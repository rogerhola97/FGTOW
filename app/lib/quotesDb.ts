// Acceso a la tabla public.quotes en Supabase. Dos vías, a propósito:
// - insertQuotePublic() usa la Publishable key (anon), sujeta a la política RLS de solo-insert
//   que ya protege el flujo público (app/api/quote/route.ts) — un cliente nunca puede leer ni
//   modificar cotizaciones por esta vía.
// - El resto usa la Service Role key (mismo patrón que findVendorByEmail en vendorAuth.ts,
//   incluida la razón por la que se lee con readEnv() y no process.env directo) porque solo se
//   llaman desde rutas ya protegidas por sesión de vendedor, o desde el propio servidor después
//   de haber hecho el insert público.
import { readEnv } from "./vendorAuth";

export type QuoteRow = Record<string, unknown> & {
  id: number;
  quote_number: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  notes: string | null;
  trailer_preset: string;
  model: string;
  configuration: unknown;
  subtotal: number;
  iva: number;
  total: number;
  include_iva: boolean;
  parent_quote_id: number | null;
  version: number;
  vendor_email: string | null;
  vendor_edited: boolean;
  source: string;
  status: string;
  created_at: string;
  updated_at: string | null;
};

function requireSupabaseUrl() {
  const url = readEnv("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) throw new Error("Falta la variable de entorno SUPABASE_URL.");
  return url;
}

function requirePublishableKey() {
  const key = readEnv("SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("Falta la variable de entorno SUPABASE_PUBLISHABLE_KEY.");
  return key;
}

function requireServiceRoleKey() {
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

export async function insertQuotePublic(record: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`${requireSupabaseUrl()}/rest/v1/quotes`, {
    method: "POST",
    headers: { apikey: requirePublishableKey(), "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(record),
  });
  if (response.ok) return { ok: true };
  const details = await response.text().catch(() => "");
  console.error("Supabase rechazó la cotización:", response.status, details);
  return { ok: false, error: details.slice(0, 500) };
}

async function serviceRoleFetch(path: string, init: RequestInit = {}) {
  const key = requireServiceRoleKey();
  return fetch(`${requireSupabaseUrl()}${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers },
  });
}

// Corrige el email_sent/status/email_error del registro que insertQuotePublic() acaba de crear,
// una vez que ya sabemos si Resend pudo o no enviar el correo. Usa la Service Role key porque la
// política RLS del flujo público solo concede INSERT a anon, nunca UPDATE.
export async function patchQuoteEmailStatus(quoteNumber: string, patch: { email_sent: boolean; email_error: string | null; status: string }) {
  const response = await serviceRoleFetch(`/rest/v1/quotes?quote_number=eq.${encodeURIComponent(quoteNumber)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) console.error("No se pudo actualizar el estado de correo de la cotización:", response.status, await response.text().catch(() => ""));
}

export async function insertQuoteVendor(record: Record<string, unknown>): Promise<{ ok: true; row: QuoteRow } | { ok: false; error: string }> {
  const response = await serviceRoleFetch(`/rest/v1/quotes`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Supabase rechazó la cotización del vendedor:", response.status, details);
    return { ok: false, error: details.slice(0, 500) };
  }
  const rows = (await response.json()) as QuoteRow[];
  return { ok: true, row: rows[0] };
}

export async function patchQuoteById(id: number, patch: Record<string, unknown>): Promise<{ ok: true; row: QuoteRow } | { ok: false; error: string }> {
  const response = await serviceRoleFetch(`/rest/v1/quotes?id=eq.${id}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Supabase rechazó la edición de la cotización:", response.status, details);
    return { ok: false, error: details.slice(0, 500) };
  }
  const rows = (await response.json()) as QuoteRow[];
  return { ok: true, row: rows[0] };
}

export async function deleteQuoteById(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await serviceRoleFetch(`/rest/v1/quotes?id=eq.${id}`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" },
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Supabase rechazó la eliminación de la cotización:", response.status, details);
    return { ok: false, error: details.slice(0, 500) };
  }
  return { ok: true };
}

export async function getQuoteById(id: number): Promise<QuoteRow | null> {
  const response = await serviceRoleFetch(`/rest/v1/quotes?id=eq.${id}&select=*&limit=1`);
  if (!response.ok) throw new Error(`Supabase rechazó la consulta de la cotización (status ${response.status}).`);
  const rows = (await response.json()) as QuoteRow[];
  return rows[0] ?? null;
}

// Todo carácter que podría alterar la sintaxis del filtro or=(...) de PostgREST se quita del
// término de búsqueda; el usuario solo escribe nombre/correo/teléfono, nunca necesita esos símbolos.
function sanitizeSearchTerm(term: string) {
  return term.replace(/[,()*]/g, "").trim().slice(0, 120);
}

export async function searchQuotes(term: string, limit = 40): Promise<QuoteRow[]> {
  const safeTerm = sanitizeSearchTerm(term);
  const filter = safeTerm
    ? `&or=(name.ilike.*${encodeURIComponent(safeTerm)}*,email.ilike.*${encodeURIComponent(safeTerm)}*,phone.ilike.*${encodeURIComponent(safeTerm)}*)`
    : "";
  const response = await serviceRoleFetch(`/rest/v1/quotes?select=*&order=created_at.desc&limit=${limit}${filter}`);
  if (!response.ok) throw new Error(`Supabase rechazó la búsqueda de cotizaciones (status ${response.status}).`);
  return (await response.json()) as QuoteRow[];
}

export async function getSiblingQuotes(email: string, excludeId: number): Promise<QuoteRow[]> {
  const response = await serviceRoleFetch(`/rest/v1/quotes?select=*&email=eq.${encodeURIComponent(email)}&id=neq.${excludeId}&order=created_at.desc`);
  if (!response.ok) throw new Error(`Supabase rechazó la consulta de cotizaciones relacionadas (status ${response.status}).`);
  return (await response.json()) as QuoteRow[];
}
