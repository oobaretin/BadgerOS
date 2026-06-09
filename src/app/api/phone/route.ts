import { NextRequest, NextResponse } from "next/server";
import { runPhoneIntel } from "@/lib/modules/phone";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }
  const data = await runPhoneIntel(query);
  return NextResponse.json(data);
}
