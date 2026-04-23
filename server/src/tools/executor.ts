import { execSync } from "node:child_process";

import { createLogger } from "../utils/logger.js";
import { OpenFlowError, getErrorMessage } from "../utils/errors.js";
import { createBrowserTools } from "./browser.js";
import type { InternalTool, ToolDefinition, ChannelSender } from "./types.js";
import { isExecError } from "./types.js";
import { truncate, requireString, optionalNumber } from "./utils.js";
import { webFetchTool, webSearchTool, httpClientTool } from "./web-tools.js";
import { createFileReadTool, createFileWriteTool, createListDirTool } from "./file-tools.js";
import {
  createSendMessageTool,
  createSendImageTool,
  SEND_MESSAGE_TOOL_NAME,
  SEND_IMAGE_TOOL_NAME,
} from "./channel-tools.js";
export type { InternalTool, ToolDefinition, ChannelSender, ExecError } from "./types.js";
export { isExecError } from "./types.js";

const log = createLogger("tools");

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
  updateSender(sender: ChannelSender): void;
}

function createShellTool(workspace: string): InternalTool {
  return {
    name: "shell",
    definition: {
      type: "function",
      function: {
        name: "shell",
        description: "Execute a shell command and return stdout and stderr",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "Shell command to execute",
            },
            timeout: {
              type: "number",
              description: "Timeout in milliseconds (default 30000)",
            },
          },
          required: ["command"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const command = requireString(args, "command");
      const timeout = optionalNumber(args, "timeout") ?? 30_000;
      try {
        const result = execSync(command, {
          timeout,
          maxBuffer: 1024 * 1024,
          encoding: "utf-8",
          shell: "/bin/bash",
          cwd: workspace,
        });
        return truncate(result || "(no output)", 10_000);
      } catch (err: unknown) {
        if (!isExecError(err)) throw err;
        if (err.killed || err.signal === "SIGTERM" || err.signal === "SIGKILL") {
          throw new OpenFlowError(`Command timed out after ${timeout}ms`, "TOOL_EXECUTION_FAILED");
        }
        const output = [err.stdout, err.stderr].filter(Boolean).join("\n");
        throw new OpenFlowError(output || "Command failed with no output", "TOOL_EXECUTION_FAILED");
      }
    },
  };
}

function registerDefaultTools(
  config: ToolsConfig,
  workspace: string,
  sender: ChannelSender | undefined,
  register: (tool: InternalTool) => void,
): void {
  if (config.shell.enabled) {
    const baseShellTool = createShellTool(workspace);
    const shellWithConfig: InternalTool = {
      ...baseShellTool,
      async execute(args: Record<string, unknown>): Promise<string> {
        return baseShellTool.execute({
          ...args,
          timeout: optionalNumber(args, "timeout") ?? config.shell.timeout,
        });
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
    const browserTools = createBrowserTools(workspace, config.browser);
    register(browserTools.screenshot);
    register(browserTools.execute);
  }
  if (sender) {
    register(createSendMessageTool(sender));
    register(createSendImageTool(sender, workspace));
  }
}

export function createToolExecutor(
  config: ToolsConfig,
  workspace: string,
  sender?: ChannelSender,
): ToolExecutor {
  const allTools: Map<string, InternalTool> = new Map();

  function register(tool: InternalTool): void {
    allTools.set(tool.name, tool);
  }

  registerDefaultTools(config, workspace, sender, register);

  const requireConfirmation = config.requireConfirmation ?? [];

  return {
    getDefinitions(): ToolDefinition[] {
      return Array.from(allTools.values()).map((t) => t.definition);
    },

    needsConfirmation(toolName: string): boolean {
      return requireConfirmation.includes(toolName);
    },

    updateSender(newSender: ChannelSender): void {
      allTools.delete(SEND_MESSAGE_TOOL_NAME);
      allTools.delete(SEND_IMAGE_TOOL_NAME);
      register(createSendMessageTool(newSender));
      register(createSendImageTool(newSender, workspace));
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
        log.info(
          { toolName: call.name, duration, responseLength: content.length },
          "tool execution completed",
        );
        return { toolCallId: call.id, content, isError: false };
      } catch (err: unknown) {
        const duration = Date.now() - startedAt;
        log.error({ toolName: call.name, duration, err }, "tool execution failed");
        return {
          toolCallId: call.id,
          content: `Tool error: ${getErrorMessage(err)}`,
          isError: true,
        };
      }
    },
  };
}
