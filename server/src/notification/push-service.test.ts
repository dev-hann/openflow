import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationService } from "./push-service.js";
import type { PushTokenStore, PushTokenRecord } from "./token-store.js";

const mockSendPush = vi.fn().mockResolvedValue([{ status: "ok", id: "ticket-1" }]);

vi.mock("expo-server-sdk", () => {
  const isValid = vi.fn((token: string) => token.startsWith("ExponentPushToken["));
  return {
    Expo: Object.assign(
      vi.fn().mockImplementation(() => ({
        chunkPushNotifications: vi.fn((msgs) => [msgs]),
        sendPushNotificationsAsync: mockSendPush,
      })),
      { isExpoPushToken: isValid },
    ),
  };
});

function mockTokenStore(tokens: PushTokenRecord[] = []): PushTokenStore {
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    getAll: vi.fn(() => tokens),
    getByToken: vi.fn(),
    touchLastUsed: vi.fn(),
  };
}

describe("createNotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("disabled config", () => {
    it("should return no-op service when disabled", async () => {
      const store = mockTokenStore();
      const service = createNotificationService({ enabled: false }, store);

      const ticket = await service.send({ to: "test", title: "t", body: "b" });
      expect(ticket.status).toBe("ok");
      expect(ticket.id).toBe("disabled");
    });

    it("should return empty array from sendAll when disabled", async () => {
      const store = mockTokenStore();
      const service = createNotificationService({ enabled: false }, store);

      const tickets = await service.sendAll([{ to: "test", title: "t", body: "b" }]);
      expect(tickets).toEqual([]);
    });

    it("should skip notifyAll when disabled", async () => {
      const store = mockTokenStore();
      const service = createNotificationService({ enabled: false }, store);

      await expect(service.notifyAll("title", "body")).resolves.toBeUndefined();
    });
  });

  describe("enabled config", () => {
    it("should reject invalid Expo push token", async () => {
      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      const ticket = await service.send({
        to: "invalid-token",
        title: "t",
        body: "b",
      });
      expect(ticket.status).toBe("error");
      expect(ticket.message).toContain("Invalid Expo push token");
    });

    it("should skip notifyAll when no tokens registered", async () => {
      const store = mockTokenStore([]);
      const service = createNotificationService({ enabled: true }, store);

      await expect(service.notifyAll("title", "body")).resolves.toBeUndefined();
    });

    it("should send to valid Expo push token", async () => {
      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      const ticket = await service.send({
        to: "ExponentPushToken[valid-token]",
        title: "Hello",
        body: "World",
      });
      expect(ticket.status).toBe("ok");
    });

    it("should broadcast to all registered tokens", async () => {
      const tokens: PushTokenRecord[] = [
        {
          token: "ExponentPushToken[a]",
          platform: "ios",
          label: "Phone",
          registeredAt: Date.now(),
          lastUsedAt: Date.now(),
        },
        {
          token: "ExponentPushToken[b]",
          platform: "android",
          label: "Tablet",
          registeredAt: Date.now(),
          lastUsedAt: Date.now(),
        },
      ];
      const store = mockTokenStore(tokens);
      const service = createNotificationService({ enabled: true }, store);

      await service.notifyAll("Title", "Body");
    });

    it("should handle send with sound and badge options", async () => {
      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      const ticket = await service.send({
        to: "ExponentPushToken[valid-token]",
        title: "Hello",
        body: "World",
        sound: "default",
        badge: 3,
      });
      expect(ticket.status).toBe("ok");
    });

    it("should unregister token on DeviceNotRegistered error", async () => {
      mockSendPush.mockResolvedValueOnce([
        {
          status: "error",
          message: "device not registered",
          details: { error: "DeviceNotRegistered" },
        },
      ]);

      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      const ticket = await service.send({
        to: "ExponentPushToken[dead-token]",
        title: "T",
        body: "B",
      });
      expect(ticket.status).toBe("error");
      expect(store.unregister).toHaveBeenCalledWith("ExponentPushToken[dead-token]");
    });

    it("should return error ticket when Expo send throws", async () => {
      mockSendPush.mockRejectedValueOnce(new Error("network failure"));

      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      const ticket = await service.send({
        to: "ExponentPushToken[valid-token]",
        title: "T",
        body: "B",
      });
      expect(ticket.status).toBe("error");
      expect(ticket.message).toContain("network failure");
    });

    it("should touch lastUsed on successful send", async () => {
      mockSendPush.mockResolvedValueOnce([{ status: "ok", id: "t1" }]);

      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      await service.send({
        to: "ExponentPushToken[touch]",
        title: "T",
        body: "B",
      });
      expect(store.touchLastUsed).toHaveBeenCalledWith("ExponentPushToken[touch]");
    });

    it("should return empty array from sendAll with empty input", async () => {
      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      const tickets = await service.sendAll([]);
      expect(tickets).toEqual([]);
    });

    it("should handle generic error response from Expo", async () => {
      mockSendPush.mockResolvedValueOnce([
        {
          status: "error",
          message: "internal error",
          details: { error: "InternalServerError" },
        },
      ]);

      const store = mockTokenStore();
      const service = createNotificationService({ enabled: true }, store);

      const ticket = await service.send({
        to: "ExponentPushToken[valid-token]",
        title: "T",
        body: "B",
      });
      expect(ticket.status).toBe("error");
      expect(store.unregister).not.toHaveBeenCalled();
    });
  });
});
