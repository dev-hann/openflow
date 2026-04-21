import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebSocket } from "ws";
import { createWsHandler } from "./ws-handler.js";
import type { AuthService } from "./auth.js";
import type { AgentEngine } from "../../agent/index.js";

interface MockWsEvents {
  message: Array<(data: Buffer) => void>;
  close: Array<() => void>;
  error: Array<(err: Error) => void>;
}

function createMockWs(): {
  ws: WebSocket;
  emit: (event: string, ...args: unknown[]) => void;
  sent: string[];
} {
  const events: Partial<MockWsEvents> = {};
  const sent: string[] = [];

  const ws = {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!events[event as keyof MockWsEvents]) {
        (events as Record<string, unknown[]>)[event] = [];
      }
      (events as Record<string, Array<(...a: unknown[]) => void>>)[event]!.push(handler);
    },
    off(event: string, handler: (...args: unknown[]) => void) {
      const handlers = (events as Record<string, Array<(...a: unknown[]) => void>>)[event];
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    },
    removeAllListeners(event?: string) {
      if (event) {
        delete (events as Record<string, unknown>)[event];
      } else {
        for (const key of Object.keys(events)) {
          delete (events as Record<string, unknown>)[key];
        }
      }
    },
    send(data: string) {
      sent.push(data);
    },
    close: vi.fn(),
    ping: vi.fn(),
    readyState: 1,
    OPEN: 1,
  } as unknown as WebSocket;

  const emit = (event: string, ...args: unknown[]) => {
    const handlers = (events as Record<string, Array<(...a: unknown[]) => void>>)[event];
    if (handlers) {
      for (const h of handlers) {
        h(...args);
      }
    }
  };

  return { ws, emit, sent };
}

function createMockAuthService(validToken: string, sessionKey: string): AuthService {
  return {
    createPairingPin: vi.fn(),
    verifyPinAndIssueTokens: vi.fn(),
    validateAccessToken: vi.fn((token: string) => {
      if (token === validToken) {
        return { sessionKey, expiresAt: Date.now() + 3600_000 };
      }
      return null;
    }),
    refreshTokens: vi.fn(),
    unpair: vi.fn(),
    listDevices: vi.fn(),
  };
}

function createMockAgentEngine(): AgentEngine {
  return {
    handleMessage: vi.fn().mockResolvedValue({ type: "text", content: "reply" }),
    getWorkspace: vi.fn().mockReturnValue({
      hasPersona: () => false,
      loadAll: () => [],
      getWorkspaceDir: () => "/tmp/workspace",
    }),
    updateChannelSender: vi.fn(),
  };
}

describe("createWsHandler", () => {
  const validToken = "valid-access-token";
  const sessionKey = "sk_test_session";
  let authService: AuthService;
  let agentEngine: AgentEngine;

  beforeEach(() => {
    authService = createMockAuthService(validToken, sessionKey);
    agentEngine = createMockAgentEngine();
  });

  function setupAuthenticated(): ReturnType<typeof createMockWs> & {
    handler: ReturnType<typeof createWsHandler>;
  } {
    const handler = createWsHandler({ authService, agentEngine });
    const mock = createMockWs();
    handler.handleConnection(mock.ws);
    const authMsg = JSON.stringify({ type: "auth", accessToken: validToken });
    mock.emit("message", Buffer.from(authMsg));
    return { ...mock, handler };
  }

  describe("authentication", () => {
    it("should authenticate with valid token", () => {
      const handler = createWsHandler({ authService, agentEngine });
      const mock = createMockWs();
      handler.handleConnection(mock.ws);

      const authMsg = JSON.stringify({ type: "auth", accessToken: validToken });
      mock.emit("message", Buffer.from(authMsg));

      const responses = mock.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      expect(responses).toHaveLength(1);
      expect(responses[0]!.type).toBe("auth_ok");
    });

    it("should reject invalid token", () => {
      const handler = createWsHandler({ authService, agentEngine });
      const mock = createMockWs();
      handler.handleConnection(mock.ws);

      const authMsg = JSON.stringify({
        type: "auth",
        accessToken: "bad-token",
      });
      mock.emit("message", Buffer.from(authMsg));

      const responses = mock.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      expect(responses.some((r) => r.type === "auth_required")).toBe(true);
    });

    it("should reject non-JSON message during auth", () => {
      const handler = createWsHandler({ authService, agentEngine });
      const mock = createMockWs();
      handler.handleConnection(mock.ws);

      mock.emit("message", Buffer.from("not json"));

      const responses = mock.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      expect(responses.some((r) => r.type === "auth_required")).toBe(true);
    });
  });

  describe("message handling", () => {
    it("should respond to ping with pong", () => {
      const { emit, sent } = setupAuthenticated();

      emit("message", Buffer.from(JSON.stringify({ type: "ping" })));

      const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      const pong = responses.find((r) => r.type === "pong");
      expect(pong).toBeDefined();
    });

    it("should handle switch_session", () => {
      const { emit, sent } = setupAuthenticated();

      emit(
        "message",
        Buffer.from(JSON.stringify({ type: "switch_session", sessionId: "sess-123" })),
      );

      const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      const switched = responses.find((r) => r.type === "session_switched");
      expect(switched).toBeDefined();
      expect(switched!.sessionId).toBe("sess-123");
    });

    it("should handle chat message and send response", async () => {
      const { emit, sent } = setupAuthenticated();

      emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "message",
            sessionId: "sess-1",
            content: "hello",
          }),
        ),
      );

      await vi.waitFor(() => {
        const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
        expect(responses.some((r) => r.type === "response")).toBe(true);
      });
    });

    it("should send error for invalid message format", () => {
      const { emit, sent } = setupAuthenticated();

      emit("message", Buffer.from("not valid json"));

      const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      const err = responses.find((r) => r.type === "error");
      expect(err).toBeDefined();
      expect(err!.code).toBe("INVALID_MESSAGE");
    });

    it("should send error when no active session", () => {
      const { emit, sent } = setupAuthenticated();

      emit("message", Buffer.from(JSON.stringify({ type: "message", content: "hello" })));

      const responses = sent.map((s) => JSON.parse(s) as Record<string, unknown>);
      const err = responses.find((r) => r.type === "error");
      expect(err).toBeDefined();
      expect(err!.code).toBe("NO_SESSION");
    });

    it("should send error response when agent returns error result", async () => {
      const engineReturningError = {
        ...createMockAgentEngine(),
        handleMessage: vi.fn().mockResolvedValue({
          type: "error",
          error: { code: "AGENT_ERROR", message: "something broke" },
        }),
      };
      const handler = createWsHandler({
        authService,
        agentEngine: engineReturningError,
      });
      const mock = createMockWs();
      handler.handleConnection(mock.ws);
      const authMsg = JSON.stringify({ type: "auth", accessToken: validToken });
      mock.emit("message", Buffer.from(authMsg));

      mock.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "message",
            sessionId: "sess-1",
            content: "hello",
          }),
        ),
      );

      await vi.waitFor(() => {
        const responses = mock.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
        const err = responses.find((r) => r.type === "error");
        expect(err).toBeDefined();
        expect(err!.code).toBe("AGENT_ERROR");
      });
    });

    it("should handle ws error event and clean up client", () => {
      const handler = createWsHandler({ authService, agentEngine });
      const mock = createMockWs();
      handler.handleConnection(mock.ws);
      const authMsg = JSON.stringify({ type: "auth", accessToken: validToken });
      mock.emit("message", Buffer.from(authMsg));

      expect(handler.getConnectedCount()).toBe(1);

      mock.emit("error", new Error("connection reset"));

      expect(handler.getConnectedCount()).toBe(0);
    });

    it("should handle duplicate auth message as invalid", () => {
      const { emit, sent } = setupAuthenticated();

      const sentBefore = sent.length;
      emit("message", Buffer.from(JSON.stringify({ type: "auth", accessToken: validToken })));

      expect(sent.length).toBe(sentBefore + 1);
      const lastMsg = JSON.parse(sent[sent.length - 1]!) as Record<string, unknown>;
      expect(lastMsg.type).toBe("error");
    });
  });

  describe("broadcast", () => {
    it("should broadcast message to all connected clients", () => {
      const handler = createWsHandler({ authService, agentEngine });

      const mock1 = createMockWs();
      const mock2 = createMockWs();
      handler.handleConnection(mock1.ws);
      handler.handleConnection(mock2.ws);

      const authMsg = JSON.stringify({ type: "auth", accessToken: validToken });
      mock1.emit("message", Buffer.from(authMsg));
      mock2.emit("message", Buffer.from(authMsg));

      handler.broadcast("notification", { message: "hello all" });

      for (const mock of [mock1, mock2]) {
        const hasNotification = mock.sent.some((s) => {
          const parsed = JSON.parse(s) as Record<string, unknown>;
          return parsed.type === "notification" && parsed.message === "hello all";
        });
        expect(hasNotification).toBe(true);
      }
    });
  });

  describe("getConnectedCount", () => {
    it("should return connected client count", () => {
      const handler = createWsHandler({ authService, agentEngine });

      expect(handler.getConnectedCount()).toBe(0);

      const mock1 = createMockWs();
      handler.handleConnection(mock1.ws);
      const authMsg = JSON.stringify({ type: "auth", accessToken: validToken });
      mock1.emit("message", Buffer.from(authMsg));

      expect(handler.getConnectedCount()).toBe(1);
    });

    it("should decrement count on disconnect", () => {
      const handler = createWsHandler({ authService, agentEngine });
      const mock = createMockWs();
      handler.handleConnection(mock.ws);
      const authMsg = JSON.stringify({ type: "auth", accessToken: validToken });
      mock.emit("message", Buffer.from(authMsg));

      expect(handler.getConnectedCount()).toBe(1);

      mock.emit("close");

      expect(handler.getConnectedCount()).toBe(0);
    });
  });
});
