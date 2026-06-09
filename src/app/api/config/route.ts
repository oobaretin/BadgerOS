import { NextResponse } from "next/server";
import { getApiKeyStatus } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    source: "API Configuration",
    keys: getApiKeyStatus(),
    note: "Free sources (ip-api, RDAP, crt.sh, InternetDB, etc.) work without keys.",
  });
}
