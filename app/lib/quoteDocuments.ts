import { FABRICATION_ADDRESS, SALES_EMAIL, WHATSAPP_NUMBER } from "./company";
import { MODEL_META, ModelId, getEquipment, getPreset } from "./quoteCatalog";

export type PaymentMethod = "cash" | "transfer" | "credit_card";
export type PaymentSchedule = "full" | "deposit_balance" | "deposit_installments" | "installments";
export type SignatureRole = "customer" | "seller";
export type DocumentSignature = { image: string; signerName: string; signedAt: string };

export const SIGNATURE_IMAGE_PREFIX = "data:image/png;base64,";
export const SIGNATURE_IMAGE_MAX_LENGTH = 400_000;

export type QuoteDocumentsData = {
  vehicle: {
    sellerName: string;
    issuePlace: string;
    issueDate: string;
    deliveryDate: string;
    vehicleType: string;
    invoiceTrailerType: string;
    brand: string;
    modelYear: string;
    serialNumber: string;
    color: string;
    condition: string;
    weightKg: number;
    capacityKg: number;
    interiorDimensions: string;
    exteriorDimensions: string;
    doorCount: number;
    windowCount: number;
    description: string;
    extras: string;
    additionalNotes: string;
  };
  payment: {
    method: PaymentMethod;
    schedule: PaymentSchedule;
    depositAmount: number;
    balanceAmount: number;
    installmentCount: number;
    monthlyAmount: number;
    beneficiary: string;
    bankName: string;
    accountNumber: string;
    clabe: string;
    paymentReference: string;
    cardProcessor: string;
    paymentLink: string;
    instructions: string;
  };
  fiscal: {
    needsInvoice: boolean;
    legalName: string;
    rfc: string;
    taxRegime: string;
    cfdiUse: string;
    fiscalPostalCode: string;
    fiscalAddress: string;
    invoiceEmail: string;
  };
  issuer: {
    legalName: string;
    rfc: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
  contractClauses: string;
  warrantyTerms: string;
  invoiceLetterNotes: string;
  signatures: Record<SignatureRole, DocumentSignature | null>;
  updatedAt: string | null;
};

type ResolveOptions = { sellerName?: string };

type QuoteForDocuments = {
  quote_number: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  trailer_preset: string;
  model: string;
  configuration: unknown;
  total: number;
  include_iva: boolean;
  vendor_email: string | null;
  document_data?: unknown;
};

type StoredConfiguration = {
  items?: Array<{ typeId?: string; note?: unknown }>;
  windows?: unknown[];
  specialItems?: Array<{ name?: string }>;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_METHODS: PaymentMethod[] = ["cash", "transfer", "credit_card"];
const PAYMENT_SCHEDULES: PaymentSchedule[] = ["full", "deposit_balance", "deposit_installments", "installments"];

function limited(value: unknown, fallback: string, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function numeric(value: unknown, fallback: number, min = 0, max = 100_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function integer(value: unknown, fallback: number, min = 0, max = 100) {
  return Math.round(numeric(value, fallback, min, max));
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function vehicleTypeFor(model: ModelId) {
  if (model === "cargo") return "Remolque de carga";
  if (model === "rzr") return "Remolque plataforma para RZR / UTV";
  return "Remolque para venta de alimentos";
}

function dimensions(widthCm: number, lengthCm: number, heightCm: number) {
  return `${(widthCm / 100).toFixed(2)} m de ancho × ${(lengthCm / 100).toFixed(2)} m de largo × ${(heightCm / 100).toFixed(2)} m de alto`;
}

function defaultDescription(quote: QuoteForDocuments) {
  const configuration = object(quote.configuration) as StoredConfiguration;
  const equipment = (configuration.items ?? []).flatMap((item) => {
    const definition = item.typeId ? getEquipment(item.typeId) : null;
    // La base para gas va en todos los remolques; no se enumera como concepto del contrato.
    if (!definition || definition.id === "base-gas") return [];
    const note = typeof item.note === "string" ? item.note.trim() : "";
    return [note ? `${definition.name} (${note})` : definition.name];
  });
  const specials = (configuration.specialItems ?? []).flatMap((item) => item.name ? [item.name] : []);
  const concepts = [...equipment, ...specials];
  return concepts.length ? concepts.join(", ") : "Configuración y acabados conforme a la cotización y al plano autorizados.";
}

export function isValidSignatureImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(SIGNATURE_IMAGE_PREFIX) && value.length <= SIGNATURE_IMAGE_MAX_LENGTH
    && /^[A-Za-z0-9+/]+=*$/.test(value.slice(SIGNATURE_IMAGE_PREFIX.length));
}

function signature(value: unknown): DocumentSignature | null {
  const candidate = object(value);
  if (!isValidSignatureImage(candidate.image)) return null;
  return {
    image: candidate.image,
    signerName: limited(candidate.signerName, "", 160),
    signedAt: typeof candidate.signedAt === "string" ? candidate.signedAt.slice(0, 40) : "",
  };
}

export function defaultQuoteDocumentsData(quote: QuoteForDocuments, options: ResolveOptions = {}): QuoteDocumentsData {
  const preset = getPreset(quote.trailer_preset);
  const model = (quote.model in MODEL_META ? quote.model : preset.model) as ModelId;
  const configuration = object(quote.configuration) as StoredConfiguration;
  const total = numeric(quote.total, 0);
  return {
    vehicle: {
      sellerName: options.sellerName?.trim() ?? "",
      issuePlace: "Monterrey, Nuevo León",
      issueDate: todayIso(),
      deliveryDate: "",
      vehicleType: vehicleTypeFor(model),
      invoiceTrailerType: "HECHIZO",
      brand: "FG TOW",
      modelYear: String(new Date().getFullYear()),
      serialNumber: "",
      color: "Por definir",
      condition: "Nuevo",
      weightKg: preset.estimatedWeightKg,
      capacityKg: preset.estimatedCapacityKg,
      interiorDimensions: dimensions(preset.widthCm, preset.lengthCm, preset.heightCm),
      exteriorDimensions: dimensions(preset.widthCm + 20, preset.lengthCm + 110, preset.heightCm + 40),
      doorCount: 1,
      windowCount: Array.isArray(configuration.windows) ? configuration.windows.length : 0,
      description: defaultDescription(quote),
      extras: "",
      additionalNotes: "",
    },
    payment: {
      method: "transfer",
      schedule: "full",
      depositAmount: 0,
      balanceAmount: total,
      installmentCount: 1,
      monthlyAmount: total,
      beneficiary: "",
      bankName: "",
      accountNumber: "",
      clabe: "",
      paymentReference: quote.quote_number,
      cardProcessor: "",
      paymentLink: "",
      instructions: "",
    },
    fiscal: {
      needsInvoice: Boolean(quote.include_iva),
      legalName: quote.name,
      rfc: "",
      taxRegime: "",
      cfdiUse: "",
      fiscalPostalCode: "",
      fiscalAddress: [quote.city, quote.state].filter(Boolean).join(", "),
      invoiceEmail: quote.email,
    },
    issuer: {
      legalName: "",
      rfc: "",
      address: FABRICATION_ADDRESS,
      phone: WHATSAPP_NUMBER,
      email: SALES_EMAIL,
      website: "fgtow.com",
    },
    contractClauses: [
      "El remolque se fabricará conforme a la cotización, el plano y las especificaciones autorizadas por el cliente.",
      "Todo cambio solicitado después de la autorización deberá aprobarse por escrito y puede modificar el precio y la fecha de entrega.",
      "La entrega se realizará una vez cubierto el saldo pactado y concluida la revisión final del remolque.",
      "Las fechas de fabricación y entrega pueden ajustarse por cambios autorizados, disponibilidad de materiales o causas fuera del control razonable de FG TOW.",
      "El cliente declara haber revisado medidas, distribución, accesorios, forma de pago y datos asentados en este documento.",
    ].join("\n"),
    warrantyTerms: "Servicios, garantía y reparaciones se atienden directamente en el taller de FG TOW, con cita previa y conforme a las condiciones entregadas con la unidad.",
    invoiceLetterNotes: "La presente carta identifica la unidad descrita y deja constancia de la operación. No sustituye al CFDI ni a la documentación oficial que resulte aplicable.",
    signatures: { customer: null, seller: null },
    updatedAt: null,
  };
}

export function resolveQuoteDocumentsData(quote: QuoteForDocuments, candidate: unknown = quote.document_data, options: ResolveOptions = {}): QuoteDocumentsData {
  const defaults = defaultQuoteDocumentsData(quote, options);
  const root = object(candidate);
  const vehicle = object(root.vehicle);
  const payment = object(root.payment);
  const fiscal = object(root.fiscal);
  const issuer = object(root.issuer);
  const signatures = object(root.signatures);
  // Documentos guardados antes usaban el correo del vendedor como nombre; se reemplaza por su nombre.
  const storedSellerName = limited(vehicle.sellerName, defaults.vehicle.sellerName, 120);
  const sellerName = storedSellerName.includes("@") ? defaults.vehicle.sellerName : storedSellerName;
  const method = PAYMENT_METHODS.includes(payment.method as PaymentMethod) ? payment.method as PaymentMethod : defaults.payment.method;
  const schedule = PAYMENT_SCHEDULES.includes(payment.schedule as PaymentSchedule) ? payment.schedule as PaymentSchedule : defaults.payment.schedule;
  const issuerLegalName = limited(issuer.legalName, defaults.issuer.legalName, 240);

  return {
    vehicle: {
      sellerName,
      issuePlace: limited(vehicle.issuePlace, defaults.vehicle.issuePlace, 160),
      issueDate: typeof vehicle.issueDate === "string" && ISO_DATE.test(vehicle.issueDate) ? vehicle.issueDate : defaults.vehicle.issueDate,
      deliveryDate: typeof vehicle.deliveryDate === "string" && (vehicle.deliveryDate === "" || ISO_DATE.test(vehicle.deliveryDate)) ? vehicle.deliveryDate : defaults.vehicle.deliveryDate,
      vehicleType: limited(vehicle.vehicleType, defaults.vehicle.vehicleType, 180),
      invoiceTrailerType: limited(vehicle.invoiceTrailerType, defaults.vehicle.invoiceTrailerType, 80),
      brand: limited(vehicle.brand, defaults.vehicle.brand, 100),
      modelYear: limited(vehicle.modelYear, defaults.vehicle.modelYear, 20),
      serialNumber: limited(vehicle.serialNumber, defaults.vehicle.serialNumber, 100),
      color: limited(vehicle.color, defaults.vehicle.color, 80),
      condition: limited(vehicle.condition, defaults.vehicle.condition, 80),
      weightKg: numeric(vehicle.weightKg, defaults.vehicle.weightKg, 0, 100_000),
      capacityKg: numeric(vehicle.capacityKg, defaults.vehicle.capacityKg, 0, 100_000),
      interiorDimensions: limited(vehicle.interiorDimensions, defaults.vehicle.interiorDimensions, 240),
      exteriorDimensions: limited(vehicle.exteriorDimensions, defaults.vehicle.exteriorDimensions, 240),
      doorCount: integer(vehicle.doorCount, defaults.vehicle.doorCount, 0, 20),
      windowCount: integer(vehicle.windowCount, defaults.vehicle.windowCount, 0, 40),
      description: limited(vehicle.description, defaults.vehicle.description, 4000),
      extras: limited(vehicle.extras, defaults.vehicle.extras, 2500),
      additionalNotes: limited(vehicle.additionalNotes, defaults.vehicle.additionalNotes, 2500),
    },
    payment: {
      method,
      schedule,
      depositAmount: numeric(payment.depositAmount, defaults.payment.depositAmount),
      balanceAmount: numeric(payment.balanceAmount, defaults.payment.balanceAmount),
      installmentCount: integer(payment.installmentCount, defaults.payment.installmentCount, 1, 60),
      monthlyAmount: numeric(payment.monthlyAmount, defaults.payment.monthlyAmount),
      beneficiary: limited(payment.beneficiary, defaults.payment.beneficiary, 160),
      bankName: limited(payment.bankName, defaults.payment.bankName, 120),
      accountNumber: limited(payment.accountNumber, defaults.payment.accountNumber, 80),
      clabe: limited(payment.clabe, defaults.payment.clabe, 24),
      paymentReference: limited(payment.paymentReference, defaults.payment.paymentReference, 120),
      cardProcessor: limited(payment.cardProcessor, defaults.payment.cardProcessor, 120),
      paymentLink: limited(payment.paymentLink, defaults.payment.paymentLink, 500),
      instructions: limited(payment.instructions, defaults.payment.instructions, 2000),
    },
    fiscal: {
      needsInvoice: fiscal.needsInvoice === true,
      legalName: limited(fiscal.legalName, defaults.fiscal.legalName, 240),
      rfc: limited(fiscal.rfc, defaults.fiscal.rfc, 20).toUpperCase(),
      taxRegime: limited(fiscal.taxRegime, defaults.fiscal.taxRegime, 180),
      cfdiUse: limited(fiscal.cfdiUse, defaults.fiscal.cfdiUse, 180),
      fiscalPostalCode: limited(fiscal.fiscalPostalCode, defaults.fiscal.fiscalPostalCode, 10),
      fiscalAddress: limited(fiscal.fiscalAddress, defaults.fiscal.fiscalAddress, 500),
      invoiceEmail: limited(fiscal.invoiceEmail, defaults.fiscal.invoiceEmail, 160),
    },
    issuer: {
      legalName: issuerLegalName === "FG TOW · De FG INV" ? "" : issuerLegalName,
      rfc: limited(issuer.rfc, defaults.issuer.rfc, 20).toUpperCase(),
      address: limited(issuer.address, defaults.issuer.address, 500),
      phone: limited(issuer.phone, defaults.issuer.phone, 80),
      email: limited(issuer.email, defaults.issuer.email, 160),
      website: limited(issuer.website, defaults.issuer.website, 160),
    },
    contractClauses: limited(root.contractClauses, defaults.contractClauses, 8000),
    warrantyTerms: limited(root.warrantyTerms, defaults.warrantyTerms, 3000),
    invoiceLetterNotes: limited(root.invoiceLetterNotes, defaults.invoiceLetterNotes, 3000),
    signatures: { customer: signature(signatures.customer), seller: signature(signatures.seller) },
    updatedAt: typeof root.updatedAt === "string" ? root.updatedAt.slice(0, 40) : defaults.updatedAt,
  };
}

export function paymentMethodLabel(method: PaymentMethod) {
  return method === "cash" ? "Efectivo" : method === "credit_card" ? "Tarjeta de crédito" : "Transferencia";
}

export function paymentScheduleLabel(schedule: PaymentSchedule) {
  if (schedule === "deposit_balance") return "Anticipo y saldo a la entrega";
  if (schedule === "deposit_installments") return "Anticipo y resto a meses";
  if (schedule === "installments") return "Total a meses";
  return "Pago total";
}
