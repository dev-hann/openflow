import { homedir } from "node:os";

import { createLogger } from "../utils/logger.js";
import { createJsonFileStore } from "../utils/json-file-store.js";

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

function isStoreData(data: unknown): data is StoreData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.tokens);
}

export function createPushTokenStore(filePath?: string): PushTokenStore {
  const resolvedPath = filePath ?? `${homedir()}/.openflow/push-tokens.json`;
  const store = createJsonFileStore<StoreData>(resolvedPath, DEFAULT_DATA, {
    validate: isStoreData,
  });

  function register(token: string, platform: PushTokenRecord["platform"], label: string): void {
    store.update((data) => {
      data.tokens = data.tokens.filter((t) => t.token !== token);
      const now = Date.now();
      data.tokens.push({ token, platform, label, registeredAt: now, lastUsedAt: now });
    });
    log.info({ platform, label }, "push token registered");
  }

  function unregister(token: string): boolean {
    let removed = false;
    store.update((data) => {
      const before = data.tokens.length;
      data.tokens = data.tokens.filter((t) => t.token !== token);
      removed = data.tokens.length < before;
    });
    if (removed) log.info({ token: token.slice(0, 8) + "..." }, "push token unregistered");
    return removed;
  }

  function getAll(): PushTokenRecord[] {
    return [...store.getData().tokens];
  }

  function getByToken(token: string): PushTokenRecord | undefined {
    return store.getData().tokens.find((t) => t.token === token);
  }

  function touchLastUsed(token: string): void {
    store.update((data) => {
      const record = data.tokens.find((t) => t.token === token);
      if (!record) return;
      record.lastUsedAt = Date.now();
    });
  }

  return { register, unregister, getAll, getByToken, touchLastUsed };
}
