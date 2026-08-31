"use client";

import { FormEvent, useState } from "react";

export function VendorLoginForm({ returnTo }: { returnTo: string }) {
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending"); setMessage("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/vendedor/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible iniciar sesión.");
      window.location.href = returnTo;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No fue posible iniciar sesión.");
    }
  }

  return (
    <form className="lead-form vendor-login-form" onSubmit={submit}>
      <label>Correo electrónico<input name="email" type="email" required autoComplete="email" /></label>
      <label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>
      <button className="button submit" disabled={state === "sending"}>{state === "sending" ? "Entrando…" : "Entrar →"}</button>
      {state === "error" && <p className="form-status error" role="status">{message}</p>}
    </form>
  );
}
