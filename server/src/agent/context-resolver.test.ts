import { describe, it, expect, vi } from "vitest";
import {
  createContextResolver,
  type ContextResolverDeps,
} from "./context-resolver.js";
import type { ChatMessage, ToolCall } from "../llm/index.js";
import { OpenFlowError } from "../utils/errors.js";

function createMockDeps(
  overrides?: Partial<ContextResolverDeps>,
): ContextResolverDeps {
  return {
    memory: {
      addMessage: vi.fn(),
      buildContext: vi.fn(() => []),
      getMessages: vi.fn(() => []),
      ...overrides?.memory,
    } as unknown as ContextResolverDeps["memory"],
    compaction: {
      compactIfNeeded: vi.fn(async (_id: string, msgs: ChatMessage[]) => msgs),
      ...overrides?.compaction,
    } as unknown as ContextResolverDeps["compaction"],
    workspace: {
      loadAll: vi.fn(() => ({
        persona: null,
        user: null,
        memory: null,
        dailyMemory: null,
      })),
      getWorkspaceDir: vi.fn(() => "/workspace"),
      ...overrides?.workspace,
    } as unknown as ContextResolverDeps["workspace"],
    systemPrompt: "You are a helpful assistant.",
    skills: [],
    config: { contextSize: 50 },
    ...overrides,
  };
}

describe("createContextResolver", () => {
  describe("persistMessage", () => {
    it("should persist assistant message", () => {
      const deps = createMockDeps();
      const resolver = createContextResolver(deps);

      resolver.persistMessage("s1", { role: "assistant", content: "Hello!" });

      expect(deps.memory.addMessage).toHaveBeenCalledWith({
        sessionId: "s1",
        role: "assistant",
        content: "Hello!",
      });
    });

    it("should persist message with tool calls", () => {
      const deps = createMockDeps();
      const resolver = createContextResolver(deps);
      const toolCalls: ToolCall[] = [
        {
          id: "tc_1",
          type: "function",
          function: { name: "shell", arguments: '{"command":"ls"}' },
        },
      ];

      resolver.persistMessage("s1", {
        role: "assistant",
        content: "",
        toolCalls,
      });

      expect(deps.memory.addMessage).toHaveBeenCalledWith({
        sessionId: "s1",
        role: "assistant",
        content: "",
        toolCalls,
      });
    });

    it("should log error when persistMessage fails", () => {
      const deps = createMockDeps({
        memory: {
          addMessage: vi.fn(() => {
            throw new Error("DB locked");
          }),
          buildContext: vi.fn(() => []),
          getMessages: vi.fn(() => []),
        } as unknown as ContextResolverDeps["memory"],
      });
      const resolver = createContextResolver(deps);

      expect(() =>
        resolver.persistMessage("s1", { role: "user", content: "hi" }),
      ).not.toThrow();
    });
  });

  describe("saveUserMessage", () => {
    it("should save user message and return null", () => {
      const deps = createMockDeps();
      const resolver = createContextResolver(deps);

      const result = resolver.saveUserMessage("s1", "hello");

      expect(result).toBeNull();
      expect(deps.memory.addMessage).toHaveBeenCalledWith({
        sessionId: "s1",
        role: "user",
        content: "hello",
      });
    });

    it("should return OpenFlowError when memory fails with generic error", () => {
      const deps = createMockDeps({
        memory: {
          addMessage: vi.fn(() => {
            throw new Error("disk full");
          }),
          buildContext: vi.fn(() => []),
          getMessages: vi.fn(() => []),
        } as unknown as ContextResolverDeps["memory"],
      });
      const resolver = createContextResolver(deps);

      const result = resolver.saveUserMessage("s1", "hello");

      expect(result).toBeInstanceOf(OpenFlowError);
      expect(result!.code).toBe("DB_ERROR");
    });

    it("should preserve existing OpenFlowError when memory fails", () => {
      const originalError = new OpenFlowError(
        "migration needed",
        "DB_MIGRATION_FAILED",
      );
      const deps = createMockDeps({
        memory: {
          addMessage: vi.fn(() => {
            throw originalError;
          }),
          buildContext: vi.fn(() => []),
          getMessages: vi.fn(() => []),
        } as unknown as ContextResolverDeps["memory"],
      });
      const resolver = createContextResolver(deps);

      const result = resolver.saveUserMessage("s1", "hello");

      expect(result).toBe(originalError);
    });
  });

  describe("buildConversationContext", () => {
    it("should build context with system prompt and messages", async () => {
      const rawMessages: ChatMessage[] = [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ];
      const deps = createMockDeps({
        memory: {
          addMessage: vi.fn(),
          buildContext: vi.fn(() => rawMessages),
          getMessages: vi.fn(() => []),
        } as unknown as ContextResolverDeps["memory"],
      });
      const resolver = createContextResolver(deps);

      const messages = await resolver.buildConversationContext("s1");

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant.",
      });
      expect(messages[1]).toEqual({ role: "user", content: "hi" });
    });

    it("should use systemPromptOverride when provided", async () => {
      const deps = createMockDeps();
      const resolver = createContextResolver(deps);

      const messages = await resolver.buildConversationContext(
        "s1",
        "Custom prompt",
      );

      expect(messages[0]).toEqual({ role: "system", content: "Custom prompt" });
    });

    it("should build system prompt from workspace when no systemPrompt", async () => {
      const deps = createMockDeps({
        systemPrompt: "",
        workspace: {
          loadAll: vi.fn(() => ({
            persona: "Friendly bot",
            user: null,
            memory: null,
            dailyMemory: null,
          })),
          getWorkspaceDir: vi.fn(() => "/ws"),
        } as unknown as ContextResolverDeps["workspace"],
      });
      const resolver = createContextResolver(deps);

      const messages = await resolver.buildConversationContext("s1");

      expect(
        (messages[0] as { role: string; content: string }).content,
      ).toContain("Friendly bot");
    });

    it("should throw OpenFlowError when context build fails", async () => {
      const deps = createMockDeps({
        memory: {
          addMessage: vi.fn(),
          buildContext: vi.fn(() => {
            throw new Error("corrupt DB");
          }),
          getMessages: vi.fn(() => []),
        } as unknown as ContextResolverDeps["memory"],
      });
      const resolver = createContextResolver(deps);

      await expect(resolver.buildConversationContext("s1")).rejects.toThrow(
        OpenFlowError,
      );
    });

    it("should preserve existing OpenFlowError on context build failure", async () => {
      const originalError = new OpenFlowError("DB corrupt", "DB_ERROR");
      const deps = createMockDeps({
        memory: {
          addMessage: vi.fn(),
          buildContext: vi.fn(() => {
            throw originalError;
          }),
          getMessages: vi.fn(() => []),
        } as unknown as ContextResolverDeps["memory"],
      });
      const resolver = createContextResolver(deps);

      await expect(resolver.buildConversationContext("s1")).rejects.toBe(
        originalError,
      );
    });
  });
});
