import type { buildSourceApplyPlanApiResponse, SourceApplyPlanAction } from "../registry/sourceApplyPlan.ts";

export interface SourceApplyPlanRouteResult {
  status: number;
  body: SourceApplyPlanRouteResponse | SourceApplyPlanRouteError;
}

export interface SourceApplyPlanRouteResponse {
  contract: SourceApplyPlanApiContractDto;
  applyPlan: ReturnType<typeof buildSourceApplyPlanApiResponse>;
}

export interface SourceApplyPlanRouteError {
  error: {
    code: "bad_request" | "invalid_action" | "dry_run_required";
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface SourceApplyPlanApiContractDto {
  endpoint: "/v1/sources/apply-plan";
  method: "POST";
  mode: "dry_run";
  request: {
    contentType: "application/json";
    fields: Array<{ name: string; type: string; required: boolean; description: string }>;
  };
  response: {
    fields: string[];
    itemFields: string[];
    forbiddenMutationFields: string[];
    actions: SourceApplyPlanAction[];
    automation: string[];
  };
  examples: Array<{ name: string; description: string }>;
}
