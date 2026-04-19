import type { IncomingMessage, ServerResponse } from "node:http";
import { createLogger } from "../../utils/logger.js";
import type { AuthService } from "./auth.js";
import type { MemoryStore } from "../../memory/index.js";
import {
  sendJson,
  readJsonBody,
  requireAuth,
  setCorsHeaders,
  handleOptions,
} from "./middleware.js";
import type { SessionInfo } from "./protocol.js";

const log = createLogger("ws/routes");

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

export interface RoutesDeps {
  authService: AuthService;
  memoryStore: MemoryStore;
  availableModels?: string[];
  currentModel?: string;
  onModelChange?: (model: string) => void;
  corsEnabled: boolean;
}

export function createRoutes(deps: RoutesDeps) {
  const { authService, memoryStore, availableModels, currentModel, onModelChange, corsEnabled } = deps;

  const authAttempts = new Map<string, { count: number; resetAt: number }>();

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

  function handleSessionsList(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const sessions = memoryStore.listSessions();
    const result: SessionInfo[] = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: memoryStore.getMessages(s.id).length,
    }));
    sendJson(res, 200, { sessions: result });
  }

  async function handleSessionCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonBody(req);
    const { title } = (body ?? {}) as { title?: string };
    const session = memoryStore.createSession(title ?? "New Chat");
    sendJson(res, 201, { id: session.id, title: session.title });
  }

  function handleSessionDelete(req: IncomingMessage, res: ServerResponse, path: string): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const sessionId = path.slice("/api/sessions/".length);
    if (!sessionId) {
      sendJson(res, 400, { error: "session_id_required" });
      return;
    }
    memoryStore.deleteSession(sessionId);
    sendJson(res, 200, { ok: true });
  }

  function handleModelsList(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    sendJson(res, 200, {
      models: availableModels ?? [],
      current: currentModel ?? "",
    });
  }

  async function handleModelUpdate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { model } = body as { model?: string };
    if (!model) {
      sendJson(res, 400, { error: "model_required" });
      return;
    }
    onModelChange?.(model);
    sendJson(res, 200, { model });
  }

  function handleStatus(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    sendJson(res, 200, { status: "ok" });
  }

  return async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    setCorsHeaders(res, corsEnabled);
    if (handleOptions(req, res, corsEnabled)) return;

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;
    const method = req.method ?? "GET";
    const clientIp = req.socket.remoteAddress ?? "unknown";

    try {
      if (path === "/api/auth/pair/init" && method === "POST") {
        await handlePairInit(req, res, clientIp);
        return;
      }

      if (path === "/api/auth/pair/verify" && method === "POST") {
        await handlePairVerify(req, res, clientIp);
        return;
      }

      if (path === "/api/auth/refresh" && method === "POST") {
        await handleRefresh(req, res, clientIp);
        return;
      }

      if (path === "/api/auth/unpair" && method === "DELETE") {
        handleUnpair(req, res);
        return;
      }

      if (path === "/api/sessions" && method === "GET") {
        handleSessionsList(req, res);
        return;
      }

      if (path === "/api/sessions" && method === "POST") {
        await handleSessionCreate(req, res);
        return;
      }

      if (path.startsWith("/api/sessions/") && method === "DELETE") {
        handleSessionDelete(req, res, path);
        return;
      }

      if (path === "/api/models" && method === "GET") {
        handleModelsList(req, res);
        return;
      }

      if (path === "/api/models/current" && method === "PUT") {
        await handleModelUpdate(req, res);
        return;
      }

      if (path === "/api/status" && method === "GET") {
        handleStatus(req, res);
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (err) {
      if (err instanceof Error && err.message === "request body too large") {
        sendJson(res, 413, { error: "payload_too_large" });
        return;
      }
      log.error({ err, path, method }, "route handler error");
      sendJson(res, 500, { error: "internal_error" });
    }
  };
}
