// Server-only: the environment helper imports cloudflare:workers and next/headers.
import { readEnv } from "./vendorAuth";

export const SALES_AI_MODEL = "gpt-6-luna";
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const OPENAI_TIMEOUT_MS = 30_000;
export const MAX_OUTPUT_TOKENS = 1500;

export type FunctionTool = {
  type: "function"; name: string; description: string; strict: true;
  parameters: Record<string, unknown>;
};
export type ResponseItem = Record<string, unknown> & { type: string };
export type SalesToolChoice = "auto" | { type: "function"; name: "calculate_trailer_price" };
export type ResponsesInput = { instructions: string; input: Record<string, unknown>[]; tools: readonly FunctionTool[]; toolChoice?: SalesToolChoice };
export type ResponsesResult = {
  output: ResponseItem[]; requestId: string | null;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
};
export type ResponsesTransport = (input: ResponsesInput) => Promise<ResponsesResult>;
export class OpenAIServerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;
  clientRequestId: string | null = null;
  constructor(code: string, status: number, message: string, requestId: string | null = null) {
    super(message); this.name = "OpenAIServerError";
    this.code = code; this.status = status; this.requestId = requestId;
  }
}
const tokenCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Reject invalid metadata entirely rather than logging fragments of arbitrary text.
function safeMetadata(value: unknown, pattern: RegExp, limit: number, key: string): string | null {
  return typeof value === "string" && value.length <= limit && pattern.test(value)
    && !value.includes(key) && !/authorization|bearer|sk-|sb_secret_|ghp_/i.test(value) ? value : null;
}
async function readErrorMetadata(response: Response): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) return {};
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) return {};
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    const error = (body as Record<string, unknown>).error;
    return error && typeof error === "object" && !Array.isArray(error) ? error as Record<string, unknown> : {};
  } catch { return {}; }
  finally { try { await reader.cancel(); } catch { /* Never log parser/body errors. */ } }
}

// Dependencies are server code only, never accepted from an HTTP payload. No retries.
export function createResponsesClient(dependencies: {
  fetch?: typeof fetch; readKey?: () => string | undefined; timeoutMs?: number;
} = {}): ResponsesTransport {
  return async ({ instructions, input, tools, toolChoice = "auto" }) => {
    const key = (dependencies.readKey ?? (() => readEnv("OPENAI_API_KEY")))();
    if (!key) throw new OpenAIServerError("AI_NOT_CONFIGURED", 503, "El asistente no está configurado.");
    const clientRequestId = crypto.randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? OPENAI_TIMEOUT_MS);
    let requestId: string | null = null;
    try {
      const response = await (dependencies.fetch ?? fetch)(OPENAI_RESPONSES_URL, {
        method: "POST", signal: controller.signal,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "X-Client-Request-Id": clientRequestId },
        body: JSON.stringify({
          model: SALES_AI_MODEL, reasoning: { effort: "low" }, store: false,
          max_output_tokens: MAX_OUTPUT_TOKENS, instructions, input, tools,
          parallel_tool_calls: false, include: ["reasoning.encrypted_content"], tool_choice: toolChoice,
        }),
      });
      const header = response.headers.get("x-request-id");
      requestId = safeMetadata(header, /^[A-Za-z0-9_-]+$/, 200, key);
      if (!response.ok) {
        const upstream = await readErrorMetadata(response);
        const retry = response.headers.get("retry-after");
        console.error("OPENAI_UPSTREAM_ERROR", {
          status: response.status, requestId, clientRequestId,
          retryAfter: safeMetadata(retry, /^(?:\d{1,10}|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT)$/, 64, key),
          code: safeMetadata(upstream.code, /^[A-Za-z][A-Za-z0-9_-]*$/, 100, key),
          type: safeMetadata(upstream.type, /^[A-Za-z][A-Za-z0-9_-]*$/, 100, key),
          param: safeMetadata(upstream.param, /^[A-Za-z_][A-Za-z0-9_.\[\]-]*$/, 200, key),
        });
        const code = response.status === 429 ? "AI_RATE_LIMITED" : response.status === 401 || response.status === 403 ? "AI_UPSTREAM_AUTH" : "AI_HTTP_ERROR";
        throw new OpenAIServerError(code, response.status === 429 ? 429 : 502, "El servicio de IA no está disponible. Intenta más tarde.", requestId);
      }
      let data: unknown;
      try { data = await response.json(); }
      catch {
        if (controller.signal.aborted) throw new OpenAIServerError("AI_TIMEOUT", 504, "El servicio de IA tardó demasiado.", requestId);
        throw new OpenAIServerError("AI_INVALID_RESPONSE", 502, "El servicio de IA devolvió una respuesta inválida.", requestId);
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new OpenAIServerError("AI_INVALID_RESPONSE", 502, "Respuesta de IA inválida.", requestId);
      const raw = data as Record<string, unknown>;
      if (raw.status === "incomplete") throw new OpenAIServerError("AI_INCOMPLETE", 502, "La respuesta de IA quedó incompleta. Simplifica la pregunta.", requestId);
      if (raw.status !== "completed" || !Array.isArray(raw.output) || raw.output.length > 32 || raw.output.some(item => !item || typeof item !== "object" || typeof item.type !== "string")) throw new OpenAIServerError("AI_INVALID_RESPONSE", 502, "Respuesta de IA inválida.", requestId);
      const usage = raw.usage && typeof raw.usage === "object" ? raw.usage as Record<string, unknown> : {};
      const inputTokens = tokenCount(usage.input_tokens), outputTokens = tokenCount(usage.output_tokens);
      return { output: raw.output as ResponseItem[], requestId, usage: { inputTokens, outputTokens, totalTokens: tokenCount(usage.total_tokens) || inputTokens + outputTokens } };
    } catch (error) {
      if (error instanceof OpenAIServerError) { error.clientRequestId = clientRequestId; throw error; }
      const failure = controller.signal.aborted
        ? new OpenAIServerError("AI_TIMEOUT", 504, "El servicio de IA tardó demasiado.", requestId)
        : new OpenAIServerError("AI_NETWORK_ERROR", 502, "No fue posible contactar al servicio de IA.", requestId);
      failure.clientRequestId = clientRequestId;
      throw failure;
    } finally { clearTimeout(timer); }
  };
}
export const sendSalesResponse = createResponsesClient();
