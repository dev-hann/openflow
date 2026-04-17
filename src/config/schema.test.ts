import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openFlowConfigSchema } from "./schema.js";

describe("openFlowConfigSchema", () => {
  const validConfig = {
    llm: {
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test-key",
      model: "test-model",
    },
    telegram: {
      botToken: "123:ABC",
    },
    agent: {},
    memory: {},
  };

  it("should parse minimal valid config with defaults", () => {
    const result = openFlowConfigSchema.parse(validConfig);
    expect(result.llm.maxTokens).toBe(4096);
    expect(result.llm.temperature).toBe(0.7);
    expect(result.telegram.allowedUsers).toEqual([]);
    expect(result.agent.maxToolRounds).toBe(10);
    expect(result.agent.workspace).toBe("~/.openflow/workspace");
    expect(result.memory.contextSize).toBe(50);
    expect(result.memory.dbPath).toBe("~/.openflow/memory.db");
    expect(result.tools.shell.enabled).toBe(true);
    expect(result.tools.shell.timeout).toBe(30_000);
    expect(result.tools.webFetch.enabled).toBe(true);
    expect(result.tools.webSearch.enabled).toBe(true);
    expect(result.tools.httpRequest.enabled).toBe(false);
    expect(result.tools.requireConfirmation).toEqual([]);
    expect(result.tools.confirmationTimeout).toBe(60_000);
    expect(result.logging.level).toBe("info");
  });

  it("should parse full config with overrides", () => {
    const full = {
      llm: {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-key",
        model: "gpt-4o",
        maxTokens: 8192,
        temperature: 0.5,
      },
      telegram: {
        botToken: "tok",
        allowedUsers: [123, 456],
      },
      agent: {
        systemPrompt: "You are helpful",
        maxToolRounds: 20,
        workspace: "/tmp/workspace",
      },
      memory: {
        contextSize: 100,
        dbPath: "/tmp/test.db",
      },
      tools: {
        shell: { enabled: false, timeout: 5000 },
        webFetch: { enabled: false },
        webSearch: { enabled: false },
        httpRequest: { enabled: true },
        requireConfirmation: ["shell", "write_file"],
        confirmationTimeout: 30_000,
      },
      logging: { level: "debug" as const },
    };
    const result = openFlowConfigSchema.parse(full);
    expect(result.llm.maxTokens).toBe(8192);
    expect(result.llm.temperature).toBe(0.5);
    expect(result.telegram.allowedUsers).toEqual([123, 456]);
    expect(result.agent.systemPrompt).toBe("You are helpful");
    expect(result.tools.shell.enabled).toBe(false);
    expect(result.tools.httpRequest.enabled).toBe(true);
    expect(result.tools.requireConfirmation).toEqual(["shell", "write_file"]);
    expect(result.tools.confirmationTimeout).toBe(30_000);
    expect(result.logging.level).toBe("debug");
  });

  describe("env var resolution", () => {
    beforeEach(() => {
      process.env.TEST_OPENFLOW_KEY = "resolved-api-key";
      process.env.TEST_OPENFLOW_TOKEN = "resolved-bot-token";
    });

    afterEach(() => {
      delete process.env.TEST_OPENFLOW_KEY;
      delete process.env.TEST_OPENFLOW_TOKEN;
    });

    it("should resolve ${ENV_VAR} in apiKey", () => {
      const config = {
        llm: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "${TEST_OPENFLOW_KEY}",
          model: "test",
        },
        telegram: { botToken: "tok" },
        agent: {},
        memory: {},
      };
      const result = openFlowConfigSchema.parse(config);
      expect(result.llm.apiKey).toBe("resolved-api-key");
    });

    it("should resolve ${ENV_VAR} in botToken", () => {
      const config = {
        llm: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "key",
          model: "test",
        },
        telegram: { botToken: "${TEST_OPENFLOW_TOKEN}" },
        agent: {},
        memory: {},
      };
      const result = openFlowConfigSchema.parse(config);
      expect(result.telegram.botToken).toBe("resolved-bot-token");
    });

    it("should throw for missing env var", () => {
      const config = {
        llm: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "${NONEXISTENT_VAR_12345}",
          model: "test",
        },
        telegram: { botToken: "tok" },
        agent: {},
        memory: {},
      };
      expect(() => openFlowConfigSchema.parse(config)).toThrow(
        /NONEXISTENT_VAR_12345/,
      );
    });

    it("should pass through plain strings", () => {
      const config = {
        llm: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "plain-key",
          model: "test",
        },
        telegram: { botToken: "plain-token" },
        agent: {},
        memory: {},
      };
      const result = openFlowConfigSchema.parse(config);
      expect(result.llm.apiKey).toBe("plain-key");
      expect(result.telegram.botToken).toBe("plain-token");
    });
  });

  it("should reject missing required fields", () => {
    expect(() => openFlowConfigSchema.parse({})).toThrow();
  });

  it("should reject empty apiKey", () => {
    const config = {
      llm: {
        baseUrl: "https://api.example.com/v1",
        apiKey: "",
        model: "test",
      },
      telegram: { botToken: "tok" },
    };
    expect(() => openFlowConfigSchema.parse(config)).toThrow();
  });

  it("should reject invalid temperature", () => {
    const config = {
      llm: {
        baseUrl: "https://api.example.com/v1",
        apiKey: "key",
        model: "test",
        temperature: 5,
      },
      telegram: { botToken: "tok" },
    };
    expect(() => openFlowConfigSchema.parse(config)).toThrow();
  });

  it("should reject invalid log level", () => {
    const config = {
      llm: {
        baseUrl: "https://api.example.com/v1",
        apiKey: "key",
        model: "test",
      },
      telegram: { botToken: "tok" },
      logging: { level: "verbose" },
    };
    expect(() => openFlowConfigSchema.parse(config)).toThrow();
  });
});
