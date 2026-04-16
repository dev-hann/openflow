import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt-builder.js";

describe("buildSystemPrompt", () => {
  it("should build minimal prompt with no workspace files", () => {
    const prompt = buildSystemPrompt(
      { persona: null, user: null, memory: null, dailyMemory: null },
      { workspace: "/home/user/workspace" },
    );

    expect(prompt).toContain("OpenFlow");
    expect(prompt).toContain("/home/user/workspace");
    expect(prompt).not.toContain("PERSONA.md");
    expect(prompt).not.toContain("USER.md");
    expect(prompt).not.toContain("MEMORY.md");
  });

  it("should include persona section when PERSONA.md exists", () => {
    const prompt = buildSystemPrompt(
      { persona: "Be friendly and use Korean.", user: null, memory: null, dailyMemory: null },
      { workspace: "/tmp" },
    );

    expect(prompt).toContain("Be friendly and use Korean.");
    expect(prompt).toContain("Persona");
  });

  it("should include user profile section", () => {
    const prompt = buildSystemPrompt(
      { persona: null, user: "- Name: Hann\n- Timezone: Asia/Seoul", memory: null, dailyMemory: null },
      { workspace: "/tmp" },
    );

    expect(prompt).toContain("Hann");
    expect(prompt).toContain("Asia/Seoul");
  });

  it("should include memory and daily memory sections", () => {
    const prompt = buildSystemPrompt(
      { persona: null, user: null, memory: "User prefers dark mode.", dailyMemory: "### 2026-04-17\nFixed bugs." },
      { workspace: "/tmp" },
    );

    expect(prompt).toContain("dark mode");
    expect(prompt).toContain("2026-04-17");
    expect(prompt).toContain("Long-term Memory");
    expect(prompt).toContain("Daily Memory");
  });

  it("should include current date in runtime section", () => {
    const prompt = buildSystemPrompt(
      { persona: null, user: null, memory: null, dailyMemory: null },
      { workspace: "/tmp" },
    );

    const today = new Date().toISOString().split("T")[0];
    expect(prompt).toContain(today);
  });

  it("should include timezone when provided", () => {
    const prompt = buildSystemPrompt(
      { persona: null, user: null, memory: null, dailyMemory: null },
      { workspace: "/tmp", timezone: "Asia/Seoul" },
    );

    expect(prompt).toContain("Asia/Seoul");
  });

  it("should include memory flush instructions", () => {
    const prompt = buildSystemPrompt(
      { persona: null, user: null, memory: null, dailyMemory: null },
      { workspace: "/tmp" },
    );

    expect(prompt).toContain("write_file");
    expect(prompt).toContain("daily memory");
  });
});
