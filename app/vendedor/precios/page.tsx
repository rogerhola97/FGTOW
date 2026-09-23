import Image from "next/image";
import Link from "next/link";
import { PricingSettingsForm } from "../../components/PricingSettingsForm";
import { VendorLogoutButton } from "../../components/VendorLogoutButton";
import { EQUIPMENT, MODEL_META, TRAILER_PRESETS } from "../../lib/quoteCatalog";
import { getPricingSettings } from "../../lib/pricingSettingsDb";
import { requireVendor } from "../../lib/vendorAuth";

export const metadata = { title: "Precios y descuentos", robots: { index: false, follow: false } };

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
      <h1>Precios<br /><em>a tu gusto.</em></h1>
      <p>Estos precios solo aplican a las cotizaciones que se crean o editan desde el panel de vendedor — el cotizador público de fgtow.com nunca cambia.</p>
      <PricingSettingsForm initialSettings={settings} equipment={EQUIPMENT} presets={TRAILER_PRESETS} modelMeta={MODEL_META} />
    </section>
  </main>;
}
