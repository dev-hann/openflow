import { createLogger } from "../utils/logger.js";
import type { ChatMessage, ToolCall } from "../utils/message-types.js";

const log = createLogger("memory");

export function rowToSession(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: row.title as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function escapeLikeWildcards(str: string): string {
  return str.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function buildSearchSnippet(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + query.length + 40);
  return (
    (start > 0 ? "..." : "") +
    content.slice(start, end) +
    (end < content.length ? "..." : "")
  );
}

export function rowToMessage(row: Record<string, unknown>): ChatMessage {
  const role = row.role as string;
  const content = row.content as string;
  const toolCallId = row.tool_call_id as string | null;
  const toolCallsJson = row.tool_calls_json as string | null;

  if (role === "tool" && toolCallId) {
    return { role: "tool", content, tool_call_id: toolCallId };
  }
  if (role === "assistant" && toolCallsJson) {
    try {
      const toolCalls = JSON.parse(toolCallsJson) as ToolCall[];
      return {
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls,
      };
    } catch {
      log.warn(
        { role, jsonLength: toolCallsJson.length },
        "malformed tool_calls_json, returning plain message",
      );
    }
  }
  return { role: role as ChatMessage["role"], content } as ChatMessage;
}

export function rowToApiMessage(row: Record<string, unknown>) {
  const base = rowToMessage(row);
  return { ...base, createdAt: row.created_at as number };
}

export function rowToSearchResult(
  row: Record<string, unknown>,
  query: string,
) {
  return {
    sessionId: row.session_id as string,
    sessionTitle: row.session_title as string,
    role: row.role as string,
    content: row.content as string,
    timestamp: row.created_at as number,
    snippet: buildSearchSnippet(row.content as string, query),
  };
}
