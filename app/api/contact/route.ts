import { getDb } from "../../../db";
import { leads } from "../../../db/schema";

type Payload = Record<string, unknown>;
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    if (clean(payload.company)) return Response.json({ ok: true }, { status: 201 });

    const name = clean(payload.name, 100);
    const phone = clean(payload.phone, 40);
    const email = clean(payload.email, 160);
    const city = clean(payload.city, 100);
    const productType = clean(payload.productType, 100);
    const budget = clean(payload.budget, 80);
    const message = clean(payload.message, 2000);
    const consent = clean(payload.consent) === "yes";

    if (!name || !phone || !city || !productType || !message || !consent) {
      return Response.json({ error: "Completa los campos obligatorios." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "El correo no es válido." }, { status: 400 });
    }

    const db = getDb();
    const [lead] = await db.insert(leads).values({ name, phone, email: email || null, city, productType, budget: budget || null, message, consent }).returning({ id: leads.id });
    return Response.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return Response.json({ error: message.includes("no such table") ? "La base de cotizaciones aún no está inicializada." : "No fue posible guardar la solicitud." }, { status: 500 });
  }
}
