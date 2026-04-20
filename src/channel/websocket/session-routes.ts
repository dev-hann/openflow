import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger } from "../../utils/logger.js";
import type { MemoryStore } from "../../memory/index.js";
import type { PushTokenStore } from "../../notification/token-store.js";
import { sendJson, readJsonBody, requireAuth } from "./middleware.js";
import type { AuthService } from "./auth.js";
import type { SessionInfo } from "./protocol.js";

const log = createLogger("ws/session-routes");

export interface SessionRoutesDeps {
  authService: AuthService;
  memoryStore: MemoryStore;
  pushTokenStore: PushTokenStore;
}

export function createSessionRoutes(deps: SessionRoutesDeps) {
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

  return [
    { match: (p: string, m: string) => p === "/api/sessions" && m === "GET", handler: (req: IncomingMessage, res: ServerResponse) => handleSessionsList(req, res) },
    { match: (p: string, m: string) => p === "/api/sessions" && m === "POST", handler: (req: IncomingMessage, res: ServerResponse) => handleSessionCreate(req, res) },
    { match: (p: string, m: string) => p.startsWith("/api/sessions/") && m === "DELETE", handler: (req: IncomingMessage, res: ServerResponse, ctx: { path: string; clientIp: string }) => handleSessionDelete(req, res, ctx.path) },
    { match: (p: string, m: string) => p === "/api/push-tokens" && m === "POST", handler: (req: IncomingMessage, res: ServerResponse) => handlePushTokenRegister(req, res) },
    { match: (p: string, m: string) => p === "/api/push-tokens" && m === "DELETE", handler: (req: IncomingMessage, res: ServerResponse) => handlePushTokenUnregister(req, res) },
  ];
}
