import { paginationCursor } from "./pagination.ts";
import { actorEnrichmentRunSummary, actorProfileTimeline, type ActorEnrichmentRun } from "../product/actorEnrichment.ts";
import { error, json, readJson } from "./http.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { decodeKeysetCursor, legacyOffset } from "./pagination.ts";

async function records(store: any, method: string): Promise<any[]> {
  const value = typeof store[method] === "function" ? store[method]() : [];
  return Array.isArray(value) ? value : await value;
}

async function scopedRuns(store: any, tenantId?: string): Promise<ActorEnrichmentRun[]> {
  return (await records(store, "listActorEnrichmentRuns")).filter((run) => inTenantScope(run, tenantId));
}


export async function handleActorEnrichmentRequest(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const url = new URL(request.url);
  const isHealth = url.pathname === "/v1/intel/operations/health" && request.method === "GET";
  const isOverview = url.pathname === "/v1/intel/actor-enrichment/overview" && request.method === "GET";
  const isStatus = url.pathname === "/v1/intel/actor-enrichment/status" && request.method === "GET";
  const isRuns = url.pathname === "/v1/intel/actor-enrichment/runs";
  const isTimeline = /^\/v1\/intel\/actor-profiles\/[^/]+\/timeline$/.test(url.pathname) && request.method === "GET";
  if (!isHealth && !isOverview && !isStatus && !isRuns && !isTimeline) return undefined;
  const body = request.method === "POST" ? await readJson<any>(request) : undefined;
  const scope = resolveTenantScope(request, url, body?.tenantId);
  if (scope.error) return scope.error;
  const tenantId = scope.tenantId;
  const store = options.store as any;

  if (isHealth) {
    const data = await store.queryIntelWorkerHealth();
    const at = data.collection?.at;
    const ageSeconds = at ? Math.max(0, (Date.now() - Date.parse(at)) / 1000) : null;
    const runs = data.enrichment;
    const profiles = new Set(runs.flatMap((run: any) => run.changedActorIds ?? [])).size;
    const newFacts = runs.reduce((n: number, run: any) => n + Number(run.newFacts ?? 0), 0);
    const wordsAdded = runs.reduce((n: number, run: any) => n + Number(run.wordsAdded ?? 0), 0);
    const last = runs[0];
    const workerRunning = Boolean(last && Date.now() - Date.parse(last.updatedAt) < 3_600_000);
    return json({ generatedAt: new Date().toISOString(),
      collection: { critical: ageSeconds === null || ageSeconds > 300, lastRunAt: at, ageSeconds, thresholdSeconds: 300, runId: data.collection?.id },
      enrichment: { critical: !workerRunning || profiles === 0 || newFacts === 0, workerRunning,
        profilesEditedLastHour: profiles, newFactsLastHour: newFacts, wordsAddedLastHour: wordsAdded,
        lastRunAt: last?.updatedAt ?? null, error: last?.error ?? null,
        profiles: runs.filter((run: any) => run.newFacts > 0).map((run: any) => ({ actorId: run.actorId, wordsAdded: run.wordsAdded, newFacts: run.newFacts })) }
    });
  }

  if (isOverview) {
    const started = performance.now();
    const result = await store.queryEnrichmentOverview(tenantId ?? "default", url.searchParams.get("q") ?? "");
    const latest = result.runs[0];
    const recent = result.runs.filter((run: any) => Date.now() - Date.parse(run.finishedAt ?? run.startedAt) < 3_600_000);
    const response = json({ profiles: result.profiles, updates: result.updates, status: {
      worker: { state: latest && Date.now() - Date.parse(latest.updatedAt) < 3_600_000 ? "active" : result.queued ? "unavailable" : "idle",
        lastRunAt: latest?.finishedAt, lastSuccessfulRunAt: result.runs.find((run: any) => run.status === "completed")?.finishedAt,
        currentFailure: latest?.status === "failed" ? latest.error : null, snapshotFresh: Boolean(latest && Date.now() - Date.parse(latest.updatedAt) < 300_000) },
      latestRun: actorEnrichmentRunSummary(latest), queued: result.queued ?? 0,
      productivity: { profiles: new Set(recent.flatMap((run: any) => run.changedActorIds ?? [])).size,
        wordsAdded: recent.reduce((n: number, run: any) => n + Number(run.wordsAdded ?? 0), 0),
        newFacts: recent.reduce((n: number, run: any) => n + Number(run.newFacts ?? 0), 0) }
    } });
    response.headers.set("server-timing", `ti;dur=${(performance.now() - started).toFixed(2)};desc="Query and JSON serialization"`);
    return response;
  }

  if (isTimeline) {
    const actorId = decodeURIComponent(url.pathname.split("/")[4] ?? "");
    const deltas = (await records(store, "listEvidenceDeltas"))
      .filter((delta) => delta.subjectType === "actor_profile" && delta.subjectId === actorId && inTenantScope(delta, tenantId))
      .sort((left, right) => String(right.observedAt ?? "").localeCompare(String(left.observedAt ?? "")));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 25)));
    const rawCursor = paginationCursor(url.searchParams, limit);
    const offset = legacyOffset(rawCursor);
    const cursor = decodeKeysetCursor(rawCursor);
    const rows = deltas.slice(offset, offset + limit).map(actorProfileTimeline);
    const nextCursor = offset + rows.length < deltas.length ? String(offset + rows.length) : undefined;
    const previousCursor = offset > 0 ? String(Math.max(0, offset - limit)) : undefined;
    return json({ schemaVersion: "ti.actor_profile_timeline.v1", actorId, updates: rows, rows, total: deltas.length, nextCursor, previousCursor, pagination: { limit, cursor: String(offset), nextCursor, previousCursor, appliedFilters: { actorId }, sortField: "observedAt", direction: "desc" } });
  }

  if (isStatus) {
    const runs = typeof store.queryActorEnrichmentRuns === "function" ? (await store.queryActorEnrichmentRuns({ tenantId, limit: 100 })).records : await scopedRuns(store, tenantId);
    const latest = runs[0];
    const running = runs.find((run) => run.status === "running");
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
    const offset = Math.max(0, Number(paginationCursor(url.searchParams, limit) ?? 0));
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
      queued: Number((latest as any)?.queued ?? 0),
    });
  }

  if (request.method === "GET") {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 25)));
    const rawCursor = paginationCursor(url.searchParams, limit);
    const offset = legacyOffset(rawCursor);
    const cursor = decodeKeysetCursor(rawCursor);
    const paged = typeof store.queryActorEnrichmentRuns === "function"
      ? await store.queryActorEnrichmentRuns({ tenantId, limit, offset, cursor: cursor ? rawCursor : undefined })
      : null;
    const runs = paged ? paged.records : await scopedRuns(store, tenantId);
    const rows = (paged ? runs : runs.slice(offset, offset + limit)).map(actorEnrichmentRunSummary);
    const total = paged?.total ?? runs.length;
    const nextCursor = paged?.nextCursor ?? (offset + rows.length < total ? String(offset + rows.length) : undefined);
    const previousCursor = offset > 0 ? String(Math.max(0, offset - limit)) : undefined;
    return json({ runs: rows, rows, total, nextCursor, previousCursor, pagination: { limit, cursor: String(offset), nextCursor, previousCursor, appliedFilters: { tenantId: tenantId ?? "" }, sortField: "updatedAt", direction: "desc" } });
  }

  if (request.method !== "POST") return error("method_not_allowed", "Method not allowed", 405);
  const worker = (options as any).actorEnrichmentWorker;
  if (!worker) return error("enrichment_unavailable", "The GPU enrichment worker is unavailable.", 503);
  worker.run();
  return json({ accepted: true, status: "queued" }, 202);
}
