import Image from "next/image";
import Link from "next/link";
import { TrailerConfigurator } from "../../components/TrailerConfigurator";

export const metadata = {
  title: "Configurador FG Cargo",
  description: "Configura medidas, ejes y aditamentos de tu FG Cargo en un plano 2D y recibe una cotización aproximada.",
};

export default function CotizadorCargoPage() {
  return <main className="configurator-page">
    <header className="nav-shell no-print">
      <Link href="/" className="brand" aria-label="FG TOW, inicio"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/">Inicio</Link><Link href="/#modelos">Modelos</Link><a href="#enviar-cotizacion">Enviar proyecto</a></nav>
      <Link className="button button-small" href="/#modelos">Ver modelos</Link>
    </header>
    <TrailerConfigurator modelId="cargo" plano={false} />
    <footer className="no-print"><Link href="/" className="footer-brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={170} height={54} unoptimized /></Link><p>Remolques para negocio, aventura y trabajo.</p><div><Link href="/">Inicio</Link><Link href="/#modelos">Modelos</Link></div><small>© 2026 FG TOW · De FG INV · <Link href="/vendedor" className="vendor-link">Acceso vendedores</Link></small></footer>
  </main>;
}
