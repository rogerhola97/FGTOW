import { EQUIPMENT } from "../../../lib/quoteCatalog";
import { getPricingSettings, updatePricingSettings } from "../../../lib/pricingSettingsDb";
import { getVendor } from "../../../lib/vendorAuth";

// Lee/edita la fila única (id=1) de public.vendor_pricing_settings. La matriz del remolque ya es
// común para cliente y vendedor; esta ruta conserva solamente tarifas de aditamentos.
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

export async function PUT(request: Request) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const extraEquipmentPrice = Number(payload.extra_equipment_price);
    if (!Number.isFinite(extraEquipmentPrice) || extraEquipmentPrice < 0) {
      return Response.json({ error: "La tarifa de aditamentos debe ser un número válido." }, { status: 400 });
    }

    const result = await updatePricingSettings({
      extra_equipment_price: Math.round(extraEquipmentPrice),
      equipment_price_overrides: cleanNumberMap(payload.equipment_price_overrides, validEquipmentIds),
    }, vendor.email);
    if (!result.ok) throw new Error("No fue posible guardar los precios.");

    return Response.json({ ok: true, settings: result.settings }, { status: 200 });
  } catch (error) {
    console.error("Error al guardar los precios de vendedor:", error);
    return Response.json({ error: "No fue posible guardar los precios. Intenta de nuevo." }, { status: 500 });
  }
}
