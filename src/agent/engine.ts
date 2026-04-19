import { existsSync, mkdirSync } from "node:fs";

import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import type { LlmClient, ChatMessage, ToolCall, LlmResponse, ToolDefinition } from "../llm/index.js";
import type { MemoryStore } from "../memory/index.js";
import type { ToolExecutor, ToolResult } from "../tools/index.js";
import type { ConfirmationHandler } from "../tools/confirmation.js";
import { createCompaction } from "./compaction.js";
import { createWorkspaceLoader, type WorkspaceLoader } from "./workspace.js";
import { buildSystemPrompt } from "./prompt-builder.js";
import { createSkillLoader, type SkillsConfig } from "./skill-loader.js";

const log = createLogger("agent");

export interface AgentConfig {
  systemPrompt: string;
  maxToolRounds: number;
  workspace: string;
  dailyMemoryDays?: number;
  skills?: SkillsConfig;
}

export interface AgentDeps {
  llm: LlmClient;
  memory: MemoryStore;
  tools: ToolExecutor;
  config: AgentConfig;
  confirmationHandler?: ConfirmationHandler;
  confirmationTimeout?: number;
}

export interface HandleMessageParams {
  sessionId: string;
  userMessage: string;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  systemPromptOverride?: string;
  chatId?: number | string;
}

export type AgentResponse =
  | { type: "text"; content: string }
  | { type: "error"; error: OpenFlowError };

export interface AgentEngine {
  handleMessage(params: HandleMessageParams): Promise<AgentResponse>;
  getWorkspace(): WorkspaceLoader;
}

export function createAgentEngine(deps: AgentDeps): AgentEngine {
  const { llm, memory, tools, config, confirmationHandler, confirmationTimeout } = deps;

  if (!existsSync(config.workspace)) {
    mkdirSync(config.workspace, { recursive: true });
  }

  const workspace = createWorkspaceLoader({
    workspaceDir: config.workspace,
    dailyMemoryDays: config.dailyMemoryDays,
  });

  const compaction = createCompaction({
    llm,
    config: { maxContextTokens: 30_000, compactThreshold: 0.8 },
  });

  const skillLoader = createSkillLoader(
    config.skills ?? { enabled: true, extraDirs: [], entries: {} },
    config.workspace,
  );
  const skills = skillLoader.loadAll();

  function persistMessage(sessionId: string, params: { role: "user" | "assistant" | "system"; content: string; toolCalls?: ToolCall[] }): void {
    try {
      memory.addMessage({ sessionId, ...params });
    } catch (err: unknown) {
      log.error({ sessionId, err }, `failed to save ${params.role} message`);
    }
  }

  function resolveSystemPrompt(): string {
    if (config.systemPrompt) return config.systemPrompt;
    const files = workspace.loadAll();
    return buildSystemPrompt(files, { workspace: workspace.getWorkspaceDir() }, skills);
  }

  function saveUserMessage(sessionId: string, content: string): OpenFlowError | null {
    try {
      memory.addMessage({ sessionId, role: "user", content });
      return null;
    } catch (err: unknown) {
      const error = err instanceof OpenFlowError
        ? err
        : new OpenFlowError("Failed to save user message", "DB_ERROR", err);
      log.error({ sessionId, err: error.message }, "failed to save user message");
      return error;
    }
  }

  async function buildConversationContext(sessionId: string, systemPromptOverride?: string): Promise<ChatMessage[]> {
    const systemPrompt = systemPromptOverride || resolveSystemPrompt();
    try {
      const rawContext = memory.buildContext(sessionId, 50);
      const contextMessages = await compaction.compactIfNeeded(sessionId, rawContext);
      return [{ role: "system", content: systemPrompt }, ...contextMessages];
    } catch (err: unknown) {
      const error = err instanceof OpenFlowError
        ? err
        : new OpenFlowError("Failed to build context", "DB_ERROR", err);
      log.error({ sessionId, err: error.message }, "failed to build context");
      throw error;
    }
  }

  async function callLlmOnce(
    messages: ChatMessage[],
    toolDefinitions: ToolDefinition[],
    onToken?: (token: string) => void,
    signal?: AbortSignal,
    round?: number,
  ): Promise<LlmResponse> {
    try {
      return await llm.chat({
        messages,
        toolDefinitions: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        onToken: round === 0 ? onToken : undefined,
        signal,
      });
    } catch (err: unknown) {
      const error = err instanceof OpenFlowError
        ? err
        : new OpenFlowError("LLM request failed", "LLM_REQUEST_FAILED", err);
      log.error({ round, err: error.message, code: error.code }, "LLM request failed");
      throw error;
    }
  }

  async function executeWithConfirmation(
    toolCallId: string,
    toolName: string,
    parsedArgs: Record<string, unknown>,
    chatId: number | string | undefined,
  ): Promise<ToolResult> {
    if (tools.needsConfirmation(toolName) && confirmationHandler && chatId !== undefined) {
      const confirmation = await confirmationHandler.requestConfirmation({
        chatId,
        toolName,
        toolArgs: parsedArgs,
        timeoutMs: confirmationTimeout ?? 60_000,
      });
      if (!confirmation.approved) {
        return { toolCallId, content: `사용자가 "${toolName}" 실행을 거부했습니다.`, isError: true };
      }
    }
    return tools.execute({ id: toolCallId, name: toolName, arguments: parsedArgs });
  }

  async function processToolCall(
    toolCall: { id: string; function: { name: string; arguments: string } },
    sessionId: string,
    chatId: number | string | undefined,
    round: number,
    messages: ChatMessage[],
  ): Promise<void> {
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch {
      log.warn(
        { sessionId, toolName: toolCall.function.name, rawArgs: toolCall.function.arguments.slice(0, 200) },
        "tool argument parse failed, using empty args",
      );
      parsedArgs = {};
    }

    const toolName = toolCall.function.name;
    log.info({ sessionId, toolName, round }, "executing tool");

    const result = await executeWithConfirmation(toolCall.id, toolName, parsedArgs, chatId);
    if (result.isError && tools.needsConfirmation(toolName)) {
      log.info({ sessionId, toolName, round }, "tool execution denied by user");
    }

    messages.push({ role: "tool", content: result.content, tool_call_id: toolCall.id });

    try {
      memory.addMessage({ sessionId, role: "tool", content: result.content, toolCallId: toolCall.id });
    } catch (err: unknown) {
      log.error({ sessionId, toolCallId: toolCall.id, err }, "failed to save tool result");
    }

    log.info({ sessionId, toolName, isError: result.isError, round }, "tool execution completed");
  }

  async function handleMessage(params: HandleMessageParams): Promise<AgentResponse> {
    const { sessionId, userMessage, onToken, signal, systemPromptOverride, chatId } = params;
    const startedAt = Date.now();
    log.info({ sessionId, messageLength: userMessage.length }, "handling message");

    const saveErr = saveUserMessage(sessionId, userMessage);
    if (saveErr) return { type: "error", error: saveErr };

    let messages: ChatMessage[];
    try {
      messages = await buildConversationContext(sessionId, systemPromptOverride);
    } catch (err: unknown) {
      return { type: "error", error: err as OpenFlowError };
    }

    const toolDefinitions = tools.getDefinitions();

    for (let round = 0; round < config.maxToolRounds; round++) {
      if (signal?.aborted) {
        return { type: "error", error: new OpenFlowError("Request aborted", "LLM_TIMEOUT") };
      }

      let response;
      try {
        response = await callLlmOnce(messages, toolDefinitions, onToken, signal, round);
      } catch (err: unknown) {
        return { type: "error", error: err as OpenFlowError };
      }

      if (response.type === "text") {
        persistMessage(sessionId, { role: "assistant", content: response.content });
        const duration = Date.now() - startedAt;
        log.info({ sessionId, duration, rounds: round, responseLength: response.content.length }, "message handled");
        return { type: "text", content: response.content };
      }

      messages.push({ role: "assistant", content: null, tool_calls: response.toolCalls });
      persistMessage(sessionId, { role: "assistant", content: "", toolCalls: response.toolCalls });
      for (const toolCall of response.toolCalls) {
        await processToolCall(toolCall, sessionId, chatId, round, messages);
      }
    }

    const overflowMsg = "Maximum tool call rounds reached. Please continue the conversation.";
    persistMessage(sessionId, { role: "assistant", content: overflowMsg });
    log.info({ sessionId, duration: Date.now() - startedAt, rounds: config.maxToolRounds }, "message handled (max rounds reached)");
    return { type: "text", content: overflowMsg };
  }

  return { handleMessage, getWorkspace: () => workspace };
}
