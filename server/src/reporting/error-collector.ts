import type { IssueReporter, ErrorReport } from "./issue-reporter.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("reporting/error-collector");

let reporter: IssueReporter | null = null;
let version = "unknown";
let initialized = false;

function handleError(source: string, err: unknown): void {
  if (!reporter) return;

  const message = err instanceof Error ? err.message : String(err);
  const stackTrace = err instanceof Error ? err.stack : undefined;

  const report: ErrorReport = {
    platform: "server",
    version,
    errorCode: "UNHANDLED_ERROR",
    message: `[${source}] ${message}`,
    stackTrace,
  };

  reporter.report(report).catch((reportErr) => {
    log.error({ err: reportErr }, "failed to report unhandled error");
  });
}

export function setupErrorCollector(
  issueReporter: IssueReporter,
  serverVersion: string,
): void {
  if (initialized) return;
  initialized = true;
  reporter = issueReporter;
  version = serverVersion;

  process.on("unhandledRejection", (reason: unknown) => {
    log.error({ err: reason }, "unhandled rejection");
    handleError("unhandledRejection", reason);
  });

  process.on("uncaughtException", (err: Error) => {
    log.error({ err }, "uncaught exception");
    handleError("uncaughtException", err);
  });
}
