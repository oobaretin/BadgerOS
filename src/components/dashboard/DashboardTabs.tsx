"use client";

type DashboardTab = "recon" | "scanner" | "face" | "reverse";

interface DashboardTabsProps {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: "recon", label: "Intelligence Recon", icon: "🔍" },
  { id: "scanner", label: "Plate Scanner", icon: "🚗" },
  { id: "face", label: "Face & Image", icon: "🧑" },
  { id: "reverse", label: "Reverse Image", icon: "🖼️" },
];

const TAB_STYLES: Record<DashboardTab, string> = {
  recon: "bg-accent/15 text-accent border-accent/30",
  scanner: "bg-orange-400/15 text-orange-400 border-orange-400/30",
  face: "bg-violet-400/15 text-violet-400 border-violet-400/30",
  reverse: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30",
};

export function DashboardTabs({ active, onChange }: DashboardTabsProps) {
  return (
    <div className="flex justify-center overflow-x-auto pb-1">
      <div
        role="tablist"
        aria-label="Dashboard mode"
        className="inline-flex gap-1 p-1 rounded-2xl border border-border bg-surface shadow-sm"
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap border ${
                selected
                  ? `${TAB_STYLES[tab.id]} shadow-sm`
                  : "text-muted hover:text-foreground hover:bg-surface-elevated/50 border-transparent"
              }`}
            >
              <span aria-hidden>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { DashboardTab };
