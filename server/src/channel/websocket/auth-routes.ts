import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson, readJsonObject, requireAuth } from "./middleware.js";
import type { AuthService } from "./auth.js";
import { route, type Route } from "./routes.js";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

export interface AuthRoutesDeps {
  authService: AuthService;
}

function createRateLimiter() {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now > entry.resetAt) attempts.delete(key);
    }
  }, RATE_LIMIT_WINDOW_MS);
  cleanupInterval.unref();

  function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || now > entry.resetAt) {
      attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX_REQUESTS) return false;
    return true;
  }

  return { checkRateLimit };
}

export function createAuthRoutes(deps: AuthRoutesDeps): Route[] {
  const { authService } = deps;
  const { checkRateLimit } = createRateLimiter();

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
    const body = await readJsonObject(req, res);
    if (!body) return;
    const pin = body.pin as string | undefined;
    const label = body.label as string | undefined;
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
    const body = await readJsonObject(req, res);
    if (!body) return;
    const refreshToken = body.refreshToken as string | undefined;
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

  return [
    route("/api/auth/pair/init", "POST", (req, res, ctx) => handlePairInit(req, res, ctx.clientIp)),
    route("/api/auth/pair/verify", "POST", (req, res, ctx) => handlePairVerify(req, res, ctx.clientIp)),
    route("/api/auth/refresh", "POST", (req, res, ctx) => handleRefresh(req, res, ctx.clientIp)),
    route("/api/auth/unpair", "DELETE", (req, res) => handleUnpair(req, res)),
    route("/api/status", "GET", (req, res) => handleStatus(req, res)),
  ];
}
