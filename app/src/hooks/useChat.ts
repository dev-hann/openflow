import { useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { useChatStore } from "../store/chat";
import { useSessionsStore } from "../store/sessions";

export function useChat() {
  const { send } = useWebSocket();
  const addMessage = useChatStore((s) => s.addMessage);
  const setSending = useChatStore((s) => s.setSending);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;

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
        sessionId: activeSessionId ?? undefined,
        content: content.trim(),
      });
    },
    [send, addMessage, setSending, activeSessionId],
  );

  return { sendMessage };
}
