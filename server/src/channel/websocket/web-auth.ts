import { randomBytes } from "node:crypto";

import { createLogger } from "../../utils/logger.js";
import type { AuthService, TokenPair } from "./auth.js";

const log = createLogger("ws/web-auth");

const WEB_SESSION_TTL_MS = 5 * 60 * 1000;

interface PendingWebSession {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  tokens: TokenPair | null;
}

export interface WebAuthService {
  createSession(): { sessionId: string; expiresInMs: number };
  approveSession(sessionId: string): TokenPair | null;
  getStatus(sessionId: string): { status: "pending" | "approved" | "expired"; tokens?: TokenPair };
  dispose(): void;
}

export function createWebAuthService(authService: AuthService): WebAuthService {
  const sessions = new Map<string, PendingWebSession>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now > session.expiresAt) sessions.delete(id);
    }
  }, 60_000);
  cleanupInterval.unref();

  function createSession(): { sessionId: string; expiresInMs: number } {
    const sessionId = randomBytes(16).toString("hex");
    const now = Date.now();
    sessions.set(sessionId, {
      sessionId,
      createdAt: now,
      expiresAt: now + WEB_SESSION_TTL_MS,
      tokens: null,
    });
    log.info({ sessionId }, "web auth session created");
    return { sessionId, expiresInMs: WEB_SESSION_TTL_MS };
  }

  function approveSession(sessionId: string): TokenPair | null {
    const session = sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
      sessions.delete(sessionId);
      log.warn({ sessionId }, "web auth session not found or expired");
      return null;
    }
    if (session.tokens) {
      log.warn({ sessionId }, "web auth session already approved");
      return null;
    }

    const tokens = authService.issueTokensForDevice(`web-${sessionId.slice(0, 6)}`);
    session.tokens = tokens;
    log.info({ sessionId }, "web auth session approved");
    return tokens;
  }

  function getStatus(sessionId: string): { status: "pending" | "approved" | "expired"; tokens?: TokenPair } {
    const session = sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
      sessions.delete(sessionId);
      return { status: "expired" };
    }
    if (session.tokens) {
      return { status: "approved", tokens: session.tokens };
    }
    return { status: "pending" };
  }

  function dispose(): void {
    clearInterval(cleanupInterval);
    sessions.clear();
  }

  return { createSession, approveSession, getStatus, dispose };
}
