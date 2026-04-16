import { existsSync, mkdirSync } from "node:fs";
import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import type { LlmClient, ChatMessage } from "../llm/index.js";
import type { MemoryStore } from "../memory/index.js";
import type { ToolExecutor } from "../tools/index.js";
import { createCompaction } from "./compaction.js";
import { createWorkspaceLoader, type WorkspaceLoader } from "./workspace.js";
import { buildSystemPrompt } from "./prompt-builder.js";

const log = createLogger("agent");

export interface AgentConfig {
  systemPrompt: string;
  maxToolRounds: number;
  workspace: string;
  dailyMemoryDays?: number;
}

export interface AgentDeps {
  llm: LlmClient;
  memory: MemoryStore;
  tools: ToolExecutor;
  config: AgentConfig;
}

export interface HandleMessageParams {
  sessionId: string;
  userMessage: string;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  systemPromptOverride?: string;
}

export type AgentResponse =
  | { type: "text"; content: string }
  | { type: "error"; error: OpenFlowError };

export interface AgentEngine {
  handleMessage(params: HandleMessageParams): Promise<AgentResponse>;
  getWorkspace(): WorkspaceLoader;
}

export function createAgentEngine(deps: AgentDeps): AgentEngine {
  const { llm, memory, tools, config } = deps;

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

  function resolveSystemPrompt(): string {
    if (config.systemPrompt) return config.systemPrompt;

    const files = workspace.loadAll();
    return buildSystemPrompt(files, { workspace: workspace.getWorkspaceDir() });
  }

  async function handleMessage(params: HandleMessageParams): Promise<AgentResponse> {
    const { sessionId, userMessage, onToken, signal, systemPromptOverride } = params;

    memory.addMessage({
      sessionId,
      role: "user",
      content: userMessage,
    });

    const systemPrompt = systemPromptOverride || resolveSystemPrompt();
    const rawContext = memory.buildContext(sessionId, 50);
    const contextMessages = await compaction.compactIfNeeded(sessionId, rawContext);
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
        log.error({ err: error.message }, "LLM request failed");
        return { type: "error", error };
      }

      if (response.type === "text") {
        memory.addMessage({
          sessionId,
          role: "assistant",
          content: response.content,
        });
        return { type: "text", content: response.content };
      }

      const toolCalls = response.toolCalls;
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: null,
        tool_calls: toolCalls,
      };
      messages.push(assistantMessage);

      memory.addMessage({
        sessionId,
        role: "assistant",
        content: "",
        toolCalls,
      });

      for (const toolCall of toolCalls) {
        let parsedArgs: Record<string, unknown>;
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          parsedArgs = {};
        }

        log.info({ toolName: toolCall.function.name, round }, "executing tool");
        const result = await tools.execute({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: parsedArgs,
        });

        const toolMessage: ChatMessage = {
          role: "tool",
          content: result.content,
          tool_call_id: toolCall.id,
        };
        messages.push(toolMessage);

        memory.addMessage({
          sessionId,
          role: "tool",
          content: result.content,
          toolCallId: toolCall.id,
        });

        log.info(
          { toolName: toolCall.function.name, isError: result.isError },
          "tool execution completed",
        );
      }
    }

    const overflowMsg = "Maximum tool call rounds reached. Please continue the conversation.";
    memory.addMessage({ sessionId, role: "assistant", content: overflowMsg });
    return { type: "text", content: overflowMsg };
  }

  return { handleMessage, getWorkspace: () => workspace };
}
