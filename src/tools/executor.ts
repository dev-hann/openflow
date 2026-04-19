import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { createLogger } from "../utils/logger.js";
import { createBrowserScreenshotTool, createBrowserExecuteTool } from "./browser.js";
import type { NotificationSender } from "../channel/types.js";

import type { InternalTool, ToolDefinition } from "./types.js";
export type { InternalTool, ToolDefinition } from "./types.js";
import { truncate } from "./utils.js";
import { webFetchTool, webSearchTool, httpClientTool } from "./web-tools.js";
import { createFileReadTool, createFileWriteTool, createListDirTool, validateWorkspacePath } from "./file-tools.js";

const log = createLogger("tools");

export interface ChannelSender extends NotificationSender {}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError: boolean;
}

export interface ToolsConfig {
  shell: { enabled: boolean; timeout: number };
  webFetch: { enabled: boolean };
  webSearch: { enabled: boolean };
  httpRequest: { enabled: boolean };
  browser: { enabled: boolean; timeout: number; headless: boolean };
  requireConfirmation?: string[];
  confirmationTimeout?: number;
}

export interface ToolExecutor {
  execute(call: ToolCall): Promise<ToolResult>;
  getDefinitions(): ToolDefinition[];
  needsConfirmation(toolName: string): boolean;
}

const shellTool: InternalTool = {
  name: "shell",
  definition: {
    type: "function",
    function: {
      name: "shell",
      description: "Execute a shell command and return stdout and stderr",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout: { type: "number", description: "Timeout in milliseconds (default 30000)" },
        },
        required: ["command"],
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const command = args.command as string;
    const timeout = (args.timeout as number) || 30_000;
    try {
      const result = execSync(command, {
        timeout,
        maxBuffer: 1024 * 1024,
        encoding: "utf-8",
        shell: "/bin/bash",
      });
      return truncate(result || "(no output)", 10_000);
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; killed?: boolean; signal?: string };
      if (e.killed || e.signal === "SIGTERM" || e.signal === "SIGKILL") {
        throw new Error(`Command timed out after ${timeout}ms`);
      }
      const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
      throw new Error(output || "Command failed with no output");
    }
  },
};

export function createToolExecutor(
  config: ToolsConfig,
  workspace: string,
  sender?: ChannelSender,
): ToolExecutor {
  const allTools: Map<string, InternalTool> = new Map();

  function register(tool: InternalTool): void {
    allTools.set(tool.name, tool);
  }

  if (config.shell.enabled) {
    const shellWithConfig: InternalTool = {
      ...shellTool,
      async execute(args: Record<string, unknown>): Promise<string> {
        return shellTool.execute({ ...args, timeout: (args.timeout as number) || config.shell.timeout });
      },
    };
    register(shellWithConfig);
  }
  register(createFileReadTool(workspace));
  register(createFileWriteTool(workspace));
  register(createListDirTool(workspace));
  if (config.webFetch.enabled) register(webFetchTool);
  if (config.webSearch.enabled) register(webSearchTool);
  if (config.httpRequest.enabled) register(httpClientTool);
  if (config.browser.enabled) {
    register(createBrowserScreenshotTool(workspace, config.browser));
    register(createBrowserExecuteTool(workspace, config.browser));
  }

  if (sender) {
    register({
      name: "send_message",
      definition: {
        type: "function",
        function: {
          name: "send_message",
          description: "Send a Telegram message",
          parameters: {
            type: "object",
            properties: {
              chatId: {
                type: "number",
                description: "Telegram chat ID to send to",
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
    });

    register({
      name: "send_image",
      definition: {
        type: "function",
        function: {
          name: "send_image",
          description: "Send an image via Telegram. Supports public URLs and local file paths within the workspace.",
          parameters: {
            type: "object",
            properties: {
              chatId: {
                type: "number",
                description: "Telegram chat ID to send to",
              },
              source: {
                type: "string",
                description: "Image source: a public URL (http/https) or a local file path relative to the workspace",
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
    });
  }

  const requireConfirmation = config.requireConfirmation ?? [];

  return {
    getDefinitions(): ToolDefinition[] {
      return Array.from(allTools.values()).map((t) => t.definition);
    },

    needsConfirmation(toolName: string): boolean {
      return requireConfirmation.includes(toolName);
    },

    async execute(call: ToolCall): Promise<ToolResult> {
      const tool = allTools.get(call.name);
      if (!tool) {
        log.warn({ toolName: call.name }, "unknown tool requested");
        return {
          toolCallId: call.id,
          content: `Unknown tool: ${call.name}`,
          isError: true,
        };
      }

      const startedAt = Date.now();
      try {
        const content = await tool.execute(call.arguments);
        const duration = Date.now() - startedAt;
        log.info({ toolName: call.name, duration, responseLength: content.length }, "tool execution completed");
        return { toolCallId: call.id, content, isError: false };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const duration = Date.now() - startedAt;
        log.error({ toolName: call.name, duration, err: msg }, "tool execution failed");
        return {
          toolCallId: call.id,
          content: `Tool error: ${msg}`,
          isError: true,
        };
      }
    },
  };
}
