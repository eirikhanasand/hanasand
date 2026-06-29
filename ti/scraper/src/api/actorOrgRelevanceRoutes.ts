import {
  actorOrgRelevanceRecordBelongsTo,
  buildActorOrgRelevanceQueue,
  buildActorOrgRelevanceReviewRecord,
  summarizeActorOrgRelevanceReview,
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
