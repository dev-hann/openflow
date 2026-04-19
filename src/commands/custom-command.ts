import { execSync } from "node:child_process";
import { createLogger } from "../utils/logger.js";

const log = createLogger("commands");

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\//,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bchmod\s+777\s+\//,
  />\s*\/dev\/sd/,
  /\bcurl\b.*\|\s*(ba)?sh/,
  /\bwget\b.*\|\s*(ba)?sh/,
  /\b(nc|ncat|netcat)\s+-/i,
];

export function validateShellCommand(command: string): string | null {
  const trimmed = command.trim();
  if (trimmed.length === 0) return "Command is empty";
  if (trimmed.length > 500) return "Command too long (max 500 chars)";
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "Command contains a potentially dangerous pattern";
    }
  }
  return null;
}

export interface CustomCommand {
  action: "shell" | "reply";
  command?: string;
  text?: string;
  description?: string;
  timeout: number;
}

export type CommandsConfig = Record<string, CustomCommand>;

export function generateDescription(cmd: CustomCommand): string {
  if (cmd.description) return cmd.description;
  const content = cmd.action === "shell" ? cmd.command : cmd.text;
  if (!content) return cmd.action;
  return `${cmd.action === "shell" ? "Shell" : "Reply"}: ${content.length > 40 ? content.slice(0, 40) + "..." : content}`;
}

export function executeCustomCommand(cmd: CustomCommand): Promise<string> {
  if (cmd.action === "reply") {
    return Promise.resolve(cmd.text ?? "");
  }

  return new Promise((resolve) => {
    try {
      const output = execSync(cmd.command ?? "", {
        timeout: cmd.timeout,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        shell: "/bin/bash",
      });
      resolve(trimOutput(output));
    } catch (err) {
      if (err instanceof Error && "stdout" in err) {
        const execErr = err as Error & { stdout?: string; stderr?: string };
        const parts = [execErr.stdout, execErr.stderr].filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        );
        resolve(trimOutput(parts.join("\n")));
        return;
      }
      log.error({ err }, "custom command execution failed");
      resolve(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

function trimOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= 4000) return trimmed;
  return trimmed.slice(0, 4000) + "\n... (truncated)";
}
