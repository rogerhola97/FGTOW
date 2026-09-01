// Da de alta (o resetea la contraseña de) una cuenta de vendedor en la tabla `vendors` de Supabase.
// No hay panel de administración para esto: es el único mecanismo para crear vendedores.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-vendor.mjs "Nombre Apellido" correo@fgtow.com "contraseña"
//
// El hash se calcula con app/lib/passwordHash.mjs — el mismo módulo que usa app/lib/vendorAuth.ts
// para verificar en el login — así que ambos lados no pueden divergir.

import { hashPassword } from "../app/lib/passwordHash.mjs";

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

const { hash, salt } = await hashPassword(password);

// vendors tiene RLS habilitado sin policies: PostgREST decide el rol (y si RLS se bypassea) a
// partir del JWT en Authorization: Bearer, no de apikey — así que se mandan ambos (mismo criterio
// que app/lib/vendorAuth.ts).
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
