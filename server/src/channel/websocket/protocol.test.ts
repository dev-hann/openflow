import { describe, it, expect } from "vitest";
import { parseWsClientMessage, serializeWsServerMessage } from "./protocol.js";

describe("parseWsClientMessage", () => {
  it("should parse message type", () => {
    const msg = parseWsClientMessage(
      JSON.stringify({ type: "message", content: "hello" }),
    );
    expect(msg).toEqual({
      type: "message",
      sessionId: undefined,
      content: "hello",
    });
  });

  it("should parse message with sessionId", () => {
    const msg = parseWsClientMessage(
      JSON.stringify({ type: "message", content: "hi", sessionId: "s1" }),
    );
    expect(msg).toEqual({ type: "message", sessionId: "s1", content: "hi" });
  });

  it("should reject message without content", () => {
    expect(
      parseWsClientMessage(JSON.stringify({ type: "message" })),
    ).toBeNull();
  });

  it("should parse switch_session type", () => {
    const msg = parseWsClientMessage(
      JSON.stringify({ type: "switch_session", sessionId: "s1" }),
    );
    expect(msg).toEqual({ type: "switch_session", sessionId: "s1" });
  });

  it("should reject switch_session without sessionId", () => {
    expect(
      parseWsClientMessage(JSON.stringify({ type: "switch_session" })),
    ).toBeNull();
  });

  it("should parse ping type", () => {
    expect(parseWsClientMessage(JSON.stringify({ type: "ping" }))).toEqual({
      type: "ping",
    });
  });

  it("should return null for unknown type", () => {
    expect(
      parseWsClientMessage(JSON.stringify({ type: "unknown" })),
    ).toBeNull();
  });

  it("should return null for non-JSON input", () => {
    expect(parseWsClientMessage("not json")).toBeNull();
  });

  it("should return null for non-object JSON", () => {
    expect(parseWsClientMessage("42")).toBeNull();
  });

  it("should return null for message without type field", () => {
    expect(
      parseWsClientMessage(JSON.stringify({ content: "hello" })),
    ).toBeNull();
  });
});

describe("serializeWsServerMessage", () => {
  it("should serialize token message", () => {
    const json = serializeWsServerMessage({
      type: "token",
      sessionId: "s1",
      content: "hi",
    });
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({ type: "token", sessionId: "s1", content: "hi" });
  });

  it("should serialize response message", () => {
    const json = serializeWsServerMessage({
      type: "response",
      sessionId: "s1",
      content: "done",
    });
    expect(JSON.parse(json).type).toBe("response");
  });

  it("should serialize error message", () => {
    const json = serializeWsServerMessage({
      type: "error",
      code: "FAIL",
      message: "bad",
    });
    expect(JSON.parse(json)).toEqual({
      type: "error",
      code: "FAIL",
      message: "bad",
    });
  });

  it("should serialize auth_ok", () => {
    const json = serializeWsServerMessage({ type: "auth_ok" });
    expect(JSON.parse(json)).toEqual({ type: "auth_ok" });
  });

  it("should serialize pong", () => {
    const json = serializeWsServerMessage({ type: "pong" });
    expect(JSON.parse(json)).toEqual({ type: "pong" });
  });

  it("should serialize notification", () => {
    const json = serializeWsServerMessage({
      type: "notification",
      message: "hello",
    });
    expect(JSON.parse(json)).toEqual({
      type: "notification",
      message: "hello",
    });
  });
});
