import { cookies } from "next/headers";
import { VENDOR_COOKIE_NAME, findVendorByEmail, signVendorSession, verifyPassword } from "../../../lib/vendorAuth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const email = clean(payload.email, 160).toLowerCase();
    const password = clean(payload.password, 200);
    if (!email || !password || !emailPattern.test(email)) {
      return Response.json({ error: "Correo o contraseña inválidos." }, { status: 400 });
    }

    const vendor = await findVendorByEmail(email);
    if (!vendor || !vendor.active) {
      return Response.json({ error: "Correo o contraseña inválidos." }, { status: 401 });
    }
    const valid = await verifyPassword(password, vendor.password_salt, vendor.password_hash);
    if (!valid) {
      return Response.json({ error: "Correo o contraseña inválidos." }, { status: 401 });
    }

    const token = await signVendorSession({ id: vendor.id, name: vendor.name, email: vendor.email });
    const store = await cookies();
    // Secure is dropped outside production so the cookie still works over plain http://localhost in dev.
    store.set(VENDOR_COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    // Deliberately verbose (message + status from Supabase when available) to diagnose Workers env/
    // fetch issues from Cloudflare Logs — never logs the actual secret values, only var names/status.
    console.error(`Error en login de vendedor: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "No fue posible iniciar sesión. Intenta de nuevo." }, { status: 500 });
  }
}
