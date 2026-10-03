import { getPricingSettings } from "./pricingSettingsDb";
import { getQuoteById } from "./quotesDb";
import { calculateVendorQuote, pricingSnapshot } from "./vendorPricing";
import { PRICING_VERSION } from "./quoteCatalog";
import { calculatePaymentPlan, DEFAULT_DEPOSIT_PERCENT, resolveQuoteDocumentsData, storedPricingBreakdown } from "./quoteDocuments";
import { AiValidationError, currentPriceArgs, quoteIdArgs, type CurrentPriceInput } from "./aiRequestValidation";
import { authorizeSalesOperation } from "./vendorAuthorization";
import { resolveCurrentPriceConfiguration } from "./aiTrailerConfiguration";
import { AiToolError } from "./aiToolErrors";

export async function calculateCurrentVendorTrailerPrice(args: unknown) {
  await authorizeSalesOperation("calculate_trailer_price");
  let input: CurrentPriceInput;
  try { input = currentPriceArgs(resolveCurrentPriceConfiguration(args)); }
  catch (error) {
    if (error instanceof AiToolError) throw error;
    throw new AiToolError(error instanceof AiValidationError ? "INVALID_TOOL_ARGUMENTS" : "INVALID_TRAILER_CONFIGURATION", error instanceof AiValidationError ? "arguments" : "trailer-configuration");
  }
  if (input.payment === "default_deposit" && (!Number.isFinite(DEFAULT_DEPOSIT_PERCENT) || DEFAULT_DEPOSIT_PERCENT < 0 || DEFAULT_DEPOSIT_PERCENT > 100)) {
    throw new AiToolError("PAYMENT_CONFIGURATION_ERROR", "payment-configuration", ["depositPercent"]);
  }
  // This selector requests the existing deposit percentage; it does not change document defaults.
  const payment = input.payment === "default_deposit"
    ? { schedule: "deposit_balance" as const, depositPercent: DEFAULT_DEPOSIT_PERCENT, installmentCount: 1 }
    : input.payment;
  let settings: Awaited<ReturnType<typeof getPricingSettings>>;
  try { settings = await getPricingSettings(); } // Never silently substitute defaults on fetch errors.
  catch { throw new AiToolError("PRICING_ERROR", "pricing-settings"); }
  let quote: ReturnType<typeof calculateVendorQuote<CurrentPriceInput["specialItems"][number]>>;
  try {
    quote = calculateVendorQuote(input.presetId, input.items, input.specialItems, input.includeIva, settings, input.discount, input.charges);
    if (!Object.values(pricingSnapshot(quote)).filter(value => typeof value === "number").every(Number.isFinite)) throw new Error("Invalid calculation");
  } catch { throw new AiToolError("PRICING_ERROR", "pricing-calculation"); }
  let paymentPlan: ReturnType<typeof calculatePaymentPlan> | null = null;
  if (payment) {
    try {
      paymentPlan = calculatePaymentPlan(quote.total, payment);
      if (![paymentPlan.depositPercent, paymentPlan.deposit, paymentPlan.balance, paymentPlan.installmentAmount].every(Number.isFinite)) throw new Error("Invalid payment calculation");
    } catch { throw new AiToolError("PAYMENT_CONFIGURATION_ERROR", "payment-calculation"); }
  }
  return {
    kind: "current" as const, model: quote.preset.model, pricingVersion: PRICING_VERSION,
    configuration: { widthCm: quote.preset.widthCm, lengthCm: quote.preset.lengthCm, heightCm: quote.preset.heightCm, axles: quote.preset.axles },
    ...pricingSnapshot(quote),
    accessories: [...quote.lines.map(line => ({ id: line.definition.id, price: line.linePrice, included: line.included, free: line.free })), ...quote.specialLines.map(line => ({ id: line.id, price: line.linePrice, included: line.included }))],
    charges: quote.chargeLines.map(line => ({ id: line.id, name: line.name, price: line.price })),
    payment: paymentPlan,
  };
}

export async function getHistoricalVendorQuote(args: unknown, operation: "get_quote" | "get_quote_summary" = "get_quote") {
  await authorizeSalesOperation(operation);
  const { quoteId } = quoteIdArgs(args);
  const quote = await getQuoteById(quoteId);
  if (!quote) return null;
  const configuration = quote.configuration && typeof quote.configuration === "object" ? quote.configuration as Record<string, unknown> : {};
  const data = resolveQuoteDocumentsData(quote);
  // Only an explicit commercial projection escapes this service. No historical price calculation.
  return {
    kind: "historical" as const, quoteId: quote.id, quoteNumber: quote.quote_number, version: quote.version,
    model: quote.model, presetId: quote.trailer_preset, stage: quote.pipeline_stage ?? "cotizacion",
    subtotal: Number(quote.subtotal), iva: Number(quote.iva), total: Number(quote.total), includeIva: quote.include_iva,
    pricingVersion: typeof configuration.pricingVersion === "number" ? configuration.pricingVersion : null,
    breakdown: storedPricingBreakdown(configuration, Number(quote.total)),
    payment: calculatePaymentPlan(Number(quote.total), data.payment),
  };
}
