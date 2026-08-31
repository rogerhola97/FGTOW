import { cookies } from "next/headers";
import { VENDOR_COOKIE_NAME } from "../../../lib/vendorAuth";

export async function POST() {
  const store = await cookies();
  store.delete(VENDOR_COOKIE_NAME);
  return Response.json({ ok: true }, { status: 200 });
}
