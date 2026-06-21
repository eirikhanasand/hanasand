export interface ParserToSellableRepairPacket {
  schemaVersion: "ti.apify_parser_to_100_sellable_rows_packet.v1";
  owner: "agent_03";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  targetSellableRows: 100;
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  productionSellableClaimed: false;
  projectedCandidateRows: number;
  projectedUsefulRows: number;
  projectedFreshRows: number;
  projectedSellableFloorProgress: number;
  candidateDecision: "sellable_candidate_after_parser_repair";
  candidates: Array<{
    id: string;
    actor: string;
    family: "apt" | "ransomware";
    sourceFamily: "vendor_report" | "cert_advisory" | "rss_security_blog" | "github_security_advisory" | "public_channel_handoff" | "dark_metadata_public_support";
    currentDecision: "hold" | "coverage_gap_only" | "included_with_caveat";
    dryRunDecision: "sellable_candidate_after_parser_repair";
    projectedRows: number;
    parserFieldsUnlocking: Array<"victim" | "sector" | "country" | "dataset_or_impact" | "ttp_tool" | "first_seen" | "last_seen" | "confidence" | "source_family_support" | "provenance_hash" | "next_buyer_search">;
    sourceFamilyGaps: string[];
    graphPivotGaps: string[];
    suppressionChecks: string[];
    provenanceHash: string;
    nextBuyerSearches: string[];
    requiresSourceCorroboration: true;
    noLeak: true;
  }>;
  rejectedRepairs: Array<{
    id: string;
    blockedReason: "stale_report" | "alias_collision" | "unrelated_actor_co_mention" | "generic_marketing_page" | "raw_body_or_unsafe_url_request" | "payload_request" | "private_auth_captcha_dependency";
    currentDecision: "hold" | "coverage_gap_only" | "included_with_caveat" | "suppress";
    projectedRows: 0;
    doesNotCountToward100Floor: true;
    noLeak: true;
  }>;
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_10";
    handoff: string;
    expectedCandidateRows: number;
  }>;
  noLeakBoundary: {
    rawBodiesExposed: false;
    unsafeUrlsExposed: false;
    payloadsRequested: false;
    privateAuthCaptchaAccess: false;
    restrictedMaterialExposed: false;
    productionSellableClaimed: false;
  };
}
