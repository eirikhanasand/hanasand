import type { MarketplaceRow, TiSearchResponse } from "../types.ts";
import { clampNumber, safeIso, safePublicUrl, sourceType, stableHash } from "../utils.ts";
import { analysisFacetsFor, baseRow, isEvidenceSourceFamily, qualityFields, relationshipInsightFields } from "../rowSupport.ts";

export function activityRows(response: TiSearchResponse, generatedAt: string, lastSeen: string, sourceById: Map<string, TiSearchResponse["sources"][number]>): MarketplaceRow[] {
  return response.recentActivity.map((item) => {
    const itemSources = item.sourceIds.map((id) => sourceById.get(id)).filter(Boolean);
    const source = itemSources.find((candidate) => sourceType(candidate?.type) !== "system") ?? itemSources[0];
    const evidenceCount = itemSources.filter((candidate) => sourceType(candidate?.type) !== "system").length;
    const itemQuality = qualityFields(response, item.date, item.confidence, evidenceCount);
    const activityTtp = response.ttps[0];
    return {
      ...baseRow(response, generatedAt, lastSeen),
      rowType: "activity",
      title: item.title,
      summary: item.detail,
      sourceType: sourceType(source?.type),
      sourceName: source?.name,
      sourceUrl: safePublicUrl(item.url ?? source?.url),
      claimType: item.claimType,
      victimName: item.victimName,
      claimedDate: item.date,
      affectedSectors: item.affectedSectors,
      countries: item.countries,
      impact: item.impact,
      ttp: activityTtp?.name,
      attackId: activityTtp?.attackId,
      tactic: activityTtp?.tactic,
      firstReportedAt: safeIso(item.firstReportedAt ?? "") ?? undefined,
      lastReportedAt: safeIso(item.lastReportedAt ?? "") ?? undefined,
      publisherCount: item.publisherCount ?? evidenceCount,
      corroboratingSourceIds: item.corroboratingSourceIds ?? [],
      contradictingSourceIds: item.contradictingSourceIds ?? [],
      confidence: clampNumber(item.confidence, 0, 1),
      ...itemQuality,
      ...relationshipInsightFields(response, "activity", itemQuality, insight(item, itemSources, activityTtp)),
      analysisFacets: analysisFacetsFor(response, "activity", itemQuality, facets(item, source, activityTtp)),
      provenanceHash: stableHash([response.query, item.title, item.detail, item.date, item.sourceIds.join(","), activityTtp?.attackId ?? ""].join("|"))
    };
  });
}

function insight(item: TiSearchResponse["recentActivity"][number], itemSources: Array<TiSearchResponse["sources"][number] | undefined>, activityTtp: TiSearchResponse["ttps"][number] | undefined) {
  return { claimType: item.claimType, victimName: item.victimName, affectedSectors: item.affectedSectors, countries: item.countries, title: item.title, ttp: activityTtp?.name, attackId: activityTtp?.attackId, tactic: activityTtp?.tactic, sourceFamilies: itemSources.map((candidate) => sourceType(candidate?.type)).filter(isEvidenceSourceFamily), sourceIds: item.sourceIds, contradictingSourceIds: item.contradictingSourceIds, confidence: item.confidence, observedAt: item.date };
}

function facets(item: TiSearchResponse["recentActivity"][number], source: TiSearchResponse["sources"][number] | undefined, activityTtp: TiSearchResponse["ttps"][number] | undefined) {
  return { sourceType: sourceType(source?.type), claimType: item.claimType, victimName: item.victimName, affectedSectors: item.affectedSectors, countries: item.countries, attackId: activityTtp?.attackId, tactic: activityTtp?.tactic };
}
