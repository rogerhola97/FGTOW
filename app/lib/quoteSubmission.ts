// Lógica compartida entre el envío público (app/api/quote/route.ts) y el panel de vendedor
// (app/api/vendedor/quotes/*): parseo/validación del payload del configurador, cálculo del
// plano SVG y del correo, y el folio. Antes vivía duplicada/privada dentro de api/quote/route.ts.
import {
  DOOR_MAX_WIDTH_CM,
  DOOR_MIN_WIDTH_CM,
  DoorConfig,
  MODEL_META,
  PlacedEquipment,
  WALL_LABEL,
  WindowConfig,
  axleLabel,
  calculateQuote,
  clampWindowHeightCm,
  clampWindowWidthCm,
  defaultDoor,
  getEquipment,
  money,
} from "./quoteCatalog";

export const clean = (value: unknown, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : "");
export const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseItems(value: unknown): PlacedEquipment[] {
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

export type SpecialItem = { name: string; widthCm: number; depthCm: number; price: number };

export function parseSpecialItems(value: unknown): SpecialItem[] {
  if (!Array.isArray(value) || value.length > 20) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Record<string, unknown>;
    const name = clean(raw.name, 120);
    const widthCm = Number(raw.widthCm);
    const depthCm = Number(raw.depthCm);
    const price = Number(raw.price);
    if (!name || !Number.isFinite(widthCm) || widthCm <= 0 || !Number.isFinite(depthCm) || depthCm <= 0 || !Number.isFinite(price) || price < 0) return [];
    return [{ name, widthCm: Math.round(widthCm), depthCm: Math.round(depthCm), price: Math.round(price) }];
  });
}

export function parseDoor(value: unknown, trailerWidthCm: number, trailerLengthCm: number): DoorConfig {
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

// Los recuadros de ventana son solo decorativos (no afectan precio ni validación de choques),
// así que basta con acotarlos a rangos razonables en vez de rechazar el envío completo.
export function parseWindows(value: unknown): WindowConfig[] {
  if (!Array.isArray(value) || value.length > 20) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Record<string, unknown>;
    const wall = raw.wall;
    if (wall !== "front" && wall !== "back" && wall !== "left" && wall !== "right") return [];
    const offsetCm = Number(raw.offsetCm);
    const widthCm = Number(raw.widthCm);
    const heightCm = Number(raw.heightCm);
    if (!Number.isFinite(offsetCm) || !Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return [];
    return [{
      id: clean(raw.id, 80) || crypto.randomUUID(),
      wall,
      offsetCm: Math.max(0, Math.round(offsetCm)),
      widthCm: Math.round(clampWindowWidthCm(widthCm)),
      heightCm: Math.round(clampWindowHeightCm(heightCm)),
    }];
  });
}

export function quoteFolio() {
  const date = new Date();
  const stamp = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `FGT-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function doorLineSvg(door: DoorConfig, preset: { widthCm: number; lengthCm: number }) {
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  if (door.wall === "front") { x1 = door.offsetCm; y1 = 0; x2 = door.offsetCm + door.widthCm; y2 = 0; }
  else if (door.wall === "back") { x1 = door.offsetCm; y1 = preset.lengthCm; x2 = door.offsetCm + door.widthCm; y2 = preset.lengthCm; }
  else if (door.wall === "left") { x1 = 0; y1 = door.offsetCm; x2 = 0; y2 = door.offsetCm + door.widthCm; }
  else { x1 = preset.widthCm; y1 = door.offsetCm; x2 = preset.widthCm; y2 = door.offsetCm + door.widthCm; }
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d6a229" stroke-width="6"/>`;
}

export function makePlanSvg(presetId: string, items: PlacedEquipment[], door: DoorConfig) {
  const quote = calculateQuote(presetId, items, [], false);
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

export function makeEmailHtml(args: { folio: string; name: string; phone: string; email: string; city: string; state: string; notes: string; presetId: string; items: PlacedEquipment[]; includeIva: boolean; door: DoorConfig; specialItems: SpecialItem[] }) {
  const quote = calculateQuote(args.presetId, args.items, args.specialItems, args.includeIva);
  const modelLabel = MODEL_META[quote.preset.model].shortLabel.toUpperCase();
  const combinedSubtotal = quote.subtotal;
  const combinedIva = quote.iva;
  const combinedTotal = quote.total;
  const rows = quote.lines.map((line, index) => `<tr><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${String(index + 2).padStart(2, "0")}</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${escapeHtml(line.definition.name)}</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${line.item.widthCm} × ${line.item.depthCm} cm</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2;text-align:right;font-weight:700">${line.included ? "Incluido" : money(line.linePrice)}</td></tr>`).join("");
  const specialRows = quote.specialLines.map((entry, index) => `<tr><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${String(quote.lines.length + index + 2).padStart(2, "0")}</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${escapeHtml(entry.name)} (especial)</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${entry.widthCm} × ${entry.depthCm} cm</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2;text-align:right;font-weight:700">${entry.included ? "Incluido" : money(entry.linePrice)}</td></tr>`).join("");
  const doorRow = `<tr><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">--</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">Puerta (${escapeHtml(WALL_LABEL[args.door.wall])})</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${args.door.widthCm} cm</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2;text-align:right;font-weight:700">Incluida</td></tr>`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#edf0ee;font-family:Arial,sans-serif;color:#06293e"><div style="max-width:760px;margin:0 auto;padding:28px 14px"><div style="background:#fff;border-top:7px solid #d6a229;padding:30px"><table style="width:100%;border-collapse:collapse"><tr><td><img src="https://fgtow.com/fg-tow-logo.png" alt="FG TOW" width="190" style="display:block;max-width:190px"></td><td style="text-align:right"><div style="font-size:11px;letter-spacing:1.5px;color:#075274;font-weight:800">COTIZACIÓN PRELIMINAR</div><div style="font-size:20px;font-weight:900;margin-top:6px">${escapeHtml(args.folio)}</div></td></tr></table><div style="background:#06293e;color:#fff;padding:20px;margin:28px 0;display:block"><div style="font-size:11px;color:#d6a229;letter-spacing:1px">${escapeHtml(modelLabel)} CONFIGURADO</div><div style="font-size:26px;font-weight:900;margin-top:5px">${(quote.preset.widthCm / 100).toFixed(2)} × ${(quote.preset.lengthCm / 100).toFixed(2)} m · ${axleLabel(quote.preset.axles).toUpperCase()}</div></div><h2 style="font-size:16px;text-transform:uppercase">Datos del cliente</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:7px 0"><b>Nombre:</b> ${escapeHtml(args.name)}</td><td style="padding:7px 0"><b>Teléfono:</b> ${escapeHtml(args.phone)}</td></tr><tr><td style="padding:7px 0"><b>Correo:</b> ${escapeHtml(args.email)}</td><td style="padding:7px 0"><b>Ciudad:</b> ${escapeHtml(args.city)}</td></tr><tr><td style="padding:7px 0"><b>Estado:</b> ${escapeHtml(args.state)}</td></tr></table><h2 style="font-size:16px;text-transform:uppercase;margin-top:30px">Desglose aproximado</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#edf0ee"><th style="padding:10px;text-align:left">#</th><th style="padding:10px;text-align:left">Concepto</th><th style="padding:10px;text-align:left">Medida</th><th style="padding:10px;text-align:right">Importe</th></tr></thead><tbody><tr><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">01</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">Remolque base</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2">${quote.preset.label}</td><td style="padding:9px 10px;border-bottom:1px solid #dde3e2;text-align:right;font-weight:700">${money(quote.preset.basePrice)}</td></tr>${doorRow}${rows}${specialRows}</tbody></table><div style="margin:24px 0 0 auto;width:280px;font-size:13px"><div style="display:flex;justify-content:space-between;padding:7px 0"><span>Subtotal</span><b>${money(combinedSubtotal)}</b></div><div style="display:flex;justify-content:space-between;padding:7px 0"><span>IVA</span><b>${money(combinedIva)}</b></div><div style="display:flex;justify-content:space-between;padding:13px 0;border-top:2px solid #d6a229;font-size:19px"><span>Total estimado</span><b>${money(combinedTotal)}</b></div></div>${args.notes ? `<h2 style="font-size:16px;text-transform:uppercase;margin-top:30px">Notas del cliente</h2><p style="font-size:13px;line-height:1.6">${escapeHtml(args.notes)}</p>` : ""}<div style="margin-top:30px;padding:18px;background:#f7f8f6;border-left:4px solid #d6a229;font-size:11px;line-height:1.55"><b>Estimación preliminar:</b> requiere revisión de ingeniería, distribución de peso, capacidad, instalaciones, acabados, impuestos y disponibilidad. El archivo SVG adjunto contiene el plano enviado por el cliente.</div></div><div style="padding:18px 28px;background:#06293e;color:#fff;font-size:11px;display:flex;justify-content:space-between"><span>FG TOW · De FG INV</span><span>contacto@fgtow.com · fgtow.com</span></div></div></body></html>`;
}

export type SendEmailArgs = {
  folio: string; name: string; phone: string; email: string; city: string; state: string; notes: string;
  presetId: string; items: PlacedEquipment[]; includeIva: boolean; door: DoorConfig; specialItems: SpecialItem[];
  preset: { widthCm: number; lengthCm: number; model: string };
  resendApiKey: string | undefined; toEmail: string; fromEmail: string;
};

// Envía el correo con Resend. No lanza: siempre regresa {emailSent, emailError} para que quien
// llama decida qué hacer (nunca debe volver a intentarse un envío ya hecho ante un error de otra parte).
export async function sendQuoteEmail(args: SendEmailArgs): Promise<{ emailSent: boolean; emailError: string | null }> {
  if (!args.resendApiKey) return { emailSent: false, emailError: "RESEND_API_KEY no configurada" };
  try {
    const planSvg = makePlanSvg(args.presetId, args.items, args.door);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${args.resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: args.fromEmail,
        to: [args.toEmail],
        reply_to: args.email,
        subject: `${args.folio} · ${MODEL_META[args.preset.model as keyof typeof MODEL_META].shortLabel} ${(args.preset.widthCm / 100).toFixed(2)} × ${(args.preset.lengthCm / 100).toFixed(2)} m · ${args.name}`,
        html: makeEmailHtml(args),
        attachments: [{ filename: `${args.folio}-plano.svg`, content: toBase64(planSvg) }],
        tags: [{ name: "source", value: "fgtow_configurator" }],
      }),
    });
    if (!emailResponse.ok) throw new Error(`Resend ${emailResponse.status}: ${(await emailResponse.text()).slice(0, 300)}`);
    return { emailSent: true, emailError: null };
  } catch (error) {
    const emailError = error instanceof Error ? error.message.slice(0, 500) : "No fue posible enviar el correo.";
    console.error("No fue posible enviar la cotización por correo:", emailError);
    return { emailSent: false, emailError };
  }
}

// Verifica el token de Cloudflare Turnstile del formulario público de /api/quote contra la API de
// siteverify. Nunca lanza: un error de red o de Cloudflare se trata igual que un token inválido,
// para que quien llama rechace el envío en vez de dejarlo pasar por accidente.
export async function verifyTurnstile(token: string, secretKey: string, remoteIp?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("No fue posible verificar el captcha:", error);
    return false;
  }
}
