import { Bot, type Context, InlineKeyboard } from "grammy";
import { run, type RunOptions } from "@grammyjs/runner";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { SETUP_SYSTEM_PROMPT } from "../agent/setup-prompt.js";
import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import type { MemoryStore } from "../memory/index.js";
import type { AgentEngine } from "../agent/index.js";
import { createTelegramFetch } from "./telegram/transport.js";
import { createOffsetStore } from "./telegram/offset-store.js";
import { createErrorPolicy, type ErrorPolicyMode } from "./telegram/error-policy.js";
import {
  extractPhotoMedia,
  extractDocumentMedia,
  extractVoiceMedia,
  extractVideoMedia,
  extractStickerMedia,
  formatMediaDescription,
  type MediaInfo,
} from "./telegram/media.js";

const log = createLogger("channel");

export interface TelegramConfig {
  botToken: string;
  allowedUsers: number[];
  streamingMode: "partial" | "block" | "progress" | "off";
  errorPolicy: ErrorPolicyMode;
  groupEnabled: boolean;
  proxy?: string;
  webhook?: {
    enabled: boolean;
    url?: string;
    host: string;
    port: number;
    secret?: string;
  };
  availableModels?: string[];
  currentModel?: string;
  onModelChange?: (model: string) => void;
}

export interface TelegramChannel {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(chatId: number | string, text: string): Promise<void>;
  editMessage(chatId: number | string, messageId: number, text: string): Promise<void>;
}

const STREAM_EDIT_INTERVAL_MS = 500;
const MAX_MESSAGE_LENGTH = 4096;
const POLL_STALL_THRESHOLD_MS = 90_000;
const POLL_WATCHDOG_INTERVAL_MS = 30_000;
const STOP_GRACE_MS = 15_000;
const GETME_TIMEOUT_MS = 15_000;
const DELETE_WEBHOOK_TIMEOUT_MS = 15_000;

const RESTART_POLICY = {
  initialMs: 2000,
  maxMs: 30_000,
  factor: 1.8,
};

function truncateMessage(text: string): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return text.slice(0, MAX_MESSAGE_LENGTH - 3) + "...";
}

function computeBackoff(attempt: number): number {
  const { initialMs, maxMs, factor } = RESTART_POLICY;
  const delay = initialMs * Math.pow(factor, attempt);
  return Math.min(delay, maxMs);
}

function isGetUpdatesConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { error_code?: number; errorCode?: number; method?: string; message?: string; description?: string };
  const code = e.error_code ?? e.errorCode;
  if (code !== 409) return false;
  const haystack = [e.method, e.description, e.message].filter((v): v is string => typeof v === "string").join(" ").toLowerCase();
  return haystack.includes("getupdates");
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("enetunreach") ||
    msg.includes("ehostunreach") ||
    msg.includes("network")
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
}

async function gracefulStop(stopFn: () => Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout>;
  await Promise.race([
    stopFn(),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, STOP_GRACE_MS);
      timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
}

export function createTelegramChannel(
  config: TelegramConfig,
  agentEngine: AgentEngine,
  createSession: (title: string) => { id: string },
  memoryStore?: MemoryStore,
): TelegramChannel {
  const telegramFetch = createTelegramFetch(config.proxy);
  const bot = new Bot(config.botToken, {
    client: { fetch: telegramFetch },
  });
  bot.api.config.use(apiThrottler());
  const offsetStore = createOffsetStore(join(homedir(), ".openflow", "telegram-offset.json"));
  const errorPolicy = createErrorPolicy({ mode: config.errorPolicy });
  const sessionMap = new Map<string, string>();

  let activeRunner: ReturnType<typeof run> | undefined;
  let abortController: AbortController | undefined;
  let webhookServer: Server | undefined;
  let stopped = false;

  function getSessionId(chatId: number, threadId?: number): string {
    const key = threadId ? `${chatId}:${threadId}` : `${chatId}`;
    let sessionId = sessionMap.get(key);
    if (!sessionId) {
      const session = createSession("Telegram Chat");
      sessionMap.set(key, session.id);
      sessionId = session.id;
    }
    return sessionId;
  }

  function isAllowed(userId: number): boolean {
    if (config.allowedUsers.length === 0) return true;
    return config.allowedUsers.includes(userId);
  }

  bot.command("new", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;

    const chatId = String(ctx.msg.chat.id);
    const session = createSession("Telegram Chat");
    sessionMap.set(chatId, session.id);
    await ctx.reply("New session started.");
    log.info({ chatId }, "new session created via /new");
  });

  bot.command("reset", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;

    const chatId = String(ctx.msg.chat.id);
    const session = createSession("Telegram Chat");
    sessionMap.set(chatId, session.id);
    await ctx.reply("Session reset.");
  });

  bot.command("help", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;

    await ctx.reply(
      "OpenFlow — Personal AI Assistant\n\n" +
        "/new — Start a new session\n" +
        "/reset — Reset current session\n" +
        "/status — Show session info\n" +
        "/compact — Summarize and compact context\n" +
        "/history — Show recent messages\n" +
        "/model — Change LLM model\n" +
        "/help — Show this help\n\n" +
        "Send any message to chat with the assistant.",
    );
  });

  bot.command("status", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;
    if (!memoryStore) { await ctx.reply("Status unavailable."); return; }

    const chatId = String(ctx.msg.chat.id);
    const sessionId = sessionMap.get(chatId);
    if (!sessionId) { await ctx.reply("No active session. Send a message to start."); return; }

    const session = memoryStore.getSession(sessionId);
    if (!session) { await ctx.reply("Session not found."); return; }

    const messages = memoryStore.getMessages(sessionId);
    const userMsgs = messages.filter((m) => m.role === "user").length;
    const assistantMsgs = messages.filter((m) => m.role === "assistant").length;
    const created = new Date(session.createdAt).toISOString().slice(0, 16);
    const updated = new Date(session.updatedAt).toISOString().slice(0, 16);

    await ctx.reply(
      `Session: ${session.title}\n` +
        `ID: ${sessionId}\n` +
        `Created: ${created}\n` +
        `Last active: ${updated}\n` +
        `Messages: ${userMsgs} user, ${assistantMsgs} assistant`,
    );
  });

  bot.command("compact", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;

    const chatId = String(ctx.msg.chat.id);
    const sessionId = sessionMap.get(chatId);
    if (!sessionId) { await ctx.reply("No active session."); return; }

    await ctx.reply("Context compaction will trigger automatically if needed on the next message.");
  });

  bot.command("history", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;
    if (!memoryStore) { await ctx.reply("History unavailable."); return; }

    const chatId = String(ctx.msg.chat.id);
    const sessionId = sessionMap.get(chatId);
    if (!sessionId) { await ctx.reply("No active session."); return; }

    const messages = memoryStore.getMessages(sessionId, 10);
    if (messages.length === 0) { await ctx.reply("No messages in this session."); return; }

    const lines = messages.map((m) => {
      const role = m.role === "user" ? "👤" : m.role === "assistant" ? "🤖" : "🔧";
      const content = (typeof m.content === "string" ? m.content : "").slice(0, 80);
      return `${role} ${content}`;
    });
    await ctx.reply(truncateMessage(lines.join("\n")));
  });

  bot.command("model", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;

    const models = config.availableModels;
    if (!models || models.length === 0) {
      await ctx.reply(config.currentModel ? `Current model: ${config.currentModel}` : "Model selection not configured.");
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const m of models) {
      const label = m === config.currentModel ? `✓ ${m}` : m;
      keyboard.text(label, `model:${m}`).row();
    }
    await ctx.reply(`Current: ${config.currentModel ?? "unknown"}\nSelect model:`, { reply_markup: keyboard });
  });

  bot.callbackQuery(/^model:(.+)$/, async (ctx) => {
    if (!isAllowed(ctx.from?.id)) { await ctx.answerCallbackQuery(); return; }

    const model = ctx.callbackQuery.data!.slice("model:".length);
    if (config.onModelChange) {
      config.onModelChange(model);
    }
    await ctx.answerCallbackQuery({ text: `Switched to ${model}` });
    await ctx.editMessageText(`Model: ${model}`);
    log.info({ model }, "model changed via inline keyboard");
  });

  bot.on("message:text", async (ctx: Context) => {
    if (!ctx.msg?.text) return;
    const userId = ctx.msg.from?.id ?? 0;
    if (!isAllowed(userId)) {
      log.warn({ userId }, "unauthorized user");
      return;
    }

    const chatId = ctx.msg.chat.id;
    const chatType = ctx.msg.chat.type;
    const isGroup = chatType === "group" || chatType === "supergroup";

    if (isGroup && !config.groupEnabled) return;

    const botUsername = bot.botInfo?.username;
    if (isGroup && botUsername) {
      const text = ctx.msg.text;
      const isCommand = text.startsWith("/");
      const isMention = text.includes(`@${botUsername}`);
      const isReply = ctx.msg.reply_to_message?.from?.username === botUsername;
      if (!isCommand && !isMention && !isReply) return;
    }

    const sessionId = getSessionId(chatId);

    const workspace = agentEngine.getWorkspace();
    const setupMode = !workspace.hasPersona();
    const systemPromptOverride = setupMode ? SETUP_SYSTEM_PROMPT : undefined;

    const onToken = createStreamingHandler(
      config.streamingMode,
      chatId,
      (text) => ctx.reply(text),
      async (cid, mid, text) => { await bot.api.editMessageText(cid, mid, text); },
      async (cid, mid) => { await bot.api.deleteMessage(cid, mid); },
      async (cid, text) => bot.api.sendMessage(cid, text),
    );

    const result = await agentEngine.handleMessage({
      sessionId,
      userMessage: ctx.msg.text,
      onToken: onToken.onToken,
      systemPromptOverride,
    });

    await onToken.flush();

    const finalText = result.type === "text"
      ? truncateMessage(result.content || "(no response)")
      : errorPolicy.shouldShow(result.error.code ?? "UNKNOWN")
        ? truncateMessage(`Error: ${result.error.message}`)
        : null;

    if (!finalText?.trim()) return;

    try {
      await onToken.finalize(finalText);
    } catch (err) {
      log.error({ err }, "failed to send final response");
    }
  });

  const mediaHandlers: Array<{ filter: string; extract: (ctx: Context) => MediaInfo | null }> = [
    { filter: "message:photo", extract: (ctx) => extractPhotoMedia(ctx) },
    { filter: "message:document", extract: (ctx) => extractDocumentMedia(ctx) },
    { filter: "message:voice", extract: (ctx) => extractVoiceMedia(ctx) },
    { filter: "message:video", extract: (ctx) => extractVideoMedia(ctx) },
    { filter: "message:sticker", extract: (ctx) => extractStickerMedia(ctx) },
  ];

  for (const { filter, extract } of mediaHandlers) {
    bot.on(filter as "message:text", async (ctx: Context) => {
      const userId = ctx.msg?.from?.id ?? 0;
      if (!isAllowed(userId)) return;

      const media = extract(ctx);
      if (!media) return;

      const chatId = ctx.msg!.chat.id;
      const threadId = (ctx.msg as { message_thread_id?: number }).message_thread_id;
      const sessionId = getSessionId(chatId, threadId);
      const description = formatMediaDescription(media);

      log.info({ chatId, mediaType: media.type, fileName: media.fileName }, "media received");

      const result = await agentEngine.handleMessage({
        sessionId,
        userMessage: description,
      });

      const replyText = result.type === "text"
        ? truncateMessage(result.content || "(no response)")
        : truncateMessage(`Error: ${result.error.message}`);

      try {
        await ctx.reply(replyText);
      } catch (err) {
        log.error({ err }, "failed to send media response");
      }
    });
  }

  bot.catch((err: unknown) => {
    log.error({ err }, "bot middleware error");
  });

  return {
    async start(): Promise<void> {
      try {
        const me = await withTimeout(bot.api.getMe(), GETME_TIMEOUT_MS, "getMe");
        log.info({ username: me.username }, "telegram bot connected");
      } catch (err) {
        throw new OpenFlowError(
          `Telegram authentication failed: ${err instanceof Error ? err.message : String(err)}`,
          "TELEGRAM_AUTH_FAILED",
          err,
        );
      }

      try {
        await withTimeout(
          bot.api.deleteWebhook({ drop_pending_updates: true }),
          DELETE_WEBHOOK_TIMEOUT_MS,
          "deleteWebhook",
        );
        log.info("cleared pending updates");
      } catch {
        // ignore
      }

      try {
        await bot.api.setMyCommands([
          { command: "new", description: "Start a new session" },
          { command: "reset", description: "Reset current session" },
          { command: "status", description: "Show session info" },
          { command: "compact", description: "Compact conversation context" },
          { command: "history", description: "Show recent messages" },
          { command: "model", description: "Change LLM model" },
          { command: "help", description: "Show help" },
        ]);
      } catch {
        // non-critical
      }

      abortController = new AbortController();

      if (config.webhook?.enabled && config.webhook.url) {
        await startWebhook();
      } else {
        await runPollingLoop();
      }
    },

    async stop(): Promise<void> {
      stopped = true;
      abortController?.abort();
      if (webhookServer) {
        await new Promise<void>((resolve) => webhookServer!.close(() => resolve()));
        webhookServer = undefined;
      }
      if (activeRunner) {
        await gracefulStop(() => activeRunner!.stop());
      }
      await gracefulStop(() => bot.stop());
      log.info("telegram bot stopped");
    },

    async sendMessage(chatId: number | string, text: string): Promise<void> {
      await bot.api.sendMessage(Number(chatId), truncateMessage(text));
    },

    async editMessage(chatId: number | string, messageId: number, text: string): Promise<void> {
      await bot.api.editMessageText(Number(chatId), messageId, truncateMessage(text));
    },
  };

  async function startWebhook(): Promise<void> {
    const wh = config.webhook!;
    const host = wh.host ?? "127.0.0.1";
    const port = wh.port ?? 8787;

    await bot.api.setWebhook(wh.url!, {
      secret_token: wh.secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });

    webhookServer = createServer(async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405).end();
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const body = Buffer.concat(chunks).toString("utf-8");

      if (wh.secret) {
        const headerSecret = req.headers["x-telegram-bot-api-secret-token"] as string | undefined;
        if (headerSecret !== wh.secret) {
          res.writeHead(403).end();
          return;
        }
      }

      try {
        await bot.handleUpdate(JSON.parse(body) as never);
      } catch (err) {
        log.error({ err }, "webhook update processing failed");
      }
      res.writeHead(200).end();
    });

    await new Promise<void>((resolve) => {
      webhookServer!.listen(port, host, () => resolve());
    });
    log.info({ host, port, url: wh.url }, "webhook server started");
  }

  async function runPollingLoop(): Promise<void> {
    let restartAttempts = 0;
    const savedOffset = offsetStore.get();
    if (savedOffset > 0) {
      log.info({ savedOffset }, "restored saved update offset");
    }

    while (!stopped && !abortController?.signal.aborted) {
      let stallDetected = false;
      let lastGetUpdatesAt = Date.now();
      let inFlightGetUpdates = 0;

      const runnerOptions: RunOptions<never> = {
        runner: {
          retryInterval: "exponential",
          maxRetryTime: 3_600_000,
          silent: true,
          fetch: {
            allowed_updates: ["message"],
          },
        },
      };

      const runner = run(bot as never, runnerOptions);
      activeRunner = runner;

      const watchdog = setInterval(() => {
        if (abortController?.signal.aborted || stopped) return;
        const now = Date.now();
        const elapsed = inFlightGetUpdates > 0
          ? now - lastGetUpdatesAt
          : now - lastGetUpdatesAt;

        if (elapsed > POLL_STALL_THRESHOLD_MS && runner.isRunning()) {
          stallDetected = true;
          log.warn(
            { elapsedMs: elapsed, inFlight: inFlightGetUpdates },
            "polling stall detected; forcing restart",
          );
          void runner.stop();
        }
      }, POLL_WATCHDOG_INTERVAL_MS);

      bot.api.config.use(async (prev, method, payload, signal) => {
        if (method === "getUpdates") {
          if (savedOffset > 0) {
            (payload as Record<string, unknown>).offset = savedOffset;
          }
          lastGetUpdatesAt = Date.now();
          inFlightGetUpdates++;
          try {
            const result = await prev(method, payload, signal);
            const updates = result as unknown as Array<{ update_id: number }>;
            if (Array.isArray(updates) && updates.length > 0) {
              const maxId = Math.max(...updates.map((u) => u.update_id));
              offsetStore.set(maxId + 1);
            }
            return result;
          } finally {
            inFlightGetUpdates = Math.max(0, inFlightGetUpdates - 1);
            lastGetUpdatesAt = Date.now();
          }
        }
        return prev(method, payload, signal);
      });

      try {
        await runner.task();

        if (stopped || abortController?.signal.aborted) return;

        const reason = stallDetected ? "stall" : "runner stopped";
        restartAttempts++;
        const delay = computeBackoff(restartAttempts);
        log.info({ reason, restartAttempts, delayMs: delay }, `polling cycle ended; restarting in ${delay}ms`);
        await sleep(delay);
      } catch (err) {
        if (stopped || abortController?.signal.aborted) return;

        const isConflict = isGetUpdatesConflict(err);
        const isNet = isNetworkError(err);

        if (isConflict) {
          log.warn("getUpdates 409 conflict; will retry after clearing webhook");
          try {
            await bot.api.deleteWebhook({ drop_pending_updates: true });
          } catch {
            // best effort
          }
        }

        if (!isConflict && !isNet) {
          log.error({ err }, "unhandled polling error");
          throw err;
        }

        restartAttempts++;
        const delay = computeBackoff(restartAttempts);
        const reason = isConflict ? "409 conflict" : "network error";
        log.info({ reason, restartAttempts, delayMs: delay }, `polling error; restarting in ${delay}ms`);
        await sleep(delay);
      } finally {
        clearInterval(watchdog);
        await gracefulStop(() => runner.stop());
        activeRunner = undefined;
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

type StreamingHandler = {
  onToken: (token: string) => void;
  flush: () => Promise<void>;
  finalize: (text: string) => Promise<void>;
};

function createStreamingHandler(
  mode: "partial" | "block" | "progress" | "off",
  chatId: number,
  replyFn: (text: string) => Promise<{ message_id: number }>,
  editFn: (chatId: number, messageId: number, text: string) => Promise<void>,
  deleteFn: (chatId: number, messageId: number) => Promise<void>,
  sendMessageFn?: (chatId: number, text: string) => Promise<{ message_id: number }>,
): StreamingHandler {
  if (mode === "off") {
    return {
      onToken: () => {},
      flush: async () => {},
      finalize: async (text) => { await replyFn(text); },
    };
  }

  if (mode === "progress") {
    let progressMsgId: number | undefined;
    let startTime = Date.now();
    let dots = 0;
    const timer = setInterval(async () => {
      dots = (dots + 1) % 4;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const text = `Thinking${".".repeat(dots + 1)}${elapsed}s`;
      try {
        if (!progressMsgId) {
          const msg = await replyFn(text);
          progressMsgId = msg.message_id;
        } else {
          await editFn(chatId, progressMsgId, text);
        }
      } catch {
        // ignore
      }
    }, 2000);
    timer.unref();

    return {
      onToken: () => {},
      flush: async () => {
        clearInterval(timer);
        if (progressMsgId) {
          try { await deleteFn(chatId, progressMsgId); } catch { /* ignore */ }
        }
      },
      finalize: async (text) => { await replyFn(text); },
    };
  }

  if (mode === "block") {
    let accumulated = "";
    let pendingBlocks: Promise<void> = Promise.resolve();
    let lastBlockMessageId: number | undefined;

    return {
      onToken: (token: string) => {
        accumulated += token;
        const newlineIdx = accumulated.indexOf("\n\n", accumulated.length - 5);
        if (newlineIdx === -1 && accumulated.length < 1500) return;

        const blockText = truncateMessage(accumulated.trim());
        if (!blockText) return;

        accumulated = "";

        pendingBlocks = pendingBlocks.then(async () => {
          try {
            const sendFn = sendMessageFn ?? (async (_cid: number, t: string) => replyFn(t));
            const msg = await sendFn(chatId, blockText);
            lastBlockMessageId = msg.message_id;
          } catch {
            // rate limit — skip block
          }
        });
      },
      flush: async () => { await pendingBlocks; },
      finalize: async (text) => {
        if (lastBlockMessageId) {
          try {
            await editFn(chatId, lastBlockMessageId, text);
          } catch {
            await replyFn(text);
          }
        } else {
          await replyFn(text);
        }
      },
    };
  }

  // mode === "partial" (default, original behavior)
  let lastEditTime = 0;
  let lastMessageId: number | undefined;
  let accumulated = "";
  let pendingEdits: Promise<void> = Promise.resolve();

  const flushEdit = async (text: string): Promise<void> => {
    const trimmed = truncateMessage(text);
    if (!trimmed.trim()) return;
    try {
      if (!lastMessageId) {
        const msg = await replyFn(trimmed);
        lastMessageId = msg.message_id;
      } else {
        await editFn(chatId, lastMessageId, trimmed);
      }
    } catch {
      // rate limit or message not modified — ignore
    }
  };

  return {
    onToken: (token: string) => {
      accumulated += token;
      const now = Date.now();
      if (now - lastEditTime < STREAM_EDIT_INTERVAL_MS) return;
      lastEditTime = now;
      pendingEdits = pendingEdits.then(() => flushEdit(accumulated));
    },
    flush: async () => { await pendingEdits; },
    finalize: async (text) => {
      if (lastMessageId) {
        await editFn(chatId, lastMessageId, text);
      } else {
        await replyFn(text);
      }
    },
  };
}
