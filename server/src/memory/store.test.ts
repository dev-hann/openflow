import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { createMemoryStore, type MemoryStore } from "./store.js";

describe("createMemoryStore", () => {
  const testDir = join(tmpdir(), "openflow-test-memory-" + Date.now());
  const dbPath = join(testDir, "test.db");
  let store: MemoryStore;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    store = createMemoryStore(dbPath);
  });

  afterEach(() => {
    store.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("sessions", () => {
    it("should create a session", () => {
      const session = store.createSession("Test Session");
      expect(session.id).toBeTruthy();
      expect(session.title).toBe("Test Session");
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.updatedAt).toBe(session.createdAt);
    });

    it("should create session with default title", () => {
      const session = store.createSession();
      expect(session.title).toBe("New Session");
    });

    it("should list sessions ordered by updatedAt DESC", async () => {
      store.createSession("A");
      await new Promise((r) => setTimeout(r, 5));
      const sessionB = store.createSession("B");
      await new Promise((r) => setTimeout(r, 5));
      store.addMessage({
        sessionId: sessionB.id,
        role: "user",
        content: "update B",
      });
      const sessions = store.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0]!.title).toBe("B");
      expect(sessions[1]!.title).toBe("A");
    });

    it("should get session by id", () => {
      const session = store.createSession("FindMe");
      const found = store.getSession(session.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe("FindMe");
    });

    it("should return null for nonexistent session", () => {
      expect(store.getSession("nonexistent")).toBeNull();
    });

    it("should delete session", () => {
      const session = store.createSession("ToDelete");
      store.deleteSession(session.id);
      expect(store.getSession(session.id)).toBeNull();
    });
  });

  describe("messages", () => {
    it("should add and retrieve messages", () => {
      const session = store.createSession("Chat");
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "Hello",
      });
      store.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Hi there",
      });

      const messages = store.getMessages(session.id);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: "user", content: "Hello" });
      expect(messages[1]).toEqual({ role: "assistant", content: "Hi there" });
    });

    it("should respect limit parameter", () => {
      const session = store.createSession("Limited");
      for (let i = 0; i < 10; i++) {
        store.addMessage({
          sessionId: session.id,
          role: "user",
          content: `msg ${i}`,
        });
      }
      const messages = store.getMessages(session.id, 3);
      expect(messages).toHaveLength(3);
    });

    it("should store tool_calls in assistant messages", () => {
      const session = store.createSession("Tools");
      store.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tc_1",
            type: "function" as const,
            function: { name: "shell", arguments: '{"command":"ls"}' },
          },
        ],
      });
      store.addMessage({
        sessionId: session.id,
        role: "tool",
        content: "file1.txt\nfile2.txt",
        toolCallId: "tc_1",
      });

      const messages = store.getMessages(session.id);
      expect(messages).toHaveLength(2);

      const assistantMsg = messages[0]!;
      expect(assistantMsg.role).toBe("assistant");
      if ("tool_calls" in assistantMsg) {
        expect(assistantMsg.tool_calls).toHaveLength(1);
      }

      const toolMsg = messages[1]!;
      expect(toolMsg.role).toBe("tool");
      if ("tool_call_id" in toolMsg) {
        expect(toolMsg.tool_call_id).toBe("tc_1");
      }
    });

    it("should handle malformed tool_calls_json gracefully", () => {
      const session = store.createSession("Corrupt");
      store.addMessage({ sessionId: session.id, role: "user", content: "hi" });
      const db = store.getDb();
      db.prepare(
        "INSERT INTO messages (session_id, role, content, tool_calls_json, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(session.id, "assistant", "corrupt", "not-valid-json{", Date.now());

      const messages = store.getMessages(session.id);
      expect(messages).toHaveLength(2);
      const assistantMsg = messages.find((m) => m.role === "assistant")!;
      expect(assistantMsg.role).toBe("assistant");
      expect("tool_calls" in assistantMsg).toBe(false);
    });

    it("should count messages for a session", () => {
      const session = store.createSession("Count");
      expect(store.getMessageCount(session.id)).toBe(0);
      store.addMessage({ sessionId: session.id, role: "user", content: "one" });
      store.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "two",
      });
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "three",
      });
      expect(store.getMessageCount(session.id)).toBe(3);
    });

    it("should return 0 count for nonexistent session", () => {
      expect(store.getMessageCount("nonexistent")).toBe(0);
    });
  });

  describe("getVisibleMessages", () => {
    it("should return only user and assistant messages", () => {
      const session = store.createSession("Visible");
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "hello",
      });
      store.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "hi",
        toolCalls: [
          {
            id: "tc1",
            type: "function" as const,
            function: { name: "shell", arguments: "{}" },
          },
        ],
      });
      store.addMessage({
        sessionId: session.id,
        role: "tool",
        content: "result",
        toolCallId: "tc1",
      });
      store.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "done",
      });

      const { messages, total } = store.getVisibleMessages(session.id);
      expect(total).toBe(3);
      expect(messages).toHaveLength(3);
      expect(
        messages.every((m) => m.role === "user" || m.role === "assistant"),
      ).toBe(true);
      expect(messages[0]!.content).toBe("hello");
      expect(messages[2]!.content).toBe("done");
    });

    it("should respect limit and offset", () => {
      const session = store.createSession("Page");
      for (let i = 0; i < 10; i++) {
        store.addMessage({
          sessionId: session.id,
          role: "user",
          content: `msg ${i}`,
        });
      }

      const page1 = store.getVisibleMessages(session.id, 3, 0);
      expect(page1.messages).toHaveLength(3);
      expect(page1.total).toBe(10);

      const page2 = store.getVisibleMessages(session.id, 3, 3);
      expect(page2.messages).toHaveLength(3);
      expect(page2.messages[0]!.content).toBe("msg 3");
    });

    it("should include createdAt timestamp", () => {
      const session = store.createSession("Timestamps");
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "hello",
      });

      const { messages } = store.getVisibleMessages(session.id);
      expect(messages[0]!.createdAt).toBeGreaterThan(0);
    });

    it("should return empty for nonexistent session", () => {
      const { messages, total } = store.getVisibleMessages("nonexistent");
      expect(messages).toHaveLength(0);
      expect(total).toBe(0);
    });
  });

  describe("buildContext", () => {
    it("should return recent messages within maxSize", () => {
      const session = store.createSession("Context");
      for (let i = 0; i < 20; i++) {
        store.addMessage({
          sessionId: session.id,
          role: "user",
          content: `msg ${i}`,
        });
      }
      const context = store.buildContext(session.id, 5);
      expect(context).toHaveLength(5);
    });

    it("should return all messages if less than maxSize", () => {
      const session = store.createSession("Small");
      store.addMessage({ sessionId: session.id, role: "user", content: "hi" });
      store.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "hello",
      });

      const context = store.buildContext(session.id, 50);
      expect(context).toHaveLength(2);
    });

    it("should return empty for nonexistent session", () => {
      const context = store.buildContext("nonexistent", 50);
      expect(context).toHaveLength(0);
    });
  });

  describe("searchMessages", () => {
    it("should find messages by keyword", () => {
      const session = store.createSession("Search");
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "What is TypeScript?",
      });
      store.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "TypeScript is a language.",
      });

      const results = store.searchMessages("TypeScript");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.content).toContain("TypeScript");
    });

    it("should return empty for no matches", () => {
      const session = store.createSession("Empty");
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "hello",
      });

      const results = store.searchMessages("xyznonexistent");
      expect(results).toHaveLength(0);
    });

    it("should escape LIKE wildcards in search query", () => {
      const session = store.createSession("Wildcards");
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "50% discount",
      });
      store.addMessage({
        sessionId: session.id,
        role: "user",
        content: "other message",
      });

      const results = store.searchMessages("50%");
      expect(results).toHaveLength(1);
      expect(results[0]!.content).toBe("50% discount");
    });
  });
});
