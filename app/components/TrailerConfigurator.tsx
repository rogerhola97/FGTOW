"use client";

import Image from "next/image";
import { FormEvent, PointerEvent, useMemo, useRef, useState } from "react";
import {
  EQUIPMENT,
  PlacedEquipment,
  TRAILER_PRESETS,
  calculateQuote,
  getEquipment,
  getPreset,
  money,
  validateLayout,
} from "../lib/quoteCatalog";

type SendState = "idle" | "sending" | "sent" | "error";
type DragState = { instanceId: string; offsetX: number; offsetY: number; pointerId: number } | null;

const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function overlaps(a: PlacedEquipment, b: PlacedEquipment) {
  return a.xCm < b.xCm + b.widthCm && a.xCm + a.widthCm > b.xCm && a.yCm < b.yCm + b.depthCm && a.yCm + a.depthCm > b.yCm;
}

function starterLayout(): PlacedEquipment[] {
  return [
    { instanceId: uid(), typeId: "plancha", xCm: 0, yCm: 18, widthCm: 50, depthCm: 90, rotation: 90 },
    { instanceId: uid(), typeId: "bano-maria", xCm: 0, yCm: 116, widthCm: 50, depthCm: 90, rotation: 90 },
    { instanceId: uid(), typeId: "freidora", xCm: 0, yCm: 214, widthCm: 40, depthCm: 40, rotation: 0 },
    { instanceId: uid(), typeId: "parrilla", xCm: 150, yCm: 18, widthCm: 50, depthCm: 50, rotation: 0 },
    { instanceId: uid(), typeId: "mesa", xCm: 150, yCm: 76, widthCm: 50, depthCm: 120, rotation: 90 },
    { instanceId: uid(), typeId: "tarja", xCm: 160, yCm: 214, widthCm: 40, depthCm: 40, rotation: 0 },
  ];
}

export function TrailerConfigurator() {
  const [presetId, setPresetId] = useState("ft-200-300");
  const [items, setItems] = useState<PlacedEquipment[]>(starterLayout);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [includeIva, setIncludeIva] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendMessage, setSendMessage] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("BORRADOR");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", city: "Monterrey, N.L.", notes: "" });
  const svgRef = useRef<SVGSVGElement>(null);

  const preset = getPreset(presetId);
  const quote = useMemo(() => calculateQuote(presetId, items, includeIva), [presetId, items, includeIva]);
  const layoutErrors = useMemo(() => validateLayout(preset, items), [preset, items]);
  const selected = items.find((item) => item.instanceId === selectedId) ?? null;
  const selectedDefinition = selected ? getEquipment(selected.typeId) : null;
  const selectedWidthLimits = selected && selectedDefinition ? { min: selected.rotation === 90 ? selectedDefinition.minDepthCm : selectedDefinition.minWidthCm, max: selected.rotation === 90 ? selectedDefinition.maxDepthCm : selectedDefinition.maxWidthCm } : null;
  const selectedDepthLimits = selected && selectedDefinition ? { min: selected.rotation === 90 ? selectedDefinition.minWidthCm : selectedDefinition.minDepthCm, max: selected.rotation === 90 ? selectedDefinition.maxWidthCm : selectedDefinition.maxDepthCm } : null;
  const collisionIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) if (overlaps(items[i], items[j])) {
      ids.add(items[i].instanceId); ids.add(items[j].instanceId);
    }
    return ids;
  }, [items]);

  function updatePreset(nextId: string) {
    const next = getPreset(nextId);
    setPresetId(nextId);
    setItems((current) => current.map((item) => ({
      ...item,
      widthCm: Math.min(item.widthCm, next.widthCm),
      depthCm: Math.min(item.depthCm, next.lengthCm),
      xCm: clamp(item.xCm, 0, Math.max(0, next.widthCm - Math.min(item.widthCm, next.widthCm))),
      yCm: clamp(item.yCm, 0, Math.max(0, next.lengthCm - Math.min(item.depthCm, next.lengthCm))),
    })));
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function findOpenSpot(widthCm: number, depthCm: number) {
    for (let y = 8; y <= preset.lengthCm - depthCm; y += 10) {
      for (let x = 0; x <= preset.widthCm - widthCm; x += 10) {
        const candidate: PlacedEquipment = { instanceId: "candidate", typeId: "", xCm: x, yCm: y, widthCm, depthCm, rotation: 0 };
        if (!items.some((item) => overlaps(candidate, item))) return { x, y };
      }
    }
    return { x: Math.max(0, (preset.widthCm - widthCm) / 2), y: Math.max(0, (preset.lengthCm - depthCm) / 2) };
  }

  function addEquipment(typeId: string) {
    const definition = getEquipment(typeId);
    if (!definition) return;
    let widthCm = definition.widthCm;
    let depthCm = definition.depthCm;
    let rotation: 0 | 90 = 0;
    if (widthCm > preset.widthCm && depthCm <= preset.widthCm && widthCm <= preset.lengthCm) {
      [widthCm, depthCm] = [depthCm, widthCm]; rotation = 90;
    }
    widthCm = Math.min(widthCm, preset.widthCm);
    depthCm = Math.min(depthCm, preset.lengthCm);
    const position = findOpenSpot(widthCm, depthCm);
    const next = { instanceId: uid(), typeId, xCm: position.x, yCm: position.y, widthCm, depthCm, rotation };
    setItems((current) => [...current, next]);
    setSelectedId(next.instanceId);
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function updateItem(instanceId: string, changes: Partial<PlacedEquipment>) {
    setItems((current) => current.map((item) => {
      if (item.instanceId !== instanceId) return item;
      const widthCm = changes.widthCm ?? item.widthCm;
      const depthCm = changes.depthCm ?? item.depthCm;
      return {
        ...item,
        ...changes,
        widthCm,
        depthCm,
        xCm: clamp(changes.xCm ?? item.xCm, 0, Math.max(0, preset.widthCm - widthCm)),
        yCm: clamp(changes.yCm ?? item.yCm, 0, Math.max(0, preset.lengthCm - depthCm)),
      };
    }));
    setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function rotateSelected() {
    if (!selected) return;
    updateItem(selected.instanceId, { widthCm: selected.depthCm, depthCm: selected.widthCm, rotation: selected.rotation === 0 ? 90 : 0 });
  }

  function removeSelected() {
    if (!selectedId) return;
    setItems((current) => current.filter((item) => item.instanceId !== selectedId));
    setSelectedId(null); setSendState("idle"); setQuoteNumber("BORRADOR");
  }

  function pointInPlan(event: PointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function startDrag(event: PointerEvent<SVGGElement>, item: PlacedEquipment) {
    event.preventDefault(); event.stopPropagation();
    const point = pointInPlan(event);
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectedId(item.instanceId);
    setDrag({ instanceId: item.instanceId, offsetX: point.x - item.xCm, offsetY: point.y - item.yCm, pointerId: event.pointerId });
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const item = items.find((candidate) => candidate.instanceId === drag.instanceId);
    if (!item) return;
    const point = pointInPlan(event);
    updateItem(item.instanceId, { xCm: Math.round(point.x - drag.offsetX), yCm: Math.round(point.y - drag.offsetY) });
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
        body: JSON.stringify({ ...values, presetId, items, includeIva }),
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

  return (
    <>
      <section className="configurator-intro no-print">
        <span className="eyebrow">Cotizador interactivo FG TOW</span>
        <h1>Diseña tu food trailer<br /><em>sobre un plano real.</em></h1>
        <p>Elige una medida, agrega equipos y arrástralos dentro del remolque. La plataforma evita que salgan de los límites y detecta cruces antes de enviar el proyecto.</p>
        <div className="source-badges"><span>Medidas desde 1.80 × 2.00 m</span><span>1 o 2 ejes</span><span>Precios aproximados MXN</span></div>
      </section>

      <section className="configurator-shell no-print">
        <aside className="config-sidebar">
          <div className="config-step"><span>01</span><div><strong>Medida del remolque</strong><small>Dimensiones interiores de trabajo</small></div></div>
          <label className="config-select">Modelo base<select value={presetId} onChange={(event) => updatePreset(event.target.value)}>{TRAILER_PRESETS.map((option) => <option key={option.id} value={option.id}>{option.label} · {money(option.basePrice)}</option>)}</select></label>
          <div className="preset-facts"><div><small>Altura</small><strong>{(preset.heightCm / 100).toFixed(2)} m</strong></div><div><small>Tren rodante</small><strong>{preset.axles === 2 ? "Doble eje" : "1 eje"}</strong></div><div><small>Peso est.</small><strong>{preset.estimatedWeightKg} kg</strong></div><div><small>Carga ref.</small><strong>{preset.estimatedCapacityKg.toLocaleString("es-MX")} kg</strong></div></div>

          <div className="config-step equipment-heading"><span>02</span><div><strong>Equipamiento</strong><small>Toca para añadir al plano</small></div></div>
          <div className="equipment-library">{EQUIPMENT.map((equipment) => <button type="button" key={equipment.id} onClick={() => addEquipment(equipment.id)}><i style={{ background: equipment.color }} /><span><strong>{equipment.name}</strong><small>{equipment.widthCm} × {equipment.depthCm} cm {equipment.surcharge ? `· +${money(equipment.surcharge)}` : ""}</small></span><b>+</b></button>)}</div>
        </aside>

        <div className="plan-workspace">
          <div className="workspace-head"><div><span>PLANO / VISTA SUPERIOR</span><strong>{preset.label}</strong></div><div className="plan-legend"><span><i className="ok" /> Disponible</span><span><i className="danger" /> Cruce</span></div></div>
          <div className="plan-scroll">
            <svg
              ref={svgRef}
              className="trailer-plan"
              viewBox={`${-35} ${-80} ${preset.widthCm + 70} ${preset.lengthCm + 120}`}
              role="img"
              aria-label={`Plano editable de remolque de ${preset.widthCm} por ${preset.lengthCm} centímetros`}
              onPointerMove={moveDrag}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onPointerDown={() => setSelectedId(null)}
            >
              <defs><pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dce5e5" strokeWidth="0.7" /></pattern><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#smallGrid)" /><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#b9c9cc" strokeWidth="1.3" /></pattern></defs>
              <path d={`M ${preset.widthCm / 2 - 45} 0 L ${preset.widthCm / 2} -65 L ${preset.widthCm / 2 + 45} 0`} fill="none" stroke="#0a3550" strokeWidth="4" />
              <circle cx={preset.widthCm / 2} cy="-66" r="6" fill="#fff" stroke="#0a3550" strokeWidth="3" />
              <rect x="0" y="0" width={preset.widthCm} height={preset.lengthCm} rx="3" fill="url(#grid)" stroke="#0a3550" strokeWidth="5" />
              <rect x="-23" y={preset.lengthCm * .52} width="23" height={preset.axles === 2 ? 76 : 45} rx="6" fill="#092f46" />
              <rect x={preset.widthCm} y={preset.lengthCm * .52} width="23" height={preset.axles === 2 ? 76 : 45} rx="6" fill="#092f46" />
              <text x={preset.widthCm / 2} y="-17" textAnchor="middle" className="plan-label">FRENTE / TIRÓN</text>
              <text x={preset.widthCm / 2} y={preset.lengthCm + 28} textAnchor="middle" className="plan-measure">ANCHO {(preset.widthCm / 100).toFixed(2)} m</text>
              <text x="-27" y={preset.lengthCm / 2} transform={`rotate(-90 -27 ${preset.lengthCm / 2})`} textAnchor="middle" className="plan-measure">LARGO {(preset.lengthCm / 100).toFixed(2)} m</text>
              <line x1={preset.widthCm / 2} x2={preset.widthCm / 2} y1="8" y2={preset.lengthCm - 8} stroke="#d6a229" strokeDasharray="7 6" strokeWidth="1.5" opacity=".7" />
              {items.map((item, index) => {
                const definition = getEquipment(item.typeId);
                if (!definition) return null;
                const bad = collisionIds.has(item.instanceId);
                const active = selectedId === item.instanceId;
                return <g key={item.instanceId} transform={`translate(${item.xCm} ${item.yCm})`} className={`plan-item ${bad ? "collision" : ""} ${active ? "selected" : ""}`} onPointerDown={(event) => startDrag(event, item)}>
                  <rect width={item.widthCm} height={item.depthCm} rx="3" fill={definition.color} fillOpacity=".92" />
                  <rect width={item.widthCm} height={item.depthCm} rx="3" fill="none" stroke={bad ? "#b3261e" : active ? "#fff" : "#0a3550"} strokeWidth={active ? 4 : 2} />
                  <text x={item.widthCm / 2} y={item.depthCm / 2 - 4} textAnchor="middle" className="item-label"><tspan x={item.widthCm / 2}>{index + 1}. {definition.shortName}</tspan><tspan x={item.widthCm / 2} dy="13">{item.widthCm} × {item.depthCm} cm</tspan></text>
                </g>;
              })}
            </svg>
          </div>

          <div className={`layout-status ${layoutErrors.length ? "has-errors" : "ready"}`}><strong>{layoutErrors.length ? `${layoutErrors.length} ajuste${layoutErrors.length > 1 ? "s" : ""} pendiente${layoutErrors.length > 1 ? "s" : ""}` : "Distribución lista para cotizar"}</strong><span>{layoutErrors[0] ?? "Todos los equipos están dentro del remolque y sin cruces."}</span></div>

          {selected && selectedDefinition && selectedWidthLimits && selectedDepthLimits ? <div className="item-editor"><div><span>ELEMENTO SELECCIONADO</span><strong>{selectedDefinition.name}</strong><small>{selectedDefinition.description}</small></div><label>Ancho<input type="number" min={selectedWidthLimits.min} max={Math.min(selectedWidthLimits.max, preset.widthCm)} value={selected.widthCm} onChange={(event) => updateItem(selected.instanceId, { widthCm: Number(event.target.value) })} /><b>cm</b></label><label>Fondo<input type="number" min={selectedDepthLimits.min} max={Math.min(selectedDepthLimits.max, preset.lengthCm)} value={selected.depthCm} onChange={(event) => updateItem(selected.instanceId, { depthCm: Number(event.target.value) })} /><b>cm</b></label><button type="button" onClick={rotateSelected}>Girar 90°</button><button type="button" className="danger-button" onClick={removeSelected}>Eliminar</button></div> : <div className="item-editor empty"><span>Selecciona un elemento del plano para ajustar su medida, girarlo o eliminarlo.</span></div>}
        </div>

        <aside className="price-panel">
          <div className="config-step"><span>03</span><div><strong>Cotización estimada</strong><small>Actualizada en tiempo real</small></div></div>
          <div className="price-base"><small>Remolque base</small><strong>{money(quote.preset.basePrice)}</strong><span>Incluye estructura, chasis, laminado, tren rodante, instalación base y hasta {quote.preset.includedEquipment} equipos principales.</span></div>
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
          <label>Notas para el equipo<textarea name="notes" rows={4} placeholder="Cuéntanos qué venderás, tipo de gas, equipos especiales, color o fecha objetivo…" value={customer.notes} onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))} /></label>
          <label className="honeypot" aria-hidden="true">Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label>
          <label className="consent"><input name="consent" value="yes" type="checkbox" required /> Autorizo que FG TOW guarde esta configuración y me contacte para revisar el proyecto.</label>
          <button className="button submit" disabled={sendState === "sending" || layoutErrors.length > 0}>{sendState === "sending" ? "Enviando cotización…" : layoutErrors.length ? "Corrige el plano para enviar" : "Enviar a FG TOW →"}</button>
          <p className={`form-status ${sendState}`} role="status">{sendMessage || "La cifra mostrada es una aproximación y no sustituye la cotización final firmada."}</p>
        </form>
      </section>

      <section className="quote-document" aria-label="Formato imprimible de cotización">
        <div className="document-head"><Image src="/fg-tow-logo.png" alt="FG TOW" width={220} height={68} unoptimized /><div><strong>COTIZACIÓN PRELIMINAR</strong><span>Folio {quoteNumber}</span><span>{new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date())}</span></div></div>
        <div className="document-banner"><div><small>MODELO</small><strong>Food Trailer {preset.widthCm / 100} × {preset.lengthCm / 100} m</strong></div><div><small>TREN RODANTE</small><strong>{preset.axles === 2 ? "Doble eje" : "1 eje completo"}</strong></div><div><small>TOTAL ESTIMADO</small><strong>{money(quote.total)}</strong></div></div>
        <div className="document-customer"><div><small>CLIENTE</small><strong>{customer.name || "Por completar"}</strong></div><div><small>CONTACTO</small><strong>{customer.phone || customer.email || "Por completar"}</strong></div><div><small>CIUDAD</small><strong>{customer.city || "Por completar"}</strong></div></div>
        <div className="document-plan-wrap"><div><small>PLANO 2D / VISTA SUPERIOR</small><strong>Distribución propuesta por el cliente</strong><span>Las posiciones se revisarán para confirmar circulación, ventilación, instalaciones y balance de peso.</span></div><svg className="document-plan" viewBox={`${-25} ${-60} ${preset.widthCm + 50} ${preset.lengthCm + 85}`} aria-label="Plano incluido en la cotización"><path d={`M ${preset.widthCm / 2 - 38} 0 L ${preset.widthCm / 2} -48 L ${preset.widthCm / 2 + 38} 0`} fill="none" stroke="#0a3550" strokeWidth="4" /><rect x="0" y="0" width={preset.widthCm} height={preset.lengthCm} fill="#f7f8f6" stroke="#0a3550" strokeWidth="5" />{items.map((item, index) => { const definition = getEquipment(item.typeId); if (!definition) return null; return <g key={item.instanceId} transform={`translate(${item.xCm} ${item.yCm})`}><rect width={item.widthCm} height={item.depthCm} rx="2" fill={definition.color} stroke="#0a3550" strokeWidth="1.5" /><text x={item.widthCm / 2} y={item.depthCm / 2} textAnchor="middle" dominantBaseline="middle" className="document-plan-label">{index + 1}</text></g>; })}</svg></div>
        <div className="document-grid"><div><h3>Especificación base</h3><dl><div><dt>Medidas interiores</dt><dd>{(preset.widthCm / 100).toFixed(2)} × {(preset.lengthCm / 100).toFixed(2)} × {(preset.heightCm / 100).toFixed(2)} m</dd></div><div><dt>Peso estimado</dt><dd>{preset.estimatedWeightKg} kg</dd></div><div><dt>Capacidad de referencia</dt><dd>{preset.estimatedCapacityKg.toLocaleString("es-MX")} kg</dd></div><div><dt>Equipos colocados</dt><dd>{items.length}</dd></div></dl></div><div><h3>Incluye de base</h3><p>Chasis y estructura, piso antiderrapante, laminado interior/exterior, tirón, cadenas, luces, instalación eléctrica y de gas base, superficies de trabajo y hasta {preset.includedEquipment} equipos principales.</p></div></div>
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
