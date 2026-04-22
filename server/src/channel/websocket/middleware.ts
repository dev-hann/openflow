import type { IncomingMessage, ServerResponse } from "node:http";

import type { AuthService } from "./auth.js";
import { createLogger } from "../../utils/logger.js";
import { OpenFlowError } from "../../utils/errors.js";

const log = createLogger("ws/middleware");

export interface AuthResult {
  sessionKey: string;
}

export function extractBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export function requireAuth(
  req: IncomingMessage,
  res: ServerResponse,
  authService: AuthService,
): AuthResult | null {
  const token = extractBearerToken(req);
  if (!token) {
    sendJson(res, 401, {
      error: "missing_authorization",
      message: "Authorization header required",
    });
    return null;
  }

  const payload = authService.validateAccessToken(token);
  if (!payload) {
    sendJson(res, 401, {
      error: "invalid_token",
      message: "Access token expired or invalid",
    });
    return null;
  }

  return { sessionKey: payload.sessionKey };
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

const MAX_BODY_SIZE = 1024 * 1024;

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalSize += buf.length;
    if (totalSize > MAX_BODY_SIZE) {
      throw new OpenFlowError("request body too large", "PERMISSION_DENIED");
    }
    chunks.push(buf);
  }
  const body = Buffer.concat(chunks).toString("utf-8");
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    log.warn("invalid JSON body");
    return null;
  }
}

export async function readJsonObject(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Record<string, unknown> | null> {
  const body = await readJsonBody(req);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_body" });
    return null;
  }
  return body as Record<string, unknown>;
}

export function setCorsHeaders(res: ServerResponse, enabled: boolean): void {
  if (!enabled) return;
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function requireBodyString(body: Record<string, unknown>, key: string): string | undefined {
  const val = body[key];
  return typeof val === "string" ? val : undefined;
}

export function requireBodyStrings(
  body: Record<string, unknown>,
  keys: string[],
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    result[key] = requireBodyString(body, key);
  }
  return result;
}

export function handleOptions(
  req: IncomingMessage,
  res: ServerResponse,
  corsEnabled: boolean,
): boolean {
  if (req.method === "OPTIONS") {
    setCorsHeaders(res, corsEnabled);
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}
