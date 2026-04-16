import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("telegram/offset");

export interface OffsetStore {
  get(): number;
  set(offset: number): void;
}

export function createOffsetStore(filePath: string): OffsetStore {
  const dir = dirname(filePath);

  function ensureDir(): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  function get(): number {
    try {
      if (!existsSync(filePath)) return 0;
      const raw = readFileSync(filePath, "utf-8").trim();
      const parsed = JSON.parse(raw) as { offset: number };
      return typeof parsed.offset === "number" ? parsed.offset : 0;
    } catch {
      return 0;
    }
  }

  let lastWritten = 0;

  function set(offset: number): void {
    if (offset <= lastWritten) return;
    lastWritten = offset;
    try {
      ensureDir();
      writeFileSync(filePath, JSON.stringify({ offset, updatedAt: Date.now() }), "utf-8");
    } catch (err) {
      log.warn({ err }, "failed to persist update offset");
    }
  }

  return { get, set };
}
