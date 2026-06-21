import type { MarketplaceRow } from "../types.ts";
import { uniqueStrings } from "../utils.ts";
import { relationshipReadyForRow } from "./state.ts";

export function graphQualityLiftForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  parserAdmissionRuntimeProof?: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>
): Pick<MarketplaceRow, "graphQualityLift" | "graphQualityLiftReasonCodes" | "graphQualityLiftEvidence"> {
  const relationshipReady = relationshipReadyForRow(row, parserAdmissionRuntimeProof);
  const sourceFamilyCorroborated = row.corroborationState === "corroborated" || row.sourceCount >= 2;
  const contradictionHeld = row.contradictionHints.length > 0 || row.reviewReasons.some((reason) => reason.startsWith("hold:"));
  const freshnessLift = row.freshnessStatus === "current" || row.freshnessStatus === "recent";
  const exportEligible = decision.paidRowDecision === "sellable" && relationshipReady && sourceFamilyCorroborated && freshnessLift && !contradictionHeld;
  return {
    graphQualityLift: graphQualityLiftState(decision, contradictionHeld, exportEligible),
    graphQualityLiftReasonCodes: uniqueStrings([
      relationshipReady ? "relationship_ready" : "relationship_thin",
      sourceFamilyCorroborated ? "source_corroborated" : "source_needs_corroboration",
      freshnessLift ? "fresh_or_recent" : "stale_or_unknown",
      contradictionHeld ? "contradiction_or_hold_present" : "no_contradiction_hold",
      exportEligible ? "review_export_candidate" : "not_export_eligible",
      "metadata_only_no_leak"
    ]),
    graphQualityLiftEvidence: { relationshipReady, sourceFamilyCorroborated, contradictionHeld, freshnessLift, exportEligible, noLeak: true }
  };
}

function graphQualityLiftState(
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  contradictionHeld: boolean,
  exportEligible: boolean
): NonNullable<MarketplaceRow["graphQualityLift"]> {
  if (exportEligible) return "accepted_sellable_lift";
  if (contradictionHeld || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress") return "rejected_hold";
  if (decision.paidRowDecision === "included_with_caveat" || decision.paidRowDecision === "coverage_gap_only") return "rejected_caveat";
  return "not_applicable";
}
