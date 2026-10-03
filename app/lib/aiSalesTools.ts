import { modelArgs } from "./aiRequestValidation";
import { authorizeSalesOperation } from "./vendorAuthorization";
import { calculateCurrentVendorTrailerPrice, getHistoricalVendorQuote } from "./quotePricingService";
import { getPricingSettings } from "./pricingSettingsDb";
import { MODEL_META, FOOD_QUICK_MODELS, getPresetsForModel, getEquipmentForModel, getCustomLengthOptions, getAllowedWidths, getAllowedAxles, getMaxHeightCm, CUSTOM_HEIGHT_MIN_CM, CUSTOM_HEIGHT_STEP_CM } from "./quoteCatalog";

export const calculate_trailer_price = calculateCurrentVendorTrailerPrice;
export async function get_quote(args: unknown) { return getHistoricalVendorQuote(args); }
export async function get_quote_summary(args: unknown) {
  const quote = await getHistoricalVendorQuote(args, "get_quote_summary");
  if (!quote) return null;
  return { kind: quote.kind, quoteId: quote.quoteId, quoteNumber: quote.quoteNumber, model: quote.model, stage: quote.stage, subtotal: quote.subtotal, iva: quote.iva, total: quote.total, pricingVersion: quote.pricingVersion, payment: quote.payment };
}
export async function get_trailer_catalog(args: unknown) {
  await authorizeSalesOperation("get_trailer_catalog");
  const { model } = modelArgs(args);
  return {
    model, label: MODEL_META[model].label,
    presets: getPresetsForModel(model).map(preset => ({ id: preset.id, widthCm: preset.widthCm, lengthCm: preset.lengthCm, heightCm: preset.heightCm, axles: preset.axles, basePrice: preset.basePrice })),
    quickModels: model === "food" ? FOOD_QUICK_MODELS.map(entry => ({ id: entry.id, name: entry.name, widthCm: entry.widthCm, lengthCm: entry.lengthCm, heightCm: entry.heightCm })) : [],
    dimensions: model === "rzr" ? [] : getCustomLengthOptions().map(lengthCm => ({ lengthCm, widthsCm: getAllowedWidths(lengthCm), axles: getAllowedAxles(lengthCm), minHeightCm: CUSTOM_HEIGHT_MIN_CM, maxHeightCm: getMaxHeightCm(lengthCm), heightStepCm: CUSTOM_HEIGHT_STEP_CM })),
  };
}
export async function get_accessories(args: unknown) {
  await authorizeSalesOperation("get_accessories");
  const { model } = modelArgs(args);
  const settings = await getPricingSettings();
  return { model, accessories: getEquipmentForModel(model).map(entry => {
    const override = settings.equipment_price_overrides[entry.id];
    const unitPrice = typeof override === "number" && Number.isFinite(override) && override >= 0 ? override : entry.fixedPrice ?? settings.extra_equipment_price;
    return { id: entry.id, name: entry.name, widthCm: entry.widthCm, depthCm: entry.depthCm, minWidthCm: entry.minWidthCm, maxWidthCm: entry.maxWidthCm, minDepthCm: entry.minDepthCm, maxDepthCm: entry.maxDepthCm, alwaysFree: Boolean(entry.alwaysFree), special: Boolean(entry.special), freeQuantity: entry.freeQuantity ?? 0, fixedPrice: entry.fixedPrice != null, vendorPriceEditable: Boolean(entry.vendorPriceEditable), unitPrice: entry.alwaysFree ? 0 : entry.special ? null : unitPrice };
  }) };
}
