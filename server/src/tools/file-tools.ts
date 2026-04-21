import {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { createLogger } from "../utils/logger.js";
import type { InternalTool } from "./types.js";
import { truncate } from "./utils.js";

const log = createLogger("tools/file");

export function validateWorkspacePath(p: string, workspace: string): string {
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

export function createFileReadTool(workspace: string): InternalTool {
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
            path: {
              type: "string",
              description: "Path to the file (relative to workspace)",
            },
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

export function createFileWriteTool(workspace: string): InternalTool {
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
            path: {
              type: "string",
              description: "Path to the file (relative to workspace)",
            },
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

export function createListDirTool(workspace: string): InternalTool {
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
            path: {
              type: "string",
              description: "Directory path (relative to workspace)",
            },
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
          log.debug({ path: full }, "failed to stat entry, skipping");
          return name;
        }
      });
      return entries.join("\n") || "(empty directory)";
    },
  };
}
