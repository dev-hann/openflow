import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { sleep } from "../utils/retry.js";
import type { ChatParams, CompleteParams, LlmResponse, ToolCall } from "./types.js";
import { parseSseStream } from "./sse-parser.js";

const log = createLogger("llm");

export interface FallbackModel {
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  apiKeys?: string[];
  fallbackModels?: FallbackModel[];
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
    const t = tc as Record<string, unknown>;
    const fn = t.function as Record<string, unknown>;
    return {
      id: t.id as string,
      type: "function" as const,
      function: {
        name: fn.name as string,
        arguments: fn.arguments as string,
      },
    };
  });
}

interface ActiveConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function isAuthError(status: number): boolean {
  return status === 401 || status === 403 || status === 429;
}

interface RequestContext {
  allKeys: string[];
  config: LlmConfig;
  getActiveConfig(): ActiveConfig;
  rotateKey(): boolean;
  tryFallback(): boolean;
}

function createRequestContext(config: LlmConfig): RequestContext {
  const allKeys = [config.apiKey, ...(config.apiKeys ?? [])].filter(Boolean);
  let activeKeyIndex = 0;
  let activeFallbackIndex = -1;

  function getActiveConfig(): ActiveConfig {
    if (activeFallbackIndex >= 0 && config.fallbackModels) {
      const fb = config.fallbackModels[activeFallbackIndex]!;
      return {
        baseUrl: fb.baseUrl ?? config.baseUrl,
        apiKey: fb.apiKey ?? allKeys[activeKeyIndex] ?? config.apiKey,
        model: fb.model,
      };
    }
    return {
      baseUrl: config.baseUrl,
      apiKey: allKeys[activeKeyIndex] ?? config.apiKey,
      model: config.model,
    };
  }

  function rotateKey(): boolean {
    if (activeFallbackIndex >= 0) return false;
    const next = (activeKeyIndex + 1) % allKeys.length;
    if (next === activeKeyIndex) return false;
    activeKeyIndex = next;
    log.info({ keyIndex: activeKeyIndex }, "rotated to next API key");
    return true;
  }

  function tryFallback(): boolean {
    if (!config.fallbackModels || config.fallbackModels.length === 0) return false;
    const next = activeFallbackIndex + 1;
    if (next >= config.fallbackModels.length) return false;
    activeFallbackIndex = next;
    log.info({ fallbackIndex: activeFallbackIndex, model: config.fallbackModels[activeFallbackIndex]!.model }, "switching to fallback model");
    return true;
  }

  return { allKeys, config, getActiveConfig, rotateKey, tryFallback };
}

async function sendRequest(
  ctx: RequestContext,
  body: Record<string, unknown>,
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const active = ctx.getActiveConfig();
  const url = buildUrl(active.baseUrl, "/chat/completions");
  const startedAt = Date.now();
  const payload = {
    model: active.model,
    max_tokens: ctx.config.maxTokens,
    temperature: ctx.config.temperature,
    stream: !!onToken,
    ...body,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${active.apiKey}`,
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (signal?.aborted) {
      throw new OpenFlowError("Request aborted", "LLM_TIMEOUT");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        if (isAuthError(response.status) && ctx.allKeys.length > 1 && ctx.rotateKey()) {
          headers.Authorization = `Bearer ${ctx.getActiveConfig().apiKey}`;
          continue;
        }
        if (isAuthError(response.status) && ctx.tryFallback()) {
          return sendRequest(ctx, body, onToken, signal);
        }
        if (response.status >= 500 && attempt < RETRY_DELAYS.length) {
          log.warn({ status: response.status, attempt }, "server error, retrying");
          await sleep(RETRY_DELAYS[attempt]!);
          continue;
        }
        const safeText = text.length > 200 ? text.slice(0, 200) + "..." : text;
        throw new OpenFlowError(
          `LLM API error ${response.status}: ${safeText}`,
          "LLM_REQUEST_FAILED",
        );
      }

      if (onToken && response.body) {
        const result = await parseSseStream(response.body, onToken);
        const duration = Date.now() - startedAt;
        log.info({ model: active.model, duration, streamed: true }, "LLM request completed");
        return result;
      }

      const json = (await response.json()) as unknown;
      const duration = Date.now() - startedAt;
      log.info({ model: active.model, duration, streamed: false }, "LLM request completed");
      return json;
    } catch (err) {
      if (err instanceof OpenFlowError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort")) {
        throw new OpenFlowError("Request timed out", "LLM_TIMEOUT");
      }
      if (attempt < RETRY_DELAYS.length) {
        log.warn({ err: msg, attempt }, "request failed, retrying");
        await sleep(RETRY_DELAYS[attempt]!);
        continue;
      }
      if (ctx.tryFallback()) {
        return sendRequest(ctx, body, onToken, signal);
      }
      throw new OpenFlowError(`LLM request failed: ${msg}`, "LLM_REQUEST_FAILED", err);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (ctx.tryFallback()) {
    return sendRequest(ctx, body, onToken, signal);
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
  const response = raw as Record<string, unknown>;
  const choices = response.choices as Array<Record<string, unknown>>;
  if (!choices?.[0]) {
    throw new OpenFlowError("No choices in LLM response", "LLM_REQUEST_FAILED");
  }

  const message = choices[0]!.message as Record<string, unknown>;
  const toolCallsRaw = message.tool_calls as Array<unknown> | undefined;

  if (toolCallsRaw && toolCallsRaw.length > 0) {
    return { type: "tool_calls", toolCalls: parseToolCalls(toolCallsRaw) };
  }

  return { type: "text", content: (message.content as string) ?? "" };
}

function parseCompleteResponse(raw: unknown): string {
  const response = raw as Record<string, unknown>;
  const choices = response.choices as Array<Record<string, unknown>>;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  return (message?.content as string) ?? "";
}

export function createLlmClient(config: LlmConfig): LlmClient {
  const ctx = createRequestContext(config);

  return {
    async chat(params: ChatParams): Promise<LlmResponse> {
      const body = buildChatBody(params);
      const raw = await sendRequest(ctx, body, params.onToken, params.signal);
      return parseChatResponse(raw);
    },

    async complete(params: CompleteParams): Promise<string> {
      const body: Record<string, unknown> = { messages: params.messages };
      const raw = await sendRequest(ctx, body, undefined, params.signal);
      return parseCompleteResponse(raw);
    },
  };
}
