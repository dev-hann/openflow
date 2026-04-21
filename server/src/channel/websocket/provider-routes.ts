import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger } from "../../utils/logger.js";
import type { ProviderStore, Provider } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { components } from "../../generated/api.js";
import { sendJson, readJsonObject, requireAuth } from "./middleware.js";
import type { AuthService } from "./auth.js";
import { route, routePattern, type Route } from "./routes.js";

const log = createLogger("ws/provider-routes");

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "••••••••";
  return apiKey.slice(0, 4) + "••••" + apiKey.slice(-4);
}

function providerToJson(p: Provider, isActive: boolean): components["schemas"]["ProviderResponse"] {
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: maskApiKey(p.apiKey),
    model: p.model,
    isDefault: p.isDefault,
    isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function fetchProviderModels(baseUrl: string, apiKey: string): Promise<Response> {
  const base = baseUrl.replace(/\/$/, "");
  return fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
}

export interface ProviderRoutesDeps {
  authService: AuthService;
  providerStore: ProviderStore;
  providerPool: ProviderPool;
}

export function createProviderRoutes(deps: ProviderRoutesDeps): Route[] {
  const { authService, providerStore, providerPool } = deps;

  async function handleProvidersList(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const activeId = providerPool.getActiveProviderId();
    const providers = providerStore.listProviders().map((p) => providerToJson(p, p.id === activeId));
    sendJson(res, 200, { providers, activeProviderId: activeId });
  }

  async function handleProviderCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonObject(req, res);
    if (!body) return;
    const name = body.name as string | undefined;
    const baseUrl = body.baseUrl as string | undefined;
    const apiKey = body.apiKey as string | undefined;
    const model = body.model as string | undefined;
    const isDefault = body.isDefault as boolean | undefined;
    if (!name || !baseUrl || !apiKey || !model) {
      sendJson(res, 400, { error: "name, baseUrl, apiKey, model are required" });
      return;
    }
    const provider = providerStore.addProvider({ name, baseUrl, apiKey, model, isDefault });
    providerPool.syncFromStore();
    if (isDefault) providerPool.switchProvider(provider.id);
    log.info({ providerId: provider.id, name }, "provider created via API");

    verifyProviderConnectivity(baseUrl, apiKey).then((verified) => {
      if (!verified) {
        log.warn({ providerId: provider.id, name }, "provider created but connectivity check failed");
      }
    }).catch((err) => {
      log.debug({ err, providerId: provider.id }, "background connectivity check failed");
    });

    sendJson(res, 201, providerToJson(provider, provider.id === providerPool.getActiveProviderId()));
  }

  async function handleProviderUpdate(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.slice("/api/providers/".length);
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    const body = await readJsonObject(req, res);
    if (!body) return;
    const updated = providerStore.updateProvider(providerId, {
      name: body.name as string | undefined,
      baseUrl: body.baseUrl as string | undefined,
      apiKey: body.apiKey as string | undefined,
      model: body.model as string | undefined,
    });
    if (!updated) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    providerPool.syncFromStore();
    log.info({ providerId }, "provider updated via API");
    sendJson(res, 200, providerToJson(updated, updated.id === providerPool.getActiveProviderId()));
  }

  async function handleProviderDelete(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.slice("/api/providers/".length);
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    providerStore.deleteProvider(providerId);
    providerPool.syncFromStore();
    log.info({ providerId }, "provider deleted via API");
    sendJson(res, 200, { ok: true });
  }

  async function handleProviderSwitch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const body = await readJsonObject(req, res);
    if (!body) return;
    const providerId = body.providerId as string | undefined;
    if (!providerId) {
      sendJson(res, 400, { error: "providerId_required" });
      return;
    }
    const provider = providerStore.getProvider(providerId);
    if (!provider) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    providerPool.switchProvider(providerId);
    providerStore.setDefault(providerId);
    log.info({ providerId }, "provider switched via API");
    sendJson(res, 200, { providerId });
  }

  async function handleProviderVerify(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.match(/^\/api\/providers\/([^/]+)\/verify$/)?.[1];
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    const provider = providerStore.getProvider(providerId);
    if (!provider) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    try {
      const resp = await fetchProviderModels(provider.baseUrl, provider.apiKey);
      if (!resp.ok) {
        sendJson(res, 200, { ok: false, error: `HTTP ${resp.status}` });
        return;
      }
      sendJson(res, 200, { ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 200, { ok: false, error: msg });
    }
  }

  async function handleProviderModels(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    const auth = requireAuth(req, res, authService);
    if (!auth) return;
    const providerId = path.match(/^\/api\/providers\/([^/]+)\/models$/)?.[1];
    if (!providerId) {
      sendJson(res, 400, { error: "provider_id_required" });
      return;
    }
    const provider = providerStore.getProvider(providerId);
    if (!provider) {
      sendJson(res, 404, { error: "provider_not_found" });
      return;
    }
    try {
      const resp = await fetchProviderModels(provider.baseUrl, provider.apiKey);
      if (!resp.ok) {
        sendJson(res, resp.status, { error: `Failed to fetch models: HTTP ${resp.status}` });
        return;
      }
      const json = (await resp.json()) as { data?: Array<{ id: string }> };
      const models = (json.data ?? []).map((m) => m.id).sort();
      sendJson(res, 200, { models });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: msg });
    }
  }

  async function verifyProviderConnectivity(baseUrl: string, apiKey: string): Promise<boolean> {
    try {
      const resp = await fetchProviderModels(baseUrl, apiKey);
      return resp.ok;
    } catch {
      return false;
    }
  }

  return [
    route("/api/providers", "GET", handleProvidersList),
    route("/api/providers", "POST", handleProviderCreate),
    routePattern(/^\/api\/providers\/[^/]+$/, "PUT", (req, res, ctx) => handleProviderUpdate(req, res, ctx.path)),
    routePattern(/^\/api\/providers\/[^/]+$/, "DELETE", (req, res, ctx) => handleProviderDelete(req, res, ctx.path)),
    route("/api/providers/current", "PUT", handleProviderSwitch),
    routePattern(/^\/api\/providers\/[^/]+\/verify$/, "POST", (req, res, ctx) => handleProviderVerify(req, res, ctx.path)),
    routePattern(/^\/api\/providers\/[^/]+\/models$/, "GET", (req, res, ctx) => handleProviderModels(req, res, ctx.path)),
  ];
}
