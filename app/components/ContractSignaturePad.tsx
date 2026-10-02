"use client";

import { useRouter } from "next/navigation";
import { PointerEvent, useEffect, useRef, useState } from "react";
import type { DocumentSignature, QuoteDocumentsData, SignatureRole } from "../lib/quoteDocuments";

type PadState = "idle" | "saving" | "error";

const ROLE_LABEL: Record<SignatureRole, string> = { customer: "Firma del cliente", seller: "Firma del vendedor" };
const CANVAS_HEIGHT = 180;

function signedAtLabel(signature: DocumentSignature) {
  const date = new Date(signature.signedAt);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SignaturePad({ quoteId, role, signerName, signature }: { quoteId: number; role: SignatureRole; signerName: string; signature: DocumentSignature | null }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [editing, setEditing] = useState(!signature);
  const [state, setState] = useState<PadState>("idle");
  const [message, setMessage] = useState("");

  // El canvas se dimensiona al ancho real en pantalla y a la densidad del dispositivo para que el
  // trazo salga nítido en celulares/tabletas de alta resolución.
  useEffect(() => {
    if (!editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = canvas.clientWidth;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(CANVAS_HEIGHT * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#0a2233";
      setHasInk(false);
    };
    resize();
    let lastWidth = canvas.clientWidth;
    const observer = new ResizeObserver(() => {
      if (canvas.clientWidth === lastWidth) return;
      lastWidth = canvas.clientWidth;
      resize();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [editing]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function lineWidth(event: PointerEvent<HTMLCanvasElement>) {
    // Lápices con presión varían el grosor; mouse y dedo reportan 0.5 o 0 y usan el grosor base.
    return event.pointerType === "pen" && event.pressure > 0 ? 1.2 + event.pressure * 2.6 : 2.4;
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const current = point(event);
    lastPoint.current = current;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    context.beginPath();
    context.fillStyle = "#0a2233";
    context.arc(current.x, current.y, lineWidth(event) / 2, 0, Math.PI * 2);
    context.fill();
    setHasInk(true);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPoint.current) return;
    event.preventDefault();
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const events = typeof event.nativeEvent.getCoalescedEvents === "function" ? event.nativeEvent.getCoalescedEvents() : [];
    const rect = event.currentTarget.getBoundingClientRect();
    const points = events.length ? events.map((item) => ({ x: item.clientX - rect.left, y: item.clientY - rect.top })) : [point(event)];
    context.lineWidth = lineWidth(event);
    context.beginPath();
    context.moveTo(lastPoint.current.x, lastPoint.current.y);
    for (const next of points) context.lineTo(next.x, next.y);
    context.stroke();
    lastPoint.current = points[points.length - 1];
  }

  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    setHasInk(false);
    setMessage("");
  }

  async function send(image: string | null) {
    setState("saving");
    setMessage(image ? "Guardando firma…" : "Eliminando firma…");
    try {
      const response = await fetch(`/api/vendedor/quotes/${quoteId}/signatures`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, image }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible guardar la firma.");
      setState("idle");
      setMessage(image ? "Firma guardada en el contrato." : "Firma eliminada.");
      setEditing(!image);
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No fue posible guardar la firma.");
    }
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    void send(canvas.toDataURL("image/png"));
  }

  return <div className="contract-signature-pad">
    <div className="contract-signature-pad-head"><strong>{ROLE_LABEL[role]}</strong><span>{signerName}</span></div>
    {editing ? <>
      <canvas
        ref={canvasRef}
        className="contract-signature-canvas"
        style={{ height: CANVAS_HEIGHT }}
        aria-label={`${ROLE_LABEL[role]}: dibuja la firma con el dedo, lápiz o mouse`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onContextMenu={(event) => event.preventDefault()}
      />
      <p className="contract-signature-hint">Firma dentro del recuadro con el dedo, lápiz o mouse.</p>
      <div className="contract-signature-actions">
        <button type="button" className="button button-outline button-small" onClick={clear} disabled={!hasInk || state === "saving"}>Limpiar</button>
        {signature && <button type="button" className="button button-outline button-small" onClick={() => { setEditing(false); setMessage(""); }} disabled={state === "saving"}>Cancelar</button>}
        <button type="button" className="button button-small" onClick={save} disabled={!hasInk || state === "saving"}>{state === "saving" ? "Guardando…" : "Guardar firma"}</button>
      </div>
    </> : signature && <>
      {/* eslint-disable-next-line @next/next/no-img-element -- firma en data URL. */}
      <img className="contract-signature-saved" src={signature.image} alt={`${ROLE_LABEL[role]} guardada`} />
      <p className="contract-signature-hint">Firmado {signedAtLabel(signature)}</p>
      <div className="contract-signature-actions">
        <button type="button" className="button button-outline button-small" onClick={() => { setEditing(true); setMessage(""); }} disabled={state === "saving"}>Volver a firmar</button>
        <button type="button" className="button button-outline button-small" onClick={() => void send(null)} disabled={state === "saving"}>Eliminar firma</button>
      </div>
    </>}
    {message && <p className={`form-status ${state}`} role="status">{message}</p>}
  </div>;
}

export function ContractSignaturePanel({ quoteId, customerName, sellerName, signatures }: { quoteId: number; customerName: string; sellerName: string; signatures: QuoteDocumentsData["signatures"] }) {
  return <section className="contract-signature-panel no-print" aria-labelledby="contract-signature-title">
    <div className="contract-signature-panel-head">
      <h2 id="contract-signature-title">Firma digital del contrato</h2>
      <p>Funciona en celular, tableta o computadora. Las firmas guardadas aparecen en todas las hojas del contrato.</p>
    </div>
    <div className="contract-signature-grid">
      <SignaturePad quoteId={quoteId} role="customer" signerName={customerName} signature={signatures.customer} />
      <SignaturePad quoteId={quoteId} role="seller" signerName={sellerName || "Vendedor"} signature={signatures.seller} />
    </div>
  </section>;
}
