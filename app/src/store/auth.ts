import { create } from "zustand";
import type { StoredAuth, TokenPair } from "../types/protocol";
import { isStoredAuth } from "../types/protocol";
import { createApiClient } from "../services/api";
import { saveAuth, clearAuth } from "../services/auth";

interface AuthState {
  storedAuth: StoredAuth | null;
  isConnected: boolean;

  setStoredAuth: (auth: StoredAuth | null) => void;
  setConnected: (connected: boolean) => void;
  clearAll: () => void;
  getValidToken: () => Promise<string | null>;
  updateTokens: (tokens: TokenPair) => Promise<void>;
}

let refreshPromise: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  storedAuth: null,
  isConnected: false,

  setStoredAuth: (auth) => {
    if (auth !== null && !isStoredAuth(auth)) return;
    set({ storedAuth: auth });
  },
  setConnected: (connected) => set({ isConnected: connected }),
  clearAll: () => set({ storedAuth: null, isConnected: false }),

  getValidToken: async () => {
    const auth = get().storedAuth;
    if (!auth || !isStoredAuth(auth)) return null;
    if (Date.now() < auth.accessExpiresAt - 60_000) return auth.accessToken;

    if (Date.now() >= auth.refreshExpiresAt) {
      await clearAuth();
      set({ storedAuth: null, isConnected: false });
      return null;
    }

    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const currentAuth = get().storedAuth;
        if (!currentAuth) return null;
        if (Date.now() < currentAuth.accessExpiresAt - 60_000) return currentAuth.accessToken;

        const api = createApiClient(currentAuth.serverUrl);
        const tokens = await api.refreshToken(currentAuth.refreshToken);
        const newAuth: StoredAuth = { serverUrl: currentAuth.serverUrl, ...tokens };
        await saveAuth(newAuth);
        set({ storedAuth: newAuth });
        return newAuth.accessToken;
      } catch {
        const currentAuth = get().storedAuth;
        if (currentAuth && Date.now() >= currentAuth.refreshExpiresAt) {
          await clearAuth();
          set({ storedAuth: null, isConnected: false });
        }
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  updateTokens: async (tokens) => {
    const auth = get().storedAuth;
    if (!auth) return;
    const newAuth: StoredAuth = { serverUrl: auth.serverUrl, ...tokens };
    await saveAuth(newAuth);
    set({ storedAuth: newAuth });
  },
}));
