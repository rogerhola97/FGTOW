// Server-side routing only: these rules select a tool, never calculate prices.
export function shouldForcePricingTool(message: string, quoteId: number | null = null): boolean {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const calculate = /\b(?:calcula|calculame|calcular|calculo|cotiza|cotizame|cotizar)\b/.test(text);
  const amounts = /\b(?:precios?|total(?:es)?|iva|anticipos?|saldos?)\b|\bcuanto\s+cuesta(?:n)?\b|\bplan(?:es)?\s+de\s+pagos?\b/.test(text);
  if (!calculate && !amounts) return false;

  // Writing, explanations and catalog browsing alone must remain automatic.
  const nonCalculation = /\b(?:redacta|redactame|redactar|escribe|escribeme|explica|explicame|explicar)\b|\b(?:que\s+modelos|que\s+accesorios|lista\s+(?:de\s+)?accesorios)\b/.test(text);
  if (nonCalculation && !calculate) return false;

  // A saved record is read with the historical tools, even if it mentions amounts.
  const newQuote = /\b(?:nueva\s+cotizacion|cotizacion\s+nueva|nuevo\s+precio|precio\s+nuevo)\b/.test(text);
  const historical = /\bcotizacion(?:es)?\s*(?:#\s*)?\d+\b|\b(?:esta|esa)\s+cotizacion\b|\b(?:guardad[ao]s?|historic[ao]s?|historial)\b|\bcuanto\s+costo\b/.test(text);
  if (historical && !newQuote) return false;

  // An attached quote is historical by default. Only an explicit NEW/current
  // calculation can override that context; the saved record is never repriced.
  const currentPrice = /\bprecios?\s+(?:vigentes?|actual(?:es)?)\b/.test(text);
  if (quoteId !== null && !newQuote && !currentPrice) return false;
  return true;
}
