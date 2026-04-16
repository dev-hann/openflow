#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

import { createLogger } from "./utils/logger.js";
import { OpenFlowError } from "./utils/errors.js";
import { loadConfig, getConfigPath, resetConfigCache, watchConfig } from "./config/loader.js";
import type { OpenFlowConfig } from "./config/schema.js";
import { createLlmClient } from "./llm/client.js";
import { createMemoryStore } from "./memory/store.js";
import { createToolExecutor } from "./tools/executor.js";
import { createAgentEngine } from "./agent/engine.js";
import { createTelegramChannel } from "./channel/telegram.js";

const log = createLogger("cli");

const HELP_TEXT = `
OpenFlow — Lightweight Personal AI Assistant

Usage:
  openflow [command] [options]

Commands:
  (none)       Start Telegram bot (same as "start")
  start        Start Telegram bot
  chat         Chat in CLI mode (no Telegram)
  config       Create or open configuration file
  config show  Show current configuration
  session      Manage sessions
    session list     List all sessions
    session reset <id> Reset a session
  --version    Show version
  --help       Show this help

Options:
  --config <path>   Path to config file
  --verbose         Enable debug logging

Configuration:
  Config file: ~/.openflow/openflow.json
  Run "openflow config" to create one.
`.trim();

const VERSION = "0.1.0";

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

function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }
  return value;
}

const LLM_PRESETS = [
  {
    id: "zai-coding-global",
    label: "ZAI Coding Plan (Global)",
    hint: "api.z.ai · GLM-5.1 recommended",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    model: "glm-5.1",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "zai-coding-cn",
    label: "ZAI Coding Plan (China)",
    hint: "open.bigmodel.cn · GLM-5.1 recommended",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    model: "glm-5.1",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "zai-global",
    label: "ZAI General (Global)",
    hint: "api.z.ai · Standard API endpoint",
    baseUrl: "https://api.z.ai/api/paas/v4",
    model: "glm-4.7-flash",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "zai-cn",
    label: "ZAI General (China)",
    hint: "open.bigmodel.cn · Standard API endpoint",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7-flash",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "GPT-4o · api.openai.com",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    needsApiKey: true,
    envKeyNames: ["OPENAI_API_KEY"],
  },
  {
    id: "anthropic",
    label: "Anthropic (via OpenAI compat)",
    hint: "api.anthropic.com · Claude models",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
    needsApiKey: true,
    envKeyNames: ["ANTHROPIC_API_KEY"],
  },
  {
    id: "google",
    label: "Google Gemini (via OpenAI compat)",
    hint: "generativelanguage.googleapis.com",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    needsApiKey: true,
    envKeyNames: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    hint: "deepseek-chat / deepseek-reasoner",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    needsApiKey: true,
    envKeyNames: ["DEEPSEEK_API_KEY"],
  },
  {
    id: "groq",
    label: "Groq",
    hint: "Ultra-fast inference · groq.com",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    needsApiKey: true,
    envKeyNames: ["GROQ_API_KEY"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "Multi-provider gateway · openrouter.ai",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o",
    needsApiKey: true,
    envKeyNames: ["OPENROUTER_API_KEY"],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    hint: "No API key needed · localhost:11434",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3",
    needsApiKey: false,
    envKeyNames: [],
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible endpoint",
    hint: "Enter URL and model manually",
    baseUrl: "",
    model: "",
    needsApiKey: true,
    envKeyNames: [],
  },
] as const;

function formatKeyPreview(key: string): string {
  if (key.length <= 12) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function normalizeApiKeyInput(raw: string): string {
  let value = raw.trim();
  if (value.startsWith("export ")) {
    value = value.slice("export ".length);
  }
  const eqIdx = value.indexOf("=");
  if (eqIdx > 0 && !value.startsWith("http")) {
    value = value.slice(eqIdx + 1);
  }
  value = value.replace(/^['"]|['"]$/g, "").replace(/;$/, "").trim();
  return value;
}

function resolveEnvKey(preset: (typeof LLM_PRESETS)[number]): string | undefined {
  for (const name of preset.envKeyNames) {
    const val = process.env[name];
    if (val?.trim()) return val.trim();
  }
  return undefined;
}

async function detectZaiEndpoint(
  apiKey: string,
): Promise<{ baseUrl: string; model: string; note: string } | null> {
  const candidates = [
    { baseUrl: "https://api.z.ai/api/coding/paas/v4", model: "glm-5.1", label: "ZAI Coding Global" },
    { baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-5.1", label: "ZAI Coding CN" },
    { baseUrl: "https://api.z.ai/api/paas/v4", model: "glm-5.1", label: "ZAI Global" },
    { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.1", label: "ZAI CN" },
    { baseUrl: "https://api.z.ai/api/coding/paas/v4", model: "glm-4.7", label: "ZAI Coding Global (glm-4.7 fallback)" },
    { baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-4.7", label: "ZAI Coding CN (glm-4.7 fallback)" },
  ];

  for (const c of candidates) {
    try {
      const resp = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: c.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          stream: false,
        }),
        signal: AbortSignal.timeout(5_000),
      } as never);
      if (resp.ok) {
        return { baseUrl: c.baseUrl, model: c.model, note: `Detected: ${c.label}` };
      }
    } catch {
      // try next
    }
  }
  return null;
}

async function fetchModels(
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const resp = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    } as never);
    if (!resp.ok) return [];
    const body = (await resp.json()) as Record<string, unknown>;
    // OpenAI standard: { data: [{ id: "model-name" }] }
    if (Array.isArray(body.data)) {
      return (body.data as Array<Record<string, unknown>>)
        .map((m) => (m.id as string) ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
    // Some providers return top-level array: [{ id: "..." }]
    if (Array.isArray(body)) {
      return ((body as Array<Record<string, unknown>>)
        .map((m) => (m.id as string) ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)));
    }
    // Some providers nest under "models": [{ id: "..." }]
    if (Array.isArray(body.models)) {
      return ((body.models as Array<Record<string, unknown>>)
        .map((m) => ((m.id as string) ?? (m as unknown as string)) ?? "")
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .sort((a, b) => a.localeCompare(b)));
    }
    return [];
  } catch {
    return [];
  }
}

async function verifyLlmEndpoint(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 16,
      }),
      signal: AbortSignal.timeout(15_000),
    } as never);
    if (resp.ok) {
      return { ok: true };
    }
    const body = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, error: body.slice(0, 200) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runSetupWizard(): Promise<OpenFlowConfig> {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  console.log(BANNER);
  intro("OpenFlow Setup Wizard");

  // --- Step 1: Provider selection ---
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

  // --- Step 2: API Key (ask first for ZAI so we can auto-detect endpoint) ---
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

  // --- Step 3: Base URL + ZAI auto-detection ---
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

  // --- Step 4: Model selection (fetched from provider API) ---
  let model: string;
  {
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
              hint: m === preset.model ? "recommended" : undefined,
            })),
            { value: "__custom__", label: "Enter model name manually", hint: "type a custom model ID" },
          ],
          initialValue: remoteModels.includes(preset.model) ? preset.model : remoteModels[0],
        }),
      ) as string;

      if (selected === "__custom__") {
        model = guardCancel(
          await text({
            message: "Model name",
            placeholder: preset.model,
            validate: (v) => (!v?.trim() ? "Model name is required" : undefined),
          }),
        ) as string;
      } else {
        model = selected;
      }
    } else {
      model = guardCancel(
        await text({
          message: "Model name",
          initialValue: preset.model || undefined,
          placeholder: "e.g. gpt-4o, glm-4-flash",
          validate: (v) => (!v?.trim() ? "Model name is required" : undefined),
        }),
      ) as string;
    }
  }

  // --- Step 5: Verify endpoint ---
  const shouldVerify = guardCancel(
    await confirm({
      message: "Verify connection to LLM endpoint now?",
      initialValue: true,
    }),
  ) as boolean;

  if (shouldVerify) {
    const s = spinner();
    s.start("Verifying endpoint...");
    const result = await verifyLlmEndpoint(baseUrl, apiKey, model);
    if (result.ok) {
      s.stop("Connection verified successfully.");
    } else {
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
  }

  // --- Step 6: Telegram (optional) ---
  clackLog.step("Telegram setup (optional)");
  const setupTelegram = guardCancel(
    await confirm({
      message: "Configure Telegram bot now?",
      initialValue: false,
    }),
  ) as boolean;

  let botToken = "NOT_SET";
  let allowedUsers: number[] = [];

  if (setupTelegram) {
    botToken = guardCancel(
      await text({
        message: "Telegram Bot Token",
        placeholder: "123456:ABC-DEF...",
        validate: (v) => (!v?.trim() ? "Bot token is required" : undefined),
      }),
    ) as string;

    const allowedUsersStr = guardCancel(
      await text({
        message: "Allowed Telegram User IDs (comma-separated, empty = allow all)",
        placeholder: "123456789,987654321",
      }),
    ) as string;

    allowedUsers = allowedUsersStr
      ? allowedUsersStr
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      : [];
  }

  // --- Step 7: Write config ---
  const config: OpenFlowConfig = {
    llm: { baseUrl, apiKey, model, maxTokens: 4096, temperature: 0.7 },
    telegram: { botToken, allowedUsers, streamingMode: "partial", errorPolicy: "once", groupEnabled: false, webhook: { enabled: false, host: "127.0.0.1", port: 8787 } },
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
    },
    logging: { level: "info" },
  };

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
  clackLog.info(`  Provider: ${preset.label}`);
  clackLog.info(`  Base URL: ${baseUrl}`);
  clackLog.info(`  Model:    ${model}`);
  clackLog.info(`  API Key:  ${formatKeyPreview(apiKey)}`);
  clackLog.info(`  Telegram: ${setupTelegram ? "configured" : "skipped"}`);
  clackLog.info(`  Config:   ${configPath}`);

  outro("Setup complete! Run `openflow chat` to start chatting.");
  return config;
}

function findArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function getCommand(argv: string[]): string {
  const args = argv.slice(2).filter((a) => !a.startsWith("-") && a !== "--config");
  return args[0] ?? "";
}

function getSubCommand(argv: string[]): string {
  const args = argv.slice(2).filter((a) => !a.startsWith("-") && a !== "--config");
  return args[1] ?? "";
}

async function runTelegramBot(config: OpenFlowConfig): Promise<void> {
  const llm = createLlmClient(config.llm);
  const memory = createMemoryStore(config.memory.dbPath);
  const tools = createToolExecutor(config.tools, config.agent.workspace);
  const agent = createAgentEngine({ llm, memory, tools, config: config.agent });

  const channel = createTelegramChannel(
    config.telegram,
    agent,
    (title: string) => memory.createSession(title),
    memory,
  );

  const cleanup = async () => {
    log.info("shutting down...");
    unwatch();
    await channel.stop();
    memory.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const unwatch = watchConfig(() => {
    log.info("config file changed, restart required for full effect");
  });

  log.info("starting OpenFlow telegram bot...");
  await channel.start();
}

async function runCliChat(config: OpenFlowConfig): Promise<void> {
  const llm = createLlmClient(config.llm);
  const memory = createMemoryStore(config.memory.dbPath);
  const tools = createToolExecutor(config.tools, config.agent.workspace);
  const agent = createAgentEngine({ llm, memory, tools, config: config.agent });

  const session = memory.createSession("CLI Chat");
  log.info({ sessionId: session.id }, "CLI session created. Type /exit to quit.");

  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const input = await rl.question("You> ");
    if (!input.trim()) continue;
    if (input.trim() === "/exit" || input.trim() === "/quit") break;
    if (input.trim() === "/new") {
      const newSession = memory.createSession("CLI Chat");
      log.info({ sessionId: newSession.id }, "new session");
      continue;
    }

    process.stdout.write("Assistant> ");
    const result = await agent.handleMessage({
      sessionId: session.id,
      userMessage: input,
      onToken: (token) => process.stdout.write(token),
    });

    if (result.type === "text") {
      process.stdout.write("\n");
    } else {
      process.stdout.write(`\nError: ${result.error.message}\n`);
    }
  }

  rl.close();
  memory.close();
}

function showConfig(config: OpenFlowConfig): void {
  const masked = {
    ...config,
    llm: {
      ...config.llm,
      apiKey: formatKeyPreview(config.llm.apiKey),
    },
    telegram: {
      ...config.telegram,
      botToken: config.telegram.botToken === "NOT_SET" ? "(not configured)" : formatKeyPreview(config.telegram.botToken),
    },
  };
  console.log(JSON.stringify(masked, null, 2));
}

async function main(): Promise<void> {
  const argv = process.argv;

  if (hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    console.log(HELP_TEXT);
    return;
  }

  if (hasFlag(argv, "--version") || hasFlag(argv, "-v")) {
    console.log(`OpenFlow v${VERSION}`);
    return;
  }

  if (hasFlag(argv, "--verbose")) {
    process.env.OPENFLOW_LOG_LEVEL = "debug";
  }

  const configPathCli = findArg(argv, "--config");
  if (configPathCli) {
    process.env.OPENFLOW_CONFIG = resolve(configPathCli);
  }

  const command = getCommand(argv);
  const subCommand = getSubCommand(argv);

  if (command === "config") {
    if (subCommand === "show") {
      try {
        const config = loadConfig();
        showConfig(config);
      } catch (err) {
        console.error(err instanceof OpenFlowError ? err.message : String(err));
        process.exit(1);
      }
      return;
    }

    const path = getConfigPath();
    if (!existsSync(path)) {
      await runSetupWizard();
      return;
    }
    console.log(`Configuration file: ${path}`);
    const { execSync } = await import("node:child_process");
    const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
    execSync(`${editor} "${path}"`, { stdio: "inherit" });
    return;
  }

  if (command === "session") {
    try {
      const config = loadConfig();
      const memory = createMemoryStore(config.memory.dbPath);

      if (subCommand === "list") {
        const sessions = memory.listSessions();
        if (sessions.length === 0) {
          console.log("No sessions found.");
        } else {
          for (const s of sessions) {
            console.log(`  ${s.id}  ${s.title}  ${new Date(s.updatedAt).toISOString()}`);
          }
        }
      } else if (subCommand === "reset" && process.argv[process.argv.indexOf("reset") + 1]) {
        const sessionId = process.argv[process.argv.indexOf("reset") + 1]!;
        memory.deleteSession(sessionId);
        console.log(`Session ${sessionId} deleted.`);
      } else {
        console.log("Usage: openflow session list | openflow session reset <id>");
      }

      memory.close();
    } catch (err) {
      console.error(err instanceof OpenFlowError ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  let config: OpenFlowConfig;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof OpenFlowError && err.code === "CONFIG_NOT_FOUND") {
      console.log(BANNER);
      clackLog.warn("No configuration file found.");
      const shouldSetup = guardCancel(
        await confirm({
          message: "Run setup wizard now?",
          initialValue: true,
        }),
      ) as boolean;
      if (shouldSetup) {
        config = await runSetupWizard();
      } else {
        clackLog.info('Run "openflow config" to set up later.');
        process.exit(0);
      }
    } else {
      throw err;
    }
  }

  if (command === "chat") {
    await runCliChat(config);
    return;
  }

  await runTelegramBot(config);
}

main().catch((err) => {
  if (err instanceof OpenFlowError) {
    log.error({ code: err.code }, err.message);
  } else {
    log.fatal({ err }, "unhandled error");
  }
  process.exit(1);
});
