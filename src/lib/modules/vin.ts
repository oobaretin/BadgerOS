import { fetchJson } from "@/lib/fetchExternal";
import { isVin, normalizeVin } from "@/lib/vehicleDetect";

export function parseNhtsaVehicleFields(decodeData: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  const results =
    (decodeData as { Results?: Array<{ Variable?: string; Value?: string | null }> })
      ?.Results ?? [];

  for (const item of results) {
    if (item.Variable && item.Value && item.Value !== "Not Applicable" && item.Value !== "0") {
      fields[item.Variable] = String(item.Value);
    }
  }

  return fields;
}

export function buildVehicleSummary(fields: Record<string, string>) {
  return {
    make: fields["Make"],
    model: fields["Model"],
    year: fields["Model Year"],
    trim: fields["Trim"],
    bodyClass: fields["Body Class"],
    driveType: fields["Drive Type"],
    engineCylinders: fields["Engine Number of Cylinders"],
    engineDisplacement: fields["Displacement (L)"],
    fuelType: fields["Fuel Type - Primary"],
    manufacturerName: fields["Manufacturer Name"],
    plantCity: fields["Plant City"],
    plantCountry: fields["Plant Country"],
  };
}

export async function runVinIntel(vinInput: string) {
  const vin = normalizeVin(vinInput.trim());

  if (!isVin(vin)) {
    return {
      source: "VIN Intelligence",
      error: "Invalid VIN (17 characters, no I, O, or Q)",
    };
  }

  const [decode, recalls, complaints] = await Promise.allSettled([
    fetchJson(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`,
      undefined,
      15_000
    ).then((r) => r.data),
    fetchJson(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${encodeURIComponent(vin)}`,
      undefined,
      15_000
    ).then((r) => r.data),
    fetchJson(
      `https://api.nhtsa.gov/complaints/complaintsByVehicle?vin=${encodeURIComponent(vin)}`,
      undefined,
      15_000
    ).then((r) => r.data),
  ]);

  const decodeData = decode.status === "fulfilled" ? decode.value : null;
  const fields = parseNhtsaVehicleFields(decodeData);

  return {
    source: "VIN Intelligence",
    vin,
    fields,
    vehicle: buildVehicleSummary(fields),
    decodeRaw: decodeData,
    recalls: recalls.status === "fulfilled" ? recalls.value : null,
    complaints: complaints.status === "fulfilled" ? complaints.value : null,
  };
}
