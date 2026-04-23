import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { createProviderPool } from "../llm/pool.js";
import { createMemoryStore } from "../memory/store.js";
import { createProviderStore } from "../memory/provider-store.js";
import { createToolExecutor, type ChannelSender } from "../tools/executor.js";
import { createAgentEngine } from "../agent/engine.js";
import { createWebSocketChannel } from "../channel/websocket/index.js";
import type { ConfirmationHandler } from "../tools/confirmation.js";
import { createNotificationService, createPushTokenStore } from "../notification/index.js";
import { watchConfig } from "../config/loader.js";
import type { OpenFlowConfig } from "../config/schema.js";
import { IssueReporter } from "../reporting/issue-reporter.js";
import { setupErrorCollector } from "../reporting/error-collector.js";

const log = createLogger("cli");

interface AgentDeps {
  memory: ReturnType<typeof createMemoryStore>;
  agent: ReturnType<typeof createAgentEngine>;
  providerPool: ReturnType<typeof createProviderPool>;
  providerStore: ReturnType<typeof createProviderStore>;
}

function createAgentDeps(
  config: OpenFlowConfig,
  sender?: ChannelSender,
  confirmationHandler?: ConfirmationHandler,
): AgentDeps {
  const memory = createMemoryStore(config.memory.dbPath);
  const providerStore = createProviderStore(memory.getDb());

  const providerPool = createProviderPool(providerStore, {
    maxTokens: config.llm.maxTokens,
    temperature: config.llm.temperature,
  });

  const tools = createToolExecutor(config.tools, config.agent.workspace, sender);
  const agent = createAgentEngine({
    llm: () => providerPool.getClient(),
    memory,
    tools,
    config: { ...config.agent, contextSize: config.memory.contextSize, skills: config.skills },
    confirmationHandler,
    confirmationTimeout: config.tools.confirmationTimeout,
  });
  return { memory, agent, providerPool, providerStore };
}

function createServerCleanup(
  memory: AgentDeps["memory"],
  wsChannel: Awaited<ReturnType<typeof createWebSocketChannel>>,
  unwatch: () => void,
  config: OpenFlowConfig,
  notification: ReturnType<typeof createNotificationService>,
): () => Promise<void> {
  let isShuttingDown = false;

  return async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

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
}

export async function runServer(config: OpenFlowConfig): Promise<void> {
  const confirmationHandler: ConfirmationHandler = {
    requestConfirmation: async () => ({ approved: true }),
  };

  const { memory, agent, providerPool, providerStore } = createAgentDeps(
    config,
    undefined,
    confirmationHandler,
  );

  const pushTokenStore = createPushTokenStore();
  const notification = createNotificationService(
    { enabled: config.notification.enabled },
    pushTokenStore,
  );

  if (!config.websocket.enabled) {
    log.error("websocket channel not enabled. Set websocket.enabled=true in config.");
    process.exit(1);
  }

  const issueReporter =
    config.reporting.enabled && config.reporting.githubToken
      ? new IssueReporter({
          githubToken: config.reporting.githubToken,
          githubRepo: config.reporting.githubRepo,
          rateLimitPerMinute: config.reporting.rateLimitPerMinute,
        })
      : undefined;

  const wsChannel = createWebSocketChannel(
    { host: config.websocket.host, port: config.websocket.port, cors: config.websocket.cors },
    {
      agentEngine: agent,
      memoryStore: memory,
      providerStore,
      providerPool,
      pushTokenStore,
      createSession: (title: string) => memory.createSession(title),
      issueReporter,
    },
  );

  log.info("starting WebSocket server...");
  await wsChannel.start();

  if (issueReporter) {
    setupErrorCollector(issueReporter, "0.1.0");
    log.info("error reporting enabled");
  }

  const sender: ChannelSender = {
    sendMessage: async (_chatId, text) => {
      wsChannel.broadcastMessage(text);
    },
    sendPhoto: async (_chatId, _photo, _caption) => {
      throw new OpenFlowError(
        "sendPhoto is not supported via WebSocket channel",
        "PERMISSION_DENIED",
      );
    },
  };
  agent.updateChannelSender(sender);

  if (config.notification.enabled) {
    notification.notifyAll("OpenFlow", config.notification.onStart).catch((err) => {
      log.warn({ err }, "failed to send start notification");
    });
  }

  const unwatch = watchConfig(() => {
    log.info("config file changed, restart required for full effect");
  });

  const cleanup = createServerCleanup(memory, wsChannel, unwatch, config, notification);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
