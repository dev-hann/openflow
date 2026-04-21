import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { sleep } from "../utils/retry.js";
import type { ChatParams, CompleteParams, LlmResponse, ToolCall } from "./types.js";
import { parseSseStream } from "./sse-parser.js";

const log = createLogger("llm");

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmClient {
  chat(params: ChatParams): Promise<LlmResponse>;
  complete(params: CompleteParams): Promise<string>;
}

const RETRY_DELAYS = [1000, 2000, 4000];

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${path}`;
}

function parseToolCalls(raw: unknown[]): ToolCall[] {
  return raw.map((tc: unknown) => {
    if (typeof tc !== "object" || tc === null) {
      throw new OpenFlowError("Invalid tool_call format in LLM response", "LLM_STREAM_ERROR");
    }
    const t = tc as Record<string, unknown>;
    const fn = t.function;
    if (typeof fn !== "object" || fn === null) {
      throw new OpenFlowError("Invalid tool_call.function format in LLM response", "LLM_STREAM_ERROR");
    }
    const fnObj = fn as Record<string, unknown>;
    if (typeof t.id !== "string" || typeof fnObj.name !== "string" || typeof fnObj.arguments !== "string") {
      throw new OpenFlowError("Missing required fields in tool_call", "LLM_STREAM_ERROR");
    }
    return {
      id: t.id,
      type: "function" as const,
      function: {
        name: fnObj.name,
        arguments: fnObj.arguments,
      },
    };
  });
}

export function createLlmClient(config: LlmConfig): LlmClient {
  return {
    async chat(params: ChatParams): Promise<LlmResponse> {
      const body = buildChatBody(params);
      const raw = await sendRequest(config, body, params.onToken, params.signal);
      return parseChatResponse(raw);
    },

    async complete(params: CompleteParams): Promise<string> {
      const body: Record<string, unknown> = { messages: params.messages };
      const raw = await sendRequest(config, body, undefined, params.signal);
      return parseCompleteResponse(raw);
    },
  };
}

async function sendRequest(
  config: LlmConfig,
  body: Record<string, unknown>,
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const url = buildUrl(config.baseUrl, "/chat/completions");
  const startedAt = Date.now();
  const payload = {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream: !!onToken,
    ...body,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (signal?.aborted) {
      throw new OpenFlowError("Request aborted", "LLM_TIMEOUT");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const abortHandler = () => controller.abort();
    if (signal) signal.addEventListener("abort", abortHandler);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status >= 500 && attempt < RETRY_DELAYS.length) {
          log.warn({ status: response.status, attempt }, "server error, retrying");
          const jitter = Math.random() * 500;
          await sleep(RETRY_DELAYS[attempt]! + jitter);
          continue;
        }
        const safeText = text.length > 200 ? text.slice(0, 200) + "..." : text;
        throw new OpenFlowError(`LLM API error ${response.status}: ${safeText}`, "LLM_REQUEST_FAILED");
      }

      if (onToken && response.body) {
        const result = await parseSseStream(response.body, onToken);
        const duration = Date.now() - startedAt;
        log.info({ model: config.model, duration, streamed: true }, "LLM request completed");
        return result;
      }

      const json = (await response.json()) as unknown;
      const duration = Date.now() - startedAt;
      log.info({ model: config.model, duration, streamed: false }, "LLM request completed");
      return json;
    } catch (err: unknown) {
      if (err instanceof OpenFlowError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new OpenFlowError("Request timed out", "LLM_TIMEOUT");
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < RETRY_DELAYS.length) {
        log.warn({ err: msg, attempt }, "request failed, retrying");
        const jitter = Math.random() * 500;
        await sleep(RETRY_DELAYS[attempt]! + jitter);
        continue;
      }
      throw new OpenFlowError(`LLM request failed: ${msg}`, "LLM_REQUEST_FAILED", err);
    } finally {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener("abort", abortHandler);
    }
  }

  throw new OpenFlowError("Max retries exceeded", "LLM_REQUEST_FAILED");
}

function buildChatBody(params: ChatParams): Record<string, unknown> {
  const body: Record<string, unknown> = { messages: params.messages };
  if (params.toolDefinitions && params.toolDefinitions.length > 0) {
    body.tools = params.toolDefinitions.map((td) => ({
      type: "function" as const,
      function: td.function,
    }));
  }
  return body;
}

function parseChatResponse(raw: unknown): LlmResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new OpenFlowError("Invalid LLM response format", "LLM_REQUEST_FAILED");
  }
  const response = raw as Record<string, unknown>;
  const choices = response.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenFlowError("No choices in LLM response", "LLM_REQUEST_FAILED");
  }

  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  if (!firstChoice || typeof firstChoice.message !== "object" || firstChoice.message === null) {
    throw new OpenFlowError("Invalid message in LLM response", "LLM_REQUEST_FAILED");
  }

  const message = firstChoice.message as Record<string, unknown>;
  const toolCallsRaw = message.tool_calls as Array<unknown> | undefined;

  if (toolCallsRaw && toolCallsRaw.length > 0) {
    return { type: "tool_calls", toolCalls: parseToolCalls(toolCallsRaw) };
  }

  return { type: "text", content: typeof message.content === "string" ? message.content : "" };
}

function parseCompleteResponse(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) {
    throw new OpenFlowError("Invalid LLM response format", "LLM_REQUEST_FAILED");
  }
  const response = raw as Record<string, unknown>;
  const choices = response.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";

  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  if (!firstChoice || typeof firstChoice.message !== "object" || firstChoice.message === null) return "";

  const message = firstChoice.message as Record<string, unknown>;
  return typeof message.content === "string" ? message.content : "";
}
