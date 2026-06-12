import { detectInputType, sanitizeInput, type InputType, type ReconResponse } from "@/lib/detect";
import type { PivotEntity } from "./types";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "mail.com",
  "yandex.com",
  "gmx.com",
  "zoho.com",
  "fastmail.com",
]);

function addPivot(
  pivots: PivotEntity[],
  seen: Set<string>,
  type: InputType,
  value: string,
  reason: string,
  parentQuery: string
) {
  const normalized =
    type === "username" ? value : sanitizeInput(value).toLowerCase();
  if (!normalized || detectInputType(normalized) !== type) return;
  const key = `${type}:${normalized}`;
  if (seen.has(key)) return;
  seen.add(key);
  pivots.push({ type, value: normalized, reason, parentQuery });
}

function extractSubdomainsFromCerts(
  certs: unknown,
  rootDomain: string
): string[] {
  if (!Array.isArray(certs)) return [];
  const root = rootDomain.toLowerCase();
  const found = new Set<string>();

  for (const entry of certs) {
    const names = String((entry as { name_value?: string }).name_value ?? "")
      .split("\n")
      .map((n) => sanitizeInput(n.replace(/^\*\./, "")).toLowerCase())
      .filter(Boolean);

    for (const name of names) {
      if (name === root || name.endsWith(`.${root}`)) {
        found.add(name);
      }
    }
  }

  return [...found].sort((a, b) => a.length - b.length).slice(0, 5);
}

function extractMxHosts(mx: unknown): string[] {
  const answers = (mx as { Answer?: Array<{ data?: string }> })?.Answer ?? [];
  return answers
    .map((a) => {
      const parts = String(a.data ?? "").trim().split(/\s+/);
      const host = parts[parts.length - 1];
      return host ? sanitizeInput(host.replace(/\.$/, "")).toLowerCase() : "";
    })
    .filter(Boolean);
}

function extractHostnamesFromIp(data: Record<string, unknown>): string[] {
  const quickScan = data.quickScan as { hostnames?: string[] } | undefined;
  const shodan = data.shodan as { hostnames?: string[] } | undefined;
  return [...(quickScan?.hostnames ?? []), ...(shodan?.hostnames ?? [])]
    .map((h) => sanitizeInput(h).toLowerCase())
    .filter((h) => detectInputType(h) === "domain");
}

export function extractPivots(
  primary: ReconResponse,
  maxPivots = 6
): PivotEntity[] {
  const pivots: PivotEntity[] = [];
  const seen = new Set<string>();
  const { type, query, results } = primary;

  if (type === "email") {
    const domain = query.split("@")[1]?.toLowerCase();
    if (domain && !FREE_EMAIL_DOMAINS.has(domain)) {
      addPivot(pivots, seen, "domain", domain, "Email domain pivot", query);
    }
  }

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const data = result.data;

    if (result.source === "/api/whois") {
      const root = type === "domain" ? query : sanitizeInput(query).toLowerCase();

      for (const sub of extractSubdomainsFromCerts(data.certificates, root)) {
        addPivot(
          pivots,
          seen,
          "domain",
          sub,
          `Certificate SAN (${root})`,
          query
        );
      }

      for (const mxHost of extractMxHosts(data.mx)) {
        addPivot(pivots, seen, "domain", mxHost, "MX record host", query);
      }

      const hunterEmails =
        (data.hunter as { data?: { emails?: Array<{ value?: string }> } } | undefined)?.data
          ?.emails ?? [];
      for (const entry of hunterEmails.slice(0, 3)) {
        const email = entry.value?.trim().toLowerCase();
        if (email && detectInputType(email) === "email") {
          addPivot(pivots, seen, "email", email, "Hunter.io domain email", query);
        }
      }

      const relatedDomains =
        (data.domainsdb as { domains?: Array<{ domain?: string }> } | undefined)?.domains ?? [];
      for (const entry of relatedDomains.slice(0, 3)) {
        const domain = entry.domain?.trim().toLowerCase();
        if (domain && domain !== root && detectInputType(domain) === "domain") {
          addPivot(pivots, seen, "domain", domain, "DomainsDB related domain", query);
        }
      }

      const answers = (data.dns as { Answer?: Array<{ data?: string }> })?.Answer ?? [];
      for (const a of answers.slice(0, 2)) {
        const ip = a.data?.trim();
        if (ip && detectInputType(ip) === "ip") {
          addPivot(pivots, seen, "ip", ip, `DNS A record (${root})`, query);
        }
      }
    }

    if (result.source === "/api/ip") {
      const target = String(data.target ?? query);
      for (const host of extractHostnamesFromIp(data)) {
        addPivot(
          pivots,
          seen,
          "domain",
          host,
          `Reverse hostname for ${target}`,
          query
        );
      }

      const ipinfoHost = (data.ipinfo as { hostname?: string } | undefined)?.hostname;
      if (ipinfoHost && detectInputType(ipinfoHost) === "domain") {
        addPivot(pivots, seen, "domain", ipinfoHost, `IPinfo hostname for ${target}`, query);
      }

      if (type === "ip" && target !== query) {
        addPivot(pivots, seen, "ip", target, "Resolved IP target", query);
      }
    }

    if (result.source === "/api/username") {
      const verified = (data.verified as Array<{ platform?: string; url?: string }>) ?? [];
      for (const profile of verified.slice(0, 2)) {
        const url = profile.url ?? "";
        try {
          const hostname = sanitizeInput(new URL(url).hostname);
          if (detectInputType(hostname) === "domain") {
            addPivot(
              pivots,
              seen,
              "domain",
              hostname,
              `${profile.platform ?? "Profile"} platform domain`,
              query
            );
          }
        } catch {
          // ignore invalid profile URLs
        }
      }
    }
  }

  const root = sanitizeInput(query).toLowerCase();
  return pivots.filter((p) => p.value !== root).slice(0, maxPivots);
}
