import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { clampNumber, stableHash } from "../utils.ts";
import { analysisFacetsFor, baseRow, qualityFields, relationshipInsightFields } from "../rowSupport.ts";

export function ttpRows(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow[] {
  return response.ttps.map((ttp) => {
    const quality = qualityFields(response, lastSeen, ttp.confidence, response.sources.length);
    return {
      ...baseRow(response, generatedAt, lastSeen),
      rowType: "ttp",
      title: ttp.name,
      summary: ttp.detail,
      ttp: ttp.name,
      attackId: ttp.attackId,
      tactic: ttp.tactic,
      confidence: clampNumber(ttp.confidence, 0, 1),
      ...relationshipInsightFields(response, "ttp", quality, { ttp: ttp.name, attackId: ttp.attackId, tactic: ttp.tactic, title: ttp.name, confidence: ttp.confidence, observedAt: lastSeen }),
      analysisFacets: analysisFacetsFor(response, "ttp", quality, { attackId: ttp.attackId, tactic: ttp.tactic }),
      provenanceHash: stableHash([response.query, ttp.name, ttp.attackId ?? "", ttp.tactic, ttp.detail].join("|"))
    };
  });
}
