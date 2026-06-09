"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { InputType, ReconResponse } from "@/lib/detect";
import { INPUT_TYPE_COLORS, INPUT_TYPE_LABELS } from "@/lib/detect";
import { getSourceStatus, STATUS_META } from "@/lib/sourceStatus";

const STORAGE_KEY = "badger-history";
const LEGACY_STORAGE_KEY = "recon-history";
const MAX_ENTRIES = 30;

export interface HistoryEntry {
  id: string;
  query: string;
  type: InputType;
  timestamp: string;
  summary?: { found: number; clean: number; warning: number };
  result?: ReconResponse;
}

interface SearchHistorySidebarProps {
  open: boolean;
  onToggle: () => void;
  onSelect: (query: string, cached?: ReconResponse) => void;
  currentQuery?: string;
}

function migrateLegacyHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return [];
    const parsed = JSON.parse(legacy) as HistoryEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.slice(0, MAX_ENTRIES)));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return parsed;
  } catch {
    return [];
  }
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacyHistory();
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistHistory(entries: HistoryEntry[]) {
  const slim = entries.map(({ result, ...rest }) => rest);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    window.dispatchEvent(new Event("badger-history-updated"));
    return true;
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim.slice(0, 10)));
      window.dispatchEvent(new Event("badger-history-updated"));
      return true;
    } catch {
      return false;
    }
  }
}

function summarizeResult(result: ReconResponse) {
  return result.results.reduce(
    (acc, r) => {
      acc[getSourceStatus(r)] += 1;
      return acc;
    },
    { found: 0, clean: 0, warning: 0 }
  );
}

export function saveSearchHistory(query: string, type: InputType, result?: ReconResponse) {
  const trimmed = query.trim();
  if (!trimmed) return;

  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query: trimmed,
    type,
    timestamp: new Date().toISOString(),
    summary: result ? summarizeResult(result) : undefined,
  };

  const prev = loadHistory().filter(
    (h) => h.query.toLowerCase() !== trimmed.toLowerCase()
  );
  persistHistory([entry, ...prev].slice(0, MAX_ENTRIES));
}

export function SearchHistorySidebar({
  open,
  onToggle,
  onSelect,
  currentQuery,
}: SearchHistorySidebarProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("badger-history-updated", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("badger-history-updated", refresh);
    };
  }, [refresh, open]);

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  };

  const deleteEntry = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    persistHistory(next);
    setHistory(next);
  };

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const handleSelect = (entry: HistoryEntry) => {
    onSelect(entry.query, entry.result);
  };

  const panel =
    open && mounted
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 lg:bg-black/20"
              onClick={onToggle}
              aria-hidden
            />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface shadow-xl">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-4">
                <div>
                  <h2 className="text-sm font-semibold">Search History</h2>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {history.length} search{history.length !== 1 ? "es" : ""} stored locally
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggle}
                  className="rounded-lg p-1.5 text-muted hover:bg-border/50 hover:text-foreground"
                  aria-label="Close sidebar"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
                    <p className="text-sm text-foreground/70">No searches yet</p>
                    <p className="text-xs text-muted">
                      Run a recon — completed searches appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {history.map((entry) => {
                      const isActive =
                        currentQuery?.toLowerCase() === entry.query.toLowerCase();
                      return (
                        <li key={entry.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => handleSelect(entry)}
                            className={`w-full rounded-xl border px-3 py-2.5 pr-8 text-left transition-colors ${
                              isActive
                                ? "border-accent/50 bg-accent/5"
                                : "border-border/60 bg-surface-elevated/40 hover:border-accent/30 hover:bg-surface-elevated"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={`rounded border px-1.5 py-0.5 text-[10px] ${INPUT_TYPE_COLORS[entry.type]}`}
                              >
                                {INPUT_TYPE_LABELS[entry.type]}
                              </span>
                              <span className="ml-auto text-[10px] text-muted">
                                {formatTime(entry.timestamp)}
                              </span>
                            </div>
                            <p className="truncate font-mono text-xs text-foreground">
                              {entry.query}
                            </p>
                            {entry.summary && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {(["found", "clean", "warning"] as const).map((k) =>
                                  entry.summary![k] > 0 ? (
                                    <span
                                      key={k}
                                      className={`rounded border px-1 py-0.5 text-[9px] ${STATUS_META[k].badge}`}
                                    >
                                      {entry.summary![k]} {STATUS_META[k].label.toLowerCase()}
                                    </span>
                                  ) : null
                                )}
                              </div>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry.id)}
                            className="absolute right-2 top-2 text-xs text-muted opacity-0 hover:text-error group-hover:opacity-100"
                            aria-label="Delete entry"
                          >
                            ✕
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {history.length > 0 && (
                <div className="shrink-0 border-t border-border p-3">
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="w-full rounded-lg border border-border px-3 py-2 text-xs text-muted transition-colors hover:border-error/30 hover:text-error"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </aside>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close search history" : "Open search history"}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground/70 transition-colors hover:border-accent/40 hover:text-foreground"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        History
        {history.length > 0 && (
          <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {history.length}
          </span>
        )}
      </button>
      {panel}
    </>
  );
}
