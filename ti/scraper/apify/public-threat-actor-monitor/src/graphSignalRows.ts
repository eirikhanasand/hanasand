import type { MarketplaceRow } from "./types.ts";
import { uniqueStrings } from "./utils.ts";
import { isCorroboratedPublicFinding } from "./paidDecision.ts";

export function graphQualityLiftForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  parserAdmissionRuntimeProof?: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>
): Pick<MarketplaceRow, "graphQualityLift" | "graphQualityLiftReasonCodes" | "graphQualityLiftEvidence"> {
  const relationshipReady = parserAdmissionRuntimeProof?.countsTowardCurrentSellableRows
    || isCorroboratedPublicFinding(row)
    || (
      row.relationshipPivotTypes.includes("actor")
      && row.relationshipPivotTypes.some((type) => ["target", "sector", "country", "ttp", "claim", "source", "source_family"].includes(type))
    );
  const sourceFamilyCorroborated = row.corroborationState === "corroborated" || row.sourceCount >= 2;
  const contradictionHeld = row.contradictionHints.length > 0 || row.reviewReasons.some((reason) => reason.startsWith("hold:"));
  const freshnessLift = row.freshnessStatus === "current" || row.freshnessStatus === "recent";
  const exportEligible = decision.paidRowDecision === "sellable"
    && relationshipReady
    && sourceFamilyCorroborated
    && freshnessLift
    && !contradictionHeld;
  const graphQualityLift: NonNullable<MarketplaceRow["graphQualityLift"]> = exportEligible
    ? "accepted_sellable_lift"
    : contradictionHeld || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress"
      ? "rejected_hold"
      : decision.paidRowDecision === "included_with_caveat" || decision.paidRowDecision === "coverage_gap_only"
        ? "rejected_caveat"
        : "not_applicable";

  return {
    graphQualityLift,
    graphQualityLiftReasonCodes: uniqueStrings([
      relationshipReady ? "relationship_ready" : "relationship_thin",
      sourceFamilyCorroborated ? "source_corroborated" : "source_needs_corroboration",
      freshnessLift ? "fresh_or_recent" : "stale_or_unknown",
      contradictionHeld ? "contradiction_or_hold_present" : "no_contradiction_hold",
      exportEligible ? "review_export_candidate" : "not_export_eligible",
      "metadata_only_no_leak"
    ]),
    graphQualityLiftEvidence: {
      relationshipReady,
      sourceFamilyCorroborated,
      contradictionHeld,
      freshnessLift,
      exportEligible,
      noLeak: true
    }
  };
}

export function marketplaceGraphSignalsForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  graphLift: Pick<MarketplaceRow, "graphQualityLiftEvidence">
): NonNullable<MarketplaceRow["marketplaceGraphSignals"]> {
  const evidence = graphLift.graphQualityLiftEvidence;
  const contradictionState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["contradictionState"] = row.contradictionHints.length > 0
    ? "contradicted"
    : row.reviewReasons.some((reason) => reason.startsWith("hold:"))
      ? "review_hold"
      : "none";
  const hasBuyerReadyPublicEvidence = decision.paidRowDecision === "sellable"
    && contradictionState === "none"
    && Boolean(row.provenanceHash)
    && row.sourceFamilies.length > 0;
  const signalState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["signalState"] = (evidence?.exportEligible || hasBuyerReadyPublicEvidence) && decision.paidRowDecision === "sellable"
    ? "buyer_ready"
    : contradictionState !== "none" || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress"
      ? "held"
      : "needs_corroboration";
  const relationshipLinks = uniqueStrings([
    `${row.actor}:actor`,
    ...row.relationshipPivots.slice(0, 5),
    ...row.sourceFamilies.slice(0, 3).map((family) => `source_family:${family}`)
  ]).slice(0, 8);
  const rejectedPivotReasons = uniqueStrings([
    row.nextSearchPivots.length === 0 ? "generic_pivot" : "",
    row.freshnessStatus === "stale" || row.freshnessDelta === "stale" ? "stale_pivot" : "",
    contradictionState === "none" ? "" : "contradicted_pivot",
    row.reviewReasons.some((reason) => reason.includes("alias") || reason.includes("unrelated")) ? "unrelated_actor_pivot" : "",
    row.hasDarknetMetadata && !row.hasPublicChannelCoverage && !evidence?.sourceFamilyCorroborated ? "restricted_only_pivot" : "",
    signalState === "buyer_ready" || evidence?.exportEligible ? "" : "missing_ledger_pivot",
    !evidence?.sourceFamilyCorroborated && signalState !== "held" && signalState !== "buyer_ready" ? "single_source_without_caveat" : "",
    row.nextSearchPivots.length === 0 && relationshipLinks.length <= 1 ? "no_action_pivot" : ""
  ].filter(Boolean)) as NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["rejectedPivotReasons"];
  const actionPivotCount = row.nextSearchPivots.length;
  const usefulPivotCount = Math.max(actionPivotCount, relationshipLinks.filter((link) => !link.endsWith(":actor")).length);
  const corroboratedPivotCount = evidence?.sourceFamilyCorroborated ? Math.min(usefulPivotCount, row.sourceFamilyCount + actionPivotCount) : 0;
  const buyerValueDelta = signalState === "buyer_ready" ? 0.04 : signalState === "needs_corroboration" ? 0.015 : 0;
  const freshnessChangeHints = uniqueStrings([
    `freshness:${row.freshnessDelta}`,
    `observed:${row.freshnessStatus}`,
    ...(row.claimedDate ? [`claimed:${row.claimedDate}`] : []),
    ...(row.firstReportedAt ? [`first_reported:${row.firstReportedAt}`] : []),
    ...(row.lastReportedAt ? [`last_reported:${row.lastReportedAt}`] : [])
  ]).slice(0, 5);
  return {
    schemaVersion: "ti.marketplace_graph_signals.v1",
    signalState,
    relationshipLinks,
    freshnessChangeHints,
    confidenceTrend: row.confidenceDelta,
    contradictionState,
    nextBuyerPivots: row.nextSearchPivots.slice(0, 5),
    pivotUtility: {
      usefulPivotCount,
      actionPivotCount,
      corroboratedPivotCount,
      suppressedGenericPivotCount: rejectedPivotReasons.filter((reason) => reason === "generic_pivot" || reason === "unrelated_actor_pivot").length,
      buyerValueDelta,
      noLeak: true
    },
    relationshipConfidence: {
      usefulPivotCount,
      actionPivotCount,
      corroboratedPivotCount,
      rejectedUnsupportedPivotCount: rejectedPivotReasons.length,
      confidenceTrend: row.confidenceDelta,
      contradictionState,
      nextSearchCount: actionPivotCount,
      sellableLift: signalState === "buyer_ready" ? 1 : 0,
      usefulLift: signalState === "buyer_ready" || signalState === "needs_corroboration" ? 1 : 0,
      buyerValueDelta,
      noLeak: true
    },
    rejectedPivotReasons,
    buyerAction: signalState === "buyer_ready"
      ? "chargeable_monitoring_signal"
      : signalState === "needs_corroboration"
        ? "use_as_lead_and_follow_next_pivots"
        : "do_not_promote_until_hold_clears",
    sourceBlockers: uniqueStrings([
      ...row.missingSourceFamilies.map((family) => `missing_${family}`),
      ...(evidence?.sourceFamilyCorroborated ? [] : ["needs_source_corroboration"]),
      ...(evidence?.freshnessLift ? [] : ["needs_fresh_public_evidence"]),
      ...(evidence?.contradictionHeld ? ["contradiction_or_review_hold"] : [])
    ]).slice(0, 6),
    noLeak: true
  };
}
