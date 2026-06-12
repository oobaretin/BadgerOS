import type { ReconResponse } from "@/lib/detect";
import type {
  DeepEnrichment,
  DeepFinding,
  DeepResearchSummary,
  PivotEntity,
} from "./types";

function countOpenPorts(primary: ReconResponse): number {
  for (const r of primary.results) {
    if (r.source !== "/api/ip" || r.status !== "fulfilled") continue;
    const ports = (r.data.quickScan as { ports?: number[] })?.ports ?? [];
    return ports.length;
  }
  return 0;
}

function countBreaches(primary: ReconResponse): number {
  for (const r of primary.results) {
    if (r.source !== "/api/breach" || r.status !== "fulfilled") continue;
    const hibp = r.data.hibp;
    if (Array.isArray(hibp)) return hibp.length;
    const breaches = (hibp as { breaches?: unknown[] })?.breaches;
    return Array.isArray(breaches) ? breaches.length : 0;
  }
  return 0;
}

function countVerifiedProfiles(primary: ReconResponse): number {
  for (const r of primary.results) {
    if (r.source !== "/api/username" || r.status !== "fulfilled") continue;
    const verified = (r.data.verified as Array<{ found?: boolean }>) ?? [];
    return verified.filter((v) => v.found).length;
  }
  return 0;
}

export function buildDeepSummary(
  primary: ReconResponse,
  pivots: PivotEntity[],
  enrichments: DeepEnrichment[],
  findings: DeepFinding[]
): DeepResearchSummary {
  const insights: string[] = [];
  const suggestedNextSteps: string[] = [];
  const relatedEntities = pivots.map((p) => ({
    type: p.type,
    value: p.value,
    reason: p.reason,
  }));

  const gravatar = enrichments.find((e) => e.kind === "gravatar");
  if (gravatar?.data.found) {
    insights.push("Gravatar profile linked to this email — possible identity correlation.");
  }

  const txt = enrichments.find((e) => e.kind === "dns_txt");
  if (txt?.data.spf) {
    insights.push("SPF record present — mail sending policy configured.");
  } else if (primary.type === "domain" || primary.type === "email") {
    suggestedNextSteps.push("Review missing SPF/DMARC for phishing resistance.");
  }

  const ptr = enrichments.find((e) => e.kind === "reverse_dns");
  const ptrHosts = (ptr?.data.hostnames as string[] | undefined) ?? [];
  if (ptrHosts.length) {
    insights.push(`Reverse DNS: ${ptrHosts.join(", ")}`);
  }

  const hunterEmail = enrichments.find((e) => e.kind === "hunter_email");
  if (hunterEmail?.data.result) {
    insights.push(`Hunter email verification: ${String(hunterEmail.data.result)}.`);
  }

  for (const r of primary.results) {
    if (r.status !== "fulfilled" || r.source !== "/api/threat") continue;
    const urlhaus = r.data.urlhaus as { url_count?: string | number; urls?: unknown[] } | undefined;
    const count = Number(urlhaus?.url_count ?? urlhaus?.urls?.length ?? 0);
    if (count > 0) {
      insights.push(`${count} malicious URL(s) listed on URLhaus for this host.`);
    }
  }

  for (const r of primary.results) {
    if (r.status !== "fulfilled" || r.source !== "/api/whois") continue;
    const hunter = r.data.hunter as { data?: { emails?: unknown[] } } | undefined;
    const emailCount = hunter?.data?.emails?.length ?? 0;
    if (emailCount > 0) {
      insights.push(`${emailCount} public email(s) discovered via Hunter.io.`);
    }
  }

  const breaches = countBreaches(primary);
  if (breaches > 0) {
    insights.push(`${breaches} known breach exposure(s) on primary target.`);
    suggestedNextSteps.push("Review breach data classes and rotate affected credentials.");
  }

  const ports = countOpenPorts(primary);
  if (ports > 0) {
    insights.push(`${ports} open port(s) observed via passive scan.`);
  }

  const profiles = countVerifiedProfiles(primary);
  if (profiles > 0) {
    insights.push(`${profiles} verified social/developer profile(s) confirmed.`);
  }

  const pivotHits = findings.filter(
    (f) => f.status === "fulfilled" && !f.data.skipped
  ).length;
  if (pivotHits > 0) {
    insights.push(`${pivotHits} secondary lookup(s) returned data from related entities.`);
  }

  if (pivots.length > 0) {
    suggestedNextSteps.push(
      `Investigate related entities: ${pivots.slice(0, 3).map((p) => p.value).join(", ")}${pivots.length > 3 ? "…" : ""}.`
    );
  }

  if (primary.type === "domain" && pivots.some((p) => p.value.includes("."))) {
    suggestedNextSteps.push("Enumerate high-value subdomains from certificate transparency.");
  }

  if (suggestedNextSteps.length === 0) {
    suggestedNextSteps.push("Add API keys in Settings for HIBP, VirusTotal, and Shodan Host depth.");
  }

  const headline =
    insights.length > 0
      ? insights[0]
      : `Deep research completed — ${pivots.length} related entit${pivots.length === 1 ? "y" : "ies"} identified.`;

  return {
    headline,
    insights,
    relatedEntities,
    suggestedNextSteps,
  };
}
