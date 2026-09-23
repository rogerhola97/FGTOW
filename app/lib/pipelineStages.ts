// Las 5 etapas del CRM de vendedor — sin "use client" a propósito, así lo pueden importar tanto
// componentes de servidor (páginas bajo /vendedor) como componentes de cliente (PipelineStageControl,
// PipelineBoard) sin cruzar el límite RSC solo por una constante.
export type PipelineStage = "cotizacion" | "produccion" | "anticipo" | "pagada" | "entregada";

export const STAGE_LABEL: Record<PipelineStage, string> = {
  cotizacion: "Cotización",
  produccion: "Lista para producción",
  anticipo: "Anticipo pagado",
  pagada: "Pagada",
  entregada: "Entregada",
};

export const STAGE_ORDER: PipelineStage[] = ["cotizacion", "produccion", "anticipo", "pagada", "entregada"];
