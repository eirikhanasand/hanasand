import {
  buildGraphCutoverReportApiDto,
  buildGraphReviewPlanApiDto,
  buildStixExportReadinessApiDto,
  graphReviewApiExamples
} from "../export/graphViews.ts";
import type { PersistedGraphSnapshot } from "../types.ts";
import { nowIso } from "../utils.ts";
import { graphReviewRouteContract } from "./graphReviewContract.ts";
import type { GraphReviewRouteRequestDto, GraphReviewRouteResult } from "./graphReviewTypes.ts";
import { validateGraphReviewRequest } from "./graphReviewValidation.ts";

export function handleGraphReviewPlanRoute(input: {
  snapshot: PersistedGraphSnapshot;
  request?: GraphReviewRouteRequestDto;
}): GraphReviewRouteResult<Record<string, unknown>> {
  const error = validateGraphReviewRequest(input.snapshot, input.request);
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
  const error = validateGraphReviewRequest(input.snapshot, input.request);
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
  const error = validateGraphReviewRequest(input.snapshot, input.request);
  if (error) return error;
  return {
    status: 200,
    body: {
      contract: graphReviewRouteContract("/v1/exports/stix"),
      readiness: buildStixExportReadinessApiDto(input.snapshot, { generatedAt: input.request?.generatedAt ?? nowIso() })
    }
  };
}
