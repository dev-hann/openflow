import { existsSync, mkdirSync } from "node:fs";

export function ensureDirSync(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
