import { useCallback, useRef, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { useApiClient } from "./use-api-client";
import { useChatStore } from "../store/chat";
import { useSessionsStore } from "../store/sessions";
import { buildSessionInfo } from "../utils/session";

const SEND_TIMEOUT_MS = 60_000;

export function useChat() {
  const sendingRef = useRef(false);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { send, reconnect: wsReconnect } = useWebSocket();
  const getApi = useApiClient();
  const addMessage = useChatStore((s) => s.addMessage);
  const setSending = useChatStore((s) => s.setSending);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const markLastMessageFailed = useChatStore((s) => s.markLastMessageFailed);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setActiveSessionId = useSessionsStore((s) => s.setActiveSessionId);
  const addSession = useSessionsStore((s) => s.addSession);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;

    const client = await getApi();
    if (!client) return null;

    try {
      const session = await client.api.createSession(client.token);
      addSession(buildSessionInfo(session));
      setActiveSessionId(session.id);
      clearMessages();
      return session.id;
    } catch {
      return null;
    }
  }, [activeSessionId, getApi, addSession, setActiveSessionId, clearMessages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || sendingRef.current) return;
      sendingRef.current = true;

      const sessionId = await ensureSession();
      if (!sessionId) { sendingRef.current = false; return; }

      const now = Date.now();
      addMessage({
        id: `user-${now}`,
        role: "user",
        content: content.trim(),
        timestamp: now,
      });

      addMessage({
        id: `assistant-${now}`,
        role: "assistant",
        content: "",
        isStreaming: true,
        timestamp: now,
      });

      setSending(true);

      try {
        send({
          type: "message",
          sessionId,
          content: content.trim(),
        });
        if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = setTimeout(() => {
          if (useChatStore.getState().isSending) {
            markLastMessageFailed();
          }
        }, SEND_TIMEOUT_MS);
      } catch {
        markLastMessageFailed();
      } finally {
        sendingRef.current = false;
      }
    },
    [send, addMessage, setSending, markLastMessageFailed, ensureSession],
  );

  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    };
  }, []);

  const switchSession = useCallback(
    (sessionId: string) => {
      clearMessages();
      setActiveSessionId(sessionId || null);
      if (sessionId) {
        send({ type: "switch_session", sessionId });
      }
    },
    [clearMessages, setActiveSessionId, send],
  );

  return { sendMessage, switchSession, reconnect: wsReconnect };
}
