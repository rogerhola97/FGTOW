import { FOOD_QUICK_MODELS, buildCustomPresetId, getAllowedAxles, getPreset, getPresetsForModel, isValidPresetId, type ModelId } from "./quoteCatalog";
import { modelArg, objectArgs } from "./aiRequestValidation";
import { AiToolError } from "./aiToolErrors";

const dimensionFields = ["widthCm", "lengthCm", "heightCm", "axles"] as const;
type Dimensions = Record<typeof dimensionFields[number], number>;

function invalidConfiguration(): never { throw new AiToolError("INVALID_TRAILER_CONFIGURATION", "trailer-configuration"); }

function resolvePresetId(raw: Record<string, unknown>, model: ModelId): string {
  for (const field of dimensionFields) {
    const value = raw[field];
    if (value != null && (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)) invalidConfiguration();
  }
  let dimensions: Dimensions;
  if (raw.quickModelId != null) {
    if (model !== "food" || typeof raw.quickModelId !== "string") invalidConfiguration();
    const quick = FOOD_QUICK_MODELS.find(entry => entry.id === raw.quickModelId);
    if (!quick) invalidConfiguration();
    // Quick models use the catalog's initial allowed axle option; no new axle rule or literal.
    const axles = getAllowedAxles(quick.lengthCm)[0];
    if (axles === undefined) invalidConfiguration();
    dimensions = { widthCm: quick.widthCm, lengthCm: quick.lengthCm, heightCm: quick.heightCm, axles };
    if (dimensionFields.some(field => raw[field] != null && raw[field] !== dimensions[field])) invalidConfiguration();
  } else {
    const missing = dimensionFields.filter(field => raw[field] == null);
    if (missing.length) throw new AiToolError("INVALID_TRAILER_CONFIGURATION", "trailer-configuration", missing);
    dimensions = Object.fromEntries(dimensionFields.map(field => [field, raw[field]])) as Dimensions;
  }
  if (model === "rzr") {
    const matches = getPresetsForModel(model).filter(preset => dimensionFields.every(field => preset[field] === dimensions[field]));
    if (matches.length !== 1) invalidConfiguration();
    return matches[0].id;
  }
  const id = buildCustomPresetId(model, dimensions.widthCm, dimensions.lengthCm, dimensions.heightCm, dimensions.axles as 1 | 2 | 3);
  // buildCustomPreset sanitizes dimensions. Validate first so invalid input is never snapped silently.
  if (!isValidPresetId(id)) invalidConfiguration();
  const preset = getPreset(id);
  if (preset.model !== model || dimensionFields.some(field => preset[field] !== dimensions[field])) invalidConfiguration();
  return preset.id;
}

export function resolveCurrentPriceConfiguration(value: unknown) {
  const raw = objectArgs(value, ["model", "quickModelId", ...dimensionFields, "items", "specialItems", "charges", "discount", "includeIva", "payment", "door"]);
  const model = modelArg(raw.model);
  const presetId = resolvePresetId(raw, model);
  // Internal presetId is constructed here, never accepted from the tool's caller.
  return { model, presetId, items: raw.items === undefined ? [] : raw.items, specialItems: raw.specialItems, charges: raw.charges, discount: raw.discount, includeIva: raw.includeIva, payment: raw.payment, door: raw.door };
}
