export function normalizeUrl(url: string): string {
  let trimmed = url.trim().replace(/\s+/g, "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  trimmed = trimmed.replace(/([^:])\/\/+/g, "$1//");
  return trimmed;
}
