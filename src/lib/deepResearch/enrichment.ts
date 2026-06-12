import { createHash } from "crypto";
import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv } from "@/lib/env";
import type { InputType } from "@/lib/detect";
import type { DeepEnrichment } from "./types";

async function lookupTxt(domain: string, kind: DeepEnrichment["kind"], label: string) {
  const res = await fetchJson(
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`,
    undefined,
    10_000
  );
  const answers = (res.data as { Answer?: Array<{ data?: string }> })?.Answer ?? [];
  const records = answers.map((a) => String(a.data ?? "").replace(/^"|"$/g, ""));

  return {
    kind,
    target: domain,
    label,
    data: {
      records,
      spf: records.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? null,
      dmarc: records.some((r) => r.toLowerCase().includes("v=dmarc1")),
    },
  } satisfies DeepEnrichment;
}

async function lookupNs(domain: string) {
  const res = await fetchJson(
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=NS`,
    undefined,
    10_000
  );
  const answers = (res.data as { Answer?: Array<{ data?: string }> })?.Answer ?? [];
  const nameservers = answers
    .map((a) => String(a.data ?? "").replace(/\.$/, ""))
    .filter(Boolean);

  return {
    kind: "dns_ns" as const,
    target: domain,
    label: "Nameservers",
    data: { nameservers },
  } satisfies DeepEnrichment;
}

async function lookupReverseDns(ip: string) {
  const octets = ip.split(".").reverse().join(".");
  const res = await fetchJson(
    `https://dns.google/resolve?name=${encodeURIComponent(`${octets}.in-addr.arpa`)}&type=PTR`,
    undefined,
    10_000
  );
  const answers = (res.data as { Answer?: Array<{ data?: string }> })?.Answer ?? [];
  const ptr = answers.map((a) => String(a.data ?? "").replace(/\.$/, "")).filter(Boolean);

  return {
    kind: "reverse_dns" as const,
    target: ip,
    label: "Reverse DNS (PTR)",
    data: { hostnames: ptr },
  } satisfies DeepEnrichment;
}

async function lookupGravatar(email: string) {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  const res = await fetch(
    `https://www.gravatar.com/${hash}.json`,
    { headers: { "User-Agent": "BadgerOS-Personal" } }
  );

  if (res.status === 404) {
    return {
      kind: "gravatar" as const,
      target: email,
      label: "Gravatar profile",
      data: { found: false },
    } satisfies DeepEnrichment;
  }

  const json = (await res.json()) as {
    entry?: Array<{ displayName?: string; profileUrl?: string; urls?: Array<{ value?: string }> }>;
  };
  const entry = json.entry?.[0];

  return {
    kind: "gravatar" as const,
    target: email,
    label: "Gravatar profile",
    data: {
      found: Boolean(entry),
      displayName: entry?.displayName ?? null,
      profileUrl: entry?.profileUrl ?? null,
      linkedUrls: (entry?.urls ?? []).map((u) => u.value).filter(Boolean).slice(0, 5),
    },
  } satisfies DeepEnrichment;
}

async function lookupHunterEmail(email: string) {
  if (!hasEnv("HUNTER_KEY")) {
    return {
      kind: "hunter_email" as const,
      target: email,
      label: "Hunter email verifier",
      data: { skipped: true, reason: "Set HUNTER_KEY (hunter.io)" },
    } satisfies DeepEnrichment;
  }

  const res = await fetchJson(
    `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${process.env.HUNTER_KEY!}`,
    undefined,
    12_000
  );
  const payload = res.data as {
    data?: { status?: string; result?: string; score?: number; regexp?: boolean; gibberish?: boolean };
    errors?: Array<{ details?: string }>;
  };

  return {
    kind: "hunter_email" as const,
    target: email,
    label: "Hunter email verifier",
    data: {
      status: payload.data?.status ?? null,
      result: payload.data?.result ?? null,
      score: payload.data?.score ?? null,
      regexp: payload.data?.regexp ?? null,
      gibberish: payload.data?.gibberish ?? null,
      error: payload.errors?.[0]?.details ?? null,
    },
  } satisfies DeepEnrichment;
}

export async function runPrimaryEnrichments(
  type: InputType,
  query: string
): Promise<DeepEnrichment[]> {
  const tasks: Promise<DeepEnrichment>[] = [];

  if (type === "email") {
    tasks.push(lookupGravatar(query));
    tasks.push(lookupHunterEmail(query));
    const domain = query.split("@")[1];
    if (domain) {
      tasks.push(lookupTxt(domain, "dns_txt", "Email domain TXT (SPF/DMARC)"));
    }
  }

  if (type === "domain") {
    tasks.push(lookupTxt(query, "dns_txt", "TXT records (SPF/DMARC)"));
    tasks.push(lookupNs(query));
  }

  if (type === "ip") {
    tasks.push(lookupReverseDns(query));
  }

  const settled = await Promise.allSettled(tasks);
  return settled
    .filter((r): r is PromiseFulfilledResult<DeepEnrichment> => r.status === "fulfilled")
    .map((r) => r.value);
}
