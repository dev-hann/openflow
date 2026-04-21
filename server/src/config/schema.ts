import { z } from "zod";

export const openFlowConfigSchema = z.object({
  llm: z
    .object({
      maxTokens: z.coerce.number().int().positive().default(4096),
      temperature: z.coerce.number().min(0).max(2).default(0.7),
    })
    .default({}),
  notification: z
    .object({
      enabled: z.boolean().default(true),
      onStart: z.string().default("🟢 OpenFlow가 시작되었습니다."),
      onStop: z.string().default("🔴 OpenFlow가 종료됩니다."),
    })
    .default({}),
  agent: z.object({
    systemPrompt: z.string().default(""),
    maxToolRounds: z.coerce.number().int().positive().default(10),
    workspace: z.string().default("~/.openflow/workspace"),
    dailyMemoryDays: z.coerce.number().int().min(1).max(14).default(2),
  }),
  memory: z.object({
    contextSize: z.coerce.number().int().positive().default(50),
    dbPath: z.string().default("~/.openflow/memory.db"),
  }),
  tools: z
    .object({
      shell: z
        .object({
          enabled: z.boolean().default(true),
          timeout: z.coerce.number().int().positive().default(30_000),
        })
        .default({}),
      webFetch: z.object({ enabled: z.boolean().default(true) }).default({}),
      webSearch: z.object({ enabled: z.boolean().default(true) }).default({}),
      httpRequest: z.object({ enabled: z.boolean().default(false) }).default({}),
      browser: z
        .object({
          enabled: z.boolean().default(false),
          timeout: z.coerce.number().int().positive().default(30_000),
          headless: z.boolean().default(true),
        })
        .default({}),
      requireConfirmation: z.array(z.string()).default([]),
      confirmationTimeout: z.coerce.number().int().positive().default(60_000),
    })
    .default({}),
  skills: z
    .object({
      enabled: z.boolean().default(true),
      extraDirs: z.array(z.string()).default([]),
      entries: z
        .record(
          z.object({
            enabled: z.boolean().default(true),
          }),
        )
        .default({}),
    })
    .default({}),
  websocket: z
    .object({
      enabled: z.boolean().default(true),
      host: z.string().default("0.0.0.0"),
      port: z.coerce.number().int().default(9800),
      cors: z.boolean().default(true),
    })
    .default({}),
  logging: z
    .object({
      level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    })
    .default({}),
});

export type OpenFlowConfig = z.infer<typeof openFlowConfigSchema>;
