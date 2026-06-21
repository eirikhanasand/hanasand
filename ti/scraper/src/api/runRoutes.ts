import type { CollectionPlan, CollectionRun, IntelligenceRequest } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import { error, json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export async function createRun(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson<IntelligenceRequest>(request);
  const requestId = stableId("request", JSON.stringify(input));
  const plan = {
    id: stableId("plan", JSON.stringify(input)),
    requestId,
    createdAt: nowIso(),
    tasks: [],
    request: input,
    reviewRequired: [],
    rejected: [],
    audit: []
  } as unknown as CollectionPlan;
  const run = runFromPlan(plan, requestId);
  options.store.savePlan?.(plan);
  options.store.saveRun?.(run);
  return json({ run, plan, scheduler: { queued: options.frontier.size() } }, 201);
}

export function runStatus(options: ApiServerOptions, runId: string): Response {
  const run = options.store.getRun?.(runId);
  return run ? json({ run }) : error("not_found", "Run not found", 404);
}

export function runResults(options: ApiServerOptions, runId: string): Response {
  return json({ runId, captures: options.store.listCaptures(), incidents: options.store.listIncidents?.() ?? [], indicators: [], entities: [], relationships: [] });
}

function runFromPlan(plan: CollectionPlan, requestId: string): CollectionRun {
  return { id: stableId("run", plan.id), planId: plan.id, requestId, status: "queued", createdAt: nowIso(), updatedAt: nowIso(), taskCount: 0, reviewTaskCount: 0, rejectedSourceCount: 0, captureCount: 0, incidentCount: 0 } as CollectionRun;
}
