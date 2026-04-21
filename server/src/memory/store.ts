import { dirname } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { ensureDirSync } from "../utils/fs.js";
import { createLogger } from "../utils/logger.js";
import type { ChatMessage, ToolCall } from "../utils/message-types.js";
import {
  wrapDb,
  generateId,
  nowMs,
  runMigrations,
  openDatabase,
  withTransaction,
} from "./db-helpers.js";
import {
  rowToSession,
  rowToMessage,
  rowToApiMessage,
  rowToSearchResult,
  escapeLikeWildcards,
} from "./row-mappers.js";

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

export type VisibleMessage = ChatMessage & { createdAt: number };

export interface MemoryStore {
  createSession(title?: string): Session;
  listSessions(): Session[];
  getSession(id: string): Session | null;
  deleteSession(id: string): void;
  addMessage(params: AddMessageParams): void;
  getMessages(sessionId: string, limit?: number): ChatMessage[];
  getMessageCount(sessionId: string): number;
  getVisibleMessages(
    sessionId: string,
    limit?: number,
    offset?: number,
  ): { messages: VisibleMessage[]; total: number };
  searchMessages(query: string, limit?: number): SearchResult[];
  buildContext(sessionId: string, maxSize: number): ChatMessage[];
  close(): void;
  getDb(): DatabaseSync;
}

function prepareSessionStatements(db: DatabaseSync) {
  return {
    insertSession: db.prepare(
      "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ),
    listSessions: db.prepare(
      "SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC, id DESC",
    ),
    getSession: db.prepare("SELECT id, title, created_at, updated_at FROM sessions WHERE id = ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
    insertMessage: db.prepare(
      "INSERT INTO messages (session_id, role, content, tool_call_id, tool_calls_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ),
    getMessages: db.prepare(
      "SELECT role, content, tool_call_id, tool_calls_json FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
    ),
    countMessages: db.prepare("SELECT COUNT(*) as count FROM messages WHERE session_id = ?"),
    getMessagesOffset: db.prepare(
      "SELECT role, content, tool_call_id, tool_calls_json FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
    ),
    countVisibleMessages: db.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE session_id = ? AND role IN ('user', 'assistant')",
    ),
    getVisibleMessages: db.prepare(
      "SELECT role, content, tool_call_id, tool_calls_json, created_at FROM messages WHERE session_id = ? AND role IN ('user', 'assistant') ORDER BY created_at ASC LIMIT ? OFFSET ?",
    ),
    searchMessages: db.prepare(
      `SELECT m.role, m.content, m.created_at, s.id as session_id, s.title as session_title
       FROM messages m JOIN sessions s ON m.session_id = s.id
       WHERE m.content LIKE ? ESCAPE '\\'
       ORDER BY m.created_at DESC LIMIT ?`,
    ),
    touchSession: db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?"),
  };
}

export function createMemoryStore(dbPath: string): MemoryStore {
  ensureDirSync(dirname(dbPath));
  const db = openDatabase(dbPath);
  runMigrations(db);
  const stmts = prepareSessionStatements(db);

  return {
    createSession(title?: string): Session {
      const id = generateId();
      const now = nowMs();
      wrapDb("createSession", () => stmts.insertSession.run(id, title ?? "New Session", now, now));
      log.info({ sessionId: id }, "session created");
      return {
        id,
        title: title ?? "New Session",
        createdAt: now,
        updatedAt: now,
      };
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
        withTransaction(db, () => {
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
      });
    },

    getMessages(sessionId: string, limit = 50): ChatMessage[] {
      return wrapDb("getMessages", () => {
        const rows = stmts.getMessages.all(sessionId, limit) as Array<Record<string, unknown>>;
        return rows.reverse().map(rowToMessage);
      });
    },

    getMessageCount(sessionId: string): number {
      return wrapDb("getMessageCount", () => {
        const row = stmts.countMessages.get(sessionId) as Record<string, unknown>;
        return (row?.count ?? 0) as number;
      });
    },

    getVisibleMessages(
      sessionId: string,
      limit = 50,
      offset = 0,
    ): { messages: VisibleMessage[]; total: number } {
      return wrapDb("getVisibleMessages", () => {
        const countRow = stmts.countVisibleMessages.get(sessionId) as Record<string, unknown>;
        const total = (countRow?.count ?? 0) as number;
        const rows = stmts.getVisibleMessages.all(sessionId, limit, offset) as Array<
          Record<string, unknown>
        >;
        return { messages: rows.map(rowToApiMessage), total };
      });
    },

    searchMessages(query: string, limit = 20): SearchResult[] {
      const escaped = escapeLikeWildcards(query);
      return wrapDb("searchMessages", () => {
        const rows = stmts.searchMessages.all(`%${escaped}%`, limit) as Array<
          Record<string, unknown>
        >;
        return rows.map((row) => rowToSearchResult(row, query));
      });
    },

    buildContext(sessionId: string, maxSize: number): ChatMessage[] {
      return wrapDb("buildContext", () => {
        const countRow = stmts.countMessages.get(sessionId) as Record<string, unknown>;
        const total = (countRow?.count ?? 0) as number;
        const offset = Math.max(0, total - maxSize);
        const rows = stmts.getMessagesOffset.all(sessionId, maxSize, offset) as Array<
          Record<string, unknown>
        >;
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
