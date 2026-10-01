"use client";

export function PrintDocumentButton({ label = "Imprimir / guardar PDF" }: { label?: string }) {
  return <button type="button" className="button" onClick={() => window.print()}>{label}</button>;
}
