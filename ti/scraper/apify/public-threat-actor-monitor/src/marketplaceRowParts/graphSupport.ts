import type { MarketplaceRow } from "../marketplaceRow.ts";

type PaidRowDecision = NonNullable<MarketplaceRow["paidRowDecision"]>;

export interface GraphSellableSupport {
  schemaVersion: "ti.apify_graph_sellable_support.v1";
  relationshipSupport: string;
  supportingSourceFamily: string;
  sourceFamilyProofState: "proven" | "missing_public_support" | "metadata_only" | "single_source" | "none";
  contradictionState: "none" | "contradicted" | "review_hold";
  caveat: string;
  nextBuyerSearch: string;
  repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
  supportsPaidDecision: PaidRowDecision;
  countsTowardProductionSellableRows: false;
  noLeak: true;
}

export interface GraphQualityLiftEvidence {
  relationshipReady: boolean;
  sourceFamilyCorroborated: boolean;
  contradictionHeld: boolean;
  freshnessLift: boolean;
  exportEligible: boolean;
  noLeak: true;
}
