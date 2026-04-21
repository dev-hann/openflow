import { existsSync, readFileSync, watchFile, writeFileSync } from "node:fs";

import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { ensureDirSync, resolveHomePath } from "../utils/fs.js";
import { openFlowConfigSchema, type OpenFlowConfig } from "./schema.js";

const log = createLogger("config");

const CONFIG_DIR = () => resolveHomePath("~/.openflow");
const CONFIG_FILE = () => resolveHomePath("~/.openflow/openflow.json");

let cachedConfig: OpenFlowConfig | null = null;

export function getConfigPath(): string {
  const cliOverride = process.env.OPENFLOW_CONFIG;
  if (cliOverride) {
    return resolveHomePath(cliOverride);
  }
  return CONFIG_FILE();
}

export function loadConfig(): OpenFlowConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    throw new OpenFlowError(
      `Configuration file not found: ${configPath}. Run "openflow config" to create one.`,
      "CONFIG_NOT_FOUND",
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new OpenFlowError(`Invalid JSON in configuration file: ${configPath}`, "CONFIG_INVALID");
  }

  const result = openFlowConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new OpenFlowError(`Configuration validation failed:\n${issues}`, "CONFIG_INVALID");
  }

  const config = result.data;
  config.agent.workspace = resolveHomePath(config.agent.workspace);
  config.memory.dbPath = resolveHomePath(config.memory.dbPath);

  if (config.logging.level && !process.env.OPENFLOW_LOG_LEVEL) {
    process.env.OPENFLOW_LOG_LEVEL = config.logging.level;
  }

  cachedConfig = config;
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

export function ensureConfigDir(): void {
  ensureDirSync(CONFIG_DIR());
}

export function initConfig(configPath?: string): void {
  const target = configPath ?? CONFIG_FILE();
  if (existsSync(target)) {
    return;
  }
  ensureConfigDir();
  const example = {
    websocket: {
      enabled: true,
      host: "127.0.0.1",
      port: 9800,
    },
    notification: {
      enabled: true,
    },
  };
  writeFileSync(target, JSON.stringify(example, null, 2) + "\n", "utf-8");
}

export type ConfigChangeCallback = (newConfig: OpenFlowConfig) => void;

export function watchConfig(onChange: ConfigChangeCallback): () => void {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const watcher = watchFile(configPath, { interval: 2000 }, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const prevCache = cachedConfig;
        cachedConfig = null;
        const newConfig = loadConfig();
        if (JSON.stringify(prevCache) !== JSON.stringify(newConfig)) {
          log.info("configuration file changed, reloading");
          onChange(newConfig);
        }
      } catch (err: unknown) {
        log.warn({ err }, "failed to reload config");
        cachedConfig = null;
      }
    }, 500);
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    watcher.unref();
  };
}
