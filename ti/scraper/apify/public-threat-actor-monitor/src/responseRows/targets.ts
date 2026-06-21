import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { clampNumber, stableHash } from "../utils.ts";
import { analysisFacetsFor, baseRow, qualityFields, relationshipInsightFields } from "../rowSupport.ts";

export function targetRows(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow[] {
  return response.targets.map((target) => {
    const quality = qualityFields(response, lastSeen, target.confidence, response.sources.length);
    return {
      ...baseRow(response, generatedAt, lastSeen),
      rowType: "target",
      title: target.sector,
      summary: target.rationale,
      sector: target.sector,
      regions: target.regions,
      confidence: clampNumber(target.confidence, 0, 1),
      ...relationshipInsightFields(response, "target", quality, { affectedSectors: [target.sector], countries: target.regions, title: target.sector, confidence: target.confidence, observedAt: lastSeen }),
      analysisFacets: analysisFacetsFor(response, "target", quality, { affectedSectors: [target.sector] }),
      provenanceHash: stableHash([response.query, target.sector, target.regions.join(","), target.rationale].join("|"))
    };
  });
}
