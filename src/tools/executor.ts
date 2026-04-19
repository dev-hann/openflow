import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createLogger } from "../utils/logger.js";
import type { JsonSchemaProperty } from "../llm/types.js";
import { withRetry, isRetryableHttpError } from "../utils/retry.js";
import { createBrowserScreenshotTool, createBrowserExecuteTool } from "../agent/browser.js";

const log = createLogger("tools");

export interface ChannelSender {
  sendMessage(chatId: number | string, text: string): Promise<void>;
  sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string): Promise<void>;
}

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

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n... (truncated, ${str.length} bytes total)`;
}

function validateWorkspacePath(p: string, workspace: string): string {
  const resolved = resolve(p);
  const resolvedWorkspace = realpathSync(resolve(workspace));
  if (!existsSync(resolved)) {
    if (!resolved.startsWith(resolvedWorkspace)) {
      throw new Error("Path is outside workspace");
    }
    return resolved;
  }
  const realResolved = realpathSync(resolved);
  if (!realResolved.startsWith(resolvedWorkspace)) {
    throw new Error("Path is outside workspace");
  }
  return realResolved;
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

function createFileReadTool(workspace: string): InternalTool {
  return {
    name: "read_file",
    definition: {
      type: "function",
      function: {
        name: "read_file",
        description: "Read the contents of a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to the file (relative to workspace)" },
          },
          required: ["path"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const path = validateWorkspacePath(args.path as string, workspace);
      if (!existsSync(path)) throw new Error(`File not found: ${path}`);
      const content = readFileSync(path, "utf-8");
      return truncate(content, 50_000);
    },
  };
}

function createFileWriteTool(workspace: string): InternalTool {
  return {
    name: "write_file",
    definition: {
      type: "function",
      function: {
        name: "write_file",
        description: "Write content to a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to the file (relative to workspace)" },
            content: { type: "string", description: "Content to write" },
          },
          required: ["path", "content"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const path = validateWorkspacePath(args.path as string, workspace);
      const content = args.content as string;
      const dir = dirname(path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(path, content, "utf-8");
      return "OK";
    },
  };
}

function createListDirTool(workspace: string): InternalTool {
  return {
    name: "list_directory",
    definition: {
      type: "function",
      function: {
        name: "list_directory",
        description: "List files and directories",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path (relative to workspace)" },
          },
          required: ["path"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const path = validateWorkspacePath(args.path as string, workspace);
      if (!existsSync(path)) throw new Error(`Directory not found: ${path}`);
      const entries = readdirSync(path).map((name) => {
        const full = join(path, name);
        try {
          const s = statSync(full);
          return s.isDirectory() ? `${name}/` : name;
        } catch {
          return name;
        }
      });
      return entries.join("\n") || "(empty directory)";
    },
  };
}

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fe80")
  ) {
    throw new Error(`Requests to private/internal networks are blocked`);
  }
}

const webFetchTool: InternalTool = {
  name: "web_fetch",
  definition: {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch a web page and extract text content",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" },
          maxLength: { type: "number", description: "Max characters to return (default 10000)" },
        },
        required: ["url"],
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string;
    const maxLen = (args.maxLength as number) || 10_000;
    validateUrl(url);
    try {
      const html = await withRetry(
        async () => {
          const resp = await fetch(url, { redirect: "follow" } as never);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.text();
        },
        { delays: [500, 1000, 2000], shouldRetry: isRetryableHttpError },
      );
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#\d+;/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return truncate(text, maxLen);
    } catch (err) {
      throw new Error(`Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

const webSearchTool: InternalTool = {
  name: "web_search",
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web using DuckDuckGo",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          maxResults: { type: "number", description: "Max results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) || 5;
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const html = await withRetry(
        async () => {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.text();
        },
        { delays: [500, 1000, 2000], shouldRetry: isRetryableHttpError },
      );
      const results: Array<{ title: string; snippet: string; href: string }> = [];
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        results.push({
          href: match[1]!,
          title: match[2]!.replace(/<[^>]+>/g, "").trim(),
          snippet: match[3]!.replace(/<[^>]+>/g, "").trim(),
        });
      }
      if (results.length === 0) return "No results found.";
      return results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.href}`).join("\n\n");
    } catch (err) {
      throw new Error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

const httpClientTool: InternalTool = {
  name: "http_request",
  definition: {
    type: "function",
    function: {
      name: "http_request",
      description: "Make an HTTP request",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Request URL" },
          method: { type: "string", description: "HTTP method (GET, POST, PUT, DELETE)" },
          headers: { type: "string", description: "JSON string of headers" },
          body: { type: "string", description: "Request body" },
        },
        required: ["url", "method"],
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const url = args.url as string;
    const method = (args.method as string).toUpperCase();
    const headersRaw = args.headers as string | undefined;
    const body = args.body as string | undefined;
    validateUrl(url);

    let headers: Record<string, string> = {};
    if (headersRaw) {
      try {
        headers = JSON.parse(headersRaw) as Record<string, string>;
      } catch {
        throw new Error("Invalid headers JSON");
      }
    }

    try {
      const text = await withRetry(
        async () => {
          const resp = await fetch(url, { method, headers, body, redirect: "follow" } as never);
          const respText = await resp.text();
          return `Status: ${resp.status}\n${truncate(respText, 10_000)}`;
        },
        { delays: [500, 1000, 2000], shouldRetry: isRetryableHttpError },
      );
      return text;
    } catch (err) {
      throw new Error(`HTTP request failed: ${err instanceof Error ? err.message : String(err)}`);
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
