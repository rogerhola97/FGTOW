// Exporta el plano 2D del configurador como una hoja tamaño carta/A4 vertical: SVG autónomo que
// luego se imprime (iframe oculto), se rasteriza a PNG o se envuelve en un PDF de una sola página.
// Sin dependencias: el PDF es un contenedor mínimo con la imagen JPEG embebida (DCTDecode).

import { OVERLAY_FILL_OPACITY, type Wall } from "./quoteCatalog";

export type PlanExportItem = {
  number: number;
  name: string;
  shortName: string;
  color: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  alongCm: number;
  depthLabelCm: number;
  wallLabel: string;
  exterior: boolean;
  // Elemento sobrepuesto (campana, repisas): semitransparente y dibujado encima de los demás.
  overlay?: boolean;
};

export type PlanExportTableSide = { lineX: number; centerX: number; labels: { y: number; fontSize: number }[] };

export type PlanExportLine = { wall: Wall; offsetCm: number; widthCm: number };

export type PlanExportData = {
  title: string;
  subtitle: string;
  reference: string;
  customer?: string;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  exteriorCm: number;
  axleWheelYs: number[];
  axleWheelHeightCm: number;
  items: PlanExportItem[];
  door: PlanExportLine & { wallLabel: string };
  windows: PlanExportLine[];
  workTable?: { label: string; sides: PlanExportTableSide[] } | null;
};

const PAGE_W = 1240;
const PAGE_H = 1754;
const FONT = "Helvetica, Arial, sans-serif";

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (value: number) => Number(value.toFixed(1)).toString();
const meters = (cm: number) => `${(cm / 100).toFixed(2)} m`;

function lineCoords(line: PlanExportLine, widthCm: number, lengthCm: number) {
  const { wall, offsetCm, widthCm: span } = line;
  if (wall === "front") return { x1: offsetCm, y1: 0, x2: offsetCm + span, y2: 0 };
  if (wall === "back") return { x1: offsetCm, y1: lengthCm, x2: offsetCm + span, y2: lengthCm };
  if (wall === "left") return { x1: 0, y1: offsetCm, x2: 0, y2: offsetCm + span };
  return { x1: widthCm, y1: offsetCm, x2: widthCm, y2: offsetCm + span };
}

export function buildPlanSvg(data: PlanExportData) {
  const { widthCm, lengthCm, exteriorCm: ext } = data;
  const legendEntries = data.items.length + 1 + (data.windows.length ? 1 : 0);
  const legendRows = Math.ceil(legendEntries / 2);
  const legendH = 84 + legendRows * 36;
  const headerH = 150;
  const footerH = 56;
  const area = { x: 60, y: headerH + 40, w: PAGE_W - 120, h: PAGE_H - headerH - 40 - legendH - footerH - 30 };
  const dimSpace = 70;
  const s = Math.min(3, (area.w - dimSpace * 2) / (widthCm + ext * 2), (area.h - dimSpace) / (lengthCm + ext * 2));
  const drawW = (widthCm + ext * 2) * s;
  const drawH = (lengthCm + ext * 2) * s;
  const ox = area.x + (area.w - drawW) / 2 + ext * s;
  const oy = area.y + (area.h - dimSpace - drawH) / 2 + ext * s;
  const X = (cm: number) => ox + cm * s;
  const Y = (cm: number) => oy + cm * s;
  const out: string[] = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}" font-family="${FONT}">`);
  out.push(`<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`);

  // Encabezado
  out.push(`<rect width="${PAGE_W}" height="${headerH}" fill="#06293e"/><rect y="${headerH}" width="${PAGE_W}" height="6" fill="#d6a229"/>`);
  out.push(`<text x="60" y="52" fill="#d6a229" font-size="15" font-weight="700" letter-spacing="2.5">FG TOW · PLANO DE DISTRIBUCIÓN</text>`);
  out.push(`<text x="60" y="96" fill="#ffffff" font-size="34" font-weight="700">${esc(data.title)}</text>`);
  out.push(`<text x="60" y="126" fill="#c9d6dd" font-size="17">${esc(data.subtitle)}</text>`);
  out.push(`<text x="${PAGE_W - 60}" y="58" fill="#ffffff" font-size="18" font-weight="700" text-anchor="end">${esc(data.reference)}</text>`);
  if (data.customer) out.push(`<text x="${PAGE_W - 60}" y="88" fill="#c9d6dd" font-size="16" text-anchor="end">${esc(data.customer)}</text>`);
  out.push(`<text x="${PAGE_W - 60}" y="118" fill="#c9d6dd" font-size="14" text-anchor="end">${esc(new Date().toLocaleDateString("es-MX", { dateStyle: "long" }))}</text>`);

  // Zona exterior
  out.push(`<rect x="${fmt(X(-ext))}" y="${fmt(Y(-ext))}" width="${fmt(drawW)}" height="${fmt(drawH)}" fill="#f6f8f7" stroke="#9fb0b6" stroke-width="1.2" stroke-dasharray="8 6"/>`);
  out.push(`<text x="${fmt(X(-ext) + 8)}" y="${fmt(Y(-ext) + 18)}" fill="#6b7f88" font-size="12" font-weight="700" letter-spacing="1.5">ZONA EXTERIOR</text>`);

  // Tirón (frente)
  const tongue = Math.min(65, ext - 5);
  out.push(`<path d="M ${fmt(X(widthCm / 2 - 45))} ${fmt(Y(0))} L ${fmt(X(widthCm / 2))} ${fmt(Y(-tongue))} L ${fmt(X(widthCm / 2 + 45))} ${fmt(Y(0))}" fill="none" stroke="#0a3550" stroke-width="3"/>`);
  out.push(`<circle cx="${fmt(X(widthCm / 2))}" cy="${fmt(Y(-tongue))}" r="5" fill="#fff" stroke="#0a3550" stroke-width="2.5"/>`);

  // Llantas
  for (const y of data.axleWheelYs) {
    out.push(`<rect x="${fmt(X(-23))}" y="${fmt(Y(y))}" width="${fmt(23 * s)}" height="${fmt(data.axleWheelHeightCm * s)}" rx="4" fill="#092f46"/>`);
    out.push(`<rect x="${fmt(X(widthCm))}" y="${fmt(Y(y))}" width="${fmt(23 * s)}" height="${fmt(data.axleWheelHeightCm * s)}" rx="4" fill="#092f46"/>`);
  }

  // Caja del remolque con cuadrícula cada 50 cm
  out.push(`<rect x="${fmt(X(0))}" y="${fmt(Y(0))}" width="${fmt(widthCm * s)}" height="${fmt(lengthCm * s)}" fill="#ffffff"/>`);
  for (let v = 50; v < widthCm; v += 50) out.push(`<line x1="${fmt(X(v))}" y1="${fmt(Y(0))}" x2="${fmt(X(v))}" y2="${fmt(Y(lengthCm))}" stroke="#e1e8e8" stroke-width="1"/>`);
  for (let v = 50; v < lengthCm; v += 50) out.push(`<line x1="${fmt(X(0))}" y1="${fmt(Y(v))}" x2="${fmt(X(widthCm))}" y2="${fmt(Y(v))}" stroke="#e1e8e8" stroke-width="1"/>`);
  out.push(`<rect x="${fmt(X(0))}" y="${fmt(Y(0))}" width="${fmt(widthCm * s)}" height="${fmt(lengthCm * s)}" fill="none" stroke="#0a3550" stroke-width="4"/>`);
  out.push(`<text x="${fmt(X(widthCm / 2))}" y="${fmt(Y(-tongue) - 12)}" fill="#0a3550" font-size="12" font-weight="700" text-anchor="middle" letter-spacing="1.5">FRENTE</text>`);

  // Mesa de trabajo (solo laterales) con su leyenda en los tramos libres
  for (const side of data.workTable?.sides ?? []) {
    out.push(`<line x1="${fmt(X(side.lineX))}" y1="${fmt(Y(0))}" x2="${fmt(X(side.lineX))}" y2="${fmt(Y(lengthCm))}" stroke="#5f7481" stroke-width="1.5" stroke-dasharray="7 6" opacity=".65"/>`);
    for (const label of side.labels) {
      out.push(`<text x="${fmt(X(side.centerX))}" y="${fmt(Y(label.y))}" fill="#7b8a90" opacity=".7" font-size="${fmt(label.fontSize * s)}" font-weight="700" letter-spacing="1" text-anchor="middle" dominant-baseline="central" transform="rotate(-90 ${fmt(X(side.centerX))} ${fmt(Y(label.y))})">${esc(data.workTable?.label ?? "")}</text>`);
    }
  }

  // Aditamentos (los sobrepuestos al final, semitransparentes)
  for (const item of [...data.items].sort((a, b) => Number(Boolean(a.overlay)) - Number(Boolean(b.overlay)))) {
    const x = X(item.xCm), y = Y(item.yCm), w = item.widthCm * s, h = item.depthCm * s;
    out.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="3" fill="${esc(item.color)}" fill-opacity="${item.overlay ? OVERLAY_FILL_OPACITY : 0.92}" stroke="#0a3550" stroke-width="1.5"${item.exterior || item.overlay ? ` stroke-dasharray="5 3"` : ""}/>`);
    const fontSize = Math.max(11, Math.min(20, Math.min(w, h) * 0.45));
    const label = w > item.shortName.length * fontSize * 0.62 + 34 && h > fontSize * 2.4 ? `${item.number}. ${item.shortName}` : String(item.number);
    out.push(`<text x="${fmt(x + w / 2)}" y="${fmt(y + h / 2)}" fill="#ffffff" stroke="#06293e" stroke-width="3" paint-order="stroke" font-size="${fmt(fontSize)}" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(label)}</text>`);
  }

  // Puerta y ventanas
  const doorLine = lineCoords(data.door, widthCm, lengthCm);
  out.push(`<line x1="${fmt(X(doorLine.x1))}" y1="${fmt(Y(doorLine.y1))}" x2="${fmt(X(doorLine.x2))}" y2="${fmt(Y(doorLine.y2))}" stroke="#d6a229" stroke-width="7"/>`);
  for (const win of data.windows) {
    const l = lineCoords(win, widthCm, lengthCm);
    out.push(`<line x1="${fmt(X(l.x1))}" y1="${fmt(Y(l.y1))}" x2="${fmt(X(l.x2))}" y2="${fmt(Y(l.y2))}" stroke="#7cc3d8" stroke-width="6"/>`);
  }

  // Cotas: largo a la izquierda y ancho abajo, fuera de la zona exterior
  const dimX = X(-ext) - 30;
  out.push(`<line x1="${fmt(dimX)}" y1="${fmt(Y(0))}" x2="${fmt(dimX)}" y2="${fmt(Y(lengthCm))}" stroke="#0a3550" stroke-width="1.5"/>`);
  out.push(`<line x1="${fmt(dimX - 8)}" y1="${fmt(Y(0))}" x2="${fmt(dimX + 8)}" y2="${fmt(Y(0))}" stroke="#0a3550" stroke-width="1.5"/><line x1="${fmt(dimX - 8)}" y1="${fmt(Y(lengthCm))}" x2="${fmt(dimX + 8)}" y2="${fmt(Y(lengthCm))}" stroke="#0a3550" stroke-width="1.5"/>`);
  out.push(`<text x="${fmt(dimX - 14)}" y="${fmt(Y(lengthCm / 2))}" fill="#0a3550" font-size="15" font-weight="700" text-anchor="middle" transform="rotate(-90 ${fmt(dimX - 14)} ${fmt(Y(lengthCm / 2))})">LARGO ${meters(lengthCm)}</text>`);
  const dimY = Y(lengthCm + ext) + 30;
  out.push(`<line x1="${fmt(X(0))}" y1="${fmt(dimY)}" x2="${fmt(X(widthCm))}" y2="${fmt(dimY)}" stroke="#0a3550" stroke-width="1.5"/>`);
  out.push(`<line x1="${fmt(X(0))}" y1="${fmt(dimY - 8)}" x2="${fmt(X(0))}" y2="${fmt(dimY + 8)}" stroke="#0a3550" stroke-width="1.5"/><line x1="${fmt(X(widthCm))}" y1="${fmt(dimY - 8)}" x2="${fmt(X(widthCm))}" y2="${fmt(dimY + 8)}" stroke="#0a3550" stroke-width="1.5"/>`);
  out.push(`<text x="${fmt(X(widthCm / 2))}" y="${fmt(dimY + 26)}" fill="#0a3550" font-size="15" font-weight="700" text-anchor="middle">ANCHO ${meters(widthCm)} · ALTURA ${meters(data.heightCm)}</text>`);

  // Leyenda
  const legendY = PAGE_H - footerH - legendH;
  out.push(`<line x1="60" y1="${legendY}" x2="${PAGE_W - 60}" y2="${legendY}" stroke="#d7dfe0" stroke-width="1.5"/>`);
  out.push(`<text x="60" y="${legendY + 40}" fill="#06293e" font-size="15" font-weight="700" letter-spacing="2">ELEMENTOS DEL PLANO</text>`);
  const colW = (PAGE_W - 120) / 2;
  const entries: { color: string; dashed?: boolean; line?: boolean; title: string; detail: string }[] = data.items.map((item) => ({
    color: item.color,
    dashed: item.exterior,
    title: `${item.number}. ${item.name}`,
    detail: `${item.alongCm} × ${item.depthLabelCm} cm · ${item.exterior ? "Exterior" : item.wallLabel}`,
  }));
  entries.push({ color: "#d6a229", line: true, title: "Puerta", detail: `${data.door.widthCm} cm · ${data.door.wallLabel}` });
  if (data.windows.length) entries.push({ color: "#7cc3d8", line: true, title: `Ventanas (${data.windows.length})`, detail: data.windows.map((w) => `${w.widthCm} cm`).join(", ") });
  entries.forEach((entry, index) => {
    const col = index < legendRows ? 0 : 1;
    const row = index % legendRows;
    const x = 60 + col * colW;
    const y = legendY + 62 + row * 36;
    if (entry.line) out.push(`<line x1="${x}" y1="${y + 10}" x2="${x + 22}" y2="${y + 10}" stroke="${entry.color}" stroke-width="6"/>`);
    else out.push(`<rect x="${x}" y="${y}" width="22" height="20" rx="3" fill="${esc(entry.color)}" stroke="#0a3550" stroke-width="1"${entry.dashed ? ` stroke-dasharray="4 2"` : ""}/>`);
    out.push(`<text x="${x + 34}" y="${y + 15}" fill="#06293e" font-size="15"><tspan font-weight="700">${esc(entry.title)}</tspan><tspan fill="#5f7481"> · ${esc(entry.detail)}</tspan></text>`);
  });

  // Pie
  out.push(`<text x="60" y="${PAGE_H - 26}" fill="#5f7481" font-size="12">Plano orientativo: posiciones sujetas a revisión técnica de circulación, instalaciones y balance de peso.</text>`);
  out.push(`<text x="${PAGE_W - 60}" y="${PAGE_H - 26}" fill="#5f7481" font-size="12" text-anchor="end">FG TOW · contacto@fgtow.com</text>`);
  out.push(`</svg>`);
  return out.join("");
}

function loadSvgImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No fue posible generar la imagen del plano."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function renderCanvas(svg: string, scale = 2) {
  const image = await loadSvgImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * scale;
  canvas.height = PAGE_H * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no permite generar imágenes.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPlanPng(svg: string, filename: string) {
  const canvas = await renderCanvas(svg);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No fue posible generar la imagen del plano.");
  saveBlob(blob, filename);
}

export async function downloadPlanPdf(svg: string, filename: string) {
  const canvas = await renderCanvas(svg);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const jpeg = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) jpeg[i] = binary.charCodeAt(i);

  // A4 vertical en puntos; la hoja del plano ya tiene la proporción de A4.
  const pageW = 595.28, pageH = 841.89;
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: string) => { offsets.push(length); push(`${offsets.length} 0 obj\n${body}\nendobj\n`); };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object("<< /Type /Catalog /Pages 2 0 R >>");
  object("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets.push(length);
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  object(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xrefOffset = length;
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  saveBlob(new Blob(parts as BlobPart[], { type: "application/pdf" }), filename);
}

export function printPlan(svg: string, title: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 portrait;margin:6mm}html,body{margin:0;background:#fff}svg{display:block;width:100%;height:auto;max-height:285mm}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>${svg}</body></html>`);
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  win.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    win.focus();
    win.print();
    // Safari no siempre dispara afterprint; se limpia de todas formas tras un rato.
    setTimeout(() => frame.remove(), 60000);
  }, 150);
}
