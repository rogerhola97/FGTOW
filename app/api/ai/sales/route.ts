import { runSalesAssistant, AiSalesServiceError } from "../../../lib/aiSalesService";
import { OpenAIServerError } from "../../../lib/openaiServer";
import { authorizeSalesOperation, VendorAuthorizationError } from "../../../lib/vendorAuthorization";
import { salesMessageArgs, AiValidationError } from "../../../lib/aiRequestValidation";

const MAX_BODY_BYTES = 20_000; // Fits 4,000 UTF-8 characters plus the small JSON envelope.
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const fail = (code: string, message: string, status: number) => reply({ ok: false, error: { code, message } }, status);

async function readBody(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new AiSalesServiceError("BODY_TOO_LARGE", "El cuerpo de la solicitud excede el límite.");
  if (!request.body) throw new AiValidationError("Falta el cuerpo JSON.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AiSalesServiceError("BODY_TOO_LARGE", "El cuerpo de la solicitud excede el límite.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new AiValidationError("El cuerpo JSON no es válido."); }
}

export async function POST(request: Request) {
  try {
    await authorizeSalesOperation("get_quote_summary");
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail("UNSUPPORTED_MEDIA_TYPE", "Utiliza Content-Type application/json.", 415);
    // No Host/forwarded headers or static localhost allowlist. Compare the Origin with the
    // Worker request URL (the current public origin); do not accept cross-site browser calls.
    const origin = request.headers.get("origin");
    if (origin !== null && origin !== new URL(request.url).origin) return fail("INVALID_ORIGIN", "Origen no permitido.", 403);
    if (request.headers.get("sec-fetch-site") === "cross-site") return fail("INVALID_ORIGIN", "Origen no permitido.", 403);
    const args = salesMessageArgs(await readBody(request));
    return reply(await runSalesAssistant(args));
  } catch (error) {
    if (error instanceof VendorAuthorizationError) return fail(error.status === 401 ? "UNAUTHENTICATED" : error.status === 403 ? "VENDOR_INACTIVE" : "AUTH_UNAVAILABLE", error.message, error.status);
    if (error instanceof AiValidationError) return fail("INVALID_REQUEST", error.message, 400);
    if (error instanceof OpenAIServerError) return fail(error.code, error.message, error.status);
    if (error instanceof AiSalesServiceError) return fail(error.code, error.message, error.code === "BODY_TOO_LARGE" ? 413 : 502);
    // No exception, prompt, upstream body or secret is logged or returned.
    return fail("AI_INTERNAL_ERROR", "No fue posible procesar la solicitud del asistente.", 500);
  }
}
