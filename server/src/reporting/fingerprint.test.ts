import { describe, it, expect } from "vitest";
import { extractFirstFrame, generateFingerprint } from "./fingerprint.js";

describe("extractFirstFrame", () => {
  it("should extract first 'at' frame from stack trace", () => {
    const stack = [
      "Error: something broke",
      "    at foo (bar.ts:10:5)",
      "    at baz (qux.ts:20:3)",
    ].join("\n");
    expect(extractFirstFrame(stack)).toBe("at foo (bar.ts:10:5)");
  });

  it("should return empty string for undefined stack trace", () => {
    expect(extractFirstFrame(undefined)).toBe("");
  });

  it("should return empty string when no 'at' lines found", () => {
    expect(extractFirstFrame("no stack frames here")).toBe("");
  });

  it("should return empty string for empty string", () => {
    expect(extractFirstFrame("")).toBe("");
  });

  it("should handle single 'at' line", () => {
    expect(extractFirstFrame("    at test (file.ts:1:1)")).toBe(
      "at test (file.ts:1:1)",
    );
  });
});

describe("generateFingerprint", () => {
  it("should return consistent hash for same inputs", () => {
    const a = generateFingerprint("server", "DB_ERROR", "stack");
    const b = generateFingerprint("server", "DB_ERROR", "stack");
    expect(a).toBe(b);
  });

  it("should return different hashes for different platforms", () => {
    const a = generateFingerprint("server", "ERR", undefined);
    const b = generateFingerprint("app", "ERR", undefined);
    expect(a).not.toBe(b);
  });

  it("should return different hashes for different error codes", () => {
    const a = generateFingerprint("server", "ERR_A", undefined);
    const b = generateFingerprint("server", "ERR_B", undefined);
    expect(a).not.toBe(b);
  });

  it("should return 16-char hex string", () => {
    const fp = generateFingerprint("server", "TEST", undefined);
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("should produce same fingerprint for same stack trace first frame", () => {
    const stack1 = "Error\n    at foo (a.ts:1:1)\n    at bar (b.ts:2:2)";
    const stack2 = "Different message\n    at foo (a.ts:1:1)\n    at baz (c.ts:3:3)";
    expect(generateFingerprint("server", "ERR", stack1)).toBe(
      generateFingerprint("server", "ERR", stack2),
    );
  });
});
