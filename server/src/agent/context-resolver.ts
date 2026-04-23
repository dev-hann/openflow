import { createLogger } from "../utils/logger.js";
import { OpenFlowError, type Result, ok, err } from "../utils/errors.js";
import type { ChatMessage, ToolCall } from "../llm/index.js";
import type { MemoryStore } from "../memory/index.js";
import type { CompactionService } from "./compaction.js";
import type { WorkspaceLoader } from "./workspace.js";
import type { SkillMeta } from "./skill-loader.js";
import { buildSystemPrompt } from "./prompt-builder.js";

const log = createLogger("agent/context-resolver");

export interface ContextResolverConfig {
  contextSize: number;
}

export interface ContextResolverDeps {
  memory: MemoryStore;
  compaction: CompactionService;
  workspace: WorkspaceLoader;
  systemPrompt: string;
  skills: SkillMeta[];
  config: ContextResolverConfig;
}

export function createContextResolver(deps: ContextResolverDeps) {
  const { memory, compaction, workspace, systemPrompt, skills, config } = deps;

  function resolveSystemPrompt(): string {
    if (systemPrompt) return systemPrompt;
    const files = workspace.loadAll();
    return buildSystemPrompt(
      files,
      { workspace: workspace.getWorkspaceDir() },
      skills,
    );
  }

  function persistMessage(
    sessionId: string,
    params: {
      role: "user" | "assistant" | "system";
      content: string;
      toolCalls?: ToolCall[];
    },
  ): boolean {
    try {
      memory.addMessage({ sessionId, ...params });
      return true;
    } catch (err: unknown) {
      log.error({ sessionId, err, role: params.role }, "failed to save message");
      return false;
    }
  }

  function saveUserMessage(sessionId: string, content: string): Result<void> {
    try {
      memory.addMessage({ sessionId, role: "user", content });
      return ok(undefined);
    } catch (cause: unknown) {
      const error =
        cause instanceof OpenFlowError
          ? cause
          : new OpenFlowError("Failed to save user message", "DB_ERROR", cause);
      log.error(
        { sessionId, err: error.message },
        "failed to save user message",
      );
      return err(error);
    }
  }

  async function buildConversationContext(
    sessionId: string,
    systemPromptOverride?: string,
  ): Promise<ChatMessage[]> {
    const resolved = systemPromptOverride || resolveSystemPrompt();
    try {
      const rawContext = memory.buildContext(sessionId, config.contextSize);
      const contextMessages = await compaction.compactIfNeeded(
        sessionId,
        rawContext,
      );
      return [{ role: "system", content: resolved }, ...contextMessages];
    } catch (err: unknown) {
      const error =
        err instanceof OpenFlowError
          ? err
          : new OpenFlowError("Failed to build context", "DB_ERROR", err);
      log.error({ sessionId, err: error.message }, "failed to build context");
      throw error;
    }
  }

  return { persistMessage, saveUserMessage, buildConversationContext };
}
