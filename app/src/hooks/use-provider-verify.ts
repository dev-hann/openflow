import { useState, useEffect } from "react";
import { normalizeUrl } from "../utils/normalize-url";

export interface VerifyResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

interface VerifyOutcome {
  models: string[];
}

export function useProviderVerify(baseUrl: string, apiKey: string) {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    setVerifyResult(null);
  }, [baseUrl]);

  async function handleVerify(): Promise<VerifyOutcome | null> {
    const trimmedUrl = normalizeUrl(baseUrl);
    if (!trimmedUrl) return null;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(`${trimmedUrl}/models`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = (await resp.json()) as { data?: Array<{ id: string }> };
        const models = data.data?.map((m) => m.id) ?? [];
        setVerifyResult({ ok: true, models });
        return { models };
      } else {
        setVerifyResult({ ok: false, error: `HTTP ${resp.status}` });
        return null;
      }
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "AbortError"
          ? "시간 초과 (10초)"
          : err instanceof Error
            ? err.message
            : "연결 실패";
      setVerifyResult({ ok: false, error: msg });
      return null;
    } finally {
      setVerifying(false);
    }
  }

  return { verifying, verifyResult, handleVerify };
}
