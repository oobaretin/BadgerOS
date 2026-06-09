"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  detectInputType,
  INPUT_TYPE_COLORS,
  INPUT_TYPE_LABELS,
  type InputType,
  type ReconResponse,
} from "@/lib/detect";
import type { DeepReconResponse } from "@/lib/deepResearch/types";
import { getActiveRoutes, fetchReconProgressive, fetchDeepResearchProgressive } from "@/lib/reconClient";
import { downloadReconCsv, downloadReconJson } from "@/lib/export";
import { ResultsPanel } from "@/components/ResultsPanel";
import { DeepResearchPanel } from "@/components/DeepResearchPanel";
import {
  SearchHistorySidebar,
  saveSearchHistory,
} from "@/components/SearchHistorySidebar";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SavedReportsPanel } from "@/components/SavedReportsPanel";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { TypeBadge } from "@/components/dashboard/TypeBadge";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { DashboardTabs, type DashboardTab } from "@/components/dashboard/DashboardTabs";
import { PlateOCRUploader, type PlateOcrCompletePayload } from "@/components/dashboard/PlateOCRUploader";
import { FaceReconUploader } from "@/components/dashboard/FaceReconUploader";
import { ReverseImageSearch } from "@/components/dashboard/ReverseImageSearch";
import { SkeletonCard } from "@/components/dashboard/SkeletonCard";
import { EXAMPLES, MODULES } from "@/components/dashboard/constants";
import { isUkPlate, isVin } from "@/lib/vehicleDetect";
import type { ReconSearchOptions } from "@/lib/reconClient";

type Theme = "dark" | "light";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [detectedType, setDetectedType] = useState<InputType | null>(null);
  const [result, setResult] = useState<DeepReconResponse | null>(null);
  const [pendingRoutes, setPendingRoutes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [runAll, setRunAll] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [vinInput, setVinInput] = useState("");
  const [ukPlate, setUkPlate] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("recon");
  const [scannerError, setScannerError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("badger-theme") as Theme | null;
    const initial = stored ?? "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("badger-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    const type = value.trim() ? detectInputType(value) : null;
    setDetectedType(type);
    if (type === "plate") {
      const normalized = value.replace(/\s/g, "").toUpperCase();
      if (isUkPlate(normalized) && !isVin(normalized)) {
        setUkPlate(true);
      }
    }
    setError(null);
  }, []);

  const buildSearchOptions = useCallback((): ReconSearchOptions => {
    const type = detectInputType(query.trim());
    if (type !== "plate") return {};
    const vin = vinInput.trim();
    return {
      ukPlate,
      vin: vin && isVin(vin) ? vin : undefined,
    };
  }, [query, vinInput, ukPlate]);

  const runSearch = useCallback(
    async (rawQuery: string, cached?: ReconResponse, options?: ReconSearchOptions) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) {
        setError("Enter an email, IP, domain, phone, plate/VIN, or username");
        return;
      }

      const type = detectInputType(trimmed);
      if (type === "unknown") {
        setError("Could not detect input type");
        return;
      }

      if (cached) {
        setResult(cached);
        setDetectedType(cached.type);
        setPendingRoutes([]);
        setLoading(false);
        setError(null);
        return;
      }

      const routes = getActiveRoutes(type, runAll);
      setLoading(true);
      setError(null);
      setResult({ type, query: trimmed, results: [] });
      setPendingRoutes(routes);
      setHistoryOpen(false);

      try {
        const searchOpts = options ?? buildSearchOptions();
        const fetcher = deepResearch ? fetchDeepResearchProgressive : fetchReconProgressive;
        const finalResult = await fetcher(trimmed, runAll, (partial) => {
          const update = partial as DeepReconResponse;
          setResult(update);
          setPendingRoutes((prev) =>
            prev.filter((r) => !update.results.some((x) => x.source === r))
          );
          setDeepLoading(deepResearch && !update.deep);
        }, searchOpts);
        setResult(finalResult);
        setDetectedType(finalResult.type);
        saveSearchHistory(trimmed, finalResult.type, finalResult);
        if (finalResult.reportId) {
          window.dispatchEvent(new Event("badger-reports-updated"));
        }
      } catch {
        setError("Network error — please try again");
      } finally {
        setLoading(false);
        setDeepLoading(false);
        setPendingRoutes([]);
      }
    },
    [runAll, deepResearch, buildSearchOptions]
  );

  const handleSearch = useCallback(
    async (overrideQuery?: string) => {
      const trimmed = (overrideQuery ?? query).trim();
      if (overrideQuery) {
        setQuery(overrideQuery);
        setDetectedType(detectInputType(overrideQuery));
      }
      await runSearch(trimmed);
    },
    [query, runSearch]
  );

  const handleHistorySelect = useCallback(
    (value: string, cached?: ReconResponse) => {
      handleQueryChange(value);
      setHistoryOpen(false);
      if (cached) {
        setResult(cached);
        setDetectedType(cached.type);
        setPendingRoutes([]);
        setLoading(false);
        setError(null);
        return;
      }
      runSearch(value);
    },
    [handleQueryChange, runSearch]
  );

  const activeRouteCount = useMemo(() => {
    if (!detectedType || detectedType === "unknown") return 0;
    return getActiveRoutes(detectedType, runAll).length;
  }, [detectedType, runAll]);

  const handlePlateOcrComplete = useCallback(
    (payload: PlateOcrCompletePayload) => {
      const { plate, country, ocr, vinDetails } = payload;
      setError(null);
      setScannerError(null);
      setHistoryOpen(false);
      handleQueryChange(plate);
      if (country === "uk") setUkPlate(true);

      const results: DeepReconResponse["results"] = [
        {
          source: "/api/plate",
          status: "fulfilled",
          data: { ...ocr, vinDetails },
        },
      ];

      if (vinDetails) {
        results.push({
          source: "/api/vin",
          status: "fulfilled",
          data: vinDetails,
        });
      }

      const ocrResult: DeepReconResponse = {
        type: "plate",
        query: plate,
        results,
      };

      setResult(ocrResult);
      setDetectedType("plate");
      saveSearchHistory(plate, "plate", ocrResult);
    },
    [handleQueryChange]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className={`sticky top-0 z-20 border-b border-border/80 bg-surface/90 backdrop-blur-md transition-[padding] ${
          historyOpen ? "lg:pl-72" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-lg">
              🦡
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">BadgerOS</h1>
              <p className="text-xs text-muted">Unified OSINT Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SearchHistorySidebar
              open={historyOpen}
              onToggle={() => setHistoryOpen((v) => !v)}
              onSelect={handleHistorySelect}
              currentQuery={result?.query ?? query}
            />
            <SavedReportsPanel
              open={reportsOpen}
              onToggle={() => setReportsOpen((v) => !v)}
              onSelect={(q) => handleSearch(q)}
            />
            <SettingsPanel open={settingsOpen} onToggle={() => setSettingsOpen((v) => !v)} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main
        className={`flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-10 transition-[margin] ${
          historyOpen ? "lg:ml-72 lg:max-w-[calc(48rem+18rem)]" : ""
        }`}
      >
        <DashboardTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === "recon" && (
          <>
        <section className="space-y-6">
          <div className="text-center space-y-2 pt-2">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Intelligence Recon</h2>
            <p className="text-muted text-sm max-w-lg mx-auto">
              Auto-detects your target and runs OSINT modules in parallel. Enable deep research to pivot into related domains, DNS, and infrastructure.
            </p>
          </div>

          <SearchInput
            query={query}
            detectedType={detectedType}
            loading={loading}
            vin={vinInput}
            ukPlate={ukPlate}
            onQueryChange={handleQueryChange}
            onVinChange={setVinInput}
            onUkPlateChange={setUkPlate}
            onSearch={() => handleSearch()}
          />

          <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            <label className="flex items-center justify-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={runAll}
                onChange={(e) => setRunAll(e.target.checked)}
                className="rounded border-border accent-accent"
              />
              Run all 8 modules (ignore smart routing)
            </label>
            <label className="flex items-center justify-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={deepResearch}
                onChange={(e) => setDeepResearch(e.target.checked)}
                className="rounded border-border accent-accent"
              />
              Deep research — pivot to related entities, DNS enrichments, and follow-up lookups
            </label>
          </div>

          {error && (
            <div className="max-w-2xl mx-auto rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">OSINT Modules</h3>
            <p className="text-xs text-muted/70 mt-1">
              {detectedType && detectedType !== "unknown"
                ? `${activeRouteCount} module${activeRouteCount !== 1 ? "s" : ""} will run${runAll ? " (all enabled)" : ` for ${INPUT_TYPE_LABELS[detectedType]}`}`
                : "Start typing to see detected input type"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((mod) => {
              const activeRoutes =
                detectedType && detectedType !== "unknown"
                  ? getActiveRoutes(detectedType, runAll)
                  : [];
              const willRun = runAll || activeRoutes.includes(mod.route);

              return (
                <div
                  key={mod.route}
                  className={`relative rounded-2xl border p-5 transition-all duration-200 ${
                    willRun && query.trim()
                      ? "border-accent/50 bg-accent/5 shadow-md shadow-accent/5"
                      : "border-border bg-surface opacity-70"
                  }`}
                >
                  {loading && willRun && (
                    <span className="absolute top-3 right-3 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{mod.icon}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{mod.name}</p>
                      <p className="text-xs text-muted mt-0.5 leading-relaxed">{mod.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {mod.types.map((t) => (
                      <span key={t} className={`text-[10px] rounded px-1.5 py-0.5 border ${INPUT_TYPE_COLORS[t]}`}>
                        {INPUT_TYPE_LABELS[t]}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {!result && !loading && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(["email", "ip", "domain", "phone", "plate", "username"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleQueryChange(EXAMPLES[type])}
                className={`rounded-xl border p-3 text-left hover:border-accent/40 transition-colors ${INPUT_TYPE_COLORS[type]}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  {INPUT_TYPE_LABELS[type]}
                </p>
                <p className="text-xs font-mono opacity-60 mt-1">{EXAMPLES[type]}</p>
              </button>
            ))}
          </section>
        )}

        {loading && !result?.results.length && (
          <section className="grid grid-cols-1 gap-4">
            {Array.from({ length: activeRouteCount || 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </section>
        )}

        {result && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 pb-1 border-b border-border">
              <TypeBadge type={result.type} />
              <span className="font-mono text-sm text-muted">{result.query}</span>
              {result.reportId && (
                <span className="text-[10px] rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 px-2 py-0.5">
                  Saved
                </span>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => downloadReconCsv(result)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground hover:border-accent/40 transition-colors disabled:opacity-40"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadReconJson(result)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground hover:border-accent/40 transition-colors disabled:opacity-40"
                >
                  Export JSON
                </button>
              </div>
            </div>
            <ResultsPanel
              response={result}
              loading={loading && !deepLoading}
              pendingRoutes={pendingRoutes}
              expandPrimary
            />
            {deepLoading && (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 text-sm text-muted animate-pulse">
                Deep research in progress — extracting pivots and running secondary lookups…
              </div>
            )}
            {result.deep && (
              <DeepResearchPanel deep={result.deep} loading={deepLoading} />
            )}
          </section>
        )}
          </>
        )}

        {activeTab === "scanner" && (
          <section className="space-y-8 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Plate Scanner</h2>
              <p className="text-muted text-sm max-w-lg mx-auto">
                Upload a plate photo for OCR, then auto-chain NHTSA VIN decode and recall lookup.
              </p>
            </div>

            <PlateOCRUploader
              variant="scanner"
              onComplete={handlePlateOcrComplete}
              onError={setScannerError}
            />

            {scannerError && (
              <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
                {scannerError}
              </div>
            )}

            {result && result.type === "plate" && (
              <div className="space-y-5 pt-4 border-t border-border">
                <div className="flex flex-wrap items-center gap-3">
                  <TypeBadge type="plate" />
                  <span className="font-mono text-sm text-muted">{result.query}</span>
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => downloadReconCsv(result)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground hover:border-accent/40 transition-colors"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadReconJson(result)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground hover:border-accent/40 transition-colors"
                    >
                      Export JSON
                    </button>
                  </div>
                </div>
                <ResultsPanel response={result} expandPrimary />
              </div>
            )}
          </section>
        )}

        {activeTab === "face" && (
          <section className="space-y-8 max-w-4xl mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Face & Image</h2>
              <p className="text-muted text-sm max-w-xl mx-auto">
                Photo upload triggers DeepFace (local), imgbb public URL, SerpApi Google, Bing Visual,
                TinEye, and auto-opens manual OSINT links — all in parallel.
              </p>
            </div>

            <FaceReconUploader />

            <p className="text-center text-xs text-muted">
              <code className="font-mono text-violet-400/80">npm run dev</code> starts Next.js + face server ·
              File uploads need <code className="font-mono text-cyan-400/80">IMGBB_KEY</code> for public URLs
            </p>
          </section>
        )}

        {activeTab === "reverse" && (
          <section className="space-y-8 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Reverse Image Search</h2>
              <p className="text-muted text-sm max-w-lg mx-auto">
                SerpApi Google Reverse Image, Bing Visual Search, TinEye, plus manual OSINT links.
              </p>
            </div>

            <ReverseImageSearch />
          </section>
        )}
      </main>

      <footer className={`border-t border-border py-6 mt-auto ${historyOpen ? "lg:ml-72" : ""}`}>
        <p className="text-center text-xs text-muted">BadgerOS · For authorized security research only</p>
      </footer>
    </div>
  );
}
