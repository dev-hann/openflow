#!/usr/bin/env node

import { resolve } from "node:path";

import { createLogger } from "./utils/logger.js";
import { OpenFlowError } from "./utils/errors.js";
import { loadConfig, initConfig } from "./config/loader.js";
import { runServer } from "./cli/runners.js";

const log = createLogger("cli");

const HELP_TEXT = `
OpenFlow — Lightweight Personal AI Assistant

Usage:
  openflow [options]

Options:
  --config <path>   Path to config file
  --verbose         Enable debug logging
  --version         Show version
  --help            Show this help

Configuration:
  Config file: ~/.openflow/openflow.json
`.trim();

const VERSION = "0.1.0";

function findArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

async function main(): Promise<void> {
  const argv = process.argv;

  if (hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    process.stdout.write(HELP_TEXT + "\n");
    return;
  }

  if (hasFlag(argv, "--version") || hasFlag(argv, "-v")) {
    process.stdout.write(`OpenFlow v${VERSION}\n`);
    return;
  }

  if (hasFlag(argv, "--verbose")) {
    process.env.OPENFLOW_LOG_LEVEL = "debug";
  }

  const configPathCli = findArg(argv, "--config");
  if (configPathCli) {
    process.env.OPENFLOW_CONFIG = resolve(configPathCli);
  }

  let config;
  try {
    config = loadConfig();
  } catch (err: unknown) {
    if (err instanceof OpenFlowError && err.code === "CONFIG_NOT_FOUND") {
      initConfig();
      config = loadConfig();
    } else {
      throw err;
    }
  }

  await runServer(config);
}

main().catch((err) => {
  if (err instanceof OpenFlowError) {
    log.error({ code: err.code }, err.message);
  } else {
    log.fatal({ err }, "unhandled error");
  }
  process.exit(1);
});
