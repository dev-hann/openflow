import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  extractBearerToken,
  requireAuth,
  sendJson,
  readJsonBody,
  readJsonObject,
  requireBodyStrings,
  setCorsHeaders,
  handleOptions,
} from "./middleware.js";
import type { AuthService } from "./auth.js";

function createMockRequest(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    headers: {},
    method: "GET",
    url: "/",
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as IncomingMessage;
}

function createMockResponse(): {
  res: ServerResponse;
  getHeaders: () => Record<string, string>;
  getStatusCode: () => number;
  getBody: () => string;
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
    getHeaders: () => headers,
    getStatusCode: () => statusCode,
    getBody: () => body,
  };
}

describe("extractBearerToken", () => {
  it("should extract Bearer token from Authorization header", () => {
    const req = createMockRequest({
      headers: { authorization: "Bearer abc123" },
    });
    expect(extractBearerToken(req)).toBe("abc123");
  });

  it("should return null when no Authorization header", () => {
    const req = createMockRequest();
    expect(extractBearerToken(req)).toBeNull();
  });

  it("should return null for non-Bearer scheme", () => {
    const req = createMockRequest({
      headers: { authorization: "Basic abc123" },
    });
    expect(extractBearerToken(req)).toBeNull();
  });

  it("should return null for empty Bearer token", () => {
    const req = createMockRequest({
      headers: { authorization: "Bearer  " },
    });
    expect(extractBearerToken(req)).toBeNull();
  });
});

describe("requireAuth", () => {
  const mockAuthService = {
    validateAccessToken:
      vi.fn<(token: string) => { sessionKey: string; expiresAt: number } | null>(),
  } as unknown as AuthService;

  beforeEach(() => {
    vi.mocked(mockAuthService.validateAccessToken).mockReset();
  });

  it("should return auth result for valid token", () => {
    vi.mocked(mockAuthService.validateAccessToken).mockReturnValue({
      sessionKey: "sk1",
      expiresAt: Date.now() + 60_000,
    });
    const { res } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: "Bearer valid-token" },
    });

    const result = requireAuth(req, res, mockAuthService);
    expect(result).toEqual({ sessionKey: "sk1" });
  });

  it("should return null and send 401 when no token", () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest();

    const result = requireAuth(req, res, mockAuthService);
    expect(result).toBeNull();
    expect(getStatusCode()).toBe(401);
  });

  it("should return null and send 401 for invalid token", () => {
    vi.mocked(mockAuthService.validateAccessToken).mockReturnValue(null);
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: "Bearer bad-token" },
    });

    const result = requireAuth(req, res, mockAuthService);
    expect(result).toBeNull();
    expect(getStatusCode()).toBe(401);
  });
});

describe("sendJson", () => {
  it("should send JSON response with correct headers", () => {
    const { res, getStatusCode, getBody, getHeaders } = createMockResponse();

    sendJson(res, 200, { hello: "world" });

    expect(getStatusCode()).toBe(200);
    expect(getHeaders()["Content-Type"]).toBe("application/json");
    const body = JSON.parse(getBody()) as { hello: string };
    expect(body.hello).toBe("world");
  });

  it("should send error status", () => {
    const { res, getStatusCode } = createMockResponse();

    sendJson(res, 404, { error: "not_found" });
    expect(getStatusCode()).toBe(404);
  });
});

describe("readJsonBody", () => {
  it("should parse JSON body", async () => {
    const data = JSON.stringify({ name: "test" });
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from(data);
    };

    const result = await readJsonBody(req);
    expect(result).toEqual({ name: "test" });
  });

  it("should return empty object for empty body", async () => {
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from("");
    };

    const result = await readJsonBody(req);
    expect(result).toEqual({});
  });

  it("should return null for invalid JSON", async () => {
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from("not json");
    };

    const result = await readJsonBody(req);
    expect(result).toBeNull();
  });

  it("should reject body exceeding max size", async () => {
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.alloc(1024 * 1024 + 1);
    };

    await expect(readJsonBody(req)).rejects.toThrow("too large");
  });
});

describe("setCorsHeaders", () => {
  it("should set CORS headers when enabled", () => {
    const { res, getHeaders } = createMockResponse();
    setCorsHeaders(res, true);
    expect(getHeaders()["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("should not set CORS headers when disabled", () => {
    const { res, getHeaders } = createMockResponse();
    setCorsHeaders(res, false);
    expect(getHeaders()["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("handleOptions", () => {
  it("should handle OPTIONS request with CORS enabled", () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({ method: "OPTIONS" });

    const handled = handleOptions(req, res, true);
    expect(handled).toBe(true);
    expect(getStatusCode()).toBe(204);
  });

  it("should not handle non-OPTIONS request", () => {
    const { res } = createMockResponse();
    const req = createMockRequest({ method: "GET" });

    const handled = handleOptions(req, res, true);
    expect(handled).toBe(false);
  });

  it("should still handle OPTIONS when CORS disabled", () => {
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({ method: "OPTIONS" });

    const handled = handleOptions(req, res, false);
    expect(handled).toBe(true);
    expect(getStatusCode()).toBe(204);
  });
});

describe("readJsonObject", () => {
  it("should return object for valid JSON body", async () => {
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from(JSON.stringify({ key: "value" }));
    };
    const { res } = createMockResponse();

    const result = await readJsonObject(req, res);
    expect(result).toEqual({ key: "value" });
  });

  it("should return null and send 400 for invalid JSON body", async () => {
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from("not json");
    };
    const { res, getStatusCode } = createMockResponse();

    const result = await readJsonObject(req, res);
    expect(result).toBeNull();
    expect(getStatusCode()).toBe(400);
  });

  it("should return parsed array body as-is (arrays are objects in JS)", async () => {
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from("[1,2,3]");
    };
    const { res } = createMockResponse();

    const result = await readJsonObject(req, res);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should return null and send 400 for null body", async () => {
    const req = createMockRequest();
    req[Symbol.asyncIterator] = async function* () {
      yield Buffer.from("not json");
    };
    const { res, getStatusCode } = createMockResponse();

    const result = await readJsonObject(req, res);
    expect(result).toBeNull();
    expect(getStatusCode()).toBe(400);
  });
});

describe("requireBodyStrings", () => {
  it("should extract string values for given keys", () => {
    const body = { name: "test", token: "abc", count: 42 };
    const result = requireBodyStrings(body, ["name", "token", "count"]);
    expect(result).toEqual({ name: "test", token: "abc", count: undefined });
  });

  it("should return undefined for missing keys", () => {
    const body = { name: "test" };
    const result = requireBodyStrings(body, ["name", "missing"]);
    expect(result).toEqual({ name: "test", missing: undefined });
  });

  it("should return undefined for all missing keys", () => {
    const body = { other: 123 };
    const result = requireBodyStrings(body, ["name", "token"]);
    expect(result).toEqual({ name: undefined, token: undefined });
  });
});
