import Link from "next/link";
import Image from "next/image";
import { LeadForm } from "./components/LeadForm";

const products = [
  { code: "01", name: "Utility 800", use: "Carga ligera y trabajo diario", size: "1.50 × 2.45 m", price: "$36,900", className: "utility" },
  { code: "02", name: "ATV Uno", use: "Cuatrimoto o hasta 2 motocicletas", size: "1.50 × 3.05 m", price: "$41,900", className: "atv" },
  { code: "03", name: "RZR Sport", use: "RZR, Can-Am y UTV", size: "1.94 × 3.60 m", price: "$49,900", className: "rzr" },
  { code: "04", name: "Food Start", use: "Café, snacks y conceptos compactos", size: "1.80 × 2.00 m", price: "$49,000", className: "food" },
];

const reasons = [
  ["01", "Diseñado para tu operación", "Partimos de lo que vas a cargar, cómo lo usarás y con qué vehículo lo remolcarás."],
  ["02", "Estructura con propósito", "Dimensiones, distribución de peso, anclajes y acabados definidos para uso real."],
  ["03", "Una sola conversación", "Diseño, fabricación, equipamiento y personalización coordinados por el mismo equipo."],
];

export default function Home() {
  return (
    <main>
      <header className="nav-shell">
        <Link href="/" className="brand" aria-label="FG TOW, inicio">
          <Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized />
        </Link>
        <nav aria-label="Navegación principal">
          <a href="#soluciones">Soluciones</a>
          <a href="#proceso">Proceso</a>
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/cotizador">Cotizador 2D</Link>
        </nav>
        <Link className="button button-small" href="/cotizador">Diseñar remolque</Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Remolques fabricados en Monterrey</span>
          <h1>Tu proyecto,<br /><em>listo para avanzar.</em></h1>
          <p>Remolques compactos para negocio, aventura y trabajo. Diseñamos cada solución alrededor de lo que necesitas mover.</p>
          <div className="hero-actions">
            <Link className="button" href="/cotizador">Diseñar mi remolque <span>→</span></Link>
            <Link className="text-link" href="/catalogo">Explorar catálogo <span>↗</span></Link>
          </div>
          <div className="trust-row">
            <span>Hecho en México</span><span>Proyecto a medida</span><span>Atención directa</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Ilustración de remolque FG TOW">
          <div className="blueprint-mark">FG / 01</div>
          <div className="trailer trailer-hero">
            <div className="trailer-body"><b>FG</b><small>TOW / UTILITY</small></div>
            <div className="trailer-frame" />
            <div className="wheel wheel-a" /><div className="wheel wheel-b" />
            <div className="hitch" />
          </div>
          <div className="spec-card"><small>CONFIGURACIÓN</small><strong>Utility / Sport</strong><span>Acero estructural · Acabado automotriz</span></div>
        </div>
      </section>

      <section className="statement">
        <span>NO FABRICAMOS EN SERIE. FABRICAMOS PARA TI.</span>
        <p>Desde una plataforma sencilla hasta una cocina móvil completa.</p>
      </section>

      <section className="section" id="soluciones">
        <div className="section-head">
          <div><span className="eyebrow">Línea inicial</span><h2>Una plataforma.<br />Muchas posibilidades.</h2></div>
          <p>Modelos base para cotizar con rapidez, configurables en medidas, capacidad, anclajes, rampas y equipamiento.</p>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.name}>
              <div className={`product-visual ${product.className}`}><span>{product.code}</span><div className="mini-trailer" /></div>
              <div className="product-info"><small>{product.use}</small><h3>FG {product.name}</h3><dl><div><dt>Base</dt><dd>{product.size}</dd></div><div><dt>Desde*</dt><dd>{product.price}</dd></div></dl><Link href={`/catalogo#${product.className}`}>Ver configuración <span>→</span></Link></div>
            </article>
          ))}
        </div>
        <div className="price-note">*Precios de referencia en MXN. La cotización final depende de capacidad, ejes, frenos, equipamiento, acabados e impuestos.</div>
      </section>

      <section className="dark-section" id="proceso">
        <div className="section-head light">
          <div><span className="eyebrow">Método FG TOW</span><h2>Del boceto<br />a la carretera.</h2></div>
          <p>Un proceso claro para convertir tu necesidad en un remolque funcional, equilibrado y con identidad propia.</p>
        </div>
        <div className="process-grid">
          {[["01", "Descubrimos", "Uso, carga, vehículo de arrastre, medidas y presupuesto."], ["02", "Diseñamos", "Propuesta técnica, distribución, accesorios y acabados."], ["03", "Fabricamos", "Construcción, integración, revisión y evidencia de avance."], ["04", "Entregamos", "Revisión contigo, documentación disponible y guía de uso."]].map((item) => <article key={item[0]}><span>{item[0]}</span><h3>{item[1]}</h3><p>{item[2]}</p></article>)}
        </div>
      </section>

      <section className="section split-section">
        <div className="split-title"><span className="eyebrow">Por qué FG TOW</span><h2>Más que metal.<br /><em>Una herramienta para crecer.</em></h2></div>
        <div className="reason-list">{reasons.map((reason) => <article key={reason[0]}><span>{reason[0]}</span><div><h3>{reason[1]}</h3><p>{reason[2]}</p></div></article>)}</div>
      </section>

      <section className="quote-section" id="cotizar">
        <div className="quote-copy"><span className="eyebrow">Cotización personalizada</span><h2>Cuéntanos qué<br />quieres mover.</h2><p>Para un food trailer puedes crear primero tu distribución en el plano 2D. Para plataformas, RZR, cuatrimotos y proyectos especiales, déjanos los datos básicos.</p><Link className="button quote-config-button" href="/cotizador">Abrir cotizador 2D →</Link><div className="quote-promise"><strong>Estimación + revisión humana</strong><span>El sistema calcula una referencia y nuestro equipo valida ingeniería, capacidad y precio final.</span></div></div>
        <LeadForm />
      </section>

      <footer><Link href="/" className="footer-brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={170} height={54} unoptimized /></Link><p>Remolques para negocio, aventura y trabajo.</p><div><Link href="/catalogo">Catálogo</Link><a href="#cotizar">Cotizar</a></div><small>© 2026 FG TOW · Parte de FG PRO</small></footer>
    </main>
  );
}
