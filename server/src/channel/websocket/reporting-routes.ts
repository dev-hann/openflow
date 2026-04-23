import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson, readJsonObject, requireAuth, getBodyString, sendApiError } from "./middleware.js";
import { route, type Route } from "./routes.js";
import type { AuthService } from "./auth.js";
import type { IssueReporter } from "../../reporting/issue-reporter.js";

const VALID_PLATFORMS = ["server", "app", "web"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(value: string | undefined): value is Platform {
  return value !== undefined && (VALID_PLATFORMS as readonly string[]).includes(value);
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

    const platform = getBodyString(body, "platform");
    const version = getBodyString(body, "version");
    const errorCode = getBodyString(body, "errorCode");
    const message = getBodyString(body, "message");

    if (!isValidPlatform(platform)) {
      sendApiError(res, 400, "invalid_platform", "Platform must be server, app, or web");
      return;
    }
    if (!errorCode || !message) {
      sendApiError(res, 400, "invalid_report", "errorCode and message are required");
      return;
    }

    const stackTraceVal = body.stackTrace;
    const metadataVal = body.metadata;

    const result = await issueReporter.report({
      platform,
      version: version ?? "unknown",
      errorCode,
      message,
      stackTrace: typeof stackTraceVal === "string" ? stackTraceVal : undefined,
      metadata:
        metadataVal && typeof metadataVal === "object" && !Array.isArray(metadataVal) && metadataVal !== null
          ? (metadataVal as Record<string, unknown>)
          : undefined,
    });

    sendJson(res, 200, {
      ok: result.ok,
      issueNumber: result.issueNumber ?? null,
      issueUrl: result.issueUrl ?? null,
    });
  }

  return [route("/api/errors", "POST", handleReportError)];
}
