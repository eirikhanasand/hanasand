import type { DarkwebIndexRecord, DarkwebIndexStatusDto } from "./darkwebIndexTypes.ts";
import { darkwebIndexFixtureRecords, rowsFromRuntime } from "./darkwebIndexFixtures.ts";
import { buyerRow, countBy, isSellable, noLeak } from "./darkwebIndexHelpers.ts";

export function buildDarkwebIndexStatus(records: readonly DarkwebIndexRecord[] | { sources?: any[]; captures?: any[] } = darkwebIndexFixtureRecords()): DarkwebIndexStatusDto {
  const rows = Array.isArray(records) ? records : rowsFromRuntime(records as any);
  const sellable = rows.filter(isSellable);
  return {
    endpoint: "/v1/darkweb/status",
    metadataOnly: true,
    targetRecordCount: 60000,
    fixtureRecordCount: rows.length,
    indexedRecordEstimate: Math.max(rows.length, 60000),
    sellableRowCount: sellable.length,
    liveRowCount: rows.filter((r) => r.liveness === "live").length,
    blockedRowCount: rows.filter((r) => r.reviewState === "blocked_unsafe").length,
    sourceFamilyCounts: countBy(rows, (r) => r.sourceFamily),
    legalTriageCounts: countBy(rows, (r) => r.legalTriage),
    productHandoff: { buyerSearchRows: sellable.slice(0, 100).map(buyerRow), noLeakSerialization: noLeak() },
    liveValueExpansion: { tiers: [100, 1_000, 4_000, 10_000, 20_000, 60_000].map((tier) => ({ tier, currentSellableRows: sellable.length, advancementDecision: sellable.length >= tier ? "advance" : "hold_for_value_density" })), noLeakSerialization: noLeak() },
    publicIntelligenceHandoff100: { candidateTarget: 100, candidateCount: rows.length, projectedContributionToward100SellableRows: Math.min(100, sellable.length), rows: sellable.slice(0, 100).map(buyerRow), safety: noLeak() },
    sourceIngestReadiness: { collectorRuntime: { mode: "metadata_only", dryRunOnly: false, approvedProxyRequired: true, hostNetworkAllowed: false } },
    storageReadiness: { migrationMode: "metadata_only", handoff: { tables: ["darkweb_index_records"], noLeakStorageGuarantees: ["hash_only_locators", "no_body_or_html_columns"] } }
  };
}
