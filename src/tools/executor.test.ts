import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createToolExecutor, type ToolsConfig } from "./executor.js";

const defaultConfig: ToolsConfig = {
  shell: { enabled: true, timeout: 5000 },
  webFetch: { enabled: true },
  webSearch: { enabled: true },
  httpRequest: { enabled: false },
};

describe("createToolExecutor", () => {
  const testDir = join(tmpdir(), "openflow-test-tools-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("getDefinitions()", () => {
    it("should return tool definitions for enabled tools", () => {
      const executor = createToolExecutor(defaultConfig, testDir);
      const defs = executor.getDefinitions();

      const names = defs.map((d) => d.function.name);
      expect(names).toContain("shell");
      expect(names).toContain("read_file");
      expect(names).toContain("write_file");
      expect(names).toContain("list_directory");
      expect(names).toContain("web_fetch");
      expect(names).toContain("web_search");
      expect(names).not.toContain("http_request");
    });

    it("should exclude shell when disabled", () => {
      const config: ToolsConfig = {
        ...defaultConfig,
        shell: { enabled: false, timeout: 5000 },
      };
      const executor = createToolExecutor(config, testDir);
      const names = executor.getDefinitions().map((d) => d.function.name);
      expect(names).not.toContain("shell");
    });

    it("should include send_message when sendFn provided", () => {
      const executor = createToolExecutor(
        defaultConfig,
        testDir,
        async () => {},
      );
      const names = executor.getDefinitions().map((d) => d.function.name);
      expect(names).toContain("send_message");
    });
  });

  describe("execute()", () => {
    it("should return error for unknown tool", async () => {
      const executor = createToolExecutor(defaultConfig, testDir);
      const result = await executor.execute({
        id: "1",
        name: "nonexistent",
        arguments: {},
      });
      expect(result.isError).toBe(true);
      expect(result.content).toContain("Unknown tool");
    });

    describe("read_file", () => {
      it("should read file content", async () => {
        const filePath = join(testDir, "test.txt");
        writeFileSync(filePath, "hello world");

        const executor = createToolExecutor(defaultConfig, testDir);
        const result = await executor.execute({
          id: "1",
          name: "read_file",
          arguments: { path: filePath },
        });
        expect(result.isError).toBe(false);
        expect(result.content).toContain("hello world");
      });

      it("should reject paths outside workspace", async () => {
        const executor = createToolExecutor(defaultConfig, testDir);
        const result = await executor.execute({
          id: "1",
          name: "read_file",
          arguments: { path: "/etc/passwd" },
        });
        expect(result.isError).toBe(true);
        expect(result.content).toContain("outside workspace");
      });

      it("should error for missing file", async () => {
        const executor = createToolExecutor(defaultConfig, testDir);
        const result = await executor.execute({
          id: "1",
          name: "read_file",
          arguments: { path: join(testDir, "nope.txt") },
        });
        expect(result.isError).toBe(true);
      });
    });

    describe("write_file", () => {
      it("should write file content", async () => {
        const filePath = join(testDir, "output.txt");
        const executor = createToolExecutor(defaultConfig, testDir);
        const result = await executor.execute({
          id: "1",
          name: "write_file",
          arguments: { path: filePath, content: "written!" },
        });
        expect(result.isError).toBe(false);
        expect(result.content).toBe("OK");
      });

      it("should create nested directories", async () => {
        const filePath = join(testDir, "sub", "dir", "file.txt");
        const executor = createToolExecutor(defaultConfig, testDir);
        const result = await executor.execute({
          id: "1",
          name: "write_file",
          arguments: { path: filePath, content: "nested" },
        });
        expect(result.isError).toBe(false);
      });
    });

    describe("list_directory", () => {
      it("should list directory contents", async () => {
        writeFileSync(join(testDir, "a.txt"), "a");
        writeFileSync(join(testDir, "b.txt"), "b");

        const executor = createToolExecutor(defaultConfig, testDir);
        const result = await executor.execute({
          id: "1",
          name: "list_directory",
          arguments: { path: testDir },
        });
        expect(result.isError).toBe(false);
        expect(result.content).toContain("a.txt");
        expect(result.content).toContain("b.txt");
      });
    });

    describe("shell", () => {
      it("should execute shell command", async () => {
        const executor = createToolExecutor(defaultConfig, testDir);
        const result = await executor.execute({
          id: "1",
          name: "shell",
          arguments: { command: "echo hello" },
        });
        expect(result.isError).toBe(false);
        expect(result.content).toContain("hello");
      });

      it("should error on timeout", async () => {
        const config: ToolsConfig = {
          ...defaultConfig,
          shell: { enabled: true, timeout: 500 },
        };
        const executor = createToolExecutor(config, testDir);
        const result = await executor.execute({
          id: "1",
          name: "shell",
          arguments: { command: "sleep 10" },
        });
        expect(result.isError).toBe(true);
      }, 10_000);
    });
  });
});
