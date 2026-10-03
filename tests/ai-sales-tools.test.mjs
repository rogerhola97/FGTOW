import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { DEFAULT_PRICING_SETTINGS } from "../app/lib/pricingSettingsShape.ts";
import { calculateVendorQuote } from "../app/lib/vendorPricing.ts";
import { calculateQuote } from "../app/lib/quoteCatalog.ts";

// Replace only server I/O modules. Pricing, validation, payment and tool code remain real.
const state = globalThis.__salesTestState = {
  session: { id: "vendor-1", email: "sales@example.test", name: "Sales", exp: Date.now() + 10000 },
  account: { id: "vendor-1", email: "sales@example.test", name: "Sales", active: true },
  settings: { ...DEFAULT_PRICING_SETTINGS, equipment_price_overrides: {}, extra_equipment_price: 3100 },
  settingsCalls: 0, quoteCalls: 0, failSettings: false,
  quote: { id: 7, quote_number: "FGT-HISTORICAL", version: 1, model: "food", trailer_preset: "custom-food-200-300-210-1", subtotal: 111, iva: 0, total: 111, include_iva: false, configuration: {}, document_data: { payment: { schedule: "deposit_balance", depositPercent: 50 }, signatures: { customer: { image: "SENSITIVE" } }, fiscal: { rfc: "SENSITIVE" }, bank: "SENSITIVE" }, name: "SENSITIVE", phone: "SENSITIVE", email: "SENSITIVE", city: "City", state: "State", vendor_email: "SENSITIVE", reference_image_files: [{ path: "SENSITIVE" }] },
};
const hook = registerHooks({ load(url, context, nextLoad) {
  const prelude = "const state = globalThis.__salesTestState;";
  let source;
  if (url.endsWith("/vendorAuth.ts")) source = prelude + "export async function getVendor(){return state.session;} export async function findVendorByEmail(){return state.account;}";
  if (url.endsWith("/pricingSettingsDb.ts")) source = prelude + "export async function getPricingSettings(){state.settingsCalls++; if(state.failSettings) throw new Error('unavailable'); return state.settings;}";
  if (url.endsWith("/quotesDb.ts")) source = prelude + "export async function getQuoteById(){state.quoteCalls++; return state.quote;}";
  return source ? { format: "module", source, shortCircuit: true } : nextLoad(url, context);
} });
const tools = await import("../app/lib/aiSalesTools.ts");
const { authorizeSalesOperation } = await import("../app/lib/vendorAuthorization.ts");
const input = () => ({ model: "food", presetId: "custom-food-200-300-210-1", items: [{ instanceId: "shelf", typeId: "repisa-alta", xCm: 10, yCm: 10, widthCm: 90, depthCm: 30, rotation: 0 }], includeIva: true, charges: [{ id: "paint", name: "Paint", price: 1000 }], discount: { type: "percent", value: 10 }, payment: { schedule: "deposit_balance", depositPercent: 50, installmentCount: 1 } });

test("current tool delegates to real vendor pricing and server settings", async () => {
  const args = input();
  // Resolve a real accessory from the catalog rather than relying on fixture names.
  const { getEquipmentForModel } = await import("../app/lib/quoteCatalog.ts");
  const shelf = getEquipmentForModel("food").find(entry => entry.fixedPrice && entry.vendorPriceEditable);
  args.items[0] = { instanceId: "shelf", typeId: shelf.id, xCm: 10, yCm: 10, widthCm: shelf.widthCm, depthCm: shelf.depthCm, rotation: 0 };
  const result = await tools.calculate_trailer_price(args);
  const expected = calculateVendorQuote(args.presetId, args.items, [], true, state.settings, { ...args.discount, reason: null }, args.charges);
  assert.equal(result.total, expected.total);
  assert.equal(result.iva, expected.iva);
  assert.equal(result.discountAmount, expected.discountAmount);
  assert.equal(result.payment.deposit + result.payment.balance, expected.total);
  assert.ok(state.settingsCalls > 0);
});
test("invalid dimensions and model mismatch fail before settings I/O", async () => {
  await assert.rejects(tools.calculate_trailer_price({ ...input(), presetId: "custom-food-200-210-210-1" }), /Medidas/);
  await assert.rejects(tools.calculate_trailer_price({ ...input(), model: "cargo" }), /modelo/);
});
test("unknown accessories and unauthorized prices are rejected", async () => {
  const args = input(); args.items[0].typeId = "invented";
  await assert.rejects(tools.calculate_trailer_price(args), /Accesorio/);
  args.items[0] = { ...args.items[0], typeId: "plancha", widthCm: 90, depthCm: 50, customPrice: 1 };
  await assert.rejects(tools.calculate_trailer_price(args), /precio manual/);
});
test("historical reads use saved totals without settings or repricing and omit sensitive fields", async () => {
  const before = state.settingsCalls;
  const result = await tools.get_quote({ quoteId: 7 });
  const summary = await tools.get_quote_summary({ quoteId: 7 });
  assert.equal(result.total, 111); assert.equal(summary.total, 111);
  assert.equal(summary.payment.deposit, 55.5);
  assert.equal(state.settingsCalls, before);
  assert.doesNotMatch(JSON.stringify([result, summary]), /SENSITIVE|rfc|signatures|bank|files|signedURL|email|phone/i);
});
test("client identity fields and arbitrary properties are rejected", async () => {
  for (const field of ["vendorId", "vendorEmail", "vendorName", "settings", "basePrice"]) {
    await assert.rejects(tools.get_quote({ quoteId: 7, [field]: "forged" }), /campos/);
  }
  await assert.rejects(tools.get_trailer_catalog({ model: "food", vendorId: "forged" }), /campos/);
});
test("absent, inactive and mismatched accounts cannot read quotes", async () => {
  const before = state.quoteCalls;
  const session = state.session;
  try {
    state.session = null; await assert.rejects(tools.get_quote({ quoteId: 7 }), error => error.status === 401);
    state.session = session; state.account.active = false;
    await assert.rejects(tools.get_quote({ quoteId: 7 }), error => error.status === 403);
    state.account.active = true; state.account.id = "other";
    await assert.rejects(tools.get_quote({ quoteId: 7 }), error => error.status === 403);
    await assert.rejects(authorizeSalesOperation("delete_quote"), error => error.status === 403);
    assert.equal(state.quoteCalls, before);
  } finally { state.session = session; state.account.active = true; state.account.id = session.id; }
});
test("catalog and accessories derive from existing rules and server tariffs", async () => {
  const catalog = await tools.get_trailer_catalog({ model: "food" });
  assert.equal(catalog.quickModels.length, 4);
  assert.ok(!catalog.dimensions.some(entry => entry.lengthCm === 210));
  const accessories = await tools.get_accessories({ model: "food" });
  assert.equal(accessories.accessories.find(entry => entry.id === "plancha").unitPrice, 3100);
  assert.equal(accessories.accessories.find(entry => entry.id === "base-gas").unitPrice, 0);
});
test("array limits and strict numeric identifiers are enforced", async () => {
  await assert.rejects(tools.get_quote({ quoteId: "7" }), /Número/);
  await assert.rejects(tools.calculate_trailer_price({ ...input(), items: Array(41).fill({}) }), /Lista/);
});
test("public and vendor baseline remain consistent under original defaults", () => {
  const id = "custom-food-200-300-210-1";
  assert.equal(calculateQuote(id, [], [], false).total, 69500);
  assert.equal(calculateVendorQuote(id, [], [], false, DEFAULT_PRICING_SETTINGS).total, 69500);
});
test("pricing failures are propagated without silently using defaults", async () => {
  state.failSettings = true;
  try { await assert.rejects(tools.calculate_trailer_price({ ...input(), items: [] }), /unavailable/); }
  finally { state.failSettings = false; }
});
test("authorized manual accessory prices still use the existing vendor calculation", async () => {
  const { getEquipmentForModel } = await import("../app/lib/quoteCatalog.ts");
  const definition = getEquipmentForModel("food").find(entry => entry.vendorPriceEditable);
  const args = { ...input(), items: [{ instanceId: "manual", typeId: definition.id, xCm: 10, yCm: 10, widthCm: definition.widthCm, depthCm: definition.depthCm, rotation: 0, customPrice: 1234 }] };
  const result = await tools.calculate_trailer_price(args);
  const expected = calculateVendorQuote(args.presetId, args.items, [], true, state.settings, { ...args.discount, reason: null }, args.charges);
  assert.equal(result.total, expected.total);
  assert.equal(result.accessories[0].price, 1234);
});
test("Cargo and RZR calculation tools match the same vendor engine", async () => {
  for (const [model, presetId] of [["cargo", "custom-cargo-200-350-210-1"], ["rzr", "rz-194-360"]]) {
    const args = { model, presetId, items: [], includeIva: false };
    const result = await tools.calculate_trailer_price(args);
    assert.equal(result.total, calculateVendorQuote(presetId, [], [], false, state.settings).total);
  }
});
test.after(() => { hook.deregister(); delete globalThis.__salesTestState; });
