import Image from "next/image";
import Link from "next/link";
import { PipelineBoard } from "../../components/PipelineBoard";
import { VendorLogoutButton } from "../../components/VendorLogoutButton";
import { getPricingSettings } from "../../lib/pricingSettingsDb";
import { DEFAULT_PRICING_SETTINGS } from "../../lib/pricingSettingsShape";
import { PipelineStage, STAGE_LABEL, STAGE_ORDER } from "../../lib/pipelineStages";
import { searchQuotes } from "../../lib/quotesDb";
import { requireVendor } from "../../lib/vendorAuth";
import { calculateStoredQuoteTotal } from "../../lib/vendorPricing";

export const metadata = { title: "CRM de cotizaciones", robots: { index: false, follow: false } };

export default async function VendedorCrmPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string }> }) {
  const vendor = await requireVendor("/vendedor/crm");
  const { q, stage: stageParam } = await searchParams;
  const query = (q ?? "").trim();
  const stage = STAGE_ORDER.includes(stageParam as PipelineStage) ? (stageParam as PipelineStage) : undefined;
  const hasSearch = Boolean(query || stage);

  // El tablero solo carga cotizaciones cuando hay búsqueda o filtro de etapa — con muchas
  // cotizaciones acumuladas, listarlas todas de entrada satura las 5 columnas y hace más difícil
  // encontrar justo la que se busca. Al buscar aparece en la etapa donde ya va, lista para
  // avanzarla igual que cualquier otra.
  const [quotes, pricingSettings] = await Promise.all([
    hasSearch ? searchQuotes(query, 60, stage).catch(() => null) : Promise.resolve(null),
    getPricingSettings().catch(() => DEFAULT_PRICING_SETTINGS),
  ]);

  return <main className="vendor-panel">
    <header className="nav-shell no-print">
      <Link href="/vendedor/panel" className="brand" aria-label="Panel de vendedor"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/vendedor/panel">Panel</Link><Link href="/vendedor/clientes">Clientes</Link></nav>
      <VendorLogoutButton />
    </header>
    <section className="vendor-panel-shell vendor-panel-shell-wide">
      <span className="eyebrow">Hola, {vendor.name}</span>
      <h1>CRM de<br /><em>cotizaciones.</em></h1>
      <p>Busca por nombre, correo o teléfono (o filtra por etapa) para ver dónde va una cotización y moverla a la siguiente etapa.</p>

      <form className="vendor-search-form" method="get">
        <input type="search" name="q" defaultValue={query} placeholder="Nombre, correo o teléfono…" autoFocus autoComplete="off" />
        <select name="stage" defaultValue={stage ?? ""}>
          <option value="">Todas las etapas</option>
          {STAGE_ORDER.map((value) => <option key={value} value={value}>{STAGE_LABEL[value]}</option>)}
        </select>
        <button type="submit" className="button">Buscar</button>
        {hasSearch && <Link href="/vendedor/crm" className="vendor-search-clear">Quitar búsqueda</Link>}
      </form>

      {!hasSearch && (
        <p className="vendor-search-empty">Busca un cliente o elige una etapa para ver sus cotizaciones aquí — el tablero no las lista todas de entrada para que no se sature.</p>
      )}
      {hasSearch && quotes === null && <p className="vendor-search-empty">No fue posible cargar las cotizaciones. Intenta de nuevo.</p>}
      {hasSearch && quotes && quotes.length === 0 && <p className="vendor-search-empty">No hay cotizaciones que coincidan con tu búsqueda.</p>}

      {hasSearch && quotes && quotes.length > 0 && (
        <PipelineBoard quotes={quotes.map((quote) => ({
          id: quote.id,
          quote_number: quote.quote_number,
          name: quote.name,
          model: quote.model,
          total: calculateStoredQuoteTotal(quote, pricingSettings),
          pipeline_stage: quote.pipeline_stage ?? "cotizacion",
          version: quote.version,
        }))} />
      )}
    </section>
  </main>;
}
