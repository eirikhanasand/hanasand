import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { clampNumber, safePublicUrl, sourceType, stableHash } from "../utils.ts";
import { analysisFacetsFor, baseRow, qualityFields, relationshipInsightFields } from "../rowSupport.ts";

export function datasetRows(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow[] {
  return response.datasets.map((dataset) => {
    const quality = qualityFields(response, lastSeen, response.confidence, response.sources.length);
    return {
      ...baseRow(response, generatedAt, lastSeen),
      rowType: "dataset",
      title: dataset.name,
      summary: dataset.coverage,
      datasetName: dataset.name,
      datasetType: dataset.type,
      datasetStatus: dataset.status,
      coverage: dataset.coverage,
      sourceUrl: safePublicUrl(dataset.url),
      sourceType: sourceType(dataset.type),
      confidence: clampNumber(response.confidence, 0, 1),
      ...relationshipInsightFields(response, "dataset", quality, { title: dataset.name, confidence: response.confidence, observedAt: lastSeen }),
      analysisFacets: analysisFacetsFor(response, "dataset", quality, { sourceType: sourceType(dataset.type) }),
      provenanceHash: stableHash([response.query, dataset.name, dataset.type, dataset.coverage, dataset.status].join("|"))
    };
  });
}
