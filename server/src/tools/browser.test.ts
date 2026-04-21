import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync, execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createBrowserTools, type BrowserConfig } from "./browser.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
  execFileSync: vi.fn().mockReturnValue(""),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue(["chromium-1234"]),
  };
});

const mockedExecFileSync = vi.mocked(execFileSync);
const mockedExecSync = vi.mocked(execSync);
const mockedExistsSync = vi.mocked(existsSync);

function makeTmpDir(): string {
  const dir = join(tmpdir(), `openflow-browser-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const defaultConfig: BrowserConfig = {
  enabled: true,
  timeout: 30_000,
  headless: true,
};

describe("createBrowserTools", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("screenshot tool", () => {
    it("has correct tool name and definition", () => {
      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      expect(screenshot.name).toBe("browser_screenshot");
      expect(screenshot.definition.function.name).toBe("browser_screenshot");
      expect(screenshot.definition.function.parameters.required).toContain("url");
    });

    it("has all expected parameters", () => {
      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      const props = screenshot.definition.function.parameters.properties;
      expect(props).toHaveProperty("url");
      expect(props).toHaveProperty("fullPage");
      expect(props).toHaveProperty("width");
      expect(props).toHaveProperty("height");
      expect(props).toHaveProperty("selector");
    });

    it("description mentions auto-install", () => {
      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      expect(screenshot.definition.function.description).toContain("auto-installed");
    });
  });

  describe("execute tool", () => {
    it("has correct tool name and definition", () => {
      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      expect(execute.name).toBe("browser_execute");
      expect(execute.definition.function.name).toBe("browser_execute");
      expect(execute.definition.function.parameters.required).toContain("script");
    });

    it("description mentions Playwright and auto-install", () => {
      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      expect(execute.definition.function.description).toContain("Playwright");
      expect(execute.definition.function.description).toContain("auto-installed");
    });

    it("script parameter description mentions workspace placeholder", () => {
      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      const scriptDesc = execute.definition.function.parameters.properties.script!.description as string;
      expect(scriptDesc).toContain("{WORKSPACE}");
    });
  });

  describe("resetInstalled", () => {
    it("resets cached installed state", () => {
      const tools = createBrowserTools(tmpDir, defaultConfig);
      tools.resetInstalled();
      expect(tools.screenshot.name).toBe("browser_screenshot");
    });
  });

  describe("shared state", () => {
    it("screenshot and execute share installed state", () => {
      const tools = createBrowserTools(tmpDir, defaultConfig);
      expect(tools.screenshot.name).toBe("browser_screenshot");
      expect(tools.execute.name).toBe("browser_execute");
    });

    it("multiple factory calls create independent state", () => {
      const tools1 = createBrowserTools(tmpDir, defaultConfig);
      const tools2 = createBrowserTools(tmpDir, defaultConfig);
      tools1.resetInstalled();
      expect(tools2.screenshot.name).toBe("browser_screenshot");
    });
  });
});

describe("browser tool execution", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    mockedExecFileSync.mockReturnValue("ok");
    mockedExecSync.mockReturnValue("");
    mockedExistsSync.mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(["chromium-1234"] as unknown as ReturnType<typeof readdirSync>);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe("screenshot.execute", () => {
    it("should capture screenshot and return output path", async () => {
      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      const result = await screenshot.execute({ url: "https://example.com" });
      expect(result).toContain("Screenshot saved:");
      expect(result).toContain(".browser");
      expect(result).toContain("ok");
    });

    it("should use selector when provided", async () => {
      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      const result = await screenshot.execute({
        url: "https://example.com",
        selector: "#main",
      });
      expect(result).toContain("Screenshot saved:");
    });

    it("should return (no output) when exec returns empty", async () => {
      mockedExecFileSync.mockReturnValue("");

      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      const result = await screenshot.execute({ url: "https://example.com" });
      expect(result).toContain("(no output)");
    });

    it("should throw on timeout", async () => {
      const err = new Error("killed") as Error & { killed: boolean; stdout: string; stderr: string };
      err.killed = true;
      err.stdout = "";
      err.stderr = "";
      mockedExecFileSync.mockImplementation(() => { throw err; });

      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      await expect(
        screenshot.execute({ url: "https://example.com" }),
      ).rejects.toThrow("timed out");
    });

    it("should throw on script failure with output", async () => {
      const err = new Error("failed") as Error & { killed: boolean; stdout: string; stderr: string };
      err.killed = false;
      err.stdout = "out";
      err.stderr = "err";
      mockedExecFileSync.mockImplementation(() => { throw err; });

      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      await expect(
        screenshot.execute({ url: "https://example.com" }),
      ).rejects.toThrow("out\nerr");
    });

    it("should throw generic message when no output", async () => {
      const err = new Error("failed") as Error & { killed: boolean; stdout: string; stderr: string };
      err.killed = false;
      err.stdout = "";
      err.stderr = "";
      mockedExecFileSync.mockImplementation(() => { throw err; });

      const { screenshot } = createBrowserTools(tmpDir, defaultConfig);
      await expect(
        screenshot.execute({ url: "https://example.com" }),
      ).rejects.toThrow("Browser script failed");
    });
  });

  describe("execute.execute", () => {
    it("should execute script and return result", async () => {
      mockedExecFileSync.mockReturnValue("script output");

      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      const result = await execute.execute({ script: "console.log(1)" });
      expect(result).toBe("script output");
    });

    it("should replace {WORKSPACE} placeholder in script", async () => {
      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      await execute.execute({ script: "saveTo({WORKSPACE}/out.txt)" });
      expect(mockedExecFileSync).toHaveBeenCalledOnce();
    });

    it("should auto-install chromium when not installed", async () => {
      mockedExistsSync.mockReturnValue(false);

      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      const result = await execute.execute({ script: "test" });
      expect(result).toBe("ok");
      expect(mockedExecSync).toHaveBeenCalledWith(
        "npx -y playwright install chromium",
        expect.anything(),
      );
    });

    it("should throw on install failure", async () => {
      mockedExistsSync.mockReturnValue(false);
      const err = new Error("install failed") as Error & { stdout: string; stderr: string };
      err.stdout = "";
      err.stderr = "npm error";
      mockedExecSync.mockImplementation(() => { throw err; });

      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      await expect(
        execute.execute({ script: "test" }),
      ).rejects.toThrow("Failed to auto-install Playwright Chromium");
    });

    it("should not reinstall when already installed", async () => {
      const { execute } = createBrowserTools(tmpDir, defaultConfig);
      await execute.execute({ script: "test1" });
      await execute.execute({ script: "test2" });

      expect(mockedExecSync).not.toHaveBeenCalled();
    });
  });
});
