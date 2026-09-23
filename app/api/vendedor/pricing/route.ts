import { EQUIPMENT, TRAILER_PRESETS } from "../../../lib/quoteCatalog";
import { getPricingSettings, updatePricingSettings } from "../../../lib/pricingSettingsDb";
import { getVendor } from "../../../lib/vendorAuth";

// Lee/edita la fila única (id=1) de public.vendor_pricing_settings: la lista de precios estándar
// que aplica a toda cotización creada o editada desde el panel de vendedor (nunca al cotizador
// público, que sigue usando quoteCatalog.ts sin tocar).
export async function GET() {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  try {
    const settings = await getPricingSettings();
    return Response.json({ ok: true, settings }, { status: 200 });
  } catch (error) {
    console.error("Error al leer los precios de vendedor:", error);
    return Response.json({ error: "No fue posible cargar los precios." }, { status: 500 });
  }
}

const validEquipmentIds = new Set(EQUIPMENT.map((item) => item.id));
const validPresetIds = new Set(TRAILER_PRESETS.map((preset) => preset.id));

function cleanNumberMap(value: unknown, allowedKeys: Set<string>): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!allowedKeys.has(key)) continue;
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) result[key] = Math.round(num);
  }
  return result;
}

function cleanCoefficients(value: unknown): Record<string, { priceBase?: number; priceFloor?: number; priceWall?: number; priceAxle?: number }> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, { priceBase?: number; priceFloor?: number; priceWall?: number; priceAxle?: number }> = {};
  for (const model of ["food", "cargo"]) {
    const raw = (value as Record<string, unknown>)[model];
    if (!raw || typeof raw !== "object") continue;
    const entry: { priceBase?: number; priceFloor?: number; priceWall?: number; priceAxle?: number } = {};
    for (const field of ["priceBase", "priceFloor", "priceWall", "priceAxle"] as const) {
      const num = Number((raw as Record<string, unknown>)[field]);
      if (Number.isFinite(num) && num >= 0) entry[field] = num;
    }
    if (Object.keys(entry).length) result[model] = entry;
  }
  return result;
}

export async function PUT(request: Request) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const includedEquipmentCount = Number(payload.included_equipment_count);
    const extraEquipmentPrice = Number(payload.extra_equipment_price);
    if (!Number.isFinite(includedEquipmentCount) || includedEquipmentCount < 0 || !Number.isFinite(extraEquipmentPrice) || extraEquipmentPrice < 0) {
      return Response.json({ error: "La tarifa plana y el número de incluidos deben ser números válidos." }, { status: 400 });
    }

    const result = await updatePricingSettings({
      included_equipment_count: Math.round(includedEquipmentCount),
      extra_equipment_price: Math.round(extraEquipmentPrice),
      equipment_price_overrides: cleanNumberMap(payload.equipment_price_overrides, validEquipmentIds),
      trailer_base_price_overrides: cleanNumberMap(payload.trailer_base_price_overrides, validPresetIds),
      custom_coefficient_overrides: cleanCoefficients(payload.custom_coefficient_overrides),
    }, vendor.email);
    if (!result.ok) throw new Error("No fue posible guardar los precios.");

    return Response.json({ ok: true, settings: result.settings }, { status: 200 });
  } catch (error) {
    console.error("Error al guardar los precios de vendedor:", error);
    return Response.json({ error: "No fue posible guardar los precios. Intenta de nuevo." }, { status: 500 });
  }
}
