import { useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { api } from "@/api/client";
import { WsClient, buildWsUrl } from "@/api/ws";
import type { WsServerMessage } from "@/api/types";
import { MessageList } from "@/components/MessageBubble";
import { InputBar } from "@/components/InputBar";
import { SessionList } from "@/components/SessionList";

export function ChatPage() {
  const { accessToken, logout } = useAuthStore();
  const {
    sessions,
    activeSessionId,
    messages,
    streamingContent,
    isStreaming,
    setSessions,
    setActiveSession,
    setMessages,
    appendStreaming,
    finishStreaming,
    sendMessage,
    switchSession,
    setWs,
  } = useChatStore();

  const loadSessions = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await api.listSessions(accessToken);
      setSessions(res.sessions);
    } catch {
      // ignore
    }
  }, [accessToken, setSessions]);

  const loadMessages = useCallback(
    async (sessionId: string) => {
      if (!accessToken) return;
      try {
        const res = await api.getSessionMessages(accessToken, sessionId);
        setMessages(res.messages);
      } catch {
        // ignore
      }
    },
    [accessToken, setMessages],
  );

  const connectWs = useCallback(async () => {
    if (!accessToken) return;
    const client = new WsClient(buildWsUrl(), accessToken);

    client.onMessage((msg: WsServerMessage) => {
      switch (msg.type) {
        case "token":
          appendStreaming(msg.content);
          break;
        case "response":
          finishStreaming(msg.content);
          loadSessions();
          break;
        case "error":
          finishStreaming("");
          break;
        case "session_switched":
          loadMessages(msg.sessionId);
          break;
      }
    });

    await client.connect();
    setWs(client);
  }, [accessToken, appendStreaming, finishStreaming, loadSessions, loadMessages, setWs]);

  useEffect(() => {
    loadSessions();
    connectWs();
    return () => {
      useChatStore.getState().ws?.dispose();
      setWs(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSession(id);
      switchSession(id);
      loadMessages(id);
    },
    [setActiveSession, switchSession, loadMessages],
  );

  const handleCreateSession = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await api.createSession(accessToken);
      await loadSessions();
      handleSelectSession(res.id);
    } catch {
      // ignore
    }
  }, [accessToken, loadSessions, handleSelectSession]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      try {
        await api.deleteSession(accessToken, id);
        await loadSessions();
        if (activeSessionId === id) {
          setActiveSession(null);
          setMessages([]);
        }
      } catch {
        // ignore
      }
    },
    [accessToken, loadSessions, activeSessionId, setActiveSession, setMessages],
  );

  const handleSend = useCallback(
    (content: string) => {
      if (!activeSessionId) {
        api.createSession(accessToken!).then((res) => {
          setActiveSession(res.id);
          switchSession(res.id);
          useChatStore.getState().ws?.send({
            type: "message",
            sessionId: res.id,
            content,
          });
          setMessages([{ role: "user", content, createdAt: Date.now() }]);
          loadSessions();
        });
        return;
      }
      sendMessage(content);
    },
    [activeSessionId, accessToken, setActiveSession, switchSession, sendMessage, setMessages, loadSessions],
  );

  return (
    <div className="h-screen flex bg-zinc-950 text-white">
      <SessionList
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={handleSelectSession}
        onCreate={handleCreateSession}
        onDelete={handleDeleteSession}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900">
          <span className="text-sm text-zinc-400">
            {activeSessionId
              ? sessions.find((s) => s.id === activeSessionId)?.title || "대화"
              : "새 대화를 시작하세요"}
          </span>
          <div className="ml-auto">
            <button
              onClick={logout}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </header>
        <MessageList
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
        />
        <InputBar onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
