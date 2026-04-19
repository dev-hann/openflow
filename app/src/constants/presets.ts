export interface ProviderPreset {
  id: string;
  label: string;
  hint: string;
  baseUrl: string;
  needsApiKey: boolean;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "zai-coding-global",
    label: "ZAI Coding Plan (Global)",
    hint: "api.z.ai · GLM-5.1",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    needsApiKey: true,
  },
  {
    id: "zai-coding-cn",
    label: "ZAI Coding Plan (China)",
    hint: "open.bigmodel.cn · GLM-5.1",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    needsApiKey: true,
  },
  {
    id: "zai-global",
    label: "ZAI General (Global)",
    hint: "api.z.ai · Standard API",
    baseUrl: "https://api.z.ai/api/paas/v4",
    needsApiKey: true,
  },
  {
    id: "zai-cn",
    label: "ZAI General (China)",
    hint: "open.bigmodel.cn · Standard API",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    needsApiKey: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "GPT-4o · api.openai.com",
    baseUrl: "https://api.openai.com/v1",
    needsApiKey: true,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "api.anthropic.com · Claude",
    baseUrl: "https://api.anthropic.com/v1",
    needsApiKey: true,
  },
  {
    id: "google",
    label: "Google Gemini",
    hint: "generativelanguage.googleapis.com",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    needsApiKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    hint: "deepseek-chat · api.deepseek.com",
    baseUrl: "https://api.deepseek.com/v1",
    needsApiKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    hint: "Ultra-fast · api.groq.com",
    baseUrl: "https://api.groq.com/openai/v1",
    needsApiKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "Multi-provider · openrouter.ai",
    baseUrl: "https://openrouter.ai/api/v1",
    needsApiKey: true,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    hint: "No API key · localhost:11434",
    baseUrl: "http://localhost:11434/v1",
    needsApiKey: false,
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Enter URL manually",
    baseUrl: "",
    needsApiKey: true,
  },
];
