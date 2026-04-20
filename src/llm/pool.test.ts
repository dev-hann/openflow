import { describe, it, expect, vi } from "vitest";
import { createProviderPool } from "./pool.js";
import type { ProviderStore, Provider } from "../memory/index.js";

function createMockProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Test Provider",
    baseUrl: overrides.baseUrl ?? "https://api.example.com/v1",
    apiKey: overrides.apiKey ?? "sk-test-key",
    model: overrides.model ?? "gpt-4",
    isDefault: overrides.isDefault ?? false,
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  };
}

function createMockStore(providers: Provider[] = []): ProviderStore {
  const store = [...providers];
  return {
    listProviders: vi.fn(() => store),
    getProvider: vi.fn((id: string) => store.find((p) => p.id === id) ?? null),
    getDefaultProvider: vi.fn(() => store.find((p) => p.isDefault) ?? store[0] ?? null),
    addProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    setDefault: vi.fn(),
  };
}

describe("createProviderPool", () => {
  describe("initialization", () => {
    it("should initialize with default provider from store", () => {
      const provider = createMockProvider({ id: "p1", isDefault: true });
      const store = createMockStore([provider]);
      const pool = createProviderPool(store);

      expect(pool.getActiveProviderId()).toBe("p1");
    });

    it("should use first provider as active when no default", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: false });
      const p2 = createMockProvider({ id: "p2", isDefault: false });
      const store = createMockStore([p1, p2]);
      const pool = createProviderPool(store);

      expect(pool.getActiveProviderId()).toBe("p1");
    });

    it("should return empty active id when no providers", () => {
      const store = createMockStore([]);
      const pool = createProviderPool(store);

      expect(pool.getActiveProviderId()).toBe("");
    });
  });

  describe("getClient()", () => {
    it("should return noop client when no providers", async () => {
      const store = createMockStore([]);
      const pool = createProviderPool(store);
      const client = pool.getClient();

      await expect(client.chat({ messages: [] })).rejects.toThrow("Provider");
    });

    it("should return client for active provider", () => {
      const provider = createMockProvider({ id: "p1", isDefault: true });
      const store = createMockStore([provider]);
      const pool = createProviderPool(store);
      const client = pool.getClient();

      expect(client).toBeDefined();
      expect(typeof client.chat).toBe("function");
    });

    it("should return same client on repeated calls", () => {
      const provider = createMockProvider({ id: "p1", isDefault: true });
      const store = createMockStore([provider]);
      const pool = createProviderPool(store);

      const client1 = pool.getClient();
      const client2 = pool.getClient();
      expect(client1).toBe(client2);
    });
  });

  describe("switchProvider()", () => {
    it("should switch active provider", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: true });
      const p2 = createMockProvider({ id: "p2", isDefault: false });
      const store = createMockStore([p1, p2]);
      const pool = createProviderPool(store);

      expect(pool.getActiveProviderId()).toBe("p1");
      pool.switchProvider("p2");
      expect(pool.getActiveProviderId()).toBe("p2");
    });

    it("should ignore switch to non-existent provider", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: true });
      const store = createMockStore([p1]);
      const pool = createProviderPool(store);

      pool.switchProvider("nonexistent");
      expect(pool.getActiveProviderId()).toBe("p1");
    });

    it("should return different client after switch", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: true, model: "model-a" });
      const p2 = createMockProvider({ id: "p2", isDefault: false, model: "model-b" });
      const store = createMockStore([p1, p2]);
      const pool = createProviderPool(store);

      const client1 = pool.getClient();
      pool.switchProvider("p2");
      const client2 = pool.getClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe("getActiveProvider()", () => {
    it("should return active provider", () => {
      const provider = createMockProvider({ id: "p1", isDefault: true, name: "Active" });
      const store = createMockStore([provider]);
      const pool = createProviderPool(store);

      const active = pool.getActiveProvider();
      expect(active?.name).toBe("Active");
    });

    it("should return null when no providers", () => {
      const store = createMockStore([]);
      const pool = createProviderPool(store);

      expect(pool.getActiveProvider()).toBeNull();
    });
  });

  describe("syncFromStore()", () => {
    it("should add new providers on sync", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: true });
      const store = createMockStore([p1]);
      const pool = createProviderPool(store);

      (store.listProviders as ReturnType<typeof vi.fn>).mockReturnValue([
        p1,
        createMockProvider({ id: "p2", isDefault: false }),
      ]);

      pool.syncFromStore();
      expect(pool.listProviders()).toHaveLength(2);
    });

    it("should remove stale clients on sync", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: true });
      const p2 = createMockProvider({ id: "p2", isDefault: false });
      const store = createMockStore([p1, p2]);
      const pool = createProviderPool(store);

      (store.listProviders as ReturnType<typeof vi.fn>).mockReturnValue([p1]);
      (store.getProvider as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => id === "p1" ? p1 : null,
      );

      pool.syncFromStore();
      const providers = pool.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0]!.id).toBe("p1");
    });

    it("should fallback to default when active provider removed", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: false });
      const p2 = createMockProvider({ id: "p2", isDefault: true });
      const store = createMockStore([p1, p2]);
      const pool = createProviderPool(store);

      pool.switchProvider("p1");
      expect(pool.getActiveProviderId()).toBe("p1");

      (store.listProviders as ReturnType<typeof vi.fn>).mockReturnValue([p2]);
      (store.getProvider as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => id === "p2" ? p2 : null,
      );

      pool.syncFromStore();
      expect(pool.getActiveProviderId()).toBe("p2");
    });
  });

  describe("listProviders()", () => {
    it("should list all providers with active flag", () => {
      const p1 = createMockProvider({ id: "p1", isDefault: true, name: "A", model: "m1" });
      const p2 = createMockProvider({ id: "p2", isDefault: false, name: "B", model: "m2" });
      const store = createMockStore([p1, p2]);
      const pool = createProviderPool(store);

      const list = pool.listProviders();
      expect(list).toHaveLength(2);
      expect(list.find((p) => p.id === "p1")?.isActive).toBe(true);
      expect(list.find((p) => p.id === "p2")?.isActive).toBe(false);
    });
  });

  describe("noop client", () => {
    it("should throw on chat with descriptive message", async () => {
      const store = createMockStore([]);
      const pool = createProviderPool(store);
      const client = pool.getClient();

      await expect(client.chat({ messages: [] })).rejects.toThrow();
    });

    it("should throw on complete with descriptive message", async () => {
      const store = createMockStore([]);
      const pool = createProviderPool(store);
      const client = pool.getClient();

      await expect(client.complete({ messages: [] })).rejects.toThrow();
    });
  });
});
