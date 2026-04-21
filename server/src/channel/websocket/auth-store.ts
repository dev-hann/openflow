import { join } from "node:path";
import { homedir } from "node:os";

import { createLogger } from "../../utils/logger.js";
import { createJsonFileStore } from "../../utils/json-file-store.js";

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

function isAuthStoreData(data: unknown): data is AuthStoreData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.devices);
}

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
  const store = createJsonFileStore<AuthStoreData>(resolvedPath, DEFAULT_DATA, {
    validate: isAuthStoreData,
  });

  function addDevice(device: DeviceRecord): void {
    store.update((data) => {
      data.devices = data.devices.filter((d) => d.sessionKey !== device.sessionKey);
      data.devices.push(device);
    });
    log.info({ label: device.label }, "device paired");
  }

  function findDeviceBySessionKey(sessionKey: string): DeviceRecord | undefined {
    return store.getData().devices.find((d) => d.sessionKey === sessionKey);
  }

  function findDeviceByRefreshHash(hash: string): DeviceRecord | undefined {
    return store.getData().devices.find((d) => d.refreshTokenHash === hash);
  }

  function updateRefreshHash(sessionKey: string, newHash: string): void {
    store.update((data) => {
      const device = data.devices.find((d) => d.sessionKey === sessionKey);
      if (!device) return;
      device.refreshTokenHash = newHash;
      device.lastSeen = Date.now();
    });
  }

  function updateLastSeen(sessionKey: string): void {
    store.update((data) => {
      const device = data.devices.find((d) => d.sessionKey === sessionKey);
      if (!device) return;
      device.lastSeen = Date.now();
    });
  }

  function removeDevice(sessionKey: string): boolean {
    let removed = false;
    store.update((data) => {
      const before = data.devices.length;
      data.devices = data.devices.filter((d) => d.sessionKey !== sessionKey);
      removed = data.devices.length < before;
    });
    if (removed) log.info({ sessionKey }, "device unpaired");
    return removed;
  }

  function listDevices(): DeviceRecord[] {
    return [...store.getData().devices];
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
