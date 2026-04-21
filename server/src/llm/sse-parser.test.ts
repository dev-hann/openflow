import { describe, it, expect } from "vitest";
import { parseSseStream } from "./sse-parser.js";

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function contentDelta(text: string): string {
  return JSON.stringify({
    choices: [{ delta: { content: text } }],
  });
}

function toolCallDelta(
  index: number,
  id: string | null,
  fnName?: string,
  fnArgs?: string,
): string {
  const delta: Record<string, unknown> = { index };
  if (id !== null) delta.id = id;
  if (fnName !== undefined) {
    delta.function = { name: fnName };
  } else if (fnArgs !== undefined) {
    delta.function = { arguments: fnArgs };
  }
  return JSON.stringify({ choices: [{ delta: { tool_calls: [delta] } }] });
}

describe("parseSseStream", () => {
  it("should stream content tokens", async () => {
    const tokens: string[] = [];
    await parseSseStream(
      makeStream([
        `data: ${contentDelta("Hello")}\n\ndata: ${contentDelta(" world")}\n\ndata: [DONE]\n\n`,
      ]),
      (t) => tokens.push(t),
    );
    expect(tokens).toEqual(["Hello", " world"]);
  });

  it("should accumulate tool calls across multiple deltas", async () => {
    const result = await parseSseStream(
      makeStream([
        `data: ${toolCallDelta(0, "call_1", "shell")}\n\n`,
        `data: ${toolCallDelta(0, null, undefined, '{"com')}\n\n`,
        `data: ${toolCallDelta(0, null, undefined, 'mand":"ls"}')}\n\n`,
        `data: [DONE]\n\n`,
      ]),
      () => {},
    );

    const choices = result.choices as Array<Record<string, unknown>>;
    const msg = choices[0]!.message as Record<string, unknown>;
    expect(msg.role).toBe("assistant");
    const tcs = msg.tool_calls as Array<Record<string, unknown>>;
    expect(tcs).toHaveLength(1);
    expect(tcs[0]!.id).toBe("call_1");
    expect((tcs[0]!.function as Record<string, unknown>).name).toBe("shell");
    expect((tcs[0]!.function as Record<string, unknown>).arguments).toBe(
      '{"command":"ls"}',
    );
  });

  it("should skip malformed JSON lines", async () => {
    const tokens: string[] = [];
    const result = await parseSseStream(
      makeStream([
        `data: ${contentDelta("ok")}\n\ndata: not-json\n\ndata: [DONE]\n\n`,
      ]),
      (t) => tokens.push(t),
    );
    expect(tokens).toEqual(["ok"]);
    const choices = result.choices as Array<Record<string, unknown>>;
    const msg = choices[0]!.message as Record<string, unknown>;
    expect(msg.content).toBe("ok");
  });

  it("should handle buffer split across chunks", async () => {
    const tokens: string[] = [];
    const chunk1 = `data: ${contentDelta("Hel")}\n\n`;
    const chunk2 = `data: ${contentDelta("lo")}\n\ndata: [DONE]\n\n`;
    await parseSseStream(makeStream([chunk1, chunk2]), (t) => tokens.push(t));
    expect(tokens).toEqual(["Hel", "lo"]);
  });

  it("should return empty content for empty stream", async () => {
    const result = await parseSseStream(
      makeStream(["data: [DONE]\n\n"]),
      () => {},
    );
    const choices = result.choices as Array<Record<string, unknown>>;
    const msg = choices[0]!.message as Record<string, unknown>;
    expect(msg.content).toBe("");
  });

  it("should handle mixed content and tool calls", async () => {
    const tokens: string[] = [];
    const result = await parseSseStream(
      makeStream([
        `data: ${contentDelta("Let me")}\n\n`,
        `data: ${contentDelta(" check")}\n\n`,
        `data: ${toolCallDelta(0, "call_1", "read_file")}\n\n`,
        `data: ${toolCallDelta(0, null, undefined, '{"path":"test.txt"}')}\n\n`,
        `data: [DONE]\n\n`,
      ]),
      (t) => tokens.push(t),
    );

    expect(tokens).toEqual(["Let me", " check"]);
    const choices = result.choices as Array<Record<string, unknown>>;
    const msg = choices[0]!.message as Record<string, unknown>;
    expect(msg.content).toBe("Let me check");
    expect(msg.tool_calls).toBeDefined();
  });

  it("should skip non-data lines", async () => {
    const tokens: string[] = [];
    await parseSseStream(
      makeStream([
        `: comment\n\nevent: ping\n\ndata: ${contentDelta("hi")}\n\ndata: [DONE]\n\n`,
      ]),
      (t) => tokens.push(t),
    );
    expect(tokens).toEqual(["hi"]);
  });

  it("should not call onToken for empty content delta", async () => {
    const tokens: string[] = [];
    await parseSseStream(
      makeStream([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "" } }] })}\n\n`,
        `data: ${contentDelta("real")}\n\n`,
        `data: [DONE]\n\n`,
      ]),
      (t) => tokens.push(t),
    );
    expect(tokens).toEqual(["real"]);
  });
});
