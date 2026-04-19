import { Bot, type Context, InlineKeyboard, InputFile } from "grammy";
import { run, type RunOptions } from "@grammyjs/runner";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { SETUP_SYSTEM_PROMPT } from "../agent/setup-prompt.js";
import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { withRetry, isRetryableNetworkError } from "../utils/retry.js";
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
import { executeCustomCommand, generateDescription, validateShellCommand, type CommandsConfig, type CustomCommand } from "../commands/custom-command.js";
import { updateCommands } from "../config/loader.js";
import type { ConfirmationHandler, ConfirmationResult } from "../tools/confirmation.js";

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
  notify?: {
    enabled: boolean;
    onStart: string;
    onStop: string;
  };
  customCommands?: CommandsConfig;
}

export interface TelegramChannel {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(chatId: number | string, text: string): Promise<void>;
  editMessage(chatId: number | string, messageId: number, text: string): Promise<void>;
  sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string): Promise<void>;
  notifyAll(message: string): Promise<void>;
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
  confirmationHandler?: ConfirmationHandler,
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
    if (config.allowedUsers.length === 0) {
      log.warn({ userId }, "no allowed users configured, denying all");
      return false;
    }
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

    let text =
      "OpenFlow — Personal AI Assistant\n\n" +
      "/new — Start a new session\n" +
      "/reset — Reset current session\n" +
      "/status — Show session info\n" +
      "/compact — Summarize and compact context\n" +
      "/history — Show recent messages\n" +
      "/model — Change LLM model\n" +
      "/cmd — Manage custom commands\n" +
      "/help — Show this help";

    if (activeCommands.size > 0) {
      text += "\n\nCustom commands:";
      for (const [name, cmd] of activeCommands) {
        text += `\n/${name} — ${generateDescription(cmd)}`;
      }
    }

    text += "\n\nSend any message to chat with the assistant.";

    await ctx.reply(text);
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

  const builtInCommands = new Set(["new", "reset", "help", "status", "compact", "history", "model", "cmd"]);
  const activeCommands = new Map<string, CustomCommand>();

  for (const [name, cmd] of Object.entries(config.customCommands ?? {})) {
    if (!builtInCommands.has(name)) {
      activeCommands.set(name, cmd);
    }
  }

  function registerCustomCommand(name: string): void {
    bot.command(name, async (ctx: Context) => {
      if (!ctx.msg) return;
      if (!isAllowed(ctx.msg.from?.id ?? 0)) return;

      const cmd = activeCommands.get(name);
      if (!cmd) {
        await ctx.reply(`/${name} has been removed.`);
        return;
      }

      const result = await executeCustomCommand(cmd);
      await ctx.reply(truncateMessage(result || "(no output)"));
    });
  }

  for (const name of activeCommands.keys()) {
    registerCustomCommand(name);
  }

  function persistCommands(): void {
    const obj: Record<string, CustomCommand> = {};
    for (const [k, v] of activeCommands) {
      obj[k] = v;
    }
    updateCommands(obj);
  }

  bot.command("cmd", async (ctx: Context) => {
    if (!ctx.msg) return;
    if (!isAllowed(ctx.msg.from?.id ?? 0)) return;

    const raw = (ctx.msg.text ?? "").replace(/^\/cmd@\w+\s*/, "/cmd ").trim();
    const parts = raw.split(/\s+/);
    const sub = parts[1]?.toLowerCase();

    if (sub === "list" || !sub) {
      if (activeCommands.size === 0) {
        await ctx.reply("No custom commands. Use:\n/cmd add <name> shell <command>\n/cmd add <name> reply <text>");
        return;
      }
      const lines = Array.from(activeCommands.entries()).map(
        ([name, cmd]) => `/${name} — ${generateDescription(cmd)}`,
      );
      await ctx.reply(`Custom commands:\n${lines.join("\n")}`);
      return;
    }

    if (sub === "add") {
      const name = parts[2]?.toLowerCase();
      const action = parts[3]?.toLowerCase();
      if (!name || !action) {
        await ctx.reply("Usage: /cmd add <name> shell <command>\n       /cmd add <name> reply <text>");
        return;
      }
      if (builtInCommands.has(name)) {
        await ctx.reply(`Cannot override built-in command: /${name}`);
        return;
      }
      if (!/^[a-z0-9_]{1,32}$/.test(name)) {
        await ctx.reply("Name must be 1-32 lowercase alphanumeric characters or underscores.");
        return;
      }
      if (action !== "shell" && action !== "reply") {
        await ctx.reply("Action must be 'shell' or 'reply'.");
        return;
      }
      const value = parts.slice(4).join(" ");
      if (!value) {
        await ctx.reply("Missing command/text value.");
        return;
      }
      const cmd: CustomCommand = {
        action: action as "shell" | "reply",
        timeout: 10_000,
      };
      if (action === "shell") {
        const validation = validateShellCommand(value);
        if (validation) {
          await ctx.reply(`⚠️ ${validation}`);
          return;
        }
        cmd.command = value;
      } else {
        cmd.text = value;
      }
      const isNew = !activeCommands.has(name);
      activeCommands.set(name, cmd);
      if (isNew) {
        registerCustomCommand(name);
      }
      persistCommands();
      await ctx.reply(`✅ /${name} ${isNew ? "added" : "updated"}: ${generateDescription(cmd)}`);
      log.info({ name, action }, "custom command added via /cmd");
      return;
    }

    if (sub === "remove" || sub === "delete") {
      const name = parts[2]?.toLowerCase();
      if (!name) {
        await ctx.reply("Usage: /cmd remove <name>");
        return;
      }
      if (!activeCommands.has(name)) {
        await ctx.reply(`/${name} not found.`);
        return;
      }
      activeCommands.delete(name);
      persistCommands();
      await ctx.reply(`✅ /${name} removed.`);
      log.info({ name }, "custom command removed via /cmd");
      return;
    }

    await ctx.reply("Unknown subcommand. Use:\n/cmd add <name> shell <command>\n/cmd add <name> reply <text>\n/cmd remove <name>\n/cmd list");
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
    memoryStore?.trackChatId(chatId);

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
      chatId,
    });

    await onToken.flush();

    const finalText = result.type === "text"
      ? truncateMessage(result.content || "(no response)")
      : errorPolicy.shouldShow(result.error.code ?? "UNKNOWN")
        ? truncateMessage(`Error: ${result.error.message}`)
        : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

    if (!finalText.trim()) return;

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
      memoryStore?.trackChatId(chatId);

      const result = await agentEngine.handleMessage({
        sessionId,
        userMessage: description,
      });

      const replyText = result.type === "text"
        ? truncateMessage(result.content || "(no response)")
        : errorPolicy.shouldShow(result.error.code ?? "UNKNOWN")
          ? truncateMessage(`Error: ${result.error.message}`)
          : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

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

  const pendingConfirmations = new Map<string, {
    resolve: (result: ConfirmationResult) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  bot.callbackQuery(/^confirm:([0-9a-f-]+):(approve|deny)$/, async (ctx) => {
    const match = /^confirm:([0-9a-f-]+):(approve|deny)$/.exec(ctx.callbackQuery.data ?? "");
    if (!match) { await ctx.answerCallbackQuery(); return; }

    const id = match[1];
    const action = match[2];
    if (!id || !action) { await ctx.answerCallbackQuery(); return; }
    const entry = pendingConfirmations.get(id);
    if (!entry) {
      await ctx.answerCallbackQuery({ text: "만료된 요청입니다" });
      return;
    }
    clearTimeout(entry.timer);
    pendingConfirmations.delete(id);
    entry.resolve({ approved: action === "approve" });
    await ctx.answerCallbackQuery({ text: action === "approve" ? "승인됨" : "거부됨" });
    try {
      const originalText = ctx.callbackQuery.message?.text ?? "";
      const suffix = action === "approve" ? "\n\n✅ 승인됨" : "\n\n❌ 거부됨";
      await ctx.editMessageText(truncateMessage(originalText + suffix));
    } catch {
      // message edit may fail, ignore
    }
  });

  if (confirmationHandler) {
    confirmationHandler.requestConfirmation = async (request) => {
      const id = crypto.randomUUID();
      const timeout = request.timeoutMs || 60_000;
      const argsPreview = formatToolArgsForConfirmation(request.toolName, request.toolArgs);
      const message =
        "⚠️ 확인이 필요한 작업입니다:\n\n" +
        `도구: ${request.toolName}\n` +
        `${argsPreview}\n\n` +
        "이 작업을 승인하시겠습니까?\n" +
        `(${Math.round(timeout / 1000)}초 내 응답이 없으면 자동 승인됩니다)`;

      const keyboard = new InlineKeyboard()
        .text("✅ 승인", `confirm:${id}:approve`)
        .text("❌ 거부", `confirm:${id}:deny`);

      try {
        await bot.api.sendMessage(Number(request.chatId), message, { reply_markup: keyboard });
      } catch (err) {
        log.error({ err, chatId: request.chatId }, "failed to send confirmation message");
        return { approved: true };
      }

      return new Promise<ConfirmationResult>((resolve) => {
        const timer = setTimeout(() => {
          pendingConfirmations.delete(id);
          log.info({ id, toolName: request.toolName }, "confirmation timed out, auto-denying");
          resolve({ approved: false });
        }, timeout);
        timer.unref();
        pendingConfirmations.set(id, { resolve, timer });
      });
    };
  }

  return {
    async start(): Promise<void> {
      try {
        const me = await withTimeout(bot.api.getMe(), GETME_TIMEOUT_MS, "getMe");
        log.info({ username: me.username }, "telegram bot connected");
      } catch (err) {
        const sanitized = (err instanceof Error ? err.message : String(err))
          .replace(/bot\d+:[a-zA-Z0-9_-]+/g, "bot***:***");
        throw new OpenFlowError(
          `Telegram authentication failed: ${sanitized}`,
          "TELEGRAM_AUTH_FAILED",
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
        const commands = [
          { command: "new", description: "Start a new session" },
          { command: "reset", description: "Reset current session" },
          { command: "status", description: "Show session info" },
          { command: "compact", description: "Compact conversation context" },
          { command: "history", description: "Show recent messages" },
          { command: "model", description: "Change LLM model" },
          { command: "help", description: "Show help" },
          { command: "cmd", description: "Manage custom commands" },
        ];
        for (const [name, cmd] of activeCommands) {
          commands.push({ command: name, description: generateDescription(cmd) });
        }
        await bot.api.setMyCommands(commands);
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
      await withRetry(() => bot.api.sendMessage(Number(chatId), truncateMessage(text)), {
        delays: [500, 1000, 2000],
        shouldRetry: (err) => {
          if (isRetryableNetworkError(err)) return true;
          if (err instanceof Error && /429|too many requests/i.test(err.message)) return true;
          return false;
        },
      });
    },

    async editMessage(chatId: number | string, messageId: number, text: string): Promise<void> {
      await withRetry(() => bot.api.editMessageText(Number(chatId), messageId, truncateMessage(text)), {
        delays: [500, 1000, 2000],
        shouldRetry: (err) => {
          if (isRetryableNetworkError(err)) return true;
          if (err instanceof Error && /429|too many requests/i.test(err.message)) return true;
          return false;
        },
      });
    },

    async sendPhoto(chatId: number | string, photo: string | Buffer, caption?: string): Promise<void> {
      const input = typeof photo === "string" ? photo : new InputFile(photo, "image.png");
      await bot.api.sendPhoto(Number(chatId), input, { caption: caption ? truncateMessage(caption) : undefined });
    },

    async notifyAll(message: string): Promise<void> {
      if (!config.notify?.enabled) return;
      const chatIds = memoryStore?.getChatIds() ?? [];
      if (chatIds.length === 0) return;
      log.info({ count: chatIds.length }, "notifyAll: sending notification");
      for (const chatId of chatIds) {
        try {
          await withRetry(() => bot.api.sendMessage(chatId, truncateMessage(message)), {
            delays: [500, 1000],
            shouldRetry: (err) => isRetryableNetworkError(err),
          });
        } catch (err) {
          log.warn({ err, chatId }, "notifyAll: failed to send to chat");
        }
      }
    },
  };

  async function startWebhook(): Promise<void> {
    const wh = config.webhook!;
    const host = wh.host ?? "127.0.0.1";
    const port = wh.port ?? 8787;

    await withRetry(() =>
      bot.api.setWebhook(wh.url!, {
        secret_token: wh.secret,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    );

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

function formatToolArgsForConfirmation(toolName: string, args: Record<string, unknown>): string {
  const preview = (s: string, max: number) => s.length <= max ? s : s.slice(0, max) + "...";
  switch (toolName) {
    case "shell":
      return `명령: ${preview(String(args.command ?? ""), 200)}`;
    case "write_file":
      return `경로: ${String(args.path ?? "")}\n내용: ${preview(String(args.content ?? ""), 100)}`;
    case "http_request":
      return `${String(args.method ?? "GET").toUpperCase()} ${String(args.url ?? "")}`;
    case "browser_execute":
      return `스크립트: ${preview(String(args.script ?? ""), 200)}`;
    default:
      return `인자: ${preview(JSON.stringify(args), 200)}`;
  }
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
