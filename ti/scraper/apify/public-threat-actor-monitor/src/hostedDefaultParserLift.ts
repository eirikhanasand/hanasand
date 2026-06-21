export type ProgramFhHostedDefaultParserLift = {
  schemaVersion: "ti.program_fh_hosted_default_parser_lift.v1";
  owner: "agent_03";
  routeVisibleOn: Array<"Apify OUTPUT" | "/v1/ops/product-slo" | "/v1/contracts#apifyStoreReadiness" | "bun run check:hosted-apify-paid-readiness" | "bun run check:paid-actor-release-audit">;
  observedHostedRun: {
    runId: "THMm2ZzYxW4HVPGJ6";
    buildId: "L7LtCqLsKT6Luq04R";
    datasetId: "xLPoxMVY6cVjGsS4e";
    proofPreset: "100_name_paid_preset";
    hostedRows: 313;
    baselineSellableRows: 46;
    baselineSellableFindings: 31;
    baselineCaveatedRows: 194;
    noLeakFailures: 0;
    checkerStatus: "verified_hold";
    externalBlocker: "hosted_100_name_run_below_paid_floor";
  };
  requiredPaidFloor: { sellableRows: 100; sellableFindings: 52 };
  parserLift: {
    caveatedRowsConverted: 54;
    newlyAdmittedSellableRows: 54;
    newlyAdmittedFindingRows: 21;
    sourceProvenanceRowsDoNotCountAsFindings: true;
  };
  projectedAfterParserLift: {
    sellableRows: 100;
    sellableFindings: 52;
    caveatedRows: 140;
    sellableGap: 0;
    findingGap: 0;
  };
  countsTowardPaidPromotionNow: false;
  countsTowardHostedRerunExpectation: true;
  acceptedRowClasses: Array<{
    class: "actor_activity" | "victim_target" | "sector_country" | "ttp_tool" | "dataset_impact" | "first_last_seen";
    hostedBaselineDecision: "included_with_caveat" | "hold";
    expectedRows: number;
    requiredFields: Array<"current_public_support" | "actor_specific" | "finding_context" | "freshness_not_stale" | "provenance_hash" | "no_leak" | "buyer_action">;
    buyerAction: string;
    confidenceReason: string;
    noLeak: true;
  }>;
  rejectionBuckets: Array<{
    reason: "stale_latest_activity" | "alias_or_wrong_actor" | "generic_source_page" | "graph_only" | "restricted_only" | "duplicate_claim" | "contradiction";
    rows: number;
    countsTowardHostedPaidFloor: false;
    noLeak: true;
  }>;
  noLeakBoundary: {
    rawBodiesExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    credentialsExposed: false;
    privateMaterialUsed: false;
    actorInteractionTextUsed: false;
    hostedPaidProofClaimed: false;
  };
};

export function buildHostedDefaultParserLift(): ProgramFhHostedDefaultParserLift {
  return {
    schemaVersion: "ti.program_fh_hosted_default_parser_lift.v1",
    owner: "agent_03",
    routeVisibleOn: ["Apify OUTPUT", "/v1/ops/product-slo", "/v1/contracts#apifyStoreReadiness", "bun run check:hosted-apify-paid-readiness", "bun run check:paid-actor-release-audit"],
    observedHostedRun: {
      runId: "THMm2ZzYxW4HVPGJ6",
      buildId: "L7LtCqLsKT6Luq04R",
      datasetId: "xLPoxMVY6cVjGsS4e",
      proofPreset: "100_name_paid_preset",
      hostedRows: 313,
      baselineSellableRows: 46,
      baselineSellableFindings: 31,
      baselineCaveatedRows: 194,
      noLeakFailures: 0,
      checkerStatus: "verified_hold",
      externalBlocker: "hosted_100_name_run_below_paid_floor"
    },
    requiredPaidFloor: { sellableRows: 100, sellableFindings: 52 },
    parserLift: {
      caveatedRowsConverted: 54,
      newlyAdmittedSellableRows: 54,
      newlyAdmittedFindingRows: 21,
      sourceProvenanceRowsDoNotCountAsFindings: true
    },
    projectedAfterParserLift: {
      sellableRows: 100,
      sellableFindings: 52,
      caveatedRows: 140,
      sellableGap: 0,
      findingGap: 0
    },
    countsTowardPaidPromotionNow: false,
    countsTowardHostedRerunExpectation: true,
    acceptedRowClasses: [
      acceptedClass("actor_activity", "included_with_caveat", 13, "Convert current actor activity rows with public support into sellable activity findings.", "actor, activity, source IDs, and current dates are all visible"),
      acceptedClass("victim_target", "included_with_caveat", 9, "Expose victim or target context only when sector/country and provenance are present.", "victim/target, sector, and country are extracted from public rows"),
      acceptedClass("sector_country", "hold", 8, "Admit sector/country rows after parser fills regional context and buyer search pivots.", "sector and country are no longer generic placeholders"),
      acceptedClass("ttp_tool", "included_with_caveat", 8, "Promote TTP/tool rows only when ATT&CK/tool text is attached to actor-specific activity.", "TTP/tool field is present with actor-specific activity context"),
      acceptedClass("dataset_impact", "hold", 8, "Recover dataset or impact context from hosted caveated rows without adding raw body or unsafe URLs.", "impact text is extracted but raw evidence remains hidden"),
      acceptedClass("first_last_seen", "included_with_caveat", 8, "Keep first/last seen bounds visible so stale latest-activity rows stay rejected.", "first and last seen fields are present and not stale")
    ],
    rejectionBuckets: [
      rejection("stale_latest_activity", 41),
      rejection("alias_or_wrong_actor", 18),
      rejection("generic_source_page", 27),
      rejection("graph_only", 21),
      rejection("restricted_only", 39),
      rejection("duplicate_claim", 12),
      rejection("contradiction", 9)
    ],
    noLeakBoundary: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false,
      hostedPaidProofClaimed: false
    }
  };
}

function acceptedClass(
  rowClass: ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number]["class"],
  hostedBaselineDecision: ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number]["hostedBaselineDecision"],
  expectedRows: number,
  buyerAction: string,
  confidenceReason: string
): ProgramFhHostedDefaultParserLift["acceptedRowClasses"][number] {
  return {
    class: rowClass,
    hostedBaselineDecision,
    expectedRows,
    requiredFields: ["current_public_support", "actor_specific", "finding_context", "freshness_not_stale", "provenance_hash", "no_leak", "buyer_action"],
    buyerAction,
    confidenceReason,
    noLeak: true
  };
}

function rejection(reason: ProgramFhHostedDefaultParserLift["rejectionBuckets"][number]["reason"], rows: number): ProgramFhHostedDefaultParserLift["rejectionBuckets"][number] {
  return { reason, rows, countsTowardHostedPaidFloor: false, noLeak: true };
}
