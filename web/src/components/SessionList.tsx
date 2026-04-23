import type { SessionInfo } from "@/api/types";

interface Props {
  sessions: SessionInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function SessionList({ sessions, activeId, onSelect, onCreate, onDelete }: Props) {
  return (
    <div className="w-64 bg-surface-card border-r border-border-default flex flex-col h-full">
      <div className="p-3 border-b border-border-default">
        <button
          onClick={onCreate}
          className="w-full rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-text-primary hover:bg-brand-primary-hover transition-colors"
        >
          + 새 대화
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="text-text-tertiary text-xs text-center mt-8">대화가 없습니다</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-surface-hover transition-colors ${
              activeId === s.id
                ? "bg-surface-elevated text-text-primary"
                : "text-text-secondary hover:bg-surface-hover hover:text-zinc-200"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{s.title || "새 대화"}</p>
              <p className="text-xs text-text-tertiary">{s.messageCount}개 메시지</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-status-error transition-opacity p-1"
              title="삭제"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
