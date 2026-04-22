import type { InternalTool } from "./types.js";
import {
  truncate,
  fetchWithRedirects,
  parseHeadersJson,
  requireString,
  optionalString,
  optionalNumber,
} from "./utils.js";
import { OpenFlowError } from "../utils/errors.js";
import { withRetry, isRetryableHttpError } from "../utils/retry.js";

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPrivateHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return true;
  }

  const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  if (isIPv4) {
    const octets = hostname.split(".").map(Number);
    if (
      octets[0]! === 10 ||
      (octets[0]! === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
      (octets[0]! === 192 && octets[1]! === 168) ||
      (octets[0]! === 169 && octets[1]! === 254)
    ) {
      return true;
    }
  }

  if (hostname.includes(":")) {
    if (hostname.startsWith("fc") || hostname.startsWith("fe80")) {
      return true;
    }
  }

  return false;
}

export function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new OpenFlowError(`Invalid URL: ${url}`, "TOOL_EXECUTION_FAILED");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new OpenFlowError(`Unsupported protocol: ${parsed.protocol}`, "TOOL_EXECUTION_FAILED");
  }
  const rawHostname = parsed.hostname.toLowerCase();
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname;
  if (isPrivateHostname(hostname)) {
    throw new OpenFlowError(
      "Requests to private/internal networks are blocked",
      "PERMISSION_DENIED",
    );
  }
}

export const webFetchTool: InternalTool = {
  name: "web_fetch",
  definition: {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch a web page and extract text content",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" },
          maxLength: {
            type: "number",
            description: "Max characters to return (default 10000)",
          },
        },
        required: ["url"],
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const url = requireString(args, "url");
    const maxLen = optionalNumber(args, "maxLength") ?? 10_000;
    validateUrl(url);
    try {
      const html = await withRetry(
        async () => {
          const resp = await fetchWithRedirects(url, {}, validateUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.text();
        },
        { delays: [500, 1000, 2000], shouldRetry: isRetryableHttpError },
      );
      const text = htmlToPlainText(html);
      return truncate(text, maxLen);
    } catch (err: unknown) {
      throw new OpenFlowError(
        `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
        "TOOL_EXECUTION_FAILED",
        err,
      );
    }
  },
};

export const webSearchTool: InternalTool = {
  name: "web_search",
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web using DuckDuckGo",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          maxResults: {
            type: "number",
            description: "Max results (default 5)",
          },
        },
        required: ["query"],
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const query = requireString(args, "query");
    const maxResults = optionalNumber(args, "maxResults") ?? 5;
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const html = await withRetry(
        async () => {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.text();
        },
        { delays: [500, 1000, 2000], shouldRetry: isRetryableHttpError },
      );
      const results: Array<{ title: string; snippet: string; href: string }> = [];
      const resultRegex =
        /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        results.push({
          href: match[1]!,
          title: match[2]!.replace(/<[^>]+>/g, "").trim(),
          snippet: match[3]!.replace(/<[^>]+>/g, "").trim(),
        });
      }
      if (results.length === 0) return "No results found.";
      return results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.href}`)
        .join("\n\n");
    } catch (err: unknown) {
      throw new OpenFlowError(
        `Search failed: ${err instanceof Error ? err.message : String(err)}`,
        "TOOL_EXECUTION_FAILED",
        err,
      );
    }
  },
};

export const httpClientTool: InternalTool = {
  name: "http_request",
  definition: {
    type: "function",
    function: {
      name: "http_request",
      description: "Make an HTTP request",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Request URL" },
          method: {
            type: "string",
            description: "HTTP method (GET, POST, PUT, DELETE)",
          },
          headers: { type: "string", description: "JSON string of headers" },
          body: { type: "string", description: "Request body" },
        },
        required: ["url", "method"],
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const url = requireString(args, "url");
    const method = requireString(args, "method").toUpperCase();
    const headers = parseHeadersJson(optionalString(args, "headers"));
    const body = optionalString(args, "body");
    validateUrl(url);

    try {
      const text = await withRetry(
        async () => {
          const resp = await fetchWithRedirects(url, { method, headers, body }, validateUrl);
          const respText = await resp.text();
          return `Status: ${resp.status}\n${truncate(respText, 10_000)}`;
        },
        { delays: [500, 1000, 2000], shouldRetry: isRetryableHttpError },
      );
      return text;
    } catch (err: unknown) {
      throw new OpenFlowError(
        `HTTP request failed: ${err instanceof Error ? err.message : String(err)}`,
        "TOOL_EXECUTION_FAILED",
        err,
      );
    }
  },
};
