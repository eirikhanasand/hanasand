import type { MarketplaceRow } from "../types.ts";
import { displayValue, sentenceCase } from "./display.ts";

export function buyerSummaryForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  whyWorthPaying: string
): string {
  const freshness = sentenceCase(row.freshnessStatus === "unknown" ? "observed" : row.freshnessStatus);
  const actor = displayValue(row.actor);
  const subject = row.victimName ?? row.sector ?? row.ttp ?? row.sourceName ?? row.title;
  const dataClaim = row.claimedDataSummary ? ` Claimed data: ${row.claimedDataSummary}.` : "";
  if (decision.paidRowDecision === "sellable" && row.claimType === "victim_claim" && row.victimName) {
    const value = row.claimedDataSummary
      ? "Includes company, actor, date, source link, claimed data, and review pivots."
      : "Includes company, actor, date, source link, and review pivots.";
    return `${freshness} ${actor} victim claim: ${subject}.${dataClaim} ${value}`;
  }
  if (decision.paidRowDecision === "sellable") return `${freshness} ${actor} signal: ${subject}.${dataClaim} ${sentenceCase(whyWorthPaying)}.`;
  if (decision.paidRowDecision === "included_with_caveat") return `${freshness} ${actor} lead: ${subject}. Use it as a watchlist lead while checking the linked source.`;
  if (decision.paidRowDecision === "coverage_gap_only") return `${actor}: add ${row.highestValueMissingFamily || "another public source"} to improve monitoring coverage.`;
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") return `${actor} source reference kept for traceability.`;
    return `${actor} item kept out of the main feed until the match is clearer.`;
  }
  return `${actor} item needs a clearer source, date, or entity match.`;
}

export function recommendedBuyerActionForRow(row: MarketplaceRow, decision: Pick<MarketplaceRow, "paidRowDecision">): string {
  if (decision.paidRowDecision === "sellable" && row.claimType === "victim_claim" && row.victimName) {
    const pivots = actionPivotsForRow(row).join(", ");
    return row.claimedDataTypes?.length
      ? `Open the source link, confirm the company match, and route ${pivots || row.victimName} to incident response, legal, or vendor risk review.`
      : `Open the source link, confirm the company match, and keep ${pivots || row.victimName} on the ransomware watchlist.`;
  }
  if (decision.paidRowDecision === "sellable") return row.claimedDataTypes?.length
    ? `Open the source link, confirm the match, and route ${actionPivotsForRow(row).join(", ") || displayValue(row.actor)} to the right owner.`
    : `Open the source link, confirm the match, and use ${actionPivotsForRow(row).join(", ") || displayValue(row.actor)} as context for related activity rows.`;
  if (decision.paidRowDecision === "included_with_caveat") return `Review the linked source and keep ${row.actor} on the watchlist.`;
  if (decision.paidRowDecision === "coverage_gap_only") return row.nextBestSourceAction || `Add ${row.highestValueMissingFamily || "another public source"} coverage.`;
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") return "Use this as a source reference for related activity rows.";
    return "Review before using in a customer-facing workflow.";
  }
  return "Review source, date, and entity match before acting.";
}

function actionPivotsForRow(row: MarketplaceRow): string[] {
  return uniqueValues([
    displayValue(row.actor),
    row.victimName ?? "",
    row.victimWebsite ?? "",
    ...(row.affectedSectors ?? []),
    ...(row.countries ?? [])
  ].filter(Boolean)).slice(0, 4);
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
