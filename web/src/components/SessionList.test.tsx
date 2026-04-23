import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionList } from "./SessionList";
import type { SessionInfo } from "@/api/types";

const sessions: SessionInfo[] = [
  { id: "s1", title: "First chat", createdAt: 0, updatedAt: 0, messageCount: 3 },
  { id: "s2", title: "Second chat", createdAt: 0, updatedAt: 0, messageCount: 7 },
];

describe("SessionList", () => {
  it("should render session titles and message counts", () => {
    render(<SessionList sessions={sessions} activeId={null} onSelect={vi.fn()} onCreate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.getByText("Second chat")).toBeInTheDocument();
    expect(screen.getByText("3개 메시지")).toBeInTheDocument();
    expect(screen.getByText("7개 메시지")).toBeInTheDocument();
  });

  it("should show empty state when no sessions", () => {
    render(<SessionList sessions={[]} activeId={null} onSelect={vi.fn()} onCreate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("대화가 없습니다")).toBeInTheDocument();
  });

  it("should call onSelect on session click", () => {
    const onSelect = vi.fn();
    render(<SessionList sessions={sessions} activeId={null} onSelect={onSelect} onCreate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText("First chat"));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("should call onCreate on new session button click", () => {
    const onCreate = vi.fn();
    render(<SessionList sessions={[]} activeId={null} onSelect={vi.fn()} onCreate={onCreate} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText("+ 새 대화"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("should call onDelete on delete button click", () => {
    const onDelete = vi.fn();
    render(<SessionList sessions={sessions} activeId={null} onSelect={vi.fn()} onCreate={vi.fn()} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByTitle("삭제");
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith("s1");
  });

  it("should highlight active session", () => {
    render(<SessionList sessions={sessions} activeId="s1" onSelect={vi.fn()} onCreate={vi.fn()} onDelete={vi.fn()} />);

    const activeEl = screen.getByText("First chat").closest("div[class*='bg-surface-elevated']");
    expect(activeEl).toBeTruthy();
  });
});
