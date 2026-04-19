import type { ToolDefinition } from "../utils/message-types.js";

export type { ToolDefinition };

export interface ChannelSender {
  sendMessage(chatId: number | string, text: string): Promise<void>;
  sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string): Promise<void>;
}

export interface InternalTool {
  name: string;
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}
