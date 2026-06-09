import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";
import { isUkPlate, isVin, normalizePlate, normalizeVin } from "@/lib/vehicleDetect";
import { runVinIntel } from "./vin";

export interface VehicleIntelOptions {
  vin?: string;
  country?: "us" | "uk";
  imageUrl?: string;
}

async function fetchPlateRecognizer(
  imageUrl: string,
  country: "us" | "uk"
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const form = new FormData();
  form.append("upload_url", imageUrl);
  form.append("regions", country === "uk" ? "gb" : "us");
  form.append("mmc", "true");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.PLATE_RECOGNIZER_KEY}`,
      },
      body: form,
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      return { ok: false, status: res.status, data: { error: text.slice(0, 200) } };
    }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Request timed out"
        : String(err);
    return { ok: false, status: 0, data: { error: message } };
  } finally {
    clearTimeout(timer);
  }
}

export async function runVehicleIntel(
  query: string,
  options: VehicleIntelOptions = {}
) {
  const trimmed = query.trim();
  const explicitVin = options.vin?.trim();
  const detectedVin = isVin(trimmed) ? normalizeVin(trimmed) : null;
  const vin = explicitVin ? normalizeVin(explicitVin) : detectedVin;
  const plate = vin ? null : normalizePlate(trimmed);
  const country =
    options.country ?? (plate && isUkPlate(plate) ? "uk" : "us");

  const results: Record<string, unknown> = {
    source: "Plate / Vehicle Intelligence",
    plate,
    vin,
    country,
  };

  if (vin) {
    const vinIntel = await runVinIntel(vin);
    if (vinIntel.error) {
      results.error = vinIntel.error;
    } else {
      results.vehicle = vinIntel.decodeRaw;
      results.recalls = vinIntel.recalls;
      results.complaints = vinIntel.complaints;
      results.vehicleSummary = vinIntel.vehicle;
    }
  }

  if (country === "uk" && plate) {
    if (hasEnv("DVLA_API_KEY")) {
      const dvla = await fetchJson(
        "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
        {
          method: "POST",
          headers: {
            "x-api-key": process.env.DVLA_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            registrationNumber: plate.replace(/\s/g, ""),
          }),
        },
        15_000
      );
      results.dvla = dvla.data;
    } else {
      results.dvla = skippedSource();
    }
  }

  if (!vin && country === "us" && plate) {
    results.note =
      "US plate text lookup requires a VIN for NHTSA decode, or pass imageUrl for Plate Recognizer ALPR.";
  }

  if (options.imageUrl) {
    if (hasEnv("PLATE_RECOGNIZER_KEY")) {
      const pr = await fetchPlateRecognizer(options.imageUrl, country);
      results.plateRecognizer = pr.data;
    } else {
      results.plateRecognizer = skippedSource();
    }
  } else if (hasEnv("PLATE_RECOGNIZER_KEY") && plate) {
    results.plateRecognizer = {
      skipped: true,
      reason:
        "Plate Recognizer reads plates from images — pass imageUrl in the API request (2500 free/mo)",
    };
  } else if (plate) {
    results.plateRecognizer = skippedSource(
      "No API key configured — add PLATE_RECOGNIZER_KEY for image-based ALPR"
    );
  }

  return results;
}
