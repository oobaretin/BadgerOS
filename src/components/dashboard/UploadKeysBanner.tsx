"use client";

import { useEffect, useState } from "react";

const KEY_LABELS: Record<string, string> = {
  IMGBB_KEY: "imgbb.com — file uploads for reverse search",
  PLATE_RECOGNIZER_KEY: "platerecognizer.com — plate photo OCR",
  BING_VISION_KEY: "Azure Bing Visual — search uploaded images without imgbb",
  SERPAPI_KEY: "serpapi.com — Google reverse image",
  TINEYE_KEY: "tineye.com — duplicate finder",
};

export function UploadKeysBanner({ keys }: { keys: (keyof typeof KEY_LABELS)[] }) {
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        const configured = new Set(
          (d.keys ?? [])
            .filter((k: { configured?: boolean }) => k.configured)
            .map((k: { key: string }) => k.key)
        );
        setMissing(keys.filter((k) => !configured.has(k)));
      })
      .catch(() => setMissing(keys));
  }, [keys]);

  if (!missing.length) return null;

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100/90 space-y-2">
      <p className="font-medium">Add these keys to .env.local, then restart npm run dev:</p>
      <ul className="space-y-1.5 text-xs">
        {missing.map((key) => (
          <li key={key}>
            <code className="text-amber-200">{key}</code>
            {KEY_LABELS[key] ? ` — ${KEY_LABELS[key]}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
