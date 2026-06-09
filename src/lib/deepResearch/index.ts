import { runRecon } from "@/lib/recon";
import { getRoutesForQuery, type ReconRoute } from "@/lib/routes";
import { MODULE_RUNNERS } from "@/lib/modules";
import { extractPivots } from "./extractPivots";
import { runPrimaryEnrichments } from "./enrichment";
import { buildDeepSummary } from "./summary";
import type {
  DeepFinding,
  DeepReconResponse,
  DeepResearchOptions,
  PivotEntity,
} from "./types";

function routesForPivot(pivot: PivotEntity, primaryType: string): ReconRoute[] {
  if (pivot.type === "domain") {
    if (primaryType === "domain" && pivot.value.includes(".")) {
      // Subdomain/MX pivots — lighter whois + threat pass
      return ["/api/whois", "/api/threat"];
    }
    return ["/api/whois", "/api/threat", "/api/ip"];
  }
  if (pivot.type === "ip") {
    return ["/api/ip"];
  }
  if (pivot.type === "email") {
    return ["/api/breach"];
  }
  if (pivot.type === "username") {
    return ["/api/username"];
  }
  return [];
}

async function runPivotLookups(
  pivots: PivotEntity[],
  primaryType: string,
  maxCalls = 10
): Promise<DeepFinding[]> {
  const findings: DeepFinding[] = [];
  let calls = 0;

  for (const pivot of pivots) {
    const routes = routesForPivot(pivot, primaryType);
    for (const route of routes) {
      if (calls >= maxCalls) return findings;
      calls += 1;

      try {
        const data = await MODULE_RUNNERS[route](pivot.value, pivot.type);
        findings.push({
          pivot,
          route,
          status: "fulfilled",
          data,
        });
      } catch (err) {
        findings.push({
          pivot,
          route,
          status: "rejected",
          data: { error: String(err) },
        });
      }
    }
  }

  return findings;
}

export async function runDeepResearch(
  rawQuery: string,
  options: DeepResearchOptions = {}
): Promise<DeepReconResponse> {
  const maxPivots = options.maxPivots ?? 6;
  const primary =
    options.primary ?? (await runRecon(rawQuery, { runAll: options.runAll }));

  if (primary.type === "unknown") {
    return primary;
  }

  const [enrichments, pivots] = await Promise.all([
    runPrimaryEnrichments(primary.type, primary.query),
    Promise.resolve(extractPivots(primary, maxPivots)),
  ]);

  const findings = await runPivotLookups(pivots, primary.type);
  const summary = buildDeepSummary(primary, pivots, enrichments, findings);

  return {
    ...primary,
    deep: {
      enrichments,
      pivots,
      findings,
      summary,
    },
  };
}

/** Routes that will run during deep phase (for UI pending state). */
export function estimateDeepPendingRoutes(
  type: import("@/lib/detect").InputType,
  runAll: boolean
): string[] {
  const base = runAll
    ? ["/api/breach", "/api/ip", "/api/phone", "/api/plate", "/api/vin", "/api/whois", "/api/threat", "/api/username"]
    : getRoutesForQuery(type);
  return [...base, "/api/deep"];
}
