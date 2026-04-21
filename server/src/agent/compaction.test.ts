import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCompaction } from "./compaction.js";
import type { LlmClient } from "../llm/index.js";

function createLongContent(length: number): string {
  return "x".repeat(length);
}

describe("createCompaction", () => {
  const mockComplete = vi
    .fn()
    .mockResolvedValue("This is a summary of the conversation.");

  function createMockLlm(): LlmClient {
    return {
      chat: vi.fn(),
      complete: mockComplete,
    };
  }

  beforeEach(() => {
    mockComplete.mockResolvedValue("This is a summary of the conversation.");
  });

  it("should not compact when context is under token limit", async () => {
    const compaction = createCompaction({
      llm: createMockLlm(),
      config: { maxContextTokens: 100_000, compactThreshold: 0.8 },
    });

    const messages = [
      { role: "user" as const, content: "short message" },
      { role: "assistant" as const, content: "short reply" },
    ];

    const result = await compaction.compactIfNeeded("session-1", messages);
    expect(result).toBe(messages);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("should compact when context exceeds token limit", async () => {
    const compaction = createCompaction({
      llm: createMockLlm(),
      config: { maxContextTokens: 100, compactThreshold: 0.8 },
    });

    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: createLongContent(200),
    }));

    const result = await compaction.compactIfNeeded("session-1", messages);
    expect(result).not.toBe(messages);
    expect(result.length).toBeLessThan(messages.length);
    expect(result[0]!.role).toBe("system");
    expect(result[0]!.content).toContain("Previous conversation summary");
    expect(mockComplete).toHaveBeenCalledOnce();
  });

  it("should return original context when summary generation fails", async () => {
    mockComplete.mockRejectedValue(new Error("LLM unavailable"));

    const compaction = createCompaction({
      llm: createMockLlm(),
      config: { maxContextTokens: 100, compactThreshold: 0.8 },
    });

    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: createLongContent(200),
    }));

    const result = await compaction.compactIfNeeded("session-1", messages);
    expect(result).toBe(messages);
  });

  it("should return original context when summary is null", async () => {
    mockComplete.mockResolvedValue(null);

    const compaction = createCompaction({
      llm: createMockLlm(),
      config: { maxContextTokens: 100, compactThreshold: 0.8 },
    });

    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: createLongContent(200),
    }));

    const result = await compaction.compactIfNeeded("session-1", messages);
    expect(result).toBe(messages);
  });

  it("should handle tool messages in context", async () => {
    const compaction = createCompaction({
      llm: createMockLlm(),
      config: { maxContextTokens: 100, compactThreshold: 0.8 },
    });

    const messages = [
      { role: "user" as const, content: createLongContent(200) },
      {
        role: "assistant" as const,
        content: null,
        tool_calls: [
          {
            id: "tc_1",
            type: "function" as const,
            function: { name: "shell", arguments: '{"command":"ls"}' },
          },
        ],
      },
      {
        role: "tool" as const,
        content: "file1.txt\nfile2.txt",
        tool_call_id: "tc_1",
      },
      { role: "assistant" as const, content: createLongContent(200) },
      { role: "user" as const, content: createLongContent(200) },
    ];

    const result = await compaction.compactIfNeeded("session-1", messages);
    expect(result).not.toBe(messages);
    expect(result[0]!.role).toBe("system");
  });

  it("should resolve lazy llm provider", async () => {
    const localComplete = vi.fn().mockResolvedValue("lazy summary");
    const localLlm: LlmClient = { chat: vi.fn(), complete: localComplete };
    const compaction = createCompaction({
      llm: () => localLlm,
      config: { maxContextTokens: 100, compactThreshold: 0.8 },
    });

    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: createLongContent(200),
    }));

    const result = await compaction.compactIfNeeded("session-1", messages);
    expect(result).not.toBe(messages);
    expect(localComplete).toHaveBeenCalledOnce();
  });

  it("should truncate conversation when it exceeds MAX_CHARS for summarization", async () => {
    const localComplete = vi.fn().mockResolvedValue("truncated summary");
    const localLlm: LlmClient = { chat: vi.fn(), complete: localComplete };
    const compaction = createCompaction({
      llm: localLlm,
      config: { maxContextTokens: 100, compactThreshold: 0.8 },
    });

    const messages = Array.from({ length: 500 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: createLongContent(500),
    }));

    await compaction.compactIfNeeded("session-1", messages);

    const userMessage = localComplete.mock.calls[0]![0].messages[1]
      .content as string;
    expect(userMessage).toContain("[Earlier conversation omitted for length]");
  });
});
