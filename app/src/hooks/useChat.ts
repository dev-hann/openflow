import { useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { useChatStore } from "../store/chat";
import { useSessionsStore } from "../store/sessions";
import { useAuthStore } from "../store/auth";
import { createApiClient } from "../services/api";

export function useChat() {
  const { send } = useWebSocket();
  const addMessage = useChatStore((s) => s.addMessage);
  const setSending = useChatStore((s) => s.setSending);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const addSession = useSessionsStore((s) => s.addSession);
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const getValidToken = useAuthStore((s) => s.getValidToken);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;
    if (!storedAuth) return null;

    const token = await getValidToken();
    if (!token) return null;

    try {
      const api = createApiClient(storedAuth.serverUrl);
      const session = await api.createSession(token);
      const now = Date.now();
      addSession({
        id: session.id,
        title: session.title,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
      });
      setActiveSessionId(session.id);
      return session.id;
    } catch {
      return null;
    }
  }, [activeSessionId, storedAuth, getValidToken, addSession, setActiveSessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const sessionId = await ensureSession();
      if (!sessionId) return;

      addMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
      });

      addMessage({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      setSending(true);
      send({
        type: "message",
        sessionId,
        content: content.trim(),
      });
    },
    [send, addMessage, setSending, ensureSession],
  );

  return { sendMessage };
}
