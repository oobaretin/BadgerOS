"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPreviewUrl, isImageFile, prepareImageUpload, resetFileInput } from "@/lib/imageUpload";
import { UploadKeysBanner } from "@/components/dashboard/UploadKeysBanner";
import { isVin, normalizeVin } from "@/lib/vehicleDetect";

export interface PlateOcrCompletePayload {
  plate: string;
  country: "us" | "uk";
  ocr: Record<string, unknown>;
  vinDetails?: Record<string, unknown>;
}

interface PlateOCRUploaderProps {
  disabled?: boolean;
  variant?: "embedded" | "scanner";
  onComplete?: (payload: PlateOcrCompletePayload) => void;
  onError?: (message: string) => void;
}

interface OcrResultState {
  plate?: string;
  confidence?: number;
  region?: string;
  vehicleType?: string;
  vehicleColor?: string;
  error?: string;
  nhtsaSearch?: { Results?: Array<{ Variable?: string; Value?: string | null }> };
  vinDetails?: {
    vin?: string;
    vehicle?: Record<string, string | undefined>;
    recalls?: { Count?: number; results?: unknown[] };
    complaints?: { Count?: number; results?: unknown[] };
  };
}

type ScanPhase = "idle" | "ocr" | "vin" | "done";

function extractVinFromNhtsa(nhtsaSearch: unknown): string | null {
  const results =
    (nhtsaSearch as { Results?: Array<{ Variable?: string; Value?: string | null }> })?.Results ??
    [];

  for (const variable of ["VIN", "Suggested VIN"]) {
    const row = results.find((r) => r.Variable === variable);
    const value = row?.Value?.trim();
    if (value && isVin(value)) return normalizeVin(value);
  }

  return null;
}

function getRecallCount(vinDetails?: OcrResultState["vinDetails"]): number {
  if (!vinDetails?.recalls) return 0;
  return (
    vinDetails.recalls.Count ??
    (Array.isArray(vinDetails.recalls.results) ? vinDetails.recalls.results.length : 0)
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted uppercase tracking-wider">OCR confidence</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-border/80 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function PlateBadge({ plate, region }: { plate: string; region?: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative inline-block">
        <div className="absolute inset-0 rounded-lg bg-yellow-400/20 blur-md" aria-hidden />
        <div className="relative rounded-lg border-2 border-yellow-400/60 bg-gradient-to-b from-yellow-100 to-yellow-200 dark:from-yellow-500/25 dark:to-yellow-600/10 px-8 py-3 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-yellow-800/70 dark:text-yellow-200/60 text-center mb-1">
            {region?.toUpperCase() ?? "DETECTED"}
          </p>
          <p className="text-3xl font-mono font-black tracking-[0.15em] text-slate-900 dark:text-yellow-50 text-center">
            {plate}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PlateOCRUploader({
  disabled = false,
  variant = "scanner",
  onComplete,
  onError,
}: PlateOCRUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [country, setCountry] = useState<"us" | "uk">("us");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const setPreviewFile = useCallback((file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = createPreviewUrl(file);
    previewUrlRef.current = url;
    setPreview(url);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      let uploadFile: File;
      try {
        uploadFile = await prepareImageUpload(file);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not prepare image for upload";
        onError?.(message);
        setResult({ error: message });
        resetFileInput(inputRef.current);
        return;
      }

      setPreviewFile(uploadFile);
      setLoading(true);
      setResult(null);
      setPhase("ocr");

      try {
        const form = new FormData();
        form.append("image", uploadFile);
        form.append("country", country);

        const ocrRes = await fetch("/api/plate/ocr", { method: "POST", body: form });
        const ocrData = (await ocrRes.json()) as OcrResultState & Record<string, unknown>;

        if (!ocrRes.ok || ocrData.error) {
          const message = String(ocrData.error ?? "Plate OCR failed");
          onError?.(message);
          setResult({ error: message });
          setPhase("idle");
          return;
        }

        let merged: OcrResultState = { ...ocrData };
        const vin = extractVinFromNhtsa(ocrData.nhtsaSearch);

        if (vin) {
          setPhase("vin");
          const vinRes = await fetch("/api/vin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vin }),
          });
          const vinData = (await vinRes.json()) as OcrResultState["vinDetails"] &
            Record<string, unknown>;

          if (vinRes.ok && !vinData.error && !(vinData as { skipped?: boolean }).skipped) {
            merged = {
              ...merged,
              vinDetails: { ...vinData, vin } as OcrResultState["vinDetails"],
            };
          }
        }

        setResult(merged);
        setPhase("done");

        if (ocrData.plate) {
          onComplete?.({
            plate: String(ocrData.plate),
            country,
            ocr: ocrData as Record<string, unknown>,
            vinDetails: merged.vinDetails as Record<string, unknown> | undefined,
          });
        }
      } catch {
        const message = "Network error — plate OCR failed";
        onError?.(message);
        setResult({ error: message });
        setPhase("idle");
      } finally {
        setLoading(false);
        resetFileInput(inputRef.current);
      }
    },
    [country, onComplete, onError, setPreviewFile]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled || loading) return;
    const file = e.dataTransfer.files[0];
    if (file && isImageFile(file)) handleFile(file);
  };

  const recallCount = getRecallCount(result?.vinDetails);
  const isScanner = variant === "scanner";

  return (
    <div
      className={
        isScanner
          ? "space-y-6"
          : "rounded-xl border border-orange-400/30 bg-orange-400/5 p-4 space-y-4"
      }
    >
      <UploadKeysBanner keys={["PLATE_RECOGNIZER_KEY"]} />
      {!isScanner && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/90">
            Plate photo OCR
          </p>
          <p className="text-xs text-muted mt-1">
            Drop a plate photo — Plate Recognizer OCR, NHTSA vanity decode, UK DVLA, and auto VIN lookup
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setCountry("us")}
          className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
            country === "us"
              ? "border-orange-400/60 bg-orange-400/20 text-orange-300"
              : "border-border bg-surface text-muted hover:border-orange-400/30"
          }`}
        >
          US Plates
        </button>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setCountry("uk")}
          className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
            country === "uk"
              ? "border-orange-400/60 bg-orange-400/20 text-orange-300"
              : "border-border bg-surface text-muted hover:border-orange-400/30"
          }`}
        >
          UK Plates
        </button>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !loading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onClick={() => !disabled && !loading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
          dragActive
            ? "border-orange-400 bg-orange-400/10 scale-[1.01]"
            : "border-border hover:border-orange-400/40 hover:bg-orange-400/5"
        } ${disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {preview ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              className={`mx-auto rounded-xl object-contain shadow-lg transition-all ${
                isScanner ? "max-h-72 w-full" : "max-h-48"
              }`}
              alt="Live plate preview"
            />
            {!loading && (
              <p className="text-xs text-muted">Click or drop to replace image</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-400/10 border border-orange-400/30 flex items-center justify-center text-2xl">
              📷
            </div>
            <p className="text-sm font-medium">Drop a plate photo here</p>
            <p className="text-xs text-muted">or click to browse · JPEG, PNG, WebP · max 10 MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            resetFileInput(e.target);
          }}
        />
      </div>

      {loading && (
        <div className="rounded-xl border border-orange-400/30 bg-orange-400/5 px-4 py-3 space-y-2">
          <p className="text-sm text-orange-400 animate-pulse text-center font-medium">
            {phase === "ocr" && "Running Plate Recognizer OCR…"}
            {phase === "vin" && "Auto-chaining VIN decode + recall lookup…"}
          </p>
          <div className="flex justify-center gap-2 text-[10px] text-muted uppercase tracking-wider">
            <span className={phase === "ocr" ? "text-orange-400 font-semibold" : ""}>OCR</span>
            <span>→</span>
            <span className={phase === "vin" ? "text-orange-400 font-semibold" : ""}>VIN</span>
            <span>→</span>
            <span className={phase === "done" ? "text-orange-400 font-semibold" : ""}>Recalls</span>
          </div>
        </div>
      )}

      {result?.error && !loading && (
        <p className="text-sm text-error/90 rounded-xl border border-error/30 bg-error/10 px-4 py-3">
          {result.error}
        </p>
      )}

      {result?.plate && !loading && !result.error && (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">
          <PlateBadge plate={result.plate} region={result.region} />

          {result.confidence != null && <ConfidenceBar value={result.confidence} />}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-surface-elevated/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted">Type</p>
              <p className="font-medium mt-0.5">{result.vehicleType ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-elevated/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted">Color</p>
              <p className="font-medium mt-0.5">{result.vehicleColor ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-elevated/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted">Region</p>
              <p className="font-medium mt-0.5 uppercase">{result.region ?? country}</p>
            </div>
            <div
              className={`rounded-lg border px-3 py-2 ${
                recallCount > 0
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-border bg-surface-elevated/50"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted">Recalls</p>
              <p
                className={`font-semibold mt-0.5 ${
                  recallCount > 0 ? "text-red-500" : "text-foreground"
                }`}
              >
                {result.vinDetails
                  ? recallCount > 0
                    ? `${recallCount} open`
                    : "None found"
                  : "No VIN linked"}
              </p>
            </div>
          </div>

          {result.vinDetails?.vehicle && (
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                NHTSA VIN decode
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {Object.entries(result.vinDetails.vehicle)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <div key={key}>
                      <span className="text-muted capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {recallCount > 0 && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-red-500">
                {recallCount} open recall{recallCount !== 1 ? "s" : ""} — review NHTSA data below
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
