import { NextResponse } from "next/server";
import { getApiKeyStatus } from "@/lib/env";
import { getDeploymentInfo } from "@/lib/keySetup";

export async function GET() {
  const deployment = getDeploymentInfo();
  return NextResponse.json({
    source: "API Configuration",
    keys: getApiKeyStatus(),
    deployment,
    note: "Free sources (ip-api, RDAP, crt.sh, InternetDB, etc.) work without keys.",
  });
}
