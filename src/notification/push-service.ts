import { Expo } from "expo-server-sdk";
import { createLogger } from "../utils/logger.js";
import type { PushTicket, PushMessage } from "./types.js";
import type { PushTokenStore } from "./token-store.js";

const log = createLogger("notification/push");

export interface ExpoPushConfig {
  enabled: boolean;
}

interface PushService {
  send(message: PushMessage): Promise<PushTicket>;
  sendAll(messages: PushMessage[]): Promise<PushTicket[]>;
}

export interface NotificationService extends PushService {
  notifyAll(title: string, body: string, data?: Record<string, unknown>): Promise<void>;
}

export function createNotificationService(
  config: ExpoPushConfig,
  tokenStore: PushTokenStore,
): NotificationService {
  if (!config.enabled) {
    return {
      async send() {
        log.debug("push notifications disabled");
        return { id: "disabled", status: "ok" };
      },
      async sendAll() {
        return [];
      },
      async notifyAll() {
        log.debug("push notifications disabled");
      },
    };
  }

  const expo = new Expo();

  async function send(message: PushMessage): Promise<PushTicket> {
    if (!Expo.isExpoPushToken(message.to)) {
      log.warn({ token: String(message.to).slice(0, 8) + "..." }, "invalid Expo push token");
      return { id: "invalid", status: "error", message: "Invalid Expo push token" };
    }

    try {
      const chunks = expo.chunkPushNotifications([
        {
          to: message.to,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: message.sound ?? "default",
          badge: message.badge,
        },
      ]);

      const tickets: PushTicket[] = [];
      for (const chunk of chunks) {
        const ticketResults = await expo.sendPushNotificationsAsync(chunk);
        for (const r of ticketResults) {
          if (r.status === "error") {
            log.error({ details: r.details, message: r.message }, "push notification error");
            if (r.details?.error === "DeviceNotRegistered") {
              tokenStore.unregister(message.to);
            }
          }
          const id = r.status === "ok" ? r.id : "unknown";
          tickets.push({
            id: id ?? "unknown",
            status: r.status as "ok" | "error",
            message: r.status === "error" ? r.message : undefined,
            details: r.status === "error" ? r.details as { error?: string } | undefined : undefined,
          });
        }
      }

      tokenStore.touchLastUsed(message.to);
      return tickets[0] ?? { id: "no-ticket", status: "ok" };
    } catch (err) {
      log.error({ err }, "failed to send push notification");
      return {
        id: "error",
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function sendAll(messages: PushMessage[]): Promise<PushTicket[]> {
    if (messages.length === 0) return [];
    const results = await Promise.all(messages.map(send));
    return results;
  }

  async function notifyAll(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const tokens = tokenStore.getAll();
    if (tokens.length === 0) {
      log.debug("no push tokens registered, skipping broadcast");
      return;
    }

    log.info({ count: tokens.length }, "broadcasting push notification");
    const messages: PushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data,
    }));
    await sendAll(messages);
  }

  return { send, sendAll, notifyAll };
}
