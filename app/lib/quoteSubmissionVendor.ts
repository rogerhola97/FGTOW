// Parseo del descuento que viene del editor de vendedor (TrailerConfigurator con isVendor=true).
// Compartido por POST /api/vendedor/quotes y PATCH /api/vendedor/quotes/[id].
import { clean } from "./quoteSubmission";
import { VendorDiscount } from "./vendorPricing";

export function parseDiscount(value: unknown): VendorDiscount {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  if (type !== "percent" && type !== "amount") return null;
  const amount = Number(raw.value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { type, value: amount, reason: clean(raw.reason, 300) || null };
}
