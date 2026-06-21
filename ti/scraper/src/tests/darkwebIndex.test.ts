import { describe, expect, test } from "bun:test";

import {
  buildDarkwebIndexStatus,
  darkwebIndexContract,
  darkwebIndexFixtureRecords,
  searchDarkwebIndex
} from "../adapters/darkwebIndex.ts";

describe("darkweb metadata index contracts", () => {
  test("builds synthetic 60k-scale metadata records with isolated collection boundaries", () => {
    const records = darkwebIndexFixtureRecords(100);
    const status = buildDarkwebIndexStatus(records);
    const contract = darkwebIndexContract();

    expect(records).toHaveLength(100);
    expect(status).toMatchObject({
      endpoint: "/v1/darkweb/status",
      metadataOnly: true,
      targetRecordCount: 60000,
      fixtureRecordCount: 100,
      indexedRecordEstimate: 60000,
      sourceIngestReadiness: {
        collectorRuntime: {
          mode: "contract_only_no_network",
          dryRunOnly: true,
          approvedProxyRequired: true,
          hostNetworkAllowed: false,
          sharedCredentialMountAllowed: false,
          writableHostMountAllowed: false,
          quarantineArtifactDescriptorsOnly: true
        }
      },
      storageReadiness: {
        migrationMode: "contract_only",
        agent06Handoff: "darkweb_index_records_refresh_runs_classification_history"
      }
    });
    expect(contract.routes).toEqual(expect.arrayContaining([
      "/v1/darkweb/status",
      "/v1/darkweb/search",
      "/v1/contracts"
    ]));
    expect(contract.safety).toMatchObject({
      metadataOnly: true,
      isolatedCollectorOnly: true,
      noPayloadFollowing: true,
      noCredentialDownloads: true,
      noPrivateAccess: true,
      noCaptchaSolving: true,
      noThreatActorInteraction: true,
      noRawUnsafeUrlPublicOutput: true
    });
    expect(contract.sourceIngest).toMatchObject({
      sourceTypes: expect.arrayContaining(["directory", "seed_list", "analyst_import", "public_report", "safe_search_result", "internal_discovery"]),
      approvalStates: expect.arrayContaining(["approved_metadata_only", "pending_legal_review", "disabled_kill_switch", "blocked_unsafe"]),
      dedupeKeys: expect.arrayContaining(["rawUrlHash", "hostHash", "pathHash", "titleHash", "contentHash", "sourceHash"]),
      runtimeMode: "contract_only_no_network"
    });
    expect(status.storageReadiness.handoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_storage_handoff.v1",
      owner: "Agent 06",
      migrationMode: "contract_only_no_database_connection",
      willConnectToDatabase: false,
      willMutate: false,
      replay: {
        sourceCheckpoint: "darkweb_index_refresh_runs.next_cursor",
        idempotencyKey: "raw_url_hash_plus_source_hash",
        duplicatePolicy: "upsert_metadata_only_by_hashes",
        cursorContinuity: "preserve_search_cursor_and_refresh_cursor",
        backfillChunks: [100, 1000, 10000, 60000]
      },
      hashLookup: {
        publicLookupAllowed: false,
        operatorOnlyFutureRoute: "/v1/darkweb/hash-lookup",
        outputRule: "return_redacted_descriptor_only"
      },
      retention: {
        defaultClass: "restricted_metadata",
        legalHoldClass: "legal_hold",
        reviewClass: "short_review"
      }
    });
    expect(status.storageReadiness.handoff.tables.map((table) => table.table)).toEqual([
      "darkweb_index_records",
      "darkweb_index_sources",
      "darkweb_index_refresh_runs",
      "darkweb_index_classification_history",
      "darkweb_index_liveness_checks",
      "darkweb_index_review_notes"
    ]);
    expect(status.storageReadiness.handoff.tables.every((table) =>
      ["raw_url", "body", "payload", "credential", "private_message", "actor_interaction"].every((column) => table.forbiddenColumns.includes(column))
    )).toBe(true);
    expect(status.storageReadiness.handoff.indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "darkweb_index_hash_lookup",
      "darkweb_index_safe_summary_text_idx",
      "darkweb_index_retention_review_idx"
    ]));
    expect(status.storageReadiness.handoff.noLeakStorageGuarantees).toEqual(expect.arrayContaining([
      "hash_only_locators",
      "no_raw_url_columns",
      "no_body_or_html_columns",
      "no_payload_or_credential_columns"
    ]));
    expect(status.liveValueExpansion).toMatchObject({
      schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
      owner: "Agent 05",
      mode: "metadata_only_ready_to_import_value_expansion",
      willFetchNetwork: false,
      willScheduleLiveWork: false,
      sourceCountInflationBlocked: true,
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.liveValueExpansion.tiers.map((tier) => tier.tier)).toEqual(["tier_1000", "tier_4000"]);
    expect(status.liveValueExpansion.tiers.every((tier) =>
      tier.candidateRows.length >= 12 &&
      tier.buyerSearchProof.sampleRows.length === 12 &&
      tier.buyerSearchProof.usefulQueryCount >= 20 &&
      tier.advancementDecision === "hold_for_value_density" &&
      tier.blockers.includes("stale_duplicate_or_review_rows_do_not_count_toward_tier") &&
      tier.rejectedLowValueCandidateCount > tier.valueQualifiedCandidateCount &&
      tier.candidateRows.every((row) =>
        row.safeLocatorHash.length > 0 &&
        row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
        row.whyWorthPayingFor.includes("without exposing raw locations") &&
        row.firstSeen.length > 0 &&
        row.lastSeen.length > 0
      )
    )).toBe(true);
    expect(status.liveValueExpansion.refreshScheduleSemantics).toHaveLength(6);
    expect(status.liveValueExpansion.refreshScheduleSemantics.every((schedule) =>
      schedule.cadenceMinutes > 0 &&
      schedule.lastSuccessAt.length > 0 &&
      schedule.nextDueAt.length > 0 &&
      schedule.expectedRowsPerDay > 0 &&
      schedule.approvedBoundary === "metadata_only_no_network_in_this_contract"
    )).toBe(true);
    expect(status.liveValueExpansion.valueGateRejects.map((row) => row.reason)).toEqual(expect.arrayContaining([
      "duplicate",
      "stale_mirror",
      "generic_listing",
      "no_actor_victim_dataset_hint",
      "unsafe_output_risk",
      "review_or_legal_hold",
      "auth_captcha_private_dependency",
      "low_buyer_value"
    ]));
    expect(status.liveValueExpansion.valueGateRejects.every((row) => row.doesNotCountTowardTier)).toBe(true);
    expect(status.publicIntelligenceHandoff100).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_intelligence_handoff_100.v1",
      owner: "Agent 05",
      mode: "metadata_only_public_intelligence_handoff",
      candidateTarget: 100,
      candidateCount: 100,
      publicCorroboratedCount: 0,
      usefulCaveatedCount: 2,
      projectedContributionToward100SellableRows: 0,
      averageBuyerValueScore: 0.41,
      staleRate: 0.92,
      duplicateRate: 0.06,
      unsafeRate: 0.24,
      authPrivateCaptchaRate: 0.33,
      safety: {
        metadataOnly: true,
        willFetchNetwork: false,
        rawUnsafeUrlsExposed: false,
        stolenFilesDownloaded: false,
        credentialsRetrieved: false,
        payloadsFollowed: false,
        privateAuthCaptchaAccess: false,
        actorInteraction: false
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.publicIntelligenceHandoff100.decisionCounts).toEqual({
      sellable_with_public_support: 0,
      included_with_caveat: 2,
      coverage_gap_only: 28,
      hold: 46,
      suppress: 24
    });
    expect(status.publicIntelligenceHandoff100.rows).toHaveLength(100);
    expect(status.publicIntelligenceHandoff100.rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      row.nextPublicCorroborationPivots.length > 0 &&
      row.firstSeen.length > 0 &&
      row.lastSeen.length > 0
    )).toBe(true);
    expect(status.publicIntelligenceHandoff100.rows.filter((row) => row.decision === "sellable_with_public_support").every((row) =>
      row.publicSupportState === "public_supported"
    )).toBe(true);
    expect(status.publicIntelligenceHandoff100.rejectionReasons.map((row) => row.reason)).toEqual(expect.arrayContaining([
      "duplicate",
      "stale_or_dead",
      "missing_useful_hint",
      "restricted_only_without_public_support",
      "unsafe_or_blocked",
      "auth_private_captcha_dependency",
      "legal_or_review_hold",
      "low_buyer_value"
    ]));
    expect(status.publicIntelligenceHandoff100.rejectionReasons.every((row) => row.doesNotCountTowardSellableRows)).toBe(true);
    expect(status.publicIntelligenceHandoff100.handoffs.agent03ParserGaps.length).toBeGreaterThan(0);
    expect(status.publicIntelligenceHandoff100.handoffs.agent04PublicCorroborationGaps.length).toBeGreaterThan(0);
    expect(status.publicIntelligenceHandoff100.handoffs.agent08GraphPivots.length).toBeGreaterThan(0);
    expect(status.publicIntelligenceHandoff100.handoffs.agent10RevenueGateCounts).toMatchObject({
      targetSellableRows: 100,
      sellableWithPublicSupport: 0,
      usefulCaveatedRows: 2,
      coverageGapOnlyRows: 28,
      heldRows: 46,
      suppressedRows: 24,
      projectedContributionToward100SellableRows: 0
    });
    expect(status.publicSupportWorklist40).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_worklist_40.v1",
      owner: "Agent 05",
      mode: "metadata_only_public_support_worklist",
      candidateSource: "publicIntelligenceHandoff100",
      topCandidateTarget: 40,
      topCandidateCount: 40,
      publicSupportReadyCount: 2,
      stillRestrictedOnlyCount: 11,
      projectedCaveatedRows: 0,
      projectedSellableRowsAfterPublicSupport: 2,
      contributionToward100SellableRows: 2,
      averageBuyerValueScore: 0.65,
      costPerUsefulRowEffect: {
        basis: "planning_estimate_no_spend",
        currentUsefulRows: 2,
        projectedUsefulRows: 4,
        usefulRowDelta: 2,
        estimatedAnalystMinutes: 24,
        costPerUsefulRowTrend: "improves_if_public_support_found"
      },
      safety: {
        metadataOnly: true,
        willFetchNetwork: false,
        rawUnsafeUrlsExposed: false,
        stolenFilesDownloaded: false,
        credentialsRetrieved: false,
        payloadsFollowed: false,
        privateAuthCaptchaAccess: false,
        actorInteraction: false
      }
    });
    expect(status.publicSupportWorklist40.staleDuplicateUnsafeLowValueRejections).toEqual({
      stale: 21,
      duplicate: 5,
      unsafe: 0,
      lowValue: 1
    });
    expect(status.publicSupportWorklist40.rows).toHaveLength(40);
    expect(status.publicSupportWorklist40.rows[0]).toMatchObject({
      rank: 1,
      publicSourceFamilyNeeded: "ransomware_tracker_or_public_dataset",
      expectedOutcome: "projected_sellable_after_public_support",
      noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials"
    });
    expect(status.publicSupportWorklist40.rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.parserFieldsNeeded.join(",") === "actor,victim,dataset,sector_country,claimed_date,source_family" &&
      row.publicSupportTarget.length > 0 &&
      row.whyBuyerWouldPayIfCorroborated.length > 0 &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials"
    )).toBe(true);
    expect(status.publicSupportWorklist40.rows.filter((row) => row.expectedOutcome === "projected_sellable_after_public_support").every((row) =>
      row.publicSupportState !== "restricted_only" &&
      row.actorHints.length > 0 &&
      (row.victimHints.length > 0 || row.datasetHints.length > 0)
    )).toBe(true);
    expect(status.publicSupportWorklist40.handoffs.agent04PublicSourceTargets.length).toBeGreaterThan(0);
    expect(status.publicSupportWorklist40.handoffs.agent03ParserFields).toEqual(expect.arrayContaining([
      expect.stringContaining("actor:"),
      expect.stringContaining("claimed_date:")
    ]));
    expect(status.publicSupportWorklist40.handoffs.agent08GraphPivots.length).toBeGreaterThan(0);
    expect(status.publicSupportWorklist40.handoffs.agent10RevenueGate).toMatchObject({
      targetSellableRows: 100,
      projectedSellableRowLift: 2,
      projectedCaveatedRows: 0,
      contributionToward100SellableRows: 2,
      usefulRowDelta: 2,
      costPerUsefulRowEffect: "improves_if_public_support_found"
    });
    expect(status.publicSupportLift1000).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_lift_1000.v1",
      owner: "Agent 05",
      mode: "metadata_only_public_support_lift_100_to_4000",
      candidateSource: "publicSupportWorklist40_and_darkweb_index_records",
      sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim",
      strictNoInflation: true,
      currentContributionToward100SellableRows: 2,
      first1000CandidateCount: 1000,
      first1000SellableAfterPublicSupport: 19,
      first1000UsefulWithCaveat: 12,
      first1000RestrictedOnlyHold: 141,
      first1000RejectedCounts: {
        stale: 285,
        duplicate: 6,
        unsafe: 333,
        lowValue: 204
      },
      first4000CandidateCount: 4000,
      first4000SellableAfterPublicSupport: 80,
      first4000UsefulWithCaveat: 54,
      first4000RestrictedOnlyHold: 556,
      first4000RejectedCounts: {
        stale: 1142,
        duplicate: 6,
        unsafe: 1333,
        lowValue: 829
      },
      first4000SupportBucketCounts: {
        currently_chargeable: 0,
        sellable_after_public_support: 80,
        useful_with_caveat: 54,
        restricted_only_hold: 556,
        stale_reject: 1142,
        duplicate_reject: 6,
        unsafe_reject: 1333,
        low_value_reject: 829,
        needs_parser_repair: 105,
        needs_source_support: 80
      },
      projectedContributionToward100PaidRowsAfterPublicSupport: 80,
      safety: {
        metadataOnly: true,
        willFetchNetwork: false,
        rawUnsafeUrlsExposed: false,
        stolenFilesDownloaded: false,
        credentialsRetrieved: false,
        payloadsFollowed: false,
        privateAuthCaptchaAccess: false,
        actorInteraction: false
      }
    });
    expect(status.publicSupportLift1000.tiers).toHaveLength(3);
    expect(status.publicSupportLift1000.tiers[0]).toMatchObject({
      tier: "top_100",
      targetCandidateCount: 100,
      evaluatedCandidateCount: 100,
      acceptedForPublicSupportCount: 31,
      contributionToward100SellableRows: 19,
      averageBuyerValueScore: 0.91,
      outcomeCounts: {
        sellable_after_public_support: 19,
        useful_with_caveat: 12,
        restricted_only_hold: 2,
        stale_reject: 65,
        duplicate_reject: 2,
        unsafe_reject: 0,
        low_value_reject: 0
      }
    });
    expect(status.publicSupportLift1000.tiers[1]).toMatchObject({
      tier: "tier_1000",
      targetCandidateCount: 1000,
      evaluatedCandidateCount: 1000,
      acceptedForPublicSupportCount: 31,
      contributionToward100SellableRows: 19,
      averageBuyerValueScore: 0.42,
      outcomeCounts: {
        sellable_after_public_support: 19,
        useful_with_caveat: 12,
        restricted_only_hold: 141,
        stale_reject: 285,
        duplicate_reject: 6,
        unsafe_reject: 333,
        low_value_reject: 204
      }
    });
    expect(status.publicSupportLift1000.tiers[2]).toMatchObject({
      tier: "tier_4000",
      targetCandidateCount: 4000,
      evaluatedCandidateCount: 4000,
      acceptedForPublicSupportCount: 134,
      contributionToward100SellableRows: 80,
      averageBuyerValueScore: 0.42,
      outcomeCounts: {
        sellable_after_public_support: 80,
        useful_with_caveat: 54,
        restricted_only_hold: 556,
        stale_reject: 1142,
        duplicate_reject: 6,
        unsafe_reject: 1333,
        low_value_reject: 829
      },
      supportBucketCounts: {
        currently_chargeable: 0,
        sellable_after_public_support: 80,
        useful_with_caveat: 54,
        restricted_only_hold: 556,
        stale_reject: 1142,
        duplicate_reject: 6,
        unsafe_reject: 1333,
        low_value_reject: 829,
        needs_parser_repair: 105,
        needs_source_support: 80
      }
    });
    expect(status.publicSupportLift1000.tiers[1].rows).toHaveLength(1000);
    expect(status.publicSupportLift1000.tiers[2].rows).toHaveLength(4000);
    expect(status.publicSupportLift1000.tiers[1].rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.requiredPublicSupportSources.length > 0 &&
      row.parserFieldsNeeded.join(",") === "actor,victim,dataset,sector_country,claimed_date,source_family,public_support_family,provenance_hash" &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      !row.countsTowardSellableFloorNow
    )).toBe(true);
    expect(status.publicSupportLift1000.tiers[2].rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.exactMissingField.length > 0 &&
      row.owningWorkerHandoff.length > 0 &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      !row.countsTowardSellableFloorNow
    )).toBe(true);
    expect(status.publicSupportLift1000.tiers[2].rows.filter((row) => row.outcome !== "sellable_after_public_support").every((row) =>
      !row.countsTowardSellableFloorAfterPublicSupport
    )).toBe(true);
    expect(status.publicSupportLift1000.tiers[2].rows.filter((row) => row.owningWorkerHandoff === "agent_03_parser_repair").every((row) =>
      row.exactMissingField === "actor" || row.exactMissingField === "victim_or_dataset"
    )).toBe(true);
    expect(status.publicSupportLift1000.tiers[2].rows.filter((row) => row.owningWorkerHandoff === "agent_04_source_support").every((row) =>
      row.outcome === "sellable_after_public_support" || row.outcome === "useful_with_caveat"
    )).toBe(true);
    expect(status.publicSupportLift1000.tiers[1].rows.filter((row) => row.outcome !== "sellable_after_public_support").every((row) =>
      !row.countsTowardSellableFloorAfterPublicSupport
    )).toBe(true);
    expect(status.publicSupportLift1000.tiers[1].rows.filter((row) => row.outcome === "sellable_after_public_support").every((row) =>
      row.actorHints.length > 0 &&
      (row.victimHints.length > 0 || row.datasetHints.length > 0) &&
      row.countsTowardSellableFloorAfterPublicSupport
    )).toBe(true);
    expect(status.publicSupportLift1000.first100RepairQueue).toHaveLength(100);
    expect(status.publicSupportLift1000.first100RepairQueue.filter((row) => row.rowDecision === "repair_for_sellable_after_public_support")).toHaveLength(80);
    expect(status.publicSupportLift1000.first100RepairQueue.filter((row) => row.rowDecision === "repair_for_useful_caveat")).toHaveLength(20);
    expect(status.publicSupportLift1000.first100RepairQueue.every((row) =>
      row.sourceTier === "tier_4000" &&
      row.actorOrGroupHint.length > 0 &&
      row.victimOrDatasetHint.length > 0 &&
      row.sectorCountry.length > 0 &&
      row.safeLocatorHash.length > 0 &&
      row.requiredPublicSupportFamily.length > 0 &&
      row.buyerValueReason.length > 0 &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      row.countsTowardSellableFloorNow === false
    )).toBe(true);
    expect(status.publicSupportLift1000.metricMovement).toMatchObject({
      repairCandidatesAdded: 100,
      likelySellableRowsAfterPublicSupport: 80,
      usefulCaveatedRows: 20,
      suppressedRows: 3866,
      remainingRowsToFirst100FloorAfterPublicSupport: 20,
      countsTowardSellableFloorNow: false
    });
    expect(status.publicSupportLift1000.publicSupportSellable100).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_sellable_100.v1",
      candidateSource: "publicSupportLift1000.first100RepairQueue",
      targetSellableRows: 100,
      candidateCount: 100,
      currentChargeableRows: 12,
      projectedAfterPublicSupportRows: 68,
      retiredRows: 20,
      remainingGapTo100Now: 88,
      remainingGapTo100AfterProjectedSupport: 20,
      rowDecisionCounts: {
        current_sellable_public_supported: 12,
        projected_after_public_support: 68,
        retired_not_chargeable: 20
      },
      countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"]
    });
    expect(status.publicSupportSellable100).toEqual(status.publicSupportLift1000.publicSupportSellable100);
    expect(status.publicSupportLift1000.publicSupportSellable100.rows).toHaveLength(100);
    expect(status.publicSupportLift1000.publicSupportSellable100.rows.filter((row) => row.countsTowardSellableFloorNow)).toHaveLength(12);
    expect(status.publicSupportLift1000.publicSupportSellable100.rows.filter((row) => row.rowDecision === "retired_not_chargeable").every((row) =>
      row.countsTowardSellableFloorNow === false &&
      row.countsTowardSellableFloorAfterPublicSupport === false
    )).toBe(true);
    expect(status.publicSupportLift1000.publicSupportSellable100.rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.safePublicSourceId.startsWith("public_support_source_") &&
      row.safePublicSourceHash.length > 0 &&
      row.parserRequirements.includes("safe_public_source_id") &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials"
    )).toBe(true);
    expect(status.publicSupportLift1000.publicSupportSellable100.agent03ParserHandoffRows).toHaveLength(100);
    expect(status.publicSupportLift1000.publicSupportSellable100.agent03ParserHandoffRows.every((row) =>
      row.handoffOwner === "agent_03_parser_repair" &&
      row.requiredFields.includes("actor") &&
      row.requiredFields.includes("victim_or_dataset") &&
      row.requiredFields.includes("safe_public_source_id") &&
      row.safePublicSourceHash.length > 0
    )).toBe(true);
    expect(status.publicSupportLift1000.publicSupportSellable250).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_sellable_250.v1",
      candidateSource: "publicSupportLift1000.tier_4000_ranked_rows",
      targetSellableRows: 100,
      candidateCount: 250,
      previousCurrentChargeableRows: 12,
      currentChargeableRows: 50,
      newlyChargeableRows: 38,
      projectedAfterPublicSupportRows: 30,
      blockedOrRetiredRows: 170,
      remainingGapTo100Now: 50,
      remainingGapTo100AfterProjectedSupport: 20,
      rowDecisionCounts: {
        current_sellable_public_supported: 50,
        projected_after_public_support: 30,
        blocked_not_chargeable: 170
      },
      countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"]
    });
    expect(status.publicSupportSellable250).toEqual(status.publicSupportLift1000.publicSupportSellable250);
    expect(status.publicSupportLift1000.publicSupportSellable250.rows).toHaveLength(250);
    expect(status.publicSupportLift1000.publicSupportSellable250.rows.filter((row) => row.countsTowardSellableFloorNow)).toHaveLength(50);
    expect(status.publicSupportLift1000.publicSupportSellable250.rows.filter((row) => row.newlyChargeableSinceSellable100)).toHaveLength(38);
    expect(status.publicSupportLift1000.publicSupportSellable250.newlyChargeableParserHandoffRows).toHaveLength(38);
    expect(Object.values(status.publicSupportLift1000.publicSupportSellable250.blockerBucketCounts).reduce((sum, count) => sum + count, 0)).toBe(200);
    expect(Object.keys(status.publicSupportLift1000.publicSupportSellable250.blockerBucketCounts).sort()).toEqual([
      "contradiction_false_claim_hold",
      "contradiction_hold",
      "duplicate_claim",
      "generic_source_only",
      "missing_buyer_action",
      "needs_public_support",
      "no_current_public_support",
      "stale_public_support",
      "unsafe_restricted_only",
      "victim_too_sensitive_to_surface"
    ]);
    expect(status.publicSupportLift1000.publicSupportSellable250.rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.safePublicSourceId.startsWith("public_support_250_source_") &&
      row.safePublicSourceHash.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.parserHandoffFields.includes("safe_public_source_id") &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      (row.rowDecision === "current_sellable_public_supported" || !row.countsTowardSellableFloorNow)
    )).toBe(true);
    expect(status.publicSupportLift1000.publicSupportSellable250.newlyChargeableParserHandoffRows.every((row) =>
      row.handoffOwner === "agent_03_parser_repair" &&
      row.countsTowardSellableFloorNow === true &&
      row.actor.length > 0 &&
      row.victimOrDataset.length > 0 &&
      row.sector.length > 0 &&
      row.country.length > 0 &&
      row.ttpOrTool.length > 0 &&
      row.datasetClaim.length > 0 &&
      row.safePublicSourceId.startsWith("public_support_250_source_") &&
      row.provenanceHash.length > 0
    )).toBe(true);
    expect(status.publicSupportLift1000.publicSupportSellable500).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_sellable_500.v1",
      candidateSource: "publicSupportLift1000.tier10000_ranked_rows",
      targetSellableRows: 250,
      candidateCount: 500,
      previousCurrentChargeableRows: 150,
      currentChargeableRows: 198,
      newlyChargeableRows: 48,
      projectedAfterPublicSupportRows: 0,
      blockedOrRetiredRows: 302,
      currentChargeable100: {
        currentChargeableCount: 198,
        newlyChargeableSinceProgramCw: 148,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 302,
        currentGapTo100: 0,
        currentGapTo250: 52,
        projectedGapTo250AfterPublicSupport: 52,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable150: {
        currentChargeableCount: 198,
        newlyChargeableSinceProgramDa: 98,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 302,
        currentGapTo150: 0,
        currentGapTo250: 52,
        projectedGapTo250AfterPublicSupport: 52,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable250: {
        currentChargeableCount: 198,
        newlyChargeableSinceProgramDc: 48,
        projectedAfterPublicSupportCount: 0,
        blockedOrRetiredCount: 302,
        currentGapTo250: 52,
        currentGapTo500: 302,
        countsProjectedRowsAsCurrent: false
      },
      rowDecisionCounts: {
        current_sellable_public_supported: 198,
        projected_after_public_support: 0,
        blocked_not_chargeable: 302
      },
      countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"]
    });
    expect(status.publicSupportSellable500).toEqual(status.publicSupportLift1000.publicSupportSellable500);
    expect(status.publicSupportLift1000.publicSupportSellable500.rows).toHaveLength(500);
    expect(status.publicSupportLift1000.publicSupportSellable500.rows.filter((row) => row.countsTowardSellableFloorNow)).toHaveLength(198);
    expect(status.publicSupportLift1000.publicSupportSellable500.rows.filter((row) => row.newlyChargeableSinceProgramCw)).toHaveLength(148);
    expect(status.publicSupportLift1000.publicSupportSellable500.rows.filter((row) => row.newlyChargeableSinceProgramDa)).toHaveLength(98);
    expect(status.publicSupportLift1000.publicSupportSellable500.rows.filter((row) => row.newlyChargeableSinceProgramDc)).toHaveLength(48);
    expect(status.publicSupportLift1000.publicSupportSellable500.newlyChargeableParserHandoffRows).toHaveLength(48);
    expect(Object.values(status.publicSupportLift1000.publicSupportSellable500.blockerBucketCounts).reduce((sum, count) => sum + count, 0)).toBe(302);
    expect(Object.keys(status.publicSupportLift1000.publicSupportSellable500.blockerBucketCounts).sort()).toEqual([
      "contradiction_false_claim_hold",
      "contradiction_hold",
      "duplicate_claim",
      "generic_source_only",
      "missing_buyer_action",
      "needs_public_support",
      "no_current_public_support",
      "stale_public_support",
      "unsafe_restricted_only",
      "victim_too_sensitive_to_surface"
    ]);
    expect(status.publicSupportLift1000.publicSupportSellable500.rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.safePublicSourceId.startsWith("public_support_500_source_") &&
      row.safePublicSourceHash.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.parserHandoffFields.includes("safe_public_source_id") &&
      row.whyWorthPayingFor.length > 0 &&
      row.nextSafeRecheckAfter.length > 0 &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      (row.rowDecision === "current_sellable_public_supported" || !row.countsTowardSellableFloorNow)
    )).toBe(true);
    expect(status.publicSupportLift1000.publicSupportSellable500.newlyChargeableParserHandoffRows.every((row) =>
      row.handoffOwner === "agent_03_parser_repair" &&
      row.countsTowardSellableFloorNow === true &&
      row.actor.length > 0 &&
      row.victimOrDataset.length > 0 &&
      row.sector.length > 0 &&
      row.country.length > 0 &&
      row.ttpOrTool.length > 0 &&
      row.datasetClaim.length > 0 &&
      row.safePublicSourceId.startsWith("public_support_500_source_") &&
      row.provenanceHash.length > 0 &&
      row.freshness === "fresh_current" &&
      row.newlyChargeableSinceProgramDa === true &&
      row.newlyChargeableSinceProgramDc === true &&
      row.recheckCadenceHours === 24 &&
      row.whyWorthPayingFor.length > 0
    )).toBe(true);
    expect(status.publicSupportLift1000.tier10000Preview).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_tier10000_preview.v1",
      baselineTier: "tier_4000",
      targetTier: "tier_10000",
      evaluatedCandidateCount: 10000,
      valueQualifiedCandidateCount: 340,
      projectedSellableAfterPublicSupport: 198,
      usefulWithCaveat: 142,
      restrictedOnlyHold: 1386,
      rejectedCounts: {
        stale: 2856,
        duplicate: 6,
        unsafe: 3333,
        lowValue: 2079
      },
      supportBucketCounts: {
        currently_chargeable: 0,
        sellable_after_public_support: 198,
        useful_with_caveat: 142,
        restricted_only_hold: 1386,
        stale_reject: 2856,
        duplicate_reject: 6,
        unsafe_reject: 3333,
        low_value_reject: 2079,
        needs_parser_repair: 266,
        needs_source_support: 198
      },
      acceptedValueDensity: 0.034,
      expansionDecision: "hold_for_value_density",
      countsTowardSellableFloorNow: false
    });
    expect(status.publicSupportLift1000.tier10000Preview.sampleRepairRows).toHaveLength(20);
    expect(status.publicSupportLift1000.tier10000Preview.sampleRepairRows.every((row) =>
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials" &&
      row.countsTowardSellableFloorNow === false
    )).toBe(true);
    expect(status.publicSupportLift1000.handoffs.agent10ReleaseMetrics).toMatchObject({
      productionSellableRowFloor: 100,
      currentContributionToward100SellableRows: 2,
      projectedTier1000SellableAfterPublicSupport: 19,
      projectedTier1000UsefulWithCaveat: 12,
      projectedTier4000SellableAfterPublicSupport: 80,
      projectedTier4000UsefulWithCaveat: 54,
      projectedContributionToward100PaidRowsAfterPublicSupport: 80,
      countedOnlyAfterSafePublicSupport: true
    });
    expect(contract.storageHandoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_storage_handoff.v1",
      tables: expect.arrayContaining(["darkweb_index_records", "darkweb_index_sources", "darkweb_index_refresh_runs"]),
      indexes: expect.arrayContaining(["darkweb_index_hash_lookup", "darkweb_index_category_liveness_review_idx"]),
      migrationMode: "contract_only_no_database_connection",
      hashLookup: "operator_only_future_route"
    });
    expect(status.schedulerReadiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_scheduler_handoff.v1",
      owner: "Agent 02",
      mode: "contract_only_no_worker_leases",
      willScheduleLiveWork: false,
      willMutateQueue: false,
      schedulerId: "darkweb_index_refresh",
      cadence: {
        highRiskMinutes: 360,
        standardMinutes: 1440,
        staleRecheckMinutes: 10080,
        legalReviewHoldMinutes: 0
      },
      budget: {
        targetRecordCount: 60000,
        maxRecordsPerRun: 2500,
        maxWorkerCount: 8,
        maxRunMinutes: 45,
        maxBytesPerPage: 262144,
        maxRedirects: 2
      },
      pressurePolicy: {
        publicSearchNonBlocking: true,
        duplicateRunReuse: "required",
        emergencyBrakeAction: "pause_darkweb_index_workers",
        retryBackoff: [15, 60, 240, 1440]
      }
    });
    expect(status.schedulerReadiness.lanes.map((lane) => lane.lane)).toEqual([
      "high_risk_leak_metadata",
      "standard_directory_refresh",
      "dead_or_intermittent_recheck",
      "legal_review_hold",
      "blocked_unsafe"
    ]);
    expect(status.schedulerReadiness.lanes.find((lane) => lane.lane === "blocked_unsafe")).toMatchObject({
      cadenceMinutes: 0,
      maxRecordsPerRun: 0,
      action: "skip_blocked"
    });
    expect(status.schedulerReadiness.noScheduleGuarantees).toEqual(expect.arrayContaining([
      "no_live_worker_leases_until_proxy_and_legal_approval",
      "no_payload_download_tasks",
      "no_auth_or_captcha_bypass_tasks",
      "no_threat_actor_interaction_tasks"
    ]));
    expect(status.parserRuntimeReadiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_parser_runtime.v1",
      owner: "Agent 03",
      mode: "isolated_landing_page_metadata_parser_contract",
      willFetchNetwork: false,
      runtime: {
        disposableWorkerRequired: true,
        approvedProxyRequired: true,
        hostNetworkAllowed: false,
        sharedCredentialMountAllowed: false,
        writableHostMountAllowed: false,
        javascriptPolicy: "disabled_or_instrumented",
        output: "quarantine_descriptor_only"
      }
    });
    expect(status.parserRuntimeReadiness.parserProfiles.map((profile) => profile.profile)).toEqual(expect.arrayContaining([
      "tor_landing_metadata",
      "i2p_landing_metadata",
      "freenet_landing_metadata",
      "directory_listing_metadata",
      "blocked_unsafe_stub"
    ]));
    expect(status.parserRuntimeReadiness.parserProfiles.every((profile) =>
      profile.allowedInputs.length > 0 &&
      profile.extractedFields.includes("legalTriage") &&
      ["rawUrl", "html", "body", "payloadBytes", "credentialValues", "privateMessages", "actorInteractionText"].every((field) => profile.blockedFields.includes(field))
    )).toBe(true);
    expect(status.parserRuntimeReadiness.blockedActions).toEqual(expect.arrayContaining([
      "stolen-file download",
      "credential dump download",
      "authentication bypass",
      "CAPTCHA solving",
      "private or invite-only access",
      "threat actor interaction"
    ]));
    expect(status.parserRuntimeReadiness.parserFailureClasses).toEqual(expect.arrayContaining([
      "unsafe_payload_link_detected",
      "credential_or_auth_prompt_detected",
      "captcha_or_private_access_detected",
      "actor_interaction_target_detected"
    ]));
    expect(contract.schedulerParserHandoff).toMatchObject({
      schedulerSchemaVersion: "ti.darkweb_index_scheduler_handoff.v1",
      parserSchemaVersion: "ti.darkweb_index_parser_runtime.v1",
      schedulerMode: "contract_only_no_worker_leases",
      parserMode: "isolated_landing_page_metadata_parser_contract",
      schedulerId: "darkweb_index_refresh",
      parserProfiles: expect.arrayContaining(["tor_landing_metadata", "blocked_unsafe_stub"])
    });
    expect(status.downstreamHandoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_downstream_handoff.v1",
      quality: {
        owner: "Agent 07",
        releaseGate: {
          requiresHumanReviewForRestrictedClaims: true,
          requiresCorroboratingPublicEvidence: true,
          blocksStandaloneDarkwebClaims: true
        }
      },
      graphStix: {
        owner: "Agent 08",
        relationshipPolicy: "descriptor_edges_review_hold",
        stixExportDefault: "hold_until_reviewed_and_correlated"
      },
      apiUi: {
        owner: "Agent 09",
        route: "/ti/darkweb/index",
        statusRoute: "/v1/darkweb/status",
        searchRoute: "/v1/darkweb/search"
      },
      opsRunbook: {
        owner: "Agent 10",
        killSwitch: {
          flag: "DARKWEB_INDEX_KILL_SWITCH",
          defaultState: "armed",
          action: "pause_workers_and_hold_sources"
        }
      }
    });
    expect(status.downstreamHandoff.quality.fixtures.map((fixture) => fixture.scenario)).toEqual(expect.arrayContaining([
      "benign_directory",
      "leak_claim_hold",
      "credential_abuse_block",
      "malware_payload_block",
      "false_positive_review",
      "stale_or_dead_recheck"
    ]));
    expect(status.downstreamHandoff.quality.fixtures.filter((fixture) => fixture.publicPromotionAllowed).every((fixture) => fixture.expectedReviewState === "approved_metadata_only")).toBe(true);
    expect(status.downstreamHandoff.graphStix.allowedEdges).toEqual(expect.arrayContaining(["source_describes_actor", "source_mentions_victim", "source_mentions_ttp", "mirror_of"]));
    expect(status.downstreamHandoff.graphStix.heldEdges).toEqual(expect.arrayContaining(["victim_claim", "credential_claim", "payload_claim", "actor_statement"]));
    expect(status.downstreamHandoff.graphStix.forbiddenStixObjects).toEqual(expect.arrayContaining(["malware_payload", "credential_dump", "raw_url_indicator", "private_message", "actor_interaction"]));
    expect(status.downstreamHandoff.apiUi.panels).toEqual(expect.arrayContaining(["overview", "records", "review_queue", "ops_runbook"]));
    expect(status.downstreamHandoff.apiUi.safeActions).toEqual(expect.arrayContaining(["filter", "paginate", "copy_hash", "open_review_ticket"]));
    expect(status.downstreamHandoff.apiUi.forbiddenActions).toEqual(expect.arrayContaining(["open_raw_url", "download_payload", "download_credentials", "contact_actor"]));
    expect(status.downstreamHandoff.opsRunbook.soak.stages).toEqual(expect.arrayContaining(["contract_fixture", "dry_run_replay", "isolated_canary", "metadata_only_limited_rollout"]));
    expect(status.downstreamHandoff.opsRunbook.alerts.map((alert) => alert.code)).toEqual(expect.arrayContaining(["unsafe_action_attempt", "proxy_boundary_failure", "parser_leak_attempt", "storage_forbidden_column"]));
    expect(status.downstreamHandoff.opsRunbook.rollback).toEqual(expect.arrayContaining(["pause_darkweb_index_workers", "disable_source_ingest", "rerun_no_leak_checks"]));
    expect(contract.downstreamHandoff).toMatchObject({
      schemaVersion: "ti.darkweb_index_downstream_handoff.v1",
      qualityFixtures: expect.arrayContaining(["quality_benign_directory", "quality_leak_claim_hold", "quality_malware_payload_block"]),
      graphStixPolicy: "descriptor_edges_review_hold",
      uiRoute: "/ti/darkweb/index",
      opsKillSwitch: "DARKWEB_INDEX_KILL_SWITCH"
    });
    expect(status.restrictedReconciliation).toMatchObject({
      schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1",
      owner: "Agent 05",
      mode: "contract_only_audit_reconciliation",
      willFetchNetwork: false,
      willMutateSources: false,
      releaseGate: {
        routeVisibleRequired: true,
        restrictedApplyPlanGreenRequired: true,
        standaloneDarkwebClaimsHeld: true,
        noLeakSerializationRequired: true
      }
    });
    expect(status.restrictedReconciliation.dependsOnRoutes).toEqual([
      "/v1/darkweb/status",
      "/v1/darkweb/search",
      "/v1/restricted-metadata/status",
      "/v1/restricted-metadata/apply-plan",
      "/v1/contracts"
    ]);
    expect(status.restrictedReconciliation.auditRows.map((row) => row.checkId)).toEqual(expect.arrayContaining([
      "darkweb_status_route_visible",
      "darkweb_search_non_blocking",
      "restricted_status_metadata_only",
      "restricted_apply_plan_green",
      "operator_hash_lookup_only",
      "kill_switch_ready"
    ]));
    expect(status.restrictedReconciliation.auditRows.every((row) => row.blockingIfMissing && row.reconciliationRule.length > 0)).toBe(true);
    expect(status.restrictedReconciliation.fieldMapping).toMatchObject({
      darkwebIndexFields: expect.arrayContaining(["rawUrlHash", "sourceHash", "legalTriage", "reviewState", "retentionClass"]),
      restrictedMetadataFields: expect.arrayContaining(["sourceId", "urlHash", "policyAuditId", "redactionProof", "auditEventIds"]),
      joinKeys: ["rawUrlHash_to_urlHash", "sourceHash_to_sourceId_or_policyAuditId"]
    });
    expect(status.restrictedReconciliation.unresolvedExternalBlockers).toEqual([]);
    expect(contract.restrictedReconciliation).toMatchObject({
      schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1",
      mode: "contract_only_audit_reconciliation",
      routeCount: 5,
      releaseGate: "restricted_apply_plan_and_no_leak_required"
    });
    expect(status.refreshOperations).toMatchObject({
      schemaVersion: "ti.darkweb_index_refresh_operations.v1",
      owner: "Agent 05",
      mode: "metadata_only_operations_model",
      targetRecordCount: 60000,
      willFetchNetwork: false,
      willScheduleLiveWork: false,
      disabledUntilApprovedHarness: true,
      budgets: {
        maxWorkerCount: 8,
        maxRunMinutes: 45,
        maxBytesPerPage: 262144,
        quarantineRetentionDays: 14,
        diskBudgetGb: 24
      }
    });
    expect(status.refreshOperations.lanes.map((lane) => lane.laneId)).toEqual(expect.arrayContaining([
      "tor_high_risk_refresh",
      "i2p_standard_refresh",
      "freenet_liveness_recheck",
      "directory_bulk_metadata",
      "analyst_import_review",
      "public_report_reference_import"
    ]));
    expect(status.refreshOperations.lanes.reduce((sum, lane) => sum + lane.targetRecords, 0)).toBe(60000);
    expect(status.refreshOperations.blockedActions).toEqual(expect.arrayContaining(["stolen-file download", "credential dump download", "threat actor interaction"]));
    expect(status.driftPacket).toMatchObject({
      schemaVersion: "ti.darkweb_index_liveness_classification_drift.v1",
      owner: "Agent 05",
      mode: "metadata_only_drift_rows",
      generatedFromFixtureCount: 100,
      noLeakSerialization: { passed: true }
    });
    expect(status.driftPacket.rows.map((row) => row.driftType)).toEqual(expect.arrayContaining([
      "newly_alive",
      "newly_dead",
      "category_changed",
      "legal_risk_changed",
      "source_reputation_changed",
      "duplicate_cluster_changed",
      "review_priority_changed",
      "graph_export_hold_changed"
    ]));
    expect(status.driftPacket.rows.every((row) =>
      row.evidence.sourceHash.length > 0 &&
      row.evidence.contentHash.length > 0 &&
      row.evidence.rawUrlHash.length > 0
    )).toBe(true);
    expect(status.searchQuality).toMatchObject({
      schemaVersion: "ti.darkweb_index_search_quality.v1",
      owner: "Agent 05",
      mode: "metadata_only_quality_metrics",
      publicSafeDisplayReadiness: {
        requiredWarnings: ["metadata_only", "review_required", "blocked_unsafe", "legal_hold"]
      }
    });
    expect(Object.keys(status.searchQuality.categoryCoverage)).toEqual(expect.arrayContaining(["forum", "leak_extortion", "directory"]));
    expect(status.searchQuality.languageHints.length).toBeGreaterThan(0);
    expect(status.searchQuality.entityExtractionConfidence.averageConfidence).toBeGreaterThan(0);
    expect(status.searchQuality.titleSummaryUsefulness.usefulSummaryCount).toBeGreaterThan(0);
    expect(status.operatorRunbook).toMatchObject({
      schemaVersion: "ti.darkweb_index_operator_runbook.v1",
      owner: "Agent 05",
      mode: "operator_controls_no_live_collection",
      isolatedCollectorPool: {
        enabledByDefault: false,
        approvedHarnessRequired: true,
        hostNetworkAllowed: false
      },
      proxyBoundary: {
        approvedProxyRequired: true,
        directEgressAllowed: false,
        networkAllowlist: ["tor", "i2p", "freenet"]
      },
      diskBudget: {
        rawBodyStorageAllowed: false,
        payloadStorageAllowed: false
      },
      emergencyStop: {
        flag: "DARKWEB_INDEX_KILL_SWITCH",
        publicSearchEffect: "non_blocking_existing_metadata_only_search"
      }
    });
    expect(status.operatorRunbook.rollback).toEqual(expect.arrayContaining(["pause_darkweb_index_workers", "clear_pending_refresh_queue", "rerun_no_leak_checks"]));
    expect(contract.operationsModel).toMatchObject({
      refreshSchemaVersion: "ti.darkweb_index_refresh_operations.v1",
      driftSchemaVersion: "ti.darkweb_index_liveness_classification_drift.v1",
      searchQualitySchemaVersion: "ti.darkweb_index_search_quality.v1",
      operatorRunbookSchemaVersion: "ti.darkweb_index_operator_runbook.v1",
      targetRecordCount: 60000,
      liveCollectionEnabled: false
    });
    expect(status.tier100Product).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier100_product.v1",
      owner: "Agent 05",
      tier: "tier_100",
      mode: "buyer_visible_safe_metadata",
      recordGoal: 100,
      producedRecordCount: 100,
      noLeakSerialization: {
        passed: true
      },
      safety: {
        rawUnsafeUrlsExposed: false,
        stolenFilesDownloaded: false,
        credentialsRetrieved: false,
        payloadsFollowed: false,
        privateAuthCaptchaAccess: false,
        actorInteraction: false
      }
    });
    expect(status.tier100Product.sourceFamilies.map((family) => family.family)).toEqual(expect.arrayContaining([
      "public_report",
      "analyst_import",
      "directory_metadata",
      "public_tracker_reference",
      "approved_seed",
      "safe_search_result"
    ]));
    expect(status.tier100Product.sourceFamilies.every((family) =>
      family.candidateCount >= 0 &&
      family.acceptedCount >= 0 &&
      family.duplicateCount >= 0 &&
      family.blockedCount >= 0 &&
      family.reviewCount >= 0 &&
      family.staleOrDeadCount >= 0 &&
      family.productLift.length > 0
    )).toBe(true);
    expect(status.tier100Product.importOutcome).toMatchObject({
      duplicate: status.sourceIngestReadiness.dedupePlan.duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds).length,
      blocked: status.counts.blockedUnsafe
    });
    expect(status.tier100Product.importOutcome.accepted).toBeGreaterThan(0);
    expect(status.tier100Product.importOutcome.reviewNeeded).toBeGreaterThan(0);
    expect(status.tier100Product.importOutcome.staleOrDead).toBeGreaterThan(0);
    expect(status.tier100Product.buyerVisibleSearch).toMatchObject({
      usefulSummaryRate: 1,
      categoryCoverageCount: 12,
      apifyFields: ["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"]
    });
    expect(status.tier100Product.buyerVisibleSearch.actorHintCoverage).toBeGreaterThanOrEqual(0.25);
    expect(status.tier100Product.buyerVisibleSearch.publicSearchBoostQueries).toEqual(expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]));
    expect(status.tier100Product.tier1000AdvancementCriteria).toMatchObject({
      targetTier: "tier_1000",
      minAcceptedRecords: 70,
      maxDuplicateRate: 0.2,
      minUsefulSummaryRate: 0.8,
      requireNoLeakProof: true,
      requireApifySearchLift: true
    });
    expect(status.tier1000Readiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier1000_readiness.v1",
      owner: "Agent 05",
      tier: "tier_1000",
      mode: "real_metadata_readiness_path",
      targetRecordCount: 1000,
      evaluatedRecordCount: 100,
      safety: {
        rawUnsafeUrlsExposed: false,
        stolenFilesDownloaded: false,
        credentialsRetrieved: false,
        payloadsFollowed: false,
        privateAuthCaptchaAccess: false,
        actorInteraction: false
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.tier1000Readiness.productQualifiedRecordCount).toBeGreaterThan(0);
    expect(status.tier1000Readiness.rejectedLowValueRecordCount).toBeGreaterThan(0);
    expect(status.tier1000Readiness.sourceFamilies.map((family) => family.family)).toEqual(expect.arrayContaining([
      "public_report",
      "analyst_import",
      "directory_metadata",
      "public_tracker_reference",
      "approved_seed",
      "safe_search_result"
    ]));
    expect(status.tier1000Readiness.sourceFamilies.every((family) =>
      family.evaluatedCount >= 0 &&
      family.productQualifiedCount >= 0 &&
      family.needsRefreshCount >= 0 &&
      family.legalHoldCount >= 0 &&
      family.blockedUnsafeCount >= 0 &&
      family.averageBuyerValue >= 0 &&
      family.refreshCadenceMinutes > 0
    )).toBe(true);
    expect(status.tier1000Readiness.freshness).toMatchObject({
      maxAllowedStaleHours: 72,
      customerFreshnessLabel: expect.stringMatching(/fresh_enough_for_monitoring|needs_refresh_before_paid_claim/)
    });
    expect(status.tier1000Readiness.searchReadiness).toMatchObject({
      safeSummaryCoverage: 1,
      categoryCoverageCount: 12,
      sourceFamilyCoverageCount: 6
    });
    expect(status.tier1000Readiness.searchReadiness.actorHintCoverage).toBeGreaterThanOrEqual(0.25);
    expect(status.tier1000Readiness.searchReadiness.apifyReadyRecordIds.length).toBeGreaterThan(0);
    expect(status.tier1000Readiness.searchReadiness.searchBoostQueries).toEqual(expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]));
    expect(status.tier1000Readiness.importGate).toMatchObject({
      accepted: status.tier1000Readiness.productQualifiedRecordCount,
      blockedUnsafe: status.tier100Product.importOutcome.blocked,
      staleOrDead: status.tier100Product.importOutcome.staleOrDead
    });
    expect(status.tier1000Readiness.importGate.acceptanceRate).toBeGreaterThan(0);
    expect(status.tier1000Readiness.importGate.duplicateRate).toBeGreaterThan(0);
    expect(status.tier1000Readiness.tier4000Planning).toMatchObject({
      targetTier: "tier_4000",
      minProductQualifiedRecords: 720,
      minFreshnessCurrentRate: 0.55,
      maxBlockedUnsafeRate: 0.18,
      requireNoLeakProof: true,
      requireActorDatasetLift: true
    });
    expect(status.tier4000Admission).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier4000_admission.v1",
      owner: "Agent 05",
      tier: "tier_4000",
      baselineTier: "tier_1000",
      targetRecordCount: 4000,
      evaluatedCandidateCount: 100,
      admissionRules: {
        minBuyerValueScore: 0.66,
        minSafeSummaryLength: 80,
        allowedLiveness: ["live", "intermittent"],
        requireApprovedMetadataOnly: true
      },
      importRefreshGate: {
        disposableIsolationRequired: true,
        approvedProxyRequired: true,
        rawUnsafeUrlSerializationAllowed: false,
        credentialOrPayloadCollectionAllowed: false,
        authCaptchaPrivateAccessAllowed: false,
        threatActorInteractionAllowed: false,
        rejectLowValueInsteadOfInflatingCount: true
      },
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.tier4000Admission.admittedCandidateCount).toBeGreaterThan(0);
    expect(status.tier4000Admission.rejectedCandidateCount).toBeGreaterThan(0);
    expect(status.tier4000Admission.qualityMetrics).toMatchObject({
      costRiskPerUsefulMetadataRow: expect.stringMatching(/low|medium|high/)
    });
    expect(status.tier4000Admission.qualityMetrics.productQualifiedRate).toBeGreaterThan(0);
    expect(status.tier4000Admission.qualityMetrics.searchHitQualityRate).toBeGreaterThan(0);
    expect(status.tier4000Admission.buyerSearchProof.sampleSearchRows.length).toBeGreaterThan(0);
    expect(status.tier4000Admission.buyerSearchProof.sampleSearchRows.every((row) =>
      row.safeSummary.length >= 80 &&
      row.searchBoostTerms.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.whyItMatters.includes("without exposing raw locations")
    )).toBe(true);
    expect(status.tier4000Admission.buyerSearchProof.activationDecision).toBe("hold_for_value_density");
    expect(status.tier4000Admission.buyerSearchProof.blockers).toEqual(expect.arrayContaining(["reject_low_value_candidates_before_count_expansion"]));
    expect(status.tier10000RefreshValue).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
      owner: "Agent 05",
      tier: "tier_10000",
      baselineTier: "tier_4000",
      targetRecordCount: 10000,
      evaluatedCandidateCount: 100,
      advancementCriteria: {
        minProductQualifiedRate: 0.72,
        maxDuplicateRate: 0.16,
        maxStaleRate: 0.28,
        maxBlockedOrReviewRate: 0.18,
        minAverageBuyerValueScore: 0.68,
        requireNoLeakProof: true
      },
      activationDecision: "hold_for_value_density",
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.tier10000RefreshValue.refreshLanes.map((lane) => lane.family)).toEqual(expect.arrayContaining([
      "public_report",
      "analyst_import",
      "directory_metadata",
      "public_tracker_reference",
      "approved_seed",
      "safe_search_result"
    ]));
    expect(status.tier10000RefreshValue.refreshLanes.every((lane) =>
      lane.cadenceMinutes > 0 &&
      lane.blockerRules.includes("reject_raw_unsafe_locations") &&
      lane.blockerRules.includes("reject_credentials_payloads_private_material")
    )).toBe(true);
    const tier10000ActorQueries = JSON.stringify(status.tier10000RefreshValue.buyerSearchProof.actorQueries);
    for (const query of ["akira", "apt29", "apt42", "lockbit"]) {
      expect(tier10000ActorQueries).toContain(query);
    }
    expect(typeof status.tier10000RefreshValue.buyerSearchProof.usefulQueryCount).toBe("number");
    expect(status.tier10000RefreshValue.buyerSearchProof.usefulQueryCount).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.buyerSearchProof.sampleRows.length).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.buyerSearchProof.sampleRows.every((row) =>
      row.safeSummary.length >= 80 &&
      row.searchBoostTerms.length > 0 &&
      row.provenanceHash.length > 0 &&
      row.whyItMatters.includes("without exposing raw locations")
    )).toBe(true);
    expect(status.tier10000RefreshValue.blockers).toEqual(expect.arrayContaining(["reject_low_value_candidates_before_count_expansion"]));
    expect(contract.tier100Product).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier100_product.v1",
      tier: "tier_100",
      recordGoal: 100,
      advancementTarget: "tier_1000",
      requireNoLeakProof: true
    });
    expect(contract.tier1000Readiness).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier1000_readiness.v1",
      tier: "tier_1000",
      targetRecordCount: 1000,
      routeFields: ["status.tier1000Readiness", "darkwebIndex.productHandoff"],
      advancementTarget: "tier_4000",
      requireNoLeakProof: true
    });
    expect(contract.tier4000Admission).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier4000_admission.v1",
      tier: "tier_4000",
      targetRecordCount: 4000,
      routeFields: ["status.tier4000Admission", "darkwebIndex.productHandoff.buyerSearchRows"],
      admissionDecisionField: "buyerSearchProof.activationDecision",
      requireNoLeakProof: true
    });
    expect(contract.tier10000RefreshValue).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
      tier: "tier_10000",
      targetRecordCount: 10000,
      routeFields: ["status.tier10000RefreshValue", "darkwebIndex.productHandoff.tier10000SearchProof"],
      decisionField: "activationDecision",
      requireNoLeakProof: true
    });
    expect(status.tier10000RefreshValue).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
      owner: "Agent 05",
      tier: "tier_10000",
      baselineTier: "tier_4000",
      mode: "refresh_and_buyer_search_value_gate",
      targetRecordCount: 10000,
      evaluatedCandidateCount: 100,
      advancementCriteria: {
        minProductQualifiedRate: 0.72,
        maxDuplicateRate: 0.16,
        maxStaleRate: 0.28,
        maxBlockedOrReviewRate: 0.18,
        minAverageBuyerValueScore: 0.68,
        requireNoLeakProof: true
      },
      activationDecision: "hold_for_value_density",
      noLeakSerialization: {
        passed: true
      }
    });
    expect(status.tier10000RefreshValue.valueQualifiedCount).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.rejectedLowValueCount).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.refreshLanes.map((lane) => lane.family)).toEqual(expect.arrayContaining([
      "public_report",
      "safe_search_result",
      "directory_metadata",
      "analyst_import",
      "public_tracker_reference",
      "approved_seed"
    ]));
    expect(status.tier10000RefreshValue.refreshLanes.every((lane) =>
      lane.cadenceMinutes >= 360 &&
      lane.blockerRules.includes("reject_if_buyer_value_below_threshold")
    )).toBe(true);
    expect(status.tier10000RefreshValue.buyerSearchProof.actorQueries).toEqual(expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]));
    expect(status.tier10000RefreshValue.buyerSearchProof.datasetTypeQueries.length).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.buyerSearchProof.newSinceLastRunQueries.length).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.buyerSearchProof.usefulQueryCount).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.buyerSearchProof.sampleRows.length).toBeGreaterThan(0);
    expect(status.tier10000RefreshValue.buyerSearchProof.sampleRows.every((row) =>
      row.safeSummary.length >= 80 &&
      row.searchBoostTerms.length > 0 &&
      row.whyItMatters.includes("without exposing raw locations")
    )).toBe(true);
    expect(status.tier10000RefreshValue.qualityMetrics).toMatchObject({
      costRiskPerUsefulMetadataRow: expect.stringMatching(/low|medium|high/)
    });
    expect(status.tier10000RefreshValue.blockers).toEqual(expect.arrayContaining([
      "refresh_low_value_rows_do_not_count_toward_target",
      "actor_victim_dataset_coverage_must_clear_buyer_search_thresholds"
    ]));
    expect(contract.tier10000RefreshValue).toMatchObject({
      schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
      tier: "tier_10000",
      targetRecordCount: 10000,
      routeFields: ["status.tier10000RefreshValue", "darkwebIndex.productHandoff.tier10000SearchProof"],
      decisionField: "activationDecision",
      requireNoLeakProof: true
    });
    expect(contract.liveValueExpansion).toMatchObject({
      schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
      tiers: ["tier_1000", "tier_4000"],
      routeFields: ["status.liveValueExpansion", "darkwebIndex.productHandoff.liveValueExpansion", "ops.productSlo.darkMetadataLiveValueExpansion"],
      requiredSampleRowsPerTier: 12,
      requiredUsefulQueriesPerTier: 20,
      sourceCountInflationBlocked: true,
      requireNoLeakProof: true
    });
    expect(contract.publicSupportWorklist40).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_worklist_40.v1",
      candidateSource: "publicIntelligenceHandoff100",
      topCandidateTarget: 40,
      routeFields: ["status.publicSupportWorklist40", "darkwebIndex.productHandoff.publicSupportWorklist40"],
      sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim",
      requireNoLeakProof: true
    });
    expect(contract.publicSupportLift1000).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_lift_1000.v1",
      candidateSource: "publicSupportWorklist40_and_darkweb_index_records",
      tierTargets: [100, 1000, 4000, 10000],
      routeFields: ["status.publicSupportLift1000", "darkwebIndex.productHandoff.publicSupportLift1000", "ops.productSlo.darkMetadataPublicSupportLift4000"],
      repairQueueField: "publicSupportLift1000.first100RepairQueue",
      sellable100Field: "publicSupportLift1000.publicSupportSellable100",
      sellable250Field: "publicSupportLift1000.publicSupportSellable250",
      sellable500Field: "publicSupportLift1000.publicSupportSellable500",
      tier10000PreviewField: "publicSupportLift1000.tier10000Preview",
      sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim",
      strictNoInflation: true,
      requireNoLeakProof: true
    });
    expect(status.sourceIngestReadiness.sources).toHaveLength(6);
    expect(status.sourceIngestReadiness.sources.every((source) =>
      source.sourceHash.length > 0 &&
      source.redactedLabel.length > 0 &&
      source.seedCount > 0 &&
      source.allowedFields.includes("rawUrlHash") &&
      source.forbiddenOperations.includes("threat actor interaction") &&
      source.isolationBoundary.payloadFollowingAllowed === false
    )).toBe(true);
    expect(status.sourceIngestReadiness.ingestPreviews.every((preview) =>
      preview.dryRunOnly &&
      preview.willFetchNetwork === false &&
      preview.candidateCount > 0 &&
      preview.dedupeKeys.includes("hostHash") &&
      preview.noFetchReasons.includes("synthetic_preview_no_network")
    )).toBe(true);
    expect(status.sourceIngestReadiness.ingestPreviews.find((preview) =>
      preview.sourceId === status.sourceIngestReadiness.sources.find((source) => source.approvalState === "blocked_unsafe")?.sourceId
    )?.acceptedMetadataCount).toBe(0);
    expect(status.sourceIngestReadiness.dedupePlan).toMatchObject({
      strategy: "host_path_title_redirect_content_hash",
      keyFields: ["rawUrlHash", "hostHash", "pathHash", "titleHash", "contentHash", "sourceHash"],
      mirrorPolicy: "cluster_by_hashes_without_following_redirect_payloads"
    });
    expect(status.sourceIngestReadiness.dedupePlan.duplicateClusters.length).toBeGreaterThan(0);
    expect(status.sourceIngestReadiness.collectorRuntime.deniedActions).toEqual(expect.arrayContaining([
      "stolen-file download",
      "credential dump download",
      "authentication bypass",
      "CAPTCHA solving",
      "threat actor interaction"
    ]));
    expect(new Set(records.map((record) => record.network))).toEqual(new Set(["tor", "i2p", "freenet"]));
    expect(new Set(records.map((record) => record.category))).toEqual(new Set([
      "forum",
      "marketplace",
      "leak_extortion",
      "paste",
      "directory",
      "blog",
      "research",
      "email_contact",
      "mirror",
      "service",
      "abuse",
      "unknown"
    ]));
    expect(new Set(records.map((record) => record.legalTriage))).toEqual(new Set([
      "benign",
      "news_or_research",
      "marketplace_or_illicit",
      "leak_or_extortion",
      "malware_or_payload",
      "credential_or_abuse",
      "unknown_requires_review",
      "blocked_unsafe"
    ]));
    expect(records.every((record) =>
      record.rawUrlHash.length > 0 &&
      record.hostHash.length > 0 &&
      record.pathHash.length > 0 &&
      record.contentHash.length > 0 &&
      record.redactedDisplayUrl.includes("host-") &&
      record.redactedDisplayUrl.includes("path-") &&
      record.isolationBoundary.disposableWorkerRequired &&
      record.isolationBoundary.lockedDownEgress &&
      record.isolationBoundary.sharedCredentialsAllowed === false &&
      record.isolationBoundary.payloadFollowingAllowed === false &&
      record.isolationBoundary.credentialDumpDownloadsAllowed === false &&
      record.isolationBoundary.malwareExecutionAllowed === false &&
      record.isolationBoundary.privateAccessAllowed === false &&
      record.isolationBoundary.captchaSolvingAllowed === false &&
      record.isolationBoundary.threatActorInteractionAllowed === false &&
      record.isolationBoundary.rawUnsafeUrlPublicOutputAllowed === false &&
      record.whatWasNotAccessed.includes("credential values") &&
      record.whatWasNotAccessed.includes("threat actor communications")
    )).toBe(true);
  });

  test("searches metadata safely with pagination and no raw unsafe material", () => {
    const records = darkwebIndexFixtureRecords(100);
    const firstPage = searchDarkwebIndex({ records, q: "akira", network: "tor", limit: 3 });
    const secondPage = searchDarkwebIndex({ records, q: "akira", network: "tor", limit: 3, cursor: firstPage.nextCursor });

    expect(firstPage).toMatchObject({
      endpoint: "/v1/darkweb/search",
      metadataOnly: true,
      query: {
        q: "akira",
        network: "tor",
        limit: 3
      },
      uiContract: {
        route: "/ti/darkweb/index"
      },
      productHandoff: {
        tier: "tier_100",
        nextTier: "tier_1000",
        publicSearchUse: "corroborating_metadata_context_only",
        warnings: ["metadata_only", "review_required", "no_raw_locations"]
      }
    });
    expect(firstPage.records.length).toBeLessThanOrEqual(3);
    expect(secondPage.records.map((record) => record.id)).not.toEqual(firstPage.records.map((record) => record.id));
    expect(firstPage.records.every((record) => record.actorHints.includes("akira") && record.network === "tor")).toBe(true);
    expect(firstPage.productHandoff.apifyReadyFields).toEqual(["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"]);
    expect(firstPage.productHandoff.buyerValueFields).toEqual(["buyerValueScore", "whyItMatters", "freshness", "sourceFamily", "provenanceHash"]);
    expect(firstPage.productHandoff.freshnessFields).toEqual(["lastSeen", "lastChecked", "liveness", "refreshCadenceMinutes"]);
    expect(firstPage.productHandoff.recordIds).toEqual(firstPage.records.map((record) => record.id));
    expect(firstPage.productHandoff.tier1000ReadyRecordIds.every((recordId) => firstPage.productHandoff.recordIds.includes(recordId))).toBe(true);
    expect(firstPage.productHandoff.buyerSearchRows).toHaveLength(firstPage.records.length);
    expect(firstPage.productHandoff.tier10000SearchProof).toMatchObject({
      usefulQueryCount: expect.any(Number),
      actorQueries: expect.arrayContaining(["akira", "apt29", "apt42", "lockbit"]),
      datasetTypeQueries: expect.any(Array),
      newSinceLastRunQueries: expect.any(Array)
    });
    expect(firstPage.productHandoff.tier10000SearchProof.sampleRows.length).toBeGreaterThan(0);
    expect(firstPage.productHandoff.liveValueExpansion).toMatchObject({
      schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
      mode: "metadata_only_ready_to_import_value_expansion",
      sourceCountInflationBlocked: true
    });
    expect(firstPage.productHandoff.liveValueExpansion.tiers).toHaveLength(2);
    expect(firstPage.productHandoff.liveValueExpansion.tiers.every((tier) =>
      tier.candidateRows.length >= 12 &&
      tier.buyerSearchProof.usefulQueryCount >= 20 &&
      tier.buyerSearchProof.sampleRows.length === 12 &&
      tier.advancementDecision === "hold_for_value_density"
    )).toBe(true);
    expect(firstPage.productHandoff.publicSupportWorklist40).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_worklist_40.v1",
      mode: "metadata_only_public_support_worklist",
      topCandidateCount: 40,
      publicSupportReadyCount: 2,
      stillRestrictedOnlyCount: 11,
      projectedCaveatedRows: 0,
      projectedSellableRowsAfterPublicSupport: 2,
      contributionToward100SellableRows: 2,
      handoffs: {
        agent10RevenueGate: {
          targetSellableRows: 100,
          projectedSellableRowLift: 2,
          contributionToward100SellableRows: 2
        }
      }
    });
    expect(firstPage.productHandoff.publicSupportWorklist40.rows).toHaveLength(40);
    expect(firstPage.productHandoff.publicSupportWorklist40.rows.every((row) =>
      row.safeLocatorHash.length > 0 &&
      row.publicSourceFamilyNeeded.length > 0 &&
      row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials"
    )).toBe(true);
    expect(firstPage.productHandoff.publicSupportLift1000).toMatchObject({
      schemaVersion: "ti.darkweb_index_public_support_lift_1000.v1",
      mode: "metadata_only_public_support_lift_100_to_4000",
      strictNoInflation: true,
      currentContributionToward100SellableRows: 2,
      first1000CandidateCount: 1000,
      first1000SellableAfterPublicSupport: 19,
      first1000UsefulWithCaveat: 12,
      first1000RestrictedOnlyHold: 141,
      first1000RejectedCounts: {
        stale: 285,
        duplicate: 6,
        unsafe: 333,
        lowValue: 204
      },
      first4000CandidateCount: 4000,
      first4000SellableAfterPublicSupport: 80,
      first4000UsefulWithCaveat: 54,
      first4000RestrictedOnlyHold: 556,
      first4000RejectedCounts: {
        stale: 1142,
        duplicate: 6,
        unsafe: 1333,
        lowValue: 829
      },
      projectedContributionToward100PaidRowsAfterPublicSupport: 80
    });
    expect(firstPage.productHandoff.publicSupportLift1000.tiers[1]?.rows).toHaveLength(1000);
    expect(firstPage.productHandoff.publicSupportLift1000.tiers[2]?.rows).toHaveLength(4000);
    expect(firstPage.productHandoff.publicSupportLift1000.first4000SupportBucketCounts.currently_chargeable).toBe(0);
    expect(firstPage.productHandoff.publicSupportLift1000.first100RepairQueue).toHaveLength(100);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable100).toMatchObject({
      candidateCount: 100,
      currentChargeableRows: 12,
      projectedAfterPublicSupportRows: 68,
      retiredRows: 20,
      remainingGapTo100Now: 88,
      remainingGapTo100AfterProjectedSupport: 20
    });
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable100.agent03ParserHandoffRows).toHaveLength(100);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable100.rows.filter((row) => row.countsTowardSellableFloorNow)).toHaveLength(12);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable250).toMatchObject({
      candidateCount: 250,
      currentChargeableRows: 50,
      newlyChargeableRows: 38,
      projectedAfterPublicSupportRows: 30,
      blockedOrRetiredRows: 170,
      remainingGapTo100Now: 50,
      remainingGapTo100AfterProjectedSupport: 20
    });
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable250.newlyChargeableParserHandoffRows).toHaveLength(38);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable250.rows.filter((row) => row.countsTowardSellableFloorNow)).toHaveLength(50);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable500).toMatchObject({
      candidateCount: 500,
      previousCurrentChargeableRows: 150,
      currentChargeableRows: 198,
      newlyChargeableRows: 48,
      projectedAfterPublicSupportRows: 0,
      blockedOrRetiredRows: 302,
      currentChargeable100: {
        currentChargeableCount: 198,
        currentGapTo100: 0,
        currentGapTo250: 52,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable150: {
        currentChargeableCount: 198,
        newlyChargeableSinceProgramDa: 98,
        currentGapTo150: 0,
        currentGapTo250: 52,
        countsProjectedRowsAsCurrent: false
      },
      currentChargeable250: {
        currentChargeableCount: 198,
        newlyChargeableSinceProgramDc: 48,
        currentGapTo250: 52,
        currentGapTo500: 302,
        countsProjectedRowsAsCurrent: false
      }
    });
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable500.newlyChargeableParserHandoffRows).toHaveLength(48);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable500.rows.filter((row) => row.countsTowardSellableFloorNow)).toHaveLength(198);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable500.rows.filter((row) => row.newlyChargeableSinceProgramDa)).toHaveLength(98);
    expect(firstPage.productHandoff.publicSupportLift1000.publicSupportSellable500.rows.filter((row) => row.newlyChargeableSinceProgramDc)).toHaveLength(48);
    expect(firstPage.productHandoff.publicSupportLift1000.metricMovement).toMatchObject({
      repairCandidatesAdded: 100,
      likelySellableRowsAfterPublicSupport: 80,
      usefulCaveatedRows: 20,
      remainingRowsToFirst100FloorAfterPublicSupport: 20,
      countsTowardSellableFloorNow: false
    });
    expect(firstPage.productHandoff.publicSupportLift1000.tier10000Preview).toMatchObject({
      evaluatedCandidateCount: 10000,
      projectedSellableAfterPublicSupport: 198,
      usefulWithCaveat: 142,
      acceptedValueDensity: 0.034,
      expansionDecision: "hold_for_value_density",
      countsTowardSellableFloorNow: false
    });
    expect(firstPage.productHandoff.publicSupportLift1000.handoffs.agent04PublicSourceTargets.length).toBeGreaterThan(0);
    expect(firstPage.productHandoff.buyerSearchRows.every((row) =>
      row.recordId.length > 0 &&
      row.safeSummary.length >= 80 &&
      row.sourceFamily.length > 0 &&
      row.refreshCadenceMinutes > 0 &&
      row.buyerValueScore >= 0 &&
      row.whyItMatters.includes("without exposing raw locations") &&
      row.provenanceHash.length > 0
    )).toBe(true);
    expect(firstPage.noLeakSerialization.passed).toBe(true);

    const serialized = JSON.stringify({ firstPage, secondPage, status: buildDarkwebIndexStatus(records), contract: darkwebIndexContract() });
    for (const forbidden of [
      "http://",
      "https://",
      ".onion",
      ".i2p",
      "password=",
      "cookie=",
      "authorization:",
      "rawUrl:",
      "private message transcript",
      "actor-interaction text"
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
