import type { MarketplaceRow } from "../types.ts";

export function buyerVisibleOutputQualityForRows(rows: MarketplaceRow[]) {
  const cardRows = rows.filter((row) => row.buyerSearchCard?.schemaVersion === "ti.apify_buyer_search_card.v1");
  const completeCards = cardRows.filter((row) => completeCard(row));
  const buyerReadyCards = completeCards.filter((row) => row.buyerSearchCard?.status === "sellable" || row.buyerSearchCard?.status === "lead");
  return {
    schemaVersion: "ti.apify_buyer_visible_output_quality.v1",
    rowCount: rows.length,
    rowsWithBuyerSearchCard: cardRows.length,
    completeBuyerSearchCards: completeCards.length,
    buyerReadyCards: buyerReadyCards.length,
    cardCoverageRate: rate(cardRows.length, rows.length),
    completeCardRate: rate(completeCards.length, rows.length),
    buyerReadyCardRate: rate(buyerReadyCards.length, rows.length),
    requiredBuyerFields: ["actor", "summary", "recentActivity", "victimsTargets", "ttpTools", "sourcePivots", "freshness", "confidence", "nextSearches", "safety"],
    noLeakFailures: cardRows.filter((row) => row.buyerSearchCard?.safety.noRawLeakData !== true || row.buyerSearchCard?.safety.noUnsafeUrls !== true || row.buyerSearchCard?.safety.noCredentials !== true).length
  };
}

function completeCard(row: MarketplaceRow): boolean {
  const card = row.buyerSearchCard;
  if (!card) return false;
  return card.actor.length > 0 &&
    card.summary.length >= 24 &&
    card.recentActivity.length > 0 &&
    card.sourcePivots.length > 0 &&
    card.nextSearches.length > 0 &&
    card.confidence.score >= 0 &&
    card.confidence.score <= 1 &&
    card.safety.noRawLeakData &&
    card.safety.noUnsafeUrls &&
    card.safety.noCredentials;
}

function rate(count: number, total: number): number {
  return total === 0 ? 0 : Number((count / total).toFixed(3));
}
