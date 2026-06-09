import { NextRequest, NextResponse } from "next/server";
import { runWhoisIntel } from "@/lib/modules/whois";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }
  const data = await runWhoisIntel(query);
  return NextResponse.json(data);
}
