import type { IncomingMessage, ServerResponse } from "node:http";
import { createLogger } from "../../utils/logger.js";
import type { AuthService } from "./auth.js";
import type { MemoryStore, ProviderStore } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { PushTokenStore } from "../../notification/token-store.js";
import {
  sendJson,
  readJsonBody,
  requireAuth,
  setCorsHeaders,
  handleOptions,
} from "./middleware.js";
import { createProviderRoutes } from "./provider-routes.js";
import { createSessionRoutes } from "./session-routes.js";

const log = createLogger("ws/routes");

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

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

  const authAttempts = new Map<string, { count: number; resetAt: number }>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of authAttempts) {
      if (now > entry.resetAt) authAttempts.delete(key);
    }
  }, RATE_LIMIT_WINDOW_MS);
  cleanupInterval.unref();

  function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = authAttempts.get(key);
    if (!entry || now > entry.resetAt) {
      authAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX_REQUESTS) return false;
    return true;
  }

  async function handlePairInit(_req: IncomingMessage, res: ServerResponse, clientIp: string): Promise<void> {
    if (!checkRateLimit(`pair_init:${clientIp}`)) {
      sendJson(res, 429, { error: "rate_limited" });
      return;
    }
    authService.createPairingPin();
    sendJson(res, 200, { expiresInMs: 300_000 });
  }

  async function handlePairVerify(req: IncomingMessage, res: ServerResponse, clientIp: string): Promise<void> {
    if (!checkRateLimit(`pair_verify:${clientIp}`)) {
      sendJson(res, 429, { error: "rate_limited" });
      return;
    }
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { pin, label } = body as { pin?: string; label?: string };
    if (!pin) {
      sendJson(res, 400, { error: "pin_required" });
      return;
    }
    const tokens = authService.verifyPinAndIssueTokens(pin, label ?? "Unknown device");
    if (!tokens) {
      sendJson(res, 401, { error: "invalid_or_expired_pin" });
      return;
    }
    sendJson(res, 200, tokens);
  }

  async function handleRefresh(req: IncomingMessage, res: ServerResponse, clientIp: string): Promise<void> {
    if (!checkRateLimit(`refresh:${clientIp}`)) {
      sendJson(res, 429, { error: "rate_limited" });
      return;
    }
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { refreshToken } = body as { refreshToken?: string };
    if (!refreshToken) {
      sendJson(res, 400, { error: "refresh_token_required" });
      return;
    }
    const tokens = authService.refreshTokens(refreshToken);
    if (!tokens) {
      sendJson(res, 401, { error: "invalid_refresh_token" });
      return;
    }
    sendJson(res, 200, tokens);
  }

  function handleUnpair(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    authService.unpair(auth.sessionKey);
    sendJson(res, 200, { ok: true });
  }

  function handleStatus(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    sendJson(res, 200, { status: "ok" });
  }

  const sessionRoutes = createSessionRoutes({ authService, memoryStore, pushTokenStore });
  const providerRoutes = createProviderRoutes({ authService, providerStore, providerPool });

  const routes: Array<{ match: (path: string, method: string) => boolean; handler: RouteHandler }> = [
    { match: (p, m) => p === "/api/auth/pair/init" && m === "POST", handler: (_req, res, ctx) => handlePairInit(_req, res, ctx.clientIp) },
    { match: (p, m) => p === "/api/auth/pair/verify" && m === "POST", handler: (_req, res, ctx) => handlePairVerify(_req, res, ctx.clientIp) },
    { match: (p, m) => p === "/api/auth/refresh" && m === "POST", handler: (_req, res, ctx) => handleRefresh(_req, res, ctx.clientIp) },
    { match: (p, m) => p === "/api/auth/unpair" && m === "DELETE", handler: (req, res) => handleUnpair(req, res) },
    ...sessionRoutes,
    ...providerRoutes,
    { match: (p, m) => p === "/api/status" && m === "GET", handler: (req, res) => handleStatus(req, res) },
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
