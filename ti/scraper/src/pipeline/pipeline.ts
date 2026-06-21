import type { CollectedItem, PipelineResult } from "../types.ts";
import { extractEntities, extractIndicators, type ExtractionContext } from "./extractors.ts";
import { buildIncidentCandidate } from "./incidentCandidate.ts";
import { buildRawCapture } from "./pipelineCapture.ts";

export function processCollectedItem(item: CollectedItem): PipelineResult {
  const capture = buildRawCapture(item);
  const extractorContext: ExtractionContext = {
    sourceId: item.sourceId,
    captureId: capture.id,
    url: item.url,
    collectedAt: item.collectedAt,
    contentHash: capture.contentHash,
    language: item.language
  };
  const indicators = extractIndicators(item.rawText, extractorContext);
  const entities = extractEntities(item.rawText, extractorContext);
  const incident = buildIncidentCandidate(item, capture.id, indicators, entities);

  return { capture, indicators, entities, incident };
}
