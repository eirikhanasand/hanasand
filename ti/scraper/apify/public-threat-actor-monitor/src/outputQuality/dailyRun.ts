import type { MarketplaceRow } from "../types.ts";
import { liveDataMetrics } from "../liveDataMetrics.ts";
import { PRODUCTION_SELLABLE_ROW_FLOOR } from "./readiness.ts";

type SourceStats = { sourceName: string; sourceType: MarketplaceRow["sourceType"]; candidateRowsProduced: number; sellableRowsProduced: number; freshCandidateRowsProduced: number; queries: Set<string>; };

export function dailyCollectionRunForRows(rows: MarketplaceRow[]) {
  const candidateRows = rows.filter(isBuyerUsefulCandidate);
  const freshCandidateRows = candidateRows.filter(isFresh);
  const live = liveDataMetrics(rows);
  const refreshedSources = [...sourceStats(rows).values()]
    .sort(sortSources).slice(0, 8).map((source) => ({ ...source, queries: [...source.queries].sort() }));
  return {
    schemaVersion: "ti.apify_daily_collection_run.v1",
    preset: "ransomlook-ransomwarelive-victim-claims-plus-cve-context",
    refreshedSourceCount: refreshedSources.length,
    candidateRowsProduced: candidateRows.length,
    freshCandidateRowsProduced: freshCandidateRows.length,
    sellableRowsProduced: rows.filter((row) => row.paidRowDecision === "sellable").length,
    liveDataRealRowsProduced: live.liveDataRealRowCount,
    sellableLiveDataRealRowsProduced: live.sellableLiveDataRealRowCount,
    recentPayworthyLiveDataRealRowsProduced: live.recentPayworthyLiveDataRealRowCount,
    distinctHostedSourceFindings: live.distinctHostedSourceFindingCount,
    distinctRecentPayworthyHostedSourceFindings: live.distinctRecentPayworthyHostedSourceFindingCount,
    caveatedCandidateRowsProduced: rows.filter((row) => row.paidRowDecision === "included_with_caveat").length,
    refreshedSources,
    nextCollectionAction: live.recentPayworthyLiveDataRealRowCount >= PRODUCTION_SELLABLE_ROW_FLOOR
      ? "keep the daily refresh running and watch customer searches, exports, and repeat runs"
      : "add more recent public claim and CVE sources so the feed keeps growing with current items"
  };
}

export function isBuyerUsefulCandidate(row: MarketplaceRow): boolean {
  return row.paidRowDecision === "sellable" || row.paidRowDecision === "included_with_caveat";
}

function sourceStats(rows: MarketplaceRow[]): Map<string, SourceStats> {
  const map = new Map<string, SourceStats>();
  for (const row of rows) addRow(map, row);
  return map;
}

function addRow(map: Map<string, SourceStats>, row: MarketplaceRow): void {
  if (!isBuyerUsefulCandidate(row) || row.sourceType === "system") return;
  const sourceName = row.sourceName ?? row.sourceId ?? row.sourceType;
  const key = `${row.sourceType}:${sourceName}`;
  const current = map.get(key) ?? { sourceName, sourceType: row.sourceType, candidateRowsProduced: 0, sellableRowsProduced: 0, freshCandidateRowsProduced: 0, queries: new Set<string>() };
  current.candidateRowsProduced += 1;
  if (row.paidRowDecision === "sellable") current.sellableRowsProduced += 1;
  if (isFresh(row)) current.freshCandidateRowsProduced += 1;
  current.queries.add(row.query);
  map.set(key, current);
}

function isFresh(row: MarketplaceRow): boolean {
  return row.freshnessStatus === "current" || row.freshnessStatus === "recent";
}

function sortSources(left: SourceStats, right: SourceStats): number {
  return right.sellableRowsProduced - left.sellableRowsProduced ||
    right.freshCandidateRowsProduced - left.freshCandidateRowsProduced || right.candidateRowsProduced - left.candidateRowsProduced || left.sourceName.localeCompare(right.sourceName);
}
