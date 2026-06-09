"use client";

import { useEffect, useState } from "react";

interface KeyStatus {
  key: string;
  label: string;
  module: string;
  configured: boolean;
}

export function SettingsPanel({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setKeys(d.keys ?? []))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false));
  }, [open]);

  const configured = keys.filter((k) => k.configured).length;

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close settings" : "Open API key settings"}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:border-accent/40 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Keys
        {keys.length > 0 && (
          <span className="text-[10px] rounded-full bg-accent/20 text-accent px-1.5 py-0.5 font-medium">
            {configured}/{keys.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={onToggle} aria-hidden />
          <aside className="fixed top-0 right-0 z-40 h-full w-80 border-l border-border bg-surface shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold">API Keys</h2>
                <p className="text-[10px] text-muted mt-0.5">Set in .env.local — values never shown here</p>
              </div>
              <button type="button" onClick={onToggle} className="rounded-lg p-1.5 text-muted hover:text-foreground">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <p className="text-xs text-muted text-center py-8">Loading…</p>
              ) : (
                keys.map((k) => (
                  <div key={k.key} className="rounded-xl border border-border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{k.label}</p>
                      <span
                        className={`text-[10px] rounded-full px-2 py-0.5 ${
                          k.configured
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-foreground/5 text-muted"
                        }`}
                      >
                        {k.configured ? "Configured" : "Missing"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted mt-1">{k.module}</p>
                    <p className="text-[10px] font-mono text-muted/60 mt-0.5">{k.key}</p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
