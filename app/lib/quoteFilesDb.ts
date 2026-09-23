// Acceso a Supabase Storage para los 3 buckets del CRM de vendedor: imágenes de referencia del
// cliente, facturas y fotos de entrega. Los 3 son privados — nunca se sube desde el navegador
// directo a Supabase, todo pasa por rutas ya protegidas por sesión de vendedor (que suben con la
// Service Role key) y las vistas usan URLs firmadas de corta duración, nunca la URL pública directa.
import { readEnv } from "./vendorAuth";

export type QuoteFileKind = "reference" | "invoice" | "delivery";

export const BUCKET_BY_KIND: Record<QuoteFileKind, string> = {
  reference: "quote-references",
  invoice: "invoices",
  delivery: "delivery-photos",
};

export const COLUMN_BY_KIND: Record<QuoteFileKind, "reference_image_files" | "invoice_files" | "delivery_photo_files"> = {
  reference: "reference_image_files",
  invoice: "invoice_files",
  delivery: "delivery_photo_files",
};

function requireSupabaseUrl() {
  const url = readEnv("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) throw new Error("Falta la variable de entorno SUPABASE_URL.");
  return url;
}

function requireServiceRoleKey() {
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY.");
  return key;
}

// Nombre de archivo saneado: solo lo usamos para mostrarlo, la ruta real en el bucket es un uuid,
// así que basta con quitar caracteres que compliquen el header Content-Disposition o la URL firmada.
export function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\- ]/g, "_").slice(-140) || "archivo";
}

export async function uploadQuoteFile(kind: QuoteFileKind, quoteId: number, fileName: string, contentType: string, bytes: ArrayBuffer): Promise<{ path: string }> {
  const bucket = BUCKET_BY_KIND[kind];
  const key = requireServiceRoleKey();
  const path = `${quoteId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const response = await fetch(`${requireSupabaseUrl()}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": contentType || "application/octet-stream" },
    body: bytes,
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase Storage rechazó la subida (status ${response.status}): ${details.slice(0, 300)}`);
  }
  return { path };
}

export async function deleteQuoteFile(kind: QuoteFileKind, path: string): Promise<void> {
  const bucket = BUCKET_BY_KIND[kind];
  const key = requireServiceRoleKey();
  const response = await fetch(`${requireSupabaseUrl()}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "DELETE",
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase Storage rechazó el borrado (status ${response.status}): ${details.slice(0, 300)}`);
  }
}

// URL firmada de 1 hora — suficiente para ver/abrir la ficha de la cotización sin dejar los
// archivos accesibles indefinidamente si el link se comparte fuera del panel.
export async function signQuoteFileUrl(kind: QuoteFileKind, path: string, expiresInSeconds = 3600): Promise<string | null> {
  const bucket = BUCKET_BY_KIND[kind];
  const key = requireServiceRoleKey();
  const response = await fetch(`${requireSupabaseUrl()}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!response.ok) return null;
  const result = (await response.json()) as { signedURL?: string };
  return result.signedURL ? `${requireSupabaseUrl()}/storage/v1${result.signedURL}` : null;
}

export async function signQuoteFileUrls(kind: QuoteFileKind, files: { path: string; name: string; uploadedAt: string }[]): Promise<{ path: string; name: string; uploadedAt: string; url: string | null }[]> {
  return Promise.all(files.map(async (file) => ({ ...file, url: await signQuoteFileUrl(kind, file.path) })));
}
