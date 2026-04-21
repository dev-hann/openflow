import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger } from "../../utils/logger.js";
import type { MemoryStore } from "../../memory/index.js";
import type { PushTokenStore } from "../../notification/token-store.js";
import {
  sendJson,
  readJsonBody,
  readJsonObject,
  requireAuth,
} from "./middleware.js";
import type { AuthService } from "./auth.js";
import type { SessionInfo } from "./protocol.js";
import { route, routePattern, type Route } from "./routes.js";

const log = createLogger("ws/session-routes");

export interface SessionRoutesDeps {
  authService: AuthService;
  memoryStore: MemoryStore;
  pushTokenStore: PushTokenStore;
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

  async function handleSessionCreate(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonBody(req);
    const { title } = (body ?? {}) as { title?: string };
    const session = memoryStore.createSession(title ?? "New Chat");
    sendJson(res, 201, { id: session.id, title: session.title });
  }

  function handleSessionDelete(
    req: IncomingMessage,
    res: ServerResponse,
    path: string,
  ): void {
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

  function handleSessionMessages(
    req: IncomingMessage,
    res: ServerResponse,
    path: string,
  ): void {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const match = path.match(/^\/api\/sessions\/([^/]+)\/messages$/);
    if (!match) {
      sendJson(res, 400, { error: "session_id_required" });
      return;
    }
    const sessionId = match[1]!;
    const parsedUrl = new URL(
      req.url ?? path,
      `http://${req.headers.host ?? "localhost"}`,
    );
    const rawLimit = parseInt(parsedUrl.searchParams.get("limit") ?? "50", 10);
    const rawOffset = parseInt(parsedUrl.searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? 50 : rawLimit, 200);
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset;

    const { messages: rawMessages, total } = memoryStore.getVisibleMessages(
      sessionId,
      limit,
      offset,
    );
    const messages = rawMessages.map((m) => ({
      role: m.role,
      content: m.content ?? "",
      createdAt: m.createdAt,
    }));

    sendJson(res, 200, { messages, total });
  }

  async function handlePushTokenRegister(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonObject(req, res);
    if (!body) return;
    const token = body.token as string | undefined;
    const platform = body.platform as string | undefined;
    const label = body.label as string | undefined;
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

  async function handlePushTokenUnregister(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonObject(req, res);
    if (!body) return;
    const token = body.token as string | undefined;
    if (!token) {
      sendJson(res, 400, { error: "token_required" });
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
    route("/api/push-tokens", "POST", (req, res) =>
      handlePushTokenRegister(req, res),
    ),
    route("/api/push-tokens", "DELETE", (req, res) =>
      handlePushTokenUnregister(req, res),
    ),
  ];
}
