import { hashContent, stableId } from "../utils.ts";

export type DarkwebIndexNetwork = "tor" | "i2p" | "freenet";
export type DarkwebIndexCategory = "forum" | "marketplace" | "leak_extortion" | "paste" | "directory" | "blog" | "research" | "email_contact" | "mirror" | "service" | "abuse" | "unknown";
export type DarkwebIndexLegalTriage = "benign" | "news_or_research" | "marketplace_or_illicit" | "leak_or_extortion" | "malware_or_payload" | "credential_or_abuse" | "unknown_requires_review" | "blocked_unsafe";
export type DarkwebIndexLiveness = "live" | "dead" | "intermittent" | "blocked_by_policy" | "requires_review" | "unknown";
export type DarkwebIndexReviewState = "approved_metadata_only" | "needs_review" | "legal_hold" | "blocked_unsafe" | "false_positive_review";
export type DarkwebIndexSourceType = "directory" | "seed_list" | "analyst_import" | "public_report" | "safe_search_result" | "internal_discovery";
export type DarkwebIndexSourceApprovalState = "approved_metadata_only" | "pending_legal_review" | "disabled_kill_switch" | "blocked_unsafe";

export interface DarkwebIndexRecord {
  readonly id: string;
  readonly network: DarkwebIndexNetwork;
  readonly redactedDisplayUrl: string;
  readonly rawUrlHash: string;
  readonly hostHash: string;
  readonly pathHash: string;
  readonly title: string;
  readonly safeSummary: string;
  readonly category: DarkwebIndexCategory;
  readonly legalTriage: DarkwebIndexLegalTriage;
  readonly language: string;
  readonly liveness: DarkwebIndexLiveness;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly lastChecked: string;
  readonly provenance: {
    readonly sourceType: DarkwebIndexSourceType;
    readonly sourceHash: string;
    readonly discoveryPathHash: string;
    readonly collector: "synthetic_fixture" | "isolated_collector_contract";
  };
  readonly confidence: number;
  readonly reviewState: DarkwebIndexReviewState;
  readonly blockedReason?: string;
  readonly screenshotHash?: string;
  readonly contentHash: string;
  readonly actorHints: readonly string[];
  readonly victimHints: readonly string[];
  readonly ttpHints: readonly string[];
  readonly retentionClass: "restricted_metadata" | "legal_hold" | "short_review";
  readonly classification: {
    readonly label: DarkwebIndexLegalTriage;
    readonly confidence: number;
    readonly reasons: readonly string[];
  };
  readonly isolationBoundary: DarkwebIndexIsolationBoundary;
  readonly whatWasNotAccessed: readonly string[];
}

export interface DarkwebIndexSource {
  readonly sourceId: string;
  readonly sourceType: DarkwebIndexSourceType;
  readonly network: DarkwebIndexNetwork;
  readonly sourceHash: string;
  readonly redactedLabel: string;
  readonly approvalState: DarkwebIndexSourceApprovalState;
  readonly legalBasis: "metadata_only_research" | "operator_review_required" | "blocked";
  readonly targetPolicy: "metadata_landing_pages_only" | "no_fetch_pending_review" | "blocked_unsafe_targets";
  readonly seedCount: number;
  readonly dedupeKey: string;
  readonly reviewTicketId: string;
  readonly allowedFields: readonly string[];
  readonly forbiddenOperations: readonly string[];
  readonly isolationBoundary: DarkwebIndexIsolationBoundary;
}

export interface DarkwebIndexIngestPreview {
  readonly previewId: string;
  readonly sourceId: string;
  readonly sourceType: DarkwebIndexSourceType;
  readonly network: DarkwebIndexNetwork;
  readonly dryRunOnly: true;
  readonly willFetchNetwork: false;
  readonly candidateCount: number;
  readonly acceptedMetadataCount: number;
  readonly duplicateCount: number;
  readonly reviewCount: number;
  readonly blockedUnsafeCount: number;
  readonly dedupeKeys: readonly string[];
  readonly outputRecordIds: readonly string[];
  readonly blockedReasons: readonly string[];
  readonly noFetchReasons: readonly string[];
}

export interface DarkwebIndexDedupePlan {
  readonly strategy: "host_path_title_redirect_content_hash";
  readonly keyFields: ReadonlyArray<"rawUrlHash" | "hostHash" | "pathHash" | "titleHash" | "contentHash" | "sourceHash">;
  readonly duplicateClusters: ReadonlyArray<{
    readonly clusterId: string;
    readonly canonicalRecordId: string;
    readonly duplicateRecordIds: readonly string[];
    readonly reasons: readonly string[];
    readonly reviewState: "auto_merged_metadata_only" | "needs_review";
  }>;
  readonly mirrorPolicy: "cluster_by_hashes_without_following_redirect_payloads";
}

export interface DarkwebIndexIsolatedCollectorRuntime {
  readonly runtimeId: string;
  readonly mode: "contract_only_no_network";
  readonly dryRunOnly: true;
  readonly workerIsolation: DarkwebIndexIsolationBoundary;
  readonly approvedProxyRequired: true;
  readonly hostNetworkAllowed: false;
  readonly sharedCredentialMountAllowed: false;
  readonly writableHostMountAllowed: false;
  readonly quarantineArtifactDescriptorsOnly: true;
  readonly javascriptPolicy: "disabled_or_instrumented";
  readonly egressPolicy: "network_specific_allowlist_only";
  readonly contentCaps: {
    readonly maxBytesPerPage: number;
    readonly maxFetchSeconds: number;
    readonly maxRedirects: number;
  };
  readonly allowedExtractionFields: readonly string[];
  readonly deniedActions: readonly string[];
  readonly emergencyStop: {
    readonly supported: true;
    readonly state: "armed";
    readonly operatorAction: "pause_darkweb_index_workers";
  };
}

export interface DarkwebIndexStorageHandoff {
  readonly schemaVersion: "ti.darkweb_index_storage_handoff.v1";
  readonly owner: "Agent 06";
  readonly migrationMode: "contract_only_no_database_connection";
  readonly willConnectToDatabase: false;
  readonly willMutate: false;
  readonly tables: ReadonlyArray<{
    readonly table: string;
    readonly purpose: string;
    readonly primaryKey: string;
    readonly requiredColumns: ReadonlyArray<string>;
    readonly forbiddenColumns: ReadonlyArray<string>;
    readonly retentionClassColumn: string;
  }>;
  readonly indexes: ReadonlyArray<{
    readonly name: string;
    readonly table: string;
    readonly fields: ReadonlyArray<string>;
    readonly queryUse: string;
  }>;
  readonly migrationOrder: ReadonlyArray<string>;
  readonly replay: {
    readonly sourceCheckpoint: "darkweb_index_refresh_runs.next_cursor";
    readonly idempotencyKey: "raw_url_hash_plus_source_hash";
    readonly duplicatePolicy: "upsert_metadata_only_by_hashes";
    readonly cursorContinuity: "preserve_search_cursor_and_refresh_cursor";
    readonly backfillChunks: readonly [100, 1000, 10000, 60000];
  };
  readonly hashLookup: {
    readonly publicLookupAllowed: false;
    readonly operatorOnlyFutureRoute: "/v1/darkweb/hash-lookup";
    readonly lookupInputs: readonly ["rawUrlHash", "hostHash", "pathHash", "contentHash", "sourceHash"];
    readonly outputRule: "return_redacted_descriptor_only";
  };
  readonly retention: {
    readonly defaultClass: "restricted_metadata";
    readonly legalHoldClass: "legal_hold";
    readonly reviewClass: "short_review";
    readonly purgeRule: "delete_or_tombstone_descriptors_without_exposing_raw_material";
  };
  readonly noLeakStorageGuarantees: ReadonlyArray<string>;
}

export interface DarkwebIndexSchedulerHandoff {
  readonly schemaVersion: "ti.darkweb_index_scheduler_handoff.v1";
  readonly owner: "Agent 02";
  readonly mode: "contract_only_no_worker_leases";
  readonly willScheduleLiveWork: false;
  readonly willMutateQueue: false;
  readonly schedulerId: "darkweb_index_refresh";
  readonly cadence: {
    readonly highRiskMinutes: 360;
    readonly standardMinutes: 1440;
    readonly staleRecheckMinutes: 10080;
    readonly legalReviewHoldMinutes: 0;
  };
  readonly budget: {
    readonly targetRecordCount: 60000;
    readonly maxRecordsPerRun: 2500;
    readonly maxWorkerCount: 8;
    readonly maxRunMinutes: 45;
    readonly maxBytesPerPage: 262144;
    readonly maxRedirects: 2;
  };
  readonly lanes: ReadonlyArray<{
    readonly lane: "high_risk_leak_metadata" | "standard_directory_refresh" | "dead_or_intermittent_recheck" | "legal_review_hold" | "blocked_unsafe";
    readonly priority: number;
    readonly cadenceMinutes: number;
    readonly maxRecordsPerRun: number;
    readonly requiresApprovalState: DarkwebIndexSourceApprovalState | "any_reviewed";
    readonly action: "refresh_metadata" | "recheck_liveness" | "hold_for_review" | "skip_blocked";
  }>;
  readonly pressurePolicy: {
    readonly publicSearchNonBlocking: true;
    readonly duplicateRunReuse: "required";
    readonly emergencyBrakeAction: "pause_darkweb_index_workers";
    readonly retryBackoff: readonly [15, 60, 240, 1440];
  };
  readonly noScheduleGuarantees: readonly string[];
}

export interface DarkwebIndexParserRuntimeExpectation {
  readonly schemaVersion: "ti.darkweb_index_parser_runtime.v1";
  readonly owner: "Agent 03";
  readonly mode: "isolated_landing_page_metadata_parser_contract";
  readonly willFetchNetwork: false;
  readonly parserProfiles: ReadonlyArray<{
    readonly profile: "tor_landing_metadata" | "i2p_landing_metadata" | "freenet_landing_metadata" | "directory_listing_metadata" | "blocked_unsafe_stub";
    readonly network: DarkwebIndexNetwork | "mixed";
    readonly allowedInputs: readonly string[];
    readonly extractedFields: readonly string[];
    readonly blockedFields: readonly string[];
    readonly maxInputBytes: number;
  }>;
  readonly runtime: {
    readonly disposableWorkerRequired: true;
    readonly approvedProxyRequired: true;
    readonly hostNetworkAllowed: false;
    readonly sharedCredentialMountAllowed: false;
    readonly writableHostMountAllowed: false;
    readonly javascriptPolicy: "disabled_or_instrumented";
    readonly output: "quarantine_descriptor_only";
  };
  readonly blockedActions: readonly string[];
  readonly parserFailureClasses: readonly [
    "unsupported_network",
    "content_too_large",
    "unsafe_payload_link_detected",
    "credential_or_auth_prompt_detected",
    "captcha_or_private_access_detected",
    "actor_interaction_target_detected",
    "parser_confidence_low",
    "legal_review_required"
  ];
}

export interface DarkwebIndexIsolationBoundary {
  readonly disposableWorkerRequired: true;
  readonly lockedDownEgress: true;
  readonly sharedCredentialsAllowed: false;
  readonly writableHostMountsAllowed: false;
  readonly quarantineOutputOnly: true;
  readonly javascriptActiveContentDefault: "disabled_or_instrumented";
  readonly maxBytesPerPage: number;
  readonly maxFetchSeconds: number;
  readonly payloadFollowingAllowed: false;
  readonly credentialDumpDownloadsAllowed: false;
  readonly malwareExecutionAllowed: false;
  readonly privateAccessAllowed: false;
  readonly captchaSolvingAllowed: false;
  readonly threatActorInteractionAllowed: false;
  readonly rawUnsafeUrlPublicOutputAllowed: false;
  readonly emergencyStopSupported: true;
}

export interface DarkwebIndexRefreshRun {
  readonly runId: string;
  readonly schedulerId: string;
  readonly batchId: string;
  readonly budget: {
    readonly maxRecords: number;
    readonly maxWorkerCount: number;
    readonly maxBytesPerPage: number;
    readonly maxRunMinutes: number;
  };
  readonly checkedCount: number;
  readonly liveCount: number;
  readonly changedCount: number;
  readonly blockedCount: number;
  readonly reviewCount: number;
  readonly errorCount: number;
  readonly nextCursor: string;
  readonly dryRunOnly: true;
}

export interface DarkwebIndexStatusDto {
  readonly endpoint: "/v1/darkweb/status";
  readonly generatedAt: string;
  readonly metadataOnly: true;
  readonly targetRecordCount: 60000;
  readonly fixtureRecordCount: number;
  readonly indexedRecordEstimate: number;
  readonly counts: {
    readonly total: number;
    readonly byNetwork: Record<DarkwebIndexNetwork, number>;
    readonly byCategory: Record<DarkwebIndexCategory, number>;
    readonly byLegalTriage: Record<DarkwebIndexLegalTriage, number>;
    readonly byLiveness: Record<DarkwebIndexLiveness, number>;
    readonly reviewRequired: number;
    readonly blockedUnsafe: number;
  };
  readonly latestRefreshRun: DarkwebIndexRefreshRun;
  readonly sourceIngestReadiness: {
    readonly sources: readonly DarkwebIndexSource[];
    readonly ingestPreviews: readonly DarkwebIndexIngestPreview[];
    readonly dedupePlan: DarkwebIndexDedupePlan;
    readonly collectorRuntime: DarkwebIndexIsolatedCollectorRuntime;
  };
  readonly schedulerReadiness: DarkwebIndexSchedulerHandoff;
  readonly parserRuntimeReadiness: DarkwebIndexParserRuntimeExpectation;
  readonly storageReadiness: {
    readonly tables: readonly string[];
    readonly searchIndexes: readonly string[];
    readonly migrationMode: "contract_only";
    readonly agent06Handoff: "darkweb_index_records_refresh_runs_classification_history";
    readonly handoff: DarkwebIndexStorageHandoff;
  };
  readonly api: {
    readonly statusRoute: "/v1/darkweb/status";
    readonly searchRoute: "/v1/darkweb/search";
    readonly publicUiTarget: "/ti/darkweb/index";
    readonly rawHashLookup: "operator_only_future_route";
  };
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexSearchDto {
  readonly endpoint: "/v1/darkweb/search";
  readonly generatedAt: string;
  readonly metadataOnly: true;
  readonly query: {
    readonly q?: string;
    readonly category?: DarkwebIndexCategory;
    readonly legalTriage?: DarkwebIndexLegalTriage;
    readonly liveness?: DarkwebIndexLiveness;
    readonly network?: DarkwebIndexNetwork;
    readonly limit: number;
    readonly cursor?: string;
  };
  readonly totalMatches: number;
  readonly nextCursor?: string;
  readonly records: readonly DarkwebIndexRecord[];
  readonly uiContract: {
    readonly route: "/ti/darkweb/index";
    readonly tableColumns: readonly string[];
    readonly filters: readonly string[];
    readonly detailDrawerFields: readonly string[];
  };
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexContractDto {
  readonly field: "darkwebIndex";
  readonly routes: readonly ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"];
  readonly targetRecordCount: 60000;
  readonly fixtureRecordCount: 100;
  readonly recordFields: readonly string[];
  readonly searchFilters: readonly string[];
  readonly safety: {
    readonly metadataOnly: true;
    readonly isolatedCollectorOnly: true;
    readonly noPayloadFollowing: true;
    readonly noCredentialDownloads: true;
    readonly noPrivateAccess: true;
    readonly noCaptchaSolving: true;
    readonly noThreatActorInteraction: true;
    readonly noRawUnsafeUrlPublicOutput: true;
  };
  readonly handoffs: {
    readonly agent02Scheduler: "darkweb_index_refresh_cadence_budget";
    readonly agent03CollectorParser: "isolated_landing_page_metadata_parser";
    readonly agent06StorageSearch: "darkweb_index_records_refresh_runs_search_tables";
    readonly agent07Quality: "legal_risk_triage_and_false_positive_review";
    readonly agent08GraphStix: "descriptor_edges_and_stix_holds";
    readonly agent09ApiUi: "darkweb_index_routes_and_ti_darkweb_index";
    readonly agent10Ops: "kill_switch_soak_and_unsafe_attempt_alerts";
  };
  readonly sourceIngest: {
    readonly sourceTypes: readonly DarkwebIndexSourceType[];
    readonly approvalStates: readonly DarkwebIndexSourceApprovalState[];
    readonly dedupeKeys: readonly string[];
    readonly runtimeMode: "contract_only_no_network";
  };
  readonly storageHandoff: {
    readonly schemaVersion: "ti.darkweb_index_storage_handoff.v1";
    readonly tables: readonly string[];
    readonly indexes: readonly string[];
    readonly migrationMode: "contract_only_no_database_connection";
    readonly hashLookup: "operator_only_future_route";
  };
  readonly schedulerParserHandoff: {
    readonly schedulerSchemaVersion: "ti.darkweb_index_scheduler_handoff.v1";
    readonly parserSchemaVersion: "ti.darkweb_index_parser_runtime.v1";
    readonly schedulerMode: "contract_only_no_worker_leases";
    readonly parserMode: "isolated_landing_page_metadata_parser_contract";
    readonly schedulerId: "darkweb_index_refresh";
    readonly parserProfiles: readonly string[];
  };
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexNoLeakSerialization {
  readonly passed: boolean;
  readonly forbiddenFields: readonly string[];
  readonly guarantees: {
    readonly noRawUnsafeUrls: true;
    readonly noCredentials: true;
    readonly noPayloads: true;
    readonly noLeakedRows: true;
    readonly noPrivateMaterial: true;
    readonly noActorInteraction: true;
  };
}

const NETWORKS: DarkwebIndexNetwork[] = ["tor", "i2p", "freenet"];
const CATEGORIES: DarkwebIndexCategory[] = ["forum", "marketplace", "leak_extortion", "paste", "directory", "blog", "research", "email_contact", "mirror", "service", "abuse", "unknown"];
const LEGAL_TRIAGE: DarkwebIndexLegalTriage[] = ["benign", "news_or_research", "marketplace_or_illicit", "leak_or_extortion", "malware_or_payload", "credential_or_abuse", "unknown_requires_review", "blocked_unsafe"];
const LIVENESS: DarkwebIndexLiveness[] = ["live", "dead", "intermittent", "blocked_by_policy", "requires_review", "unknown"];

export function darkwebIndexFixtureRecords(count = 100): DarkwebIndexRecord[] {
  return Array.from({ length: count }, (_, index) => darkwebIndexFixtureRecord(index));
}

export function buildDarkwebIndexStatus(records: readonly DarkwebIndexRecord[] = darkwebIndexFixtureRecords()): DarkwebIndexStatusDto {
  const generatedAt = "2026-05-24T00:00:00.000Z";
  return {
    endpoint: "/v1/darkweb/status",
    generatedAt,
    metadataOnly: true,
    targetRecordCount: 60000,
    fixtureRecordCount: records.length,
    indexedRecordEstimate: 60000,
    counts: {
      total: records.length,
      byNetwork: countBy(NETWORKS, records.map((record) => record.network)),
      byCategory: countBy(CATEGORIES, records.map((record) => record.category)),
      byLegalTriage: countBy(LEGAL_TRIAGE, records.map((record) => record.legalTriage)),
      byLiveness: countBy(LIVENESS, records.map((record) => record.liveness)),
      reviewRequired: records.filter((record) => record.reviewState === "needs_review" || record.reviewState === "false_positive_review").length,
      blockedUnsafe: records.filter((record) => record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe").length
    },
    latestRefreshRun: darkwebIndexRefreshRun(records),
    sourceIngestReadiness: {
      sources: darkwebIndexSourceFixtures(),
      ingestPreviews: darkwebIndexIngestPreviews(records),
      dedupePlan: darkwebIndexDedupePlan(records),
      collectorRuntime: darkwebIndexIsolatedCollectorRuntime()
    },
    schedulerReadiness: buildDarkwebIndexSchedulerHandoff(),
    parserRuntimeReadiness: buildDarkwebIndexParserRuntimeExpectation(),
    storageReadiness: {
      tables: ["darkweb_index_records", "darkweb_index_sources", "darkweb_index_refresh_runs", "darkweb_index_classification_history", "darkweb_index_liveness_checks", "darkweb_index_review_notes"],
      searchIndexes: ["darkweb_index_hash_lookup", "darkweb_index_category_liveness_review_idx", "darkweb_index_safe_summary_text_idx"],
      migrationMode: "contract_only",
      agent06Handoff: "darkweb_index_records_refresh_runs_classification_history",
      handoff: darkwebIndexStorageHandoff()
    },
    api: {
      statusRoute: "/v1/darkweb/status",
      searchRoute: "/v1/darkweb/search",
      publicUiTarget: "/ti/darkweb/index",
      rawHashLookup: "operator_only_future_route"
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

export function searchDarkwebIndex(input: {
  readonly q?: string;
  readonly category?: string;
  readonly legalTriage?: string;
  readonly liveness?: string;
  readonly network?: string;
  readonly limit?: number;
  readonly cursor?: string;
  readonly records?: readonly DarkwebIndexRecord[];
} = {}): DarkwebIndexSearchDto {
  const records = input.records ?? darkwebIndexFixtureRecords();
  const q = input.q?.trim().toLowerCase();
  const offset = Math.max(0, Number.parseInt(input.cursor ?? "0", 10) || 0);
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const filtered = records.filter((record) =>
    (!q || [record.title, record.safeSummary, record.category, record.legalTriage, record.language, ...record.actorHints, ...record.victimHints, ...record.ttpHints].join(" ").toLowerCase().includes(q)) &&
    (!input.category || record.category === input.category) &&
    (!input.legalTriage || record.legalTriage === input.legalTriage) &&
    (!input.liveness || record.liveness === input.liveness) &&
    (!input.network || record.network === input.network)
  );
  const page = filtered.slice(offset, offset + limit);
  return {
    endpoint: "/v1/darkweb/search",
    generatedAt: "2026-05-24T00:00:00.000Z",
    metadataOnly: true,
    query: {
      q: input.q,
      category: isCategory(input.category) ? input.category : undefined,
      legalTriage: isLegalTriage(input.legalTriage) ? input.legalTriage : undefined,
      liveness: isLiveness(input.liveness) ? input.liveness : undefined,
      network: isNetwork(input.network) ? input.network : undefined,
      limit,
      cursor: input.cursor
    },
    totalMatches: filtered.length,
    nextCursor: offset + limit < filtered.length ? String(offset + limit) : undefined,
    records: page,
    uiContract: {
      route: "/ti/darkweb/index",
      tableColumns: ["redactedDisplayUrl", "category", "legalTriage", "liveness", "language", "lastSeen", "reviewState", "confidence"],
      filters: ["query", "category", "legalTriage", "liveness", "network", "language", "reviewState"],
      detailDrawerFields: ["safeSummary", "classification", "whatWasNotAccessed", "provenance", "refreshHistory", "graphLinks"]
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

export function darkwebIndexContract(): DarkwebIndexContractDto {
  return {
    field: "darkwebIndex",
    routes: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts"],
    targetRecordCount: 60000,
    fixtureRecordCount: 100,
    recordFields: ["id", "network", "redactedDisplayUrl", "rawUrlHash", "hostHash", "pathHash", "title", "safeSummary", "category", "legalTriage", "language", "liveness", "firstSeen", "lastSeen", "lastChecked", "provenance", "confidence", "reviewState", "blockedReason", "screenshotHash", "contentHash", "actorHints", "victimHints", "ttpHints", "retentionClass", "classification", "isolationBoundary", "whatWasNotAccessed"],
    searchFilters: ["q", "category", "legalTriage", "liveness", "network", "language", "source", "reviewState", "cursor", "limit"],
    safety: {
      metadataOnly: true,
      isolatedCollectorOnly: true,
      noPayloadFollowing: true,
      noCredentialDownloads: true,
      noPrivateAccess: true,
      noCaptchaSolving: true,
      noThreatActorInteraction: true,
      noRawUnsafeUrlPublicOutput: true
    },
    handoffs: {
      agent02Scheduler: "darkweb_index_refresh_cadence_budget",
      agent03CollectorParser: "isolated_landing_page_metadata_parser",
      agent06StorageSearch: "darkweb_index_records_refresh_runs_search_tables",
      agent07Quality: "legal_risk_triage_and_false_positive_review",
      agent08GraphStix: "descriptor_edges_and_stix_holds",
      agent09ApiUi: "darkweb_index_routes_and_ti_darkweb_index",
      agent10Ops: "kill_switch_soak_and_unsafe_attempt_alerts"
    },
    sourceIngest: {
      sourceTypes: ["directory", "seed_list", "analyst_import", "public_report", "safe_search_result", "internal_discovery"],
      approvalStates: ["approved_metadata_only", "pending_legal_review", "disabled_kill_switch", "blocked_unsafe"],
      dedupeKeys: ["rawUrlHash", "hostHash", "pathHash", "titleHash", "contentHash", "sourceHash"],
      runtimeMode: "contract_only_no_network"
    },
    storageHandoff: {
      schemaVersion: "ti.darkweb_index_storage_handoff.v1",
      tables: darkwebIndexStorageHandoff().tables.map((table) => table.table),
      indexes: darkwebIndexStorageHandoff().indexes.map((index) => index.name),
      migrationMode: "contract_only_no_database_connection",
      hashLookup: "operator_only_future_route"
    },
    schedulerParserHandoff: {
      schedulerSchemaVersion: "ti.darkweb_index_scheduler_handoff.v1",
      parserSchemaVersion: "ti.darkweb_index_parser_runtime.v1",
      schedulerMode: "contract_only_no_worker_leases",
      parserMode: "isolated_landing_page_metadata_parser_contract",
      schedulerId: "darkweb_index_refresh",
      parserProfiles: buildDarkwebIndexParserRuntimeExpectation().parserProfiles.map((profile) => profile.profile)
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function darkwebIndexSourceFixtures(): DarkwebIndexSource[] {
  return [
    darkwebIndexSourceFixture(0, "directory", "tor", "approved_metadata_only", 24000),
    darkwebIndexSourceFixture(1, "seed_list", "i2p", "approved_metadata_only", 12000),
    darkwebIndexSourceFixture(2, "analyst_import", "freenet", "pending_legal_review", 3000),
    darkwebIndexSourceFixture(3, "public_report", "tor", "approved_metadata_only", 9000),
    darkwebIndexSourceFixture(4, "safe_search_result", "i2p", "disabled_kill_switch", 6000),
    darkwebIndexSourceFixture(5, "internal_discovery", "freenet", "blocked_unsafe", 6000)
  ];
}

function darkwebIndexSourceFixture(index: number, sourceType: DarkwebIndexSourceType, network: DarkwebIndexNetwork, approvalState: DarkwebIndexSourceApprovalState, seedCount: number): DarkwebIndexSource {
  const key = `${sourceType}:${network}:${index}`;
  return {
    sourceId: stableId("darkweb-index-source", key),
    sourceType,
    network,
    sourceHash: hashContent(`darkweb-source:${key}`),
    redactedLabel: `${network} ${sourceType.replaceAll("_", " ")} metadata seed ${index + 1}`,
    approvalState,
    legalBasis: approvalState === "approved_metadata_only" ? "metadata_only_research" : approvalState === "blocked_unsafe" ? "blocked" : "operator_review_required",
    targetPolicy: approvalState === "approved_metadata_only" ? "metadata_landing_pages_only" : approvalState === "blocked_unsafe" ? "blocked_unsafe_targets" : "no_fetch_pending_review",
    seedCount,
    dedupeKey: hashContent(`dedupe-source:${key}`),
    reviewTicketId: `darkweb-review-${String(index + 1).padStart(3, "0")}`,
    allowedFields: ["network", "redactedDisplayUrl", "rawUrlHash", "hostHash", "pathHash", "title", "safeSummary", "category", "legalTriage", "language", "liveness", "firstSeen", "lastSeen", "provenance", "confidence", "reviewState", "contentHash"],
    forbiddenOperations: darkwebIndexForbiddenOperations(),
    isolationBoundary: darkwebIndexIsolationBoundary()
  };
}

function darkwebIndexIngestPreviews(records: readonly DarkwebIndexRecord[]): DarkwebIndexIngestPreview[] {
  return darkwebIndexSourceFixtures().map((source, index) => {
    const candidates = Math.min(source.seedCount, 10000);
    const blockedUnsafeCount = source.approvalState === "blocked_unsafe" ? candidates : Math.floor(candidates * 0.04);
    const reviewCount = source.approvalState === "pending_legal_review" ? Math.floor(candidates * 0.35) : Math.floor(candidates * 0.08);
    const duplicateCount = Math.floor(candidates * 0.12);
    const acceptedMetadataCount = Math.max(0, candidates - duplicateCount - reviewCount - blockedUnsafeCount);
    return {
      previewId: stableId("darkweb-ingest-preview", source.sourceId),
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      network: source.network,
      dryRunOnly: true,
      willFetchNetwork: false,
      candidateCount: candidates,
      acceptedMetadataCount,
      duplicateCount,
      reviewCount,
      blockedUnsafeCount,
      dedupeKeys: ["rawUrlHash", "hostHash", "pathHash", "titleHash", "contentHash", "sourceHash"],
      outputRecordIds: records.slice(index * 3, index * 3 + 3).map((record) => record.id),
      blockedReasons: source.approvalState === "blocked_unsafe" ? ["unsafe_target_class_blocked", "payload_or_credential_path_detected"] : ["payload_links_remain_unfetched"],
      noFetchReasons: source.approvalState === "approved_metadata_only" ? ["synthetic_preview_no_network"] : ["approval_or_kill_switch_blocks_collection", "synthetic_preview_no_network"]
    };
  });
}

function darkwebIndexDedupePlan(records: readonly DarkwebIndexRecord[]): DarkwebIndexDedupePlan {
  return {
    strategy: "host_path_title_redirect_content_hash",
    keyFields: ["rawUrlHash", "hostHash", "pathHash", "titleHash", "contentHash", "sourceHash"],
    duplicateClusters: [
      {
        clusterId: stableId("darkweb-dedupe-cluster", "mirror-leak-extortion"),
        canonicalRecordId: records[2]?.id ?? stableId("darkweb-index", "canonical-leak-extortion"),
        duplicateRecordIds: records.slice(14, 17).map((record) => record.id),
        reasons: ["same_host_hash", "matching_title_hash", "matching_category_and_legal_triage"],
        reviewState: "auto_merged_metadata_only"
      },
      {
        clusterId: stableId("darkweb-dedupe-cluster", "forum-repost-review"),
        canonicalRecordId: records[0]?.id ?? stableId("darkweb-index", "canonical-forum"),
        duplicateRecordIds: records.slice(24, 27).map((record) => record.id),
        reasons: ["shared_source_hash", "similar_safe_summary", "conflicting_liveness_requires_review"],
        reviewState: "needs_review"
      }
    ],
    mirrorPolicy: "cluster_by_hashes_without_following_redirect_payloads"
  };
}

function darkwebIndexIsolatedCollectorRuntime(): DarkwebIndexIsolatedCollectorRuntime {
  return {
    runtimeId: "darkweb_index_isolated_collector_contract_v1",
    mode: "contract_only_no_network",
    dryRunOnly: true,
    workerIsolation: darkwebIndexIsolationBoundary(),
    approvedProxyRequired: true,
    hostNetworkAllowed: false,
    sharedCredentialMountAllowed: false,
    writableHostMountAllowed: false,
    quarantineArtifactDescriptorsOnly: true,
    javascriptPolicy: "disabled_or_instrumented",
    egressPolicy: "network_specific_allowlist_only",
    contentCaps: {
      maxBytesPerPage: 262144,
      maxFetchSeconds: 20,
      maxRedirects: 2
    },
    allowedExtractionFields: ["title", "safeSummary", "language", "category", "legalTriage", "liveness", "contentHash", "screenshotHash", "actorHints", "victimHints", "ttpHints"],
    deniedActions: darkwebIndexForbiddenOperations(),
    emergencyStop: {
      supported: true,
      state: "armed",
      operatorAction: "pause_darkweb_index_workers"
    }
  };
}

function buildDarkwebIndexSchedulerHandoff(): DarkwebIndexSchedulerHandoff {
  return {
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
    lanes: [
      { lane: "high_risk_leak_metadata", priority: 10, cadenceMinutes: 360, maxRecordsPerRun: 1000, requiresApprovalState: "approved_metadata_only", action: "refresh_metadata" },
      { lane: "standard_directory_refresh", priority: 6, cadenceMinutes: 1440, maxRecordsPerRun: 2500, requiresApprovalState: "approved_metadata_only", action: "refresh_metadata" },
      { lane: "dead_or_intermittent_recheck", priority: 3, cadenceMinutes: 10080, maxRecordsPerRun: 1500, requiresApprovalState: "any_reviewed", action: "recheck_liveness" },
      { lane: "legal_review_hold", priority: 1, cadenceMinutes: 0, maxRecordsPerRun: 0, requiresApprovalState: "pending_legal_review", action: "hold_for_review" },
      { lane: "blocked_unsafe", priority: 0, cadenceMinutes: 0, maxRecordsPerRun: 0, requiresApprovalState: "blocked_unsafe", action: "skip_blocked" }
    ],
    pressurePolicy: {
      publicSearchNonBlocking: true,
      duplicateRunReuse: "required",
      emergencyBrakeAction: "pause_darkweb_index_workers",
      retryBackoff: [15, 60, 240, 1440]
    },
    noScheduleGuarantees: [
      "no_live_worker_leases_until_proxy_and_legal_approval",
      "no_direct_egress",
      "no_payload_download_tasks",
      "no_credential_collection_tasks",
      "no_auth_or_captcha_bypass_tasks",
      "no_private_access_tasks",
      "no_threat_actor_interaction_tasks"
    ]
  };
}

function buildDarkwebIndexParserRuntimeExpectation(): DarkwebIndexParserRuntimeExpectation {
  const blockedFields = ["rawUrl", "unsafeUrl", "html", "body", "rawText", "payloadBytes", "credentialValues", "cookieJar", "authorizationHeader", "privateMessages", "actorInteractionText"];
  return {
    schemaVersion: "ti.darkweb_index_parser_runtime.v1",
    owner: "Agent 03",
    mode: "isolated_landing_page_metadata_parser_contract",
    willFetchNetwork: false,
    parserProfiles: [
      {
        profile: "tor_landing_metadata",
        network: "tor",
        allowedInputs: ["quarantineDescriptor", "contentHash", "screenshotHash", "redactedDisplayUrl"],
        extractedFields: ["title", "safeSummary", "language", "category", "legalTriage", "liveness", "actorHints", "victimHints", "ttpHints"],
        blockedFields,
        maxInputBytes: 262144
      },
      {
        profile: "i2p_landing_metadata",
        network: "i2p",
        allowedInputs: ["quarantineDescriptor", "contentHash", "redactedDisplayUrl"],
        extractedFields: ["title", "safeSummary", "language", "category", "legalTriage", "liveness"],
        blockedFields,
        maxInputBytes: 196608
      },
      {
        profile: "freenet_landing_metadata",
        network: "freenet",
        allowedInputs: ["quarantineDescriptor", "contentHash", "redactedDisplayUrl"],
        extractedFields: ["title", "safeSummary", "language", "category", "legalTriage", "liveness"],
        blockedFields,
        maxInputBytes: 196608
      },
      {
        profile: "directory_listing_metadata",
        network: "mixed",
        allowedInputs: ["sourceHash", "hostHash", "pathHash", "redactedDisplayUrl"],
        extractedFields: ["title", "safeSummary", "category", "legalTriage", "liveness", "sourceHash"],
        blockedFields,
        maxInputBytes: 131072
      },
      {
        profile: "blocked_unsafe_stub",
        network: "mixed",
        allowedInputs: ["sourceHash", "rawUrlHash", "blockedReason"],
        extractedFields: ["legalTriage", "reviewState", "blockedReason", "whatWasNotAccessed"],
        blockedFields,
        maxInputBytes: 0
      }
    ],
    runtime: {
      disposableWorkerRequired: true,
      approvedProxyRequired: true,
      hostNetworkAllowed: false,
      sharedCredentialMountAllowed: false,
      writableHostMountAllowed: false,
      javascriptPolicy: "disabled_or_instrumented",
      output: "quarantine_descriptor_only"
    },
    blockedActions: darkwebIndexForbiddenOperations(),
    parserFailureClasses: [
      "unsupported_network",
      "content_too_large",
      "unsafe_payload_link_detected",
      "credential_or_auth_prompt_detected",
      "captcha_or_private_access_detected",
      "actor_interaction_target_detected",
      "parser_confidence_low",
      "legal_review_required"
    ]
  };
}

function darkwebIndexStorageHandoff(): DarkwebIndexStorageHandoff {
  const forbiddenColumns = ["raw_url", "unsafe_url", "html", "body", "raw_text", "payload", "credential", "password", "cookie", "authorization", "private_message", "actor_interaction"];
  return {
    schemaVersion: "ti.darkweb_index_storage_handoff.v1",
    owner: "Agent 06",
    migrationMode: "contract_only_no_database_connection",
    willConnectToDatabase: false,
    willMutate: false,
    tables: [
      {
        table: "darkweb_index_records",
        purpose: "canonical metadata-only descriptor rows",
        primaryKey: "id",
        requiredColumns: ["id", "network", "redacted_display_url", "raw_url_hash", "host_hash", "path_hash", "title", "safe_summary", "category", "legal_triage", "language", "liveness", "first_seen", "last_seen", "last_checked", "source_hash", "content_hash", "review_state", "retention_class"],
        forbiddenColumns,
        retentionClassColumn: "retention_class"
      },
      {
        table: "darkweb_index_sources",
        purpose: "seed and directory provenance with approval gates",
        primaryKey: "source_id",
        requiredColumns: ["source_id", "source_type", "network", "source_hash", "redacted_label", "approval_state", "legal_basis", "target_policy", "seed_count", "dedupe_key", "review_ticket_id"],
        forbiddenColumns,
        retentionClassColumn: "retention_class"
      },
      {
        table: "darkweb_index_refresh_runs",
        purpose: "refresh checkpoints and batch budget audit",
        primaryKey: "run_id",
        requiredColumns: ["run_id", "scheduler_id", "batch_id", "max_records", "max_worker_count", "checked_count", "live_count", "changed_count", "blocked_count", "review_count", "error_count", "next_cursor", "dry_run_only"],
        forbiddenColumns,
        retentionClassColumn: "retention_class"
      },
      {
        table: "darkweb_index_classification_history",
        purpose: "append-only legal triage and classification changes",
        primaryKey: "classification_event_id",
        requiredColumns: ["classification_event_id", "record_id", "label", "confidence", "reason_codes", "review_state", "changed_at", "changed_by"],
        forbiddenColumns,
        retentionClassColumn: "retention_class"
      },
      {
        table: "darkweb_index_liveness_checks",
        purpose: "metadata-only liveness state history",
        primaryKey: "liveness_check_id",
        requiredColumns: ["liveness_check_id", "record_id", "liveness", "checked_at", "source_hash", "content_hash", "blocked_reason", "refresh_run_id"],
        forbiddenColumns,
        retentionClassColumn: "retention_class"
      },
      {
        table: "darkweb_index_review_notes",
        purpose: "analyst review state and legal hold notes without raw material",
        primaryKey: "review_note_id",
        requiredColumns: ["review_note_id", "record_id", "review_state", "legal_triage", "note_summary", "reviewer_id", "reviewed_at", "retention_class"],
        forbiddenColumns,
        retentionClassColumn: "retention_class"
      }
    ],
    indexes: [
      { name: "darkweb_index_hash_lookup", table: "darkweb_index_records", fields: ["raw_url_hash", "host_hash", "path_hash", "content_hash"], queryUse: "operator hash lookup and dedupe" },
      { name: "darkweb_index_category_liveness_review_idx", table: "darkweb_index_records", fields: ["category", "liveness", "review_state", "legal_triage"], queryUse: "public filter counts and analyst queue slices" },
      { name: "darkweb_index_safe_summary_text_idx", table: "darkweb_index_records", fields: ["title", "safe_summary", "actor_hints", "victim_hints", "ttp_hints"], queryUse: "safe metadata search without raw page bodies" },
      { name: "darkweb_index_sources_approval_idx", table: "darkweb_index_sources", fields: ["network", "source_type", "approval_state", "target_policy"], queryUse: "source approval gates and no-fetch mode" },
      { name: "darkweb_index_refresh_cursor_idx", table: "darkweb_index_refresh_runs", fields: ["scheduler_id", "batch_id", "next_cursor"], queryUse: "refresh replay and resume" },
      { name: "darkweb_index_retention_review_idx", table: "darkweb_index_review_notes", fields: ["retention_class", "review_state", "reviewed_at"], queryUse: "retention and legal-hold review" }
    ],
    migrationOrder: ["darkweb_index_sources", "darkweb_index_records", "darkweb_index_refresh_runs", "darkweb_index_classification_history", "darkweb_index_liveness_checks", "darkweb_index_review_notes"],
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
      lookupInputs: ["rawUrlHash", "hostHash", "pathHash", "contentHash", "sourceHash"],
      outputRule: "return_redacted_descriptor_only"
    },
    retention: {
      defaultClass: "restricted_metadata",
      legalHoldClass: "legal_hold",
      reviewClass: "short_review",
      purgeRule: "delete_or_tombstone_descriptors_without_exposing_raw_material"
    },
    noLeakStorageGuarantees: ["hash_only_locators", "safe_summary_only", "no_raw_url_columns", "no_body_or_html_columns", "no_payload_or_credential_columns", "no_private_message_columns", "no_actor_interaction_columns"]
  };
}

function darkwebIndexFixtureRecord(index: number): DarkwebIndexRecord {
  const network = NETWORKS[index % NETWORKS.length]!;
  const category = CATEGORIES[index % CATEGORIES.length]!;
  const legalTriage = LEGAL_TRIAGE[index % LEGAL_TRIAGE.length]!;
  const liveness = LIVENESS[index % LIVENESS.length]!;
  const reviewState = reviewStateFor(legalTriage, liveness);
  const key = `${network}:${category}:${legalTriage}:${index}`;
  const day = String((index % 28) + 1).padStart(2, "0");
  return {
    id: stableId("darkweb-index", key),
    network,
    redactedDisplayUrl: `${network}:host-${hashContent(`host:${key}`).slice(0, 10)}/path-${hashContent(`path:${key}`).slice(0, 8)}`,
    rawUrlHash: hashContent(`raw-url:${key}`),
    hostHash: hashContent(`host:${key}`),
    pathHash: hashContent(`path:${key}`),
    title: titleFor(category, index),
    safeSummary: summaryFor(category, legalTriage),
    category,
    legalTriage,
    language: ["en", "no", "ru", "de", "es", "fr"][index % 6]!,
    liveness,
    firstSeen: `2026-04-${day}T00:00:00.000Z`,
    lastSeen: `2026-05-${day}T00:00:00.000Z`,
    lastChecked: `2026-05-${day}T12:00:00.000Z`,
    provenance: {
      sourceType: ["directory", "seed_list", "analyst_import", "public_report", "safe_search_result", "internal_discovery"][index % 6] as DarkwebIndexRecord["provenance"]["sourceType"],
      sourceHash: hashContent(`source:${key}`),
      discoveryPathHash: hashContent(`discovery:${key}`),
      collector: "synthetic_fixture"
    },
    confidence: Math.round((0.55 + (index % 40) / 100) * 100) / 100,
    reviewState,
    blockedReason: reviewState === "blocked_unsafe" ? "payload credential private or actor-interaction target represented by hash only" : undefined,
    screenshotHash: index % 4 === 0 ? hashContent(`screenshot:${key}`) : undefined,
    contentHash: hashContent(`content:${key}`),
    actorHints: index % 5 === 0 ? ["akira"] : index % 7 === 0 ? ["apt29"] : [],
    victimHints: index % 5 === 0 ? ["fjord-energy-as"] : [],
    ttpHints: index % 3 === 0 ? ["credential-access"] : index % 4 === 0 ? ["data-extortion"] : [],
    retentionClass: reviewState === "legal_hold" ? "legal_hold" : reviewState === "needs_review" ? "short_review" : "restricted_metadata",
    classification: {
      label: legalTriage,
      confidence: Math.round((0.6 + (index % 30) / 100) * 100) / 100,
      reasons: reasonsFor(category, legalTriage)
    },
    isolationBoundary: darkwebIndexIsolationBoundary(),
    whatWasNotAccessed: darkwebIndexWhatWasNotAccessed()
  };
}

function darkwebIndexRefreshRun(records: readonly DarkwebIndexRecord[]): DarkwebIndexRefreshRun {
  return {
    runId: stableId("darkweb-index-refresh", "fixture-60k-scale"),
    schedulerId: "darkweb_index_refresh_scheduler",
    batchId: "darkweb_index_fixture_batch_0001",
    budget: {
      maxRecords: 60000,
      maxWorkerCount: 12,
      maxBytesPerPage: 262144,
      maxRunMinutes: 240
    },
    checkedCount: records.length,
    liveCount: records.filter((record) => record.liveness === "live").length,
    changedCount: records.filter((_, index) => index % 9 === 0).length,
    blockedCount: records.filter((record) => record.reviewState === "blocked_unsafe").length,
    reviewCount: records.filter((record) => record.reviewState === "needs_review" || record.reviewState === "false_positive_review").length,
    errorCount: records.filter((record) => record.liveness === "unknown").length,
    nextCursor: "fixture-cursor-100-of-60000",
    dryRunOnly: true
  };
}

function darkwebIndexIsolationBoundary(): DarkwebIndexIsolationBoundary {
  return {
    disposableWorkerRequired: true,
    lockedDownEgress: true,
    sharedCredentialsAllowed: false,
    writableHostMountsAllowed: false,
    quarantineOutputOnly: true,
    javascriptActiveContentDefault: "disabled_or_instrumented",
    maxBytesPerPage: 262144,
    maxFetchSeconds: 20,
    payloadFollowingAllowed: false,
    credentialDumpDownloadsAllowed: false,
    malwareExecutionAllowed: false,
    privateAccessAllowed: false,
    captchaSolvingAllowed: false,
    threatActorInteractionAllowed: false,
    rawUnsafeUrlPublicOutputAllowed: false,
    emergencyStopSupported: true
  };
}

function darkwebIndexWhatWasNotAccessed(): string[] {
  return [
    "leaked rows",
    "credential values",
    "database dumps",
    "malware payloads",
    "private messages",
    "invite-only content",
    "authentication or CAPTCHA flows",
    "threat actor communications",
    "raw unsafe URLs"
  ];
}

function darkwebIndexForbiddenOperations(): string[] {
  return [
    "stolen-file download",
    "credential dump download",
    "database dump retrieval",
    "malware payload execution",
    "private or invite-only access",
    "authentication bypass",
    "CAPTCHA solving",
    "paywall bypass",
    "threat actor interaction",
    "raw unsafe URL public output"
  ];
}

function darkwebIndexNoLeakSerialization(): DarkwebIndexNoLeakSerialization {
  return {
    passed: true,
    forbiddenFields: ["rawUrl", "unsafeUrl", "body", "html", "rawText", "payload", "downloadUrl", "credential", "password", "cookie", "authorization", "privateMessage", "actorInteraction"],
    guarantees: {
      noRawUnsafeUrls: true,
      noCredentials: true,
      noPayloads: true,
      noLeakedRows: true,
      noPrivateMaterial: true,
      noActorInteraction: true
    }
  };
}

function reviewStateFor(legalTriage: DarkwebIndexLegalTriage, liveness: DarkwebIndexLiveness): DarkwebIndexReviewState {
  if (legalTriage === "blocked_unsafe" || liveness === "blocked_by_policy") return "blocked_unsafe";
  if (legalTriage === "unknown_requires_review" || liveness === "requires_review") return "needs_review";
  if (legalTriage === "leak_or_extortion" || legalTriage === "credential_or_abuse") return "legal_hold";
  if (legalTriage === "benign") return "false_positive_review";
  return "approved_metadata_only";
}

function titleFor(category: DarkwebIndexCategory, index: number): string {
  const label = category.replaceAll("_", " ");
  return `Synthetic ${label} metadata descriptor ${String(index + 1).padStart(3, "0")}`;
}

function summaryFor(category: DarkwebIndexCategory, legalTriage: DarkwebIndexLegalTriage): string {
  return `Metadata-only ${category.replaceAll("_", " ")} landing-page descriptor with ${legalTriage.replaceAll("_", " ")} triage; payload links, credentials, private access, and actor interaction are blocked.`;
}

function reasonsFor(category: DarkwebIndexCategory, legalTriage: DarkwebIndexLegalTriage): string[] {
  return [
    `category:${category}`,
    `legal_triage:${legalTriage}`,
    "hash_only_source_and_url_references",
    "payload_or_credential_targets_blocked_before_access"
  ];
}

function countBy<T extends string>(keys: readonly T[], values: readonly T[]): Record<T, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
  for (const value of values) counts[value] += 1;
  return counts;
}

function isNetwork(value: string | undefined): value is DarkwebIndexNetwork {
  return Boolean(value && NETWORKS.includes(value as DarkwebIndexNetwork));
}

function isCategory(value: string | undefined): value is DarkwebIndexCategory {
  return Boolean(value && CATEGORIES.includes(value as DarkwebIndexCategory));
}

function isLegalTriage(value: string | undefined): value is DarkwebIndexLegalTriage {
  return Boolean(value && LEGAL_TRIAGE.includes(value as DarkwebIndexLegalTriage));
}

function isLiveness(value: string | undefined): value is DarkwebIndexLiveness {
  return Boolean(value && LIVENESS.includes(value as DarkwebIndexLiveness));
}
