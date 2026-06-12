"use client";

import {
  INPUT_TYPE_COLORS,
  INPUT_TYPE_LABELS,
  type InputType,
} from "@/lib/detect";
import { isUkPlate, isVin } from "@/lib/vehicleDetect";
import { TypeBadge } from "./TypeBadge";

const INPUT_RING: Partial<Record<InputType, string>> = {
  phone: "border-rose-400/40 focus-within:border-rose-400/60 focus-within:ring-rose-400/25",
  plate: "border-orange-400/40 focus-within:border-orange-400/60 focus-within:ring-orange-400/25",
  email: "border-purple-400/30 focus-within:border-purple-400/50 focus-within:ring-purple-400/20",
  ip: "border-cyan-400/30 focus-within:border-cyan-400/50 focus-within:ring-cyan-400/20",
  domain: "border-emerald-400/30 focus-within:border-emerald-400/50 focus-within:ring-emerald-400/20",
  username: "border-amber-400/30 focus-within:border-amber-400/50 focus-within:ring-amber-400/20",
};

interface SearchInputProps {
  query: string;
  detectedType: InputType | null;
  loading: boolean;
  vin: string;
  ukPlate: boolean;
  onQueryChange: (value: string) => void;
  onVinChange: (value: string) => void;
  onUkPlateChange: (value: boolean) => void;
  onSearch: () => void;
}

export function SearchInput({
  query,
  detectedType,
  loading,
  vin,
  ukPlate,
  onQueryChange,
  onVinChange,
  onUkPlateChange,
  onSearch,
}: SearchInputProps) {
  const showPlateOptions =
    detectedType === "plate" && query.trim() && !isVin(query.replace(/\s/g, ""));

  const ringClass =
    detectedType && detectedType !== "unknown"
      ? (INPUT_RING[detectedType] ?? "focus-within:border-accent/50 focus-within:ring-accent/20")
      : "focus-within:border-accent/50 focus-within:ring-accent/20";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) onSearch();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div
        className={`flex items-center rounded-2xl border bg-surface shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden focus-within:ring-2 transition-all ${ringClass}`}
      >
        <div className="pl-4 text-muted shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Email, IP, domain, phone, plate/VIN, or username…"
          disabled={loading}
          autoFocus
          className="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-muted/60"
        />
        {detectedType && query.trim() && (
          <div className="pr-2 shrink-0">
            <TypeBadge type={detectedType} />
          </div>
        )}
        <button
          type="button"
          onClick={onSearch}
          disabled={loading || !query.trim()}
          className="m-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-muted disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shrink-0"
        >
          {loading ? "Scanning…" : "Recon"}
        </button>
      </div>

      {detectedType && query.trim() && detectedType !== "unknown" && (
        <div className="flex flex-wrap justify-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${INPUT_TYPE_COLORS[detectedType]}`}
          >
            Detected: {INPUT_TYPE_LABELS[detectedType]}
          </span>
        </div>
      )}

      {showPlateOptions && (
        <div className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/90">
            Plate options
          </p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={ukPlate}
              onChange={(e) => onUkPlateChange(e.target.checked)}
              className="rounded border-border accent-orange-500"
            />
            UK plate — query DVLA vehicle enquiry
            {isUkPlate(query) && (
              <span className="text-[10px] text-muted">(auto-detected format)</span>
            )}
          </label>
          <div className="space-y-1.5">
            <label htmlFor="vin-input" className="text-xs text-muted">
              Optional VIN (17 characters) for NHTSA decode &amp; recalls
            </label>
            <input
              id="vin-input"
              type="text"
              value={vin}
              onChange={(e) => onVinChange(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 5YJSA1E14HF000001"
              maxLength={17}
              disabled={loading}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-mono outline-none focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/20"
            />
            {vin.trim() && !isVin(vin) && (
              <p className="text-xs text-amber-500">VIN must be exactly 17 characters (no I, O, or Q)</p>
            )}
          </div>
        </div>
      )}

      {detectedType === "phone" && query.trim() && (
        <p className="text-center text-xs text-rose-400/80">
          Phone lookup via NumLookup — carrier, line type, country, validity
        </p>
      )}
    </div>
  );
}
