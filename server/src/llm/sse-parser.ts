import { createLogger } from "../utils/logger.js";

const log = createLogger("llm");

interface StreamState {
  fullContent: string;
  toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    index: number;
  }>;
}

function processSseLine(
  line: string,
  state: StreamState,
  onToken: (token: string) => void,
): void {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "data: [DONE]" || !trimmed.startsWith("data: ")) return;

  try {
    const parsed = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
    const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
    if (!choices?.[0]) return;

    const delta = choices[0]!.delta as Record<string, unknown>;
    if (typeof delta.content === "string") {
      state.fullContent += delta.content;
      if (delta.content) onToken(delta.content);
    }
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
        const idx = tc.index as number;
        if (!state.toolCalls[idx]) {
          state.toolCalls[idx] = {
            id: tc.id as string,
            type: "function" as const,
            function: { name: "", arguments: "" },
            index: idx,
          };
        }
        const fn = tc.function as Record<string, unknown> | undefined;
        if (fn?.name) state.toolCalls[idx]!.function.name += fn.name as string;
        if (fn?.arguments) state.toolCalls[idx]!.function.arguments += fn.arguments as string;
        if (tc.id) state.toolCalls[idx]!.id = tc.id as string;
      }
    }
  } catch {
    log.warn({ line: trimmed.slice(0, 120) }, "malformed SSE line skipped");
  }
}

export async function parseSseStream(
  body: NodeJS.ReadableStream | AsyncIterable<Uint8Array>,
  onToken: (token: string) => void,
): Promise<Record<string, unknown>> {
  const state: StreamState = { fullContent: "", toolCalls: [] };

  const decoder = new TextDecoder();
  const reader = (body as ReadableStream<Uint8Array>).getReader();

  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      processSseLine(line, state, onToken);
    }
  }

  if (state.toolCalls.length > 0) {
    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: state.fullContent || null,
            tool_calls: state.toolCalls,
          },
        },
      ],
    } as Record<string, unknown>;
  }

  return {
    choices: [
      {
        message: { role: "assistant", content: state.fullContent },
      },
    ],
  } as Record<string, unknown>;
}
