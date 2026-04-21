import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { createJsonFileStore } from "./json-file-store.js";

describe("createJsonFileStore", () => {
  const testDir = join(tmpdir(), "openflow-test-json-store-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should return default value when file does not exist", () => {
    const store = createJsonFileStore(join(testDir, "missing.json"), {
      count: 0,
    });
    expect(store.getData()).toEqual({ count: 0 });
  });

  it("should persist data via setData", () => {
    const filePath = join(testDir, "set.json");
    const store = createJsonFileStore(filePath, { count: 0 });
    store.setData({ count: 42 });
    const raw = readFileSync(filePath, "utf-8");
    expect(JSON.parse(raw)).toEqual({ count: 42 });
    expect(store.getData()).toEqual({ count: 42 });
  });

  it("should persist data via update", () => {
    const filePath = join(testDir, "update.json");
    const store = createJsonFileStore<{ items: string[] }>(filePath, {
      items: [],
    });
    store.update((data) => {
      data.items.push("a", "b");
    });
    expect(store.getData()).toEqual({ items: ["a", "b"] });
    const raw = readFileSync(filePath, "utf-8");
    expect(JSON.parse(raw)).toEqual({ items: ["a", "b"] });
  });

  it("should load existing data from file", () => {
    const filePath = join(testDir, "existing.json");
    writeFileSync(filePath, JSON.stringify({ count: 99 }) + "\n", "utf-8");
    const store = createJsonFileStore(filePath, { count: 0 });
    expect(store.getData()).toEqual({ count: 99 });
  });

  it("should fall back to default when file contains invalid JSON", () => {
    const filePath = join(testDir, "invalid.json");
    writeFileSync(filePath, "not json{{{" + "\n", "utf-8");
    const store = createJsonFileStore(filePath, { count: 0 });
    expect(store.getData()).toEqual({ count: 0 });
  });

  it("should use validate function to reject malformed data", () => {
    const filePath = join(testDir, "validate.json");
    writeFileSync(filePath, JSON.stringify({ wrong: true }) + "\n", "utf-8");
    const isValid = (d: unknown): d is { count: number } =>
      typeof d === "object" &&
      d !== null &&
      "count" in d &&
      typeof (d as Record<string, unknown>).count === "number";
    const store = createJsonFileStore(filePath, { count: 0 }, { validate: isValid });
    expect(store.getData()).toEqual({ count: 0 });
  });

  it("should accept valid data through validate function", () => {
    const filePath = join(testDir, "validate-ok.json");
    writeFileSync(filePath, JSON.stringify({ count: 7 }) + "\n", "utf-8");
    const isValid = (d: unknown): d is { count: number } =>
      typeof d === "object" &&
      d !== null &&
      "count" in d &&
      typeof (d as Record<string, unknown>).count === "number";
    const store = createJsonFileStore(filePath, { count: 0 }, { validate: isValid });
    expect(store.getData()).toEqual({ count: 7 });
  });

  it("should create parent directories on save", () => {
    const filePath = join(testDir, "nested", "dir", "store.json");
    const store = createJsonFileStore(filePath, { count: 0 });
    store.setData({ count: 1 });
    const raw = readFileSync(filePath, "utf-8");
    expect(JSON.parse(raw)).toEqual({ count: 1 });
  });
});
