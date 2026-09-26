// Forma de la lista de precios estándar del vendedor, sin ningún import de servidor (cloudflare:workers,
// next/headers, etc.) — este archivo lo puede importar tanto código de servidor (pricingSettingsDb.ts,
// vendorPricing.ts) como un componente "use client" (TrailerConfigurator.tsx).
export type PricingSettings = {
  // Campos heredados: se leen para que las instalaciones existentes sigan siendo compatibles,
  // pero ya no alteran la matriz canónica del remolque ni la cantidad incluida por tamaño.
  included_equipment_count: number;
  extra_equipment_price: number;
  equipment_price_overrides: Record<string, number>;
  trailer_base_price_overrides: Record<string, number>;
  custom_coefficient_overrides: Record<string, { priceBase?: number; priceFloor?: number; priceWall?: number }>;
  updated_at: string;
  updated_by: string | null;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  included_equipment_count: 5,
  extra_equipment_price: 2500,
  equipment_price_overrides: {},
  trailer_base_price_overrides: {},
  custom_coefficient_overrides: {},
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};
