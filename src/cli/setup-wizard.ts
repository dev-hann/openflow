import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log as clackLog,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";

import { getConfigPath, resetConfigCache } from "../config/loader.js";
import type { OpenFlowConfig } from "../config/schema.js";
import {
  LLM_PRESETS,
  formatKeyPreview,
  normalizeApiKeyInput,
  resolveEnvKey,
  detectZaiEndpoint,
  fetchModels,
  verifyLlmEndpoint,
} from "./presets.js";

const BANNER = `
  ┌─────────────────────────────────────────┐
  │   ___                    ____ _     __   │
  │  / _ \\ _ __   ___ _ __ / ___| |   / _|  │
  │ | | | | '_ \\ / _ \\ '_ | |   | |  | |    │
  │ | |_| | |_) |  __/ | || |___| |__| |    │
  │  \\___/| .__/ \\___|_| |_\\____|_____|_|   │
  │       |_|                                │
  │         Personal AI Assistant            │
  └─────────────────────────────────────────┘
`.trim();

export { BANNER };

export function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }
  return value;
}

async function selectModel(baseUrl: string, apiKey: string, defaultModel: string): Promise<string> {
  const s = spinner();
  s.start("Fetching available models...");
  const remoteModels = await fetchModels(baseUrl, apiKey);
  s.stop(remoteModels.length > 0 ? `Found ${remoteModels.length} models.` : "Could not fetch model list.");

  if (remoteModels.length > 0) {
    const selected = guardCancel(
      await select({
        message: "Select model",
        options: [
          ...remoteModels.map((m) => ({
            value: m,
            label: m,
            hint: m === defaultModel ? "recommended" : undefined,
          })),
          { value: "__custom__", label: "Enter model name manually", hint: "type a custom model ID" },
        ],
        initialValue: remoteModels.includes(defaultModel) ? defaultModel : remoteModels[0],
      }),
    ) as string;

    if (selected === "__custom__") {
      return guardCancel(
        await text({
          message: "Model name",
          placeholder: defaultModel,
          validate: (v) => (!v?.trim() ? "Model name is required" : undefined),
        }),
      ) as string;
    }
    return selected;
  }

  return guardCancel(
    await text({
      message: "Model name",
      initialValue: defaultModel || undefined,
      placeholder: "e.g. gpt-4o, glm-4-flash",
      validate: (v) => (!v?.trim() ? "Model name is required" : undefined),
    }),
  ) as string;
}

async function verifyEndpoint(baseUrl: string, apiKey: string, model: string): Promise<void> {
  const shouldVerify = guardCancel(
    await confirm({
      message: "Verify connection to LLM endpoint now?",
      initialValue: true,
    }),
  ) as boolean;

  if (!shouldVerify) return;

  const s = spinner();
  s.start("Verifying endpoint...");
  const result = await verifyLlmEndpoint(baseUrl, apiKey, model);
  if (result.ok) {
    s.stop("Connection verified successfully.");
    return;
  }

  s.stop(`Verification failed${result.status ? ` (HTTP ${result.status})` : ""}.`);
  clackLog.warn(
    `Could not verify endpoint. The setup will continue, but you may need to check your credentials.\n  Error: ${result.error ?? "unknown"}`,
  );
  const proceed = guardCancel(
    await confirm({
      message: "Continue anyway?",
      initialValue: true,
    }),
  ) as boolean;
  if (!proceed) {
    cancel("Setup cancelled.");
    process.exit(0);
  }
}

export async function runSetupWizard(): Promise<OpenFlowConfig> {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  console.log(BANNER);
  intro("OpenFlow Setup Wizard");

  const providerChoice = guardCancel(
    await select({
      message: "Select LLM provider",
      options: LLM_PRESETS.map((p) => ({
        value: p.id,
        label: p.label,
        hint: p.hint,
      })),
    }),
  ) as string;

  const preset = LLM_PRESETS.find((p) => p.id === providerChoice)!;

  let apiKey = "";
  const isZai = preset.id.startsWith("zai");

  if (preset.needsApiKey) {
    const envKey = resolveEnvKey(preset);
    if (envKey) {
      const useExisting = guardCancel(
        await confirm({
          message: `Found API key in environment (${formatKeyPreview(envKey)}). Use it?`,
          initialValue: true,
        }),
      ) as boolean;
      if (useExisting) {
        apiKey = envKey;
      }
    }

    if (!apiKey) {
      apiKey = guardCancel(
        await text({
          message: "API Key",
          placeholder: isZai ? "sk-..." : "sk-...",
          validate: (v) => {
            const normalized = normalizeApiKeyInput(v ?? "");
            if (!normalized) return "API Key is required";
            return undefined;
          },
        }),
      ) as string;
      apiKey = normalizeApiKeyInput(apiKey);
    }
  } else {
    clackLog.info("Local mode — no API key needed.");
  }

  let baseUrl: string;

  if (isZai && apiKey) {
    const shouldDetect = guardCancel(
      await confirm({
        message: "Auto-detect best ZAI endpoint for your API key?",
        initialValue: true,
      }),
    ) as boolean;

    if (shouldDetect) {
      const s = spinner();
      s.start("Probing ZAI endpoints...");
      const detected = await detectZaiEndpoint(apiKey);
      if (detected) {
        s.stop(`${detected.note} (model: ${detected.model})`);
        baseUrl = detected.baseUrl;

        const useDetected = guardCancel(
          await confirm({
            message: `Use detected endpoint? (${baseUrl})`,
            initialValue: true,
          }),
        ) as boolean;

        if (!useDetected) {
          baseUrl = guardCancel(
            await text({
              message: "API Base URL",
              initialValue: preset.baseUrl,
            }),
          ) as string;
        }
      } else {
        s.stop("Could not auto-detect. Using default endpoint.");
        baseUrl = guardCancel(
          await text({
            message: "API Base URL",
            initialValue: preset.baseUrl,
          }),
        ) as string;
      }
    } else {
      baseUrl = guardCancel(
        await text({
          message: "API Base URL",
          initialValue: preset.baseUrl,
        }),
      ) as string;
    }
  } else if (preset.id === "custom") {
    baseUrl = guardCancel(
      await text({
        message: "API Base URL",
        placeholder: "https://api.example.com/v1",
        validate: (v) => (!v?.trim() ? "Base URL is required" : undefined),
      }),
    ) as string;
  } else {
    baseUrl = guardCancel(
      await text({
        message: "API Base URL",
        initialValue: preset.baseUrl,
      }),
    ) as string;
  }

  const model = await selectModel(baseUrl, apiKey, preset.model);

  await verifyEndpoint(baseUrl, apiKey, model);

  clackLog.step("Browser control (optional)");
  const enableBrowser = guardCancel(
    await confirm({
      message: "Enable browser automation (Playwright)? Will auto-install on first use.",
      initialValue: false,
    }),
  ) as boolean;

  const config = buildDefaultConfig(baseUrl, apiKey, model, enableBrowser);
  await saveAndShowConfig(config, configPath, configDir, preset.label, baseUrl, model, apiKey, enableBrowser);

  outro("Setup complete! Run `openflow chat` to start chatting.");
  return config;
}

function buildDefaultConfig(
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

async function saveAndShowConfig(
  config: OpenFlowConfig,
  configPath: string,
  configDir: string,
  providerLabel: string,
  baseUrl: string,
  model: string,
  apiKey: string,
  enableBrowser: boolean,
): Promise<void> {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
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
