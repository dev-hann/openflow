import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson, readJsonObject, requireAuth, requireBodyString } from "./middleware.js";
import type { WebAuthService } from "./web-auth.js";
import { route, routePattern, type Route } from "./routes.js";

export interface WebAuthRoutesDeps {
  webAuthService: WebAuthService;
  authService: import("./auth.js").AuthService;
}

export function createWebAuthRoutes(deps: WebAuthRoutesDeps): Route[] {
  const { webAuthService, authService } = deps;

  function handleWebInit(_req: IncomingMessage, res: ServerResponse): void {
    const result = webAuthService.createSession();
    sendJson(res, 200, result);
  }

  async function handleWebApprove(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;

    const body = await readJsonObject(req, res);
    if (!body) return;

    const sessionId = requireBodyString(body, "sessionId");
    if (!sessionId || !/^[a-f0-9]{32}$/.test(sessionId)) {
      sendJson(res, 400, { error: "invalid_session_id" });
      return;
    }

    const tokens = webAuthService.approveSession(sessionId);
    if (!tokens) {
      sendJson(res, 404, { error: "session_not_found_or_expired" });
      return;
    }

    sendJson(res, 200, { ok: true });
  }

  function handleWebStatus(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const match = url.pathname.match(/^\/api\/auth\/web\/status\/([a-f0-9]{32})$/);
    if (!match) {
      sendJson(res, 400, { error: "invalid_session_id" });
      return;
    }

    const sessionId = match[1]!;
    const result = webAuthService.getStatus(sessionId);

    if (result.status === "approved" && result.tokens) {
      sendJson(res, 200, { status: "approved", ...result.tokens });
    } else {
      sendJson(res, 200, { status: result.status });
    }
  }

  return [
    route("/api/auth/web/init", "POST", (req, res) => handleWebInit(req, res)),
    route("/api/auth/web/approve", "POST", (req, res) => handleWebApprove(req, res)),
    routePattern(/^\/api\/auth\/web\/status\/[a-f0-9]{32}$/, "GET", (req, res) =>
      handleWebStatus(req, res),
    ),
  ];
}
