import type { MarketplaceRow } from "../marketplaceRow.ts";

type FreshnessStatus = MarketplaceRow["freshnessStatus"];

export interface ParserAdmissionRuntimeProof {
  schemaVersion: "ti.apify_parser_admission_runtime_proof.v1";
  owner: "parser";
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
  repairOwner: "parser" | "source" | "channels" | "quality";
  blockedReason?: ParserAdmissionBlockedReason;
  noLeakProof: ParserNoLeakProof;
}

export type ParserAdmissionBlockedReason =
  | "missing_required_fields"
  | "single_source_without_caveat"
  | "generic_source_page"
  | "coverage_gap_only"
  | "restricted_only_without_public_support"
  | "stale_or_held"
  | "alias_or_contradiction";

export interface ParserNoLeakProof {
  rawBodiesExposed: false;
  unsafeUrlsExposed: false;
  restrictedPayloadsExposed: false;
  credentialsExposed: false;
  privateMaterialUsed: false;
  actorInteractionTextUsed: false;
}
