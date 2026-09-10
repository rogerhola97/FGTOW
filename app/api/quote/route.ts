import { calculateQuote, isValidPresetId, validateLayout } from "../../lib/quoteCatalog";
import { clean, emailPattern, parseDoor, parseItems, parseSpecialItems, parseWindows, quoteFolio, sendQuoteEmail, verifyTurnstile } from "../../lib/quoteSubmission";
import { insertQuotePublic, patchQuoteEmailStatus } from "../../lib/quotesDb";
import { getVendor, readEnv } from "../../lib/vendorAuth";

type Payload = Record<string, unknown>;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    if (clean(payload.company)) return Response.json({ ok: true }, { status: 201 });

    // El captcha solo se le pide a un visitante público — un vendedor con sesión ya está
    // autenticado y su cotizador ni siquiera muestra el widget (ver TrailerConfigurator).
    const turnstileSecretKey = readEnv("TURNSTILE_SECRET_KEY");
    if (turnstileSecretKey && !(await getVendor())) {
      const captchaToken = clean(payload["cf-turnstile-response"], 2000);
      const captchaOk = await verifyTurnstile(captchaToken, turnstileSecretKey, request.headers.get("cf-connecting-ip") || undefined);
      if (!captchaOk) return Response.json({ error: "No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo." }, { status: 400 });
    }

    const name = clean(payload.name, 100);
    const phone = clean(payload.phone, 40);
    const email = clean(payload.email, 160);
    const city = clean(payload.city, 100);
    const state = clean(payload.state, 100);
    const notes = clean(payload.notes, 2000);
    const presetId = clean(payload.presetId, 60);
    const includeIva = payload.includeIva === true;
    const consent = clean(payload.consent) === "yes";
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = parseItems(rawItems);
    const specialItems = parseSpecialItems(payload.specialItems);
    const windows = parseWindows(payload.windows);

    if (!name || !phone || !email || !city || !state || !consent || !isValidPresetId(presetId) || rawItems.length !== items.length || items.length === 0) {
      return Response.json({ error: "Completa los datos y agrega al menos un equipo válido." }, { status: 400 });
    }
    if (!emailPattern.test(email)) return Response.json({ error: "El correo electrónico no es válido." }, { status: 400 });

    const quote = calculateQuote(presetId, items, includeIva);
    const door = parseDoor(payload.door, quote.preset.widthCm, quote.preset.lengthCm);
    const layoutErrors = validateLayout(quote.preset, items, door);
    if (layoutErrors.length) return Response.json({ error: `El plano requiere ajustes: ${layoutErrors[0]}` }, { status: 400 });

    const specialTotal = specialItems.reduce((sum, entry) => sum + entry.price, 0);
    const combinedSubtotal = quote.subtotal + specialTotal;
    const combinedIva = includeIva ? Math.round(combinedSubtotal * 0.16) : 0;
    const combinedTotal = combinedSubtotal + combinedIva;

    const folio = quoteFolio();
    const toEmail = readEnv("QUOTE_TO_EMAIL") || "contacto@fgtow.com";

    // 1) Se guarda primero en Supabase (con el correo marcado como pendiente). Si esto falla se
    // responde el error real de inmediato y NUNCA se manda el correo — antes se mandaba el
    // correo primero y, si el guardado fallaba después, el sitio mostraba un error genérico aunque
    // el correo ya hubiera salido; cada reintento del cliente mandaba otro correo duplicado sin
    // que nada se guardara.
    const insertResult = await insertQuotePublic({
      quote_number: folio,
      name,
      phone,
      email,
      city,
      state,
      notes: notes || null,
      trailer_preset: quote.preset.id,
      model: quote.preset.model,
      trailer_width_cm: quote.preset.widthCm,
      trailer_length_cm: quote.preset.lengthCm,
      axles: quote.preset.axles,
      configuration: { version: 3, items, door, windows, specialItems },
      subtotal: combinedSubtotal,
      iva: combinedIva,
      total: combinedTotal,
      include_iva: includeIva,
      email_to: toEmail,
      email_sent: false,
      email_error: "Pendiente de envío.",
      consent: true,
      source: "website-2d",
      status: "email_pending",
    });
    if (!insertResult.ok) throw new Error("No fue posible guardar la cotización.");

    // 2) Ya con la cotización guardada, se intenta el correo — su resultado ya no puede hacer
    // perder el registro ni disparar un reintento que duplique el envío.
    const { emailSent, emailError } = await sendQuoteEmail({
      folio, name, phone, email, city, state, notes, presetId, items, includeIva, door, specialItems,
      preset: quote.preset,
      resendApiKey: readEnv("RESEND_API_KEY"),
      toEmail,
      fromEmail: readEnv("QUOTE_FROM_EMAIL") || "FG TOW Cotizaciones <cotizaciones@fgtow.com>",
    });

    // 3) Se corrige el estado real de envío en el registro ya guardado.
    await patchQuoteEmailStatus(folio, { email_sent: emailSent, email_error: emailError, status: emailSent ? "new" : "email_pending" });

    return Response.json({
      ok: true,
      quoteNumber: folio,
      emailSent,
      message: emailSent ? `Cotización ${folio} enviada a contacto@fgtow.com.` : `Cotización ${folio} guardada. Falta activar el servicio de correo para su envío automático.`,
    }, { status: 201 });
  } catch (error) {
    console.error("Error al procesar la cotización:", error);
    return Response.json({ error: "No fue posible guardar o enviar la cotización. Intenta de nuevo." }, { status: 500 });
  }
}
