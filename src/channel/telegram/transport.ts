import * as dns from "node:dns";
import { Agent, EnvHttpProxyAgent, ProxyAgent, fetch as undiciFetch } from "undici";
import { createLogger } from "../../utils/logger.js";
import { logRequest } from "../../utils/diagnostics.js";

const log = createLogger("telegram/transport");

const TELEGRAM_API_HOSTNAME = "api.telegram.org";
const TELEGRAM_FALLBACK_IPS: readonly string[] = ["149.154.167.220"];

const FALLBACK_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

type FetchFn = typeof fetch;

function collectErrorCodes(err: unknown): Set<string> {
  const codes = new Set<string>();
  const queue: unknown[] = [err];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (typeof current === "object") {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && code.trim()) codes.add(code.trim().toUpperCase());
      const cause = (current as { cause?: unknown }).cause;
      if (cause && !seen.has(cause)) queue.push(cause);
      const errors = (current as { errors?: unknown[] }).errors;
      if (Array.isArray(errors)) for (const e of errors) if (e && !seen.has(e)) queue.push(e);
    }
  }
  return codes;
}

function isTransportError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (!msg.includes("fetch failed")) return false;
  const codes = collectErrorCodes(err);
  return FALLBACK_ERROR_CODES.size === 0 || [...FALLBACK_ERROR_CODES].some((c) => codes.has(c)) || msg.includes("fetch failed");
}

type LookupFn = (hostname: string, options: unknown, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => void;

function createPinnedLookup(addresses: string[]): LookupFn {
  return (hostname, _options, callback) => {
    if (hostname === TELEGRAM_API_HOSTNAME && addresses.length > 0) {
      callback(null, addresses[0]!, 4);
      return;
    }
    dns.lookup(hostname, _options as dns.LookupOptions, callback as never);
  };
}

function createIpv4FirstLookup(): LookupFn {
  return (hostname, options, callback) => {
    const base = typeof options === "number" ? { family: options } : (options as Record<string, unknown>);
    dns.lookup(hostname, { ...(base as object), order: "ipv4first" } as dns.LookupOptions, callback as never);
  };
}

type DispatcherFactory = { create: () => Agent | EnvHttpProxyAgent | ProxyAgent; label: string };

function hasEnvProxy(): boolean {
  const v = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.https_proxy ?? process.env.http_proxy;
  return typeof v === "string" && v.trim().length > 0;
}

function buildAttempts(configProxy?: string): DispatcherFactory[] {
  const ipv4Lookup = createIpv4FirstLookup();
  const pinnedLookup = createPinnedLookup([...TELEGRAM_FALLBACK_IPS]);
  const explicitProxy = configProxy?.trim();
  const useEnvProxy = !explicitProxy && hasEnvProxy();

  const makeAgent = (connectOpts: Record<string, unknown>) => {
    if (explicitProxy) {
      return new ProxyAgent({ uri: explicitProxy, connect: connectOpts });
    }
    if (useEnvProxy) {
      return new EnvHttpProxyAgent({ connect: connectOpts });
    }
    return new Agent({ connect: connectOpts });
  };

  const prefix = explicitProxy ? "proxy-explicit" : useEnvProxy ? "proxy-env" : "direct";

  return [
    {
      label: prefix,
      create: () => makeAgent({ autoSelectFamily: false, lookup: ipv4Lookup }),
    },
    {
      label: `ipv4-forced`,
      create: () => makeAgent({ family: 4, autoSelectFamily: false, lookup: ipv4Lookup }),
    },
    {
      label: "dns-pinned",
      create: () => makeAgent({ family: 4, autoSelectFamily: false, lookup: pinnedLookup }),
    },
  ];
}

function stripSignal(init: RequestInit | undefined): RequestInit | undefined {
  if (!init) return init;
  const { signal: _s, ...rest } = init;
  return rest;
}

function relaySignal(init: RequestInit | undefined): { init: RequestInit | undefined; signal: AbortSignal | undefined; cleanup: () => void } {
  const originalSignal = (init as Record<string, unknown> | undefined)?.signal as AbortSignal | undefined;
  if (!originalSignal) {
    return { init: stripSignal(init), signal: undefined, cleanup: () => {} };
  }

  const controller = new AbortController();

  const onAbort = () => {
    try { controller.abort(originalSignal.reason); } catch { controller.abort(); }
  };

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { originalSignal.removeEventListener("abort", onAbort); } catch {}
  };

  if (originalSignal.aborted) {
    try { controller.abort(originalSignal.reason); } catch { controller.abort(); }
  } else {
    originalSignal.addEventListener("abort", onAbort, { once: true });
  }

  const { signal: _s, ...rest } = init!;
  return { init: { ...rest, signal: controller.signal }, signal: controller.signal, cleanup };
}

export function createTelegramFetch(configProxy?: string): FetchFn {
  const attempts = buildAttempts(configProxy);
  let stickyIndex = 0;

  log.info({ attempts: attempts.map((a) => a.label) }, "telegram transport fallback chain initialized");

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { init: safeInit, cleanup } = relaySignal(init);
    const url = input instanceof URL ? input.toString() : String(input);
    const method = (init?.method ?? "POST").toUpperCase();
    const start = Date.now();

    const startIndex = Math.min(stickyIndex, attempts.length - 1);
    let lastError: unknown;

    try {
      const dispatcher = attempts[startIndex]!.create();
      const response = await undiciFetch(input as URL, { ...safeInit, dispatcher } as never);
      logRequest({ method, url, status: response.status, durationMs: Date.now() - start });
      cleanup();
      return response as Response;
    } catch (err) {
      lastError = err;
    }

    if (!isTransportError(lastError)) {
      cleanup();
      throw lastError;
    }

    for (let i = startIndex + 1; i < attempts.length; i++) {
      const attempt = attempts[i]!;
      log.warn({ attempt: attempt.label, codes: [...collectErrorCodes(lastError)] }, `transport fallback: trying ${attempt.label}`);
      try {
        const dispatcher = attempt.create();
        const response = await undiciFetch(input as URL, { ...safeInit, dispatcher } as never);
        stickyIndex = i;
        logRequest({ method, url, status: response.status, durationMs: Date.now() - start });
        log.info({ stickyAttempt: attempt.label }, "transport fallback succeeded, sticking");
        cleanup();
        return response as Response;
      } catch (err) {
        lastError = err;
        if (!isTransportError(err)) {
          cleanup();
          throw err;
        }
      }
    }

    cleanup();
    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    logRequest({ method, url, error: errMsg, durationMs: Date.now() - start });
    throw lastError;
  };
}
