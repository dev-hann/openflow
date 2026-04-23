import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthService } from "./auth.js";
import { createWebAuthService } from "./web-auth.js";

function createMockAuthService(): AuthService {
  return {
    createPairingPin: vi.fn(),
    verifyPinAndIssueTokens: vi.fn(),
    validateAccessToken: vi.fn(),
    refreshTokens: vi.fn(),
    unpair: vi.fn(),
    listDevices: vi.fn(),
    issueTokensForDevice: vi.fn(() => ({
      accessToken: "at_test",
      refreshToken: "rt_test",
      sessionKey: "sk_test",
      accessExpiresAt: Date.now() + 3600_000,
      refreshExpiresAt: Date.now() + 86400_000 * 30,
    })),
  };
}

describe("createWebAuthService", () => {
  let authService: ReturnType<typeof createMockAuthService>;
  let webAuth: ReturnType<typeof createWebAuthService>;

  beforeEach(() => {
    vi.useFakeTimers();
    authService = createMockAuthService();
    webAuth = createWebAuthService(authService);
  });

  it("should create a pending session", () => {
    const result = webAuth.createSession();
    expect(result.sessionId).toMatch(/^[a-f0-9]{32}$/);
    expect(result.expiresInMs).toBe(300_000);
  });

  it("should return pending status for new session", () => {
    const { sessionId } = webAuth.createSession();
    const status = webAuth.getStatus(sessionId);
    expect(status.status).toBe("pending");
  });

  it("should return expired status for unknown session", () => {
    const status = webAuth.getStatus("nonexistent");
    expect(status.status).toBe("expired");
  });

  it("should approve session and issue tokens", () => {
    const { sessionId } = webAuth.createSession();
    const tokens = webAuth.approveSession(sessionId);

    expect(tokens).not.toBeNull();
    expect(tokens!.accessToken).toBe("at_test");
    expect(tokens!.refreshToken).toBe("rt_test");
    expect(authService.issueTokensForDevice).toHaveBeenCalledWith(
      expect.stringMatching(/^web-[a-f0-9]{6}$/),
    );
  });

  it("should return approved status after approval", () => {
    const { sessionId } = webAuth.createSession();
    webAuth.approveSession(sessionId);
    const status = webAuth.getStatus(sessionId);
    expect(status.status).toBe("approved");
    if (status.status === "approved") {
      expect(status.tokens).toBeDefined();
    }
  });

  it("should not approve unknown session", () => {
    const result = webAuth.approveSession("nonexistent");
    expect(result).toBeNull();
  });

  it("should not approve expired session", () => {
    const { sessionId } = webAuth.createSession();
    vi.advanceTimersByTime(300_001);
    const result = webAuth.approveSession(sessionId);
    expect(result).toBeNull();
  });

  it("should not approve session twice", () => {
    const { sessionId } = webAuth.createSession();
    webAuth.approveSession(sessionId);
    const second = webAuth.approveSession(sessionId);
    expect(second).toBeNull();
  });

  it("should expire session after TTL", () => {
    const { sessionId } = webAuth.createSession();
    vi.advanceTimersByTime(300_001);
    const status = webAuth.getStatus(sessionId);
    expect(status.status).toBe("expired");
  });

  it("should generate unique session IDs", () => {
    const a = webAuth.createSession();
    const b = webAuth.createSession();
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});
