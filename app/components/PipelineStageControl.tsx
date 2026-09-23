"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PipelineStage, STAGE_LABEL, STAGE_ORDER } from "../lib/pipelineStages";

export type { PipelineStage };
export { STAGE_LABEL, STAGE_ORDER };

// Selector de etapa del pipeline — se usa en la ficha de una cotización y en cada tarjeta del
// tablero /vendedor/crm. Sin restricción de transición a propósito: un vendedor puede regresar una
// tarjeta (p.ej. un anticipo que se canceló) sin depender de nadie más.
export function PipelineStageControl({ id, stage, onChanged }: { id: number; stage: PipelineStage; onChanged?: (stage: PipelineStage) => void }) {
  const [current, setCurrent] = useState(stage);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange(next: PipelineStage) {
    if (next === current || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/vendedor/quotes/${id}/stage`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No fue posible mover la cotización.");
      setCurrent(next);
      onChanged?.(next);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible mover la cotización.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <select className={`pipeline-stage-select stage-${current}`} value={current} disabled={saving} onChange={(event) => handleChange(event.target.value as PipelineStage)}>
      {STAGE_ORDER.map((value) => <option key={value} value={value}>{STAGE_LABEL[value]}</option>)}
    </select>
  );
}
