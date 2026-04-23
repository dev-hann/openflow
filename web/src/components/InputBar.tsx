import { useState, type KeyboardEvent } from "react";

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function InputBar({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border-default bg-surface-card p-4">
      <div className="flex gap-2 max-w-3xl mx-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none rounded-xl border border-border-subtle bg-surface-elevated px-4 py-2.5 text-sm text-zinc-100 placeholder-text-tertiary focus:outline-none focus:border-brand-primary disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          전송
        </button>
      </div>
    </div>
  );
}
