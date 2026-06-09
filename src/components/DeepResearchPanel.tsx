"use client";

import { useState } from "react";
import type { DeepResearchData, DeepFinding } from "@/lib/deepResearch/types";
import { ROUTE_LABELS } from "@/lib/routes";

interface DeepResearchPanelProps {
  deep: DeepResearchData;
  loading?: boolean;
}

function EnrichmentCard({
  kind,
  label,
  target,
  data,
}: {
  kind: string;
  label: string;
  target: string;
  data: Record<string, unknown>;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          {label}
        </h4>
        <span className="text-[10px] font-mono text-muted">{kind}</span>
      </div>
      <p className="text-xs font-mono text-muted truncate">{target}</p>
      {kind === "gravatar" && (
        <p className="text-sm">
          {data.found
            ? `Profile found${data.displayName ? `: ${String(data.displayName)}` : ""}`
            : "No Gravatar profile"}
        </p>
      )}
      {kind === "dns_txt" && (
        <div className="text-xs space-y-1 font-mono">
          <p>SPF: {data.spf ? "Yes" : "Not found"}</p>
          <p>DMARC hint: {data.dmarc ? "Yes" : "Not found"}</p>
        </div>
      )}
      {kind === "dns_ns" && (
        <ul className="text-xs font-mono space-y-1 max-h-24 overflow-auto">
          {((data.nameservers as string[]) ?? []).map((ns) => (
            <li key={ns}>{ns}</li>
          ))}
        </ul>
      )}
      {kind === "reverse_dns" && (
        <ul className="text-xs font-mono space-y-1">
          {((data.hostnames as string[]) ?? []).length ? (
            (data.hostnames as string[]).map((h) => <li key={h}>{h}</li>)
          ) : (
            <li className="text-muted">No PTR record</li>
          )}
        </ul>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: DeepFinding }) {
  const [expanded, setExpanded] = useState(false);
  const routeLabel = ROUTE_LABELS[finding.route] ?? finding.route;
  const skipped = Boolean((finding.data as { skipped?: boolean }).skipped);

  return (
    <article className="rounded-xl border border-accent/20 bg-accent/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent/10 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{finding.pivot.value}</p>
          <p className="text-xs text-muted mt-0.5">
            {routeLabel} · {finding.pivot.reason}
          </p>
        </div>
        <span
          className={`text-[10px] rounded px-2 py-0.5 shrink-0 ${
            finding.status === "rejected"
              ? "bg-error/10 text-error"
              : skipped
                ? "bg-foreground/5 text-muted"
                : "bg-emerald-400/10 text-emerald-400"
          }`}
        >
          {finding.status === "rejected" ? "failed" : skipped ? "skipped" : "data"}
        </span>
      </button>
      {expanded && (
        <pre className="mx-4 mb-4 p-3 rounded-lg bg-surface border border-border text-[10px] font-mono overflow-auto max-h-48">
          {JSON.stringify(finding.data, null, 2)}
        </pre>
      )}
    </article>
  );
}

export function DeepResearchPanel({ deep, loading }: DeepResearchPanelProps) {
  const { summary, enrichments, pivots, findings } = deep;

  return (
    <section className="space-y-5 rounded-2xl border border-accent/30 bg-accent/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <span aria-hidden>🔬</span> Deep Research
          </h3>
          <p className="text-xs text-muted mt-1 max-w-xl">{summary.headline}</p>
        </div>
        {loading && (
          <span className="text-xs text-accent animate-pulse">Analyzing pivots…</span>
        )}
      </div>

      {summary.insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Insights
          </h4>
          <ul className="space-y-1.5">
            {summary.insights.map((line, i) => (
              <li key={i} className="text-sm text-foreground/80 flex gap-2">
                <span className="text-accent shrink-0">•</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {enrichments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Primary enrichments
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {enrichments.map((e) => (
              <EnrichmentCard
                key={`${e.kind}-${e.target}`}
                kind={e.kind}
                label={e.label}
                target={e.target}
                data={e.data}
              />
            ))}
          </div>
        </div>
      )}

      {pivots.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Related entities ({pivots.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {pivots.map((p) => (
              <span
                key={`${p.type}-${p.value}`}
                className="inline-flex flex-col rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              >
                <span className="font-mono font-medium">{p.value}</span>
                <span className="text-muted text-[10px] mt-0.5">{p.reason}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {findings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Pivot lookups ({findings.length})
          </h4>
          <div className="grid gap-2">
            {findings.map((f, i) => (
              <FindingCard key={`${f.pivot.value}-${f.route}-${i}`} finding={f} />
            ))}
          </div>
        </div>
      )}

      {summary.suggestedNextSteps.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-surface/80 p-4 space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Suggested next steps
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/70">
            {summary.suggestedNextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
