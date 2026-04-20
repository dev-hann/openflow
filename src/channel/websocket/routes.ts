import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger } from "../../utils/logger.js";
import type { AuthService } from "./auth.js";
import type { MemoryStore, ProviderStore } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { PushTokenStore } from "../../notification/token-store.js";
import {
  sendJson,
  setCorsHeaders,
  handleOptions,
} from "./middleware.js";
import { createAuthRoutes } from "./auth-routes.js";
import { createProviderRoutes } from "./provider-routes.js";
import { createSessionRoutes } from "./session-routes.js";

const log = createLogger("ws/routes");

export interface RoutesDeps {
  authService: AuthService;
  memoryStore: MemoryStore;
  providerStore: ProviderStore;
  providerPool: ProviderPool;
  pushTokenStore: PushTokenStore;
  corsEnabled: boolean;
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: { path: string; clientIp: string }) => Promise<void> | void;

export function createRoutes(deps: RoutesDeps) {
  const { authService, memoryStore, providerStore, providerPool, pushTokenStore, corsEnabled } = deps;

  const authRoutes = createAuthRoutes({ authService });
  const sessionRoutes = createSessionRoutes({ authService, memoryStore, pushTokenStore });
  const providerRoutes = createProviderRoutes({ authService, providerStore, providerPool });

  const routes: Array<{ match: (path: string, method: string) => boolean; handler: RouteHandler }> = [
    ...authRoutes,
    ...sessionRoutes,
    ...providerRoutes,
  ];

  async function dispatchRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;
    const method = req.method ?? "GET";
    const clientIp = req.socket.remoteAddress ?? "unknown";

    for (const route of routes) {
      if (route.match(path, method)) {
        await route.handler(req, res, { path, clientIp });
        return;
      }
    }
    sendJson(res, 404, { error: "not_found" });
  }

  return async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    setCorsHeaders(res, corsEnabled);
    if (handleOptions(req, res, corsEnabled)) return;

    try {
      await dispatchRequest(req, res);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "request body too large") {
        sendJson(res, 413, { error: "payload_too_large" });
        return;
      }
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      log.error({ err, path: url.pathname, method: req.method }, "route handler error");
      sendJson(res, 500, { error: "internal_error" });
    }
  };
}
