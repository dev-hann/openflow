import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, resetConfigCache, getConfigPath, initConfig } from "./loader.js";

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
    delete process.env.OPENFLOW_LOG_LEVEL;
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

  it("should set OPENFLOW_LOG_LEVEL from config when not set", () => {
    writeFileSync(testConfigPath, JSON.stringify({ logging: { level: "debug" }, agent: {}, memory: {} }));
    delete process.env.OPENFLOW_LOG_LEVEL;

    loadConfig();
    expect(process.env.OPENFLOW_LOG_LEVEL).toBe("debug");
  });

  it("should not override OPENFLOW_LOG_LEVEL if already set", () => {
    writeFileSync(testConfigPath, JSON.stringify({ logging: { level: "debug" }, agent: {}, memory: {} }));
    process.env.OPENFLOW_LOG_LEVEL = "warn";

    loadConfig();
    expect(process.env.OPENFLOW_LOG_LEVEL).toBe("warn");
  });
});

describe("initConfig", () => {
  const testDir = join(tmpdir(), "openflow-test-init-" + Date.now());
  const testConfigPath = join(testDir, "openflow.json");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should create config file if it does not exist", () => {
    initConfig(testConfigPath);
    expect(existsSync(testConfigPath)).toBe(true);
    const content = JSON.parse(readFileSync(testConfigPath, "utf-8")) as Record<string, unknown>;
    expect(content.websocket).toBeDefined();
    expect(content.notification).toBeDefined();
  });

  it("should not overwrite existing config file", () => {
    const existing = { websocket: { enabled: false } };
    writeFileSync(testConfigPath, JSON.stringify(existing));

    initConfig(testConfigPath);
    const content = JSON.parse(readFileSync(testConfigPath, "utf-8")) as Record<string, unknown>;
    expect((content.websocket as Record<string, unknown>).enabled).toBe(false);
  });
});
