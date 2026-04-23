import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger } from "../../utils/logger.js";
import { getErrorMessage } from "../../utils/errors.js";
import type { ProviderStore, Provider } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { components } from "../../generated/api.js";
import {
  sendJson,
  readJsonObject,
  requireAuth,
  getBodyString,
  sendApiError,
} from "./middleware.js";
import type { AuthService } from "./auth.js";
import { route, routePattern, type Route } from "./routes.js";

const log = createLogger("ws/provider-routes");

const PROVIDER_ID_REGEX = /^\/api\/providers\/([^/]+)(?:\/(verify|models))?$/;

function extractProviderId(path: string): string | null {
  const match = path.match(PROVIDER_ID_REGEX);
  return match?.[1] ?? null;
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "••••••••";
  return apiKey.slice(0, 4) + "••••" + apiKey.slice(-4);
}

function providerToJson(
  p: Provider,
  activeId: string | null,
): components["schemas"]["ProviderResponse"] {
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: maskApiKey(p.apiKey),
    model: p.model,
    isDefault: p.isDefault,
    isActive: p.id === activeId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function resolveProviderId(
  res: ServerResponse,
  path: string,
): string | null {
  const id = extractProviderId(path);
  if (!id) sendApiError(res, 400, "provider_id_required", "Provider ID is required in the URL path");
  return id;
}

async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
): Promise<Response> {
  const base = baseUrl.replace(/\/$/, "");
  return fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
}

async function verifyProviderConnectivity(
  baseUrl: string,
  apiKey: string,
): Promise<boolean> {
  try {
    const resp = await fetchProviderModels(baseUrl, apiKey);
    if (!resp.ok) {
      log.debug({ baseUrl, status: resp.status }, "provider connectivity check returned non-OK status");
      return false;
    }
    return true;
  } catch (err: unknown) {
    log.debug({ baseUrl, err }, "provider connectivity check failed");
    return false;
  }
}

export interface ProviderRoutesDeps {
  authService: AuthService;
  providerStore: ProviderStore;
  providerPool: ProviderPool;
}

async function handleProvidersList(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return;
  const activeId = deps.providerPool.getActiveProviderId();
  const providers = deps.providerStore
    .listProviders()
    .map((p) => providerToJson(p, activeId));
  sendJson(res, 200, { providers, activeProviderId: activeId });
}

async function handleProviderCreate(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return;
  const body = await readJsonObject(req, res);
  if (!body) return;
  const name = getBodyString(body, "name");
  const baseUrl = getBodyString(body, "baseUrl");
  const apiKey = getBodyString(body, "apiKey");
  const model = getBodyString(body, "model");
  const isDefault =
    typeof body.isDefault === "boolean" ? body.isDefault : undefined;
  if (!name || !baseUrl || !apiKey || !model) {
    sendApiError(
      res,
      400,
      "fields_required",
      "name, baseUrl, apiKey, model are required",
    );
    return;
  }
  const provider = deps.providerStore.addProvider({
    name,
    baseUrl,
    apiKey,
    model,
    isDefault,
  });
  if (isDefault) {
    deps.providerStore.setDefault(provider.id);
    deps.providerPool.syncFromStore();
    deps.providerPool.switchProvider(provider.id);
  } else {
    deps.providerPool.syncFromStore();
  }
  log.info({ providerId: provider.id, name }, "provider created via API");

  verifyProviderConnectivity(baseUrl, apiKey)
    .then((verified) => {
      if (!verified) {
        log.warn(
          { providerId: provider.id, name },
          "provider created but connectivity check failed",
        );
      }
    })
    .catch((err) => {
      log.debug(
        { err, providerId: provider.id },
        "background connectivity check failed",
      );
    });

  const activeId = deps.providerPool.getActiveProviderId();
  sendJson(res, 201, providerToJson(provider, activeId));
}

async function handleProviderUpdate(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return;
  const providerId = resolveProviderId(res, path);
  if (!providerId) return;
  const body = await readJsonObject(req, res);
  if (!body) return;
  const updated = deps.providerStore.updateProvider(providerId, {
    name: getBodyString(body, "name"),
    baseUrl: getBodyString(body, "baseUrl"),
    apiKey: getBodyString(body, "apiKey"),
    model: getBodyString(body, "model"),
  });
  if (!updated) {
    sendApiError(res, 404, "provider_not_found", "Provider not found");
    return;
  }
  deps.providerPool.syncFromStore();
  log.info({ providerId }, "provider updated via API");
  const activeId = deps.providerPool.getActiveProviderId();
  sendJson(res, 200, providerToJson(updated, activeId));
}

async function handleProviderDelete(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return;
  const providerId = resolveProviderId(res, path);
  if (!providerId) return;
  deps.providerStore.deleteProvider(providerId);
  deps.providerPool.syncFromStore();
  log.info({ providerId }, "provider deleted via API");
  sendJson(res, 200, { ok: true });
}

async function handleProviderSwitch(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return;
  const body = await readJsonObject(req, res);
  if (!body) return;
  const providerId = getBodyString(body, "providerId");
  if (!providerId) {
    sendApiError(res, 400, "provider_id_required", "Provider ID is required");
    return;
  }
  const provider = deps.providerStore.getProvider(providerId);
  if (!provider) {
    sendApiError(res, 404, "provider_not_found", "Provider not found");
    return;
  }
  deps.providerPool.switchProvider(providerId);
  deps.providerStore.setDefault(providerId);
  log.info({ providerId }, "provider switched via API");
  sendJson(res, 200, { providerId });
}

async function handleProviderVerify(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return;
  const providerId = resolveProviderId(res, path);
  if (!providerId) return;
  const provider = deps.providerStore.getProvider(providerId);
  if (!provider) {
    sendApiError(res, 404, "provider_not_found", "Provider not found");
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
    const msg = getErrorMessage(err);
    sendJson(res, 200, { ok: false, error: msg });
  }
}

async function handleProviderModels(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return;
  const providerId = resolveProviderId(res, path);
  if (!providerId) return;
  const provider = deps.providerStore.getProvider(providerId);
  if (!provider) {
    sendApiError(res, 404, "provider_not_found", "Provider not found");
    return;
  }
  try {
    const resp = await fetchProviderModels(provider.baseUrl, provider.apiKey);
    if (!resp.ok) {
      sendApiError(
        res,
        resp.status,
        "provider_request_failed",
        `Failed to fetch models: HTTP ${resp.status}`,
      );
      return;
    }
    const json = (await resp.json()) as { data?: Array<{ id: string }> };
    const models = (json.data ?? []).map((m) => m.id).sort();
    sendJson(res, 200, { models });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    sendApiError(res, 500, "provider_request_failed", msg);
  }
}

export function createProviderRoutes(deps: ProviderRoutesDeps): Route[] {
  return [
    route("/api/providers", "GET", (req, res) => handleProvidersList(deps, req, res)),
    route("/api/providers", "POST", (req, res) => handleProviderCreate(deps, req, res)),
    route("/api/providers/current", "PUT", (req, res) => handleProviderSwitch(deps, req, res)),
    routePattern(/^\/api\/providers\/[^/]+$/, "PUT", (req, res, ctx) => handleProviderUpdate(deps, req, res, ctx.path)),
    routePattern(/^\/api\/providers\/[^/]+$/, "DELETE", (req, res, ctx) => handleProviderDelete(deps, req, res, ctx.path)),
    routePattern(/^\/api\/providers\/[^/]+\/verify$/, "POST", (req, res, ctx) => handleProviderVerify(deps, req, res, ctx.path)),
    routePattern(/^\/api\/providers\/[^/]+\/models$/, "GET", (req, res, ctx) => handleProviderModels(deps, req, res, ctx.path)),
  ];
}
