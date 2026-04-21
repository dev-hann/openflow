import { describe, it, expect } from "vitest";
import {
  withRetry,
  withSyncRetry,
  isRetryableNetworkError,
  isRetryableHttpError,
  isSqliteBusy,
  sleep,
} from "./retry.js";

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const result = await withRetry(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("should retry on failure and succeed", async () => {
    let attempt = 0;
    const result = await withRetry(
      () => {
        attempt++;
        if (attempt < 3) throw new Error("fail");
        return Promise.resolve("ok");
      },
      { delays: [1, 1, 1] },
    );
    expect(result).toBe("ok");
    expect(attempt).toBe(3);
  });

  it("should throw after max attempts", async () => {
    await expect(
      withRetry(() => Promise.reject(new Error("always fail")), {
        delays: [1, 1],
      }),
    ).rejects.toThrow("always fail");
  });

  it("should respect explicit maxAttempts shorter than delays", async () => {
    let attempt = 0;
    await expect(
      withRetry(
        () => {
          attempt++;
          throw new Error("fail");
        },
        { delays: [1, 1, 1], maxAttempts: 2 },
      ),
    ).rejects.toThrow("fail");
    expect(attempt).toBe(2);
  });

  it("should respect shouldRetry returning false", async () => {
    let attempt = 0;
    await expect(
      withRetry(
        () => {
          attempt++;
          throw new Error("no retry");
        },
        { delays: [1, 1], shouldRetry: () => false },
      ),
    ).rejects.toThrow("no retry");
    expect(attempt).toBe(1);
  });
});

describe("isRetryableNetworkError", () => {
  it("should detect ECONNREFUSED", () => {
    expect(isRetryableNetworkError(new Error("ECONNREFUSED"))).toBe(true);
  });

  it("should detect ETIMEDOUT", () => {
    expect(isRetryableNetworkError(new Error("connection ETIMEDOUT"))).toBe(true);
  });

  it("should not match non-network errors", () => {
    expect(isRetryableNetworkError(new Error("something else"))).toBe(false);
  });

  it("should return false for non-Error", () => {
    expect(isRetryableNetworkError("string")).toBe(false);
  });
});

describe("isRetryableHttpError", () => {
  it("should detect HTTP 5xx", () => {
    expect(isRetryableHttpError(new Error("HTTP 500"))).toBe(true);
    expect(isRetryableHttpError(new Error("HTTP 503"))).toBe(true);
  });

  it("should not match HTTP 4xx", () => {
    expect(isRetryableHttpError(new Error("HTTP 404"))).toBe(false);
  });

  it("should delegate to isRetryableNetworkError", () => {
    expect(isRetryableHttpError(new Error("fetch failed"))).toBe(true);
  });
});

describe("isSqliteBusy", () => {
  it("should detect SQLITE_BUSY", () => {
    expect(isSqliteBusy(new Error("SQLITE_BUSY"))).toBe(true);
  });

  it("should detect database is locked", () => {
    expect(isSqliteBusy(new Error("database is locked"))).toBe(true);
  });

  it("should not match other errors", () => {
    expect(isSqliteBusy(new Error("other error"))).toBe(false);
  });
});

describe("withSyncRetry", () => {
  it("should return result on first success", () => {
    const result = withSyncRetry(
      () => 42,
      () => false,
    );
    expect(result).toBe(42);
  });

  it("should throw when shouldRetry returns false", () => {
    expect(() =>
      withSyncRetry(
        () => {
          throw new Error("fail");
        },
        () => false,
      ),
    ).toThrow("fail");
  });

  it("should retry when shouldRetry returns true", () => {
    let attempt = 0;
    const result = withSyncRetry(
      () => {
        attempt++;
        if (attempt < 2) throw new Error("busy");
        return "ok";
      },
      (err) => err instanceof Error && err.message === "busy",
    );
    expect(result).toBe("ok");
    expect(attempt).toBe(2);
  });

  it("should exhaust all retry attempts and throw", () => {
    let attempt = 0;
    expect(() =>
      withSyncRetry(
        () => {
          attempt++;
          throw new Error("busy");
        },
        () => true,
      ),
    ).toThrow("busy");
    expect(attempt).toBe(4);
  });
});

describe("sleep", () => {
  it("should resolve after specified ms", async () => {
    const start = Date.now();
    await sleep(10);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(8);
  });
});
