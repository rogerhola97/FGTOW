"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Botón de eliminar para /vendedor/clientes y /vendedor/clientes/[id]. La confirmación es un
// window.confirm() nativo a propósito: es una acción destructiva de un solo paso y no amerita un
// modal propio en este panel interno.
export function DeleteQuoteButton({ id, quoteNumber, redirectTo }: { id: number; quoteNumber: string; redirectTo?: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (deleting) return;
    if (!window.confirm(`¿Seguro que quieres eliminar la cotización ${quoteNumber}? Esta acción no se puede deshacer.`)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/vendedor/quotes/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || "No fue posible eliminar la cotización.");
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible eliminar la cotización.");
      setDeleting(false);
    }
  }

  return (
    <button type="button" className="button button-small button-danger" onClick={handleDelete} disabled={deleting}>
      {deleting ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
