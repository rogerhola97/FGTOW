// Cálculo de cotización para vendedores. El precio del remolque y la cantidad incluida vienen de
// la misma matriz canónica del cotizador público; aquí sólo se aplican tarifas de aditamentos y el
// descuento propio de la cotización.
import {
  PlacedEquipment,
  TrailerPreset,
  getEquipment,
  getPreset,
} from "./quoteCatalog";
import { PricingSettings } from "./pricingSettingsShape";

export type VendorDiscount = { type: "percent" | "amount"; value: number; reason: string | null } | null;

export function getPresetWithSettings(id: string, settings: PricingSettings): TrailerPreset {
  void settings;
  // El vendedor usa exactamente la misma matriz y las mismas restricciones que el cliente.
  // Los ajustes persistidos antiguos se conservan en Supabase por compatibilidad, pero ya no
  // pueden crear otra fuente de precio base ni otra cantidad global de aditamentos incluidos.
  return getPreset(id);
}

function equipmentPrice(typeId: string, settings: PricingSettings) {
  const override = settings.equipment_price_overrides[typeId];
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) return override;
  return settings.extra_equipment_price;
}

export function calculateVendorQuote<T extends { name: string; widthCm: number; depthCm: number }>(
  presetId: string,
  items: PlacedEquipment[],
  specialItems: T[],
  includeIva: boolean,
  settings: PricingSettings,
  discount: VendorDiscount = null,
) {
  const preset = getPresetWithSettings(presetId, settings);
  const includedCount = preset.includedEquipment;
  let includedUsed = 0;
  let extras = 0;
  const lines = items.flatMap((item) => {
    const definition = getEquipment(item.typeId);
    if (!definition) return [];
    const included = includedUsed < includedCount;
    if (included) includedUsed += 1;
    const linePrice = included ? 0 : equipmentPrice(item.typeId, settings);
    extras += linePrice;
    return [{ item, definition, linePrice, included }];
  });
  const specialLines = specialItems.map((entry) => {
    const included = includedUsed < includedCount;
    if (included) includedUsed += 1;
    const linePrice = included ? 0 : settings.extra_equipment_price;
    extras += linePrice;
    return { ...entry, linePrice, included };
  });
  const preDiscountSubtotal = preset.basePrice + extras;
  let discountAmount = 0;
  if (discount && discount.value > 0) {
    discountAmount = discount.type === "percent"
      ? Math.round((preDiscountSubtotal * Math.min(discount.value, 100)) / 100)
      : Math.round(Math.min(discount.value, preDiscountSubtotal));
  }
  const subtotal = Math.max(0, preDiscountSubtotal - discountAmount);
  const iva = includeIva ? Math.round(subtotal * 0.16) : 0;
  return { preset, lines, specialLines, includedUsed, extras, preDiscountSubtotal, discountAmount, subtotal, iva, total: subtotal + iva };
}

type StoredQuoteForPricing = {
  trailer_preset: string;
  configuration: unknown;
  include_iva: boolean;
  discount_type?: "percent" | "amount" | null;
  discount_value?: number | null;
  discount_reason?: string | null;
  total: number;
};

// Las listas de cotizaciones guardadas muestran el importe histórico persistido. El editor puede
// recalcular con la matriz vigente, pero el registro sólo cambia cuando el vendedor vuelve a guardar.
export function calculateStoredQuoteTotal(quote: StoredQuoteForPricing, settings: PricingSettings) {
  void settings;
  // Una cotización guardada conserva el total que fue aceptado en ese momento. Al abrirla en el
  // editor se vuelve a calcular con la matriz vigente y solo cambia al guardar nuevamente.
  return Number(quote.total);
}
