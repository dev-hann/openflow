import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReportingRoutes } from "./reporting-routes.js";
import type { AuthService } from "./auth.js";
import type { IssueReporter } from "../../reporting/issue-reporter.js";

function createMockResponse() {
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
  return {
    headers: rest.headers ?? {},
    method: rest.method ?? "POST",
    url: rest.url ?? "/api/errors",
    socket: { remoteAddress: "127.0.0.1" },
    [Symbol.asyncIterator]: async function* () {
      if (body) yield Buffer.from(JSON.stringify(body));
      else yield Buffer.from("");
    },
  } as unknown as IncomingMessage;
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

function createMockIssueReporter(): IssueReporter {
  return {
    report: vi.fn().mockResolvedValue({ ok: true, issueNumber: 42, issueUrl: "https://github.com/test/repo/issues/42" }),
  };
}

describe("reporting-routes", () => {
  const authService = createMockAuthService();
  const issueReporter = createMockIssueReporter();
  const routes = createReportingRoutes({ authService, issueReporter });

  function findRoute(path: string, method: string) {
    return routes.find((r) => r.match(path, method));
  }

  it("should return 401 without auth", async () => {
    const found = findRoute("/api/errors", "POST");
    expect(found).toBeDefined();
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({ headers: {} });
    await found!.handler(req, res, { path: "/api/errors", clientIp: "127.0.0.1" });
    expect(getStatusCode()).toBe(401);
  });

  it("should report error with valid fields", async () => {
    const found = findRoute("/api/errors", "POST");
    const { res, getStatusCode, getBody } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: VALID_TOKEN },
      body: {
        platform: "app",
        version: "1.0.0",
        errorCode: "CRASH",
        message: "App crashed unexpectedly",
      },
    });
    await found!.handler(req, res, { path: "/api/errors", clientIp: "127.0.0.1" });
    expect(getStatusCode()).toBe(200);
    const responseBody = JSON.parse(getBody()) as { ok: boolean; issueNumber: number; issueUrl: string };
    expect(responseBody.ok).toBe(true);
    expect(responseBody.issueNumber).toBe(42);
    expect(responseBody.issueUrl).toBe("https://github.com/test/repo/issues/42");
    expect(issueReporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "app",
        version: "1.0.0",
        errorCode: "CRASH",
        message: "App crashed unexpectedly",
      }),
    );
  });

  it("should reject invalid platform", async () => {
    const found = findRoute("/api/errors", "POST");
    const { res, getStatusCode, getBody } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: VALID_TOKEN },
      body: {
        platform: "mobile",
        errorCode: "CRASH",
        message: "Bad platform",
      },
    });
    await found!.handler(req, res, { path: "/api/errors", clientIp: "127.0.0.1" });
    expect(getStatusCode()).toBe(400);
    const responseBody = JSON.parse(getBody()) as { error: string };
    expect(responseBody.error).toBe("validation_error");
  });

  it("should reject missing required fields", async () => {
    const found = findRoute("/api/errors", "POST");
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: VALID_TOKEN },
      body: {
        platform: "app",
      },
    });
    await found!.handler(req, res, { path: "/api/errors", clientIp: "127.0.0.1" });
    expect(getStatusCode()).toBe(400);
  });

  it("should accept report with stackTrace and metadata", async () => {
    const found = findRoute("/api/errors", "POST");
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: VALID_TOKEN },
      body: {
        platform: "web",
        version: "2.0.0",
        errorCode: "UI_ERROR",
        message: "Button click failed",
        stackTrace: "Error: click\n  at button.js:1",
        metadata: { browser: "Chrome", os: "Linux" },
      },
    });
    await found!.handler(req, res, { path: "/api/errors", clientIp: "127.0.0.1" });
    expect(getStatusCode()).toBe(200);
    expect(issueReporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        stackTrace: "Error: click\n  at button.js:1",
        metadata: { browser: "Chrome", os: "Linux" },
      }),
    );
  });

  it("should use unknown version when not provided", async () => {
    const found = findRoute("/api/errors", "POST");
    const { res, getStatusCode } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: VALID_TOKEN },
      body: {
        platform: "server",
        errorCode: "TIMEOUT",
        message: "Request timeout",
      },
    });
    await found!.handler(req, res, { path: "/api/errors", clientIp: "127.0.0.1" });
    expect(getStatusCode()).toBe(200);
    expect(issueReporter.report).toHaveBeenCalledWith(
      expect.objectContaining({ version: "unknown" }),
    );
  });

  it("should return null issue fields when reporter returns no issue", async () => {
    const localReporter = createMockIssueReporter();
    localReporter.report = vi.fn().mockResolvedValue({ ok: false });
    const localRoutes = createReportingRoutes({ authService, issueReporter: localReporter });
    const found = localRoutes[0]!;

    const { res, getStatusCode, getBody } = createMockResponse();
    const req = createMockRequest({
      headers: { authorization: VALID_TOKEN },
      body: {
        platform: "app",
        errorCode: "ERR",
        message: "test",
      },
    });
    await found.handler(req, res, { path: "/api/errors", clientIp: "127.0.0.1" });
    expect(getStatusCode()).toBe(200);
    const responseBody = JSON.parse(getBody()) as { ok: boolean; issueNumber: null; issueUrl: null };
    expect(responseBody.ok).toBe(false);
    expect(responseBody.issueNumber).toBeNull();
    expect(responseBody.issueUrl).toBeNull();
  });
});
