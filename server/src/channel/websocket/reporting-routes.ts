import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson, readJsonObject, requireAuth, sendApiError } from "./middleware.js";
import { route, type Route } from "./routes.js";
import type { AuthService } from "./auth.js";
import type { IssueReporter } from "../../reporting/issue-reporter.js";

const VALID_PLATFORMS = ["server", "app", "web"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(value: string): value is Platform {
  return (VALID_PLATFORMS as readonly string[]).includes(value);
}

export interface ReportingRoutesDeps {
  authService: AuthService;
  issueReporter: IssueReporter;
}

export function createReportingRoutes(deps: ReportingRoutesDeps): Route[] {
  const { authService, issueReporter } = deps;

  async function handleReportError(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;

    const body = await readJsonObject(req, res);
    if (!body) return;

    const platform = body.platform as string;
    const version = body.version as string;
    const errorCode = body.errorCode as string;
    const message = body.message as string;

    if (!isValidPlatform(platform)) {
      sendApiError(res, 400, "invalid_platform", "Platform must be server, app, or web");
      return;
    }
    if (!errorCode || !message) {
      sendApiError(res, 400, "invalid_report", "errorCode and message are required");
      return;
    }

    const result = await issueReporter.report({
      platform,
      version: version ?? "unknown",
      errorCode,
      message,
      stackTrace: body.stackTrace as string | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });

    sendJson(res, 200, {
      ok: result.ok,
      issueNumber: result.issueNumber ?? null,
      issueUrl: result.issueUrl ?? null,
    });
  }

  return [route("/api/errors", "POST", handleReportError)];
}
