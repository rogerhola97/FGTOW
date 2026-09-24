// Cálculo de cotización con la lista de precios estándar editable del vendedor (ver
// app/vendedor/precios) y el descuento de la cotización — usado ÚNICAMENTE por las rutas bajo
// /api/vendedor/**. El cotizador público (app/api/quote/route.ts) sigue usando calculateQuote() de
// quoteCatalog.ts sin tocar, así que sus precios nunca cambian por esto.
import {
  EXTRA_EQUIPMENT_PRICE,
  INCLUDED_EQUIPMENT_COUNT,
  PlacedEquipment,
  SECOND_AXLE_SURCHARGE,
  TRAILER_PRESETS,
  TrailerPreset,
  buildCustomPreset,
  getEquipment,
  parseCustomPresetId,
} from "./quoteCatalog";
import { PricingSettings } from "./pricingSettingsShape";

export type VendorDiscount = { type: "percent" | "amount"; value: number; reason: string | null } | null;

export function getPresetWithSettings(id: string, settings: PricingSettings): TrailerPreset {
  const includedEquipment = Number.isFinite(settings.included_equipment_count) ? settings.included_equipment_count : INCLUDED_EQUIPMENT_COUNT;
  const fixed = TRAILER_PRESETS.find((preset) => preset.id === id);
  if (fixed) {
    const matchingOneAxle = fixed.axles === 2
      ? TRAILER_PRESETS.find((preset) => preset.model === fixed.model && preset.widthCm === fixed.widthCm && preset.lengthCm === fixed.lengthCm && preset.axles === 1)
      : undefined;
    if (matchingOneAxle) {
      const oneAxleOverride = settings.trailer_base_price_overrides[matchingOneAxle.id];
      const oneAxlePrice = typeof oneAxleOverride === "number" && Number.isFinite(oneAxleOverride) && oneAxleOverride >= 0
        ? oneAxleOverride
        : matchingOneAxle.basePrice;
      return { ...fixed, basePrice: oneAxlePrice + SECOND_AXLE_SURCHARGE, includedEquipment };
    }
    const override = settings.trailer_base_price_overrides[id];
    const basePrice = typeof override === "number" && Number.isFinite(override) && override >= 0 ? override : fixed.basePrice;
    return { ...fixed, basePrice, includedEquipment };
  }
  const parsed = parseCustomPresetId(id);
  if (parsed) return { ...buildCustomPreset(parsed.model, parsed.widthCm, parsed.lengthCm, parsed.heightCm, parsed.axles, parsed.model === "cargo" ? settings.custom_coefficient_overrides.cargo : undefined), includedEquipment };
  return TRAILER_PRESETS[0];
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
  const includedCount = Number.isFinite(settings.included_equipment_count) ? settings.included_equipment_count : INCLUDED_EQUIPMENT_COUNT;
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
    const linePrice = included ? 0 : EXTRA_EQUIPMENT_PRICE;
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

// Las listas de cotizaciones guardadas muestran el importe con las reglas vigentes. El valor
// histórico permanece intacto en la base hasta que el vendedor guarda esa cotización otra vez.
export function calculateStoredQuoteTotal(quote: StoredQuoteForPricing, settings: PricingSettings) {
  try {
    const configuration = quote.configuration && typeof quote.configuration === "object"
      ? quote.configuration as { items?: PlacedEquipment[]; specialItems?: { name: string; widthCm: number; depthCm: number }[] }
      : {};
    const items = Array.isArray(configuration.items) ? configuration.items : [];
    const specialItems = Array.isArray(configuration.specialItems) ? configuration.specialItems : [];
    const discount: VendorDiscount = quote.discount_type && Number(quote.discount_value) > 0
      ? { type: quote.discount_type, value: Number(quote.discount_value), reason: quote.discount_reason ?? null }
      : null;
    return calculateVendorQuote(quote.trailer_preset, items, specialItems, Boolean(quote.include_iva), settings, discount).total;
  } catch {
    return Number(quote.total);
  }
}
