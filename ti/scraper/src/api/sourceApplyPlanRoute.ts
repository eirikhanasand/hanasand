import {
  buildSourceApplyPlan,
  buildSourceApplyPlanApiResponse,
  type SourceApplyPlanAction,
  type SourceApplyPlanApiRequestDto
} from "../registry/sourceApplyPlan.ts";
import { buildSourceCutoverRehearsalReport } from "../registry/sourceCutover.ts";
import type { SeedSourceBundle } from "../registry/sourceSeeds.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

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

const APPLY_ACTIONS: SourceApplyPlanAction[] = ["approve", "activate", "quarantine", "restore", "retire", "request_legal_notes", "leave_unchanged"];

export function handleSourceApplyPlanRoute(input: {
  request: Partial<SourceApplyPlanApiRequestDto> & Record<string, unknown>;
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  generatedAt?: string;
}): SourceApplyPlanRouteResult {
  const validation = validateSourceApplyPlanRequest(input.request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : 400, body: validation };

  const generatedAt = input.generatedAt ?? nowIso();
  const request: SourceApplyPlanApiRequestDto = {
    tenantId: typeof input.request.tenantId === "string" ? input.request.tenantId : undefined,
    queryScope: {
      queries: (input.request.queryScope as SourceApplyPlanApiRequestDto["queryScope"]).queries,
      entityTypes: (input.request.queryScope as SourceApplyPlanApiRequestDto["queryScope"]).entityTypes
    },
    sourcePackIds: Array.isArray(input.request.sourcePackIds) ? input.request.sourcePackIds.map(String) : [],
    selectedActions: input.request.selectedActions as SourceApplyPlanAction[] | undefined,
    dryRun: true,
    includeExecutionPreview: input.request.includeExecutionPreview === true
  };
  const requestedPacks = (input.sourcePacks ?? []).filter((pack) => request.sourcePackIds.includes(pack.name));
  const rehearsal = buildSourceCutoverRehearsalReport({
    tenantId: request.tenantId,
    generatedAt,
    queries: request.queryScope.queries,
    sources: input.sources,
    desiredSourcePacks: requestedPacks,
    maxItemsPerSection: 50
  });
  const plan = buildSourceApplyPlan({
    rehearsal,
    sources: request.tenantId
      ? input.sources.filter((source) => source.tenantId === request.tenantId || source.tenantId === undefined)
      : input.sources,
    generatedAt
  });

  return {
    status: 200,
    body: {
      contract: sourceApplyPlanApiContract(),
      applyPlan: buildSourceApplyPlanApiResponse(plan, request)
    }
  };
}

export function sourceApplyPlanApiContract(): SourceApplyPlanApiContractDto {
  return {
    endpoint: "/v1/sources/apply-plan",
    method: "POST",
    mode: "dry_run",
    request: {
      contentType: "application/json",
      fields: [
        { name: "dryRun", type: "true", required: false, description: "Must remain true or omitted; route never mutates registry state." },
        { name: "tenantId", type: "string", required: false, description: "Tenant scope for source lookup and plan generation." },
        { name: "queryScope.queries", type: "string[]", required: true, description: "Actor, CVE, sector, or other query families covered by the plan." },
        { name: "queryScope.entityTypes", type: "string[]", required: false, description: "Optional entity type hints matching /v1/intel/search terms." },
        { name: "sourcePackIds", type: "string[]", required: false, description: "Safe public source-pack ids/names to include in dry-run install planning." },
        { name: "selectedActions", type: "SourceApplyPlanAction[]", required: false, description: "Optional action filter for compact API responses." },
        { name: "includeExecutionPreview", type: "boolean", required: false, description: "Includes a dry-run preview that explicitly reports executed:false." }
      ]
    },
    response: {
      fields: ["contract", "applyPlan"],
      itemFields: ["itemId", "sourceId", "sourceName", "action", "automation", "approvalRequired", "blocked", "prerequisiteFailures", "expectedDiffCount", "policyImpact", "collectionImpact", "rollback", "reason"],
      forbiddenMutationFields: ["updatedSource", "reviewDecisionApplied", "startedCrawl", "leasedTask", "rawPayload", "dbTransaction", "restrictedActivation"],
      actions: APPLY_ACTIONS,
      automation: ["automation_safe", "human_approval_required", "blocked", "rollback_only"]
    },
    examples: [
      { name: "happy_path", description: "Dry-run source plan with no registry mutation." },
      { name: "human_approval_required", description: "Safe-public candidate approval remains human-reviewed." },
      { name: "blocked_restricted_source", description: "Restricted source cannot be auto-activated." },
      { name: "duplicate_source", description: "Duplicate source is exposed as reviewable retire or legal action." },
      { name: "stale_legal_notes", description: "Legal notes refresh request is represented without mutation." },
      { name: "rollback_only_quarantine", description: "Degraded source quarantine is rollback-only." }
    ]
  };
}

function validateSourceApplyPlanRequest(input: Partial<SourceApplyPlanApiRequestDto> & Record<string, unknown>): SourceApplyPlanRouteError | undefined {
  const dryRun = (input as Record<string, unknown>).dryRun;
  if (dryRun === false) {
    return { error: { code: "dry_run_required", message: "/v1/sources/apply-plan is dry-run only" } };
  }
  const queryScope = input.queryScope as SourceApplyPlanApiRequestDto["queryScope"] | undefined;
  if (!queryScope || !Array.isArray(queryScope.queries) || queryScope.queries.length === 0 || queryScope.queries.some((query) => typeof query !== "string" || !query.trim())) {
    return { error: { code: "bad_request", message: "queryScope.queries must contain at least one query" } };
  }
  if (input.selectedActions !== undefined) {
    if (!Array.isArray(input.selectedActions)) {
      return { error: { code: "invalid_action", message: "selectedActions must be an array" } };
    }
    const invalid = input.selectedActions.filter((action) => !APPLY_ACTIONS.includes(action as SourceApplyPlanAction));
    if (invalid.length) {
      return {
        error: {
          code: "invalid_action",
          message: "selectedActions contains unsupported source apply actions",
          details: { invalid, allowed: APPLY_ACTIONS }
        }
      };
    }
  }
  return undefined;
}
