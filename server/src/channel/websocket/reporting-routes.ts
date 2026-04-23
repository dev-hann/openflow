import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson, readJsonObject, requireAuth, validateBody } from "./middleware.js";
import { route, type Route } from "./routes.js";
import type { AuthService } from "./auth.js";
import type { IssueReporter } from "../../reporting/issue-reporter.js";
import { ErrorReportSchema } from "./reporting-schemas.js";

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

    const parsed = validateBody(body, ErrorReportSchema, res);
    if (!parsed) return;

    const result = await issueReporter.report({
      platform: parsed.platform,
      version: parsed.version ?? "unknown",
      errorCode: parsed.errorCode,
      message: parsed.message,
      stackTrace: parsed.stackTrace,
      metadata: parsed.metadata,
    });

    sendJson(res, 200, {
      ok: result.ok,
      issueNumber: result.issueNumber ?? null,
      issueUrl: result.issueUrl ?? null,
    });
  }

  return [route("/api/errors", "POST", handleReportError)];
}
