import { getVendor, findVendorByEmail } from "./vendorAuth";

export const SALES_OPERATIONS = ["calculate_trailer_price", "get_quote", "get_quote_summary", "get_trailer_catalog", "get_accessories"] as const;
export type SalesOperation = typeof SALES_OPERATIONS[number];
export class VendorAuthorizationError extends Error {
  readonly status: 401 | 403 | 503;
  constructor(status: 401 | 403 | 503, message: string) { super(message); this.status = status; this.name = "VendorAuthorizationError"; }
}
// Shared panel: all active vendors have these read/calculation permissions. Identity is never an argument.
export async function authorizeSalesOperation(operation: SalesOperation) {
  if (!SALES_OPERATIONS.includes(operation)) throw new VendorAuthorizationError(403, "Operación no permitida.");
  const session = await getVendor();
  if (!session) throw new VendorAuthorizationError(401, "No autorizado.");
  let account;
  try { account = await findVendorByEmail(session.email); }
  catch { throw new VendorAuthorizationError(503, "No fue posible verificar la cuenta."); }
  if (!account || !account.active || account.id !== session.id) throw new VendorAuthorizationError(403, "Cuenta no autorizada.");
  return { id: account.id, email: account.email, name: account.name };
}
