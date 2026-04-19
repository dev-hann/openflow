import type { SessionInfo } from "../types/protocol";

interface SessionCreateResult {
  id: string;
  title: string;
}

export function buildSessionInfo(session: SessionCreateResult): SessionInfo {
  const now = Date.now();
  return {
    id: session.id,
    title: session.title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
}
