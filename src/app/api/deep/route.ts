import { NextRequest, NextResponse } from "next/server";
import { detectInputType } from "@/lib/detect";
import { runDeepResearch } from "@/lib/deepResearch";
import { persistReconReport } from "@/lib/reports";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const limit = checkRateLimit(clientKey);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Try again shortly.",
        retryAfterMs: limit.retryAfterMs,
      },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { query, runAll = false, primaryResults, maxPivots = 6 } = body;

  if (!query && !primaryResults) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  const rawQuery = String(query ?? primaryResults?.query ?? "").trim();
  if (!rawQuery) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  if (detectInputType(rawQuery) === "unknown") {
    return NextResponse.json({ error: "Could not detect input type" }, { status: 400 });
  }

  const data = await runDeepResearch(rawQuery, {
    runAll: Boolean(runAll),
    maxPivots: Number(maxPivots) || 6,
    primary: primaryResults ?? undefined,
  });

  const reportId = data.type !== "unknown" ? persistReconReport(data) : undefined;

  return NextResponse.json({ ...data, reportId });
}
