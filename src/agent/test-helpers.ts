import { vi } from "vitest";
import type { LlmClient, LlmResponse } from "../llm/index.js";
import type { ToolExecutor } from "../tools/index.js";

export function mockLlmClient(responses: LlmResponse[]): LlmClient {
  let callIndex = 0;
  return {
    chat: vi.fn().mockImplementation(async () => {
      const response = responses[Math.min(callIndex, responses.length - 1)];
      callIndex++;
      return response!;
    }),
    complete: vi.fn(),
  };
}

export function mockToolExecutor(
  results: Record<string, string>,
  needsConfirmationFn?: (name: string) => boolean,
): ToolExecutor {
  return {
    getDefinitions: () => [
      {
        type: "function" as const,
        function: {
          name: "test_tool",
          description: "A test tool",
          parameters: { type: "object" as const, properties: {} },
        },
      },
    ],
    execute: vi.fn().mockImplementation(async (call) => {
      const content = results[call.name] ?? "tool result";
      return { toolCallId: call.id, content, isError: false };
    }),
    needsConfirmation: needsConfirmationFn ?? (() => false),
    updateSender: vi.fn(),
  };
}
