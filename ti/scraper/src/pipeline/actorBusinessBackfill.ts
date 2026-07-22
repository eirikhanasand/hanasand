import type { CollectedItem, ExtractedEntity, RawCapture } from "../types.ts";
import { extractSourceSpecificEntities } from "./sourceSpecificExtraction.ts";

const BUSINESS_TYPES = new Set([
  "extortion_model", "advertised_product", "advertised_data", "pricing_claim", "payment_claim", "revenue_claim",
  "revenue_share_claim", "communication_channel", "buyer_seller_communication", "intermediary_communication", "monetization_path",
  "victim_pressure_tactic", "profitability_signal",
]);

export function actorBusinessEntitiesFromRetainedCapture(capture: RawCapture): ExtractedEntity[] {
  const group = capture.metadata?.ransomwareGroup;
  if (capture.metadata?.extractionProfile !== "ransomware_group_metadata" || typeof group?.description !== "string" || !group.description.trim()) return [];
  const item: CollectedItem = {
    tenantId: capture.tenantId,
    sourceId: capture.sourceId,
    taskId: capture.taskId,
    url: capture.url,
    title: capture.metadata?.title,
    rawText: group.description,
    collectedAt: capture.collectedAt,
    publishedAt: capture.publishedAt,
    contentHash: capture.contentHash,
    links: [],
    metadata: capture.metadata,
    sensitive: capture.sensitive,
  };
  return extractSourceSpecificEntities(item, {
    sourceId: capture.sourceId,
    captureId: capture.id,
    url: capture.url,
    collectedAt: capture.collectedAt,
    contentHash: capture.contentHash,
  }).filter(entity => BUSINESS_TYPES.has(entity.type));
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
