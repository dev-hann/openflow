import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger } from "../../utils/logger.js";
import type { MemoryStore } from "../../memory/index.js";
import type { PushTokenStore } from "../../notification/token-store.js";
import {
  sendJson,
  readJsonBody,
  readJsonObject,
  requireAuth,
  requireBodyString,
  sendApiError,
} from "./middleware.js";
import type { AuthService } from "./auth.js";
import type { SessionInfo } from "./protocol.js";
import { route, routePattern, type Route } from "./routes.js";

const log = createLogger("ws/session-routes");

const VALID_PLATFORMS = ["ios", "android", "web"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(value: string | undefined): value is Platform {
  return value !== undefined && (VALID_PLATFORMS as readonly string[]).includes(value);
}

export interface SessionRoutesDeps {
  authService: AuthService;
  memoryStore: MemoryStore;
  pushTokenStore: PushTokenStore;
}

function extractSessionId(path: string, prefix: string): string | null {
  const rest = path.slice(prefix.length);
  return rest && !rest.includes("/") ? rest : null;
}

function toDisplayMessages(
  messages: Array<{ role: string; content: string | null; createdAt: number }>,
) {
  return messages
    .filter((m) => !(m.role === "assistant" && (!m.content || m.content.trim() === "")))
    .map((m) => ({
      role: m.role,
      content: m.content ?? "",
      createdAt: m.createdAt,
    }));
}

function parseQueryInt(value: string | null, fallback: number, max?: number): number {
  const parsed = parseInt(value ?? String(fallback), 10);
  const result = Number.isNaN(parsed) ? fallback : parsed;
  return max !== undefined ? Math.min(result, max) : result;
}

export function createSessionRoutes(deps: SessionRoutesDeps): Route[] {
  const { authService, memoryStore, pushTokenStore } = deps;

  function handleSessionsList(req: IncomingMessage, res: ServerResponse): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const sessions = memoryStore.listSessions();
    const result: SessionInfo[] = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: memoryStore.getMessageCount(s.id),
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
    const sessionId = extractSessionId(path, "/api/sessions/");
    if (!sessionId) {
      sendApiError(res, 400, "session_id_required", "Session ID is required in the URL path");
      return;
    }
    memoryStore.deleteSession(sessionId);
    sendJson(res, 200, { ok: true });
  }

  function handleSessionMessages(req: IncomingMessage, res: ServerResponse, path: string): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const match = path.match(/^\/api\/sessions\/([^/]+)\/messages$/);
    if (!match) {
      sendApiError(res, 400, "session_id_required", "Invalid session messages URL format");
      return;
    }
    const sessionId = match[1]!;
    const parsedUrl = new URL(req.url ?? path, `http://${req.headers.host ?? "localhost"}`);
    const limit = parseQueryInt(parsedUrl.searchParams.get("limit"), 50, 200);
    const offset = parseQueryInt(parsedUrl.searchParams.get("offset"), 0);

    const { messages: rawMessages, total } = memoryStore.getVisibleMessages(
      sessionId,
      limit,
      offset,
    );
    const messages = toDisplayMessages(rawMessages);

    sendJson(res, 200, { messages, total });
  }

  async function handlePushTokenRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonObject(req, res);
    if (!body) return;
    const token = requireBodyString(body, "token");
    const platform = requireBodyString(body, "platform");
    const label = requireBodyString(body, "label");
    if (!token) {
      sendApiError(res, 400, "token_required", "Push token is required");
      return;
    }
    if (!isValidPlatform(platform)) {
      sendApiError(res, 400, "invalid_platform", "Platform must be ios, android, or web");
      return;
    }
    pushTokenStore.register(token, platform, label ?? "Unknown device");
    log.info({ platform, label }, "push token registered via API");
    sendJson(res, 200, { ok: true });
  }

  async function handlePushTokenUnregister(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonObject(req, res);
    if (!body) return;
    const token = requireBodyString(body, "token");
    if (!token) {
      sendApiError(res, 400, "token_required", "Push token is required");
      return;
    }
    const removed = pushTokenStore.unregister(token);
    sendJson(res, 200, { ok: removed });
  }

  return [
    route("/api/sessions", "GET", (req, res) => handleSessionsList(req, res)),
    route("/api/sessions", "POST", (req, res) => handleSessionCreate(req, res)),
    routePattern(/^\/api\/sessions\/[^/]+$/, "DELETE", (req, res, ctx) =>
      handleSessionDelete(req, res, ctx.path),
    ),
    routePattern(/^\/api\/sessions\/[^/]+\/messages$/, "GET", (req, res, ctx) =>
      handleSessionMessages(req, res, ctx.path),
    ),
    route("/api/push-tokens", "POST", (req, res) => handlePushTokenRegister(req, res)),
    route("/api/push-tokens", "DELETE", (req, res) => handlePushTokenUnregister(req, res)),
  ];
}
