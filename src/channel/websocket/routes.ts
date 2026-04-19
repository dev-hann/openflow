import type { IncomingMessage, ServerResponse } from "node:http";
import { createLogger } from "../../utils/logger.js";
import type { AuthService } from "./auth.js";
import type { MemoryStore, ProviderStore, Provider } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { PushTokenStore } from "../../notification/token-store.js";
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

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "••••••••";
  return apiKey.slice(0, 4) + "••••" + apiKey.slice(-4);
}

function providerToJson(p: Provider, isActive: boolean) {
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: maskApiKey(p.apiKey),
    model: p.model,
    isDefault: p.isDefault,
    isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export interface RoutesDeps {
  authService: AuthService;
  memoryStore: MemoryStore;
  providerStore: ProviderStore;
  providerPool: ProviderPool;
  pushTokenStore: PushTokenStore;
  corsEnabled: boolean;
}

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

  function handleProvidersList(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const activeId = providerPool.getActiveProviderId();
    const providers = providerStore.listProviders().map((p) => providerToJson(p, p.id === activeId));
    sendJson(res, 200, { providers, activeProviderId: activeId });
  }

  async function handleProviderCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { name, baseUrl, apiKey, model, isDefault } = body as {
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      isDefault?: boolean;
    };
    if (!name || !baseUrl || !apiKey || !model) {
      sendJson(res, 400, { error: "name, baseUrl, apiKey, model are required" });
      return;
    }
    const provider = providerStore.addProvider({ name, baseUrl, apiKey, model, isDefault });
    providerPool.syncFromStore();
    if (isDefault) providerPool.switchProvider(provider.id);
    log.info({ providerId: provider.id, name }, "provider created via API");

    verifyProviderConnectivity(baseUrl, apiKey).then((verified) => {
      if (!verified) {
        log.warn({ providerId: provider.id, name }, "provider created but connectivity check failed");
      }
    }).catch(() => {});

    sendJson(res, 201, providerToJson(provider, provider.id === providerPool.getActiveProviderId()));
  }

  async function handleProviderUpdate(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.slice("/api/providers/".length);
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { name, baseUrl, apiKey, model } = body as {
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    };
    const updated = providerStore.updateProvider(providerId, { name, baseUrl, apiKey, model });
    if (!updated) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    providerPool.syncFromStore();
    log.info({ providerId }, "provider updated via API");
    sendJson(res, 200, providerToJson(updated, updated.id === providerPool.getActiveProviderId()));
  }

  function handleProviderDelete(req: IncomingMessage, res: ServerResponse, path: string): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.slice("/api/providers/".length);
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    providerStore.deleteProvider(providerId);
    providerPool.syncFromStore();
    log.info({ providerId }, "provider deleted via API");
    sendJson(res, 200, { ok: true });
  }

  async function handleProviderSwitch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { providerId } = body as { providerId?: string };
    if (!providerId) {
      sendJson(res, 400, { error: "providerId_required" });
      return;
    }
    const provider = providerStore.getProvider(providerId);
    if (!provider) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    providerPool.switchProvider(providerId);
    providerStore.setDefault(providerId);
    log.info({ providerId }, "provider switched via API");
    sendJson(res, 200, { providerId });
  }

  async function handleProviderVerify(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.match(/^\/api\/providers\/([^/]+)\/verify$/)?.[1];
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    const provider = providerStore.getProvider(providerId);
    if (!provider) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    try {
      const base = provider.baseUrl.replace(/\/$/, "");
      const resp = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) {
        sendJson(res, 200, { ok: false, error: `HTTP ${resp.status}` });
        return;
      }
      sendJson(res, 200, { ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 200, { ok: false, error: msg });
    }
  }

  async function handleProviderModels(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.match(/^\/api\/providers\/([^/]+)\/models$/)?.[1];
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    const provider = providerStore.getProvider(providerId);
    if (!provider) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    try {
      const base = provider.baseUrl.replace(/\/$/, "");
      const resp = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) {
        sendJson(res, resp.status, { error: `Failed to fetch models: HTTP ${resp.status}` });
        return;
      }
      const json = (await resp.json()) as { data?: Array<{ id: string }> };
      const models = (json.data ?? []).map((m) => m.id).sort();
      sendJson(res, 200, { models });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: msg });
    }
  }

  function handleStatus(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    sendJson(res, 200, { status: "ok" });
  }

  async function verifyProviderConnectivity(baseUrl: string, apiKey: string): Promise<boolean> {
    try {
      const base = baseUrl.replace(/\/$/, "");
      const resp = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async function handlePushTokenRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { token, platform, label } = body as { token?: string; platform?: string; label?: string };
    if (!token) {
      sendJson(res, 400, { error: "token_required" });
      return;
    }
    if (platform !== "ios" && platform !== "android" && platform !== "web") {
      sendJson(res, 400, { error: "platform must be ios, android, or web" });
      return;
    }
    pushTokenStore.register(token, platform, label ?? "Unknown device");
    log.info({ platform, label }, "push token registered via API");
    sendJson(res, 200, { ok: true });
  }

  async function handlePushTokenUnregister(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_body" });
      return;
    }
    const { token } = body as { token?: string };
    if (!token) {
      sendJson(res, 400, { error: "token_required" });
      return;
    }
    const removed = pushTokenStore.unregister(token);
    sendJson(res, 200, { ok: removed });
  }

  type RouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: { path: string; clientIp: string }) => Promise<void> | void;

  const routes: Array<{ match: (path: string, method: string) => boolean; handler: RouteHandler }> = [
    { match: (p, m) => p === "/api/auth/pair/init" && m === "POST", handler: (_req, res, ctx) => handlePairInit(_req, res, ctx.clientIp) },
    { match: (p, m) => p === "/api/auth/pair/verify" && m === "POST", handler: (_req, res, ctx) => handlePairVerify(_req, res, ctx.clientIp) },
    { match: (p, m) => p === "/api/auth/refresh" && m === "POST", handler: (_req, res, ctx) => handleRefresh(_req, res, ctx.clientIp) },
    { match: (p, m) => p === "/api/auth/unpair" && m === "DELETE", handler: (req, res) => handleUnpair(req, res) },
    { match: (p, m) => p === "/api/sessions" && m === "GET", handler: (req, res) => handleSessionsList(req, res) },
    { match: (p, m) => p === "/api/sessions" && m === "POST", handler: (req, res) => handleSessionCreate(req, res) },
    { match: (p, m) => p.startsWith("/api/sessions/") && m === "DELETE", handler: (req, res, ctx) => handleSessionDelete(req, res, ctx.path) },
    { match: (p, m) => p === "/api/providers" && m === "GET", handler: (req, res) => handleProvidersList(req, res) },
    { match: (p, m) => p === "/api/providers" && m === "POST", handler: (req, res) => handleProviderCreate(req, res) },
    { match: (p, m) => !!p.match(/^\/api\/providers\/[^/]+$/) && m === "PUT", handler: (req, res, ctx) => handleProviderUpdate(req, res, ctx.path) },
    { match: (p, m) => !!p.match(/^\/api\/providers\/[^/]+$/) && m === "DELETE", handler: (req, res, ctx) => handleProviderDelete(req, res, ctx.path) },
    { match: (p, m) => p === "/api/providers/current" && m === "PUT", handler: (req, res) => handleProviderSwitch(req, res) },
    { match: (p, m) => !!p.match(/^\/api\/providers\/[^/]+\/verify$/) && m === "POST", handler: (req, res, ctx) => handleProviderVerify(req, res, ctx.path) },
    { match: (p, m) => !!p.match(/^\/api\/providers\/[^/]+\/models$/) && m === "GET", handler: (req, res, ctx) => handleProviderModels(req, res, ctx.path) },
    { match: (p, m) => p === "/api/status" && m === "GET", handler: (req, res) => handleStatus(req, res) },
    { match: (p, m) => p === "/api/push-tokens" && m === "POST", handler: (req, res) => handlePushTokenRegister(req, res) },
    { match: (p, m) => p === "/api/push-tokens" && m === "DELETE", handler: (req, res) => handlePushTokenUnregister(req, res) },
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
