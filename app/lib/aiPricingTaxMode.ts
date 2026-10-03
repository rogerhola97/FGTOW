export type PricingTaxMode = "with_iva" | "without_iva" | "both";

// Request-local server policy. Historical queries do not use this selector.
export function resolvePricingTaxMode(message: string): PricingTaxMode {
  const text = message.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/\b(?:ambos|ambas|las dos opciones|las dos variantes|los dos escenarios|con y sin iva|sin y con iva)\b/.test(text)) return "both";
  const withoutPattern = /\b(?:sin|antes de(?:l)?|no (?:incluyas|incluya|incluye|incluir)) (?:el )?iva\b/g;
  const without = withoutPattern.test(text);
  // Remove negative requests before looking for positive forms such as "incluye IVA".
  const positiveText = text.replace(withoutPattern, " ");
  const withIva = /\b(?:con|incluye|incluyas|incluya|incluir|incluyendo) (?:el )?iva\b|\biva incluido\b/.test(positiveText);
  if (without && withIva) return "both";
  if (without) return "without_iva";
  if (withIva) return "with_iva";
  return "both";
}
