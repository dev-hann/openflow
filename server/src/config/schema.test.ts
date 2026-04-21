import { describe, it, expect } from "vitest";
import { openFlowConfigSchema } from "./schema.js";

describe("openFlowConfigSchema", () => {
  it("should parse minimal config with defaults", () => {
    const result = openFlowConfigSchema.parse({ agent: {}, memory: {} });
    expect(result.llm.maxTokens).toBe(4096);
    expect(result.llm.temperature).toBe(0.7);
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
    expect(result.notification.enabled).toBe(true);
    expect(result.logging.level).toBe("info");
  });

  it("should parse full config with overrides", () => {
    const full = {
      llm: {
        maxTokens: 8192,
        temperature: 0.5,
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
      notification: {
        enabled: false,
        onStart: "Custom start",
        onStop: "Custom stop",
      },
      logging: { level: "debug" as const },
    };
    const result = openFlowConfigSchema.parse(full);
    expect(result.llm.maxTokens).toBe(8192);
    expect(result.llm.temperature).toBe(0.5);
    expect(result.agent.systemPrompt).toBe("You are helpful");
    expect(result.tools.shell.enabled).toBe(false);
    expect(result.tools.httpRequest.enabled).toBe(true);
    expect(result.tools.requireConfirmation).toEqual(["shell", "write_file"]);
    expect(result.tools.confirmationTimeout).toBe(30_000);
    expect(result.notification.enabled).toBe(false);
    expect(result.notification.onStart).toBe("Custom start");
    expect(result.logging.level).toBe("debug");
  });

  it("should accept empty config with all defaults", () => {
    const result = openFlowConfigSchema.parse({ agent: {}, memory: {} });
    expect(result.llm.maxTokens).toBe(4096);
    expect(result.llm.temperature).toBe(0.7);
  });

  it("should reject invalid temperature", () => {
    const config = {
      llm: { temperature: 5 },
    };
    expect(() => openFlowConfigSchema.parse(config)).toThrow();
  });

  it("should reject invalid log level", () => {
    const config = {
      logging: { level: "verbose" },
    };
    expect(() => openFlowConfigSchema.parse(config)).toThrow();
  });
});
