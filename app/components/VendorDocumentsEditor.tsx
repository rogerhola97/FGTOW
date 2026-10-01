"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { QuoteDocumentsData } from "../lib/quoteDocuments";

type SaveState = "idle" | "saving" | "saved" | "error";
type DocumentKind = "contrato" | "carta-factura";

const DOCUMENT_LABEL: Record<DocumentKind, string> = { contrato: "Contrato", "carta-factura": "Carta factura" };

function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(value || 0);
}

export function VendorDocumentsEditor({ quoteId, quoteNumber, total, initialData }: { quoteId: number; quoteNumber: string; total: number; initialData: QuoteDocumentsData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [states, setStates] = useState<Record<DocumentKind, SaveState>>({ contrato: "idle", "carta-factura": "idle" });
  const [messages, setMessages] = useState<Record<DocumentKind, string>>({
    contrato: "Los datos del remolque y del cliente ya vienen de la cotización.",
    "carta-factura": "Completa los datos fiscales únicamente cuando el cliente requiera CFDI.",
  });

  function markChanged(kinds: DocumentKind[]) {
    setStates((current) => {
      const next = { ...current };
      kinds.forEach((kind) => { next[kind] = "idle"; });
      return next;
    });
    setMessages((current) => {
      const next = { ...current };
      kinds.forEach((kind) => { next[kind] = "Hay cambios sin guardar."; });
      return next;
    });
  }

  function updateVehicle<K extends keyof QuoteDocumentsData["vehicle"]>(key: K, value: QuoteDocumentsData["vehicle"][K]) {
    setData((current) => ({ ...current, vehicle: { ...current.vehicle, [key]: value } }));
    markChanged(["contrato", "carta-factura"]);
  }

  function updatePayment<K extends keyof QuoteDocumentsData["payment"]>(key: K, value: QuoteDocumentsData["payment"][K]) {
    setData((current) => ({ ...current, payment: { ...current.payment, [key]: value } }));
    markChanged(["contrato", "carta-factura"]);
  }

  function updateFiscal<K extends keyof QuoteDocumentsData["fiscal"]>(key: K, value: QuoteDocumentsData["fiscal"][K]) {
    setData((current) => ({ ...current, fiscal: { ...current.fiscal, [key]: value } }));
    markChanged(["carta-factura"]);
  }

  function updateIssuer<K extends keyof QuoteDocumentsData["issuer"]>(key: K, value: QuoteDocumentsData["issuer"][K]) {
    setData((current) => ({ ...current, issuer: { ...current.issuer, [key]: value } }));
    markChanged(["contrato", "carta-factura"]);
  }

  function updateRoot(key: "contractClauses" | "warrantyTerms" | "invoiceLetterNotes", value: string, kind: DocumentKind) {
    setData((current) => ({ ...current, [key]: value }));
    markChanged([kind]);
  }

  async function persist(kind: DocumentKind) {
    if (states[kind] === "saving") return false;
    setStates((current) => ({ ...current, [kind]: "saving" }));
    setMessages((current) => ({ ...current, [kind]: `Guardando ${DOCUMENT_LABEL[kind].toLowerCase()}…` }));
    try {
      const response = await fetch(`/api/vendedor/quotes/${quoteId}/documents`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json() as { error?: string; documentData?: QuoteDocumentsData };
      if (!response.ok || !result.documentData) throw new Error(result.error || `No fue posible guardar ${DOCUMENT_LABEL[kind].toLowerCase()}.`);
      setData(result.documentData);
      setStates((current) => ({ ...current, [kind]: "saved" }));
      setMessages((current) => ({ ...current, [kind]: `${DOCUMENT_LABEL[kind]} guardado correctamente.` }));
      router.refresh();
      return true;
    } catch (error) {
      setStates((current) => ({ ...current, [kind]: "error" }));
      setMessages((current) => ({ ...current, [kind]: error instanceof Error ? error.message : `No fue posible guardar ${DOCUMENT_LABEL[kind].toLowerCase()}.` }));
      return false;
    }
  }

  function openDocument(kind: DocumentKind) {
    window.open(`/vendedor/clientes/${quoteId}/documentos/${kind}`, "_blank", "noopener,noreferrer");
  }

  function submit(event: FormEvent<HTMLFormElement>, kind: DocumentKind) {
    event.preventDefault();
    void persist(kind);
  }

  const showDeposit = data.payment.schedule === "deposit_balance" || data.payment.schedule === "deposit_installments";
  const showInstallments = data.payment.schedule === "deposit_installments" || data.payment.schedule === "installments";

  const issuerFields = <div className="vendor-document-grid">
    <label>Razón social / emisor<input value={data.issuer.legalName} maxLength={240} onChange={(event) => updateIssuer("legalName", event.target.value)} /></label>
    <label>RFC del emisor<input value={data.issuer.rfc} maxLength={20} autoCapitalize="characters" onChange={(event) => updateIssuer("rfc", event.target.value.toUpperCase())} /></label>
    <label className="span-2">Domicilio del emisor<textarea rows={2} maxLength={500} value={data.issuer.address} onChange={(event) => updateIssuer("address", event.target.value)} /></label>
    <label>Teléfono<input value={data.issuer.phone} maxLength={80} onChange={(event) => updateIssuer("phone", event.target.value)} /></label>
    <label>Correo<input type="email" value={data.issuer.email} maxLength={160} onChange={(event) => updateIssuer("email", event.target.value)} /></label>
    <label>Sitio web<input value={data.issuer.website} maxLength={160} onChange={(event) => updateIssuer("website", event.target.value)} /></label>
  </div>;

  return (
    <section className="vendor-documents" aria-labelledby="vendor-documents-title">
      <div className="vendor-documents-head">
        <div>
          <span className="eyebrow">Documentos FG TOW · {quoteNumber}</span>
          <h2 id="vendor-documents-title">Documentos del cliente</h2>
          <p>El contrato y la carta factura son independientes y desplegables. Guarda cada uno antes de abrir su vista imprimible.</p>
        </div>
      </div>

      <div className="vendor-document-cards">
        <details className="vendor-document-card">
          <summary><span><strong>Contrato</strong><small>Condiciones, especificaciones, pago, plano y firmas.</small></span><b>Desplegar</b></summary>
          <form onSubmit={(event) => submit(event, "contrato")} className="vendor-document-form">
            <section className="vendor-document-form-section">
              <h3>Datos del remolque y la operación</h3>
              <div className="vendor-document-grid">
                <label>Vendedor que atiende<input value={data.vehicle.sellerName} maxLength={120} onChange={(event) => updateVehicle("sellerName", event.target.value)} /></label>
                <label>Lugar de expedición<input value={data.vehicle.issuePlace} maxLength={160} onChange={(event) => updateVehicle("issuePlace", event.target.value)} /></label>
                <label>Fecha del documento<input type="date" value={data.vehicle.issueDate} onChange={(event) => updateVehicle("issueDate", event.target.value)} /></label>
                <label>Fecha de entrega<input type="date" value={data.vehicle.deliveryDate} onChange={(event) => updateVehicle("deliveryDate", event.target.value)} /></label>
                <label>Tipo de vehículo<input value={data.vehicle.vehicleType} maxLength={180} onChange={(event) => updateVehicle("vehicleType", event.target.value)} /></label>
                <label>Marca<input value={data.vehicle.brand} maxLength={100} onChange={(event) => updateVehicle("brand", event.target.value)} /></label>
                <label>Modelo / año<input value={data.vehicle.modelYear} maxLength={20} onChange={(event) => updateVehicle("modelYear", event.target.value)} /></label>
                <label>Número de serie<input value={data.vehicle.serialNumber} maxLength={100} placeholder="Cuando esté asignado" onChange={(event) => updateVehicle("serialNumber", event.target.value)} /></label>
                <label>Color<input value={data.vehicle.color} maxLength={80} onChange={(event) => updateVehicle("color", event.target.value)} /></label>
                <label>Condición<input value={data.vehicle.condition} maxLength={80} onChange={(event) => updateVehicle("condition", event.target.value)} /></label>
                <label>Peso estimado (kg)<input type="number" min={0} value={data.vehicle.weightKg} onChange={(event) => updateVehicle("weightKg", Number(event.target.value))} /></label>
                <label>Capacidad de carga (kg)<input type="number" min={0} value={data.vehicle.capacityKg} onChange={(event) => updateVehicle("capacityKg", Number(event.target.value))} /></label>
                <label className="span-2">Medidas interiores<input value={data.vehicle.interiorDimensions} maxLength={240} onChange={(event) => updateVehicle("interiorDimensions", event.target.value)} /></label>
                <label className="span-2">Medidas exteriores<input value={data.vehicle.exteriorDimensions} maxLength={240} onChange={(event) => updateVehicle("exteriorDimensions", event.target.value)} /></label>
                <label>Número de puertas<input type="number" min={0} max={20} value={data.vehicle.doorCount} onChange={(event) => updateVehicle("doorCount", Number(event.target.value))} /></label>
                <label>Número de ventanas<input type="number" min={0} max={40} value={data.vehicle.windowCount} onChange={(event) => updateVehicle("windowCount", Number(event.target.value))} /></label>
                <label className="span-2">Descripción<textarea rows={4} maxLength={4000} value={data.vehicle.description} onChange={(event) => updateVehicle("description", event.target.value)} /></label>
                <label className="span-2">Extras con costo<textarea rows={3} maxLength={2500} placeholder="Conceptos, medidas e importes especiales" value={data.vehicle.extras} onChange={(event) => updateVehicle("extras", event.target.value)} /></label>
                <label className="span-2">Adicionales y observaciones<textarea rows={3} maxLength={2500} value={data.vehicle.additionalNotes} onChange={(event) => updateVehicle("additionalNotes", event.target.value)} /></label>
              </div>
            </section>

            <section className="vendor-document-form-section">
              <h3>Forma y plan de pago</h3>
              <div className="vendor-document-grid">
                <label>Método de pago<select value={data.payment.method} onChange={(event) => updatePayment("method", event.target.value as QuoteDocumentsData["payment"]["method"])}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="credit_card">Tarjeta de crédito</option></select></label>
                <label>Plan de pago<select value={data.payment.schedule} onChange={(event) => updatePayment("schedule", event.target.value as QuoteDocumentsData["payment"]["schedule"])}><option value="full">Pago total</option><option value="deposit_balance">Anticipo y saldo a la entrega</option><option value="deposit_installments">Anticipo y resto a meses</option><option value="installments">Todo a meses</option></select></label>
                {showDeposit && <label>Anticipo<input type="number" min={0} step="0.01" value={data.payment.depositAmount} onChange={(event) => updatePayment("depositAmount", Number(event.target.value))} /><small>Referencia: {money(total)}</small></label>}
                {showDeposit && <label>Saldo restante<input type="number" min={0} step="0.01" value={data.payment.balanceAmount} onChange={(event) => updatePayment("balanceAmount", Number(event.target.value))} /></label>}
                {showInstallments && <label>Número de mensualidades<input type="number" min={1} max={60} value={data.payment.installmentCount} onChange={(event) => updatePayment("installmentCount", Number(event.target.value))} /></label>}
                {showInstallments && <label>Monto por mensualidad<input type="number" min={0} step="0.01" value={data.payment.monthlyAmount} onChange={(event) => updatePayment("monthlyAmount", Number(event.target.value))} /></label>}
                {data.payment.method === "transfer" && <>
                  <label>Beneficiario<input value={data.payment.beneficiary} maxLength={160} onChange={(event) => updatePayment("beneficiary", event.target.value)} /></label>
                  <label>Banco<input value={data.payment.bankName} maxLength={120} onChange={(event) => updatePayment("bankName", event.target.value)} /></label>
                  <label>Número de cuenta<input value={data.payment.accountNumber} maxLength={80} inputMode="numeric" onChange={(event) => updatePayment("accountNumber", event.target.value)} /></label>
                  <label>CLABE<input value={data.payment.clabe} maxLength={24} inputMode="numeric" onChange={(event) => updatePayment("clabe", event.target.value)} /></label>
                  <label className="span-2">Referencia para el pago<input value={data.payment.paymentReference} maxLength={120} onChange={(event) => updatePayment("paymentReference", event.target.value)} /></label>
                </>}
                {data.payment.method === "credit_card" && <>
                  <label>Terminal / procesador<input value={data.payment.cardProcessor} maxLength={120} placeholder="Ej. terminal bancaria o liga de pago" onChange={(event) => updatePayment("cardProcessor", event.target.value)} /></label>
                  <label>Liga de pago<input type="url" value={data.payment.paymentLink} maxLength={500} placeholder="https://" onChange={(event) => updatePayment("paymentLink", event.target.value)} /></label>
                  <p className="vendor-document-security span-2">Por seguridad, no captures número completo de tarjeta, CVV, NIP ni fecha de vencimiento.</p>
                </>}
                <label className="span-2">Instrucciones o condiciones del pago<textarea rows={3} maxLength={2000} value={data.payment.instructions} onChange={(event) => updatePayment("instructions", event.target.value)} /></label>
              </div>
            </section>

            <section className="vendor-document-form-section"><h3>Datos de FG TOW</h3>{issuerFields}</section>
            <section className="vendor-document-form-section">
              <h3>Condiciones del contrato</h3>
              <div className="vendor-document-grid">
                <label className="span-2">Cláusulas (una por renglón)<textarea rows={7} maxLength={8000} value={data.contractClauses} onChange={(event) => updateRoot("contractClauses", event.target.value, "contrato")} /></label>
                <label className="span-2">Garantía, servicio y reparaciones<textarea rows={4} maxLength={3000} value={data.warrantyTerms} onChange={(event) => updateRoot("warrantyTerms", event.target.value, "contrato")} /></label>
              </div>
            </section>

            <div className="vendor-document-actions">
              <button type="submit" className="button" disabled={states.contrato === "saving"}>{states.contrato === "saving" ? "Guardando…" : "Guardar contrato"}</button>
              <button type="button" className="button button-outline" onClick={() => openDocument("contrato")}>Ver contrato</button>
              <p className={`form-status ${states.contrato}`} role="status">{messages.contrato}</p>
            </div>
          </form>
        </details>

        <details className="vendor-document-card">
          <summary><span><strong>Carta factura</strong><small>Identificación de la unidad, importe y datos fiscales.</small></span><b>Desplegar</b></summary>
          <form onSubmit={(event) => submit(event, "carta-factura")} className="vendor-document-form">
            <section className="vendor-document-form-section">
              <h3>Datos de la unidad</h3>
              <p className="vendor-document-shared-note">Estos datos se comparten con el contrato; cualquier cambio se reflejará en ambos documentos.</p>
              <div className="vendor-document-grid">
                <label>Tipo de vehículo<input value={data.vehicle.vehicleType} maxLength={180} onChange={(event) => updateVehicle("vehicleType", event.target.value)} /></label>
                <label>Marca<input value={data.vehicle.brand} maxLength={100} onChange={(event) => updateVehicle("brand", event.target.value)} /></label>
                <label>Modelo / año<input value={data.vehicle.modelYear} maxLength={20} onChange={(event) => updateVehicle("modelYear", event.target.value)} /></label>
                <label>Número de serie<input value={data.vehicle.serialNumber} maxLength={100} placeholder="Cuando esté asignado" onChange={(event) => updateVehicle("serialNumber", event.target.value)} /></label>
                <label>Color<input value={data.vehicle.color} maxLength={80} onChange={(event) => updateVehicle("color", event.target.value)} /></label>
                <label>Condición<input value={data.vehicle.condition} maxLength={80} onChange={(event) => updateVehicle("condition", event.target.value)} /></label>
                <label>Peso estimado (kg)<input type="number" min={0} value={data.vehicle.weightKg} onChange={(event) => updateVehicle("weightKg", Number(event.target.value))} /></label>
                <label>Capacidad de carga (kg)<input type="number" min={0} value={data.vehicle.capacityKg} onChange={(event) => updateVehicle("capacityKg", Number(event.target.value))} /></label>
                <label className="span-2">Medidas interiores<input value={data.vehicle.interiorDimensions} maxLength={240} onChange={(event) => updateVehicle("interiorDimensions", event.target.value)} /></label>
                <label className="span-2">Medidas exteriores<input value={data.vehicle.exteriorDimensions} maxLength={240} onChange={(event) => updateVehicle("exteriorDimensions", event.target.value)} /></label>
                <label>Número de puertas<input type="number" min={0} max={20} value={data.vehicle.doorCount} onChange={(event) => updateVehicle("doorCount", Number(event.target.value))} /></label>
                <label>Número de ventanas<input type="number" min={0} max={40} value={data.vehicle.windowCount} onChange={(event) => updateVehicle("windowCount", Number(event.target.value))} /></label>
              </div>
            </section>

            <section className="vendor-document-form-section">
              <h3>Datos fiscales y factura</h3>
              <div className="vendor-document-grid">
                <label className="vendor-document-check span-2"><input type="checkbox" checked={data.fiscal.needsInvoice} onChange={(event) => updateFiscal("needsInvoice", event.target.checked)} /><span>El cliente requiere factura (CFDI)</span></label>
                {data.fiscal.needsInvoice && <>
                  <label>Nombre o razón social<input value={data.fiscal.legalName} maxLength={240} onChange={(event) => updateFiscal("legalName", event.target.value)} /></label>
                  <label>RFC<input value={data.fiscal.rfc} maxLength={20} autoCapitalize="characters" onChange={(event) => updateFiscal("rfc", event.target.value.toUpperCase())} /></label>
                  <label>Régimen fiscal<input value={data.fiscal.taxRegime} maxLength={180} onChange={(event) => updateFiscal("taxRegime", event.target.value)} /></label>
                  <label>Uso de CFDI<input value={data.fiscal.cfdiUse} maxLength={180} onChange={(event) => updateFiscal("cfdiUse", event.target.value)} /></label>
                  <label>Código postal fiscal<input value={data.fiscal.fiscalPostalCode} maxLength={10} inputMode="numeric" onChange={(event) => updateFiscal("fiscalPostalCode", event.target.value)} /></label>
                  <label>Correo de facturación<input type="email" value={data.fiscal.invoiceEmail} maxLength={160} onChange={(event) => updateFiscal("invoiceEmail", event.target.value)} /></label>
                  <label className="span-2">Domicilio fiscal<textarea rows={3} maxLength={500} value={data.fiscal.fiscalAddress} onChange={(event) => updateFiscal("fiscalAddress", event.target.value)} /></label>
                </>}
                <p className="vendor-document-security span-2">La carta factura identifica la unidad, pero no sustituye al CFDI. Confirma los datos contra la constancia de situación fiscal.</p>
              </div>
            </section>

            <section className="vendor-document-form-section"><h3>Datos de FG TOW</h3>{issuerFields}</section>
            <section className="vendor-document-form-section">
              <h3>Nota de la carta factura</h3>
              <div className="vendor-document-grid"><label className="span-2">Texto editable<textarea rows={4} maxLength={3000} value={data.invoiceLetterNotes} onChange={(event) => updateRoot("invoiceLetterNotes", event.target.value, "carta-factura")} /></label></div>
            </section>

            <div className="vendor-document-actions">
              <button type="submit" className="button" disabled={states["carta-factura"] === "saving"}>{states["carta-factura"] === "saving" ? "Guardando…" : "Guardar carta factura"}</button>
              <button type="button" className="button button-outline" onClick={() => openDocument("carta-factura")}>Ver carta factura</button>
              <p className={`form-status ${states["carta-factura"]}`} role="status">{messages["carta-factura"]}</p>
            </div>
          </form>
        </details>
      </div>
    </section>
  );
}
