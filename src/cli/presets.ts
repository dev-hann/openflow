export const LLM_PRESETS = [
  {
    id: "zai-coding-global",
    label: "ZAI Coding Plan (Global)",
    hint: "api.z.ai · GLM-5.1 recommended",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    model: "glm-5.1",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "zai-coding-cn",
    label: "ZAI Coding Plan (China)",
    hint: "open.bigmodel.cn · GLM-5.1 recommended",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    model: "glm-5.1",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "zai-global",
    label: "ZAI General (Global)",
    hint: "api.z.ai · Standard API endpoint",
    baseUrl: "https://api.z.ai/api/paas/v4",
    model: "glm-4.7-flash",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "zai-cn",
    label: "ZAI General (China)",
    hint: "open.bigmodel.cn · Standard API endpoint",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7-flash",
    needsApiKey: true,
    envKeyNames: ["ZAI_API_KEY", "Z_AI_API_KEY"],
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "GPT-4o · api.openai.com",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    needsApiKey: true,
    envKeyNames: ["OPENAI_API_KEY"],
  },
  {
    id: "anthropic",
    label: "Anthropic (via OpenAI compat)",
    hint: "api.anthropic.com · Claude models",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
    needsApiKey: true,
    envKeyNames: ["ANTHROPIC_API_KEY"],
  },
  {
    id: "google",
    label: "Google Gemini (via OpenAI compat)",
    hint: "generativelanguage.googleapis.com",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    needsApiKey: true,
    envKeyNames: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    hint: "deepseek-chat / deepseek-reasoner",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    needsApiKey: true,
    envKeyNames: ["DEEPSEEK_API_KEY"],
  },
  {
    id: "groq",
    label: "Groq",
    hint: "Ultra-fast inference · groq.com",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    needsApiKey: true,
    envKeyNames: ["GROQ_API_KEY"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "Multi-provider gateway · openrouter.ai",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o",
    needsApiKey: true,
    envKeyNames: ["OPENROUTER_API_KEY"],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    hint: "No API key needed · localhost:11434",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3",
    needsApiKey: false,
    envKeyNames: [],
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible endpoint",
    hint: "Enter URL and model manually",
    baseUrl: "",
    model: "",
    needsApiKey: true,
    envKeyNames: [],
  },
] as const;

export type LlmPreset = (typeof LLM_PRESETS)[number];

export function formatKeyPreview(key: string): string {
  if (key.length <= 12) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function normalizeApiKeyInput(raw: string): string {
  let value = raw.trim();
  if (value.startsWith("export ")) {
    value = value.slice("export ".length);
  }
  const eqIdx = value.indexOf("=");
  if (eqIdx > 0 && !value.startsWith("http")) {
    value = value.slice(eqIdx + 1);
  }
  value = value.replace(/^['"]|['"]$/g, "").replace(/;$/, "").trim();
  return value;
}

export function resolveEnvKey(preset: LlmPreset): string | undefined {
  for (const name of preset.envKeyNames) {
    const val = process.env[name];
    if (val?.trim()) return val.trim();
  }
  return undefined;
}

export async function detectZaiEndpoint(
  apiKey: string,
): Promise<{ baseUrl: string; model: string; note: string } | null> {
  const candidates = [
    { baseUrl: "https://api.z.ai/api/coding/paas/v4", model: "glm-5.1", label: "ZAI Coding Global" },
    { baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-5.1", label: "ZAI Coding CN" },
    { baseUrl: "https://api.z.ai/api/paas/v4", model: "glm-5.1", label: "ZAI Global" },
    { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.1", label: "ZAI CN" },
    { baseUrl: "https://api.z.ai/api/coding/paas/v4", model: "glm-4.7", label: "ZAI Coding Global (glm-4.7 fallback)" },
    { baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4", model: "glm-4.7", label: "ZAI Coding CN (glm-4.7 fallback)" },
  ];

  for (const c of candidates) {
    try {
      const resp = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: c.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          stream: false,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (resp.ok) {
        return { baseUrl: c.baseUrl, model: c.model, note: `Detected: ${c.label}` };
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function fetchModels(
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const resp = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return [];
    const body = (await resp.json()) as Record<string, unknown>;
    if (Array.isArray(body.data)) {
      return (body.data as Array<Record<string, unknown>>)
        .map((m) => (m.id as string) ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
    if (Array.isArray(body)) {
      return ((body as Array<Record<string, unknown>>)
        .map((m) => (m.id as string) ?? "")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)));
    }
    if (Array.isArray(body.models)) {
      return ((body.models as Array<Record<string, unknown>>)
        .map((m) => ((m.id as string) ?? (m as unknown as string)) ?? "")
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .sort((a, b) => a.localeCompare(b)));
    }
    return [];
  } catch {
    return [];
  }
}

export async function verifyLlmEndpoint(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 16,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (resp.ok) {
      return { ok: true };
    }
    const body = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, error: body.slice(0, 200) };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
