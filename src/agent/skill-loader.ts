import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createLogger } from "../utils/logger.js";

const log = createLogger("skill-loader");

export interface SkillMeta {
  name: string;
  description: string;
  location: string;
}

export interface SkillsConfig {
  enabled: boolean;
  extraDirs: string[];
  entries: Record<string, { enabled: boolean }>;
}

interface ParsedFrontmatter {
  name?: string;
  description?: string;
}

const MAX_SKILL_FILE_BYTES = 256 * 1024;

function resolvePath(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

export function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match?.[1]) return null;

  const raw = match[1];
  const result: ParsedFrontmatter = {};

  for (const line of raw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (key === "name") result.name = value;
    if (key === "description") result.description = value;
  }

  return result;
}

function loadSkillsFromDir(
  rootDir: string,
  disabledEntries: Record<string, { enabled: boolean }>,
): SkillMeta[] {
  if (!existsSync(rootDir)) return [];

  let entries;
  try {
    entries = readdirSync(rootDir, { withFileTypes: true });
  } catch {
    log.warn({ dir: rootDir }, "failed to read skills directory");
    return [];
  }

  const skills: SkillMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFilePath = join(rootDir, entry.name, "SKILL.md");
    if (!existsSync(skillFilePath)) continue;

    const disabled = disabledEntries[entry.name];
    if (disabled && !disabled.enabled) {
      log.debug({ skill: entry.name }, "skill disabled by config");
      continue;
    }

    try {
      const content = readFileSync(skillFilePath, "utf-8");
      if (Buffer.byteLength(content) > MAX_SKILL_FILE_BYTES) {
        log.warn({ skill: entry.name }, "skill file too large, skipping");
        continue;
      }

      const meta = parseFrontmatter(content);
      if (!meta?.name || !meta?.description) {
        log.warn({ skill: entry.name, file: skillFilePath }, "skill missing name or description");
        continue;
      }

      skills.push({
        name: meta.name,
        description: meta.description,
        location: resolve(skillFilePath),
      });
    } catch (err) {
      log.warn({ skill: entry.name, err }, "failed to read skill file");
    }
  }

  return skills;
}

export function createSkillLoader(
  config: SkillsConfig,
  workspaceDir: string,
  options?: { globalDir?: string },
): { loadAll(): SkillMeta[] } {
  return {
    loadAll(): SkillMeta[] {
      if (!config.enabled) return [];

      const merged = new Map<string, SkillMeta>();

      const disabledEntries = config.entries ?? {};

      for (const dir of config.extraDirs) {
        const resolved = resolvePath(dir);
        for (const skill of loadSkillsFromDir(resolved, disabledEntries)) {
          merged.set(skill.name, skill);
        }
      }

      const globalDir = options?.globalDir ?? resolvePath("~/.openflow/skills");
      for (const skill of loadSkillsFromDir(globalDir, disabledEntries)) {
        merged.set(skill.name, skill);
      }

      const wsSkillsDir = join(resolvePath(workspaceDir), "skills");
      for (const skill of loadSkillsFromDir(wsSkillsDir, disabledEntries)) {
        merged.set(skill.name, skill);
      }

      const result = Array.from(merged.values());
      log.info({ count: result.length }, "skills loaded");
      return result;
    },
  };
}

export function buildSkillPrompt(skills: SkillMeta[]): string {
  if (skills.length === 0) return "";

  const lines = skills.map(
    (s) =>
      `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n    <location>${s.location}</location>\n  </skill>`,
  );

  return [
    "## Available Skills",
    "<skills>",
    lines.join("\n"),
    "</skills>",
    'When a task matches a skill description, use the read_file tool to load the full SKILL.md content from its location, then follow its instructions.',
  ].join("\n");
}
