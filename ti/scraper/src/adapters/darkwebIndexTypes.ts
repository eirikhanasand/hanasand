export type DarkwebIndexNetwork = "tor" | "i2p" | "freenet";
export type DarkwebIndexCategory = "forum" | "marketplace" | "leak_extortion" | "paste" | "directory" | "blog" | "research" | "email_contact" | "mirror" | "service" | "abuse" | "unknown";
export type DarkwebIndexLegalTriage = "benign" | "news_or_research" | "marketplace_or_illicit" | "leak_or_extortion" | "malware_or_payload" | "credential_or_abuse" | "unknown_requires_review" | "blocked_unsafe";
export type DarkwebIndexLiveness = "live" | "dead" | "intermittent" | "blocked_by_policy" | "requires_review" | "unknown";
export type DarkwebIndexReviewState = "approved_metadata_only" | "needs_review" | "legal_hold" | "blocked_unsafe" | "false_positive_review";
export type DarkwebIndexSourceType = "directory" | "seed_list" | "analyst_import" | "public_report" | "safe_search_result" | "internal_discovery";
export type DarkwebIndexSourceApprovalState = "approved_metadata_only" | "pending_legal_review" | "disabled_kill_switch" | "blocked_unsafe";

export interface DarkwebIndexNoLeakSerialization {
  passed: boolean;
  forbiddenFields: string[];
  rule: string;
}

export interface DarkwebIndexRecord {
  id: string;
  network: DarkwebIndexNetwork;
  category: DarkwebIndexCategory;
  legalTriage: DarkwebIndexLegalTriage;
  liveness: DarkwebIndexLiveness;
  reviewState: DarkwebIndexReviewState;
  title: string;
  safeSummary: string;
  actorHints: string[];
  victimHints: string[];
  datasetHints: string[];
  sectorHints: string[];
  countryHints: string[];
  sourceFamily: string;
  firstSeen: string;
  lastSeen: string;
  rawUrlHash: string;
  sourceHash: string;
  safeLocatorHash: string;
  provenance: { sourceType: DarkwebIndexSourceType; sourceHash: string };
  isolationBoundary: {
    metadataOnly: true;
    noPayloadFollowing: true;
    noCredentialDownloads: true;
    noThreatActorInteraction: true;
  };
  valueScore: number;
}

export type DarkwebIndexBuyerRow = Pick<DarkwebIndexRecord,
  "id" | "network" | "category" | "title" | "safeSummary" | "actorHints" | "victimHints" |
  "datasetHints" | "sectorHints" | "countryHints" | "firstSeen" | "lastSeen" | "liveness" |
  "legalTriage" | "reviewState" | "valueScore" | "safeLocatorHash"
> & { noLeakProof: string };

export interface DarkwebIndexStatusDto {
  endpoint: "/v1/darkweb/status";
  generatedAt: string;
  metadataOnly: true;
  indexedRecordCount: number;
  monitoredSourceCount: number;
  sellableRowCount: number;
  liveRowCount: number;
  blockedRowCount: number;
  latestRecordAt?: string;
  counts: {
    byNetwork: Record<string, number>;
    byLegalTriage: Record<string, number>;
    byLiveness: Record<string, number>;
    byReviewState: Record<string, number>;
  };
  noLeakSerialization: DarkwebIndexNoLeakSerialization;
  productHandoff: { buyerSearchRows: DarkwebIndexBuyerRow[]; noLeakSerialization: DarkwebIndexNoLeakSerialization };
}

export interface DarkwebIndexSearchDto {
  generatedAt: string;
  query: string;
  filters: { network?: string; category?: string; legalTriage?: string; reviewState?: string };
  count: number;
  rows: DarkwebIndexBuyerRow[];
  canonicalIdentity?: {
    type: "actor";
    canonicalName: string;
    aliases: string[];
    canonicalPath: string;
    restrictedEvidenceState: "available" | "no_approved_restricted_evidence";
    restrictedRecordCount: number;
  };
  nextCursor?: string;
  noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexContractDto {
  routes: string[];
  searchableFields: string[];
  safety: Record<string, boolean>;
  sourceIngest: {
    sourceTypes: DarkwebIndexSourceType[];
    approvalStates: DarkwebIndexSourceApprovalState[];
    dedupeKeys: string[];
    runtimeMode: "metadata_only";
  };
}
