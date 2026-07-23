import type { CollectionPlan, CollectionRun, IntelligenceRequest } from "../types.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { createCollectionPlan } from "../planner/intelligencePlanner.ts";
import { exportEvidenceBackedStixBundle } from "../export/stix.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
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
    if (existingRun && ["queued", "running"].includes(existingRun.status)) options.runExecutor?.(existingRun.id);
    return json({ run: existingRun, plan: existingPlan, scheduler: { queued: options.frontier.size() } });
  }
  const createdAt = nowIso();
  const requestId = stableId("request", `${scope.tenantId}:${idempotencyKey ?? requestHash}`);
  const planned = createCollectionPlan({ ...input, id: requestId, createdAt, actorIdentities: options.store.listActorIdentities?.() ?? [] }, options.store.listSources().filter((source: any) => !source.tenantId || source.tenantId === scope.tenantId), options.frontier);
  const plan = { ...planned, id: stableId("plan", requestId), requestId, tenantId: scope.tenantId, idempotencyKey, requestHash } as CollectionPlan;
  const executableTasks = plan.tasks.filter((task: any) => !task.availableAt || !task.deadlineAt || Date.parse(task.availableAt) <= Date.parse(task.deadlineAt));
  const executablePlan = { ...plan, tasks: executableTasks } as CollectionPlan;
  const run = runFromPlan(executablePlan, requestId);
  executablePlan.tasks = executableTasks.map((task: any) => ({ ...task, runId: run.id, planId: plan.id, crawlBudgetKey: undefined }));
  options.store.savePlan?.(executablePlan);
  options.store.saveRun?.(run);
  for (const task of executablePlan.tasks) options.frontier.enqueueTask(task);
  options.runExecutor?.(run.id);
  return json({ run, plan: executablePlan, scheduler: { runId: run.id, planId: plan.id, queued: options.frontier.size() } }, 201);
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
  const runCaptureIds = new Set(run.captureIds ?? []);
  const captures = options.store.listCaptures().filter((capture: any) => (!capture.tenantId || capture.tenantId === scope.tenantId) && (runCaptureIds.has(capture.id) || captureRunId(capture) === runId));
  const captureIds = new Set(captures.map((capture: any) => capture.id));
  const belongsToRun = (record: any) => captureIds.has(record.captureId) && (!record.tenantId || record.tenantId === scope.tenantId);
  const incidents = (options.store.listIncidents?.() ?? []).filter(belongsToRun);
  const indicators = ((options.store as any).listIndicators?.() ?? []).filter(belongsToRun);
  const entities = ((options.store as any).listExtractedEntities?.() ?? []).filter(belongsToRun);
  const relationships = ((options.store as any).listEvidenceLinks?.() ?? []).filter(belongsToRun);
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
  const runCaptureIds = new Set(run.captureIds ?? []);
  const captures = options.store.listCaptures().filter((capture: any) => (!capture.tenantId || capture.tenantId === scope.tenantId) && (runCaptureIds.has(capture.id) || captureRunId(capture) === run.id));
  const bundle = exportEvidenceBackedStixBundle({ captures, options: { producerName: input.producerName ?? "ti-scraper", generatedAt: input.generatedAt ?? nowIso(), bundleKey: run.id, includeDerivedIntelligence: false } });
  const standardsValidation = validateStixBundle(bundle);
  if (!standardsValidation.valid) return error("invalid_stix_report", "Generated bundle did not pass STIX 2.1 validation", 500);
  return json({
    bundle,
    standardsValidation: { standard: "STIX 2.1", valid: true, issues: [] },
    exportPolicy: {
      evidenceOnly: true,
      derivedIntelligenceIncluded: false,
      reason: "Unreviewed parser output is withheld from third-party reporting.",
      captureIds: captures.map((capture: any) => capture.id),
      sourceIds: [...new Set(captures.map((capture: any) => capture.sourceId))]
    }
  });
}

function runFromPlan(plan: CollectionPlan, requestId: string): CollectionRun {
  return { id: stableId("run", plan.id), tenantId: (plan as any).tenantId ?? plan.request?.tenantId, planId: plan.id, requestId, status: "queued", createdAt: nowIso(), updatedAt: nowIso(), taskCount: plan.tasks.length, reviewTaskCount: plan.reviewRequired.length, rejectedSourceCount: plan.rejected.length, captureCount: 0, incidentCount: 0 } as CollectionRun;
}

function captureRunId(capture: any): string | undefined {
  return capture.runId ?? capture.metadata?.runId ?? capture.provenance?.runId;
}
