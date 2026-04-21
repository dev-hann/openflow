import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync } from "node:fs";
import type { OpenFlowConfig } from "../config/schema.js";

const mockMemoryStore = {
  getDb: vi.fn(() => ({})),
  createSession: vi.fn(() => ({ id: "session-1" })),
  close: vi.fn(),
};
const mockProviderStore = { getAll: vi.fn(() => []) };
const mockProviderPool = { getClient: vi.fn() };
const mockAgentEngine = {
  handleMessage: vi.fn(),
  getWorkspace: vi.fn(),
  updateChannelSender: vi.fn(),
};
const mockWsChannel = {
  start: vi.fn(),
  stop: vi.fn(),
  broadcastMessage: vi.fn(),
};

vi.mock("../memory/store.js", () => ({
  createMemoryStore: vi.fn(() => mockMemoryStore),
}));
vi.mock("../memory/provider-store.js", () => ({
  createProviderStore: vi.fn(() => mockProviderStore),
}));
vi.mock("../llm/pool.js", () => ({
  createProviderPool: vi.fn(() => mockProviderPool),
}));
vi.mock("../tools/executor.js", () => ({
  createToolExecutor: vi.fn(() => ({
    getDefinitions: vi.fn(() => []),
    execute: vi.fn(),
    needsConfirmation: vi.fn(() => false),
    updateSender: vi.fn(),
  })),
}));
vi.mock("../agent/engine.js", () => ({
  createAgentEngine: vi.fn(() => mockAgentEngine),
}));
vi.mock("../channel/websocket/index.js", () => ({
  createWebSocketChannel: vi.fn(() => mockWsChannel),
}));
vi.mock("../notification/index.js", () => ({
  createNotificationService: vi.fn(() => ({
    send: vi.fn(),
    sendAll: vi.fn(),
    notifyAll: vi.fn(),
  })),
  createPushTokenStore: vi.fn(() => ({
    register: vi.fn(),
    unregister: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));
vi.mock("../config/loader.js", () => ({
  watchConfig: vi.fn(() => vi.fn()),
}));

function createTestConfig(overrides?: Partial<OpenFlowConfig>): OpenFlowConfig {
  return {
    llm: { maxTokens: 4096, temperature: 0.7 },
    notification: {
      enabled: false,
      onStart: "started",
      onStop: "stopped",
    },
    agent: {
      systemPrompt: "",
      maxToolRounds: 10,
      workspace: join(tmpdir(), "openflow-test-cli-" + Date.now()),
      dailyMemoryDays: 2,
    },
    memory: {
      contextSize: 50,
      dbPath: join(tmpdir(), "openflow-test-cli-" + Date.now() + ".db"),
    },
    tools: {
      shell: { enabled: true, timeout: 5000 },
      webFetch: { enabled: false },
      webSearch: { enabled: false },
      httpRequest: { enabled: false },
      browser: { enabled: false, timeout: 30_000, headless: true },
      requireConfirmation: [],
      confirmationTimeout: 60_000,
    },
    skills: { enabled: true, extraDirs: [], entries: {} },
    websocket: { enabled: true, host: "127.0.0.1", port: 19800, cors: true },
    logging: { level: "info" as const },
    ...overrides,
  };
}

describe("runServer", () => {
  let testDir: string;
  let originalExit: typeof process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = join(tmpdir(), "openflow-test-cli-" + Date.now());
    mkdirSync(testDir, { recursive: true });
    originalExit = process.exit;
  });

  afterEach(() => {
    process.exit = originalExit;
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should wire agent deps and start WebSocket server", async () => {
    process.exit = vi.fn() as unknown as typeof process.exit;
    const { runServer } = await import("./runners.js");
    const config = createTestConfig({
      agent: { ...createTestConfig().agent, workspace: testDir },
    });

    await runServer(config);

    expect(mockWsChannel.start).toHaveBeenCalledOnce();
    expect(mockAgentEngine.updateChannelSender).toHaveBeenCalledOnce();
  });

  it("should exit when websocket is disabled", async () => {
    const exitMock = vi.fn((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
    process.exit = exitMock as unknown as typeof process.exit;

    const { runServer } = await import("./runners.js");
    const config = createTestConfig({
      websocket: { enabled: false, host: "127.0.0.1", port: 19800, cors: true },
      agent: { ...createTestConfig().agent, workspace: testDir },
    });

    await expect(runServer(config)).rejects.toThrow("process.exit(1)");
  });

  it("should register cleanup on SIGINT", async () => {
    process.exit = vi.fn() as unknown as typeof process.exit;
    const { runServer } = await import("./runners.js");
    const config = createTestConfig({
      agent: { ...createTestConfig().agent, workspace: testDir },
    });

    await runServer(config);

    const listeners = process.listeners("SIGINT");
    expect(listeners.length).toBeGreaterThanOrEqual(1);
  });

  it("should call cleanup and exit on signal", async () => {
    process.exit = vi.fn() as unknown as typeof process.exit;
    const { runServer } = await import("./runners.js");
    const config = createTestConfig({
      agent: { ...createTestConfig().agent, workspace: testDir },
    });

    await runServer(config);

    const listeners = process.listeners("SIGINT");
    const cleanup = listeners[listeners.length - 1];
    await (cleanup as () => Promise<void>)();

    expect(mockWsChannel.stop).toHaveBeenCalled();
    expect(mockMemoryStore.close).toHaveBeenCalled();
  });

  it("should prevent double cleanup", async () => {
    process.exit = vi.fn() as unknown as typeof process.exit;
    const { runServer } = await import("./runners.js");
    const config = createTestConfig({
      agent: { ...createTestConfig().agent, workspace: testDir },
    });

    await runServer(config);

    const listeners = process.listeners("SIGINT");
    const cleanup = listeners[listeners.length - 1] as () => Promise<void>;
    await cleanup();
    vi.clearAllMocks();
    await cleanup();
    expect(mockWsChannel.stop).not.toHaveBeenCalled();
  });

  it("should send start notification when enabled", async () => {
    process.exit = vi.fn() as unknown as typeof process.exit;
    const mockNotifyAll = vi.fn().mockResolvedValue(undefined);
    const { createNotificationService } = await import("../notification/index.js");
    vi.mocked(createNotificationService).mockImplementation(
      () =>
        ({
          send: vi.fn().mockResolvedValue(undefined),
          sendAll: vi.fn().mockResolvedValue([]),
          notifyAll: mockNotifyAll,
        }) as unknown as ReturnType<typeof createNotificationService>,
    );

    const { runServer } = await import("./runners.js");
    const config = createTestConfig({
      notification: { enabled: true, onStart: "Server up!", onStop: "Bye!" },
      agent: { ...createTestConfig().agent, workspace: testDir },
    });

    await runServer(config);

    expect(mockNotifyAll).toHaveBeenCalled();
  });
});
