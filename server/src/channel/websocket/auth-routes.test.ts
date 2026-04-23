import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAuthRoutes } from "./auth-routes.js";
import type { AuthService } from "./auth.js";

function createMockResponse(): {
  res: ServerResponse;
  getStatusCode: () => number;
  getBody: () => string;
} {
  let statusCode = 200;
  let body = "";

  const res = {
    writeHead: vi.fn((code: number) => {
      statusCode = code;
    }),
    setHeader: vi.fn(),
    end: vi.fn((data?: string | Buffer) => {
      if (data) body = typeof data === "string" ? data : data.toString();
    }),
  } as unknown as ServerResponse;

  return { res, getStatusCode: () => statusCode, getBody: () => body };
}

function createMockRequest(overrides: {
  headers?: Record<string, string>;
  method?: string;
  url?: string;
  body?: Record<string, unknown>;
}): IncomingMessage {
  const { body, ...rest } = overrides;
  const req = {
    headers: rest.headers ?? {},
    method: rest.method ?? "GET",
    url: rest.url ?? "/",
    socket: { remoteAddress: "127.0.0.1" },
    [Symbol.asyncIterator]: async function* () {
      if (body) yield Buffer.from(JSON.stringify(body));
      else yield Buffer.from("");
    },
  } as unknown as IncomingMessage;
  return req;
}

const VALID_TOKEN = "Bearer at_test-token";
const mockAuthPayload = {
  sessionKey: "sk_test",
  expiresAt: Date.now() + 60_000,
};

function createMockAuthService(): AuthService {
  return {
    validateAccessToken: vi.fn((token: string) =>
      token === "at_test-token" ? mockAuthPayload : null,
    ),
    createPairingPin: vi.fn(() => "123456"),
    verifyPinAndIssueTokens: vi.fn(),
    refreshTokens: vi.fn(),
    unpair: vi.fn(),
    listDevices: vi.fn(),
  } as unknown as AuthService;
}

function createTestSetup() {
  const authService = createMockAuthService();
  const routes = createAuthRoutes({ authService });

  function findRoute(path: string, method: string) {
    return routes.find((r) => r.match(path, method));
  }

  return { authService, routes, findRoute };
}

describe("auth routes", () => {
  const setup = createTestSetup();
  const { findRoute, authService } = setup;

  describe("POST /api/auth/pair/init", () => {
    it("should create a pairing pin", async () => {
      const route = findRoute("/api/auth/pair/init", "POST");
      expect(route).toBeDefined();
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({ method: "POST" });
      await route!.handler(req, res, {
        path: "/api/auth/pair/init",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { expiresInMs: number };
      expect(body.expiresInMs).toBe(300_000);
      expect(authService.createPairingPin).toHaveBeenCalled();
    });

    it("should rate limit after too many requests", async () => {
      const route = findRoute("/api/auth/pair/init", "POST");
      expect(route).toBeDefined();

      for (let i = 0; i < 11; i++) {
        const { res, getStatusCode } = createMockResponse();
        const req = createMockRequest({ method: "POST" });
        await route!.handler(req, res, {
          path: "/api/auth/pair/init",
          clientIp: "10.0.0.1",
        });
        if (i >= 10) {
          expect(getStatusCode()).toBe(429);
        }
      }
    });
  });

  describe("POST /api/auth/pair/verify", () => {
    it("should return error when pin is missing", async () => {
      const route = findRoute("/api/auth/pair/verify", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        method: "POST",
        body: {},
      });
      await route!.handler(req, res, {
        path: "/api/auth/pair/verify",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("validation_error");
    });

    it("should return tokens for valid pin", async () => {
      vi.mocked(authService.verifyPinAndIssueTokens).mockReturnValue({
        accessToken: "at_new",
        refreshToken: "rt_new",
        sessionKey: "sk_new",
        accessExpiresAt: Date.now() + 3600_000,
        refreshExpiresAt: Date.now() + 86400_000,
      });
      const route = findRoute("/api/auth/pair/verify", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        method: "POST",
        body: { pin: "123456", label: "iPhone" },
      });
      await route!.handler(req, res, {
        path: "/api/auth/pair/verify",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { accessToken: string };
      expect(body.accessToken).toBe("at_new");
      expect(authService.verifyPinAndIssueTokens).toHaveBeenCalledWith("123456", "iPhone");
    });

    it("should return 401 for invalid pin", async () => {
      vi.mocked(authService.verifyPinAndIssueTokens).mockReturnValue(null);
      const route = findRoute("/api/auth/pair/verify", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        method: "POST",
        body: { pin: "000000" },
      });
      await route!.handler(req, res, {
        path: "/api/auth/pair/verify",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(401);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("invalid_or_expired_pin");
    });

    it("should use default label when not provided", async () => {
      vi.mocked(authService.verifyPinAndIssueTokens).mockReturnValue({
        accessToken: "at_new",
        refreshToken: "rt_new",
        sessionKey: "sk_new",
        accessExpiresAt: Date.now() + 3600_000,
        refreshExpiresAt: Date.now() + 86400_000,
      });
      const route = findRoute("/api/auth/pair/verify", "POST");
      const { res } = createMockResponse();
      const req = createMockRequest({
        method: "POST",
        body: { pin: "123456" },
      });
      await route!.handler(req, res, {
        path: "/api/auth/pair/verify",
        clientIp: "127.0.0.1",
      });
      expect(authService.verifyPinAndIssueTokens).toHaveBeenCalledWith("123456", "Unknown device");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should return new tokens for valid refresh token", async () => {
      vi.mocked(authService.refreshTokens).mockReturnValue({
        accessToken: "at_refreshed",
        refreshToken: "rt_refreshed",
        sessionKey: "sk_test",
        accessExpiresAt: Date.now() + 3600_000,
        refreshExpiresAt: Date.now() + 86400_000,
      });
      const route = findRoute("/api/auth/refresh", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        method: "POST",
        body: { refreshToken: "rt_valid" },
      });
      await route!.handler(req, res, {
        path: "/api/auth/refresh",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { accessToken: string };
      expect(body.accessToken).toBe("at_refreshed");
    });

    it("should return error when refreshToken is missing", async () => {
      const route = findRoute("/api/auth/refresh", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        method: "POST",
        body: {},
      });
      await route!.handler(req, res, {
        path: "/api/auth/refresh",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("validation_error");
    });

    it("should return 401 for invalid refresh token", async () => {
      vi.mocked(authService.refreshTokens).mockReturnValue(null);
      const route = findRoute("/api/auth/refresh", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        method: "POST",
        body: { refreshToken: "rt_invalid" },
      });
      await route!.handler(req, res, {
        path: "/api/auth/refresh",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(401);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("invalid_refresh_token");
    });
  });

  describe("DELETE /api/auth/unpair", () => {
    it("should unpair device with valid auth", async () => {
      const route = findRoute("/api/auth/unpair", "DELETE");
      expect(route).toBeDefined();
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "DELETE",
      });
      await route!.handler(req, res, {
        path: "/api/auth/unpair",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(authService.unpair).toHaveBeenCalledWith("sk_test");
    });

    it("should return 401 without auth", async () => {
      const route = findRoute("/api/auth/unpair", "DELETE");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({ method: "DELETE" });
      await route!.handler(req, res, {
        path: "/api/auth/unpair",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(401);
    });
  });

  describe("GET /api/status", () => {
    it("should return status with valid auth", async () => {
      const route = findRoute("/api/status", "GET");
      expect(route).toBeDefined();
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
      });
      await route!.handler(req, res, {
        path: "/api/status",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { status: string };
      expect(body.status).toBe("ok");
    });

    it("should return 401 without auth", async () => {
      const route = findRoute("/api/status", "GET");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({});
      await route!.handler(req, res, {
        path: "/api/status",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(401);
    });
  });
});
