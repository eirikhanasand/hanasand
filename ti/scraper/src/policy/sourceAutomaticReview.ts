export const AUTOMATIC_REVIEW_PROMPT_VERSION = "ti.automatic_intelligence_review.prompt.v7";
export const AUTOMATIC_REVIEW_RESPONSE_SCHEMA = "ti.automatic_intelligence_review.response.v1";
export const SOURCE_AUTOMATIC_REVIEW_SCHEMA = "ti.automatic_source_review.v1";

export function automaticReviewModelVersion(explicit?: unknown) {
  return cleanModelVersion(explicit) ?? cleanModelVersion(Bun.env.HANASAND_AI_MODEL) ?? "hanasand";
}

export function sourceRequiresAutomaticReview(source: any) {
  return Boolean(source?.metadata?.sourcePortfolioVerification || source?.metadata?.sourceFeedDiscovery);
}

export function hasApprovedAutomaticSourceReview(source: any, modelVersion = automaticReviewModelVersion()) {
  if (!sourceRequiresAutomaticReview(source)) return true;
  const review = source?.metadata?.automaticSourceReview;
  return review?.schemaVersion === SOURCE_AUTOMATIC_REVIEW_SCHEMA
    && review?.state === "approved"
    && review?.promptVersion === AUTOMATIC_REVIEW_PROMPT_VERSION
    && review?.configuredModelVersion === modelVersion
    && review?.decision?.subject?.type === "source"
    && review?.decision?.subject?.id === source.id
    && review?.decision?.action === "confirm"
    && review?.decision?.claimValidity === "supported"
    && review?.runtimeIdentity?.status === "completed"
    && typeof review?.runtimeIdentity?.conversationId === "string"
    && review.runtimeIdentity.conversationId.length > 0
    && /^[a-f0-9]{64}$/.test(String(review?.requestSha256 ?? ""))
    && Array.isArray(review?.selectedEvidenceIds)
    && review.selectedEvidenceIds.length > 0;
}

function cleanModelVersion(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_.:@/-]{1,120}$/.test(text) ? text : undefined;
}
