import assert from "node:assert/strict";
import test from "node:test";

import { buildCustomPresetId } from "../app/lib/quoteCatalog.ts";
import { DEFAULT_PRICING_SETTINGS } from "../app/lib/pricingSettingsShape.ts";
import { calculateVendorQuote, pricingSnapshot } from "../app/lib/vendorPricing.ts";
import { calculatePaymentPlan, defaultQuoteDocumentsData, resolveQuoteDocumentsData, storedPricingBreakdown } from "../app/lib/quoteDocuments.ts";

// Remolque de 2.00 × 3.00 m a un eje: base de 69,500 en la matriz vigente.
const presetId = buildCustomPresetId("food", 200, 300, 210, 1);
const entrepano = { instanceId: "shelf", typeId: "repisa", xCm: 0, yCm: 0, widthCm: 120, depthCm: 35, rotation: 0 };
const pintura = { id: "paint", name: "Pintura negra", price: 1000 };
const descuento = { type: "amount", value: 4000, reason: "Descuento interno" };
const halfDeposit = { schedule: "deposit_balance", depositPercent: 50, installmentCount: 1 };

function quoteFor({ charges = [], discount = null, includeIva = false } = {}) {
  return calculateVendorQuote(presetId, [entrepano], [], includeIva, DEFAULT_PRICING_SETTINGS, discount, charges);
}

function assertPlanAddsUp(plan) {
  assert.equal(Math.round((plan.deposit + plan.balance) * 100) / 100, plan.total);
}

test("base + entrepaño + pintura − descuento = 68,000 con anticipo y saldo de 34,000", () => {
  const quote = quoteFor({ charges: [pintura], discount: descuento });
  assert.equal(quote.preset.basePrice, 69500);
  assert.equal(quote.extras, 2500);
  assert.equal(quote.preDiscountSubtotal, 72000);
  assert.equal(quote.discountAmount, 4000);
  assert.equal(quote.iva, 0);
  assert.equal(quote.total, 68000);

  const plan = calculatePaymentPlan(quote.total, halfDeposit);
  assert.equal(plan.deposit, 34000);
  assert.equal(plan.balance, 34000);
  assertPlanAddsUp(plan);
});

test("sin pintura el total baja exactamente el importe del cargo", () => {
  const quote = quoteFor({ discount: descuento });
  assert.equal(quote.extras, 1500);
  assert.equal(quote.total, 67000);
  const plan = calculatePaymentPlan(quote.total, halfDeposit);
  assert.equal(plan.deposit, 33500);
  assert.equal(plan.balance, 33500);
  assertPlanAddsUp(plan);
});

test("con pintura y sin descuento el total es 72,000", () => {
  const quote = quoteFor({ charges: [pintura] });
  assert.equal(quote.total, 72000);
  const plan = calculatePaymentPlan(quote.total, halfDeposit);
  assert.equal(plan.deposit, 36000);
  assert.equal(plan.balance, 36000);
  assertPlanAddsUp(plan);
});

test("con IVA el anticipo y el saldo se calculan sobre el total con IVA", () => {
  const quote = quoteFor({ charges: [pintura], discount: descuento, includeIva: true });
  assert.equal(quote.subtotal, 68000);
  assert.equal(quote.iva, 10880);
  assert.equal(quote.total, 78880);
  const plan = calculatePaymentPlan(quote.total, halfDeposit);
  assert.equal(plan.deposit, 39440);
  assert.equal(plan.balance, 39440);
  assertPlanAddsUp(plan);
});

test("el descuento en porcentaje se aplica sobre el subtotal que ya incluye los cargos", () => {
  const quote = quoteFor({ charges: [pintura], discount: { type: "percent", value: 10, reason: null } });
  assert.equal(quote.preDiscountSubtotal, 72000);
  assert.equal(quote.discountAmount, 7200);
  assert.equal(quote.total, 64800);
});

test("porcentajes de anticipo con centavos siempre suman el total", () => {
  for (const [total, percent] of [[68000, 30], [78880, 33.33], [64801, 50], [99999.99, 17.5]]) {
    const plan = calculatePaymentPlan(total, { schedule: "deposit_balance", depositPercent: percent, installmentCount: 1 });
    assertPlanAddsUp(plan);
  }
  const monthly = calculatePaymentPlan(68000, { schedule: "deposit_installments", depositPercent: 50, installmentCount: 4 });
  assert.equal(monthly.installmentAmount, 8500);
  const full = calculatePaymentPlan(68000, { schedule: "full", depositPercent: 50, installmentCount: 1 });
  assert.equal(full.deposit, 0);
  assert.equal(full.balance, 68000);
});

const storedQuote = (total, configuration = {}, documentData = {}) => ({
  quote_number: "FG-TEST", name: "Cliente", phone: "", email: "", city: "Monterrey", state: "Nuevo León",
  trailer_preset: presetId, model: "food", configuration, total, include_iva: false, vendor_email: null, document_data: documentData,
});

test("el contrato usa el total guardado y no importes capturados a mano", () => {
  const quote = quoteFor({ charges: [pintura], discount: descuento });
  const legacy = { payment: { schedule: "deposit_balance", depositAmount: 35250, balanceAmount: 35250 } };
  const data = resolveQuoteDocumentsData(storedQuote(quote.total, {}, legacy));
  assert.equal(data.payment.depositPercent, 50);
  assert.equal("depositAmount" in data.payment, false);
  const plan = calculatePaymentPlan(quote.total, data.payment);
  assert.equal(plan.deposit, 34000);
  assert.equal(plan.balance, 34000);

  assert.equal(defaultQuoteDocumentsData(storedQuote(quote.total)).payment.depositPercent, 50);
});

test("el desglose guardado lista la pintura y sólo se muestra si coincide con el total", () => {
  const quote = quoteFor({ charges: [pintura], discount: descuento });
  const configuration = { charges: [pintura], pricing: pricingSnapshot(quote) };
  const breakdown = storedPricingBreakdown(configuration, quote.total);
  assert.deepEqual(breakdown.lines.map((line) => line.price), [1500, 1000]);
  assert.equal(breakdown.lines[1].name, "Pintura negra");
  assert.equal(breakdown.extras, 2500);
  assert.equal(breakdown.total, 68000);
  assert.equal(storedPricingBreakdown(configuration, 67000), null);
  assert.equal(storedPricingBreakdown({}, 68000), null);

  const data = defaultQuoteDocumentsData(storedQuote(quote.total, { items: [entrepano], charges: [pintura] }));
  assert.match(data.vehicle.description, /Pintura negra/);
});
