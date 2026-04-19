import { create } from "zustand";
import type { StoredAuth } from "../types/protocol";

interface AuthState {
  storedAuth: StoredAuth | null;
  isConnected: boolean;
  isConnecting: boolean;

  setStoredAuth: (auth: StoredAuth | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  clearAll: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  storedAuth: null,
  isConnected: false,
  isConnecting: false,

  setStoredAuth: (auth) => set({ storedAuth: auth }),
  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  clearAll: () => set({ storedAuth: null, isConnected: false, isConnecting: false }),
}));
