import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import {
  validateWorkspacePath,
  createFileReadTool,
  createFileWriteTool,
  createListDirTool,
} from "./file-tools.js";

describe("validateWorkspacePath", () => {
  const testDir = join(tmpdir(), `openflow-test-filetools-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should resolve a path inside workspace", () => {
    const filePath = join(testDir, "test.txt");
    writeFileSync(filePath, "hello");
    const result = validateWorkspacePath(filePath, testDir);
    expect(result).toBe(resolve(filePath));
  });

  it("should reject a path outside workspace", () => {
    expect(() => validateWorkspacePath("/etc/passwd", testDir)).toThrow(
      "Path is outside workspace",
    );
  });

  it("should reject path traversal with ..", () => {
    const traversal = join(testDir, "..", "..", "etc", "passwd");
    expect(() => validateWorkspacePath(traversal, testDir)).toThrow(
      "Path is outside workspace",
    );
  });

  it("should allow non-existent path inside workspace", () => {
    const filePath = join(testDir, "nonexistent.txt");
    const result = validateWorkspacePath(filePath, testDir);
    expect(result).toBe(resolve(filePath));
  });

  it("should reject non-existent path outside workspace", () => {
    expect(() =>
      validateWorkspacePath("/tmp/outside-test-file.txt", testDir),
    ).toThrow("Path is outside workspace");
  });

  it("should resolve symlink inside workspace", () => {
    const target = join(testDir, "target.txt");
    const link = join(testDir, "link.txt");
    writeFileSync(target, "data");
    symlinkSync(target, link);

    const result = validateWorkspacePath(link, testDir);
    expect(result).toBe(resolve(target));
  });

  it("should reject symlink pointing outside workspace", () => {
    const outsideDir = join(tmpdir(), `openflow-test-outside-${Date.now()}`);
    mkdirSync(outsideDir, { recursive: true });
    const outsideFile = join(outsideDir, "secret.txt");
    writeFileSync(outsideFile, "secret");

    const link = join(testDir, "escape.txt");
    symlinkSync(outsideFile, link);

    expect(() => validateWorkspacePath(link, testDir)).toThrow(
      "Path is outside workspace",
    );

    rmSync(outsideDir, { recursive: true, force: true });
  });
});

describe("createFileReadTool", () => {
  const testDir = join(tmpdir(), `openflow-test-readtool-${Date.now()}`);
  const tool = createFileReadTool(testDir);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should read file content", async () => {
    const filePath = join(testDir, "read.txt");
    writeFileSync(filePath, "file content");
    const result = await tool.execute({ path: filePath });
    expect(result).toBe("file content");
  });

  it("should throw for missing file", async () => {
    await expect(
      tool.execute({ path: join(testDir, "missing.txt") }),
    ).rejects.toThrow("File not found");
  });

  it("should throw for path outside workspace", async () => {
    await expect(tool.execute({ path: "/etc/passwd" })).rejects.toThrow(
      "outside workspace",
    );
  });

  it("should throw for missing path argument", async () => {
    await expect(tool.execute({})).rejects.toThrow("Missing or invalid argument: path");
  });

  it("should throw for non-string path argument", async () => {
    await expect(tool.execute({ path: 123 })).rejects.toThrow(
      "Missing or invalid argument: path",
    );
  });

  it("should throw for empty path argument", async () => {
    await expect(tool.execute({ path: "" })).rejects.toThrow(
      "Missing or invalid argument: path",
    );
  });

  it("should truncate large content", async () => {
    const filePath = join(testDir, "large.txt");
    const largeContent = "x".repeat(60_000);
    writeFileSync(filePath, largeContent);
    const result = await tool.execute({ path: filePath });
    expect(result.length).toBeLessThan(largeContent.length);
  });
});

describe("createFileWriteTool", () => {
  const testDir = join(tmpdir(), `openflow-test-writetool-${Date.now()}`);
  const tool = createFileWriteTool(testDir);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should write file content", async () => {
    const filePath = join(testDir, "write.txt");
    const result = await tool.execute({ path: filePath, content: "written" });
    expect(result).toBe("OK");
    expect(readFileSync(filePath, "utf-8")).toBe("written");
  });

  it("should create nested directories", async () => {
    const filePath = join(testDir, "a", "b", "c", "file.txt");
    const result = await tool.execute({
      path: filePath,
      content: "nested",
    });
    expect(result).toBe("OK");
    expect(readFileSync(filePath, "utf-8")).toBe("nested");
  });

  it("should overwrite existing file", async () => {
    const filePath = join(testDir, "overwrite.txt");
    writeFileSync(filePath, "old");
    await tool.execute({ path: filePath, content: "new" });
    expect(readFileSync(filePath, "utf-8")).toBe("new");
  });

  it("should throw for path outside workspace", async () => {
    await expect(
      tool.execute({ path: "/tmp/outside.txt", content: "nope" }),
    ).rejects.toThrow("outside workspace");
  });

  it("should throw for missing path argument", async () => {
    await expect(
      tool.execute({ content: "nope" }),
    ).rejects.toThrow("Missing or invalid argument: path");
  });

  it("should throw for missing content argument", async () => {
    const filePath = join(testDir, "nocontent.txt");
    await expect(
      tool.execute({ path: filePath }),
    ).rejects.toThrow("Missing or invalid argument: content");
  });
});

describe("createListDirTool", () => {
  const testDir = join(tmpdir(), `openflow-test-listtool-${Date.now()}`);
  const tool = createListDirTool(testDir);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should list files and directories", async () => {
    writeFileSync(join(testDir, "file.txt"), "f");
    mkdirSync(join(testDir, "subdir"), { recursive: true });

    const result = await tool.execute({ path: testDir });
    expect(result).toContain("file.txt");
    expect(result).toContain("subdir/");
  });

  it("should return (empty directory) for empty dir", async () => {
    const emptyDir = join(testDir, "empty");
    mkdirSync(emptyDir);
    const result = await tool.execute({ path: emptyDir });
    expect(result).toBe("(empty directory)");
  });

  it("should throw for non-existent directory", async () => {
    await expect(tool.execute({ path: join(testDir, "nope") })).rejects.toThrow(
      "Directory not found",
    );
  });

  it("should throw for path outside workspace", async () => {
    await expect(tool.execute({ path: "/etc" })).rejects.toThrow(
      "outside workspace",
    );
  });

  it("should throw for missing path argument", async () => {
    await expect(tool.execute({})).rejects.toThrow(
      "Missing or invalid argument: path",
    );
  });
});
