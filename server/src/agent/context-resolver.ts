import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import type { ChatMessage, ToolCall } from "../llm/index.js";
import type { MemoryStore } from "../memory/index.js";
import type { CompactionService } from "./compaction.js";
import type { WorkspaceLoader } from "./workspace.js";
import type { SkillMeta } from "./skill-loader.js";
import { buildSystemPrompt } from "./prompt-builder.js";

const log = createLogger("agent");

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
    return buildSystemPrompt(files, { workspace: workspace.getWorkspaceDir() }, skills);
  }

  function persistMessage(
    sessionId: string,
    params: {
      role: "user" | "assistant" | "system";
      content: string;
      toolCalls?: ToolCall[];
    },
  ): void {
    try {
      memory.addMessage({ sessionId, ...params });
    } catch (err: unknown) {
      log.error({ sessionId, err }, `failed to save ${params.role} message`);
    }
  }

  function saveUserMessage(sessionId: string, content: string): OpenFlowError | null {
    try {
      memory.addMessage({ sessionId, role: "user", content });
      return null;
    } catch (err: unknown) {
      const error =
        err instanceof OpenFlowError
          ? err
          : new OpenFlowError("Failed to save user message", "DB_ERROR", err);
      log.error({ sessionId, err: error.message }, "failed to save user message");
      return error;
    }
  }

  async function buildConversationContext(
    sessionId: string,
    systemPromptOverride?: string,
  ): Promise<ChatMessage[]> {
    const resolved = systemPromptOverride || resolveSystemPrompt();
    try {
      const rawContext = memory.buildContext(sessionId, config.contextSize);
      const contextMessages = await compaction.compactIfNeeded(sessionId, rawContext);
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
