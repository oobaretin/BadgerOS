import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";

export interface PlateOcrOptions {
  country?: "us" | "uk";
}

interface PlateRecognizerHit {
  plate?: string;
  score?: number;
  region?: { code?: string };
  vehicle?: { type?: string };
  color?: Array<{ color?: string }>;
  model_make?: Array<{ make?: string; model?: string }>;
}

interface PlateRecognizerResponse {
  results?: PlateRecognizerHit[];
  error?: string;
  detail?: string;
}

export async function runPlateOcr(
  image: File | Blob,
  options: PlateOcrOptions = {}
): Promise<Record<string, unknown>> {
  const country = options.country === "uk" ? "uk" : "us";

  if (!hasEnv("PLATE_RECOGNIZER_KEY")) {
    return {
      source: "Plate OCR",
      error: "Add PLATE_RECOGNIZER_KEY for image-based ALPR (platerecognizer.com)",
    };
  }

  const ocrForm = new FormData();
  ocrForm.append("upload", image);
  ocrForm.append("regions", country === "uk" ? "gb" : "us");
  ocrForm.append("config", JSON.stringify({ mode: "redline", threshold_d: 0.1 }));
  ocrForm.append("mmc", "true");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let ocrData: PlateRecognizerResponse;
  try {
    const ocrRes = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
      method: "POST",
      headers: { Authorization: `Token ${process.env.PLATE_RECOGNIZER_KEY}` },
      body: ocrForm,
      signal: controller.signal,
    });
    ocrData = (await ocrRes.json()) as PlateRecognizerResponse;
    if (!ocrRes.ok) {
      return {
        source: "Plate OCR",
        error: ocrData.detail ?? ocrData.error ?? "Plate Recognizer request failed",
        ocrData,
      };
    }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Plate Recognizer request timed out"
        : String(err);
    return { source: "Plate OCR", error: message };
  } finally {
    clearTimeout(timer);
  }

  const results = ocrData.results ?? [];
  if (!results.length) {
    return {
      source: "Plate OCR",
      error: "No plate detected in image",
      ocrData,
    };
  }

  const best = results[0];
  const plate = String(best.plate ?? "").toUpperCase();
  if (!plate) {
    return { source: "Plate OCR", error: "No plate text extracted", ocrData };
  }

  const confidence = Math.round((best.score ?? 0) * 100);
  const region = best.region?.code ?? (country === "uk" ? "gb" : "us");
  const vehicleType = best.vehicle?.type ?? "unknown";
  const vehicleColor = best.color?.[0]?.color ?? "unknown";

  const [nhtsaSearch, dvla] = await Promise.allSettled([
    fetchJson(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevanityplate/${encodeURIComponent(plate)}?format=json`,
      undefined,
      15_000
    ).then((r) => r.data),
    country === "uk"
      ? hasEnv("DVLA_API_KEY")
        ? fetchJson(
            "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
            {
              method: "POST",
              headers: {
                "x-api-key": process.env.DVLA_API_KEY!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ registrationNumber: plate.replace(/\s/g, "") }),
            },
            15_000
          ).then((r) => r.data)
        : Promise.resolve(skippedSource("Add DVLA_API_KEY for UK vehicle enquiry"))
      : Promise.resolve(null),
  ]);

  return {
    source: "Plate OCR",
    plate,
    country,
    confidence,
    region,
    vehicleType,
    vehicleColor,
    rawOcr: best,
    plateRecognizer: { results: [best] },
    vehicle: nhtsaSearch.status === "fulfilled" ? nhtsaSearch.value : null,
    nhtsaSearch: nhtsaSearch.status === "fulfilled" ? nhtsaSearch.value : null,
    dvla: dvla.status === "fulfilled" ? dvla.value : null,
  };
}
