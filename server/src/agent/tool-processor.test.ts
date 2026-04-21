import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToolProcessor, type RawToolCall } from "./tool-processor.js";
import type { ToolExecutor, ToolResult } from "../tools/index.js";
import type { MemoryStore } from "../memory/index.js";
import type { ConfirmationHandler } from "../tools/confirmation.js";

function createMockToolExecutor(overrides?: {
  results?: Record<string, ToolResult>;
  needsConfirmation?: (name: string) => boolean;
}): ToolExecutor {
  return {
    getDefinitions: vi.fn(() => []),
    execute: vi.fn(async (call) => {
      const content = overrides?.results?.[call.name]?.content ?? "tool result";
      const isError = overrides?.results?.[call.name]?.isError ?? false;
      return { toolCallId: call.id, content, isError };
    }),
    needsConfirmation: overrides?.needsConfirmation ?? (() => false),
    updateSender: vi.fn(),
  };
}

function createMockMemoryStore(): MemoryStore {
  return {
    addMessage: vi.fn(),
    createSession: vi.fn(),
    listSessions: vi.fn(() => []),
    getSession: vi.fn(() => null),
    deleteSession: vi.fn(),
    getMessages: vi.fn(() => []),
    getMessageCount: vi.fn(() => 0),
    getVisibleMessages: vi.fn(() => ({ messages: [], total: 0 })),
    searchMessages: vi.fn(() => []),
    buildContext: vi.fn(() => []),
    close: vi.fn(),
    getDb: vi.fn(),
  } as unknown as MemoryStore;
}

function createMockConfirmationHandler(
  approved: boolean,
): ConfirmationHandler {
  return {
    requestConfirmation: vi.fn(async () => ({ approved })),
  };
}

const BASE_TOOL_CALL: RawToolCall = {
  id: "call_123",
  function: { name: "read_file", arguments: '{"path":"/test.txt"}' },
};

describe("createToolProcessor", () => {
  let tools: ToolExecutor;
  let memory: MemoryStore;

  beforeEach(() => {
    tools = createMockToolExecutor();
    memory = createMockMemoryStore();
  });

  it("should execute tool and save result to memory", async () => {
    const { processToolCall } = createToolProcessor({ tools, memory });
    const result = await processToolCall(BASE_TOOL_CALL, "sess_1", 1, 1);

    expect(result.role).toBe("tool");
    if (result.role === "tool") {
      expect(result.tool_call_id).toBe("call_123");
    }
    expect(result.content).toBe("tool result");
    expect(tools.execute).toHaveBeenCalledWith({
      id: "call_123",
      name: "read_file",
      arguments: { path: "/test.txt" },
    });
    expect(memory.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "sess_1",
        role: "tool",
        toolCallId: "call_123",
      }),
    );
  });

  it("should handle JSON parse failure gracefully", async () => {
    const { processToolCall } = createToolProcessor({ tools, memory });
    const badCall: RawToolCall = {
      id: "call_bad",
      function: { name: "read_file", arguments: "{invalid json" },
    };
    const result = await processToolCall(badCall, "sess_1", 1, 1);

    expect(result.role).toBe("tool");
    expect(result.content).toContain("Failed to parse tool arguments");
    expect(tools.execute).not.toHaveBeenCalled();
    expect(memory.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "sess_1",
        role: "tool",
        content: expect.stringContaining("Failed to parse"),
      }),
    );
  });

  it("should continue when memory.addMessage fails on success path", async () => {
    const failMemory = createMockMemoryStore();
    (failMemory.addMessage as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("db locked");
    });

    const { processToolCall } = createToolProcessor({
      tools,
      memory: failMemory,
    });
    const result = await processToolCall(BASE_TOOL_CALL, "sess_1", 1, 1);

    expect(result.role).toBe("tool");
    expect(result.content).toBe("tool result");
  });

  it("should continue when memory.addMessage fails on parse error path", async () => {
    const failMemory = createMockMemoryStore();
    (failMemory.addMessage as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("db locked");
    });

    const { processToolCall } = createToolProcessor({
      tools,
      memory: failMemory,
    });
    const badCall: RawToolCall = {
      id: "call_bad",
      function: { name: "read_file", arguments: "{bad" },
    };
    const result = await processToolCall(badCall, "sess_1", 1, 1);

    expect(result.role).toBe("tool");
    expect(result.content).toContain("Failed to parse");
  });

  it("should request confirmation for tools that need it", async () => {
    const confirmHandler = createMockConfirmationHandler(true);
    const needsConfirmTools = createMockToolExecutor({
      needsConfirmation: (name) => name === "shell_exec",
    });

    const { processToolCall } = createToolProcessor({
      tools: needsConfirmTools,
      memory,
      confirmationHandler: confirmHandler,
    });

    const shellCall: RawToolCall = {
      id: "call_shell",
      function: { name: "shell_exec", arguments: '{"command":"rm -rf /"}' },
    };

    const result = await processToolCall(shellCall, "sess_1", 1, 1);

    expect(confirmHandler.requestConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 1,
        toolName: "shell_exec",
        timeoutMs: 60_000,
      }),
    );
    expect(result.role).toBe("tool");
  });

  it("should reject tool execution when user denies confirmation", async () => {
    const denyHandler = createMockConfirmationHandler(false);
    const needsConfirmTools = createMockToolExecutor({
      needsConfirmation: (name) => name === "shell_exec",
    });

    const { processToolCall } = createToolProcessor({
      tools: needsConfirmTools,
      memory,
      confirmationHandler: denyHandler,
    });

    const shellCall: RawToolCall = {
      id: "call_shell",
      function: { name: "shell_exec", arguments: '{"command":"ls"}' },
    };

    const result = await processToolCall(shellCall, "sess_1", 1, 1);

    expect(result.content).toContain("거부");
    expect(needsConfirmTools.execute).not.toHaveBeenCalled();
  });

  it("should skip confirmation when chatId is undefined", async () => {
    const confirmHandler = createMockConfirmationHandler(true);
    const needsConfirmTools = createMockToolExecutor({
      needsConfirmation: () => true,
    });

    const { processToolCall } = createToolProcessor({
      tools: needsConfirmTools,
      memory,
      confirmationHandler: confirmHandler,
    });

    await processToolCall(BASE_TOOL_CALL, "sess_1", undefined, 1);

    expect(confirmHandler.requestConfirmation).not.toHaveBeenCalled();
    expect(needsConfirmTools.execute).toHaveBeenCalled();
  });

  it("should skip confirmation when no confirmationHandler provided", async () => {
    const needsConfirmTools = createMockToolExecutor({
      needsConfirmation: () => true,
    });

    const { processToolCall } = createToolProcessor({
      tools: needsConfirmTools,
      memory,
    });

    const result = await processToolCall(BASE_TOOL_CALL, "sess_1", 1, 1);

    expect(result.role).toBe("tool");
    expect(needsConfirmTools.execute).toHaveBeenCalled();
  });

  it("should use custom confirmationTimeout", async () => {
    const confirmHandler = createMockConfirmationHandler(true);
    const needsConfirmTools = createMockToolExecutor({
      needsConfirmation: () => true,
    });

    const { processToolCall } = createToolProcessor({
      tools: needsConfirmTools,
      memory,
      confirmationHandler: confirmHandler,
      confirmationTimeout: 30_000,
    });

    await processToolCall(BASE_TOOL_CALL, "sess_1", 1, 1);

    expect(confirmHandler.requestConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 30_000 }),
    );
  });

  it("should propagate tool execution errors", async () => {
    const errorTools = createMockToolExecutor({
      results: {
        read_file: { toolCallId: "call_123", content: "file not found", isError: true },
      },
    });

    const { processToolCall } = createToolProcessor({ tools: errorTools, memory });
    const result = await processToolCall(BASE_TOOL_CALL, "sess_1", 1, 1);

    expect(result.content).toBe("file not found");
  });
});
