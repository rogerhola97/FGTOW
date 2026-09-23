import { PipelineStage, getQuoteById, updateQuoteStage } from "../../../../../lib/quotesDb";
import { getVendor } from "../../../../../lib/vendorAuth";

const STAGES: PipelineStage[] = ["cotizacion", "produccion", "anticipo", "pagada", "entregada"];

// Mueve una cotización entre las 5 columnas del tablero de /vendedor/crm. Sin transición
// restringida a propósito: un vendedor puede regresar una tarjeta (p.ej. un anticipo que se
// canceló) sin tener que pedirle a nadie que la "desbloquee".
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Cotización inválida." }, { status: 400 });

  try {
    const payload = (await request.json()) as { stage?: string };
    if (!STAGES.includes(payload.stage as PipelineStage)) return Response.json({ error: "Etapa inválida." }, { status: 400 });

    const existing = await getQuoteById(id);
    if (!existing) return Response.json({ error: "La cotización no existe." }, { status: 404 });

    const result = await updateQuoteStage(id, payload.stage as PipelineStage);
    if (!result.ok) throw new Error("No fue posible mover la cotización.");

    return Response.json({ ok: true, row: result.row }, { status: 200 });
  } catch (error) {
    console.error("Error al mover una cotización de etapa:", error);
    return Response.json({ error: "No fue posible mover la cotización. Intenta de nuevo." }, { status: 500 });
  }
}
