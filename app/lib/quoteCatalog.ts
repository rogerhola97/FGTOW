export type ModelId = "food" | "cargo" | "rzr";

export type ModelMeta = {
  id: ModelId;
  label: string;
  shortLabel: string;
  tagline: string;
  heroTitleLine: string;
  heroEm: string;
  intro: string;
  equipmentHeading: string;
  equipmentSub: string;
  equipmentLabel: string;
  includesNote: string;
  defaultPresetId: string;
};

export const MODEL_META: Record<ModelId, ModelMeta> = {
  food: {
    id: "food",
    label: "FG Food Truck",
    shortLabel: "Food Truck",
    tagline: "Cocina móvil",
    heroTitleLine: "Diseña tu food truck",
    heroEm: "sobre un plano real.",
    intro: "Elige una medida, agrega equipos de cocina y arrástralos dentro del remolque. La plataforma evita que salgan de los límites y detecta cruces antes de enviar el proyecto.",
    equipmentHeading: "Equipamiento",
    equipmentSub: "Toca para añadir al plano",
    equipmentLabel: "equipos principales",
    includesNote: "estructura, chasis, laminado, tren rodante, instalación eléctrica y de gas base",
    defaultPresetId: "custom-food-200-300-210-1",
  },
  cargo: {
    id: "cargo",
    label: "FG Cargo",
    shortLabel: "Cargo",
    tagline: "Carga y trabajo",
    heroTitleLine: "Configura tu remolque",
    heroEm: "de carga y trabajo.",
    intro: "Elige una medida, agrega rampas, racks y amarres, y colócalos sobre el plano. La plataforma evita que salgan de los límites y detecta cruces antes de enviar el proyecto.",
    equipmentHeading: "Aditamentos",
    equipmentSub: "Toca para añadir al plano",
    equipmentLabel: "aditamentos principales",
    includesNote: "estructura, chasis, piso antiderrapante, tren rodante, luces reglamentarias, tirón y cadenas de seguridad",
    defaultPresetId: "custom-cargo-200-350-210-1",
  },
  rzr: {
    id: "rzr",
    label: "FG RZR Sport",
    shortLabel: "RZR Sport",
    tagline: "Aventura y transporte de UTV",
    heroTitleLine: "Configura tu remolque",
    heroEm: "para RZR, motos y cuatrimotos.",
    intro: "Elige una medida, agrega rampas, anclajes y soportes, y colócalos sobre el plano. La plataforma evita que salgan de los límites y detecta cruces antes de enviar el proyecto.",
    equipmentHeading: "Aditamentos",
    equipmentSub: "Toca para añadir al plano",
    equipmentLabel: "aditamentos principales",
    includesNote: "estructura, chasis, cama baja, tren rodante, luces reglamentarias, tirón y cadenas de seguridad",
    defaultPresetId: "rz-194-360",
  },
};

export type Wall = "front" | "back" | "left" | "right";

export type DoorConfig = {
  wall: Wall;
  offsetCm: number;
  widthCm: number;
};

export const DOOR_DEFAULT_WIDTH_CM = 80;
export const DOOR_MIN_WIDTH_CM = 60;
export const DOOR_MAX_WIDTH_CM = 150;
export const DOOR_CLEARANCE_CM = 70;

export const WALL_LABEL: Record<Wall, string> = {
  front: "Frontal (frente / tirón)",
  back: "Trasera",
  left: "Lateral izquierdo",
  right: "Lateral derecho",
};

export function defaultDoor(trailerWidthCm: number): DoorConfig {
  return { wall: "back", offsetCm: Math.max(0, (trailerWidthCm - DOOR_DEFAULT_WIDTH_CM) / 2), widthCm: DOOR_DEFAULT_WIDTH_CM };
}

export function wallLengthCm(wall: Wall, trailerWidthCm: number, trailerLengthCm: number) {
  return wall === "front" || wall === "back" ? trailerWidthCm : trailerLengthCm;
}

export function wallForPoint(xCm: number, yCm: number, trailerWidthCm: number, trailerLengthCm: number): Wall {
  const distFront = yCm;
  const distBack = trailerLengthCm - yCm;
  const distLeft = xCm;
  const distRight = trailerWidthCm - xCm;
  const min = Math.min(distFront, distBack, distLeft, distRight);
  if (min === distLeft) return "left";
  if (min === distRight) return "right";
  if (min === distFront) return "front";
  return "back";
}

export function placeOnWall(wall: Wall, offsetCm: number, alongCm: number, depthCm: number, trailerWidthCm: number, trailerLengthCm: number, mount: "inside" | "outside" = "inside") {
  const rotation: 0 | 90 = wall === "front" || wall === "back" ? 0 : 90;
  const span = wallLengthCm(wall, trailerWidthCm, trailerLengthCm);
  const maxOffset = Math.max(0, span - alongCm);
  const offset = Math.min(Math.max(offsetCm, 0), maxOffset);
  let xCm = 0;
  let yCm = 0;
  if (wall === "front") { xCm = offset; yCm = mount === "outside" ? -depthCm : 0; }
  else if (wall === "back") { xCm = offset; yCm = mount === "outside" ? trailerLengthCm : trailerLengthCm - depthCm; }
  else if (wall === "left") { yCm = offset; xCm = mount === "outside" ? -depthCm : 0; }
  else { yCm = offset; xCm = mount === "outside" ? trailerWidthCm : trailerWidthCm - depthCm; }
  return {
    xCm,
    yCm,
    widthCm: rotation === 0 ? alongCm : depthCm,
    depthCm: rotation === 0 ? depthCm : alongCm,
    rotation,
    offset,
  };
}

export function doorClearanceRect(door: DoorConfig, trailerWidthCm: number, trailerLengthCm: number) {
  if (door.wall === "front") return { xCm: door.offsetCm, yCm: 0, widthCm: door.widthCm, depthCm: DOOR_CLEARANCE_CM };
  if (door.wall === "back") return { xCm: door.offsetCm, yCm: Math.max(0, trailerLengthCm - DOOR_CLEARANCE_CM), widthCm: door.widthCm, depthCm: DOOR_CLEARANCE_CM };
  if (door.wall === "left") return { xCm: 0, yCm: door.offsetCm, widthCm: DOOR_CLEARANCE_CM, depthCm: door.widthCm };
  return { xCm: Math.max(0, trailerWidthCm - DOOR_CLEARANCE_CM), yCm: door.offsetCm, widthCm: DOOR_CLEARANCE_CM, depthCm: door.widthCm };
}

export const AXLE_WHEEL_HEIGHT_CM = 34;
export const AXLE_WHEEL_GAP_CM = 8;

// Axle band is centered at 3/4 of the trailer's length (measured from the front/tow end),
// shared by the plan drawing (wheel positions) and layout validation (door-vs-axle overlap).
export function axleBandCm(preset: { lengthCm: number; axles: number }) {
  const height = preset.axles * AXLE_WHEEL_HEIGHT_CM + (preset.axles - 1) * AXLE_WHEEL_GAP_CM;
  const start = preset.lengthCm * 0.75 - height / 2;
  return { start, end: start + height, height };
}

export function doorOverlapsAxleBand(door: DoorConfig, preset: { lengthCm: number; axles: number }) {
  if (door.wall !== "left" && door.wall !== "right") return false;
  const band = axleBandCm(preset);
  return door.offsetCm < band.end && door.offsetCm + door.widthCm > band.start;
}

export function rectsOverlap(a: { xCm: number; yCm: number; widthCm: number; depthCm: number }, b: { xCm: number; yCm: number; widthCm: number; depthCm: number }) {
  return a.xCm < b.xCm + b.widthCm && a.xCm + a.widthCm > b.xCm && a.yCm < b.yCm + b.depthCm && a.yCm + a.depthCm > b.yCm;
}

export type TrailerPreset = {
  id: string;
  model: ModelId;
  label: string;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  axles: 1 | 2 | 3;
  basePrice: number;
  includedEquipment: number;
  estimatedWeightKg: number;
  estimatedCapacityKg: number;
};

export type EquipmentDefinition = {
  id: string;
  model: ModelId;
  name: string;
  shortName: string;
  category: string;
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
  mount?: "inside" | "outside";
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
  { id: "rz-150-305", model: "rzr", label: "1.50 × 3.05 m · 1 eje", widthCm: 150, lengthCm: 305, heightCm: 55, axles: 1, basePrice: 41900, includedEquipment: 2, estimatedWeightKg: 400, estimatedCapacityKg: 900 },
  { id: "rz-194-360", model: "rzr", label: "1.94 × 3.60 m · 1 eje", widthCm: 194, lengthCm: 360, heightCm: 55, axles: 1, basePrice: 49900, includedEquipment: 3, estimatedWeightKg: 480, estimatedCapacityKg: 1300 },
  { id: "rz-194-360-2e", model: "rzr", label: "1.94 × 3.60 m · doble eje", widthCm: 194, lengthCm: 360, heightCm: 55, axles: 2, basePrice: 58900, includedEquipment: 3, estimatedWeightKg: 560, estimatedCapacityKg: 1900 },
  { id: "rz-207-420-2e", model: "rzr", label: "2.07 × 4.20 m · doble eje", widthCm: 207, lengthCm: 420, heightCm: 55, axles: 2, basePrice: 69900, includedEquipment: 4, estimatedWeightKg: 650, estimatedCapacityKg: 2600 },
];

export const EQUIPMENT: EquipmentDefinition[] = [
  { id: "plancha", model: "food", name: "Plancha", shortName: "Plancha", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 60, maxWidthCm: 180, minDepthCm: 45, maxDepthCm: 65, surcharge: 1000, includedEligible: true, color: "#d6a229", description: "Plancha de acero con quemador; medida base 90 × 50 cm." },
  { id: "bano-maria", model: "food", name: "Baño María", shortName: "Baño María", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 60, maxWidthCm: 140, minDepthCm: 40, maxDepthCm: 65, surcharge: 1500, includedEligible: true, color: "#d88726", description: "Módulo para insertos de 1/4; configuración base de 6 insertos." },
  { id: "freidora", model: "food", name: "Freidora", shortName: "Freidora", category: "coccion", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, surcharge: 1200, includedEligible: true, color: "#c45d35", description: "Freidora integrada con zona de trabajo y alimentación de gas." },
  { id: "parrilla", model: "food", name: "Parrilla con quemador", shortName: "Parrilla", category: "coccion", widthCm: 50, depthCm: 50, minWidthCm: 40, maxWidthCm: 90, minDepthCm: 40, maxDepthCm: 70, surcharge: 1200, includedEligible: true, color: "#b94733", description: "Parrilla o quemador de alta/baja presión según el menú." },
  { id: "asador", model: "food", name: "Asador", shortName: "Asador", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 80, maxWidthCm: 490, minDepthCm: 45, maxDepthCm: 70, surcharge: 2500, includedEligible: true, color: "#8d3c31", description: "Asador seccionado; el crecimiento de longitud se revisa por proyecto." },
  { id: "tarja", model: "food", name: "Tarja con tanque de agua", shortName: "Tarja", category: "agua", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 80, minDepthCm: 35, maxDepthCm: 60, surcharge: 750, includedEligible: true, color: "#2f7f99", description: "Tarja chica, mezcladora y preparación para tanque de agua." },
  { id: "lavamanos", model: "food", name: "Lavamanos exterior", shortName: "Lavamanos", category: "agua", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, surcharge: 2200, includedEligible: false, color: "#4f94aa", description: "Módulo exterior encajonado de aproximadamente 40 × 40 × 70 cm; va montado por fuera del remolque.", mount: "outside" },
  { id: "mesa", model: "food", name: "Mesa de trabajo", shortName: "Mesa", category: "trabajo", widthCm: 120, depthCm: 50, minWidthCm: 40, maxWidthCm: 240, minDepthCm: 40, maxDepthCm: 70, surcharge: 0, includedEligible: false, color: "#5f7481", description: "Cubierta de trabajo en acero inoxidable, ajustable a la distribución." },
  { id: "barra-fria", model: "food", name: "Barra fría con insertos", shortName: "Barra fría", category: "trabajo", widthCm: 90, depthCm: 50, minWidthCm: 60, maxWidthCm: 160, minDepthCm: 40, maxDepthCm: 65, surcharge: 2500, includedEligible: false, color: "#3c8f84", description: "Barra para insertos con cajón para hielo." },
  { id: "panera", model: "food", name: "Panera", shortName: "Panera", category: "trabajo", widthCm: 50, depthCm: 40, minWidthCm: 40, maxWidthCm: 120, minDepthCm: 35, maxDepthCm: 60, surcharge: 1200, includedEligible: false, color: "#788f57", description: "Panera con tapas y división interior." },
  { id: "refrigerador", model: "food", name: "Espacio para refrigerador", shortName: "Refrigerador", category: "trabajo", widthCm: 70, depthCm: 70, minWidthCm: 50, maxWidthCm: 180, minDepthCm: 50, maxDepthCm: 90, surcharge: 0, includedEligible: false, color: "#546ab1", description: "Reserva de espacio; el equipo no se incluye en el precio." },
  { id: "campana", model: "food", name: "Campana con extracción", shortName: "Campana", category: "especial", widthCm: 180, depthCm: 55, minWidthCm: 90, maxWidthCm: 450, minDepthCm: 45, maxDepthCm: 75, surcharge: 4000, includedEligible: false, color: "#714d82", description: "Campana con extractores; base calculada con dos abanicos." },
  { id: "repisa", model: "food", name: "Repisa baja", shortName: "Repisa", category: "especial", widthCm: 120, depthCm: 35, minWidthCm: 50, maxWidthCm: 300, minDepthCm: 25, maxDepthCm: 50, surcharge: 1000, includedEligible: false, color: "#7d6a4c", description: "Repisa bajo mesa de trabajo." },
  { id: "barra-abatible", model: "food", name: "Barra abatible", shortName: "Barra", category: "especial", widthCm: 218, depthCm: 25, minWidthCm: 100, maxWidthCm: 500, minDepthCm: 20, maxDepthCm: 45, surcharge: 2500, includedEligible: false, color: "#2f5d70", description: "Barra cromada o antiderrapante abatible para servicio; va montada por fuera del remolque.", mount: "outside" },
  { id: "base-gas", model: "food", name: "Base para gas", shortName: "Base gas", category: "especial", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, surcharge: 800, includedEligible: false, color: "#6f6f6f", description: "Base exterior para cilindro; la ubicación final requiere validación." },

  { id: "rampa", model: "cargo", name: "Rampa de acceso", shortName: "Rampa", category: "acceso", widthCm: 150, depthCm: 45, minWidthCm: 100, maxWidthCm: 220, minDepthCm: 35, maxDepthCm: 60, surcharge: 1800, includedEligible: true, color: "#c45d35", description: "Rampa abatible para carga y descarga por la parte trasera." },
  { id: "compuerta", model: "cargo", name: "Compuerta trasera abatible", shortName: "Compuerta", category: "acceso", widthCm: 150, depthCm: 20, minWidthCm: 100, maxWidthCm: 220, minDepthCm: 15, maxDepthCm: 30, surcharge: 2200, includedEligible: false, color: "#8d3c31", description: "Compuerta trasera con bisagras reforzadas." },
  { id: "rack-lateral", model: "cargo", name: "Rack lateral", shortName: "Rack", category: "almacen", widthCm: 30, depthCm: 240, minWidthCm: 20, maxWidthCm: 40, minDepthCm: 150, maxDepthCm: 400, surcharge: 1500, includedEligible: false, color: "#5f7481", description: "Rack lateral para herramienta y tubería larga." },
  { id: "caja-herramientas", model: "cargo", name: "Caja de herramientas", shortName: "Caja", category: "almacen", widthCm: 60, depthCm: 40, minWidthCm: 40, maxWidthCm: 90, minDepthCm: 30, maxDepthCm: 50, surcharge: 1200, includedEligible: true, color: "#788f57", description: "Caja metálica con cerradura, montada al frente del remolque." },
  { id: "amarres", model: "cargo", name: "Amarres adicionales", shortName: "Amarres", category: "seguridad", widthCm: 20, depthCm: 20, minWidthCm: 15, maxWidthCm: 30, minDepthCm: 15, maxDepthCm: 30, surcharge: 600, includedEligible: true, color: "#2f7f99", description: "Punto de amarre reforzado adicional." },
  { id: "malla-piso", model: "cargo", name: "Malla o lona de piso", shortName: "Malla", category: "estructura", widthCm: 150, depthCm: 200, minWidthCm: 100, maxWidthCm: 220, minDepthCm: 100, maxDepthCm: 500, surcharge: 900, includedEligible: false, color: "#4f94aa", description: "Cubierta de malla o lona para proteger la carga." },
  { id: "salpicaderas", model: "cargo", name: "Salpicaderas reforzadas", shortName: "Salpicaderas", category: "seguridad", widthCm: 20, depthCm: 30, minWidthCm: 15, maxWidthCm: 25, minDepthCm: 20, maxDepthCm: 40, surcharge: 500, includedEligible: true, color: "#6f6f6f", description: "Salpicadera reforzada sobre cada rueda." },
  { id: "luces-led", model: "cargo", name: "Luces de trabajo LED", shortName: "Luces LED", category: "estructura", widthCm: 15, depthCm: 15, minWidthCm: 10, maxWidthCm: 20, minDepthCm: 10, maxDepthCm: 20, surcharge: 700, includedEligible: false, color: "#d6a229", description: "Luz LED de trabajo orientable." },

  { id: "rampa-reforzada", model: "rzr", name: "Rampa reforzada", shortName: "Rampa", category: "acceso", widthCm: 180, depthCm: 50, minWidthCm: 150, maxWidthCm: 220, minDepthCm: 40, maxDepthCm: 70, surcharge: 2200, includedEligible: true, color: "#c45d35", description: "Rampa reforzada para UTV, RZR o cuatrimoto." },
  { id: "anclajes", model: "rzr", name: "Anclajes regulables", shortName: "Anclajes", category: "seguridad", widthCm: 20, depthCm: 20, minWidthCm: 15, maxWidthCm: 30, minDepthCm: 15, maxDepthCm: 30, surcharge: 600, includedEligible: true, color: "#2f7f99", description: "Anclaje regulable para asegurar el vehículo." },
  { id: "malacate", model: "rzr", name: "Malacate eléctrico", shortName: "Malacate", category: "estructura", widthCm: 40, depthCm: 30, minWidthCm: 30, maxWidthCm: 50, minDepthCm: 20, maxDepthCm: 40, surcharge: 3500, includedEligible: false, color: "#092f46", description: "Malacate eléctrico frontal para autocarga." },
  { id: "freno-inercia", model: "rzr", name: "Freno de inercia", shortName: "Freno", category: "seguridad", widthCm: 30, depthCm: 20, minWidthCm: 20, maxWidthCm: 40, minDepthCm: 15, maxDepthCm: 30, surcharge: 2800, includedEligible: false, color: "#714d82", description: "Sistema de freno de inercia para remolque cargado." },
  { id: "riel-motos", model: "rzr", name: "Riel para motos", shortName: "Riel motos", category: "almacen", widthCm: 25, depthCm: 300, minWidthCm: 20, maxWidthCm: 35, minDepthCm: 150, maxDepthCm: 400, surcharge: 1800, includedEligible: false, color: "#5f7481", description: "Riel con topes para asegurar motocicletas." },
  { id: "soporte-cuatri", model: "rzr", name: "Soporte cuatrimoto adicional", shortName: "Soporte", category: "almacen", widthCm: 60, depthCm: 90, minWidthCm: 50, maxWidthCm: 80, minDepthCm: 70, maxDepthCm: 120, surcharge: 1500, includedEligible: false, color: "#3c8f84", description: "Soporte adicional para una segunda cuatrimoto." },
  { id: "cama-baja", model: "rzr", name: "Extensión de cama baja", shortName: "Cama baja", category: "estructura", widthCm: 194, depthCm: 60, minWidthCm: 150, maxWidthCm: 220, minDepthCm: 40, maxDepthCm: 90, surcharge: 2500, includedEligible: false, color: "#8d3c31", description: "Extensión de cama baja para UTV de mayor longitud." },
  { id: "portallantas", model: "rzr", name: "Portallantas de refacción", shortName: "Portallantas", category: "seguridad", widthCm: 40, depthCm: 40, minWidthCm: 30, maxWidthCm: 50, minDepthCm: 30, maxDepthCm: 50, surcharge: 900, includedEligible: true, color: "#6f6f6f", description: "Soporte para llanta de refacción." },
];

export function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

export function getPresetsForModel(modelId: ModelId) {
  return TRAILER_PRESETS.filter((preset) => preset.model === modelId);
}

export function getEquipmentForModel(modelId: ModelId) {
  return EQUIPMENT.filter((equipment) => equipment.model === modelId);
}

export function getEquipment(id: string) {
  return EQUIPMENT.find((equipment) => equipment.id === id);
}

export function axleLabel(axles: number) {
  return axles === 1 ? "1 eje" : axles === 2 ? "Doble eje" : "Triple eje";
}

export function getSizingMode(modelId: ModelId): "preset" | "custom" {
  return modelId === "rzr" ? "preset" : "custom";
}

type CustomModelId = "food" | "cargo";

export const CUSTOM_WIDTH_OPTIONS_CM = [180, 200, 220] as const;
export const CUSTOM_LENGTH_MIN_CM = 200;
export const CUSTOM_LENGTH_MAX_CM = 900;
export const CUSTOM_LENGTH_STEP_CM = 50;
export const CUSTOM_HEIGHT_MIN_CM = 210;
export const CUSTOM_HEIGHT_STEP_CM = 10;

// Widths of 180cm only fit the two shortest lengths; every longer trailer needs the wider axle track.
export function getAllowedWidths(lengthCm: number): number[] {
  return lengthCm <= 250 ? [...CUSTOM_WIDTH_OPTIONS_CM] : [200, 220];
}

// 3m height is only offered from 5m of length onward, so shorter trailers don't look top-heavy.
export function getMaxHeightCm(lengthCm: number): number {
  return lengthCm < 500 ? 270 : 300;
}

// Axle count is forced (not just capped) past 4.5m of length — the trailer needs the extra axle to carry itself.
export function getAllowedAxles(lengthCm: number): (1 | 2 | 3)[] {
  if (lengthCm <= 450) return [1, 2];
  if (lengthCm <= 650) return [2];
  return [3];
}

export function getCustomLengthOptions(): number[] {
  const values: number[] = [];
  for (let v = CUSTOM_LENGTH_MIN_CM; v <= CUSTOM_LENGTH_MAX_CM; v += CUSTOM_LENGTH_STEP_CM) values.push(v);
  return values;
}

export function getCustomHeightOptions(lengthCm: number): number[] {
  const max = getMaxHeightCm(lengthCm);
  const values: number[] = [];
  for (let v = CUSTOM_HEIGHT_MIN_CM; v <= max; v += CUSTOM_HEIGHT_STEP_CM) values.push(v);
  return values;
}

export function buildCustomPresetId(model: CustomModelId, widthCm: number, lengthCm: number, heightCm: number, axles: 1 | 2 | 3) {
  return `custom-${model}-${widthCm}-${lengthCm}-${heightCm}-${axles}`;
}

function parseCustomPresetId(id: string): { model: CustomModelId; widthCm: number; lengthCm: number; heightCm: number; axles: number } | null {
  const match = /^custom-(food|cargo)-(\d+)-(\d+)-(\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  const [, model, widthCm, lengthCm, heightCm, axles] = match;
  return { model: model as CustomModelId, widthCm: Number(widthCm), lengthCm: Number(lengthCm), heightCm: Number(heightCm), axles: Number(axles) };
}

function clampToStep(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(Math.max(value, min), max);
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.min(Math.max(snapped, min), max);
}

function pickNearestAllowed(value: number, allowed: number[]) {
  if (allowed.includes(value)) return value;
  return allowed.reduce((best, candidate) => (Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best), allowed[0]);
}

// Single source of truth for "is this combination legal" — length is sanitized first since every
// other dimension's allowed range is derived from it, then width/height/axles are snapped to fit.
function sanitizeCustomDims(lengthCmRaw: number, widthCmRaw: number, heightCmRaw: number, axlesRaw: number) {
  const lengthCm = clampToStep(lengthCmRaw, CUSTOM_LENGTH_MIN_CM, CUSTOM_LENGTH_MAX_CM, CUSTOM_LENGTH_STEP_CM);
  const widthCm = pickNearestAllowed(widthCmRaw, getAllowedWidths(lengthCm));
  const heightCm = clampToStep(heightCmRaw, CUSTOM_HEIGHT_MIN_CM, getMaxHeightCm(lengthCm), CUSTOM_HEIGHT_STEP_CM);
  const axles = pickNearestAllowed(axlesRaw, getAllowedAxles(lengthCm)) as 1 | 2 | 3;
  return { widthCm, lengthCm, heightCm, axles };
}

// Calibrated against the historical fixed-preset prices/weights: a fixed base cost plus a rate per
// m² of floor and per m² of "wall" (perimeter × height), plus a flat cost per axle beyond the first.
const CUSTOM_PRICE_COEFFICIENTS: Record<CustomModelId, { priceBase: number; priceFloor: number; priceWall: number; priceAxle: number; weightBase: number; weightFloor: number; weightWall: number; weightAxle: number }> = {
  food: { priceBase: 32000, priceFloor: 3600, priceWall: 900, priceAxle: 7500, weightBase: 545, weightFloor: 14.3, weightWall: 3.6, weightAxle: 150 },
  cargo: { priceBase: 16000, priceFloor: 5600, priceWall: 220, priceAxle: 9500, weightBase: 247, weightFloor: 26.8, weightWall: 1.1, weightAxle: 124 },
};

const CUSTOM_CAPACITY_FACTOR: Record<1 | 2 | 3, number> = { 1: 2.2, 2: 3.2, 3: 4.0 };

function includedEquipmentForCustom(model: CustomModelId, lengthCm: number) {
  const lengthM = lengthCm / 100;
  const raw = model === "food" ? Math.round(lengthM) : Math.round(lengthM * 0.8);
  return Math.min(6, Math.max(2, raw));
}

export function buildCustomPreset(model: CustomModelId, widthCmRaw: number, lengthCmRaw: number, heightCmRaw: number, axlesRaw: number): TrailerPreset {
  const { widthCm, lengthCm, heightCm, axles } = sanitizeCustomDims(lengthCmRaw, widthCmRaw, heightCmRaw, axlesRaw);
  const floorAreaM2 = (widthCm / 100) * (lengthCm / 100);
  const wallAreaM2 = 2 * (widthCm / 100 + lengthCm / 100) * (heightCm / 100);
  const extraAxles = axles - 1;
  const coeff = CUSTOM_PRICE_COEFFICIENTS[model];
  const basePrice = Math.round(coeff.priceBase + coeff.priceFloor * floorAreaM2 + coeff.priceWall * wallAreaM2 + coeff.priceAxle * extraAxles);
  const estimatedWeightKg = Math.round(coeff.weightBase + coeff.weightFloor * floorAreaM2 + coeff.weightWall * wallAreaM2 + coeff.weightAxle * extraAxles);
  const estimatedCapacityKg = Math.round(estimatedWeightKg * CUSTOM_CAPACITY_FACTOR[axles]);
  return {
    id: buildCustomPresetId(model, widthCm, lengthCm, heightCm, axles),
    model,
    label: `${(widthCm / 100).toFixed(2)} × ${(lengthCm / 100).toFixed(2)} m · ${axleLabel(axles)}`,
    widthCm,
    lengthCm,
    heightCm,
    axles,
    basePrice,
    includedEquipment: includedEquipmentForCustom(model, lengthCm),
    estimatedWeightKg,
    estimatedCapacityKg,
  };
}

export function getPreset(id: string) {
  const found = TRAILER_PRESETS.find((preset) => preset.id === id);
  if (found) return found;
  const parsed = parseCustomPresetId(id);
  // Unreachable on any validated path (route.ts gates with isValidPresetId; the client only ever
  // builds ids via buildCustomPresetId or the RZR preset <select>) — kept as a safe fallback only.
  if (parsed) return buildCustomPreset(parsed.model, parsed.widthCm, parsed.lengthCm, parsed.heightCm, parsed.axles);
  return TRAILER_PRESETS[0];
}

export function isValidPresetId(id: string) {
  if (TRAILER_PRESETS.some((preset) => preset.id === id)) return true;
  const parsed = parseCustomPresetId(id);
  if (!parsed) return false;
  const sane = sanitizeCustomDims(parsed.lengthCm, parsed.widthCm, parsed.heightCm, parsed.axles);
  return sane.widthCm === parsed.widthCm && sane.lengthCm === parsed.lengthCm && sane.heightCm === parsed.heightCm && sane.axles === parsed.axles;
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

export function validateLayout(preset: TrailerPreset, items: PlacedEquipment[], door?: DoorConfig) {
  const errors: string[] = [];
  if (door && doorOverlapsAxleBand(door, preset)) errors.push("La puerta no puede colocarse sobre los ejes.");
  const clearance = door ? doorClearanceRect(door, preset.widthCm, preset.lengthCm) : null;
  for (const item of items) {
    const definition = getEquipment(item.typeId);
    if (!definition) {
      errors.push("Hay un equipo desconocido en el plano.");
      continue;
    }
    const mount = definition.mount ?? "inside";
    const minWidth = item.rotation === 90 ? definition.minDepthCm : definition.minWidthCm;
    const maxWidth = item.rotation === 90 ? definition.maxDepthCm : definition.maxWidthCm;
    const minDepth = item.rotation === 90 ? definition.minWidthCm : definition.minDepthCm;
    const maxDepth = item.rotation === 90 ? definition.maxWidthCm : definition.maxDepthCm;
    if (item.widthCm < minWidth || item.widthCm > maxWidth || item.depthCm < minDepth || item.depthCm > maxDepth) {
      errors.push(`${definition.name} tiene medidas fuera del rango permitido.`);
    }
    if (mount === "inside" && (item.xCm < 0 || item.yCm < 0 || item.xCm + item.widthCm > preset.widthCm || item.yCm + item.depthCm > preset.lengthCm)) {
      errors.push(`${definition.name} está fuera del remolque.`);
    }
    if (mount === "inside" && clearance && rectsOverlap(item, clearance)) {
      errors.push(`${definition.name} bloquea el acceso de la puerta.`);
    }
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (rectsOverlap(a, b)) errors.push(`${getEquipment(a.typeId)?.name ?? "Equipo"} se cruza con ${getEquipment(b.typeId)?.name ?? "otro equipo"}.`);
    }
  }
  return [...new Set(errors)];
}
