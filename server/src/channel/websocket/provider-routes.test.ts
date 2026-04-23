import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createProviderRoutes } from "./provider-routes.js";
import type { AuthService } from "./auth.js";
import type { ProviderStore, Provider } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";

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

const SAMPLE_PROVIDER: Provider = {
  id: "prov_1",
  name: "TestProvider",
  baseUrl: "https://api.test.com/v1",
  apiKey: "sk-test-key",
  model: "gpt-4",
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

function createMockProviderStore(): ProviderStore {
  const providers = new Map<string, Provider>();
  providers.set("prov_1", SAMPLE_PROVIDER);

  return {
    listProviders: vi.fn(() => Array.from(providers.values())),
    addProvider: vi.fn(
      (params: {
        name: string;
        baseUrl: string;
        apiKey: string;
        model: string;
        isDefault?: boolean;
      }) => {
        const p: Provider = {
          id: `prov_${providers.size + 1}`,
          name: params.name,
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          model: params.model,
          isDefault: params.isDefault ?? false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        providers.set(p.id, p);
        return p;
      },
    ),
    getProvider: vi.fn((id: string) => providers.get(id) ?? null),
    updateProvider: vi.fn((id: string, params: Partial<Provider>) => {
      const existing = providers.get(id);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.baseUrl !== undefined ? { baseUrl: params.baseUrl } : {}),
        ...(params.apiKey !== undefined ? { apiKey: params.apiKey } : {}),
        ...(params.model !== undefined ? { model: params.model } : {}),
        updatedAt: Date.now(),
      };
      providers.set(id, updated);
      return updated;
    }),
    deleteProvider: vi.fn((id: string) => {
      providers.delete(id);
    }),
    setDefault: vi.fn(),
  } as unknown as ProviderStore;
}

function createMockProviderPool(): ProviderPool {
  return {
    getClient: vi.fn(),
    getActiveProviderId: vi.fn(() => "prov_1"),
    switchProvider: vi.fn(),
    syncFromStore: vi.fn(),
  } as unknown as ProviderPool;
}

function createTestSetup() {
  const authService = createMockAuthService();
  const providerStore = createMockProviderStore();
  const providerPool = createMockProviderPool();
  const routes = createProviderRoutes({
    authService,
    providerStore,
    providerPool,
  });

  function findRoute(path: string, method: string) {
    return routes.find((r) => r.match(path, method));
  }

  return { authService, providerStore, providerPool, routes, findRoute };
}

describe("provider routes", () => {
  const setup = createTestSetup();
  const { findRoute, providerPool } = setup;

  describe("GET /api/providers", () => {
    it("should return 401 without auth", async () => {
      const route = findRoute("/api/providers", "GET");
      expect(route).toBeDefined();
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({ headers: {} });
      await route!.handler(req, res, {
        path: "/api/providers",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(401);
    });

    it("should list providers with auth", async () => {
      const route = findRoute("/api/providers", "GET");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
      });
      await route!.handler(req, res, {
        path: "/api/providers",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { providers: unknown[] };
      expect(body.providers).toHaveLength(1);
    });
  });

  describe("POST /api/providers", () => {
    it("should reject missing required fields", async () => {
      const route = findRoute("/api/providers", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: { name: "test" },
      });
      await route!.handler(req, res, {
        path: "/api/providers",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
      const body = JSON.parse(getBody()) as { error: string };
      expect(body.error).toBe("validation_error");
    });

    it("should create provider with all required fields", async () => {
      const route = findRoute("/api/providers", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: {
          name: "NewProvider",
          baseUrl: "https://api.new.com/v1",
          apiKey: "sk-test-new",
          model: "gpt-4",
        },
      });
      await route!.handler(req, res, {
        path: "/api/providers",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(201);
      const body = JSON.parse(getBody()) as { id: string };
      expect(body.id).toBeDefined();
      expect(providerPool.syncFromStore).toHaveBeenCalled();
    });

    it("should create provider as default and switch", async () => {
      const localSetup = createTestSetup();
      const route = localSetup.findRoute("/api/providers", "POST");
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: {
          name: "DefaultProvider",
          baseUrl: "https://api.default.com/v1",
          apiKey: "sk-test-default",
          model: "gpt-4",
          isDefault: true,
        },
      });
      await route!.handler(req, res, {
        path: "/api/providers",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(201);
      const body = JSON.parse(getBody()) as { id: string };
      expect(body.id).toBeDefined();
      expect(localSetup.providerPool.switchProvider).toHaveBeenCalledWith(body.id);
    });

    it("should create provider and run background connectivity check", async () => {
      const localSetup = createTestSetup();
      const route = localSetup.findRoute("/api/providers", "POST");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: {
          name: "CheckProvider",
          baseUrl: "https://api.check.com/v1",
          apiKey: "sk-test-check",
          model: "gpt-4",
        },
      });
      await route!.handler(req, res, {
        path: "/api/providers",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(globalThis.fetch).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("should create provider with successful connectivity check", async () => {
      const localSetup = createTestSetup();
      const route = localSetup.findRoute("/api/providers", "POST");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        }),
      );
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
        body: {
          name: "HealthyProvider",
          baseUrl: "https://api.healthy.com/v1",
          apiKey: "sk-test-healthy",
          model: "gpt-4",
        },
      });
      await route!.handler(req, res, {
        path: "/api/providers",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(globalThis.fetch).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  describe("PUT /api/providers/:id", () => {
    it("should update existing provider", async () => {
      const route = findRoute("/api/providers/prov_1", "PUT");
      expect(route).toBeDefined();
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "PUT",
        body: { name: "UpdatedName" },
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
    });

    it("should return 404 for non-existent provider", async () => {
      const route = findRoute("/api/providers/prov_999", "PUT");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "PUT",
        body: { name: "UpdatedName" },
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_999",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(404);
    });
  });

  describe("DELETE /api/providers/:id", () => {
    it("should delete existing provider", async () => {
      const route = findRoute("/api/providers/prov_1", "DELETE");
      expect(route).toBeDefined();
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "DELETE",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
    });
  });

  describe("PUT /api/providers/current", () => {
    const localSetup = createTestSetup();
    const localFindRoute = localSetup.findRoute;

    it("should switch active provider", async () => {
      const route = localFindRoute("/api/providers/current", "PUT");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "PUT",
        body: { providerId: "prov_1" },
      });
      await route!.handler(req, res, {
        path: "/api/providers/current",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      expect(localSetup.providerPool.switchProvider).toHaveBeenCalledWith("prov_1");
    });

    it("should reject missing providerId", async () => {
      const route = localFindRoute("/api/providers/current", "PUT");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "PUT",
        body: {},
      });
      await route!.handler(req, res, {
        path: "/api/providers/current",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(400);
    });

    it("should return 404 for non-existent provider", async () => {
      const route = localFindRoute("/api/providers/current", "PUT");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "PUT",
        body: { providerId: "prov_nonexist" },
      });
      await route!.handler(req, res, {
        path: "/api/providers/current",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(404);
    });
  });

  describe("POST /api/providers/:id/verify", () => {
    const verifySetup = createTestSetup();

    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    it("should return ok:true when provider is reachable", async () => {
      const route = verifySetup.findRoute("/api/providers/prov_1/verify", "POST");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1/verify",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { ok: boolean };
      expect(body.ok).toBe(true);
    });

    it("should return ok:false when provider returns error", async () => {
      const route = verifySetup.findRoute("/api/providers/prov_1/verify", "POST");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1/verify",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { ok: boolean; error: string };
      expect(body.ok).toBe(false);
      expect(body.error).toContain("401");
    });

    it("should return ok:false on network error", async () => {
      const route = verifySetup.findRoute("/api/providers/prov_1/verify", "POST");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1/verify",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { ok: boolean; error: string };
      expect(body.ok).toBe(false);
      expect(body.error).toContain("network down");
    });

    it("should return 404 for non-existent provider", async () => {
      const route = verifySetup.findRoute("/api/providers/prov_999/verify", "POST");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "POST",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_999/verify",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(404);
    });
  });

  describe("GET /api/providers/:id/models", () => {
    const modelsSetup = createTestSetup();

    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    it("should return sorted model list", async () => {
      const route = modelsSetup.findRoute("/api/providers/prov_1/models", "GET");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [{ id: "gpt-4" }, { id: "gpt-3.5-turbo" }],
            }),
        }),
      );
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "GET",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1/models",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { models: string[] };
      expect(body.models).toEqual(["gpt-3.5-turbo", "gpt-4"]);
    });

    it("should handle missing data field", async () => {
      const route = modelsSetup.findRoute("/api/providers/prov_1/models", "GET");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        }),
      );
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "GET",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1/models",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(200);
      const body = JSON.parse(getBody()) as { models: string[] };
      expect(body.models).toEqual([]);
    });

    it("should return error when provider API fails", async () => {
      const route = modelsSetup.findRoute("/api/providers/prov_1/models", "GET");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
        }),
      );
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "GET",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1/models",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(403);
      const body = JSON.parse(getBody()) as { error: string; message: string };
      expect(body.error).toBe("provider_request_failed");
      expect(body.message).toContain("403");
    });

    it("should return 500 on network error", async () => {
      const route = modelsSetup.findRoute("/api/providers/prov_1/models", "GET");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
      const { res, getStatusCode, getBody } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "GET",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_1/models",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(500);
      const body = JSON.parse(getBody()) as { error: string; message: string };
      expect(body.error).toBe("provider_request_failed");
      expect(body.message).toContain("timeout");
    });

    it("should return 404 for non-existent provider", async () => {
      const route = modelsSetup.findRoute("/api/providers/prov_999/models", "GET");
      const { res, getStatusCode } = createMockResponse();
      const req = createMockRequest({
        headers: { authorization: VALID_TOKEN },
        method: "GET",
      });
      await route!.handler(req, res, {
        path: "/api/providers/prov_999/models",
        clientIp: "127.0.0.1",
      });
      expect(getStatusCode()).toBe(404);
    });
  });
});
