import type { IssueReporter, ErrorReport } from "./issue-reporter.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("reporting/error-collector");

export function createErrorCollector(
  issueReporter: IssueReporter,
  serverVersion: string,
): void {
  function handleError(source: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const stackTrace = err instanceof Error ? err.stack : undefined;

    const report: ErrorReport = {
      platform: "server",
      version: serverVersion,
      errorCode: "UNHANDLED_ERROR",
      message: `[${source}] ${message}`,
      stackTrace,
    };

    issueReporter.report(report).catch((reportErr) => {
      log.error({ err: reportErr }, "failed to report unhandled error");
    });
  }

  process.on("unhandledRejection", (reason: unknown) => {
    log.error({ err: reason }, "unhandled rejection");
    handleError("unhandledRejection", reason);
  });

  process.on("uncaughtException", (err: Error) => {
    log.error({ err }, "uncaught exception");
    handleError("uncaughtException", err);
  });
}
