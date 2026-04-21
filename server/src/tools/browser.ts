import { execSync, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { createLogger } from "../utils/logger.js";
import { ensureDirSync } from "../utils/fs.js";
import type { InternalTool } from "./types.js";
import { isExecError } from "./types.js";

const log = createLogger("browser");

export interface BrowserConfig {
  enabled: boolean;
  timeout: number;
  headless: boolean;
}

const SCREENSHOT_DIR = ".browser";

function getBrowsersPath(): string {
  return (
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    join(homedir(), ".cache/ms-playwright")
  );
}

function isChromiumInstalled(): boolean {
  const dir = getBrowsersPath();
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some((d) => d.startsWith("chromium"));
  } catch {
    return false;
  }
}

function installChromium(timeout: number): void {
  log.info("Chromium not found, auto-installing Playwright browser...");
  try {
    execSync("npx -y playwright install chromium", {
      timeout: Math.max(timeout, 120_000),
      maxBuffer: 2 * 1024 * 1024,
      encoding: "utf-8",
      shell: "/bin/bash",
      stdio: "pipe",
    });
    log.info("Playwright Chromium installed successfully");
  } catch (err: unknown) {
    if (!isExecError(err)) throw err;
    const output = [err.stdout, err.stderr].filter(Boolean).join("\n");
    log.error({ err: output }, "failed to install Playwright Chromium");
    throw new Error(
      `Failed to auto-install Playwright Chromium. Run manually: npx playwright install chromium\n${output}`,
    );
  }
}

function ensureScreenshotDir(workspace: string): string {
  const dir = join(workspace, SCREENSHOT_DIR);
  ensureDirSync(dir);
  return dir;
}

function runPlaywrightScript(script: string, timeout: number): string {
  const tmpDir = mkdtempSync(
    join(process.env.RUNNER_TEMP ?? "/tmp", "openflow-browser-"),
  );
  const scriptPath = join(tmpDir, "script.mjs");
  writeFileSync(scriptPath, script, "utf-8");

  try {
    const result = execFileSync(
      "npx",
      ["-y", "playwright", "test", "--config", "null", scriptPath],
      {
        timeout,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "utf-8",
        shell: "/bin/bash",
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
      },
    );
    return result || "(no output)";
  } catch (err: unknown) {
    if (!isExecError(err)) throw err;
    if (err.killed)
      throw new Error(`Browser script timed out after ${timeout}ms`);
    const output = [err.stdout, err.stderr].filter(Boolean).join("\n");
    throw new Error(output || "Browser script failed");
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch (err: unknown) {
      log.debug({ err, tmpDir }, "failed to clean temp dir");
    }
  }
}

export interface BrowserTools {
  screenshot: InternalTool;
  execute: InternalTool;
  resetInstalled(): void;
}

export function createBrowserTools(
  workspace: string,
  config: BrowserConfig,
): BrowserTools {
  let installed = false;

  function ensureInstalled(): void {
    if (installed) return;
    if (isChromiumInstalled()) {
      installed = true;
      return;
    }
    installChromium(config.timeout);
    installed = true;
  }

  const screenshot: InternalTool = {
    name: "browser_screenshot",
    definition: {
      type: "function",
      function: {
        name: "browser_screenshot",
        description:
          "Open a URL in a headless Chromium browser and save a screenshot as PNG. " +
          "Use for: capturing webpage screenshots, checking page layouts, sending page images to user via send_image. " +
          "NOT for: static text extraction (use web_fetch). " +
          "Playwright is auto-installed on first use.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to capture" },
            fullPage: {
              type: "boolean",
              description: "Capture full scrollable page (default: true)",
            },
            width: {
              type: "number",
              description: "Viewport width in pixels (default: 1280)",
            },
            height: {
              type: "number",
              description: "Viewport height in pixels (default: 720)",
            },
            selector: {
              type: "string",
              description: "CSS selector to capture a specific element only",
            },
          },
          required: ["url"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      ensureInstalled();

      const url = args.url as string;
      const fullPage = (args.fullPage as boolean) ?? true;
      const width = (args.width as number) || 1280;
      const height = (args.height as number) || 720;
      const selector = args.selector as string | undefined;

      const screenshotDir = ensureScreenshotDir(workspace);
      const filename = `screenshot-${Date.now()}.png`;
      const outputPath = join(screenshotDir, filename);

      const selectorLine = selector
        ? `const el = await page.locator(${JSON.stringify(selector)}); await el.screenshot({ path: outPath });`
        : `await page.screenshot({ path: outPath, fullPage: ${fullPage} });`;

      const script = `
import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: ${config.headless} });
  const page = await browser.newPage({ viewport: { width: ${width}, height: ${height} } });
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle', timeout: ${config.timeout} });
  const outPath = ${JSON.stringify(outputPath)};
      ${selectorLine}
      await browser.close();
})();
`;

      const result = runPlaywrightScript(script, config.timeout);
      log.info({ url, output: outputPath }, "screenshot captured");
      return `Screenshot saved: ${outputPath}\n${result}`;
    },
  };

  const execute: InternalTool = {
    name: "browser_execute",
    definition: {
      type: "function",
      function: {
        name: "browser_execute",
        description:
          "Execute a Playwright script to automate browser interactions. " +
          "Use for: login automation, form filling, data scraping from JS-rendered pages, web monitoring, multi-step browser workflows. " +
          "NOT for: simple screenshots (use browser_screenshot) or static text fetch (use web_fetch). " +
          "Script template: import { chromium } from 'playwright'; (async () => { const browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); ... await browser.close(); })(); " +
          "Use {WORKSPACE} placeholder for workspace directory path. Playwright is auto-installed on first use.",
        parameters: {
          type: "object",
          properties: {
            script: {
              type: "string",
              description:
                "Playwright Node.js ESM script. Use `import { chromium } from 'playwright'`. " +
                "Save output files to `{WORKSPACE}/` for later access. " +
                "Use page.goto(), page.fill(), page.click(), page.evaluate() for interactions. " +
                "Use page.waitForSelector() before interacting with dynamic elements.",
            },
          },
          required: ["script"],
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      ensureInstalled();

      const script = (args.script as string).replace(
        /\{WORKSPACE\}/g,
        JSON.stringify(workspace).slice(1, -1),
      );

      const result = runPlaywrightScript(script, config.timeout);
      log.info("browser script executed");
      return result;
    },
  };

  return {
    screenshot,
    execute,
    resetInstalled(): void {
      installed = false;
    },
  };
}
