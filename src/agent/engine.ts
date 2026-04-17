import { existsSync, mkdirSync } from "node:fs";
import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import type { LlmClient, ChatMessage } from "../llm/index.js";
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

  function resolveSystemPrompt(): string {
    if (config.systemPrompt) return config.systemPrompt;

    const files = workspace.loadAll();
    return buildSystemPrompt(files, { workspace: workspace.getWorkspaceDir() }, skills);
  }

  async function handleMessage(params: HandleMessageParams): Promise<AgentResponse> {
    const { sessionId, userMessage, onToken, signal, systemPromptOverride, chatId } = params;
    const startedAt = Date.now();
    log.info({ sessionId, messageLength: userMessage.length }, "handling message");

    try {
      memory.addMessage({
        sessionId,
        role: "user",
        content: userMessage,
      });
    } catch (err) {
      const error = err instanceof OpenFlowError
        ? err
        : new OpenFlowError("Failed to save user message", "DB_ERROR", err);
      log.error({ sessionId, err: error.message }, "failed to save user message");
      return { type: "error", error };
    }

    const systemPrompt = systemPromptOverride || resolveSystemPrompt();

    let contextMessages: ChatMessage[];
    try {
      const rawContext = memory.buildContext(sessionId, 50);
      contextMessages = await compaction.compactIfNeeded(sessionId, rawContext);
    } catch (err) {
      const error = err instanceof OpenFlowError
        ? err
        : new OpenFlowError("Failed to build context", "DB_ERROR", err);
      log.error({ sessionId, err: error.message }, "failed to build context");
      return { type: "error", error };
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...contextMessages,
    ];

    const toolDefinitions = tools.getDefinitions();

    for (let round = 0; round < config.maxToolRounds; round++) {
      if (signal?.aborted) {
        return { type: "error", error: new OpenFlowError("Request aborted", "LLM_TIMEOUT") };
      }

      let response;
      try {
        response = await llm.chat({
          messages,
          toolDefinitions: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          onToken: round === 0 ? onToken : undefined,
          signal,
        });
      } catch (err) {
        const error = err instanceof OpenFlowError
          ? err
          : new OpenFlowError("LLM request failed", "LLM_REQUEST_FAILED", err);
        log.error({ sessionId, round, err: error.message, code: error.code }, "LLM request failed");
        return { type: "error", error };
      }

      if (response.type === "text") {
        try {
          memory.addMessage({
            sessionId,
            role: "assistant",
            content: response.content,
          });
        } catch (err) {
          log.error({ sessionId, err }, "failed to save assistant message");
        }
        const duration = Date.now() - startedAt;
        log.info({ sessionId, duration, rounds: round, responseLength: response.content.length }, "message handled");
        return { type: "text", content: response.content };
      }

      const toolCalls = response.toolCalls;
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: null,
        tool_calls: toolCalls,
      };
      messages.push(assistantMessage);

      try {
        memory.addMessage({
          sessionId,
          role: "assistant",
          content: "",
          toolCalls,
        });
      } catch (err) {
        log.error({ sessionId, err }, "failed to save assistant tool_calls");
      }

      for (const toolCall of toolCalls) {
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

        log.info({ sessionId, toolName: toolCall.function.name, round }, "executing tool");

        const toolName = toolCall.function.name;
        let result: ToolResult;

        if (
          tools.needsConfirmation(toolName) &&
          confirmationHandler &&
          chatId !== undefined
        ) {
          const confirmation = await confirmationHandler.requestConfirmation({
            chatId,
            toolName,
            toolArgs: parsedArgs,
            timeoutMs: confirmationTimeout ?? 60_000,
          });

          if (!confirmation.approved) {
            log.info({ sessionId, toolName, round }, "tool execution denied by user");
            result = {
              toolCallId: toolCall.id,
              content: `사용자가 "${toolName}" 실행을 거부했습니다.`,
              isError: true,
            };
          } else {
            result = await tools.execute({
              id: toolCall.id,
              name: toolName,
              arguments: parsedArgs,
            });
          }
        } else {
          result = await tools.execute({
            id: toolCall.id,
            name: toolName,
            arguments: parsedArgs,
          });
        }

        const toolMessage: ChatMessage = {
          role: "tool",
          content: result.content,
          tool_call_id: toolCall.id,
        };
        messages.push(toolMessage);

        try {
          memory.addMessage({
            sessionId,
            role: "tool",
            content: result.content,
            toolCallId: toolCall.id,
          });
        } catch (err) {
          log.error({ sessionId, toolCallId: toolCall.id, err }, "failed to save tool result");
        }

        log.info(
          { sessionId, toolName: toolCall.function.name, isError: result.isError, round },
          "tool execution completed",
        );
      }
    }

    const overflowMsg = "Maximum tool call rounds reached. Please continue the conversation.";
    try {
      memory.addMessage({ sessionId, role: "assistant", content: overflowMsg });
    } catch (err) {
      log.error({ sessionId, err }, "failed to save overflow message");
    }
    const duration = Date.now() - startedAt;
    log.info({ sessionId, duration, rounds: config.maxToolRounds }, "message handled (max rounds reached)");
    return { type: "text", content: overflowMsg };
  }

  return { handleMessage, getWorkspace: () => workspace };
}
