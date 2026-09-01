import Image from "next/image";
import Link from "next/link";
import { VendorLogoutButton } from "../../components/VendorLogoutButton";
import { requireVendor } from "../../lib/vendorAuth";

export const metadata = { title: "Panel de vendedor", robots: { index: false, follow: false } };

const configurators = [
  { id: "food", label: "FG Food Truck", description: "Plano completo de distribución de cocina." },
  { id: "cargo", label: "FG Cargo", description: "Plano completo de aditamentos de carga." },
  { id: "rzr", label: "FG RZR Sport", description: "Plano completo de aditamentos para UTV." },
];

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
      <p>Los tres modelos con el plano interactivo tal como se muestran hoy en el sitio.</p>
      <div className="vendor-panel-grid">
        {configurators.map((item) => (
          <Link key={item.id} href={`/vendedor/cotizador/${item.id}`} className="vendor-panel-card">
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </Link>
        ))}
      </div>
    </section>
  </main>;
}
