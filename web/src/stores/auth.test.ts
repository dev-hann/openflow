import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "./auth";
import type { TokenPairResponse } from "@/api/types";

vi.mock("@/api/client", () => ({
  api: {
    refreshToken: vi.fn(),
  },
}));

import { api } from "@/api/client";

const mockToken: TokenPairResponse = {
  accessToken: "at_test-token",
  refreshToken: "rt_test-refresh",
  sessionKey: "sk_test-session",
  accessExpiresAt: Date.now() + 3600_000,
  refreshExpiresAt: Date.now() + 86400_000 * 30,
};

beforeEach(() => {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    sessionKey: null,
    accessExpiresAt: null,
    refreshExpiresAt: null,
    isAuthenticated: false,
  });
  localStorage.clear();
  vi.mocked(api.refreshToken).mockReset();
});

describe("useAuthStore", () => {
  it("should set tokens and persist to localStorage", () => {
    useAuthStore.getState().setTokens(mockToken);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("at_test-token");
    expect(state.refreshToken).toBe("rt_test-refresh");
    expect(state.isAuthenticated).toBe(true);

    const stored = JSON.parse(localStorage.getItem("openflow_auth")!);
    expect(stored.accessToken).toBe("at_test-token");
  });

  it("should load valid tokens from storage", () => {
    localStorage.setItem("openflow_auth", JSON.stringify(mockToken));
    useAuthStore.getState().loadFromStorage();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("at_test-token");
  });

  it("should clear expired tokens from storage", () => {
    const expired = {
      ...mockToken,
      accessExpiresAt: Date.now() - 1000,
      refreshExpiresAt: Date.now() - 1000,
    };
    localStorage.setItem("openflow_auth", JSON.stringify(expired));
    useAuthStore.getState().loadFromStorage();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("openflow_auth")).toBeNull();
  });

  it("should not load when no storage data", () => {
    useAuthStore.getState().loadFromStorage();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("should clear storage on invalid JSON", () => {
    localStorage.setItem("openflow_auth", "not-json");
    useAuthStore.getState().loadFromStorage();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("openflow_auth")).toBeNull();
  });

  it("should refresh access token successfully", async () => {
    const newTokens: TokenPairResponse = {
      ...mockToken,
      accessToken: "at_new-access",
      accessExpiresAt: Date.now() + 3600_000,
    };
    vi.mocked(api.refreshToken).mockResolvedValue(newTokens);

    useAuthStore.getState().setTokens(mockToken);
    const result = await useAuthStore.getState().refreshAccess();

    expect(result).toBe("at_new-access");
    expect(useAuthStore.getState().accessToken).toBe("at_new-access");
  });

  it("should logout on refresh failure", async () => {
    vi.mocked(api.refreshToken).mockRejectedValue(new Error("fail"));
    useAuthStore.getState().setTokens(mockToken);

    const result = await useAuthStore.getState().refreshAccess();

    expect(result).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("openflow_auth")).toBeNull();
  });

  it("should return null when no refresh token", async () => {
    const result = await useAuthStore.getState().refreshAccess();
    expect(result).toBeNull();
    expect(api.refreshToken).not.toHaveBeenCalled();
  });

  it("should clear all state on logout", () => {
    useAuthStore.getState().setTokens(mockToken);
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(localStorage.getItem("openflow_auth")).toBeNull();
  });
});
