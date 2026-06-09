import { NextRequest, NextResponse } from "next/server";
import { detectInputType } from "@/lib/detect";
import { runIpIntel } from "@/lib/modules/ip";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, inputType: bodyType } = body;
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }
  const inputType = bodyType ?? detectInputType(query);
  const data = await runIpIntel(query, inputType);
  return NextResponse.json(data);
}
