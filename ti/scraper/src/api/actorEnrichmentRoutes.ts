import { actorEnrichmentRun, actorEnrichmentRunSummary, actorProfileTimeline, type ActorEnrichmentRun } from "../product/actorEnrichment.ts";
import { error, json, readJson } from "./http.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

async function records(store: any, method: string): Promise<any[]> {
  const value = typeof store[method] === "function" ? store[method]() : [];
  return Array.isArray(value) ? value : await value;
}

async function scopedRuns(store: any, tenantId?: string): Promise<ActorEnrichmentRun[]> {
  return (await records(store, "listActorEnrichmentRuns")).filter((run) => inTenantScope(run, tenantId));
}

function runFromData(tenantId: string | undefined, profiles: any[], deltas: any[], previous?: ActorEnrichmentRun | null, link: "resumeOf" | "retryOf" = "resumeOf") {
  const startedAt = new Date().toISOString();
  const changedFieldCount = deltas.reduce((count, delta) => {
    const metadata = delta.metadata && typeof delta.metadata === "object" ? delta.metadata : {};
    return count + Object.keys(metadata.characterization && typeof metadata.characterization === "object" ? metadata.characterization : {}).length + (Array.isArray(metadata.aliasesAdded) ? metadata.aliasesAdded.length : 0);
  }, 0);
  const run = actorEnrichmentRun({
    tenantId,
    status: "completed",
    startedAt,
    finishedAt: new Date().toISOString(),
    actorCount: profiles.length,
    sourceCount: new Set(deltas.map((delta) => delta.sourceId).filter(Boolean)).size,
    changedFieldCount,
    evidenceCount: new Set(deltas.flatMap((delta) => Array.isArray(delta.captureIds) ? delta.captureIds : [])).size,
    failureCount: 0,
    errorCategories: [],
    cursor: profiles.length,
    ...(previous ? { [link]: previous.id } : {}),
  });
  return run;
}

export async function handleActorEnrichmentRequest(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const url = new URL(request.url);
  const isStatus = url.pathname === "/v1/intel/actor-enrichment/status" && request.method === "GET";
  const isRuns = url.pathname === "/v1/intel/actor-enrichment/runs";
  const isTimeline = /^\/v1\/intel\/actor-profiles\/[^/]+\/timeline$/.test(url.pathname) && request.method === "GET";
  if (!isStatus && !isRuns && !isTimeline) return undefined;
  const body = request.method === "POST" ? await readJson<any>(request) : undefined;
  const scope = resolveTenantScope(request, url, body?.tenantId);
  if (scope.error) return scope.error;
  const tenantId = scope.tenantId;
  const store = options.store as any;

  if (isTimeline) {
    const actorId = decodeURIComponent(url.pathname.split("/")[4] ?? "");
    const deltas = (await records(store, "listEvidenceDeltas"))
      .filter((delta) => delta.subjectType === "actor_profile" && delta.subjectId === actorId && inTenantScope(delta, tenantId))
      .sort((left, right) => String(right.observedAt ?? "").localeCompare(String(left.observedAt ?? "")));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 25)));
    const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0));
    const rows = deltas.slice(offset, offset + limit).map(actorProfileTimeline);
    const nextCursor = offset + rows.length < deltas.length ? String(offset + rows.length) : undefined;
    const previousCursor = offset > 0 ? String(Math.max(0, offset - limit)) : undefined;
    return json({ schemaVersion: "ti.actor_profile_timeline.v1", actorId, updates: rows, rows, total: deltas.length, nextCursor, previousCursor, pagination: { limit, cursor: String(offset), nextCursor, previousCursor, appliedFilters: { actorId }, sortField: "observedAt", direction: "desc" } });
  }

  if (isStatus) {
    const runs = await scopedRuns(store, tenantId);
    const latest = runs[0];
    const running = runs.find((run) => run.status === "running");
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
    const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0));
    const pageRuns = runs.slice(offset, offset + limit);
    const nextCursor = offset + pageRuns.length < runs.length ? String(offset + pageRuns.length) : undefined;
    const previousCursor = offset > 0 ? String(Math.max(0, offset - limit)) : undefined;
    return json({
      schemaVersion: "ti.actor_enrichment_status.v1",
      generatedAt: new Date().toISOString(),
      worker: {
        state: running ? "active" : "idle",
        lastRunAt: latest?.finishedAt ?? null,
        lastSuccessfulRunAt: runs.find((run) => run.status === "completed")?.finishedAt ?? null,
        currentFailure: latest?.status === "failed" ? latest.error : null,
        snapshotFresh: Boolean(latest && Date.now() - Date.parse(latest.updatedAt) <= 300_000),
      },
      latestRun: actorEnrichmentRunSummary(latest),
      runs: pageRuns.map(actorEnrichmentRunSummary),
      rows: pageRuns.map(actorEnrichmentRunSummary),
      total: runs.length,
      nextCursor,
      previousCursor,
      pagination: { limit, cursor: String(offset), nextCursor, previousCursor, appliedFilters: {}, sortField: "updatedAt", direction: "desc" },
      queued: 0,
    });
  }

  if (request.method === "GET") {
    const runs = await scopedRuns(store, tenantId);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 25)));
    const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0));
    const rows = runs.slice(offset, offset + limit).map(actorEnrichmentRunSummary);
    const nextCursor = offset + rows.length < runs.length ? String(offset + rows.length) : undefined;
    const previousCursor = offset > 0 ? String(Math.max(0, offset - limit)) : undefined;
    return json({ runs: rows, rows, total: runs.length, nextCursor, previousCursor, pagination: { limit, cursor: String(offset), nextCursor, previousCursor, appliedFilters: { tenantId: tenantId ?? "" }, sortField: "updatedAt", direction: "desc" } });
  }

  if (request.method !== "POST") return error("method_not_allowed", "Method not allowed", 405);
  const profiles = (await records(store, "listActorProfiles")).filter((profile) => inTenantScope(profile, tenantId));
  const deltas = (await records(store, "listEvidenceDeltas"))
    .filter((delta) => delta.subjectType === "actor_profile" && inTenantScope(delta, tenantId));
  const runs = await scopedRuns(store, tenantId);
  const previous = body?.runId ? runs.find((run) => run.id === body.runId) : runs[0];
  const link = body?.action === "retry" ? "retryOf" : "resumeOf";
  const run = runFromData(tenantId, profiles, deltas, body?.action === "retry" || body?.action === "resume" ? previous : null, link);
  store.saveActorEnrichmentRun(run);
  return json({ run: actorEnrichmentRunSummary(run) }, 201);
}
