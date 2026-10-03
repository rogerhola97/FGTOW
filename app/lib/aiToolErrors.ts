export type AiToolErrorCode = "INVALID_TOOL_ARGUMENTS" | "INVALID_TRAILER_CONFIGURATION" | "PRICING_ERROR" | "PAYMENT_CONFIGURATION_ERROR" | "TOOL_UNAVAILABLE";
export type AiToolErrorStage = "arguments" | "trailer-configuration" | "pricing-settings" | "pricing-calculation" | "payment-configuration" | "payment-calculation" | "tool-execution";
export type MissingToolField = "widthCm" | "lengthCm" | "heightCm" | "axles" | "schedule" | "depositPercent" | "installmentCount";

const descriptions = {
  INVALID_TOOL_ARGUMENTS: { message: "Los argumentos de la herramienta no son válidos.", retryable: true, hint: "Revisa los campos y tipos definidos por la herramienta; corrige los argumentos." },
  INVALID_TRAILER_CONFIGURATION: { message: "La configuración del remolque no es válida.", retryable: true, hint: "Consulta el catálogo o proporciona modelo, medidas y ejes válidos. No inventes los datos faltantes." },
  PRICING_ERROR: { message: "No fue posible consultar las tarifas vigentes.", retryable: false, hint: "No inventes precios ni sustituyas el cálculo por precios del catálogo. Intenta más tarde." },
  PAYMENT_CONFIGURATION_ERROR: { message: "No fue posible resolver la configuración de pago.", retryable: true, hint: "Solicita únicamente los datos de pago que falten; no calcules anticipo, saldo ni mensualidades manualmente." },
  TOOL_UNAVAILABLE: { message: "La herramienta no está disponible.", retryable: false, hint: "Explica la limitación sin inventar resultados. Intenta más tarde." },
} as const;

export class AiToolError extends Error {
  readonly code: AiToolErrorCode;
  readonly stage: AiToolErrorStage;
  readonly missingFields: readonly MissingToolField[];
  constructor(code: AiToolErrorCode, stage: AiToolErrorStage, missingFields: readonly MissingToolField[] = []) {
    super(descriptions[code].message);
    this.name = "AiToolError";
    this.code = code;
    this.stage = stage;
    this.missingFields = missingFields;
  }
}

// Only fixed descriptions and field names from our code escape to the model.
export function safeToolFailure(error: AiToolError) {
  return { ok: false as const, error: { code: error.code, ...descriptions[error.code], ...(error.missingFields.length ? { missingFields: error.missingFields } : {}) } };
}
