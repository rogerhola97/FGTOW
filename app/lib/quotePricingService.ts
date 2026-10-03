import { getPricingSettings } from "./pricingSettingsDb";
import { getQuoteById } from "./quotesDb";
import { calculateVendorQuote, pricingSnapshot } from "./vendorPricing";
import { PRICING_VERSION } from "./quoteCatalog";
import { calculatePaymentPlan, DEFAULT_DEPOSIT_PERCENT, resolveQuoteDocumentsData, storedPricingBreakdown } from "./quoteDocuments";
import { AiValidationError, currentPriceArgs, quoteIdArgs } from "./aiRequestValidation";
import { authorizeSalesOperation } from "./vendorAuthorization";

export async function calculateCurrentVendorTrailerPrice(args: unknown) {
  await authorizeSalesOperation("calculate_trailer_price");
  const input = currentPriceArgs(args);
  if (input.payment === "default_deposit" && (!Number.isFinite(DEFAULT_DEPOSIT_PERCENT) || DEFAULT_DEPOSIT_PERCENT < 0 || DEFAULT_DEPOSIT_PERCENT > 100)) {
    throw new AiValidationError("No hay un porcentaje de anticipo predeterminado disponible. Solicita el porcentaje al vendedor.");
  }
  // This selector requests the existing deposit percentage; it does not change document defaults.
  const payment = input.payment === "default_deposit"
    ? { schedule: "deposit_balance" as const, depositPercent: DEFAULT_DEPOSIT_PERCENT, installmentCount: 1 }
    : input.payment;
  const settings = await getPricingSettings(); // Fail closed: never silently substitute defaults on fetch errors.
  const quote = calculateVendorQuote(input.presetId, input.items, input.specialItems, input.includeIva, settings, input.discount, input.charges);
  return {
    kind: "current" as const, model: quote.preset.model, presetId: quote.preset.id, pricingVersion: PRICING_VERSION,
    ...pricingSnapshot(quote),
    accessories: [...quote.lines.map(line => ({ id: line.definition.id, price: line.linePrice, included: line.included, free: line.free })), ...quote.specialLines.map(line => ({ id: line.id, price: line.linePrice, included: line.included }))],
    charges: quote.chargeLines.map(line => ({ id: line.id, name: line.name, price: line.price })),
    payment: payment ? calculatePaymentPlan(quote.total, payment) : null,
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
