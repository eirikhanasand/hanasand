import type { CollectedItem, ExtractedEntity, RawCapture } from "../types.ts";
import { extractActorBusinessEvidence } from "./actorBusinessEvidence.ts";
import { extractEntities, type ExtractionContext } from "./extractors.ts";
import type { ActorIdentityRecord } from "./mitreActorCatalog.ts";
import { extractSourceSpecificEntities } from "./sourceSpecificExtraction.ts";

const BUSINESS_TYPES = new Set([
  "extortion_model", "advertised_product", "advertised_data", "pricing_claim", "payment_claim", "revenue_claim",
  "revenue_share_claim", "negotiation_claim", "communication_channel", "buyer_seller_communication", "intermediary_communication", "monetization_path",
  "victim_pressure_tactic", "profitability_signal",
]);

export function actorBusinessEntitiesFromRetainedCapture(capture: RawCapture, actorIdentities: ActorIdentityRecord[] = []): ExtractedEntity[] {
  const group = capture.metadata?.ransomwareGroup;
  const groupProfile = capture.metadata?.extractionProfile === "ransomware_group_metadata" && typeof group?.description === "string" && group.description.trim();
  const retainedFeedText = typeof capture.metadata?.safeExcerpt === "string" && capture.metadata.safeExcerpt.trim() || typeof capture.body === "string" && capture.body.trim();
  const feedProfile = capture.metadata?.feedItem === true && retainedFeedText;
  const rawText = groupProfile ? group.description : feedProfile ? retainedFeedText : undefined;
  if (!rawText || !extractActorBusinessEvidence(rawText).length) return [];
  const item: CollectedItem = {
    tenantId: capture.tenantId,
    sourceId: capture.sourceId,
    taskId: capture.taskId,
    url: capture.url,
    title: capture.metadata?.title,
    rawText,
    collectedAt: capture.collectedAt,
    publishedAt: capture.publishedAt,
    contentHash: capture.contentHash,
    links: [],
    metadata: capture.metadata,
    sensitive: capture.sensitive,
  };
  const context: ExtractionContext = {
    sourceId: capture.sourceId,
    captureId: capture.id,
    url: capture.url,
    collectedAt: capture.collectedAt,
    contentHash: capture.contentHash,
  };
  const fallbackEntities = extractEntities(rawText, context, actorIdentities);
  return extractSourceSpecificEntities(item, context, actorIdentities, fallbackEntities).filter(entity =>
    BUSINESS_TYPES.has(entity.type) || (!groupProfile && entity.type === "actor")
  );
}

export function actorBusinessLineageCounts(
  store: { listExtractedEntities(): any[]; listClaimEvidence(): any[] },
  captureIds: Set<string>,
) {
  const entities = store.listExtractedEntities().filter((row: any) =>
    captureIds.has(row.captureId)
    && row.extractorVersion === "ti-source-specific-extractor-v3"
    && BUSINESS_TYPES.has(row.type)
  );
  const entityIds = new Set(entities.map((row: any) => row.id));
  const evidence = store.listClaimEvidence().filter((row: any) => row.subjectType === "entity" && entityIds.has(row.subjectId));
  return { entities: entities.length, claims: new Set(evidence.map((row: any) => row.claimId)).size, claimEvidence: evidence.length };
}
