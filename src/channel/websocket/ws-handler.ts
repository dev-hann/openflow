import type { WebSocket } from "ws";
import { parseWsClientMessage, serializeWsServerMessage } from "./protocol.js";
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

  function handleConnection(ws: WebSocket): void {
    let authenticated = false;
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, "authentication timeout");
      }
    }, 10_000);
    authTimeout.unref();

    ws.on("message", (raw: Buffer) => {
      const text = raw.toString("utf-8");

      if (!authenticated) {
        try {
          const msg = JSON.parse(text) as Record<string, unknown>;
          if (msg.type === "auth" && typeof msg.accessToken === "string") {
            const payload = authService.validateAccessToken(msg.accessToken);
            if (payload) {
              authenticated = true;
              clearTimeout(authTimeout);
              const state: ClientState = {
                sessionKey: payload.sessionKey,
                activeSessionId: null,
              };
              clients.set(ws, state);
              ws.send(serializeWsServerMessage({ type: "auth_ok" }));
              log.info({ sessionKey: payload.sessionKey }, "WS client authenticated");

              ws.removeAllListeners("message");
              ws.on("message", (rawInner: Buffer) => {
                handleMessage(ws, state, rawInner.toString("utf-8")).catch((err) => {
                  log.error({ err }, "WS message handler error");
                });
              });
              return;
            }
          }
        } catch {
          log.debug({ text: text.slice(0, 100) }, "non-JSON message during auth");
        }
        ws.send(serializeWsServerMessage({ type: "auth_required" }));
        ws.close(4001, "authentication required");
        return;
      }
    });

    ws.on("close", () => {
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

  return { handleConnection, getConnectedCount };
}
