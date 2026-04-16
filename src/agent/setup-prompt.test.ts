import { describe, it, expect } from "vitest";
import { SETUP_SYSTEM_PROMPT } from "./setup-prompt.js";

describe("SETUP_SYSTEM_PROMPT", () => {
  it("should include Korean language instruction", () => {
    expect(SETUP_SYSTEM_PROMPT).toContain("Korean");
    expect(SETUP_SYSTEM_PROMPT).toContain("한국어");
  });

  it("should instruct to ask one question at a time", () => {
    expect(SETUP_SYSTEM_PROMPT).toContain("ONE AT A TIME");
  });

  it("should mention PERSONA.md creation", () => {
    expect(SETUP_SYSTEM_PROMPT).toContain("PERSONA.md");
  });

  it("should mention USER.md creation", () => {
    expect(SETUP_SYSTEM_PROMPT).toContain("USER.md");
  });

  it("should mention write_file tool", () => {
    expect(SETUP_SYSTEM_PROMPT).toContain("write_file");
  });
});
