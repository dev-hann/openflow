import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLlmClient, type LlmConfig } from "./client.js";

function mockFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown>; text?: () => Promise<string> }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    json: response.json ?? (() => Promise.resolve({})),
    text: response.text ?? (() => Promise.resolve("")),
  } as Response);
}

const baseConfig: LlmConfig = {
  baseUrl: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
  maxTokens: 1024,
  temperature: 0.5,
};

describe("createLlmClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { role: "assistant", content: "Hello!" } }],
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("complete()", () => {
    it("should send messages and return text content", async () => {
      const client = createLlmClient(baseConfig);
      const result = await client.complete({
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(result).toBe("Hello!");
    });

    it("should send to correct URL with auth header", async () => {
      const client = createLlmClient(baseConfig);
      await client.complete({
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(fetch).toHaveBeenCalledOnce();
      const [url, opts] = (fetch as ReturnType<typeof mockFetch>).mock.calls[0]!;
      expect(url).toBe("https://api.example.com/v1/chat/completions");
      expect((opts as RequestInit).headers).toHaveProperty("Authorization", "Bearer test-key");
    });

    it("should include model and params in body", async () => {
      const client = createLlmClient(baseConfig);
      await client.complete({
        messages: [{ role: "user", content: "Hi" }],
      });

      const opts = (fetch as ReturnType<typeof mockFetch>).mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(body.model).toBe("test-model");
      expect(body.max_tokens).toBe(1024);
      expect(body.temperature).toBe(0.5);
    });
  });

  describe("chat() with text response", () => {
    it("should return text response", async () => {
      const client = createLlmClient(baseConfig);
      const result = await client.chat({
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(result.type).toBe("text");
      if (result.type === "text") {
        expect(result.content).toBe("Hello!");
      }
    });
  });

  describe("chat() with tool_calls response", () => {
    it("should return tool_calls response", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "call_1",
                function: { name: "shell", arguments: '{"command":"ls"}' },
              }],
            },
          }],
        }),
      }));

      const client = createLlmClient(baseConfig);
      const result = await client.chat({
        messages: [{ role: "user", content: "run ls" }],
      });
      expect(result.type).toBe("tool_calls");
      if (result.type === "tool_calls") {
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0]!.function.name).toBe("shell");
      }
    });
  });

  describe("error handling", () => {
    it("should throw on non-ok response after retries", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.complete({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("LLM API error 401");
    });

    it("should throw on empty choices", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.chat({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("No choices");
    });
  });
});
