import type { MarketplaceRow } from "./marketplaceRow.ts";

type FreshnessStatus = MarketplaceRow["freshnessStatus"];
type PaidRowDecision = NonNullable<MarketplaceRow["paidRowDecision"]>;

export interface BuyerSearchCard {
  schemaVersion: "ti.apify_buyer_search_card.v1";
  status: "sellable" | "lead" | "coverage_gap" | "held";
  actor: string;
  summary: string;
  recentActivity: string[];
  victimsTargets: string[];
  ttpTools: string[];
  sourcePivots: string[];
  freshness: {
    status: FreshnessStatus;
    observedAt?: string;
    firstReportedAt?: string;
    lastReportedAt?: string;
  };
  confidence: {
    score: number;
    label: "high" | "medium" | "low";
    reason: string;
  };
  nextSearches: string[];
  safety: {
    noRawLeakData: true;
    noUnsafeUrls: true;
    noCredentials: true;
    restrictedMaterial: "metadata_only_or_suppressed";
  };
}

export interface PaidRowRemediationAction {
  owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
  action: string;
  expectedEffect: string;
}

export interface GraphQualityLiftEvidence {
  relationshipReady: boolean;
  sourceFamilyCorroborated: boolean;
  contradictionHeld: boolean;
  freshnessLift: boolean;
  exportEligible: boolean;
  noLeak: true;
}

export interface MarketplaceGraphSignals {
  schemaVersion: "ti.marketplace_graph_signals.v1";
  signalState: "buyer_ready" | "needs_corroboration" | "held";
  relationshipLinks: string[];
  freshnessChangeHints: string[];
  confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
  contradictionState: "none" | "contradicted" | "review_hold";
  nextBuyerPivots: string[];
  pivotUtility: GraphPivotUtility;
  relationshipConfidence: RelationshipConfidence;
  rejectedPivotReasons: RejectedPivotReason[];
  buyerAction: string;
  sourceBlockers: string[];
  noLeak: true;
}

export interface GraphPivotUtility {
  usefulPivotCount: number;
  actionPivotCount: number;
  corroboratedPivotCount: number;
  suppressedGenericPivotCount: number;
  buyerValueDelta: number;
  noLeak: true;
}

export interface RelationshipConfidence {
  usefulPivotCount: number;
  actionPivotCount: number;
  corroboratedPivotCount: number;
  rejectedUnsupportedPivotCount: number;
  confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
  contradictionState: "none" | "contradicted" | "review_hold";
  nextSearchCount: number;
  sellableLift: number;
  usefulLift: number;
  buyerValueDelta: number;
  noLeak: true;
}

export type RejectedPivotReason =
  | "generic_pivot"
  | "stale_pivot"
  | "contradicted_pivot"
  | "unrelated_actor_pivot"
  | "restricted_only_pivot"
  | "missing_ledger_pivot"
  | "single_source_without_caveat"
  | "no_action_pivot";

export interface PaidGraphSearchPack {
  schemaVersion: "ti.apify_paid_graph_search_pack.v1";
  queryType: "actor" | "victim" | "sector" | "country" | "ttp" | "tool" | "campaign" | "ransomware_group" | "unknown" | "alias_collision";
  buyerIntent: string;
  primaryEntity: string;
  normalizedAliases: string[];
  usefulNextSearches: string[];
  sourceFamilyCorroboration: "corroborated" | "single_source" | "metadata_only" | "unverified";
  contradictionCaveatState: "none" | "caveated" | "contradicted" | "held";
  suppressedNoisyPivots: string[];
  exportEligibility: "eligible" | "review_required" | "not_exportable";
  whyWorthPayingForOrHeld: string;
  noLeak: true;
}

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

export interface ParserAdmissionRuntimeProof {
  schemaVersion: "ti.apify_parser_admission_runtime_proof.v1";
  owner: "agent_03";
  candidateId: string;
  admissionDecision: "sellable" | "useful_caveated" | "suppress";
  countsTowardCurrentSellableRows: boolean;
  requiredFieldsPresent: string[];
  missingFields: string[];
  sourceFamilySupport: string[];
  sourceEvidenceCount: number;
  confidence: number;
  freshnessStatus: FreshnessStatus;
  caveat: string;
  contradictionState: "none" | "held" | "contradicted";
  provenanceHash: string;
  nextBuyerSearch: string;
  repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_07";
  blockedReason?: "missing_required_fields" | "single_source_without_caveat" | "generic_source_page" | "coverage_gap_only" | "restricted_only_without_public_support" | "stale_or_held" | "alias_or_contradiction";
  noLeakProof: {
    rawBodiesExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    credentialsExposed: false;
    privateMaterialUsed: false;
    actorInteractionTextUsed: false;
  };
}

export interface MarketplaceRowSafety {
  metadataOnly: true;
  credentialsIncluded: false;
  stolenFilesIncluded: false;
  privateContentIncluded: false;
  actorInteraction: false;
}
