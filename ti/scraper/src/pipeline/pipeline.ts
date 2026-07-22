import type { CollectedItem, PipelineResult } from "../types.ts";
import { extractEntities, extractIndicators, type ExtractionContext } from "./extractors.ts";
import { buildIncidentCandidate } from "./incidentCandidate.ts";
import { buildRawCapture } from "./pipelineCapture.ts";
import { nowIso } from "../utils.ts";
import { extractSourceSpecificEntities } from "./sourceSpecificExtraction.ts";
import type { ActorIdentityRecord } from "./mitreActorCatalog.ts";

export function processCollectedItem(item: CollectedItem, options: { actorIdentities?: ActorIdentityRecord[] } = {}): PipelineResult {
  const processedAt = nowIso();
  const capture = { ...buildRawCapture(item), processedAt };
  const extractorContext: ExtractionContext = {
    sourceId: item.sourceId,
    captureId: capture.id,
    url: item.url,
    collectedAt: item.collectedAt,
    contentHash: capture.contentHash,
    language: item.language
  };
  const indicators = extractIndicators(item.rawText, extractorContext);
  const sourceSpecificEntities = extractSourceSpecificEntities(item, extractorContext, options.actorIdentities);
  const fallbackEntities = extractEntities(item.rawText, extractorContext, options.actorIdentities);
  const authoritativeTypes = item.metadata?.extractionProfile === "ransomware_victim_blog"
    ? new Set(sourceSpecificEntities.filter((entity) => entity.type === "actor" || entity.type === "ransomware_family" || entity.type === "victim").flatMap((entity) => entity.type === "actor" || entity.type === "ransomware_family" ? ["actor", "ransomware_family"] : [entity.type]))
    : new Set<string>();
  const entities = mergeEntities(sourceSpecificEntities, fallbackEntities.filter((entity) => !authoritativeTypes.has(entity.type)));
  capture.metadata = {
    ...capture.metadata,
    extractionMethod: sourceSpecificEntities.length ? "source_specific_with_deterministic_fallback" : "deterministic_fallback",
    sourceSpecificEntityCount: sourceSpecificEntities.length
  };
  const candidate = buildIncidentCandidate(item, capture.id, indicators, entities);
  const incident = candidate ? {
    ...candidate,
    reportedAt: validIso(item.metadata?.reportedAt) ?? validIso(item.metadata?.incidentDate),
    publishedAt: item.publishedAt,
    collectedAt: item.collectedAt,
    processedAt
  } : undefined;

  return { capture, indicators, entities, incident };
}

function mergeEntities(preferred: any[], fallback: any[]): any[] {
  const merged = new Map<string, any>();
  for (const entity of [...preferred, ...fallback]) {
    const key = `${entity.type}:${String(entity.normalizedValue ?? entity.value).trim().toLowerCase()}`;
    const previous = merged.get(key);
    if (!previous) merged.set(key, entity);
    else if ((entity.confidence ?? 0) > (previous.confidence ?? 0)) merged.set(key, { ...entity, provenance: [...(previous.provenance ?? []), ...(entity.provenance ?? [])] });
    else merged.set(key, { ...previous, provenance: [...(previous.provenance ?? []), ...(entity.provenance ?? [])] });
  }
  return [...merged.values()];
}

function validIso(value: unknown): string | undefined {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}
