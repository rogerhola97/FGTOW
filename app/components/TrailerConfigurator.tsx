"use client";

import Image from "next/image";
import { FormEvent, PointerEvent, useMemo, useRef, useState } from "react";
import {
  DOOR_CLEARANCE_CM,
  DOOR_MAX_WIDTH_CM,
  DOOR_MIN_WIDTH_CM,
  DoorConfig,
  MODEL_META,
  ModelId,
  PlacedEquipment,
  TrailerPreset,
  WALL_LABEL,
  Wall,
  calculateQuote,
  defaultDoor,
  doorClearanceRect,
  getEquipment,
  getEquipmentForModel,
  getPreset,
  getPresetsForModel,
  money,
  placeOnWall,
  rectsOverlap,
  validateLayout,
  wallForPoint,
  wallLengthCm,
} from "../lib/quoteCatalog";

type PlacedItem = PlacedEquipment & { wall: Wall };
type SendState = "idle" | "sending" | "sent" | "error";
type DragState = { kind: "item"; instanceId: string; pointerId: number } | { kind: "door"; pointerId: number } | null;

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
  if (modelId === "cargo") return buildStarterLayout(["caja-herramientas", "amarres", "salpicaderas", "salpicaderas", "rampa"], trailerWidthCm, trailerLengthCm, door);
  if (modelId === "rzr") return buildStarterLayout(["anclajes", "anclajes", "portallantas", "freno-inercia", "rampa-reforzada"], trailerWidthCm, trailerLengthCm, door);
  return buildStarterLayout(["plancha", "bano-maria", "freidora", "parrilla", "mesa", "tarja"], trailerWidthCm, trailerLengthCm, door);
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
      const blockedByItem = existing.some((item) => rectsOverlap(candidate, item));
      if (!blockedByDoor && !blockedByItem) return { wall, offsetCm: rect.offset, alongCm, depthCm };
    }
  }
  const fallbackWall = walls[0];
  const fallbackSpan = wallLengthCm(fallbackWall, trailerWidthCm, trailerLengthCm);
  return { wall: fallbackWall, offsetCm: 0, alongCm: Math.min(definition!.widthCm, fallbackSpan), depthCm: definition!.depthCm };
}

const WALL_ORDER: Wall[] = ["front", "right", "back", "left"];

export function TrailerConfigurator({ modelId }: { modelId: ModelId }) {
  const meta = MODEL_META[modelId];
  const presets = useMemo(() => getPresetsForModel(modelId), [modelId]);
  const equipmentList = useMemo(() => getEquipmentForModel(modelId), [modelId]);
  const [presetId, setPresetId] = useState(meta.defaultPresetId);
  const preset = getPreset(presetId);
  const [door, setDoor] = useState<DoorConfig>(() => defaultDoor(preset.widthCm));
  const [items, setItems] = useState<PlacedItem[]>(() => starterLayout(modelId, preset.widthCm, preset.lengthCm, door));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doorSelected, setDoorSelected] = useState(false);
  const [drag, setDrag] = useState<DragState>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [includeIva, setIncludeIva] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendMessage, setSendMessage] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("BORRADOR");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", city: "Monterrey, N.L.", notes: "" });
  const svgRef = useRef<SVGSVGElement>(null);

  const quote = useMemo(() => calculateQuote(presetId, items, includeIva), [presetId, items, includeIva]);
  const layoutErrors = useMemo(() => validateLayout(preset, items, door), [preset, items, door]);
  const selected = items.find((item) => item.instanceId === selectedId) ?? null;
  const selectedDefinition = selected ? getEquipment(selected.typeId) : null;
  const selectedAlongLimits = selectedDefinition ? { min: selectedDefinition.minWidthCm, max: selectedDefinition.maxWidthCm } : null;
  const selectedDepthLimits = selectedDefinition ? { min: selectedDefinition.minDepthCm, max: selectedDefinition.maxDepthCm } : null;
  const collisionIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) if (rectsOverlap(items[i], items[j])) {
      ids.add(items[i].instanceId); ids.add(items[j].instanceId);
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
    setSendState("idle"); setQuoteNumber("BORRADOR");
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

  function updateItemSize(instanceId: string, part: "along" | "depth", value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setItems((current) => current.map((item) => {
      if (item.instanceId !== instanceId) return item;
      const definition = getEquipment(item.typeId);
      const mount = definition?.mount ?? "inside";
      const currentAlong = item.rotation === 0 ? item.widthCm : item.depthCm;
      const currentDepth = item.rotation === 0 ? item.depthCm : item.widthCm;
      const alongCm = part === "along" ? value : currentAlong;
      const depthCm = part === "depth" ? value : currentDepth;
      const rect = placeOnWall(item.wall, offsetOfItem(item), alongCm, depthCm, preset.widthCm, preset.lengthCm, mount);
      return { ...item, xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm, rotation: rect.rotation };
    }));
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function cycleWall(instanceId: string) {
    setItems((current) => current.map((item) => {
      if (item.instanceId !== instanceId) return item;
      const definition = getEquipment(item.typeId);
      const mount = definition?.mount ?? "inside";
      const alongCm = item.rotation === 0 ? item.widthCm : item.depthCm;
      const depthCm = item.rotation === 0 ? item.depthCm : item.widthCm;
      const nextWall = WALL_ORDER[(WALL_ORDER.indexOf(item.wall) + 1) % WALL_ORDER.length];
      const span = wallLengthCm(nextWall, preset.widthCm, preset.lengthCm);
      const clampedAlong = Math.min(alongCm, span);
      const centeredOffset = avoidDoor(nextWall, Math.max(0, (span - clampedAlong) / 2), clampedAlong, mount, door, span);
      const rect = placeOnWall(nextWall, centeredOffset, clampedAlong, depthCm, preset.widthCm, preset.lengthCm, mount);
      return { ...item, wall: nextWall, xCm: rect.xCm, yCm: rect.yCm, widthCm: rect.widthCm, depthCm: rect.depthCm, rotation: rect.rotation };
    }));
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function removeSelected() {
    if (!selectedId) return;
    setItems((current) => current.filter((item) => item.instanceId !== selectedId));
    setSelectedId(null); setSendState("idle"); setQuoteNumber("BORRADOR");
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

  function moveDoorTo(pointX: number, pointY: number) {
    setDoor((current) => {
      const wall = wallForPoint(clamp(pointX, 0, preset.widthCm), clamp(pointY, 0, preset.lengthCm), preset.widthCm, preset.lengthCm);
      const desired = (wall === "front" || wall === "back" ? pointX : pointY) - current.widthCm / 2;
      const rect = placeOnWall(wall, desired, current.widthCm, 1, preset.widthCm, preset.lengthCm);
      return { wall, offsetCm: rect.offset, widthCm: current.widthCm };
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function cycleDoorWall() {
    setDoor((current) => {
      const nextWall = WALL_ORDER[(WALL_ORDER.indexOf(current.wall) + 1) % WALL_ORDER.length];
      const span = wallLengthCm(nextWall, preset.widthCm, preset.lengthCm);
      const clampedWidth = Math.min(current.widthCm, span);
      const centeredOffset = Math.max(0, (span - clampedWidth) / 2);
      const rect = placeOnWall(nextWall, centeredOffset, clampedWidth, 1, preset.widthCm, preset.lengthCm);
      return { wall: nextWall, offsetCm: rect.offset, widthCm: clampedWidth };
    });
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function updateDoorWidth(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setDoor((current) => {
      const span = wallLengthCm(current.wall, preset.widthCm, preset.lengthCm);
      const clampedWidth = Math.min(Math.max(value, DOOR_MIN_WIDTH_CM), Math.min(DOOR_MAX_WIDTH_CM, span));
      const rect = placeOnWall(current.wall, current.offsetCm, clampedWidth, 1, preset.widthCm, preset.lengthCm);
      return { wall: current.wall, offsetCm: rect.offset, widthCm: clampedWidth };
    });
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
    setDrag({ kind: "item", instanceId: item.instanceId, pointerId: event.pointerId });
  }

  function startDoorDrag(event: PointerEvent<SVGGElement>) {
    event.preventDefault(); event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectedId(null);
    setDoorSelected(true);
    setDrag({ kind: "door", pointerId: event.pointerId });
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const point = pointInPlan(event);
    if (drag.kind === "item") moveItemTo(drag.instanceId, point.x, point.y);
    else moveDoorTo(point.x, point.y);
  }

  function stopDrag() {
    if (drag && svgRef.current?.hasPointerCapture(drag.pointerId)) svgRef.current.releasePointerCapture(drag.pointerId);
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
        body: JSON.stringify({ ...values, presetId, items, door, includeIva }),
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

  const doorGeo = doorGeometry(door, preset);
  const doorHitRect = placeOnWall(door.wall, door.offsetCm, door.widthCm, 22, preset.widthCm, preset.lengthCm, "inside");
  const doorClearance = doorClearanceRect(door, preset.widthCm, preset.lengthCm);

  return (
    <>
      <section className="configurator-intro no-print">
        <span className="eyebrow">Cotizador interactivo · {meta.label}</span>
        <h1>{meta.heroTitleLine}<br /><em>{meta.heroEm}</em></h1>
        <p>{meta.intro}</p>
        <div className="source-badges">{meta.sourceBadges.map((badge) => <span key={badge}>{badge}</span>)}</div>
      </section>

      <section className="configurator-shell no-print">
        <aside className="config-sidebar">
          <div className="config-step"><span>01</span><div><strong>Medida del remolque</strong><small>Dimensiones interiores de trabajo</small></div></div>
          <label className="config-select">Modelo base<select value={presetId} onChange={(event) => updatePreset(event.target.value)}>{presets.map((option) => <option key={option.id} value={option.id}>{option.label} · {money(option.basePrice)}</option>)}</select></label>
          <div className="preset-facts"><div><small>Altura</small><strong>{(preset.heightCm / 100).toFixed(2)} m</strong></div><div><small>Tren rodante</small><strong>{preset.axles === 2 ? "Doble eje" : "1 eje"}</strong></div><div><small>Peso est.</small><strong>{preset.estimatedWeightKg} kg</strong></div><div><small>Carga ref.</small><strong>{preset.estimatedCapacityKg.toLocaleString("es-MX")} kg</strong></div></div>

          <div className="config-step equipment-heading"><span>02</span><div><strong>{meta.equipmentHeading}</strong><small>Elige cuántos y toca “Agregar”</small></div></div>
          <div className="equipment-library">{equipmentList.map((equipment) => {
            const qty = quantities[equipment.id] ?? 1;
            return (
              <div className="equipment-row" key={equipment.id}>
                <i style={{ background: equipment.color }} />
                <span><strong>{equipment.name}{equipment.mount === "outside" ? " (exterior)" : ""}</strong><small>{equipment.widthCm} × {equipment.depthCm} cm {equipment.surcharge ? `· +${money(equipment.surcharge)}` : ""}</small></span>
                <div className="qty-stepper">
                  <button type="button" aria-label="Quitar uno" onClick={() => setQuantities((current) => ({ ...current, [equipment.id]: Math.max(1, (current[equipment.id] ?? 1) - 1) }))}>−</button>
                  <span>{qty}</span>
                  <button type="button" aria-label="Agregar uno más" onClick={() => setQuantities((current) => ({ ...current, [equipment.id]: Math.min(12, (current[equipment.id] ?? 1) + 1) }))}>+</button>
                </div>
                <button type="button" className="qty-add" onClick={() => addEquipment(equipment.id, qty)}>Agregar {qty > 1 ? `×${qty}` : ""}</button>
              </div>
            );
          })}</div>
        </aside>

        <div className="plan-workspace">
          <div className="workspace-head"><div><span>PLANO / VISTA SUPERIOR</span><strong>{preset.label}</strong></div><div className="plan-legend"><span><i className="ok" /> Disponible</span><span><i className="danger" /> Cruce</span><span><i className="door" /> Puerta</span></div></div>
          <div className="plan-scroll">
            <svg
              ref={svgRef}
              className="trailer-plan"
              viewBox={`${-60} ${-120} ${preset.widthCm + 100} ${preset.lengthCm + 190}`}
              role="img"
              aria-label={`Plano editable de remolque de ${preset.widthCm} por ${preset.lengthCm} centímetros`}
              onPointerMove={moveDrag}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onPointerDown={() => { setSelectedId(null); setDoorSelected(false); }}
            >
              <defs><pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dce5e5" strokeWidth="0.7" /></pattern><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#smallGrid)" /><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#b9c9cc" strokeWidth="1.3" /></pattern></defs>
              <path d={`M ${preset.widthCm / 2 - 45} 0 L ${preset.widthCm / 2} -65 L ${preset.widthCm / 2 + 45} 0`} fill="none" stroke="#0a3550" strokeWidth="4" />
              <circle cx={preset.widthCm / 2} cy="-66" r="6" fill="#fff" stroke="#0a3550" strokeWidth="3" />
              <rect x="0" y="0" width={preset.widthCm} height={preset.lengthCm} rx="3" fill="url(#grid)" stroke="#0a3550" strokeWidth="5" />
              <rect x="-23" y={preset.lengthCm * .52} width="23" height={preset.axles === 2 ? 76 : 45} rx="6" fill="#092f46" />
              <rect x={preset.widthCm} y={preset.lengthCm * .52} width="23" height={preset.axles === 2 ? 76 : 45} rx="6" fill="#092f46" />
              <text x={preset.widthCm / 2} y="-17" textAnchor="middle" className="plan-label">FRENTE / TIRÓN</text>

              {doorSelected && <rect x={doorClearance.xCm} y={doorClearance.yCm} width={doorClearance.widthCm} height={doorClearance.depthCm} fill="rgba(214,162,41,.14)" stroke="#d6a229" strokeDasharray="6 5" strokeWidth="1.2" />}

              {items.map((item, index) => {
                const definition = getEquipment(item.typeId);
                if (!definition) return null;
                const bad = collisionIds.has(item.instanceId);
                const active = selectedId === item.instanceId;
                return <g key={item.instanceId} transform={`translate(${item.xCm} ${item.yCm})`} className={`plan-item ${bad ? "collision" : ""} ${active ? "selected" : ""}`} onPointerDown={(event) => startItemDrag(event, item)}>
                  <rect width={item.widthCm} height={item.depthCm} rx="3" fill={definition.color} fillOpacity=".92" />
                  <rect width={item.widthCm} height={item.depthCm} rx="3" fill="none" stroke={bad ? "#b3261e" : active ? "#fff" : "#0a3550"} strokeWidth={active ? 4 : 2} />
                  <text x={item.widthCm / 2} y={item.depthCm / 2 - 4} textAnchor="middle" className="item-label"><tspan x={item.widthCm / 2}>{index + 1}. {definition.shortName}</tspan><tspan x={item.widthCm / 2} dy="13">{item.widthCm} × {item.depthCm} cm</tspan></text>
                </g>;
              })}

              <g className={`plan-door ${doorSelected ? "selected" : ""}`} onPointerDown={startDoorDrag}>
                <rect x={doorHitRect.xCm} y={doorHitRect.yCm} width={doorHitRect.widthCm} height={doorHitRect.depthCm} fill="transparent" />
                <line x1={doorGeo.x1} y1={doorGeo.y1} x2={doorGeo.x2} y2={doorGeo.y2} stroke="#d6a229" strokeWidth="7" strokeLinecap="butt" />
                <text x={doorGeo.labelX} y={doorGeo.labelY} textAnchor="middle" className="door-label" transform={doorGeo.rotate ? `rotate(${doorGeo.rotate} ${doorGeo.labelX} ${doorGeo.labelY})` : undefined}>PUERTA {door.widthCm}cm</text>
              </g>

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
              <g className="ruler ruler-left">
                <line x1={-6} y1={0} x2={-6} y2={preset.lengthCm} className="ruler-line" />
                {ticksFor(preset.lengthCm, 10).map((v) => <line key={`lh-${v}`} x1={-6} y1={v} x2={-(v % 50 === 0 ? 16 : 10)} y2={v} className="ruler-tick" />)}
                {rulerLabels(preset.lengthCm, 50, 20).map((v) => <text key={`lhl-${v}`} x={-24} y={v} textAnchor="middle" dominantBaseline="middle" className="ruler-label" transform={`rotate(-90 -24 ${v})`}>{v}</text>)}
              </g>
              <g className="ruler ruler-right">
                <line x1={preset.widthCm + 6} y1={0} x2={preset.widthCm + 6} y2={preset.lengthCm} className="ruler-line" />
                {ticksFor(preset.lengthCm, 10).map((v) => <line key={`rh-${v}`} x1={preset.widthCm + 6} y1={v} x2={preset.widthCm + (v % 50 === 0 ? 16 : 10)} y2={v} className="ruler-tick" />)}
                {rulerLabels(preset.lengthCm, 50, 20).map((v) => <text key={`rhl-${v}`} x={preset.widthCm + 24} y={v} textAnchor="middle" dominantBaseline="middle" className="ruler-label" transform={`rotate(-90 ${preset.widthCm + 24} ${v})`}>{v}</text>)}
              </g>

              <text x={preset.widthCm / 2} y={preset.lengthCm + 48} textAnchor="middle" className="plan-measure">ANCHO {(preset.widthCm / 100).toFixed(2)} m</text>
              <text x="-44" y={preset.lengthCm / 2} transform={`rotate(-90 -44 ${preset.lengthCm / 2})`} textAnchor="middle" className="plan-measure">LARGO {(preset.lengthCm / 100).toFixed(2)} m</text>
            </svg>
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
          ) : (
            <div className="item-editor empty"><span>Selecciona un elemento o la puerta en el plano para ajustar su medida o cambiarlo de pared. Todo se desliza pegado a la orilla del remolque.</span></div>
          )}
        </div>

        <aside className="price-panel">
          <div className="config-step"><span>03</span><div><strong>Cotización estimada</strong><small>Actualizada en tiempo real</small></div></div>
          <div className="price-base"><small>Remolque base</small><strong>{money(quote.preset.basePrice)}</strong><span>Incluye {meta.includesNote} y hasta {quote.preset.includedEquipment} {meta.equipmentLabel}.</span></div>
          <ol className="price-lines">{quote.lines.map((line, index) => <li key={line.item.instanceId}><span><i style={{ background: line.definition.color }} />{index + 1}. {line.definition.shortName}</span><strong>{line.included ? "Incluido" : line.linePrice ? `+${money(line.linePrice)}` : "$0"}</strong></li>)}</ol>
          {!items.length && <p className="empty-price">Agrega equipos para construir tu distribución.</p>}
          <div className="price-totals"><div><span>Base</span><strong>{money(quote.preset.basePrice)}</strong></div><div><span>Extras</span><strong>{money(quote.extras)}</strong></div><label><span><input type="checkbox" checked={includeIva} onChange={(event) => setIncludeIva(event.target.checked)} /> Incluir IVA (16%)</span><strong>{money(quote.iva)}</strong></label><div className="grand-total"><span>Total estimado</span><strong>{money(quote.total)}</strong></div></div>
          <p className="estimate-note">Estimación comercial basada en medidas y equipamiento. Requiere validación de ingeniería, capacidad, instalaciones, acabados y disponibilidad.</p>
          <a className="button config-continue" href="#enviar-cotizacion">Continuar con mis datos →</a>
        </aside>
      </section>

      <section className="quote-submit no-print" id="enviar-cotizacion">
        <div className="quote-submit-copy"><span className="eyebrow">Termina tu proyecto</span><h2>Recibe una propuesta<br /><em>con tu distribución.</em></h2><p>Guardaremos el plano y enviaremos la cotización preliminar al equipo comercial de FG TOW para revisión.</p><ul><li>Plano 2D y lista de equipos</li><li>Importe aproximado desglosado</li><li>Seguimiento desde contacto@fgtow.com</li></ul></div>
        <form className="quote-customer-form" onSubmit={submitQuote}>
          <div className="form-row"><label>Nombre completo<input name="name" required minLength={2} autoComplete="name" value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} /></label><label>Teléfono<input name="phone" required minLength={7} inputMode="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} /></label></div>
          <div className="form-row"><label>Correo electrónico<input name="email" required type="email" autoComplete="email" value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} /></label><label>Ciudad<input name="city" required value={customer.city} onChange={(event) => setCustomer((current) => ({ ...current, city: event.target.value }))} /></label></div>
          <label>Notas para el equipo<textarea name="notes" rows={4} placeholder="Cuéntanos el uso que le darás, vehículo de arrastre, aditamentos especiales, color o fecha objetivo…" value={customer.notes} onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))} /></label>
          <label className="honeypot" aria-hidden="true">Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label>
          <label className="consent"><input name="consent" value="yes" type="checkbox" required /> Autorizo que FG TOW guarde esta configuración y me contacte para revisar el proyecto.</label>
          <button className="button submit" disabled={sendState === "sending" || layoutErrors.length > 0}>{sendState === "sending" ? "Enviando cotización…" : layoutErrors.length ? "Corrige el plano para enviar" : "Enviar a FG TOW →"}</button>
          <p className={`form-status ${sendState}`} role="status">{sendMessage || "La cifra mostrada es una aproximación y no sustituye la cotización final firmada."}</p>
        </form>
      </section>

      <section className="quote-document" aria-label="Formato imprimible de cotización">
        <div className="document-head"><Image src="/fg-tow-logo.png" alt="FG TOW" width={220} height={68} unoptimized /><div><strong>COTIZACIÓN PRELIMINAR</strong><span>Folio {quoteNumber}</span><span>{new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date())}</span></div></div>
        <div className="document-banner"><div><small>MODELO</small><strong>{meta.shortLabel} {preset.widthCm / 100} × {preset.lengthCm / 100} m</strong></div><div><small>TREN RODANTE</small><strong>{preset.axles === 2 ? "Doble eje" : "1 eje completo"}</strong></div><div><small>TOTAL ESTIMADO</small><strong>{money(quote.total)}</strong></div></div>
        <div className="document-customer"><div><small>CLIENTE</small><strong>{customer.name || "Por completar"}</strong></div><div><small>CONTACTO</small><strong>{customer.phone || customer.email || "Por completar"}</strong></div><div><small>CIUDAD</small><strong>{customer.city || "Por completar"}</strong></div></div>
        <div className="document-plan-wrap"><div><small>PLANO 2D / VISTA SUPERIOR</small><strong>Distribución propuesta por el cliente</strong><span>Las posiciones se revisarán para confirmar circulación, ventilación, instalaciones y balance de peso. Puerta: {WALL_LABEL[door.wall]}, {door.widthCm} cm.</span></div><svg className="document-plan" viewBox={`${-25} ${-60} ${preset.widthCm + 50} ${preset.lengthCm + 85}`} aria-label="Plano incluido en la cotización"><path d={`M ${preset.widthCm / 2 - 38} 0 L ${preset.widthCm / 2} -48 L ${preset.widthCm / 2 + 38} 0`} fill="none" stroke="#0a3550" strokeWidth="4" /><rect x="0" y="0" width={preset.widthCm} height={preset.lengthCm} fill="#f7f8f6" stroke="#0a3550" strokeWidth="5" />{items.map((item, index) => { const definition = getEquipment(item.typeId); if (!definition) return null; return <g key={item.instanceId} transform={`translate(${item.xCm} ${item.yCm})`}><rect width={item.widthCm} height={item.depthCm} rx="2" fill={definition.color} stroke="#0a3550" strokeWidth="1.5" /><text x={item.widthCm / 2} y={item.depthCm / 2} textAnchor="middle" dominantBaseline="middle" className="document-plan-label">{index + 1}</text></g>; })}<line x1={doorGeo.x1} y1={doorGeo.y1} x2={doorGeo.x2} y2={doorGeo.y2} stroke="#d6a229" strokeWidth="6" /></svg></div>
        <div className="document-grid"><div><h3>Especificación base</h3><dl><div><dt>Medidas interiores</dt><dd>{(preset.widthCm / 100).toFixed(2)} × {(preset.lengthCm / 100).toFixed(2)} × {(preset.heightCm / 100).toFixed(2)} m</dd></div><div><dt>Peso estimado</dt><dd>{preset.estimatedWeightKg} kg</dd></div><div><dt>Capacidad de referencia</dt><dd>{preset.estimatedCapacityKg.toLocaleString("es-MX")} kg</dd></div><div><dt>Puerta</dt><dd>{WALL_LABEL[door.wall]} · {door.widthCm} cm</dd></div><div><dt>Elementos colocados</dt><dd>{items.length}</dd></div></dl></div><div><h3>Incluye de base</h3><p>Incluye {meta.includesNote} y hasta {preset.includedEquipment} {meta.equipmentLabel}.</p></div></div>
        <table><thead><tr><th>#</th><th>Equipo / concepto</th><th>Medida</th><th>Importe</th></tr></thead><tbody><tr><td>01</td><td>Remolque base {preset.label}</td><td>{preset.widthCm} × {preset.lengthCm} cm</td><td>{money(preset.basePrice)}</td></tr>{quote.lines.map((line, index) => <tr key={line.item.instanceId}><td>{String(index + 2).padStart(2, "0")}</td><td>{line.definition.name}</td><td>{line.item.widthCm} × {line.item.depthCm} cm</td><td>{line.included ? "Incluido" : line.linePrice ? money(line.linePrice) : "$0"}</td></tr>)}</tbody></table>
        <div className="document-total"><div><span>Subtotal</span><strong>{money(quote.subtotal)}</strong></div><div><span>IVA</span><strong>{money(quote.iva)}</strong></div><div><span>Total estimado</span><strong>{money(quote.total)}</strong></div></div>
        <div className="document-terms"><strong>Alcance de esta estimación</strong><p>Importes en pesos mexicanos. Esta propuesta es orientativa y está sujeta a revisión técnica, distribución de peso, capacidad requerida, especificaciones sanitarias, materiales, acabados, impuestos y disponibilidad. El precio final será confirmado por FG TOW después de revisar el plano.</p></div>
        {customer.notes && <div className="document-notes"><strong>Notas del proyecto</strong><p>{customer.notes}</p></div>}
        <div className="document-footer"><span>FG TOW · Parte de FG PRO</span><span>contacto@fgtow.com · fgtow.com</span></div>
      </section>

      <div className="quote-actions no-print"><button type="button" className="button" onClick={() => window.print()}>Guardar cotización en PDF</button><span>En la ventana de impresión selecciona “Guardar como PDF”.</span></div>
    </>
  );
}
