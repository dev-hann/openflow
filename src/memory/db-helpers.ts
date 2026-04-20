import { DatabaseSync } from "node:sqlite";

import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { isSqliteBusy, withSyncRetry } from "../utils/retry.js";

const log = createLogger("memory");

export const MIGRATIONS = [
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

export function generateId(): string {
  return crypto.randomUUID();
}

export function nowMs(): number {
  return Date.now();
}

export function wrapDb<T>(label: string, fn: () => T): T {
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

export function openDatabase(dbPath: string): DatabaseSync {
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

export function runMigrations(db: DatabaseSync): void {
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
