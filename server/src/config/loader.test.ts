import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, resetConfigCache, getConfigPath } from "./loader.js";

describe("loadConfig", () => {
  const testDir = join(tmpdir(), "openflow-test-config-" + Date.now());
  const testConfigPath = join(testDir, "openflow.json");

  beforeEach(() => {
    resetConfigCache();
    mkdirSync(testDir, { recursive: true });
    process.env.OPENFLOW_CONFIG = testConfigPath;
  });

  afterEach(() => {
    resetConfigCache();
    delete process.env.OPENFLOW_CONFIG;
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should load and cache valid config", () => {
    const config = {
      agent: {},
      memory: {},
    };
    writeFileSync(testConfigPath, JSON.stringify(config));

    const result = loadConfig();
    expect(result.llm.maxTokens).toBe(4096);

    const result2 = loadConfig();
    expect(result2).toBe(result);
  });

  it("should throw CONFIG_NOT_FOUND for missing file", () => {
    const missingPath = join(testDir, "nonexistent.json");
    process.env.OPENFLOW_CONFIG = missingPath;

    try {
      loadConfig();
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      expect(err).toHaveProperty("code", "CONFIG_NOT_FOUND");
    }
  });

  it("should throw CONFIG_INVALID for bad JSON", () => {
    writeFileSync(testConfigPath, "{ invalid json");

    try {
      loadConfig();
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      expect(err).toHaveProperty("code", "CONFIG_INVALID");
    }
  });

  it("should throw CONFIG_INVALID for schema validation failure", () => {
    writeFileSync(testConfigPath, JSON.stringify({ agent: { maxToolRounds: -1 } }));

    try {
      loadConfig();
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      expect(err).toHaveProperty("code", "CONFIG_INVALID");
    }
  });

  it("should resolve ~ paths in workspace and dbPath", () => {
    const config = {
      agent: {},
      memory: {},
    };
    writeFileSync(testConfigPath, JSON.stringify(config));

    const result = loadConfig();
    expect(result.agent.workspace).not.toContain("~");
    expect(result.memory.dbPath).not.toContain("~");
    expect(result.agent.workspace).toContain("/.openflow/workspace");
    expect(result.memory.dbPath).toContain("/.openflow/memory.db");
  });

  it("getConfigPath should respect OPENFLOW_CONFIG env", () => {
    process.env.OPENFLOW_CONFIG = "/tmp/my-config.json";
    expect(getConfigPath()).toBe("/tmp/my-config.json");
    delete process.env.OPENFLOW_CONFIG;
  });
});
