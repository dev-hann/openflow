import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import { createAuthStore, type AuthStore, type DeviceRecord } from "./auth-store.js";

describe("createAuthStore", () => {
  const testDir = join(tmpdir(), "openflow-test-auth-store-" + Date.now());
  const storePath = join(testDir, "auth.json");
  let store: AuthStore;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    store = createAuthStore(storePath);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const makeDevice = (overrides?: Partial<DeviceRecord>): DeviceRecord => ({
    sessionKey: "sk_test_" + Math.random().toString(36).slice(2),
    refreshTokenHash: "hash_" + Math.random().toString(36).slice(2),
    label: "Test Device",
    pairedAt: Date.now(),
    lastSeen: Date.now(),
    ...overrides,
  });

  it("should add a device", () => {
    const device = makeDevice({ label: "iPhone" });
    store.addDevice(device);
    const found = store.findDeviceBySessionKey(device.sessionKey);
    expect(found).toBeTruthy();
    expect(found!.label).toBe("iPhone");
  });

  it("should find device by refresh token hash", () => {
    const device = makeDevice({ refreshTokenHash: "rt_hash_abc123" });
    store.addDevice(device);
    const found = store.findDeviceByRefreshHash("rt_hash_abc123");
    expect(found).toBeTruthy();
    expect(found!.sessionKey).toBe(device.sessionKey);
  });

  it("should return undefined for unknown session key", () => {
    expect(store.findDeviceBySessionKey("unknown")).toBeUndefined();
  });

  it("should return undefined for unknown refresh hash", () => {
    expect(store.findDeviceByRefreshHash("unknown")).toBeUndefined();
  });

  it("should update refresh token hash", () => {
    const device = makeDevice({ refreshTokenHash: "old_hash" });
    store.addDevice(device);
    store.updateRefreshHash(device.sessionKey, "new_hash");
    expect(store.findDeviceByRefreshHash("old_hash")).toBeUndefined();
    expect(store.findDeviceByRefreshHash("new_hash")).toBeTruthy();
  });

  it("should update last seen timestamp", () => {
    const device = makeDevice({ lastSeen: 1000 });
    store.addDevice(device);
    const before = store.findDeviceBySessionKey(device.sessionKey)!.lastSeen;
    store.updateLastSeen(device.sessionKey);
    const after = store.findDeviceBySessionKey(device.sessionKey)!.lastSeen;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("should remove a device", () => {
    const device = makeDevice();
    store.addDevice(device);
    const removed = store.removeDevice(device.sessionKey);
    expect(removed).toBe(true);
    expect(store.findDeviceBySessionKey(device.sessionKey)).toBeUndefined();
  });

  it("should return false when removing nonexistent device", () => {
    expect(store.removeDevice("nonexistent")).toBe(false);
  });

  it("should list all devices", () => {
    store.addDevice(makeDevice({ label: "A" }));
    store.addDevice(makeDevice({ label: "B" }));
    const list = store.listDevices();
    expect(list).toHaveLength(2);
    expect(list.map((d) => d.label).sort()).toEqual(["A", "B"]);
  });

  it("should replace device with same session key on add", () => {
    const key = "sk_shared_key";
    store.addDevice(makeDevice({ sessionKey: key, label: "First" }));
    store.addDevice(makeDevice({ sessionKey: key, label: "Second" }));
    const list = store.listDevices();
    expect(list).toHaveLength(1);
    expect(list[0]!.label).toBe("Second");
  });

  it("should not update refresh hash for nonexistent device", () => {
    store.updateRefreshHash("nonexistent", "hash");
    expect(store.findDeviceByRefreshHash("hash")).toBeUndefined();
  });

  it("should not update last seen for nonexistent device", () => {
    store.updateLastSeen("nonexistent");
    expect(store.listDevices()).toHaveLength(0);
  });
});
