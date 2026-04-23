import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "assets", "logo.svg");

if (!existsSync(svgPath)) {
  console.error("Missing:", svgPath);
  process.exit(1);
}

const outputs = [
  { path: join(root, "web", "public", "favicon.svg"), type: "svg" },
  { path: join(root, "web", "public", "apple-touch-icon.png"), w: 180, h: 180, bg: "#863bff", pad: true },
  { path: join(root, "app", "assets", "icon.png"), w: 1024, h: 1024 },
  { path: join(root, "app", "assets", "splash-icon.png"), w: 1024, h: 1024, bg: "#ffffff", pad: true },
  { path: join(root, "app", "assets", "adaptive-icon.png"), w: 1024, h: 1024 },
  { path: join(root, "app", "android", "app", "src", "main", "res", "mipmap-mdpi", "ic_launcher.png"), w: 48, h: 48, bg: "#863bff", pad: true },
  { path: join(root, "app", "android", "app", "src", "main", "res", "mipmap-hdpi", "ic_launcher.png"), w: 72, h: 72, bg: "#863bff", pad: true },
  { path: join(root, "app", "android", "app", "src", "main", "res", "mipmap-xhdpi", "ic_launcher.png"), w: 96, h: 96, bg: "#863bff", pad: true },
  { path: join(root, "app", "android", "app", "src", "main", "res", "mipmap-xxhdpi", "ic_launcher.png"), w: 144, h: 144, bg: "#863bff", pad: true },
  { path: join(root, "app", "android", "app", "src", "main", "res", "mipmap-xxxhdpi", "ic_launcher.png"), w: 192, h: 192, bg: "#863bff", pad: true },
];

for (const out of outputs) {
  mkdirSync(dirname(out.path), { recursive: true });
  if (out.type === "svg") {
    const { readFileSync, copyFileSync } = await import("node:fs");
    copyFileSync(svgPath, out.path);
    console.log("COPIED:", out.path);
    continue;
  }

  const pipeline = sharp(svgPath).resize(out.w, out.h, { fit: "contain", background: out.bg || { r: 0, g: 0, b: 0, alpha: 0 } });
  
  if (out.bg && out.bg !== "#ffffff") {
    await pipeline
      .flatten({ background: out.bg })
      .png()
      .toFile(out.path);
  } else if (out.bg === "#ffffff") {
    await pipeline
      .flatten({ background: "#ffffff" })
      .png()
      .toFile(out.path);
  } else {
    await pipeline.png().toFile(out.path);
  }
  console.log("GENERATED:", out.path, `${out.w}x${out.h}`);
}

console.log("\nDone!");
