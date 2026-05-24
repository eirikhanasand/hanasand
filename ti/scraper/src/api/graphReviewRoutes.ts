import {
  buildGraphCutoverReportApiDto,
  buildGraphReviewPlanApiDto,
  buildStixExportReadinessApiDto,
  graphReviewApiExamples
} from "../export/graphViews.ts";
import type {
  GraphReviewApiExamplesDto,
  GraphReviewApplyAction,
  GraphReviewPlanApiDto,
  GraphCutoverReportApiDto,
  PersistedGraphSnapshot,
  StixExportReadinessApiDto
} from "../types.ts";
import { nowIso } from "../utils.ts";

export interface GraphReviewRouteRequestDto {
  dryRun?: boolean;
  relationshipId?: string;
  selectedActions?: GraphReviewApplyAction[];
  includeExamples?: boolean;
  includeDiscoveryOnly?: boolean;
  minConfidence?: number;
  requireAccepted?: boolean;
  generatedAt?: string;
}

export interface GraphReviewRouteError {
  error: {
    code: "dry_run_required" | "invalid_action" | "relationship_not_found";
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface GraphReviewPlanRouteResponse {
  contract: GraphReviewRouteContractDto;
  reviewPlan: GraphReviewPlanApiDto;
  examples?: GraphReviewApiExamplesDto;
}

export interface GraphCutoverReportRouteResponse {
  contract: GraphReviewRouteContractDto;
  cutoverReport: GraphCutoverReportApiDto;
  examples?: GraphReviewApiExamplesDto;
}

export interface StixExportReadinessRouteResponse {
  contract: GraphReviewRouteContractDto;
  readiness: StixExportReadinessApiDto;
  examples?: GraphReviewApiExamplesDto;
}

export interface GraphReviewRouteContractDto {
  endpoint: "/v1/graph/review-plan" | "/v1/graph/cutover-report" | "/v1/exports/stix";
  method: "GET";
  mode: "dry_run";
  query: Array<{ name: string; type: string; required: boolean; description: string }>;
  response: {
    fields: string[];
    actions: GraphReviewApplyAction[];
    forbiddenMutationFields: string[];
    automation: string[];
  };
  examples: Array<{ name: GraphReviewApplyAction | "discovery_only_manual_review_required"; description: string }>;
}

export type GraphReviewRouteResult<T> = {
  status: number;
  body: T | GraphReviewRouteError;
};

const GRAPH_REVIEW_ACTIONS: GraphReviewApplyAction[] = [
  "accept_edge",
  "reject_edge",
  "downgrade_edge",
  "supersede_edge",
  "request_evidence",
  "mark_stale",
  "expire_edge",
  "hold_edge",
  "block_export"
];

export function handleGraphReviewPlanRoute(input: {
  snapshot: PersistedGraphSnapshot;
  request?: GraphReviewRouteRequestDto;
  generatedAt?: string;
}): GraphReviewRouteResult<GraphReviewPlanRouteResponse> {
  const request = input.request ?? {};
  const validation = validateGraphReviewRequest(input.snapshot, request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : validation.error.code === "relationship_not_found" ? 404 : 400, body: validation };

  const generatedAt = request.generatedAt ?? input.generatedAt ?? nowIso();
  const reviewPlan = filterReviewPlan(buildGraphReviewPlanApiDto(input.snapshot, {
    generatedAt,
    source: "api_request"
  }), request);

  return {
    status: 200,
    body: {
      contract: graphReviewRouteContract("/v1/graph/review-plan"),
      reviewPlan,
      examples: request.includeExamples ? graphReviewApiExamples(generatedAt) : undefined
    }
  };
}

export function handleGraphCutoverReportRoute(input: {
  snapshot: PersistedGraphSnapshot;
  request?: GraphReviewRouteRequestDto;
  generatedAt?: string;
}): GraphReviewRouteResult<GraphCutoverReportRouteResponse> {
  const request = input.request ?? {};
  const validation = validateGraphReviewRequest(input.snapshot, request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : validation.error.code === "relationship_not_found" ? 404 : 400, body: validation };

  const generatedAt = request.generatedAt ?? input.generatedAt ?? nowIso();
  const cutoverReport = buildGraphCutoverReportApiDto(input.snapshot, {
    generatedAt,
    includeDiscoveryOnly: request.includeDiscoveryOnly,
    minConfidence: request.minConfidence,
    requireAccepted: request.requireAccepted
  });

  return {
    status: 200,
    body: {
      contract: graphReviewRouteContract("/v1/graph/cutover-report"),
      cutoverReport,
      examples: request.includeExamples ? graphReviewApiExamples(generatedAt) : undefined
    }
  };
}

export function handleStixExportReadinessRoute(input: {
  snapshot: PersistedGraphSnapshot;
  request?: GraphReviewRouteRequestDto;
  generatedAt?: string;
}): GraphReviewRouteResult<StixExportReadinessRouteResponse> {
  const request = input.request ?? {};
  const validation = validateGraphReviewRequest(input.snapshot, request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : validation.error.code === "relationship_not_found" ? 404 : 400, body: validation };

  const generatedAt = request.generatedAt ?? input.generatedAt ?? nowIso();
  const snapshot = { ...input.snapshot, generatedAt };
  const readiness = filterStixReadiness(buildStixExportReadinessApiDto(snapshot, {
    includeDiscoveryOnly: request.includeDiscoveryOnly,
    minConfidence: request.minConfidence,
    requireAccepted: request.requireAccepted
  }), request);

  return {
    status: 200,
    body: {
      contract: graphReviewRouteContract("/v1/exports/stix"),
      readiness,
      examples: request.includeExamples ? graphReviewApiExamples(generatedAt) : undefined
    }
  };
}

export function graphReviewRouteContract(endpoint: GraphReviewRouteContractDto["endpoint"]): GraphReviewRouteContractDto {
  return {
    endpoint,
    method: "GET",
    mode: "dry_run",
    query: [
      { name: "runId", type: "string", required: true, description: "Run scope used by server mounts to materialize a graph snapshot." },
      { name: "relationshipId", type: "string", required: false, description: "Optional relationship filter; invalid ids return relationship_not_found." },
      { name: "selectedActions", type: "GraphReviewApplyAction[]", required: false, description: "Optional comma-separated action filter for review-plan responses." },
      { name: "includeExamples", type: "boolean", required: false, description: "Includes frozen Task M examples for documentation and contract tests." },
      { name: "includeDiscoveryOnly", type: "boolean", required: false, description: "STIX readiness policy switch; default keeps discovery-only edges blocked." },
      { name: "dryRun", type: "true", required: false, description: "Must remain true or omitted; graph review routes do not mutate state." }
    ],
    response: {
      fields: [
        "contract",
        endpoint === "/v1/graph/review-plan" ? "reviewPlan.exportSla" : endpoint === "/v1/graph/cutover-report" ? "cutoverReport" : "readiness.exportSla",
        endpoint === "/v1/graph/review-plan" ? "reviewPlan.enforcement" : endpoint === "/v1/graph/cutover-report" ? "cutoverReport" : "readiness.enforcement",
        endpoint === "/v1/graph/review-plan" ? "reviewPlan.certification" : endpoint === "/v1/graph/cutover-report" ? "cutoverReport" : "readiness.certification",
        endpoint === "/v1/exports/stix" ? "readiness.taxiiCollections" : "taxii_future_boundary",
        endpoint === "/v1/graph/review-plan" ? "reviewPlan" : endpoint === "/v1/graph/cutover-report" ? "cutoverReport" : "readiness",
        "examples"
      ],
      actions: GRAPH_REVIEW_ACTIONS,
      forbiddenMutationFields: ["updatedRelationship", "reviewDecisionApplied", "stixBundlePublished", "taxiiCollectionUpdated", "dbTransaction"],
      automation: ["automation_safe", "human_approval_required", "blocked", "rollback_only"]
    },
    examples: [
      { name: "accept_edge", description: "Accepted graph edge review preview." },
      { name: "reject_edge", description: "Rejected graph edge review preview." },
      { name: "downgrade_edge", description: "Confidence downgrade review preview." },
      { name: "supersede_edge", description: "Supersession review preview." },
      { name: "request_evidence", description: "Additional-evidence request preview." },
      { name: "mark_stale", description: "Stale relationship review preview." },
      { name: "expire_edge", description: "Expired relationship review preview." },
      { name: "hold_edge", description: "Held relationship export preview." },
      { name: "block_export", description: "Export blocker preview." },
      { name: "discovery_only_manual_review_required", description: "Weak discovery-only evidence remains blocked from automated STIX readiness." }
    ]
  };
}

function validateGraphReviewRequest(snapshot: PersistedGraphSnapshot, request: GraphReviewRouteRequestDto): GraphReviewRouteError | undefined {
  if (request.dryRun === false) {
    return { error: { code: "dry_run_required", message: "Graph review routes are dry-run only" } };
  }
  if (request.selectedActions !== undefined) {
    if (!Array.isArray(request.selectedActions)) {
      return { error: { code: "invalid_action", message: "selectedActions must be an array" } };
    }
    const invalid = request.selectedActions.filter((action) => !GRAPH_REVIEW_ACTIONS.includes(action));
    if (invalid.length) {
      return {
        error: {
          code: "invalid_action",
          message: "selectedActions contains unsupported graph review actions",
          details: { invalid, allowed: GRAPH_REVIEW_ACTIONS }
        }
      };
    }
  }
  if (request.relationshipId && !snapshot.relationships.some((relationship) => relationship.id === request.relationshipId)) {
    return {
      error: {
        code: "relationship_not_found",
        message: "Relationship id was not found in the materialized graph snapshot",
        details: { relationshipId: request.relationshipId }
      }
    };
  }
  return undefined;
}

function filterReviewPlan(plan: GraphReviewPlanApiDto, request: GraphReviewRouteRequestDto): GraphReviewPlanApiDto {
  const selectedActions = request.selectedActions ? new Set(request.selectedActions) : undefined;
  const actions = plan.actions.filter((action) =>
    (!request.relationshipId || action.relationshipId === request.relationshipId)
    && (!selectedActions || selectedActions.has(action.action))
  );
  return {
    ...plan,
    actions,
    summary: {
      total: actions.length,
      automationSafe: actions.filter((action) => action.safety === "automation_safe").length,
      humanApprovalRequired: actions.filter((action) => action.safety === "human_approval_required").length,
      blocked: actions.filter((action) => action.safety === "blocked").length
    },
    status: actions.some((action) => action.safety === "blocked")
      ? "blocked"
      : actions.length > 0
        ? "needs_review"
        : "ready"
  };
}

function filterStixReadiness(readiness: StixExportReadinessApiDto, request: GraphReviewRouteRequestDto): StixExportReadinessApiDto {
  if (!request.relationshipId) return readiness;
  const relationships = readiness.relationships.filter((relationship) => relationship.relationshipId === request.relationshipId);
  const reviewActions = readiness.reviewActions.filter((action) => action.relationshipId === request.relationshipId);
  const previewItems = readiness.preview.items.filter((item) => item.relationshipId === request.relationshipId);
  const readyCount = relationships.filter((relationship) => relationship.ready).length;
  const blockedCount = relationships.length - readyCount;
  return {
    ...readiness,
    ready: relationships.length > 0 && blockedCount === 0,
    readyCount,
    blockedCount,
    relationships,
    reviewActions,
    preview: {
      ...readiness.preview,
      includedCount: previewItems.filter((item) => item.included).length,
      excludedCount: previewItems.filter((item) => !item.included).length,
      items: previewItems
    }
  };
}
