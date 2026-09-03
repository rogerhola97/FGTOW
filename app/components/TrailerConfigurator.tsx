"use client";

import Image from "next/image";
import { FormEvent, PointerEvent, UIEvent, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STATE, MEXICAN_STATES } from "../lib/mexicanStates";
import { FABRICATION_ADDRESS, FABRICATION_MAPS_URL } from "../lib/company";
import {
  CUSTOM_WIDTH_OPTIONS_CM,
  DOOR_CLEARANCE_CM,
  DOOR_MAX_WIDTH_CM,
  DOOR_MIN_WIDTH_CM,
  DoorConfig,
  MODEL_META,
  ModelId,
  PERIMETER_TABLE_DEPTH_CM,
  PlacedEquipment,
  TrailerPreset,
  WALL_LABEL,
  Wall,
  WindowConfig,
  axleBandCm,
  axleLabel,
  buildCustomPresetId,
  calculateQuote,
  defaultDoor,
  defaultWindows,
  doorClearanceRect,
  getAllowedAxles,
  getAllowedWidths,
  getCustomHeightOptions,
  getCustomLengthOptions,
  getEquipment,
  getEquipmentForModel,
  getPreset,
  getPresetsForModel,
  getSizingMode,
  money,
  placeOnWall,
  rectsOverlap,
  validateLayout,
  wallForPoint,
  wallLengthCm,
  windowHeightCm,
  windowWidthCm,
} from "../lib/quoteCatalog";

type PlacedItem = PlacedEquipment & { wall: Wall };
type SendState = "idle" | "sending" | "sent" | "error";
type DragState = { kind: "item"; instanceId: string; pointerId: number; originWall: Wall; originOffsetCm: number } | { kind: "door"; pointerId: number } | { kind: "window"; id: string; pointerId: number; originWall: Wall; originOffsetCm: number } | null;

const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function ticksFor(maxCm: number, step: number) {
  const values: number[] = [];
  for (let v = 0; v <= maxCm; v += step) values.push(v);
  if (values[values.length - 1] !== maxCm) values.push(maxCm);
  return values;
}

function rulerLabels(maxCm: number, step: number, minGap: number) {
  const values: number[] = [];
  for (let v = 0; v <= maxCm; v += step) values.push(v);
  const last = values[values.length - 1];
  if (last !== maxCm) {
    if (maxCm - last < minGap) values[values.length - 1] = maxCm;
    else values.push(maxCm);
  }
  return values;
}

const SNAP_DISTANCE_CM = 8;

function snapAlongWall(offset: number, alongCm: number, neighbors: { start: number; end: number }[]) {
  let best = offset;
  let bestGap = SNAP_DISTANCE_CM;
  const end = offset + alongCm;
  for (const neighbor of neighbors) {
    const gapBefore = neighbor.start - end;
    if (gapBefore > 0 && gapBefore < bestGap) { bestGap = gapBefore; best = neighbor.start - alongCm; }
    const gapAfter = offset - neighbor.end;
    if (gapAfter > 0 && gapAfter < bestGap) { bestGap = gapAfter; best = neighbor.end; }
  }
  return best;
}

function doorGeometry(door: DoorConfig, preset: TrailerPreset) {
  const { wall, offsetCm, widthCm } = door;
  if (wall === "front") return { x1: offsetCm, y1: 0, x2: offsetCm + widthCm, y2: 0, labelX: offsetCm + widthCm / 2, labelY: 18, rotate: 0 };
  if (wall === "back") return { x1: offsetCm, y1: preset.lengthCm, x2: offsetCm + widthCm, y2: preset.lengthCm, labelX: offsetCm + widthCm / 2, labelY: preset.lengthCm - 12, rotate: 0 };
  if (wall === "left") return { x1: 0, y1: offsetCm, x2: 0, y2: offsetCm + widthCm, labelX: 18, labelY: offsetCm + widthCm / 2, rotate: -90 };
  return { x1: preset.widthCm, y1: offsetCm, x2: preset.widthCm, y2: offsetCm + widthCm, labelX: preset.widthCm - 18, labelY: offsetCm + widthCm / 2, rotate: 90 };
}

function makeItem(typeId: string, wall: Wall, offsetCm: number, alongCm: number, depthCm: number, trailerWidthCm: number, trailerLengthCm: number, mount: "inside" | "outside"): PlacedItem {
  const rect = placeOnWall(wall, offsetCm, alongCm, depthCm, trailerWidthCm, trailerLengthCm, mount);
  return { instanceId: uid(), typeId, wall, xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm, rotation: rect.rotation };
}

function offsetOfItem(item: PlacedItem) {
  return item.wall === "front" || item.wall === "back" ? item.xCm : item.yCm;
}

function avoidDoor(wall: Wall, offset: number, alongCm: number, mount: "inside" | "outside", door: DoorConfig, span: number) {
  if (mount !== "inside" || wall !== door.wall) return offset;
  const forbiddenStart = door.offsetCm - alongCm;
  const forbiddenEnd = door.offsetCm + door.widthCm;
  if (offset <= forbiddenStart || offset >= forbiddenEnd) return offset;
  const distToStart = Math.abs(offset - forbiddenStart);
  const distToEnd = Math.abs(offset - forbiddenEnd);
  const candidate = distToStart < distToEnd ? forbiddenStart : forbiddenEnd;
  return clamp(candidate, 0, Math.max(0, span - alongCm));
}

function segmentsOverlap(aOffset: number, aWidth: number, bOffset: number, bWidth: number) {
  return aOffset < bOffset + bWidth && aOffset + aWidth > bOffset;
}

// Windows and the door only need to avoid each other along their own wall (they don't block floor
// equipment), so this is a simpler 1D version of the item collision resolver above.
function findFreeOffsetOnWall(desiredOffset: number, widthCm: number, span: number, blockers: { offsetCm: number; widthCm: number }[]) {
  const maxOffset = Math.max(0, span - widthCm);
  const desired = clamp(desiredOffset, 0, maxOffset);
  const isFree = (offset: number) => !blockers.some((b) => segmentsOverlap(offset, widthCm, b.offsetCm, b.widthCm));
  if (isFree(desired)) return desired;
  const step = 2;
  const range = Math.max(desired, maxOffset - desired);
  for (let d = step; d <= range + step; d += step) {
    const left = desired - d;
    const right = desired + d;
    if (left >= 0 && isFree(left)) return left;
    if (right <= maxOffset && isFree(right)) return right;
  }
  return desired;
}

// The axle band only exists along the left/right walls (that's where the wheels are drawn),
// so the door can't be dropped, cycled onto, or widened into that band on those walls.
function avoidAxleBand(wall: Wall, offset: number, widthCm: number, preset: TrailerPreset) {
  if (wall !== "left" && wall !== "right") return offset;
  const band = axleBandCm(preset);
  const forbiddenStart = band.start - widthCm;
  const forbiddenEnd = band.end;
  if (offset <= forbiddenStart || offset >= forbiddenEnd) return offset;
  const distToStart = Math.abs(offset - forbiddenStart);
  const distToEnd = Math.abs(offset - forbiddenEnd);
  const candidate = distToStart < distToEnd ? forbiddenStart : forbiddenEnd;
  return clamp(candidate, 0, Math.max(0, preset.lengthCm - widthCm));
}

type SwapTarget = { instanceId: string; wall: Wall; offsetCm: number };
type CollisionParams = {
  instanceId: string;
  wall: Wall;
  offsetCm: number;
  alongCm: number;
  depthCm: number;
  mount: "inside" | "outside";
  trailerWidthCm: number;
  trailerLengthCm: number;
  others: PlacedItem[];
  door: DoorConfig;
  originWall: Wall;
  originOffsetCm: number;
  overlapExempt?: boolean;
};

const OVERLAP_SWAP_RATIO = 0.6;

// When a dragged item would overlap another, push it to the nearest free spot along
// the same wall, then other walls, and only swap places with the blocking item as a last resort.
function resolveCollision(params: CollisionParams): { wall: Wall; offsetCm: number; swapWith?: SwapTarget } {
  const { wall, alongCm, depthCm, mount, trailerWidthCm, trailerLengthCm, door, originWall, originOffsetCm } = params;
  const others = params.others.filter((o) => !getEquipment(o.typeId)?.overlapExempt);

  const span = wallLengthCm(wall, trailerWidthCm, trailerLengthCm);
  const maxOffset = Math.max(0, span - alongCm);
  const desired = clamp(params.offsetCm, 0, maxOffset);

  // Items mounted above/below the counter (hood, low shelf) can sit anywhere without avoiding others.
  if (params.overlapExempt) return { wall, offsetCm: desired };

  function rectFor(w: Wall, offset: number, a: number, d: number, m: "inside" | "outside") {
    const rect = placeOnWall(w, offset, a, d, trailerWidthCm, trailerLengthCm, m);
    return { xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm };
  }

  function isFree(w: Wall, offset: number, exclude: string[] = []) {
    const candidate = rectFor(w, offset, alongCm, depthCm, mount);
    const clearance = mount === "inside" ? doorClearanceRect(door, trailerWidthCm, trailerLengthCm) : null;
    if (clearance && rectsOverlap(candidate, clearance)) return false;
    return !others.some((o) => !exclude.includes(o.instanceId) && rectsOverlap(candidate, o));
  }

  if (isFree(wall, desired)) return { wall, offsetCm: desired };

  const desiredRect = rectFor(wall, desired, alongCm, depthCm, mount);
  const desiredArea = alongCm * depthCm;
  const overlapping = others
    .map((other) => {
      if (!rectsOverlap(desiredRect, other)) return null;
      const overlapWidth = Math.min(desiredRect.xCm + desiredRect.widthCm, other.xCm + other.widthCm) - Math.max(desiredRect.xCm, other.xCm);
      const overlapDepth = Math.min(desiredRect.yCm + desiredRect.depthCm, other.yCm + other.depthCm) - Math.max(desiredRect.yCm, other.yCm);
      const overlapArea = Math.max(0, overlapWidth) * Math.max(0, overlapDepth);
      const otherArea = Math.max(1, other.widthCm * other.depthCm);
      return { other, ratio: overlapArea / Math.min(desiredArea, otherArea) };
    })
    .filter((entry): entry is { other: PlacedItem; ratio: number } => entry !== null)
    .sort((a, b) => b.ratio - a.ratio);

  // A swap sends the target to the DRAGGED item's original spot (not the drop point) so the two
  // truly trade places instead of both landing on the same offset when dropped right on top of it.
  function attemptSwap(target: PlacedItem): SwapTarget | null {
    const targetDef = getEquipment(target.typeId);
    const targetMount = targetDef?.mount ?? "inside";
    if (targetMount !== mount) return null;
    const targetAlong = target.rotation === 0 ? target.widthCm : target.depthCm;
    const targetDepth = target.rotation === 0 ? target.depthCm : target.widthCm;
    const targetWallSpan = wallLengthCm(target.wall, trailerWidthCm, trailerLengthCm);
    const originSpan = wallLengthCm(originWall, trailerWidthCm, trailerLengthCm);
    if (alongCm > targetWallSpan || targetAlong > originSpan) return null;
    const draggedNewOffset = clamp(offsetOfItem(target), 0, Math.max(0, targetWallSpan - alongCm));
    if (!isFree(target.wall, draggedNewOffset, [target.instanceId])) return null;
    const targetNewOffset = clamp(originOffsetCm, 0, Math.max(0, originSpan - targetAlong));
    const targetCandidate = rectFor(originWall, targetNewOffset, targetAlong, targetDepth, targetMount);
    const targetClearance = targetMount === "inside" ? doorClearanceRect(door, trailerWidthCm, trailerLengthCm) : null;
    if (targetClearance && rectsOverlap(targetCandidate, targetClearance)) return null;
    if (others.some((o) => o.instanceId !== target.instanceId && rectsOverlap(targetCandidate, o))) return null;
    return { instanceId: target.instanceId, wall: originWall, offsetCm: targetNewOffset };
  }

  for (const entry of overlapping) {
    if (entry.ratio < OVERLAP_SWAP_RATIO) break;
    const swap = attemptSwap(entry.other);
    if (swap) {
      const targetWallSpan = wallLengthCm(entry.other.wall, trailerWidthCm, trailerLengthCm);
      const draggedNewOffset = clamp(offsetOfItem(entry.other), 0, Math.max(0, targetWallSpan - alongCm));
      return { wall: entry.other.wall, offsetCm: draggedNewOffset, swapWith: swap };
    }
  }

  const step = 2;
  const range = Math.max(desired, maxOffset - desired);
  for (let d = step; d <= range + step; d += step) {
    const left = desired - d;
    const right = desired + d;
    if (left >= 0 && isFree(wall, left)) return { wall, offsetCm: left };
    if (right <= maxOffset && isFree(wall, right)) return { wall, offsetCm: right };
  }

  const fallbackWalls = (mount === "outside" ? (["back", "front", "left", "right"] as Wall[]) : WALL_ORDER).filter((w) => w !== wall);
  for (const candidateWall of fallbackWalls) {
    const candidateSpan = wallLengthCm(candidateWall, trailerWidthCm, trailerLengthCm);
    if (alongCm > candidateSpan) continue;
    for (let offset = 0; offset <= candidateSpan - alongCm + 0.01; offset += 5) {
      if (isFree(candidateWall, offset)) return { wall: candidateWall, offsetCm: offset };
    }
  }

  for (const entry of overlapping) {
    const swap = attemptSwap(entry.other);
    if (swap) {
      const targetWallSpan = wallLengthCm(entry.other.wall, trailerWidthCm, trailerLengthCm);
      const draggedNewOffset = clamp(offsetOfItem(entry.other), 0, Math.max(0, targetWallSpan - alongCm));
      return { wall: entry.other.wall, offsetCm: draggedNewOffset, swapWith: swap };
    }
  }

  return { wall, offsetCm: desired };
}

function applyPlacementResult(
  current: PlacedItem[],
  instanceId: string,
  alongCm: number,
  depthCm: number,
  mount: "inside" | "outside",
  placement: { wall: Wall; offsetCm: number; swapWith?: SwapTarget },
  trailerWidthCm: number,
  trailerLengthCm: number,
): PlacedItem[] {
  return current.map((entry) => {
    if (entry.instanceId === instanceId) {
      const rect = placeOnWall(placement.wall, placement.offsetCm, alongCm, depthCm, trailerWidthCm, trailerLengthCm, mount);
      return { ...entry, wall: placement.wall, xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm, rotation: rect.rotation };
    }
    if (placement.swapWith && entry.instanceId === placement.swapWith.instanceId) {
      const swapDef = getEquipment(entry.typeId);
      const swapMount = swapDef?.mount ?? "inside";
      const swapAlong = entry.rotation === 0 ? entry.widthCm : entry.depthCm;
      const swapDepth = entry.rotation === 0 ? entry.depthCm : entry.widthCm;
      const rect = placeOnWall(placement.swapWith.wall, placement.swapWith.offsetCm, swapAlong, swapDepth, trailerWidthCm, trailerLengthCm, swapMount);
      return { ...entry, wall: placement.swapWith.wall, xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm, rotation: rect.rotation };
    }
    return entry;
  });
}

function buildStarterLayout(typeIds: string[], trailerWidthCm: number, trailerLengthCm: number, door: DoorConfig): PlacedItem[] {
  let working: PlacedItem[] = [];
  for (const typeId of typeIds) {
    const definition = getEquipment(typeId);
    if (!definition) continue;
    const placement = findOpenPlacement(definition, trailerWidthCm, trailerLengthCm, working, door);
    const next = makeItem(typeId, placement.wall, placement.offsetCm, placement.alongCm, placement.depthCm, trailerWidthCm, trailerLengthCm, definition.mount ?? "inside");
    working = [...working, next];
  }
  return working;
}

function starterLayout(modelId: ModelId, trailerWidthCm: number, trailerLengthCm: number, door: DoorConfig): PlacedItem[] {
  if (modelId === "cargo" || modelId === "rzr") return [];
  return buildStarterLayout(["plancha", "bano-maria", "freidora", "parrilla", "tarja"], trailerWidthCm, trailerLengthCm, door);
}

function findOpenPlacement(definition: ReturnType<typeof getEquipment>, trailerWidthCm: number, trailerLengthCm: number, existing: PlacedItem[], door: DoorConfig) {
  const mount = definition!.mount ?? "inside";
  const walls: Wall[] = mount === "outside" ? ["back", "front", "left", "right"] : ["back", "left", "right", "front"];
  const clearance = mount === "inside" ? doorClearanceRect(door, trailerWidthCm, trailerLengthCm) : null;
  for (const wall of walls) {
    const span = wallLengthCm(wall, trailerWidthCm, trailerLengthCm);
    const alongCm = Math.max(definition!.minWidthCm, Math.min(definition!.maxWidthCm, Math.min(definition!.widthCm, span)));
    if (alongCm > span) continue;
    const depthCm = definition!.depthCm;
    for (let offset = 0; offset <= span - alongCm + 0.01; offset += 5) {
      const rect = placeOnWall(wall, offset, alongCm, depthCm, trailerWidthCm, trailerLengthCm, mount);
      const candidate = { xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm };
      const blockedByDoor = clearance ? rectsOverlap(candidate, clearance) : false;
      const blockedByItem = definition!.overlapExempt ? false : existing.some((item) => !getEquipment(item.typeId)?.overlapExempt && rectsOverlap(candidate, item));
      if (!blockedByDoor && !blockedByItem) return { wall, offsetCm: rect.offset, alongCm, depthCm };
    }
  }
  const fallbackWall = walls[0];
  const fallbackSpan = wallLengthCm(fallbackWall, trailerWidthCm, trailerLengthCm);
  return { wall: fallbackWall, offsetCm: 0, alongCm: Math.min(definition!.widthCm, fallbackSpan), depthCm: definition!.depthCm };
}

const WALL_ORDER: Wall[] = ["front", "right", "back", "left"];

export function TrailerConfigurator({ modelId, plano = true }: { modelId: ModelId; plano?: boolean }) {
  const meta = MODEL_META[modelId];
  const sizingMode = getSizingMode(modelId);
  const presets = useMemo(() => getPresetsForModel(modelId), [modelId]);
  const equipmentList = useMemo(() => getEquipmentForModel(modelId), [modelId]);
  const [presetId, setPresetId] = useState(meta.defaultPresetId);
  const preset = getPreset(presetId);
  const lengthOptions = useMemo(() => getCustomLengthOptions(), []);
  const heightOptions = useMemo(() => getCustomHeightOptions(preset.lengthCm), [preset.lengthCm]);
  const allowedAxles = useMemo(() => getAllowedAxles(preset.lengthCm), [preset.lengthCm]);
  const [door, setDoor] = useState<DoorConfig>(() => defaultDoor(preset.widthCm));
  const [windows, setWindows] = useState<WindowConfig[]>(() => (modelId === "food" ? defaultWindows(door.wall, preset.widthCm, preset.lengthCm) : []));
  const [windowSelectedId, setWindowSelectedId] = useState<string | null>(null);
  const [specialItems, setSpecialItems] = useState<{ id: string; name: string; widthCm: number; depthCm: number; price: number }[]>([]);
  const [specialForm, setSpecialForm] = useState({ name: "", widthCm: "", depthCm: "", price: "" });
  const [items, setItems] = useState<PlacedItem[]>(() => starterLayout(modelId, preset.widthCm, preset.lengthCm, door));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doorSelected, setDoorSelected] = useState(false);
  const [drag, setDrag] = useState<DragState>(null);
  const dragRef = useRef<DragState>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [equipmentAtEnd, setEquipmentAtEnd] = useState(false);
  const equipmentLibraryRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);
  const toggleStep = (step: 1 | 2 | 3) => setActiveStep((current) => (current === step ? 0 : step));
  const [includeIva, setIncludeIva] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendMessage, setSendMessage] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("BORRADOR");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", city: "Monterrey, N.L.", state: DEFAULT_STATE, notes: "" });
  const svgRef = useRef<SVGSVGElement>(null);
  const sentBannerRef = useRef<HTMLDivElement>(null);
  const [rulerHeightPx, setRulerHeightPx] = useState<number | null>(null);

  useEffect(() => {
    const node = svgRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setRulerHeightPx(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (sendState === "sent") sentBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sendState]);

  const quote = useMemo(() => calculateQuote(presetId, items, includeIva), [presetId, items, includeIva]);
  const specialItemsTotal = useMemo(() => specialItems.reduce((sum, entry) => sum + entry.price, 0), [specialItems]);
  const combinedSubtotal = quote.subtotal + specialItemsTotal;
  const combinedIva = includeIva ? Math.round(combinedSubtotal * 0.16) : 0;
  const combinedTotal = combinedSubtotal + combinedIva;
  const layoutErrors = useMemo(() => validateLayout(preset, items, door), [preset, items, door]);
  const selected = items.find((item) => item.instanceId === selectedId) ?? null;
  const selectedDefinition = selected ? getEquipment(selected.typeId) : null;
  const selectedAlongLimits = selectedDefinition ? { min: selectedDefinition.minWidthCm, max: selectedDefinition.maxWidthCm } : null;
  const selectedDepthLimits = selectedDefinition ? { min: selectedDefinition.minDepthCm, max: selectedDefinition.maxDepthCm } : null;
  const collisionIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
      if (getEquipment(items[i].typeId)?.overlapExempt || getEquipment(items[j].typeId)?.overlapExempt) continue;
      if (rectsOverlap(items[i], items[j])) { ids.add(items[i].instanceId); ids.add(items[j].instanceId); }
    }
    const clearance = doorClearanceRect(door, preset.widthCm, preset.lengthCm);
    for (const item of items) {
      const definition = getEquipment(item.typeId);
      if ((definition?.mount ?? "inside") === "inside" && rectsOverlap(item, clearance)) ids.add(item.instanceId);
    }
    return ids;
  }, [items, door, preset]);

  function updatePreset(nextId: string) {
    const next = getPreset(nextId);
    setPresetId(nextId);
    setItems((current) => current.map((item) => {
      const definition = getEquipment(item.typeId);
      const mount = definition?.mount ?? "inside";
      const alongCm = item.rotation === 0 ? item.widthCm : item.depthCm;
      const depthCm = item.rotation === 0 ? item.depthCm : item.widthCm;
      const rect = placeOnWall(item.wall, offsetOfItem(item), alongCm, depthCm, next.widthCm, next.lengthCm, mount);
      return { ...item, xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm, rotation: rect.rotation };
    }));
    setDoor((current) => {
      const rect = placeOnWall(current.wall, current.offsetCm, current.widthCm, 1, next.widthCm, next.lengthCm);
      return { wall: current.wall, offsetCm: rect.offset, widthCm: current.widthCm };
    });
    setWindows((current) => current.map((w) => {
      const widthCm = windowWidthCm(w.wall);
      const span = wallLengthCm(w.wall, next.widthCm, next.lengthCm);
      const clamped = clamp(w.offsetCm, 0, Math.max(0, span - widthCm));
      const blockers = door.wall === w.wall ? [{ offsetCm: door.offsetCm, widthCm: door.widthCm }] : [];
      return { ...w, offsetCm: findFreeOffsetOnWall(clamped, widthCm, span, blockers) };
    }));
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  // Builds the next custom-size id by changing just one dimension; getPreset()/buildCustomPreset()
  // sanitizes the full combination (width/height/axles snap to whatever the new value allows).
  // Width is never blocked: picking a width that doesn't fit the current length instead pulls the
  // length down to the shortest option that does fit it (e.g. 1.80 m forces the length to 2.00 m).
  function updateCustomDim(part: "width" | "length" | "height" | "axles", value: number) {
    const nextWidth = part === "width" ? value : preset.widthCm;
    let nextLength = part === "length" ? value : preset.lengthCm;
    if (part === "width" && !getAllowedWidths(nextLength).includes(nextWidth)) {
      nextLength = lengthOptions.find((l) => getAllowedWidths(l).includes(nextWidth)) ?? nextLength;
    }
    const nextHeight = part === "height" ? value : preset.heightCm;
    const nextAxles = part === "axles" ? value : preset.axles;
    updatePreset(buildCustomPresetId(modelId as "food" | "cargo", nextWidth, nextLength, nextHeight, nextAxles as 1 | 2 | 3));
  }

  function addEquipment(typeId: string, quantity: number) {
    const definition = getEquipment(typeId);
    if (!definition || quantity < 1) return;
    let working = items;
    let lastId: string | null = null;
    for (let i = 0; i < quantity; i += 1) {
      const placement = findOpenPlacement(definition, preset.widthCm, preset.lengthCm, working, door);
      const next = makeItem(typeId, placement.wall, placement.offsetCm, placement.alongCm, placement.depthCm, preset.widthCm, preset.lengthCm, definition.mount ?? "inside");
      working = [...working, next];
      lastId = next.instanceId;
    }
    setItems(working);
    if (lastId) { setSelectedId(lastId); setDoorSelected(false); }
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  // Vendor-only: a one-off accessory the client asked for that isn't in the standard catalog.
  // It's priced and listed on the quote, but isn't placed on the 2D plan.
  function addSpecialItem() {
    const name = specialForm.name.trim();
    const widthCm = Number(specialForm.widthCm);
    const depthCm = Number(specialForm.depthCm);
    const price = Number(specialForm.price);
    if (!name || !Number.isFinite(widthCm) || widthCm <= 0 || !Number.isFinite(depthCm) || depthCm <= 0 || !Number.isFinite(price) || price < 0) return;
    setSpecialItems((current) => [...current, { id: uid(), name, widthCm, depthCm, price }]);
    setSpecialForm({ name: "", widthCm: "", depthCm: "", price: "" });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function removeSpecialItem(id: string) {
    setSpecialItems((current) => current.filter((entry) => entry.id !== id));
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function updateItemSize(instanceId: string, part: "along" | "depth", value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setItems((current) => {
      const item = current.find((entry) => entry.instanceId === instanceId);
      if (!item) return current;
      const definition = getEquipment(item.typeId);
      const mount = definition?.mount ?? "inside";
      const currentAlong = item.rotation === 0 ? item.widthCm : item.depthCm;
      const currentDepth = item.rotation === 0 ? item.depthCm : item.widthCm;
      const alongCm = part === "along" ? value : currentAlong;
      const depthCm = part === "depth" ? value : currentDepth;
      const originOffsetCm = offsetOfItem(item);
      const others = current.filter((entry) => entry.instanceId !== instanceId);
      const placement = resolveCollision({
        instanceId,
        wall: item.wall,
        offsetCm: originOffsetCm,
        alongCm,
        depthCm,
        mount,
        trailerWidthCm: preset.widthCm,
        trailerLengthCm: preset.lengthCm,
        others,
        door,
        originWall: item.wall,
        originOffsetCm,
        overlapExempt: definition?.overlapExempt,
      });
      return applyPlacementResult(current, instanceId, alongCm, depthCm, mount, placement, preset.widthCm, preset.lengthCm);
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function cycleWall(instanceId: string) {
    setItems((current) => {
      const item = current.find((entry) => entry.instanceId === instanceId);
      if (!item) return current;
      const definition = getEquipment(item.typeId);
      const mount = definition?.mount ?? "inside";
      const alongCm = item.rotation === 0 ? item.widthCm : item.depthCm;
      const depthCm = item.rotation === 0 ? item.depthCm : item.widthCm;
      const nextWall = WALL_ORDER[(WALL_ORDER.indexOf(item.wall) + 1) % WALL_ORDER.length];
      const span = wallLengthCm(nextWall, preset.widthCm, preset.lengthCm);
      const clampedAlong = Math.min(alongCm, span);
      const centeredOffset = avoidDoor(nextWall, Math.max(0, (span - clampedAlong) / 2), clampedAlong, mount, door, span);
      const others = current.filter((entry) => entry.instanceId !== instanceId);
      const placement = resolveCollision({
        instanceId,
        wall: nextWall,
        offsetCm: centeredOffset,
        alongCm: clampedAlong,
        depthCm,
        mount,
        trailerWidthCm: preset.widthCm,
        trailerLengthCm: preset.lengthCm,
        others,
        door,
        originWall: item.wall,
        originOffsetCm: offsetOfItem(item),
        overlapExempt: definition?.overlapExempt,
      });
      return applyPlacementResult(current, instanceId, clampedAlong, depthCm, mount, placement, preset.widthCm, preset.lengthCm);
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function removeItem(instanceId: string) {
    setItems((current) => current.filter((item) => item.instanceId !== instanceId));
    if (selectedId === instanceId) setSelectedId(null);
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function removeSelected() {
    if (!selectedId) return;
    removeItem(selectedId);
  }

  function moveItemTo(instanceId: string, pointX: number, pointY: number) {
    setItems((current) => current.map((item) => {
      if (item.instanceId !== instanceId) return item;
      const definition = getEquipment(item.typeId);
      const mount = definition?.mount ?? "inside";
      const alongCm = item.rotation === 0 ? item.widthCm : item.depthCm;
      const depthCm = item.rotation === 0 ? item.depthCm : item.widthCm;
      const wall = wallForPoint(clamp(pointX, 0, preset.widthCm), clamp(pointY, 0, preset.lengthCm), preset.widthCm, preset.lengthCm);
      const span = wallLengthCm(wall, preset.widthCm, preset.lengthCm);
      const desired = clamp((wall === "front" || wall === "back" ? pointX : pointY) - alongCm / 2, 0, Math.max(0, span - alongCm));
      const afterDoor = avoidDoor(wall, desired, alongCm, mount, door, span);
      const neighbors = current.filter((other) => other.instanceId !== instanceId && other.wall === wall).map((other) => {
        const otherAlong = other.rotation === 0 ? other.widthCm : other.depthCm;
        const otherOffset = offsetOfItem(other);
        return { start: otherOffset, end: otherOffset + otherAlong };
      });
      const offset = clamp(snapAlongWall(afterDoor, alongCm, neighbors), 0, Math.max(0, span - alongCm));
      const rect = placeOnWall(wall, offset, alongCm, depthCm, preset.widthCm, preset.lengthCm, mount);
      return { ...item, wall, xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm, rotation: rect.rotation };
    }));
  }

  // Runs once, when the pointer is released: if the item was dropped on top of another,
  // push it to the nearest free spot, or swap places with the blocker as a last resort.
  function finalizeItemPlacement(instanceId: string, originWall: Wall, originOffsetCm: number) {
    setItems((current) => {
      const item = current.find((entry) => entry.instanceId === instanceId);
      if (!item) return current;
      const definition = getEquipment(item.typeId);
      const mount = definition?.mount ?? "inside";
      const alongCm = item.rotation === 0 ? item.widthCm : item.depthCm;
      const depthCm = item.rotation === 0 ? item.depthCm : item.widthCm;
      const others = current.filter((entry) => entry.instanceId !== instanceId);
      const placement = resolveCollision({
        instanceId,
        wall: item.wall,
        offsetCm: offsetOfItem(item),
        alongCm,
        depthCm,
        mount,
        trailerWidthCm: preset.widthCm,
        trailerLengthCm: preset.lengthCm,
        others,
        door,
        originWall,
        originOffsetCm,
        overlapExempt: definition?.overlapExempt,
      });
      return applyPlacementResult(current, instanceId, alongCm, depthCm, mount, placement, preset.widthCm, preset.lengthCm);
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function windowBlockersOnWall(wall: Wall, excludeId?: string) {
    return windows.filter((w) => w.wall === wall && w.id !== excludeId).map((w) => ({ offsetCm: w.offsetCm, widthCm: windowWidthCm(w.wall) }));
  }

  function moveDoorTo(pointX: number, pointY: number) {
    setDoor((current) => {
      const wall = wallForPoint(clamp(pointX, 0, preset.widthCm), clamp(pointY, 0, preset.lengthCm), preset.widthCm, preset.lengthCm);
      const desired = (wall === "front" || wall === "back" ? pointX : pointY) - current.widthCm / 2;
      const afterAxles = avoidAxleBand(wall, desired, current.widthCm, preset);
      const span = wallLengthCm(wall, preset.widthCm, preset.lengthCm);
      const afterWindows = findFreeOffsetOnWall(afterAxles, current.widthCm, span, windowBlockersOnWall(wall));
      const rect = placeOnWall(wall, afterWindows, current.widthCm, 1, preset.widthCm, preset.lengthCm);
      return { wall, offsetCm: rect.offset, widthCm: current.widthCm };
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function cycleDoorWall() {
    setDoor((current) => {
      const nextWall = WALL_ORDER[(WALL_ORDER.indexOf(current.wall) + 1) % WALL_ORDER.length];
      const span = wallLengthCm(nextWall, preset.widthCm, preset.lengthCm);
      const clampedWidth = Math.min(current.widthCm, span);
      const centeredOffset = avoidAxleBand(nextWall, Math.max(0, (span - clampedWidth) / 2), clampedWidth, preset);
      const afterWindows = findFreeOffsetOnWall(centeredOffset, clampedWidth, span, windowBlockersOnWall(nextWall));
      const rect = placeOnWall(nextWall, afterWindows, clampedWidth, 1, preset.widthCm, preset.lengthCm);
      return { wall: nextWall, offsetCm: rect.offset, widthCm: clampedWidth };
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function updateDoorWidth(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setDoor((current) => {
      const span = wallLengthCm(current.wall, preset.widthCm, preset.lengthCm);
      const clampedWidth = Math.min(Math.max(value, DOOR_MIN_WIDTH_CM), Math.min(DOOR_MAX_WIDTH_CM, span));
      const afterAxles = avoidAxleBand(current.wall, current.offsetCm, clampedWidth, preset);
      const afterWindows = findFreeOffsetOnWall(afterAxles, clampedWidth, span, windowBlockersOnWall(current.wall));
      const rect = placeOnWall(current.wall, afterWindows, clampedWidth, 1, preset.widthCm, preset.lengthCm);
      return { wall: current.wall, offsetCm: rect.offset, widthCm: clampedWidth };
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function startWindowDrag(event: PointerEvent<SVGGElement>, win: WindowConfig) {
    event.preventDefault(); event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectedId(null);
    setDoorSelected(false);
    setWindowSelectedId(win.id);
    const next: DragState = { kind: "window", id: win.id, pointerId: event.pointerId, originWall: win.wall, originOffsetCm: win.offsetCm };
    dragRef.current = next;
    setDrag(next);
  }

  // A wall holds at most one window: if the target wall is already occupied by another window,
  // that window is bumped to the dragged window's previous wall instead of letting both coexist.
  function centeredWindowOffset(wall: Wall) {
    const widthCm = windowWidthCm(wall);
    const span = wallLengthCm(wall, preset.widthCm, preset.lengthCm);
    const blockers = door.wall === wall ? [{ offsetCm: door.offsetCm, widthCm: door.widthCm }] : [];
    return findFreeOffsetOnWall(Math.max(0, (span - widthCm) / 2), widthCm, span, blockers);
  }

  function moveWindowTo(id: string, pointX: number, pointY: number) {
    setWindows((current) => {
      const dragged = current.find((w) => w.id === id);
      if (!dragged) return current;
      const wall = wallForPoint(clamp(pointX, 0, preset.widthCm), clamp(pointY, 0, preset.lengthCm), preset.widthCm, preset.lengthCm);
      const widthCm = windowWidthCm(wall);
      const span = wallLengthCm(wall, preset.widthCm, preset.lengthCm);
      const desired = (wall === "front" || wall === "back" ? pointX : pointY) - widthCm / 2;
      const doorBlocker = door.wall === wall ? [{ offsetCm: door.offsetCm, widthCm: door.widthCm }] : [];
      const offsetCm = findFreeOffsetOnWall(desired, widthCm, span, doorBlocker);
      const occupant = wall !== dragged.wall ? current.find((w) => w.id !== id && w.wall === wall) : undefined;
      return current.map((w) => {
        if (w.id === id) return { ...w, wall, offsetCm };
        if (occupant && w.id === occupant.id) return { ...w, wall: dragged.wall, offsetCm: centeredWindowOffset(dragged.wall) };
        return w;
      });
    });
  }

  function cycleWindowWall(id: string) {
    setWindows((current) => {
      const dragged = current.find((w) => w.id === id);
      if (!dragged) return current;
      const nextWall = WALL_ORDER[(WALL_ORDER.indexOf(dragged.wall) + 1) % WALL_ORDER.length];
      const centeredOffset = centeredWindowOffset(nextWall);
      const occupant = current.find((w) => w.id !== id && w.wall === nextWall);
      return current.map((w) => {
        if (w.id === id) return { ...w, wall: nextWall, offsetCm: centeredOffset };
        if (occupant && w.id === occupant.id) return { ...w, wall: dragged.wall, offsetCm: centeredWindowOffset(dragged.wall) };
        return w;
      });
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function finalizeWindowPlacement() {
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function pointInPlan(event: PointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function startItemDrag(event: PointerEvent<SVGGElement>, item: PlacedItem) {
    event.preventDefault(); event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectedId(item.instanceId);
    setDoorSelected(false);
    setWindowSelectedId(null);
    const next: DragState = { kind: "item", instanceId: item.instanceId, pointerId: event.pointerId, originWall: item.wall, originOffsetCm: offsetOfItem(item) };
    dragRef.current = next;
    setDrag(next);
  }

  function startDoorDrag(event: PointerEvent<SVGGElement>) {
    event.preventDefault(); event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectedId(null);
    setDoorSelected(true);
    setWindowSelectedId(null);
    const next: DragState = { kind: "door", pointerId: event.pointerId };
    dragRef.current = next;
    setDrag(next);
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const point = pointInPlan(event);
    if (drag.kind === "item") moveItemTo(drag.instanceId, point.x, point.y);
    else if (drag.kind === "window") moveWindowTo(drag.id, point.x, point.y);
    else moveDoorTo(point.x, point.y);
  }

  // Reads/clears the ref (not the state) first so a duplicate pointerup/pointercancel for the
  // same gesture — which can otherwise both see the same stale `drag` state — only finalizes once.
  function stopDrag() {
    const active = dragRef.current;
    if (!active) return;
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(active.pointerId)) svgRef.current.releasePointerCapture(active.pointerId);
    if (active.kind === "item") finalizeItemPlacement(active.instanceId, active.originWall, active.originOffsetCm);
    else if (active.kind === "window") finalizeWindowPlacement();
    setDrag(null);
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (layoutErrors.length) {
      setSendState("error"); setSendMessage("Corrige los cruces o elementos fuera del plano antes de enviar."); return;
    }
    setSendState("sending"); setSendMessage("Guardando y enviando tu configuración…");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, presetId, items, door, includeIva, specialItems }),
      });
      const result = await response.json() as { error?: string; quoteNumber?: string; emailSent?: boolean; message?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible enviar la cotización.");
      setQuoteNumber(result.quoteNumber ?? "FGT-PENDIENTE");
      setSendState("sent");
      setSendMessage(result.message || (result.emailSent ? "Cotización enviada a contacto@fgtow.com." : "Cotización guardada; falta configurar el servicio de correo."));
    } catch (error) {
      setSendState("error"); setSendMessage(error instanceof Error ? error.message : "No fue posible enviar la cotización.");
    }
  }

  const stepChevron = <i className="step-chevron" aria-hidden="true">⌄</i>;

  function stepHeader(step: 1 | 2 | 3, title: string, subtitle: string, extraClassName = "") {
    return (
      <div
        className={`config-step ${extraClassName} ${activeStep === step ? "is-open" : ""}`}
        onClick={() => toggleStep(step)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleStep(step); } }}
      >
        <span>{String(step).padStart(2, "0")}</span>
        <div><strong>{title}</strong><small>{subtitle}</small></div>
        {stepChevron}
      </div>
    );
  }

  // Toggles the "more accessories below" hint off once the list is scrolled to its end (or if it
  // never overflows in the first place), instead of the old mobile carousel that looped forever.
  function handleEquipmentLibraryScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    setEquipmentAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  }

  useEffect(() => {
    const el = equipmentLibraryRef.current;
    if (el) setEquipmentAtEnd(el.scrollHeight <= el.clientHeight + 4);
  }, [equipmentList]);

  const equipmentPicker = (
    <>
      {stepHeader(2, "Paso 2 · Elige tus accesorios", `Incluye hasta ${preset.includedEquipment} sin costo — agrega los que necesites`, "equipment-heading")}
      <div className={`step-panel ${activeStep === 2 ? "is-open" : ""}`}>
        <div className="equipment-library-wrap">
        <div className="equipment-library" ref={equipmentLibraryRef} onScroll={handleEquipmentLibraryScroll}>{equipmentList.map((equipment) => {
          const qty = quantities[equipment.id] ?? 1;
          return (
            <div className="equipment-row" key={equipment.id}>
              <i style={{ background: equipment.color }} />
              <span><strong>{equipment.name}{equipment.mount === "outside" && !/exterior/i.test(equipment.name) ? " (exterior)" : ""}</strong><small>{equipment.widthCm} × {equipment.depthCm} cm {equipment.surcharge ? `· +${money(equipment.surcharge)}` : ""}</small></span>
              <div className="qty-stepper">
                <button type="button" aria-label="Quitar uno" onClick={() => setQuantities((current) => ({ ...current, [equipment.id]: Math.max(1, (current[equipment.id] ?? 1) - 1) }))}>−</button>
                <span>{qty}</span>
                <button type="button" aria-label="Agregar uno más" onClick={() => setQuantities((current) => ({ ...current, [equipment.id]: Math.min(12, (current[equipment.id] ?? 1) + 1) }))}>+</button>
              </div>
              <button type="button" className="qty-add" onClick={() => addEquipment(equipment.id, qty)}>Agregar {qty > 1 ? `×${qty}` : ""}</button>
            </div>
          );
        })}</div>
        {!equipmentAtEnd && <div className="equipment-scroll-hint" aria-hidden="true"><i>⌄</i></div>}
        </div>

        {plano && (
          <div className="special-item-box">
            <strong>Aditamento especial</strong>
            <small>Solo para vendedores: algo fuera del catálogo, con su propio nombre, medida y precio.</small>
            <div className="special-item-form">
              <label>Nombre<input type="text" value={specialForm.name} onChange={(event) => setSpecialForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Rotulado especial" /></label>
              <label>Ancho cm<input type="number" min={1} value={specialForm.widthCm} onChange={(event) => setSpecialForm((current) => ({ ...current, widthCm: event.target.value }))} /></label>
              <label>Fondo cm<input type="number" min={1} value={specialForm.depthCm} onChange={(event) => setSpecialForm((current) => ({ ...current, depthCm: event.target.value }))} /></label>
              <label>Precio<input type="number" min={0} value={specialForm.price} onChange={(event) => setSpecialForm((current) => ({ ...current, price: event.target.value }))} /></label>
              <button type="button" className="qty-add" onClick={addSpecialItem}>Agregar especial</button>
            </div>
            {specialItems.length > 0 && (
              <ul className="special-item-list">
                {specialItems.map((entry) => (
                  <li key={entry.id}>
                    <span><strong>{entry.name}</strong><small>{entry.widthCm} × {entry.depthCm} cm · {money(entry.price)}</small></span>
                    <button type="button" className="danger-button" onClick={() => removeSpecialItem(entry.id)}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );

  const doorGeo = doorGeometry(door, preset);
  const doorHitRect = placeOnWall(door.wall, door.offsetCm, door.widthCm, 22, preset.widthCm, preset.lengthCm, "inside");
  const doorClearance = doorClearanceRect(door, preset.widthCm, preset.lengthCm);
  const axleWheelHeight = 34;
  const axleWheelGap = 8;
  const axleBand = axleBandCm(preset);
  const axleWheelYs = Array.from({ length: preset.axles }, (_, i) => axleBand.start + i * (axleWheelHeight + axleWheelGap));

  return (
    <>
      <section className="configurator-intro no-print">
        <span className="eyebrow">Cotizador interactivo · {meta.label}</span>
        <h1>{meta.heroTitleLine}<br /><em>{plano ? meta.heroEm : meta.heroEmAddons ?? meta.heroEm}</em></h1>
        <p>{plano ? meta.intro : meta.introAddons}</p>
      </section>

      <p className="configurator-steps-lead no-print">Sigue los pasos para configurar tu remolque.</p>

      <section className={`configurator-shell no-print ${plano ? "" : "configurator-shell--simple"}`}>
        <aside className="config-sidebar">
          {stepHeader(1, "Paso 1 · Elige la medida de tu remolque", "Ancho, largo, altura y ejes")}
          <div className={`step-panel ${activeStep === 1 ? "is-open" : ""}`}>
          {sizingMode === "preset" ? (
            <label className="config-select">Modelo base<select value={presetId} onChange={(event) => updatePreset(event.target.value)}>{presets.map((option) => <option key={option.id} value={option.id}>{option.label} · {money(option.basePrice)}</option>)}</select></label>
          ) : (
            <div className="config-custom-dims">
              <div className="dim-field">
                <small>Ancho</small>
                <div className="dim-options desktop-only">
                  {CUSTOM_WIDTH_OPTIONS_CM.map((w) => (
                    <button key={w} type="button" className={`dim-option ${preset.widthCm === w ? "active" : ""}`} onClick={() => updateCustomDim("width", w)}>{(w / 100).toFixed(2)} m</button>
                  ))}
                </div>
                <select className="dim-select-mobile" value={preset.widthCm} onChange={(event) => updateCustomDim("width", Number(event.target.value))}>
                  {CUSTOM_WIDTH_OPTIONS_CM.map((w) => <option key={w} value={w}>{(w / 100).toFixed(2)} m</option>)}
                </select>
              </div>
              <label className="config-select dim-field">Largo<select value={preset.lengthCm} onChange={(event) => updateCustomDim("length", Number(event.target.value))}>{lengthOptions.map((l) => <option key={l} value={l} disabled={!getAllowedWidths(l).includes(preset.widthCm)}>{(l / 100).toFixed(2)} m</option>)}</select></label>
              <label className="config-select dim-field">Altura<select value={preset.heightCm} onChange={(event) => updateCustomDim("height", Number(event.target.value))}>{heightOptions.map((h) => <option key={h} value={h}>{(h / 100).toFixed(2)} m</option>)}</select></label>
              <div className="dim-field config-axle-box">
                <small>Ejes</small>
                <div className="dim-options desktop-only">
                  {[1, 2, 3].map((a) => (
                    <button key={a} type="button" className={`dim-option ${preset.axles === a ? "active" : ""}`} disabled={!allowedAxles.includes(a as 1 | 2 | 3)} onClick={() => updateCustomDim("axles", a)}>{a}</button>
                  ))}
                </div>
                <select className="dim-select-mobile" value={preset.axles} onChange={(event) => updateCustomDim("axles", Number(event.target.value))}>
                  {[1, 2, 3].map((a) => <option key={a} value={a} disabled={!allowedAxles.includes(a as 1 | 2 | 3)}>{a} {a > 1 ? "ejes" : "eje"}</option>)}
                </select>
              </div>
              <div className="dim-price-hint">Precio base estimado <strong>{money(preset.basePrice)}</strong></div>
            </div>
          )}
          <div className="preset-facts"><div><small>Altura</small><strong>{(preset.heightCm / 100).toFixed(2)} m</strong></div><div><small>Tren rodante</small><strong>{axleLabel(preset.axles)}</strong></div><div><small>Peso est.</small><strong>{preset.estimatedWeightKg} kg</strong></div><div><small>Carga ref.</small><strong>{preset.estimatedCapacityKg.toLocaleString("es-MX")} kg</strong></div></div>
          <button type="button" className="step-advance button" onClick={() => setActiveStep(2)}>Continuar al paso 2 →</button>
          </div>

          {plano && equipmentPicker}
        </aside>

        {plano ? (
        <div className="plan-workspace">
          <div className="workspace-head"><div><span>PLANO / VISTA SUPERIOR</span><strong>{preset.label}</strong></div><div className="plan-legend"><span><i className="ok" /> Disponible</span><span><i className="danger" /> Cruce</span><span><i className="door" /> Puerta</span></div></div>
          <div className="plan-scroll">
            <div className="plan-row">
              <svg className="ruler-strip" viewBox={`0 ${-120} 30 ${preset.lengthCm + 190}`} preserveAspectRatio="none" style={rulerHeightPx ? { height: rulerHeightPx } : undefined} aria-hidden="true">
                <line x1={24} y1={0} x2={24} y2={preset.lengthCm} className="ruler-line" />
                {ticksFor(preset.lengthCm, 10).map((v) => <line key={`lh-${v}`} x1={24} y1={v} x2={30 - (v % 50 === 0 ? 16 : 10)} y2={v} className="ruler-tick" />)}
                {rulerLabels(preset.lengthCm, 50, 20).map((v) => <text key={`lhl-${v}`} x={6} y={v} textAnchor="middle" dominantBaseline="middle" className="ruler-label" transform={`rotate(-90 6 ${v})`}>{v}</text>)}
              </svg>

              <svg
                ref={svgRef}
                className="trailer-plan"
                viewBox={`${-30} ${-120} ${preset.widthCm + 60} ${preset.lengthCm + 190}`}
                role="img"
                aria-label={`Plano editable de remolque de ${preset.widthCm} por ${preset.lengthCm} centímetros`}
                onPointerMove={moveDrag}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                onPointerDown={() => { setSelectedId(null); setDoorSelected(false); setWindowSelectedId(null); }}
              >
                <defs><pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dce5e5" strokeWidth="0.7" /></pattern><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#smallGrid)" /><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#b9c9cc" strokeWidth="1.3" /></pattern></defs>
                <path d={`M ${preset.widthCm / 2 - 45} 0 L ${preset.widthCm / 2} -65 L ${preset.widthCm / 2 + 45} 0`} fill="none" stroke="#0a3550" strokeWidth="4" />
                <circle cx={preset.widthCm / 2} cy="-66" r="6" fill="#fff" stroke="#0a3550" strokeWidth="3" />
                <rect x="0" y="0" width={preset.widthCm} height={preset.lengthCm} rx="3" fill="url(#grid)" stroke="#0a3550" strokeWidth="5" />
                {modelId === "food" && preset.widthCm > PERIMETER_TABLE_DEPTH_CM * 2 && preset.lengthCm > PERIMETER_TABLE_DEPTH_CM * 2 && (
                  <rect x={PERIMETER_TABLE_DEPTH_CM} y={PERIMETER_TABLE_DEPTH_CM} width={preset.widthCm - PERIMETER_TABLE_DEPTH_CM * 2} height={preset.lengthCm - PERIMETER_TABLE_DEPTH_CM * 2} fill="none" stroke="#5f7481" strokeDasharray="7 6" strokeWidth="1.5" opacity=".65" />
                )}
                {axleWheelYs.map((y, i) => <rect key={`axle-left-${i}`} x="-23" y={y} width="23" height={axleWheelHeight} rx="6" fill="#092f46" />)}
                {axleWheelYs.map((y, i) => <rect key={`axle-right-${i}`} x={preset.widthCm} y={y} width="23" height={axleWheelHeight} rx="6" fill="#092f46" />)}
                <text x={preset.widthCm / 2} y="-17" textAnchor="middle" className="plan-label">FRENTE / TIRÓN</text>

                {doorSelected && <rect x={doorClearance.xCm} y={doorClearance.yCm} width={doorClearance.widthCm} height={doorClearance.depthCm} fill="rgba(214,162,41,.14)" stroke="#d6a229" strokeDasharray="6 5" strokeWidth="1.2" />}

                {items.map((item, index) => {
                  const definition = getEquipment(item.typeId);
                  if (!definition) return null;
                  const bad = collisionIds.has(item.instanceId);
                  const active = selectedId === item.instanceId;
                  const faint = definition.overlapExempt ?? false;
                  return <g key={item.instanceId} transform={`translate(${item.xCm} ${item.yCm})`} className={`plan-item ${bad ? "collision" : ""} ${active ? "selected" : ""} ${faint ? "faint" : ""}`} onPointerDown={(event) => startItemDrag(event, item)}>
                    <rect width={item.widthCm} height={item.depthCm} rx="3" fill={faint ? "#9aa4a7" : definition.color} fillOpacity={faint ? ".16" : ".92"} />
                    <rect width={item.widthCm} height={item.depthCm} rx="3" fill="none" stroke={bad ? "#b3261e" : active ? "#fff" : faint ? "#b7c0c2" : "#0a3550"} strokeWidth={active ? 4 : faint ? 1.2 : 2} strokeDasharray={faint ? "4 3" : undefined} />
                    <text x={item.widthCm / 2} y={item.depthCm / 2 - 4} textAnchor="middle" className={`item-label ${faint ? "faint" : ""}`}><tspan x={item.widthCm / 2}>{index + 1}. {definition.shortName}</tspan><tspan x={item.widthCm / 2} dy="13">{item.widthCm} × {item.depthCm} cm</tspan></text>
                  </g>;
                })}

                <g className={`plan-door ${doorSelected ? "selected" : ""}`} onPointerDown={startDoorDrag}>
                  <rect x={doorHitRect.xCm} y={doorHitRect.yCm} width={doorHitRect.widthCm} height={doorHitRect.depthCm} fill="transparent" />
                  <line x1={doorGeo.x1} y1={doorGeo.y1} x2={doorGeo.x2} y2={doorGeo.y2} stroke="#d6a229" strokeWidth="7" strokeLinecap="butt" />
                  <text x={doorGeo.labelX} y={doorGeo.labelY} textAnchor="middle" className="door-label" transform={doorGeo.rotate ? `rotate(${doorGeo.rotate} ${doorGeo.labelX} ${doorGeo.labelY})` : undefined}>PUERTA {door.widthCm}cm</text>
                </g>

                {windows.map((win) => {
                  const widthCm = windowWidthCm(win.wall);
                  const winGeo = doorGeometry({ wall: win.wall, offsetCm: win.offsetCm, widthCm }, preset);
                  const winHitRect = placeOnWall(win.wall, win.offsetCm, widthCm, 22, preset.widthCm, preset.lengthCm, "inside");
                  const active = windowSelectedId === win.id;
                  return (
                    <g key={win.id} className={`plan-window ${active ? "selected" : ""}`} onPointerDown={(event) => startWindowDrag(event, win)}>
                      <rect x={winHitRect.xCm} y={winHitRect.yCm} width={winHitRect.widthCm} height={winHitRect.depthCm} fill="transparent" />
                      <line x1={winGeo.x1} y1={winGeo.y1} x2={winGeo.x2} y2={winGeo.y2} stroke="#7cc3d8" strokeWidth="6" strokeLinecap="butt" />
                    </g>
                  );
                })}

                <line x1={preset.widthCm / 2} x2={preset.widthCm / 2} y1="8" y2={preset.lengthCm - 8} stroke="#d6a229" strokeDasharray="7 6" strokeWidth="1.5" opacity=".7" />

                <g className="ruler ruler-bottom">
                  <line x1={0} y1={preset.lengthCm + 6} x2={preset.widthCm} y2={preset.lengthCm + 6} className="ruler-line" />
                  {ticksFor(preset.widthCm, 10).map((v) => <line key={`bw-${v}`} x1={v} y1={preset.lengthCm + 6} x2={v} y2={preset.lengthCm + (v % 50 === 0 ? 16 : 10)} className="ruler-tick" />)}
                  {rulerLabels(preset.widthCm, 50, 20).map((v) => <text key={`bwl-${v}`} x={v} y={preset.lengthCm + 27} textAnchor="middle" className="ruler-label">{v}</text>)}
                </g>
                <g className="ruler ruler-top">
                  <line x1={0} y1={-80} x2={preset.widthCm} y2={-80} className="ruler-line" />
                  {ticksFor(preset.widthCm, 10).map((v) => <line key={`tw-${v}`} x1={v} y1={-80} x2={v} y2={-80 - (v % 50 === 0 ? 16 : 10)} className="ruler-tick" />)}
                  {rulerLabels(preset.widthCm, 50, 20).map((v) => <text key={`twl-${v}`} x={v} y={-101} textAnchor="middle" className="ruler-label">{v}</text>)}
                </g>

                <text x={preset.widthCm / 2} y={preset.lengthCm + 48} textAnchor="middle" className="plan-measure">ANCHO {(preset.widthCm / 100).toFixed(2)} m</text>
              </svg>

              <svg className="ruler-strip" viewBox={`0 ${-120} 30 ${preset.lengthCm + 190}`} preserveAspectRatio="none" style={rulerHeightPx ? { height: rulerHeightPx } : undefined} aria-hidden="true">
                <line x1={6} y1={0} x2={6} y2={preset.lengthCm} className="ruler-line" />
                {ticksFor(preset.lengthCm, 10).map((v) => <line key={`rh-${v}`} x1={6} y1={v} x2={v % 50 === 0 ? 16 : 10} y2={v} className="ruler-tick" />)}
                {rulerLabels(preset.lengthCm, 50, 20).map((v) => <text key={`rhl-${v}`} x={24} y={v} textAnchor="middle" dominantBaseline="middle" className="ruler-label" transform={`rotate(-90 24 ${v})`}>{v}</text>)}
              </svg>
            </div>
          </div>

          <div className={`layout-status ${layoutErrors.length ? "has-errors" : "ready"}`}><strong>{layoutErrors.length ? `${layoutErrors.length} ajuste${layoutErrors.length > 1 ? "s" : ""} pendiente${layoutErrors.length > 1 ? "s" : ""}` : "Distribución lista para cotizar"}</strong><span>{layoutErrors[0] ?? "Todos los equipos están dentro del remolque, contra las orillas y sin cruces."}</span></div>

          {selected && selectedDefinition && selectedAlongLimits && selectedDepthLimits ? (
            <div className="item-editor">
              <div><span>ELEMENTO SELECCIONADO</span><strong>{selectedDefinition.name}</strong><small>{selectedDefinition.description} {(selectedDefinition.mount ?? "inside") === "outside" ? "Va montado por fuera del remolque." : `Pared actual: ${WALL_LABEL[selected.wall]}.`}</small></div>
              <label>Ancho<input type="number" min={selectedAlongLimits.min} max={Math.min(selectedAlongLimits.max, wallLengthCm(selected.wall, preset.widthCm, preset.lengthCm))} value={selected.rotation === 0 ? selected.widthCm : selected.depthCm} onChange={(event) => updateItemSize(selected.instanceId, "along", Number(event.target.value))} /><b>cm</b></label>
              <label>Fondo<input type="number" min={selectedDepthLimits.min} max={selectedDepthLimits.max} value={selected.rotation === 0 ? selected.depthCm : selected.widthCm} onChange={(event) => updateItemSize(selected.instanceId, "depth", Number(event.target.value))} /><b>cm</b></label>
              <button type="button" onClick={() => cycleWall(selected.instanceId)}>Cambiar de pared ↻</button>
              <button type="button" className="danger-button" onClick={removeSelected}>Eliminar</button>
            </div>
          ) : doorSelected ? (
            <div className="item-editor door-editor">
              <div><span>PUERTA DEL REMOLQUE</span><strong>{WALL_LABEL[door.wall]}</strong><small>Se ubica por defecto centrada en la parte trasera. Nada puede colocarse justo frente a ella (zona de {DOOR_CLEARANCE_CM} cm).</small></div>
              <label>Ancho<input type="number" min={DOOR_MIN_WIDTH_CM} max={Math.min(DOOR_MAX_WIDTH_CM, wallLengthCm(door.wall, preset.widthCm, preset.lengthCm))} value={door.widthCm} onChange={(event) => updateDoorWidth(Number(event.target.value))} /><b>cm</b></label>
              <button type="button" onClick={cycleDoorWall}>Cambiar de pared ↻</button>
            </div>
          ) : windowSelectedId ? (
            (() => {
              const win = windows.find((w) => w.id === windowSelectedId);
              if (!win) return null;
              return (
                <div className="item-editor door-editor">
                  <div><span>VENTANA</span><strong>{WALL_LABEL[win.wall]}</strong><small>Incluida sin costo. {windowWidthCm(win.wall)} × {windowHeightCm(win.wall)} cm. No puede sobreponerse a la puerta ni a otra ventana.</small></div>
                  <button type="button" onClick={() => cycleWindowWall(win.id)}>Cambiar de pared ↻</button>
                </div>
              );
            })()
          ) : (
            <div className="item-editor empty"><span>Selecciona un elemento, la puerta o una ventana en el plano para ajustar su medida o cambiarlo de pared. Todo se desliza pegado a la orilla del remolque.</span></div>
          )}
        </div>
        ) : (
        <div className="addons-workspace">
          <div className="addons-equipment-picker">{equipmentPicker}</div>
          <div className={`step-panel ${activeStep === 2 ? "is-open" : ""}`}>
          <div className="workspace-head"><div><span>ADITAMENTOS AGREGADOS</span><strong>{preset.label}</strong></div></div>
          {items.length ? (
            <ul className="addons-list">
              {items.map((item, index) => {
                const definition = getEquipment(item.typeId);
                if (!definition) return null;
                return (
                  <li key={item.instanceId} className="addons-row">
                    <i style={{ background: definition.color }} />
                    <span><strong>{index + 1}. {definition.name}</strong><small>{item.rotation === 0 ? item.widthCm : item.depthCm} × {item.rotation === 0 ? item.depthCm : item.widthCm} cm</small></span>
                    <button type="button" className="danger-button" onClick={() => removeItem(item.instanceId)}>Quitar</button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="item-editor empty"><span>Agrega aditamentos desde la lista de arriba para armar tu configuración.</span></div>
          )}
          {layoutErrors.length > 0 && (
            <div className="layout-status has-errors"><strong>Ajuste pendiente</strong><span>No caben todos los aditamentos con esta medida, quita alguno.</span></div>
          )}
          <button type="button" className="step-advance button" onClick={() => setActiveStep(3)}>Continuar al paso 3 →</button>
          </div>
        </div>
        )}

        <aside className="price-panel">
          {stepHeader(3, "Paso 3 · Revisa tu cotización", "Después pasamos a tus datos")}
          <div className={`step-panel ${activeStep === 3 ? "is-open" : ""}`}>
          <div className="price-base"><small>Remolque base</small><strong>{money(quote.preset.basePrice)}</strong><span>Incluye {meta.includesNote} y hasta {quote.preset.includedEquipment} {meta.equipmentLabel}.</span></div>
          <ol className="price-lines">{quote.lines.map((line, index) => <li key={line.item.instanceId}><span><i style={{ background: line.definition.color }} />{index + 1}. {line.definition.shortName}</span><strong>{line.included ? "Incluido" : line.linePrice ? `+${money(line.linePrice)}` : "$0"}</strong></li>)}{specialItems.map((entry) => <li key={entry.id}><span><i style={{ background: "#a8324a" }} />{entry.name}</span><strong>+{money(entry.price)}</strong></li>)}</ol>
          {!items.length && !specialItems.length && <p className="empty-price">Agrega equipos para construir tu distribución.</p>}
          <div className="price-totals"><div><span>Base</span><strong>{money(quote.preset.basePrice)}</strong></div><div><span>Extras</span><strong>{money(quote.extras + specialItemsTotal)}</strong></div><label><span><input type="checkbox" checked={includeIva} onChange={(event) => setIncludeIva(event.target.checked)} /> Incluir IVA (16%)</span><strong>{money(combinedIva)}</strong></label><div className="grand-total"><span>Total estimado</span><strong>{money(combinedTotal)}</strong></div></div>
          <p className="estimate-note">Estimación comercial basada en medidas y equipamiento. Requiere validación de ingeniería, capacidad, instalaciones, acabados y disponibilidad.</p>
          <a className="button config-continue" href="#enviar-cotizacion">Continuar con mis datos →</a>
          </div>
        </aside>
      </section>

      <section className="quote-submit no-print" id="enviar-cotizacion">
        <div className="quote-submit-copy"><span className="eyebrow">Termina tu proyecto</span><h2>Recibe una propuesta<br /><em>con tu distribución.</em></h2><p>{plano ? "Guardaremos el plano y enviaremos la cotización preliminar al equipo comercial de FG TOW para revisión." : "Enviaremos la cotización preliminar al equipo comercial de FG TOW para revisión."}</p><ul>{plano && <li>Plano 2D y lista de equipos</li>}{!plano && <li>Lista de aditamentos</li>}<li>Importe aproximado desglosado</li><li>Seguimiento desde contacto@fgtow.com</li></ul>{!plano && <p className="quote-submit-address">¿Prefieres verlo en persona? Te esperamos en nuestra planta: <a href={FABRICATION_MAPS_URL} target="_blank" rel="noreferrer">📍 {FABRICATION_ADDRESS}</a></p>}</div>
        <form className="quote-customer-form" onSubmit={submitQuote}>
          <div className="form-row"><label>Nombre completo<input name="name" required minLength={2} autoComplete="name" value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} /></label><label>Teléfono<input name="phone" required minLength={7} inputMode="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} /></label></div>
          <div className="form-row form-row-3"><label>Correo electrónico<input name="email" required type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} /></label><label>Ciudad<input name="city" required value={customer.city} onChange={(event) => setCustomer((current) => ({ ...current, city: event.target.value }))} /></label><label>Estado<select name="state" required value={customer.state} onChange={(event) => setCustomer((current) => ({ ...current, state: event.target.value }))} autoComplete="address-level1">{MEXICAN_STATES.map((stateName) => <option key={stateName}>{stateName}</option>)}</select></label></div>
          <label>Notas para el equipo<textarea name="notes" rows={4} placeholder="Cuéntanos el uso que le darás, vehículo de arrastre, aditamentos especiales, color o fecha objetivo…" value={customer.notes} onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))} /></label>
          <label className="honeypot" aria-hidden="true">Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label>
          <label className="consent"><input name="consent" value="yes" type="checkbox" required /> Autorizo que FG TOW guarde esta configuración y me contacte para revisar el proyecto.</label>
          <button className="button submit" disabled={sendState === "sending" || layoutErrors.length > 0}>{sendState === "sending" ? "Enviando cotización…" : layoutErrors.length ? "Corrige el plano para enviar" : "Enviar a FG TOW →"}</button>
          <p className={`form-status ${sendState}`} role="status">{sendMessage || "La cifra mostrada es una aproximación y no sustituye la cotización final firmada."}</p>
        </form>
      </section>

      {sendState === "sent" && (
      <>
      <div className="quote-sent-banner no-print" role="status" ref={sentBannerRef}>
        <strong>✓ Solicitud enviada</strong>
        <span>{sendMessage}</span>
      </div>

      <section className="quote-document" aria-label="Formato imprimible de cotización">
        <div className="document-head"><Image src="/fg-tow-logo.png" alt="FG TOW" width={220} height={68} unoptimized /><div><strong>COTIZACIÓN PRELIMINAR</strong><span>Folio {quoteNumber}</span><span>{new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date())}</span></div></div>
        <div className="document-banner"><div><small>MODELO</small><strong>{meta.shortLabel} {preset.widthCm / 100} × {preset.lengthCm / 100} m</strong></div><div><small>TREN RODANTE</small><strong>{axleLabel(preset.axles)}</strong></div><div><small>TOTAL ESTIMADO</small><strong>{money(combinedTotal)}</strong></div></div>
        <div className="document-customer"><div><small>CLIENTE</small><strong>{customer.name || "Por completar"}</strong></div><div><small>CONTACTO</small><strong>{customer.phone || customer.email || "Por completar"}</strong></div><div><small>CIUDAD</small><strong>{customer.city || "Por completar"}</strong></div><div><small>ESTADO</small><strong>{customer.state || "Por completar"}</strong></div></div>
        {plano && <div className="document-plan-wrap"><div><small>PLANO 2D / VISTA SUPERIOR</small><strong>Distribución propuesta por el cliente</strong><span>Las posiciones se revisarán para confirmar circulación, ventilación, instalaciones y balance de peso. Puerta: {WALL_LABEL[door.wall]}, {door.widthCm} cm.</span></div><svg className="document-plan" viewBox={`${-25} ${-60} ${preset.widthCm + 50} ${preset.lengthCm + 85}`} aria-label="Plano incluido en la cotización"><path d={`M ${preset.widthCm / 2 - 38} 0 L ${preset.widthCm / 2} -48 L ${preset.widthCm / 2 + 38} 0`} fill="none" stroke="#0a3550" strokeWidth="4" /><rect x="0" y="0" width={preset.widthCm} height={preset.lengthCm} fill="#f7f8f6" stroke="#0a3550" strokeWidth="5" />{items.map((item, index) => { const definition = getEquipment(item.typeId); if (!definition) return null; return <g key={item.instanceId} transform={`translate(${item.xCm} ${item.yCm})`}><rect width={item.widthCm} height={item.depthCm} rx="2" fill={definition.color} stroke="#0a3550" strokeWidth="1.5" /><text x={item.widthCm / 2} y={item.depthCm / 2} textAnchor="middle" dominantBaseline="middle" className="document-plan-label">{index + 1}</text></g>; })}<line x1={doorGeo.x1} y1={doorGeo.y1} x2={doorGeo.x2} y2={doorGeo.y2} stroke="#d6a229" strokeWidth="6" /></svg></div>}
        <div className="document-grid"><div><h3>Especificación base</h3><dl><div><dt>Medidas interiores</dt><dd>{(preset.widthCm / 100).toFixed(2)} × {(preset.lengthCm / 100).toFixed(2)} × {(preset.heightCm / 100).toFixed(2)} m</dd></div><div><dt>Peso estimado</dt><dd>{preset.estimatedWeightKg} kg</dd></div><div><dt>Capacidad de referencia</dt><dd>{preset.estimatedCapacityKg.toLocaleString("es-MX")} kg</dd></div>{plano && <div><dt>Puerta</dt><dd>{WALL_LABEL[door.wall]} · {door.widthCm} cm</dd></div>}<div><dt>Elementos colocados</dt><dd>{items.length}</dd></div></dl></div><div><h3>Incluye de base</h3><p>Incluye {meta.includesNote} y hasta {preset.includedEquipment} {meta.equipmentLabel}.</p></div></div>
        <table><thead><tr><th>#</th><th>Equipo / concepto</th><th>Medida</th><th>Importe</th></tr></thead><tbody><tr><td>01</td><td>Remolque base {preset.label}</td><td>{preset.widthCm} × {preset.lengthCm} cm</td><td>{money(preset.basePrice)}</td></tr>{quote.lines.map((line, index) => <tr key={line.item.instanceId}><td>{String(index + 2).padStart(2, "0")}</td><td>{line.definition.name}</td><td>{line.item.widthCm} × {line.item.depthCm} cm</td><td>{line.included ? "Incluido" : line.linePrice ? money(line.linePrice) : "$0"}</td></tr>)}{specialItems.map((entry, index) => <tr key={entry.id}><td>{String(quote.lines.length + index + 2).padStart(2, "0")}</td><td>{entry.name} (especial)</td><td>{entry.widthCm} × {entry.depthCm} cm</td><td>{money(entry.price)}</td></tr>)}</tbody></table>
        <div className="document-total"><div><span>Subtotal</span><strong>{money(combinedSubtotal)}</strong></div><div><span>IVA</span><strong>{money(combinedIva)}</strong></div><div><span>Total estimado</span><strong>{money(combinedTotal)}</strong></div></div>
        <div className="document-terms"><strong>Alcance de esta estimación</strong><p>Importes en pesos mexicanos. Esta propuesta es orientativa y está sujeta a revisión técnica, distribución de peso, capacidad requerida, especificaciones sanitarias, materiales, acabados, impuestos y disponibilidad. El precio final será confirmado por FG TOW después de revisar el plano.</p></div>
        {customer.notes && <div className="document-notes"><strong>Notas del proyecto</strong><p>{customer.notes}</p></div>}
        <div className="document-footer"><span>FG TOW · De FG INV</span><span>contacto@fgtow.com · fgtow.com</span></div>
      </section>

      <div className="quote-actions no-print"><button type="button" className="button" onClick={() => window.print()}>Imprimir cotización</button><span>En la ventana de impresión selecciona “Guardar como PDF” si prefieres un archivo.</span></div>
      </>
      )}
    </>
  );
}
