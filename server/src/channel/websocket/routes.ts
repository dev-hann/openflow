import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger } from "../../utils/logger.js";
import type { AuthService } from "./auth.js";
import type { MemoryStore, ProviderStore } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { PushTokenStore } from "../../notification/token-store.js";
import { sendJson, setCorsHeaders, handleOptions } from "./middleware.js";
import { createAuthRoutes } from "./auth-routes.js";
import { createProviderRoutes } from "./provider-routes.js";
import { createSessionRoutes } from "./session-routes.js";
import { createWebAuthRoutes } from "./web-auth-routes.js";
import { createReportingRoutes } from "./reporting-routes.js";
import type { WebAuthService } from "./web-auth.js";
import type { IssueReporter } from "../../reporting/issue-reporter.js";

const log = createLogger("ws/routes");

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: { path: string; clientIp: string },
) => Promise<void> | void;

export interface Route {
  match: (path: string, method: string) => boolean;
  handler: RouteHandler;
}

export function route(path: string, method: string, handler: RouteHandler): Route {
  return { match: (p, m) => p === path && m === method, handler };
}

export function routePattern(pattern: RegExp, method: string, handler: RouteHandler): Route {
  return { match: (p, m) => !!p.match(pattern) && m === method, handler };
}

export interface RoutesDeps {
  authService: AuthService;
  webAuthService: WebAuthService;
  memoryStore: MemoryStore;
  providerStore: ProviderStore;
  providerPool: ProviderPool;
  pushTokenStore: PushTokenStore;
  corsEnabled: boolean;
  issueReporter?: IssueReporter;
}

export function createRoutes(deps: RoutesDeps) {
  const { authService, webAuthService, memoryStore, providerStore, providerPool, pushTokenStore, corsEnabled } =
    deps;

  const authRoutes = createAuthRoutes({ authService });
  const webAuthRoutes = createWebAuthRoutes({ webAuthService, authService });
  const sessionRoutes = createSessionRoutes({ authService, memoryStore, pushTokenStore });
  const providerRoutes = createProviderRoutes({ authService, providerStore, providerPool });
  const reportingRoutes = deps.issueReporter
    ? createReportingRoutes({ authService, issueReporter: deps.issueReporter })
    : [];

  const routes: Route[] = [...authRoutes, ...webAuthRoutes, ...sessionRoutes, ...providerRoutes, ...reportingRoutes];

  return async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    setCorsHeaders(res, corsEnabled);
    if (handleOptions(req, res, corsEnabled)) return true;

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const isApi = url.pathname.startsWith("/api");

    try {
      for (const r of routes) {
        const method = req.method ?? "GET";
        if (r.match(url.pathname, method)) {
          const clientIp =
            (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
            req.socket.remoteAddress ??
            "unknown";
          await r.handler(req, res, { path: url.pathname, clientIp });
          return true;
        }
      }
      if (isApi) {
        sendJson(res, 404, { error: "not_found" });
      }
      return isApi;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "request body too large") {
        sendJson(res, 413, { error: "payload_too_large" });
        return true;
      }
      log.error({ err, path: url.pathname, method: req.method }, "route handler error");
      sendJson(res, 500, { error: "internal_error" });
      return true;
    }
  };
}
