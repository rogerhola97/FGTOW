import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env as workerEnv } from "cloudflare:workers";
import { hashPassword, verifyPassword } from "./passwordHash.mjs";

export { hashPassword, verifyPassword };
export const VENDOR_COOKIE_NAME = "fgtow_vendor";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// process.env alone is unreliable for secrets on deployed Cloudflare Workers (it depends on the
// nodejs_compat_populate_process_env flag actually populating it in time). The `env` binding from
// cloudflare:workers is the authoritative source there — same pattern already used by db/index.ts —
// with process.env kept only as the fallback for local dev / the standalone create-vendor.mjs path.
// .trim() guards against a stray trailing space/newline from pasting the value into the dashboard.
function readEnv(name: string): string | undefined {
  const bound = (workerEnv as Record<string, unknown> | undefined)?.[name];
  if (typeof bound === "string" && bound.trim()) return bound.trim();
  const fromProcess = process.env[name];
  return typeof fromProcess === "string" && fromProcess.trim() ? fromProcess.trim() : undefined;
}

const DEBUG_ENV_NAMES = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VENDOR_SESSION_SECRET"] as const;

// TODO(temporal): quitar junto con el logging de app/api/vendedor/login/route.ts una vez
// resuelto el problema de variables de entorno en producción. No expone ningún valor, solo de
// dónde (o si) se pudo leer cada variable, para diferenciar un binding de Workers roto de un
// valor vacío/typo en el dashboard.
export function debugEnvState() {
  const workerEnvAvailable = typeof workerEnv === "object" && workerEnv !== null;
  const workerEnvKeyCount = workerEnvAvailable ? Object.keys(workerEnv as object).length : 0;
  const sources: Record<string, "workerEnv" | "processEnv" | "missing"> = {};
  for (const name of DEBUG_ENV_NAMES) {
    const fromWorker = (workerEnv as Record<string, unknown> | undefined)?.[name];
    if (typeof fromWorker === "string" && fromWorker.trim()) { sources[name] = "workerEnv"; continue; }
    const fromProcess = process.env[name];
    sources[name] = typeof fromProcess === "string" && fromProcess.trim() ? "processEnv" : "missing";
  }
  return { workerEnvAvailable, workerEnvKeyCount, sources };
}

export type VendorSession = { id: string; name: string; email: string; exp: number };
export type VendorRow = { id: string; name: string; email: string; password_hash: string; password_salt: string; active: boolean };

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
  // TODO(temporal): logging de diagnóstico — nunca imprime la key, el hash ni el salt.
  const serviceRoleType = serviceKey.startsWith("eyJ") ? "legacy_jwt" : serviceKey.startsWith("sb_secret_") ? "sb_secret" : "unknown";
  console.error(`[vendor-login-debug] service_role_present=${Boolean(serviceKey)} service_role_type=${serviceRoleType}`);

  // PostgREST resuelve el rol de Postgres (y por lo tanto si RLS se bypassea) a partir del JWT en
  // Authorization: Bearer, no de apikey — apikey solo identifica el proyecto ante el gateway. Con
  // vendors en RLS y sin policies, mandar solo apikey deja la petición corriendo como anon y
  // Supabase responde 200 con [] en vez de negar la petición, que es justo lo que se observó.
  const response = await fetch(
    `${supabaseUrl}/rest/v1/vendors?email=eq.${encodeURIComponent(email)}&select=id,name,email,password_hash,password_salt,active`,
    { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } },
  );
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error(`[vendor-login-debug] supabase_status=${response.status} response_is_array=false response_rows=0`);
    throw new Error(`Supabase rechazó la consulta de vendedores (status ${response.status}): ${details.slice(0, 300)}`);
  }
  const rows = (await response.json()) as VendorRow[];
  const isArray = Array.isArray(rows);
  console.error(`[vendor-login-debug] supabase_status=${response.status} response_is_array=${isArray} response_rows=${isArray ? rows.length : 0}`);
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
