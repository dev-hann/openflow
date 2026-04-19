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

export interface InternalTool {
  name: string;
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}
