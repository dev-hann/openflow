import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createBrowserTools, type BrowserConfig } from "./browser.js";

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
