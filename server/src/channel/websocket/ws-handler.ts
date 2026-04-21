import type { WebSocket } from "ws";

import {
  parseWsClientMessage,
  serializeWsServerMessage,
  type WsServerMessage,
} from "./protocol.js";
import { createStreamingTokenHandler, sendError, sendFinalResponse } from "./streaming.js";
import type { AuthService } from "./auth.js";
import type { AgentEngine } from "../../agent/index.js";
import { createLogger } from "../../utils/logger.js";
import { SETUP_SYSTEM_PROMPT } from "../../agent/setup-prompt.js";

const log = createLogger("ws/handler");

export interface WsHandlerDeps {
  authService: AuthService;
  agentEngine: AgentEngine;
}

interface ClientState {
  sessionKey: string;
  activeSessionId: string | null;
}

export function createWsHandler(deps: WsHandlerDeps) {
  const { authService, agentEngine } = deps;
  const clients = new Map<WebSocket, ClientState>();

  function tryAuthenticate(text: string): ClientState | null {
    try {
      const msg = JSON.parse(text) as Record<string, unknown>;
      if (msg.type === "auth" && typeof msg.accessToken === "string") {
        const payload = authService.validateAccessToken(msg.accessToken);
        if (payload) {
          return { sessionKey: payload.sessionKey, activeSessionId: null };
        }
      }
    } catch {
      log.debug({ text: text.slice(0, 100) }, "non-JSON message during auth");
    }
    return null;
  }

  function handleConnection(ws: WebSocket): void {
    let authenticated = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, "authentication timeout");
      }
    }, 10_000);
    authTimeout.unref();

    function onAuthMessage(raw: Buffer): void {
      if (authenticated) return;

      const text = raw.toString("utf-8");
      const state = tryAuthenticate(text);
      if (!state) {
        ws.send(serializeWsServerMessage({ type: "auth_required" }));
        ws.close(4001, "authentication required");
        return;
      }

      authenticated = true;
      clearTimeout(authTimeout);
      clients.set(ws, state);
      ws.send(serializeWsServerMessage({ type: "auth_ok" }));
      log.info({ sessionKey: state.sessionKey }, "WS client authenticated");

      ws.off("message", onAuthMessage);
      ws.on("message", (rawInner: Buffer) => {
        handleMessage(ws, state, rawInner.toString("utf-8")).catch((err) => {
          log.error({ err }, "WS message handler error");
        });
      });

      heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
        }
      }, 30_000);
      heartbeat.unref();
    }

    ws.on("message", onAuthMessage);

    ws.on("close", () => {
      if (heartbeat) clearInterval(heartbeat);
      const clientState = clients.get(ws);
      clients.delete(ws);
      if (clientState) {
        log.info({ sessionKey: clientState.sessionKey }, "WS client disconnected");
      }
    });

    ws.on("error", (err) => {
      log.error({ err }, "WS client error");
      clients.delete(ws);
    });
  }

  async function handleMessage(ws: WebSocket, state: ClientState, raw: string): Promise<void> {
    const msg = parseWsClientMessage(raw);
    if (!msg) {
      sendError(ws, "INVALID_MESSAGE", "Could not parse message");
      return;
    }

    switch (msg.type) {
      case "ping":
        ws.send(serializeWsServerMessage({ type: "pong" }));
        break;

      case "switch_session":
        state.activeSessionId = msg.sessionId;
        ws.send(serializeWsServerMessage({ type: "session_switched", sessionId: msg.sessionId }));
        log.info({ sessionId: msg.sessionId }, "session switched");
        break;

      case "message":
        await handleChatMessage(ws, state, msg.content, msg.sessionId);
        break;
    }
  }

  async function handleChatMessage(
    ws: WebSocket,
    state: ClientState,
    content: string,
    sessionIdOverride?: string,
  ): Promise<void> {
    const sessionId = sessionIdOverride ?? state.activeSessionId;
    if (!sessionId) {
      sendError(ws, "NO_SESSION", "No active session. Create or select a session first.");
      return;
    }

    const workspace = agentEngine.getWorkspace();
    const setupMode = !workspace.hasPersona();
    const systemPromptOverride = setupMode ? SETUP_SYSTEM_PROMPT : undefined;

    const onToken = createStreamingTokenHandler(ws, sessionId);

    const result = await agentEngine.handleMessage({
      sessionId,
      userMessage: content,
      onToken,
      systemPromptOverride,
      chatId: state.sessionKey,
    });

    if (result.type === "text") {
      sendFinalResponse(ws, sessionId, result.content);
    } else {
      sendError(ws, result.error.code ?? "UNKNOWN", result.error.message, sessionId);
    }
  }

  function getConnectedCount(): number {
    return clients.size;
  }

  function broadcast(type: string, payload: Record<string, unknown>): void {
    const msg = serializeWsServerMessage({ type, ...payload } as WsServerMessage);
    for (const client of clients.keys()) {
      if (client.readyState === client.OPEN) {
        client.send(msg);
      }
    }
  }

  return { handleConnection, getConnectedCount, broadcast };
}
