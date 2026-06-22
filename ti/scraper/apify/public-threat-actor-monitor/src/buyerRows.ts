import type { MarketplaceRow } from "./types.ts";
import { uniqueStrings } from "./utils.ts";
import { confidenceLabelForRow, recentActivityForRow, cardStatus } from "./buyerRows/cardFields.ts";
import { cardPivots, cleanBuyerPivots, keyPivotsForRow } from "./buyerRows/pivots.ts";
import { buyerSummaryForRow, recommendedBuyerActionForRow } from "./buyerRows/summary.ts";

export function buyerSearchCardForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  whyWorthPaying: string
): NonNullable<MarketplaceRow["buyerSearchCard"]> {
  const { victimsTargets, ttpTools, sourcePivots } = cardPivots(row);
  const nextSearches = uniqueStrings([
    ...keyPivotsForRow(row),
    ...cleanBuyerPivots(row.nextSearchPivots)
  ]).slice(0, 6);
  return {
    schemaVersion: "ti.apify_buyer_search_card.v1",
    status: cardStatus(decision),
    actor: row.actor,
    summary: buyerSummaryForRow(row, decision, whyWorthPaying),
    recentActivity: recentActivityForRow(row),
    victimsTargets,
    ttpTools,
    sourcePivots,
    freshness: {
      status: row.freshnessStatus,
      observedAt: row.lastReportedAt ?? row.claimedDate ?? row.lastSeen,
      firstReportedAt: row.firstReportedAt,
      lastReportedAt: row.lastReportedAt
    },
    confidence: {
      score: Number(row.confidence.toFixed(3)),
      label: confidenceLabelForRow(row),
      reason: row.paidRowReason ?? whyWorthPaying
    },
    nextSearches,
    safety: {
      noRawLeakData: true,
      noUnsafeUrls: true,
      noCredentials: true,
      restrictedMaterial: "not_included"
    }
  };
}
export { buyerSummaryForRow, recommendedBuyerActionForRow, keyPivotsForRow };
