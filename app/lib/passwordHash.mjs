// Single source of truth for vendor password hashing — shared verbatim between
// app/lib/vendorAuth.ts (runs on Cloudflare Workers) and scripts/create-vendor.mjs (runs on
// plain Node). Both runtimes expose the same Web Crypto globals (crypto.subtle, TextEncoder,
// getRandomValues) since Node 19+, so this file needs no imports and can't drift between the two
// call sites the way two separate reimplementations could.
export const PBKDF2_ITERATIONS = 100_000;
export const HASH_ALGO = "SHA-256";
export const SALT_BYTES = 16;

export function toHex(bytes) {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: HASH_ALGO }, keyMaterial, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEqualHex(hash, expectedHashHex);
}
