import { getQuoteById, patchQuoteById } from "../../../../../lib/quotesDb";
import { isValidSignatureImage, resolveQuoteDocumentsData, type SignatureRole } from "../../../../../lib/quoteDocuments";
import { getVendor } from "../../../../../lib/vendorAuth";

const ROLES: SignatureRole[] = ["customer", "seller"];

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Cotización inválida." }, { status: 400 });

  const payload = await request.json().catch(() => null) as { role?: unknown; image?: unknown } | null;
  const role = payload?.role as SignatureRole;
  if (!ROLES.includes(role)) return Response.json({ error: "Firma inválida." }, { status: 400 });
  if (payload?.image !== null && !isValidSignatureImage(payload?.image)) return Response.json({ error: "La imagen de la firma no es válida o es demasiado grande." }, { status: 400 });

  try {
    const quote = await getQuoteById(id);
    if (!quote) return Response.json({ error: "La cotización no existe." }, { status: 404 });

    const documentData = resolveQuoteDocumentsData(quote, quote.document_data, { sellerName: vendor.name });
    const signerName = role === "customer" ? quote.name : documentData.vehicle.sellerName || vendor.name;
    documentData.signatures = {
      ...documentData.signatures,
      [role]: payload.image === null ? null : { image: payload.image, signerName, signedAt: new Date().toISOString() },
    };

    const result = await patchQuoteById(id, { document_data: documentData, updated_at: new Date().toISOString() });
    if (!result.ok) throw new Error(result.error || "No fue posible guardar la firma.");

    return Response.json({ ok: true, signatures: documentData.signatures }, { status: 200 });
  } catch (error) {
    console.error("Error al guardar la firma del contrato:", error);
    return Response.json({ error: "No fue posible guardar la firma." }, { status: 500 });
  }
}
