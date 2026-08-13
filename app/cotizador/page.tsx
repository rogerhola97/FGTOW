import Image from "next/image";
import Link from "next/link";
import { TrailerConfigurator } from "../components/TrailerConfigurator";

export const metadata = {
  title: "Cotizador 2D de food trailers",
  description: "Diseña la distribución de tu food trailer FG TOW en un plano 2D y recibe una cotización aproximada.",
};

export default function CotizadorPage() {
  return <main className="configurator-page">
    <header className="nav-shell no-print">
      <Link href="/" className="brand" aria-label="FG TOW, inicio"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/">Inicio</Link><Link href="/catalogo">Catálogo</Link><a href="#enviar-cotizacion">Enviar proyecto</a></nav>
      <Link className="button button-small" href="/catalogo">Ver modelos</Link>
    </header>
    <TrailerConfigurator />
    <footer className="no-print"><Link href="/" className="footer-brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={170} height={54} unoptimized /></Link><p>Remolques para negocio, aventura y trabajo.</p><div><Link href="/">Inicio</Link><Link href="/catalogo">Catálogo</Link></div><small>© 2026 FG TOW · Parte de FG PRO</small></footer>
  </main>;
}
