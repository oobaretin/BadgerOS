import type { ReconSourceResult } from "./detect";
import { parseNhtsaDecode } from "./vehicleDetect";

export type SourceStatus = "found" | "clean" | "warning";

export const STATUS_META: Record<
  SourceStatus,
  { label: string; dot: string; badge: string }
> = {
  found: {
    label: "Found",
    dot: "bg-emerald-500",
    badge: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  },
  clean: {
    label: "Clean",
    dot: "bg-sky-500",
    badge: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  },
  warning: {
    label: "Warning",
    dot: "bg-amber-500",
    badge: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  },
};

function payload(data: Record<string, unknown>): Record<string, unknown> {
  if (data.data && typeof data.data === "object") {
    return data.data as Record<string, unknown>;
  }
  return data;
}

function breachStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  if (p.error) return "warning";

  const rep = p.reputation as Record<string, unknown> | null;
  const repDetails = rep?.details as Record<string, unknown> | undefined;
  const hibp = p.hibp as unknown[] | Record<string, unknown> | null;
  const hibpSkipped = (hibp as { skipped?: boolean })?.skipped;
  const hibpBreaches = Array.isArray(hibp)
    ? hibp
    : hibpSkipped
      ? []
      : ((hibp as { breaches?: unknown[] })?.breaches ?? []);
  const breachDir = p.breachDirectory as {
    result?: unknown[];
    error?: string;
    skipped?: boolean;
  } | null;

  const hasBreaches =
    hibpBreaches.length > 0 || (breachDir?.result?.length ?? 0) > 0;
  const suspicious =
    rep?.suspicious === true || repDetails?.data_breach === true;
  const disposable =
    (p.disify as { disposable?: boolean })?.disposable === true ||
    (p.kickbox as { disposable?: boolean })?.disposable === true;
  const hunter = p.hunter as {
    data?: { status?: string; result?: string; score?: number };
    skipped?: boolean;
  } | null;
  const hunterRisk =
    hunter?.data?.result === "undeliverable" ||
    hunter?.data?.status === "invalid" ||
    (typeof hunter?.data?.score === "number" && hunter.data.score < 30);

  if (hasBreaches || suspicious || disposable || hunterRisk) return "found";
  if (rep || hibp || breachDir || hunter?.data) return "clean";
  return "warning";
}

function ipStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  const geo = p.geo as { status?: string } | null;
  const abuse = p.abuse as { data?: { abuseConfidenceScore?: number } } | null;
  const shodan = p.shodan as { vulns?: Record<string, unknown> } | null;
  const quickScan = p.quickScan as { vulns?: unknown[]; ports?: unknown[] } | null;

  const score = abuse?.data?.abuseConfidenceScore ?? 0;
  const greynoise = p.greynoise as { noise?: boolean } | null;
  const hasVulns =
    (shodan?.vulns && Object.keys(shodan.vulns).length > 0) ||
    (quickScan?.vulns?.length ?? 0) > 0;

  if (score >= 75 || hasVulns || greynoise?.noise) return "found";
  if (score >= 25) return "warning";
  if (geo?.status === "success" || quickScan || shodan) return "clean";
  return "warning";
}

function whoisStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  const rdap = p.rdap as { errorCode?: number; ldhName?: string } | null;
  const dns = p.dns as { Answer?: unknown[] } | null;
  const certs = (p.certificates as unknown[]) ?? [];
  const st = p.securityTrails as { subdomains?: unknown[] } | null;
  const domainsdb = p.domainsdb as { domains?: unknown[]; skipped?: boolean } | null;
  const hunter = p.hunter as { data?: { emails?: unknown[] }; skipped?: boolean } | null;

  if (rdap?.errorCode && !dns?.Answer?.length) return "warning";
  if (
    rdap?.ldhName ||
    certs.length > 0 ||
    (st?.subdomains?.length ?? 0) > 0 ||
    (domainsdb?.domains?.length ?? 0) > 0 ||
    (hunter?.data?.emails?.length ?? 0) > 0
  ) {
    return "found";
  }
  if (rdap || dns?.Answer?.length) return "clean";
  return "warning";
}

function threatStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  const vt = p.virusTotal as { skipped?: boolean; data?: { attributes?: { last_analysis_stats?: Record<string, number> } } } | null;
  if (vt?.skipped) {
    // fall through to other sources
  }
  const stats = vt?.data?.attributes?.last_analysis_stats;
  const otx = p.alienVault as { pulse_info?: { count?: number } } | null;
  const phish = p.phishTank as {
    results?: { in_database?: boolean; verified?: boolean };
  } | null;

  const malicious = stats?.malicious ?? 0;
  const suspicious = stats?.suspicious ?? 0;
  const pulses = otx?.pulse_info?.count ?? 0;
  const phishHit =
    phish?.results?.in_database === true || phish?.results?.verified === true;
  const mozilla = p.mozillaObservatory as { grade?: string; score?: number } | null;
  const weakTls = mozilla?.grade && !["A", "A+", "A-"].includes(String(mozilla.grade));
  const urlhaus = p.urlhaus as {
    query_status?: string;
    url_count?: string | number;
    urls?: unknown[];
    skipped?: boolean;
  } | null;
  const urlhausHits =
    urlhaus?.query_status === "ok" &&
    (Number(urlhaus.url_count) > 0 || (urlhaus.urls?.length ?? 0) > 0);
  const mb = p.malwareBazaar as { query_status?: string; data?: unknown[]; skipped?: boolean } | null;
  const mbHit = mb?.query_status === "ok" && Array.isArray(mb.data) && mb.data.length > 0;

  if (malicious > 0 || phishHit || urlhausHits || mbHit) return "found";
  if (suspicious > 0 || pulses > 0 || weakTls) return "warning";
  if (stats || otx || phish) return "clean";
  return "warning";
}

function phoneStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  if (p.error && !(p.numlookup as { skipped?: boolean } | null)?.skipped) return "warning";

  const numlookup = p.numlookup as { skipped?: boolean; valid?: boolean; carrier?: string } | null;

  if (numlookup?.skipped) return "warning";
  if (numlookup?.valid === false) return "warning";
  if (numlookup?.valid === true || numlookup?.carrier) return "found";
  if (numlookup) return "clean";
  return "warning";
}

function vinStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  if (p.skipped) return "warning";
  if (p.error) return "warning";

  const vehicle = p.vehicle as { make?: string; model?: string } | null;
  const recalls = (p.recalls as { results?: unknown[] })?.results?.length ?? 0;
  const complaints = (p.complaints as { results?: unknown[] })?.results?.length ?? 0;

  if (vehicle?.make || recalls > 0 || complaints > 0) return "found";
  if (p.vin) return "clean";
  return "warning";
}

function plateStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  if (p.error) return "warning";

  const decode = parseNhtsaDecode(p.vehicle);
  const recalls = (p.recalls as { results?: unknown[] })?.results?.length ?? 0;
  const dvla = p.dvla as { skipped?: boolean; make?: string } | null;
  const pr = p.plateRecognizer as { skipped?: boolean; results?: unknown[] } | null;

  if (decode.Make || decode.Model || recalls > 0 || dvla?.make || (pr?.results?.length ?? 0) > 0) {
    return "found";
  }
  if (p.note) return "warning";
  if ((dvla?.skipped && p.country === "uk") || pr?.skipped) return "warning";
  if (p.vin || p.plate) return "clean";
  return "warning";
}

function usernameStatus(data: Record<string, unknown>): SourceStatus {
  const p = payload(data);
  const verified = (p.verified as Array<{ found?: boolean }>) ?? [];
  const detected = (p.detected as Array<{ found?: boolean }>) ?? [];
  const totalFound =
    verified.filter((r) => r.found).length + detected.filter((r) => r.found).length;

  if (totalFound > 0) return "found";
  if (verified.length || detected.length) return "clean";
  return "warning";
}

export function getSourceStatus(result: ReconSourceResult): SourceStatus {
  if (result.status === "rejected" || result.data.error) return "warning";

  const handlers: Record<string, (d: Record<string, unknown>) => SourceStatus> = {
    "/api/breach": breachStatus,
    "/api/ip": ipStatus,
    "/api/phone": phoneStatus,
    "/api/plate": plateStatus,
    "/api/vin": vinStatus,
    "/api/whois": whoisStatus,
    "/api/threat": threatStatus,
    "/api/username": usernameStatus,
  };

  return handlers[result.source]?.(result.data) ?? "warning";
}

export function getSourceSummary(result: ReconSourceResult): string {
  const status = getSourceStatus(result);
  const p = payload(result.data);

  switch (result.source) {
    case "/api/breach": {
      const hibp = p.hibp as unknown[] | { breaches?: unknown[] } | null;
      const count = Array.isArray(hibp)
        ? hibp.length
        : ((hibp as { breaches?: unknown[] })?.breaches?.length ?? 0);
      return status === "found"
        ? `${count} breach source(s) or suspicious signals`
        : status === "clean"
          ? "No breaches detected"
          : "Lookup incomplete or failed";
    }
    case "/api/ip": {
      const geo = p.geo as { city?: string; country?: string } | null;
      if (geo?.city) return `${geo.city}, ${geo.country ?? "—"}`;
      return status === "warning" ? "IP lookup failed" : "IP data retrieved";
    }
    case "/api/whois": {
      const rdap = p.rdap as { ldhName?: string } | null;
      return rdap?.ldhName ? `Registered: ${rdap.ldhName}` : "Domain records checked";
    }
    case "/api/threat": {
      const vt = p.virusTotal as {
        data?: { attributes?: { last_analysis_stats?: Record<string, number> } };
      } | null;
      const m = vt?.data?.attributes?.last_analysis_stats?.malicious ?? 0;
      const urlhaus = p.urlhaus as { url_count?: string | number; urls?: unknown[] } | null;
      const uh = Number(urlhaus?.url_count ?? urlhaus?.urls?.length ?? 0);
      if (m > 0) return `${m} malicious VT detection(s)`;
      if (uh > 0) return `${uh} malicious URL(s) on URLhaus`;
      return "No active threats flagged";
    }
    case "/api/username": {
      const verified = (p.verified as Array<{ found?: boolean }>) ?? [];
      const detected = (p.detected as Array<{ found?: boolean }>) ?? [];
      const n =
        verified.filter((r) => r.found).length +
        detected.filter((r) => r.found).length;
      return n > 0 ? `${n} profile(s) found` : "No profiles detected";
    }
    case "/api/phone": {
      const nl = p.numlookup as { valid?: boolean; carrier?: string; location?: string; skipped?: boolean } | null;
      if (nl?.skipped) return "Add NUMLOOKUP_KEY (numlookupapi.com)";
      const carrier = nl?.carrier;
      const location = nl?.location;
      if (carrier) return `${carrier}${location ? ` · ${location}` : ""}`;
      if (nl?.valid) return "Valid phone number";
      if (nl?.valid === false) return "Invalid phone number";
      return status === "warning" ? "Phone lookup incomplete" : "Phone checked";
    }
    case "/api/plate": {
      const decode = parseNhtsaDecode(p.vehicle);
      const recalls = (p.recalls as { results?: unknown[] })?.results?.length ?? 0;
      const dvla = p.dvla as { make?: string; skipped?: boolean } | null;
      if (p.source === "Plate OCR" && p.plate) {
        const conf = typeof p.confidence === "number" ? ` · ${p.confidence}% OCR` : "";
        return `OCR: ${p.plate}${conf}`;
      }
      if (decode.Make) {
        return `${decode["Model Year"] ?? ""} ${decode.Make} ${decode.Model ?? ""}`.trim();
      }
      if (dvla?.make) return `${dvla.make}${p.plate ? ` · ${p.plate}` : ""}`;
      const pr = (p.plateRecognizer as { results?: Array<{ plate?: string }> })?.results?.[0];
      if (pr?.plate) return `ALPR: ${pr.plate}`;
      if (recalls > 0) return `${recalls} recall(s) found`;
      if (p.note) return String(p.note).slice(0, 60);
      if (dvla?.skipped && p.country === "uk") return "Add DVLA API key (developer.gov.uk)";
      const prSkipped = p.plateRecognizer as { skipped?: boolean; reason?: string } | null;
      if (prSkipped?.skipped) return prSkipped.reason ?? "Add Plate Recognizer key for ALPR";
      return "Vehicle lookup complete";
    }
    case "/api/vin": {
      const vehicle = p.vehicle as { make?: string; model?: string; year?: string } | null;
      const recalls = (p.recalls as { results?: unknown[] })?.results?.length ?? 0;
      const complaints = (p.complaints as { results?: unknown[] })?.results?.length ?? 0;
      if (p.skipped) return String((p as { reason?: string }).reason ?? "No VIN provided");
      if (vehicle?.make) {
        return `${vehicle.year ?? ""} ${vehicle.make} ${vehicle.model ?? ""}`.trim();
      }
      if (recalls > 0) return `${recalls} recall(s)`;
      if (complaints > 0) return `${complaints} complaint(s)`;
      return status === "warning" ? "VIN lookup incomplete" : "VIN checked";
    }
    default:
      return STATUS_META[status].label;
  }
}
