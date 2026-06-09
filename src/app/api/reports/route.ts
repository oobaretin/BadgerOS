import { NextRequest, NextResponse } from "next/server";
import type { ReconResponse } from "@/lib/detect";
import db from "@/lib/db";
import { persistReconReport, saveReport, type SaveReportInput } from "@/lib/reports";

interface ReportRow {
  id: string;
  created_at: string;
  query: string;
  query_type: string;
  risk_score: string | null;
  tags: string | null;
  summary: string | null;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  const rows = db
    .prepare(
      `
    select id, created_at, query, query_type, risk_score, tags, summary
    from reports order by created_at desc limit 50
  `
    )
    .all() as ReportRow[];

  return NextResponse.json({
    reports: rows.map((r) => ({
      ...r,
      summary: parseJson(r.summary, {}),
      tags: parseJson(r.tags, []),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (typeof body.query === "string" && typeof body.type === "string" && Array.isArray(body.results)) {
    const id = persistReconReport(body as ReconResponse);
    return NextResponse.json({ id, saved: true }, { status: 201 });
  }

  if (typeof body.query !== "string" || typeof body.query_type !== "string") {
    return NextResponse.json({ error: "query and query_type required" }, { status: 400 });
  }

  const report: SaveReportInput = {
    query: body.query.trim(),
    query_type: body.query_type.trim(),
    summary: typeof body.summary === "object" && body.summary ? body.summary : {},
    modules: typeof body.modules === "object" && body.modules ? body.modules : {},
    risk_score: typeof body.risk_score === "string" ? body.risk_score : null,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
  };

  const id = saveReport(report);
  return NextResponse.json({ id, saved: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id;

  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "Report id required" }, { status: 400 });
  }

  db.prepare("delete from reports where id = ?").run(id.trim());
  return NextResponse.json({ deleted: true });
}
