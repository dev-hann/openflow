import { describe, it, expect, vi } from "vitest";
import type { WebSocket } from "ws";
import {
  createStreamingContext,
  createStreamingTokenHandler,
  sendFinalResponse,
  sendError,
} from "./streaming.js";

function mockWebSocket(): { ws: WebSocket; getSent: () => string[] } {
  const sent: string[] = [];
  const ws = {
    send: vi.fn((data: string) => sent.push(data)),
    readyState: 1,
    OPEN: 1,
  } as unknown as WebSocket;
  return { ws, getSent: () => sent };
}

function mockClosedWebSocket(): { ws: WebSocket; getSent: () => string[] } {
  const sent: string[] = [];
  const ws = {
    send: vi.fn((data: string) => sent.push(data)),
    readyState: 3,
    OPEN: 1,
  } as unknown as WebSocket;
  return { ws, getSent: () => sent };
}

describe("createStreamingContext", () => {
  it("should send message via streaming context", () => {
    const { ws, getSent } = mockWebSocket();
    const ctx = createStreamingContext(ws, "sess-1");

    ctx.send({ type: "token", sessionId: "sess-1", content: "hi" });

    const msg = JSON.parse(getSent()[0]!) as Record<string, unknown>;
    expect(msg).toEqual({ type: "token", sessionId: "sess-1", content: "hi" });
  });

  it("should not send when websocket is closed", () => {
    const { ws, getSent } = mockClosedWebSocket();
    const ctx = createStreamingContext(ws, "sess-1");

    ctx.send({ type: "token", sessionId: "sess-1", content: "hi" });

    expect(getSent()).toHaveLength(0);
  });

  it("should handle multiple sends", () => {
    const { ws, getSent } = mockWebSocket();
    const ctx = createStreamingContext(ws, "sess-1");

    ctx.send({ type: "token", sessionId: "sess-1", content: "a" });
    ctx.send({ type: "token", sessionId: "sess-1", content: "b" });
    ctx.send({ type: "response", sessionId: "sess-1", content: "done" });

    expect(getSent()).toHaveLength(3);
  });
});

describe("createStreamingTokenHandler", () => {
  it("should send token message via websocket", () => {
    const { ws, getSent } = mockWebSocket();
    const handler = createStreamingTokenHandler(ws, "sess-1");

    handler("Hello");
    handler(" world");

    const messages = getSent().map(
      (s) => JSON.parse(s) as Record<string, unknown>,
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      type: "token",
      sessionId: "sess-1",
      content: "Hello",
    });
    expect(messages[1]).toEqual({
      type: "token",
      sessionId: "sess-1",
      content: " world",
    });
  });

  it("should not send when websocket is not open", () => {
    const { ws, getSent } = mockClosedWebSocket();

    const handler = createStreamingTokenHandler(ws, "sess-1");
    handler("test");

    expect(getSent()).toHaveLength(0);
  });
});

describe("sendFinalResponse", () => {
  it("should send response message via websocket", () => {
    const { ws, getSent } = mockWebSocket();

    sendFinalResponse(ws, "sess-1", "Final answer");

    const msg = JSON.parse(getSent()[0]!) as Record<string, unknown>;
    expect(msg).toEqual({
      type: "response",
      sessionId: "sess-1",
      content: "Final answer",
    });
  });

  it("should not send when websocket is not open", () => {
    const { ws, getSent } = mockClosedWebSocket();

    sendFinalResponse(ws, "sess-1", "test");

    expect(getSent()).toHaveLength(0);
  });
});

describe("sendError", () => {
  it("should send error message with code and message", () => {
    const { ws, getSent } = mockWebSocket();

    sendError(ws, "TIMEOUT", "Request timed out", "sess-1");

    const msg = JSON.parse(getSent()[0]!) as Record<string, unknown>;
    expect(msg).toEqual({
      type: "error",
      sessionId: "sess-1",
      code: "TIMEOUT",
      message: "Request timed out",
    });
  });

  it("should send error message without sessionId", () => {
    const { ws, getSent } = mockWebSocket();

    sendError(ws, "INVALID_MESSAGE", "Bad format");

    const msg = JSON.parse(getSent()[0]!) as Record<string, unknown>;
    expect(msg).toEqual({
      type: "error",
      sessionId: undefined,
      code: "INVALID_MESSAGE",
      message: "Bad format",
    });
  });

  it("should not send when websocket is not open", () => {
    const { ws, getSent } = mockClosedWebSocket();

    sendError(ws, "ERR", "fail");

    expect(getSent()).toHaveLength(0);
  });
});
