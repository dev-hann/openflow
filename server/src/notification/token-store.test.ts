import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createPushTokenStore, type PushTokenStore } from "./token-store.js";

describe("createPushTokenStore", () => {
  const testDir = join(tmpdir(), "openflow-test-token-store-" + Date.now());
  const storePath = join(testDir, "tokens.json");
  let store: PushTokenStore;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    store = createPushTokenStore(storePath);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should register a token", () => {
    store.register("tok_abc123", "ios", "iPhone");
    const token = store.getByToken("tok_abc123");
    expect(token).toBeTruthy();
    expect(token!.platform).toBe("ios");
    expect(token!.label).toBe("iPhone");
  });

  it("should return all registered tokens", () => {
    store.register("tok_1", "ios", "Phone");
    store.register("tok_2", "android", "Tablet");
    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.label).sort()).toEqual(["Phone", "Tablet"]);
  });

  it("should unregister a token", () => {
    store.register("tok_remove", "web", "Browser");
    const removed = store.unregister("tok_remove");
    expect(removed).toBe(true);
    expect(store.getByToken("tok_remove")).toBeUndefined();
  });

  it("should return false when unregistering unknown token", () => {
    expect(store.unregister("unknown")).toBe(false);
  });

  it("should return undefined for unknown token lookup", () => {
    expect(store.getByToken("nonexistent")).toBeUndefined();
  });

  it("should update lastUsedAt on touchLastUsed", () => {
    store.register("tok_touch", "ios", "Phone");
    const before = store.getByToken("tok_touch")!.lastUsedAt;
    store.touchLastUsed("tok_touch");
    const after = store.getByToken("tok_touch")!.lastUsedAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("should replace existing token on re-registration", () => {
    store.register("tok_dup", "ios", "Old Label");
    store.register("tok_dup", "android", "New Label");
    const all = store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.label).toBe("New Label");
    expect(all[0]!.platform).toBe("android");
  });

  it("should not touch lastUsed for nonexistent token", () => {
    store.touchLastUsed("nonexistent");
    expect(store.getAll()).toHaveLength(0);
  });

  it("should reset to defaults when file contains invalid data", () => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    writeFileSync(storePath, JSON.stringify({ tokens: "not an array" }));

    const corruptedStore = createPushTokenStore(storePath);
    expect(corruptedStore.getAll()).toHaveLength(0);

    corruptedStore.register("tok_after_reset", "ios", "Phone");
    expect(corruptedStore.getAll()).toHaveLength(1);
  });

  it("should reset to defaults when file contains non-object data", () => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    writeFileSync(storePath, JSON.stringify("just a string"));

    const corruptedStore = createPushTokenStore(storePath);
    expect(corruptedStore.getAll()).toHaveLength(0);
  });

  it("should reset to defaults when file is empty JSON", () => {
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    writeFileSync(storePath, JSON.stringify({}));

    const emptyStore = createPushTokenStore(storePath);
    expect(emptyStore.getAll()).toHaveLength(0);

    emptyStore.register("tok_new", "android", "Tablet");
    expect(emptyStore.getAll()).toHaveLength(1);
  });
});
