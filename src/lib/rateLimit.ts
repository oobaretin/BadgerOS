const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (hits.length >= MAX_REQUESTS) {
    const oldest = hits[0] ?? now;
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - oldest) };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true };
}

export function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "local";
}
