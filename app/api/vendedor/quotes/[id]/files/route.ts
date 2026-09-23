import { COLUMN_BY_KIND, QuoteFileKind, deleteQuoteFile, sanitizeFileName, uploadQuoteFile } from "../../../../../lib/quoteFilesDb";
import { QuoteFile, getQuoteById, patchQuoteById } from "../../../../../lib/quotesDb";
import { getVendor } from "../../../../../lib/vendorAuth";

const VALID_KINDS: QuoteFileKind[] = ["reference", "invoice", "delivery"];
const MAX_BYTES = 15 * 1024 * 1024;

function isKind(value: unknown): value is QuoteFileKind {
  return typeof value === "string" && (VALID_KINDS as string[]).includes(value);
}

// Sube un archivo (imagen de referencia, factura o foto de entrega) a Supabase Storage y lo agrega
// al arreglo correspondiente en la cotización. multipart/form-data: campos `kind` y `file`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Cotización inválida." }, { status: 400 });

  try {
    const existing = await getQuoteById(id);
    if (!existing) return Response.json({ error: "La cotización no existe." }, { status: 404 });

    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (!isKind(kind)) return Response.json({ error: "Tipo de archivo inválido." }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: "Falta el archivo." }, { status: 400 });
    if (file.size === 0) return Response.json({ error: "El archivo está vacío." }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "El archivo no puede pesar más de 15 MB." }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const { path } = await uploadQuoteFile(kind, id, file.name || "archivo", file.type, bytes);

    const column = COLUMN_BY_KIND[kind];
    const currentFiles = (existing[column] as QuoteFile[] | undefined) ?? [];
    const newFile: QuoteFile = { path, name: sanitizeFileName(file.name || "archivo"), uploadedAt: new Date().toISOString() };
    const result = await patchQuoteById(id, { [column]: [...currentFiles, newFile] });
    if (!result.ok) throw new Error("No fue posible guardar la referencia del archivo.");

    return Response.json({ ok: true, file: newFile }, { status: 201 });
  } catch (error) {
    console.error("Error al subir un archivo de cotización:", error);
    return Response.json({ error: "No fue posible subir el archivo. Intenta de nuevo." }, { status: 500 });
  }
}

// Quita un archivo del arreglo y lo borra del bucket. Body: { kind, path }.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return Response.json({ error: "No autorizado." }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Cotización inválida." }, { status: 400 });

  try {
    const payload = (await request.json()) as { kind?: string; path?: string };
    if (!isKind(payload.kind)) return Response.json({ error: "Tipo de archivo inválido." }, { status: 400 });
    if (typeof payload.path !== "string" || !payload.path) return Response.json({ error: "Falta el archivo a borrar." }, { status: 400 });

    const existing = await getQuoteById(id);
    if (!existing) return Response.json({ error: "La cotización no existe." }, { status: 404 });

    const column = COLUMN_BY_KIND[payload.kind];
    const currentFiles = (existing[column] as QuoteFile[] | undefined) ?? [];
    const nextFiles = currentFiles.filter((entry) => entry.path !== payload.path);

    await deleteQuoteFile(payload.kind, payload.path);
    const result = await patchQuoteById(id, { [column]: nextFiles });
    if (!result.ok) throw new Error("No fue posible actualizar la cotización.");

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error al borrar un archivo de cotización:", error);
    return Response.json({ error: "No fue posible borrar el archivo. Intenta de nuevo." }, { status: 500 });
  }
}
