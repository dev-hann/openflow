import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { ensureDirSync, resolveHomePath, resolveHomePathToString } from "./fs.js";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

describe("ensureDirSync", () => {
  const testDir = join(tmpdir(), `openflow-fs-test-${Date.now()}`);

  it("should create directory when it does not exist", () => {
    ensureDirSync(testDir);
    expect(existsSync(testDir)).toBe(true);
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should not throw when directory already exists", () => {
    mkdirSync(testDir, { recursive: true });
    expect(() => ensureDirSync(testDir)).not.toThrow();
    rmSync(testDir, { recursive: true, force: true });
  });
});

describe("resolveHomePath", () => {
  it("should resolve ~/ to absolute path", () => {
    const result = resolveHomePath("~/test/path");
    expect(result).toBe(resolve(homedir(), "test/path"));
  });

  it("should return unchanged path without ~/ prefix", () => {
    expect(resolveHomePath("/absolute/path")).toBe("/absolute/path");
    expect(resolveHomePath("relative/path")).toBe("relative/path");
  });

  it("should handle bare ~", () => {
    expect(resolveHomePath("~")).toBe("~");
  });
});

describe("resolveHomePathToString", () => {
  it("should resolve ~/ using join", () => {
    const result = resolveHomePathToString("~/test/path");
    expect(result).toBe(join(homedir(), "test/path"));
  });

  it("should return unchanged path without ~/ prefix", () => {
    expect(resolveHomePathToString("/absolute/path")).toBe("/absolute/path");
    expect(resolveHomePathToString("relative/path")).toBe("relative/path");
  });

  it("should handle bare ~", () => {
    expect(resolveHomePathToString("~")).toBe("~");
  });
});
