import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("telegram/offset");

const WRITE_RETRY_DELAYS = [100, 200];

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
    ensureDir();
    const data = JSON.stringify({ offset, updatedAt: Date.now() });
    for (let attempt = 0; attempt <= WRITE_RETRY_DELAYS.length; attempt++) {
      try {
        writeFileSync(filePath, data, "utf-8");
        return;
      } catch (err) {
        if (attempt < WRITE_RETRY_DELAYS.length) {
          const end = Date.now() + WRITE_RETRY_DELAYS[attempt]!;
          while (Date.now() < end) { /* busy wait */ }
          continue;
        }
        log.warn({ err }, "failed to persist update offset");
      }
    }
  }

  return { get, set };
}
