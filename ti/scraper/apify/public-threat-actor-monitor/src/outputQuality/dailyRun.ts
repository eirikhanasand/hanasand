import type { MarketplaceRow } from "../types.ts";

type SourceStats = { sourceName: string; sourceType: MarketplaceRow["sourceType"]; candidateRowsProduced: number; sellableRowsProduced: number; freshCandidateRowsProduced: number; queries: Set<string>; };

export function dailyCollectionRunForRows(rows: MarketplaceRow[]) {
  const candidateRows = rows.filter(isBuyerUsefulCandidate);
  const freshCandidateRows = candidateRows.filter(isFresh);
  const refreshedSources = [...sourceStats(rows).values()]
    .sort(sortSources).slice(0, 8).map((source) => ({ ...source, queries: [...source.queries].sort() }));
  return {
    schemaVersion: "ti.apify_daily_collection_run.v1",
    preset: "100-name-default-watchlist",
    refreshedSourceCount: refreshedSources.length,
    candidateRowsProduced: candidateRows.length,
    freshCandidateRowsProduced: freshCandidateRows.length,
    sellableRowsProduced: rows.filter((row) => row.paidRowDecision === "sellable").length,
    caveatedCandidateRowsProduced: rows.filter((row) => row.paidRowDecision === "included_with_caveat").length,
    refreshedSources,
    nextCollectionAction: candidateRows.length >= 100
      ? "keep daily refresh cadence and measure hosted conversion"
      : "prioritize refreshed sources that produce sellable current rows before diagnostics or coverage gaps"
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
