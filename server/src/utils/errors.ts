export type ErrorCode =
  | "CONFIG_INVALID"
  | "CONFIG_NOT_FOUND"
  | "LLM_REQUEST_FAILED"
  | "LLM_TIMEOUT"
  | "LLM_STREAM_ERROR"
  | "TOOL_EXECUTION_FAILED"
  | "DB_ERROR"
  | "DB_MIGRATION_FAILED"
  | "NOTIFICATION_ERROR"
  | "PERMISSION_DENIED"
  | "REQUEST_TOO_LARGE"
  | "REPORT_ERROR";

export class OpenFlowError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: ErrorCode, cause?: unknown) {
    super(message);
    this.name = "OpenFlowError";
    this.code = code;
    this.cause = cause;
  }
}

export type Result<T, E = OpenFlowError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends OpenFlowError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function ensureOpenFlowError(
  err: unknown,
  fallbackMessage: string,
  code: ErrorCode,
): OpenFlowError {
  return err instanceof OpenFlowError
    ? err
    : new OpenFlowError(fallbackMessage, code, err);
}
