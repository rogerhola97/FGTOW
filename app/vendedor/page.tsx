import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VendorLoginForm } from "../components/VendorLoginForm";
import { getVendor, safeVendorReturnPath } from "../lib/vendorAuth";

export const metadata = {
  title: "Acceso vendedores",
  description: "Inicia sesión como vendedor para configurar cotizaciones completas.",
  robots: { index: false, follow: false },
};

export default async function VendedorAccesoPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const { return_to } = await searchParams;
  const returnTo = safeVendorReturnPath(return_to);
  const vendor = await getVendor();
  if (vendor) redirect(returnTo);

  return <main className="vendor-gate">
    <header className="nav-shell no-print">
      <Link href="/" className="brand" aria-label="FG TOW, inicio"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link>
      <nav aria-label="Navegación principal"><Link href="/">Inicio</Link><Link href="/#modelos">Modelos</Link></nav>
    </header>
    <section className="vendor-gate-shell">
      <div className="vendor-gate-copy"><span className="eyebrow">Acceso interno</span><h1>Iniciar sesión<br /><em>como vendedor.</em></h1><p>Esta sección es para el equipo comercial de FG TOW: aquí se configuran los tres modelos con el plano completo.</p></div>
      <VendorLoginForm returnTo={returnTo} />
    </section>
  </main>;
}
