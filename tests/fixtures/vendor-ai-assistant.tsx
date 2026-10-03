// Isolated browser fixture: no vendor session or production backend is used.
import { createRoot } from "react-dom/client";
import { VendorAiAssistant } from "../../app/components/VendorAiAssistant";
import "../../app/globals.css";

createRoot(document.getElementById("root")!).render(<main className="vendor-panel">
  <header className="nav-shell"><a href="#" className="brand"><img src="/fg-tow-logo.png" alt="FG TOW" width="190" height="58" /></a><nav aria-label="Navegación principal"><a href="#">Inicio</a><a href="#">Modelos</a></nav><button className="button button-small">Cerrar sesión</button></header>
  <section className="vendor-panel-shell"><span className="eyebrow">Hola, vendedor</span><h1>Configuradores<br /><em>completos.</em></h1><p>Los tres modelos con el plano interactivo.</p><div className="vendor-panel-grid">{["CRM · Seguimiento", "Clientes y cotizaciones", "Tarifas de aditamentos", "Cotizadores"].map(title => <a key={title} href="#" className="vendor-panel-card"><strong>{title}</strong><span>Herramientas de ventas de FG TOW.</span></a>)}</div></section>
  <VendorAiAssistant />
</main>);
