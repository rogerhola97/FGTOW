import { EQUIPMENT, getPreset, isValidPresetId, validateLayout, type ModelId, type PlacedEquipment } from "./quoteCatalog";
import { parseCharges, parseDiscount } from "./quoteSubmissionVendor";
import { parseDoor, parseItems, parseSpecialItems, type SpecialItem } from "./quoteSubmission";
import type { VendorCharge, VendorDiscount } from "./vendorPricing";
import type { QuoteDocumentsData } from "./quoteDocuments";
import { AiToolError } from "./aiToolErrors";

export class AiValidationError extends Error {
  constructor(message: string) { super(message); this.name = "AiValidationError"; }
}
export function objectArgs(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new AiValidationError("Se requiere un objeto de argumentos.");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !allowed.includes(key))) throw new AiValidationError("Hay campos no permitidos.");
  return raw;
}
export function textArg(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new AiValidationError("Texto inválido.");
  return value.trim();
}
export function numberArg(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new AiValidationError("Número fuera de rango.");
  return value;
}
export function modelArg(value: unknown): ModelId {
  if (value !== "food" && value !== "cargo" && value !== "rzr") throw new AiValidationError("Modelo inválido.");
  return value;
}
export function modelArgs(value: unknown) { const raw = objectArgs(value, ["model"]); return { model: modelArg(raw.model) }; }
export function quoteIdArgs(value: unknown) { const raw = objectArgs(value, ["quoteId"]); return { quoteId: numberArg(raw.quoteId, 1, Number.MAX_SAFE_INTEGER, true) }; }
export function salesMessageArgs(value: unknown): { message: string; quoteId: number | null } {
  const raw = objectArgs(value, ["message", "quoteId"]);
  const message = textArg(raw.message, 4000);
  if (message.length < 2) throw new AiValidationError("El mensaje debe tener al menos dos caracteres.");
  let quoteId: number | null = null;
  if (raw.quoteId != null) {
    // Routes use positive integer IDs. Accept their canonical decimal URL representation too.
    const id = typeof raw.quoteId === "string" && /^[1-9][0-9]{0,15}$/.test(raw.quoteId) ? Number(raw.quoteId) : raw.quoteId;
    quoteId = numberArg(id, 1, Number.MAX_SAFE_INTEGER, true);
  }
  return { message, quoteId };
}
function arrayArg(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new AiValidationError("Lista inválida o demasiado grande.");
  return value;
}
export type CurrentPriceInput = {
  model: ModelId; presetId: string; items: PlacedEquipment[]; specialItems: SpecialItem[];
  includeIva: boolean; discount: VendorDiscount; charges: VendorCharge[];
  payment?: "default_deposit" | Pick<QuoteDocumentsData["payment"], "schedule" | "depositPercent" | "installmentCount">;
};
export function currentPriceArgs(value: unknown): CurrentPriceInput {
  const raw = objectArgs(value, ["model", "presetId", "items", "specialItems", "includeIva", "discount", "charges", "payment", "door"]);
  const model = modelArg(raw.model);
  const presetId = textArg(raw.presetId, 60);
  if (!isValidPresetId(presetId)) throw new AiToolError("INVALID_TRAILER_CONFIGURATION", "trailer-configuration");
  const preset = getPreset(presetId);
  if (preset.model !== model) throw new AiToolError("INVALID_TRAILER_CONFIGURATION", "trailer-configuration");
  const equipment = new Map(EQUIPMENT.filter(entry => entry.model === model).map(entry => [entry.id, entry]));
  const itemsRaw = arrayArg(raw.items, 40);
  for (const entry of itemsRaw) {
    const item = objectArgs(entry, ["instanceId", "typeId", "xCm", "yCm", "widthCm", "depthCm", "rotation", "specialId", "customPrice", "note"]);
    textArg(item.instanceId, 80);
    const definition = equipment.get(textArg(item.typeId, 60));
    if (!definition) throw new AiValidationError("Accesorio inválido para el modelo.");
    for (const key of ["xCm", "yCm", "widthCm", "depthCm"]) numberArg(item[key], key.startsWith("x") || key.startsWith("y") ? -1000 : 1, 2000, true);
    if (item.rotation !== 0 && item.rotation !== 90) throw new AiValidationError("Rotación inválida.");
    if (item.specialId != null) textArg(item.specialId, 80);
    if (Boolean(definition.special) !== Boolean(item.specialId)) throw new AiValidationError("Enlace de accesorio especial inválido.");
    if (item.note != null) textArg(item.note, 500);
    if (item.customPrice != null) {
      if (!definition.vendorPriceEditable) throw new AiValidationError("Este accesorio no admite precio manual.");
      numberArg(item.customPrice, 0, 1_000_000);
    }
  }
  const items = parseItems(itemsRaw, { vendor: true });
  if (new Set(items.map(item => item.instanceId)).size !== items.length) throw new AiValidationError("Identificadores duplicados.");
  const specialsRaw = arrayArg(raw.specialItems ?? [], 20);
  for (const entry of specialsRaw) {
    const special = objectArgs(entry, ["id", "name", "widthCm", "depthCm", "heightCm", "price", "comment", "mount", "customPrice"]);
    if (special.id != null) textArg(special.id, 80);
    textArg(special.name, 120);
    numberArg(special.widthCm, 1, 2000, true); numberArg(special.depthCm, 1, 2000, true);
    if (special.heightCm != null) numberArg(special.heightCm, 1, 500, true);
    if (special.price != null) numberArg(special.price, 0, 1_000_000);
    if (special.customPrice != null) numberArg(special.customPrice, 0, 1_000_000);
    if (special.comment != null) textArg(special.comment, 500);
    if (special.mount != null && special.mount !== "inside" && special.mount !== "outside") throw new AiValidationError("Montaje inválido.");
  }
  const specialItems = parseSpecialItems(specialsRaw.map(entry => ({ ...(entry as object), price: (entry as Record<string, unknown>).price ?? 0 })), { vendor: true });
  const specialIds = new Set(specialItems.map(item => item.id));
  if (specialIds.size !== specialItems.length || items.some(item => item.specialId && !specialIds.has(item.specialId))) throw new AiValidationError("Referencia especial inválida.");
  if (typeof raw.includeIva !== "boolean") throw new AiValidationError("IVA inválido.");
  const chargesRaw = arrayArg(raw.charges ?? [], 20);
  for (const entry of chargesRaw) {
    const charge = objectArgs(entry, ["id", "name", "price"]);
    if (charge.id != null) textArg(charge.id, 40);
    textArg(charge.name, 120); numberArg(charge.price, 0, 1_000_000);
  }
  if (raw.discount != null) {
    const discount = objectArgs(raw.discount, ["type", "value", "reason"]);
    if (discount.type !== "percent" && discount.type !== "amount") throw new AiValidationError("Descuento inválido.");
    numberArg(discount.value, 0, discount.type === "percent" ? 100 : 1_000_000);
    if (discount.reason != null) textArg(discount.reason, 300);
  }
  let payment: CurrentPriceInput["payment"];
  if (raw.payment === "default_deposit") payment = "default_deposit";
  else if (raw.payment != null) {
    try {
      const pay = objectArgs(raw.payment, ["schedule", "depositPercent", "installmentCount"]);
      const missing = (["schedule", "depositPercent", "installmentCount"] as const).filter(field => pay[field] == null);
      if (missing.length) throw new AiToolError("PAYMENT_CONFIGURATION_ERROR", "payment-configuration", missing);
      if (pay.schedule !== "full" && pay.schedule !== "deposit_balance" && pay.schedule !== "deposit_installments" && pay.schedule !== "installments") throw new AiValidationError("Esquema de pago inválido.");
      payment = { schedule: pay.schedule, depositPercent: numberArg(pay.depositPercent, 0, 100), installmentCount: numberArg(pay.installmentCount, 1, 100, true) };
    } catch (error) {
      if (error instanceof AiToolError) throw error;
      throw new AiToolError("PAYMENT_CONFIGURATION_ERROR", "payment-configuration");
    }
  }
  let door;
  if (raw.door != null) {
    try {
      const d = objectArgs(raw.door, ["wall", "offsetCm", "widthCm"]);
      if (!["front", "back", "left", "right"].includes(d.wall as string)) throw new AiValidationError("Puerta inválida.");
      numberArg(d.offsetCm, 0, 900); numberArg(d.widthCm, 60, 150);
      door = parseDoor(d, preset.widthCm, preset.lengthCm);
      if (door.widthCm !== d.widthCm || door.offsetCm !== d.offsetCm) throw new AiValidationError("Puerta fuera de rango.");
    } catch { throw new AiToolError("INVALID_TRAILER_CONFIGURATION", "trailer-configuration"); }
  }
  const errors = validateLayout(preset, items, door);
  if (errors.length) throw new AiToolError("INVALID_TRAILER_CONFIGURATION", "trailer-configuration");
  return { model, presetId, items, specialItems, includeIva: raw.includeIva, discount: parseDiscount(raw.discount), charges: parseCharges(chargesRaw), payment };
}
