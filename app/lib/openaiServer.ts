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
export type ResponsesInput = { instructions: string; input: Record<string, unknown>[]; tools: readonly FunctionTool[] };
export type ResponsesResult = {
  output: ResponseItem[]; requestId: string | null;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
};
export type ResponsesTransport = (input: ResponsesInput) => Promise<ResponsesResult>;
export class OpenAIServerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;
  constructor(code: string, status: number, message: string, requestId: string | null = null) {
    super(message); this.name = "OpenAIServerError";
    this.code = code; this.status = status; this.requestId = requestId;
  }
}
const tokenCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Dependencies are server code only, never accepted from an HTTP payload. No retries or logging.
export function createResponsesClient(dependencies: {
  fetch?: typeof fetch; readKey?: () => string | undefined; timeoutMs?: number;
} = {}): ResponsesTransport {
  return async ({ instructions, input, tools }) => {
    const key = (dependencies.readKey ?? (() => readEnv("OPENAI_API_KEY")))();
    if (!key) throw new OpenAIServerError("AI_NOT_CONFIGURED", 503, "El asistente no está configurado.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? OPENAI_TIMEOUT_MS);
    let requestId: string | null = null;
    try {
      const response = await (dependencies.fetch ?? fetch)(OPENAI_RESPONSES_URL, {
        method: "POST", signal: controller.signal,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: SALES_AI_MODEL, reasoning: { effort: "low" }, store: false,
          max_output_tokens: MAX_OUTPUT_TOKENS, instructions, input, tools,
          parallel_tool_calls: false, include: ["reasoning.encrypted_content"],
        }),
      });
      const header = response.headers.get("x-request-id");
      requestId = header && /^[A-Za-z0-9_-]{1,200}$/.test(header) ? header : null;
      if (!response.ok) {
        // Never parse or echo upstream error bodies: they may contain request data.
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
      if (error instanceof OpenAIServerError) throw error;
      if (controller.signal.aborted) throw new OpenAIServerError("AI_TIMEOUT", 504, "El servicio de IA tardó demasiado.", requestId);
      throw new OpenAIServerError("AI_NETWORK_ERROR", 502, "No fue posible contactar al servicio de IA.", requestId);
    } finally { clearTimeout(timer); }
  };
}
export const sendSalesResponse = createResponsesClient();
