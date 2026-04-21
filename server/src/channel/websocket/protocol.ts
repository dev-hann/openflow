import { createLogger } from "../../utils/logger.js";
import type { components } from "../../generated/api.js";

const log = createLogger("ws/protocol");

export interface WsChatMessage {
  type: "message";
  sessionId?: string;
  content: string;
}

export interface WsSwitchSession {
  type: "switch_session";
  sessionId: string;
}

export interface WsPing {
  type: "ping";
}

export type WsClientMessage = WsChatMessage | WsSwitchSession | WsPing;

export interface WsTokenChunk {
  type: "token";
  sessionId: string;
  content: string;
}

export interface WsResponse {
  type: "response";
  sessionId: string;
  content: string;
}

export interface WsError {
  type: "error";
  sessionId?: string;
  code: string;
  message: string;
}

export interface WsAuthRequired {
  type: "auth_required";
}

export interface WsAuthOk {
  type: "auth_ok";
}

export interface WsSessionSwitched {
  type: "session_switched";
  sessionId: string;
}

export interface WsPong {
  type: "pong";
}

export interface WsNotification {
  type: "notification";
  message: string;
}

export type WsServerMessage =
  | WsTokenChunk
  | WsResponse
  | WsError
  | WsAuthRequired
  | WsAuthOk
  | WsSessionSwitched
  | WsPong
  | WsNotification;

export type SessionInfo = components["schemas"]["SessionInfo"];

export function parseWsClientMessage(raw: string): WsClientMessage | null {
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    if (typeof msg.type !== "string") return null;
    switch (msg.type) {
      case "message":
        if (typeof msg.content !== "string") return null;
        return {
          type: "message",
          sessionId: typeof msg.sessionId === "string" ? msg.sessionId : undefined,
          content: msg.content,
        };
      case "switch_session":
        if (typeof msg.sessionId !== "string") return null;
        return { type: "switch_session", sessionId: msg.sessionId };
      case "ping":
        return { type: "ping" };
      default:
        return null;
    }
  } catch {
    log.debug("failed to parse WebSocket client message");
    return null;
  }
}

export function serializeWsServerMessage(msg: WsServerMessage): string {
  return JSON.stringify(msg);
}
