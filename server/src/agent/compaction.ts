import { createLogger } from "../utils/logger.js";
import type { LlmClient, ChatMessage } from "../llm/index.js";

const log = createLogger("agent/compaction");

const COMPACT_SYSTEM_PROMPT = `Summarize the following conversation concisely while preserving:
- All factual information, decisions, and conclusions
- Important context the assistant would need to continue the conversation
- File paths, URLs, error messages, and technical details
- The user's goals and preferences

Do NOT include greetings, pleasantries, or meta-commentary.
Write in third person. Be comprehensive but concise.`;

const CHARS_PER_TOKEN = 4;
const MAX_CONVERSATION_CHARS = 80_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function messageToText(msg: ChatMessage): string {
  if (msg.role === "tool") return `[Tool ${msg.tool_call_id}]: ${msg.content}`;
  if (msg.role === "assistant" && msg.tool_calls) {
    const calls = msg.tool_calls
      .map((tc) => `${tc.function.name}(${tc.function.arguments})`)
      .join(", ");
    return `[Assistant called: ${calls}]${msg.content ? ` ${msg.content}` : ""}`;
  }
  if (msg.role === "assistant") return `[Assistant]: ${msg.content ?? ""}`;
  return `[${msg.role}]: ${msg.content}`;
}

export interface CompactionConfig {
  maxContextTokens: number;
  compactThreshold: number;
}

export interface CompactionDeps {
  llm: LlmClient | (() => LlmClient);
  config: CompactionConfig;
}

export interface CompactionService {
  compactIfNeeded(sessionId: string, contextMessages: ChatMessage[]): Promise<ChatMessage[]>;
}

export function createCompaction(deps: CompactionDeps): CompactionService {
  const { config } = deps;
  const resolveLlm = typeof deps.llm === "function" ? deps.llm : () => deps.llm as LlmClient;

  async function compactIfNeeded(
    sessionId: string,
    contextMessages: ChatMessage[],
  ): Promise<ChatMessage[]> {
    const totalTokens = contextMessages.reduce(
      (sum, msg) => sum + estimateTokens(messageToText(msg)),
      0,
    );

    if (totalTokens < config.maxContextTokens) {
      return contextMessages;
    }

    log.info(
      { sessionId, totalTokens, maxTokens: config.maxContextTokens },
      "context exceeds limit, starting compaction",
    );

    const summary = await generateSummary(contextMessages);
    if (!summary) return contextMessages;

    const compactedCount = contextMessages.length;
    log.info(
      { sessionId, compactedCount, summaryTokens: estimateTokens(summary) },
      "compaction completed",
    );

    return [
      {
        role: "system" as const,
        content: `[Previous conversation summary]\n${summary}`,
      },
      ...contextMessages.slice(-Math.floor(contextMessages.length * 0.3)),
    ];
  }

  async function generateSummary(messages: ChatMessage[]): Promise<string | null> {
    let conversation = messages.map(messageToText).join("\n\n");

    if (conversation.length > MAX_CONVERSATION_CHARS) {
      const texts = messages.map(messageToText);
      const recentTexts: string[] = [];
      let totalLen = 0;
      for (let i = texts.length - 1; i >= 0; i--) {
        totalLen += texts[i]!.length + 2;
        if (totalLen > MAX_CONVERSATION_CHARS) break;
        recentTexts.unshift(texts[i]!);
      }
      conversation = `[Earlier conversation omitted for length]\n\n` + recentTexts.join("\n\n");
    }

    try {
      const result = await resolveLlm().complete({
        messages: [
          { role: "system", content: COMPACT_SYSTEM_PROMPT },
          { role: "user", content: conversation },
        ],
      });

      return result || null;
    } catch (err: unknown) {
      log.error({ err }, "compaction summary generation failed");
      return null;
    }
  }

  return { compactIfNeeded };
}
