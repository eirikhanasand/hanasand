import type { MarketplaceRow } from "./types.ts";

export function liveDataMetrics(rows: MarketplaceRow[]) {
  const liveRows = rows.filter((row) => row.liveDataReal);
  const sellableLiveRows = liveRows.filter((row) => row.paidRowDecision === "sellable");
  const sourceKeys = new Set(liveRows.map((row) => row.distinctHostedSourceKey).filter(Boolean));
  return {
    liveDataRealRowCount: liveRows.length,
    sellableLiveDataRealRowCount: sellableLiveRows.length,
    distinctHostedSourceFindingCount: sourceKeys.size,
    fixtureBackedRowCount: rows.filter((row) => row.fixtureBacked).length,
    defaultWatchlistBackedRowCount: rows.filter((row) => row.defaultWatchlistBacked).length
  };
}
