import { createLogger } from "../utils/logger.js";
import { OpenFlowError } from "../utils/errors.js";
import { generateFingerprint } from "./fingerprint.js";

const log = createLogger("reporting/issue-reporter");

export interface ErrorReport {
  platform: "server" | "app" | "web";
  version: string;
  errorCode: string;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

export interface IssueReporterConfig {
  githubToken: string;
  githubRepo: string;
  rateLimitPerMinute: number;
}

export interface IssueReporter {
  report(
    report: ErrorReport,
  ): Promise<{ ok: boolean; issueNumber?: number; issueUrl?: string }>;
}

interface RateLimitEntry {
  timestamp: number;
}

async function githubApi(
  githubToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `https://api.github.com${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
}

function buildIssueBody(report: ErrorReport, fingerprint: string): string {
  const parts: string[] = [];
  parts.push(`<!-- openflow-error-report`);
  parts.push(`fingerprint: ${fingerprint}`);
  parts.push(`platform: ${report.platform}`);
  parts.push(`-->`);
  parts.push("");
  parts.push(`## Auto Error Report`);
  parts.push("");
  parts.push(`| Field | Value |`);
  parts.push(`|-------|-------|`);
  parts.push(`| Platform | \`${report.platform}\` |`);
  parts.push(`| Version | \`${report.version}\` |`);
  parts.push(`| Error Code | \`${report.errorCode}\` |`);
  parts.push("");
  parts.push(`**Message:** ${report.message}`);
  if (report.stackTrace) {
    parts.push("");
    parts.push("<details><summary>Stack Trace</summary>");
    parts.push("");
    parts.push("```");
    parts.push(report.stackTrace);
    parts.push("```");
    parts.push("</details>");
  }
  if (report.metadata && Object.keys(report.metadata).length > 0) {
    parts.push("");
    parts.push("<details><summary>Metadata</summary>");
    parts.push("");
    parts.push("```json");
    parts.push(JSON.stringify(report.metadata, null, 2));
    parts.push("```");
    parts.push("</details>");
  }
  return parts.join("\n");
}

async function findExistingIssue(
  githubToken: string,
  owner: string,
  repo: string,
  fingerprint: string,
): Promise<number | null> {
  try {
    const query = `repo:${owner}/${repo} is:issue is:open label:auto-reported in:body "${fingerprint}"`;
    const res = await githubApi(
      githubToken,
      `/search/issues?q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) {
      log.debug({ status: res.status }, "GitHub issue search returned non-OK status");
      return null;
    }
    const data = (await res.json()) as { items?: { number: number }[] };
    if (data.items && data.items.length > 0) return data.items[0]!.number;
    return null;
  } catch (err: unknown) {
    log.debug({ err }, "GitHub issue search failed");
    return null;
  }
}

async function addComment(
  githubToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
  report: ErrorReport,
): Promise<void> {
  const body = [
    `**Recurrence reported** (${new Date().toISOString()})`,
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| Platform | \`${report.platform}\` |`,
    `| Version | \`${report.version}\` |`,
    `| Message | ${report.message} |`,
  ].join("\n");

  await githubApi(githubToken, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

async function createNewIssue(
  githubToken: string,
  owner: string,
  repo: string,
  report: ErrorReport,
  fingerprint: string,
): Promise<{ number: number; url: string } | null> {
  const title = `[auto] [${report.platform}] ${report.errorCode}: ${report.message.slice(0, 80)}`;
  const body = buildIssueBody(report, fingerprint);
  const labels = ["bug", "auto-reported", report.platform];

  const res = await githubApi(githubToken, `/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!res.ok) {
    const text = await res.text();
    log.error({ status: res.status, body: text }, "failed to create issue");
    return null;
  }

  const data = (await res.json()) as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}

export function createIssueReporter(config: IssueReporterConfig): IssueReporter {
  const parts = config.githubRepo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new OpenFlowError(`Invalid githubRepo format: "${config.githubRepo}". Expected "owner/repo".`, "CONFIG_INVALID");
  }
  const [owner, repo] = parts as [string, string];
  const recentReports: RateLimitEntry[] = [];

  function checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;
    while (recentReports.length > 0 && recentReports[0]!.timestamp <= windowStart) {
      recentReports.shift();
    }
    if (recentReports.length >= config.rateLimitPerMinute) {
      return false;
    }
    recentReports.push({ timestamp: now });
    return true;
  }

  async function report(
    errorReport: ErrorReport,
  ): Promise<{ ok: boolean; issueNumber?: number; issueUrl?: string }> {
    if (!checkRateLimit()) {
      log.warn("rate limit exceeded, dropping error report");
      return { ok: false };
    }

    const fingerprint = generateFingerprint(
      errorReport.platform,
      errorReport.errorCode,
      errorReport.stackTrace,
    );

    try {
      const existingNumber = await findExistingIssue(config.githubToken, owner, repo, fingerprint);
      if (existingNumber !== null) {
        await addComment(config.githubToken, owner, repo, existingNumber, errorReport);
        log.info({ issueNumber: existingNumber }, "added recurrence comment to existing issue");
        return { ok: true, issueNumber: existingNumber };
      }

      const created = await createNewIssue(config.githubToken, owner, repo, errorReport, fingerprint);
      if (created) {
        log.info({ issueNumber: created.number, url: created.url }, "created new issue");
        return { ok: true, issueNumber: created.number, issueUrl: created.url };
      }
      return { ok: false };
    } catch (err: unknown) {
      log.error({ err }, "failed to report error to GitHub");
      return { ok: false };
    }
  }

  return { report };
}
