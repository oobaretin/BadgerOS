import { NextRequest, NextResponse } from "next/server";
import { runVehicleIntel } from "@/lib/modules/vehicle";

export async function POST(req: NextRequest) {
  const { query, vin, country, imageUrl } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  const data = await runVehicleIntel(query, {
    vin,
    imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
    country: country === "uk" || country === "us" ? country : undefined,
  });
  return NextResponse.json(data);
}
