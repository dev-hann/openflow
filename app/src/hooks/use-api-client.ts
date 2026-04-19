import { useCallback } from "react";
import { useAuthStore } from "../store/auth";
import { createApiClient, type ApiClient } from "../services/api";

export function useApiClient() {
  const storedAuth = useAuthStore((s) => s.storedAuth);
  const getValidToken = useAuthStore((s) => s.getValidToken);

  return useCallback(async (): Promise<{
    api: ApiClient;
    token: string;
  } | null> => {
    const token = await getValidToken();
    if (!token || !storedAuth) return null;
    return { api: createApiClient(storedAuth.serverUrl), token };
  }, [storedAuth, getValidToken]);
}
