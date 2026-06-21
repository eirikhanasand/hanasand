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
import { sourceApplyPlanApiContract } from "./sourceApplyPlanContract.ts";
import type { SourceApplyPlanRouteResult } from "./sourceApplyPlanTypes.ts";
import { validateSourceApplyPlanRequest } from "./sourceApplyPlanValidation.ts";

export function handleSourceApplyPlanRoute(input: {
  request: Partial<SourceApplyPlanApiRequestDto> & Record<string, unknown>;
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  generatedAt?: string;
}): SourceApplyPlanRouteResult {
  const validation = validateSourceApplyPlanRequest(input.request);
  if (validation) return { status: validation.error.code === "dry_run_required" ? 409 : 400, body: validation };
  const generatedAt = input.generatedAt ?? nowIso();
  const request = normalizedRequest(input.request);
  const requestedPacks = (input.sourcePacks ?? []).filter((pack) => request.sourcePackIds.includes(pack.name));
  const rehearsal = buildSourceCutoverRehearsalReport({
    tenantId: request.tenantId,
    generatedAt,
    queries: request.queryScope.queries,
    sources: input.sources,
    desiredSourcePacks: requestedPacks,
    maxItemsPerSection: 50
  });
  const scopedSources = request.tenantId ? input.sources.filter((source) => source.tenantId === request.tenantId || source.tenantId === undefined) : input.sources;
  const plan = buildSourceApplyPlan({ rehearsal, sources: scopedSources, generatedAt });
  return { status: 200, body: { contract: sourceApplyPlanApiContract(), applyPlan: buildSourceApplyPlanApiResponse(plan, request) } };
}

function normalizedRequest(input: Partial<SourceApplyPlanApiRequestDto> & Record<string, unknown>): SourceApplyPlanApiRequestDto {
  return {
    tenantId: typeof input.tenantId === "string" ? input.tenantId : undefined,
    queryScope: {
      queries: (input.queryScope as SourceApplyPlanApiRequestDto["queryScope"]).queries,
      entityTypes: (input.queryScope as SourceApplyPlanApiRequestDto["queryScope"]).entityTypes
    },
    sourcePackIds: Array.isArray(input.sourcePackIds) ? input.sourcePackIds.map(String) : [],
    selectedActions: input.selectedActions as SourceApplyPlanAction[] | undefined,
    dryRun: true,
    includeExecutionPreview: input.includeExecutionPreview === true
  };
}
