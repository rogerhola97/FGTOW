import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env as workerEnv } from "cloudflare:workers";

export const VENDOR_COOKIE_NAME = "fgtow_vendor";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 100_000;
const HASH_ALGO = "SHA-256";

// process.env alone is unreliable for secrets on deployed Cloudflare Workers (it depends on the
// nodejs_compat_populate_process_env flag actually populating it in time). The `env` binding from
// cloudflare:workers is the authoritative source there — same pattern already used by db/index.ts —
// with process.env kept only as the fallback for local dev / the standalone create-vendor.mjs path.
function readEnv(name: string): string | undefined {
  const bound = (workerEnv as Record<string, unknown> | undefined)?.[name];
  if (typeof bound === "string" && bound) return bound;
  return process.env[name];
}

export type VendorSession = { id: string; name: string; email: string; exp: number };
export type VendorRow = { id: string; name: string; email: string; password_hash: string; password_salt: string; active: boolean };

function toHex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// PBKDF2-SHA256 via Web Crypto (works in the Cloudflare Workers runtime without extra deps).
export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: HASH_ALGO }, keyMaterial, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password: string, saltHex: string, expectedHashHex: string): Promise<boolean> {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEqualHex(hash, expectedHashHex);
}

function sessionSecret() {
  const secret = readEnv("VENDOR_SESSION_SECRET");
  if (!secret) throw new Error("Falta la variable de entorno VENDOR_SESSION_SECRET.");
  return secret;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signVendorSession(vendor: { id: string; name: string; email: string }): Promise<string> {
  const payload: VendorSession = { id: vendor.id, name: vendor.name, email: vendor.email, exp: Date.now() + SESSION_TTL_MS };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await hmacKey(sessionSecret());
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return `${base64url(payloadBytes)}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyVendorSession(token: string | undefined | null): Promise<VendorSession | null> {
  if (!token) return null;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  try {
    const payloadBytes = base64urlToBytes(payloadPart);
    const key = await hmacKey(sessionSecret());
    const valid = await crypto.subtle.verify("HMAC", key, base64urlToBytes(signaturePart), payloadBytes);
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as VendorSession;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Vendor accounts live in Supabase (the app's real datastore — see app/api/quote/route.ts),
// in a `vendors` table gated by RLS with no public policies: only the service role can read it.
export async function findVendorByEmail(email: string): Promise<VendorRow | null> {
  const supabaseUrl = readEnv("SUPABASE_URL")?.replace(/\/$/, "");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    const missing = [!supabaseUrl && "SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(", ");
    throw new Error(`Faltan variables de entorno para Supabase: ${missing}`);
  }
  // Supabase's newer sb_secret_/sb_publishable_ keys aren't JWTs, so only `apikey` is sent —
  // same header pattern already used successfully in app/api/quote/route.ts and contact/route.ts.
  const response = await fetch(
    `${supabaseUrl}/rest/v1/vendors?email=eq.${encodeURIComponent(email)}&select=id,name,email,password_hash,password_salt,active`,
    { headers: { apikey: serviceKey } },
  );
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase rechazó la consulta de vendedores (status ${response.status}): ${details.slice(0, 300)}`);
  }
  const rows = (await response.json()) as VendorRow[];
  return rows[0] ?? null;
}

export async function getVendor(): Promise<VendorSession | null> {
  const store = await cookies();
  return verifyVendorSession(store.get(VENDOR_COOKIE_NAME)?.value);
}

export async function requireVendor(returnTo: string): Promise<VendorSession> {
  const vendor = await getVendor();
  if (vendor) return vendor;
  redirect(`/vendedor?return_to=${encodeURIComponent(returnTo)}`);
}

const VENDOR_PANEL_PATH = "/vendedor/panel";

// Keeps the post-login redirect inside the site and away from the login page itself,
// same spirit as safeRelativeReturnPath() in app/chatgpt-auth.ts.
export function safeVendorReturnPath(value: string | undefined | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return VENDOR_PANEL_PATH;
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return VENDOR_PANEL_PATH;
    if (url.pathname === "/vendedor") return VENDOR_PANEL_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return VENDOR_PANEL_PATH;
  }
}
