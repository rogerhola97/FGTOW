type Payload = Record<string, unknown>;

const clean = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;

    // Campo señuelo: los bots suelen llenarlo, pero una persona nunca lo ve.
    if (clean(payload.company)) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const name = clean(payload.name, 100);
    const phone = clean(payload.phone, 40);
    const email = clean(payload.email, 160);
    const city = clean(payload.city, 100);
    const state = clean(payload.state, 100);
    const productType = clean(payload.productType, 100);
    const budget = clean(payload.budget, 80);
    const message = clean(payload.message, 2000);
    const consent = clean(payload.consent) === "yes";

    if (!name || !phone || !city || !state || !productType || !message || !consent) {
      return Response.json(
        { error: "Completa los campos obligatorios." },
        { status: 400 },
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: "El correo no es válido." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error("Supabase no está configurado.");
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        phone,
        email: email || null,
        city,
        state,
        product_type: productType,
        budget: budget || null,
        message,
        consent,
        source: "website",
        status: "new",
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Supabase rechazó el registro:", response.status, details);
      throw new Error("No fue posible guardar la solicitud en Supabase.");
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Error al guardar una solicitud:", error);
    return Response.json(
      { error: "No fue posible guardar la solicitud." },
      { status: 500 },
    );
  }
}
