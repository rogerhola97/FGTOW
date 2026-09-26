import Image from "next/image";
import Link from "next/link";
import { PricingSettingsForm } from "../../components/PricingSettingsForm";
import { VendorLogoutButton } from "../../components/VendorLogoutButton";
import { EQUIPMENT } from "../../lib/quoteCatalog";
import { getPricingSettings } from "../../lib/pricingSettingsDb";
import { requireVendor } from "../../lib/vendorAuth";

export const metadata = { title: "Tarifas de aditamentos", robots: { index: false, follow: false } };

export default async function VendedorPreciosPage() {
  const vendor = await requireVendor("/vendedor/precios");
  const settings = await getPricingSettings();

  return <main className="vendor-panel">
    <header className="nav-shell no-print">
      <Link href="/vendedor/panel" className="brand" aria-label="Panel de vendedor"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/vendedor/panel">Panel</Link><Link href="/vendedor/crm">CRM</Link></nav>
      <VendorLogoutButton />
    </header>
    <section className="vendor-panel-shell">
      <span className="eyebrow">Hola, {vendor.name}</span>
      <h1>Tarifas de<br /><em>aditamentos.</em></h1>
      <p>La matriz de remolques, los ejes obligatorios, las alturas permitidas y los accesorios incluidos son comunes para todos los cotizadores. Aquí puedes ajustar solamente los aditamentos adicionales del panel de vendedor.</p>
      <PricingSettingsForm initialSettings={settings} equipment={EQUIPMENT} />
    </section>
  </main>;
}
