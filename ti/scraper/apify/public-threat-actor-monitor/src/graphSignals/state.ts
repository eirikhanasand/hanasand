import type { MarketplaceRow } from "../types.ts";
import { isCorroboratedPublicFinding } from "../paidDecision.ts";

export function relationshipReadyForRow(
  row: MarketplaceRow,
  parserAdmissionRuntimeProof?: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>
): boolean {
  return parserAdmissionRuntimeProof?.countsTowardCurrentSellableRows
    || isCorroboratedPublicFinding(row)
    || (
      row.relationshipPivotTypes.includes("actor")
      && row.relationshipPivotTypes.some((type) => ["target", "sector", "country", "ttp", "claim", "source", "source_family"].includes(type))
    );
}

export function contradictionStateForRow(row: MarketplaceRow): NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["contradictionState"] {
  if (row.contradictionHints.length > 0) return "contradicted";
  if (row.reviewReasons.some((reason) => reason.startsWith("hold:"))) return "review_hold";
  return "none";
}

export function signalStateForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  evidence: NonNullable<MarketplaceRow["graphQualityLiftEvidence"]> | undefined,
  contradictionState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["contradictionState"]
): NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["signalState"] {
  const hasBuyerReadyPublicEvidence = decision.paidRowDecision === "sellable" && contradictionState === "none" && Boolean(row.provenanceHash) && row.sourceFamilies.length > 0;
  if ((evidence?.exportEligible || hasBuyerReadyPublicEvidence) && decision.paidRowDecision === "sellable") return "buyer_ready";
  if (contradictionState !== "none" || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress") return "held";
  return "needs_corroboration";
}
