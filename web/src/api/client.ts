import type {
  PairInitResponse,
  PairVerifyRequest,
  RefreshRequest,
  TokenPairResponse,
  SessionInfo,
  ChatMessage,
  ProviderInfo,
  WebAuthInitResponse,
  WebAuthStatusResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getBaseUrl(): string {
  return "";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown", message: res.statusText }));
    throw new ApiError(res.status, body.error ?? "unknown", body.message ?? res.statusText);
  }

  return res.json();
}

export const api = {
  pairInit(): Promise<PairInitResponse> {
    return request("/api/auth/pair/init", { method: "POST" });
  },

  pairVerify(body: PairVerifyRequest): Promise<TokenPairResponse> {
    return request("/api/auth/pair/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  refreshToken(body: RefreshRequest): Promise<TokenPairResponse> {
    return request("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  unpair(token: string): Promise<{ ok: boolean }> {
    return request("/api/auth/unpair", { method: "DELETE" }, token);
  },

  getStatus(token: string): Promise<{ status: string }> {
    return request("/api/status", {}, token);
  },

  listSessions(token: string): Promise<{ sessions: SessionInfo[] }> {
    return request("/api/sessions", {}, token);
  },

  createSession(token: string, title?: string): Promise<{ id: string; title: string }> {
    return request(
      "/api/sessions",
      {
        method: "POST",
        body: title ? JSON.stringify({ title }) : undefined,
      },
      token,
    );
  },

  deleteSession(token: string, sessionId: string): Promise<{ ok: boolean }> {
    return request(`/api/sessions/${sessionId}`, { method: "DELETE" }, token);
  },

  getSessionMessages(
    token: string,
    sessionId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ messages: ChatMessage[]; total: number }> {
    return request(
      `/api/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`,
      {},
      token,
    );
  },

  listProviders(token: string): Promise<{ providers: ProviderInfo[]; activeProviderId: string | null }> {
    return request("/api/providers", {}, token);
  },

  switchProvider(token: string, providerId: string): Promise<{ providerId: string }> {
    return request(
      "/api/providers/current",
      {
        method: "PUT",
        body: JSON.stringify({ providerId }),
      },
      token,
    );
  },

  webAuthInit(): Promise<WebAuthInitResponse> {
    return request("/api/auth/web/init", { method: "POST" });
  },

  webAuthStatus(sessionId: string): Promise<WebAuthStatusResponse> {
    return request(`/api/auth/web/status/${sessionId}`, {});
  },
};
