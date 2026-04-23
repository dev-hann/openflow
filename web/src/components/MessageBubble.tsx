import { useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";

interface Props {
  content: string;
}

export function MarkdownContent({ content }: Props) {
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface BubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: BubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-brand-primary text-text-primary"
            : "bg-surface-elevated text-zinc-100"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        ) : (
          <div className="text-sm">
            <MarkdownContent content={content} />
            {isStreaming && <span className="inline-block w-1.5 h-4 bg-brand-primary-light animate-pulse ml-0.5" />}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
}: {
  messages: { role: "user" | "assistant"; content: string; createdAt: number }[];
  streamingContent: string | null;
  isStreaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => (
        <MessageBubble key={i} role={msg.role} content={msg.content} />
      ))}
      {streamingContent && (
        <MessageBubble
          role="assistant"
          content={streamingContent}
          isStreaming={isStreaming}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
