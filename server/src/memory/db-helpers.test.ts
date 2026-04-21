import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import {
  wrapDb,
  openDatabase,
  withTransaction,
  runMigrations,
  generateId,
  nowMs,
  MIGRATIONS,
} from "./db-helpers.js";

const TEST_DIR = join(tmpdir(), `openflow-db-helpers-test-${Date.now()}`);

describe("db-helpers", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("generateId", () => {
    it("should return a valid UUID", () => {
      const id = generateId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should return unique ids", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe("nowMs", () => {
    it("should return current timestamp in milliseconds", () => {
      const before = Date.now();
      const result = nowMs();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe("openDatabase", () => {
    it("should open database and set pragmas", () => {
      const dbPath = join(TEST_DIR, "test.db");
      const db = openDatabase(dbPath);
      try {
        const journalMode = db
          .prepare("PRAGMA journal_mode")
          .get() as Record<string, unknown>;
        expect(String(journalMode["journal_mode"])).toBe("wal");

        const foreignKeys = db
          .prepare("PRAGMA foreign_keys")
          .get() as Record<string, unknown>;
        expect(Number(foreignKeys["foreign_keys"])).toBe(1);

        const busyTimeout = db
          .prepare("PRAGMA busy_timeout")
          .get() as Record<string, unknown>;
        expect(Number(busyTimeout["timeout"])).toBe(5000);
      } finally {
        db.close();
      }
    });

    it("should throw OpenFlowError on invalid path", () => {
      expect(() => openDatabase("/nonexistent/deep/path/db.db")).toThrow(
        "Failed to open database",
      );
    });
  });

  describe("wrapDb", () => {
    it("should wrap successful operation", () => {
      const dbPath = join(TEST_DIR, "wrap-test.db");
      const db = openDatabase(dbPath);
      try {
        db.exec("CREATE TABLE t (v TEXT)");
        const result = wrapDb("test-op", () => {
          db.exec("INSERT INTO t VALUES ('hello')");
          return 42;
        });
        expect(result).toBe(42);
      } finally {
        db.close();
      }
    });

    it("should wrap failed operation as OpenFlowError", () => {
      const dbPath = join(TEST_DIR, "wrap-fail.db");
      const db = openDatabase(dbPath);
      try {
        expect(() =>
          wrapDb("fail-op", () => {
            throw new Error("boom");
          }),
        ).toThrow("Database operation failed: fail-op");
      } finally {
        db.close();
      }
    });
  });

  describe("withTransaction", () => {
    it("should commit on success", () => {
      const dbPath = join(TEST_DIR, "tx-commit.db");
      const db = openDatabase(dbPath);
      try {
        db.exec("CREATE TABLE t (v TEXT)");
        withTransaction(db, () => {
          db.exec("INSERT INTO t VALUES ('committed')");
        });
        const row = db.prepare("SELECT v FROM t").get() as Record<
          string,
          unknown
        >;
        expect(row.v).toBe("committed");
      } finally {
        db.close();
      }
    });

    it("should rollback on error", () => {
      const dbPath = join(TEST_DIR, "tx-rollback.db");
      const db = openDatabase(dbPath);
      try {
        db.exec("CREATE TABLE t (v TEXT)");
        expect(() =>
          withTransaction(db, () => {
            db.exec("INSERT INTO t VALUES ('will-rollback')");
            throw new Error("fail");
          }),
        ).toThrow("fail");

        const row = db.prepare("SELECT COUNT(*) as cnt FROM t").get() as Record<
          string,
          unknown
        >;
        expect(Number(row.cnt)).toBe(0);
      } finally {
        db.close();
      }
    });
  });

  describe("runMigrations", () => {
    it("should create sessions, messages, and providers tables", () => {
      const dbPath = join(TEST_DIR, "migration-test.db");
      const db = openDatabase(dbPath);
      try {
        runMigrations(db);

        const tables = (
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            )
            .all() as Array<Record<string, unknown>>
        ).map((r) => r.name as string);

        expect(tables).toContain("sessions");
        expect(tables).toContain("messages");
        expect(tables).toContain("providers");
      } finally {
        db.close();
      }
    });

    it("should create expected indexes", () => {
      const dbPath = join(TEST_DIR, "migration-indexes.db");
      const db = openDatabase(dbPath);
      try {
        runMigrations(db);

        const indexes = (
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
            )
            .all() as Array<Record<string, unknown>>
        ).map((r) => r.name as string);

        expect(indexes).toContain("idx_messages_session");
        expect(indexes).toContain("idx_messages_content");
      } finally {
        db.close();
      }
    });

    it("should be idempotent", () => {
      const dbPath = join(TEST_DIR, "migration-idempotent.db");
      const db = openDatabase(dbPath);
      try {
        runMigrations(db);
        runMigrations(db);

        const row = db
          .prepare("SELECT COUNT(*) as cnt FROM sessions")
          .get() as Record<string, unknown>;
        expect(Number(row.cnt)).toBe(0);
      } finally {
        db.close();
      }
    });
  });

  describe("MIGRATIONS", () => {
    it("should contain expected number of migration statements", () => {
      expect(MIGRATIONS.length).toBeGreaterThanOrEqual(4);
    });
  });
});
