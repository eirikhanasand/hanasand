import type { HostedDefaultParserLiftContract } from "./commonActorTypes.ts";

export interface ProgramFhHostedPublicCorroborationLift {
  schemaVersion: "ti.program_fh_hosted_public_corroboration_lift.v1";
  owner: "agent_08";
  observedHostedRun: HostedDefaultParserLiftContract["observedHostedRun"];
  acceptedPublicCorroborationRows: Array<{
    class: "single_source" | "stale_timestamp" | "missing_sector_country" | "missing_ttp_tool" | "missing_buyer_action" | "missing_confidence_reason";
    hostedBaselineDecision: "included_with_caveat" | "hold";
    expectedRowsUnlockedAfterParserAdmission: number;
    buyerVisibleMetricImproved: "source_family_diversity" | "freshness" | "sector_country" | "ttp_tool" | "buyer_action" | "confidence_reason";
    publicSourceFamily: "vendor_report" | "government_advisory" | "cert_advisory" | "security_blog" | "public_report" | "victim_notice";
    parserHandoff: string;
    provenanceHash: string;
    countsTowardPaidPromotionNow: false;
    noLeak: true;
  }>;
  rejectedPublicCorroborationRows: Array<{
    reason: "stale_latest_activity" | "alias_or_wrong_actor" | "generic_source_page" | "graph_only" | "restricted_only" | "duplicate_claim" | "contradiction";
    rows: number;
    buyerVisibleMetricImproved: "none";
    countsTowardPaidPromotionNow: false;
    noLeak: true;
  }>;
  projectedHostedRerunEffect: {
    baselineSellableRows: 46;
    acceptedCorroborationRows: 54;
    expectedSellableRowsAfterParserAdmission: 100;
    baselineSellableFindings: 31;
    expectedFindingRowsAfterParserAdmission: 52;
    hostedPaidProofClaimed: false;
  };
  noLeakBoundary: {
    rawBodiesExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    credentialsExposed: false;
    privateMaterialUsed: false;
    actorInteractionTextUsed: false;
  };
}
