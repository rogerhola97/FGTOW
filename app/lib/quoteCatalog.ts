export type TrailerPreset = {
  id: string;
  label: string;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  axles: 1 | 2;
  basePrice: number;
  includedEquipment: number;
  estimatedWeightKg: number;
  estimatedCapacityKg: number;
};

export type EquipmentDefinition = {
  id: string;
  name: string;
  shortName: string;
  category: "coccion" | "agua" | "trabajo" | "especial";
  widthCm: number;
  depthCm: number;
  minWidthCm: number;
  maxWidthCm: number;
  minDepthCm: number;
  maxDepthCm: number;
  surcharge: number;
  includedEligible: boolean;
  color: string;
  description: string;
};

export type PlacedEquipment = {
  instanceId: string;
  typeId: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  rotation: 0 | 90;
};

export const TRAILER_PRESETS: TrailerPreset[] = [
  { id: "ft-180-200", label: "1.80 × 2.00 m · 1 eje", widthCm: 180, lengthCm: 200, heightCm: 200, axles: 1, basePrice: 49000, includedEquipment: 2, estimatedWeightKg: 650, estimatedCapacityKg: 1200 },
  { id: "ft-180-250", label: "1.80 × 2.50 m · 1 eje", widthCm: 180, lengthCm: 250, heightCm: 205, axles: 1, basePrice: 58500, includedEquipment: 5, estimatedWeightKg: 700, estimatedCapacityKg: 1400 },
  { id: "ft-180-300", label: "1.80 × 3.00 m · 1 eje", widthCm: 180, lengthCm: 300, heightCm: 210, axles: 1, basePrice: 62500, includedEquipment: 5, estimatedWeightKg: 735, estimatedCapacityKg: 1500 },
  { id: "ft-200-300", label: "2.00 × 3.00 m · 1 eje", widthCm: 200, lengthCm: 300, heightCm: 210, axles: 1, basePrice: 69000, includedEquipment: 5, estimatedWeightKg: 750, estimatedCapacityKg: 1500 },
  { id: "ft-200-350", label: "2.00 × 3.50 m · 1 eje", widthCm: 200, lengthCm: 350, heightCm: 210, axles: 1, basePrice: 75500, includedEquipment: 5, estimatedWeightKg: 790, estimatedCapacityKg: 1650 },
  { id: "ft-200-400", label: "2.00 × 4.00 m · 1 eje", widthCm: 200, lengthCm: 400, heightCm: 210, axles: 1, basePrice: 79500, includedEquipment: 5, estimatedWeightKg: 830, estimatedCapacityKg: 1800 },
  { id: "ft-200-400-2e", label: "2.00 × 4.00 m · doble eje", widthCm: 200, lengthCm: 400, heightCm: 210, axles: 2, basePrice: 86500, includedEquipment: 5, estimatedWeightKg: 870, estimatedCapacityKg: 2500 },
  { id: "ft-220-500", label: "2.20 × 5.00 m · doble eje", widthCm: 220, lengthCm: 500, heightCm: 200, axles: 2, basePrice: 107000, includedEquipment: 5, estimatedWeightKg: 900, estimatedCapacityKg: 3000 },
  { id: "ft-220-600", label: "2.20 × 6.00 m · doble eje", widthCm: 220, lengthCm: 600, heightCm: 200, axles: 2, basePrice: 117000, includedEquipment: 5, estimatedWeightKg: 1000, estimatedCapacityKg: 3000 },
];

export const EQUIPMENT: EquipmentDefinition[] = [
  { id: "plancha", name: "Plancha", shortName: "Plancha", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 60, maxWidthCm: 180, minDepthCm: 45, maxDepthCm: 65, surcharge: 1000, includedEligible: true, color: "#d6a229", description: "Plancha de acero con quemador; medida base 90 × 50 cm." },
  { id: "bano-maria", name: "Baño María", shortName: "Baño María", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 60, maxWidthCm: 140, minDepthCm: 40, maxDepthCm: 65, surcharge: 1500, includedEligible: true, color: "#d88726", description: "Módulo para insertos de 1/4; configuración base de 6 insertos." },
  { id: "freidora", name: "Freidora", shortName: "Freidora", category: "coccion", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, surcharge: 1200, includedEligible: true, color: "#c45d35", description: "Freidora integrada con zona de trabajo y alimentación de gas." },
  { id: "parrilla", name: "Parrilla con quemador", shortName: "Parrilla", category: "coccion", widthCm: 50, depthCm: 50, minWidthCm: 40, maxWidthCm: 90, minDepthCm: 40, maxDepthCm: 70, surcharge: 1200, includedEligible: true, color: "#b94733", description: "Parrilla o quemador de alta/baja presión según el menú." },
  { id: "asador", name: "Asador", shortName: "Asador", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 80, maxWidthCm: 490, minDepthCm: 45, maxDepthCm: 70, surcharge: 2500, includedEligible: true, color: "#8d3c31", description: "Asador seccionado; el crecimiento de longitud se revisa por proyecto." },
  { id: "tarja", name: "Tarja con tanque de agua", shortName: "Tarja", category: "agua", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 80, minDepthCm: 35, maxDepthCm: 60, surcharge: 750, includedEligible: true, color: "#2f7f99", description: "Tarja chica, mezcladora y preparación para tanque de agua." },
  { id: "lavamanos", name: "Lavamanos exterior", shortName: "Lavamanos", category: "agua", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, surcharge: 2200, includedEligible: false, color: "#4f94aa", description: "Módulo exterior encajonado de aproximadamente 40 × 40 × 70 cm." },
  { id: "mesa", name: "Mesa de trabajo", shortName: "Mesa", category: "trabajo", widthCm: 120, depthCm: 50, minWidthCm: 40, maxWidthCm: 240, minDepthCm: 40, maxDepthCm: 70, surcharge: 0, includedEligible: false, color: "#5f7481", description: "Cubierta de trabajo en acero inoxidable, ajustable a la distribución." },
  { id: "barra-fria", name: "Barra fría con insertos", shortName: "Barra fría", category: "trabajo", widthCm: 90, depthCm: 50, minWidthCm: 60, maxWidthCm: 160, minDepthCm: 40, maxDepthCm: 65, surcharge: 2500, includedEligible: false, color: "#3c8f84", description: "Barra para insertos con cajón para hielo." },
  { id: "panera", name: "Panera", shortName: "Panera", category: "trabajo", widthCm: 50, depthCm: 40, minWidthCm: 40, maxWidthCm: 120, minDepthCm: 35, maxDepthCm: 60, surcharge: 1200, includedEligible: false, color: "#788f57", description: "Panera con tapas y división interior." },
  { id: "refrigerador", name: "Espacio para refrigerador", shortName: "Refrigerador", category: "trabajo", widthCm: 70, depthCm: 70, minWidthCm: 50, maxWidthCm: 180, minDepthCm: 50, maxDepthCm: 90, surcharge: 0, includedEligible: false, color: "#546ab1", description: "Reserva de espacio; el equipo no se incluye en el precio." },
  { id: "campana", name: "Campana con extracción", shortName: "Campana", category: "especial", widthCm: 180, depthCm: 55, minWidthCm: 90, maxWidthCm: 450, minDepthCm: 45, maxDepthCm: 75, surcharge: 4000, includedEligible: false, color: "#714d82", description: "Campana con extractores; base calculada con dos abanicos." },
  { id: "repisa", name: "Repisa baja", shortName: "Repisa", category: "especial", widthCm: 120, depthCm: 35, minWidthCm: 50, maxWidthCm: 300, minDepthCm: 25, maxDepthCm: 50, surcharge: 1000, includedEligible: false, color: "#7d6a4c", description: "Repisa bajo mesa de trabajo." },
  { id: "barra-abatible", name: "Barra abatible", shortName: "Barra", category: "especial", widthCm: 218, depthCm: 25, minWidthCm: 100, maxWidthCm: 500, minDepthCm: 20, maxDepthCm: 45, surcharge: 2500, includedEligible: false, color: "#2f5d70", description: "Barra cromada o antiderrapante abatible para servicio." },
  { id: "base-gas", name: "Base para gas", shortName: "Base gas", category: "especial", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, surcharge: 800, includedEligible: false, color: "#6f6f6f", description: "Base exterior para cilindro; la ubicación final requiere validación." },
];

export function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

export function getPreset(id: string) {
  return TRAILER_PRESETS.find((preset) => preset.id === id) ?? TRAILER_PRESETS[3];
}

export function getEquipment(id: string) {
  return EQUIPMENT.find((equipment) => equipment.id === id);
}

export function calculateQuote(presetId: string, items: PlacedEquipment[], includeIva: boolean) {
  const preset = getPreset(presetId);
  let includedUsed = 0;
  let extras = 0;
  const lines = items.flatMap((item) => {
    const definition = getEquipment(item.typeId);
    if (!definition) return [];
    const usesIncludedSlot = definition.includedEligible && includedUsed < preset.includedEquipment;
    if (usesIncludedSlot) includedUsed += 1;
    const linePrice = usesIncludedSlot ? 0 : definition.surcharge;
    extras += linePrice;
    return [{ item, definition, linePrice, included: usesIncludedSlot }];
  });
  const subtotal = preset.basePrice + extras;
  const iva = includeIva ? Math.round(subtotal * 0.16) : 0;
  return { preset, lines, includedUsed, extras, subtotal, iva, total: subtotal + iva };
}

export function validateLayout(preset: TrailerPreset, items: PlacedEquipment[]) {
  const errors: string[] = [];
  for (const item of items) {
    const definition = getEquipment(item.typeId);
    if (!definition) {
      errors.push("Hay un equipo desconocido en el plano.");
      continue;
    }
    const minWidth = item.rotation === 90 ? definition.minDepthCm : definition.minWidthCm;
    const maxWidth = item.rotation === 90 ? definition.maxDepthCm : definition.maxWidthCm;
    const minDepth = item.rotation === 90 ? definition.minWidthCm : definition.minDepthCm;
    const maxDepth = item.rotation === 90 ? definition.maxWidthCm : definition.maxDepthCm;
    if (item.widthCm < minWidth || item.widthCm > maxWidth || item.depthCm < minDepth || item.depthCm > maxDepth) {
      errors.push(`${definition.name} tiene medidas fuera del rango permitido.`);
    }
    if (item.xCm < 0 || item.yCm < 0 || item.xCm + item.widthCm > preset.widthCm || item.yCm + item.depthCm > preset.lengthCm) {
      errors.push(`${definition.name} está fuera del remolque.`);
    }
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      const overlap = a.xCm < b.xCm + b.widthCm && a.xCm + a.widthCm > b.xCm && a.yCm < b.yCm + b.depthCm && a.yCm + a.depthCm > b.yCm;
      if (overlap) errors.push(`${getEquipment(a.typeId)?.name ?? "Equipo"} se cruza con ${getEquipment(b.typeId)?.name ?? "otro equipo"}.`);
    }
  }
  return [...new Set(errors)];
}
