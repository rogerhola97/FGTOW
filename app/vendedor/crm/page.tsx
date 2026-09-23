import Image from "next/image";
import Link from "next/link";
import { PipelineBoard } from "../../components/PipelineBoard";
import { VendorLogoutButton } from "../../components/VendorLogoutButton";
import { listQuotesForBoard } from "../../lib/quotesDb";
import { requireVendor } from "../../lib/vendorAuth";

export const metadata = { title: "CRM de cotizaciones", robots: { index: false, follow: false } };

export default async function VendedorCrmPage() {
  const vendor = await requireVendor("/vendedor/crm");
  const quotes = await listQuotesForBoard().catch(() => []);

  return <main className="vendor-panel">
    <header className="nav-shell no-print">
      <Link href="/vendedor/panel" className="brand" aria-label="Panel de vendedor"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/vendedor/panel">Panel</Link><Link href="/vendedor/clientes">Clientes</Link></nav>
      <VendorLogoutButton />
    </header>
    <section className="vendor-panel-shell vendor-panel-shell-wide">
      <span className="eyebrow">Hola, {vendor.name}</span>
      <h1>CRM de<br /><em>cotizaciones.</em></h1>
      <p>Arrastra el seguimiento de cada cliente por las 5 etapas, desde que cotiza hasta que su remolque queda entregado.</p>
      <PipelineBoard quotes={quotes.map((quote) => ({
        id: quote.id,
        quote_number: quote.quote_number,
        name: quote.name,
        model: quote.model,
        total: Number(quote.total),
        pipeline_stage: quote.pipeline_stage ?? "cotizacion",
        version: quote.version,
      }))} />
    </section>
  </main>;
}
