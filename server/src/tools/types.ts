import type { ToolDefinition } from "../utils/message-types.js";

export type { ToolDefinition };

export interface ChannelSender {
  sendMessage(chatId: number | string, text: string): Promise<void>;
  sendPhoto(
    chatId: number | string,
    photo: string | Buffer,
    caption?: string,
  ): Promise<void>;
}

export interface InternalTool {
  name: string;
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}

export interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  killed?: boolean;
  signal?: string;
}

export function isExecError(err: unknown): err is ExecError {
  return err instanceof Error;
}
