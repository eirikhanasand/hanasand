import type { CollectionPlan, CollectionRun, IntelligenceRequest } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import { error, json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { toSafeCaptureDto } from "./captureDtos.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";

export async function createRun(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson<IntelligenceRequest>(request);
  const scope = resolveTenantScope(request, new URL(request.url), input.tenantId);
  if (scope.error) return scope.error;
  input.tenantId = scope.tenantId;
  const requestId = stableId("request", JSON.stringify(input));
  const plan = {
    id: stableId("plan", JSON.stringify(input)),
    requestId,
    createdAt: nowIso(),
    tasks: [],
    request: input,
    tenantId: scope.tenantId,
    reviewRequired: [],
    rejected: [],
    audit: []
  } as unknown as CollectionPlan;
  const run = runFromPlan(plan, requestId);
  options.store.savePlan?.(plan);
  options.store.saveRun?.(run);
  return json({ run, plan, scheduler: { queued: options.frontier.size() } }, 201);
}

export function runStatus(request: Request, options: ApiServerOptions, runId: string): Response {
  const scope = resolveTenantScope(request);
  if (scope.error) return scope.error;
  const run = options.store.getRun?.(runId);
  return run && inTenantScope(run, scope.tenantId) ? json({ run }) : error("not_found", "Run not found", 404);
}

export function runResults(request: Request, options: ApiServerOptions, runId: string): Response {
  const scope = resolveTenantScope(request);
  if (scope.error) return scope.error;
  const run = options.store.getRun?.(runId);
  if (!run || !inTenantScope(run, scope.tenantId)) return error("not_found", "Run not found", 404);
  const captures = options.store.listCaptures().filter((capture: any) => inTenantScope(capture, scope.tenantId) && captureRunId(capture) === runId);
  const captureIds = new Set(captures.map((capture: any) => capture.id));
  const incidents = (options.store.listIncidents?.() ?? []).filter((incident: any) => inTenantScope(incident, scope.tenantId) && captureIds.has(incident.captureId));
  const indicators = ((options.store as any).listIndicators?.() ?? []).filter((record: any) => inTenantScope(record, scope.tenantId) && captureIds.has(record.captureId));
  const entities = ((options.store as any).listExtractedEntities?.() ?? []).filter((record: any) => inTenantScope(record, scope.tenantId) && captureIds.has(record.captureId));
  const relationships = ((options.store as any).listEvidenceLinks?.() ?? []).filter((record: any) => inTenantScope(record, scope.tenantId) && captureIds.has(record.captureId));
  return json({ runId, captures: captures.map((capture: any) => toSafeCaptureDto(capture, { tenantId: scope.tenantId })), incidents, indicators, entities, relationships });
}

function runFromPlan(plan: CollectionPlan, requestId: string): CollectionRun {
  return { id: stableId("run", plan.id), tenantId: (plan as any).tenantId ?? plan.request?.tenantId, planId: plan.id, requestId, status: "queued", createdAt: nowIso(), startedAt: nowIso(), updatedAt: nowIso(), taskCount: 0, reviewTaskCount: 0, rejectedSourceCount: 0, captureCount: 0, incidentCount: 0 } as CollectionRun;
}

function captureRunId(capture: any): string | undefined {
  return capture.runId ?? capture.metadata?.runId ?? capture.provenance?.runId;
}
