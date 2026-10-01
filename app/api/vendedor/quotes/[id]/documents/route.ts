import { getQuoteById, patchQuoteById } from "../../../../../lib/quotesDb";
import { resolveQuoteDocumentsData } from "../../../../../lib/quoteDocuments";
import { getVendor } from "../../../../../lib/vendorAuth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Cotización inválida." }, { status: 400 });

  try {
    const quote = await getQuoteById(id);
    if (!quote) return Response.json({ error: "La cotización no existe." }, { status: 404 });

    const payload = await request.json() as unknown;
    const documentData = resolveQuoteDocumentsData(quote, payload);
    documentData.updatedAt = new Date().toISOString();

    const result = await patchQuoteById(id, {
      document_data: documentData,
      vendor_email: vendor.email,
      vendor_edited: true,
      updated_at: new Date().toISOString(),
    });
    if (!result.ok) throw new Error(result.error || "No fue posible guardar los documentos.");

    return Response.json({ ok: true, documentData }, { status: 200 });
  } catch (error) {
    console.error("Error al guardar los documentos de la cotización:", error);
    return Response.json({ error: "No fue posible guardar los documentos. Revisa que la actualización de Supabase esté aplicada." }, { status: 500 });
  }
}
