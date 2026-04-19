import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { isSqliteBusy, withSyncRetry } from "../utils/retry.js";
import { ensureDirSync } from "../utils/fs.js";
import type { ChatMessage, ToolCall } from "../utils/message-types.js";

const log = createLogger("memory");

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AddMessageParams {
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  role: string;
  content: string;
  timestamp: number;
  snippet: string;
}

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AddProviderParams {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault?: boolean;
}

export interface MemoryStore {
  createSession(title?: string): Session;
  listSessions(): Session[];
  getSession(id: string): Session | null;
  deleteSession(id: string): void;
  addMessage(params: AddMessageParams): void;
  getMessages(sessionId: string, limit?: number): ChatMessage[];
  searchMessages(query: string, limit?: number): SearchResult[];
  buildContext(sessionId: string, maxSize: number): ChatMessage[];
  close(): void;
  getDb(): DatabaseSync;
}

export interface ProviderStore {
  listProviders(): Provider[];
  getProvider(id: string): Provider | null;
  getDefaultProvider(): Provider | null;
  addProvider(params: AddProviderParams): Provider;
  updateProvider(id: string, params: Partial<Pick<Provider, "name" | "baseUrl" | "apiKey" | "model">>): Provider | null;
  deleteProvider(id: string): void;
  setDefault(id: string): Provider | null;
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tool_call_id TEXT,
    tool_calls_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_content ON messages(content)`,
  `CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

function generateId(): string {
  return randomUUID();
}

function nowMs(): number {
  return Date.now();
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    title: row.title as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function rowToProvider(row: Record<string, unknown>): Provider {
  return {
    id: row.id as string,
    name: row.name as string,
    baseUrl: row.base_url as string,
    apiKey: row.api_key as string,
    model: row.model as string,
    isDefault: (row.is_default as number) === 1,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

function buildSearchSnippet(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + query.length + 40);
  return (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : "");
}

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  const role = row.role as string;
  const content = row.content as string;
  const toolCallId = row.tool_call_id as string | null;
  const toolCallsJson = row.tool_calls_json as string | null;

  if (role === "tool" && toolCallId) {
    return { role: "tool", content, tool_call_id: toolCallId };
  }
  if (role === "assistant" && toolCallsJson) {
    const toolCalls = JSON.parse(toolCallsJson) as ToolCall[];
    return { role: "assistant", content: content || null, tool_calls: toolCalls };
  }
  return { role: role as ChatMessage["role"], content } as ChatMessage;
}

function wrapDb<T>(label: string, fn: () => T): T {
  try {
    return withSyncRetry(fn, (err) => {
      if (isSqliteBusy(err)) {
        log.warn({ label }, "database busy, retrying");
        return true;
      }
      return false;
    });
  } catch (err: unknown) {
    log.error({ label, err }, "database operation failed");
    throw new OpenFlowError(`Database operation failed: ${label}`, "DB_ERROR", err);
  }
}

function openDatabase(dbPath: string): DatabaseSync {
  try {
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 5000");
    log.info({ dbPath }, "database opened");
    return db;
  } catch (err: unknown) {
    log.error({ dbPath, err }, "failed to open database");
    throw new OpenFlowError(`Failed to open database: ${dbPath}`, "DB_ERROR", err);
  }
}

function runMigrations(db: DatabaseSync): void {
  try {
    db.exec("BEGIN");
    for (const sql of MIGRATIONS) {
      db.exec(sql);
    }
    db.exec("COMMIT");
    log.info("database migration completed");
  } catch (err: unknown) {
    db.exec("ROLLBACK");
    log.error({ err }, "database migration failed");
    throw new OpenFlowError("Database migration failed", "DB_MIGRATION_FAILED", err);
  }
}

export function createMemoryStore(dbPath: string): MemoryStore {
  ensureDirSync(dirname(dbPath));
  const db = openDatabase(dbPath);
  runMigrations(db);

  const stmts = {
    insertSession: db.prepare(
      "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ),
    listSessions: db.prepare(
      "SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC, id DESC",
    ),
    getSession: db.prepare(
      "SELECT id, title, created_at, updated_at FROM sessions WHERE id = ?",
    ),
    deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
    insertMessage: db.prepare(
      "INSERT INTO messages (session_id, role, content, tool_call_id, tool_calls_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ),
    getMessages: db.prepare(
      "SELECT role, content, tool_call_id, tool_calls_json FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
    ),
    countMessages: db.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE session_id = ?",
    ),
    getMessagesOffset: db.prepare(
      "SELECT role, content, tool_call_id, tool_calls_json FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
    ),
    searchMessages: db.prepare(
      `SELECT m.role, m.content, m.created_at, s.id as session_id, s.title as session_title
       FROM messages m JOIN sessions s ON m.session_id = s.id
       WHERE m.content LIKE ?
       ORDER BY m.created_at DESC LIMIT ?`,
    ),
    touchSession: db.prepare(
      "UPDATE sessions SET updated_at = ? WHERE id = ?",
    ),
  };

  return {
    createSession(title?: string): Session {
      const id = generateId();
      const now = nowMs();
      wrapDb("createSession", () => stmts.insertSession.run(id, title ?? "New Session", now, now));
      log.info({ sessionId: id }, "session created");
      return { id, title: title ?? "New Session", createdAt: now, updatedAt: now };
    },

    listSessions(): Session[] {
      return wrapDb("listSessions", () =>
        (stmts.listSessions.all() as Array<Record<string, unknown>>).map(rowToSession),
      );
    },

    getSession(id: string): Session | null {
      return wrapDb("getSession", () => {
        const row = stmts.getSession.get(id) as Record<string, unknown> | undefined;
        if (!row) return null;
        return rowToSession(row);
      });
    },

    deleteSession(id: string): void {
      wrapDb("deleteSession", () => stmts.deleteSession.run(id));
      log.info({ sessionId: id }, "session deleted");
    },

    addMessage(params: AddMessageParams): void {
      const now = nowMs();
      const toolCallsJson = params.toolCalls ? JSON.stringify(params.toolCalls) : null;
      wrapDb("addMessage", () => {
        stmts.insertMessage.run(
          params.sessionId,
          params.role,
          params.content,
          params.toolCallId ?? null,
          toolCallsJson,
          now,
        );
        stmts.touchSession.run(now, params.sessionId);
      });
    },

    getMessages(sessionId: string, limit = 50): ChatMessage[] {
      return wrapDb("getMessages", () => {
        const rows = stmts.getMessages.all(sessionId, limit) as Array<Record<string, unknown>>;
        return rows.reverse().map(rowToMessage);
      });
    },

    searchMessages(query: string, limit = 20): SearchResult[] {
      return wrapDb("searchMessages", () => {
        const rows = stmts.searchMessages.all(`%${query}%`, limit) as Array<Record<string, unknown>>;
        return rows.map((row) => ({
          sessionId: row.session_id as string,
          sessionTitle: row.session_title as string,
          role: row.role as string,
          content: row.content as string,
          timestamp: row.created_at as number,
          snippet: buildSearchSnippet(row.content as string, query),
        }));
      });
    },

    buildContext(sessionId: string, maxSize: number): ChatMessage[] {
      return wrapDb("buildContext", () => {
        const countRow = stmts.countMessages.get(sessionId) as Record<string, unknown>;
        const total = (countRow?.count ?? 0) as number;
        const offset = Math.max(0, total - maxSize);
        const rows = stmts.getMessagesOffset.all(sessionId, maxSize, offset) as Array<Record<string, unknown>>;
        return rows.map(rowToMessage);
      });
    },

    close(): void {
      db.close();
      log.info("database closed");
    },

    getDb(): DatabaseSync {
      return db;
    },
  };
}

export function createProviderStore(db: DatabaseSync): ProviderStore {
  runMigrations(db);

  const stmts = {
    listProviders: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers ORDER BY created_at ASC",
    ),
    getProvider: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers WHERE id = ?",
    ),
    getDefaultProvider: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers WHERE is_default = 1 LIMIT 1",
    ),
    insertProvider: db.prepare(
      "INSERT INTO providers (id, name, base_url, api_key, model, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    updateProviderPartial: db.prepare(
      "UPDATE providers SET name = COALESCE(?, name), base_url = COALESCE(?, base_url), api_key = COALESCE(?, api_key), model = COALESCE(?, model), updated_at = ? WHERE id = ?",
    ),
    deleteProvider: db.prepare("DELETE FROM providers WHERE id = ?"),
    clearDefault: db.prepare("UPDATE providers SET is_default = 0"),
    setDefault: db.prepare("UPDATE providers SET is_default = 1, updated_at = ? WHERE id = ?"),
    getUpdatedProvider: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers WHERE id = ?",
    ),
  };

  return {
    listProviders(): Provider[] {
      return wrapDb("listProviders", () =>
        (stmts.listProviders.all() as Array<Record<string, unknown>>).map(rowToProvider),
      );
    },

    getProvider(id: string): Provider | null {
      return wrapDb("getProvider", () => {
        const row = stmts.getProvider.get(id) as Record<string, unknown> | undefined;
        return row ? rowToProvider(row) : null;
      });
    },

    getDefaultProvider(): Provider | null {
      return wrapDb("getDefaultProvider", () => {
        const row = stmts.getDefaultProvider.get() as Record<string, unknown> | undefined;
        return row ? rowToProvider(row) : null;
      });
    },

    addProvider(params: AddProviderParams): Provider {
      const id = generateId();
      const now = nowMs();
      const isDefault = params.isDefault ? 1 : 0;
      wrapDb("addProvider", () =>
        stmts.insertProvider.run(id, params.name, params.baseUrl, params.apiKey, params.model, isDefault, now, now),
      );
      log.info({ providerId: id, name: params.name }, "provider added");
      return {
        id,
        name: params.name,
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        model: params.model,
        isDefault: params.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
      };
    },

    updateProvider(id: string, params: Partial<Pick<Provider, "name" | "baseUrl" | "apiKey" | "model">>): Provider | null {
      const now = nowMs();
      wrapDb("updateProvider", () =>
        stmts.updateProviderPartial.run(
          params.name ?? null,
          params.baseUrl ?? null,
          params.apiKey ?? null,
          params.model ?? null,
          now,
          id,
        ),
      );
      const row = wrapDb("updateProvider:get", () =>
        stmts.getUpdatedProvider.get(id) as Record<string, unknown> | undefined,
      );
      if (!row) return null;
      log.info({ providerId: id }, "provider updated");
      return rowToProvider(row);
    },

    deleteProvider(id: string): void {
      wrapDb("deleteProvider", () => stmts.deleteProvider.run(id));
      log.info({ providerId: id }, "provider deleted");
    },

    setDefault(id: string): Provider | null {
      const now = nowMs();
      wrapDb("setDefault", () => {
        stmts.clearDefault.run();
        stmts.setDefault.run(now, id);
      });
      const row = wrapDb("setDefault:get", () =>
        stmts.getUpdatedProvider.get(id) as Record<string, unknown> | undefined,
      );
      if (!row) return null;
      log.info({ providerId: id }, "provider set as default");
      return rowToProvider(row);
    },
  };
}
