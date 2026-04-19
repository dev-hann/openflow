import type { TokenPair, SessionInfo, StoredAuth, ProviderInfo } from "../types/protocol";

export function normalizeUrl(url: string): string {
  let trimmed = url.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed;
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

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeUrl(baseUrl);
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
    const resp = (await this.request("/api/auth/pair/verify", {
      method: "POST",
      body: { pin, label },
    })) as TokenPair;
    return resp;
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const resp = (await this.request("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    })) as TokenPair;
    return resp;
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

  async createSession(accessToken: string, title?: string): Promise<Pick<SessionInfo, "id" | "title">> {
    const resp = (await this.request("/api/sessions", {
      method: "POST",
      body: { title: title ?? "New Chat" },
      accessToken,
    })) as Pick<SessionInfo, "id" | "title">;
    return resp;
  }

  async deleteSession(accessToken: string, sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}`, { method: "DELETE", accessToken });
  }

  async listModels(accessToken: string): Promise<{ models: string[]; current: string }> {
    const resp = (await this.request("/api/models", { accessToken })) as {
      models: string[];
      current: string;
    };
    return resp;
  }

  async switchModel(accessToken: string, model: string): Promise<void> {
    await this.request("/api/models/current", { method: "PUT", body: { model }, accessToken });
  }

  async getStatus(): Promise<{ status: string; version: string }> {
    const resp = (await this.request("/api/status")) as { status: string; version: string };
    return resp;
  }

  async listProviders(accessToken: string): Promise<{ providers: ProviderInfo[]; activeProviderId: string }> {
    const resp = (await this.request("/api/providers", { accessToken })) as {
      providers: ProviderInfo[];
      activeProviderId: string;
    };
    return resp;
  }

  async createProvider(
    accessToken: string,
    params: { name: string; baseUrl: string; apiKey: string; model: string; isDefault?: boolean },
  ): Promise<ProviderInfo> {
    const resp = (await this.request("/api/providers", {
      method: "POST",
      body: params,
      accessToken,
    })) as ProviderInfo;
    return resp;
  }

  async updateProvider(
    accessToken: string,
    id: string,
    params: Partial<Pick<ProviderInfo, "name" | "baseUrl" | "apiKey" | "model">>,
  ): Promise<ProviderInfo> {
    const resp = (await this.request(`/api/providers/${id}`, {
      method: "PUT",
      body: params,
      accessToken,
    })) as ProviderInfo;
    return resp;
  }

  async deleteProvider(accessToken: string, id: string): Promise<void> {
    await this.request(`/api/providers/${id}`, { method: "DELETE", accessToken });
  }

  async verifyProvider(accessToken: string, id: string): Promise<{ ok: boolean; error?: string }> {
    const resp = (await this.request(`/api/providers/${id}/verify`, {
      method: "POST",
      accessToken,
    })) as { ok: boolean; error?: string };
    return resp;
  }

  async fetchProviderModels(accessToken: string, id: string): Promise<string[]> {
    const resp = (await this.request(`/api/providers/${id}/models`, { accessToken })) as {
      models: string[];
    };
    return resp.models;
  }

  async switchProvider(accessToken: string, providerId: string): Promise<void> {
    await this.request("/api/providers/current", {
      method: "PUT",
      body: { providerId },
      accessToken,
    });
  }
}

export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}
