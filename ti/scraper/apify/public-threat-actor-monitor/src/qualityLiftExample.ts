import type { PaidRowDecision, RemediationOwner } from "./commonActorTypes.ts";
import type { EvidenceSourceFamily } from "./marketplaceRow.ts";

export interface QualityLiftExample {
  id: string;
  query: string;
  owner: RemediationOwner;
  sourceFamily: EvidenceSourceFamily;
  beforeDecision: PaidRowDecision;
  afterDecision: PaidRowDecision;
  outcome: "accepted" | "rejected";
  repairAction: string;
  rejectionReason?: "no_sellable_row_lift" | "still_single_source" | "stale_after_repair" | "unsafe_or_unapproved_source" | "cost_exceeds_value";
  victimExtractionDelta: number;
  actorEntitySpecificityDelta: number;
  sectorCountryDelta: number;
  ttpToolDelta: number;
  firstLastSeenDelta: number;
  corroborationDelta: number;
  sourceFamilyDiversityDelta: number;
  freshnessDelta: number;
  staleRowsSuppressedDelta: number;
  sellableRowsDelta: number;
  freshRowsDelta: number;
  usefulRowsDelta: number;
  projectedRowRevenueDeltaUsd: number;
  costPerUsefulRowDeltaUsd: number;
  proofNotes: string[];
}
