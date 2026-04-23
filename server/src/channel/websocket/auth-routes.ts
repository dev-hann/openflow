import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson, readJsonObject, requireAuth, sendApiError, validateBody } from "./middleware.js";
import type { AuthService } from "./auth.js";
import { route, type Route } from "./routes.js";
import { PairVerifySchema, RefreshSchema } from "./auth-schemas.js";

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

  async function handlePairInit(
    _req: IncomingMessage,
    res: ServerResponse,
    clientIp: string,
  ): Promise<void> {
    if (!checkRateLimit(`pair_init:${clientIp}`)) {
      sendApiError(res, 429, "rate_limited", "Too many pairing requests. Please try again later.");
      return;
    }
    authService.createPairingPin();
    sendJson(res, 200, { expiresInMs: 300_000 });
  }

  async function handlePairVerify(
    req: IncomingMessage,
    res: ServerResponse,
    clientIp: string,
  ): Promise<void> {
    if (!checkRateLimit(`pair_verify:${clientIp}`)) {
      sendApiError(res, 429, "rate_limited", "Too many verification attempts. Please try again later.");
      return;
    }
    const body = await readJsonObject(req, res);
    if (!body) return;
    const parsed = validateBody(body, PairVerifySchema, res);
    if (!parsed) return;
    const tokens = authService.verifyPinAndIssueTokens(parsed.pin, parsed.label ?? "Unknown device");
    if (!tokens) {
      sendApiError(res, 401, "invalid_or_expired_pin", "PIN is invalid or has expired");
      return;
    }
    sendJson(res, 200, tokens);
  }

  async function handleRefresh(
    req: IncomingMessage,
    res: ServerResponse,
    clientIp: string,
  ): Promise<void> {
    if (!checkRateLimit(`refresh:${clientIp}`)) {
      sendApiError(res, 429, "rate_limited", "Too many refresh requests. Please try again later.");
      return;
    }
    const body = await readJsonObject(req, res);
    if (!body) return;
    const parsed = validateBody(body, RefreshSchema, res);
    if (!parsed) return;
    const tokens = authService.refreshTokens(parsed.refreshToken);
    if (!tokens) {
      sendApiError(res, 401, "invalid_refresh_token", "Refresh token is invalid or has been rotated");
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
    route("/api/auth/pair/verify", "POST", (req, res, ctx) =>
      handlePairVerify(req, res, ctx.clientIp),
    ),
    route("/api/auth/refresh", "POST", (req, res, ctx) => handleRefresh(req, res, ctx.clientIp)),
    route("/api/auth/unpair", "DELETE", (req, res) => handleUnpair(req, res)),
    route("/api/status", "GET", (req, res) => handleStatus(req, res)),
  ];
}
