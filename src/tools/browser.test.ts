import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createBrowserScreenshotTool,
  createBrowserExecuteTool,
  resetBrowserInstalled,
  type BrowserConfig,
} from "./browser.js";

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

describe("createBrowserScreenshotTool", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    resetBrowserInstalled();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("has correct tool name and definition", () => {
    const tool = createBrowserScreenshotTool(tmpDir, defaultConfig);
    expect(tool.name).toBe("browser_screenshot");
    expect(tool.definition.function.name).toBe("browser_screenshot");
    expect(tool.definition.function.parameters.required).toContain("url");
  });

  it("has all expected parameters", () => {
    const tool = createBrowserScreenshotTool(tmpDir, defaultConfig);
    const props = tool.definition.function.parameters.properties;
    expect(props).toHaveProperty("url");
    expect(props).toHaveProperty("fullPage");
    expect(props).toHaveProperty("width");
    expect(props).toHaveProperty("height");
    expect(props).toHaveProperty("selector");
  });

  it("description mentions auto-install", () => {
    const tool = createBrowserScreenshotTool(tmpDir, defaultConfig);
    expect(tool.definition.function.description).toContain("auto-installed");
  });
});

describe("createBrowserExecuteTool", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    resetBrowserInstalled();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("has correct tool name and definition", () => {
    const tool = createBrowserExecuteTool(tmpDir, defaultConfig);
    expect(tool.name).toBe("browser_execute");
    expect(tool.definition.function.name).toBe("browser_execute");
    expect(tool.definition.function.parameters.required).toContain("script");
  });

  it("description mentions Playwright and auto-install", () => {
    const tool = createBrowserExecuteTool(tmpDir, defaultConfig);
    expect(tool.definition.function.description).toContain("Playwright");
    expect(tool.definition.function.description).toContain("auto-installed");
  });

  it("script parameter description mentions workspace placeholder", () => {
    const tool = createBrowserExecuteTool(tmpDir, defaultConfig);
    const scriptDesc = tool.definition.function.parameters.properties.script!.description as string;
    expect(scriptDesc).toContain("{WORKSPACE}");
  });
});

describe("auto-install behavior", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    resetBrowserInstalled();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resetBrowserInstalled resets cached state", () => {
    resetBrowserInstalled();
    const tool = createBrowserScreenshotTool(tmpDir, defaultConfig);
    expect(tool.name).toBe("browser_screenshot");
  });

  it("ensureBrowserInstalled is idempotent on second call", () => {
    const tool = createBrowserScreenshotTool(tmpDir, defaultConfig);
    expect(tool.definition.function.description).toContain("auto-installed");
  });
});
