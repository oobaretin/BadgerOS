import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";

function abuseChHeaders(contentType = "application/x-www-form-urlencoded"): Record<string, string> {
  return {
    "Auth-Key": process.env.ABUSECH_AUTH_KEY!,
    "Content-Type": contentType,
  };
}

async function abuseChPost(url: string, params: Record<string, string>, timeoutMs = 15_000) {
  const body = new URLSearchParams(params);
  const res = await fetchJson(
    url,
    {
      method: "POST",
      headers: abuseChHeaders(),
      body: body.toString(),
    },
    timeoutMs
  );

  if (!res.ok) {
    const message =
      typeof res.data === "object" &&
      res.data &&
      "error" in res.data &&
      typeof (res.data as { error?: unknown }).error === "string"
        ? String((res.data as { error: string }).error).slice(0, 200)
        : `URLhaus request failed (${res.status})`;
    return { query_status: "error", error: message };
  }

  return res.data;
}

export async function queryUrlhausHost(host: string) {
  if (!hasEnv("ABUSECH_AUTH_KEY")) {
    return skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)");
  }

  return abuseChPost("https://urlhaus-api.abuse.ch/v1/host/", { host });
}

async function queryUrlhausUrlId(urlId: string) {
  return abuseChPost("https://urlhaus-api.abuse.ch/v1/urlid/", { urlid: urlId }, 12_000);
}

export async function queryMalwareBazaarHash(sha256: string) {
  if (!hasEnv("ABUSECH_AUTH_KEY")) {
    return skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)");
  }

  return abuseChPost(
    "https://mb-api.abuse.ch/api/v1/",
    { query: "get_info", hash: sha256 },
    15_000
  );
}

export async function enrichMalwareBazaarFromUrlhaus(urlhausData: unknown) {
  if (!hasEnv("ABUSECH_AUTH_KEY")) {
    return skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)");
  }

  const urlhaus = urlhausData as {
    skipped?: boolean;
    query_status?: string;
    urls?: Array<{ id?: string }>;
  };

  if (urlhaus?.skipped) {
    return skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)");
  }

  if (urlhaus?.query_status === "no_results") {
    return skippedSource("Host not in URLhaus — no MalwareBazaar correlation");
  }

  if (urlhaus?.query_status && urlhaus.query_status !== "ok") {
    return skippedSource("URLhaus lookup did not return correlatable URLs");
  }

  const urls = urlhaus.urls ?? [];
  if (!urls.length) {
    return skippedSource("No URLhaus URLs — MalwareBazaar correlates via payload hashes");
  }

  const firstId = urls[0]?.id;
  if (!firstId) {
    return skippedSource("No URLhaus URL id for MalwareBazaar lookup");
  }

  const urlDetail = await queryUrlhausUrlId(String(firstId));
  const detail = urlDetail as {
    query_status?: string;
    payloads?: Array<{ response_sha256?: string; sha256_hash?: string }>;
  };

  if (detail.query_status && detail.query_status !== "ok") {
    return skippedSource("URLhaus URL detail unavailable for MalwareBazaar lookup");
  }

  const payloads = detail.payloads ?? [];
  const hash =
    payloads.find((p) => p.response_sha256)?.response_sha256 ??
    payloads.find((p) => p.sha256_hash)?.sha256_hash;

  if (!hash) {
    return skippedSource("No SHA256 in URLhaus payload metadata");
  }

  return queryMalwareBazaarHash(hash);
}
