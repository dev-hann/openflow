type ErrorPlatform = "server" | "app" | "web";

interface ErrorReport {
  platform: ErrorPlatform;
  version: string;
  errorCode: string;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

let token: string | undefined;

export function initErrorReporter(getToken: () => string | undefined): void {
  token = getToken();

  window.onerror = (message, _source, _lineno, _colno, error) => {
    report({
      platform: "web",
      version: __APP_VERSION__,
      errorCode: "RUNTIME_ERROR",
      message: String(message),
      stackTrace: error?.stack,
    });
  };

  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    report({
      platform: "web",
      version: __APP_VERSION__,
      errorCode: "UNHANDLED_REJECTION",
      message: reason instanceof Error ? reason.message : String(reason),
      stackTrace: reason instanceof Error ? reason.stack : undefined,
    });
  };
}

export async function report(report: ErrorReport): Promise<void> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const currentToken = token ?? (() => { try { return undefined; } catch { return undefined; } })();
    if (currentToken) {
      headers["Authorization"] = `Bearer ${currentToken}`;
    }
    await fetch("/api/errors", {
      method: "POST",
      headers,
      body: JSON.stringify(report),
    });
  } catch {
    // silently ignore - error reporting should not cause more errors
  }
}

declare const __APP_VERSION__: string;
