import type { InputType, ReconResponse, ReconSourceResult } from "@/lib/detect";
import { detectInputType, normalizeQuery } from "@/lib/detect";
import { isVin, normalizeVin } from "@/lib/vehicleDetect";
import type { DeepReconResponse } from "@/lib/deepResearch/types";
import { ALL_ROUTES, getRoutesForQuery, type ReconRoute } from "@/lib/routes";

export interface ReconSearchOptions {
  /** Optional VIN when primary query is a license plate. */
  vin?: string;
  /** Enable UK DVLA lookup for plate searches. */
  ukPlate?: boolean;
  /** Persist to SQLite when the progressive search completes (default true). */
  persistReport?: boolean;
}

async function persistReportToDb(
  response: ReconResponse | DeepReconResponse
): Promise<string | undefined> {
  if (response.type === "unknown") return undefined;

  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { id?: string };
    return data.id;
  } catch {
    return undefined;
  }
}

function buildRouteBody(
  route: ReconRoute,
  query: string,
  type: InputType,
  options: ReconSearchOptions
): Record<string, unknown> {
  const base = { query, inputType: type };

  if (route === "/api/plate") {
    return {
      ...base,
      vin: options.vin?.trim() || undefined,
      country: options.ukPlate ? "uk" : "us",
    };
  }

  if (route === "/api/vin") {
    const optionalVin = options.vin?.trim();
    const resolvedVin =
      optionalVin && isVin(optionalVin)
        ? normalizeVin(optionalVin)
        : type === "plate" && isVin(query)
          ? query
          : undefined;
    return { ...base, vin: resolvedVin };
  }

  return base;
}

export async function fetchReconProgressive(
  rawQuery: string,
  runAll: boolean,
  onUpdate: (response: ReconResponse) => void,
  options: ReconSearchOptions = {}
): Promise<ReconResponse> {
  const type = detectInputType(rawQuery);
  const query =
    type !== "unknown" ? normalizeQuery(type, rawQuery) : rawQuery.trim();
  const routes = runAll ? [...ALL_ROUTES] : getRoutesForQuery(type);

  const response: ReconResponse = { type, query, results: [] };
  onUpdate({ ...response, results: [] });

  await Promise.all(
    routes.map(async (route) => {
      try {
        const res = await fetch(route, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildRouteBody(route, query, type, options)),
        });
        const data = await res.json();
        const entry: ReconSourceResult = res.ok
          ? { source: route, status: "fulfilled", data }
          : {
              source: route,
              status: "rejected",
              data: { error: (data as { error?: string }).error ?? "Request failed" },
            };

        response.results = [...response.results, entry];
        onUpdate({ ...response, results: [...response.results] });
      } catch (err) {
        const entry: ReconSourceResult = {
          source: route,
          status: "rejected",
          data: { error: String(err) },
        };
        response.results = [...response.results, entry];
        onUpdate({ ...response, results: [...response.results] });
      }
    })
  );

  if (options.persistReport !== false && response.type !== "unknown") {
    const reportId = await persistReportToDb(response);
    if (reportId) return { ...response, reportId };
  }

  return response;
}

export function getActiveRoutes(type: InputType, runAll: boolean): ReconRoute[] {
  return runAll ? [...ALL_ROUTES] : getRoutesForQuery(type);
}

export async function fetchDeepResearchProgressive(
  rawQuery: string,
  runAll: boolean,
  onUpdate: (response: DeepReconResponse) => void,
  options: ReconSearchOptions = {}
): Promise<DeepReconResponse> {
  const primary = await fetchReconProgressive(
    rawQuery,
    runAll,
    (partial) => {
      onUpdate({ ...partial });
    },
    { ...options, persistReport: false }
  );

  onUpdate({ ...primary, deep: undefined });

  try {
    const res = await fetch("/api/deep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: rawQuery, runAll, primaryResults: primary }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      return {
        ...primary,
        deep: {
          enrichments: [],
          pivots: [],
          findings: [],
          summary: {
            headline: "Deep research failed",
            insights: [err.error ?? "Secondary analysis unavailable"],
            relatedEntities: [],
            suggestedNextSteps: ["Retry with a stable network connection."],
          },
        },
      };
    }

    const deep = (await res.json()) as DeepReconResponse & { reportId?: string };
    onUpdate(deep);
    return deep;
  } catch (err) {
    const fallback: DeepReconResponse = {
      ...primary,
      deep: {
        enrichments: [],
        pivots: [],
        findings: [],
        summary: {
          headline: "Deep research failed",
          insights: [String(err)],
          relatedEntities: [],
          suggestedNextSteps: ["Retry the search."],
        },
      },
    };
    onUpdate(fallback);
    return fallback;
  }
}
