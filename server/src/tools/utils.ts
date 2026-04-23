import { OpenFlowError } from "../utils/errors.js";

export function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new OpenFlowError(`Missing or invalid argument: ${key}`, "TOOL_EXECUTION_FAILED");
  }
  return value;
}

export function requireNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new OpenFlowError(`Missing or invalid argument: ${key}`, "TOOL_EXECUTION_FAILED");
  }
  return value;
}

export function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && !Number.isNaN(value) ? value : undefined;
}

export function optionalBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === "boolean" ? value : undefined;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n... (truncated, ${str.length} bytes total)`;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export async function fetchWithRedirects(
  url: string,
  init: RequestInit,
  validateUrlFn?: (url: string) => void,
): Promise<Response> {
  let currentUrl = url;
  let redirects = 0;
  let resp = await fetch(currentUrl, { ...init, redirect: "manual" });
  while (REDIRECT_STATUSES.has(resp.status) && redirects < MAX_REDIRECTS) {
    const location = resp.headers.get("location");
    if (!location) break;
    const redirectUrl = new URL(location, currentUrl).href;
    validateUrlFn?.(redirectUrl);
    currentUrl = redirectUrl;
    resp = await fetch(currentUrl, { ...init, redirect: "manual" });
    redirects++;
  }
  return resp;
}

export function parseHeadersJson(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new OpenFlowError("Invalid headers JSON", "TOOL_EXECUTION_FAILED");
    }
    for (const [, val] of Object.entries(parsed)) {
      if (typeof val !== "string") {
        throw new OpenFlowError(
          "Invalid headers: keys and values must be strings",
          "TOOL_EXECUTION_FAILED",
        );
      }
    }
    return parsed as Record<string, string>;
  } catch (err: unknown) {
    throw err instanceof OpenFlowError
      ? err
      : new OpenFlowError("Invalid headers JSON", "TOOL_EXECUTION_FAILED", err);
  }
}
