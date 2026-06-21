import {
  buildGraphCutoverReportApiDto,
  buildGraphReviewPlanApiDto,
  buildStixExportReadinessApiDto,
  graphReviewApiExamples
} from "../export/graphViews.ts";
import type { PersistedGraphSnapshot } from "../types.ts";
import { nowIso } from "../utils.ts";

export interface GraphReviewRouteRequestDto {
  relationshipId?: string;
  includeExamples?: boolean;
  generatedAt?: string;
  dryRun?: boolean;
}

export type GraphReviewRouteResult<T> = {
  status: number;
  body: T | { error: { code: string; message: string; details?: Record<string, unknown> } };
};

export function handleGraphReviewPlanRoute(input: {
  snapshot: PersistedGraphSnapshot;
  request?: GraphReviewRouteRequestDto;
}): GraphReviewRouteResult<Record<string, unknown>> {
  const error = validate(input.snapshot, input.request);
  if (error) return error;
  const generatedAt = input.request?.generatedAt ?? nowIso();
  return {
    status: 200,
    body: {
      contract: graphReviewRouteContract("/v1/graph/review-plan"),
      reviewPlan: buildGraphReviewPlanApiDto(input.snapshot, { generatedAt }),
      examples: input.request?.includeExamples ? graphReviewApiExamples(generatedAt) : undefined
    }
  };
}

export function handleGraphCutoverReportRoute(input: {
  snapshot: PersistedGraphSnapshot;
  request?: GraphReviewRouteRequestDto;
}): GraphReviewRouteResult<Record<string, unknown>> {
  const error = validate(input.snapshot, input.request);
  if (error) return error;
  return {
    status: 200,
    body: {
      contract: graphReviewRouteContract("/v1/graph/cutover-report"),
      cutoverReport: buildGraphCutoverReportApiDto(input.snapshot, { generatedAt: input.request?.generatedAt ?? nowIso() })
    }
  };
}

export function handleStixExportReadinessRoute(input: {
  snapshot: PersistedGraphSnapshot;
  request?: GraphReviewRouteRequestDto;
}): GraphReviewRouteResult<Record<string, unknown>> {
  const error = validate(input.snapshot, input.request);
  if (error) return error;
  return {
    status: 200,
    body: {
      contract: graphReviewRouteContract("/v1/exports/stix"),
      readiness: buildStixExportReadinessApiDto(input.snapshot, { generatedAt: input.request?.generatedAt ?? nowIso() })
    }
  };
}

export function graphReviewRouteContract(endpoint: string) {
  return {
    endpoint,
    method: "GET",
    mode: "dry_run",
    responseFields: ["contract", endpoint.includes("review") ? "reviewPlan" : endpoint.includes("cutover") ? "cutoverReport" : "readiness"],
    safeMetadataOnly: true
  };
}

function validate(snapshot: PersistedGraphSnapshot, request: GraphReviewRouteRequestDto = {}): GraphReviewRouteResult<never> | undefined {
  if (request.dryRun === false) {
    return { status: 409, body: { error: { code: "dry_run_required", message: "Graph review routes do not mutate state" } } };
  }
  if (request.relationshipId && !snapshot.relationships.some((relationship) => relationship.id === request.relationshipId)) {
    return { status: 404, body: { error: { code: "relationship_not_found", message: "Relationship id was not found", details: { relationshipId: request.relationshipId } } } };
  }
  return undefined;
}
