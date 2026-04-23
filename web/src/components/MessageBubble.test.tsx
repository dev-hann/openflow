import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble, MessageList } from "./MessageBubble";

describe("MessageBubble", () => {
  it("should render user message with text", () => {
    render(<MessageBubble role="user" content="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("should render assistant message with markdown", () => {
    render(<MessageBubble role="assistant" content="**bold** text" />);
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("should show streaming cursor when streaming", () => {
    const { container } = render(<MessageBubble role="assistant" content="thinking..." isStreaming />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("should not show cursor when not streaming", () => {
    const { container } = render(<MessageBubble role="assistant" content="done" />);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});

describe("MessageList", () => {
  it("should render all messages", () => {
    const messages = [
      { role: "user" as const, content: "hi", createdAt: 1 },
      { role: "assistant" as const, content: "hello", createdAt: 2 },
    ];
    render(<MessageList messages={messages} streamingContent={null} isStreaming={false} />);

    expect(screen.getByText("hi")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("should render streaming content", () => {
    const messages = [{ role: "user" as const, content: "hi", createdAt: 1 }];
    render(<MessageList messages={messages} streamingContent="so far" isStreaming={true} />);

    expect(screen.getByText("so far")).toBeInTheDocument();
  });

  it("should render empty list without errors", () => {
    const { container } = render(<MessageList messages={[]} streamingContent={null} isStreaming={false} />);
    expect(container.querySelectorAll("[class*='rounded-2xl']")).toHaveLength(0);
  });
});
