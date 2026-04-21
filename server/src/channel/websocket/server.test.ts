import { describe, it, expect, vi, afterEach } from "vitest";
import { createWebSocketChannel, type WebSocketChannel } from "./server.js";
import type { AgentEngine } from "../../agent/index.js";
import type { MemoryStore, ProviderStore } from "../../memory/index.js";
import type { ProviderPool } from "../../llm/pool.js";
import type { PushTokenStore } from "../../notification/token-store.js";

const TEST_PORT = 19876;

function createMockAgentEngine(): AgentEngine {
  return {
    handleMessage: vi.fn().mockResolvedValue({ type: "text", content: "ok" }),
    getWorkspace: vi.fn().mockReturnValue({
      hasPersona: vi.fn().mockReturnValue(true),
      loadFile: vi.fn().mockReturnValue(""),
      listFiles: vi.fn().mockReturnValue([]),
      getDailyMemory: vi.fn().mockReturnValue(null),
    }),
    updateChannelSender: vi.fn(),
  };
}

function createMockDeps() {
  return {
    agentEngine: createMockAgentEngine(),
    memoryStore: {
      createSession: vi.fn().mockReturnValue({ id: "s1" }),
      listSessions: vi.fn().mockReturnValue([]),
      getMessages: vi.fn().mockReturnValue([]),
      getMessageCount: vi.fn().mockReturnValue(0),
      getVisibleMessages: vi.fn().mockReturnValue({ messages: [], total: 0 }),
      addMessage: vi.fn(),
      deleteSession: vi.fn(),
      close: vi.fn(),
    } as unknown as MemoryStore,
    providerStore: {
      listProviders: vi.fn().mockReturnValue([]),
      getProvider: vi.fn().mockReturnValue(null),
      addProvider: vi.fn(),
      updateProvider: vi.fn().mockReturnValue(null),
      deleteProvider: vi.fn(),
      setDefault: vi.fn().mockReturnValue(null),
    } as unknown as ProviderStore,
    providerPool: {
      getActiveProviderId: vi.fn().mockReturnValue(null),
      syncFromStore: vi.fn(),
      switchProvider: vi.fn(),
    } as unknown as ProviderPool,
    pushTokenStore: {
      register: vi.fn(),
      unregister: vi.fn().mockReturnValue(false),
      getAll: vi.fn().mockReturnValue([]),
      getByToken: vi.fn().mockReturnValue(undefined),
      touchLastUsed: vi.fn(),
    } as unknown as PushTokenStore,
    createSession: vi.fn().mockReturnValue({ id: "s1" }),
  };
}

describe("createWebSocketChannel", () => {
  let channel: WebSocketChannel;

  afterEach(async () => {
    try {
      await channel?.stop();
    } catch {}
  });

  it("should start and stop the HTTP+WS server", async () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: TEST_PORT, cors: false },
      createMockDeps(),
    );

    await channel.start();
    expect(channel.authService).toBeDefined();

    const resp = await fetch(`http://127.0.0.1:${TEST_PORT}/nonexistent`);
    expect(resp.status).toBe(404);

    await channel.stop();
  });

  it("should return 404 for unknown routes", async () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: TEST_PORT + 1, cors: true },
      createMockDeps(),
    );

    await channel.start();

    const resp = await fetch(`http://127.0.0.1:${TEST_PORT + 1}/unknown/path`);
    expect(resp.status).toBe(404);

    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("not_found");

    await channel.stop();
  });

  it("should set CORS headers when enabled", async () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: TEST_PORT + 2, cors: true },
      createMockDeps(),
    );

    await channel.start();

    const resp = await fetch(`http://127.0.0.1:${TEST_PORT + 2}/api/sessions`);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");

    await channel.stop();
  });

  it("should expose authService with expected methods", () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: 0, cors: false },
      createMockDeps(),
    );

    expect(channel.authService).toBeDefined();
    expect(typeof channel.authService.createPairingPin).toBe("function");
    expect(typeof channel.authService.validateAccessToken).toBe("function");
  });

  it("should handle OPTIONS preflight request", async () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: TEST_PORT + 3, cors: true },
      createMockDeps(),
    );

    await channel.start();

    const resp = await fetch(`http://127.0.0.1:${TEST_PORT + 3}/api/sessions`, {
      method: "OPTIONS",
    });
    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe("*");

    await channel.stop();
  });

  it("should not set CORS headers when disabled", async () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: TEST_PORT + 4, cors: false },
      createMockDeps(),
    );

    await channel.start();

    const resp = await fetch(`http://127.0.0.1:${TEST_PORT + 4}/api/sessions`);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();

    await channel.stop();
  });

  it("should handle double stop gracefully", async () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: TEST_PORT + 5, cors: false },
      createMockDeps(),
    );

    await channel.start();
    await channel.stop();
    await channel.stop();
  });

  it("should handle stop without start", async () => {
    channel = createWebSocketChannel(
      { host: "127.0.0.1", port: 0, cors: false },
      createMockDeps(),
    );

    await channel.stop();
  });

  describe("broadcastMessage", () => {
    it("should be callable without errors when no clients connected", () => {
      channel = createWebSocketChannel(
        { host: "127.0.0.1", port: 0, cors: false },
        createMockDeps(),
      );

      expect(() => channel.broadcastMessage("hello")).not.toThrow();
    });
  });
});
