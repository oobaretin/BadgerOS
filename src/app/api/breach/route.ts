import { NextRequest, NextResponse } from "next/server";
import { runBreachIntel } from "@/lib/modules/breach";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }
  const data = await runBreachIntel(query);
  return NextResponse.json(data);
}
