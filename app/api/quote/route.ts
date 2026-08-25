import { DOOR_MAX_WIDTH_CM, DOOR_MIN_WIDTH_CM, DoorConfig, MODEL_META, PlacedEquipment, TRAILER_PRESETS, WALL_LABEL, calculateQuote, defaultDoor, getEquipment, money, validateLayout } from "../../lib/quoteCatalog";

type Payload = Record<string, unknown>;

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseItems(value: unknown): PlacedEquipment[] {
  if (!Array.isArray(value) || value.length > 40) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const typeId = clean(item.typeId, 60);
    const definition = getEquipment(typeId);
    if (!definition) return [];
    const numbers = [item.xCm, item.yCm, item.widthCm, item.depthCm].map(Number);
    if (numbers.some((number) => !Number.isFinite(number))) return [];
    return [{
      instanceId: clean(item.instanceId, 80) || crypto.randomUUID(),
      typeId,
      xCm: Math.round(numbers[0]),
      yCm: Math.round(numbers[1]),
      widthCm: Math.round(numbers[2]),
      depthCm: Math.round(numbers[3]),
      rotation: Number(item.rotation) === 90 ? 90 as const : 0 as const,
    }];
  });
}

function parseDoor(value: unknown, trailerWidthCm: number, trailerLengthCm: number): DoorConfig {
  const fallback = defaultDoor(trailerWidthCm);
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const wall = raw.wall;
  if (wall !== "front" && wall !== "back" && wall !== "left" && wall !== "right") return fallback;
  const widthCm = Number(raw.widthCm);
  const offsetCm = Number(raw.offsetCm);
  if (!Number.isFinite(widthCm) || !Number.isFinite(offsetCm)) return fallback;
  const span = wall === "front" || wall === "back" ? trailerWidthCm : trailerLengthCm;
  const clampedWidth = Math.min(Math.max(widthCm, DOOR_MIN_WIDTH_CM), Math.min(DOOR_MAX_WIDTH_CM, span));
  const clampedOffset = Math.min(Math.max(offsetCm, 0), Math.max(0, span - clampedWidth));
  return { wall, offsetCm: clampedOffset, widthCm: clampedWidth };
}

function doorLineSvg(door: DoorConfig, preset: { widthCm: number; lengthCm: number }) {
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  if (door.wall === "front") { x1 = door.offsetCm; y1 = 0; x2 = door.offsetCm + door.widthCm; y2 = 0; }
  else if (door.wall === "back") { x1 = door.offsetCm; y1 = preset.lengthCm; x2 = door.offsetCm + door.widthCm; y2 = preset.lengthCm; }
  else if (door.wall === "left") { x1 = 0; y1 = door.offsetCm; x2 = 0; y2 = door.offsetCm + door.widthCm; }
  else { x1 = preset.widthCm; y1 = door.offsetCm; x2 = preset.widthCm; y2 = door.offsetCm + door.widthCm; }
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d6a229" stroke-width="6"/>`;
}

function quoteFolio() {
  const date = new Date();
  const stamp = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `FGT-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function makePlanSvg(presetId: string, items: PlacedEquipment[], door: DoorConfig) {
  const quote = calculateQuote(presetId, items, false);
  const { preset } = quote;
  const equipment = items.map((item, index) => {
    const definition = getEquipment(item.typeId)!;
    return `<g transform="translate(${item.xCm} ${item.yCm})"><rect width="${item.widthCm}" height="${item.depthCm}" rx="3" fill="${definition.color}" stroke="#0a3550" stroke-width="2"/><text x="${item.widthCm / 2}" y="${item.depthCm / 2}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-family="Arial" font-size="7" font-weight="700">${index + 1}. ${escapeHtml(definition.shortName)}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-35 -80 ${preset.widthCm + 70} ${preset.lengthCm + 120}" width="900" height="1200"><rect width="100%" height="100%" x="-35" y="-80" fill="#f7f8f6"/><path d="M ${preset.widthCm / 2 - 45} 0 L ${preset.widthCm / 2} -65 L ${preset.widthCm / 2 + 45} 0" fill="none" stroke="#0a3550" stroke-width="4"/><rect x="0" y="0" width="${preset.widthCm}" height="${preset.lengthCm}" rx="3" fill="#fff" stroke="#0a3550" stroke-width="5"/><line x1="${preset.widthCm / 2}" x2="${preset.widthCm / 2}" y1="8" y2="${preset.lengthCm - 8}" stroke="#d6a229" stroke-dasharray="7 6" stroke-width="1.5"/>${equipment}${doorLineSvg(door, preset)}<text x="${preset.widthCm / 2}" y="-18" text-anchor="middle" fill="#0a3550" font-family="Arial" font-size="8" font-weight="700">FG TOW · FRENTE / TIRÓN</text><text x="${preset.widthCm / 2}" y="${preset.lengthCm + 26}" text-anchor="middle" fill="#0a3550" font-family="Arial" font-size="9" font-weight="700">${(preset.widthCm / 100).toFixed(2)} × ${(preset.lengthCm / 100).toFixed(2)} m</text></svg>`;
}

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + 8192)));
  return btoa(binary);
}

function makeEmailHtml(args: { folio: string; name: string; phone: string; email: string; city: string; notes: string; presetId: string; items: PlacedEquipment[]; includeIva: boolean; door: DoorConfig }) {
  const quote = calculateQuote(args.presetId, args.items, args.includeIva);
  const modelLabel = MODEL_META[quote.preset.model].shortLabel.toUpperCase();
  const rows = quote.lines.map((line, index) => `<tr><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${String(index + 2).padStart(2, "0")}</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${escapeHtml(line.definition.name)}</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${line.item.widthCm} × ${line.item.depthCm} cm</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2;text-align:right;font-weight:700">${line.included ? "Incluido" : line.linePrice ? money(line.linePrice) : "$0"}</td></tr>`).join("");
  const doorRow = `<tr><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">--</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">Puerta (${escapeHtml(WALL_LABEL[args.door.wall])})</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${args.door.widthCm} cm</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2;text-align:right;font-weight:700">Incluida</td></tr>`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#edf0ee;font-family:Arial,sans-serif;color:#06293e"><div style="max-width:760px;margin:0 auto;padding:28px 14px"><div style="background:#fff;border-top:7px solid #d6a229;padding:30px"><table style="width:100%;border-collapse:collapse"><tr><td><img src="https://fgtow.com/fg-tow-logo.png" alt="FG TOW" width="190" style="display:block;max-width:190px"></td><td style="text-align:right"><div style="font-size:11px;letter-spacing:1.5px;color:#075274;font-weight:800">COTIZACIÓN PRELIMINAR</div><div style="font-size:20px;font-weight:900;margin-top:6px">${escapeHtml(args.folio)}</div></td></tr></table><div style="background:#06293e;color:#fff;padding:20px;margin:28px 0;display:block"><div style="font-size:11px;color:#d6a229;letter-spacing:1px">${escapeHtml(modelLabel)} CONFIGURADO</div><div style="font-size:26px;font-weight:900;margin-top:5px">${(quote.preset.widthCm / 100).toFixed(2)} × ${(quote.preset.lengthCm / 100).toFixed(2)} m · ${quote.preset.axles === 2 ? "DOBLE EJE" : "1 EJE"}</div></div><h2 style="font-size:16px;text-transform:uppercase">Datos del cliente</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:7px 0"><b>Nombre:</b> ${escapeHtml(args.name)}</td><td style="padding:7px 0"><b>Teléfono:</b> ${escapeHtml(args.phone)}</td></tr><tr><td style="padding:7px 0"><b>Correo:</b> ${escapeHtml(args.email)}</td><td style="padding:7px 0"><b>Ciudad:</b> ${escapeHtml(args.city)}</td></tr></table><h2 style="font-size:16px;text-transform:uppercase;margin-top:30px">Desglose aproximado</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#edf0ee"><th style="padding:10px;text-align:left">#</th><th style="padding:10px;text-align:left">Concepto</th><th style="padding:10px;text-align:left">Medida</th><th style="padding:10px;text-align:right">Importe</th></tr></thead><tbody><tr><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">01</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">Remolque base</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${quote.preset.label}</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2;text-align:right;font-weight:700">${money(quote.preset.basePrice)}</td></tr>${doorRow}${rows}</tbody></table><div style="margin:24px 0 0 auto;width:280px;font-size:13px"><div style="display:flex;justify-content:space-between;padding:7px 0"><span>Subtotal</span><b>${money(quote.subtotal)}</b></div><div style="display:flex;justify-content:space-between;padding:7px 0"><span>IVA</span><b>${money(quote.iva)}</b></div><div style="display:flex;justify-content:space-between;padding:13px 0;border-top:2px solid #d6a229;font-size:19px"><span>Total estimado</span><b>${money(quote.total)}</b></div></div>${args.notes ? `<h2 style="font-size:16px;text-transform:uppercase;margin-top:30px">Notas del cliente</h2><p style="font-size:13px;line-height:1.6">${escapeHtml(args.notes)}</p>` : ""}<div style="margin-top:30px;padding:18px;background:#f7f8f6;border-left:4px solid #d6a229;font-size:11px;line-height:1.55"><b>Estimación preliminar:</b> requiere revisión de ingeniería, distribución de peso, capacidad, instalaciones, acabados, impuestos y disponibilidad. El archivo SVG adjunto contiene el plano 2D enviado por el cliente.</div></div><div style="padding:18px 28px;background:#06293e;color:#fff;font-size:11px;display:flex;justify-content:space-between"><span>FG TOW · Parte de FG PRO</span><span>contacto@fgtow.com · fgtow.com</span></div></div></body></html>`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    if (clean(payload.company)) return Response.json({ ok: true }, { status: 201 });

    const name = clean(payload.name, 100);
    const phone = clean(payload.phone, 40);
    const email = clean(payload.email, 160);
    const city = clean(payload.city, 100);
    const notes = clean(payload.notes, 2000);
    const presetId = clean(payload.presetId, 60);
    const includeIva = payload.includeIva === true;
    const consent = clean(payload.consent) === "yes";
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = parseItems(rawItems);

    if (!name || !phone || !email || !city || !consent || !TRAILER_PRESETS.some((preset) => preset.id === presetId) || rawItems.length !== items.length || items.length === 0) {
      return Response.json({ error: "Completa los datos y agrega al menos un equipo válido." }, { status: 400 });
    }
    if (!emailPattern.test(email)) return Response.json({ error: "El correo electrónico no es válido." }, { status: 400 });

    const quote = calculateQuote(presetId, items, includeIva);
    const door = parseDoor(payload.door, quote.preset.widthCm, quote.preset.lengthCm);
    const layoutErrors = validateLayout(quote.preset, items, door);
    if (layoutErrors.length) return Response.json({ error: `El plano requiere ajustes: ${layoutErrors[0]}` }, { status: 400 });

    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabasePublishableKey) throw new Error("Supabase no está configurado.");

    const folio = quoteFolio();
    const planSvg = makePlanSvg(presetId, items, door);
    const resendApiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.QUOTE_TO_EMAIL || "contacto@fgtow.com";
    const fromEmail = process.env.QUOTE_FROM_EMAIL || "FG TOW Cotizaciones <cotizaciones@fgtow.com>";
    let emailSent = false;
    let emailError: string | null = null;

    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${resendApiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            reply_to: email,
            subject: `${folio} · ${MODEL_META[quote.preset.model].shortLabel} ${(quote.preset.widthCm / 100).toFixed(2)} × ${(quote.preset.lengthCm / 100).toFixed(2)} m · ${name}`,
            html: makeEmailHtml({ folio, name, phone, email, city, notes, presetId, items, includeIva, door }),
            attachments: [{ filename: `${folio}-plano.svg`, content: toBase64(planSvg) }],
            tags: [{ name: "source", value: "fgtow_configurator" }],
          }),
        });
        if (!emailResponse.ok) throw new Error(`Resend ${emailResponse.status}: ${(await emailResponse.text()).slice(0, 300)}`);
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message.slice(0, 500) : "No fue posible enviar el correo.";
        console.error("No fue posible enviar la cotización por correo:", emailError);
      }
    } else {
      emailError = "RESEND_API_KEY no configurada";
    }

    const databaseResponse = await fetch(`${supabaseUrl}/rest/v1/quotes`, {
      method: "POST",
      headers: { apikey: supabasePublishableKey, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({
        quote_number: folio,
        name,
        phone,
        email,
        city,
        notes: notes || null,
        trailer_preset: quote.preset.id,
        trailer_width_cm: quote.preset.widthCm,
        trailer_length_cm: quote.preset.lengthCm,
        axles: quote.preset.axles,
        configuration: { version: 2, items, door },
        subtotal: quote.subtotal,
        iva: quote.iva,
        total: quote.total,
        include_iva: includeIva,
        email_to: toEmail,
        email_sent: emailSent,
        email_error: emailError,
        consent: true,
        source: "website-2d",
        status: emailSent ? "new" : "email_pending",
      }),
    });
    if (!databaseResponse.ok) {
      const details = await databaseResponse.text();
      console.error("Supabase rechazó la cotización:", databaseResponse.status, details);
      throw new Error("No fue posible guardar la cotización.");
    }

    return Response.json({
      ok: true,
      quoteNumber: folio,
      emailSent,
      message: emailSent ? `Cotización ${folio} enviada a contacto@fgtow.com.` : `Cotización ${folio} guardada en Supabase. Falta activar el servicio de correo para su envío automático.`,
    }, { status: 201 });
  } catch (error) {
    console.error("Error al procesar la cotización:", error);
    return Response.json({ error: "No fue posible guardar o enviar la cotización. Intenta de nuevo." }, { status: 500 });
  }
}
