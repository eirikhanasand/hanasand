import type { MarketplaceRow } from "../types.ts";

export function buyerSummaryForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  whyWorthPaying: string
): string {
  const freshness = row.freshnessStatus === "unknown" ? "observed" : row.freshnessStatus;
  const subject = row.victimName ?? row.sector ?? row.ttp ?? row.sourceName ?? row.title;
  if (decision.paidRowDecision === "sellable") return `${freshness} ${row.actor} ${row.rowType} row: ${subject}. ${whyWorthPaying}.`;
  if (decision.paidRowDecision === "included_with_caveat") return `${freshness} ${row.actor} lead: ${subject}. Useful context, but corroboration is still thin.`;
  if (decision.paidRowDecision === "coverage_gap_only") return `${row.actor} coverage gap: ${row.highestValueMissingFamily || "additional public support"} would make future rows more useful.`;
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") return `${row.actor} source page is hidden from paid findings because it is provenance-only, not a buyer finding.`;
    return `${row.actor} row is hidden from paid output because it lacks safe matching evidence.`;
  }
  return `${row.actor} row is held until evidence, freshness, or specificity improves.`;
}

export function recommendedBuyerActionForRow(row: MarketplaceRow, decision: Pick<MarketplaceRow, "paidRowDecision">): string {
  if (decision.paidRowDecision === "sellable") return `Triage now; pivot on ${keyPivotsForRow(row).slice(0, 3).join(", ") || row.actor}.`;
  if (decision.paidRowDecision === "included_with_caveat") return `Use as a lead and collect corroboration from ${row.highestValueMissingFamily || "another public source family"}.`;
  if (decision.paidRowDecision === "coverage_gap_only") return row.nextBestSourceAction || `Add ${row.highestValueMissingFamily || "another source family"} coverage.`;
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") return "Do not charge for this source page; use the admitted activity, target, or TTP rows that cite it.";
    return "Do not use this row for decisions until safe matching evidence appears.";
  }
  return "Hold for review before acting.";
}

import { keyPivotsForRow } from "./pivots.ts";
