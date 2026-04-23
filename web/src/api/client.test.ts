import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError } from "./client";

function mockFetch(data: unknown, ok = true, status = 200) {
  const res = {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(data),
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(res as Response);
}

describe("ApiError", () => {
  it("should set status, code, and message", () => {
    const err = new ApiError(401, "invalid_token", "bad token");
    expect(err.status).toBe(401);
    expect(err.code).toBe("invalid_token");
    expect(err.message).toBe("bad token");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call pairInit", async () => {
    mockFetch({ expiresInMs: 300000 });
    const res = await api.pairInit();
    expect(res.expiresInMs).toBe(300000);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/pair/init",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should call pairVerify with body", async () => {
    const tokens = {
      accessToken: "at_test",
      refreshToken: "rt_test",
      sessionKey: "sk_test",
      accessExpiresAt: 1,
      refreshExpiresAt: 2,
    };
    mockFetch(tokens);
    const res = await api.pairVerify({ pin: "123456", label: "web" });
    expect(res.accessToken).toBe("at_test");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ pin: "123456", label: "web" });
  });

  it("should include Bearer token header", async () => {
    mockFetch({ sessions: [] });
    await api.listSessions("at_my-token");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers.Authorization).toBe("Bearer at_my-token");
  });

  it("should throw ApiError on non-ok response", async () => {
    mockFetch({ error: "invalid_token", message: "Token expired" }, false, 401);
    await expect(api.listSessions("bad")).rejects.toThrow(ApiError);
    await expect(api.listSessions("bad")).rejects.toSatisfy((e: ApiError) => e.status === 401);
  });

  it("should create session with title", async () => {
    mockFetch({ id: "s1", title: "test" });
    await api.createSession("at_test", "test");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ title: "test" });
  });

  it("should create session without title", async () => {
    mockFetch({ id: "s1", title: "" });
    await api.createSession("at_test");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].body).toBeUndefined();
  });

  it("should delete session", async () => {
    mockFetch({ ok: true });
    await api.deleteSession("at_test", "s1");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/sessions/s1");
    expect(call[1].method).toBe("DELETE");
  });

  it("should get session messages with pagination", async () => {
    mockFetch({ messages: [], total: 0 });
    await api.getSessionMessages("at_test", "s1", 20, 10);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/sessions/s1/messages?limit=20&offset=10");
  });

  it("should switch provider", async () => {
    mockFetch({ providerId: "p1" });
    await api.switchProvider("at_test", "p1");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/providers/current");
    expect(call[1].method).toBe("PUT");
  });

  it("should handle fetch json parse failure on error", async () => {
    const res = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res as Response);
    await expect(api.listSessions("at_test")).rejects.toSatisfy(
      (e: ApiError) => e.status === 500 && e.code === "unknown",
    );
  });

  it("should call webAuthInit", async () => {
    mockFetch({ sessionId: "abc123", expiresInMs: 300000 });
    const res = await api.webAuthInit();
    expect(res.sessionId).toBe("abc123");
    expect(res.expiresInMs).toBe(300000);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/web/init",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should call webAuthStatus", async () => {
    mockFetch({ status: "pending" });
    const res = await api.webAuthStatus("abc123");
    expect(res.status).toBe("pending");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/auth/web/status/abc123");
  });

  it("should return approved status with tokens", async () => {
    mockFetch({
      status: "approved",
      accessToken: "at_test",
      refreshToken: "rt_test",
      sessionKey: "sk_test",
      accessExpiresAt: 1,
      refreshExpiresAt: 2,
    });
    const res = await api.webAuthStatus("abc123");
    expect(res.status).toBe("approved");
    expect(res.accessToken).toBe("at_test");
    expect(res.refreshToken).toBe("rt_test");
  });
});
