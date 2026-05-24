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
      }
    });
    expect(firstPage.records.length).toBeLessThanOrEqual(3);
    expect(secondPage.records.map((record) => record.id)).not.toEqual(firstPage.records.map((record) => record.id));
    expect(firstPage.records.every((record) => record.actorHints.includes("akira") && record.network === "tor")).toBe(true);
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
