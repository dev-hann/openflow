import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isFailed?: boolean;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  isSending: boolean;

  addMessage: (message: ChatMessage) => void;
  appendToLastMessage: (content: string) => void;
  finalizeLastMessage: (content: string) => void;
  markLastMessageFailed: () => void;
  removeFailedPair: () => void;
  clearMessages: () => void;
  setSending: (sending: boolean) => void;
}

function updateLastAssistant(
  messages: ChatMessage[],
  patch: Partial<ChatMessage>,
): ChatMessage[] {
  const updated = [...messages];
  const last = updated[updated.length - 1];
  if (last && last.role === "assistant") {
    updated[updated.length - 1] = { ...last, ...patch };
  }
  return updated;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isSending: false,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendToLastMessage: (content) =>
    set((state) => ({
      messages: updateLastAssistant(state.messages, {
        content: (state.messages[state.messages.length - 1]?.content ?? "") + content,
        isStreaming: true,
      }),
    })),

  finalizeLastMessage: (content) =>
    set((state) => ({
      messages: updateLastAssistant(state.messages, {
        content,
        isStreaming: false,
        isFailed: false,
      }),
    })),

  markLastMessageFailed: () =>
    set((state) => ({
      messages: updateLastAssistant(state.messages, {
        isStreaming: false,
        isFailed: true,
      }),
      isSending: false,
    })),

  removeFailedPair: () =>
    set((state) => {
      const msgs = state.messages;
      const last = msgs[msgs.length - 1];
      if (last?.role !== "assistant" || !last.isFailed) return state;
      const prev = msgs[msgs.length - 2];
      if (prev?.role === "user") {
        return { messages: msgs.slice(0, -2) };
      }
      return { messages: msgs.slice(0, -1) };
    }),

  clearMessages: () => set({ messages: [] }),
  setSending: (sending) => set({ isSending: sending }),
}));
