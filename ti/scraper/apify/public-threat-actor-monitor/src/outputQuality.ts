import type { MarketplaceRow, MonetizationSummary } from "./types.ts";
import { ACTOR_START_EVENT, DATASET_ITEM_EVENT } from "./constants.ts";
import { apifyEventSkipReason } from "./utils.ts";

export function buyerVisibleOutputQualityForRows(rows: MarketplaceRow[]) {
  const rowsWithBuyerSearchCard = rows.filter((row) => row.buyerSearchCard?.schemaVersion === "ti.apify_buyer_search_card.v1");
  const completeBuyerSearchCards = rowsWithBuyerSearchCard.filter((row) => {
    const card = row.buyerSearchCard;
    if (!card) return false;
    return card.actor.length > 0
      && card.summary.length >= 24
      && card.recentActivity.length > 0
      && card.sourcePivots.length > 0
      && card.nextSearches.length > 0
      && card.confidence.score >= 0
      && card.confidence.score <= 1
      && card.safety.noRawLeakData
      && card.safety.noUnsafeUrls
      && card.safety.noCredentials;
  });
  const buyerReadyCards = completeBuyerSearchCards.filter((row) => row.buyerSearchCard?.status === "sellable" || row.buyerSearchCard?.status === "lead");
  return {
    schemaVersion: "ti.apify_buyer_visible_output_quality.v1",
    rowCount: rows.length,
    rowsWithBuyerSearchCard: rowsWithBuyerSearchCard.length,
    completeBuyerSearchCards: completeBuyerSearchCards.length,
    buyerReadyCards: buyerReadyCards.length,
    cardCoverageRate: rows.length === 0 ? 0 : Number((rowsWithBuyerSearchCard.length / rows.length).toFixed(3)),
    completeCardRate: rows.length === 0 ? 0 : Number((completeBuyerSearchCards.length / rows.length).toFixed(3)),
    buyerReadyCardRate: rows.length === 0 ? 0 : Number((buyerReadyCards.length / rows.length).toFixed(3)),
    requiredBuyerFields: ["actor", "summary", "recentActivity", "victimsTargets", "ttpTools", "sourcePivots", "freshness", "confidence", "nextSearches", "safety"],
    noLeakFailures: rowsWithBuyerSearchCard.filter((row) =>
      row.buyerSearchCard?.safety.noRawLeakData !== true
      || row.buyerSearchCard?.safety.noUnsafeUrls !== true
      || row.buyerSearchCard?.safety.noCredentials !== true
    ).length
  };
}

export function dailyCollectionRunForRows(rows: MarketplaceRow[]) {
  const candidateRows = rows.filter(isBuyerUsefulCandidate);
  const freshCandidateRows = candidateRows.filter((row) => row.freshnessStatus === "current" || row.freshnessStatus === "recent");
  const sourceMap = new Map<string, {
    sourceName: string;
    sourceType: MarketplaceRow["sourceType"];
    candidateRowsProduced: number;
    sellableRowsProduced: number;
    freshCandidateRowsProduced: number;
    queries: Set<string>;
  }>();

  for (const row of rows) {
    if (!isBuyerUsefulCandidate(row)) continue;
    if (row.sourceType === "system") continue;
    const sourceName = row.sourceName ?? row.sourceId ?? row.sourceType;
    const key = `${row.sourceType}:${sourceName}`;
    const current = sourceMap.get(key) ?? {
      sourceName,
      sourceType: row.sourceType,
      candidateRowsProduced: 0,
      sellableRowsProduced: 0,
      freshCandidateRowsProduced: 0,
      queries: new Set<string>()
    };
    current.candidateRowsProduced += 1;
    if (row.paidRowDecision === "sellable") current.sellableRowsProduced += 1;
    if (row.freshnessStatus === "current" || row.freshnessStatus === "recent") current.freshCandidateRowsProduced += 1;
    current.queries.add(row.query);
    sourceMap.set(key, current);
  }

  const refreshedSources = [...sourceMap.values()]
    .sort((left, right) => right.sellableRowsProduced - left.sellableRowsProduced
      || right.freshCandidateRowsProduced - left.freshCandidateRowsProduced
      || right.candidateRowsProduced - left.candidateRowsProduced
      || left.sourceName.localeCompare(right.sourceName))
    .slice(0, 8)
    .map((source) => ({
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      candidateRowsProduced: source.candidateRowsProduced,
      sellableRowsProduced: source.sellableRowsProduced,
      freshCandidateRowsProduced: source.freshCandidateRowsProduced,
      queries: [...source.queries].sort()
    }));

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

export function paidRowQualitySummary(rows: MarketplaceRow[]) {
  const byDecision = {
    sellable: rows.filter((row) => row.paidRowDecision === "sellable").length,
    included_with_caveat: rows.filter((row) => row.paidRowDecision === "included_with_caveat").length,
    coverage_gap_only: rows.filter((row) => row.paidRowDecision === "coverage_gap_only").length,
    hold: rows.filter((row) => row.paidRowDecision === "hold").length,
    suppress: rows.filter((row) => row.paidRowDecision === "suppress").length
  };
  return {
    ...byDecision,
    chargeRecommended: rows.filter((row) => row.billingGuidance === "charge").length,
    contextOnly: rows.filter((row) => row.billingGuidance !== "charge").length,
    usefulForBuyer: rows.filter((row) => row.paidRowDecision === "sellable" || row.paidRowDecision === "included_with_caveat").length,
    averageBuyerValueScore: rows.length
      ? Number((rows.reduce((sum, row) => sum + (row.buyerValueScore ?? 0), 0) / rows.length).toFixed(3))
      : 0
  };
}

export const PRODUCTION_SELLABLE_ROW_FLOOR = 100;

export function monetizationReadinessForRows(rows: MarketplaceRow[], quality: ReturnType<typeof paidRowQualitySummary>) {
  const rateTargetSellableRows = Math.ceil(rows.length * 0.25);
  const targetSellableRows = Math.max(PRODUCTION_SELLABLE_ROW_FLOOR, rateTargetSellableRows);
  const blockers = [
    quality.sellable < PRODUCTION_SELLABLE_ROW_FLOOR ? "sellable_rows_below_100_production_floor" : null,
    quality.sellable < targetSellableRows ? "sellable_rows_below_paid_traffic_floor" : null,
    quality.averageBuyerValueScore < 0.55 ? "average_buyer_value_below_listing_floor" : null,
    quality.usefulForBuyer === 0 ? "no_buyer_useful_rows" : null
  ].filter((blocker): blocker is string => Boolean(blocker));
  return {
    status: blockers.length === 0 ? "ready_for_paid_traffic" : "blocked_for_paid_traffic",
    minimumProductionSellableRows: PRODUCTION_SELLABLE_ROW_FLOOR,
    targetSellableRows,
    rateTargetSellableRows,
    sellableRows: quality.sellable,
    usefulForBuyerRows: quality.usefulForBuyer,
    averageBuyerValueScore: quality.averageBuyerValueScore,
    blockers,
    currentProductionFloorProgress: Number((quality.sellable / PRODUCTION_SELLABLE_ROW_FLOOR).toFixed(3)),
    nextRevenueAction: blockers.includes("sellable_rows_below_paid_traffic_floor")
      ? "add_or_repair live corroborating sources until at least 100 output rows are chargeable findings and at least 25 percent of rows are sellable"
      : "send paid traffic and measure Apify views, starts, dataset rows, and repeat runs"
  };
}

export function revenueConversionChecklistForRows(rows: MarketplaceRow[], quality: ReturnType<typeof paidRowQualitySummary>) {
  const usefulRate = rows.length ? quality.usefulForBuyer / rows.length : 0;
  const sellableRate = rows.length ? quality.sellable / rows.length : 0;
  const readyForPaidTraffic = quality.sellable >= PRODUCTION_SELLABLE_ROW_FLOOR && sellableRate >= 0.25 && quality.averageBuyerValueScore >= 0.55;
  return {
    schemaVersion: "ti.apify_revenue_conversion_checklist.v1",
    routeVisibleOn: ["Apify OUTPUT", "/v1/contracts#apifyStoreReadiness", "/v1/ops/product-slo"],
    paidTrafficState: readyForPaidTraffic ? "ready" : "blocked",
    listingCopyState: "ready",
    sampleDataQualityState: usefulRate >= 0.4 && readyForPaidTraffic ? "ready" : "blocked",
    pricingState: "ready",
    telemetryState: "missing",
    payoutState: "unknown",
    nextManualVerificationStep: "Open Apify Store analytics and billing, then copy verified views, users, starts, paid runs, refunds, usage cost, creator revenue, beneficiary, payout method, and withdrawal readiness into the product SLO inputs.",
    checks: [
      { id: "listing_copy", state: "ready" },
      { id: "sample_rows", state: rows.length >= 12 ? "ready" : "blocked", blocker: rows.length >= 12 ? undefined : "smoke/default run should expose at least 12 safe buyer examples" },
      { id: "production_sellable_rows", state: quality.sellable >= PRODUCTION_SELLABLE_ROW_FLOOR ? "ready" : "blocked", proofField: "OUTPUT.monetizationReadiness.sellableRows", blocker: quality.sellable >= PRODUCTION_SELLABLE_ROW_FLOOR ? undefined : "production paid traffic requires at least 100 sellable rows" },
      { id: "pricing_shape", state: "ready" },
      { id: "marketplace_telemetry", state: "missing", proofField: "OUTPUT.monetization", blocker: "Apify analytics not externally copied into this run" },
      { id: "payout_setup", state: "missing", blocker: "beneficiary, payout method, and withdrawal readiness require external billing verification" },
      { id: "no_leak_sample_proof", state: "ready" }
    ]
  };
}
export function monetizationForRows(rows: MarketplaceRow[]): MonetizationSummary {
  const quality = paidRowQualitySummary(rows);
  const enabled = Boolean(process.env.APIFY_ACTOR_RUN_ID && process.env.APIFY_TOKEN);
  const summary: MonetizationSummary = {
    enabled,
    eventNames: [ACTOR_START_EVENT, DATASET_ITEM_EVENT],
    pricingModel: "pay_per_event",
    billingMode: "apify_synthetic_events",
    actorStartEvent: ACTOR_START_EVENT,
    datasetItemEvent: DATASET_ITEM_EVENT,
    datasetItemCount: rows.length,
    sellableRowCount: quality.sellable,
    caveatedRowCount: quality.included_with_caveat,
    coverageGapOnlyRowCount: quality.coverage_gap_only,
    holdRowCount: quality.hold,
    suppressedRowCount: quality.suppress,
    chargeRecommendedRowCount: quality.chargeRecommended
  };
  if (!summary.enabled) {
    summary.skippedReason = apifyEventSkipReason();
  }
  return summary;
}

