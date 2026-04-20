import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createLogger } from "./logger.js";

const log = createLogger("json-store");

export interface JsonFileStore<T> {
  getData(): T;
  setData(data: T): void;
  update(fn: (data: T) => void): void;
}

export function createJsonFileStore<T>(
  filePath: string,
  defaultValue: T,
  options?: { validate?: (data: unknown) => data is T },
): JsonFileStore<T> {
  let data = loadData(filePath, defaultValue, options?.validate);

  function loadData(path: string, def: T, validate?: (data: unknown) => data is T): T {
    try {
      if (!existsSync(path)) return structuredClone(def);
      const raw = readFileSync(path, "utf-8").trim();
      const parsed: unknown = JSON.parse(raw);
      if (validate) {
        return validate(parsed) ? parsed : structuredClone(def);
      }
      return parsed as T;
    } catch {
      log.debug({ path }, "failed to load json store, using defaults");
      return structuredClone(def);
    }
  }

  function save(dataToSave: T): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(dataToSave, null, 2) + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });
  }

  return {
    getData(): T {
      return data;
    },

    setData(newData: T): void {
      data = newData;
      save(data);
    },

    update(fn: (d: T) => void): void {
      fn(data);
      save(data);
    },
  };
}
