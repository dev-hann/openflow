import type { TokenPair, SessionInfo, StoredAuth, ProviderInfo } from "../types/protocol";
import { normalizeUrl } from "../utils/normalize-url";

export { normalizeUrl } from "../utils/normalize-url";

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

  private async typedRequest<T>(path: string, options?: Parameters<ApiClient["request"]>[1]): Promise<T> {
    return (await this.request(path, options)) as T;
  }

  async pairInit(): Promise<{ expiresInMs: number }> {
    return this.typedRequest<{ expiresInMs: number }>("/api/auth/pair/init", { method: "POST" });
  }

  async pairVerify(pin: string, label: string): Promise<TokenPair> {
    return this.typedRequest<TokenPair>("/api/auth/pair/verify", {
      method: "POST",
      body: { pin, label },
    });
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.typedRequest<TokenPair>("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
  }

  async unpair(accessToken: string): Promise<void> {
    await this.request("/api/auth/unpair", { method: "DELETE", accessToken });
  }

  async listSessions(accessToken: string): Promise<SessionInfo[]> {
    const resp = await this.typedRequest<{ sessions: SessionInfo[] }>("/api/sessions", { accessToken });
    return resp.sessions;
  }

  async createSession(accessToken: string, title?: string): Promise<Pick<SessionInfo, "id" | "title">> {
    return this.typedRequest<Pick<SessionInfo, "id" | "title">>("/api/sessions", {
      method: "POST",
      body: { title: title ?? "New Chat" },
      accessToken,
    });
  }

  async deleteSession(accessToken: string, sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}`, { method: "DELETE", accessToken });
  }

  async listModels(accessToken: string): Promise<{ models: string[]; current: string }> {
    return this.typedRequest<{ models: string[]; current: string }>("/api/models", { accessToken });
  }

  async switchModel(accessToken: string, model: string): Promise<void> {
    await this.request("/api/models/current", { method: "PUT", body: { model }, accessToken });
  }

  async getStatus(): Promise<{ status: string; version: string }> {
    return this.typedRequest<{ status: string; version: string }>("/api/status");
  }

  async listProviders(accessToken: string): Promise<{ providers: ProviderInfo[]; activeProviderId: string }> {
    return this.typedRequest<{ providers: ProviderInfo[]; activeProviderId: string }>("/api/providers", { accessToken });
  }

  async createProvider(
    accessToken: string,
    params: { name: string; baseUrl: string; apiKey: string; model: string; isDefault?: boolean },
  ): Promise<ProviderInfo> {
    return this.typedRequest<ProviderInfo>("/api/providers", {
      method: "POST",
      body: params,
      accessToken,
    });
  }

  async updateProvider(
    accessToken: string,
    id: string,
    params: Partial<Pick<ProviderInfo, "name" | "baseUrl" | "apiKey" | "model">>,
  ): Promise<ProviderInfo> {
    return this.typedRequest<ProviderInfo>(`/api/providers/${id}`, {
      method: "PUT",
      body: params,
      accessToken,
    });
  }

  async deleteProvider(accessToken: string, id: string): Promise<void> {
    await this.request(`/api/providers/${id}`, { method: "DELETE", accessToken });
  }

  async verifyProvider(accessToken: string, id: string): Promise<{ ok: boolean; error?: string }> {
    return this.typedRequest<{ ok: boolean; error?: string }>(`/api/providers/${id}/verify`, {
      method: "POST",
      accessToken,
    });
  }

  async fetchProviderModels(accessToken: string, id: string): Promise<string[]> {
    const resp = await this.typedRequest<{ models: string[] }>(`/api/providers/${id}/models`, { accessToken });
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
