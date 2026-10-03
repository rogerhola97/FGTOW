// Parseo del descuento y los cargos adicionales que vienen del editor de vendedor
// (TrailerConfigurator con isVendor=true). Compartido por POST /api/vendedor/quotes y
// PATCH /api/vendedor/quotes/[id].
import { clean } from "./quoteSubmission";
import { VendorCharge, VendorDiscount } from "./vendorPricing";

const MAX_CHARGES = 20;

export function parseCharges(value: unknown): VendorCharge[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CHARGES).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const name = clean(raw.name, 120);
    const price = Number(raw.price);
    if (!name || !Number.isFinite(price) || price < 0 || price > 1_000_000) return [];
    return [{ id: clean(raw.id, 40) || `cargo-${index + 1}`, name, price: Math.round(price * 100) / 100 }];
  });
}

export function parseDiscount(value: unknown): VendorDiscount {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  if (type !== "percent" && type !== "amount") return null;
  const amount = Number(raw.value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { type, value: amount, reason: clean(raw.reason, 300) || null };
}
