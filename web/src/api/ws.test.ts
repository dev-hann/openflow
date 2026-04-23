import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WsClient } from "./ws";
import type { WsServerMessage } from "./types";

let mockWs: {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  OPEN: number;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
};

class MockWebSocket {
  static OPEN = WebSocket.OPEN;
  static CONNECTING = WebSocket.CONNECTING;
  static CLOSING = WebSocket.CLOSING;
  static CLOSED = WebSocket.CLOSED;

  readyState = WebSocket.CONNECTING;
  send = vi.fn();
  close = vi.fn();
  OPEN = WebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    mockWs = this as unknown as typeof mockWs;
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

beforeEach(() => {
  vi.useFakeTimers();
  mockWs = null as unknown as typeof mockWs;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WsClient", () => {
  it("should send auth message on open and resolve on auth_ok", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const promise = client.connect();

    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "auth", accessToken: "at_test" }),
    );

    const msg: WsServerMessage = { type: "auth_ok" };
    mockWs.onmessage!({ data: JSON.stringify(msg) });

    await expect(promise).resolves.toBeUndefined();
  });

  it("should reject on auth_required", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const promise = client.connect();

    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();

    const msg: WsServerMessage = { type: "auth_required" };
    mockWs.onmessage!({ data: JSON.stringify(msg) });

    await expect(promise).rejects.toThrow("Authentication failed");
  });

  it("should reject on connection error", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const promise = client.connect();

    mockWs.onerror!();

    await expect(promise).rejects.toThrow("WebSocket connection failed");
  });

  it("should notify listeners on server messages", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const listener = vi.fn();
    client.onMessage(listener);

    const promise = client.connect();
    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();
    mockWs.onmessage!({ data: JSON.stringify({ type: "auth_ok" }) });
    await promise;

    const token: WsServerMessage = { type: "token", sessionId: "s1", content: "hi" };
    mockWs.onmessage!({ data: JSON.stringify(token) });
    expect(listener).toHaveBeenCalledWith(token);
  });

  it("should unsubscribe via returned function", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const listener = vi.fn();
    const unsub = client.onMessage(listener);

    const promise = client.connect();
    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();
    mockWs.onmessage!({ data: JSON.stringify({ type: "auth_ok" }) });
    await promise;

    unsub();
    mockWs.onmessage!({ data: JSON.stringify({ type: "token", sessionId: "s1", content: "x" }) });
    expect(listener).not.toHaveBeenCalled();
  });

  it("should send ping periodically", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const promise = client.connect();
    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();
    mockWs.onmessage!({ data: JSON.stringify({ type: "auth_ok" }) });
    await promise;

    mockWs.send.mockClear();
    vi.advanceTimersByTime(25_000);
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "ping" }));
  });

  it("should schedule reconnect on close", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const promise = client.connect();
    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();
    mockWs.onmessage!({ data: JSON.stringify({ type: "auth_ok" }) });
    await promise;

    mockWs.onclose!();
    vi.advanceTimersByTime(5_000);
  });

  it("should not reconnect after dispose", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const promise = client.connect();
    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();
    mockWs.onmessage!({ data: JSON.stringify({ type: "auth_ok" }) });
    await promise;

    client.dispose();
    mockWs.onclose!();
    vi.advanceTimersByTime(30_000);
  });

  it("should not send on null websocket", () => {
    const client = new WsClient("ws://localhost", "at_test");
    expect(() => client.send({ type: "ping" })).not.toThrow();
  });

  it("should ignore malformed messages", async () => {
    const client = new WsClient("ws://localhost", "at_test");
    const listener = vi.fn();
    client.onMessage(listener);

    const promise = client.connect();
    mockWs.readyState = WebSocket.OPEN;
    mockWs.onopen!();
    mockWs.onmessage!({ data: "not-json" });
    mockWs.onmessage!({ data: JSON.stringify({ type: "auth_ok" }) });
    await promise;

    expect(listener).not.toHaveBeenCalled();
  });
});
