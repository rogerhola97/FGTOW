"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PipelineStage, PipelineStageControl, STAGE_LABEL, STAGE_ORDER } from "./PipelineStageControl";

export type BoardQuote = {
  id: number;
  quote_number: string;
  name: string;
  model: string;
  total: number;
  pipeline_stage: PipelineStage;
  version: number;
};

const moneyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const MODEL_SHORT_LABEL: Record<string, string> = { food: "Food Trailer", cargo: "Cargo", rzr: "RZR Sport" };

export function PipelineBoard({ quotes }: { quotes: BoardQuote[] }) {
  const columns = useMemo(() => {
    const grouped: Record<PipelineStage, BoardQuote[]> = { cotizacion: [], produccion: [], anticipo: [], pagada: [], entregada: [] };
    for (const quote of quotes) grouped[quote.pipeline_stage]?.push(quote);
    return grouped;
  }, [quotes]);

  return (
    <div className="pipeline-board">
      {STAGE_ORDER.map((stage) => {
        const items = columns[stage];
        const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
        return (
          <div className={`pipeline-column stage-${stage}`} key={stage}>
            <div className="pipeline-column-head">
              <strong>{STAGE_LABEL[stage]}</strong>
              <span>{items.length} · {moneyFormatter.format(total)}</span>
            </div>
            <div className="pipeline-column-body">
              {items.length === 0 && <p className="pipeline-column-empty">Sin cotizaciones aquí.</p>}
              {items.map((quote) => (
                <div className="pipeline-card" key={quote.id}>
                  <Link href={`/vendedor/clientes/${quote.id}`}><strong>{quote.name}</strong><span>{quote.quote_number}{quote.version > 1 ? ` · v${quote.version}` : ""}</span></Link>
                  <span className="pipeline-card-model">{MODEL_SHORT_LABEL[quote.model] ?? quote.model}</span>
                  <strong className="pipeline-card-total">{moneyFormatter.format(Number(quote.total))}</strong>
                  <PipelineStageControl id={quote.id} stage={quote.pipeline_stage} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
