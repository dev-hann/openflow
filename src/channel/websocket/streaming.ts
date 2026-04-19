import type { WebSocket } from "ws";
import { serializeWsServerMessage, type WsServerMessage } from "./protocol.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("ws/streaming");

export interface StreamingContext {
  send(msg: WsServerMessage): void;
}

export function createStreamingContext(ws: WebSocket, _sessionId: string): StreamingContext {
  function send(msg: WsServerMessage): void {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(serializeWsServerMessage(msg));
  }

  return { send };
}

export function createStreamingTokenHandler(
  ws: WebSocket,
  sessionId: string,
): (token: string) => void {
  return (token: string) => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(
      serializeWsServerMessage({
        type: "token",
        sessionId,
        content: token,
      }),
    );
  };
}

export function sendFinalResponse(ws: WebSocket, sessionId: string, content: string): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(
    serializeWsServerMessage({
      type: "response",
      sessionId,
      content,
    }),
  );
}

export function sendError(
  ws: WebSocket,
  code: string,
  message: string,
  sessionId?: string,
): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(
    serializeWsServerMessage({
      type: "error",
      sessionId,
      code,
      message,
    }),
  );
  log.debug({ code, sessionId }, "WS error sent");
}
