import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { OpenFlowError } from "../utils/errors.js";
import type { ChatMessage, ToolCall } from "../llm/types.js";

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
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowMs(): number {
  return Date.now();
}

export function createMemoryStore(dbPath: string): MemoryStore {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  } catch (err) {
    throw new OpenFlowError(`Failed to open database: ${dbPath}`, "DB_ERROR", err);
  }

  try {
    db.exec("BEGIN");
    for (const sql of MIGRATIONS) {
      db.exec(sql);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw new OpenFlowError("Database migration failed", "DB_MIGRATION_FAILED", err);
  }

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

  return {
    createSession(title?: string): Session {
      const id = generateId();
      const now = nowMs();
      stmts.insertSession.run(id, title ?? "New Session", now, now);
      return { id, title: title ?? "New Session", createdAt: now, updatedAt: now };
    },

    listSessions(): Session[] {
      return stmts.listSessions.all().map((row) => ({
        id: (row as Record<string, unknown>).id as string,
        title: (row as Record<string, unknown>).title as string,
        createdAt: (row as Record<string, unknown>).created_at as number,
        updatedAt: (row as Record<string, unknown>).updated_at as number,
      }));
    },

    getSession(id: string): Session | null {
      const row = stmts.getSession.get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: row.id as string,
        title: row.title as string,
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
      };
    },

    deleteSession(id: string): void {
      stmts.deleteSession.run(id);
    },

    addMessage(params: AddMessageParams): void {
      const now = nowMs();
      const toolCallsJson = params.toolCalls ? JSON.stringify(params.toolCalls) : null;
      stmts.insertMessage.run(
        params.sessionId,
        params.role,
        params.content,
        params.toolCallId ?? null,
        toolCallsJson,
        now,
      );
      stmts.touchSession.run(now, params.sessionId);
    },

    getMessages(sessionId: string, limit = 50): ChatMessage[] {
      const rows = stmts.getMessages.all(sessionId, limit) as Array<Record<string, unknown>>;
      return rows.reverse().map(rowToMessage);
    },

    searchMessages(query: string, limit = 20): SearchResult[] {
      const rows = stmts.searchMessages.all(`%${query}%`, limit) as Array<Record<string, unknown>>;
      return rows.map((row) => {
        const content = row.content as string;
        const idx = content.toLowerCase().indexOf(query.toLowerCase());
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + query.length + 40);
        return {
          sessionId: row.session_id as string,
          sessionTitle: row.session_title as string,
          role: row.role as string,
          content,
          timestamp: row.created_at as number,
          snippet: (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : ""),
        };
      });
    },

    buildContext(sessionId: string, maxSize: number): ChatMessage[] {
      const countRow = stmts.countMessages.get(sessionId) as Record<string, unknown>;
      const total = (countRow?.count ?? 0) as number;
      const offset = Math.max(0, total - maxSize);
      const rows = stmts.getMessagesOffset.all(sessionId, maxSize, offset) as Array<Record<string, unknown>>;
      return rows.map(rowToMessage);
    },

    close(): void {
      db.close();
    },
  };
}
