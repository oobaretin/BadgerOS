"use client";

import { useState } from "react";
import type { ReconResponse, ReconSourceResult } from "@/lib/detect";
import { ROUTE_LABELS } from "@/lib/routes";
import { parseNhtsaDecode } from "@/lib/vehicleDetect";
import {
  getSourceStatus,
  getSourceSummary,
  STATUS_META,
  type SourceStatus,
} from "@/lib/sourceStatus";

interface ResultsPanelProps {
  response: ReconResponse;
  loading?: boolean;
  pendingRoutes?: string[];
  expandPrimary?: boolean;
}

function DataSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
        {title}
      </h3>
      {children}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
      <dt className="text-xs text-foreground/40 sm:w-36 shrink-0">{label}</dt>
      <dd className="text-sm font-mono break-all">{value ?? "—"}</dd>
    </div>
  );
}

function SkippedNotice({ data }: { data: unknown }) {
  const item = data as { skipped?: boolean; reason?: string } | null;
  if (!item?.skipped) return null;
  return (
    <p className="text-sm text-muted italic">{item.reason ?? "Skipped — no API key configured"}</p>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <p className="text-sm text-error/80 font-mono">{message}</p>
  );
}

function BreachResults({ data }: { data: Record<string, unknown> }) {
  if (data.error) {
    return <ErrorBlock message={String(data.error)} />;
  }

  const rep = data.reputation as Record<string, unknown> | null;
  const repDetails = rep?.details as Record<string, unknown> | undefined;

  const hibp = data.hibp as Record<string, unknown> | unknown[] | null;
  const hibpBreaches = Array.isArray(hibp)
    ? hibp
    : ((hibp?.breaches as Array<{
        Name?: string;
        name?: string;
        BreachDate?: string;
        date?: string;
        DataClasses?: string[];
        dataClasses?: string[];
      }>) ?? []);

  const breachDir = data.breachDirectory as {
    success?: boolean;
    found?: string;
    result?: Array<{ sources?: string; email?: string; fields?: string[] }>;
    error?: string;
  } | null;

  const dirResults = breachDir?.result ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DataSection title="EmailRep">
        {rep && !rep.error ? (
          <div className="space-y-3">
            <dl className="space-y-2">
              <KeyValue label="Email" value={String(rep.email ?? "—")} />
              <KeyValue label="Reputation" value={String(rep.reputation ?? "—")} />
              <KeyValue label="Suspicious" value={rep.suspicious ? "Yes" : "No"} />
              <KeyValue label="References" value={String(rep.references ?? 0)} />
            </dl>
            {repDetails?.data_breach != null && (
              <KeyValue label="Data Breach" value={repDetails.data_breach ? "Yes" : "No"} />
            )}
          </div>
        ) : rep?.error ? (
          <p className="text-sm text-foreground/50">{String(rep.error)}</p>
        ) : (
          <p className="text-sm text-foreground/40">EmailRep lookup failed</p>
        )}
      </DataSection>

      <DataSection title="Have I Been Pwned">
        <SkippedNotice data={hibp} />
        {!(hibp as { skipped?: boolean })?.skipped && hibpBreaches.length ? (
          <ul className="space-y-2 max-h-48 overflow-auto">
            {hibpBreaches.map((b, i) => {
              const item = b as Record<string, unknown>;
              return (
                <li key={i} className="text-xs border-b border-border/50 pb-2">
                  <p className="font-medium">{String(item.Name ?? item.name ?? "Unknown")}</p>
                  <p className="text-muted font-mono">
                    {String(item.BreachDate ?? item.date ?? "—")}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : hibp ? (
          <p className="text-sm text-emerald-400">No breaches found</p>
        ) : (
          <p className="text-sm text-foreground/40">HIBP lookup failed</p>
        )}
      </DataSection>

      <DataSection title="BreachDirectory">
        <SkippedNotice data={breachDir} />
        {!(breachDir as { skipped?: boolean })?.skipped && dirResults.length ? (
          <ul className="space-y-2 max-h-48 overflow-auto">
            {dirResults.slice(0, 10).map((item, i) => (
              <li key={i} className="text-xs border-b border-border/50 pb-2">
                <p className="font-medium">{item.email ?? item.sources ?? "Match"}</p>
                {item.fields?.length ? (
                  <p className="text-muted font-mono">{item.fields.join(", ")}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : breachDir?.error ? (
          <p className="text-sm text-foreground/50">{String(breachDir.error)}</p>
        ) : breachDir ? (
          <p className="text-sm text-emerald-400">No breaches found</p>
        ) : (
          <p className="text-sm text-foreground/40">BreachDirectory lookup failed</p>
        )}
      </DataSection>
    </div>
  );
}

function IpResults({ data }: { data: Record<string, unknown> }) {
  const resolvedFrom = data.resolvedFrom as string | null;
  const target = data.target as string | undefined;
  const geo = data.geo as Record<string, unknown> | null;
  const abuse = data.abuse as Record<string, unknown> | null;
  const abuseData = abuse?.data as Record<string, unknown> | undefined;
  const shodan = data.shodan as Record<string, unknown> | null;
  const quickScan = data.quickScan as Record<string, unknown> | null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {resolvedFrom && (
        <div className="sm:col-span-2 rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-xs text-muted">
          Resolved <span className="font-mono text-foreground">{resolvedFrom}</span> →{" "}
          <span className="font-mono text-accent">{target}</span>
        </div>
      )}
      <DataSection title="Geolocation (ip-api.com)">
        {geo && geo.status === "success" ? (
          <dl className="space-y-2">
            <KeyValue label="IP" value={String(geo.query ?? "—")} />
            <KeyValue label="City" value={String(geo.city ?? "—")} />
            <KeyValue label="Region" value={String(geo.regionName ?? "—")} />
            <KeyValue label="Country" value={String(geo.country ?? "—")} />
            <KeyValue label="ZIP" value={String(geo.zip ?? "—")} />
            <KeyValue label="Coords" value={`${geo.lat ?? "—"}, ${geo.lon ?? "—"}`} />
            <KeyValue label="ISP" value={String(geo.isp ?? "—")} />
            <KeyValue label="Org" value={String(geo.org ?? "—")} />
            <KeyValue label="AS" value={String(geo.as ?? "—")} />
          </dl>
        ) : geo ? (
          <p className="text-sm text-foreground/50">
            {String(geo.message ?? "Geolocation lookup failed")}
          </p>
        ) : (
          <p className="text-sm text-foreground/40">Geolocation lookup failed</p>
        )}
      </DataSection>

      <DataSection title="AbuseIPDB">
        <SkippedNotice data={abuse} />
        {!(abuse as { skipped?: boolean })?.skipped && abuseData ? (
          <dl className="space-y-2">
            <KeyValue label="IP" value={String(abuseData.ipAddress ?? "—")} />
            <KeyValue
              label="Abuse Score"
              value={`${abuseData.abuseConfidenceScore ?? 0}/100`}
            />
            <KeyValue label="Country" value={String(abuseData.countryCode ?? "—")} />
            <KeyValue label="ISP" value={String(abuseData.isp ?? "—")} />
            <KeyValue label="Domain" value={String(abuseData.domain ?? "—")} />
            <KeyValue label="Usage Type" value={String(abuseData.usageType ?? "—")} />
            <KeyValue label="Total Reports" value={String(abuseData.totalReports ?? 0)} />
            <KeyValue
              label="Distinct Reporters"
              value={String(abuseData.numDistinctUsers ?? 0)}
            />
            <KeyValue
              label="Last Reported"
              value={String(abuseData.lastReportedAt ?? "—")}
            />
          </dl>
        ) : abuse?.error ? (
          <p className="text-sm text-foreground/50">{String(abuse.error)}</p>
        ) : (
          <p className="text-sm text-foreground/40">AbuseIPDB lookup failed</p>
        )}
      </DataSection>

      <DataSection title="Shodan Host">
        <SkippedNotice data={shodan} />
        {!(shodan as { skipped?: boolean })?.skipped && shodan && !shodan.error ? (
          <dl className="space-y-2">
            <KeyValue label="IP" value={String(shodan.ip_str ?? "—")} />
            <KeyValue label="OS" value={String(shodan.os ?? "—")} />
            <KeyValue label="ISP" value={String(shodan.isp ?? "—")} />
            <KeyValue label="Org" value={String(shodan.org ?? "—")} />
            <KeyValue
              label="Ports"
              value={
                Array.isArray(shodan.ports)
                  ? (shodan.ports as number[]).join(", ")
                  : "—"
              }
            />
            <KeyValue
              label="Hostnames"
              value={
                Array.isArray(shodan.hostnames)
                  ? (shodan.hostnames as string[]).join(", ")
                  : "—"
              }
            />
            <KeyValue
              label="Vulns"
              value={
                shodan.vulns
                  ? Object.keys(shodan.vulns as Record<string, unknown>).join(", ")
                  : "—"
              }
            />
          </dl>
        ) : shodan?.error ? (
          <p className="text-sm text-foreground/50">{String(shodan.error)}</p>
        ) : (
          <p className="text-sm text-foreground/40">Shodan lookup failed</p>
        )}
      </DataSection>

      <DataSection title="Shodan InternetDB (free)">
        {quickScan && !quickScan.error ? (
          <dl className="space-y-2">
            <KeyValue label="IP" value={String(quickScan.ip ?? "—")} />
            <KeyValue
              label="Ports"
              value={
                Array.isArray(quickScan.ports)
                  ? (quickScan.ports as number[]).join(", ")
                  : "—"
              }
            />
            <KeyValue
              label="Hostnames"
              value={
                Array.isArray(quickScan.hostnames)
                  ? (quickScan.hostnames as string[]).join(", ")
                  : "—"
              }
            />
            <KeyValue
              label="Tags"
              value={
                Array.isArray(quickScan.tags)
                  ? (quickScan.tags as string[]).join(", ")
                  : "—"
              }
            />
            <KeyValue
              label="Vulns"
              value={
                Array.isArray(quickScan.vulns)
                  ? (quickScan.vulns as string[]).join(", ")
                  : "—"
              }
            />
            <KeyValue
              label="CPEs"
              value={
                Array.isArray(quickScan.cpes)
                  ? (quickScan.cpes as string[]).slice(0, 5).join(", ")
                  : "—"
              }
            />
          </dl>
        ) : quickScan?.error ? (
          <p className="text-sm text-foreground/50">{String(quickScan.error)}</p>
        ) : (
          <p className="text-sm text-foreground/40">InternetDB lookup failed</p>
        )}
      </DataSection>
    </div>
  );
}

interface CrtShEntry {
  name_value?: string;
  not_before?: string;
  not_after?: string;
}

function WhoisResults({ data }: { data: Record<string, unknown> }) {
  const rdap = data.rdap as {
    errorCode?: number;
    ldhName?: string;
    status?: string[];
    events?: Array<{ eventAction?: string; eventDate?: string }>;
    nameservers?: Array<{ ldhName?: string }>;
  } | null;

  const dns = data.dns as { Answer?: Array<{ data?: string; TTL?: number }> } | null;
  const mx = data.mx as { Answer?: Array<{ data?: string; TTL?: number }> } | null;
  const certs = (data.certificates as CrtShEntry[]) ?? [];

  const st = data.securityTrails as {
    message?: string;
    hostname?: string;
    subdomains?: string[];
    current_dns?: Record<string, unknown>;
  } | null;

  const wayback = data.wayback as {
    archived_snapshots?: {
      closest?: { available?: boolean; url?: string; timestamp?: string };
    };
  } | null;

  const registration = rdap?.events?.find((e) => e.eventAction === "registration");
  const expiration = rdap?.events?.find((e) => e.eventAction === "expiration");
  const snapshot = wayback?.archived_snapshots?.closest;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <DataSection title="RDAP">
        {rdap && !rdap.errorCode ? (
          <dl className="space-y-2">
            <KeyValue label="Domain" value={String(rdap.ldhName ?? "—")} />
            <KeyValue label="Registered" value={String(registration?.eventDate ?? "—")} />
            <KeyValue label="Expires" value={String(expiration?.eventDate ?? "—")} />
            <KeyValue label="Status" value={(rdap.status ?? []).join(", ") || "—"} />
            <KeyValue
              label="Nameservers"
              value={
                rdap.nameservers?.map((n) => n.ldhName).filter(Boolean).join(", ") || "—"
              }
            />
          </dl>
        ) : (
          <p className="text-sm text-foreground/40">RDAP lookup failed</p>
        )}
      </DataSection>

      <DataSection title="DNS A (Google)">
        {dns?.Answer?.length ? (
          <ul className="space-y-1">
            {dns.Answer.map((a) => (
              <li key={a.data} className="text-sm font-mono">
                {a.data} <span className="text-muted">TTL {a.TTL}s</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/40">No A records</p>
        )}
      </DataSection>

      <DataSection title="MX (Cloudflare DNS)">
        {mx?.Answer?.length ? (
          <ul className="space-y-1">
            {mx.Answer.map((a) => (
              <li key={a.data} className="text-sm font-mono">
                {a.data} <span className="text-muted">TTL {a.TTL}s</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/40">No MX records</p>
        )}
      </DataSection>

      <DataSection title="Certificates (crt.sh)">
        {certs.length ? (
          <ul className="space-y-1 max-h-40 overflow-auto">
            {certs.map((c, i) => (
              <li key={i} className="text-xs font-mono border-b border-border/50 pb-1">
                {c.name_value?.split("\n")[0]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/40">No certificates found</p>
        )}
      </DataSection>

      <DataSection title="SecurityTrails">
        {st?.message ? (
          <p className="text-sm text-foreground/50">{st.message}</p>
        ) : st ? (
          <dl className="space-y-2">
            <KeyValue label="Hostname" value={String(st.hostname ?? "—")} />
            <KeyValue
              label="Subdomains"
              value={String(st.subdomains?.length ?? 0)}
            />
          </dl>
        ) : (
          <p className="text-sm text-foreground/40">SecurityTrails lookup failed</p>
        )}
      </DataSection>

      <DataSection title="Wayback Machine">
        {snapshot?.available ? (
          <dl className="space-y-2">
            <KeyValue label="Timestamp" value={String(snapshot.timestamp ?? "—")} />
            <dd>
              <a
                href={snapshot.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline break-all font-mono"
              >
                {snapshot.url}
              </a>
            </dd>
          </dl>
        ) : snapshot ? (
          <p className="text-sm text-foreground/40">No archived snapshot</p>
        ) : (
          <p className="text-sm text-foreground/40">Wayback lookup failed</p>
        )}
      </DataSection>
    </div>
  );
}

function UsernameResults({ data }: { data: Record<string, unknown> }) {
  const verified = (data.verified as Array<{
    platform: string;
    url: string;
    found: boolean;
  }>) ?? [];
  const detected = (data.detected as Array<{
    platform: string;
    url: string;
    found: boolean;
  }>) ?? [];

  const verifiedFound = verified.filter((r) => r.found).length;
  const detectedFound = detected.filter((r) => r.found).length;

  function ResultTable({
    rows,
    title,
    unverified,
  }: {
    rows: Array<{ platform: string; url: string; found: boolean }>;
    title: string;
    unverified?: boolean;
  }) {
    return (
      <DataSection title={title}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground/40 border-b border-border">
                <th className="pb-2 pr-4">Platform</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">URL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.platform} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{p.platform}</td>
                  <td className="py-2 pr-4">
                    {p.found ? (
                      <span className={unverified ? "text-amber-400" : "text-emerald-400"}>
                        {unverified ? "Possible (unverified)" : "Found"}
                      </span>
                    ) : (
                      <span className="text-foreground/30">Not found</span>
                    )}
                  </td>
                  <td className="py-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-accent hover:underline break-all"
                    >
                      {p.url}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSection>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ResultTable
        title={`API Verified (${verifiedFound} found)`}
        rows={verified}
      />
      <ResultTable
        title={`HEAD Detected (${detectedFound} possible — unverified)`}
        rows={detected}
        unverified
      />
    </div>
  );
}

function PhoneResults({ data }: { data: Record<string, unknown> }) {
  if (data.error) {
    return <ErrorBlock message={String(data.error)} />;
  }

  const numverify = data.numverify as {
    skipped?: boolean;
    valid?: boolean;
    number?: string;
    international_format?: string;
    country_name?: string;
    location?: string;
    carrier?: string;
    line_type?: string;
    error?: { info?: string };
  } | null;

  const abstract = data.abstract as {
    skipped?: boolean;
    valid?: boolean;
    phone?: string;
    format?: { international?: string; local?: string };
    country?: { name?: string; code?: string; prefix?: string };
    location?: string;
    type?: string;
    carrier?: string;
    error?: { message?: string };
  } | null;

  const valid =
    numverify?.valid != null && abstract?.valid != null
      ? numverify.valid && abstract.valid
      : (numverify?.valid ?? abstract?.valid);
  const carrier = numverify?.carrier ?? abstract?.carrier;
  const lineType = numverify?.line_type ?? abstract?.type;
  const country = numverify?.country_name ?? abstract?.country?.name;
  const hasSummary = valid != null || carrier || lineType || country;

  return (
    <div className="space-y-4">
      {hasSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rose-400/70">Validity</p>
            <p className="text-sm font-semibold mt-0.5">
              {valid == null ? "—" : valid ? "Valid" : "Invalid"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rose-400/70">Carrier</p>
            <p className="text-sm font-semibold mt-0.5">{carrier ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rose-400/70">Line type</p>
            <p className="text-sm font-semibold mt-0.5">{lineType ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rose-400/70">Country</p>
            <p className="text-sm font-semibold mt-0.5">{country ?? "—"}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
      <DataSection title="Numverify (APILayer)">
        <SkippedNotice data={numverify} />
        {!numverify?.skipped && numverify?.valid != null ? (
          <dl className="space-y-2">
            <KeyValue label="Number" value={String(data.number ?? numverify.number ?? "—")} />
            <KeyValue label="Valid" value={numverify.valid ? "Yes" : "No"} />
            <KeyValue label="International" value={String(numverify.international_format ?? "—")} />
            <KeyValue label="Country" value={String(numverify.country_name ?? "—")} />
            <KeyValue label="Location" value={String(numverify.location ?? "—")} />
            <KeyValue label="Carrier" value={String(numverify.carrier ?? "—")} />
            <KeyValue label="Line type" value={String(numverify.line_type ?? "—")} />
          </dl>
        ) : numverify?.error ? (
          <p className="text-sm text-foreground/50">{String(numverify.error.info ?? "Lookup failed")}</p>
        ) : !numverify?.skipped ? (
          <p className="text-sm text-foreground/50">Numverify lookup failed</p>
        ) : null}
      </DataSection>

      <DataSection title="Abstract Phone Validation">
        <SkippedNotice data={abstract} />
        {!abstract?.skipped && abstract?.valid != null ? (
          <dl className="space-y-2">
            <KeyValue label="Number" value={String(abstract.phone ?? data.number ?? "—")} />
            <KeyValue label="Valid" value={abstract.valid ? "Yes" : "No"} />
            <KeyValue
              label="International"
              value={String(abstract.format?.international ?? "—")}
            />
            <KeyValue label="Local" value={String(abstract.format?.local ?? "—")} />
            <KeyValue label="Country" value={String(abstract.country?.name ?? "—")} />
            <KeyValue label="Location" value={String(abstract.location ?? "—")} />
            <KeyValue label="Carrier" value={String(abstract.carrier ?? "—")} />
            <KeyValue label="Type" value={String(abstract.type ?? "—")} />
          </dl>
        ) : abstract?.error ? (
          <p className="text-sm text-foreground/50">{String(abstract.error.message ?? "Lookup failed")}</p>
        ) : !abstract?.skipped ? (
          <p className="text-sm text-foreground/50">Abstract lookup failed</p>
        ) : null}
      </DataSection>
      </div>
    </div>
  );
}

function PlateResults({ data }: { data: Record<string, unknown> }) {
  const vehicle = data.vehicle as { Results?: unknown[]; Message?: string } | null;
  const recalls = data.recalls as {
    results?: unknown[];
    message?: string;
  } | null;
  const complaints = data.complaints as {
    results?: unknown[];
    message?: string;
  } | null;
  const dvla = data.dvla as {
    skipped?: boolean;
    make?: string;
    colour?: string;
    yearOfManufacture?: number;
    fuelType?: string;
    taxStatus?: string;
    motStatus?: string;
    registrationNumber?: string;
    message?: string;
    errors?: Array<{ detail?: string }>;
  } | null;

  const plateRecognizer = data.plateRecognizer as {
    skipped?: boolean;
    reason?: string;
    results?: Array<{
      plate?: string;
      score?: number;
      region?: { code?: string };
      vehicle?: { type?: string; score?: number };
      model_make?: Array<{ make?: string; model?: string; score?: number }>;
      color?: Array<{ color?: string; score?: number }>;
    }>;
    error?: string;
  } | null;

  const decode = parseNhtsaDecode(vehicle);
  const hasDecode = Boolean(decode.Make || decode.Model);
  const recallCount = Array.isArray(recalls?.results) ? recalls.results.length : 0;
  const complaintCount = Array.isArray(complaints?.results) ? complaints.results.length : 0;
  const prHit = plateRecognizer?.results?.[0];
  const prMakeModel = prHit?.model_make?.[0];
  const prColor = prHit?.color?.[0]?.color;
  const isUk = data.country === "uk";
  const isOcr = data.source === "Plate OCR";
  const ocrConfidence = typeof data.confidence === "number" ? data.confidence : null;

  return (
    <div className="space-y-4">
      {isOcr && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-orange-400/30 bg-orange-400/10 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">OCR plate</p>
            <p className="text-sm font-mono font-semibold mt-0.5">{String(data.plate ?? "—")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Confidence</p>
            <p className="text-sm font-semibold mt-0.5">
              {ocrConfidence != null ? `${ocrConfidence}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Vehicle</p>
            <p className="text-sm font-semibold mt-0.5">
              {String(data.vehicleType ?? prHit?.vehicle?.type ?? "—")}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Color</p>
            <p className="text-sm font-semibold mt-0.5">
              {String(data.vehicleColor ?? prColor ?? "—")}
            </p>
          </div>
        </div>
      )}

      {(hasDecode || dvla?.make || recallCount > 0 || complaintCount > 0) && !isOcr && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Vehicle</p>
            <p className="text-sm font-semibold mt-0.5">
              {hasDecode
                ? `${decode["Model Year"] ?? ""} ${decode.Make ?? ""} ${decode.Model ?? ""}`.trim() || "—"
                : dvla?.make ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Recalls</p>
            <p className="text-sm font-semibold mt-0.5">
              {data.vin ? (recallCount > 0 ? `${recallCount} open` : "None found") : "Needs VIN"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Complaints</p>
            <p className="text-sm font-semibold mt-0.5">
              {data.vin ? (complaintCount > 0 ? `${complaintCount} filed` : "None found") : "Needs VIN"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Region</p>
            <p className="text-sm font-semibold mt-0.5">
              {isUk ? "UK (DVLA)" : "US (NHTSA)"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Identifier</p>
            <p className="text-sm font-mono font-semibold mt-0.5">
              {String(data.vin ?? data.plate ?? "—")}
            </p>
          </div>
        </div>
      )}

      {Boolean(data.plate || data.vin) && (
        <dl className="grid gap-2 sm:grid-cols-3 text-sm">
          <KeyValue label="Plate" value={String(data.plate ?? "—")} />
          <KeyValue label="VIN" value={String(data.vin ?? "—")} />
          <KeyValue label="Country" value={String(data.country ?? "—")} />
        </dl>
      )}

      {Boolean(data.note) && (
        <p className="text-sm text-muted rounded-xl border border-border bg-surface p-3">
          {String(data.note)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DataSection title={isOcr ? "NHTSA Vanity Plate Decode" : "NHTSA VIN Decode"}>
          {hasDecode ? (
            <dl className="space-y-2">
              <KeyValue label="Make" value={decode.Make ?? "—"} />
              <KeyValue label="Model" value={decode.Model ?? "—"} />
              <KeyValue label="Year" value={decode["Model Year"] ?? "—"} />
              <KeyValue label="Body" value={decode["Body Class"] ?? "—"} />
              <KeyValue label="Fuel" value={decode["Fuel Type - Primary"] ?? "—"} />
              <KeyValue label="Plant" value={decode["Plant Country"] ?? "—"} />
            </dl>
          ) : data.vin ? (
            <p className="text-sm text-foreground/50">
              {decode["Error Text"] ?? vehicle?.Message ?? "No decode results"}
            </p>
          ) : (
            <p className="text-sm text-muted">Enter a VIN for NHTSA decode</p>
          )}
        </DataSection>

        <DataSection title="NHTSA Recalls">
          {Array.isArray(recalls?.results) ? (
            recalls.results.length ? (
              <ul className="space-y-2 max-h-48 overflow-auto text-xs">
                {recalls.results.slice(0, 8).map((item, i) => {
                  const r = item as Record<string, unknown>;
                  return (
                    <li key={i} className="border-b border-border/50 pb-2">
                      <p className="font-medium">{String(r.Component ?? r.NHTSACampaignNumber ?? "Recall")}</p>
                      <p className="text-muted">{String(r.Summary ?? r.Consequence ?? "—").slice(0, 120)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">No open recalls found</p>
            )
          ) : data.vin ? (
            <p className="text-sm text-foreground/50">Recall lookup unavailable</p>
          ) : (
            <p className="text-sm text-muted">Requires VIN</p>
          )}
        </DataSection>

        <DataSection title="NHTSA Complaints">
          {Array.isArray(complaints?.results) ? (
            complaints.results.length ? (
              <ul className="space-y-2 max-h-48 overflow-auto text-xs">
                {complaints.results.slice(0, 8).map((item, i) => {
                  const c = item as Record<string, unknown>;
                  return (
                    <li key={i} className="border-b border-border/50 pb-2">
                      <p className="font-medium">{String(c.components ?? c.summary ?? "Complaint")}</p>
                      <p className="text-muted">{String(c.summary ?? c.crash ?? "—").slice(0, 120)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">No complaints found</p>
            )
          ) : data.vin ? (
            <p className="text-sm text-foreground/50">Complaint lookup unavailable</p>
          ) : (
            <p className="text-sm text-muted">Requires VIN</p>
          )}
        </DataSection>

        <DataSection title="DVLA (UK)">
          <SkippedNotice data={dvla} />
          {!dvla?.skipped && dvla?.make ? (
            <dl className="space-y-2">
              <KeyValue label="Registration" value={String(dvla.registrationNumber ?? data.plate ?? "—")} />
              <KeyValue label="Make" value={String(dvla.make ?? "—")} />
              <KeyValue label="Colour" value={String(dvla.colour ?? "—")} />
              <KeyValue label="Year" value={String(dvla.yearOfManufacture ?? "—")} />
              <KeyValue label="Fuel" value={String(dvla.fuelType ?? "—")} />
              <KeyValue label="Tax" value={String(dvla.taxStatus ?? "—")} />
              <KeyValue label="MOT" value={String(dvla.motStatus ?? "—")} />
            </dl>
          ) : !dvla?.skipped && data.country === "uk" ? (
            <p className="text-sm text-foreground/50">
              {String(dvla?.errors?.[0]?.detail ?? dvla?.message ?? "DVLA lookup failed")}
            </p>
          ) : !dvla?.skipped ? (
            <p className="text-sm text-muted">UK plate required for DVLA</p>
          ) : null}
        </DataSection>

        <DataSection title="Plate Recognizer (ALPR)">
          <SkippedNotice data={plateRecognizer} />
          {!plateRecognizer?.skipped && prHit ? (
            <dl className="space-y-2">
              <KeyValue label="Plate" value={prHit.plate ?? "—"} />
              <KeyValue label="Confidence" value={prHit.score != null ? `${Math.round(prHit.score * 100)}%` : "—"} />
              <KeyValue label="Region" value={prHit.region?.code ?? "—"} />
              <KeyValue label="Vehicle type" value={prHit.vehicle?.type ?? "—"} />
              <KeyValue
                label="Make / model"
                value={
                  prMakeModel
                    ? `${prMakeModel.make ?? "—"} ${prMakeModel.model ?? ""}`.trim()
                    : "—"
                }
              />
              <KeyValue label="Color" value={prColor ?? "—"} />
            </dl>
          ) : !plateRecognizer?.skipped && plateRecognizer?.error ? (
            <p className="text-sm text-foreground/50">{plateRecognizer.error}</p>
          ) : !plateRecognizer?.skipped && data.plate ? (
            <p className="text-sm text-muted">No ALPR results — pass imageUrl to analyze a photo</p>
          ) : null}
        </DataSection>
      </div>
    </div>
  );
}

function VinResults({ data }: { data: Record<string, unknown> }) {
  if (data.skipped) {
    return <SkippedNotice data={data} />;
  }

  if (data.error) {
    return <ErrorBlock message={String(data.error)} />;
  }

  const vehicle = data.vehicle as {
    make?: string;
    model?: string;
    year?: string;
    trim?: string;
    bodyClass?: string;
    driveType?: string;
    engineCylinders?: string;
    engineDisplacement?: string;
    fuelType?: string;
    manufacturerName?: string;
    plantCity?: string;
    plantCountry?: string;
  } | null;

  const recalls = data.recalls as { results?: unknown[] } | null;
  const complaints = data.complaints as { results?: unknown[] } | null;
  const recallCount = Array.isArray(recalls?.results) ? recalls.results.length : 0;
  const complaintCount = Array.isArray(complaints?.results) ? complaints.results.length : 0;

  return (
    <div className="space-y-4">
      {vehicle?.make && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-orange-400/30 bg-orange-400/10 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Vehicle</p>
            <p className="text-sm font-semibold mt-0.5">
              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Recalls</p>
            <p className="text-sm font-semibold mt-0.5">
              {recallCount > 0 ? `${recallCount} open` : "None found"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">Complaints</p>
            <p className="text-sm font-semibold mt-0.5">
              {complaintCount > 0 ? `${complaintCount} filed` : "None found"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-orange-400/70">VIN</p>
            <p className="text-sm font-mono font-semibold mt-0.5">{String(data.vin ?? "—")}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DataSection title="NHTSA VIN Decode">
          {vehicle?.make ? (
            <dl className="space-y-2">
              <KeyValue label="Make" value={vehicle.make ?? "—"} />
              <KeyValue label="Model" value={vehicle.model ?? "—"} />
              <KeyValue label="Year" value={vehicle.year ?? "—"} />
              <KeyValue label="Trim" value={vehicle.trim ?? "—"} />
              <KeyValue label="Body" value={vehicle.bodyClass ?? "—"} />
              <KeyValue label="Drive" value={vehicle.driveType ?? "—"} />
              <KeyValue label="Engine" value={vehicle.engineCylinders ?? "—"} />
              <KeyValue label="Displacement" value={vehicle.engineDisplacement ? `${vehicle.engineDisplacement}L` : "—"} />
              <KeyValue label="Fuel" value={vehicle.fuelType ?? "—"} />
              <KeyValue label="Manufacturer" value={vehicle.manufacturerName ?? "—"} />
              <KeyValue label="Plant" value={[vehicle.plantCity, vehicle.plantCountry].filter(Boolean).join(", ") || "—"} />
            </dl>
          ) : (
            <p className="text-sm text-foreground/50">No decode results</p>
          )}
        </DataSection>

        <DataSection title="NHTSA Recalls">
          {Array.isArray(recalls?.results) ? (
            recalls.results.length ? (
              <ul className="space-y-2 max-h-48 overflow-auto text-xs">
                {recalls.results.slice(0, 8).map((item, i) => {
                  const r = item as Record<string, unknown>;
                  return (
                    <li key={i} className="border-b border-border/50 pb-2">
                      <p className="font-medium">{String(r.Component ?? r.NHTSACampaignNumber ?? "Recall")}</p>
                      <p className="text-muted">{String(r.Summary ?? r.Consequence ?? "—").slice(0, 120)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">No open recalls found</p>
            )
          ) : (
            <p className="text-sm text-foreground/50">Recall lookup unavailable</p>
          )}
        </DataSection>

        <DataSection title="NHTSA Complaints">
          {Array.isArray(complaints?.results) ? (
            complaints.results.length ? (
              <ul className="space-y-2 max-h-48 overflow-auto text-xs">
                {complaints.results.slice(0, 8).map((item, i) => {
                  const c = item as Record<string, unknown>;
                  return (
                    <li key={i} className="border-b border-border/50 pb-2">
                      <p className="font-medium">{String(c.components ?? c.summary ?? "Complaint")}</p>
                      <p className="text-muted">{String(c.summary ?? c.crash ?? "—").slice(0, 120)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">No complaints found</p>
            )
          ) : (
            <p className="text-sm text-foreground/50">Complaint lookup unavailable</p>
          )}
        </DataSection>
      </div>
    </div>
  );
}

function ThreatResults({ data }: { data: Record<string, unknown> }) {
  const vt = data.virusTotal as {
    data?: { attributes?: Record<string, unknown> };
    error?: { message?: string };
  } | null;
  const vtAttrs = vt?.data?.attributes;
  const vtStats = vtAttrs?.last_analysis_stats as Record<string, number> | undefined;

  const otx = data.alienVault as {
    pulse_info?: { count?: number };
    alexa?: string;
    validation?: string[];
    whois?: string;
  } | null;

  const urlScan = data.urlScan as {
    results?: Array<{ page?: { title?: string; url?: string } }>;
    message?: string;
  } | null;

  const phishTank = data.phishTank as {
    results?: { in_database?: boolean; verified?: boolean; phish_id?: string };
    errortext?: string;
  } | null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DataSection title="VirusTotal">
        {vtStats ? (
          <dl className="space-y-2">
            <KeyValue label="Malicious" value={String(vtStats.malicious ?? 0)} />
            <KeyValue label="Suspicious" value={String(vtStats.suspicious ?? 0)} />
            <KeyValue label="Harmless" value={String(vtStats.harmless ?? 0)} />
            <KeyValue label="Reputation" value={String(vtAttrs?.reputation ?? "—")} />
          </dl>
        ) : (
          <p className="text-sm text-foreground/50">
            {String(vt?.error?.message ?? "VirusTotal lookup failed")}
          </p>
        )}
      </DataSection>

      <DataSection title="AlienVault OTX">
        {otx ? (
          <dl className="space-y-2">
            <KeyValue label="Pulse Count" value={String(otx.pulse_info?.count ?? 0)} />
            <KeyValue label="Alexa Rank" value={String(otx.alexa ?? "—")} />
            {otx.validation?.length ? (
              <KeyValue label="Validation" value={otx.validation.join(", ")} />
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-foreground/40">OTX lookup failed</p>
        )}
      </DataSection>

      <DataSection title="urlscan.io">
        {urlScan?.results?.length ? (
          <ul className="space-y-2 max-h-40 overflow-auto">
            {urlScan.results.map((scan, i) => (
              <li key={i} className="text-xs border-b border-border/50 pb-2">
                <p className="font-medium truncate">{scan.page?.title ?? "Untitled"}</p>
                {scan.page?.url && (
                  <a
                    href={scan.page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-accent hover:underline break-all"
                  >
                    {scan.page.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/40">
            {urlScan?.message ?? "No scans found"}
          </p>
        )}
      </DataSection>

      <DataSection title="PhishTank">
        {phishTank?.results ? (
          <dl className="space-y-2">
            <KeyValue
              label="In Database"
              value={phishTank.results.in_database ? "Yes" : "No"}
            />
            <KeyValue
              label="Verified"
              value={phishTank.results.verified ? "Yes" : "No"}
            />
            <KeyValue label="Phish ID" value={String(phishTank.results.phish_id ?? "—")} />
          </dl>
        ) : (
          <p className="text-sm text-foreground/50">
            {phishTank?.errortext ?? "PhishTank lookup failed"}
          </p>
        )}
      </DataSection>
    </div>
  );
}

function getPayload(data: Record<string, unknown>): Record<string, unknown> {
  if (data.data && typeof data.data === "object") {
    return data.data as Record<string, unknown>;
  }
  return data;
}

function SourceResult({ source, status, data }: ReconSourceResult) {
  if (status === "rejected") {
    return <ErrorBlock message={String(data.error ?? "Request failed")} />;
  }

  if (data.error) {
    return <ErrorBlock message={String(data.error)} />;
  }

  const payload = getPayload(data);

  const panels: Record<string, React.ReactNode> = {
    "/api/breach": <BreachResults data={payload} />,
    "/api/ip": <IpResults data={payload} />,
    "/api/phone": <PhoneResults data={payload} />,
    "/api/plate": <PlateResults data={payload} />,
    "/api/vin": <VinResults data={payload} />,
    "/api/whois": <WhoisResults data={payload} />,
    "/api/threat": <ThreatResults data={payload} />,
    "/api/username": <UsernameResults data={payload} />,
  };

  return (
    <div className="space-y-3">
      {panels[source] ?? (
        <pre className="text-xs font-mono text-foreground/70 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SourceStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function ExpandableSourceCard({
  result,
  defaultExpanded = false,
  loading = false,
}: {
  result: ReconSourceResult;
  defaultExpanded?: boolean;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const status = getSourceStatus(result);
  const summary = getSourceSummary(result);
  const label =
    (result.data.source as string) ??
    ROUTE_LABELS[result.source as keyof typeof ROUTE_LABELS] ??
    result.source.replace("/api/", "");

  return (
    <article className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-elevated/50 transition-colors"
      >
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_META[status].dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{label}</h3>
            <StatusBadge status={status} />
            {loading && (
              <span className="text-[10px] text-accent animate-pulse">Loading…</span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5 truncate">{summary}</p>
        </div>
        <span className="text-[10px] font-mono text-muted shrink-0 hidden sm:inline">
          {result.source}
        </span>
        <svg
          className={`w-4 h-4 text-muted shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          <SourceResult {...result} />
        </div>
      )}
    </article>
  );
}

export function ResultsPanel({
  response,
  loading = false,
  pendingRoutes = [],
  expandPrimary = true,
}: ResultsPanelProps) {
  if (!response.results.length && !loading) {
    return (
      <p className="text-sm text-foreground/50">No module results returned.</p>
    );
  }

  const counts = response.results.reduce(
    (acc, r) => {
      acc[getSourceStatus(r)] += 1;
      return acc;
    },
    { found: 0, clean: 0, warning: 0 } as Record<SourceStatus, number>
  );

  const primaryRoutes = new Set(
    response.results
      .map((r) => r.source)
      .filter((s) => {
        const map: Record<string, string[]> = {
          email: ["/api/breach", "/api/threat"],
          ip: ["/api/ip", "/api/threat"],
          domain: ["/api/whois", "/api/ip", "/api/threat"],
          phone: ["/api/phone"],
          plate: ["/api/plate", "/api/vin"],
          username: ["/api/username"],
        };
        return map[response.type]?.includes(s) ?? false;
      })
  );

  return (
    <div className="space-y-4">
      {response.results.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as SourceStatus[]).map((key) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${STATUS_META[key].badge}`}
            >
              {STATUS_META[key].label}: {counts[key]}
            </span>
          ))}
          {loading && pendingRoutes.length > 0 && (
            <span className="text-xs text-muted self-center">
              Waiting on {pendingRoutes.length} module{pendingRoutes.length !== 1 ? "s" : ""}…
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {response.results.map((result) => (
          <ExpandableSourceCard
            key={result.source}
            result={result}
            defaultExpanded={expandPrimary && primaryRoutes.has(result.source)}
          />
        ))}
        {loading &&
          pendingRoutes.map((route) => (
            <ExpandableSourceCard
              key={`pending-${route}`}
              result={{
                source: route,
                status: "rejected",
                data: { source: route.replace("/api/", ""), pending: true },
              }}
              loading
            />
          ))}
      </div>
    </div>
  );
}
