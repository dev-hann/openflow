import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { createLlmClient, type LlmClient, type LlmConfig } from "./client.js";
import type { LlmResponse } from "./types.js";
import type { Provider, ProviderStore } from "../memory/index.js";

const log = createLogger("llm/pool");

const NO_PROVIDER_MESSAGE = "LLM Provider가 등록되지 않았습니다. 앱에서 Provider를 추가해주세요.";

function createNoopClient(message: string): LlmClient {
  const error = new OpenFlowError(message, "LLM_REQUEST_FAILED");
  return {
    async chat(): Promise<LlmResponse> {
      throw error;
    },
    async complete(): Promise<string> {
      throw error;
    },
  };
}

export interface ProviderPool {
  getClient(): LlmClient;
  getActiveProvider(): Provider | null;
  getActiveProviderId(): string;
  switchProvider(id: string): void;
  syncFromStore(): void;
  listProviders(): { id: string; name: string; model: string; isActive: boolean }[];
}

export interface ProviderPoolOptions {
  maxTokens?: number;
  temperature?: number;
}

export function createProviderPool(
  providerStore: ProviderStore,
  options?: ProviderPoolOptions,
): ProviderPool {
  const maxTokens = options?.maxTokens ?? 4096;
  const temperature = options?.temperature ?? 0.7;
  const clients = new Map<string, LlmClient>();
  let activeProviderId: string | null = null;

  function buildConfig(provider: Provider): LlmConfig {
    return {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.model,
      maxTokens,
      temperature,
    };
  }

  function getOrCreateClient(provider: Provider): LlmClient {
    let client = clients.get(provider.id);
    if (!client) {
      client = createLlmClient(buildConfig(provider));
      clients.set(provider.id, client);
      log.info({ providerId: provider.id, name: provider.name }, "LLM client created for provider");
    }
    return client;
  }

  function initFromStore(): void {
    const providers = providerStore.listProviders();
    if (providers.length === 0) return;

    const defaultProvider = providers.find((p) => p.isDefault) ?? providers[0]!;
    activeProviderId = defaultProvider.id;
    getOrCreateClient(defaultProvider);

    for (const p of providers) {
      if (p.id !== defaultProvider.id) {
        getOrCreateClient(p);
      }
    }

    log.info({ activeId: activeProviderId, total: providers.length }, "provider pool initialized");
  }

  initFromStore();

  return {
    getClient(): LlmClient {
      if (activeProviderId) {
        const client = clients.get(activeProviderId);
        if (client) return client;
      }

      const provider = providerStore.getDefaultProvider();
      if (provider) {
        activeProviderId = provider.id;
        return getOrCreateClient(provider);
      }

      log.warn("no provider configured");
      return createNoopClient(NO_PROVIDER_MESSAGE);
    },

    getActiveProvider(): Provider | null {
      if (!activeProviderId) return null;
      return providerStore.getProvider(activeProviderId);
    },

    getActiveProviderId(): string {
      return activeProviderId ?? "";
    },

    switchProvider(id: string): void {
      const provider = providerStore.getProvider(id);
      if (!provider) {
        log.warn({ providerId: id }, "provider not found, ignoring switch");
        return;
      }
      getOrCreateClient(provider);
      activeProviderId = id;
      log.info({ providerId: id, name: provider.name }, "switched active provider");
    },

    syncFromStore(): void {
      const providers = providerStore.listProviders();
      const storeIds = new Set(providers.map((p) => p.id));

      for (const id of clients.keys()) {
        if (!storeIds.has(id)) {
          clients.delete(id);
          log.info({ providerId: id }, "removed stale client from pool");
        }
      }

      for (const p of providers) {
        clients.set(p.id, createLlmClient(buildConfig(p)));
      }

      if (activeProviderId && !storeIds.has(activeProviderId)) {
        const fallback = providers.find((p) => p.isDefault) ?? providers[0];
        activeProviderId = fallback?.id ?? null;
        log.info({ newActiveId: activeProviderId }, "active provider no longer exists, switched");
      }
    },

    listProviders(): { id: string; name: string; model: string; isActive: boolean }[] {
      return providerStore.listProviders().map((p) => ({
        id: p.id,
        name: p.name,
        model: p.model,
        isActive: p.id === activeProviderId,
      }));
    },
  };
}
