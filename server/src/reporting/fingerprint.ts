import { createHash } from "node:crypto";

export function extractFirstFrame(stackTrace: string | undefined): string {
  if (!stackTrace) return "";
  const lines = stackTrace.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("at ")) return trimmed;
  }
  return "";
}

export function generateFingerprint(
  platform: string,
  errorCode: string,
  stackTrace?: string,
): string {
  const firstFrame = extractFirstFrame(stackTrace);
  const raw = `${platform}:${errorCode}:${firstFrame}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}
