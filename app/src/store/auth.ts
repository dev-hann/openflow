import { create } from "zustand";
import type { StoredAuth, TokenPair } from "../types/protocol";
import { createApiClient, ApiError } from "../services/api";
import { saveAuth } from "../services/auth";

interface AuthState {
  storedAuth: StoredAuth | null;
  isConnected: boolean;
  isConnecting: boolean;

  setStoredAuth: (auth: StoredAuth | null) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  clearAll: () => void;
  getValidToken: () => Promise<string | null>;
  updateTokens: (tokens: TokenPair) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  storedAuth: null,
  isConnected: false,
  isConnecting: false,

  setStoredAuth: (auth) => set({ storedAuth: auth }),
  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  clearAll: () => set({ storedAuth: null, isConnected: false, isConnecting: false }),

  getValidToken: async () => {
    const auth = get().storedAuth;
    if (!auth) return null;
    if (Date.now() < auth.accessExpiresAt - 60_000) return auth.accessToken;

    try {
      const api = createApiClient(auth.serverUrl);
      const tokens = await api.refreshToken(auth.refreshToken);
      const newAuth: StoredAuth = { serverUrl: auth.serverUrl, ...tokens };
      await saveAuth(newAuth);
      set({ storedAuth: newAuth });
      return newAuth.accessToken;
    } catch {
      return null;
    }
  },

  updateTokens: async (tokens) => {
    const auth = get().storedAuth;
    if (!auth) return;
    const newAuth: StoredAuth = { serverUrl: auth.serverUrl, ...tokens };
    await saveAuth(newAuth);
    set({ storedAuth: newAuth });
  },
}));
