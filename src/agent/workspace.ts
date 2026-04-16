import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createLogger } from "../utils/logger.js";

const log = createLogger("workspace");

const DAILY_MEMORY_DIR = "daily";
const MAX_DAILY_FILE_CHARS = 1200;
const MAX_DAILY_TOTAL_CHARS = 2800;
const DEFAULT_DAILY_MEMORY_DAYS = 2;
const MAX_DAILY_MEMORY_DAYS = 14;

export interface WorkspaceConfig {
  workspaceDir: string;
  dailyMemoryDays?: number;
}

export interface WorkspaceFiles {
  persona: string | null;
  user: string | null;
  memory: string | null;
  dailyMemory: string | null;
}

function resolvePath(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function safeRead(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8").trim();
    return content || null;
  } catch {
    return null;
  }
}

function truncateToChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + "...";
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function listRecentDailyFiles(dailyDir: string, days: number): string[] {
  if (!existsSync(dailyDir)) return [];
  const files = readdirSync(dailyDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();
  return files.slice(0, days);
}

export function createWorkspaceLoader(config: WorkspaceConfig) {
  const dir = resolvePath(config.workspaceDir);
  const dailyDays = Math.min(
    config.dailyMemoryDays ?? DEFAULT_DAILY_MEMORY_DAYS,
    MAX_DAILY_MEMORY_DAYS,
  );

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    log.info({ dir }, "created workspace directory");
  }

  const dailyDir = join(dir, DAILY_MEMORY_DIR);
  if (!existsSync(dailyDir)) {
    mkdirSync(dailyDir, { recursive: true });
  }

  function loadAll(): WorkspaceFiles {
    const persona = safeRead(join(dir, "PERSONA.md"));
    const user = safeRead(join(dir, "USER.md"));
    const memory = safeRead(join(dir, "MEMORY.md"));
    const dailyMemory = loadDailyMemory();
    return { persona, user, memory, dailyMemory };
  }

  function loadDailyMemory(): string | null {
    const files = listRecentDailyFiles(dailyDir, dailyDays);
    if (files.length === 0) return null;

    const parts: string[] = [];
    let totalChars = 0;

    for (const file of files) {
      const content = safeRead(join(dailyDir, file));
      if (!content) continue;
      const truncated = truncateToChars(content, MAX_DAILY_FILE_CHARS);
      const entry = `### ${file.replace(".md", "")}\n${truncated}`;
      if (totalChars + entry.length > MAX_DAILY_TOTAL_CHARS) break;
      parts.push(entry);
      totalChars += entry.length;
    }

    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  function writeDailyMemory(content: string): void {
    const filePath = join(dailyDir, `${todayDateString()}.md`);
    const existing = safeRead(filePath) ?? "";
    const combined = existing ? `${existing}\n\n${content}` : content;
    writeFileSync(filePath, combined, "utf-8");
    log.info({ file: filePath }, "daily memory written");
  }

  function getPersonaPath(): string {
    return join(dir, "PERSONA.md");
  }

  function getWorkspaceDir(): string {
    return dir;
  }

  function writePersona(content: string): void {
    writeFileSync(join(dir, "PERSONA.md"), content, "utf-8");
    log.info("PERSONA.md written");
  }

  function writeUser(content: string): void {
    writeFileSync(join(dir, "USER.md"), content, "utf-8");
    log.info("USER.md written");
  }

  function hasPersona(): boolean {
    return existsSync(join(dir, "PERSONA.md"));
  }

  return { loadAll, loadDailyMemory, writeDailyMemory, writePersona, writeUser, hasPersona, getPersonaPath, getWorkspaceDir };
}

export type WorkspaceLoader = ReturnType<typeof createWorkspaceLoader>;
