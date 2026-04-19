#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { confirm, log as clackLog } from "@clack/prompts";

import { createLogger } from "./utils/logger.js";
import { OpenFlowError } from "./utils/errors.js";
import { loadConfig, getConfigPath } from "./config/loader.js";
import { guardCancel, runSetupWizard, BANNER } from "./cli/setup-wizard.js";
import { runServer, runCliChat, showConfig } from "./cli/runners.js";

const log = createLogger("cli");

const HELP_TEXT = `
OpenFlow — Lightweight Personal AI Assistant

Usage:
  openflow [command] [options]

Commands:
  (none)       Start server (same as "start")
  start        Start WebSocket + HTTP server
  chat         Chat in CLI mode
  config       Create or open configuration file
  config show  Show current configuration
  session      Manage sessions
    session list     List all sessions
    session reset <id> Reset a session
  --version    Show version
  --help       Show this help

Options:
  --config <path>   Path to config file
  --verbose         Enable debug logging

Configuration:
  Config file: ~/.openflow/openflow.json
  Run "openflow config" to create one.
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

function getCommand(argv: string[]): string {
  const args = argv.slice(2).filter((a) => !a.startsWith("-") && a !== "--config");
  return args[0] ?? "";
}

function getSubCommand(argv: string[]): string {
  const args = argv.slice(2).filter((a) => !a.startsWith("-") && a !== "--config");
  return args[1] ?? "";
}

function writeStdout(text: string): void {
  process.stdout.write(text + "\n");
}

function writeStderr(text: string): void {
  process.stderr.write(text + "\n");
}

async function main(): Promise<void> {
  const argv = process.argv;

  if (hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    writeStdout(HELP_TEXT);
    return;
  }

  if (hasFlag(argv, "--version") || hasFlag(argv, "-v")) {
    writeStdout(`OpenFlow v${VERSION}`);
    return;
  }

  if (hasFlag(argv, "--verbose")) {
    process.env.OPENFLOW_LOG_LEVEL = "debug";
  }

  const configPathCli = findArg(argv, "--config");
  if (configPathCli) {
    process.env.OPENFLOW_CONFIG = resolve(configPathCli);
  }

  const command = getCommand(argv);
  const subCommand = getSubCommand(argv);

  if (command === "config") {
    if (subCommand === "show") {
      try {
        const config = loadConfig();
        showConfig(config);
      } catch (err) {
        writeStderr(err instanceof OpenFlowError ? err.message : String(err));
        process.exit(1);
      }
      return;
    }

    const path = getConfigPath();
    if (!existsSync(path)) {
      await runSetupWizard();
      return;
    }
    writeStdout(`Configuration file: ${path}`);
    const { execFileSync } = await import("node:child_process");
    const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
    execFileSync(editor, [path], { stdio: "inherit" });
    return;
  }

  if (command === "session") {
    try {
      const config = loadConfig();
      const { createMemoryStore } = await import("./memory/store.js");
      const memory = createMemoryStore(config.memory.dbPath);

      if (subCommand === "list") {
        const sessions = memory.listSessions();
        if (sessions.length === 0) {
          writeStdout("No sessions found.");
        } else {
          for (const s of sessions) {
            writeStdout(`  ${s.id}  ${s.title}  ${new Date(s.updatedAt).toISOString()}`);
          }
        }
      } else if (subCommand === "reset" && process.argv[process.argv.indexOf("reset") + 1]) {
        const sessionId = process.argv[process.argv.indexOf("reset") + 1]!;
        memory.deleteSession(sessionId);
        writeStdout(`Session ${sessionId} deleted.`);
      } else {
        writeStdout("Usage: openflow session list | openflow session reset <id>");
      }

      memory.close();
    } catch (err) {
      writeStderr(err instanceof OpenFlowError ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof OpenFlowError && err.code === "CONFIG_NOT_FOUND") {
      writeStdout(BANNER);
      clackLog.warn("No configuration file found.");
      const shouldSetup = guardCancel(
        await confirm({
          message: "Run setup wizard now?",
          initialValue: true,
        }),
      ) as boolean;
      if (shouldSetup) {
        config = await runSetupWizard();
      } else {
        clackLog.info('Run "openflow config" to set up later.');
        process.exit(0);
      }
    } else {
      throw err;
    }
  }

  if (command === "chat") {
    await runCliChat(config);
    return;
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
