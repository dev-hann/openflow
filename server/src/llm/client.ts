import { z } from "zod";

import { createLogger } from "../utils/logger.js";
import { OpenFlowError, getErrorMessage } from "../utils/errors.js";
import { sleep } from "../utils/retry.js";
import type { ChatParams, CompleteParams, LlmResponse } from "./types.js";
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

interface RetrySignal {
  __retry: true;
  status?: number;
  body?: string;
  errorMessage?: string;
  cause?: unknown;
}

function isRetrySignal(value: unknown): value is RetrySignal {
  return typeof value === "object" && value !== null && "__retry" in value;
}

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${path}`;
}

const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function").default("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const LlmMessageSchema = z.object({
  tool_calls: z.array(ToolCallSchema).optional(),
  content: z.union([z.string(), z.null()]).optional(),
});

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

async function handleStreamResponse(
  body: ReadableStream<Uint8Array>,
  config: LlmConfig,
  onToken: (token: string) => void,
  startedAt: number,
): Promise<unknown> {
  try {
    const result = await parseSseStream(body, onToken);
    const duration = Date.now() - startedAt;
    log.info({ model: config.model, duration, streamed: true }, "LLM request completed");
    return result;
  } catch (err: unknown) {
    throw new OpenFlowError(`Stream error after partial delivery: ${getErrorMessage(err)}`, "LLM_STREAM_ERROR", err);
  }
}

function classifyAttemptError(err: unknown): never | RetrySignal {
  if (err instanceof OpenFlowError) throw err;
  if (err instanceof Error && err.name === "AbortError") {
    throw new OpenFlowError("Request timed out", "LLM_TIMEOUT");
  }
  const msg = getErrorMessage(err);
  return { __retry: true, errorMessage: msg, cause: err } satisfies RetrySignal;
}

async function processResponse(
  response: Response,
  config: LlmConfig,
  onToken: ((token: string) => void) | undefined,
  startedAt: number,
): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text();
    if (response.status >= 500)
      return { __retry: true, status: response.status, body: text } satisfies RetrySignal;
    const safeText = text.length > 200 ? text.slice(0, 200) + "..." : text;
    throw new OpenFlowError(
      `LLM API error ${response.status}: ${safeText}`,
      "LLM_REQUEST_FAILED",
    );
  }

  if (onToken && response.body) {
    return await handleStreamResponse(response.body, config, onToken, startedAt);
  }

  const json = (await response.json()) as unknown;
  const duration = Date.now() - startedAt;
  log.info({ model: config.model, duration, streamed: false }, "LLM request completed");
  return json;
}

async function sendSingleAttempt(
  url: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
  config: LlmConfig,
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const startedAt = Date.now();
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
    return await processResponse(response, config, onToken, startedAt);
  } catch (err: unknown) {
    return classifyAttemptError(err);
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener("abort", abortHandler);
  }
}

function throwRetryExhausted(signal: RetrySignal): never {
  if (signal.status) {
    const safeText =
      (signal.body ?? "").length > 200
        ? (signal.body ?? "").slice(0, 200) + "..."
        : (signal.body ?? "");
    throw new OpenFlowError(`LLM API error ${signal.status}: ${safeText}`, "LLM_REQUEST_FAILED");
  }
  throw new OpenFlowError(
    `LLM request failed: ${signal.errorMessage}`,
    "LLM_REQUEST_FAILED",
    signal.cause,
  );
}

async function sendRequest(
  config: LlmConfig,
  body: Record<string, unknown>,
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const url = buildUrl(config.baseUrl, "/chat/completions");
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

    const result = await sendSingleAttempt(url, headers, payload, config, onToken, signal);

    if (!isRetrySignal(result)) return result;

    if (attempt < RETRY_DELAYS.length) {
      if (result.status) {
        log.warn({ status: result.status, attempt }, "server error, retrying");
      } else {
        log.warn({ err: result.cause ?? result.errorMessage, attempt }, "request failed, retrying");
      }
      const jitter = Math.random() * 500;
      await sleep(RETRY_DELAYS[attempt]! + jitter);
      continue;
    }

    throwRetryExhausted(result);
  }
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

function extractLlmMessage(raw: unknown): z.infer<typeof LlmMessageSchema> | null {
  if (typeof raw !== "object" || raw === null) {
    throw new OpenFlowError("Invalid LLM response format", "LLM_REQUEST_FAILED");
  }
  const response = raw as Record<string, unknown>;
  const choices = response.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  if (!firstChoice || typeof firstChoice.message !== "object" || firstChoice.message === null) {
    throw new OpenFlowError("Invalid message in LLM response", "LLM_REQUEST_FAILED");
  }

  const parsed = LlmMessageSchema.safeParse(firstChoice.message);
  if (!parsed.success) {
    throw new OpenFlowError(
      `Invalid message shape in LLM response: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      "LLM_REQUEST_FAILED",
    );
  }
  return parsed.data;
}

function parseChatResponse(raw: unknown): LlmResponse {
  const message = extractLlmMessage(raw);
  if (!message) {
    throw new OpenFlowError("No choices in LLM response", "LLM_REQUEST_FAILED");
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    return { type: "tool_calls", toolCalls: message.tool_calls };
  }

  return { type: "text", content: typeof message.content === "string" ? message.content : "" };
}

function parseCompleteResponse(raw: unknown): string {
  try {
    const message = extractLlmMessage(raw);
    if (!message) return "";
    return typeof message.content === "string" ? message.content : "";
  } catch (err: unknown) {
    log.debug({ err }, "failed to parse complete response, returning empty");
    return "";
  }
}
