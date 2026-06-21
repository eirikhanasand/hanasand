import type { EvidenceSourceFamily, MarketplaceRow, TiSearchResponse } from "../types.ts";

export function expectedSourceFamilies(response: TiSearchResponse): EvidenceSourceFamily[] {
  const query = response.query.toLowerCase();
  const needsPublicChannel = /(lockbit|akira|clop|black basta|play|ransomhub|alphv|hunters|scattered spider|apt42|charming kitten|telegram|ransom)/i.test(query) ||
    response.recentActivity.some((activity) => activity.claimType === "victim_claim");
  return needsPublicChannel ? ["clear_web", "public_channel"] : ["clear_web"];
}

export function coverageStatusFor(freshnessStatus: MarketplaceRow["freshnessStatus"], evidenceCount: number, sourceFamilyCount: number): MarketplaceRow["coverageStatus"] {
  if (evidenceCount === 0) return "no_evidence";
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") return "stale";
  if (sourceFamilyCount < 2) return "thin";
  return "sufficient";
}

export function coverageGapCodesFor(response: TiSearchResponse, freshnessStatus: MarketplaceRow["freshnessStatus"], evidenceCount: number, sourceFamilies: Set<EvidenceSourceFamily>, missingSourceFamilies: string[]): string[] {
  const codes = new Set<string>();
  if (evidenceCount === 0) codes.add("no_public_evidence");
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") codes.add("stale_or_missing_timestamp");
  if (missingSourceFamilies.includes("clear_web")) codes.add("missing_clear_web_evidence");
  if (missingSourceFamilies.includes("public_channel")) codes.add("missing_public_channel_evidence");
  if (sourceFamilies.size === 1 && evidenceCount > 0) codes.add("single_source_family");
  if (response.recentActivity.some((activity) => (activity.contradictingSourceIds?.length ?? 0) > 0)) codes.add("contradicting_public_reports");
  return [...codes].sort();
}
