import type { ReconResponse } from "./detect";

export function downloadReconJson(result: ReconResponse) {
  const payload = {
    ...result,
    exportedAt: new Date().toISOString(),
  };

  downloadBlob(
    JSON.stringify(payload, null, 2),
    buildFilename(result.query, "json"),
    "application/json"
  );
}

export function downloadReconCsv(result: ReconResponse) {
  const rows: string[][] = [["module", "platform", "status", "url", "notes"]];

  for (const r of result.results) {
    const p = r.data;
    const username = p.username as string | undefined;
    const verified = (p.verified as Array<{ platform: string; found: boolean; url: string }>) ?? [];
    const detected = (p.detected as Array<{ platform: string; found: boolean; url: string }>) ?? [];

    if (verified.length || detected.length) {
      for (const item of [...verified, ...detected]) {
        rows.push([
          r.source.replace("/api/", ""),
          item.platform,
          item.found ? "found" : "not_found",
          item.url,
          username ?? result.query,
        ]);
      }
      continue;
    }

    rows.push([
      r.source.replace("/api/", ""),
      "-",
      r.status,
      "-",
      r.status === "rejected" ? String(p.error ?? "failed") : "ok",
    ]);
  }

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  downloadBlob(csv, buildFilename(result.query, "csv"), "text/csv");
}

function buildFilename(query: string, ext: string) {
  const safeQuery = query.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `badger-${safeQuery || "export"}-${stamp}.${ext}`;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
