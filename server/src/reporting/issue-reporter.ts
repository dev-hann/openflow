import { createLogger } from "../utils/logger.js";
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

interface RateLimitEntry {
  timestamp: number;
}

export class IssueReporter {
  private config: IssueReporterConfig;
  private recentReports: RateLimitEntry[] = [];

  constructor(config: IssueReporterConfig) {
    this.config = config;
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;
    this.recentReports = this.recentReports.filter((e) => e.timestamp > windowStart);
    if (this.recentReports.length >= this.config.rateLimitPerMinute) {
      return false;
    }
    this.recentReports.push({ timestamp: now });
    return true;
  }

  private async githubApi(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `https://api.github.com${path}`;
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });
  }

  private buildIssueBody(report: ErrorReport, fingerprint: string): string {
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

  private async findExistingIssue(fingerprint: string): Promise<number | null> {
    try {
      const [owner, repo] = this.config.githubRepo.split("/");
      const query = `repo:${owner}/${repo} is:issue is:open label:auto-reported in:body "${fingerprint}"`;
      const res = await this.githubApi(
        `/search/issues?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { items?: { number: number }[] };
      if (data.items && data.items.length > 0) return data.items[0]!.number;
      return null;
    } catch {
      return null;
    }
  }

  private async addComment(
    issueNumber: number,
    report: ErrorReport,
  ): Promise<void> {
    const [owner, repo] = this.config.githubRepo.split("/");
    const body = [
      `**Recurrence reported** (${new Date().toISOString()})`,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Platform | \`${report.platform}\` |`,
      `| Version | \`${report.version}\` |`,
      `| Message | ${report.message} |`,
    ].join("\n");

    await this.githubApi(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
  }

  private async createNewIssue(
    report: ErrorReport,
    fingerprint: string,
  ): Promise<{ number: number; url: string } | null> {
    const [owner, repo] = this.config.githubRepo.split("/");
    const title = `[auto] [${report.platform}] ${report.errorCode}: ${report.message.slice(0, 80)}`;
    const body = this.buildIssueBody(report, fingerprint);
    const labels = ["bug", "auto-reported", report.platform];

    const res = await this.githubApi(`/repos/${owner}/${repo}/issues`, {
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

  async report(
    report: ErrorReport,
  ): Promise<{ ok: boolean; issueNumber?: number; issueUrl?: string }> {
    if (!this.checkRateLimit()) {
      log.warn("rate limit exceeded, dropping error report");
      return { ok: false };
    }

    const fingerprint = generateFingerprint(
      report.platform,
      report.errorCode,
      report.stackTrace,
    );

    try {
      const existingNumber = await this.findExistingIssue(fingerprint);
      if (existingNumber !== null) {
        await this.addComment(existingNumber, report);
        log.info({ issueNumber: existingNumber }, "added recurrence comment to existing issue");
        return { ok: true, issueNumber: existingNumber };
      }

      const created = await this.createNewIssue(report, fingerprint);
      if (created) {
        log.info({ issueNumber: created.number, url: created.url }, "created new issue");
        return { ok: true, issueNumber: created.number, issueUrl: created.url };
      }
      return { ok: false };
    } catch (err) {
      log.error({ err }, "failed to report error to GitHub");
      return { ok: false };
    }
  }
}
