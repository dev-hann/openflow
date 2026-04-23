import { createLogger } from "../../utils/logger.js";

const log = createLogger("ws/provider-connectivity");

export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
): Promise<Response> {
  const base = baseUrl.replace(/\/$/, "");
  return fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function verifyProviderConnectivity(
  baseUrl: string,
  apiKey: string,
): Promise<boolean> {
  try {
    const resp = await fetchProviderModels(baseUrl, apiKey);
    if (!resp.ok) {
      log.debug(
        { baseUrl, status: resp.status },
        "provider connectivity check returned non-OK status",
      );
      return false;
    }
    return true;
  } catch (err: unknown) {
    log.debug({ baseUrl, err }, "provider connectivity check failed");
    return false;
  }
}
