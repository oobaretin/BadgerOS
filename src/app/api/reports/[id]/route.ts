import { NextRequest, NextResponse } from "next/server";
import { getReportById } from "@/lib/reports";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json({ error: "Report id required" }, { status: 400 });
  }

  const report = getReportById(id);

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(report);
}
