export type ModelId = "food" | "cargo" | "rzr";

export type ModelMeta = {
  id: ModelId;
  label: string;
  shortLabel: string;
  tagline: string;
  heroTitleLine: string;
  heroEm: string;
  heroEmAddons?: string;
  intro: string;
  introAddons: string;
  equipmentHeading: string;
  equipmentSub: string;
  equipmentLabel: string;
  includesNote: string;
  defaultPresetId: string;
};

export const MODEL_META: Record<ModelId, ModelMeta> = {
  food: {
    id: "food",
    label: "FG Food Trailer",
    shortLabel: "Food Trailer",
    tagline: "Cocina móvil",
    heroTitleLine: "Elige tu",
    heroEm: "Food Trailer.",
    intro: "Selecciona el modelo que mejor se adapte a tu negocio.",
    introAddons: "Selecciona el modelo que mejor se adapte a tu negocio.",
    equipmentHeading: "Equipamiento",
    equipmentSub: "Toca para añadir al plano",
    equipmentLabel: "equipos principales",
    includesNote: "estructura, chasis, laminado, tren rodante, instalación eléctrica y de gas base, mesa de trabajo perimetral",
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
    introAddons: "Elige la medida y agrega rampas, racks y amarres para armar tu cotización al instante.",
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
    introAddons: "Elige la medida y agrega rampas, anclajes y soportes para armar tu cotización al instante.",
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

// The food truck's perimeter work counter — always included, not one of the priced/placed accessories.
export const PERIMETER_TABLE_DEPTH_CM = 55;

// widthCm/heightCm are each window's own current size — windows are resizable per-instance
// (drawing only, no cost impact); windowWidthCm()/windowHeightCm() below only compute the
// starting size for a new window, proportional to that trailer's own dimensions.
export type WindowConfig = { id: string; wall: Wall; offsetCm: number; widthCm: number; heightCm: number };

type WindowWallType = "lateral" | "frontal";

export const WINDOW_WIDTH_MIN_CM = 40;
export const WINDOW_WIDTH_MAX_CM = 300;
export const WINDOW_HEIGHT_MIN_CM = 35;
export const WINDOW_HEIGHT_MAX_CM = 120;

// Ventanas laterales (a lo largo del remolque) y frontales (a lo ancho) escalan como una fracción
// de la pared y de la altura donde van, en vez de un tamaño fijo — así siempre quedan proporcionadas
// y jamás más anchas que la propia pared, sin importar el tamaño del remolque.
const WINDOW_RATIO: Record<WindowWallType, { width: number; height: number }> = {
  lateral: { width: 0.45, height: 0.35 },
  frontal: { width: 0.5, height: 0.28 },
};

export function windowWallType(wall: Wall): WindowWallType {
  return wall === "left" || wall === "right" ? "lateral" : "frontal";
}

export function windowWidthCm(wall: Wall, trailerWidthCm: number, trailerLengthCm: number) {
  const span = wallLengthCm(wall, trailerWidthCm, trailerLengthCm);
  return clampWindowWidthCm(Math.round(span * WINDOW_RATIO[windowWallType(wall)].width));
}

export function windowHeightCm(wall: Wall, trailerHeightCm: number) {
  return clampWindowHeightCm(Math.round(trailerHeightCm * WINDOW_RATIO[windowWallType(wall)].height));
}

export function clampWindowWidthCm(value: number) {
  return Math.min(WINDOW_WIDTH_MAX_CM, Math.max(WINDOW_WIDTH_MIN_CM, value));
}

export function clampWindowHeightCm(value: number) {
  return Math.min(WINDOW_HEIGHT_MAX_CM, Math.max(WINDOW_HEIGHT_MIN_CM, value));
}

// One window per wall, max: left, right, and whichever front/back wall isn't holding the door —
// 3 total. Centered on each wall so it's always valid regardless of trailer size.
export function defaultWindows(doorWall: Wall, trailerWidthCm: number, trailerLengthCm: number, trailerHeightCm: number): WindowConfig[] {
  const oppositeFrontBack: Wall = doorWall === "front" ? "back" : "front";
  const frontalWall: Wall = doorWall === "left" || doorWall === "right" ? "front" : oppositeFrontBack;
  const lateralWidth = windowWidthCm("left", trailerWidthCm, trailerLengthCm);
  const lateralOffset = Math.max(0, (trailerLengthCm - lateralWidth) / 2);
  const frontalSpan = wallLengthCm(frontalWall, trailerWidthCm, trailerLengthCm);
  const frontalWidth = windowWidthCm(frontalWall, trailerWidthCm, trailerLengthCm);
  const frontalOffset = Math.max(0, (frontalSpan - frontalWidth) / 2);
  return [
    { id: "win-left", wall: "left", offsetCm: lateralOffset, widthCm: lateralWidth, heightCm: windowHeightCm("left", trailerHeightCm) },
    { id: "win-right", wall: "right", offsetCm: lateralOffset, widthCm: lateralWidth, heightCm: windowHeightCm("right", trailerHeightCm) },
    { id: "win-frontal", wall: frontalWall, offsetCm: frontalOffset, widthCm: frontalWidth, heightCm: windowHeightCm(frontalWall, trailerHeightCm) },
  ];
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

// Tarifa de los aditamentos que exceden la cantidad incluida por el tamaño cotizado.
// INCLUDED_EQUIPMENT_COUNT queda como fallback de compatibilidad; cada preset resuelto lleva su
// cantidad real (2 para referencias menores de 3 m y 5 desde 3 m).
export const INCLUDED_EQUIPMENT_COUNT = 5;
export const EXTRA_EQUIPMENT_PRICE = 2500;

// Valores de compatibilidad para filas que no fueron publicadas en el PDF. No se usan para mezclar
// filas existentes de uno y dos ejes: cuando el PDF trae ambos precios, cada uno se conserva.
export const SECOND_AXLE_SURCHARGE = 7000;
export const ADDITIONAL_LENGTH_SURCHARGE = 4500;
export const CUSTOM_NEXT_STANDARD_GAP = 1500;
export const PRICE_ROUNDING_STEP = 500;
export const PRICING_VERSION = 4;

export type TrailerPriceSeries = "price" | "suggested";
export type TrailerPriceReferenceRow = {
  widthCm: number;
  lengthCm: number;
  oneAxlePrice: number | null;
  twoAxlePriceInPdf: number | null;
  oneAxleSuggestedPrice: number | null;
  twoAxleSuggestedPriceInPdf: number | null;
};

// Transcripción literal de las columnas PRECIO y PRECIO SUGERIDO del PDF. Los null distinguen una
// celda ausente de las bases calculadas posteriormente con las reglas comerciales autorizadas.
export const PDF_TRAILER_PRICE_REFERENCE: TrailerPriceReferenceRow[] = [
  { widthCm: 180, lengthCm: 200, oneAxlePrice: 59324, twoAxlePriceInPdf: null, oneAxleSuggestedPrice: 50500, twoAxleSuggestedPriceInPdf: null },
  { widthCm: 180, lengthCm: 250, oneAxlePrice: 64454, twoAxlePriceInPdf: null, oneAxleSuggestedPrice: 54500, twoAxleSuggestedPriceInPdf: null },
  { widthCm: 200, lengthCm: 200, oneAxlePrice: 61520, twoAxlePriceInPdf: 69020, oneAxleSuggestedPrice: 56000, twoAxleSuggestedPriceInPdf: 62500 },
  { widthCm: 200, lengthCm: 250, oneAxlePrice: 67010, twoAxlePriceInPdf: 74510, oneAxleSuggestedPrice: 61500, twoAxleSuggestedPriceInPdf: 68000 },
  { widthCm: 200, lengthCm: 300, oneAxlePrice: 72500, twoAxlePriceInPdf: 80000, oneAxleSuggestedPrice: 69500, twoAxleSuggestedPriceInPdf: 76000 },
  { widthCm: 200, lengthCm: 350, oneAxlePrice: 77990, twoAxlePriceInPdf: 85490, oneAxleSuggestedPrice: 74500, twoAxleSuggestedPriceInPdf: 81500 },
  { widthCm: 200, lengthCm: 400, oneAxlePrice: 83480, twoAxlePriceInPdf: 90980, oneAxleSuggestedPrice: 80500, twoAxleSuggestedPriceInPdf: 87500 },
  { widthCm: 200, lengthCm: 450, oneAxlePrice: 88970, twoAxlePriceInPdf: 96470, oneAxleSuggestedPrice: 84000, twoAxleSuggestedPriceInPdf: 91500 },
  { widthCm: 200, lengthCm: 500, oneAxlePrice: null, twoAxlePriceInPdf: 101960, oneAxleSuggestedPrice: null, twoAxleSuggestedPriceInPdf: 106000 },
  { widthCm: 200, lengthCm: 550, oneAxlePrice: null, twoAxlePriceInPdf: 107450, oneAxleSuggestedPrice: null, twoAxleSuggestedPriceInPdf: 111500 },
  { widthCm: 220, lengthCm: 200, oneAxlePrice: 63716, twoAxlePriceInPdf: 71216, oneAxleSuggestedPrice: 60500, twoAxleSuggestedPriceInPdf: 67500 },
  { widthCm: 220, lengthCm: 250, oneAxlePrice: 69566, twoAxlePriceInPdf: 77066, oneAxleSuggestedPrice: 65000, twoAxleSuggestedPriceInPdf: 69500 },
  { widthCm: 220, lengthCm: 300, oneAxlePrice: 75416, twoAxlePriceInPdf: 82916, oneAxleSuggestedPrice: 73000, twoAxleSuggestedPriceInPdf: 80500 },
  { widthCm: 220, lengthCm: 350, oneAxlePrice: 81266, twoAxlePriceInPdf: 88766, oneAxleSuggestedPrice: 77000, twoAxleSuggestedPriceInPdf: 84500 },
  { widthCm: 220, lengthCm: 400, oneAxlePrice: 87116, twoAxlePriceInPdf: 94616, oneAxleSuggestedPrice: 84000, twoAxleSuggestedPriceInPdf: 91500 },
  { widthCm: 220, lengthCm: 450, oneAxlePrice: 92966, twoAxlePriceInPdf: 100466, oneAxleSuggestedPrice: 89000, twoAxleSuggestedPriceInPdf: 96500 },
  { widthCm: 220, lengthCm: 500, oneAxlePrice: null, twoAxlePriceInPdf: 106316, oneAxleSuggestedPrice: null, twoAxleSuggestedPriceInPdf: 110500 },
  { widthCm: 220, lengthCm: 550, oneAxlePrice: null, twoAxlePriceInPdf: 112166, oneAxleSuggestedPrice: null, twoAxleSuggestedPriceInPdf: 115000 },
  { widthCm: 220, lengthCm: 600, oneAxlePrice: null, twoAxlePriceInPdf: null, oneAxleSuggestedPrice: null, twoAxleSuggestedPriceInPdf: 117500 },
];

export function getReferenceOneAxlePrice(widthCm: number, lengthCm: number, series: TrailerPriceSeries = "price") {
  const row = PDF_TRAILER_PRICE_REFERENCE.find((candidate) => candidate.widthCm === widthCm && candidate.lengthCm === lengthCm);
  if (series === "price") return row?.oneAxlePrice ?? null;
  if (row?.oneAxleSuggestedPrice != null) return row.oneAxleSuggestedPrice;
  // When the PDF only publishes the two-axle variant, recover the one-axle base using the same
  // fixed $7,000 difference that governs the complete suggested-price series.
  return row?.twoAxleSuggestedPriceInPdf == null ? null : row.twoAxleSuggestedPriceInPdf - SECOND_AXLE_SURCHARGE;
}

export function getReferenceTwoAxlePrice(widthCm: number, lengthCm: number, series: TrailerPriceSeries = "price") {
  const row = PDF_TRAILER_PRICE_REFERENCE.find((candidate) => candidate.widthCm === widthCm && candidate.lengthCm === lengthCm);
  const exact = series === "price" ? row?.twoAxlePriceInPdf : row?.twoAxleSuggestedPriceInPdf;
  if (exact != null) return exact;
  const oneAxle = getReferenceOneAxlePrice(widthCm, lengthCm, series);
  return oneAxle == null ? null : oneAxle + SECOND_AXLE_SURCHARGE;
}

// Serie completa de referencias de un eje aprobada para Food Trailer. Los valores que no aparecen
// como un eje en el PDF se congelan aquí de forma explícita; ya no se extrapolan durante la venta.
const FOOD_ONE_AXLE_STANDARD_PRICES: Record<number, Record<number, number>> = {
  180: { 200: 50500, 250: 54500 },
  200: { 200: 56000, 250: 61500, 300: 69500, 350: 74500, 400: 80500, 450: 84000, 500: 99000, 550: 104500, 600: 106500, 650: 111500, 700: 116500, 750: 121500, 800: 126500, 850: 131500, 900: 136500 },
  220: { 200: 60500, 250: 65000, 300: 73000, 350: 77000, 400: 84000, 450: 89000, 500: 103500, 550: 108000, 600: 110500, 650: 115500, 700: 120500, 750: 125500, 800: 130500, 850: 135500, 900: 140500 },
};

export function getSuggestedOneAxlePrice(widthCm: number, standardLengthCm: number) {
  return FOOD_ONE_AXLE_STANDARD_PRICES[widthCm]?.[standardLengthCm] ?? null;
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
  color: string;
  description: string;
  mount?: "inside" | "outside";
  // Mounted above or below the working counter, so it doesn't compete for floor/wall space with other equipment.
  overlapExempt?: boolean;
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
  { id: "rz-150-305", model: "rzr", label: "1.50 × 3.05 m · 1 eje", widthCm: 150, lengthCm: 305, heightCm: 55, axles: 1, basePrice: 42000, includedEquipment: 5, estimatedWeightKg: 400, estimatedCapacityKg: 900 },
  { id: "rz-194-360", model: "rzr", label: "1.94 × 3.60 m · 1 eje", widthCm: 194, lengthCm: 360, heightCm: 55, axles: 1, basePrice: 50000, includedEquipment: 5, estimatedWeightKg: 480, estimatedCapacityKg: 1300 },
  { id: "rz-194-360-2e", model: "rzr", label: "1.94 × 3.60 m · doble eje", widthCm: 194, lengthCm: 360, heightCm: 55, axles: 2, basePrice: 57000, includedEquipment: 5, estimatedWeightKg: 560, estimatedCapacityKg: 1900 },
  { id: "rz-207-420-2e", model: "rzr", label: "2.07 × 4.20 m · doble eje", widthCm: 207, lengthCm: 420, heightCm: 55, axles: 2, basePrice: 70000, includedEquipment: 5, estimatedWeightKg: 650, estimatedCapacityKg: 2600 },
];

export const EQUIPMENT: EquipmentDefinition[] = [
  { id: "plancha", model: "food", name: "Plancha", shortName: "Plancha", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 60, maxWidthCm: 180, minDepthCm: 45, maxDepthCm: 65, color: "#d6a229", description: "Plancha de acero con quemador; medida base 90 × 50 cm." },
  { id: "bano-maria", model: "food", name: "Baño María", shortName: "Baño María", category: "coccion", widthCm: 60, depthCm: 50, minWidthCm: 40, maxWidthCm: 65, minDepthCm: 40, maxDepthCm: 140, color: "#d88726", description: "Módulo para insertos de 1/4; configuración base de 6 insertos." },
  { id: "freidora", model: "food", name: "Freidora", shortName: "Freidora", category: "coccion", widthCm: 30, depthCm: 40, minWidthCm: 25, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, color: "#c45d35", description: "Freidora integrada con zona de trabajo y alimentación de gas." },
  { id: "parrilla", model: "food", name: "Parrilla con quemador", shortName: "Parrilla", category: "coccion", widthCm: 50, depthCm: 40, minWidthCm: 40, maxWidthCm: 70, minDepthCm: 40, maxDepthCm: 90, color: "#b94733", description: "Parrilla o quemador de alta/baja presión según el menú." },
  { id: "asador", model: "food", name: "Asador", shortName: "Asador", category: "coccion", widthCm: 90, depthCm: 50, minWidthCm: 80, maxWidthCm: 490, minDepthCm: 45, maxDepthCm: 70, color: "#8d3c31", description: "Asador seccionado; el crecimiento de longitud se revisa por proyecto." },
  { id: "tarja", model: "food", name: "Tarja con tanque de agua", shortName: "Tarja", category: "agua", widthCm: 50, depthCm: 45, minWidthCm: 35, maxWidthCm: 80, minDepthCm: 35, maxDepthCm: 60, color: "#2f7f99", description: "Tarja chica, mezcladora y preparación para tanque de agua." },
  { id: "lavamanos", model: "food", name: "Tarja exterior", shortName: "Tarja ext.", category: "agua", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, color: "#4f94aa", description: "Módulo exterior encajonado de aproximadamente 40 × 40 × 70 cm; va montado por fuera del remolque.", mount: "outside" },
  { id: "barra-fria", model: "food", name: "Barra fría con insertos", shortName: "Barra fría", category: "trabajo", widthCm: 90, depthCm: 40, minWidthCm: 60, maxWidthCm: 160, minDepthCm: 40, maxDepthCm: 65, color: "#3c8f84", description: "Barra para insertos con cajón para hielo." },
  { id: "panera", model: "food", name: "Panera", shortName: "Panera", category: "trabajo", widthCm: 60, depthCm: 50, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 40, maxDepthCm: 120, color: "#788f57", description: "Panera con tapas y división interior." },
  { id: "refrigerador", model: "food", name: "Espacio para refrigerador", shortName: "Refrigerador", category: "trabajo", widthCm: 75, depthCm: 70, minWidthCm: 50, maxWidthCm: 180, minDepthCm: 50, maxDepthCm: 90, color: "#546ab1", description: "Reserva de espacio; el equipo no se incluye en el precio." },
  { id: "campana", model: "food", name: "Campana con extractor", shortName: "Campana", category: "especial", widthCm: 100, depthCm: 60, minWidthCm: 90, maxWidthCm: 450, minDepthCm: 45, maxDepthCm: 75, color: "#714d82", description: "Campana con extractores; va montada en alto y puede sobreponerse a otros equipos.", overlapExempt: true },
  { id: "repisa", model: "food", name: "Repisa baja", shortName: "Repisa", category: "especial", widthCm: 120, depthCm: 35, minWidthCm: 50, maxWidthCm: 300, minDepthCm: 25, maxDepthCm: 50, color: "#7d6a4c", description: "Repisa bajo mesa de trabajo; puede sobreponerse a otros equipos.", overlapExempt: true },
  { id: "barra-abatible", model: "food", name: "Barra abatible", shortName: "Barra", category: "especial", widthCm: 220, depthCm: 25, minWidthCm: 100, maxWidthCm: 500, minDepthCm: 20, maxDepthCm: 45, color: "#2f5d70", description: "Barra cromada o antiderrapante abatible para servicio; va montada por fuera del remolque.", mount: "outside" },
  { id: "base-gas", model: "food", name: "Base para gas", shortName: "Base gas", category: "especial", widthCm: 40, depthCm: 40, minWidthCm: 35, maxWidthCm: 60, minDepthCm: 35, maxDepthCm: 60, color: "#6f6f6f", description: "Base exterior para cilindro; va montada por fuera y no afecta el interior.", mount: "outside" },

  { id: "rampa", model: "cargo", name: "Rampa de acceso", shortName: "Rampa", category: "acceso", widthCm: 150, depthCm: 45, minWidthCm: 100, maxWidthCm: 220, minDepthCm: 35, maxDepthCm: 60, color: "#c45d35", description: "Rampa abatible para carga y descarga por la parte trasera." },
  { id: "compuerta", model: "cargo", name: "Compuerta trasera abatible", shortName: "Compuerta", category: "acceso", widthCm: 150, depthCm: 20, minWidthCm: 100, maxWidthCm: 220, minDepthCm: 15, maxDepthCm: 30, color: "#8d3c31", description: "Compuerta trasera con bisagras reforzadas." },
  { id: "rack-lateral", model: "cargo", name: "Rack lateral", shortName: "Rack", category: "almacen", widthCm: 30, depthCm: 240, minWidthCm: 20, maxWidthCm: 40, minDepthCm: 150, maxDepthCm: 400, color: "#5f7481", description: "Rack lateral para herramienta y tubería larga." },
  { id: "caja-herramientas", model: "cargo", name: "Caja de herramientas", shortName: "Caja", category: "almacen", widthCm: 60, depthCm: 40, minWidthCm: 40, maxWidthCm: 90, minDepthCm: 30, maxDepthCm: 50, color: "#788f57", description: "Caja metálica con cerradura, montada al frente del remolque." },
  { id: "amarres", model: "cargo", name: "Amarres adicionales", shortName: "Amarres", category: "seguridad", widthCm: 20, depthCm: 20, minWidthCm: 15, maxWidthCm: 30, minDepthCm: 15, maxDepthCm: 30, color: "#2f7f99", description: "Punto de amarre reforzado adicional." },
  { id: "malla-piso", model: "cargo", name: "Malla o lona de piso", shortName: "Malla", category: "estructura", widthCm: 150, depthCm: 200, minWidthCm: 100, maxWidthCm: 220, minDepthCm: 100, maxDepthCm: 500, color: "#4f94aa", description: "Cubierta de malla o lona para proteger la carga." },
  { id: "salpicaderas", model: "cargo", name: "Salpicaderas reforzadas", shortName: "Salpicaderas", category: "seguridad", widthCm: 20, depthCm: 30, minWidthCm: 15, maxWidthCm: 25, minDepthCm: 20, maxDepthCm: 40, color: "#6f6f6f", description: "Salpicadera reforzada sobre cada rueda." },
  { id: "luces-led", model: "cargo", name: "Luces de trabajo LED", shortName: "Luces LED", category: "estructura", widthCm: 15, depthCm: 15, minWidthCm: 10, maxWidthCm: 20, minDepthCm: 10, maxDepthCm: 20, color: "#d6a229", description: "Luz LED de trabajo orientable." },

  { id: "rampa-reforzada", model: "rzr", name: "Rampa reforzada", shortName: "Rampa", category: "acceso", widthCm: 180, depthCm: 50, minWidthCm: 150, maxWidthCm: 220, minDepthCm: 40, maxDepthCm: 70, color: "#c45d35", description: "Rampa reforzada para UTV, RZR o cuatrimoto." },
  { id: "anclajes", model: "rzr", name: "Anclajes regulables", shortName: "Anclajes", category: "seguridad", widthCm: 20, depthCm: 20, minWidthCm: 15, maxWidthCm: 30, minDepthCm: 15, maxDepthCm: 30, color: "#2f7f99", description: "Anclaje regulable para asegurar el vehículo." },
  { id: "malacate", model: "rzr", name: "Malacate eléctrico", shortName: "Malacate", category: "estructura", widthCm: 40, depthCm: 30, minWidthCm: 30, maxWidthCm: 50, minDepthCm: 20, maxDepthCm: 40, color: "#092f46", description: "Malacate eléctrico frontal para autocarga." },
  { id: "freno-inercia", model: "rzr", name: "Freno de inercia", shortName: "Freno", category: "seguridad", widthCm: 30, depthCm: 20, minWidthCm: 20, maxWidthCm: 40, minDepthCm: 15, maxDepthCm: 30, color: "#714d82", description: "Sistema de freno de inercia para remolque cargado." },
  { id: "riel-motos", model: "rzr", name: "Riel para motos", shortName: "Riel motos", category: "almacen", widthCm: 25, depthCm: 300, minWidthCm: 20, maxWidthCm: 35, minDepthCm: 150, maxDepthCm: 400, color: "#5f7481", description: "Riel con topes para asegurar motocicletas." },
  { id: "soporte-cuatri", model: "rzr", name: "Soporte cuatrimoto adicional", shortName: "Soporte", category: "almacen", widthCm: 60, depthCm: 90, minWidthCm: 50, maxWidthCm: 80, minDepthCm: 70, maxDepthCm: 120, color: "#3c8f84", description: "Soporte adicional para una segunda cuatrimoto." },
  { id: "cama-baja", model: "rzr", name: "Extensión de cama baja", shortName: "Cama baja", category: "estructura", widthCm: 194, depthCm: 60, minWidthCm: 150, maxWidthCm: 220, minDepthCm: 40, maxDepthCm: 90, color: "#8d3c31", description: "Extensión de cama baja para UTV de mayor longitud." },
  { id: "portallantas", model: "rzr", name: "Portallantas de refacción", shortName: "Portallantas", category: "seguridad", widthCm: 40, depthCm: 40, minWidthCm: 30, maxWidthCm: 50, minDepthCm: 30, maxDepthCm: 50, color: "#6f6f6f", description: "Soporte para llanta de refacción." },
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

export type CustomModelId = "food" | "cargo";
export type CustomPriceCoefficients = { priceBase: number; priceFloor: number; priceWall: number };

export const CUSTOM_WIDTH_OPTIONS_CM = [180, 200, 220] as const;
export const CUSTOM_LENGTH_MIN_CM = 200;
export const CUSTOM_LENGTH_MAX_CM = 900;
export const CUSTOM_STANDARD_LENGTH_STEP_CM = 50;
export const CUSTOM_LENGTH_EXTENSION_OPTIONS_CM = [20, 30, 40] as const;
export const CUSTOM_HEIGHT_MIN_CM = 210;
export const CUSTOM_HEIGHT_STEP_CM = 10;

// Widths of 180cm only fit the two shortest lengths; every longer trailer needs the wider axle track.
export function getAllowedWidths(lengthCm: number): number[] {
  return lengthCm <= 250 ? [...CUSTOM_WIDTH_OPTIONS_CM] : [200, 220];
}

export type QuickModel = {
  id: string;
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  idealFor: string[];
};

// Quick-start sizes for Paso 1 of the food truck configurator — just a shortcut into the same
// custom width/length/height/axles the manual sizer already uses, so the pricing formula never changes.
export const FOOD_QUICK_MODELS: QuickModel[] = [
  { id: "compact-250", name: "FG Compact 250", lengthCm: 250, widthCm: 180, heightCm: 210, idealFor: ["Café", "Bebidas", "Helados", "Postres", "Snacks"] },
  { id: "street-300", name: "FG Street 300", lengthCm: 300, widthCm: 200, heightCm: 210, idealFor: ["Hot Dogs", "Elotes y Snacks", "Crepas", "Tacos", "Lonches"] },
  { id: "cocina-400", name: "FG Cocina 400", lengthCm: 400, widthCm: 200, heightCm: 210, idealFor: ["Hamburguesas", "Tacos", "Alitas", "Antojitos", "Comida corrida"] },
  { id: "pro-450", name: "FG Full 450", lengthCm: 450, widthCm: 220, heightCm: 210, idealFor: ["Pizza", "Mariscos", "Pollo Frito o Asado", "Parrilla", "Cocina de alto volumen"] },
];

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
  for (let standard = CUSTOM_LENGTH_MIN_CM; standard <= CUSTOM_LENGTH_MAX_CM; standard += CUSTOM_STANDARD_LENGTH_STEP_CM) {
    values.push(standard);
    for (const extension of CUSTOM_LENGTH_EXTENSION_OPTIONS_CM) {
      if (standard + extension <= CUSTOM_LENGTH_MAX_CM) values.push(standard + extension);
    }
  }
  return values;
}

export function getLengthPricingRule(lengthCm: number) {
  if (lengthCm % CUSTOM_STANDARD_LENGTH_STEP_CM === 0) {
    return {
      standardLengthCm: lengthCm,
      lowerStandardLengthCm: lengthCm,
      upperStandardLengthCm: lengthCm,
      pricedAsLengthCm: lengthCm,
      additionalLengthCm: 0,
      surcharge: 0,
    };
  }
  const lowerStandardLengthCm = lengthCm - (lengthCm % CUSTOM_STANDARD_LENGTH_STEP_CM);
  const upperStandardLengthCm = lowerStandardLengthCm + CUSTOM_STANDARD_LENGTH_STEP_CM;
  const additionalLengthCm = lengthCm - lowerStandardLengthCm;
  if (!(CUSTOM_LENGTH_EXTENSION_OPTIONS_CM as readonly number[]).includes(additionalLengthCm)) return null;
  return {
    standardLengthCm: lowerStandardLengthCm,
    lowerStandardLengthCm,
    upperStandardLengthCm,
    pricedAsLengthCm: additionalLengthCm >= 40 ? upperStandardLengthCm : lowerStandardLengthCm,
    additionalLengthCm,
    surcharge: additionalLengthCm >= 40 ? 0 : ADDITIONAL_LENGTH_SURCHARGE,
  };
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

export function parseCustomPresetId(id: string): { model: CustomModelId; widthCm: number; lengthCm: number; heightCm: number; axles: number } | null {
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
  const lengthCm = pickNearestAllowed(lengthCmRaw, getCustomLengthOptions());
  const widthCm = pickNearestAllowed(widthCmRaw, getAllowedWidths(lengthCm));
  // Las restricciones técnicas siempre usan el largo real, no el largo empleado como referencia
  // comercial. Así 4.90 m conserva los 2 ejes obligatorios y 6.90 m conserva los 3 ejes.
  const heightCm = clampToStep(heightCmRaw, CUSTOM_HEIGHT_MIN_CM, getMaxHeightCm(lengthCm), CUSTOM_HEIGHT_STEP_CM);
  const axles = pickNearestAllowed(axlesRaw, getAllowedAxles(lengthCm)) as 1 | 2 | 3;
  return { widthCm, lengthCm, heightCm, axles };
}

// Estos coeficientes se conservan para peso/capacidad y para transformar la antigua fórmula de
// altura en un modificador único. El precio estándar de Cargo ya no se calcula con ellos.
export const CUSTOM_PRICE_COEFFICIENTS: Record<CustomModelId, { priceBase: number; priceFloor: number; priceWall: number; weightBase: number; weightFloor: number; weightWall: number; weightAxle: number }> = {
  food: { priceBase: 32000, priceFloor: 3600, priceWall: 900, weightBase: 545, weightFloor: 14.3, weightWall: 3.6, weightAxle: 150 },
  cargo: { priceBase: 16000, priceFloor: 5600, priceWall: 220, weightBase: 247, weightFloor: 26.8, weightWall: 1.1, weightAxle: 124 },
};

const CUSTOM_CAPACITY_FACTOR: Record<1 | 2 | 3, number> = { 1: 2.2, 2: 3.2, 3: 4.0 };

// Precios de un eje de Cargo congelados a partir de la fórmula anterior y redondeados a $500.
// A partir de esta versión son datos estándar, no resultados de una fórmula durante la cotización.
const CARGO_ONE_AXLE_STANDARD_PRICES: Record<number, Record<number, number>> = {
  180: { 200: 39500, 250: 45000 },
  200: { 200: 42000, 250: 48000, 300: 54000, 350: 60500, 400: 66500, 450: 72500, 500: 78500, 550: 84500, 600: 90500, 650: 96500, 700: 102500, 750: 109000, 800: 115000, 850: 121000, 900: 127000 },
  220: { 200: 44500, 250: 51000, 300: 58000, 350: 64500, 400: 71000, 450: 77500, 500: 84500, 550: 91000, 600: 97500, 650: 104000, 700: 110500, 750: 117500, 800: 124000, 850: 130500, 900: 137000 },
};

export type StandardTrailerPrice = {
  model: ModelId;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  axles: 1 | 2 | 3;
  standardPrice: number;
  includedEquipment: number;
  available: boolean;
  source: "pdf-suggested" | "derived-approved" | "cargo-frozen" | "fixed";
};

export function roundPrice(value: number) {
  return Math.round(value / PRICE_ROUNDING_STEP) * PRICE_ROUNDING_STEP;
}

export function getIncludedEquipmentCount(pricedAsLengthCm: number) {
  return pricedAsLengthCm < 300 ? 2 : 5;
}

function hasPdfSuggestedPrice(widthCm: number, lengthCm: number, axles: number) {
  const row = PDF_TRAILER_PRICE_REFERENCE.find((candidate) => candidate.widthCm === widthCm && candidate.lengthCm === lengthCm);
  return axles === 1 ? row?.oneAxleSuggestedPrice != null : axles === 2 ? row?.twoAxleSuggestedPriceInPdf != null : false;
}

function standardPriceFor(model: CustomModelId, widthCm: number, lengthCm: number, axles: 1 | 2 | 3) {
  const oneAxlePrice = (model === "food" ? FOOD_ONE_AXLE_STANDARD_PRICES : CARGO_ONE_AXLE_STANDARD_PRICES)[widthCm]?.[lengthCm];
  if (oneAxlePrice == null) return null;
  if (model === "food" && axles === 2) return getReferenceTwoAxlePrice(widthCm, lengthCm, "suggested") ?? oneAxlePrice + SECOND_AXLE_SURCHARGE;
  return oneAxlePrice + (axles - 1) * SECOND_AXLE_SURCHARGE;
}

function buildStandardTrailerPrices(): StandardTrailerPrice[] {
  const rows: StandardTrailerPrice[] = [];
  for (const model of ["food", "cargo"] as const) {
    const matrix = model === "food" ? FOOD_ONE_AXLE_STANDARD_PRICES : CARGO_ONE_AXLE_STANDARD_PRICES;
    for (const [widthKey, lengths] of Object.entries(matrix)) {
      const widthCm = Number(widthKey);
      for (const lengthKey of Object.keys(lengths)) {
        const lengthCm = Number(lengthKey);
        for (const axles of [1, 2, 3] as const) {
          const standardPrice = standardPriceFor(model, widthCm, lengthCm, axles);
          if (standardPrice == null) continue;
          rows.push({
            model,
            widthCm,
            lengthCm,
            heightCm: CUSTOM_HEIGHT_MIN_CM,
            axles,
            standardPrice,
            includedEquipment: getIncludedEquipmentCount(lengthCm),
            available: getAllowedWidths(lengthCm).includes(widthCm) && getAllowedAxles(lengthCm).includes(axles),
            source: model === "cargo" ? "cargo-frozen" : hasPdfSuggestedPrice(widthCm, lengthCm, axles) ? "pdf-suggested" : "derived-approved",
          });
        }
      }
    }
  }
  for (const preset of TRAILER_PRESETS) {
    rows.push({
      model: preset.model,
      widthCm: preset.widthCm,
      lengthCm: preset.lengthCm,
      heightCm: preset.heightCm,
      axles: preset.axles,
      standardPrice: preset.basePrice,
      includedEquipment: preset.includedEquipment,
      available: true,
      source: "fixed",
    });
  }
  return rows;
}

export const STANDARD_TRAILER_PRICES = buildStandardTrailerPrices();

export function getStandardTrailerPrice(model: ModelId, widthCm: number, lengthCm: number, axles: 1 | 2 | 3) {
  return STANDARD_TRAILER_PRICES.find((row) => row.model === model && row.widthCm === widthCm && row.lengthCm === lengthCm && row.axles === axles) ?? null;
}

function priceAtHeight(row: StandardTrailerPrice, heightCm: number) {
  if (row.model === "rzr" || heightCm <= row.heightCm) return row.standardPrice;
  const rate = CUSTOM_PRICE_COEFFICIENTS[row.model].priceWall;
  const extraHeightM = (heightCm - row.heightCm) / 100;
  const extraWallM2 = 2 * (row.widthCm / 100 + row.lengthCm / 100) * extraHeightM;
  return row.standardPrice + roundPrice(extraWallM2 * rate);
}

export function resolveCustomTrailerPrice(model: CustomModelId, widthCm: number, lengthCm: number, heightCm: number, axles: 1 | 2 | 3) {
  const rule = getLengthPricingRule(lengthCm);
  if (!rule) return null;
  const lower = getStandardTrailerPrice(model, widthCm, rule.lowerStandardLengthCm, axles);
  const upper = getStandardTrailerPrice(model, widthCm, rule.upperStandardLengthCm, axles);
  if (!lower || !upper) return null;
  const lowerPrice = priceAtHeight(lower, heightCm);
  const upperPrice = priceAtHeight(upper, heightCm);
  let price = lowerPrice;
  if (rule.additionalLengthCm >= 40) {
    price = upperPrice;
  } else if (rule.additionalLengthCm > 0) {
    price = Math.max(lowerPrice, Math.min(lowerPrice + ADDITIONAL_LENGTH_SURCHARGE, upperPrice - CUSTOM_NEXT_STANDARD_GAP));
  }
  return {
    price: roundPrice(price),
    lowerPrice,
    upperPrice,
    pricedAsLengthCm: rule.pricedAsLengthCm,
    includedEquipment: getIncludedEquipmentCount(rule.pricedAsLengthCm),
    rule,
  };
}

export function validateStandardTrailerPrices() {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const row of STANDARD_TRAILER_PRICES) {
    const key = `${row.model}-${row.widthCm}-${row.lengthCm}-${row.heightCm}-${row.axles}`;
    if (keys.has(key)) errors.push(`Precio estándar duplicado: ${key}.`);
    keys.add(key);
    if (row.standardPrice % PRICE_ROUNDING_STEP !== 0) errors.push(`${key} no está redondeado a $${PRICE_ROUNDING_STEP}.`);
    if (row.includedEquipment !== getIncludedEquipmentCount(row.lengthCm)) errors.push(`${key} tiene una cantidad incorrecta de aditamentos incluidos.`);
    const oneAxle = getStandardTrailerPrice(row.model, row.widthCm, row.lengthCm, 1);
    if (row.axles === 2 && oneAxle && row.standardPrice < oneAxle.standardPrice) errors.push(`${key} cuesta menos que un eje.`);
  }
  for (const model of ["food", "cargo"] as const) {
    for (const widthCm of CUSTOM_WIDTH_OPTIONS_CM) {
      for (const axles of [1, 2, 3] as const) {
        const rows = STANDARD_TRAILER_PRICES.filter((row) => row.model === model && row.widthCm === widthCm && row.axles === axles).sort((a, b) => a.lengthCm - b.lengthCm);
        for (let index = 1; index < rows.length; index += 1) {
          if (rows[index].standardPrice < rows[index - 1].standardPrice) errors.push(`${model} ${widthCm} cm y ${axles} ejes baja de precio al aumentar el largo.`);
        }
      }
    }
    for (let lengthCm = CUSTOM_LENGTH_MIN_CM; lengthCm <= CUSTOM_LENGTH_MAX_CM; lengthCm += CUSTOM_STANDARD_LENGTH_STEP_CM) {
      for (const axles of [1, 2, 3] as const) {
        const rows = STANDARD_TRAILER_PRICES.filter((row) => row.model === model && row.lengthCm === lengthCm && row.axles === axles).sort((a, b) => a.widthCm - b.widthCm);
        for (let index = 1; index < rows.length; index += 1) {
          if (rows[index].standardPrice < rows[index - 1].standardPrice) errors.push(`${model} ${lengthCm} cm y ${axles} ejes baja de precio al aumentar el ancho.`);
        }
      }
    }
  }
  for (const model of ["food", "cargo"] as const) {
    const widths = [...new Set(STANDARD_TRAILER_PRICES.filter((row) => row.model === model).map((row) => row.widthCm))];
    for (const widthCm of widths) {
      const lengths = [...new Set(STANDARD_TRAILER_PRICES.filter((row) => row.model === model && row.widthCm === widthCm).map((row) => row.lengthCm))].sort((a, b) => a - b);
      for (let index = 0; index < lengths.length - 1; index += 1) {
        const lowerLengthCm = lengths[index];
        const upperLengthCm = lengths[index + 1];
        if (upperLengthCm - lowerLengthCm !== CUSTOM_STANDARD_LENGTH_STEP_CM) continue;
        for (const axles of [1, 2, 3] as const) {
          for (const extension of CUSTOM_LENGTH_EXTENSION_OPTIONS_CM) {
            const result = resolveCustomTrailerPrice(model, widthCm, lowerLengthCm + extension, CUSTOM_HEIGHT_MIN_CM, axles);
            const key = `${model}-${widthCm}-${lowerLengthCm}+${extension}-${axles}`;
            if (!result) {
              errors.push(`No se pudo resolver el precio personalizado ${key}.`);
              continue;
            }
            if (result.price < result.lowerPrice) errors.push(`${key} quedó por debajo del estándar inferior.`);
            if (result.price > result.upperPrice) errors.push(`${key} superó el estándar superior.`);
            if (extension < 40 && result.price > result.upperPrice - CUSTOM_NEXT_STANDARD_GAP) errors.push(`${key} no conserva $${CUSTOM_NEXT_STANDARD_GAP} antes del siguiente estándar.`);
            if (extension >= 40 && result.price !== result.upperPrice) errors.push(`${key} no usa el siguiente estándar.`);
            if (result.price % PRICE_ROUNDING_STEP !== 0) errors.push(`${key} no está redondeado a $${PRICE_ROUNDING_STEP}.`);
          }
        }
      }
    }
  }
  return [...new Set(errors)];
}

const STANDARD_PRICE_ERRORS = validateStandardTrailerPrices();
if (STANDARD_PRICE_ERRORS.length) throw new Error(`Matriz de precios inválida: ${STANDARD_PRICE_ERRORS.join(" ")}`);

export function buildCustomPreset(model: CustomModelId, widthCmRaw: number, lengthCmRaw: number, heightCmRaw: number, axlesRaw: number, coeffOverride?: Partial<CustomPriceCoefficients>): TrailerPreset {
  void coeffOverride;
  const { widthCm, lengthCm, heightCm, axles } = sanitizeCustomDims(lengthCmRaw, widthCmRaw, heightCmRaw, axlesRaw);
  const pricing = resolveCustomTrailerPrice(model, widthCm, lengthCm, heightCm, axles);
  if (!pricing) throw new Error(`No existe una referencia estándar para ${model} ${widthCm} × ${lengthCm} cm con ${axles} ejes.`);
  const actualFloorAreaM2 = (widthCm / 100) * (lengthCm / 100);
  const actualWallAreaM2 = 2 * (widthCm / 100 + lengthCm / 100) * (heightCm / 100);
  const extraAxles = axles - 1;
  const coeff = CUSTOM_PRICE_COEFFICIENTS[model];
  const estimatedWeightKg = Math.round(coeff.weightBase + coeff.weightFloor * actualFloorAreaM2 + coeff.weightWall * actualWallAreaM2 + coeff.weightAxle * extraAxles);
  const estimatedCapacityKg = Math.round(estimatedWeightKg * CUSTOM_CAPACITY_FACTOR[axles]);
  return {
    id: buildCustomPresetId(model, widthCm, lengthCm, heightCm, axles),
    model,
    label: `${(widthCm / 100).toFixed(2)} × ${(lengthCm / 100).toFixed(2)} m · ${axleLabel(axles)}`,
    widthCm,
    lengthCm,
    heightCm,
    axles,
    basePrice: pricing.price,
    includedEquipment: pricing.includedEquipment,
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
  const exactCombination = sane.widthCm === parsed.widthCm && sane.lengthCm === parsed.lengthCm && sane.heightCm === parsed.heightCm && sane.axles === parsed.axles;
  if (!exactCombination) return false;
  return resolveCustomTrailerPrice(parsed.model, parsed.widthCm, parsed.lengthCm, parsed.heightCm, parsed.axles as 1 | 2 | 3) != null;
}

// Los primeros preset.includedEquipment aditamentos van sin costo y el resto cuesta el flat
// EXTRA_EQUIPMENT_PRICE. Los aditamentos especiales entran en el
// mismo conteo y en la misma tarifa plana, en el orden en que se agregaron: primero los del plano
// (items) y luego los especiales (specialItems).
export function calculateQuote<T extends { name: string; widthCm: number; depthCm: number }>(presetId: string, items: PlacedEquipment[], specialItems: T[], includeIva: boolean) {
  const preset = getPreset(presetId);
  let includedUsed = 0;
  let extras = 0;
  const lines = items.flatMap((item) => {
    const definition = getEquipment(item.typeId);
    if (!definition) return [];
    const included = includedUsed < preset.includedEquipment;
    if (included) includedUsed += 1;
    const linePrice = included ? 0 : EXTRA_EQUIPMENT_PRICE;
    extras += linePrice;
    return [{ item, definition, linePrice, included }];
  });
  const specialLines = specialItems.map((entry) => {
    const included = includedUsed < preset.includedEquipment;
    if (included) includedUsed += 1;
    const linePrice = included ? 0 : EXTRA_EQUIPMENT_PRICE;
    extras += linePrice;
    return { ...entry, linePrice, included };
  });
  const subtotal = preset.basePrice + extras;
  const iva = includeIva ? Math.round(subtotal * 0.16) : 0;
  return { preset, lines, specialLines, includedUsed, extras, subtotal, iva, total: subtotal + iva };
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
      const defA = getEquipment(a.typeId);
      const defB = getEquipment(b.typeId);
      if (defA?.overlapExempt || defB?.overlapExempt) continue;
      if (rectsOverlap(a, b)) errors.push(`${defA?.name ?? "Equipo"} se cruza con ${defB?.name ?? "otro equipo"}.`);
    }
  }
  return [...new Set(errors)];
}
