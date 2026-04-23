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
  sendApiError,
  validateBody,
} from "./middleware.js";
import type { AuthService } from "./auth.js";
import { route, routePattern, type Route } from "./routes.js";
import {
  fetchProviderModels,
  verifyProviderConnectivity,
} from "./provider-connectivity.js";
import {
  ProviderCreateSchema,
  ProviderUpdateSchema,
  ProviderSwitchSchema,
  ProviderModelsResponseSchema,
} from "./provider-schemas.js";

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

function requireProviderId(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): string | null {
  const auth = requireAuth(req, res, deps.authService);
  if (!auth) return null;
  const id = extractProviderId(path);
  if (!id) {
    sendApiError(
      res,
      400,
      "provider_id_required",
      "Provider ID is required in the URL path",
    );
    return null;
  }
  return id;
}

function requireProvider(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Provider | null {
  const providerId = requireProviderId(deps, req, res, path);
  if (!providerId) return null;
  const provider = deps.providerStore.getProvider(providerId);
  if (!provider) {
    sendApiError(res, 404, "provider_not_found", "Provider not found");
    return null;
  }
  return provider;
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
  const parsed = validateBody(body, ProviderCreateSchema, res);
  if (!parsed) return;
  const provider = deps.providerStore.addProvider(parsed);
  if (parsed.isDefault) {
    deps.providerStore.setDefault(provider.id);
    deps.providerPool.syncFromStore();
    deps.providerPool.switchProvider(provider.id);
  } else {
    deps.providerPool.syncFromStore();
  }
  log.info({ providerId: provider.id, name: provider.name }, "provider created via API");

  verifyProviderConnectivity(parsed.baseUrl, parsed.apiKey)
    .then((verified) => {
      if (!verified) {
        log.warn(
          { providerId: provider.id, name: provider.name },
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
  const provider = requireProvider(deps, req, res, path);
  if (!provider) return;
  const body = await readJsonObject(req, res);
  if (!body) return;
  const parsed = validateBody(body, ProviderUpdateSchema, res);
  if (!parsed) return;
  const updated = deps.providerStore.updateProvider(provider.id, parsed);
  deps.providerPool.syncFromStore();
  log.info({ providerId: provider.id }, "provider updated via API");
  const activeId = deps.providerPool.getActiveProviderId();
  sendJson(res, 200, providerToJson(updated ?? provider, activeId));
}

async function handleProviderDelete(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  const provider = requireProvider(deps, req, res, path);
  if (!provider) return;
  deps.providerStore.deleteProvider(provider.id);
  deps.providerPool.syncFromStore();
  log.info({ providerId: provider.id }, "provider deleted via API");
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
  const parsed = validateBody(body, ProviderSwitchSchema, res);
  if (!parsed) return;
  const provider = deps.providerStore.getProvider(parsed.providerId);
  if (!provider) {
    sendApiError(res, 404, "provider_not_found", "Provider not found");
    return;
  }
  deps.providerPool.switchProvider(parsed.providerId);
  deps.providerStore.setDefault(parsed.providerId);
  log.info({ providerId: parsed.providerId }, "provider switched via API");
  sendJson(res, 200, { providerId: parsed.providerId });
}

async function handleProviderVerify(
  deps: ProviderRoutesDeps,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
): Promise<void> {
  const provider = requireProvider(deps, req, res, path);
  if (!provider) return;
  try {
    const resp = await fetchProviderModels(provider.baseUrl, provider.apiKey);
    if (!resp.ok) {
      sendJson(res, 200, { ok: false, error: `HTTP ${resp.status}` });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch (err: unknown) {
    log.debug({ err, providerId: provider.id }, "provider connectivity check failed");
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
  const provider = requireProvider(deps, req, res, path);
  if (!provider) return;
  try {
    const resp = await fetchProviderModels(provider.baseUrl, provider.apiKey);
    if (!resp.ok) {
      sendApiError(
        res,
        502,
        "provider_request_failed",
        `Failed to fetch models: HTTP ${resp.status}`,
      );
      return;
    }
    const raw = await resp.json();
    const parsed = ProviderModelsResponseSchema.safeParse(raw);
    const models = parsed.success
      ? parsed.data.data.map((m) => m.id).sort()
      : [];
    sendJson(res, 200, { models });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    sendApiError(res, 500, "provider_request_failed", msg);
  }
}

export function createProviderRoutes(deps: ProviderRoutesDeps): Route[] {
  return [
    route("/api/providers", "GET", (req, res) =>
      handleProvidersList(deps, req, res),
    ),
    route("/api/providers", "POST", (req, res) =>
      handleProviderCreate(deps, req, res),
    ),
    route("/api/providers/current", "PUT", (req, res) =>
      handleProviderSwitch(deps, req, res),
    ),
    routePattern(/^\/api\/providers\/[^/]+$/, "PUT", (req, res, ctx) =>
      handleProviderUpdate(deps, req, res, ctx.path),
    ),
    routePattern(/^\/api\/providers\/[^/]+$/, "DELETE", (req, res, ctx) =>
      handleProviderDelete(deps, req, res, ctx.path),
    ),
    routePattern(/^\/api\/providers\/[^/]+\/verify$/, "POST", (req, res, ctx) =>
      handleProviderVerify(deps, req, res, ctx.path),
    ),
    routePattern(/^\/api\/providers\/[^/]+\/models$/, "GET", (req, res, ctx) =>
      handleProviderModels(deps, req, res, ctx.path),
    ),
  ];
}
