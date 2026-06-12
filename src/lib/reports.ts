import type { InputType, ReconResponse } from "@/lib/detect";
import type { DeepReconResponse } from "@/lib/deepResearch/types";
import { buildReportFromRecon, type SaveReportInput } from "@/lib/buildReport";
import type { ReconRoute } from "@/lib/routes";
import db from "@/lib/db";

interface StoredModule {
  route: string;
  fulfilled: boolean;
  data: Record<string, unknown>;
}

interface ReportDetailRow {
  id: string;
  query: string;
  query_type: string;
  modules: string;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type { ReconReport, SaveReportInput } from "@/lib/buildReport";
export { buildReportFromRecon } from "@/lib/buildReport";

export function saveReport(report: SaveReportInput): string {
  const id = crypto.randomUUID();

  db.prepare(
    `
  insert into reports (id, query, query_type, summary, modules, risk_score, tags)
  values (?, ?, ?, ?, ?, ?, ?)
`
  ).run(
    id,
    report.query,
    report.query_type,
    JSON.stringify(report.summary),
    JSON.stringify(report.modules),
    report.risk_score,
    JSON.stringify(report.tags)
  );

  return id;
}

export function persistReconReport(response: ReconResponse | DeepReconResponse): string {
  return saveReport(buildReportFromRecon(response));
}

export function getReportById(id: string): ReconResponse | null {
  const row = db
    .prepare("select id, query, query_type, modules from reports where id = ?")
    .get(id.trim()) as ReportDetailRow | undefined;

  if (!row) return null;

  const modules = parseJson<Record<string, StoredModule>>(row.modules, {});
  const results = Object.values(modules).map((mod) => ({
    source: mod.route as ReconRoute,
    status: mod.fulfilled ? ("fulfilled" as const) : ("rejected" as const),
    data: mod.data ?? {},
  }));

  return {
    type: row.query_type as InputType,
    query: row.query,
    results,
    reportId: row.id,
  };
}
