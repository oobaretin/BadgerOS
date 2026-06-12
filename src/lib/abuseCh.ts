import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";

function abuseChHeaders(): Record<string, string> {
  return { "Auth-Key": process.env.ABUSECH_AUTH_KEY! };
}

export async function queryUrlhausHost(host: string) {
  if (!hasEnv("ABUSECH_AUTH_KEY")) {
    return skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)");
  }

  const res = await fetchJson(
    `https://urlhaus-api.abuse.ch/v1/host/${encodeURIComponent(host)}/`,
    { headers: abuseChHeaders() },
    15_000
  );
  return res.data;
}

async function queryUrlhausUrl(urlId: string) {
  const res = await fetchJson(
    `https://urlhaus-api.abuse.ch/v1/url/${encodeURIComponent(urlId)}/`,
    { headers: abuseChHeaders() },
    12_000
  );
  return res.data;
}

export async function queryMalwareBazaarHash(sha256: string) {
  if (!hasEnv("ABUSECH_AUTH_KEY")) {
    return skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)");
  }

  const body = new URLSearchParams({ query: "get_info", hash: sha256 });
  const res = await fetchJson(
    "https://mb-api.abuse.ch/api/v1/",
    {
      method: "POST",
      headers: {
        ...abuseChHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
    15_000
  );
  return res.data;
}

export async function enrichMalwareBazaarFromUrlhaus(urlhausData: unknown) {
  if (!hasEnv("ABUSECH_AUTH_KEY")) {
    return skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)");
  }

  const urls = (urlhausData as { urls?: Array<{ id?: string }> })?.urls ?? [];
  if (!urls.length) {
    return skippedSource("No URLhaus URLs — MalwareBazaar correlates via payload hashes");
  }

  const firstId = urls[0]?.id;
  if (!firstId) {
    return skippedSource("No URLhaus URL id for MalwareBazaar lookup");
  }

  const urlDetail = await queryUrlhausUrl(String(firstId));
  const payloads =
    (urlDetail as { payloads?: Array<{ sha256_hash?: string }> })?.payloads ?? [];
  const hash = payloads.find((p) => p.sha256_hash)?.sha256_hash;
  if (!hash) {
    return skippedSource("No SHA256 in URLhaus payload metadata");
  }

  return queryMalwareBazaarHash(hash);
}
