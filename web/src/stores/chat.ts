import { create } from "zustand";
import type { SessionInfo, ChatMessage } from "@/api/types";
import type { WsClient } from "@/api/ws";

interface ChatState {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  streamingContent: string | null;
  isStreaming: boolean;
  ws: WsClient | null;

  setSessions: (sessions: SessionInfo[]) => void;
  setActiveSession: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (msg: ChatMessage) => void;
  startStreaming: (content: string) => void;
  appendStreaming: (content: string) => void;
  finishStreaming: (content: string) => void;
  clearStreaming: () => void;
  setWs: (ws: WsClient | null) => void;

  sendMessage: (content: string) => void;
  switchSession: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  streamingContent: null,
  isStreaming: false,
  ws: null,

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  startStreaming: (content) =>
    set({ streamingContent: content, isStreaming: true }),
  appendStreaming: (content) =>
    set((s) => ({ streamingContent: (s.streamingContent ?? "") + content })),
  finishStreaming: (content) =>
    set((s) => ({
      messages: [...s.messages, { role: "assistant", content, createdAt: Date.now() }],
      streamingContent: null,
      isStreaming: false,
    })),
  clearStreaming: () => set({ streamingContent: null, isStreaming: false }),
  setWs: (ws) => set({ ws }),

  sendMessage: (content) => {
    const { ws, activeSessionId } = get();
    if (!ws || !activeSessionId) return;

    set((s) => ({
      messages: [...s.messages, { role: "user" as const, content, createdAt: Date.now() }],
    }));

    ws.send({ type: "message", sessionId: activeSessionId, content });
  },

  switchSession: (sessionId) => {
    const { ws } = get();
    ws?.send({ type: "switch_session", sessionId });
    set({ activeSessionId: sessionId, messages: [], streamingContent: null, isStreaming: false });
  },
}));
