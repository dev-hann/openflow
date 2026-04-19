import { createLogger } from "../utils/logger.js";

const log = createLogger("llm");

export async function parseSseStream(
  body: NodeJS.ReadableStream | AsyncIterable<Uint8Array>,
  onToken: (token: string) => void,
): Promise<Record<string, unknown>> {
  let buffer = "";
  let fullContent = "";
  let toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    index: number;
  }> = [];

  const decoder = new TextDecoder();
  const reader = (body as ReadableStream<Uint8Array>).getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const parsed = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
        const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
        if (!choices?.[0]) continue;

        const delta = choices[0]!.delta as Record<string, unknown>;
        if (typeof delta.content === "string") {
          fullContent += delta.content;
          if (delta.content) onToken(delta.content);
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
            const idx = tc.index as number;
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id as string,
                type: "function" as const,
                function: { name: "", arguments: "" },
                index: idx,
              };
            }
            const fn = tc.function as Record<string, unknown> | undefined;
            if (fn?.name) toolCalls[idx]!.function.name += fn.name as string;
            if (fn?.arguments) toolCalls[idx]!.function.arguments += fn.arguments as string;
            if (tc.id) toolCalls[idx]!.id = tc.id as string;
          }
        }
      } catch {
        log.warn({ line: trimmed.slice(0, 120) }, "malformed SSE line skipped");
      }
    }
  }

  if (toolCalls.length > 0) {
    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: fullContent || null,
            tool_calls: toolCalls,
          },
        },
      ],
    } as Record<string, unknown>;
  }

  return {
    choices: [
      {
        message: { role: "assistant", content: fullContent },
      },
    ],
  } as Record<string, unknown>;
}
