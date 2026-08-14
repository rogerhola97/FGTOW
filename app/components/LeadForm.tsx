"use client";

import { FormEvent, useState } from "react";

export function LeadForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("sending");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("No enviado");
      form.reset(); setState("sent");
    } catch { setState("error"); }
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <div className="form-row"><label>Nombre completo<input name="name" required minLength={2} autoComplete="name" /></label><label>Teléfono<input name="phone" required inputMode="tel" autoComplete="tel" /></label></div>
      <div className="form-row"><label>Correo electrónico<input name="email" type="email" autoComplete="email" /></label><label>Ciudad<input name="city" required defaultValue="Monterrey, N.L." /></label></div>
      <div className="form-row"><label>¿Qué necesitas?<select name="productType" required defaultValue=""><option value="" disabled>Selecciona una opción</option><option>Plataforma / carga</option><option>Cuatrimoto / motocicletas</option><option>RZR / Can-Am / UTV</option><option>Food truck</option><option>Proyecto especial</option></select></label><label>Presupuesto estimado<select name="budget" defaultValue="Por definir"><option>Por definir</option><option>Hasta $50,000</option><option>$50,000 – $100,000</option><option>$100,000 – $200,000</option><option>Más de $200,000</option></select></label></div>
      <label>Cuéntanos sobre tu proyecto<textarea name="message" required rows={4} placeholder="Qué vas a transportar, medidas aproximadas, equipamiento o fecha que tienes en mente…" /></label>
      <label className="honeypot" aria-hidden="true">Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent"><input type="checkbox" name="consent" value="yes" required /> Autorizo que FG TOW me contacte para atender esta solicitud.</label>
      <button className="button submit" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Solicitar cotización →"}</button>
      <p className={`form-status ${state}`} role="status">{state === "sent" ? "Recibimos tu proyecto. Te contactaremos para continuar." : state === "error" ? "No pudimos enviar el formulario. Intenta de nuevo en unos minutos." : "Tus datos se usan únicamente para dar seguimiento a tu cotización."}</p>
    </form>
  );
}
