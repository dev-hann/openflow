import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
};

export function createStaticHandler(webRoot: string) {
  const resolvedRoot = normalize(webRoot);

  async function serveStatic(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    let path = url.pathname;

    if (!path.startsWith("/api") && !path.startsWith("/ws")) {
      const filePath = join(resolvedRoot, path === "/" ? "index.html" : path);

      if (!filePath.startsWith(resolvedRoot + sep) && filePath !== resolvedRoot) {
        return false;
      }

      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
          const indexPath = join(resolvedRoot, "index.html");
          const content = await readFile(indexPath);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(content);
          return true;
        }

        const content = await readFile(filePath);
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
        return true;
      } catch {
        const indexPath = join(resolvedRoot, "index.html");
        try {
          const content = await readFile(indexPath);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(content);
          return true;
        } catch {
          return false;
        }
      }
    }

    return false;
  }

  return serveStatic;
}
