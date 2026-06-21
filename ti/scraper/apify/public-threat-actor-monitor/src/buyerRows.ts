import type { MarketplaceRow, PaidRowDecision } from "./types.ts";
import { uniqueStrings } from "./utils.ts";

export function buyerSearchCardForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  whyWorthPaying: string
): NonNullable<MarketplaceRow["buyerSearchCard"]> {
  const status: NonNullable<MarketplaceRow["buyerSearchCard"]>["status"] = decision.paidRowDecision === "sellable"
    ? "sellable"
    : decision.paidRowDecision === "included_with_caveat"
      ? "lead"
      : decision.paidRowDecision === "coverage_gap_only"
        ? "coverage_gap"
        : "held";
  const recentActivity = uniqueStrings([
    row.claimType ? row.claimType.replaceAll("_", " ") : "",
    row.claimedDate ? `claimed ${row.claimedDate}` : "",
    row.impact ?? "",
    row.relationshipSummary
  ].filter(Boolean)).slice(0, 4);
  const victimsTargets = uniqueStrings([
    row.victimName ?? "",
    row.sector ?? "",
    ...(row.affectedSectors ?? []),
    row.country ?? "",
    ...(row.countries ?? []),
    ...(row.regions ?? [])
  ].filter(Boolean)).slice(0, 6);
  const ttpTools = uniqueStrings([
    row.ttp ?? "",
    row.attackId ?? "",
    row.tactic ?? "",
    ...row.relationshipPivots
      .filter((pivot) => /^(ttp|attack|tactic|tool|malware|cve):/i.test(pivot))
      .map((pivot) => pivot.replace(/^[^:]+:/, ""))
  ].filter(Boolean)).slice(0, 6);
  const sourcePivots = uniqueStrings([
    ...(row.sourceName ? [`source:${row.sourceName}`] : []),
    ...row.sourceFamilies.map((family) => `family:${family}`),
    ...(row.sourceId ? [`id:${row.sourceId}`] : []),
    ...(row.publisherCount ? [`publishers:${row.publisherCount}`] : []),
    ...(row.corroboratingSourceIds?.length ? [`corroborating:${row.corroboratingSourceIds.length}`] : [])
  ]).slice(0, 6);
  const nextSearches = uniqueStrings([
    ...keyPivotsForRow(row),
    ...row.nextSearchPivots
  ]).slice(0, 6);
  const confidenceLabel: NonNullable<MarketplaceRow["buyerSearchCard"]>["confidence"]["label"] = row.confidence >= 0.75
    ? "high"
    : row.confidence >= 0.55
      ? "medium"
      : "low";
  return {
    schemaVersion: "ti.apify_buyer_search_card.v1",
    status,
    actor: row.actor,
    summary: buyerSummaryForRow(row, decision, whyWorthPaying),
    recentActivity: recentActivity.length > 0 ? recentActivity : [row.title],
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
      label: confidenceLabel,
      reason: row.paidRowReason ?? whyWorthPaying
    },
    nextSearches,
    safety: {
      noRawLeakData: true,
      noUnsafeUrls: true,
      noCredentials: true,
      restrictedMaterial: "metadata_only_or_suppressed"
    }
  };
}

export function buyerSummaryForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  whyWorthPaying: string
): string {
  const freshness = row.freshnessStatus === "unknown" ? "observed" : row.freshnessStatus;
  const subject = row.victimName ?? row.sector ?? row.ttp ?? row.sourceName ?? row.title;
  if (decision.paidRowDecision === "sellable") {
    return `${freshness} ${row.actor} ${row.rowType} row: ${subject}. ${whyWorthPaying}.`;
  }
  if (decision.paidRowDecision === "included_with_caveat") {
    return `${freshness} ${row.actor} lead: ${subject}. Useful context, but corroboration is still thin.`;
  }
  if (decision.paidRowDecision === "coverage_gap_only") {
    return `${row.actor} coverage gap: ${row.highestValueMissingFamily || "additional public support"} would make future rows more useful.`;
  }
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") {
      return `${row.actor} source page is hidden from paid findings because it is provenance-only, not a buyer finding.`;
    }
    return `${row.actor} row is hidden from paid output because it lacks safe matching evidence.`;
  }
  return `${row.actor} row is held until evidence, freshness, or specificity improves.`;
}

export function recommendedBuyerActionForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision">
): string {
  if (decision.paidRowDecision === "sellable") {
    return `Triage now; pivot on ${keyPivotsForRow(row).slice(0, 3).join(", ") || row.actor}.`;
  }
  if (decision.paidRowDecision === "included_with_caveat") {
    return `Use as a lead and collect corroboration from ${row.highestValueMissingFamily || "another public source family"}.`;
  }
  if (decision.paidRowDecision === "coverage_gap_only") {
    return row.nextBestSourceAction || `Add ${row.highestValueMissingFamily || "another source family"} coverage.`;
  }
  if (decision.paidRowDecision === "suppress") {
    if (row.rowType === "source") {
      return "Do not charge for this source page; use the admitted activity, target, or TTP rows that cite it.";
    }
    return "Do not use this row for decisions until safe matching evidence appears.";
  }
  return "Hold for review before acting.";
}

export function keyPivotsForRow(row: MarketplaceRow): string[] {
  return uniqueStrings([
    row.actor,
    row.victimName ?? "",
    row.sector ?? "",
    ...(row.affectedSectors ?? []),
    row.country ?? "",
    ...(row.countries ?? []),
    row.ttp ?? "",
    row.attackId ?? "",
    ...row.sourceFamilies.map((family) => `source:${family}`),
    ...row.nextSearchPivots.slice(0, 3)
  ].filter(Boolean)).slice(0, 8);
}
