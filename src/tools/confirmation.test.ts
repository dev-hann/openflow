import { describe, it, expect } from "vitest";
import { NOOP_CONFIRMATION_HANDLER } from "./confirmation.js";

describe("NOOP_CONFIRMATION_HANDLER", () => {
  it("should always approve", async () => {
    const result = await NOOP_CONFIRMATION_HANDLER.requestConfirmation({
      chatId: 123,
      toolName: "shell",
      toolArgs: { command: "rm -rf /" },
      timeoutMs: 1000,
    });
    expect(result.approved).toBe(true);
  });
});
