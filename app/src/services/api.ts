import type { TokenPair, SessionInfo, StoredAuth } from "../types/protocol";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      accessToken?: string;
    } = {},
  ): Promise<unknown> {
    const { method = "GET", body, accessToken } = options;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await resp.json()) as Record<string, unknown>;
    if (!resp.ok) {
      const error = (json.error as string) ?? "unknown_error";
      const message = (json.message as string) ?? error;
      throw new ApiError(resp.status, error, message);
    }
    return json;
  }

  async pairInit(): Promise<{ expiresInMs: number }> {
    const resp = (await this.request("/api/auth/pair/init", { method: "POST" })) as {
      expiresInMs: number;
    };
    return resp;
  }

  async pairVerify(pin: string, label: string): Promise<TokenPair> {
    return (await this.request("/api/auth/pair/verify", {
      method: "POST",
      body: { pin, label },
    })) as Promise<TokenPair>;
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return (await this.request("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    })) as Promise<TokenPair>;
  }

  async unpair(accessToken: string): Promise<void> {
    await this.request("/api/auth/unpair", { method: "DELETE", accessToken });
  }

  async listSessions(accessToken: string): Promise<SessionInfo[]> {
    const resp = (await this.request("/api/sessions", { accessToken })) as {
      sessions: SessionInfo[];
    };
    return resp.sessions;
  }

  async createSession(accessToken: string, title?: string): Promise<SessionInfo> {
    return (await this.request("/api/sessions", {
      method: "POST",
      body: { title: title ?? "New Chat" },
      accessToken,
    })) as Promise<SessionInfo>;
  }

  async deleteSession(accessToken: string, sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}`, { method: "DELETE", accessToken });
  }

  async listModels(accessToken: string): Promise<{ models: string[]; current: string }> {
    return (await this.request("/api/models", { accessToken })) as Promise<{
      models: string[];
      current: string;
    }>;
  }

  async switchModel(accessToken: string, model: string): Promise<void> {
    await this.request("/api/models/current", { method: "PUT", body: { model }, accessToken });
  }

  async getStatus(): Promise<{ status: string; version: string }> {
    return (await this.request("/api/status")) as Promise<{ status: string; version: string }>;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}
