import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSkillLoader,
  buildSkillPrompt,
  parseFrontmatter,
  type SkillsConfig,
} from "./skill-loader.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `openflow-skill-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSkill(dir: string, name: string, frontmatter: string, body = ""): void {
  const skillDir = join(dir, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), `---\n${frontmatter}\n---\n${body}`, "utf-8");
}

const defaultConfig: SkillsConfig = {
  enabled: true,
  extraDirs: [],
  entries: {},
};

describe("parseFrontmatter", () => {
  it("parses name and description", () => {
    const content = "---\nname: weather\ndescription: Get weather info\n---\nBody";
    const result = parseFrontmatter(content);
    expect(result).toEqual({ name: "weather", description: "Get weather info" });
  });

  it("parses quoted description", () => {
    const content = '---\nname: test\ndescription: "A longer description here"\n---\n';
    const result = parseFrontmatter(content);
    expect(result).toEqual({ name: "test", description: "A longer description here" });
  });

  it("returns null when no frontmatter", () => {
    expect(parseFrontmatter("no frontmatter")).toBeNull();
  });

  it("returns partial when name missing", () => {
    const content = "---\ndescription: no name\n---\n";
    const result = parseFrontmatter(content);
    expect(result).toEqual({ description: "no name" });
  });
});

describe("createSkillLoader", () => {
  let tmpDir: string;
  let emptyGlobalDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    emptyGlobalDir = join(tmpDir, "empty-global");
    mkdirSync(emptyGlobalDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when skills disabled", () => {
    const config: SkillsConfig = { ...defaultConfig, enabled: false };
    const loader = createSkillLoader(config, tmpDir, { globalDir: emptyGlobalDir });
    expect(loader.loadAll()).toEqual([]);
  });

  it("loads skills from global dir", () => {
    writeSkill(emptyGlobalDir, "weather", "name: weather\ndescription: Get weather");

    const loader = createSkillLoader(defaultConfig, tmpDir, { globalDir: emptyGlobalDir });
    const skills = loader.loadAll();

    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("weather");
    expect(skills[0]!.description).toBe("Get weather");
  });

  it("loads skills from workspace skills dir", () => {
    const wsSkills = join(tmpDir, "skills");
    writeSkill(wsSkills, "github", "name: github\ndescription: GitHub operations");

    const loader = createSkillLoader(defaultConfig, tmpDir, { globalDir: emptyGlobalDir });
    const skills = loader.loadAll();

    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("github");
  });

  it("workspace skills override global", () => {
    writeSkill(emptyGlobalDir, "weather", "name: weather\ndescription: Global weather");

    const wsSkills = join(tmpDir, "skills");
    writeSkill(wsSkills, "weather", "name: weather\ndescription: Workspace weather");

    const loader = createSkillLoader(defaultConfig, tmpDir, { globalDir: emptyGlobalDir });
    const skills = loader.loadAll();

    expect(skills).toHaveLength(1);
    expect(skills[0]!.description).toBe("Workspace weather");
  });

  it("filters disabled skills", () => {
    const wsSkills = join(tmpDir, "skills");
    writeSkill(wsSkills, "weather", "name: weather\ndescription: Get weather");
    writeSkill(wsSkills, "disabled", "name: disabled\ndescription: Should be hidden");

    const config: SkillsConfig = {
      ...defaultConfig,
      entries: { disabled: { enabled: false } },
    };
    const loader = createSkillLoader(config, tmpDir, { globalDir: emptyGlobalDir });
    const skills = loader.loadAll();

    expect(skills).toHaveLength(1);
    expect(skills[0]!.name).toBe("weather");
  });

  it("skips skills without name or description", () => {
    const wsSkills = join(tmpDir, "skills");
    const badDir = join(wsSkills, "bad");
    mkdirSync(badDir, { recursive: true });
    writeFileSync(join(badDir, "SKILL.md"), "---\nname: only-name\n---\n", "utf-8");

    const loader = createSkillLoader(defaultConfig, tmpDir, { globalDir: emptyGlobalDir });
    expect(loader.loadAll()).toHaveLength(0);
  });

  it("skips directories without SKILL.md", () => {
    const wsSkills = join(tmpDir, "skills");
    const noSkillDir = join(wsSkills, "noskill");
    mkdirSync(noSkillDir, { recursive: true });
    writeFileSync(join(noSkillDir, "README.md"), "hello", "utf-8");

    const loader = createSkillLoader(defaultConfig, tmpDir, { globalDir: emptyGlobalDir });
    expect(loader.loadAll()).toHaveLength(0);
  });

  it("returns empty for non-existent directory", () => {
    const config: SkillsConfig = {
      ...defaultConfig,
      extraDirs: ["/nonexistent/path"],
    };
    const loader = createSkillLoader(config, tmpDir, { globalDir: emptyGlobalDir });
    expect(loader.loadAll()).toEqual([]);
  });
});

describe("buildSkillPrompt", () => {
  it("returns empty string for no skills", () => {
    expect(buildSkillPrompt([])).toBe("");
  });

  it("generates XML prompt with skills", () => {
    const skills = [
      { name: "weather", description: "Get weather", location: "/path/weather/SKILL.md" },
    ];
    const prompt = buildSkillPrompt(skills);

    expect(prompt).toContain("<skills>");
    expect(prompt).toContain("<name>weather</name>");
    expect(prompt).toContain("<description>Get weather</description>");
    expect(prompt).toContain("<location>/path/weather/SKILL.md</location>");
    expect(prompt).toContain("</skills>");
    expect(prompt).toContain("read_file");
  });

  it("includes multiple skills", () => {
    const skills = [
      { name: "a", description: "Skill A", location: "/a/SKILL.md" },
      { name: "b", description: "Skill B", location: "/b/SKILL.md" },
    ];
    const prompt = buildSkillPrompt(skills);

    expect(prompt).toContain("<name>a</name>");
    expect(prompt).toContain("<name>b</name>");
  });
});
