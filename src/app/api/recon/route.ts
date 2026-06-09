import { NextRequest, NextResponse } from "next/server";
import { runRecon } from "@/lib/recon";
import { persistReconReport } from "@/lib/reports";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";

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
  const { query, runAll = false } = body;

  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  const data = await runRecon(query, { runAll: Boolean(runAll) });

  const reportId = data.type !== "unknown" ? persistReconReport(data) : undefined;

  return NextResponse.json({ ...data, reportId });
}
