import type { ToolDefinition } from "../utils/message-types.js";

export type { ToolDefinition };

export interface InternalTool {
  name: string;
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}
