const DEFAULT_DELAYS = [500, 1000, 2000];

export interface RetryOptions {
  maxAttempts?: number;
  delays?: number[];
  shouldRetry?: (err: unknown) => boolean;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const delays = options?.delays ?? DEFAULT_DELAYS;
  const maxAttempts = options?.maxAttempts ?? delays.length + 1;
  const shouldRetry = options?.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      if (attempt >= maxAttempts - 1 || !shouldRetry(err)) {
        throw err;
      }
      const delay = delays[attempt] ?? delays[delays.length - 1] ?? 1000;
      await sleep(delay);
    }
  }
  throw lastErr;
}

export function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("enetunreach") ||
    msg.includes("ehostunreach") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang up") ||
    msg.includes("network")
  );
}

export function isRetryableHttpError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("http 5") || isRetryableNetworkError(err);
}

export function isSqliteBusy(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("sqlite_busy") || msg.includes("database is locked");
}

const SYNC_RETRY_DELAYS = [100, 200, 400];

export function withSyncRetry<T>(
  fn: () => T,
  shouldRetry: (err: unknown) => boolean,
): T {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= SYNC_RETRY_DELAYS.length; attempt++) {
    try {
      return fn();
    } catch (err: unknown) {
      lastErr = err;
      if (attempt < SYNC_RETRY_DELAYS.length && shouldRetry(err)) {
        const delay = SYNC_RETRY_DELAYS[attempt]!;
        const end = Date.now() + delay;
        while (Date.now() < end) {
          // busy wait for sync SQLite / file I/O
        }
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}
