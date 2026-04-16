import { z } from "zod";

function resolveEnvVar(value: string): string {
  const envVarPattern = /^\$\{([^}]+)\}$/;
  const match = envVarPattern.exec(value);
  if (!match?.[1]) {
    return value;
  }
  const envValue = process.env[match[1]];
  if (!envValue) {
    throw new Error(`Environment variable "${match[1]}" is not set`);
  }
  return envValue;
}

const envString = z.string().transform(resolveEnvVar);

export const openFlowConfigSchema = z.object({
  llm: z.object({
    baseUrl: envString,
    apiKey: envString,
    model: envString,
    maxTokens: z.coerce.number().int().positive().default(4096),
    temperature: z.coerce.number().min(0).max(2).default(0.7),
    apiKeys: z.array(envString).optional(),
    fallbackModels: z.array(z.object({
      model: z.string(),
      baseUrl: envString.optional(),
      apiKey: envString.optional(),
    })).optional(),
  }),
  telegram: z.object({
    botToken: envString,
    allowedUsers: z.array(z.coerce.number()).default([]),
    streamingMode: z.enum(["partial", "block", "progress", "off"]).default("partial"),
    errorPolicy: z.enum(["always", "once", "silent"]).default("once"),
    groupEnabled: z.boolean().default(false),
    proxy: envString.optional(),
    webhook: z.object({
      enabled: z.boolean().default(false),
      url: envString.optional(),
      host: z.string().default("127.0.0.1"),
      port: z.coerce.number().int().default(8787),
      secret: envString.optional(),
    }).default({}),
  }),
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
    })
    .default({}),
  logging: z
    .object({
      level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    })
    .default({}),
});

export type OpenFlowConfig = z.infer<typeof openFlowConfigSchema>;
