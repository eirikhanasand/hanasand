import type { CollectionPlan, CollectionRun, IntelligenceRequest } from "../types.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { createCollectionPlan } from "../planner/intelligencePlanner.ts";
import { exportEvidenceBackedStixBundle } from "../export/stix.ts";
import { error, json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { toSafeCaptureDto } from "./captureDtos.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";

export async function createRun(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson<IntelligenceRequest>(request);
  const scope = resolveTenantScope(request, new URL(request.url), input.tenantId);
  if (scope.error) return scope.error;
  input.tenantId = scope.tenantId;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  const requestHash = hashContent(JSON.stringify(input));
  const existingPlan = idempotencyKey
    ? options.store.listPlans?.().find((plan: any) => plan.tenantId === scope.tenantId && plan.idempotencyKey === idempotencyKey)
    : undefined;
  if (existingPlan) {
    if ((existingPlan as any).requestHash !== requestHash) return error("idempotency_conflict", "Idempotency key was already used for a different request", 409);
    const existingRun = options.store.listRuns?.().find((run: any) => run.planId === existingPlan.id);
    return json({ run: existingRun, plan: existingPlan, scheduler: { queued: options.frontier.size() } });
  }
  const createdAt = nowIso();
  const requestId = stableId("request", `${scope.tenantId}:${idempotencyKey ?? requestHash}`);
  const planned = createCollectionPlan({ ...input, id: requestId, createdAt }, options.store.listSources().filter((source: any) => !source.tenantId || source.tenantId === scope.tenantId), options.frontier);
  const plan = { ...planned, id: stableId("plan", requestId), requestId, tenantId: scope.tenantId, idempotencyKey, requestHash } as CollectionPlan;
  const run = runFromPlan(plan, requestId);
  options.store.savePlan?.(plan);
  options.store.saveRun?.(run);
  for (const task of plan.tasks) options.frontier.enqueueTask(task);
  return json({ run, plan, scheduler: { queued: options.frontier.size() } }, 201);
}

export function runStatus(request: Request, options: ApiServerOptions, runId: string): Response {
  const scope = resolveTenantScope(request);
  if (scope.error) return scope.error;
  const run = options.store.getRun?.(runId);
  return run && inTenantScope(run, scope.tenantId) ? json({ run, frontier: { summary: options.frontier.groupedSnapshot() } }) : error("not_found", "Run not found", 404);
}

export function runResults(request: Request, options: ApiServerOptions, runId: string): Response {
  const url = new URL(request.url);
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
  const requested = new Set((url.searchParams.get("include") ?? "captures,incidents,indicators,entities,relationships").split(",").map((item) => item.trim()).filter(Boolean));
  const collections: Record<string, any[]> = { captures: captures.map((capture: any) => toSafeCaptureDto(capture, { tenantId: scope.tenantId })), incidents, indicators, entities, relationships };
  const results = Object.fromEntries(Object.entries(collections).filter(([name]) => requested.has(name)).map(([name, items]) => [name, { items, total: items.length }]));
  return json({ runId, results });
}

export async function exportRunStix(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson<{ runId?: string; producerName?: string; generatedAt?: string; tenantId?: string }>(request);
  if (!input.runId) return error("bad_request", "runId is required", 400);
  const scope = resolveTenantScope(request, new URL(request.url), input.tenantId);
  if (scope.error) return scope.error;
  const run = options.store.getRun?.(input.runId);
  if (!run || !inTenantScope(run, scope.tenantId)) return error("not_found", "Run not found", 404);
  const captures = options.store.listCaptures().filter((capture: any) => inTenantScope(capture, scope.tenantId) && captureRunId(capture) === run.id);
  const bundle = exportEvidenceBackedStixBundle({ captures, options: { producerName: input.producerName ?? "ti-scraper", generatedAt: input.generatedAt ?? nowIso(), bundleKey: run.id } });
  return json({ bundle });
}

function runFromPlan(plan: CollectionPlan, requestId: string): CollectionRun {
  return { id: stableId("run", plan.id), tenantId: (plan as any).tenantId ?? plan.request?.tenantId, planId: plan.id, requestId, status: "queued", createdAt: nowIso(), startedAt: nowIso(), updatedAt: nowIso(), taskCount: plan.tasks.length, reviewTaskCount: plan.reviewRequired.length, rejectedSourceCount: plan.rejected.length, captureCount: 0, incidentCount: 0 } as CollectionRun;
}

function captureRunId(capture: any): string | undefined {
  return capture.runId ?? capture.metadata?.runId ?? capture.provenance?.runId;
}
