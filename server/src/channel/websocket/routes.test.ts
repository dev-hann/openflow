import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRoutes, route, routePattern, type RoutesDeps } from "./routes.js";
import type { AuthService } from "./auth.js";
import type { MemoryStore } from "../../memory/index.js";
import type { ProviderStore } from "../../memory/provider-store.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { PushTokenStore } from "../../notification/token-store.js";

function createMockResponse(): {
  res: ServerResponse;
  getStatusCode: () => number;
  getBody: () => string;
  getHeaders: () => Record<string, string>;
} {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";

  const res = {
    writeHead: vi.fn((code: number, h?: Record<string, string>) => {
      statusCode = code;
      if (h) Object.assign(headers, h);
    }),
    setHeader: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    end: vi.fn((data?: string | Buffer) => {
      if (data) body = typeof data === "string" ? data : data.toString();
    }),
  } as unknown as ServerResponse;

  return {
    res,
    getStatusCode: () => statusCode,
    getBody: () => body,
    getHeaders: () => headers,
  };
}

function createMockRequest(overrides: {
  headers?: Record<string, string>;
  method?: string;
  url?: string;
}): IncomingMessage {
  return {
    headers: overrides.headers ?? {},
    method: overrides.method ?? "GET",
    url: overrides.url ?? "/",
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage;
}

function createMockDeps(): RoutesDeps {
  return {
    authService: {
      validateAccessToken: vi.fn(() => ({
        sessionKey: "sk_test",
        expiresAt: Date.now() + 60_000,
      })),
      createPairingPin: vi.fn(),
      verifyPinAndIssueTokens: vi.fn(),
      refreshTokens: vi.fn(),
      unpair: vi.fn(),
      listDevices: vi.fn(),
    } as unknown as AuthService,
    memoryStore: {
      createSession: vi.fn(() => ({
        id: "s1",
        title: "Test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })),
      listSessions: vi.fn(() => []),
      getSession: vi.fn(() => null),
      deleteSession: vi.fn(),
      addMessage: vi.fn(),
      getMessages: vi.fn(() => []),
      getMessageCount: vi.fn(() => 0),
      getVisibleMessages: vi.fn(() => ({ messages: [], total: 0 })),
      searchMessages: vi.fn(() => []),
      buildContext: vi.fn(() => []),
      close: vi.fn(),
      getDb: vi.fn(),
    } as unknown as MemoryStore,
    providerStore: {
      listProviders: vi.fn(() => []),
      getProvider: vi.fn(() => null),
      getDefaultProvider: vi.fn(() => null),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      deleteProvider: vi.fn(),
    } as unknown as ProviderStore,
    providerPool: {
      getClient: vi.fn(),
      getActiveProvider: vi.fn(() => null),
      getActiveProviderId: vi.fn(() => ""),
      switchProvider: vi.fn(),
      syncFromStore: vi.fn(),
      listProviders: vi.fn(() => []),
    } as unknown as ProviderPool,
    pushTokenStore: {
      register: vi.fn(),
      unregister: vi.fn(() => true),
      getAllTokens: vi.fn(() => []),
      getTokenCount: vi.fn(() => 0),
    } as unknown as PushTokenStore,
    corsEnabled: true,
  };
}

describe("route helpers", () => {
  describe("route()", () => {
    it("should match exact path and method", () => {
      const handler = vi.fn();
      const r = route("/api/test", "GET", handler);
      expect(r.match("/api/test", "GET")).toBe(true);
      expect(r.match("/api/test", "POST")).toBe(false);
      expect(r.match("/api/other", "GET")).toBe(false);
    });
  });

  describe("routePattern()", () => {
    it("should match regex pattern and method", () => {
      const handler = vi.fn();
      const r = routePattern(/^\/api\/sessions\/[^/]+$/, "GET", handler);
      expect(r.match("/api/sessions/abc-123", "GET")).toBe(true);
      expect(r.match("/api/sessions/abc-123", "DELETE")).toBe(false);
      expect(r.match("/api/sessions", "GET")).toBe(false);
    });
  });
});

describe("createRoutes", () => {
  const deps = createMockDeps();
  const handleRequest = createRoutes(deps);

  it("should set CORS headers on every request", async () => {
    const { res, getHeaders } = createMockResponse();
    const req = createMockRequest({ url: "/api/nonexistent" });

    await handleRequest(req, res);
    expect(getHeaders()["Access-Control-Allow-Origin"]).toBe("http://localhost:*");
  });

  it("should handle OPTIONS preflight request", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({ method: "OPTIONS" });

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(204);
  });

  it("should return 404 for unknown routes", async () => {
    const { res, getStatusCode, getBody } = createMockResponse();
    const req = createMockRequest({ url: "/api/nonexistent" });

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(404);
    const parsed = JSON.parse(getBody()) as { error: string };
    expect(parsed.error).toBe("not_found");
  });

  it("should return 413 for request body too large error", async () => {
    const bodyDeps = createMockDeps();
    const handleBody = createRoutes(bodyDeps);

    const { res, getStatusCode, getBody } = createMockResponse();
    const bigBody = "a".repeat(1024 * 1024 + 100);
    const req = {
      headers: { authorization: "Bearer at_test-token" },
      method: "POST",
      url: "/api/sessions",
      socket: { remoteAddress: "127.0.0.1" },
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(bigBody);
      },
    } as unknown as IncomingMessage;

    await handleBody(req, res);
    expect(getStatusCode()).toBe(413);
    const parsed = JSON.parse(getBody()) as { error: string };
    expect(parsed.error).toBe("payload_too_large");
  });

  it("should return 500 when route handler throws unexpected error", async () => {
    const throwingDeps = createMockDeps();
    (throwingDeps.memoryStore.listSessions as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("unexpected crash");
    });

    const handleThrowing = createRoutes(throwingDeps);
    const { res, getStatusCode, getBody } = createMockResponse();
    const req = createMockRequest({
      url: "/api/sessions",
      headers: { authorization: "Bearer at_test" },
    });

    await handleThrowing(req, res);
    expect(getStatusCode()).toBe(500);
    const parsed = JSON.parse(getBody()) as { error: string };
    expect(parsed.error).toBe("internal_error");
  });

  it("should not set CORS headers when corsEnabled is false", async () => {
    const noCorsDeps = { ...createMockDeps(), corsEnabled: false };
    const noCorsHandle = createRoutes(noCorsDeps);
    const { res, getHeaders } = createMockResponse();
    const req = createMockRequest({ url: "/api/nonexistent" });

    await noCorsHandle(req, res);
    expect(getHeaders()["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("should extract clientIp from x-forwarded-for header", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      url: "/api/nonexistent",
      headers: { "x-forwarded-for": " 10.0.0.1 , 10.0.0.2 " },
    });

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(404);
  });

  it("should dispatch to registered auth routes", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      url: "/api/status",
      headers: {},
    });

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(401);
  });

  it("should dispatch to registered session routes", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      url: "/api/sessions",
      headers: {},
    });

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(401);
  });

  it("should fall back to remoteAddress when x-forwarded-for is absent", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      url: "/api/nonexistent",
      headers: {},
    });

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(404);
  });

  it("should fall back to 'unknown' when no IP is available", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = {
      headers: {},
      method: "GET",
      url: "/api/nonexistent",
      socket: {},
    } as unknown as IncomingMessage;

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(404);
  });

  it("should handle undefined req.url and req.method", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as IncomingMessage;

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(404);
  });

  it("should handle undefined host header in dispatchRequest", async () => {
    const { res, getStatusCode } = createMockResponse();
    const req = {
      headers: {} as Record<string, string>,
      method: "GET",
      url: "/api/nonexistent",
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as IncomingMessage;

    await handleRequest(req, res);
    expect(getStatusCode()).toBe(404);
  });

  it("should handle error with undefined url in catch block", async () => {
    const throwingDeps = createMockDeps();
    (throwingDeps.memoryStore.listSessions as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("unexpected crash");
    });

    const handleThrowing = createRoutes(throwingDeps);
    const { res, getStatusCode } = createMockResponse();
    const req = {
      headers: { authorization: "Bearer at_test" } as Record<string, string>,
      method: "GET",
      url: "/api/sessions",
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as IncomingMessage;

    await handleThrowing(req, res);
    expect(getStatusCode()).toBe(500);
  });
});
