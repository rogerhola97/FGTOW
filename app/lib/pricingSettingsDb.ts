// Acceso a la fila única de public.vendor_pricing_settings en Supabase (id=1). Mismo patrón que
// app/lib/quotesDb.ts: siempre con la Service Role key, solo desde rutas ya protegidas por sesión
// de vendedor. Esta tabla nunca la toca el flujo público.
import { readEnv } from "./vendorAuth";
import { DEFAULT_PRICING_SETTINGS, PricingSettings } from "./pricingSettingsShape";

export { DEFAULT_PRICING_SETTINGS };
export type { PricingSettings };

function requireSupabaseUrl() {
  const url = readEnv("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) throw new Error("Falta la variable de entorno SUPABASE_URL.");
  return url;
}

function requireServiceRoleKey() {
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

async function serviceRoleFetch(path: string, init: RequestInit = {}) {
  const key = requireServiceRoleKey();
  return fetch(`${requireSupabaseUrl()}${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers },
  });
}

// Si la fila id=1 todavía no existe (instalación nueva antes de correr la migración con su
// `insert ... on conflict do nothing`) se regresan los defaults en memoria en vez de fallar, para
// que el panel de vendedor siga usable con la tarifa plana de siempre.
export async function getPricingSettings(): Promise<PricingSettings> {
  const response = await serviceRoleFetch(`/rest/v1/vendor_pricing_settings?id=eq.1&select=*&limit=1`);
  if (!response.ok) throw new Error(`Supabase rechazó la consulta de precios (status ${response.status}).`);
  const rows = (await response.json()) as PricingSettings[];
  return rows[0] ?? DEFAULT_PRICING_SETTINGS;
}

export async function updatePricingSettings(patch: Partial<PricingSettings>, updatedBy: string): Promise<{ ok: true; settings: PricingSettings } | { ok: false; error: string }> {
  const response = await serviceRoleFetch(`/rest/v1/vendor_pricing_settings?id=eq.1`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString(), updated_by: updatedBy }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Supabase rechazó la edición de precios:", response.status, details);
    return { ok: false, error: details.slice(0, 500) };
  }
  const rows = (await response.json()) as PricingSettings[];
  return { ok: true, settings: rows[0] };
}
