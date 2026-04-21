import { existsSync, readFileSync } from "node:fs";

import type { InternalTool, ChannelSender } from "./types.js";
import { validateWorkspacePath } from "./file-tools.js";

export function createSendMessageTool(sender: ChannelSender): InternalTool {
  return {
    name: "send_message",
    definition: {
      type: "function",
      function: {
        name: "send_message",
        description: "Send a message to the connected client",
        parameters: {
          type: "object",
          properties: {
            chatId: {
              type: "number",
              description: "Chat ID to send to",
            },
            text: { type: "string", description: "Message text" },
          },
          required: ["chatId", "text"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const chatId = args.chatId as number;
      const text = args.text as string;
      await sender.sendMessage(chatId, text);
      return "OK";
    },
  };
}

export function createSendImageTool(sender: ChannelSender, workspace: string): InternalTool {
  return {
    name: "send_image",
    definition: {
      type: "function",
      function: {
        name: "send_image",
        description:
          "Send an image to the connected client. Supports public URLs and local file paths within the workspace.",
        parameters: {
          type: "object",
          properties: {
            chatId: {
              type: "number",
              description: "Chat ID to send to",
            },
            source: {
              type: "string",
              description:
                "Image source: a public URL (http/https) or a local file path relative to the workspace",
            },
            caption: {
              type: "string",
              description: "Optional caption for the image",
            },
          },
          required: ["chatId", "source"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const chatId = args.chatId as number;
      const source = args.source as string;
      const caption = args.caption as string | undefined;

      if (source.startsWith("http://") || source.startsWith("https://")) {
        await sender.sendPhoto(chatId, source, caption);
        return "OK";
      }

      const path = validateWorkspacePath(source, workspace);
      if (!existsSync(path)) throw new Error(`Image file not found: ${source}`);
      const buffer = readFileSync(path);
      await sender.sendPhoto(chatId, buffer, caption);
      return "OK";
    },
  };
}
