import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { createAgentEngine, type AgentConfig } from "./engine.js";
import type { LlmClient, LlmResponse } from "../llm/index.js";
import type { MemoryStore } from "../memory/index.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { createMemoryStore } from "../memory/store.js";
import { mockLlmClient, mockToolExecutor } from "./test-helpers.js";
import { OpenFlowError } from "../utils/errors.js";

describe("createAgentEngine", () => {
  const testDir = join(tmpdir(), "openflow-test-agent-" + Date.now());
  let memory: MemoryStore;

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    memory = createMemoryStore(join(testDir, `test-${Date.now()}.db`));
  });

  afterEach(() => {
    memory.close();
  });

  it("should return text response directly", async () => {
    const llm = mockLlmClient([
      { type: "text", content: "Hello! How can I help?" },
    ]);
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "Hi",
    });

    expect(result.type).toBe("text");
    if (result.type === "text") {
      expect(result.content).toBe("Hello! How can I help?");
    }
  });

  it("should execute tool calls and loop", async () => {
    const llm = mockLlmClient([
      {
        type: "tool_calls",
        toolCalls: [
          {
            id: "tc_1",
            type: "function" as const,
            function: { name: "test_tool", arguments: '{"key":"value"}' },
          },
        ],
      },
      { type: "text", content: "Done! Result was: tool result" },
    ]);
    const tools = mockToolExecutor({ test_tool: "tool result" });
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Tool Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "run the tool",
    });

    expect(result.type).toBe("text");
    expect(llm.chat).toHaveBeenCalledTimes(2);
    expect(tools.execute).toHaveBeenCalledTimes(1);
  });

  it("should stop after maxToolRounds", async () => {
    const toolCallResponse: LlmResponse = {
      type: "tool_calls",
      toolCalls: [
        {
          id: "tc_loop",
          type: "function" as const,
          function: { name: "test_tool", arguments: "{}" },
        },
      ],
    };
    const llm = mockLlmClient([
      toolCallResponse,
      toolCallResponse,
      toolCallResponse,
    ]);
    const tools = mockToolExecutor({ test_tool: "looping" });
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 2,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Loop Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "loop",
    });

    expect(result.type).toBe("text");
    if (result.type === "text") {
      expect(result.content).toContain("Maximum tool call");
    }
  });

  it("should store user and assistant messages in memory", async () => {
    const llm = mockLlmClient([{ type: "text", content: "Got it" }]);
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Memory Test");

    await engine.handleMessage({
      sessionId: session.id,
      userMessage: "remember this",
    });

    const messages = memory.getMessages(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "user", content: "remember this" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Got it" });
  });

  it("should execute multiple tool calls in parallel", async () => {
    const toolCallResponse: LlmResponse = {
      type: "tool_calls",
      toolCalls: [
        {
          id: "tc_a",
          type: "function" as const,
          function: { name: "tool_a", arguments: '{"key":"a"}' },
        },
        {
          id: "tc_b",
          type: "function" as const,
          function: { name: "tool_b", arguments: '{"key":"b"}' },
        },
      ],
    };
    const llm = mockLlmClient([
      toolCallResponse,
      { type: "text", content: "Both done" },
    ]);
    const tools = mockToolExecutor({ tool_a: "result a", tool_b: "result b" });
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Parallel Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "run both tools",
    });

    expect(result.type).toBe("text");
    expect(tools.execute).toHaveBeenCalledTimes(2);
  });

  it("should return error for malformed tool arguments instead of executing with empty args", async () => {
    const toolCallResponse: LlmResponse = {
      type: "tool_calls",
      toolCalls: [
        {
          id: "tc_bad",
          type: "function" as const,
          function: { name: "test_tool", arguments: "{invalid json" },
        },
      ],
    };
    const llm = mockLlmClient([
      toolCallResponse,
      { type: "text", content: "Recovered" },
    ]);
    const tools = mockToolExecutor({ test_tool: "should not run" });
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Bad Args Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "run tool with bad args",
    });

    expect(result.type).toBe("text");
    expect(tools.execute).not.toHaveBeenCalled();

    const messages = memory.getMessages(session.id);
    const toolMsg = messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg!.content).toContain("Failed to parse tool arguments");
  });

  it("should return error on LLM failure", async () => {
    const llm: LlmClient = {
      chat: vi.fn().mockRejectedValue(new Error("API down")),
      complete: vi.fn(),
    };
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Error Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "test",
    });

    expect(result.type).toBe("error");
  });

  it("should return error when signal is aborted before LLM call", async () => {
    const llm = mockLlmClient([{ type: "text", content: "should not reach" }]);
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Abort Test");

    const controller = new AbortController();
    controller.abort();

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "abort test",
      signal: controller.signal,
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error.code).toBe("LLM_TIMEOUT");
    }
  });

  it("should accept lazy LLM factory function", async () => {
    const llmInstance = mockLlmClient([
      { type: "text", content: "Lazy response" },
    ]);
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({
      llm: () => llmInstance,
      memory,
      tools,
      config,
    });
    const session = memory.createSession("Lazy LLM Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "test",
    });

    expect(result.type).toBe("text");
    if (result.type === "text") {
      expect(result.content).toBe("Lazy response");
    }
  });

  it("should return error when context build fails", async () => {
    const llm = mockLlmClient([{ type: "text", content: "should not reach" }]);
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });

    const result = await engine.handleMessage({
      sessionId: "nonexistent-session-id",
      userMessage: "test",
    });

    expect(result.type).toBe("error");
  });

  it("should pass systemPromptOverride to context resolver", async () => {
    const llm = mockLlmClient([
      { type: "text", content: "Custom prompt response" },
    ]);
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "default prompt",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Override Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "test",
      systemPromptOverride: "custom system prompt",
    });

    expect(result.type).toBe("text");
    expect(llm.chat).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(llm.chat).mock.calls[0]![0];
    expect(callArgs.messages[0]).toEqual({
      role: "system",
      content: "custom system prompt",
    });
  });

  it("should return error with LLM_REQUEST_FAILED on non-OpenFlowError from LLM", async () => {
    const llm: LlmClient = {
      chat: vi.fn().mockRejectedValue("string error"),
      complete: vi.fn(),
    };
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("String Error Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "test",
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error.code).toBe("LLM_REQUEST_FAILED");
    }
  });

  it("should wrap and return OpenFlowError from LLM as-is", async () => {
    const originalError = new OpenFlowError("custom error", "LLM_STREAM_ERROR");
    const llm: LlmClient = {
      chat: vi.fn().mockRejectedValue(originalError),
      complete: vi.fn(),
    };
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("OFError Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "test",
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error.code).toBe("LLM_STREAM_ERROR");
    }
  });

  it("should auto-create workspace directory when it does not exist", async () => {
    const llm = mockLlmClient([{ type: "text", content: "ok" }]);
    const tools = mockToolExecutor({});
    const newWorkspace = join(testDir, "auto-created-dir-" + Date.now());
    expect(existsSync(newWorkspace)).toBe(false);

    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: newWorkspace,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    expect(existsSync(newWorkspace)).toBe(true);

    const session = memory.createSession("Auto Workspace Test");
    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "hi",
    });
    expect(result.type).toBe("text");
  });

  it("should wrap non-OpenFlowError in runLlmLoop catch path", async () => {
    const callCount = { value: 0 };
    const llm: LlmClient = {
      chat: vi.fn().mockImplementation(() => {
        callCount.value++;
        if (callCount.value === 1) {
          const toolCallResponse: LlmResponse = {
            type: "tool_calls",
            toolCalls: [
              {
                id: "tc_1",
                type: "function" as const,
                function: { name: "test_tool", arguments: "{}" },
              },
            ],
          };
          return Promise.resolve(toolCallResponse);
        }
        return Promise.reject("raw string error");
      }),
      complete: vi.fn(),
    };
    const tools = mockToolExecutor({ test_tool: "ok" });
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Raw Error Wrap Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "test",
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error.code).toBe("LLM_REQUEST_FAILED");
    }
  });

  it("should return error when signal aborts during tool call loop", async () => {
    const controller = new AbortController();
    const toolCallResponse: LlmResponse = {
      type: "tool_calls",
      toolCalls: [
        {
          id: "tc_1",
          type: "function" as const,
          function: { name: "test_tool", arguments: "{}" },
        },
      ],
    };
    const llm: LlmClient = {
      chat: vi.fn().mockImplementation(() => {
        controller.abort();
        return Promise.resolve(toolCallResponse);
      }),
      complete: vi.fn(),
    };
    const tools = mockToolExecutor({ test_tool: "ok" });
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Mid-loop Abort Test");

    const result = await engine.handleMessage({
      sessionId: session.id,
      userMessage: "abort mid-loop",
      signal: controller.signal,
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error.code).toBe("LLM_TIMEOUT");
    }
  });

  it("should persist assistant tool_calls message before processing tools", async () => {
    const toolCallResponse: LlmResponse = {
      type: "tool_calls",
      toolCalls: [
        {
          id: "tc_persist",
          type: "function" as const,
          function: { name: "test_tool", arguments: '{"a":"b"}' },
        },
      ],
    };
    const llm = mockLlmClient([
      toolCallResponse,
      { type: "text", content: "final" },
    ]);
    const tools = mockToolExecutor({ test_tool: "result" });
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const engine = createAgentEngine({ llm, memory, tools, config });
    const session = memory.createSession("Persist Test");

    await engine.handleMessage({
      sessionId: session.id,
      userMessage: "run tool",
    });

    const messages = memory.getMessages(session.id);
    const assistantMsg = messages.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.content).toBeNull();
    const toolMsg = messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg!.content).toBe("result");
  });

  it("should return error when context build fails with non-existent session", async () => {
    const llm = mockLlmClient([{ type: "text", content: "should not reach" }]);
    const tools = mockToolExecutor({});
    const config: AgentConfig = {
      systemPrompt: "",
      maxToolRounds: 5,
      workspace: testDir,
    };

    const failingMemory = {
      createSession: vi.fn(() => ({
        id: "sess-ctx-fail",
        title: "Ctx Fail",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
      getSession: vi.fn(() => null),
      listSessions: vi.fn(() => []),
      deleteSession: vi.fn(),
      addMessage: vi.fn(),
      getMessages: vi.fn(() => []),
      getMessageCount: vi.fn(() => 0),
      getVisibleMessages: vi.fn(() => ({ messages: [], total: 0 })),
      searchMessages: vi.fn(() => []),
      buildContext: vi.fn(() => {
        throw new Error("context build crashed");
      }),
      close: vi.fn(),
      getDb: vi.fn(),
    } as unknown as MemoryStore;

    const engine = createAgentEngine({
      llm: () => llm,
      memory: failingMemory,
      tools,
      config,
    });

    const result = await engine.handleMessage({
      sessionId: "sess-ctx-fail",
      userMessage: "test context failure",
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error.message).toContain("Failed to build context");
      expect(result.error.code).toBe("DB_ERROR");
    }
  });
});
