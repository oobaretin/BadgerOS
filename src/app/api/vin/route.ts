import { NextRequest, NextResponse } from "next/server";
import { isVin, normalizeVin } from "@/lib/vehicleDetect";
import { runVinIntel } from "@/lib/modules/vin";
import { skippedSource } from "@/lib/env";

function resolveVin(body: Record<string, unknown>): string | null {
  const explicit = typeof body.vin === "string" ? body.vin.trim() : "";
  if (explicit && isVin(explicit)) return normalizeVin(explicit);

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query && isVin(query)) return normalizeVin(query);

  return null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const vin = resolveVin(body);

  if (!vin) {
    return NextResponse.json({
      source: "VIN Intelligence",
      ...skippedSource("No VIN — enter a 17-character VIN or add one in plate options"),
    });
  }

  const data = await runVinIntel(vin);

  if (data.error) {
    return NextResponse.json(data, { status: 422 });
  }

  return NextResponse.json(data);
}
