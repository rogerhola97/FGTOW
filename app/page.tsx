import Link from "next/link";
import Image from "next/image";
import { LeadForm } from "./components/LeadForm";

const products = [
  {
    code: "01",
    id: "food",
    name: "Food Trailer",
    use: "Cocina móvil para café, snacks y servicio completo",
    description: "Distribuye tu cocina, ventana de servicio e instalaciones antes de fabricar. Para café, snacks, tacos y operaciones de servicio completo.",
    className: "food",
  },
  {
    code: "02",
    id: "cargo",
    name: "Cargo",
    use: "Plataforma para herramienta, mudanza y carga diaria",
    description: "Plataforma robusta para herramienta, mudanza y carga diaria. Configura medidas, ejes y aditamentos como rampas, racks y amarres según tu operación.",
    className: "cargo",
  },
  {
    code: "03",
    id: "rzr",
    name: "RZR Sport",
    use: "Transporte para RZR, UTV, motos y cuatrimotos",
    description: "Un solo concepto para mover RZR, Can-Am, UTV, motos y cuatrimotos. Configura tamaño, ejes y aditamentos como rampas reforzadas, anclajes y malacate.",
    className: "rzr",
  },
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
          <a href="#modelos">Modelos</a>
          <a href="#proceso">Proceso</a>
        </nav>
        <a className="button button-small" href="#modelos">Diseñar remolque</a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Remolques fabricados en Monterrey</span>
          <h1>Tu proyecto,<br /><em>listo para avanzar.</em></h1>
          <p>Remolques para negocio, aventura y trabajo. Diseñamos cada solución alrededor de lo que necesitas mover.</p>
          <div className="hero-actions">
            <a className="button" href="#modelos">Ver modelos</a>
          </div>
          <div className="trust-row">
            <span>Hecho en México</span><span>Proyecto a medida</span><span>Atención directa</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Ilustración de remolque FG TOW">
          <div className="trailer trailer-hero">
            <div className="trailer-body"><b>FG</b></div>
            <div className="trailer-frame" />
            <div className="wheel wheel-a" /><div className="wheel wheel-b" />
            <div className="hitch"><i className="hitch-leg" /></div>
          </div>
        </div>
      </section>

      <section className="statement">
        <span>NO FABRICAMOS EN SERIE. FABRICAMOS PARA TI.</span>
        <p>Desde una plataforma sencilla hasta una cocina móvil completa.</p>
      </section>

      <section className="section" id="modelos">
        <div className="section-head">
          <div><span className="eyebrow">Línea inicial</span><h2 className="hero-title">Tres modelos,<br /><em>un punto de partida.</em></h2></div>
          <div className="section-head-desc">
            <p>Modelos base para cotizar con rapidez, configurables en medidas, capacidad, anclajes, rampas y equipamiento.</p>
            <p>Elige el concepto que se parece a lo que necesitas y configúralo a tu proyecto: medidas, ejes y aditamentos.</p>
          </div>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.name}>
              <div className={`product-visual ${product.className}`}><span>{product.code}</span><div className="mini-trailer"><span className="mini-window" /><i className="mini-hitch"><b className="mini-hitch-leg" /></i></div></div>
              <div className="product-info"><small>{product.use}</small><h3>FG {product.name}</h3><p>{product.description}</p><Link className="button" href={`/cotizador/${product.id}`}>Configurar este modelo <span>→</span></Link></div>
            </article>
          ))}
        </div>
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
        <div className="quote-copy"><span className="eyebrow">Cotización personalizada</span><h2>Cuéntanos qué<br />quieres mover.</h2><p>Elige tu modelo base —food trailer, cargo o RZR sport— y configura tus accesorios para armar tu cotización al instante.</p><a className="button quote-config-button" href="#modelos">Elegir modelo y configurar →</a><div className="quote-promise"><strong>Estimación + revisión humana</strong><span>El sistema calcula una referencia y nuestro equipo valida ingeniería, capacidad y precio final.</span></div></div>
        <LeadForm />
      </section>

      <footer><Link href="/" className="footer-brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={170} height={54} unoptimized /></Link><p>Remolques para negocio, aventura y trabajo.</p><div><a href="#modelos">Modelos</a><a href="#cotizar">Cotizar</a></div><small>© 2026 FG TOW · De FG INV · <Link href="/vendedor" className="vendor-link">Acceso vendedores</Link></small></footer>
    </main>
  );
}
