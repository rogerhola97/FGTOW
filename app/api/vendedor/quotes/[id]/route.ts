import { calculateQuote, isValidPresetId, validateLayout } from "../../../../lib/quoteCatalog";
import { clean, emailPattern, parseDoor, parseItems, parseSpecialItems, parseWindows } from "../../../../lib/quoteSubmission";
import { getQuoteById, patchQuoteById } from "../../../../lib/quotesDb";
import { getVendor } from "../../../../lib/vendorAuth";

// "Guardar cambios" en el editor de vendedor: actualiza la MISMA cotización (mismo folio y
// versión) en vez de crear una nueva — el folio/versión nueva es responsabilidad de
// POST /api/vendedor/quotes con basedOnQuoteId. Tampoco dispara correo (ver plan aprobado).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Cotización inválida." }, { status: 400 });

  try {
    const existing = await getQuoteById(id);
    if (!existing) return Response.json({ error: "La cotización no existe." }, { status: 404 });

    const payload = (await request.json()) as Record<string, unknown>;
    const name = clean(payload.name, 100);
    const phone = clean(payload.phone, 40);
    const email = clean(payload.email, 160);
    const city = clean(payload.city, 100);
    const state = clean(payload.state, 100);
    const notes = clean(payload.notes, 2000);
    const presetId = clean(payload.presetId, 60);
    const includeIva = payload.includeIva === true;
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = parseItems(rawItems);
    const specialItems = parseSpecialItems(payload.specialItems);
    const windows = parseWindows(payload.windows);

    if (!name || !phone || !email || !city || !state || !isValidPresetId(presetId) || rawItems.length !== items.length || items.length === 0) {
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

    const result = await patchQuoteById(id, {
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
      vendor_email: vendor.email,
      vendor_edited: true,
      updated_at: new Date().toISOString(),
    });
    if (!result.ok) throw new Error("No fue posible guardar los cambios.");

    return Response.json({ ok: true, id: result.row.id, quoteNumber: result.row.quote_number }, { status: 200 });
  } catch (error) {
    console.error("Error al editar una cotización desde el panel de vendedor:", error);
    return Response.json({ error: "No fue posible guardar los cambios. Intenta de nuevo." }, { status: 500 });
  }
}
