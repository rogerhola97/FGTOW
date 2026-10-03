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
  settingsCalls: 0, quoteCalls: 0, failSettings: false, failPayment: false, paymentCalls: [],
  quote: { id: 7, quote_number: "FGT-HISTORICAL", version: 1, model: "food", trailer_preset: "custom-food-200-300-210-1", subtotal: 111, iva: 0, total: 111, include_iva: false, configuration: {}, document_data: { payment: { schedule: "deposit_balance", depositPercent: 50 }, signatures: { customer: { image: "SENSITIVE" } }, fiscal: { rfc: "SENSITIVE" }, bank: "SENSITIVE" }, name: "SENSITIVE", phone: "SENSITIVE", email: "SENSITIVE", city: "City", state: "State", vendor_email: "SENSITIVE", reference_image_files: [{ path: "SENSITIVE" }] },
};
const hook = registerHooks({ load(url, context, nextLoad) {
  const prelude = "const state = globalThis.__salesTestState;";
  let source;
  if (url.endsWith("/vendorAuth.ts")) source = prelude + "export async function getVendor(){return state.session;} export async function findVendorByEmail(){return state.account;}";
  if (url.endsWith("/pricingSettingsDb.ts")) source = prelude + "export async function getPricingSettings(){state.settingsCalls++; if(state.failSettings) throw new Error('unavailable'); return state.settings;}";
  if (url.endsWith("/quotesDb.ts")) source = prelude + "export async function getQuoteById(){state.quoteCalls++; return state.quote;}";
  if (url.endsWith("/quoteDocuments.ts")) {
    const actual = JSON.stringify(`${url}?actual-payment-rules`);
    source = `export * from ${actual}; import { DEFAULT_DEPOSIT_PERCENT as actualDefault, calculatePaymentPlan as actualCalculatePaymentPlan } from ${actual}; ${prelude} export let DEFAULT_DEPOSIT_PERCENT = actualDefault; export function setTestDefault(value){DEFAULT_DEPOSIT_PERCENT=value;} export function calculatePaymentPlan(total,payment){state.paymentCalls.push({total,payment:structuredClone(payment)});if(state.failPayment)throw new Error('PRIVATE_PAYMENT SQL SECRET');return actualCalculatePaymentPlan(total,payment);}`;
  }
  return source ? { format: "module", source, shortCircuit: true } : nextLoad(url, context);
} });
const tools = await import("../app/lib/aiSalesTools.ts");
const paymentRules = await import("../app/lib/quoteDocuments.ts");
const { currentPriceArgs } = await import("../app/lib/aiRequestValidation.ts");
const { getPreset, buildCustomPresetId, FOOD_QUICK_MODELS } = await import("../app/lib/quoteCatalog.ts");
const { resolveCurrentPriceConfiguration } = await import("../app/lib/aiTrailerConfiguration.ts");
const { safeToolFailure } = await import("../app/lib/aiToolErrors.ts");
const { authorizeSalesOperation } = await import("../app/lib/vendorAuthorization.ts");
const input = () => ({ model: "food", widthCm: 200, lengthCm: 300, heightCm: 210, axles: 1, items: [{ instanceId: "shelf", typeId: "repisa-alta", xCm: 10, yCm: 10, widthCm: 90, depthCm: 30, rotation: 0 }], includeIva: true, charges: [{ id: "paint", name: "Paint", price: 1000 }], discount: { type: "percent", value: 10 }, payment: { schedule: "deposit_balance", depositPercent: 50, installmentCount: 1 } });

test("current tool delegates to real vendor pricing and server settings", async () => {
  const args = input();
  // Resolve a real accessory from the catalog rather than relying on fixture names.
  const { getEquipmentForModel } = await import("../app/lib/quoteCatalog.ts");
  const shelf = getEquipmentForModel("food").find(entry => entry.fixedPrice && entry.vendorPriceEditable);
  args.items[0] = { instanceId: "shelf", typeId: shelf.id, xCm: 10, yCm: 10, widthCm: shelf.widthCm, depthCm: shelf.depthCm, rotation: 0 };
  const result = await tools.calculate_trailer_price(args);
  const expected = calculateVendorQuote(buildCustomPresetId(args.model, args.widthCm, args.lengthCm, args.heightCm, args.axles), args.items, [], true, state.settings, { ...args.discount, reason: null }, args.charges);
  assert.equal(result.total, expected.total);
  assert.equal(result.iva, expected.iva);
  assert.equal(result.discountAmount, expected.discountAmount);
  assert.equal(result.payment.deposit + result.payment.balance, expected.total);
  assert.ok(state.settingsCalls > 0);
});
test("invalid dimensions and model mismatch fail before settings I/O", async () => {
  await assert.rejects(tools.calculate_trailer_price({ ...input(), lengthCm: 210 }), error => error.code === "INVALID_TRAILER_CONFIGURATION");
  await assert.rejects(tools.calculate_trailer_price({ ...input(), model: "cargo", quickModelId: "compact-250" }), error => error.code === "INVALID_TRAILER_CONFIGURATION");
});
test("unknown accessories and unauthorized prices are rejected", async () => {
  const args = input(); args.items[0].typeId = "invented";
  await assert.rejects(tools.calculate_trailer_price(args), error => error.code === "INVALID_TOOL_ARGUMENTS");
  args.items[0] = { ...args.items[0], typeId: "plancha", widthCm: 90, depthCm: 50, customPrice: 1 };
  await assert.rejects(tools.calculate_trailer_price(args), error => error.code === "INVALID_TOOL_ARGUMENTS");
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
  await assert.rejects(tools.calculate_trailer_price({ ...input(), items: Array(41).fill({}) }), error => error.code === "INVALID_TOOL_ARGUMENTS");
});
test("public and vendor baseline remain consistent under original defaults", () => {
  const id = "custom-food-200-300-210-1";
  assert.equal(calculateQuote(id, [], [], false).total, 69500);
  assert.equal(calculateVendorQuote(id, [], [], false, DEFAULT_PRICING_SETTINGS).total, 69500);
});
test("pricing failures are propagated without silently using defaults", async () => {
  state.failSettings = true;
  try { await assert.rejects(tools.calculate_trailer_price({ ...input(), items: [] }), error => error.code === "PRICING_ERROR" && error.stage === "pricing-settings" && !error.message.includes("unavailable")); }
  finally { state.failSettings = false; }
});
test("authorized manual accessory prices still use the existing vendor calculation", async () => {
  const { getEquipmentForModel } = await import("../app/lib/quoteCatalog.ts");
  const definition = getEquipmentForModel("food").find(entry => entry.vendorPriceEditable);
  const args = { ...input(), items: [{ instanceId: "manual", typeId: definition.id, xCm: 10, yCm: 10, widthCm: definition.widthCm, depthCm: definition.depthCm, rotation: 0, customPrice: 1234 }] };
  const result = await tools.calculate_trailer_price(args);
  const expected = calculateVendorQuote(buildCustomPresetId(args.model, args.widthCm, args.lengthCm, args.heightCm, args.axles), args.items, [], true, state.settings, { ...args.discount, reason: null }, args.charges);
  assert.equal(result.total, expected.total);
  assert.equal(result.accessories[0].price, 1234);
});
test("Cargo and RZR calculation tools match the same vendor engine", async () => {
  for (const [model, presetId] of [["cargo", "custom-cargo-200-350-210-1"], ["rzr", "rz-194-360"]]) {
    const preset = getPreset(presetId);
    const args = { model, widthCm: preset.widthCm, lengthCm: preset.lengthCm, heightCm: preset.heightCm, axles: preset.axles, items: [], includeIva: false };
    const result = await tools.calculate_trailer_price(args);
    assert.equal(result.total, calculateVendorQuote(presetId, [], [], false, state.settings).total);
  }
});
const compactInput = () => ({ model: "food", quickModelId: "compact-250", items: [], specialItems: [], includeIva: true, charges: [] });

test("Compact 250 price remains 63220 with IVA and no requested payment plan", async () => {
  const result = await tools.calculate_trailer_price(compactInput());
  assert.equal(result.basePrice, 54500);
  assert.equal(result.subtotal, 54500);
  assert.equal(result.iva, 8720);
  assert.equal(result.total, 63220);
  assert.equal(result.payment, null);
});

test("requested default deposit uses the official percentage and real payment calculator", async () => {
  const result = await tools.calculate_trailer_price({ ...compactInput(), payment: "default_deposit" });
  const expected = paymentRules.calculatePaymentPlan(63220, { schedule: "deposit_balance", depositPercent: paymentRules.DEFAULT_DEPOSIT_PERCENT, installmentCount: 1 });
  assert.deepEqual(result.payment, expected);
  assert.equal(result.payment.deposit, 31610);
  assert.equal(result.payment.balance, 31610);
  assert.equal(result.payment.depositPercent, paymentRules.DEFAULT_DEPOSIT_PERCENT);
  assert.equal(result.payment.hasInstallments, false);
  assert.equal(result.payment.deposit + result.payment.balance, result.total);
});

test("exact FG Compact 250 tool call preserves default_deposit through validation and calls the real payment calculator", async () => {
  const compact = FOOD_QUICK_MODELS.find(entry => entry.name === "FG Compact 250");
  assert.ok(compact);
  const presetId = buildCustomPresetId("food", compact.widthCm, compact.lengthCm, compact.heightCm, 1);
  assert.equal(presetId, "custom-food-180-250-210-1");
  const preset = getPreset(presetId);
  assert.deepEqual([preset.model, preset.widthCm, preset.lengthCm, preset.heightCm, preset.axles], ["food", 180, 250, 210, 1]);
  const args = { model: "food", quickModelId: compact.id, includeIva: true, payment: "default_deposit" };
  const resolved = resolveCurrentPriceConfiguration(args);
  assert.equal(resolved.presetId, presetId);
  assert.equal(currentPriceArgs(resolved).payment, "default_deposit");
  const before = state.paymentCalls.length;
  const calculated = await tools.calculate_trailer_price(args);
  assert.deepEqual({ basePrice: calculated.basePrice, iva: calculated.iva, total: calculated.total, depositPercent: calculated.payment.depositPercent, deposit: calculated.payment.deposit, balance: calculated.payment.balance }, { basePrice: 54500, iva: 8720, total: 63220, depositPercent: 50, deposit: 31610, balance: 31610 });
  assert.deepEqual(state.paymentCalls.slice(before), [{ total: 63220, payment: { schedule: "deposit_balance", depositPercent: paymentRules.DEFAULT_DEPOSIT_PERCENT, installmentCount: 1 } }]);
  assert.equal(Object.hasOwn(calculated, "presetId"), false);
  assert.deepEqual(calculated.configuration, { widthCm: 180, lengthCm: 250, heightCm: 210, axles: 1 });
});

test("invalid quick-model IDs are rejected while nullable door is accepted without bypassing unknown-field checks", async () => {
  const args = { ...compactInput(), discount: null, payment: "default_deposit" };
  const before = state.settingsCalls;
  await assert.rejects(tools.calculate_trailer_price({ ...args, quickModelId: "unknown" }), error => error.code === "INVALID_TRAILER_CONFIGURATION");
  await assert.rejects(tools.calculate_trailer_price({ ...args, door: { wall: "front", offsetCm: 0, widthCm: 60, unknown: null } }), error => error.code === "INVALID_TRAILER_CONFIGURATION");
  assert.equal(state.settingsCalls, before);
  assert.equal((await tools.calculate_trailer_price({ ...args, door: null })).payment.deposit, 31610);
});

test("explicit Compact 250 dimensions produce exactly the same result as the quick-model adapter", async () => {
  const quick = await tools.calculate_trailer_price({ model: "food", quickModelId: "compact-250", includeIva: true, payment: "default_deposit" });
  const explicit = await tools.calculate_trailer_price({ model: "food", quickModelId: null, widthCm: 180, lengthCm: 250, heightCm: 210, axles: 1, includeIva: true, payment: "default_deposit", discount: null, door: null });
  assert.deepEqual(explicit, quick);
});

test("invalid or incomplete dimensions fail before I/O instead of snapping or inventing a configuration", async () => {
  const before = state.settingsCalls;
  const args = { model: "food", widthCm: 180, lengthCm: 250, heightCm: 210, axles: 1, includeIva: true };
  for (const invalid of [{ widthCm: 190 }, { lengthCm: 210 }, { heightCm: 211 }, { axles: 3 }, { axles: 0 }, { widthCm: "180" }, { lengthCm: 250.5 }]) {
    await assert.rejects(tools.calculate_trailer_price({ ...args, ...invalid }), error => error.code === "INVALID_TRAILER_CONFIGURATION");
  }
  await assert.rejects(tools.calculate_trailer_price({ model: "food", widthCm: 180, includeIva: true }), error => {
    assert.equal(error.code, "INVALID_TRAILER_CONFIGURATION");
    assert.deepEqual(error.missingFields, ["lengthCm", "heightCm", "axles"]);
    return true;
  });
  assert.equal(state.settingsCalls, before);
});

test("quick-model conflicts are rejected explicitly and compatible dimensions are accepted", async () => {
  const before = state.settingsCalls;
  for (const conflict of [{ widthCm: 200 }, { lengthCm: 300 }, { heightCm: 220 }, { axles: 2 }]) {
    await assert.rejects(tools.calculate_trailer_price({ ...compactInput(), ...conflict }), error => error.code === "INVALID_TRAILER_CONFIGURATION");
  }
  assert.equal(state.settingsCalls, before);
  const result = await tools.calculate_trailer_price({ ...compactInput(), widthCm: 180, lengthCm: 250, heightCm: 210, axles: 1 });
  assert.equal(result.total, 63220);
});

test("every quick model resolves dimensions and initial axles exclusively from the catalog", async () => {
  const catalog = await tools.get_trailer_catalog({ model: "food" });
  for (const quick of catalog.quickModels) {
    const result = await tools.calculate_trailer_price({ model: "food", quickModelId: quick.id, includeIva: false });
    assert.deepEqual(result.configuration, { widthCm: quick.widthCm, lengthCm: quick.lengthCm, heightCm: quick.heightCm, axles: quick.axles });
    const id = buildCustomPresetId("food", quick.widthCm, quick.lengthCm, quick.heightCm, quick.axles);
    assert.equal(result.total, calculateVendorQuote(id, [], [], false, state.settings).total);
  }
});

test("pricing and payment calculation exceptions produce safe structured errors without raw messages", async () => {
  const original = state.settings;
  try {
    state.settings = { ...original, equipment_price_overrides: null };
    await assert.rejects(tools.calculate_trailer_price(input()), error => {
      assert.equal(error.code, "PRICING_ERROR");
      assert.equal(error.stage, "pricing-calculation");
      return true;
    });
  } finally { state.settings = original; }
  state.failPayment = true;
  try {
    await assert.rejects(tools.calculate_trailer_price({ ...compactInput(), payment: "default_deposit" }), error => {
      assert.equal(error.code, "PAYMENT_CONFIGURATION_ERROR");
      assert.equal(error.stage, "payment-calculation");
      const safe = safeToolFailure(error);
      assert.equal(safe.error.retryable, true);
      assert.doesNotMatch(JSON.stringify(safe), /PRIVATE_|SQL|SECRET|stack/);
      return true;
    });
  } finally { state.failPayment = false; }
});

test("explicit deposit and installments continue to use existing payment rules", async () => {
  const payment = { schedule: "deposit_installments", depositPercent: 30, installmentCount: 4 };
  const result = await tools.calculate_trailer_price({ ...compactInput(), payment });
  assert.deepEqual(result.payment, paymentRules.calculatePaymentPlan(result.total, payment));
  assert.equal(result.payment.deposit, 18966);
  assert.equal(result.payment.balance, 44254);
  assert.equal(result.payment.installmentAmount, 11063.5);
});

test("AI cannot override base price or invent a missing explicit payment percentage", async () => {
  const before = state.settingsCalls;
  for (const field of ["basePrice", "price", "total", "presetId"]) await assert.rejects(tools.calculate_trailer_price({ ...compactInput(), [field]: 1 }), error => error.code === "INVALID_TOOL_ARGUMENTS");
  await assert.rejects(tools.calculate_trailer_price({ ...compactInput(), payment: { schedule: "deposit_balance", installmentCount: 1 } }), error => error.code === "PAYMENT_CONFIGURATION_ERROR" && error.missingFields.includes("depositPercent"));
  assert.equal(state.settingsCalls, before);
});

test("missing official deposit default fails closed without inventing a percentage", async () => {
  const original = paymentRules.DEFAULT_DEPOSIT_PERCENT;
  const before = state.settingsCalls;
  paymentRules.setTestDefault(undefined);
  try {
    await assert.rejects(tools.calculate_trailer_price({ ...compactInput(), payment: "default_deposit" }), error => error.code === "PAYMENT_CONFIGURATION_ERROR" && error.missingFields.includes("depositPercent"));
    assert.equal(state.settingsCalls, before);
    const explicit = { schedule: "deposit_balance", depositPercent: 30, installmentCount: 1 };
    const result = await tools.calculate_trailer_price({ ...compactInput(), payment: explicit });
    assert.deepEqual(result.payment, paymentRules.calculatePaymentPlan(result.total, explicit));
  } finally { paymentRules.setTestDefault(original); }
});

test("historical payment percentage and amounts stay saved rather than using current default", async () => {
  const original = state.quote.document_data.payment;
  const before = state.settingsCalls;
  state.quote.document_data.payment = { schedule: "deposit_balance", depositPercent: 25, installmentCount: 1 };
  try {
    const result = await tools.get_quote_summary({ quoteId: 7 });
    assert.equal(result.total, 111);
    assert.equal(result.payment.depositPercent, 25);
    assert.equal(result.payment.deposit, 27.75);
    assert.equal(result.payment.balance, 83.25);
    assert.equal(state.settingsCalls, before);
  } finally { state.quote.document_data.payment = original; }
});

test.after(() => { hook.deregister(); delete globalThis.__salesTestState; });
