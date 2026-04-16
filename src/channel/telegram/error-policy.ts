import { createLogger } from "../../utils/logger.js";

const log = createLogger("channel/error-policy");

export type ErrorPolicyMode = "always" | "once" | "silent";

interface ErrorPolicyConfig {
  mode: ErrorPolicyMode;
  cooldownMs: number;
}

interface TrackedError {
  code: string;
  lastShownAt: number;
}

export function createErrorPolicy(config?: Partial<ErrorPolicyConfig>) {
  const mode = config?.mode ?? "once";
  const cooldownMs = config?.cooldownMs ?? 4 * 60 * 60 * 1000;
  const seen = new Map<string, TrackedError>();

  function shouldShow(errorCode: string): boolean {
    if (mode === "always") return true;
    if (mode === "silent") return false;

    const now = Date.now();
    const tracked = seen.get(errorCode);
    if (!tracked) {
      seen.set(errorCode, { code: errorCode, lastShownAt: now });
      return true;
    }

    if (now - tracked.lastShownAt > cooldownMs) {
      tracked.lastShownAt = now;
      return true;
    }

    log.debug({ errorCode }, "suppressing duplicate error");
    return false;
  }

  function reset(): void {
    seen.clear();
  }

  return { shouldShow, reset };
}
