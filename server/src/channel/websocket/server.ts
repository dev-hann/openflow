import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { createLogger } from "../../utils/logger.js";
import { createAuthService, type AuthService } from "./auth.js";
import { createWsHandler } from "./ws-handler.js";
import { createRoutes } from "./routes.js";
import type { Channel } from "../types.js";
import type { AgentEngine } from "../../agent/index.js";
import type { MemoryStore, ProviderStore } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { PushTokenStore } from "../../notification/token-store.js";

const log = createLogger("ws/server");

const MAX_CONNECTIONS = 10;

export interface WebSocketChannelConfig {
  host: string;
  port: number;
  cors: boolean;
}

export interface WebSocketChannelDeps {
  agentEngine: AgentEngine;
  memoryStore: MemoryStore;
  providerStore: ProviderStore;
  providerPool: ProviderPool;
  pushTokenStore: PushTokenStore;
  createSession: (title: string) => { id: string };
}

export interface WebSocketChannel extends Channel {
  authService: AuthService;
  broadcastMessage(text: string): void;
}

export function createWebSocketChannel(
  config: WebSocketChannelConfig,
  deps: WebSocketChannelDeps,
): WebSocketChannel {
  const authService = createAuthService();

  const wsHandler = createWsHandler({
    authService,
    agentEngine: deps.agentEngine,
  });

  const routes = createRoutes({
    authService,
    memoryStore: deps.memoryStore,
    providerStore: deps.providerStore,
    providerPool: deps.providerPool,
    pushTokenStore: deps.pushTokenStore,
    corsEnabled: config.cors,
  });

  let server: Server | undefined;
  let wss: WebSocketServer | undefined;

  return {
    authService,

    broadcastMessage(text: string): void {
      wsHandler.broadcast("notification", { message: text });
    },

    async start(): Promise<void> {
      server = createServer((req: IncomingMessage, res: ServerResponse) => {
        routes(req, res).catch((err) => {
          log.error({ err }, "unhandled route error");
        });
      });

      wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

      server.on("upgrade", (req: IncomingMessage, socket, head) => {
        wss!.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          wss!.emit("connection", ws, req);
        });
      });

      wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
        if (wss!.clients.size > MAX_CONNECTIONS) {
          ws.close(1013, "too many connections");
          return;
        }
        wsHandler.handleConnection(ws);
      });

      await new Promise<void>((resolve) => {
        server!.listen(config.port, config.host, () => resolve());
      });

      log.info(
        { host: config.host, port: config.port },
        `WebSocket + HTTP server listening on ${config.host}:${config.port}`,
      );
    },

    async stop(): Promise<void> {
      if (wss) {
        for (const client of wss.clients) {
          client.close(1001, "server shutting down");
        }
        const shutdownTimeout = setTimeout(() => {
          log.warn("WS shutdown timed out, forcing close");
          for (const client of wss!.clients) {
            client.terminate();
          }
        }, 5_000);
        shutdownTimeout.unref();
        await new Promise<void>((resolve) =>
          wss!.close(() => {
            clearTimeout(shutdownTimeout);
            resolve();
          }),
        );
        wss = undefined;
      }
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
        server = undefined;
      }
      log.info("WebSocket server stopped");
    },
  };
}
