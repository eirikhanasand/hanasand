import type { MarketplaceRow } from "./types.ts";

export function liveDataMetrics(rows: MarketplaceRow[]) {
  const liveRows = rows.filter((row) => row.liveDataReal);
  const sellableLiveRows = liveRows.filter((row) => row.paidRowDecision === "sellable");
  const recentPayworthyLiveRows = sellableLiveRows.filter(isStrictRecentPayworthySellableRow);
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

export function isStrictRecentPayworthySellableRow(row: MarketplaceRow): boolean {
  return row.billingGuidance === "charge" &&
    row.buyerValueScore !== undefined &&
    row.buyerValueScore >= 0.7 &&
    row.paidRowDecision === "sellable" &&
    isStrictHostedSource(row) &&
    isStrictActivityFinding(row) &&
    !hasStrictTestMarker(row) &&
    (row.freshnessStatus === "current" || row.freshnessStatus === "recent") &&
    row.fixtureBacked !== true &&
    row.defaultWatchlistBacked !== true;
}

export function strictSellableRowRejectionReasons(row: MarketplaceRow): string[] {
  return [
    row.paidRowDecision !== "sellable" ? "paid_row_decision_not_sellable" : null,
    row.billingGuidance !== "charge" ? "billing_guidance_not_charge" : null,
    row.buyerValueScore === undefined || row.buyerValueScore < 0.7 ? "buyer_value_score_below_0_7" : null,
    !isStrictHostedSource(row) ? "missing_hosted_source_url" : null,
    !isStrictActivityFinding(row) ? "not_strict_activity_finding" : null,
    hasStrictTestMarker(row) ? "test_or_fixture_marker" : null,
    row.freshnessStatus !== "current" && row.freshnessStatus !== "recent" ? "not_current_or_recent" : null,
    row.fixtureBacked === true ? "fixture_backed" : null,
    row.defaultWatchlistBacked === true ? "default_watchlist_backed" : null
  ].filter((reason): reason is string => Boolean(reason));
}

export function isStrictActivityFinding(row: MarketplaceRow): boolean {
  if (row.rowType !== "activity" || !row.sourceUrl) return false;
  if (row.claimType === "victim_claim") return Boolean(row.victimName);
  if (row.claimType === "vulnerability_disclosure") return Boolean(row.attackId);
  return false;
}

function isStrictHostedSource(row: MarketplaceRow): boolean {
  if (row.liveDataReal !== true) return false;
  if (!row.sourceUrl || !/^https?:\/\//i.test(row.sourceUrl)) return false;
  return Boolean(row.distinctHostedSourceKey || row.sourceName);
}

function hasStrictTestMarker(row: MarketplaceRow): boolean {
  return /\b(test|example|fixture|demo|sample)\b/i.test([row.title, row.summary, row.victimName, row.actor, row.query].join(" "));
}
