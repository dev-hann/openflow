import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createAgentEngine, type AgentConfig } from "./engine.js";
import type { LlmClient, LlmResponse } from "../llm/index.js";
import type { MemoryStore } from "../memory/index.js";
import type { ConfirmationHandler } from "../tools/confirmation.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { createMemoryStore } from "../memory/store.js";
import { mockLlmClient, mockToolExecutor } from "./test-helpers.js";

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
    const llm = mockLlmClient([{ type: "text", content: "Hello! How can I help?" }]);
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
    const llm = mockLlmClient([toolCallResponse, toolCallResponse, toolCallResponse]);
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

  describe("confirmation", () => {
    it("should request confirmation and execute when approved", async () => {
      const llm = mockLlmClient([
        {
          type: "tool_calls",
          toolCalls: [
            {
              id: "tc_confirm",
              type: "function" as const,
              function: { name: "shell", arguments: '{"command":"ls"}' },
            },
          ],
        },
        { type: "text", content: "Done!" },
      ]);
      const tools = mockToolExecutor({ shell: "file1\nfile2" }, (name) => name === "shell");
      const confirmationHandler: ConfirmationHandler = {
        requestConfirmation: vi.fn().mockResolvedValue({ approved: true }),
      };
      const config: AgentConfig = {
        systemPrompt: "",
        maxToolRounds: 5,
        workspace: testDir,
      };

      const engine = createAgentEngine({ llm, memory, tools, config, confirmationHandler });
      const session = memory.createSession("Confirmation Test");

      const result = await engine.handleMessage({
        sessionId: session.id,
        userMessage: "list files",
        chatId: 123,
      });

      expect(result.type).toBe("text");
      expect(confirmationHandler.requestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: 123, toolName: "shell" }),
      );
      expect(tools.execute).toHaveBeenCalledTimes(1);
    });

    it("should skip execution when user denies confirmation", async () => {
      const llm = mockLlmClient([
        {
          type: "tool_calls",
          toolCalls: [
            {
              id: "tc_deny",
              type: "function" as const,
              function: { name: "shell", arguments: '{"command":"rm -rf /"}' },
            },
          ],
        },
        { type: "text", content: "Understood, I won't do that." },
      ]);
      const tools = mockToolExecutor({ shell: "should not run" }, (name) => name === "shell");
      const confirmationHandler: ConfirmationHandler = {
        requestConfirmation: vi.fn().mockResolvedValue({ approved: false }),
      };
      const config: AgentConfig = {
        systemPrompt: "",
        maxToolRounds: 5,
        workspace: testDir,
      };

      const engine = createAgentEngine({ llm, memory, tools, config, confirmationHandler });
      const session = memory.createSession("Deny Test");

      const result = await engine.handleMessage({
        sessionId: session.id,
        userMessage: "delete everything",
        chatId: 456,
      });

      expect(result.type).toBe("text");
      expect(tools.execute).toHaveBeenCalledTimes(0);
    });

    it("should execute without confirmation when tool is not in requireConfirmation", async () => {
      const llm = mockLlmClient([
        {
          type: "tool_calls",
          toolCalls: [
            {
              id: "tc_noconfirm",
              type: "function" as const,
              function: { name: "read_file", arguments: '{"path":"/tmp/test.txt"}' },
            },
          ],
        },
        { type: "text", content: "Here's the file." },
      ]);
      const tools = mockToolExecutor({ read_file: "file content" }, (name) => name === "shell");
      const confirmationHandler: ConfirmationHandler = {
        requestConfirmation: vi.fn().mockResolvedValue({ approved: true }),
      };
      const config: AgentConfig = {
        systemPrompt: "",
        maxToolRounds: 5,
        workspace: testDir,
      };

      const engine = createAgentEngine({ llm, memory, tools, config, confirmationHandler });
      const session = memory.createSession("No Confirm Test");

      const result = await engine.handleMessage({
        sessionId: session.id,
        userMessage: "read file",
        chatId: 789,
      });

      expect(result.type).toBe("text");
      expect(confirmationHandler.requestConfirmation).not.toHaveBeenCalled();
      expect(tools.execute).toHaveBeenCalledTimes(1);
    });

    it("should execute without confirmation when chatId is not provided", async () => {
      const llm = mockLlmClient([
        {
          type: "tool_calls",
          toolCalls: [
            {
              id: "tc_nochatid",
              type: "function" as const,
              function: { name: "shell", arguments: '{"command":"echo test"}' },
            },
          ],
        },
        { type: "text", content: "Done." },
      ]);
      const tools = mockToolExecutor({ shell: "test" }, (name) => name === "shell");
      const confirmationHandler: ConfirmationHandler = {
        requestConfirmation: vi.fn().mockResolvedValue({ approved: true }),
      };
      const config: AgentConfig = {
        systemPrompt: "",
        maxToolRounds: 5,
        workspace: testDir,
      };

      const engine = createAgentEngine({ llm, memory, tools, config, confirmationHandler });
      const session = memory.createSession("No ChatId Test");

      const result = await engine.handleMessage({
        sessionId: session.id,
        userMessage: "run command",
      });

      expect(result.type).toBe("text");
      expect(confirmationHandler.requestConfirmation).not.toHaveBeenCalled();
      expect(tools.execute).toHaveBeenCalledTimes(1);
    });

    it("should execute without confirmation when confirmationHandler is not provided", async () => {
      const llm = mockLlmClient([
        {
          type: "tool_calls",
          toolCalls: [
            {
              id: "tc_nohandler",
              type: "function" as const,
              function: { name: "shell", arguments: '{"command":"echo test"}' },
            },
          ],
        },
        { type: "text", content: "Done." },
      ]);
      const tools = mockToolExecutor({ shell: "test" }, (name) => name === "shell");
      const config: AgentConfig = {
        systemPrompt: "",
        maxToolRounds: 5,
        workspace: testDir,
      };

      const engine = createAgentEngine({ llm, memory, tools, config });
      const session = memory.createSession("No Handler Test");

      const result = await engine.handleMessage({
        sessionId: session.id,
        userMessage: "run command",
        chatId: 123,
      });

      expect(result.type).toBe("text");
      expect(tools.execute).toHaveBeenCalledTimes(1);
    });
  });
});
