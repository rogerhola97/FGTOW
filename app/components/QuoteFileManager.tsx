"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ManagedFile = { path: string; name: string; uploadedAt: string; url: string | null };

const dateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

// Gestor de archivos genérico para facturas y fotos de entrega en la ficha de una cotización
// (/vendedor/clientes/[id]) — sube/lista/borra contra /api/vendedor/quotes/[id]/files. La imagen
// de referencia del cliente vive dentro del propio TrailerConfigurator (junto al panel de precio,
// donde tiene más contexto mientras se arma la cotización), no aquí.
export function QuoteFileManager({ quoteId, kind, title, hint, accept, initialFiles }: {
  quoteId: number;
  kind: "invoice" | "delivery";
  title: string;
  hint: string;
  accept: string;
  initialFiles: ManagedFile[];
}) {
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function upload(file: File) {
    setUploading(true); setError("");
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch(`/api/vendedor/quotes/${quoteId}/files`, { method: "POST", body: form });
      const result = (await response.json()) as { error?: string; file?: ManagedFile };
      if (!response.ok || !result.file) throw new Error(result.error || "No fue posible subir el archivo.");
      setFiles((current) => [...current, { ...result.file!, url: null }]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(path: string) {
    setUploading(true); setError("");
    try {
      const response = await fetch(`/api/vendedor/quotes/${quoteId}/files`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, path }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible borrar el archivo.");
      setFiles((current) => current.filter((entry) => entry.path !== path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible borrar el archivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="quote-file-manager">
      <div className="quote-file-manager-head"><strong>{title}</strong><span>{hint}</span></div>
      {files.length > 0 && (
        <ul className="quote-file-list">
          {files.map((file) => (
            <li key={file.path}>
              {file.url ? <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a> : <span>{file.name}</span>}
              <small>{dateFormatter.format(new Date(file.uploadedAt))}</small>
              <button type="button" className="button-small button-danger" disabled={uploading} onClick={() => remove(file.path)}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      <input type="file" accept={accept} disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />
      {error && <p className="form-status error">{error}</p>}
    </div>
  );
}
