import { NextRequest, NextResponse } from "next/server";
import { runUsernameIntel } from "@/lib/modules/username";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }
  const data = await runUsernameIntel(query);
  return NextResponse.json(data);
}
