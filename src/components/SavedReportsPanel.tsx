"use client";

import { useCallback, useEffect, useState } from "react";
import { INPUT_TYPE_COLORS, INPUT_TYPE_LABELS, type InputType } from "@/lib/detect";

interface SavedReport {
  id: string;
  created_at: string;
  query: string;
  query_type: string;
  risk_score: string | null;
  tags: string[];
  summary: { headline?: string; counts?: { found?: number; warning?: number } };
}

const RISK_STYLES: Record<string, string> = {
  high: "text-error bg-error/10 border-error/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

export function SavedReportsPanel({
  open,
  onToggle,
  onSelect,
}: {
  open: boolean;
  onToggle: () => void;
  onSelect: (query: string) => void;
}) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(() => {
    setLoading(true);
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    loadReports();
  }, [open, loadReports]);

  useEffect(() => {
    const refresh = () => loadReports();
    window.addEventListener("badger-reports-updated", refresh);
    return () => window.removeEventListener("badger-reports-updated", refresh);
  }, [loadReports]);

  const deleteReport = async (id: string) => {
    await fetch("/api/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close saved reports" : "Open saved reports"}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:border-accent/40 transition-colors"
      >
        <span aria-hidden>📋</span>
        Reports
        {reports.length > 0 && (
          <span className="text-[10px] rounded-full bg-accent/20 text-accent px-1.5 py-0.5 font-medium">
            {reports.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={onToggle} aria-hidden />
          <aside className="fixed top-0 right-0 z-40 h-full w-80 border-l border-border bg-surface shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold">Saved Reports</h2>
                <p className="text-xs text-muted">SQLite · recon.db</p>
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="rounded-lg p-2 text-muted hover:text-foreground hover:bg-surface-elevated"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading && <p className="text-xs text-muted text-center py-8">Loading…</p>}
              {!loading && reports.length === 0 && (
                <p className="text-xs text-muted text-center py-8">
                  No reports yet — run a recon search to save one.
                </p>
              )}
              {reports.map((report) => {
                const type = report.query_type as InputType;
                const risk = report.risk_score ?? "low";
                return (
                  <div
                    key={report.id}
                    className="rounded-xl border border-border bg-surface-elevated/40 p-3 space-y-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(report.query);
                        onToggle();
                      }}
                      className="w-full text-left space-y-1"
                    >
                      <p className="font-mono text-sm truncate">{report.query}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${INPUT_TYPE_COLORS[type] ?? INPUT_TYPE_COLORS.unknown}`}
                        >
                          {INPUT_TYPE_LABELS[type] ?? report.query_type}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${RISK_STYLES[risk] ?? RISK_STYLES.low}`}
                        >
                          {risk}
                        </span>
                      </div>
                      {report.summary?.headline && (
                        <p className="text-xs text-muted line-clamp-2">{report.summary.headline}</p>
                      )}
                      <p className="text-[10px] text-muted">
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReport(report.id)}
                      className="text-[10px] text-muted hover:text-error"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
