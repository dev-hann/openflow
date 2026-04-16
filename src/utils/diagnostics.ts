import { createLogger } from "../utils/logger.js";

const log = createLogger("diagnostics");

interface DiagnosticEntry {
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  error?: string;
}

const MAX_ENTRIES = 200;
const entries: DiagnosticEntry[] = [];

export function logRequest(entry: Omit<DiagnosticEntry, "timestamp">): void {
  const full: DiagnosticEntry = { ...entry, timestamp: Date.now() };
  entries.push(full);
  if (entries.length > MAX_ENTRIES) entries.shift();
  if (entry.error) {
    log.warn({ method: entry.method, url: entry.url, error: entry.error }, "request failed");
  } else {
    log.debug({ method: entry.method, url: entry.url, status: entry.status, durationMs: entry.durationMs }, "request completed");
  }
}

export function getDiagnostics(): DiagnosticEntry[] {
  return [...entries];
}

export function getDiagnosticsSummary(): { total: number; failed: number; avgDurationMs: number } {
  const total = entries.length;
  const failed = entries.filter((e) => e.error).length;
  const durations = entries.filter((e) => e.durationMs).map((e) => e.durationMs!);
  const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  return { total, failed, avgDurationMs };
}
