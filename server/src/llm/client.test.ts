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

    it("should throw on null response", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve(null),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.chat({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("Invalid LLM response");
    });

    it("should throw on missing message in choice", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: null }] }),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.chat({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("Invalid message");
    });

    it("should return empty string on null content in complete", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { role: "assistant", content: null } }],
        }),
      }));

      const client = createLlmClient(baseConfig);
      const result = await client.complete({
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(result).toBe("");
    });
  });

  describe("retry behavior", () => {
    it("should throw on abort signal", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { role: "assistant", content: "hi" } }],
        }),
      }));

      const controller = new AbortController();
      controller.abort();

      const client = createLlmClient(baseConfig);
      await expect(
        client.chat({
          messages: [{ role: "user", content: "Hi" }],
          signal: controller.signal,
        }),
      ).rejects.toThrow();
    });

    it("should not retry on 4xx client error", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.complete({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("LLM API error 400");
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  describe("base URL handling", () => {
    it("should handle trailing slash in baseUrl", async () => {
      const config = { ...baseConfig, baseUrl: "https://api.example.com/v1/" };
      const client = createLlmClient(config);
      await client.complete({ messages: [{ role: "user", content: "Hi" }] });

      const [url] = (fetch as ReturnType<typeof mockFetch>).mock.calls[0]!;
      expect(url).toBe("https://api.example.com/v1/chat/completions");
    });
  });

  describe("server error retry", () => {
    it("should retry on 5xx and eventually fail", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.complete({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("LLM API error 500");
      expect(fetch).toHaveBeenCalledTimes(4);
    }, 30_000);

    it("should retry on network error and eventually fail", async () => {
      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => {
          callCount++;
          throw new TypeError("fetch failed");
        }),
      );

      const client = createLlmClient(baseConfig);
      await expect(
        client.complete({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("LLM request failed");
      expect(callCount).toBe(4);
    }, 30_000);
  });

  describe("complete() edge cases", () => {
    it("should return empty string for empty choices", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      }));

      const client = createLlmClient(baseConfig);
      const result = await client.complete({
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(result).toBe("");
    });

    it("should return empty string for null message in choice", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: null }] }),
      }));

      const client = createLlmClient(baseConfig);
      const result = await client.complete({
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(result).toBe("");
    });

    it("should return empty string for non-string content", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { role: "assistant", content: 123 } }],
        }),
      }));

      const client = createLlmClient(baseConfig);
      const result = await client.complete({
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(result).toBe("");
    });
  });

  describe("chat() tool_calls validation", () => {
    it("should throw on invalid tool_call format (non-object)", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: ["not-an-object"],
            },
          }],
        }),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.chat({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("Invalid tool_call format");
    });

    it("should throw on missing function in tool_call", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "call_1" }],
            },
          }],
        }),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.chat({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("Invalid tool_call.function format");
    });

    it("should throw on missing required fields in tool_call", async () => {
      vi.stubGlobal("fetch", mockFetch({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: 123, function: { name: "shell" } }],
            },
          }],
        }),
      }));

      const client = createLlmClient(baseConfig);
      await expect(
        client.chat({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow("Missing required fields in tool_call");
    });
  });

  describe("chat() with streaming", () => {
    it("should use SSE parser when onToken is provided", async () => {
      const tokens: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          body: null,
          json: () => Promise.resolve({
            choices: [{ message: { role: "assistant", content: "Hello!" } }],
          }),
        }),
      );

      const client = createLlmClient(baseConfig);
      const result = await client.chat({
        messages: [{ role: "user", content: "Hi" }],
        onToken: (token) => { tokens.push(token); },
      });
      expect(result.type).toBe("text");
    });
  });

  describe("chat() with tool definitions", () => {
    it("should include tools in request body", async () => {
      const client = createLlmClient(baseConfig);
      await client.chat({
        messages: [{ role: "user", content: "Hi" }],
        toolDefinitions: [
          { type: "function", function: { name: "shell", description: "Run command", parameters: { type: "object", properties: {} } } },
        ],
      });

      const opts = (fetch as ReturnType<typeof mockFetch>).mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(body.tools).toBeDefined();
      const tools = body.tools as Array<{ type: string; function: { name: string } }>;
      expect(tools[0]!.function.name).toBe("shell");
    });
  });
});
