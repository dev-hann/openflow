import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isSending: boolean;

  addMessage: (message: ChatMessage) => void;
  appendToLastMessage: (content: string) => void;
  finalizeLastMessage: (content: string) => void;
  clearMessages: () => void;
  setSending: (sending: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isSending: false,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendToLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + content,
          isStreaming: true,
        };
      }
      return { messages };
    }),

  finalizeLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          content,
          isStreaming: false,
        };
      }
      return { messages };
    }),

  clearMessages: () => set({ messages: [] }),
  setSending: (sending) => set({ isSending: sending }),
}));
