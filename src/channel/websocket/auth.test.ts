import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAuthService, type AuthService } from "./auth.js";
import type { AuthStore, DeviceRecord } from "./auth-store.js";

function createMockStore(): AuthStore & { devices: DeviceRecord[] } {
  const devices: DeviceRecord[] = [];

  return {
    devices,
    addDevice(device: DeviceRecord): void {
      devices.push(device);
    },
    findDeviceBySessionKey(sessionKey: string): DeviceRecord | undefined {
      return devices.find((d) => d.sessionKey === sessionKey);
    },
    findDeviceByRefreshHash(hash: string): DeviceRecord | undefined {
      return devices.find((d) => d.refreshTokenHash === hash);
    },
    updateRefreshHash(sessionKey: string, newHash: string): void {
      const d = devices.find((d) => d.sessionKey === sessionKey);
      if (d) {
        d.refreshTokenHash = newHash;
        d.lastSeen = Date.now();
      }
    },
    updateLastSeen(sessionKey: string): void {
      const d = devices.find((d) => d.sessionKey === sessionKey);
      if (d) d.lastSeen = Date.now();
    },
    removeDevice(sessionKey: string): boolean {
      const idx = devices.findIndex((d) => d.sessionKey === sessionKey);
      if (idx === -1) return false;
      devices.splice(idx, 1);
      return true;
    },
    listDevices(): DeviceRecord[] {
      return [...devices];
    },
  };
}

describe("createAuthService", () => {
  let store: ReturnType<typeof createMockStore>;
  let service: AuthService;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createMockStore();
    service = createAuthService(store);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("createPairingPin", () => {
    it("should return a 6-digit PIN", () => {
      const pin = service.createPairingPin();
      expect(pin).toMatch(/^\d{6}$/);
    });
  });

  describe("verifyPinAndIssueTokens", () => {
    it("should issue tokens for valid PIN", () => {
      const pin = service.createPairingPin();
      const tokens = service.verifyPinAndIssueTokens(pin, "TestDevice");
      expect(tokens).toBeTruthy();
      expect(tokens!.accessToken).toBeTruthy();
      expect(tokens!.refreshToken).toBeTruthy();
      expect(tokens!.sessionKey).toBeTruthy();
      expect(tokens!.accessExpiresAt).toBeGreaterThan(Date.now() - 1000);
      expect(tokens!.refreshExpiresAt).toBeGreaterThan(tokens!.accessExpiresAt);
    });

    it("should register device in store after PIN verification", () => {
      const pin = service.createPairingPin();
      const tokens = service.verifyPinAndIssueTokens(pin, "TestDevice");
      expect(store.devices).toHaveLength(1);
      expect(store.devices[0]!.label).toBe("TestDevice");
      expect(store.devices[0]!.sessionKey).toBe(tokens!.sessionKey);
    });

    it("should return null for invalid PIN", () => {
      service.createPairingPin();
      expect(service.verifyPinAndIssueTokens("000000", "TestDevice")).toBeNull();
    });

    it("should return null for already claimed PIN", () => {
      const pin = service.createPairingPin();
      service.verifyPinAndIssueTokens(pin, "First");
      expect(service.verifyPinAndIssueTokens(pin, "Second")).toBeNull();
    });

    it("should return null for expired PIN", () => {
      const pin = service.createPairingPin();
      vi.advanceTimersByTime(6 * 60 * 1000);
      expect(service.verifyPinAndIssueTokens(pin, "Late")).toBeNull();
    });
  });

  describe("validateAccessToken", () => {
    it("should validate a fresh access token", () => {
      const pin = service.createPairingPin();
      const tokens = service.verifyPinAndIssueTokens(pin, "Device");
      const payload = service.validateAccessToken(tokens!.accessToken);
      expect(payload).toBeTruthy();
      expect(payload!.sessionKey).toBe(tokens!.sessionKey);
    });

    it("should return null for invalid token format", () => {
      expect(service.validateAccessToken("invalid")).toBeNull();
    });

    it("should return null for expired access token", () => {
      const pin = service.createPairingPin();
      const tokens = service.verifyPinAndIssueTokens(pin, "Device");
      vi.advanceTimersByTime(61 * 60 * 1000);
      expect(service.validateAccessToken(tokens!.accessToken)).toBeNull();
    });

    it("should return null for token of unpaired device", () => {
      const pin = service.createPairingPin();
      const tokens = service.verifyPinAndIssueTokens(pin, "Device");
      store.devices.length = 0;
      expect(service.validateAccessToken(tokens!.accessToken)).toBeNull();
    });
  });

  describe("refreshTokens", () => {
    it("should issue new token pair with valid refresh token", () => {
      const pin = service.createPairingPin();
      const original = service.verifyPinAndIssueTokens(pin, "Device");
      vi.advanceTimersByTime(1000);
      const refreshed = service.refreshTokens(original!.refreshToken);
      expect(refreshed).toBeTruthy();
      expect(refreshed!.sessionKey).toBe(original!.sessionKey);
      expect(refreshed!.accessToken).not.toBe(original!.accessToken);
      expect(refreshed!.refreshToken).not.toBe(original!.refreshToken);
    });

    it("should return null for invalid refresh token", () => {
      expect(service.refreshTokens("rt_invalid")).toBeNull();
    });

    it("should invalidate old refresh token after use", () => {
      const pin = service.createPairingPin();
      const original = service.verifyPinAndIssueTokens(pin, "Device");
      service.refreshTokens(original!.refreshToken);
      expect(service.refreshTokens(original!.refreshToken)).toBeNull();
    });
  });

  describe("unpair", () => {
    it("should remove device from store", () => {
      const pin = service.createPairingPin();
      const tokens = service.verifyPinAndIssueTokens(pin, "Device");
      expect(service.unpair(tokens!.sessionKey)).toBe(true);
      expect(store.devices).toHaveLength(0);
    });

    it("should return false for unknown session key", () => {
      expect(service.unpair("unknown")).toBe(false);
    });
  });

  describe("listDevices", () => {
    it("should list all paired devices", () => {
      const pin1 = service.createPairingPin();
      service.verifyPinAndIssueTokens(pin1, "Phone");
      const pin2 = service.createPairingPin();
      service.verifyPinAndIssueTokens(pin2, "Tablet");
      const devices = service.listDevices();
      expect(devices).toHaveLength(2);
      expect(devices.map((d) => d.label).sort()).toEqual(["Phone", "Tablet"]);
    });
  });
});
