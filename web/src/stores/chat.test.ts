import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatStore } from "./chat";
import type { WsClient } from "@/api/ws";

function createMockWs() {
  return {
    send: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    connect: vi.fn(),
    dispose: vi.fn(),
  } as unknown as WsClient;
}

beforeEach(() => {
  useChatStore.setState({
    sessions: [],
    activeSessionId: null,
    messages: [],
    streamingContent: null,
    isStreaming: false,
    ws: null,
  });
});

describe("useChatStore", () => {
  it("should set sessions", () => {
    const sessions = [{ id: "s1", title: "Test", createdAt: 0, updatedAt: 0, messageCount: 5 }];
    useChatStore.getState().setSessions(sessions);
    expect(useChatStore.getState().sessions).toEqual(sessions);
  });

  it("should send message via ws and append to messages", () => {
    const ws = createMockWs();
    useChatStore.setState({ ws, activeSessionId: "s1" });

    useChatStore.getState().sendMessage("hello");

    expect(ws.send).toHaveBeenCalledWith({
      type: "message",
      sessionId: "s1",
      content: "hello",
    });
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].role).toBe("user");
    expect(useChatStore.getState().messages[0].content).toBe("hello");
  });

  it("should not send message without active session", () => {
    const ws = createMockWs();
    useChatStore.setState({ ws, activeSessionId: null });

    useChatStore.getState().sendMessage("hello");

    expect(ws.send).not.toHaveBeenCalled();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("should not send message without ws", () => {
    useChatStore.setState({ ws: null, activeSessionId: "s1" });
    useChatStore.getState().sendMessage("hello");
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("should switch session and clear messages", () => {
    const ws = createMockWs();
    useChatStore.setState({
      ws,
      activeSessionId: "s1",
      messages: [{ role: "user", content: "old", createdAt: 0 }],
      streamingContent: "partial",
      isStreaming: true,
    });

    useChatStore.getState().switchSession("s2");

    expect(ws.send).toHaveBeenCalledWith({ type: "switch_session", sessionId: "s2" });
    expect(useChatStore.getState().activeSessionId).toBe("s2");
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().streamingContent).toBeNull();
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should handle streaming pipeline", () => {
    useChatStore.getState().startStreaming("H");
    expect(useChatStore.getState().streamingContent).toBe("H");
    expect(useChatStore.getState().isStreaming).toBe(true);

    useChatStore.getState().appendStreaming("i");
    expect(useChatStore.getState().streamingContent).toBe("Hi");

    useChatStore.getState().finishStreaming("Hi there");
    expect(useChatStore.getState().streamingContent).toBeNull();
    expect(useChatStore.getState().isStreaming).toBe(false);
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0]).toMatchObject({
      role: "assistant",
      content: "Hi there",
    });
  });

  it("should clear streaming state", () => {
    useChatStore.getState().startStreaming("x");
    useChatStore.getState().clearStreaming();
    expect(useChatStore.getState().streamingContent).toBeNull();
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should set ws client", () => {
    const ws = createMockWs();
    useChatStore.getState().setWs(ws);
    expect(useChatStore.getState().ws).toBe(ws);
  });

  it("should append messages", () => {
    useChatStore.getState().appendMessage({ role: "user", content: "a", createdAt: 1 });
    useChatStore.getState().appendMessage({ role: "assistant", content: "b", createdAt: 2 });
    expect(useChatStore.getState().messages).toHaveLength(2);
  });
});
