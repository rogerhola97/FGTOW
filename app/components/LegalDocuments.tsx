import Image from "next/image";
import { QuoteRow } from "../lib/quotesDb";
import { QuoteDocumentsData, paymentMethodLabel, paymentScheduleLabel } from "../lib/quoteDocuments";
import { DoorConfig, PlacedEquipment, WALL_LABEL, WindowConfig, getEquipment, getPreset } from "../lib/quoteCatalog";

type DocumentSpecialItem = { id?: string; name: string; widthCm: number; depthCm: number; comment?: string; mount?: "inside" | "outside" };
type StoredConfiguration = { items?: PlacedEquipment[]; door?: DoorConfig; windows?: WindowConfig[]; specialItems?: DocumentSpecialItem[] };

const moneyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

function money(value: unknown) {
  return moneyFormatter.format(Number(value) || 0);
}

function longDate(value: string) {
  if (!value) return "Por definir";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(date);
}

function Header({ data, title, quoteNumber }: { data: QuoteDocumentsData; title: string; quoteNumber: string }) {
  return <header className="legal-document-header">
    <Image src="/fg-tow-logo.png" alt="FG TOW" width={210} height={66} priority unoptimized />
    <div className="legal-document-contact">
      <strong>{data.issuer.legalName}</strong>
      {data.issuer.rfc && <span>RFC {data.issuer.rfc}</span>}
      <span>{data.issuer.phone} · {data.issuer.email}</span>
      <span>{data.issuer.website}</span>
      <span>{data.issuer.address}</span>
    </div>
    <div className="legal-document-title"><span>{title}</span><strong>{quoteNumber}</strong></div>
  </header>;
}

function CustomerStrip({ quote }: { quote: QuoteRow }) {
  return <section className="legal-customer-strip">
    <div><small>CLIENTE</small><strong>{quote.name}</strong></div>
    <div><small>TELÉFONO</small><strong>{quote.phone || "No indicado"}</strong></div>
    <div><small>CORREO</small><strong>{quote.email || "No indicado"}</strong></div>
    <div><small>UBICACIÓN</small><strong>{[quote.city, quote.state].filter(Boolean).join(", ")}</strong></div>
  </section>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="legal-detail"><dt>{label}</dt><dd>{value || "No indicado"}</dd></div>;
}

function PaymentSummary({ data, total }: { data: QuoteDocumentsData; total: number }) {
  const payment = data.payment;
  return <div className="legal-payment-summary">
    <div><small>MÉTODO</small><strong>{paymentMethodLabel(payment.method)}</strong></div>
    <div><small>ESQUEMA</small><strong>{paymentScheduleLabel(payment.schedule)}</strong></div>
    <div><small>TOTAL</small><strong>{money(total)}</strong></div>
    {(payment.schedule === "deposit_balance" || payment.schedule === "deposit_installments") && <div><small>ANTICIPO</small><strong>{money(payment.depositAmount)}</strong></div>}
    {(payment.schedule === "deposit_balance" || payment.schedule === "deposit_installments") && <div><small>SALDO</small><strong>{money(payment.balanceAmount)}</strong></div>}
    {(payment.schedule === "deposit_installments" || payment.schedule === "installments") && <div><small>MENSUALIDADES</small><strong>{payment.installmentCount} × {money(payment.monthlyAmount)}</strong></div>}
  </div>;
}

function PaymentInstructions({ data }: { data: QuoteDocumentsData }) {
  const payment = data.payment;
  return <section className="legal-payment-card">
    <h2>Datos para el pago</h2>
    <dl className="legal-details-grid">
      <Detail label="Forma de pago" value={`${paymentMethodLabel(payment.method)} · ${paymentScheduleLabel(payment.schedule)}`} />
      {payment.method === "transfer" && <>
        <Detail label="Beneficiario" value={payment.beneficiary} />
        <Detail label="Banco" value={payment.bankName} />
        <Detail label="Cuenta" value={payment.accountNumber} />
        <Detail label="CLABE" value={payment.clabe} />
        <Detail label="Referencia" value={payment.paymentReference} />
      </>}
      {payment.method === "credit_card" && <>
        <Detail label="Terminal / procesador" value={payment.cardProcessor} />
        <Detail label="Liga de pago" value={payment.paymentLink} />
      </>}
    </dl>
    {payment.instructions && <p className="legal-preline">{payment.instructions}</p>}
  </section>;
}

function Signatures({ sellerName }: { sellerName: string }) {
  return <div className="legal-signatures">
    <div><span /><strong>Firma del cliente</strong></div>
    <div><span /><strong>FG TOW / {sellerName || "Representante autorizado"}</strong></div>
  </div>;
}

function Plan({ quote }: { quote: QuoteRow }) {
  const configuration = (quote.configuration ?? {}) as StoredConfiguration;
  const preset = getPreset(quote.trailer_preset);
  const items = configuration.items ?? [];
  const door = configuration.door;
  const windows = configuration.windows ?? [];
  const margin = 80;
  const doorLine = door ? (() => {
    if (door.wall === "front") return { x1: door.offsetCm, y1: 0, x2: door.offsetCm + door.widthCm, y2: 0 };
    if (door.wall === "back") return { x1: door.offsetCm, y1: preset.lengthCm, x2: door.offsetCm + door.widthCm, y2: preset.lengthCm };
    if (door.wall === "left") return { x1: 0, y1: door.offsetCm, x2: 0, y2: door.offsetCm + door.widthCm };
    return { x1: preset.widthCm, y1: door.offsetCm, x2: preset.widthCm, y2: door.offsetCm + door.widthCm };
  })() : null;
  const windowLine = (window: WindowConfig) => {
    if (window.wall === "front") return { x1: window.offsetCm, y1: 0, x2: window.offsetCm + window.widthCm, y2: 0 };
    if (window.wall === "back") return { x1: window.offsetCm, y1: preset.lengthCm, x2: window.offsetCm + window.widthCm, y2: preset.lengthCm };
    if (window.wall === "left") return { x1: 0, y1: window.offsetCm, x2: 0, y2: window.offsetCm + window.widthCm };
    return { x1: preset.widthCm, y1: window.offsetCm, x2: preset.widthCm, y2: window.offsetCm + window.widthCm };
  };

  return <>
    <div className="legal-plan-wrap">
      <svg viewBox={`${-margin} ${-margin} ${preset.widthCm + margin * 2} ${preset.lengthCm + margin * 2}`} role="img" aria-label="Plano de distribución del remolque">
        <path d={`M ${preset.widthCm / 2 - 42} 0 L ${preset.widthCm / 2} -66 L ${preset.widthCm / 2 + 42} 0`} fill="none" stroke="#0a3550" strokeWidth="4" />
        <rect x="0" y="0" width={preset.widthCm} height={preset.lengthCm} fill="#f7f8f6" stroke="#0a3550" strokeWidth="5" />
        {windows.map((window) => <line key={window.id} {...windowLine(window)} stroke="#2885a6" strokeWidth="9" strokeLinecap="round" />)}
        {items.map((item, index) => {
          const definition = getEquipment(item.typeId);
          if (!definition) return null;
          return <g key={item.instanceId} transform={`translate(${item.xCm} ${item.yCm})`}>
            <rect width={item.widthCm} height={item.depthCm} rx="2" fill={definition.color} stroke="#0a3550" strokeWidth="1.5" />
            <text x={item.widthCm / 2} y={item.depthCm / 2} textAnchor="middle" dominantBaseline="middle">{index + 1}</text>
          </g>;
        })}
        {doorLine && <line {...doorLine} stroke="#d6a229" strokeWidth="10" strokeLinecap="round" />}
      </svg>
    </div>
    <div className="legal-plan-legend">
      {items.map((item, index) => {
        const definition = getEquipment(item.typeId);
        return definition ? <div key={item.instanceId}><b>{index + 1}</b><span>{definition.name} · {item.widthCm} × {item.depthCm} cm</span></div> : null;
      })}
      {door && <div><b className="is-door" /><span>Puerta: {WALL_LABEL[door.wall]} · {door.widthCm} cm</span></div>}
      {windows.length > 0 && <div><b className="is-window" /><span>{windows.length} ventana{windows.length === 1 ? "" : "s"}</span></div>}
    </div>
  </>;
}

export function ContractDocument({ quote, data }: { quote: QuoteRow; data: QuoteDocumentsData }) {
  const configuration = (quote.configuration ?? {}) as StoredConfiguration;
  const preset = getPreset(quote.trailer_preset);
  const clauses = data.contractClauses.split(/\r?\n/).map((clause) => clause.trim()).filter(Boolean);
  const total = Number(quote.total) || 0;

  return <article className="legal-document legal-contract">
    <section className="legal-document-page">
      <Header data={data} title="Contrato de compraventa" quoteNumber={quote.quote_number} />
      <CustomerStrip quote={quote} />
      <div className="legal-kicker-row"><span>Atendido por {data.vehicle.sellerName || "FG TOW"}</span><span>{data.vehicle.issuePlace}, {longDate(data.vehicle.issueDate)}</span></div>

      <section className="legal-section">
        <h2>Especificación de la unidad</h2>
        <dl className="legal-details-grid">
          <Detail label="Vehículo" value={data.vehicle.vehicleType} />
          <Detail label="Marca / modelo" value={`${data.vehicle.brand} · ${data.vehicle.modelYear}`} />
          <Detail label="Número de serie" value={data.vehicle.serialNumber || "Pendiente de asignación"} />
          <Detail label="Condición / color" value={`${data.vehicle.condition} · ${data.vehicle.color}`} />
          <Detail label="Tren rodante" value={`${preset.axles} ${preset.axles === 1 ? "eje" : "ejes"}`} />
          <Detail label="Puertas / ventanas" value={`${data.vehicle.doorCount} / ${data.vehicle.windowCount}`} />
          <Detail label="Peso estimado" value={`${data.vehicle.weightKg.toLocaleString("es-MX")} kg`} />
          <Detail label="Capacidad de carga" value={`${data.vehicle.capacityKg.toLocaleString("es-MX")} kg`} />
          <Detail label="Medidas interiores" value={data.vehicle.interiorDimensions} />
          <Detail label="Medidas exteriores" value={data.vehicle.exteriorDimensions} />
        </dl>
      </section>

      <section className="legal-section legal-description">
        <h2>Descripción y alcance</h2>
        <p>{data.vehicle.description}</p>
        {data.vehicle.extras && <p><strong>Extras:</strong> {data.vehicle.extras}</p>}
        {data.vehicle.additionalNotes && <p><strong>Adicionales:</strong> {data.vehicle.additionalNotes}</p>}
      </section>

      <PaymentSummary data={data} total={total} />
      <div className="legal-delivery"><span>Fecha de entrega acordada</span><strong>{longDate(data.vehicle.deliveryDate)}</strong></div>
      <Signatures sellerName={data.vehicle.sellerName} />
      <footer className="legal-page-footer"><span>FG TOW · De FG INV</span><span>Página 1 de 3</span></footer>
    </section>

    <section className="legal-document-page">
      <Header data={data} title="Anexo técnico · plano" quoteNumber={quote.quote_number} />
      <div className="legal-plan-title"><div><small>UNIDAD</small><strong>{preset.label}</strong></div><div><small>CLIENTE</small><strong>{quote.name}</strong></div><div><small>ELEMENTOS</small><strong>{configuration.items?.length ?? 0}</strong></div></div>
      <Plan quote={quote} />
      <div className="legal-plan-note">Este plano forma parte de la especificación comercial. Las instalaciones, circulaciones, ventilación y distribución de peso quedan sujetas a la revisión final de fabricación.</div>
      <Signatures sellerName={data.vehicle.sellerName} />
      <footer className="legal-page-footer"><span>FG TOW · De FG INV</span><span>Página 2 de 3</span></footer>
    </section>

    <section className="legal-document-page">
      <Header data={data} title="Condiciones comerciales" quoteNumber={quote.quote_number} />
      <PaymentSummary data={data} total={total} />
      <PaymentInstructions data={data} />
      <section className="legal-section legal-clauses">
        <h2>Condiciones del contrato</h2>
        <ol>{clauses.map((clause, index) => <li key={`${index}-${clause.slice(0, 20)}`}>{clause}</li>)}</ol>
      </section>
      <section className="legal-section legal-warranty"><h2>Garantía, servicio y reparaciones</h2><p>{data.warrantyTerms}</p></section>
      <p className="legal-review-note">Plantilla editable preparada con los datos de la cotización. FG TOW debe revisar las condiciones comerciales y legales antes de recabar firmas.</p>
      <Signatures sellerName={data.vehicle.sellerName} />
      <footer className="legal-page-footer"><span>FG TOW · De FG INV</span><span>Página 3 de 3</span></footer>
    </section>
  </article>;
}

export function InvoiceLetterDocument({ quote, data }: { quote: QuoteRow; data: QuoteDocumentsData }) {
  const preset = getPreset(quote.trailer_preset);
  const total = Number(quote.total) || 0;
  return <article className="legal-document legal-invoice-letter">
    <section className="legal-document-page">
      <Header data={data} title="Carta factura" quoteNumber={quote.quote_number} />
      <CustomerStrip quote={quote} />
      <p className="legal-letter-intro">Por medio de la presente, {data.issuer.legalName} hace constar la operación correspondiente a la unidad descrita a continuación.</p>
      <section className="legal-section">
        <h2>Datos de la unidad</h2>
        <dl className="legal-details-grid">
          <Detail label="Vehículo" value={data.vehicle.vehicleType} />
          <Detail label="Marca" value={data.vehicle.brand} />
          <Detail label="Modelo / año" value={data.vehicle.modelYear} />
          <Detail label="Número de serie" value={data.vehicle.serialNumber || "Pendiente de asignación"} />
          <Detail label="Peso estimado" value={`${data.vehicle.weightKg.toLocaleString("es-MX")} kg`} />
          <Detail label="Capacidad de carga" value={`${data.vehicle.capacityKg.toLocaleString("es-MX")} kg`} />
          <Detail label="Ejes" value={`${preset.axles} ${preset.axles === 1 ? "eje completo" : "ejes completos"}`} />
          <Detail label="Puertas / ventanas" value={`${data.vehicle.doorCount} / ${data.vehicle.windowCount}`} />
          <Detail label="Medidas interiores" value={data.vehicle.interiorDimensions} />
          <Detail label="Medidas exteriores" value={data.vehicle.exteriorDimensions} />
          <Detail label="Condición" value={data.vehicle.condition} />
          <Detail label="Color" value={data.vehicle.color} />
        </dl>
      </section>

      <PaymentSummary data={data} total={total} />

      <section className="legal-section legal-fiscal-block">
        <h2>Datos para facturación</h2>
        {data.fiscal.needsInvoice ? <dl className="legal-details-grid">
          <Detail label="Nombre / razón social" value={data.fiscal.legalName} />
          <Detail label="RFC" value={data.fiscal.rfc} />
          <Detail label="Régimen fiscal" value={data.fiscal.taxRegime} />
          <Detail label="Uso CFDI" value={data.fiscal.cfdiUse} />
          <Detail label="Código postal fiscal" value={data.fiscal.fiscalPostalCode} />
          <Detail label="Correo de facturación" value={data.fiscal.invoiceEmail} />
          <Detail label="Domicilio fiscal" value={data.fiscal.fiscalAddress} />
        </dl> : <p>El cliente no solicitó CFDI en esta operación.</p>}
      </section>

      <section className="legal-letter-note"><p>{data.invoiceLetterNotes}</p></section>
      <div className="legal-letter-date">{data.vehicle.issuePlace}, {longDate(data.vehicle.issueDate)}</div>
      <Signatures sellerName={data.vehicle.sellerName} />
      <footer className="legal-page-footer"><span>{data.issuer.address}</span><span>FG TOW · De FG INV</span></footer>
    </section>
  </article>;
}
