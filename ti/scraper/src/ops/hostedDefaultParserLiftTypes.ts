export type ProgramFhHostedDefaultParserLift = {
  schemaVersion: "ti.program_fh_hosted_default_parser_lift.v1";
  owner: "agent_03";
  routeVisibleOn: Array<"Apify OUTPUT" | "/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "bun run check:hosted-apify-paid-readiness" | "bun run check:paid-actor-release-audit">;
  observedHostedRun: {
    runId: "THMm2ZzYxW4HVPGJ6"; buildId: "L7LtCqLsKT6Luq04R"; datasetId: "xLPoxMVY6cVjGsS4e";
    proofPreset: "100_name_paid_preset"; hostedRows: 313; baselineSellableRows: 46; baselineSellableFindings: 31;
    baselineCaveatedRows: 194; noLeakFailures: 0; checkerStatus: "verified_hold"; externalBlocker: "hosted_100_name_run_below_paid_floor";
  };
  requiredPaidFloor: { sellableRows: 100; sellableFindings: 52 };
  parserLift: { caveatedRowsConverted: 54; newlyAdmittedSellableRows: 54; newlyAdmittedFindingRows: 21; sourceProvenanceRowsDoNotCountAsFindings: true };
  projectedAfterParserLift: { sellableRows: 100; sellableFindings: 52; caveatedRows: 140; sellableGap: 0; findingGap: 0 };
  countsTowardPaidPromotionNow: false;
  countsTowardHostedRerunExpectation: true;
  acceptedRowClasses: Array<{
    class: "actor_activity" | "victim_target" | "sector_country" | "ttp_tool" | "dataset_impact" | "first_last_seen";
    hostedBaselineDecision: "included_with_caveat" | "hold";
    expectedRows: number;
    requiredFields: Array<"current_public_support" | "actor_specific" | "finding_context" | "freshness_not_stale" | "provenance_hash" | "no_leak" | "buyer_action">;
    buyerAction: string; confidenceReason: string; noLeak: true;
  }>;
  rejectionBuckets: Array<{
    reason: "stale_latest_activity" | "alias_or_wrong_actor" | "generic_source_page" | "graph_only" | "restricted_only" | "duplicate_claim" | "contradiction";
    rows: number; countsTowardHostedPaidFloor: false; noLeak: true;
  }>;
  noLeakBoundary: {
    rawBodiesExposed: false; unsafeUrlsExposed: false; restrictedPayloadsExposed: false; credentialsExposed: false;
    privateMaterialUsed: false; actorInteractionTextUsed: false; hostedPaidProofClaimed: false;
  };
};
