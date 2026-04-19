import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("ws/auth-store");

export interface DeviceRecord {
  sessionKey: string;
  refreshTokenHash: string;
  label: string;
  pairedAt: number;
  lastSeen: number;
}

interface AuthStoreData {
  devices: DeviceRecord[];
}

const DEFAULT_DATA: AuthStoreData = { devices: [] };

export interface AuthStore {
  addDevice(device: DeviceRecord): void;
  findDeviceBySessionKey(sessionKey: string): DeviceRecord | undefined;
  findDeviceByRefreshHash(hash: string): DeviceRecord | undefined;
  updateRefreshHash(sessionKey: string, newHash: string): void;
  updateLastSeen(sessionKey: string): void;
  removeDevice(sessionKey: string): boolean;
  listDevices(): DeviceRecord[];
}

export function createAuthStore(filePath?: string): AuthStore {
  const resolvedPath = filePath ?? join(homedir(), ".openflow", "auth-store.json");
  let data: AuthStoreData = loadData(resolvedPath);

  function loadData(path: string): AuthStoreData {
    try {
      if (!existsSync(path)) return { ...DEFAULT_DATA };
      const raw = readFileSync(path, "utf-8").trim();
      const parsed = JSON.parse(raw) as AuthStoreData;
      if (!Array.isArray(parsed.devices)) return { ...DEFAULT_DATA };
      return parsed;
    } catch {
      log.debug({ path }, "failed to load auth store, using defaults");
      return { ...DEFAULT_DATA };
    }
  }

  function save(): void {
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(resolvedPath, JSON.stringify(data, null, 2) + "\n", { encoding: "utf-8", mode: 0o600 });
  }

  function addDevice(device: DeviceRecord): void {
    data.devices = data.devices.filter((d) => d.sessionKey !== device.sessionKey);
    data.devices.push(device);
    save();
    log.info({ label: device.label }, "device paired");
  }

  function findDeviceBySessionKey(sessionKey: string): DeviceRecord | undefined {
    return data.devices.find((d) => d.sessionKey === sessionKey);
  }

  function findDeviceByRefreshHash(hash: string): DeviceRecord | undefined {
    return data.devices.find((d) => d.refreshTokenHash === hash);
  }

  function updateRefreshHash(sessionKey: string, newHash: string): void {
    const device = data.devices.find((d) => d.sessionKey === sessionKey);
    if (!device) return;
    device.refreshTokenHash = newHash;
    device.lastSeen = Date.now();
    save();
  }

  function updateLastSeen(sessionKey: string): void {
    const device = data.devices.find((d) => d.sessionKey === sessionKey);
    if (!device) return;
    device.lastSeen = Date.now();
    save();
  }

  function removeDevice(sessionKey: string): boolean {
    const before = data.devices.length;
    data.devices = data.devices.filter((d) => d.sessionKey !== sessionKey);
    if (data.devices.length === before) return false;
    save();
    log.info({ sessionKey }, "device unpaired");
    return true;
  }

  function listDevices(): DeviceRecord[] {
    return [...data.devices];
  }

  return {
    addDevice,
    findDeviceBySessionKey,
    findDeviceByRefreshHash,
    updateRefreshHash,
    updateLastSeen,
    removeDevice,
    listDevices,
  };
}
