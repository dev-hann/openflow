import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionRoutes } from "./session-routes.js";
import type { AuthService } from "./auth.js";
import type { MemoryStore } from "../../memory/index.js";
import type { PushTokenStore } from "../../notification/token-store.js";

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
    createPairingPin: vi.fn(),
    verifyPinAndIssueTokens: vi.fn(),
    refreshTokens: vi.fn(),
    unpair: vi.fn(),
    listDevices: vi.fn(),
  } as unknown as AuthService;
}

function createMockMemoryStore(): MemoryStore {
  const sessions = new Map<
    string,
    { id: string; title: string; createdAt: number; updatedAt: number }
  >();
  let msgCounter = 0;

  return {
    createSession: vi.fn((title?: string) => {
      const id = `sess_${++msgCounter}`;
      const now = Date.now();
      const session = {
        id,
        title: title ?? "New Chat",
        createdAt: now,
        updatedAt: now,
      };
      sessions.set(id, session);
      return session;
    }),
    listSessions: vi.fn(() => Array.from(sessions.values())),
    getSession: vi.fn((id: string) => sessions.get(id) ?? null),
    deleteSession: vi.fn((id: string) => {
      sessions.delete(id);
    }),
    addMessage: vi.fn(),
    getMessages: vi.fn(() => []),
    getMessageCount: vi.fn(() => 0),
    getVisibleMessages: vi.fn(() => ({ messages: [], total: 0 })),
    searchMessages: vi.fn(() => []),
    buildContext: vi.fn(() => []),
    close: vi.fn(),
    getDb: vi.fn(),
  } as unknown as MemoryStore;
}

function createMockPushTokenStore(): PushTokenStore {
  const tokens = new Map<string, { platform: string; label: string }>();
  return {
    register: vi.fn((token: string, platform: string, label: string) => {
      tokens.set(token, { platform, label });
    }),
    unregister: vi.fn((token: string) => {
      const existed = tokens.has(token);
      tokens.delete(token);
      return existed;
    }),
    getAllTokens: vi.fn(() =>
      Array.from(tokens.entries()).map(([token, info]) => ({ token, ...info })),
    ),
    getTokenCount: vi.fn(() => tokens.size),
  } as unknown as PushTokenStore;
}

function createTestSetup() {
  const authService = createMockAuthService();
  const memoryStore = createMockMemoryStore();
  const pushTokenStore = createMockPushTokenStore();

  const routes = createSessionRoutes({
    authService,
    memoryStore,
    pushTokenStore,
  });

  function findRoute(path: string, method: string) {
    return routes.find((r) => r.match(path, method));
  }

  return { authService, memoryStore, pushTokenStore, routes, findRoute };
}

describe("session routes", () => {
  const setup = createTestSetup();
  const { findRoute, memoryStore } = setup;

  describe("GET /api/sessions", () => {
    it("should return 401 without auth", async () => {
      const route = findRoute("/api/sessions", "GET");
      expect(route).toBeDefined();
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      await route!.handler(req, res, {
        path: "/api/sessions",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(401);
    });

    it("should list sessions with auth", async () => {
      const route = findRoute("/api/sessions", "GET");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
      });
      await route!.handler(req, res, {
        path: "/api/sessions",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { sessions: unknown[] };
      expect(body.sessions).toBeDefined();
    });
  });

  describe("POST /api/sessions", () => {
    it("should create session with default title", async () => {
      const route = findRoute("/api/sessions", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: {},
      });
      await route!.handler(req, res, {
        path: "/api/sessions",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(201);
      const body = JSON.parse(getBody()) as { id: string; title: string };
      expect(body.id).toBeDefined();
      expect(body.title).toBe("New Chat");
    });

    it("should create session with custom title", async () => {
      const route = findRoute("/api/sessions", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: { title: "My Chat" },
      });
      await route!.handler(req, res, {
        path: "/api/sessions",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(201);
      const body = JSON.parse(getBody()) as { title: string };
      expect(body.title).toBe("My Chat");
    });
  });

  describe("DELETE /api/sessions/:id", () => {
    it("should delete a session", async () => {
      const route = findRoute("/api/sessions/sess_1", "DELETE");
      expect(route).toBeDefined();
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "DELETE",
      });
      await route!.handler(req, res, {
        path: "/api/sessions/sess_1",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(memoryStore.deleteSession).toHaveBeenCalledWith("sess_1");
    });

    it("should return 400 for delete without session id", async () => {
      const route = findRoute("/api/sessions/", "DELETE");
      if (!route) return;
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "DELETE",
      });
      await route.handler(req, res, {
        path: "/api/sessions/",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
    });

    it("should return 400 for delete with nested path", async () => {
      const route = findRoute("/api/sessions/sess_1/something", "DELETE");
      if (!route) return;
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "DELETE",
      });
      await route.handler(req, res, {
        path: "/api/sessions/sess_1/something",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("session_id_required");
    });
  });

  describe("GET /api/sessions/:id/messages", () => {
    it("should return messages for a session", async () => {
      const route = findRoute("/api/sessions/sess_1/messages", "GET");
      expect(route).toBeDefined();
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        url: "/api/sessions/sess_1/messages?limit=10&offset=0",
      });
      await route!.handler(req, res, {
        path: "/api/sessions/sess_1/messages",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as {
        messages: unknown[];
        total: number;
      };
      expect(body.messages).toBeDefined();
      expect(typeof body.total).toBe("number");
    });

    it("should use default pagination when not specified", async () => {
      const route = findRoute("/api/sessions/sess_1/messages", "GET");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        url: "/api/sessions/sess_1/messages",
      });
      await route!.handler(req, res, {
        path: "/api/sessions/sess_1/messages",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      expect(memoryStore.getVisibleMessages).toHaveBeenCalledWith(
        "sess_1",
        50,
        0,
      );
    });

    it("should clamp limit to 200 maximum", async () => {
      const route = findRoute("/api/sessions/sess_1/messages", "GET");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        url: "/api/sessions/sess_1/messages?limit=500",
      });
      await route!.handler(req, res, {
        path: "/api/sessions/sess_1/messages",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      expect(memoryStore.getVisibleMessages).toHaveBeenCalledWith(
        "sess_1",
        200,
        0,
      );
    });

    it("should handle NaN limit gracefully", async () => {
      const route = findRoute("/api/sessions/sess_1/messages", "GET");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        url: "/api/sessions/sess_1/messages?limit=abc",
      });
      await route!.handler(req, res, {
        path: "/api/sessions/sess_1/messages",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      expect(memoryStore.getVisibleMessages).toHaveBeenCalledWith(
        "sess_1",
        50,
        0,
      );
    });

    it("should handle NaN offset gracefully", async () => {
      const route = findRoute("/api/sessions/sess_1/messages", "GET");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        url: "/api/sessions/sess_1/messages?offset=xyz",
      });
      await route!.handler(req, res, {
        path: "/api/sessions/sess_1/messages",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      expect(memoryStore.getVisibleMessages).toHaveBeenCalledWith(
        "sess_1",
        50,
        0,
      );
    });

    it("should return messages with content mapped to empty string when null", async () => {
      const localSetup = createTestSetup();
      localSetup.memoryStore.getVisibleMessages = vi.fn(() => ({
        messages: [
          { role: "user", content: null as unknown as string, createdAt: 123 },
          { role: "assistant", content: "hello", createdAt: 456 },
        ],
        total: 2,
      }));
      const route = localSetup.findRoute("/api/sessions/sess_1/messages", "GET");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        url: "/api/sessions/sess_1/messages",
      });
      await route!.handler(req, res, {
        path: "/api/sessions/sess_1/messages",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.messages[0]!.content).toBe("");
      expect(body.messages[1]!.content).toBe("hello");
    });
  });

  describe("POST /api/push-tokens", () => {
    it("should register a push token", async () => {
      const route = findRoute("/api/push-tokens", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: {
          token: "expo-token-123",
          platform: "ios",
          label: "iPhone",
        },
      });
      await route!.handler(req, res, {
        path: "/api/push-tokens",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(setup.pushTokenStore.register).toHaveBeenCalledWith(
        "expo-token-123",
        "ios",
        "iPhone",
      );
    });

    it("should reject missing token", async () => {
      const route = findRoute("/api/push-tokens", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: { platform: "ios", label: "iPhone" },
      });
      await route!.handler(req, res, {
        path: "/api/push-tokens",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("token_required");
    });

    it("should reject invalid platform", async () => {
      const route = findRoute("/api/push-tokens", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: { token: "expo-token", platform: "blackberry", label: "Phone" },
      });
      await route!.handler(req, res, {
        path: "/api/push-tokens",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toContain("platform");
    });

    it("should accept all valid platforms", async () => {
      const localSetup = createTestSetup();
      const route = localSetup.findRoute("/api/push-tokens", "POST");

      for (const platform of ["ios", "android", "web"]) {
        const { res, getStatusCode } = createMockResponse();
        const req = createMockRequest({
          headers: { authorization: VALID_TOKEN },
          method: "POST",
          body: { token: `token-${platform}`, platform, label: "Device" },
        });
        await route!.handler(req, res, {
          path: "/api/push-tokens",
          clientIp: "127.0.0.1",
        });
        expect(getStatusCode()).toBe(200);
      }
    });

    it("should use default label when not provided", async () => {
      const route = findRoute("/api/push-tokens", "POST");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: { token: "expo-token", platform: "android" },
      });
      await route!.handler(req, res, {
        path: "/api/push-tokens",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      expect(setup.pushTokenStore.register).toHaveBeenCalledWith(
        "expo-token",
        "android",
        "Unknown device",
      );
    });
  });

  describe("DELETE /api/push-tokens", () => {
    it("should unregister a push token", async () => {
      const route = findRoute("/api/push-tokens", "DELETE");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "DELETE",
        body: { token: "expo-token-123" },
      });
      await route!.handler(req, res, {
        path: "/api/push-tokens",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { ok: boolean };
      expect(body.ok).toBeDefined();
    });

    it("should reject missing token", async () => {
      const route = findRoute("/api/push-tokens", "DELETE");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "DELETE",
        body: {},
      });
      await route!.handler(req, res, {
        path: "/api/push-tokens",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("token_required");
    });
  });
});
