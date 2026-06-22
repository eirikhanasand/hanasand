import type { MarketplaceRow } from "./types.ts";

export function liveDataMetrics(rows: MarketplaceRow[]) {
  const liveRows = rows.filter((row) => row.liveDataReal);
  const sellableLiveRows = liveRows.filter((row) => row.paidRowDecision === "sellable");
  const recentPayworthyLiveRows = sellableLiveRows.filter(isRecentPayworthy);
  const sourceKeys = new Set(liveRows.map((row) => row.distinctHostedSourceKey).filter(Boolean));
  const recentPayworthySourceKeys = new Set(recentPayworthyLiveRows.map((row) => row.distinctHostedSourceKey).filter(Boolean));
  return {
    liveDataRealRowCount: liveRows.length,
    sellableLiveDataRealRowCount: sellableLiveRows.length,
    recentPayworthyLiveDataRealRowCount: recentPayworthyLiveRows.length,
    distinctHostedSourceFindingCount: sourceKeys.size,
    distinctRecentPayworthyHostedSourceFindingCount: recentPayworthySourceKeys.size,
    fixtureBackedRowCount: rows.filter((row) => row.fixtureBacked).length,
    defaultWatchlistBackedRowCount: rows.filter((row) => row.defaultWatchlistBacked).length
  };
}

function isRecentPayworthy(row: MarketplaceRow): boolean {
  return row.billingGuidance === "charge" &&
    row.buyerValueScore !== undefined &&
    row.buyerValueScore >= 0.7 &&
    isStrictActivityFinding(row) &&
    !hasTestMarker(row) &&
    (row.freshnessStatus === "current" || row.freshnessStatus === "recent") &&
    row.fixtureBacked !== true &&
    row.defaultWatchlistBacked !== true;
}

function isStrictActivityFinding(row: MarketplaceRow): boolean {
  if (row.rowType !== "activity" || !row.sourceUrl) return false;
  if (row.claimType === "victim_claim") return Boolean(row.victimName);
  if (row.claimType === "vulnerability_disclosure") return Boolean(row.attackId);
  return false;
}

function hasTestMarker(row: MarketplaceRow): boolean {
  return /\b(test|example|fixture|demo|sample)\b/i.test([row.title, row.summary, row.victimName, row.actor, row.query].join(" "));
}
