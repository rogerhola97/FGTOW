// Da de alta (o resetea la contraseña de) una cuenta de vendedor en la tabla `vendors` de Supabase.
// No hay panel de administración para esto: es el único mecanismo para crear vendedores.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-vendor.mjs "Nombre Apellido" correo@fgtow.com "contraseña"
//
// El hash debe calcularse exactamente igual que app/lib/vendorAuth.ts (PBKDF2-SHA256,
// 100000 iteraciones, salt de 16 bytes, salida de 256 bits) para que el login funcione.

import { webcrypto as crypto } from "node:crypto";

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Uso: node scripts/create-vendor.mjs "Nombre" correo@fgtow.com "contraseña"');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const PBKDF2_ITERATIONS = 100_000;

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(rawPassword) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(rawPassword), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, keyMaterial, 256);
  return { hash: toHex(bits), salt: toHex(salt) };
}

const { hash, salt } = await hashPassword(password);

const response = await fetch(`${supabaseUrl}/rest/v1/vendors?on_conflict=email`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
    prefer: "return=representation,resolution=merge-duplicates",
  },
  body: JSON.stringify({ name, email: email.toLowerCase(), password_hash: hash, password_salt: salt, active: true }),
});

if (!response.ok) {
  console.error(`Supabase rechazó el alta (${response.status}):`, await response.text());
  process.exit(1);
}

const [row] = await response.json();
console.log(`Vendedor listo: ${row?.email ?? email} (id ${row?.id ?? "?"}).`);
