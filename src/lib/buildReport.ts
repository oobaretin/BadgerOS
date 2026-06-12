import type { ReconResponse, ReconSourceResult } from "@/lib/detect";
import type { DeepReconResponse } from "@/lib/deepResearch/types";
import { getSourceStatus } from "@/lib/sourceStatus";

export interface SaveReportInput {
  query: string;
  query_type: string;
  summary: Record<string, unknown>;
  modules: Record<string, unknown>;
  risk_score: string | null;
  tags: string[];
}

export type ReconReport = SaveReportInput;

function moduleKey(source: string): string {
  return source.replace(/^\/api\//, "");
}

function summarizeCounts(results: ReconSourceResult[]) {
  return results.reduce(
    (acc, r) => {
      acc[getSourceStatus(r)] += 1;
      return acc;
    },
    { found: 0, clean: 0, warning: 0 }
  );
}

function computeRiskScore(results: ReconSourceResult[]): string {
  const counts = summarizeCounts(results);
  if (counts.found >= 2) return "high";
  if (counts.found >= 1) return "medium";
  if (counts.warning >= 2) return "medium";
  if (counts.warning >= 1) return "low";
  return "low";
}

function buildTags(type: string, results: ReconSourceResult[]): string[] {
  const tags = new Set<string>([type]);
  for (const r of results) {
    if (getSourceStatus(r) === "found") {
      tags.add(moduleKey(r.source));
    }
  }
  return [...tags];
}

function buildModules(results: ReconSourceResult[]): Record<string, unknown> {
  const modules: Record<string, unknown> = {};
  for (const r of results) {
    modules[moduleKey(r.source)] = {
      status: getSourceStatus(r),
      route: r.source,
      fulfilled: r.status === "fulfilled",
      data: r.data,
    };
  }
  return modules;
}

export function buildReportFromRecon(response: ReconResponse | DeepReconResponse): ReconReport {
  const counts = summarizeCounts(response.results);
  const deep = "deep" in response ? response.deep : undefined;

  return {
    query: response.query,
    query_type: response.type,
    summary: {
      headline:
        deep?.summary.headline ??
        `${counts.found} finding(s), ${counts.warning} warning(s), ${counts.clean} clean`,
      counts,
      deep: deep?.summary,
      pivotCount: deep?.pivots.length ?? 0,
    },
    modules: buildModules(response.results),
    risk_score: computeRiskScore(response.results),
    tags: buildTags(response.type, response.results),
  };
}
