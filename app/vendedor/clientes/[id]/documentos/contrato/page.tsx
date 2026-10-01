import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractDocument } from "../../../../../components/LegalDocuments";
import { PrintDocumentButton } from "../../../../../components/PrintDocumentButton";
import { resolveQuoteDocumentsData } from "../../../../../lib/quoteDocuments";
import { getQuoteById } from "../../../../../lib/quotesDb";
import { requireVendor } from "../../../../../lib/vendorAuth";

export const metadata = { title: "Contrato · FG TOW", robots: { index: false, follow: false } };

export default async function ContractPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await requireVendor(`/vendedor/clientes/${id}/documentos/contrato`);
  const quote = await getQuoteById(id);
  if (!quote) notFound();
  const data = resolveQuoteDocumentsData(quote);

  return <main className="legal-document-preview">
    <div className="legal-preview-toolbar no-print">
      <div><span>Vista previa</span><strong>Contrato · {quote.quote_number}</strong></div>
      <div><Link href={`/vendedor/clientes/${quote.id}`}>Volver a editar</Link><Link href={`/vendedor/clientes/${quote.id}/documentos/carta-factura`}>Ver carta factura</Link><PrintDocumentButton /></div>
    </div>
    <ContractDocument quote={quote} data={data} />
  </main>;
}
