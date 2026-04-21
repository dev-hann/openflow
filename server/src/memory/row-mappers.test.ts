import { describe, it, expect } from "vitest";
import {
  rowToSession,
  rowToMessage,
  rowToApiMessage,
  rowToSearchResult,
  escapeLikeWildcards,
} from "./row-mappers.js";

describe("rowToSession", () => {
  it("should map row fields to session object", () => {
    const row = {
      id: "sess_1",
      title: "Test Session",
      created_at: 1000,
      updated_at: 2000,
    };
    const result = rowToSession(row);
    expect(result).toEqual({
      id: "sess_1",
      title: "Test Session",
      createdAt: 1000,
      updatedAt: 2000,
    });
  });
});

describe("rowToMessage", () => {
  it("should map a basic user message", () => {
    const row = { role: "user", content: "hello", tool_call_id: null, tool_calls_json: null };
    const result = rowToMessage(row);
    expect(result).toEqual({ role: "user", content: "hello" });
  });

  it("should map a tool message with tool_call_id", () => {
    const row = { role: "tool", content: "result", tool_call_id: "tc_1", tool_calls_json: null };
    const result = rowToMessage(row);
    expect(result).toEqual({ role: "tool", content: "result", tool_call_id: "tc_1" });
  });

  it("should map assistant message with tool_calls", () => {
    const toolCalls = [{ id: "tc_1", type: "function", function: { name: "read", arguments: "{}" } }];
    const row = {
      role: "assistant",
      content: "let me check",
      tool_call_id: null,
      tool_calls_json: JSON.stringify(toolCalls),
    };
    const result = rowToMessage(row);
    expect(result).toEqual({
      role: "assistant",
      content: "let me check",
      tool_calls: toolCalls,
    });
  });

  it("should map assistant message with null content and tool_calls", () => {
    const toolCalls = [{ id: "tc_1", type: "function", function: { name: "read", arguments: "{}" } }];
    const row = {
      role: "assistant",
      content: "",
      tool_call_id: null,
      tool_calls_json: JSON.stringify(toolCalls),
    };
    const result = rowToMessage(row);
    expect(result).toEqual({
      role: "assistant",
      content: null,
      tool_calls: toolCalls,
    });
  });

  it("should fall back to plain message on malformed tool_calls_json", () => {
    const row = {
      role: "assistant",
      content: "thinking",
      tool_call_id: null,
      tool_calls_json: "not-valid-json{{{",
    };
    const result = rowToMessage(row);
    expect(result).toEqual({ role: "assistant", content: "thinking" });
  });

  it("should map assistant message without tool_calls", () => {
    const row = {
      role: "assistant",
      content: "response",
      tool_call_id: null,
      tool_calls_json: null,
    };
    const result = rowToMessage(row);
    expect(result).toEqual({ role: "assistant", content: "response" });
  });
});

describe("rowToApiMessage", () => {
  it("should extend rowToMessage with createdAt", () => {
    const row = {
      role: "user",
      content: "hello",
      tool_call_id: null,
      tool_calls_json: null,
      created_at: 1234567890,
    };
    const result = rowToApiMessage(row);
    expect(result).toEqual({
      role: "user",
      content: "hello",
      createdAt: 1234567890,
    });
  });
});

describe("rowToSearchResult", () => {
  it("should map row to search result with snippet", () => {
    const row = {
      session_id: "sess_1",
      session_title: "Test",
      role: "user",
      content: "Hello world, this is a test message about cats",
      created_at: 1000,
    };
    const result = rowToSearchResult(row, "test");
    expect(result.sessionId).toBe("sess_1");
    expect(result.sessionTitle).toBe("Test");
    expect(result.role).toBe("user");
    expect(result.content).toBe("Hello world, this is a test message about cats");
    expect(result.timestamp).toBe(1000);
    expect(result.snippet).toContain("test");
  });

  it("should add ellipsis when snippet is truncated at start", () => {
    const longPrefix = "a".repeat(50);
    const row = {
      session_id: "s1",
      session_title: "T",
      role: "user",
      content: longPrefix + "target word here",
      created_at: 1,
    };
    const result = rowToSearchResult(row, "target");
    expect(result.snippet.startsWith("...")).toBe(true);
  });

  it("should add ellipsis when snippet is truncated at end", () => {
    const longSuffix = "b".repeat(50);
    const row = {
      session_id: "s1",
      session_title: "T",
      role: "user",
      content: "target word here" + longSuffix,
      created_at: 1,
    };
    const result = rowToSearchResult(row, "target");
    expect(result.snippet).toContain("target");
  });
});

describe("escapeLikeWildcards", () => {
  it("should escape percent sign", () => {
    expect(escapeLikeWildcards("50%")).toBe("50\\%");
  });

  it("should escape underscore", () => {
    expect(escapeLikeWildcards("hello_world")).toBe("hello\\_world");
  });

  it("should escape backslash", () => {
    expect(escapeLikeWildcards("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("should escape all special characters together", () => {
    expect(escapeLikeWildcards("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });

  it("should return unchanged string without special characters", () => {
    expect(escapeLikeWildcards("hello")).toBe("hello");
  });

  it("should handle empty string", () => {
    expect(escapeLikeWildcards("")).toBe("");
  });
});
