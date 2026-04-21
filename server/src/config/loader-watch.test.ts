import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { watchFileMock } = vi.hoisted(() => {
  let watcherCallback: () => void = () => {};
  return {
    watchFileMock: Object.assign(
      vi.fn().mockImplementation((_path: unknown, _opts: unknown, cb: unknown) => {
        watcherCallback = cb as () => void;
        return { unref: vi.fn() };
      }),
      { getCallback: () => watcherCallback },
    ),
  };
});

vi.mock("node:fs", async (importOriginal) => {
  const original = (await importOriginal()) as object;
  return { ...original, watchFile: watchFileMock };
});

import { loadConfig, resetConfigCache, watchConfig } from "./loader.js";

describe("watchConfig", () => {
  const testDir = join(tmpdir(), `openflow-test-watch-${Date.now()}`);
  const testConfigPath = join(testDir, "openflow.json");

  beforeEach(() => {
    resetConfigCache();
    mkdirSync(testDir, { recursive: true });
    process.env.OPENFLOW_CONFIG = testConfigPath;
    vi.useFakeTimers();
    watchFileMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetConfigCache();
    delete process.env.OPENFLOW_CONFIG;
    delete process.env.OPENFLOW_LOG_LEVEL;
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should return unwatch function for nonexistent config", () => {
    delete process.env.OPENFLOW_CONFIG;
    const unwatch = watchConfig(() => {});
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  it("should return unwatch function for existing config", () => {
    writeFileSync(testConfigPath, JSON.stringify({ agent: {}, memory: {} }));
    const unwatch = watchConfig(() => {});
    expect(typeof unwatch).toBe("function");
    unwatch();
  });

  it("should reload config and call onChange on file change", () => {
    writeFileSync(testConfigPath, JSON.stringify({ agent: {}, memory: {} }));
    loadConfig();

    const onChange = vi.fn();
    const unwatch = watchConfig(onChange);

    writeFileSync(
      testConfigPath,
      JSON.stringify({ logging: { level: "debug" }, agent: {}, memory: {} }),
    );
    watchFileMock.getCallback()();
    vi.advanceTimersByTime(600);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].logging.level).toBe("debug");

    unwatch();
  });

  it("should debounce rapid file changes into single reload", () => {
    writeFileSync(testConfigPath, JSON.stringify({ agent: {}, memory: {} }));
    loadConfig();

    const onChange = vi.fn();
    const unwatch = watchConfig(onChange);

    writeFileSync(
      testConfigPath,
      JSON.stringify({ logging: { level: "warn" }, agent: {}, memory: {} }),
    );
    const cb = watchFileMock.getCallback();
    cb();
    cb();
    cb();
    vi.advanceTimersByTime(600);

    expect(onChange).toHaveBeenCalledTimes(1);

    unwatch();
  });

  it("should handle reload error gracefully", () => {
    writeFileSync(testConfigPath, JSON.stringify({ agent: {}, memory: {} }));
    loadConfig();

    const onChange = vi.fn();
    const unwatch = watchConfig(onChange);

    writeFileSync(testConfigPath, "{ corrupted");
    watchFileMock.getCallback()();
    vi.advanceTimersByTime(600);

    expect(onChange).not.toHaveBeenCalled();

    unwatch();
  });

  it("should not call onChange when config content unchanged", () => {
    const content = JSON.stringify({ agent: {}, memory: {} });
    writeFileSync(testConfigPath, content);
    loadConfig();

    const onChange = vi.fn();
    const unwatch = watchConfig(onChange);

    writeFileSync(testConfigPath, content);
    watchFileMock.getCallback()();
    vi.advanceTimersByTime(600);

    expect(onChange).not.toHaveBeenCalled();

    unwatch();
  });

  it("should clear debounce timer on unwatch", () => {
    writeFileSync(testConfigPath, JSON.stringify({ agent: {}, memory: {} }));
    loadConfig();

    const onChange = vi.fn();
    const unwatch = watchConfig(onChange);
    watchFileMock.getCallback()();
    unwatch();

    vi.advanceTimersByTime(600);
    expect(onChange).not.toHaveBeenCalled();
  });
});
