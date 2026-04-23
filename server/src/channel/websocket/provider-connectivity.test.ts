import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchProviderModels,
  verifyProviderConnectivity,
} from "./provider-connectivity.js";

describe("fetchProviderModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch from correct URL with Bearer auth", async () => {
    const mockResponse = { ok: true, status: 200 };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse),
    );

    const result = await fetchProviderModels(
      "https://api.example.com/v1",
      "sk-test-key",
    );

    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/models",
      {
        headers: { Authorization: "Bearer sk-test-key" },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("should strip trailing slash from baseUrl", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    await fetchProviderModels(
      "https://api.example.com/v1/",
      "sk-test-key",
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/models",
      expect.any(Object),
    );
  });

  it("should return raw response for caller to handle", async () => {
    const mockResponse = { ok: false, status: 401 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await fetchProviderModels(
      "https://api.example.com/v1",
      "sk-test-key",
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe("verifyProviderConnectivity", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true when provider responds OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const result = await verifyProviderConnectivity(
      "https://api.example.com/v1",
      "sk-test-key",
    );

    expect(result).toBe(true);
  });

  it("should return false when provider responds non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const result = await verifyProviderConnectivity(
      "https://api.example.com/v1",
      "sk-test-key",
    );

    expect(result).toBe(false);
  });

  it("should return false on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const result = await verifyProviderConnectivity(
      "https://api.example.com/v1",
      "sk-test-key",
    );

    expect(result).toBe(false);
  });
});
