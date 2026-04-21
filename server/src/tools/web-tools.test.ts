import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateUrl,
  isPrivateHostname,
  webFetchTool,
  webSearchTool,
  httpClientTool,
} from "./web-tools.js";
import { OpenFlowError } from "../utils/errors.js";

describe("isPrivateHostname", () => {
  it("should detect localhost", () => {
    expect(isPrivateHostname("localhost")).toBe(true);
  });

  it("should detect 127.0.0.1", () => {
    expect(isPrivateHostname("127.0.0.1")).toBe(true);
  });

  it("should detect 10.x private range", () => {
    expect(isPrivateHostname("10.0.0.1")).toBe(true);
  });

  it("should detect 192.168.x private range", () => {
    expect(isPrivateHostname("192.168.1.1")).toBe(true);
  });

  it("should detect 172.16-31.x private range", () => {
    expect(isPrivateHostname("172.16.0.1")).toBe(true);
    expect(isPrivateHostname("172.31.255.1")).toBe(true);
  });

  it("should not flag 172.32.x as private", () => {
    expect(isPrivateHostname("172.32.0.1")).toBe(false);
  });

  it("should detect 169.254.x link-local", () => {
    expect(isPrivateHostname("169.254.1.1")).toBe(true);
  });

  it("should detect IPv6 unique local fc prefix", () => {
    expect(isPrivateHostname("fc00::1")).toBe(true);
  });

  it("should detect IPv6 link-local fe80 prefix", () => {
    expect(isPrivateHostname("fe80::1")).toBe(true);
  });

  it("should detect .local domains", () => {
    expect(isPrivateHostname("myserver.local")).toBe(true);
  });

  it("should detect .internal domains", () => {
    expect(isPrivateHostname("service.internal")).toBe(true);
  });

  it("should allow public hostnames", () => {
    expect(isPrivateHostname("example.com")).toBe(false);
  });

  it("should allow hostnames starting with 10.", () => {
    expect(isPrivateHostname("10.example.com")).toBe(false);
  });

  it("should allow fc-domain.com", () => {
    expect(isPrivateHostname("fc-domain.com")).toBe(false);
  });
});

describe("validateUrl", () => {
  it("should accept valid https URLs", () => {
    expect(() => validateUrl("https://example.com/page")).not.toThrow();
  });

  it("should accept valid http URLs", () => {
    expect(() => validateUrl("http://example.com/page")).not.toThrow();
  });

  it("should throw on invalid URL", () => {
    expect(() => validateUrl("not-a-url")).toThrow("Invalid URL");
  });

  it("should throw on unsupported protocol", () => {
    expect(() => validateUrl("ftp://example.com/file")).toThrow(
      "Unsupported protocol",
    );
  });

  it("should block localhost", () => {
    expect(() => validateUrl("http://localhost:3000/api")).toThrow(
      "private/internal networks",
    );
  });

  it("should block 127.0.0.1", () => {
    expect(() => validateUrl("http://127.0.0.1/secret")).toThrow(
      "private/internal networks",
    );
  });

  it("should block 0.0.0.0", () => {
    expect(() => validateUrl("http://0.0.0.0/")).toThrow(
      "private/internal networks",
    );
  });

  it("should block ::1", () => {
    expect(() => validateUrl("http://[::1]/")).toThrow(
      "private/internal networks",
    );
  });

  it("should block .local domains", () => {
    expect(() => validateUrl("http://myserver.local/")).toThrow(
      "private/internal networks",
    );
  });

  it("should block .internal domains", () => {
    expect(() => validateUrl("http://service.internal/")).toThrow(
      "private/internal networks",
    );
  });

  it("should block 10.x private range", () => {
    expect(() => validateUrl("http://10.0.0.1/")).toThrow(
      "private/internal networks",
    );
  });

  it("should allow hostnames starting with 10.", () => {
    expect(() => validateUrl("http://10.example.com/")).not.toThrow();
  });

  it("should block 192.168.x private range", () => {
    expect(() => validateUrl("http://192.168.1.1/")).toThrow(
      "private/internal networks",
    );
  });

  it("should block 172.16-31.x private range", () => {
    expect(() => validateUrl("http://172.16.0.1/")).toThrow(
      "private/internal networks",
    );
    expect(() => validateUrl("http://172.31.255.1/")).toThrow(
      "private/internal networks",
    );
  });

  it("should allow 172.32.x (not in private range)", () => {
    expect(() => validateUrl("http://172.32.0.1/")).not.toThrow();
  });

  it("should block 169.254.x link-local", () => {
    expect(() => validateUrl("http://169.254.1.1/")).toThrow(
      "private/internal networks",
    );
  });

  it("should block fc-prefix (IPv6 unique local)", () => {
    expect(() => validateUrl("http://[fc00::1]/")).toThrow(
      "private/internal networks",
    );
  });

  it("should block fe80-prefix (IPv6 link-local)", () => {
    expect(() => validateUrl("http://[fe80::1]/")).toThrow(
      "private/internal networks",
    );
  });

  it("should allow fc-domain.com hostname", () => {
    expect(() => validateUrl("https://fc-domain.com/page")).not.toThrow();
  });

  it("should allow fe80-shop.com hostname", () => {
    expect(() => validateUrl("https://fe80-shop.com/")).not.toThrow();
  });
});

describe("webFetchTool", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            "<html><head><script>alert(1)</script><style>body{}</style></head><body><p>Hello &amp; World</p></body></html>",
          ),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should extract plain text from HTML", async () => {
    const result = await webFetchTool.execute({
      url: "https://example.com",
    });
    expect(result).toContain("Hello & World");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("<style>");
  });

  it("should strip script and style tags", async () => {
    const result = await webFetchTool.execute({
      url: "https://example.com",
    });
    expect(result).not.toContain("alert");
    expect(result).not.toContain("body{}");
  });

  it("should truncate long responses", async () => {
    const longHtml = `<html><body><p>${"x".repeat(20_000)}</p></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(longHtml),
      }),
    );

    const result = await webFetchTool.execute({
      url: "https://example.com",
      maxLength: 100,
    });
    expect(result.length).toBeLessThan(200);
    expect(result).toContain("truncated");
  });

  it("should throw on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      }),
    );

    await expect(
      webFetchTool.execute({ url: "https://example.com" }),
    ).rejects.toThrow("Failed to fetch");
  });

  it("should throw on invalid URL", async () => {
    await expect(
      webFetchTool.execute({ url: "ftp://example.com" }),
    ).rejects.toThrow();
  });

  it("should throw on private network URL", async () => {
    await expect(
      webFetchTool.execute({ url: "http://localhost:3000" }),
    ).rejects.toThrow("private/internal networks");
  });
});

describe("webSearchTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should parse DuckDuckGo results", async () => {
    const html = `
      <html><body>
      <a class="result__a" href="https://example.com/page1">Example <b>Result</b></a>
      <a class="result__snippet">Snippet text 1</a>
      <a class="result__a" href="https://example.com/page2">Second Result</a>
      <a class="result__snippet">Snippet text 2</a>
      </body></html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(html),
      }),
    );

    const result = await webSearchTool.execute({ query: "test" });
    expect(result).toContain("Example Result");
    expect(result).toContain("https://example.com/page1");
    expect(result).toContain("Snippet text 1");
  });

  it("should return no results message for empty search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve("<html><body>No results here</body></html>"),
      }),
    );

    const result = await webSearchTool.execute({ query: "obscure query" });
    expect(result).toBe("No results found.");
  });

  it("should limit results to maxResults", async () => {
    const results = Array.from(
      { length: 10 },
      (_, i) =>
        `<a class="result__a" href="https://example.com/${i}">Result ${i}</a>` +
        `<a class="result__snippet">Snippet ${i}</a>`,
    ).join("\n");
    const html = `<html><body>${results}</body></html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(html),
      }),
    );

    const result = await webSearchTool.execute({
      query: "test",
      maxResults: 2,
    });
    expect(result).toContain("Result 0");
    expect(result).toContain("Result 1");
    expect(result).not.toContain("Result 2");
  });

  it("should throw on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve("Service Unavailable"),
      }),
    );

    await expect(webSearchTool.execute({ query: "test" })).rejects.toThrow(
      "Search failed",
    );
  });
});

describe("httpClientTool", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"status":"ok"}'),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should make GET request and return response", async () => {
    const result = await httpClientTool.execute({
      url: "https://api.example.com/data",
      method: "GET",
    });
    expect(result).toContain("Status: 200");
    expect(result).toContain('{"status":"ok"}');
  });

  it("should make POST request with body and headers", async () => {
    await httpClientTool.execute({
      url: "https://api.example.com/data",
      method: "POST",
      headers: '{"Content-Type":"application/json"}',
      body: '{"key":"value"}',
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((opts as RequestInit).method).toBe("POST");
  });

  it("should uppercase method", async () => {
    await httpClientTool.execute({
      url: "https://api.example.com/data",
      method: "delete",
    });

    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((opts as RequestInit).method).toBe("DELETE");
  });

  it("should throw on invalid URL", async () => {
    await expect(
      httpClientTool.execute({
        url: "ftp://example.com",
        method: "GET",
      }),
    ).rejects.toThrow();
  });

  it("should return status text on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      }),
    );

    const result = await httpClientTool.execute({
      url: "https://api.example.com/data",
      method: "GET",
    });
    expect(result).toContain("Status: 403");
    expect(result).toContain("Forbidden");
  });

  it("should throw OpenFlowError on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(
      httpClientTool.execute({
        url: "https://api.example.com/data",
        method: "GET",
      }),
    ).rejects.toThrow(OpenFlowError);
  });
});
