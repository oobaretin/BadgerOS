const DEFAULT_TIMEOUT_MS = 12_000;

export interface FetchJsonResult {
  ok: boolean;
  status: number;
  data: unknown;
}

export async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();

    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: { error: text.slice(0, 200) || "Invalid JSON response" },
      };
    }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Request timed out"
        : String(err);
    return { ok: false, status: 0, data: { error: message } };
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveDomainToIp(domain: string): Promise<string | null> {
  const res = await fetchJson(
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
    undefined,
    8_000
  );
  const answers = (res.data as { Answer?: Array<{ type?: number; data?: string }> })?.Answer;
  const aRecord = answers?.find((a) => a.type === 1);
  return aRecord?.data ?? null;
}
