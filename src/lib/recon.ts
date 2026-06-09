import {
  detectInputType,
  normalizeQuery,
  type ReconResponse,
  type ReconSourceResult,
} from "@/lib/detect";
import { ALL_ROUTES, getRoutesForQuery, type ReconRoute } from "@/lib/routes";
import { MODULE_RUNNERS } from "@/lib/modules";

export interface RunReconOptions {
  runAll?: boolean;
}

export async function runRecon(
  rawQuery: string,
  options: RunReconOptions = {}
): Promise<ReconResponse> {
  const type = detectInputType(rawQuery);
  const query =
    type !== "unknown" ? normalizeQuery(type, rawQuery) : rawQuery.trim();

  const routes: ReconRoute[] = options.runAll
    ? [...ALL_ROUTES]
    : getRoutesForQuery(type);

  const settled = await Promise.allSettled(
    routes.map(async (route) => {
      const data = await MODULE_RUNNERS[route](query, type);
      return { source: route, status: "fulfilled" as const, data };
    })
  );

  const results: ReconSourceResult[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      source: routes[i],
      status: "rejected",
      data: { error: String(r.reason) },
    };
  });

  return { type, query, results };
}

export async function runSingleModule(
  route: ReconRoute,
  rawQuery: string
): Promise<ReconSourceResult> {
  const type = detectInputType(rawQuery);
  const query =
    type !== "unknown" ? normalizeQuery(type, rawQuery) : rawQuery.trim();

  try {
    const data = await MODULE_RUNNERS[route](query, type);
    return { source: route, status: "fulfilled", data };
  } catch (err) {
    return { source: route, status: "rejected", data: { error: String(err) } };
  }
}
