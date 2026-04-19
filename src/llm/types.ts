export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

import type { JsonSchemaProperty } from "../utils/json-schema.js";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, JsonSchemaProperty>;
      required?: string[];
    };
  };
}

export type { JsonSchemaProperty };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

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
