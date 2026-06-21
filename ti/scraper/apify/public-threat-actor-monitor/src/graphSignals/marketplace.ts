import type { MarketplaceRow } from "../types.ts";
import { rejectedPivotReasonsForRow, relationshipLinksForRow } from "./pivots.ts";
import { contradictionStateForRow, signalStateForRow } from "./state.ts";
import { buyerActionForSignal, freshnessHintsForRow, sourceBlockersForRow } from "./utility.ts";
import { pivotUtility, relationshipConfidence, type SignalCounts } from "./confidence.ts";

export function marketplaceGraphSignalsForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  graphLift: Pick<MarketplaceRow, "graphQualityLiftEvidence">
): NonNullable<MarketplaceRow["marketplaceGraphSignals"]> {
  const evidence = graphLift.graphQualityLiftEvidence;
  const contradictionState = contradictionStateForRow(row);
  const signalState = signalStateForRow(row, decision, evidence, contradictionState);
  const relationshipLinks = relationshipLinksForRow(row);
  const rejectedPivotReasons = rejectedPivotReasonsForRow(row, signalState, contradictionState, evidence);
  const counts = signalCounts(row, relationshipLinks, rejectedPivotReasons, signalState, contradictionState, evidence);
  return {
    schemaVersion: "ti.marketplace_graph_signals.v1",
    signalState,
    relationshipLinks,
    freshnessChangeHints: freshnessHintsForRow(row),
    confidenceTrend: row.confidenceDelta,
    contradictionState,
    nextBuyerPivots: row.nextSearchPivots.slice(0, 5),
    pivotUtility: pivotUtility(counts),
    relationshipConfidence: relationshipConfidence(row, counts),
    rejectedPivotReasons,
    buyerAction: buyerActionForSignal(signalState),
    sourceBlockers: sourceBlockersForRow(row, evidence),
    noLeak: true
  };
}

function signalCounts(row: MarketplaceRow, relationshipLinks: string[], rejectedPivotReasons, signalState, contradictionState, evidence): SignalCounts {
  const actionPivotCount = row.nextSearchPivots.length;
  const usefulPivotCount = Math.max(actionPivotCount, relationshipLinks.filter((link) => !link.endsWith(":actor")).length);
  const corroboratedPivotCount = evidence?.sourceFamilyCorroborated ? Math.min(usefulPivotCount, row.sourceFamilyCount + actionPivotCount) : 0;
  const buyerValueDelta = signalState === "buyer_ready" ? 0.04 : signalState === "needs_corroboration" ? 0.015 : 0;
  return { usefulPivotCount, actionPivotCount, corroboratedPivotCount, buyerValueDelta, signalState, contradictionState, rejectedPivotReasons };
}
