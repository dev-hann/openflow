import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkspaceLoader } from "./workspace.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `openflow-test-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("createWorkspaceLoader", () => {
  it("should create workspace and daily directories", () => {
    createWorkspaceLoader({ workspaceDir: testDir });
    expect(existsSync(testDir)).toBe(true);
    expect(existsSync(join(testDir, "daily"))).toBe(true);
  });

  it("should return null for all files when empty", () => {
    const loader = createWorkspaceLoader({ workspaceDir: testDir });
    const files = loader.loadAll();
    expect(files.persona).toBeNull();
    expect(files.user).toBeNull();
    expect(files.memory).toBeNull();
    expect(files.dailyMemory).toBeNull();
  });

  it("should load PERSONA.md", () => {
    writeFileSync(join(testDir, "PERSONA.md"), "You are a friendly assistant.", "utf-8");
    const loader = createWorkspaceLoader({ workspaceDir: testDir });
    const files = loader.loadAll();
    expect(files.persona).toBe("You are a friendly assistant.");
  });

  it("should load USER.md", () => {
    writeFileSync(join(testDir, "USER.md"), "- Name: Hann\n- Timezone: Asia/Seoul", "utf-8");
    const loader = createWorkspaceLoader({ workspaceDir: testDir });
    const files = loader.loadAll();
    expect(files.user).toContain("Hann");
  });

  it("should load MEMORY.md", () => {
    writeFileSync(join(testDir, "MEMORY.md"), "User prefers Korean language.", "utf-8");
    const loader = createWorkspaceLoader({ workspaceDir: testDir });
    const files = loader.loadAll();
    expect(files.memory).toContain("Korean");
  });

  it("should load daily memory files", () => {
    const dailyDir = join(testDir, "daily");
    mkdirSync(dailyDir, { recursive: true });
    writeFileSync(join(dailyDir, "2026-04-16.md"), "Discussed project architecture.", "utf-8");
    writeFileSync(join(dailyDir, "2026-04-17.md"), "Fixed notification push service.", "utf-8");

    const loader = createWorkspaceLoader({ workspaceDir: testDir, dailyMemoryDays: 2 });
    const files = loader.loadAll();
    expect(files.dailyMemory).toContain("2026-04-17");
    expect(files.dailyMemory).toContain("notification");
  });

  it("should truncate long daily files", () => {
    const dailyDir = join(testDir, "daily");
    mkdirSync(dailyDir, { recursive: true });
    const longContent = "x".repeat(2000);
    writeFileSync(join(dailyDir, "2026-04-17.md"), longContent, "utf-8");

    const loader = createWorkspaceLoader({ workspaceDir: testDir, dailyMemoryDays: 1 });
    const files = loader.loadAll();
    expect(files.dailyMemory!.length).toBeLessThan(longContent.length);
  });

  it("should respect dailyMemoryDays limit", () => {
    const dailyDir = join(testDir, "daily");
    mkdirSync(dailyDir, { recursive: true });
    writeFileSync(join(dailyDir, "2026-04-15.md"), "Day 15", "utf-8");
    writeFileSync(join(dailyDir, "2026-04-16.md"), "Day 16", "utf-8");
    writeFileSync(join(dailyDir, "2026-04-17.md"), "Day 17", "utf-8");

    const loader = createWorkspaceLoader({ workspaceDir: testDir, dailyMemoryDays: 1 });
    const files = loader.loadAll();
    expect(files.dailyMemory).toContain("2026-04-17");
    expect(files.dailyMemory).not.toContain("2026-04-16");
  });

  it("should write daily memory", () => {
    const loader = createWorkspaceLoader({ workspaceDir: testDir });
    loader.writeDailyMemory("Important decision made today.");

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dailyDir = join(testDir, "daily");
    const content = readFileSync(join(dailyDir, `${dateStr}.md`), "utf-8");
    expect(content).toContain("Important decision");
  });

  it("should append to existing daily memory", () => {
    const loader = createWorkspaceLoader({ workspaceDir: testDir });
    loader.writeDailyMemory("First entry.");
    loader.writeDailyMemory("Second entry.");

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dailyDir = join(testDir, "daily");
    const content = readFileSync(join(dailyDir, `${dateStr}.md`), "utf-8");
    expect(content).toContain("First entry.");
    expect(content).toContain("Second entry.");
  });

  it("should resolve ~ path", () => {
    const loader = createWorkspaceLoader({ workspaceDir: "~/some-test-path" });
    expect(loader.getWorkspaceDir()).toContain("home");
    expect(loader.getWorkspaceDir()).not.toContain("~");
  });

  it("should return persona path", () => {
    const loader = createWorkspaceLoader({ workspaceDir: testDir });
    expect(loader.getPersonaPath()).toBe(join(testDir, "PERSONA.md"));
  });
});
