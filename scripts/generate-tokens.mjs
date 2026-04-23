import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const tokens = JSON.parse(readFileSync(join(root, "design-tokens.json"), "utf-8"));

function generateCss() {
  const lines = ["/* Auto-generated from design-tokens.json — do not edit manually */", "@theme {"];
  const flatten = (obj, prefix) => {
    for (const [key, val] of Object.entries(obj)) {
      const name = prefix ? `${prefix}-${key}` : key;
      if (typeof val === "object" && val !== null) {
        flatten(val, name);
      } else {
        lines.push(`  --${name}: ${val};`);
      }
    }
  };
  flatten(tokens.color, "color");
  for (const [key, val] of Object.entries(tokens.font.family)) {
    lines.push(`  --font-family-${key}: ${val};`);
  }
  for (const [key, val] of Object.entries(tokens.font.size)) {
    lines.push(`  --font-size-${key}: ${val};`);
  }
  for (const [key, val] of Object.entries(tokens.font.weight)) {
    lines.push(`  --font-weight-${key}: ${val};`);
  }
  for (const [key, val] of Object.entries(tokens.space)) {
    lines.push(`  --spacing-${key}: ${val};`);
  }
  for (const [key, val] of Object.entries(tokens.radius)) {
    lines.push(`  --radius-${key}: ${val};`);
  }
  lines.push("}", "");
  return lines.join("\n");
}

function generateDart() {
  const sanitizeDartName = (name) => {
    let n = name;
    if (/^\d/.test(n)) n = `v${n}`;
    n = n.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    n = n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return n;
  };

  const hexToInt = (hex) => {
    const h = hex.replace("#", "").replace("0x", "");
    const argb = h.length === 6 ? `FF${h}` : h;
    return `0x${argb.toUpperCase()}`;
  };

  const lines = [
    "// Auto-generated from design-tokens.json — do not edit manually",
    "",
    "import 'package:flutter/material.dart';",
    "",
    "abstract class AppColors {",
  ];

  const flattenColors = (obj, prefix) => {
    for (const [key, val] of Object.entries(obj)) {
      const name = prefix ? `${prefix}_${key}` : key;
      if (typeof val === "object" && val !== null) {
        flattenColors(val, name);
      } else {
        if (val.startsWith("rgba(")) {
          const m = val.match(/rgba?\((\d+),(\d+),(\d+),?([\d.]+)?\)/);
          if (m) {
            const r = parseInt(m[1]).toString(16).padStart(2, "0");
            const g = parseInt(m[2]).toString(16).padStart(2, "0");
            const b = parseInt(m[3]).toString(16).padStart(2, "0");
            const a = m[4] ? Math.round(parseFloat(m[4]) * 255).toString(16).padStart(2, "0") : "FF";
            lines.push(`  static const Color ${sanitizeDartName(name.replace(/-/g, "_"))} = Color(${hexToInt(`#${a}${r}${g}${b}`)});`);
          }
        } else {
          lines.push(`  static const Color ${sanitizeDartName(name.replace(/-/g, "_"))} = Color(${hexToInt(val)});`);
        }
      }
    }
  };
  flattenColors(tokens.color, "");
  lines.push("}", "");

  lines.push("abstract class AppSpacing {");
  for (const [key, val] of Object.entries(tokens.space)) {
    const num = parseFloat(val);
    lines.push(`  static const double s${key} = ${num};`);
  }
  lines.push("}", "");

  lines.push("abstract class AppRadius {");
  for (const [key, val] of Object.entries(tokens.radius)) {
    const name = sanitizeDartName(key);
    if (val === "9999px") {
      lines.push(`  static const double ${name} = double.infinity;`);
    } else {
      const num = parseFloat(val);
      lines.push(`  static const double ${name} = ${num};`);
    }
  }
  lines.push("}", "");

  lines.push("abstract class AppFontSize {");
  for (const [key, val] of Object.entries(tokens.font.size)) {
    const name = sanitizeDartName(key);
    const num = parseFloat(val);
    lines.push(`  static const double ${name} = ${num};`);
  }
  lines.push("}", "");

  return lines.join("\n");
}

const cssOutput = join(root, "web", "src", "design-tokens.css");
const dartOutput = join(root, "app", "lib", "config", "tokens.dart");

writeFileSync(cssOutput, generateCss());
console.log("GENERATED:", cssOutput);

writeFileSync(dartOutput, generateDart());
console.log("GENERATED:", dartOutput);

console.log("\nDone!");
