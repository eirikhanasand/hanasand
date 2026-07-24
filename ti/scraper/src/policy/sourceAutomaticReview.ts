import { createHash } from "node:crypto";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";

export const AUTOMATIC_REVIEW_PROMPT_VERSION = "ti.automatic_intelligence_review.prompt.v7";
export const SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION = "ti.automatic_intelligence_review.prompt.v6";
export const AUTOMATIC_REVIEW_RESPONSE_SCHEMA = "ti.automatic_intelligence_review.response.v1";
export const SOURCE_AUTOMATIC_REVIEW_SCHEMA = "ti.automatic_source_review.v1";

export function automaticReviewModelVersion(explicit?: unknown) {
  return cleanModelVersion(explicit) ?? cleanModelVersion(Bun.env.HANASAND_AI_MODEL) ?? "hanasand";
}

export function sourceRequiresAutomaticReview(source: any) {
  return Boolean(source?.metadata?.sourcePortfolioVerification || source?.metadata?.sourceFeedDiscovery);
}

export function automaticSourceReviewIdentity(source: any) {
  const identity = {
    sourceId: String(source?.id ?? ""),
    tenantKey: String(source?.tenantId ?? "global"),
    canonicalFeedKey: canonicalFeedKey(String(source?.url ?? "")),
    createdAt: String(source?.createdAt ?? "")
  };
  return { ...identity, sha256: createHash("sha256").update(JSON.stringify(identity)).digest("hex") };
}

export function sourceAutomaticReviewIdentityMatches(source: any, review = source?.metadata?.automaticSourceReview) {
  const identity = automaticSourceReviewIdentity(source);
  return review?.sourceIdentity?.sourceId === identity.sourceId
    && review.sourceIdentity.tenantKey === identity.tenantKey
    && review.sourceIdentity.canonicalFeedKey === identity.canonicalFeedKey
    && review.sourceIdentity.createdAt === identity.createdAt
    && review.sourceIdentity.sha256 === identity.sha256;
}

export function sourceAutomaticReviewEvidenceBound(review: any) {
  const ids = review?.selectedEvidenceIds;
  const provenance = review?.selectedEvidenceProvenance;
  if (!Array.isArray(ids) || !ids.length || !Array.isArray(provenance) || provenance.length !== ids.length) return false;
  const selected = new Set(ids);
  const bound = new Set(provenance.map((item: any) => item?.evidenceId));
  return selected.size === ids.length
    && bound.size === provenance.length
    && ids.every((id: unknown) => bound.has(id))
    && provenance.every((item: any) =>
    selected.has(item?.evidenceId)
    && /^[A-Za-z0-9_.:-]{1,200}$/.test(String(item?.sourceId ?? ""))
    && /^[A-Za-z0-9_.:-]{1,200}$/.test(String(item?.tenantKey ?? ""))
    && /^[A-Za-z0-9_.:-]{1,200}$/.test(String(item?.captureId ?? ""))
    && /^[A-Za-z0-9_.:-]{1,200}$/.test(String(item?.contentHash ?? ""))
    && /^[a-f0-9]{64}$/.test(String(item?.captureStateSha256 ?? "")));
}

export function hasApprovedAutomaticSourceReview(source: any, modelVersion = automaticReviewModelVersion()) {
  if (!sourceRequiresAutomaticReview(source)) return true;
  const review = source?.metadata?.automaticSourceReview;
  return review?.schemaVersion === SOURCE_AUTOMATIC_REVIEW_SCHEMA
    && review?.state === "approved"
    && review?.promptVersion === SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION
    && review?.configuredModelVersion === modelVersion
    && review?.decision?.subject?.type === "source"
    && review?.decision?.subject?.id === source.id
    && review?.decision?.action === "confirm"
    && review?.decision?.claimValidity === "supported"
    && sourceAutomaticReviewIdentityMatches(source, review)
    && review?.runtimeIdentity?.status === "completed"
    && typeof review?.runtimeIdentity?.conversationId === "string"
    && review.runtimeIdentity.conversationId.length > 0
    && /^[a-f0-9]{64}$/.test(String(review?.requestSha256 ?? ""))
    && sourceAutomaticReviewEvidenceBound(review);
}

function cleanModelVersion(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_.:@/-]{1,120}$/.test(text) ? text : undefined;
}
