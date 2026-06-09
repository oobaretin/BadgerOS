"use client";

import type { InputType } from "@/lib/detect";
import { TypeBadge } from "./TypeBadge";

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  loading: boolean;
  detectedType: InputType | null;
}

export function SearchBar({
  query,
  onQueryChange,
  onSearch,
  loading,
  detectedType,
}: SearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) onSearch();
  };

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="flex items-center rounded-xl border border-border bg-surface-elevated shadow-lg shadow-black/20 overflow-hidden focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30 transition-all">
        <div className="pl-4 text-foreground/40">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter email, IP, domain, or username…"
          className="flex-1 bg-transparent px-3 py-4 text-sm outline-none placeholder:text-foreground/30"
          disabled={loading}
          autoFocus
        />

        {detectedType && query.trim() && (
          <div className="pr-2 hidden sm:block">
            <TypeBadge type={detectedType} />
          </div>
        )}

        <button
          onClick={onSearch}
          disabled={loading || !query.trim()}
          className="mr-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent-muted disabled:opacity-40 disabled:cursor-not-allowed text-background text-sm font-medium transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Scanning
            </span>
          ) : (
            "Search"
          )}
        </button>
      </div>

      {detectedType && query.trim() && (
        <p className="mt-2 text-xs text-foreground/40 text-center sm:hidden">
          Detected: {detectedType}
        </p>
      )}
    </div>
  );
}
