import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { truncate, fetchWithRedirects, parseHeadersJson } from "./utils.js";

describe("truncate", () => {
  it("should return string as-is when within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("should truncate and append summary", () => {
    const result = truncate("a".repeat(20), 10);
    expect(result).toContain("truncated");
    expect(result).toContain("20 bytes total");
    expect(result.length).toBeLessThan(50);
  });

  it("should handle exact-length string", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("should handle empty string", () => {
    expect(truncate("", 10)).toBe("");
  });
});

describe("fetchWithRedirects", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200, statusText: "OK" })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return response directly when no redirect", async () => {
    const resp = await fetchWithRedirects("https://example.com", {});
    expect(resp.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("should follow 301 redirect", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: "https://example.com/new" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200, statusText: "OK" }));
    vi.stubGlobal("fetch", mockFetch);

    const resp = await fetchWithRedirects("https://example.com/old", {});
    expect(resp.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should follow 302 redirect", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/new-path" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200, statusText: "OK" }));
    vi.stubGlobal("fetch", mockFetch);

    const resp = await fetchWithRedirects("https://example.com/old", {});
    expect(resp.status).toBe(200);
  });

  it("should stop redirecting when location header missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 301 })));

    const resp = await fetchWithRedirects("https://example.com", {});
    expect(resp.status).toBe(301);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("should call validateUrlFn for each redirect", async () => {
    const validate = vi.fn();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: "https://other.com/page" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200, statusText: "OK" }));
    vi.stubGlobal("fetch", mockFetch);

    await fetchWithRedirects("https://example.com", {}, validate);
    expect(validate).toHaveBeenCalledWith("https://other.com/page");
  });

  it("should stop after max redirects", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 301,
        headers: { location: "https://example.com/loop" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const resp = await fetchWithRedirects("https://example.com/start", {});
    expect(resp.status).toBe(301);
    expect(mockFetch.mock.calls.length).toBe(6);
  });
});

describe("parseHeadersJson", () => {
  it("should parse valid JSON headers", () => {
    const result = parseHeadersJson('{"Content-Type":"application/json"}');
    expect(result).toEqual({ "Content-Type": "application/json" });
  });

  it("should return empty object for undefined", () => {
    expect(parseHeadersJson(undefined)).toEqual({});
  });

  it("should return empty object for empty string", () => {
    expect(parseHeadersJson("")).toEqual({});
  });

  it("should throw on invalid JSON", () => {
    expect(() => parseHeadersJson("not json")).toThrow("Invalid headers JSON");
  });

  it("should throw on non-object JSON", () => {
    expect(() => parseHeadersJson('"hello"')).toThrow("Invalid headers JSON");
  });

  it("should throw on array JSON", () => {
    expect(() => parseHeadersJson("[1,2,3]")).toThrow("Invalid headers JSON");
  });

  it("should throw on null JSON", () => {
    expect(() => parseHeadersJson("null")).toThrow("Invalid headers JSON");
  });

  it("should throw on non-string header value", () => {
    expect(() => parseHeadersJson('{"X-Custom":123}')).toThrow("keys and values must be strings");
  });

  it("should accept multiple valid headers", () => {
    const raw = '{"Accept":"*/*","Authorization":"Bearer test"}';
    const result = parseHeadersJson(raw);
    expect(result).toEqual({
      Accept: "*/*",
      Authorization: "Bearer test",
    });
  });
});
