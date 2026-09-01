import Image from "next/image";
import Link from "next/link";
import { TrailerConfigurator } from "../../../components/TrailerConfigurator";
import { requireVendor } from "../../../lib/vendorAuth";

export const metadata = { title: "Vendedor · FG Food Truck", robots: { index: false, follow: false } };

export default async function VendedorCotizadorFoodPage() {
  await requireVendor("/vendedor/cotizador/food");
  return <main className="configurator-page">
    <header className="nav-shell no-print">
      <Link href="/vendedor/panel" className="brand" aria-label="Panel de vendedor"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/vendedor/panel">Panel de vendedor</Link><a href="#enviar-cotizacion">Enviar proyecto</a></nav>
      <Link className="button button-small" href="/vendedor/panel">Panel de vendedor</Link>
    </header>
    <TrailerConfigurator modelId="food" />
    <footer className="no-print"><Link href="/" className="footer-brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={170} height={54} unoptimized /></Link><p>Remolques para negocio, aventura y trabajo.</p><div><Link href="/vendedor/panel">Panel de vendedor</Link></div><small>© 2026 FG TOW · De FG INV</small></footer>
  </main>;
}
