import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { normalizeFacet, uniqueStrings } from "../utils.ts";
import type { qualityFields } from "./qualityFields.ts";

export function analysisFacetsFor(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: { sourceType?: MarketplaceRow["sourceType"]; claimType?: string; victimName?: string; affectedSectors?: string[]; countries?: string[]; attackId?: string; tactic?: string; coverageGapCode?: string; }
): string[] {
  return uniqueStrings([
    `row:${rowType}`,
    `status:${response.status ?? "unknown"}`,
    `freshness:${quality.freshnessStatus}`,
    `evidence:${quality.evidenceGrade}`,
    `coverage:${quality.coverageStatus}`,
    `priority:${quality.collectionPriority}`,
    `action:${quality.recommendedCollectionAction}`,
    context.sourceType ? `source:${context.sourceType}` : undefined,
    context.claimType ? `claim:${context.claimType}` : undefined,
    context.victimName ? "entity:victim" : undefined,
    context.affectedSectors?.length ? "entity:sector" : undefined,
    context.countries?.length ? "entity:country" : undefined,
    context.attackId ? "entity:attack_technique" : undefined,
    context.tactic ? `tactic:${normalizeFacet(context.tactic)}` : undefined,
    context.coverageGapCode ? `gap:${context.coverageGapCode}` : undefined,
    quality.hasPublicChannelCoverage ? "coverage:public_channel_present" : undefined,
    quality.hasDarknetMetadata ? "coverage:darknet_metadata_present" : undefined,
    "safety:metadata_only"
  ].filter((value): value is string => Boolean(value))).sort();
}
