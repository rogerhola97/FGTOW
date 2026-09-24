import Image from "next/image";
import Link from "next/link";
import { VendorLogoutButton } from "../../components/VendorLogoutButton";
import { requireVendor } from "../../lib/vendorAuth";

export const metadata = { title: "Panel de vendedor", robots: { index: false, follow: false } };

export default async function VendedorPanelPage() {
  const vendor = await requireVendor("/vendedor/panel");

  return <main className="vendor-panel">
    <header className="nav-shell no-print">
      <Link href="/" className="brand" aria-label="FG TOW, inicio"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/">Inicio</Link><Link href="/#modelos">Modelos</Link></nav>
      <VendorLogoutButton />
    </header>
    <section className="vendor-panel-shell">
      <span className="eyebrow">Hola, {vendor.name}</span>
      <h1>Configuradores<br /><em>completos.</em></h1>
      <p>Los tres modelos con el plano interactivo.</p>
      <div className="vendor-panel-grid">
        <Link href="/vendedor/crm" className="vendor-panel-card vendor-panel-card-clients">
          <strong>CRM · Seguimiento</strong>
          <span>Tablero de las 5 etapas: cotización, producción, anticipo, pagada y entregada.</span>
        </Link>
        <Link href="/vendedor/clientes" className="vendor-panel-card vendor-panel-card-clients">
          <strong>Clientes y cotizaciones</strong>
          <span>Busca, revisa y edita las cotizaciones que los clientes mandan desde el sitio.</span>
        </Link>
        <Link href="/vendedor/precios" className="vendor-panel-card vendor-panel-card-clients">
          <strong>Precios y descuentos</strong>
          <span>Ajusta el precio de remolques y aditamentos para tus propias cotizaciones.</span>
        </Link>
        <Link href="/vendedor/cotizador" className="vendor-panel-card">
          <strong>Cotizadores</strong>
          <span>Food Trailer, Cargo y RZR Sport — empieza una cotización nueva con el plano interactivo.</span>
        </Link>
      </div>
    </section>
  </main>;
}
