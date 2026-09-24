import Image from "next/image";
import Link from "next/link";
import { DeleteQuoteButton } from "../../components/DeleteQuoteButton";
import { VendorLogoutButton } from "../../components/VendorLogoutButton";
import { MODEL_META } from "../../lib/quoteCatalog";
import { PipelineStage, STAGE_LABEL, STAGE_ORDER } from "../../lib/pipelineStages";
import { DEFAULT_PRICING_SETTINGS } from "../../lib/pricingSettingsShape";
import { getPricingSettings } from "../../lib/pricingSettingsDb";
import { requireVendor } from "../../lib/vendorAuth";
import { calculateStoredQuoteTotal } from "../../lib/vendorPricing";
import { searchQuotes } from "../../lib/quotesDb";

export const metadata = { title: "Clientes y cotizaciones", robots: { index: false, follow: false } };

const dateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
const moneyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const STATUS_LABEL: Record<string, string> = {
  new: "Nueva",
  email_pending: "Correo pendiente",
  contacted: "Contactado",
  quoted: "Cotizado",
  won: "Ganada",
  lost: "Perdida",
};

// source = quién la originó: el cliente desde el sitio público ("website-2d") o un vendedor desde
// /vendedor/cotizador o /vendedor/clientes ("vendor-panel") — ver app/api/quote/route.ts y
// app/api/vendedor/quotes/route.ts.
const SOURCE_LABEL: Record<string, string> = {
  "website-2d": "En línea",
  "vendor-panel": "En oficina",
};

export default async function VendedorClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string }> }) {
  const vendor = await requireVendor("/vendedor/clientes");
  const { q, stage: stageParam } = await searchParams;
  const query = (q ?? "").trim();
  const stage = STAGE_ORDER.includes(stageParam as PipelineStage) ? (stageParam as PipelineStage) : undefined;
  const [quotes, pricingSettings] = await Promise.all([
    searchQuotes(query, 40, stage).catch(() => null),
    getPricingSettings().catch(() => DEFAULT_PRICING_SETTINGS),
  ]);

  return <main className="vendor-panel">
    <header className="nav-shell no-print">
      <Link href="/" className="brand" aria-label="FG TOW, inicio"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/vendedor/panel">Panel</Link><Link href="/#modelos">Modelos</Link></nav>
      <VendorLogoutButton />
    </header>
    <section className="vendor-panel-shell">
      <span className="eyebrow">Hola, {vendor.name}</span>
      <h1>Clientes y<br /><em>cotizaciones.</em></h1>
      <p>Busca por nombre, correo o teléfono para ver, editar o continuar una cotización que ya se guardó.</p>

      <form className="vendor-search-form" method="get">
        <input type="search" name="q" defaultValue={query} placeholder="Nombre, correo o teléfono…" autoFocus autoComplete="off" />
        <select name="stage" defaultValue={stage ?? ""}>
          <option value="">Todas las etapas</option>
          {STAGE_ORDER.map((value) => <option key={value} value={value}>{STAGE_LABEL[value]}</option>)}
        </select>
        <button type="submit" className="button">Buscar</button>
        {(query || stage) && <Link href="/vendedor/clientes" className="vendor-search-clear">Quitar filtros</Link>}
      </form>

      {quotes === null && <p className="vendor-search-empty">No fue posible cargar las cotizaciones. Intenta de nuevo.</p>}
      {quotes && quotes.length === 0 && <p className="vendor-search-empty">{query ? `No hay cotizaciones que coincidan con "${query}".` : "Todavía no hay cotizaciones guardadas."}</p>}

      {quotes && quotes.length > 0 && (
        <div className="vendor-quotes-table-wrap">
        <table className="vendor-quotes-table">
          <thead><tr><th>Cliente</th><th>Contacto</th><th>Modelo</th><th>Total</th><th>Etapa</th><th>Estado</th><th>Origen</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td><Link href={`/vendedor/clientes/${quote.id}`}>{quote.name}</Link>{quote.version > 1 && <span className="vendor-quote-version"> · v{quote.version}</span>}</td>
                <td><span>{quote.email}</span><small>{quote.phone}</small></td>
                <td>{MODEL_META[quote.model as keyof typeof MODEL_META]?.shortLabel ?? quote.model}</td>
                <td>{moneyFormatter.format(calculateStoredQuoteTotal(quote, pricingSettings))}</td>
                <td><span className={`pipeline-stage-badge stage-${quote.pipeline_stage ?? "cotizacion"}`}>{STAGE_LABEL[quote.pipeline_stage ?? "cotizacion"]}</span></td>
                <td><span className={`vendor-quote-status status-${quote.status}`}>{STATUS_LABEL[quote.status] ?? quote.status}</span></td>
                <td><span className={`vendor-quote-source source-${quote.source}`}>{SOURCE_LABEL[quote.source] ?? quote.source}</span></td>
                <td>{dateFormatter.format(new Date(quote.created_at))}</td>
                <td><DeleteQuoteButton id={quote.id} quoteNumber={quote.quote_number} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  </main>;
}
