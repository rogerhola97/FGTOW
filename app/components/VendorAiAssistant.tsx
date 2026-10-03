"use client";

import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };
const greeting: ChatMessage = { role: "assistant", content: "Hola. Soy el asistente de ventas de FG TOW.\nPuedo ayudarte con precios, modelos, accesorios, cotizaciones, anticipos y mensajes para clientes." };
const suggestions = ["¿Cuánto cuesta el Compact 250?", "¿Qué modelos Food manejamos?", "¿Qué accesorios tenemos?", "Ayúdame a redactar un WhatsApp"];
const errorMessage = "No pude completar la consulta. Intenta nuevamente.";
const maxLength = 4000;

function boldText(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);
}

// Only React text nodes, emphasis and lists. HTML, links and scripts stay text.
function AssistantText({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const listLine = (line: string) => line.match(/^\s*(?:([-*+])|\d+[.)])\s+(.+)$/);
  for (let index = 0; index < lines.length;) {
    if (!lines[index].trim()) { index++; continue; }
    const key = index;
    const match = listLine(lines[index]);
    if (match) {
      const unordered = Boolean(match[1]);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const entry = listLine(lines[index]);
        if (!entry || Boolean(entry[1]) !== unordered) break;
        items.push(<li key={index}>{boldText(entry[2])}</li>); index++;
      }
      blocks.push(unordered ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>);
    } else {
      const paragraph: ReactNode[] = [];
      while (index < lines.length && lines[index].trim() && !listLine(lines[index])) {
        if (paragraph.length) paragraph.push(<br key={`br-${index}`} />);
        paragraph.push(<Fragment key={index}>{boldText(lines[index])}</Fragment>); index++;
      }
      blocks.push(<p key={key}>{paragraph}</p>);
    }
  }
  return <div className="vendor-ai-text">{blocks}</div>;
}

export function VendorAiAssistant() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [copyError, setCopyError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversation = useRef(0);

  useEffect(() => {
    if (open && !pending) input.current?.focus();
  }, [open, pending]);
  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTop = messages.length === 1 ? 0 : log.scrollHeight;
  }, [messages, pending, error, open]);
  useEffect(() => () => {
    activeRequest.current?.abort();
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  function close() { setOpen(false); trigger.current?.focus(); }

  function reset() {
    conversation.current++;
    activeRequest.current?.abort(); activeRequest.current = null;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setMessages([greeting]); setDraft(""); setPending(false); setError(""); setCopied(null); setCopyError("");
    input.current?.focus();
  }

  async function send(text: string) {
    const content = text.trim();
    if (activeRequest.current || content.length < 2 || content.length > maxLength) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setMessages(previous => [...previous, { role: "user", content }]);
    setDraft(""); setError(""); setPending(true);
    try {
      // Each request is independent. The transcript stays local and is never sent.
      const response = await fetch("/api/ai/sales", {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: content, quoteId: null }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true
        || !("message" in result) || typeof result.message !== "string" || !result.message.trim()) throw new Error("Invalid response");
      if (activeRequest.current === controller) setMessages(previous => [...previous, { role: "assistant", content: result.message as string }]);
    } catch {
      if (activeRequest.current === controller) { setError(errorMessage); setDraft(content); }
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setPending(false); }
    }
  }

  async function copy(content: string, index: number) {
    const generation = conversation.current;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(content);
      if (conversation.current !== generation) return;
      if (copyTimer.current) clearTimeout(copyTimer.current);
      setCopied(index); copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      if (conversation.current === generation) setCopyError("No pude copiar la respuesta. Puedes seleccionar el texto y copiarlo.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(draft); }

  return <div className="vendor-ai no-print">
    <button ref={trigger} type="button" className="vendor-ai-trigger" aria-expanded={open} aria-controls={panelId}
      onClick={() => open ? close() : setOpen(true)}><span aria-hidden="true">✨</span> Asistente FG TOW</button>
    {open && <section id={panelId} className="vendor-ai-panel" role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header className="vendor-ai-header">
        <div className="vendor-ai-heading"><span className="vendor-ai-eyebrow">APOYO DE VENTAS</span><h2 id={`${panelId}-title`}>Asistente FG TOW</h2><p>Precios, catálogo, cotizaciones y apoyo de ventas</p></div>
        <button type="button" className="vendor-ai-close" aria-label="Cerrar asistente" onClick={close}>×</button>
        <button type="button" className="vendor-ai-reset" onClick={reset}>Nueva conversación</button>
      </header>
      <div ref={transcript} className="vendor-ai-transcript" role="log" aria-label="Mensajes del asistente" aria-live="polite" aria-relevant="additions" aria-busy={pending}>
        {messages.map((message, index) => <article key={index} className={`vendor-ai-message is-${message.role}`}>
          <span className="vendor-ai-author">{message.role === "user" ? "Tú" : "FG TOW"}</span>
          {message.role === "assistant" ? <AssistantText content={message.content} /> : <p className="vendor-ai-user-text">{message.content}</p>}
          {message.role === "assistant" && <button type="button" className="vendor-ai-copy" onClick={() => void copy(message.content, index)} aria-label={`Copiar respuesta ${index + 1}`}>{copied === index ? "Copiado" : "Copiar"}</button>}
        </article>)}
        {messages.length === 1 && <div className="vendor-ai-suggestions" aria-label="Consultas sugeridas">{suggestions.map(suggestion => <button type="button" key={suggestion} disabled={pending} onClick={() => void send(suggestion)}>{suggestion}<span aria-hidden="true">↗</span></button>)}</div>}
        {pending && <p className="vendor-ai-loading" role="status">Consultando FG TOW...</p>}
        {error && <p className="vendor-ai-error" role="alert">{error}</p>}
      </div>
      <form className="vendor-ai-composer" onSubmit={submit}>
        <label htmlFor={`${panelId}-input`}>Tu consulta</label>
        <textarea ref={input} id={`${panelId}-input`} value={draft} maxLength={maxLength} rows={2} disabled={pending}
          placeholder="Pregunta por un precio, modelo o cotización…" onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }} />
        <div className="vendor-ai-composer-footer"><span>{draft.length.toLocaleString("es-MX")} / 4,000</span><button type="submit" className="button" disabled={pending || draft.trim().length < 2}>Enviar <span aria-hidden="true">→</span></button></div>
        <p className="vendor-ai-note">Cada consulta es independiente. Shift+Enter agrega una línea.</p>
        <span className="vendor-ai-copy-status" role="status">{copied !== null ? "Respuesta copiada." : copyError}</span>
      </form>
    </section>}
  </div>;
}
