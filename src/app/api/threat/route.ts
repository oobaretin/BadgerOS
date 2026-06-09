import { NextRequest, NextResponse } from "next/server";
import { runThreatIntel } from "@/lib/modules/threat";

export async function POST(req: NextRequest) {
  const { query, inputType } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }
  const data = await runThreatIntel(query, inputType ?? "domain");
  return NextResponse.json(data);
}
