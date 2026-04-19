import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";

import { createLogger } from "../utils/logger.js";

const log = createLogger("notification/tokens");

export interface PushTokenRecord {
  token: string;
  platform: "ios" | "android" | "web";
  label: string;
  registeredAt: number;
  lastUsedAt: number;
}

export interface PushTokenStore {
  register(token: string, platform: PushTokenRecord["platform"], label: string): void;
  unregister(token: string): boolean;
  getAll(): PushTokenRecord[];
  getByToken(token: string): PushTokenRecord | undefined;
  touchLastUsed(token: string): void;
}

interface StoreData {
  tokens: PushTokenRecord[];
}

const DEFAULT_DATA: StoreData = { tokens: [] };

export function createPushTokenStore(filePath?: string): PushTokenStore {
  const resolvedPath = filePath ?? `${homedir()}/.openflow/push-tokens.json`;
  let data: StoreData = loadData(resolvedPath);

  function loadData(path: string): StoreData {
    try {
      if (!existsSync(path)) return { ...DEFAULT_DATA };
      const raw = readFileSync(path, "utf-8").trim();
      const parsed = JSON.parse(raw) as StoreData;
      if (!Array.isArray(parsed.tokens)) return { ...DEFAULT_DATA };
      return parsed;
    } catch {
      log.debug({ path }, "failed to load push token store, using defaults");
      return { ...DEFAULT_DATA };
    }
  }

  function save(): void {
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(resolvedPath, JSON.stringify(data, null, 2) + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });
    log.debug({ count: data.tokens.length }, "token store saved");
  }

  function register(token: string, platform: PushTokenRecord["platform"], label: string): void {
    data.tokens = data.tokens.filter((t) => t.token !== token);
    const now = Date.now();
    data.tokens.push({ token, platform, label, registeredAt: now, lastUsedAt: now });
    save();
    log.info({ platform, label }, "push token registered");
  }

  function unregister(token: string): boolean {
    const before = data.tokens.length;
    data.tokens = data.tokens.filter((t) => t.token !== token);
    if (data.tokens.length === before) return false;
    save();
    log.info({ token: token.slice(0, 8) + "..." }, "push token unregistered");
    return true;
  }

  function getAll(): PushTokenRecord[] {
    return [...data.tokens];
  }

  function getByToken(token: string): PushTokenRecord | undefined {
    return data.tokens.find((t) => t.token === token);
  }

  function touchLastUsed(token: string): void {
    const record = data.tokens.find((t) => t.token === token);
    if (!record) return;
    record.lastUsedAt = Date.now();
    save();
  }

  return { register, unregister, getAll, getByToken, touchLastUsed };
}
