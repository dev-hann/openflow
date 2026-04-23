import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createIssueReporter } from "./issue-reporter.js";
import { OpenFlowError } from "../utils/errors.js";

const GITHUB_TOKEN = "ghp_test-token-for-testing";
const GITHUB_REPO = "test-owner/test-repo";

function mockGithubSearchResponse(items: Array<{ number: number }> = []) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ items }),
  };
}

function mockGithubCreateIssueResponse(number: number, url: string) {
  return {
    ok: true,
    status: 201,
    json: () => Promise.resolve({ number, html_url: url }),
  };
}

function mockGithubCommentResponse() {
  return {
    ok: true,
    status: 201,
    json: () => Promise.resolve({ id: 1 }),
  };
}

describe("createIssueReporter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw on invalid githubRepo format", () => {
    expect(() => createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: "invalid",
      rateLimitPerMinute: 10,
    })).toThrow(OpenFlowError);
  });

  it("should throw on githubRepo with empty parts", () => {
    expect(() => createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: "/repo",
      rateLimitPerMinute: 10,
    })).toThrow(OpenFlowError);
  });

  it("should create a new issue when no existing issue found", async () => {
    const reporter = createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: GITHUB_REPO,
      rateLimitPerMinute: 10,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(mockGithubSearchResponse())
        .mockResolvedValueOnce(
          mockGithubCreateIssueResponse(42, "https://github.com/test-owner/test-repo/issues/42"),
        ),
    );

    const result = await reporter.report({
      platform: "app",
      version: "1.0.0",
      errorCode: "CRASH",
      message: "App crashed",
    });

    expect(result.ok).toBe(true);
    expect(result.issueNumber).toBe(42);
    expect(result.issueUrl).toBe("https://github.com/test-owner/test-repo/issues/42");
  });

  it("should add comment to existing issue when fingerprint matches", async () => {
    const reporter = createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: GITHUB_REPO,
      rateLimitPerMinute: 10,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(mockGithubSearchResponse([{ number: 10 }]))
        .mockResolvedValueOnce(mockGithubCommentResponse()),
    );

    const result = await reporter.report({
      platform: "server",
      version: "0.1.0",
      errorCode: "DB_ERROR",
      message: "Database locked",
      stackTrace: "Error: locked\n  at db.ts:10",
    });

    expect(result.ok).toBe(true);
    expect(result.issueNumber).toBe(10);
    expect(result.issueUrl).toBeUndefined();
  });

  it("should return ok:false when issue creation fails", async () => {
    const reporter = createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: GITHUB_REPO,
      rateLimitPerMinute: 10,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(mockGithubSearchResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve("forbidden") }),
    );

    const result = await reporter.report({
      platform: "web",
      version: "2.0.0",
      errorCode: "UI_ERROR",
      message: "Render failed",
    });

    expect(result.ok).toBe(false);
  });

  it("should return ok:false when rate limit exceeded", async () => {
    const reporter = createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: GITHUB_REPO,
      rateLimitPerMinute: 1,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockGithubSearchResponse()),
    );

    await reporter.report({
      platform: "app",
      version: "1.0.0",
      errorCode: "ERR",
      message: "first",
    });

    const result = await reporter.report({
      platform: "app",
      version: "1.0.0",
      errorCode: "ERR",
      message: "second",
    });

    expect(result.ok).toBe(false);
  });

  it("should return ok:false on fetch error", async () => {
    const reporter = createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: GITHUB_REPO,
      rateLimitPerMinute: 10,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failure")),
    );

    const result = await reporter.report({
      platform: "server",
      version: "1.0.0",
      errorCode: "TIMEOUT",
      message: "Request timed out",
    });

    expect(result.ok).toBe(false);
  });

  it("should include stackTrace and metadata in issue body", async () => {
    const reporter = createIssueReporter({
      githubToken: GITHUB_TOKEN,
      githubRepo: GITHUB_REPO,
      rateLimitPerMinute: 10,
    });

    let capturedBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(mockGithubSearchResponse())
        .mockImplementationOnce(async (_url: string, opts: RequestInit) => {
          capturedBody = opts.body as string;
          return mockGithubCreateIssueResponse(1, "https://github.com/test/test/issues/1");
        }),
    );

    await reporter.report({
      platform: "app",
      version: "1.0.0",
      errorCode: "FATAL",
      message: "Out of memory",
      stackTrace: "Error: OOM\n  at index.js:1",
      metadata: { device: "Pixel 7", memory: "8GB" },
    });

    expect(capturedBody).toContain("Error: OOM");
    expect(capturedBody).toContain("Pixel 7");
  });
});
