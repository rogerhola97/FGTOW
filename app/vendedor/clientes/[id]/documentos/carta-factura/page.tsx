import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceLetterDocument } from "../../../../../components/LegalDocuments";
import { PrintDocumentButton } from "../../../../../components/PrintDocumentButton";
import { resolveQuoteDocumentsData } from "../../../../../lib/quoteDocuments";
import { getQuoteById } from "../../../../../lib/quotesDb";
import { requireVendor } from "../../../../../lib/vendorAuth";

export const metadata = { title: "Carta factura · FG TOW", robots: { index: false, follow: false } };

export default async function InvoiceLetterPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await requireVendor(`/vendedor/clientes/${id}/documentos/carta-factura`);
  const quote = await getQuoteById(id);
  if (!quote) notFound();
  const data = resolveQuoteDocumentsData(quote);

  return <main className="legal-document-preview">
    <div className="legal-preview-toolbar no-print">
      <div><span>Vista previa</span><strong>Carta factura · {quote.quote_number}</strong></div>
      <div><Link href={`/vendedor/clientes/${quote.id}`}>Volver a editar</Link><Link href={`/vendedor/clientes/${quote.id}/documentos/contrato`}>Ver contrato</Link><PrintDocumentButton /></div>
    </div>
    <InvoiceLetterDocument quote={quote} data={data} />
  </main>;
}
