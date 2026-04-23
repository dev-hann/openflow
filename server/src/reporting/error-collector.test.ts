import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IssueReporter, ErrorReport } from "./issue-reporter.js";

describe("createErrorCollector", () => {
  let reported: ErrorReport[];
  let reporter: IssueReporter;
  let capturedHandlers: Map<string, Array<(...args: unknown[]) => void>>;

  beforeEach(() => {
    reported = [];
    reporter = {
      report: vi.fn(async (report: ErrorReport) => {
        reported.push(report);
        return { ok: true };
      }),
    };

    capturedHandlers = new Map();
    vi.spyOn(process, "on").mockImplementation(function (this: NodeJS.Process, event: string, handler: (...args: unknown[]) => void) {
      const list = capturedHandlers.get(event) ?? [];
      list.push(handler);
      capturedHandlers.set(event, list);
      return this;
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getHandler(event: string): ((...args: unknown[]) => void) | undefined {
    return capturedHandlers.get(event)?.[0];
  }

  it("should register unhandledRejection handler", async () => {
    const { createErrorCollector } = await import("./error-collector.js");
    createErrorCollector(reporter, "1.0.0");

    expect(getHandler("unhandledRejection")).toBeDefined();
  });

  it("should register uncaughtException handler", async () => {
    const { createErrorCollector } = await import("./error-collector.js");
    createErrorCollector(reporter, "1.0.0");

    expect(getHandler("uncaughtException")).toBeDefined();
  });

  it("should report unhandledRejection with correct fields", async () => {
    const { createErrorCollector } = await import("./error-collector.js");
    createErrorCollector(reporter, "1.0.0");

    const handler = getHandler("unhandledRejection")!;
    handler("rejection reason");

    await vi.waitFor(() => reported.length > 0);

    expect(reported).toHaveLength(1);
    expect(reported[0]).toEqual({
      platform: "server",
      version: "1.0.0",
      errorCode: "UNHANDLED_ERROR",
      message: "[unhandledRejection] rejection reason",
      stackTrace: undefined,
    });
  });

  it("should report uncaughtException with stack trace", async () => {
    const { createErrorCollector } = await import("./error-collector.js");
    createErrorCollector(reporter, "1.0.0");

    const handler = getHandler("uncaughtException")!;
    const err = new Error("something crashed");
    handler(err);

    await vi.waitFor(() => reported.length > 0);

    expect(reported).toHaveLength(1);
    expect(reported[0]!.message).toBe("[uncaughtException] something crashed");
    expect(reported[0]!.stackTrace).toContain("something crashed");
    expect(reported[0]!.errorCode).toBe("UNHANDLED_ERROR");
    expect(reported[0]!.platform).toBe("server");
    expect(reported[0]!.version).toBe("1.0.0");
  });

  it("should handle reporter failure gracefully", async () => {
    const failReporter: IssueReporter = {
      report: vi.fn(async () => {
        throw new Error("GitHub API down");
      }),
    };

    const freshHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
    vi.spyOn(process, "on").mockImplementation(function (this: NodeJS.Process, event: string, handler: (...args: unknown[]) => void) {
      const list = freshHandlers.get(event) ?? [];
      list.push(handler);
      freshHandlers.set(event, list);
      return this;
    } as never);

    const { createErrorCollector } = await import("./error-collector.js");
    createErrorCollector(failReporter, "2.0.0");

    const handler = freshHandlers.get("unhandledRejection")?.[0];
    if (!handler) return;
    handler("test");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(failReporter.report).toHaveBeenCalledOnce();
  });
});
