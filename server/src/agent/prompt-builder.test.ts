import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt-builder.js";
import type { SkillMeta } from "./skill-loader.js";

const noFiles = { persona: null, user: null, memory: null, dailyMemory: null };

describe("buildSystemPrompt", () => {
  it("should build minimal prompt with no workspace files", () => {
    const prompt = buildSystemPrompt(noFiles, { workspace: "/home/user/workspace" });

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
    const prompt = buildSystemPrompt(noFiles, { workspace: "/tmp" });

    const today = new Date().toISOString().split("T")[0];
    expect(prompt).toContain(today);
  });

  it("should include timezone when provided", () => {
    const prompt = buildSystemPrompt(noFiles, { workspace: "/tmp", timezone: "Asia/Seoul" });

    expect(prompt).toContain("Asia/Seoul");
  });

  it("should include memory flush instructions", () => {
    const prompt = buildSystemPrompt(noFiles, { workspace: "/tmp" });

    expect(prompt).toContain("write_file");
    expect(prompt).toContain("daily memory");
  });

  it("should not include skills section when no skills provided", () => {
    const prompt = buildSystemPrompt(noFiles, { workspace: "/tmp" });

    expect(prompt).not.toContain("<skills>");
    expect(prompt).not.toContain("Available Skills");
  });

  it("should include skills section with XML", () => {
    const skills: SkillMeta[] = [
      { name: "weather", description: "Get weather forecasts", location: "/skills/weather/SKILL.md" },
    ];
    const prompt = buildSystemPrompt(noFiles, { workspace: "/tmp" }, skills);

    expect(prompt).toContain("Available Skills");
    expect(prompt).toContain("<skills>");
    expect(prompt).toContain("<name>weather</name>");
    expect(prompt).toContain("<description>Get weather forecasts</description>");
    expect(prompt).toContain("<location>/skills/weather/SKILL.md</location>");
    expect(prompt).toContain("</skills>");
    expect(prompt).toContain("read_file");
  });

  it("should place skills between user profile and memory sections", () => {
    const skills: SkillMeta[] = [
      { name: "test", description: "Test skill", location: "/test/SKILL.md" },
    ];
    const prompt = buildSystemPrompt(
      { persona: null, user: "User info", memory: "Memory content", dailyMemory: null },
      { workspace: "/tmp" },
      skills,
    );

    const userIdx = prompt.indexOf("User Profile");
    const skillIdx = prompt.indexOf("Available Skills");
    const memoryIdx = prompt.indexOf("Long-term Memory");

    expect(userIdx).toBeGreaterThan(-1);
    expect(skillIdx).toBeGreaterThan(userIdx);
    expect(memoryIdx).toBeGreaterThan(skillIdx);
  });
});
