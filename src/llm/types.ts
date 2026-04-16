export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

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

export interface JsonSchemaProperty {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  enum?: string[];
  items?: JsonSchemaProperty;
}

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
