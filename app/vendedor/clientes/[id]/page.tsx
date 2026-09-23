import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteQuoteButton } from "../../../components/DeleteQuoteButton";
import { PipelineStageControl } from "../../../components/PipelineStageControl";
import { QuoteFileManager } from "../../../components/QuoteFileManager";
import { InitialQuoteData, TrailerConfigurator } from "../../../components/TrailerConfigurator";
import { DoorConfig, ModelId, PlacedEquipment, WindowConfig } from "../../../lib/quoteCatalog";
import { signQuoteFileUrls } from "../../../lib/quoteFilesDb";
import { getQuoteById, getSiblingQuotes } from "../../../lib/quotesDb";
import { requireVendor } from "../../../lib/vendorAuth";

export const metadata = { title: "Editar cotización", robots: { index: false, follow: false } };

const dateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
const moneyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

type StoredConfiguration = { items?: PlacedEquipment[]; door?: DoorConfig; windows?: WindowConfig[]; specialItems?: { name: string; widthCm: number; depthCm: number; price: number }[] };

export default async function VendedorClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireVendor("/vendedor/clientes");
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const quote = await getQuoteById(id);
  if (!quote) notFound();

  const siblings = await getSiblingQuotes(quote.email, quote.id).catch(() => []);
  const configuration = (quote.configuration ?? {}) as StoredConfiguration;

  const [referenceImages, invoiceFiles, deliveryPhotos] = await Promise.all([
    signQuoteFileUrls("reference", quote.reference_image_files ?? []),
    signQuoteFileUrls("invoice", quote.invoice_files ?? []),
    signQuoteFileUrls("delivery", quote.delivery_photo_files ?? []),
  ]);

  const initialQuote: InitialQuoteData = {
    id: quote.id,
    quoteNumber: quote.quote_number,
    version: quote.version,
    presetId: quote.trailer_preset,
    items: configuration.items ?? [],
    door: configuration.door ?? { wall: "back", offsetCm: 0, widthCm: 80 },
    windows: configuration.windows ?? [],
    specialItems: configuration.specialItems ?? [],
    customer: { name: quote.name, phone: quote.phone, email: quote.email, city: quote.city, state: quote.state, notes: quote.notes ?? "" },
    includeIva: Boolean(quote.include_iva),
    discountType: quote.discount_type ?? null,
    discountValue: quote.discount_value ?? null,
    discountReason: quote.discount_reason ?? null,
    referenceImages,
  };

  return <main className="configurator-page">
    <header className="nav-shell no-print">
      <Link href="/vendedor/panel" className="brand" aria-label="Panel de vendedor"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/vendedor/panel">Panel de vendedor</Link><Link href="/vendedor/clientes">Clientes</Link></nav>
      <Link className="button button-small" href="/vendedor/clientes">← Clientes</Link>
    </header>

    <section className="vendor-quote-detail-head no-print">
      <div className="vendor-quote-detail-headline">
        <div>
          <span className="eyebrow">Folio {quote.quote_number} · versión {quote.version}</span>
          <h1>{quote.name}</h1>
        </div>
        <div className="vendor-quote-detail-actions">
          <PipelineStageControl id={quote.id} stage={quote.pipeline_stage ?? "cotizacion"} />
          <DeleteQuoteButton id={quote.id} quoteNumber={quote.quote_number} redirectTo="/vendedor/clientes" />
        </div>
      </div>
      <p>{quote.email} · {quote.phone} · {quote.city}, {quote.state}</p>
      <p className="vendor-quote-meta">Guardada el {dateFormatter.format(new Date(quote.created_at))}{quote.updated_at ? ` · última edición ${dateFormatter.format(new Date(quote.updated_at))}` : ""}{quote.vendor_email ? ` por ${quote.vendor_email}` : ""}</p>

      <div className="quote-file-managers">
        <QuoteFileManager quoteId={quote.id} kind="invoice" title="Facturas" hint="PDF o imagen de la factura de esta cotización." accept="application/pdf,image/*" initialFiles={invoiceFiles} />
        {quote.pipeline_stage === "entregada" && (
          <QuoteFileManager quoteId={quote.id} kind="delivery" title="Fotos de entrega" hint="Fotos del remolque ya entregado al cliente." accept="image/*" initialFiles={deliveryPhotos} />
        )}
      </div>

      {siblings.length > 0 && (
        <div className="vendor-siblings">
          <strong>Otras cotizaciones de este cliente</strong>
          <ul>
            {siblings.map((sibling) => (
              <li key={sibling.id}>
                <Link href={`/vendedor/clientes/${sibling.id}`}>{sibling.quote_number} · v{sibling.version}</Link>
                <span>{moneyFormatter.format(Number(sibling.total))} · {dateFormatter.format(new Date(sibling.created_at))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>

    <TrailerConfigurator modelId={quote.model as ModelId} initialQuote={initialQuote} isVendor />

    <footer className="no-print"><Link href="/" className="footer-brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={170} height={54} unoptimized /></Link><p>Remolques para negocio, aventura y trabajo.</p><div><Link href="/vendedor/clientes">Clientes</Link></div><small>© 2026 FG TOW · De FG INV</small></footer>
  </main>;
}
