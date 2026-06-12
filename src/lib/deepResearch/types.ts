import type { InputType, ReconResponse, ReconSourceResult } from "@/lib/detect";
import type { ReconRoute } from "@/lib/routes";

export interface PivotEntity {
  type: InputType;
  value: string;
  reason: string;
  parentQuery: string;
}

export interface DeepEnrichment {
  kind: "gravatar" | "dns_txt" | "dns_ns" | "reverse_dns" | "hunter_email";
  target: string;
  label: string;
  data: Record<string, unknown>;
}

export interface DeepFinding {
  pivot: PivotEntity;
  route: ReconRoute;
  status: ReconSourceResult["status"];
  data: Record<string, unknown>;
}

export interface DeepResearchSummary {
  headline: string;
  insights: string[];
  relatedEntities: Array<{ type: string; value: string; reason: string }>;
  suggestedNextSteps: string[];
}

export interface DeepResearchData {
  enrichments: DeepEnrichment[];
  pivots: PivotEntity[];
  findings: DeepFinding[];
  summary: DeepResearchSummary;
}

export interface DeepReconResponse extends ReconResponse {
  deep?: DeepResearchData;
}

export interface DeepResearchOptions {
  runAll?: boolean;
  maxPivots?: number;
  primary?: ReconResponse;
}
