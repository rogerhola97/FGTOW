import { getPricingSettings } from "./pricingSettingsDb";
import { getQuoteById } from "./quotesDb";
import { calculateVendorQuote, pricingSnapshot } from "./vendorPricing";
import { PRICING_VERSION } from "./quoteCatalog";
import { calculatePaymentPlan, resolveQuoteDocumentsData, storedPricingBreakdown } from "./quoteDocuments";
import { currentPriceArgs, quoteIdArgs } from "./aiRequestValidation";
import { authorizeSalesOperation } from "./vendorAuthorization";

export async function calculateCurrentVendorTrailerPrice(args: unknown) {
  await authorizeSalesOperation("calculate_trailer_price");
  const input = currentPriceArgs(args);
  const settings = await getPricingSettings(); // Fail closed: never silently substitute defaults on fetch errors.
  const quote = calculateVendorQuote(input.presetId, input.items, input.specialItems, input.includeIva, settings, input.discount, input.charges);
  return {
    kind: "current" as const, model: quote.preset.model, presetId: quote.preset.id, pricingVersion: PRICING_VERSION,
    ...pricingSnapshot(quote),
    accessories: [...quote.lines.map(line => ({ id: line.definition.id, price: line.linePrice, included: line.included, free: line.free })), ...quote.specialLines.map(line => ({ id: line.id, price: line.linePrice, included: line.included }))],
    charges: quote.chargeLines.map(line => ({ id: line.id, name: line.name, price: line.price })),
    payment: input.payment ? calculatePaymentPlan(quote.total, input.payment) : null,
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
