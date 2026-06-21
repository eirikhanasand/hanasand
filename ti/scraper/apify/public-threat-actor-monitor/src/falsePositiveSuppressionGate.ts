export interface FalsePositiveSuppressionGate {
  schemaVersion: "ti.apify_paid_row_false_positive_suppression_gate.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  fixtures: Array<{
    id: string;
    actor: string;
    family: "apt" | "ransomware" | "unknown";
    scenario: "alias_collision" | "common_victim_name" | "unrelated_actor_co_mention" | "stale_repost_as_current" | "single_source_requires_caveat" | "metadata_only_without_public_support" | "true_positive_preserved" | "unknown_search_suppressed" | "contradicted_claim";
    currentPaidRowDecision: "chargeable" | "caveated" | "held" | "suppressed" | "searching";
    correctedDecision: "chargeable" | "caveated" | "held" | "suppressed" | "searching";
    reasonCode: "alias_collision" | "ambiguous_victim_name" | "unrelated_actor_co_mention" | "stale_repost_as_current" | "single_source_without_caveat" | "metadata_only_without_public_support" | "true_positive_sellable" | "unknown_query_searching" | "contradicted_claim";
    buyerVisibleEffect: string;
    repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    nextRepairAction: string;
    currentBuyerTrust: number;
    correctedBuyerTrust: number;
    preventsBilling: boolean;
    noLeak: true;
  }>;
  lift: {
    falsePositivesSuppressed: number;
    contradictedRowsHeld: number;
    staleRepostsBlocked: number;
    singleSourceRowsCaveated: number;
    truePositivesPreserved: number;
    sellableRowsProtected: number;
    buyerTrustDelta: number;
    rowsPreventedFromBilling: number;
  };
  programCpHardening: {
    schemaVersion: "ti.apify_program_cp_paid_row_false_positive_freshness_hardening.v1";
    activeCandidatePoolRowsAudited: 100;
    apifySmokeRowsAudited: 12;
    currentChargeableRows: number;
    rowCountInflationBlocked: number;
    staleLatestActivityRowsBlocked: number;
    aliasCollisionRowsBlocked: number;
    wrongActorRowsBlocked: number;
    genericSourcePageRowsBlocked: number;
    unrelatedCoMentionRowsBlocked: number;
    graphOnlyRowsBlocked: number;
    restrictedOnlyRowsHeld: number;
    syntheticProofRowsBlocked: number;
    lowBuyerValueRowsBlocked: number;
    caveatedRowsExcludedFromChargeable: number;
    truePositiveRowsPreserved: number;
    suppressionProof: Array<{
      class: "stale_latest_activity" | "alias_collision" | "wrong_actor" | "generic_source_page" | "unrelated_co_mention" | "graph_only" | "restricted_only" | "synthetic_proof_only" | "low_buyer_value" | "caveated_only";
      exampleActor: string;
      countsTowardSellable: false;
      proof: string;
      repairOwner: "agent_03" | "agent_04" | "agent_05" | "agent_06" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    }>;
    preservedTruePositiveProof: Array<{
      actor: string;
      requiredSignals: Array<"current_public_support" | "actor_specific" | "victim_or_dataset_context" | "provenance_hash" | "no_leak" | "buyer_action">;
      countsTowardSellable: true;
      whyBuyerShouldCare: string;
      nextBuyerSearch: string;
      provenanceHash: string;
      noLeak: true;
    }>;
    fastestRepairsTo100: Array<{
      owner: "agent_03" | "agent_04" | "agent_05" | "agent_06" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      blocker: "freshness" | "alias_collision" | "wrong_actor" | "generic_source_page" | "caveated_source_corroboration" | "restricted_only_public_support" | "graph_public_corroboration" | "marketplace_wording" | "evidence_no_leak" | "paid_release_accounting";
      rowsBlocked: number;
      expectedSellableRowsAfterRepair: number;
      nextAction: string;
      countsTowardPaidFloorNow: false;
    }>;
    secondBatchAudit: {
      schemaVersion: "ti.apify_program_cp_second_batch_candidate_audit.v1";
      auditedPreset: "smoke_fixture" | "100_name_paid_preset";
      localProofRows: number;
      currentSellableRows: number;
      sellableFindingRows: number;
      sellableSourceProvenanceRows: number;
      sourceProvenanceRowsCountTowardFindingFloor: false;
      localProofPassed100RowFloor: boolean;
      hostedProofRequired: true;
      hostedProofCountsTowardPaidPromotion: false;
      externalMarketplaceVerificationRequired: true;
      staleLatestActivitySellableRows: number;
      aliasOrWrongActorSellableRows: number;
      genericSourcePageSellableRows: number;
      graphOnlySellableRows: number;
      restrictedOnlySellableRows: number;
      caveatedRowsCountTowardChargeable: false;
      findingAdmissionRequiredSignals: Array<"current_public_support" | "actor_specific" | "finding_context" | "freshness_not_stale" | "provenance_hash" | "no_leak" | "buyer_action">;
      rowInflationGuards: Array<{
        guard: "source_provenance_padding" | "stale_latest_activity" | "alias_or_wrong_actor" | "generic_source_page" | "graph_only" | "restricted_only" | "caveated_as_chargeable";
        countsTowardPaidPromotion: false;
        proof: string;
        owner: "agent_03" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
      }>;
      noLeakProof: {
        rawEvidenceExposed: false;
        unsafeUrlsExposed: false;
        restrictedPayloadsExposed: false;
        objectKeysExposed: false;
        privateMaterialExposed: false;
        accountMaterialExposed: false;
        actorInteractionContentExposed: false;
      };
    };
    noLeakProof: {
      rawEvidenceExposed: false;
      unsafeUrlsExposed: false;
      restrictedPayloadsExposed: false;
      objectKeysExposed: false;
      privateMaterialExposed: false;
      accountMaterialExposed: false;
      actorInteractionContentExposed: false;
    };
  };
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    fixtureCount: number;
    blockerFocus: string;
    expectedEffect: string;
  }>;
  noLeakProof: {
    rawEvidenceExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
    privateMaterialExposed: false;
    accountMaterialExposed: false;
    actorInteractionContentExposed: false;
  };
}
