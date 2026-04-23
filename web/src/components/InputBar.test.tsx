import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InputBar } from "./InputBar";

describe("InputBar", () => {
  it("should render input and send button", () => {
    render(<InputBar onSend={vi.fn()} />);
    expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toBeInTheDocument();
    expect(screen.getByText("전송")).toBeInTheDocument();
  });

  it("should call onSend with trimmed text on button click", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText("메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "  hello  " } });
    fireEvent.click(screen.getByText("전송"));

    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("should call onSend on Enter (without Shift)", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText("메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("should not call onSend on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    const input = screen.getByPlaceholderText("메시지를 입력하세요...");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should not call onSend with empty text", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} />);

    fireEvent.change(screen.getByPlaceholderText("메시지를 입력하세요..."), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("전송"));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("should clear input after send", () => {
    render(<InputBar onSend={vi.fn()} />);

    const input = screen.getByPlaceholderText("메시지를 입력하세요...") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByText("전송"));

    expect(input.value).toBe("");
  });

  it("should disable input and button when disabled", () => {
    render(<InputBar onSend={vi.fn()} disabled />);

    expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toBeDisabled();
    expect(screen.getByText("전송")).toBeDisabled();
  });
});
