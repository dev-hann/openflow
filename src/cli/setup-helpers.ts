import { writeFileSync } from "node:fs";

import { log as clackLog } from "@clack/prompts";

import { resetConfigCache } from "../config/loader.js";
import { ensureDirSync } from "../utils/fs.js";
import type { OpenFlowConfig } from "../config/schema.js";
import { formatKeyPreview } from "./presets.js";

export function buildDefaultConfig(
  baseUrl: string,
  apiKey: string,
  model: string,
  enableBrowser: boolean,
): OpenFlowConfig {
  return {
    llm: { baseUrl, apiKey, model, maxTokens: 4096, temperature: 0.7 },
    agent: {
      systemPrompt: "",
      maxToolRounds: 10,
      workspace: "~/.openflow/workspace",
      dailyMemoryDays: 2,
    },
    memory: { contextSize: 50, dbPath: "~/.openflow/memory.db" },
    tools: {
      shell: { enabled: true, timeout: 30_000 },
      webFetch: { enabled: true },
      webSearch: { enabled: true },
      httpRequest: { enabled: false },
      browser: { enabled: enableBrowser, timeout: 30_000, headless: true },
      requireConfirmation: ["shell"],
      confirmationTimeout: 60_000,
    },
    skills: { enabled: true, extraDirs: [], entries: {} },
    commands: {},
    websocket: { enabled: true, host: "127.0.0.1", port: 9800, cors: false },
    notification: { enabled: true, onStart: "🟢 OpenFlow가 시작되었습니다.", onStop: "🔴 OpenFlow가 종료됩니다." },
    logging: { level: "info" },
  };
}

export async function saveAndShowConfig(
  config: OpenFlowConfig,
  configPath: string,
  configDir: string,
  providerLabel: string,
  baseUrl: string,
  model: string,
  apiKey: string,
  enableBrowser: boolean,
): Promise<void> {
  ensureDirSync(configDir);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  resetConfigCache();

  const { homedir } = await import("node:os");
  const home = homedir();
  config.agent.workspace = config.agent.workspace.replace(/^~\//, `${home}/`);
  config.memory.dbPath = config.memory.dbPath.replace(/^~\//, `${home}/`);

  clackLog.step("Configuration summary:");
  clackLog.info(`  Provider: ${providerLabel}`);
  clackLog.info(`  Base URL: ${baseUrl}`);
  clackLog.info(`  Model:    ${model}`);
  clackLog.info(`  API Key:  ${formatKeyPreview(apiKey)}`);
  clackLog.info(`  Push:     enabled`);
  clackLog.info(`  Browser:  ${enableBrowser ? "enabled" : "disabled"}`);
  clackLog.info(`  Config:   ${configPath}`);
}
