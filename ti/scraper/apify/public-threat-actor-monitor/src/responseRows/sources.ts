import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { clampNumber, safePublicUrl, sourceType, stableHash } from "../utils.ts";
import { analysisFacetsFor, baseRow, isEvidenceSourceFamily, qualityFields, relationshipInsightFields } from "../rowSupport.ts";

export function sourceRows(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow[] {
  return response.sources.filter((source) => sourceType(source.type) !== "system").map((source) => {
    const quality = qualityFields(response, lastSeen, response.confidence, response.sources.length);
    return {
      ...baseRow(response, generatedAt, lastSeen),
      rowType: "source",
      title: source.name,
      summary: source.provenance,
      sourceType: sourceType(source.type),
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: safePublicUrl(source.url),
      provenance: source.provenance,
      confidence: clampNumber(response.confidence, 0, 1),
      ...relationshipInsightFields(response, "source", quality, { sourceFamilies: [sourceType(source.type)].filter(isEvidenceSourceFamily), sourceIds: [source.id], title: source.name, confidence: response.confidence, observedAt: lastSeen }),
      analysisFacets: analysisFacetsFor(response, "source", quality, { sourceType: sourceType(source.type) }),
      provenanceHash: stableHash([response.query, source.id, source.provenance].join("|"))
    };
  });
}
