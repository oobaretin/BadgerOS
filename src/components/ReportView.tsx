"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReconResponse } from "@/lib/detect";
import { buildGraph, mergeGraphData } from "@/lib/graph-builder";
import { buildReportFromRecon } from "@/lib/buildReport";
import { ResultsPanel } from "@/components/ResultsPanel";
import { RelationshipGraph } from "@/components/RelationshipGraph";

type ReportTab = "modules" | "graph";

const RISK_STYLES: Record<string, string> = {
  high: "text-error bg-error/10 border-error/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

interface Props {
  response: ReconResponse;
  loading?: boolean;
  pendingRoutes?: string[];
  expandPrimary?: boolean;
  onPivotSearch: (label: string) => Promise<void>;
}

export function ReportView({
  response,
  loading = false,
  pendingRoutes = [],
  expandPrimary = true,
  onPivotSearch,
}: Props) {
  const [tab, setTab] = useState<ReportTab>("modules");
  const [mergedGraph, setMergedGraph] = useState(() =>
    buildGraph(buildReportFromRecon(response))
  );
  const [pivotLoading, setPivotLoading] = useState(false);
  const pivotPendingRef = useRef(false);
  const lastQueryRef = useRef(response.query);

  const activeReport = useMemo(() => buildReportFromRecon(response), [response]);

  useEffect(() => {
    const nextGraph = buildGraph(activeReport);
    const pivotPending = pivotPendingRef.current;
    const queryChanged = lastQueryRef.current !== activeReport.query;
    if (pivotPending) {
      setMergedGraph((prev) => mergeGraphData(prev, nextGraph));
      pivotPendingRef.current = false;
      setPivotLoading(false);
    } else {
      setMergedGraph(nextGraph);
      if (queryChanged) {
        setTab("modules");
        lastQueryRef.current = activeReport.query;
      }
    }
  }, [activeReport]);

  const handleNodeClick = useCallback(
    async (node: { type: string; label: string }) => {
      if (node.type === activeReport.query_type || pivotLoading) return;
      pivotPendingRef.current = true;
      setPivotLoading(true);
      setTab("graph");
      try {
        await onPivotSearch(node.label);
      } catch {
        pivotPendingRef.current = false;
        setPivotLoading(false);
      }
    },
    [activeReport.query_type, onPivotSearch, pivotLoading]
  );

  const nodeCount = mergedGraph.nodes.length;
  const edgeCount = mergedGraph.edges.length;
  const graphTabLabel = `Graph (${nodeCount} · ${edgeCount})`;

  const headline =
    typeof activeReport.summary?.headline === "string" ? activeReport.summary.headline : null;
  const risk = activeReport.risk_score ?? "low";

  return (
    <div className="space-y-4">
      {headline && (
        <div className="rounded-xl border border-border bg-surface-elevated/60 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-foreground/80">{headline}</p>
          <span
            className={`text-[10px] px-2 py-0.5 rounded border capitalize ${RISK_STYLES[risk] ?? RISK_STYLES.low}`}
          >
            {risk} risk
          </span>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-border bg-surface-elevated p-1">
        <button
          type="button"
          onClick={() => setTab("modules")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            tab === "modules"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Modules
        </button>
        <button
          type="button"
          onClick={() => setTab("graph")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            tab === "graph"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {graphTabLabel}
        </button>
      </div>

      {tab === "modules" ? (
        <ResultsPanel
          response={response}
          loading={loading}
          pendingRoutes={pendingRoutes}
          expandPrimary={expandPrimary}
        />
      ) : mergedGraph.nodes.length <= 1 ? (
        <p className="text-sm text-muted rounded-xl border border-border bg-surface p-4">
          Not enough related entities to display a graph yet. Run more modules or pivot from a richer
          result.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          {pivotLoading && (
            <p className="text-xs text-accent animate-pulse">Expanding graph from pivot search…</p>
          )}
          <RelationshipGraph data={mergedGraph} onNodeClick={handleNodeClick} />
        </div>
      )}
    </div>
  );
}
