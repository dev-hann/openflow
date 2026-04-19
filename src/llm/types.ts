import type { ChatMessage, ToolCall, ToolDefinition } from "../utils/message-types.js";

export type { ChatMessage, ToolCall, ToolDefinition };
export type { JsonSchemaProperty } from "../utils/json-schema.js";

export interface ChatParams {
  messages: ChatMessage[];
  toolDefinitions?: ToolDefinition[];
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export interface CompleteParams {
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export type LlmResponse =
  | { type: "text"; content: string }
  | { type: "tool_calls"; toolCalls: ToolCall[] };
