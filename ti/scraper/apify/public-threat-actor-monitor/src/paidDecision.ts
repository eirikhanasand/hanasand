import type { MarketplaceRow } from "./types.ts";
import { caveatedLead, capabilityWithoutEvidence, coverageGap, noEvidenceHold, parserAdmittedSellable, publicEvidenceSellable, publicFindingSellable, sourceProvenance, strongSellable, unsupportedContext } from "./paidDecision/decisions.ts";
import { historicalVictimSellable, isSellableHistoricalVictim } from "./paidDecision/historicalVictims.ts";
import { currentLiveActivitySellable, isSellableCurrentLiveActivity } from "./paidDecision/liveActivity.ts";
import { isCorroboratedPublicFinding, isSellablePublicEvidenceRow } from "./paidDecision/predicates.ts";
export { isCorroboratedPublicFinding, isSellablePublicEvidenceRow } from "./paidDecision/predicates.ts";
export { whyWorthPayingFor } from "./paidDecision/reasons.ts";

type DecisionFields = Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance">;

export function paidRowDecisionFor(
  row: MarketplaceRow,
  parserAdmissionRuntimeProof?: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>
): DecisionFields {
  if (row.rowType === "dataset" && row.sourceType === "darknet_metadata" && !row.hasDarknetMetadata) {
    return capabilityWithoutEvidence();
  }
  if (row.rowType === "coverage_gap") return coverageGap();
  if (row.rowType === "source") return sourceProvenance();
  if (parserAdmissionRuntimeProof?.countsTowardCurrentSellableRows) return parserAdmittedSellable();
  if (isSellableHistoricalVictim(row)) return historicalVictimSellable();
  if (hasHoldCondition(row)) return noEvidenceHold(row);
  if (isStrongSellable(row)) return strongSellable();
  if (isCorroboratedPublicFinding(row)) return publicFindingSellable();
  if (isSellablePublicEvidenceRow(row)) return publicEvidenceSellable();
  if (isSellableCurrentLiveActivity(row)) return currentLiveActivitySellable();
  if (row.isActionable || row.evidenceGrade === "single_source" || row.coverageStatus === "thin") {
    return caveatedLead(row);
  }
  return unsupportedContext();
}

function hasHoldCondition(row: MarketplaceRow): boolean {
  return row.contradictionHints.length > 0 ||
    row.reviewReasons.some((reason) => reason.startsWith("hold:")) ||
    row.coverageStatus === "no_evidence";
}

function isStrongSellable(row: MarketplaceRow): boolean {
  return row.isActionable &&
    row.evidenceGrade === "corroborated" &&
    row.sourceFamilyCount >= 2 &&
    (row.freshnessStatus === "current" || row.freshnessStatus === "recent");
}
