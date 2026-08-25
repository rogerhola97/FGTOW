import Link from "next/link";
import Image from "next/image";

const catalog = [
  {
    id: "food",
    className: "food",
    tagline: "Cocina móvil",
    title: "FG Food Truck",
    description: "Distribuye tu cocina, ventana de servicio e instalaciones sobre un plano 2D real antes de fabricar. Para café, snacks, tacos y operaciones de servicio completo.",
    tags: ["Plano 2D editable", "Equipamiento de cocina", "1 o 2 ejes"],
  },
  {
    id: "cargo",
    className: "cargo",
    tagline: "Carga y trabajo",
    title: "FG Cargo",
    description: "Plataforma robusta para herramienta, mudanza y carga diaria. Configura medidas, ejes y aditamentos como rampas, racks y amarres según tu operación.",
    tags: ["Rampas y compuertas", "Racks y almacenaje", "1 o 2 ejes"],
  },
  {
    id: "rzr",
    className: "rzr",
    tagline: "Aventura y transporte de UTV",
    title: "FG RZR Sport",
    description: "Un solo concepto para mover RZR, Can-Am, UTV, motos y cuatrimotos. Configura tamaño, ejes y aditamentos como rampas reforzadas, anclajes y malacate.",
    tags: ["Rampas reforzadas", "Anclajes y malacate", "1 o 2 ejes"],
  },
];

export const metadata = { title: "Catálogo de remolques", description: "Tres modelos base FG TOW —food truck, cargo y RZR sport— cada uno configurable en medidas, ejes y aditamentos." };

export default function Catalogo() {
  return <main className="catalog-page">
    <header className="nav-shell"><Link href="/" className="brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={190} height={58} priority unoptimized /></Link><nav><Link href="/">Inicio</Link><a href="#modelos">Modelos</a><Link href="/#proceso">Proceso</Link></nav><a className="button button-small" href="#modelos">Ver modelos</a></header>
    <section className="catalog-hero"><span className="eyebrow">Catálogo base 2026</span><h1>Tres modelos,<br /><em>un punto de partida.</em></h1><p>Elige el concepto que se parece a lo que necesitas y configúralo a tu proyecto: medidas, ejes y aditamentos.</p></section>
    <section className="catalog-list" id="modelos">{catalog.map((item, index) => <article id={item.id} className="catalog-item" key={item.id}><div className="catalog-number">{String(index + 1).padStart(2, "0")}</div><div className="catalog-visual"><div className={`product-visual ${item.className}`}><span>FG / {String(index + 1).padStart(2, "0")}</span><div className="mini-trailer" /></div></div><div className="catalog-main"><span>{item.tagline}</span><h2>{item.title}</h2><p>{item.description}</p><ul>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul><Link className="button" href={`/cotizador/${item.id}`}>Configurar este modelo →</Link></div></article>)}</section>
    <section className="catalog-note"><div><span className="eyebrow">Importante</span><h2>La capacidad no se adivina.</h2></div><p>Antes de fabricar confirmamos peso de carga, distribución, vehículo de arrastre, tipo de camino y accesorios. Los precios que verás al configurar son referencias comerciales y cambian según ingeniería, materiales, equipamiento, impuestos y entrega.</p></section>
    <footer><Link href="/" className="footer-brand"><Image src="/fg-tow-logo.png" alt="FG TOW" width={170} height={54} unoptimized /></Link><p>Remolques para negocio, aventura y trabajo.</p><div><Link href="/">Inicio</Link><a href="#modelos">Modelos</a></div><small>© 2026 FG TOW · Parte de FG PRO</small></footer>
  </main>;
}
