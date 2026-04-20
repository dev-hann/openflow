import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { createMemoryStore } from "./store.js";
import { createProviderStore, type ProviderStore } from "./provider-store.js";

describe("createProviderStore", () => {
  const testDir = join(tmpdir(), "openflow-test-provider-" + Date.now());
  const dbPath = join(testDir, "test.db");
  let store: ProviderStore;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    const memory = createMemoryStore(dbPath);
    store = createProviderStore(memory.getDb());
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should add a provider", () => {
    const provider = store.addProvider({
      name: "Test Provider",
      baseUrl: "https://api.test.com/v1",
      apiKey: "sk-test-key",
      model: "gpt-4",
    });
    expect(provider.id).toBeTruthy();
    expect(provider.name).toBe("Test Provider");
    expect(provider.baseUrl).toBe("https://api.test.com/v1");
    expect(provider.apiKey).toBe("sk-test-key");
    expect(provider.model).toBe("gpt-4");
    expect(provider.isDefault).toBe(false);
  });

  it("should add a provider as default", () => {
    const provider = store.addProvider({
      name: "Default Provider",
      baseUrl: "https://api.test.com/v1",
      apiKey: "sk-test-key",
      model: "gpt-4",
      isDefault: true,
    });
    expect(provider.isDefault).toBe(true);
  });

  it("should get provider by id", () => {
    const added = store.addProvider({
      name: "Test",
      baseUrl: "https://api.test.com/v1",
      apiKey: "sk-test-key",
      model: "gpt-4",
    });
    const found = store.getProvider(added.id);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(added.id);
    expect(found!.name).toBe("Test");
  });

  it("should return null for nonexistent provider", () => {
    expect(store.getProvider("nonexistent")).toBeNull();
  });

  it("should list providers", () => {
    store.addProvider({ name: "A", baseUrl: "https://a.com", apiKey: "key-a", model: "m-a" });
    store.addProvider({ name: "B", baseUrl: "https://b.com", apiKey: "key-b", model: "m-b" });
    const list = store.listProviders();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("should update provider fields", () => {
    const added = store.addProvider({
      name: "Original",
      baseUrl: "https://original.com",
      apiKey: "sk-test-key",
      model: "m1",
    });
    const updated = store.updateProvider(added.id, {
      name: "Updated",
      model: "m2",
    });
    expect(updated).toBeTruthy();
    expect(updated!.name).toBe("Updated");
    expect(updated!.model).toBe("m2");
    expect(updated!.baseUrl).toBe("https://original.com");
  });

  it("should return null when updating nonexistent provider", () => {
    const result = store.updateProvider("nonexistent", { name: "X" });
    expect(result).toBeNull();
  });

  it("should delete provider", () => {
    const added = store.addProvider({
      name: "ToDelete",
      baseUrl: "https://test.com",
      apiKey: "key",
      model: "m",
    });
    store.deleteProvider(added.id);
    expect(store.getProvider(added.id)).toBeNull();
  });

  it("should get default provider", () => {
    store.addProvider({ name: "NotDefault", baseUrl: "https://a.com", apiKey: "k", model: "m" });
    store.addProvider({ name: "Default", baseUrl: "https://b.com", apiKey: "k", model: "m", isDefault: true });
    const def = store.getDefaultProvider();
    expect(def).toBeTruthy();
    expect(def!.name).toBe("Default");
    expect(def!.isDefault).toBe(true);
  });

  it("should return null when no default provider", () => {
    store.addProvider({ name: "NotDefault", baseUrl: "https://a.com", apiKey: "k", model: "m" });
    expect(store.getDefaultProvider()).toBeNull();
  });

  it("should set default provider", () => {
    const a = store.addProvider({ name: "A", baseUrl: "https://a.com", apiKey: "k", model: "m", isDefault: true });
    const b = store.addProvider({ name: "B", baseUrl: "https://b.com", apiKey: "k", model: "m" });
    const result = store.setDefault(b.id);
    expect(result).toBeTruthy();
    expect(result!.isDefault).toBe(true);
    expect(store.getProvider(a.id)!.isDefault).toBe(false);
  });

  it("should return null when setting nonexistent provider as default", () => {
    const result = store.setDefault("nonexistent");
    expect(result).toBeNull();
  });
});
