import { createLogger } from "../utils/logger.js";
import { createLlmClient } from "../llm/client.js";
import { createMemoryStore } from "../memory/store.js";
import { createToolExecutor, type ChannelSender } from "../tools/executor.js";
import { createAgentEngine } from "../agent/engine.js";
import { createWebSocketChannel } from "../channel/websocket/index.js";
import type { ConfirmationHandler } from "../tools/confirmation.js";
import { createNotificationService, createPushTokenStore } from "../notification/index.js";
import { watchConfig } from "../config/loader.js";
import type { OpenFlowConfig } from "../config/schema.js";
import { formatKeyPreview } from "./presets.js";

const log = createLogger("cli");

export async function runServer(config: OpenFlowConfig): Promise<void> {
  const sender: ChannelSender = {
    sendMessage: async () => {},
    sendPhoto: async () => {},
  };

  const confirmationHandler: ConfirmationHandler = {
    requestConfirmation: async () => ({ approved: true }),
  };

  const llm = createLlmClient(config.llm);
  const memory = createMemoryStore(config.memory.dbPath);
  const tools = createToolExecutor(config.tools, config.agent.workspace, sender);
  const agent = createAgentEngine({
    llm,
    memory,
    tools,
    config: { ...config.agent, skills: config.skills },
    confirmationHandler,
    confirmationTimeout: config.tools.confirmationTimeout,
  });

  const pushTokenStore = createPushTokenStore();
  const notification = createNotificationService(
    { enabled: config.notification.enabled },
    pushTokenStore,
  );

  if (!config.websocket.enabled) {
    log.error("websocket channel not enabled. Set websocket.enabled=true in config.");
    process.exit(1);
  }

  const wsChannel = createWebSocketChannel(
    { host: config.websocket.host, port: config.websocket.port, cors: config.websocket.cors },
    {
      agentEngine: agent,
      memoryStore: memory,
      createSession: (title: string) => memory.createSession(title),
      availableModels: config.llm.apiKeys ? undefined : [config.llm.model],
      currentModel: config.llm.model,
      onModelChange: (model: string) => {
        config.llm.model = model;
      },
    },
  );

  log.info("starting WebSocket server...");
  await wsChannel.start();

  if (config.notification.enabled) {
    notification.notifyAll("OpenFlow", config.notification.onStart).catch((err) => {
      log.warn({ err }, "failed to send start notification");
    });
  }

  const unwatch = watchConfig(() => {
    log.info("config file changed, restart required for full effect");
  });

  const cleanup = async () => {
    log.info("shutting down...");
    unwatch();
    if (config.notification.enabled) {
      await notification.notifyAll("OpenFlow", config.notification.onStop).catch((err) => {
        log.warn({ err }, "failed to send stop notification");
      });
    }
    await wsChannel.stop();
    memory.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

export async function runCliChat(config: OpenFlowConfig): Promise<void> {
  const llm = createLlmClient(config.llm);
  const memory = createMemoryStore(config.memory.dbPath);
  const tools = createToolExecutor(config.tools, config.agent.workspace);
  const agent = createAgentEngine({ llm, memory, tools, config: { ...config.agent, skills: config.skills } });

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

export function showConfig(config: OpenFlowConfig): void {
  const masked = {
    ...config,
    llm: {
      ...config.llm,
      apiKey: formatKeyPreview(config.llm.apiKey),
    },
  };
  process.stdout.write(JSON.stringify(masked, null, 2) + "\n");
}
