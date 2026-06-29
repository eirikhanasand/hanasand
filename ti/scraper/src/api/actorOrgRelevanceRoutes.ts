import {
  actorOrgRelevanceRecordBelongsTo,
  buildActorOrgRelevanceQueue,
  buildActorOrgRelevanceReviewRecord,
  createActorOrgRelevanceAlertGenerationRequest,
  createActorOrgRelevanceCaseHandoffRequest,
  createActorOrgRelevanceWebhookTriggerRequest,
  materializeActorOrgRelevanceWatchlist,
  summarizeActorOrgRelevanceReview,
  updateActorOrgRelevanceReviewWorkflow,
  type ActorOrgRelevanceReviewRecord
} from "../product/actorOrgRelevanceQueue.ts";
import type { PublicTiOrgRelevanceProofLike } from "../product/analystHandoff.ts";
import { nowIso } from "../utils.ts";
import { error, json, page, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export async function submitActorOrgRelevanceReview(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<{
    tenantId?: string;
    organizationId?: string;
    requestedByUserId?: string;
    orgRelevance?: PublicTiOrgRelevanceProofLike;
    staleEvidenceBefore?: string;
    generatedAt?: string;
  }>(request);
  if (!body.orgRelevance) return error("missing_org_relevance", "Submit an orgRelevance payload from the public TI actor response.", 400);

  const tenantId = body.tenantId || request.headers.get("x-tenant-id") || undefined;
  const organizationId = body.organizationId || request.headers.get("x-organization-id") || undefined;
  const existing = findExistingReview(options, body.orgRelevance, tenantId, organizationId);
  const record = buildActorOrgRelevanceReviewRecord({
    tenantId,
    organizationId,
    requestedByUserId: body.requestedByUserId || request.headers.get("x-actor-id") || undefined,
    orgRelevance: body.orgRelevance,
    staleEvidenceBefore: body.staleEvidenceBefore,
    generatedAt: body.generatedAt || nowIso(),
    existing
  });
  if (!record.organizationId) return error("missing_org", "Actor relevance review requires an organization id.", 400);
  (options.store as any).saveActorOrgRelevanceReview(record);
  return json({
    record,
    summary: summarizeActorOrgRelevanceReview(record)
  }, existing ? 200 : 201);
}

export function listActorOrgRelevanceReviews(url: URL, options: ApiServerOptions, request: Request): Response {
  const scope = actorOrgScope(url, request);
  if (!scope.organizationId) return error("missing_org", "organizationId is required to list actor relevance reviews.", 400);
  const records = ((options.store as any).listActorOrgRelevanceReviews?.() ?? []) as ActorOrgRelevanceReviewRecord[];
  const queue = buildActorOrgRelevanceQueue({
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    records,
    generatedAt: url.searchParams.get("generatedAt") || undefined,
    state: stateParam(url.searchParams.get("state")),
    workflowStatus: workflowStatusParam(url.searchParams.get("workflowStatus")),
    query: url.searchParams.get("q") || undefined
  });
  return json({ ...queue, records: page(queue.records, url) });
}

export function getActorOrgRelevanceReview(url: URL, options: ApiServerOptions, id: string | undefined, request: Request): Response {
  if (!id) return error("missing_review_id", "Actor relevance review id is required.", 400);
  const scope = actorOrgScope(url, request);
  if (!scope.organizationId) return error("missing_org", "organizationId is required to fetch actor relevance review detail.", 400);
  const record = (options.store as any).getActorOrgRelevanceReview?.(id) as ActorOrgRelevanceReviewRecord | undefined;
  if (!actorOrgRelevanceRecordBelongsTo(record, scope)) return error("not_found", "Actor relevance review not found.", 404);
  return json({
    record,
    summary: summarizeActorOrgRelevanceReview(record!)
  });
}

export async function updateActorOrgRelevanceReview(request: Request, options: ApiServerOptions, id: string | undefined): Promise<Response> {
  if (!id) return error("missing_review_id", "Actor relevance review id is required.", 400);
  const url = new URL(request.url);
  const scope = actorOrgScope(url, request);
  if (!scope.organizationId) return error("missing_org", "organizationId is required to update actor relevance review workflow.", 400);
  const record = (options.store as any).getActorOrgRelevanceReview?.(id) as ActorOrgRelevanceReviewRecord | undefined;
  if (!actorOrgRelevanceRecordBelongsTo(record, scope)) return error("not_found", "Actor relevance review not found.", 404);
  const body = await readJson<any>(request);
  const update = updateActorOrgRelevanceReviewWorkflow(record!, {
    action: body.action,
    actorId: body.actorId || request.headers.get("x-actor-id") || undefined,
    assignedTo: body.assignedTo,
    decision: body.decision,
    rationale: body.rationale,
    note: body.note,
    generatedAt: body.generatedAt || nowIso()
  });
  if (!update.ok) return error(update.code, update.message, 400);
  (options.store as any).saveActorOrgRelevanceReview(update.record);
  return json({
    record: update.record,
    summary: summarizeActorOrgRelevanceReview(update.record)
  });
}

export async function materializeActorOrgRelevanceReviewWatchlist(request: Request, options: ApiServerOptions, id: string | undefined): Promise<Response> {
  if (!id) return error("missing_review_id", "Actor relevance review id is required.", 400);
  const url = new URL(request.url);
  const scope = actorOrgScope(url, request);
  if (!scope.organizationId) return error("missing_org", "organizationId is required to create an actor relevance watchlist.", 400);
  const record = (options.store as any).getActorOrgRelevanceReview?.(id) as ActorOrgRelevanceReviewRecord | undefined;
  if (!actorOrgRelevanceRecordBelongsTo(record, scope)) return error("not_found", "Actor relevance review not found.", 404);
  const body = await readJson<any>(request);
  const watchlistId = body.watchlistId ? String(body.watchlistId) : record!.handoff?.alertGeneration.request.body.watchlistId;
  const existing = watchlistId ? (options.store as any).getDwmWatchlist?.(watchlistId) : undefined;
  if (existing && (existing.tenantId !== record!.tenantId || existing.organizationId !== record!.organizationId)) {
    return error("watchlist_scope_mismatch", "Existing watchlist belongs to another organization scope.", 409);
  }
  const materialized = materializeActorOrgRelevanceWatchlist({
    record: record!,
    existing,
    materialize: {
      actorId: body.actorId || request.headers.get("x-actor-id") || undefined,
      watchlistId,
      webhookDestinationId: body.webhookDestinationId,
      generatedAt: body.generatedAt || nowIso()
    }
  });
  if (!materialized.ok) return error(materialized.code, materialized.message, 400);
  (options.store as any).saveDwmWatchlist(materialized.watchlist);
  (options.store as any).saveActorOrgRelevanceReview(materialized.record);
  return json({
    created: materialized.created,
    watchlist: materialized.watchlist,
    record: materialized.record,
    summary: summarizeActorOrgRelevanceReview(materialized.record)
  }, materialized.created ? 201 : 200);
}

export async function createActorOrgRelevanceReviewAlertGenerationRequest(request: Request, options: ApiServerOptions, id: string | undefined): Promise<Response> {
  if (!id) return error("missing_review_id", "Actor relevance review id is required.", 400);
  const url = new URL(request.url);
  const scope = actorOrgScope(url, request);
  if (!scope.organizationId) return error("missing_org", "organizationId is required to request actor relevance alert generation.", 400);
  const record = (options.store as any).getActorOrgRelevanceReview?.(id) as ActorOrgRelevanceReviewRecord | undefined;
  if (!actorOrgRelevanceRecordBelongsTo(record, scope)) return error("not_found", "Actor relevance review not found.", 404);
  const body = await readJson<any>(request);
  const watchlistId = body.watchlistId ? String(body.watchlistId) : record!.handoff?.alertGeneration.request.body.watchlistId;
  const watchlist = watchlistId ? (options.store as any).getDwmWatchlist?.(watchlistId) : undefined;
  const result = createActorOrgRelevanceAlertGenerationRequest({
    record: record!,
    watchlist,
    request: {
      actorId: body.actorId || request.headers.get("x-actor-id") || undefined,
      generatedAt: body.generatedAt || nowIso()
    }
  });
  if (!result.ok) return error(result.code, result.message, result.code === "watchlist_scope_mismatch" ? 409 : 400);
  (options.store as any).saveActorOrgRelevanceReview(result.record);
  return json({
    created: result.created,
    receipt: result.receipt,
    record: result.record,
    summary: summarizeActorOrgRelevanceReview(result.record)
  }, result.created ? 201 : 200);
}

export async function createActorOrgRelevanceReviewCaseHandoffRequest(request: Request, options: ApiServerOptions, id: string | undefined): Promise<Response> {
  if (!id) return error("missing_review_id", "Actor relevance review id is required.", 400);
  const url = new URL(request.url);
  const scope = actorOrgScope(url, request);
  if (!scope.organizationId) return error("missing_org", "organizationId is required to request actor relevance case handoff.", 400);
  const record = (options.store as any).getActorOrgRelevanceReview?.(id) as ActorOrgRelevanceReviewRecord | undefined;
  if (!actorOrgRelevanceRecordBelongsTo(record, scope)) return error("not_found", "Actor relevance review not found.", 404);
  const body = await readJson<any>(request);
  const result = createActorOrgRelevanceCaseHandoffRequest({
    record: record!,
    request: {
      actorId: body.actorId || request.headers.get("x-actor-id") || undefined,
      generatedAt: body.generatedAt || nowIso()
    }
  });
  if (!result.ok) return error(result.code, result.message, 400);
  (options.store as any).saveActorOrgRelevanceReview(result.record);
  return json({
    created: result.created,
    receipt: result.receipt,
    record: result.record,
    summary: summarizeActorOrgRelevanceReview(result.record)
  }, result.created ? 201 : 200);
}

export async function createActorOrgRelevanceReviewWebhookTriggerRequest(request: Request, options: ApiServerOptions, id: string | undefined): Promise<Response> {
  if (!id) return error("missing_review_id", "Actor relevance review id is required.", 400);
  const url = new URL(request.url);
  const scope = actorOrgScope(url, request);
  if (!scope.organizationId) return error("missing_org", "organizationId is required to prepare actor relevance webhook delivery.", 400);
  const record = (options.store as any).getActorOrgRelevanceReview?.(id) as ActorOrgRelevanceReviewRecord | undefined;
  if (!actorOrgRelevanceRecordBelongsTo(record, scope)) return error("not_found", "Actor relevance review not found.", 404);
  const body = await readJson<any>(request);
  const result = createActorOrgRelevanceWebhookTriggerRequest({
    record: record!,
    request: {
      actorId: body.actorId || request.headers.get("x-actor-id") || undefined,
      dryRun: body.dryRun !== false,
      generatedAt: body.generatedAt || nowIso()
    }
  });
  if (!result.ok) return error(result.code, result.message, 400);
  (options.store as any).saveActorOrgRelevanceReview(result.record);
  return json({
    created: result.created,
    receipt: result.receipt,
    record: result.record,
    summary: summarizeActorOrgRelevanceReview(result.record)
  }, result.created ? 201 : 200);
}

function findExistingReview(
  options: ApiServerOptions,
  orgRelevance: PublicTiOrgRelevanceProofLike,
  tenantId: string | undefined,
  organizationId: string | undefined
) {
  const records = ((options.store as any).listActorOrgRelevanceReviews?.() ?? []) as ActorOrgRelevanceReviewRecord[];
  return records.find((record) => record.actorId === orgRelevance.actorId
    && record.query === orgRelevance.query
    && (!tenantId || record.tenantId === tenantId)
    && (!organizationId || record.organizationId === organizationId));
}

function actorOrgScope(url: URL, request: Request) {
  return {
    tenantId: url.searchParams.get("tenantId") || request.headers.get("x-tenant-id") || "default",
    organizationId: url.searchParams.get("organizationId") || request.headers.get("x-organization-id") || ""
  };
}

function stateParam(value: string | null) {
  return value === "ready" || value === "blocked" ? value : undefined;
}

function workflowStatusParam(value: string | null) {
  return value === "new" || value === "reviewing" || value === "escalated" || value === "suppressed" || value === "closed" ? value : undefined;
}
