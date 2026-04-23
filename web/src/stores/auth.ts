import { create } from "zustand";
import type { TokenPairResponse } from "@/api/types";
import { api } from "@/api/client";

const STORAGE_KEY = "openflow_auth";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sessionKey: string | null;
  accessExpiresAt: number | null;
  refreshExpiresAt: number | null;

  isAuthenticated: boolean;

  setTokens: (tokens: TokenPairResponse) => void;
  refreshAccess: () => Promise<string | null>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  sessionKey: null,
  accessExpiresAt: null,
  refreshExpiresAt: null,
  isAuthenticated: false,

  setTokens: (tokens) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionKey: tokens.sessionKey,
      accessExpiresAt: tokens.accessExpiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
      isAuthenticated: true,
    });
  },

  refreshAccess: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return null;
    try {
      const tokens = await api.refreshToken({ refreshToken });
      get().setTokens(tokens);
      return tokens.accessToken;
    } catch {
      get().logout();
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      accessToken: null,
      refreshToken: null,
      sessionKey: null,
      accessExpiresAt: null,
      refreshExpiresAt: null,
      isAuthenticated: false,
    });
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const tokens = JSON.parse(raw) as TokenPairResponse;
      if (tokens.accessExpiresAt && Date.now() < tokens.refreshExpiresAt) {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionKey: tokens.sessionKey,
          accessExpiresAt: tokens.accessExpiresAt,
          refreshExpiresAt: tokens.refreshExpiresAt,
          isAuthenticated: true,
        });
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
}));
