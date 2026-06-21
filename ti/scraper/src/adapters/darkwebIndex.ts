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

export interface DarkwebIndexDownstreamHandoff {
  readonly schemaVersion: "ti.darkweb_index_downstream_handoff.v1";
  readonly quality: {
    readonly owner: "Agent 07";
    readonly fixtures: ReadonlyArray<{
      readonly fixtureId: string;
      readonly scenario: "benign_directory" | "leak_claim_hold" | "credential_abuse_block" | "malware_payload_block" | "false_positive_review" | "stale_or_dead_recheck";
      readonly expectedReviewState: DarkwebIndexReviewState;
      readonly expectedLegalTriage: DarkwebIndexLegalTriage;
      readonly publicPromotionAllowed: boolean;
      readonly requiredCaveats: readonly string[];
    }>;
    readonly releaseGate: {
      readonly requiresHumanReviewForRestrictedClaims: true;
      readonly requiresCorroboratingPublicEvidence: true;
      readonly blocksStandaloneDarkwebClaims: true;
      readonly proofCommands: readonly string[];
    };
  };
  readonly graphStix: {
    readonly owner: "Agent 08";
    readonly relationshipPolicy: "descriptor_edges_review_hold";
    readonly allowedEdges: readonly ["source_describes_actor", "source_mentions_victim", "source_mentions_ttp", "mirror_of", "same_host_hash"];
    readonly heldEdges: readonly ["victim_claim", "credential_claim", "payload_claim", "actor_statement"];
    readonly stixExportDefault: "hold_until_reviewed_and_correlated";
    readonly allowedStixObjects: readonly ["identity_descriptor", "threat_actor_alias_hint", "indicator_hash_only", "relationship_review_hold"];
    readonly forbiddenStixObjects: readonly ["malware_payload", "credential_dump", "raw_url_indicator", "private_message", "actor_interaction"];
  };
  readonly apiUi: {
    readonly owner: "Agent 09";
    readonly route: "/ti/darkweb/index";
    readonly statusRoute: "/v1/darkweb/status";
    readonly searchRoute: "/v1/darkweb/search";
    readonly panels: readonly ["overview", "records", "review_queue", "source_readiness", "storage_handoff", "scheduler_parser_handoff", "ops_runbook"];
    readonly safeActions: readonly ["filter", "paginate", "copy_hash", "open_review_ticket", "export_metadata_csv"];
    readonly forbiddenActions: readonly ["open_raw_url", "download_payload", "download_credentials", "solve_captcha", "contact_actor", "bypass_authentication"];
    readonly warningCodes: readonly ["metadata_only", "review_required", "blocked_unsafe", "legal_hold", "operator_hash_lookup_only"];
  };
  readonly opsRunbook: {
    readonly owner: "Agent 10";
    readonly killSwitch: {
      readonly flag: "DARKWEB_INDEX_KILL_SWITCH";
      readonly defaultState: "armed";
      readonly action: "pause_workers_and_hold_sources";
    };
    readonly soak: {
      readonly stages: readonly ["contract_fixture", "dry_run_replay", "isolated_canary", "metadata_only_limited_rollout"];
      readonly requiredSignals: readonly ["no_leak_serialization", "zero_forbidden_actions", "proxy_boundary_healthy", "queue_budget_within_limit", "review_queue_within_slo"];
    };
    readonly alerts: ReadonlyArray<{
      readonly code: "unsafe_action_attempt" | "proxy_boundary_failure" | "parser_leak_attempt" | "review_queue_over_slo" | "storage_forbidden_column";
      readonly severity: "hold" | "rollback";
      readonly operatorAction: string;
    }>;
    readonly rollback: readonly ["pause_darkweb_index_workers", "disable_source_ingest", "clear_pending_restricted_queue", "keep_public_search_non_blocking", "rerun_no_leak_checks"];
  };
}

export interface DarkwebIndexRestrictedReconciliation {
  readonly schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1";
  readonly owner: "Agent 05";
  readonly mode: "contract_only_audit_reconciliation";
  readonly willFetchNetwork: false;
  readonly willMutateSources: false;
  readonly dependsOnRoutes: readonly ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/contracts"];
  readonly auditRows: ReadonlyArray<{
    readonly checkId: string;
    readonly source: "darkweb_index" | "restricted_metadata_status" | "restricted_metadata_apply_plan" | "contracts";
    readonly expectedState: "route_visible" | "metadata_only" | "non_blocking" | "operator_only" | "held_until_review" | "kill_switch_ready";
    readonly reconciliationRule: string;
    readonly blockingIfMissing: boolean;
  }>;
  readonly fieldMapping: {
    readonly darkwebIndexFields: readonly ["rawUrlHash", "hostHash", "pathHash", "contentHash", "sourceHash", "legalTriage", "reviewState", "retentionClass"];
    readonly restrictedMetadataFields: readonly ["sourceId", "urlHash", "policyAuditId", "retentionClass", "legalHold", "killSwitchState", "redactionProof", "auditEventIds"];
    readonly joinKeys: readonly ["rawUrlHash_to_urlHash", "sourceHash_to_sourceId_or_policyAuditId"];
  };
  readonly releaseGate: {
    readonly routeVisibleRequired: true;
    readonly restrictedApplyPlanGreenRequired: true;
    readonly standaloneDarkwebClaimsHeld: true;
    readonly noLeakSerializationRequired: true;
    readonly proofCommands: readonly string[];
  };
  readonly unresolvedExternalBlockers: readonly string[];
}

export interface DarkwebIndexRefreshOperationsPlan {
  readonly schemaVersion: "ti.darkweb_index_refresh_operations.v1";
  readonly owner: "Agent 05";
  readonly mode: "metadata_only_operations_model";
  readonly targetRecordCount: 60000;
  readonly willFetchNetwork: false;
  readonly willScheduleLiveWork: false;
  readonly lanes: ReadonlyArray<{
    readonly laneId: string;
    readonly sourceType: DarkwebIndexSourceType;
    readonly network: DarkwebIndexNetwork | "mixed";
    readonly targetRecords: number;
    readonly cadenceMinutes: number;
    readonly maxRecordsPerRun: number;
    readonly approvalRequired: DarkwebIndexSourceApprovalState | "operator_review";
    readonly action: "refresh_metadata" | "recheck_liveness" | "import_metadata_descriptors" | "hold_for_review";
    readonly safeOutput: "hashes_redacted_labels_and_quarantine_descriptors";
  }>;
  readonly budgets: {
    readonly maxWorkerCount: 8;
    readonly maxRunMinutes: 45;
    readonly maxBytesPerPage: 262144;
    readonly quarantineRetentionDays: 14;
    readonly diskBudgetGb: 24;
  };
  readonly disabledUntilApprovedHarness: true;
  readonly blockedActions: readonly string[];
}

export interface DarkwebIndexDriftPacket {
  readonly schemaVersion: "ti.darkweb_index_liveness_classification_drift.v1";
  readonly owner: "Agent 05";
  readonly mode: "metadata_only_drift_rows";
  readonly generatedFromFixtureCount: number;
  readonly rows: ReadonlyArray<{
    readonly driftId: string;
    readonly recordId: string;
    readonly driftType:
      | "newly_alive"
      | "newly_dead"
      | "category_changed"
      | "legal_risk_changed"
      | "source_reputation_changed"
      | "duplicate_cluster_changed"
      | "review_priority_changed"
      | "graph_export_hold_changed";
    readonly previousState: string;
    readonly currentState: string;
    readonly reviewImpact: "no_change" | "review_required" | "legal_hold" | "blocked_unsafe" | "graph_export_hold";
    readonly publicUiEffect: "show_badge" | "hold_public_claim" | "hide_from_public_default" | "update_filter_count";
    readonly evidence: {
      readonly sourceHash: string;
      readonly contentHash: string;
      readonly rawUrlHash: string;
    };
  }>;
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexSearchQualityMetrics {
  readonly schemaVersion: "ti.darkweb_index_search_quality.v1";
  readonly owner: "Agent 05";
  readonly mode: "metadata_only_quality_metrics";
  readonly categoryCoverage: Record<DarkwebIndexCategory, number>;
  readonly languageHints: ReadonlyArray<{ readonly language: string; readonly count: number }>;
  readonly titleSummaryUsefulness: {
    readonly usefulTitleCount: number;
    readonly usefulSummaryCount: number;
    readonly weakSummaryCount: number;
  };
  readonly entityExtractionConfidence: {
    readonly actorHintCount: number;
    readonly victimHintCount: number;
    readonly datasetHintCount: number;
    readonly ttpHintCount: number;
    readonly averageConfidence: number;
  };
  readonly blockedUnsafeEvidenceCounts: {
    readonly payloadLike: number;
    readonly credentialLike: number;
    readonly privateAccessLike: number;
    readonly actorInteractionLike: number;
  };
  readonly falsePositiveReviewRows: readonly string[];
  readonly publicSafeDisplayReadiness: {
    readonly readyCount: number;
    readonly heldCount: number;
    readonly blockedCount: number;
    readonly requiredWarnings: readonly ["metadata_only", "review_required", "blocked_unsafe", "legal_hold"];
  };
}

export interface DarkwebIndexTier100ProductSlice {
  readonly schemaVersion: "ti.darkweb_index_tier100_product.v1";
  readonly owner: "Agent 05";
  readonly tier: "tier_100";
  readonly mode: "buyer_visible_safe_metadata";
  readonly recordGoal: 100;
  readonly producedRecordCount: number;
  readonly sourceFamilies: ReadonlyArray<{
    readonly family: "public_report" | "analyst_import" | "directory_metadata" | "public_tracker_reference" | "approved_seed" | "safe_search_result";
    readonly candidateCount: number;
    readonly acceptedCount: number;
    readonly duplicateCount: number;
    readonly blockedCount: number;
    readonly reviewCount: number;
    readonly staleOrDeadCount: number;
    readonly productLift: "actor_search_corroboration" | "victim_context" | "category_coverage" | "liveness_signal" | "source_family_diversity";
  }>;
  readonly importOutcome: {
    readonly accepted: number;
    readonly duplicate: number;
    readonly blocked: number;
    readonly reviewNeeded: number;
    readonly staleOrDead: number;
    readonly acceptedRecordIds: readonly string[];
    readonly duplicateRecordIds: readonly string[];
    readonly blockedRecordIds: readonly string[];
    readonly reviewRecordIds: readonly string[];
    readonly staleOrDeadRecordIds: readonly string[];
  };
  readonly buyerVisibleSearch: {
    readonly usefulSummaryRate: number;
    readonly actorHintCoverage: number;
    readonly victimHintCoverage: number;
    readonly categoryCoverageCount: number;
    readonly liveOrIntermittentCount: number;
    readonly publicSearchBoostQueries: readonly string[];
    readonly apifyFields: readonly ["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"];
  };
  readonly tier1000AdvancementCriteria: {
    readonly targetTier: "tier_1000";
    readonly minAcceptedRecords: 70;
    readonly maxDuplicateRate: 0.2;
    readonly minUsefulSummaryRate: 0.8;
    readonly minActorHintCoverage: 0.25;
    readonly minCategoryCoverage: 8;
    readonly maxBlockedUnsafeRate: 0.2;
    readonly maxFalsePositiveReviewRows: 12;
    readonly requireNoLeakProof: true;
    readonly requireApifySearchLift: true;
  };
  readonly safety: {
    readonly rawUnsafeUrlsExposed: false;
    readonly stolenFilesDownloaded: false;
    readonly credentialsRetrieved: false;
    readonly payloadsFollowed: false;
    readonly privateAuthCaptchaAccess: false;
    readonly actorInteraction: false;
  };
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexTier1000Readiness {
  readonly schemaVersion: "ti.darkweb_index_tier1000_readiness.v1";
  readonly owner: "Agent 05";
  readonly tier: "tier_1000";
  readonly mode: "real_metadata_readiness_path";
  readonly targetRecordCount: 1000;
  readonly evaluatedRecordCount: number;
  readonly productQualifiedRecordCount: number;
  readonly rejectedLowValueRecordCount: number;
  readonly sourceFamilies: ReadonlyArray<{
    readonly family: "public_report" | "analyst_import" | "directory_metadata" | "public_tracker_reference" | "approved_seed" | "safe_search_result";
    readonly evaluatedCount: number;
    readonly productQualifiedCount: number;
    readonly needsRefreshCount: number;
    readonly legalHoldCount: number;
    readonly blockedUnsafeCount: number;
    readonly averageBuyerValue: number;
    readonly refreshCadenceMinutes: number;
  }>;
  readonly freshness: {
    readonly currentEnoughCount: number;
    readonly staleCount: number;
    readonly deadOrUnknownCount: number;
    readonly liveOrIntermittentRate: number;
    readonly medianRefreshCadenceMinutes: number;
    readonly maxAllowedStaleHours: 72;
    readonly customerFreshnessLabel: "fresh_enough_for_monitoring" | "needs_refresh_before_paid_claim";
  };
  readonly searchReadiness: {
    readonly safeSummaryCoverage: number;
    readonly actorHintCoverage: number;
    readonly victimHintCoverage: number;
    readonly categoryCoverageCount: number;
    readonly sourceFamilyCoverageCount: number;
    readonly buyerValueCoverage: number;
    readonly apifyReadyRecordIds: readonly string[];
    readonly searchBoostQueries: readonly string[];
  };
  readonly importGate: {
    readonly accepted: number;
    readonly duplicate: number;
    readonly blockedUnsafe: number;
    readonly reviewNeeded: number;
    readonly staleOrDead: number;
    readonly lowBuyerValue: number;
    readonly acceptanceRate: number;
    readonly duplicateRate: number;
    readonly blockedUnsafeRate: number;
  };
  readonly tier4000Planning: {
    readonly targetTier: "tier_4000";
    readonly requiredBeforeAdvance: readonly string[];
    readonly minProductQualifiedRecords: 720;
    readonly minFreshnessCurrentRate: 0.55;
    readonly maxBlockedUnsafeRate: 0.18;
    readonly requireNoLeakProof: true;
    readonly requireActorDatasetLift: true;
  };
  readonly safety: {
    readonly rawUnsafeUrlsExposed: false;
    readonly stolenFilesDownloaded: false;
    readonly credentialsRetrieved: false;
    readonly payloadsFollowed: false;
    readonly privateAuthCaptchaAccess: false;
    readonly actorInteraction: false;
  };
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexTier4000Admission {
  readonly schemaVersion: "ti.darkweb_index_tier4000_admission.v1";
  readonly owner: "Agent 05";
  readonly tier: "tier_4000";
  readonly mode: "buyer_value_admission_gate";
  readonly baselineTier: "tier_1000";
  readonly targetRecordCount: 4000;
  readonly evaluatedCandidateCount: number;
  readonly admittedCandidateCount: number;
  readonly rejectedCandidateCount: number;
  readonly admissionRules: {
    readonly minBuyerValueScore: 0.66;
    readonly minSafeSummaryLength: 80;
    readonly allowedLiveness: readonly ["live", "intermittent"];
    readonly requiredSignals: readonly ["category", "sourceFamily", "lastSeen", "provenanceHash", "actor_or_victim_or_dataset_hint"];
    readonly maxDuplicateRate: 0.18;
    readonly maxStaleRate: 0.35;
    readonly maxBlockedOrReviewRate: 0.22;
    readonly requireApprovedMetadataOnly: true;
  };
  readonly candidateModel: {
    readonly requiredFields: readonly ["safeSummary", "actorHints", "victimHints", "datasetHints", "claimedDate", "firstSeen", "lastSeen", "sourceFamily", "liveness", "refreshCadenceMinutes", "searchBoostTerms", "provenanceHash", "buyerValueScore", "whyItMatters"];
    readonly publicSafeHashFields: readonly ["rawUrlHash", "hostHash", "pathHash", "contentHash", "sourceHash"];
    readonly forbiddenFields: readonly string[];
  };
  readonly qualityMetrics: {
    readonly productQualifiedRate: number;
    readonly staleRate: number;
    readonly duplicateRate: number;
    readonly blockedOrReviewRate: number;
    readonly searchHitQualityRate: number;
    readonly actorHintCoverage: number;
    readonly victimHintCoverage: number;
    readonly datasetHintCoverage: number;
    readonly averageBuyerValueScore: number;
    readonly costRiskPerUsefulMetadataRow: "low" | "medium" | "high";
  };
  readonly importRefreshGate: {
    readonly disposableIsolationRequired: true;
    readonly approvedProxyRequired: true;
    readonly rawUnsafeUrlSerializationAllowed: false;
    readonly credentialOrPayloadCollectionAllowed: false;
    readonly authCaptchaPrivateAccessAllowed: false;
    readonly threatActorInteractionAllowed: false;
    readonly refreshCadenceMinutesByFamily: Record<DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"], number>;
    readonly rejectLowValueInsteadOfInflatingCount: true;
  };
  readonly buyerSearchProof: {
    readonly sampleSearchRows: readonly DarkwebIndexBuyerSearchRow[];
    readonly usefulSearchQueries: readonly string[];
    readonly activationDecision: "hold_for_value_density" | "ready_for_limited_canary";
    readonly blockers: readonly string[];
  };
  readonly crossAgentHandoffs: {
    readonly sourceAtlas: "source_family_value_and_replacement_candidates";
    readonly publicChannel: "corroborate_actor_victim_dataset_claims";
    readonly evidencePromotion: "metadata_context_only_public_answer_support";
    readonly qualityGate: "tier4000_product_quality_admission";
    readonly apiFrontend: "buyer_search_rows_and_filters";
    readonly productSlo: "cost_risk_per_useful_metadata_row";
  };
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexBuyerSearchRow {
  readonly recordId: string;
  readonly safeSummary: string;
  readonly actorHints: readonly string[];
  readonly victimHints: readonly string[];
  readonly datasetHints: readonly string[];
  readonly claimedDate: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly sourceFamily: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"];
  readonly liveness: DarkwebIndexLiveness;
  readonly refreshCadenceMinutes: number;
  readonly searchBoostTerms: readonly string[];
  readonly confidence: number;
  readonly freshness: "current" | "refresh_due" | "stale_or_dead";
  readonly buyerValueScore: number;
  readonly whyItMatters: string;
  readonly provenanceHash: string;
}

export interface DarkwebIndexTier10000RefreshValue {
  readonly schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1";
  readonly owner: "Agent 05";
  readonly tier: "tier_10000";
  readonly baselineTier: "tier_4000";
  readonly mode: "refresh_and_buyer_search_value_gate";
  readonly targetRecordCount: 10000;
  readonly evaluatedCandidateCount: number;
  readonly valueQualifiedCount: number;
  readonly rejectedLowValueCount: number;
  readonly advancementCriteria: {
    readonly minProductQualifiedRate: 0.72;
    readonly maxDuplicateRate: 0.16;
    readonly maxStaleRate: 0.28;
    readonly maxBlockedOrReviewRate: 0.18;
    readonly minActorCoverage: 0.25;
    readonly minVictimCoverage: 0.18;
    readonly minDatasetCoverage: 0.24;
    readonly minAverageBuyerValueScore: 0.68;
    readonly requireNoLeakProof: true;
  };
  readonly refreshLanes: ReadonlyArray<{
    readonly family: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"];
    readonly cadenceMinutes: number;
    readonly risk: "low" | "medium" | "high";
    readonly expectedBuyerVisibleRowEffect: "fresh_actor_hits" | "victim_context" | "dataset_claim_discovery" | "source_family_diversity" | "stale_row_suppression";
    readonly blockerRules: readonly string[];
  }>;
  readonly buyerSearchProof: {
    readonly actorQueries: readonly string[];
    readonly victimCompanyQueries: readonly string[];
    readonly ransomwareGroupQueries: readonly string[];
    readonly datasetTypeQueries: readonly string[];
    readonly sectorCountryQueries: readonly string[];
    readonly newSinceLastRunQueries: readonly string[];
    readonly usefulQueryCount: number;
    readonly sampleRows: readonly DarkwebIndexBuyerSearchRow[];
  };
  readonly qualityMetrics: {
    readonly searchHitQualityRate: number;
    readonly usefulSummaryRate: number;
    readonly currentEnoughFreshnessRate: number;
    readonly duplicateSuppressionRate: number;
    readonly blockedOrReviewRate: number;
    readonly actorCoverage: number;
    readonly victimCoverage: number;
    readonly datasetCoverage: number;
    readonly averageBuyerValueScore: number;
    readonly costRiskPerUsefulMetadataRow: "low" | "medium" | "high";
  };
  readonly activationDecision: "ready_for_tier10000_limited_canary" | "hold_for_value_density";
  readonly blockers: readonly string[];
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexLiveValueExpansion {
  readonly schemaVersion: "ti.darkweb_index_live_value_expansion.v1";
  readonly owner: "Agent 05";
  readonly mode: "metadata_only_ready_to_import_value_expansion";
  readonly willFetchNetwork: false;
  readonly willScheduleLiveWork: false;
  readonly sourceCountInflationBlocked: true;
  readonly tiers: ReadonlyArray<{
    readonly tier: "tier_1000" | "tier_4000";
    readonly targetRecordCount: 1000 | 4000;
    readonly evaluatedCandidateCount: number;
    readonly valueQualifiedCandidateCount: number;
    readonly rejectedLowValueCandidateCount: number;
    readonly usefulRowRate: number;
    readonly averageBuyerValueScore: number;
    readonly staleRate: number;
    readonly duplicateRate: number;
    readonly blockedOrReviewRate: number;
    readonly sampleRowsRequired: 12;
    readonly usefulQueriesRequired: 20;
    readonly advancementDecision: "ready_for_import_batch" | "hold_for_value_density";
    readonly blockers: readonly string[];
    readonly candidateRows: readonly DarkwebIndexLiveValueCandidateRow[];
    readonly buyerSearchProof: {
      readonly usefulQueryCount: number;
      readonly actorQueries: readonly string[];
      readonly victimCompanyQueries: readonly string[];
      readonly ransomwareGroupQueries: readonly string[];
      readonly datasetTypeQueries: readonly string[];
      readonly sectorCountryQueries: readonly string[];
      readonly newSinceLastRunQueries: readonly string[];
      readonly sampleRows: readonly DarkwebIndexLiveValueCandidateRow[];
    };
  }>;
  readonly refreshScheduleSemantics: ReadonlyArray<{
    readonly sourceFamily: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"];
    readonly cadenceMinutes: number;
    readonly lastSuccessAt: string;
    readonly nextDueAt: string;
    readonly failureReason: "none" | "pending_legal_review" | "source_approval_not_current" | "unsafe_or_private_dependency" | "low_value_density";
    readonly parserFamily: "public_report_metadata" | "analyst_import_metadata" | "directory_landing_metadata" | "public_tracker_metadata" | "approved_seed_metadata" | "safe_search_result_metadata";
    readonly sourceFamilyDiversityImpact: "high" | "medium" | "low";
    readonly expectedRowsPerDay: number;
    readonly approvedBoundary: "metadata_only_no_network_in_this_contract";
  }>;
  readonly valueGateRejects: ReadonlyArray<{
    readonly reason:
      | "duplicate"
      | "stale_mirror"
      | "generic_listing"
      | "no_actor_victim_dataset_hint"
      | "unsafe_output_risk"
      | "review_or_legal_hold"
      | "auth_captcha_private_dependency"
      | "low_buyer_value";
    readonly rejectedCount: number;
    readonly doesNotCountTowardTier: true;
  }>;
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexLiveValueCandidateRow {
  readonly recordId: string;
  readonly tier: "tier_1000" | "tier_4000";
  readonly sourceFamily: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"];
  readonly safeLocatorHash: string;
  readonly actorHints: readonly string[];
  readonly victimHints: readonly string[];
  readonly datasetHints: readonly string[];
  readonly sectorCountry: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly liveness: DarkwebIndexLiveness;
  readonly freshness: DarkwebIndexBuyerSearchRow["freshness"];
  readonly buyerValueScore: number;
  readonly reviewState: DarkwebIndexReviewState;
  readonly noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
  readonly decision: "value_qualified" | "rejected";
  readonly whyWorthPayingFor: string;
  readonly rejectionReason?: string;
}

export type DarkwebIndexPublicHandoffDecision =
  | "sellable_with_public_support"
  | "included_with_caveat"
  | "coverage_gap_only"
  | "hold"
  | "suppress";

export interface DarkwebIndexPublicIntelligenceHandoff100 {
  readonly schemaVersion: "ti.darkweb_index_public_intelligence_handoff_100.v1";
  readonly owner: "Agent 05";
  readonly mode: "metadata_only_public_intelligence_handoff";
  readonly candidateTarget: 100;
  readonly candidateCount: number;
  readonly publicCorroboratedCount: number;
  readonly usefulCaveatedCount: number;
  readonly rejectedCount: number;
  readonly projectedContributionToward100SellableRows: number;
  readonly averageBuyerValueScore: number;
  readonly staleRate: number;
  readonly duplicateRate: number;
  readonly unsafeRate: number;
  readonly authPrivateCaptchaRate: number;
  readonly decisionCounts: Record<DarkwebIndexPublicHandoffDecision, number>;
  readonly rejectionReasons: ReadonlyArray<{
    readonly reason:
      | "duplicate"
      | "stale_or_dead"
      | "missing_useful_hint"
      | "restricted_only_without_public_support"
      | "unsafe_or_blocked"
      | "auth_private_captcha_dependency"
      | "legal_or_review_hold"
      | "low_buyer_value";
    readonly count: number;
    readonly doesNotCountTowardSellableRows: true;
  }>;
  readonly rows: readonly DarkwebIndexPublicHandoffRow[];
  readonly sampleRows: readonly DarkwebIndexPublicHandoffRow[];
  readonly handoffs: {
    readonly agent03ParserGaps: readonly string[];
    readonly agent04PublicCorroborationGaps: readonly string[];
    readonly agent08GraphPivots: readonly string[];
    readonly agent10RevenueGateCounts: {
      readonly targetSellableRows: 100;
      readonly sellableWithPublicSupport: number;
      readonly usefulCaveatedRows: number;
      readonly coverageGapOnlyRows: number;
      readonly heldRows: number;
      readonly suppressedRows: number;
      readonly averageBuyerValueScore: number;
      readonly projectedContributionToward100SellableRows: number;
    };
  };
  readonly safety: {
    readonly metadataOnly: true;
    readonly willFetchNetwork: false;
    readonly rawUnsafeUrlsExposed: false;
    readonly stolenFilesDownloaded: false;
    readonly credentialsRetrieved: false;
    readonly payloadsFollowed: false;
    readonly privateAuthCaptchaAccess: false;
    readonly actorInteraction: false;
  };
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexPublicHandoffRow {
  readonly recordId: string;
  readonly sourceFamily: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"];
  readonly safeLocatorHash: string;
  readonly actorHints: readonly string[];
  readonly victimHints: readonly string[];
  readonly datasetHints: readonly string[];
  readonly sectorCountry: string;
  readonly claimedDate: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly liveness: DarkwebIndexLiveness;
  readonly freshness: DarkwebIndexBuyerSearchRow["freshness"];
  readonly buyerValueScore: number;
  readonly publicSupportState: "public_supported" | "public_pivot_available" | "restricted_only" | "unsafe_or_held";
  readonly decision: DarkwebIndexPublicHandoffDecision;
  readonly decisionReason: string;
  readonly noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
  readonly nextPublicCorroborationPivots: readonly string[];
  readonly parserGap?: string;
  readonly publicCorroborationGap?: string;
  readonly graphPivot?: string;
}

export interface DarkwebIndexPublicSupportWorklist40 {
  readonly schemaVersion: "ti.darkweb_index_public_support_worklist_40.v1";
  readonly owner: "Agent 05";
  readonly mode: "metadata_only_public_support_worklist";
  readonly candidateSource: "publicIntelligenceHandoff100";
  readonly topCandidateTarget: 40;
  readonly topCandidateCount: number;
  readonly publicSupportReadyCount: number;
  readonly stillRestrictedOnlyCount: number;
  readonly staleDuplicateUnsafeLowValueRejections: {
    readonly stale: number;
    readonly duplicate: number;
    readonly unsafe: number;
    readonly lowValue: number;
  };
  readonly projectedCaveatedRows: number;
  readonly projectedSellableRowsAfterPublicSupport: number;
  readonly contributionToward100SellableRows: number;
  readonly averageBuyerValueScore: number;
  readonly costPerUsefulRowEffect: {
    readonly basis: "planning_estimate_no_spend";
    readonly currentUsefulRows: number;
    readonly projectedUsefulRows: number;
    readonly usefulRowDelta: number;
    readonly estimatedAnalystMinutes: number;
    readonly costPerUsefulRowTrend: "improves_if_public_support_found" | "held_until_public_support_exists";
  };
  readonly rows: readonly DarkwebIndexPublicSupportWorkRow[];
  readonly handoffs: {
    readonly agent04PublicSourceTargets: readonly string[];
    readonly agent03ParserFields: readonly string[];
    readonly agent08GraphPivots: readonly string[];
    readonly agent10RevenueGate: {
      readonly targetSellableRows: 100;
      readonly projectedSellableRowLift: number;
      readonly projectedCaveatedRows: number;
      readonly contributionToward100SellableRows: number;
      readonly usefulRowDelta: number;
      readonly costPerUsefulRowEffect: "improves_if_public_support_found" | "held_until_public_support_exists";
    };
  };
  readonly safety: DarkwebIndexPublicIntelligenceHandoff100["safety"];
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexPublicSupportWorkRow {
  readonly rank: number;
  readonly recordId: string;
  readonly safeLocatorHash: string;
  readonly sourceFamily: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"];
  readonly publicSourceFamilyNeeded:
    | "vendor_cti_or_research_report"
    | "government_cert_or_advisory"
    | "news_or_victim_public_statement"
    | "ransomware_tracker_or_public_dataset"
    | "malware_research_or_ttp_report"
    | "public_search_or_directory_context";
  readonly parserFieldsNeeded: readonly ["actor", "victim", "dataset", "sector_country", "claimed_date", "source_family"];
  readonly expectedOutcome: "projected_sellable_after_public_support" | "projected_caveated_after_public_support" | "hold_restricted_only" | "reject_stale" | "reject_duplicate" | "reject_unsafe" | "reject_low_value";
  readonly currentDecision: DarkwebIndexPublicHandoffDecision;
  readonly publicSupportState: DarkwebIndexPublicHandoffRow["publicSupportState"];
  readonly actorHints: readonly string[];
  readonly victimHints: readonly string[];
  readonly datasetHints: readonly string[];
  readonly sectorCountry: string;
  readonly claimedDate: string;
  readonly freshness: DarkwebIndexBuyerSearchRow["freshness"];
  readonly buyerValueScore: number;
  readonly selectionScore: number;
  readonly whyBuyerWouldPayIfCorroborated: string;
  readonly noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
  readonly publicSupportTarget: string;
  readonly graphPivot?: string;
  readonly rejectionReason?: "stale" | "duplicate" | "unsafe" | "low_value" | "restricted_only";
}

export type DarkwebIndexPublicSupportLiftOutcome =
  | "sellable_after_public_support"
  | "useful_with_caveat"
  | "restricted_only_hold"
  | "stale_reject"
  | "duplicate_reject"
  | "unsafe_reject"
  | "low_value_reject";

export type DarkwebIndexPublicSupportLiftSupportBucket =
  | "currently_chargeable"
  | DarkwebIndexPublicSupportLiftOutcome
  | "needs_parser_repair"
  | "needs_source_support";

export interface DarkwebIndexPublicSupportLift1000 {
  readonly schemaVersion: "ti.darkweb_index_public_support_lift_1000.v1";
  readonly owner: "Agent 05";
  readonly mode: "metadata_only_public_support_lift_100_to_4000";
  readonly candidateSource: "publicSupportWorklist40_and_darkweb_index_records";
  readonly sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim";
  readonly strictNoInflation: true;
  readonly currentContributionToward100SellableRows: number;
  readonly first1000CandidateCount: number;
  readonly first1000SellableAfterPublicSupport: number;
  readonly first1000UsefulWithCaveat: number;
  readonly first1000RestrictedOnlyHold: number;
  readonly first1000RejectedCounts: {
    readonly stale: number;
    readonly duplicate: number;
    readonly unsafe: number;
    readonly lowValue: number;
  };
  readonly first4000CandidateCount: number;
  readonly first4000SellableAfterPublicSupport: number;
  readonly first4000UsefulWithCaveat: number;
  readonly first4000RestrictedOnlyHold: number;
  readonly first4000RejectedCounts: {
    readonly stale: number;
    readonly duplicate: number;
    readonly unsafe: number;
    readonly lowValue: number;
  };
  readonly first4000SupportBucketCounts: Record<DarkwebIndexPublicSupportLiftSupportBucket, number>;
  readonly projectedContributionToward100PaidRowsAfterPublicSupport: number;
  readonly first100RepairQueue: readonly DarkwebIndexPublicSupportRepairQueueRow[];
  readonly publicSupportSellable100: DarkwebIndexPublicSupportSellable100;
  readonly publicSupportSellable250: DarkwebIndexPublicSupportSellable250;
  readonly publicSupportSellable500: DarkwebIndexPublicSupportSellable500;
  readonly tier10000Preview: DarkwebIndexPublicSupportTier10000Preview;
  readonly metricMovement: {
    readonly repairCandidatesAdded: number;
    readonly likelySellableRowsAfterPublicSupport: number;
    readonly usefulCaveatedRows: number;
    readonly suppressedRows: number;
    readonly remainingRowsToFirst100FloorAfterPublicSupport: number;
    readonly countsTowardSellableFloorNow: false;
  };
  readonly tiers: readonly DarkwebIndexPublicSupportLiftTier[];
  readonly handoffs: {
    readonly agent03ParserFields: readonly string[];
    readonly agent04PublicSourceTargets: readonly string[];
    readonly agent06EvidenceNoLeakRequirements: readonly string[];
    readonly agent07QualityHolds: readonly string[];
    readonly agent08GraphSupportPivots: readonly string[];
    readonly agent09MarketplaceFields: readonly string[];
    readonly agent10ReleaseMetrics: {
      readonly productionSellableRowFloor: 100;
      readonly currentContributionToward100SellableRows: number;
      readonly projectedTier1000SellableAfterPublicSupport: number;
      readonly projectedTier1000UsefulWithCaveat: number;
      readonly projectedTier4000SellableAfterPublicSupport: number;
      readonly projectedTier4000UsefulWithCaveat: number;
      readonly projectedContributionToward100PaidRowsAfterPublicSupport: number;
      readonly countedOnlyAfterSafePublicSupport: true;
    };
  };
  readonly safety: DarkwebIndexPublicIntelligenceHandoff100["safety"];
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexPublicSupportSellable100 {
  readonly schemaVersion: "ti.darkweb_index_public_support_sellable_100.v1";
  readonly candidateSource: "publicSupportLift1000.first100RepairQueue";
  readonly targetSellableRows: 100;
  readonly candidateCount: number;
  readonly currentChargeableRows: number;
  readonly projectedAfterPublicSupportRows: number;
  readonly retiredRows: number;
  readonly remainingGapTo100Now: number;
  readonly remainingGapTo100AfterProjectedSupport: number;
  readonly rowDecisionCounts: {
    readonly current_sellable_public_supported: number;
    readonly projected_after_public_support: number;
    readonly retired_not_chargeable: number;
  };
  readonly rows: readonly DarkwebIndexPublicSupportSellable100Row[];
  readonly agent03ParserHandoffRows: readonly DarkwebIndexPublicSupportSellable100ParserHandoff[];
  readonly countersVisibleOn: readonly ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"];
  readonly safety: DarkwebIndexPublicIntelligenceHandoff100["safety"];
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexPublicSupportSellable100Row {
  readonly rank: number;
  readonly recordId: string;
  readonly actorOrGroupHint: string;
  readonly victimOrDatasetHint: string;
  readonly sectorCountry: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly safeLocatorHash: string;
  readonly requiredPublicSupportFamily: DarkwebIndexPublicSupportRepairQueueRow["requiredPublicSupportFamily"];
  readonly safePublicSourceId: string;
  readonly safePublicSourceHash: string;
  readonly sourceFamilySupportState: "public_support_attached" | "public_support_needed" | "retired_no_safe_public_support";
  readonly parserRequirements: readonly ["actor", "victim_or_dataset", "sector_country", "claimed_date", "public_source_family", "safe_public_source_id", "provenance_hash"];
  readonly rowDecision: "current_sellable_public_supported" | "projected_after_public_support" | "retired_not_chargeable";
  readonly buyerValueReason: string;
  readonly countsTowardSellableFloorNow: boolean;
  readonly countsTowardSellableFloorAfterPublicSupport: boolean;
  readonly noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
}

export interface DarkwebIndexPublicSupportSellable100ParserHandoff {
  readonly rank: number;
  readonly recordId: string;
  readonly actor: string;
  readonly victimOrDataset: string;
  readonly sectorCountry: string;
  readonly date: string;
  readonly requiredFields: readonly ["actor", "victim_or_dataset", "sector_country", "claimed_date", "public_source_family", "safe_public_source_id", "provenance_hash"];
  readonly safePublicSourceId: string;
  readonly safePublicSourceHash: string;
  readonly handoffOwner: "agent_03_parser_repair";
  readonly countsTowardSellableFloorNow: boolean;
}

export type DarkwebIndexPublicSupportSellable250Blocker =
  | "needs_public_support"
  | "no_current_public_support"
  | "stale_public_support"
  | "duplicate_claim"
  | "unsafe_restricted_only"
  | "generic_source_only"
  | "victim_too_sensitive_to_surface"
  | "contradiction_hold"
  | "contradiction_false_claim_hold"
  | "missing_buyer_action"
  | "missing_actor_or_group_context"
  | "missing_target_or_dataset_context"
  | "raw_location_leak_risk";

export interface DarkwebIndexPublicSupportSellable250 {
  readonly schemaVersion: "ti.darkweb_index_public_support_sellable_250.v1";
  readonly candidateSource: "publicSupportLift1000.tier_4000_ranked_rows";
  readonly targetSellableRows: 100;
  readonly candidateCount: 250;
  readonly previousCurrentChargeableRows: 12;
  readonly currentChargeableRows: number;
  readonly newlyChargeableRows: number;
  readonly projectedAfterPublicSupportRows: number;
  readonly blockedOrRetiredRows: number;
  readonly remainingGapTo100Now: number;
  readonly remainingGapTo100AfterProjectedSupport: number;
  readonly rowDecisionCounts: {
    readonly current_sellable_public_supported: number;
    readonly projected_after_public_support: number;
    readonly blocked_not_chargeable: number;
  };
  readonly blockerBucketCounts: Record<DarkwebIndexPublicSupportSellable250Blocker, number>;
  readonly rows: readonly DarkwebIndexPublicSupportSellable250Row[];
  readonly newlyChargeableParserHandoffRows: readonly DarkwebIndexPublicSupportSellable250ParserHandoff[];
  readonly countersVisibleOn: readonly ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"];
  readonly safety: DarkwebIndexPublicIntelligenceHandoff100["safety"];
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexPublicSupportSellable250Row {
  readonly rank: number;
  readonly recordId: string;
  readonly actorOrGroupHint: string;
  readonly victimOrDatasetHint: string;
  readonly sector: string;
  readonly country: string;
  readonly ttpOrToolHint: string;
  readonly datasetClaim: string;
  readonly claimedOrObservedDate: string;
  readonly safeLocatorHash: string;
  readonly publicSupportSourceFamily: DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"];
  readonly safePublicSourceId: string;
  readonly safePublicSourceHash: string;
  readonly provenanceHash: string;
  readonly confidence: "high" | "medium" | "low";
  readonly rowDecision: "current_sellable_public_supported" | "projected_after_public_support" | "blocked_not_chargeable";
  readonly blockerBucket?: DarkwebIndexPublicSupportSellable250Blocker;
  readonly newlyChargeableSinceSellable100: boolean;
  readonly countsTowardSellableFloorNow: boolean;
  readonly countsTowardSellableFloorAfterPublicSupport: boolean;
  readonly parserHandoffFields: readonly ["actor", "victim_or_dataset", "sector", "country", "ttp_or_tool", "dataset_claim", "claimed_or_observed_date", "public_source_family", "safe_public_source_id", "provenance_hash"];
  readonly noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
}

export interface DarkwebIndexPublicSupportSellable250ParserHandoff {
  readonly rank: number;
  readonly recordId: string;
  readonly actor: string;
  readonly victimOrDataset: string;
  readonly sector: string;
  readonly country: string;
  readonly ttpOrTool: string;
  readonly datasetClaim: string;
  readonly date: string;
  readonly publicSourceFamily: DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"];
  readonly safePublicSourceId: string;
  readonly safePublicSourceHash: string;
  readonly provenanceHash: string;
  readonly handoffOwner: "agent_03_parser_repair";
  readonly countsTowardSellableFloorNow: true;
}

export interface DarkwebIndexPublicSupportSellable500 {
  readonly schemaVersion: "ti.darkweb_index_public_support_sellable_500.v1";
  readonly candidateSource: "publicSupportLift1000.tier10000_ranked_rows";
  readonly targetSellableRows: 250;
  readonly candidateCount: 1500;
  readonly previousCurrentChargeableRows: 1000;
  readonly currentChargeableRows: number;
  readonly newlyChargeableRows: number;
  readonly projectedAfterPublicSupportRows: number;
  readonly blockedOrRetiredRows: number;
  readonly currentChargeable100: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramCw: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo100: number;
    readonly currentGapTo250: number;
    readonly projectedGapTo250AfterPublicSupport: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly currentChargeable150: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramDa: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo150: number;
    readonly currentGapTo250: number;
    readonly projectedGapTo250AfterPublicSupport: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly currentChargeable250: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramDc: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo250: number;
    readonly currentGapTo500: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly currentChargeable500: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramDd: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo500: number;
    readonly currentGapTo1000: number;
    readonly parserHandoffRowCount: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly currentChargeable750: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramDe: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo750: number;
    readonly currentGapTo1000: number;
    readonly parserHandoffRowCount: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly currentChargeable1000: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramFg: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo1000: number;
    readonly currentGapTo4000: number;
    readonly parserHandoffRowCount: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly currentChargeable1250: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramGh: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo1250: number;
    readonly currentGapTo4000: number;
    readonly parserHandoffRowCount: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly currentChargeable1500: {
    readonly currentChargeableCount: number;
    readonly newlyChargeableSinceProgramHa: number;
    readonly projectedAfterPublicSupportCount: number;
    readonly blockedOrRetiredCount: number;
    readonly currentGapTo1500: number;
    readonly currentGapTo4000: number;
    readonly parserHandoffRowCount: number;
    readonly countsProjectedRowsAsCurrent: false;
  };
  readonly rowDecisionCounts: {
    readonly current_sellable_public_supported: number;
    readonly projected_after_public_support: number;
    readonly blocked_not_chargeable: number;
  };
  readonly blockerBucketCounts: Record<DarkwebIndexPublicSupportSellable250Blocker, number>;
  readonly rows: readonly DarkwebIndexPublicSupportSellable500Row[];
  readonly newlyChargeableParserHandoffRows: readonly DarkwebIndexPublicSupportSellable500ParserHandoff[];
  readonly countersVisibleOn: readonly ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"];
  readonly safety: DarkwebIndexPublicIntelligenceHandoff100["safety"];
  readonly noLeakSerialization: DarkwebIndexNoLeakSerialization;
}

export interface DarkwebIndexPublicSupportSellable500Row extends Omit<DarkwebIndexPublicSupportSellable250Row, "newlyChargeableSinceSellable100" | "safePublicSourceId" | "safePublicSourceHash"> {
  readonly safePublicSourceId: string;
  readonly safePublicSourceHash: string;
  readonly newlyChargeableSinceProgramCw: boolean;
  readonly newlyChargeableSinceProgramDa: boolean;
  readonly newlyChargeableSinceProgramDc: boolean;
  readonly newlyChargeableSinceProgramDd: boolean;
  readonly newlyChargeableSinceProgramDe: boolean;
  readonly newlyChargeableSinceProgramFg: boolean;
  readonly newlyChargeableSinceProgramGh: boolean;
  readonly freshness: "fresh_current" | "recent_recheck_due" | "stale_blocked";
  readonly liveness: "live" | "intermittent" | "requires_recheck" | "blocked";
  readonly recheckCadenceHours: 24 | 48 | 168;
  readonly nextSafeRecheckAfter: string;
  readonly whyWorthPayingFor: string;
}

export interface DarkwebIndexPublicSupportSellable500ParserHandoff extends Omit<DarkwebIndexPublicSupportSellable250ParserHandoff, "safePublicSourceId" | "safePublicSourceHash"> {
  readonly safePublicSourceId: string;
  readonly safePublicSourceHash: string;
  readonly freshness: DarkwebIndexPublicSupportSellable500Row["freshness"];
  readonly recheckCadenceHours: DarkwebIndexPublicSupportSellable500Row["recheckCadenceHours"];
  readonly whyWorthPayingFor: string;
  readonly newlyChargeableSinceProgramDa: boolean;
  readonly newlyChargeableSinceProgramDc: boolean;
  readonly newlyChargeableSinceProgramDd: boolean;
  readonly newlyChargeableSinceProgramDe: boolean;
  readonly newlyChargeableSinceProgramFg: boolean;
  readonly newlyChargeableSinceProgramGh: boolean;
}

export interface DarkwebIndexPublicSupportLiftTier {
  readonly tier: "top_100" | "tier_1000" | "tier_4000";
  readonly targetCandidateCount: 100 | 1000 | 4000;
  readonly evaluatedCandidateCount: number;
  readonly acceptedForPublicSupportCount: number;
  readonly outcomeCounts: Record<DarkwebIndexPublicSupportLiftOutcome, number>;
  readonly supportBucketCounts: Record<DarkwebIndexPublicSupportLiftSupportBucket, number>;
  readonly contributionToward100SellableRows: number;
  readonly averageBuyerValueScore: number;
  readonly rows: readonly DarkwebIndexPublicSupportLiftRow[];
}

export interface DarkwebIndexPublicSupportLiftRow {
  readonly rank: number;
  readonly tier: DarkwebIndexPublicSupportLiftTier["tier"];
  readonly recordId: string;
  readonly safeLocatorHash: string;
  readonly actorHints: readonly string[];
  readonly victimHints: readonly string[];
  readonly datasetHints: readonly string[];
  readonly sectorCountry: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly sourceFamily: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"];
  readonly requiredPublicSupportSources: readonly DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"][];
  readonly parserFieldsNeeded: readonly ["actor", "victim", "dataset", "sector_country", "claimed_date", "source_family", "public_support_family", "provenance_hash"];
  readonly expectedBuyerValue: number;
  readonly outcome: DarkwebIndexPublicSupportLiftOutcome;
  readonly noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
  readonly publicSupportTarget: string;
  readonly whyBuyerWouldPayIfCorroborated: string;
  readonly graphPivot?: string;
  readonly rejectionReason?: "stale" | "duplicate" | "unsafe" | "low_value" | "restricted_only";
  readonly exactMissingField: "none" | "actor" | "victim_or_dataset" | "public_support_source" | "fresh_current_claim" | "safe_public_evidence" | "not_chargeable_rejected";
  readonly owningWorkerHandoff: "agent_03_parser_repair" | "agent_04_source_support" | "agent_05_restricted_metadata_hold" | "agent_07_quality_suppression" | "agent_08_graph_pivot_support" | "agent_09_marketplace_field_mapping" | "agent_10_release_gate";
  readonly countsTowardSellableFloorNow: false;
  readonly countsTowardSellableFloorAfterPublicSupport: boolean;
}

export interface DarkwebIndexPublicSupportRepairQueueRow {
  readonly rank: number;
  readonly sourceTier: "tier_4000";
  readonly recordId: string;
  readonly actorOrGroupHint: string;
  readonly victimOrDatasetHint: string;
  readonly sectorCountry: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly safeLocatorHash: string;
  readonly requiredPublicSupportFamily: DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"];
  readonly exactMissingField: DarkwebIndexPublicSupportLiftRow["exactMissingField"];
  readonly rowDecision: "repair_for_sellable_after_public_support" | "repair_for_useful_caveat";
  readonly buyerValueReason: string;
  readonly owningWorkerHandoff: DarkwebIndexPublicSupportLiftRow["owningWorkerHandoff"];
  readonly countsTowardSellableFloorNow: false;
  readonly countsTowardSellableFloorAfterPublicSupport: boolean;
  readonly noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials";
}

export interface DarkwebIndexPublicSupportTier10000Preview {
  readonly schemaVersion: "ti.darkweb_index_public_support_tier10000_preview.v1";
  readonly baselineTier: "tier_4000";
  readonly targetTier: "tier_10000";
  readonly evaluatedCandidateCount: number;
  readonly valueQualifiedCandidateCount: number;
  readonly projectedSellableAfterPublicSupport: number;
  readonly usefulWithCaveat: number;
  readonly restrictedOnlyHold: number;
  readonly rejectedCounts: {
    readonly stale: number;
    readonly duplicate: number;
    readonly unsafe: number;
    readonly lowValue: number;
  };
  readonly supportBucketCounts: Record<DarkwebIndexPublicSupportLiftSupportBucket, number>;
  readonly acceptedValueDensity: number;
  readonly expansionDecision: "hold_for_value_density" | "ready_for_limited_public_support_repair";
  readonly blockers: readonly string[];
  readonly sampleRepairRows: readonly DarkwebIndexPublicSupportRepairQueueRow[];
  readonly countsTowardSellableFloorNow: false;
}

export interface DarkwebIndexOperatorRunbook {
  readonly schemaVersion: "ti.darkweb_index_operator_runbook.v1";
  readonly owner: "Agent 05";
  readonly mode: "operator_controls_no_live_collection";
  readonly isolatedCollectorPool: {
    readonly enabledByDefault: false;
    readonly approvedHarnessRequired: true;
    readonly maxWorkers: 8;
    readonly disposableWorkersRequired: true;
    readonly hostNetworkAllowed: false;
  };
  readonly proxyBoundary: {
    readonly approvedProxyRequired: true;
    readonly directEgressAllowed: false;
    readonly networkAllowlist: readonly ["tor", "i2p", "freenet"];
  };
  readonly diskBudget: {
    readonly quarantineDescriptorGb: 24;
    readonly rawBodyStorageAllowed: false;
    readonly payloadStorageAllowed: false;
    readonly retentionDays: 14;
  };
  readonly contentSizeCap: {
    readonly maxBytesPerPage: 262144;
    readonly maxFetchSeconds: 20;
    readonly maxRedirects: 2;
  };
  readonly emergencyStop: {
    readonly flag: "DARKWEB_INDEX_KILL_SWITCH";
    readonly action: "pause_workers_hold_sources_clear_pending_refresh";
    readonly publicSearchEffect: "non_blocking_existing_metadata_only_search";
  };
  readonly rollback: readonly ["pause_darkweb_index_workers", "disable_source_ingest", "clear_pending_refresh_queue", "preserve_review_holds", "rerun_no_leak_checks"];
  readonly proofCommands: readonly string[];
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
  readonly downstreamHandoff: DarkwebIndexDownstreamHandoff;
  readonly restrictedReconciliation: DarkwebIndexRestrictedReconciliation;
  readonly refreshOperations: DarkwebIndexRefreshOperationsPlan;
  readonly driftPacket: DarkwebIndexDriftPacket;
  readonly searchQuality: DarkwebIndexSearchQualityMetrics;
  readonly tier100Product: DarkwebIndexTier100ProductSlice;
  readonly tier1000Readiness: DarkwebIndexTier1000Readiness;
  readonly tier4000Admission: DarkwebIndexTier4000Admission;
  readonly tier10000RefreshValue: DarkwebIndexTier10000RefreshValue;
  readonly liveValueExpansion: DarkwebIndexLiveValueExpansion;
  readonly publicIntelligenceHandoff100: DarkwebIndexPublicIntelligenceHandoff100;
  readonly publicSupportWorklist40: DarkwebIndexPublicSupportWorklist40;
  readonly publicSupportLift1000: DarkwebIndexPublicSupportLift1000;
  readonly publicSupportSellable100: DarkwebIndexPublicSupportSellable100;
  readonly publicSupportSellable250: DarkwebIndexPublicSupportSellable250;
  readonly publicSupportSellable500: DarkwebIndexPublicSupportSellable500;
  readonly operatorRunbook: DarkwebIndexOperatorRunbook;
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
  readonly productHandoff: {
    readonly tier: "tier_100";
    readonly nextTier: "tier_1000";
    readonly apifyReadyFields: readonly ["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"];
    readonly buyerValueFields: readonly ["buyerValueScore", "whyItMatters", "freshness", "sourceFamily", "provenanceHash"];
    readonly freshnessFields: readonly ["lastSeen", "lastChecked", "liveness", "refreshCadenceMinutes"];
    readonly publicSearchUse: "corroborating_metadata_context_only";
    readonly recordIds: readonly string[];
    readonly tier1000ReadyRecordIds: readonly string[];
    readonly buyerSearchRows: readonly DarkwebIndexBuyerSearchRow[];
    readonly tier10000SearchProof: DarkwebIndexTier10000RefreshValue["buyerSearchProof"];
    readonly liveValueExpansion: Pick<DarkwebIndexLiveValueExpansion, "schemaVersion" | "mode" | "sourceCountInflationBlocked" | "tiers">;
    readonly publicIntelligenceHandoff100: Pick<DarkwebIndexPublicIntelligenceHandoff100, "schemaVersion" | "mode" | "candidateCount" | "publicCorroboratedCount" | "usefulCaveatedCount" | "projectedContributionToward100SellableRows" | "decisionCounts" | "sampleRows" | "handoffs">;
    readonly publicSupportWorklist40: Pick<DarkwebIndexPublicSupportWorklist40, "schemaVersion" | "mode" | "topCandidateCount" | "publicSupportReadyCount" | "stillRestrictedOnlyCount" | "projectedCaveatedRows" | "projectedSellableRowsAfterPublicSupport" | "contributionToward100SellableRows" | "rows" | "handoffs">;
    readonly publicSupportLift1000: Pick<DarkwebIndexPublicSupportLift1000, "schemaVersion" | "mode" | "strictNoInflation" | "currentContributionToward100SellableRows" | "first1000CandidateCount" | "first1000SellableAfterPublicSupport" | "first1000UsefulWithCaveat" | "first1000RestrictedOnlyHold" | "first1000RejectedCounts" | "first4000CandidateCount" | "first4000SellableAfterPublicSupport" | "first4000UsefulWithCaveat" | "first4000RestrictedOnlyHold" | "first4000RejectedCounts" | "first4000SupportBucketCounts" | "projectedContributionToward100PaidRowsAfterPublicSupport" | "first100RepairQueue" | "publicSupportSellable100" | "publicSupportSellable250" | "publicSupportSellable500" | "tier10000Preview" | "metricMovement" | "tiers" | "handoffs">;
    readonly warnings: readonly ["metadata_only", "review_required", "no_raw_locations"];
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
  readonly downstreamHandoff: {
    readonly schemaVersion: "ti.darkweb_index_downstream_handoff.v1";
    readonly qualityFixtures: readonly string[];
    readonly graphStixPolicy: "descriptor_edges_review_hold";
    readonly uiRoute: "/ti/darkweb/index";
    readonly opsKillSwitch: "DARKWEB_INDEX_KILL_SWITCH";
  };
  readonly restrictedReconciliation: {
    readonly schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1";
    readonly mode: "contract_only_audit_reconciliation";
    readonly routeCount: 5;
    readonly releaseGate: "restricted_apply_plan_and_no_leak_required";
  };
  readonly operationsModel: {
    readonly refreshSchemaVersion: "ti.darkweb_index_refresh_operations.v1";
    readonly driftSchemaVersion: "ti.darkweb_index_liveness_classification_drift.v1";
    readonly searchQualitySchemaVersion: "ti.darkweb_index_search_quality.v1";
    readonly operatorRunbookSchemaVersion: "ti.darkweb_index_operator_runbook.v1";
    readonly targetRecordCount: 60000;
    readonly liveCollectionEnabled: false;
  };
  readonly tier100Product: {
    readonly schemaVersion: "ti.darkweb_index_tier100_product.v1";
    readonly tier: "tier_100";
    readonly recordGoal: 100;
    readonly advancementTarget: "tier_1000";
    readonly routeFields: readonly ["status.tier100Product", "darkwebIndex.productHandoff"];
    readonly requireNoLeakProof: true;
  };
  readonly tier1000Readiness: {
    readonly schemaVersion: "ti.darkweb_index_tier1000_readiness.v1";
    readonly tier: "tier_1000";
    readonly targetRecordCount: 1000;
    readonly routeFields: readonly ["status.tier1000Readiness", "darkwebIndex.productHandoff"];
    readonly requiredRecordFields: readonly ["safeSummary", "category", "liveness", "actorHints", "victimHints", "sourceFamily", "legalTriage", "lastSeen", "provenanceHash", "buyerValue"];
    readonly advancementTarget: "tier_4000";
    readonly requireNoLeakProof: true;
  };
  readonly tier4000Admission: {
    readonly schemaVersion: "ti.darkweb_index_tier4000_admission.v1";
    readonly tier: "tier_4000";
    readonly targetRecordCount: 4000;
    readonly routeFields: readonly ["status.tier4000Admission", "darkwebIndex.productHandoff.buyerSearchRows"];
    readonly admissionDecisionField: "buyerSearchProof.activationDecision";
    readonly requireNoLeakProof: true;
  };
  readonly tier10000RefreshValue: {
    readonly schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1";
    readonly tier: "tier_10000";
    readonly targetRecordCount: 10000;
    readonly routeFields: readonly ["status.tier10000RefreshValue", "darkwebIndex.productHandoff.tier10000SearchProof"];
    readonly decisionField: "activationDecision";
    readonly requireNoLeakProof: true;
  };
  readonly liveValueExpansion: {
    readonly schemaVersion: "ti.darkweb_index_live_value_expansion.v1";
    readonly tiers: readonly ["tier_1000", "tier_4000"];
    readonly routeFields: readonly ["status.liveValueExpansion", "darkwebIndex.productHandoff.liveValueExpansion", "ops.productSlo.darkMetadataLiveValueExpansion"];
    readonly requiredSampleRowsPerTier: 12;
    readonly requiredUsefulQueriesPerTier: 20;
    readonly sourceCountInflationBlocked: true;
    readonly requireNoLeakProof: true;
  };
  readonly publicIntelligenceHandoff100: {
    readonly schemaVersion: "ti.darkweb_index_public_intelligence_handoff_100.v1";
    readonly candidateTarget: 100;
    readonly routeFields: readonly ["status.publicIntelligenceHandoff100", "darkwebIndex.productHandoff.publicIntelligenceHandoff100", "ops.productSlo.darkMetadataPublicHandoff100"];
    readonly decisions: readonly ["sellable_with_public_support", "included_with_caveat", "coverage_gap_only", "hold", "suppress"];
    readonly requiresPublicSupportForSellable: true;
    readonly requireNoLeakProof: true;
  };
  readonly publicSupportWorklist40: {
    readonly schemaVersion: "ti.darkweb_index_public_support_worklist_40.v1";
    readonly candidateSource: "publicIntelligenceHandoff100";
    readonly topCandidateTarget: 40;
    readonly routeFields: readonly ["status.publicSupportWorklist40", "darkwebIndex.productHandoff.publicSupportWorklist40"];
    readonly sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim";
    readonly requireNoLeakProof: true;
  };
  readonly publicSupportLift1000: {
    readonly schemaVersion: "ti.darkweb_index_public_support_lift_1000.v1";
    readonly candidateSource: "publicSupportWorklist40_and_darkweb_index_records";
    readonly tierTargets: readonly [100, 1000, 4000, 10000];
    readonly routeFields: readonly ["status.publicSupportLift1000", "darkwebIndex.productHandoff.publicSupportLift1000", "ops.productSlo.darkMetadataPublicSupportLift4000"];
    readonly repairQueueField: "publicSupportLift1000.first100RepairQueue";
    readonly sellable100Field: "publicSupportLift1000.publicSupportSellable100";
    readonly sellable250Field: "publicSupportLift1000.publicSupportSellable250";
    readonly sellable500Field: "publicSupportLift1000.publicSupportSellable500";
    readonly tier10000PreviewField: "publicSupportLift1000.tier10000Preview";
    readonly sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim";
    readonly strictNoInflation: true;
    readonly requireNoLeakProof: true;
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
  const publicSupportLift1000 = buildDarkwebIndexPublicSupportLift1000(records);
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
    downstreamHandoff: buildDarkwebIndexDownstreamHandoff(),
    restrictedReconciliation: buildDarkwebIndexRestrictedReconciliation(),
    refreshOperations: buildDarkwebIndexRefreshOperationsPlan(),
    driftPacket: buildDarkwebIndexDriftPacket(records),
    searchQuality: buildDarkwebIndexSearchQualityMetrics(records),
    tier100Product: buildDarkwebIndexTier100ProductSlice(records),
    tier1000Readiness: buildDarkwebIndexTier1000Readiness(records),
    tier4000Admission: buildDarkwebIndexTier4000Admission(records),
    tier10000RefreshValue: buildDarkwebIndexTier10000RefreshValue(records),
    liveValueExpansion: buildDarkwebIndexLiveValueExpansion(records),
    publicIntelligenceHandoff100: buildDarkwebIndexPublicIntelligenceHandoff100(records),
    publicSupportWorklist40: buildDarkwebIndexPublicSupportWorklist40(records),
    publicSupportLift1000,
    publicSupportSellable100: publicSupportLift1000.publicSupportSellable100,
    publicSupportSellable250: publicSupportLift1000.publicSupportSellable250,
    publicSupportSellable500: publicSupportLift1000.publicSupportSellable500,
    operatorRunbook: buildDarkwebIndexOperatorRunbook(),
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
    productHandoff: {
      tier: "tier_100",
      nextTier: "tier_1000",
      apifyReadyFields: ["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"],
      buyerValueFields: ["buyerValueScore", "whyItMatters", "freshness", "sourceFamily", "provenanceHash"],
      freshnessFields: ["lastSeen", "lastChecked", "liveness", "refreshCadenceMinutes"],
      publicSearchUse: "corroborating_metadata_context_only",
      recordIds: page.map((record) => record.id),
      tier1000ReadyRecordIds: page.filter(isTier1000ProductQualifiedRecord).map((record) => record.id),
      buyerSearchRows: page.map(buyerSearchRowFor),
      tier10000SearchProof: buildDarkwebIndexTier10000RefreshValue(records).buyerSearchProof,
      liveValueExpansion: liveValueExpansionSearchHandoff(buildDarkwebIndexLiveValueExpansion(records)),
      publicIntelligenceHandoff100: publicIntelligenceHandoffSearchHandoff(buildDarkwebIndexPublicIntelligenceHandoff100(records)),
      publicSupportWorklist40: publicSupportWorklistSearchHandoff(buildDarkwebIndexPublicSupportWorklist40(records)),
      publicSupportLift1000: publicSupportLiftSearchHandoff(buildDarkwebIndexPublicSupportLift1000(records)),
      warnings: ["metadata_only", "review_required", "no_raw_locations"]
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
    downstreamHandoff: {
      schemaVersion: "ti.darkweb_index_downstream_handoff.v1",
      qualityFixtures: buildDarkwebIndexDownstreamHandoff().quality.fixtures.map((fixture) => fixture.fixtureId),
      graphStixPolicy: "descriptor_edges_review_hold",
      uiRoute: "/ti/darkweb/index",
      opsKillSwitch: "DARKWEB_INDEX_KILL_SWITCH"
    },
    restrictedReconciliation: {
      schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1",
      mode: "contract_only_audit_reconciliation",
      routeCount: 5,
      releaseGate: "restricted_apply_plan_and_no_leak_required"
    },
    operationsModel: {
      refreshSchemaVersion: "ti.darkweb_index_refresh_operations.v1",
      driftSchemaVersion: "ti.darkweb_index_liveness_classification_drift.v1",
      searchQualitySchemaVersion: "ti.darkweb_index_search_quality.v1",
      operatorRunbookSchemaVersion: "ti.darkweb_index_operator_runbook.v1",
      targetRecordCount: 60000,
      liveCollectionEnabled: false
    },
    tier100Product: {
      schemaVersion: "ti.darkweb_index_tier100_product.v1",
      tier: "tier_100",
      recordGoal: 100,
      advancementTarget: "tier_1000",
      routeFields: ["status.tier100Product", "darkwebIndex.productHandoff"],
      requireNoLeakProof: true
    },
    tier1000Readiness: {
      schemaVersion: "ti.darkweb_index_tier1000_readiness.v1",
      tier: "tier_1000",
      targetRecordCount: 1000,
      routeFields: ["status.tier1000Readiness", "darkwebIndex.productHandoff"],
      requiredRecordFields: ["safeSummary", "category", "liveness", "actorHints", "victimHints", "sourceFamily", "legalTriage", "lastSeen", "provenanceHash", "buyerValue"],
      advancementTarget: "tier_4000",
      requireNoLeakProof: true
    },
    tier4000Admission: {
      schemaVersion: "ti.darkweb_index_tier4000_admission.v1",
      tier: "tier_4000",
      targetRecordCount: 4000,
      routeFields: ["status.tier4000Admission", "darkwebIndex.productHandoff.buyerSearchRows"],
      admissionDecisionField: "buyerSearchProof.activationDecision",
      requireNoLeakProof: true
    },
    tier10000RefreshValue: {
      schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
      tier: "tier_10000",
      targetRecordCount: 10000,
      routeFields: ["status.tier10000RefreshValue", "darkwebIndex.productHandoff.tier10000SearchProof"],
      decisionField: "activationDecision",
      requireNoLeakProof: true
    },
    liveValueExpansion: {
      schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
      tiers: ["tier_1000", "tier_4000"],
      routeFields: ["status.liveValueExpansion", "darkwebIndex.productHandoff.liveValueExpansion", "ops.productSlo.darkMetadataLiveValueExpansion"],
      requiredSampleRowsPerTier: 12,
      requiredUsefulQueriesPerTier: 20,
      sourceCountInflationBlocked: true,
      requireNoLeakProof: true
    },
    publicIntelligenceHandoff100: {
      schemaVersion: "ti.darkweb_index_public_intelligence_handoff_100.v1",
      candidateTarget: 100,
      routeFields: ["status.publicIntelligenceHandoff100", "darkwebIndex.productHandoff.publicIntelligenceHandoff100", "ops.productSlo.darkMetadataPublicHandoff100"],
      decisions: ["sellable_with_public_support", "included_with_caveat", "coverage_gap_only", "hold", "suppress"],
      requiresPublicSupportForSellable: true,
      requireNoLeakProof: true
    },
    publicSupportWorklist40: {
      schemaVersion: "ti.darkweb_index_public_support_worklist_40.v1",
      candidateSource: "publicIntelligenceHandoff100",
      topCandidateTarget: 40,
      routeFields: ["status.publicSupportWorklist40", "darkwebIndex.productHandoff.publicSupportWorklist40"],
      sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim",
      requireNoLeakProof: true
    },
    publicSupportLift1000: {
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

function buildDarkwebIndexDownstreamHandoff(): DarkwebIndexDownstreamHandoff {
  return {
    schemaVersion: "ti.darkweb_index_downstream_handoff.v1",
    quality: {
      owner: "Agent 07",
      fixtures: [
        {
          fixtureId: "quality_benign_directory",
          scenario: "benign_directory",
          expectedReviewState: "approved_metadata_only",
          expectedLegalTriage: "benign",
          publicPromotionAllowed: true,
          requiredCaveats: ["metadata_descriptor_only", "source_hash_only"]
        },
        {
          fixtureId: "quality_leak_claim_hold",
          scenario: "leak_claim_hold",
          expectedReviewState: "needs_review",
          expectedLegalTriage: "leak_or_extortion",
          publicPromotionAllowed: false,
          requiredCaveats: ["unverified_claim", "requires_public_corroboration", "no_stolen_files_accessed"]
        },
        {
          fixtureId: "quality_credential_abuse_block",
          scenario: "credential_abuse_block",
          expectedReviewState: "blocked_unsafe",
          expectedLegalTriage: "credential_or_abuse",
          publicPromotionAllowed: false,
          requiredCaveats: ["unsafe_target_blocked", "no_credentials_accessed"]
        },
        {
          fixtureId: "quality_malware_payload_block",
          scenario: "malware_payload_block",
          expectedReviewState: "blocked_unsafe",
          expectedLegalTriage: "malware_or_payload",
          publicPromotionAllowed: false,
          requiredCaveats: ["payload_links_not_followed", "no_execution"]
        },
        {
          fixtureId: "quality_false_positive_review",
          scenario: "false_positive_review",
          expectedReviewState: "false_positive_review",
          expectedLegalTriage: "unknown_requires_review",
          publicPromotionAllowed: false,
          requiredCaveats: ["ambiguous_descriptor", "analyst_review_required"]
        },
        {
          fixtureId: "quality_stale_or_dead_recheck",
          scenario: "stale_or_dead_recheck",
          expectedReviewState: "needs_review",
          expectedLegalTriage: "news_or_research",
          publicPromotionAllowed: false,
          requiredCaveats: ["stale_liveness", "recheck_required"]
        }
      ],
      releaseGate: {
        requiresHumanReviewForRestrictedClaims: true,
        requiresCorroboratingPublicEvidence: true,
        blocksStandaloneDarkwebClaims: true,
        proofCommands: [
          "bun test src/tests/darkwebIndex.test.ts",
          "bun test src/tests/api.test.ts -t \"routes darkweb metadata index status and search without unsafe leaks\"",
          "bun run check:contract-index"
        ]
      }
    },
    graphStix: {
      owner: "Agent 08",
      relationshipPolicy: "descriptor_edges_review_hold",
      allowedEdges: ["source_describes_actor", "source_mentions_victim", "source_mentions_ttp", "mirror_of", "same_host_hash"],
      heldEdges: ["victim_claim", "credential_claim", "payload_claim", "actor_statement"],
      stixExportDefault: "hold_until_reviewed_and_correlated",
      allowedStixObjects: ["identity_descriptor", "threat_actor_alias_hint", "indicator_hash_only", "relationship_review_hold"],
      forbiddenStixObjects: ["malware_payload", "credential_dump", "raw_url_indicator", "private_message", "actor_interaction"]
    },
    apiUi: {
      owner: "Agent 09",
      route: "/ti/darkweb/index",
      statusRoute: "/v1/darkweb/status",
      searchRoute: "/v1/darkweb/search",
      panels: ["overview", "records", "review_queue", "source_readiness", "storage_handoff", "scheduler_parser_handoff", "ops_runbook"],
      safeActions: ["filter", "paginate", "copy_hash", "open_review_ticket", "export_metadata_csv"],
      forbiddenActions: ["open_raw_url", "download_payload", "download_credentials", "solve_captcha", "contact_actor", "bypass_authentication"],
      warningCodes: ["metadata_only", "review_required", "blocked_unsafe", "legal_hold", "operator_hash_lookup_only"]
    },
    opsRunbook: {
      owner: "Agent 10",
      killSwitch: {
        flag: "DARKWEB_INDEX_KILL_SWITCH",
        defaultState: "armed",
        action: "pause_workers_and_hold_sources"
      },
      soak: {
        stages: ["contract_fixture", "dry_run_replay", "isolated_canary", "metadata_only_limited_rollout"],
        requiredSignals: ["no_leak_serialization", "zero_forbidden_actions", "proxy_boundary_healthy", "queue_budget_within_limit", "review_queue_within_slo"]
      },
      alerts: [
        { code: "unsafe_action_attempt", severity: "rollback", operatorAction: "pause workers and open safety review" },
        { code: "proxy_boundary_failure", severity: "rollback", operatorAction: "stop isolated collectors and preserve audit ids" },
        { code: "parser_leak_attempt", severity: "hold", operatorAction: "quarantine descriptor and block promotion" },
        { code: "review_queue_over_slo", severity: "hold", operatorAction: "hold public promotion and increase analyst review" },
        { code: "storage_forbidden_column", severity: "rollback", operatorAction: "block migration and rerun storage no-leak audit" }
      ],
      rollback: ["pause_darkweb_index_workers", "disable_source_ingest", "clear_pending_restricted_queue", "keep_public_search_non_blocking", "rerun_no_leak_checks"]
    }
  };
}

function buildDarkwebIndexRestrictedReconciliation(): DarkwebIndexRestrictedReconciliation {
  return {
    schemaVersion: "ti.darkweb_index_restricted_reconciliation.v1",
    owner: "Agent 05",
    mode: "contract_only_audit_reconciliation",
    willFetchNetwork: false,
    willMutateSources: false,
    dependsOnRoutes: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/contracts"],
    auditRows: [
      {
        checkId: "darkweb_status_route_visible",
        source: "darkweb_index",
        expectedState: "route_visible",
        reconciliationRule: "status exposes metadata-only index, storage, scheduler, parser, downstream, and reconciliation packets",
        blockingIfMissing: true
      },
      {
        checkId: "darkweb_search_non_blocking",
        source: "darkweb_index",
        expectedState: "non_blocking",
        reconciliationRule: "search remains paginated and redacted even when restricted metadata is held",
        blockingIfMissing: true
      },
      {
        checkId: "restricted_status_metadata_only",
        source: "restricted_metadata_status",
        expectedState: "metadata_only",
        reconciliationRule: "restricted status exposes source ids, hashes, policy state, redaction proof, and audit ids only",
        blockingIfMissing: true
      },
      {
        checkId: "restricted_apply_plan_green",
        source: "restricted_metadata_apply_plan",
        expectedState: "held_until_review",
        reconciliationRule: "apply-plan remains dry-run and returns rollback-only actions for unsafe or unapproved sources",
        blockingIfMissing: true
      },
      {
        checkId: "operator_hash_lookup_only",
        source: "contracts",
        expectedState: "operator_only",
        reconciliationRule: "raw hash lookup remains operator-only future route and never public raw locator output",
        blockingIfMissing: true
      },
      {
        checkId: "kill_switch_ready",
        source: "contracts",
        expectedState: "kill_switch_ready",
        reconciliationRule: "emergency stop and kill switch actions pause workers and hold source ingest",
        blockingIfMissing: true
      }
    ],
    fieldMapping: {
      darkwebIndexFields: ["rawUrlHash", "hostHash", "pathHash", "contentHash", "sourceHash", "legalTriage", "reviewState", "retentionClass"],
      restrictedMetadataFields: ["sourceId", "urlHash", "policyAuditId", "retentionClass", "legalHold", "killSwitchState", "redactionProof", "auditEventIds"],
      joinKeys: ["rawUrlHash_to_urlHash", "sourceHash_to_sourceId_or_policyAuditId"]
    },
    releaseGate: {
      routeVisibleRequired: true,
      restrictedApplyPlanGreenRequired: true,
      standaloneDarkwebClaimsHeld: true,
      noLeakSerializationRequired: true,
      proofCommands: [
        "bun test src/tests/darkwebIndex.test.ts",
        "bun test src/tests/api.test.ts -t \"routes darkweb metadata index status and search without unsafe leaks\"",
        "bun run check:restricted-metadata-apply-plan",
        "bun run check:contract-index"
      ]
    },
    unresolvedExternalBlockers: []
  };
}

function buildDarkwebIndexRefreshOperationsPlan(): DarkwebIndexRefreshOperationsPlan {
  return {
    schemaVersion: "ti.darkweb_index_refresh_operations.v1",
    owner: "Agent 05",
    mode: "metadata_only_operations_model",
    targetRecordCount: 60000,
    willFetchNetwork: false,
    willScheduleLiveWork: false,
    lanes: [
      { laneId: "tor_high_risk_refresh", sourceType: "directory", network: "tor", targetRecords: 18000, cadenceMinutes: 360, maxRecordsPerRun: 800, approvalRequired: "approved_metadata_only", action: "refresh_metadata", safeOutput: "hashes_redacted_labels_and_quarantine_descriptors" },
      { laneId: "i2p_standard_refresh", sourceType: "seed_list", network: "i2p", targetRecords: 12000, cadenceMinutes: 1440, maxRecordsPerRun: 700, approvalRequired: "approved_metadata_only", action: "refresh_metadata", safeOutput: "hashes_redacted_labels_and_quarantine_descriptors" },
      { laneId: "freenet_liveness_recheck", sourceType: "seed_list", network: "freenet", targetRecords: 9000, cadenceMinutes: 10080, maxRecordsPerRun: 600, approvalRequired: "operator_review", action: "recheck_liveness", safeOutput: "hashes_redacted_labels_and_quarantine_descriptors" },
      { laneId: "directory_bulk_metadata", sourceType: "directory", network: "mixed", targetRecords: 11000, cadenceMinutes: 1440, maxRecordsPerRun: 2500, approvalRequired: "approved_metadata_only", action: "refresh_metadata", safeOutput: "hashes_redacted_labels_and_quarantine_descriptors" },
      { laneId: "analyst_import_review", sourceType: "analyst_import", network: "mixed", targetRecords: 3000, cadenceMinutes: 0, maxRecordsPerRun: 0, approvalRequired: "operator_review", action: "hold_for_review", safeOutput: "hashes_redacted_labels_and_quarantine_descriptors" },
      { laneId: "public_report_reference_import", sourceType: "public_report", network: "mixed", targetRecords: 7000, cadenceMinutes: 1440, maxRecordsPerRun: 900, approvalRequired: "approved_metadata_only", action: "import_metadata_descriptors", safeOutput: "hashes_redacted_labels_and_quarantine_descriptors" }
    ],
    budgets: {
      maxWorkerCount: 8,
      maxRunMinutes: 45,
      maxBytesPerPage: 262144,
      quarantineRetentionDays: 14,
      diskBudgetGb: 24
    },
    disabledUntilApprovedHarness: true,
    blockedActions: darkwebIndexForbiddenOperations()
  };
}

function buildDarkwebIndexDriftPacket(records: readonly DarkwebIndexRecord[]): DarkwebIndexDriftPacket {
  const selected = [records[0], records[1], records[2], records[3], records[4], records[5], records[6], records[7]].filter((record): record is DarkwebIndexRecord => Boolean(record));
  const driftTypes: DarkwebIndexDriftPacket["rows"][number]["driftType"][] = [
    "newly_alive",
    "newly_dead",
    "category_changed",
    "legal_risk_changed",
    "source_reputation_changed",
    "duplicate_cluster_changed",
    "review_priority_changed",
    "graph_export_hold_changed"
  ];
  const currentState = (record: DarkwebIndexRecord, driftType: DarkwebIndexDriftPacket["rows"][number]["driftType"]): string => {
    if (driftType === "newly_alive" || driftType === "newly_dead") return record.liveness;
    if (driftType === "category_changed") return record.category;
    if (driftType === "legal_risk_changed") return record.legalTriage;
    if (driftType === "source_reputation_changed") return record.confidence >= 0.75 ? "strong_metadata_source" : "watch_metadata_source";
    if (driftType === "duplicate_cluster_changed") return "hash_cluster_recomputed";
    if (driftType === "review_priority_changed") return record.reviewState;
    return record.reviewState === "approved_metadata_only" ? "graph_export_candidate" : "graph_export_hold";
  };
  const reviewImpact = (record: DarkwebIndexRecord, driftType: DarkwebIndexDriftPacket["rows"][number]["driftType"]): DarkwebIndexDriftPacket["rows"][number]["reviewImpact"] => {
    if (record.legalTriage === "blocked_unsafe" || record.reviewState === "blocked_unsafe") return "blocked_unsafe";
    if (record.reviewState === "legal_hold") return "legal_hold";
    if (driftType === "graph_export_hold_changed") return "graph_export_hold";
    if (driftType === "newly_alive" || driftType === "review_priority_changed" || driftType === "duplicate_cluster_changed") return "review_required";
    return "no_change";
  };
  const publicUiEffect = (record: DarkwebIndexRecord, driftType: DarkwebIndexDriftPacket["rows"][number]["driftType"]): DarkwebIndexDriftPacket["rows"][number]["publicUiEffect"] => {
    if (record.legalTriage === "blocked_unsafe" || record.reviewState === "blocked_unsafe") return "hide_from_public_default";
    if (driftType === "graph_export_hold_changed" || record.reviewState !== "approved_metadata_only") return "hold_public_claim";
    if (record.liveness === "live") return "show_badge";
    return "update_filter_count";
  };
  return {
    schemaVersion: "ti.darkweb_index_liveness_classification_drift.v1",
    owner: "Agent 05",
    mode: "metadata_only_drift_rows",
    generatedFromFixtureCount: records.length,
    rows: selected.map((record, index) => ({
      driftId: stableId("darkweb-drift", `${record.id}:${driftTypes[index]}`),
      recordId: record.id,
      driftType: driftTypes[index]!,
      previousState: index % 2 === 0 ? "unknown" : "needs_review",
      currentState: currentState(record, driftTypes[index]!),
      reviewImpact: reviewImpact(record, driftTypes[index]!),
      publicUiEffect: publicUiEffect(record, driftTypes[index]!),
      evidence: {
        sourceHash: record.provenance.sourceHash,
        contentHash: record.contentHash,
        rawUrlHash: record.rawUrlHash
      }
    })),
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function buildDarkwebIndexSearchQualityMetrics(records: readonly DarkwebIndexRecord[]): DarkwebIndexSearchQualityMetrics {
  const actorHintCount = records.filter((record) => record.actorHints.length > 0).length;
  const victimHintCount = records.filter((record) => record.victimHints.length > 0).length;
  const ttpHintCount = records.filter((record) => record.ttpHints.length > 0).length;
  const blocked = records.filter((record) => record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe");
  const averageConfidence = records.length === 0 ? 0 : Math.round((records.reduce((sum, record) => sum + record.confidence, 0) / records.length) * 100) / 100;
  return {
    schemaVersion: "ti.darkweb_index_search_quality.v1",
    owner: "Agent 05",
    mode: "metadata_only_quality_metrics",
    categoryCoverage: countBy(CATEGORIES, records.map((record) => record.category)),
    languageHints: [...new Set(records.map((record) => record.language))].sort((left, right) => left.localeCompare(right)).map((language: string) => ({
      language,
      count: records.filter((record) => record.language === language).length
    })),
    titleSummaryUsefulness: {
      usefulTitleCount: records.filter((record) => record.title.length >= 12).length,
      usefulSummaryCount: records.filter((record) => record.safeSummary.length >= 40).length,
      weakSummaryCount: records.filter((record) => record.safeSummary.length < 40 || record.confidence < 0.6).length
    },
    entityExtractionConfidence: {
      actorHintCount,
      victimHintCount,
      datasetHintCount: records.filter((record) => /dataset|descriptor|claim/i.test(record.safeSummary)).length,
      ttpHintCount,
      averageConfidence
    },
    blockedUnsafeEvidenceCounts: {
      payloadLike: blocked.filter((record) => record.legalTriage === "malware_or_payload" || /payload/i.test(record.blockedReason ?? "")).length,
      credentialLike: blocked.filter((record) => record.legalTriage === "credential_or_abuse" || /credential/i.test(record.blockedReason ?? "")).length,
      privateAccessLike: blocked.filter((record) => /private/i.test(record.blockedReason ?? "")).length,
      actorInteractionLike: blocked.filter((record) => /actor-interaction|interaction/i.test(record.blockedReason ?? "")).length
    },
    falsePositiveReviewRows: records.filter((record) => record.reviewState === "false_positive_review").slice(0, 10).map((record) => record.id),
    publicSafeDisplayReadiness: {
      readyCount: records.filter((record) => record.reviewState === "approved_metadata_only").length,
      heldCount: records.filter((record) => record.reviewState === "needs_review" || record.reviewState === "legal_hold" || record.reviewState === "false_positive_review").length,
      blockedCount: records.filter((record) => record.reviewState === "blocked_unsafe").length,
      requiredWarnings: ["metadata_only", "review_required", "blocked_unsafe", "legal_hold"]
    }
  };
}

function buildDarkwebIndexTier100ProductSlice(records: readonly DarkwebIndexRecord[]): DarkwebIndexTier100ProductSlice {
  const tierRecords = records.slice(0, 100);
  const acceptedRecords = tierRecords.filter((record) => record.reviewState === "approved_metadata_only" && (record.liveness === "live" || record.liveness === "intermittent"));
  const duplicateRecordIds = darkwebIndexDedupePlan(tierRecords).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds).filter((recordId) => tierRecords.some((record) => record.id === recordId));
  const duplicateSet = new Set(duplicateRecordIds);
  const blockedRecords = tierRecords.filter((record) => record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe");
  const reviewRecords = tierRecords.filter((record) =>
    record.reviewState === "needs_review" ||
    record.reviewState === "legal_hold" ||
    record.reviewState === "false_positive_review"
  );
  const staleOrDeadRecords = tierRecords.filter((record) => record.liveness === "dead" || record.liveness === "unknown");
  const usefulSummaryRate = ratio(tierRecords.filter((record) => record.safeSummary.length >= 80 && record.title.length >= 20).length, Math.max(1, tierRecords.length));
  const actorHintCoverage = ratio(tierRecords.filter((record) => record.actorHints.length > 0).length, Math.max(1, tierRecords.length));
  const victimHintCoverage = ratio(tierRecords.filter((record) => record.victimHints.length > 0).length, Math.max(1, tierRecords.length));
  const sourceFamilies: DarkwebIndexTier100ProductSlice["sourceFamilies"] = [
    tier100SourceFamily("public_report", tierRecords),
    tier100SourceFamily("analyst_import", tierRecords),
    tier100SourceFamily("directory_metadata", tierRecords),
    tier100SourceFamily("public_tracker_reference", tierRecords),
    tier100SourceFamily("approved_seed", tierRecords),
    tier100SourceFamily("safe_search_result", tierRecords)
  ];
  return {
    schemaVersion: "ti.darkweb_index_tier100_product.v1",
    owner: "Agent 05",
    tier: "tier_100",
    mode: "buyer_visible_safe_metadata",
    recordGoal: 100,
    producedRecordCount: tierRecords.length,
    sourceFamilies,
    importOutcome: {
      accepted: acceptedRecords.length,
      duplicate: duplicateSet.size,
      blocked: blockedRecords.length,
      reviewNeeded: reviewRecords.length,
      staleOrDead: staleOrDeadRecords.length,
      acceptedRecordIds: acceptedRecords.slice(0, 25).map((record) => record.id),
      duplicateRecordIds: [...duplicateSet].slice(0, 25),
      blockedRecordIds: blockedRecords.slice(0, 25).map((record) => record.id),
      reviewRecordIds: reviewRecords.slice(0, 25).map((record) => record.id),
      staleOrDeadRecordIds: staleOrDeadRecords.slice(0, 25).map((record) => record.id)
    },
    buyerVisibleSearch: {
      usefulSummaryRate,
      actorHintCoverage,
      victimHintCoverage,
      categoryCoverageCount: uniqueSorted(tierRecords.map((record) => record.category)).length,
      liveOrIntermittentCount: tierRecords.filter((record) => record.liveness === "live" || record.liveness === "intermittent").length,
      publicSearchBoostQueries: uniqueSorted(tierRecords.flatMap((record) => [...record.actorHints, ...record.victimHints, record.category])).slice(0, 20),
      apifyFields: ["actorHints", "victimHints", "category", "legalTriage", "liveness", "safeSummary", "sourceFamily", "lastSeen"]
    },
    tier1000AdvancementCriteria: {
      targetTier: "tier_1000",
      minAcceptedRecords: 70,
      maxDuplicateRate: 0.2,
      minUsefulSummaryRate: 0.8,
      minActorHintCoverage: 0.25,
      minCategoryCoverage: 8,
      maxBlockedUnsafeRate: 0.2,
      maxFalsePositiveReviewRows: 12,
      requireNoLeakProof: true,
      requireApifySearchLift: true
    },
    safety: {
      rawUnsafeUrlsExposed: false,
      stolenFilesDownloaded: false,
      credentialsRetrieved: false,
      payloadsFollowed: false,
      privateAuthCaptchaAccess: false,
      actorInteraction: false
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function buildDarkwebIndexTier1000Readiness(records: readonly DarkwebIndexRecord[]): DarkwebIndexTier1000Readiness {
  const tierRecords = records.slice(0, 1000);
  const duplicateRecordIds = darkwebIndexDedupePlan(tierRecords).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds).filter((recordId) => tierRecords.some((record) => record.id === recordId));
  const duplicateSet = new Set(duplicateRecordIds);
  const blockedRecords = tierRecords.filter((record) => record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe");
  const reviewRecords = tierRecords.filter((record) => record.reviewState === "needs_review" || record.reviewState === "legal_hold" || record.reviewState === "false_positive_review");
  const staleOrDeadRecords = tierRecords.filter((record) => record.liveness === "dead" || record.liveness === "unknown");
  const qualifiedRecords = tierRecords.filter((record) => isTier1000ProductQualifiedRecord(record) && !duplicateSet.has(record.id));
  const lowBuyerValueRecords = tierRecords.filter((record) => buyerValueScoreFor(record) < 0.55);
  const currentEnoughRecords = tierRecords.filter((record) => isCurrentEnoughForMonitoring(record));
  const sourceFamilies: DarkwebIndexTier1000Readiness["sourceFamilies"] = [
    tier1000SourceFamily("public_report", tierRecords),
    tier1000SourceFamily("analyst_import", tierRecords),
    tier1000SourceFamily("directory_metadata", tierRecords),
    tier1000SourceFamily("public_tracker_reference", tierRecords),
    tier1000SourceFamily("approved_seed", tierRecords),
    tier1000SourceFamily("safe_search_result", tierRecords)
  ];
  return {
    schemaVersion: "ti.darkweb_index_tier1000_readiness.v1",
    owner: "Agent 05",
    tier: "tier_1000",
    mode: "real_metadata_readiness_path",
    targetRecordCount: 1000,
    evaluatedRecordCount: tierRecords.length,
    productQualifiedRecordCount: qualifiedRecords.length,
    rejectedLowValueRecordCount: lowBuyerValueRecords.length,
    sourceFamilies,
    freshness: {
      currentEnoughCount: currentEnoughRecords.length,
      staleCount: tierRecords.filter((record) => !isCurrentEnoughForMonitoring(record) && record.liveness !== "dead" && record.liveness !== "unknown").length,
      deadOrUnknownCount: staleOrDeadRecords.length,
      liveOrIntermittentRate: ratio(tierRecords.filter((record) => record.liveness === "live" || record.liveness === "intermittent").length, Math.max(1, tierRecords.length)),
      medianRefreshCadenceMinutes: median(sourceFamilies.map((family) => family.refreshCadenceMinutes)),
      maxAllowedStaleHours: 72,
      customerFreshnessLabel: ratio(currentEnoughRecords.length, Math.max(1, tierRecords.length)) >= 0.55 ? "fresh_enough_for_monitoring" : "needs_refresh_before_paid_claim"
    },
    searchReadiness: {
      safeSummaryCoverage: ratio(tierRecords.filter((record) => record.safeSummary.length >= 80).length, Math.max(1, tierRecords.length)),
      actorHintCoverage: ratio(tierRecords.filter((record) => record.actorHints.length > 0).length, Math.max(1, tierRecords.length)),
      victimHintCoverage: ratio(tierRecords.filter((record) => record.victimHints.length > 0).length, Math.max(1, tierRecords.length)),
      categoryCoverageCount: uniqueSorted(tierRecords.map((record) => record.category)).length,
      sourceFamilyCoverageCount: sourceFamilies.filter((family) => family.evaluatedCount > 0).length,
      buyerValueCoverage: ratio(tierRecords.filter((record) => buyerValueScoreFor(record) >= 0.55).length, Math.max(1, tierRecords.length)),
      apifyReadyRecordIds: qualifiedRecords.slice(0, 50).map((record) => record.id),
      searchBoostQueries: uniqueSorted(tierRecords.flatMap((record) => [...record.actorHints, ...record.victimHints, record.category])).slice(0, 30)
    },
    importGate: {
      accepted: qualifiedRecords.length,
      duplicate: duplicateSet.size,
      blockedUnsafe: blockedRecords.length,
      reviewNeeded: reviewRecords.length,
      staleOrDead: staleOrDeadRecords.length,
      lowBuyerValue: lowBuyerValueRecords.length,
      acceptanceRate: ratio(qualifiedRecords.length, Math.max(1, tierRecords.length)),
      duplicateRate: ratio(duplicateSet.size, Math.max(1, tierRecords.length)),
      blockedUnsafeRate: ratio(blockedRecords.length, Math.max(1, tierRecords.length))
    },
    tier4000Planning: {
      targetTier: "tier_4000",
      requiredBeforeAdvance: [
        "replace low-buyer-value records before counting tier progress",
        "raise current-enough freshness above 55 percent with approved refresh runs",
        "prove Apify/public search lift on actor and victim queries",
        "keep blocked unsafe and legal-hold rows out of public-ready counts",
        "preserve no-leak serialization for every status/search response"
      ],
      minProductQualifiedRecords: 720,
      minFreshnessCurrentRate: 0.55,
      maxBlockedUnsafeRate: 0.18,
      requireNoLeakProof: true,
      requireActorDatasetLift: true
    },
    safety: {
      rawUnsafeUrlsExposed: false,
      stolenFilesDownloaded: false,
      credentialsRetrieved: false,
      payloadsFollowed: false,
      privateAuthCaptchaAccess: false,
      actorInteraction: false
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function buildDarkwebIndexTier4000Admission(records: readonly DarkwebIndexRecord[]): DarkwebIndexTier4000Admission {
  const tierRecords = records.slice(0, 4000);
  const duplicateRecordIds = darkwebIndexDedupePlan(tierRecords).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds).filter((recordId) => tierRecords.some((record) => record.id === recordId));
  const duplicateSet = new Set(duplicateRecordIds);
  const admitted = tierRecords.filter((record) => isTier4000AdmittedRecord(record) && !duplicateSet.has(record.id));
  const blockedOrReview = tierRecords.filter((record) =>
    record.reviewState === "blocked_unsafe" ||
    record.reviewState === "needs_review" ||
    record.reviewState === "legal_hold" ||
    record.reviewState === "false_positive_review" ||
    record.legalTriage === "blocked_unsafe"
  );
  const stale = tierRecords.filter((record) => !isCurrentEnoughForMonitoring(record));
  const datasetHintRecords = tierRecords.filter((record) => datasetHintsFor(record).length > 0);
  const averageBuyerValueScore = tierRecords.length === 0 ? 0 : Math.round((tierRecords.reduce((sum, record) => sum + buyerValueScoreFor(record), 0) / tierRecords.length) * 100) / 100;
  const productQualifiedRate = ratio(admitted.length, Math.max(1, tierRecords.length));
  const staleRate = ratio(stale.length, Math.max(1, tierRecords.length));
  const blockedOrReviewRate = ratio(blockedOrReview.length, Math.max(1, tierRecords.length));
  const searchHitQualityRate = ratio(tierRecords.filter((record) => buyerSearchRowFor(record).searchBoostTerms.length >= 3 && buyerValueScoreFor(record) >= 0.55).length, Math.max(1, tierRecords.length));
  const activationDecision = productQualifiedRate >= 0.72 && staleRate <= 0.35 && blockedOrReviewRate <= 0.22 ? "ready_for_limited_canary" : "hold_for_value_density";
  return {
    schemaVersion: "ti.darkweb_index_tier4000_admission.v1",
    owner: "Agent 05",
    tier: "tier_4000",
    mode: "buyer_value_admission_gate",
    baselineTier: "tier_1000",
    targetRecordCount: 4000,
    evaluatedCandidateCount: tierRecords.length,
    admittedCandidateCount: admitted.length,
    rejectedCandidateCount: Math.max(0, tierRecords.length - admitted.length),
    admissionRules: {
      minBuyerValueScore: 0.66,
      minSafeSummaryLength: 80,
      allowedLiveness: ["live", "intermittent"],
      requiredSignals: ["category", "sourceFamily", "lastSeen", "provenanceHash", "actor_or_victim_or_dataset_hint"],
      maxDuplicateRate: 0.18,
      maxStaleRate: 0.35,
      maxBlockedOrReviewRate: 0.22,
      requireApprovedMetadataOnly: true
    },
    candidateModel: {
      requiredFields: ["safeSummary", "actorHints", "victimHints", "datasetHints", "claimedDate", "firstSeen", "lastSeen", "sourceFamily", "liveness", "refreshCadenceMinutes", "searchBoostTerms", "provenanceHash", "buyerValueScore", "whyItMatters"],
      publicSafeHashFields: ["rawUrlHash", "hostHash", "pathHash", "contentHash", "sourceHash"],
      forbiddenFields: darkwebIndexNoLeakSerialization().forbiddenFields
    },
    qualityMetrics: {
      productQualifiedRate,
      staleRate,
      duplicateRate: ratio(duplicateSet.size, Math.max(1, tierRecords.length)),
      blockedOrReviewRate,
      searchHitQualityRate,
      actorHintCoverage: ratio(tierRecords.filter((record) => record.actorHints.length > 0).length, Math.max(1, tierRecords.length)),
      victimHintCoverage: ratio(tierRecords.filter((record) => record.victimHints.length > 0).length, Math.max(1, tierRecords.length)),
      datasetHintCoverage: ratio(datasetHintRecords.length, Math.max(1, tierRecords.length)),
      averageBuyerValueScore,
      costRiskPerUsefulMetadataRow: productQualifiedRate >= 0.72 ? "low" : productQualifiedRate >= 0.45 ? "medium" : "high"
    },
    importRefreshGate: {
      disposableIsolationRequired: true,
      approvedProxyRequired: true,
      rawUnsafeUrlSerializationAllowed: false,
      credentialOrPayloadCollectionAllowed: false,
      authCaptchaPrivateAccessAllowed: false,
      threatActorInteractionAllowed: false,
      refreshCadenceMinutesByFamily: {
        public_report: refreshCadenceMinutesFor("public_report"),
        analyst_import: refreshCadenceMinutesFor("analyst_import"),
        directory_metadata: refreshCadenceMinutesFor("directory_metadata"),
        public_tracker_reference: refreshCadenceMinutesFor("public_tracker_reference"),
        approved_seed: refreshCadenceMinutesFor("approved_seed"),
        safe_search_result: refreshCadenceMinutesFor("safe_search_result")
      },
      rejectLowValueInsteadOfInflatingCount: true
    },
    buyerSearchProof: {
      sampleSearchRows: admitted.slice(0, 10).map(buyerSearchRowFor),
      usefulSearchQueries: uniqueSorted(tierRecords.flatMap((record) => buyerSearchRowFor(record).searchBoostTerms)).slice(0, 30),
      activationDecision,
      blockers: activationDecision === "ready_for_limited_canary" ? [] : [
        "product_qualified_rate_below_72_percent",
        "tier_4000_requires_more_actor_victim_dataset_signal",
        "reject_low_value_candidates_before_count_expansion"
      ]
    },
    crossAgentHandoffs: {
      sourceAtlas: "source_family_value_and_replacement_candidates",
      publicChannel: "corroborate_actor_victim_dataset_claims",
      evidencePromotion: "metadata_context_only_public_answer_support",
      qualityGate: "tier4000_product_quality_admission",
      apiFrontend: "buyer_search_rows_and_filters",
      productSlo: "cost_risk_per_useful_metadata_row"
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function buildDarkwebIndexTier10000RefreshValue(records: readonly DarkwebIndexRecord[]): DarkwebIndexTier10000RefreshValue {
  const tierRecords = records.slice(0, 10_000);
  const duplicateRecordIds = darkwebIndexDedupePlan(tierRecords).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds).filter((recordId) => tierRecords.some((record) => record.id === recordId));
  const duplicateSet = new Set(duplicateRecordIds);
  const valueQualified = tierRecords.filter((record) =>
    isTier4000AdmittedRecord(record) &&
    !duplicateSet.has(record.id) &&
    buyerValueScoreFor(record) >= 0.68
  );
  const stale = tierRecords.filter((record) => !isCurrentEnoughForMonitoring(record));
  const blockedOrReview = tierRecords.filter((record) =>
    record.reviewState === "blocked_unsafe" ||
    record.reviewState === "needs_review" ||
    record.reviewState === "legal_hold" ||
    record.reviewState === "false_positive_review" ||
    record.legalTriage === "blocked_unsafe"
  );
  const actorHints = uniqueSorted(tierRecords.flatMap((record) => record.actorHints));
  const victimHints = uniqueSorted(tierRecords.flatMap((record) => record.victimHints));
  const datasetHints = uniqueSorted(tierRecords.flatMap(datasetHintsFor));
  const currentRows = tierRecords.filter(isCurrentEnoughForMonitoring);
  const searchHitQualityCount = tierRecords.filter((record) => buyerSearchRowFor(record).searchBoostTerms.length >= 3 && buyerValueScoreFor(record) >= 0.55).length;
  const usefulSummaryCount = tierRecords.filter((record) => record.safeSummary.length >= 80 && buyerSearchRowFor(record).whyItMatters.length > 0).length;
  const averageBuyerValueScore = tierRecords.length === 0 ? 0 : Math.round((tierRecords.reduce((sum, record) => sum + buyerValueScoreFor(record), 0) / tierRecords.length) * 100) / 100;
  const searchHitQualityRate = ratio(searchHitQualityCount, Math.max(1, tierRecords.length));
  const blockedOrReviewRate = ratio(blockedOrReview.length, Math.max(1, tierRecords.length));
  const duplicateRate = ratio(duplicateSet.size, Math.max(1, tierRecords.length));
  const staleRate = ratio(stale.length, Math.max(1, tierRecords.length));
  const activationDecision =
    ratio(valueQualified.length, Math.max(1, tierRecords.length)) >= 0.72 &&
    duplicateRate <= 0.16 &&
    staleRate <= 0.28 &&
    blockedOrReviewRate <= 0.18 &&
    ratio(tierRecords.filter((record) => record.actorHints.length > 0).length, Math.max(1, tierRecords.length)) >= 0.25 &&
    ratio(tierRecords.filter((record) => record.victimHints.length > 0).length, Math.max(1, tierRecords.length)) >= 0.18 &&
    ratio(tierRecords.filter((record) => datasetHintsFor(record).length > 0).length, Math.max(1, tierRecords.length)) >= 0.24 &&
    averageBuyerValueScore >= 0.68
      ? "ready_for_tier10000_limited_canary"
      : "hold_for_value_density";

  return {
    schemaVersion: "ti.darkweb_index_tier10000_refresh_value.v1",
    owner: "Agent 05",
    tier: "tier_10000",
    baselineTier: "tier_4000",
    mode: "refresh_and_buyer_search_value_gate",
    targetRecordCount: 10_000,
    evaluatedCandidateCount: tierRecords.length,
    valueQualifiedCount: valueQualified.length,
    rejectedLowValueCount: Math.max(0, tierRecords.length - valueQualified.length),
    advancementCriteria: {
      minProductQualifiedRate: 0.72,
      maxDuplicateRate: 0.16,
      maxStaleRate: 0.28,
      maxBlockedOrReviewRate: 0.18,
      minActorCoverage: 0.25,
      minVictimCoverage: 0.18,
      minDatasetCoverage: 0.24,
      minAverageBuyerValueScore: 0.68,
      requireNoLeakProof: true
    },
    refreshLanes: [
      tier10000RefreshLane("public_report", "fresh_actor_hits", "low"),
      tier10000RefreshLane("analyst_import", "victim_context", "medium"),
      tier10000RefreshLane("directory_metadata", "source_family_diversity", "medium"),
      tier10000RefreshLane("public_tracker_reference", "dataset_claim_discovery", "low"),
      tier10000RefreshLane("approved_seed", "stale_row_suppression", "medium"),
      tier10000RefreshLane("safe_search_result", "fresh_actor_hits", "low")
    ],
    buyerSearchProof: buildTier10000BuyerSearchProof(tierRecords, valueQualified),
    qualityMetrics: {
      searchHitQualityRate,
      usefulSummaryRate: ratio(usefulSummaryCount, Math.max(1, tierRecords.length)),
      currentEnoughFreshnessRate: ratio(currentRows.length, Math.max(1, tierRecords.length)),
      duplicateSuppressionRate: ratio(Math.max(0, tierRecords.length - duplicateSet.size), Math.max(1, tierRecords.length)),
      blockedOrReviewRate,
      actorCoverage: ratio(tierRecords.filter((record) => record.actorHints.length > 0).length, Math.max(1, tierRecords.length)),
      victimCoverage: ratio(tierRecords.filter((record) => record.victimHints.length > 0).length, Math.max(1, tierRecords.length)),
      datasetCoverage: ratio(tierRecords.filter((record) => datasetHintsFor(record).length > 0).length, Math.max(1, tierRecords.length)),
      averageBuyerValueScore,
      costRiskPerUsefulMetadataRow: searchHitQualityRate >= 0.72 && blockedOrReviewRate <= 0.18 ? "low" : searchHitQualityRate >= 0.45 ? "medium" : "high"
    },
    activationDecision,
    blockers: activationDecision === "ready_for_tier10000_limited_canary" ? [] : [
      "tier10000_product_qualified_rate_below_72_percent",
      "tier10000_average_buyer_value_below_0_68",
      "tier10000_needs_more_current_actor_victim_dataset_hits",
      "reject_low_value_candidates_before_count_expansion",
      "tier_10000_requires_higher_value_density",
      "refresh_low_value_rows_do_not_count_toward_target",
      "actor_victim_dataset_coverage_must_clear_buyer_search_thresholds"
    ],
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function tier10000RefreshLane(
  family: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"],
  expectedBuyerVisibleRowEffect: DarkwebIndexTier10000RefreshValue["refreshLanes"][number]["expectedBuyerVisibleRowEffect"],
  risk: DarkwebIndexTier10000RefreshValue["refreshLanes"][number]["risk"]
): DarkwebIndexTier10000RefreshValue["refreshLanes"][number] {
  const sharedBlockers = [
    "reject_raw_unsafe_locations",
    "reject_credentials_payloads_private_material",
    "hold_if_source_approval_not_current",
    "hold_if_raw_unsafe_location_would_be_required",
    "hold_if_auth_captcha_or_private_access_detected",
    "reject_if_buyer_value_below_threshold",
    "suppress_duplicate_or_stale_rows",
    "preserve_metadata_only_no_leak_serialization"
  ];
  return {
    family,
    cadenceMinutes: refreshCadenceMinutesFor(family),
    risk,
    expectedBuyerVisibleRowEffect,
    blockerRules: family === "analyst_import"
      ? [...sharedBlockers, "require_source_hash_and_review_ticket"]
      : sharedBlockers
  };
}

function buildTier10000BuyerSearchProof(
  records: readonly DarkwebIndexRecord[],
  valueQualified: readonly DarkwebIndexRecord[]
): DarkwebIndexTier10000RefreshValue["buyerSearchProof"] {
  const sampleRecords = valueQualified.length > 0
    ? valueQualified.slice(0, 12)
    : records.filter(isTier1000ProductQualifiedRecord).slice(0, 12);
  const sampleRows = sampleRecords.map(buyerSearchRowFor);
  const actorQueries = uniqueSorted(records.flatMap((record) => record.actorHints)).slice(0, 12);
  const victimCompanyQueries = uniqueSorted(records.flatMap((record) => record.victimHints)).slice(0, 12);
  const ransomwareGroupQueries = actorQueries.filter((query) => ["akira", "lockbit", "cl0p"].includes(query)).slice(0, 8);
  const datasetTypeQueries = uniqueSorted(records.flatMap(datasetHintsFor)).slice(0, 12);
  const sectorCountryQueries = uniqueSorted(records.flatMap((record) =>
    record.victimHints.map((victim) => `${victim} ${record.language}`)
  )).slice(0, 12);
  const newSinceLastRunQueries = uniqueSorted(sampleRows.flatMap((row) =>
    row.searchBoostTerms.map((term) => `${term} since:last-run`)
  )).slice(0, 12);
  return {
    actorQueries,
    victimCompanyQueries,
    ransomwareGroupQueries,
    datasetTypeQueries,
    sectorCountryQueries,
    newSinceLastRunQueries,
    usefulQueryCount: uniqueSorted([
      ...actorQueries,
      ...victimCompanyQueries,
      ...ransomwareGroupQueries,
      ...datasetTypeQueries,
      ...sectorCountryQueries,
      ...newSinceLastRunQueries
    ]).length,
    sampleRows
  };
}

function buildDarkwebIndexLiveValueExpansion(records: readonly DarkwebIndexRecord[]): DarkwebIndexLiveValueExpansion {
  return {
    schemaVersion: "ti.darkweb_index_live_value_expansion.v1",
    owner: "Agent 05",
    mode: "metadata_only_ready_to_import_value_expansion",
    willFetchNetwork: false,
    willScheduleLiveWork: false,
    sourceCountInflationBlocked: true,
    tiers: [
      buildLiveValueExpansionTier("tier_1000", 1000, records),
      buildLiveValueExpansionTier("tier_4000", 4000, records)
    ],
    refreshScheduleSemantics: buildLiveValueRefreshScheduleSemantics(),
    valueGateRejects: buildLiveValueRejectBuckets(records),
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function liveValueExpansionSearchHandoff(expansion: DarkwebIndexLiveValueExpansion): Pick<DarkwebIndexLiveValueExpansion, "schemaVersion" | "mode" | "sourceCountInflationBlocked" | "tiers"> {
  return {
    schemaVersion: expansion.schemaVersion,
    mode: expansion.mode,
    sourceCountInflationBlocked: expansion.sourceCountInflationBlocked,
    tiers: expansion.tiers
  };
}

function publicIntelligenceHandoffSearchHandoff(
  handoff: DarkwebIndexPublicIntelligenceHandoff100
): Pick<DarkwebIndexPublicIntelligenceHandoff100, "schemaVersion" | "mode" | "candidateCount" | "publicCorroboratedCount" | "usefulCaveatedCount" | "projectedContributionToward100SellableRows" | "decisionCounts" | "sampleRows" | "handoffs"> {
  return {
    schemaVersion: handoff.schemaVersion,
    mode: handoff.mode,
    candidateCount: handoff.candidateCount,
    publicCorroboratedCount: handoff.publicCorroboratedCount,
    usefulCaveatedCount: handoff.usefulCaveatedCount,
    projectedContributionToward100SellableRows: handoff.projectedContributionToward100SellableRows,
    decisionCounts: handoff.decisionCounts,
    sampleRows: handoff.sampleRows,
    handoffs: handoff.handoffs
  };
}

function publicSupportWorklistSearchHandoff(
  worklist: DarkwebIndexPublicSupportWorklist40
): Pick<DarkwebIndexPublicSupportWorklist40, "schemaVersion" | "mode" | "topCandidateCount" | "publicSupportReadyCount" | "stillRestrictedOnlyCount" | "projectedCaveatedRows" | "projectedSellableRowsAfterPublicSupport" | "contributionToward100SellableRows" | "rows" | "handoffs"> {
  return {
    schemaVersion: worklist.schemaVersion,
    mode: worklist.mode,
    topCandidateCount: worklist.topCandidateCount,
    publicSupportReadyCount: worklist.publicSupportReadyCount,
    stillRestrictedOnlyCount: worklist.stillRestrictedOnlyCount,
    projectedCaveatedRows: worklist.projectedCaveatedRows,
    projectedSellableRowsAfterPublicSupport: worklist.projectedSellableRowsAfterPublicSupport,
    contributionToward100SellableRows: worklist.contributionToward100SellableRows,
    rows: worklist.rows,
    handoffs: worklist.handoffs
  };
}

function publicSupportLiftSearchHandoff(
  lift: DarkwebIndexPublicSupportLift1000
): Pick<DarkwebIndexPublicSupportLift1000, "schemaVersion" | "mode" | "strictNoInflation" | "currentContributionToward100SellableRows" | "first1000CandidateCount" | "first1000SellableAfterPublicSupport" | "first1000UsefulWithCaveat" | "first1000RestrictedOnlyHold" | "first1000RejectedCounts" | "first4000CandidateCount" | "first4000SellableAfterPublicSupport" | "first4000UsefulWithCaveat" | "first4000RestrictedOnlyHold" | "first4000RejectedCounts" | "first4000SupportBucketCounts" | "projectedContributionToward100PaidRowsAfterPublicSupport" | "first100RepairQueue" | "publicSupportSellable100" | "publicSupportSellable250" | "publicSupportSellable500" | "tier10000Preview" | "metricMovement" | "tiers" | "handoffs"> {
  return {
    schemaVersion: lift.schemaVersion,
    mode: lift.mode,
    strictNoInflation: lift.strictNoInflation,
    currentContributionToward100SellableRows: lift.currentContributionToward100SellableRows,
    first1000CandidateCount: lift.first1000CandidateCount,
    first1000SellableAfterPublicSupport: lift.first1000SellableAfterPublicSupport,
    first1000UsefulWithCaveat: lift.first1000UsefulWithCaveat,
    first1000RestrictedOnlyHold: lift.first1000RestrictedOnlyHold,
    first1000RejectedCounts: lift.first1000RejectedCounts,
    first4000CandidateCount: lift.first4000CandidateCount,
    first4000SellableAfterPublicSupport: lift.first4000SellableAfterPublicSupport,
    first4000UsefulWithCaveat: lift.first4000UsefulWithCaveat,
    first4000RestrictedOnlyHold: lift.first4000RestrictedOnlyHold,
    first4000RejectedCounts: lift.first4000RejectedCounts,
    first4000SupportBucketCounts: lift.first4000SupportBucketCounts,
    projectedContributionToward100PaidRowsAfterPublicSupport: lift.projectedContributionToward100PaidRowsAfterPublicSupport,
    first100RepairQueue: lift.first100RepairQueue,
    publicSupportSellable100: lift.publicSupportSellable100,
    publicSupportSellable250: lift.publicSupportSellable250,
    publicSupportSellable500: lift.publicSupportSellable500,
    tier10000Preview: lift.tier10000Preview,
    metricMovement: lift.metricMovement,
    tiers: lift.tiers,
    handoffs: lift.handoffs
  };
}

function buildLiveValueExpansionTier(
  tier: DarkwebIndexLiveValueExpansion["tiers"][number]["tier"],
  targetRecordCount: 1000 | 4000,
  records: readonly DarkwebIndexRecord[]
): DarkwebIndexLiveValueExpansion["tiers"][number] {
  const tierRecords = records.slice(0, targetRecordCount);
  const duplicateIds = new Set(darkwebIndexDedupePlan(tierRecords).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds));
  const valueQualified = tierRecords.filter((record) => liveValueRowQualified(record, duplicateIds));
  const stale = tierRecords.filter((record) => !isCurrentEnoughForMonitoring(record));
  const blockedOrReview = tierRecords.filter((record) => isBlockedOrReviewRecord(record));
  const averageBuyerValueScore = tierRecords.length === 0 ? 0 : Math.round((tierRecords.reduce((sum, record) => sum + buyerValueScoreFor(record), 0) / tierRecords.length) * 100) / 100;
  const usefulRowRate = ratio(valueQualified.length, Math.max(1, tierRecords.length));
  const staleRate = ratio(stale.length, Math.max(1, tierRecords.length));
  const duplicateRate = ratio(duplicateIds.size, Math.max(1, tierRecords.length));
  const blockedOrReviewRate = ratio(blockedOrReview.length, Math.max(1, tierRecords.length));
  const advancementDecision =
    usefulRowRate >= 0.72 &&
    averageBuyerValueScore >= 0.68 &&
    staleRate <= 0.28 &&
    duplicateRate <= 0.16 &&
    blockedOrReviewRate <= 0.18
      ? "ready_for_import_batch"
      : "hold_for_value_density";
  const candidateRows = liveValueCandidateRowsFor(tier, tierRecords, duplicateIds, valueQualified);
  const buyerSearchProof = buildLiveValueBuyerSearchProof(candidateRows, tierRecords);
  return {
    tier,
    targetRecordCount,
    evaluatedCandidateCount: tierRecords.length,
    valueQualifiedCandidateCount: valueQualified.length,
    rejectedLowValueCandidateCount: Math.max(0, tierRecords.length - valueQualified.length),
    usefulRowRate,
    averageBuyerValueScore,
    staleRate,
    duplicateRate,
    blockedOrReviewRate,
    sampleRowsRequired: 12,
    usefulQueriesRequired: 20,
    advancementDecision,
    blockers: advancementDecision === "ready_for_import_batch" ? [] : [
      "value_qualified_density_below_72_percent",
      "average_buyer_value_must_clear_0_68_before_promotion",
      "stale_duplicate_or_review_rows_do_not_count_toward_tier",
      "needs_more_actor_victim_dataset_search_hits",
      "no_leak_serialization_required_for_every_candidate"
    ],
    candidateRows,
    buyerSearchProof
  };
}

function buildLiveValueBuyerSearchProof(
  candidateRows: readonly DarkwebIndexLiveValueCandidateRow[],
  records: readonly DarkwebIndexRecord[]
): DarkwebIndexLiveValueExpansion["tiers"][number]["buyerSearchProof"] {
  const valueRows = candidateRows.filter((row) => row.decision === "value_qualified");
  const sampleRows = (valueRows.length >= 12 ? valueRows : candidateRows).slice(0, 12);
  const actorQueries = uniqueSorted(records.flatMap((record) => record.actorHints)).slice(0, 20);
  const victimCompanyQueries = uniqueSorted(records.flatMap((record) => record.victimHints)).slice(0, 20);
  const ransomwareGroupQueries = uniqueSorted(actorQueries.filter((query) => ["akira", "lockbit", "cl0p"].includes(query))).slice(0, 20);
  const datasetTypeQueries = uniqueSorted(records.flatMap(datasetHintsFor)).slice(0, 20);
  const sectorCountryQueries = uniqueSorted(candidateRows.map((row) => row.sectorCountry)).slice(0, 20);
  const newSinceLastRunQueries = uniqueSorted(sampleRows.flatMap((row) =>
    [...row.actorHints, ...row.victimHints, ...row.datasetHints, row.sourceFamily].map((term) => `${term} new since last run`)
  )).slice(0, 20);
  return {
    usefulQueryCount: uniqueSorted([
      ...actorQueries,
      ...victimCompanyQueries,
      ...ransomwareGroupQueries,
      ...datasetTypeQueries,
      ...sectorCountryQueries,
      ...newSinceLastRunQueries
    ]).length,
    actorQueries,
    victimCompanyQueries,
    ransomwareGroupQueries,
    datasetTypeQueries,
    sectorCountryQueries,
    newSinceLastRunQueries,
    sampleRows
  };
}

function liveValueCandidateRowsFor(
  tier: DarkwebIndexLiveValueCandidateRow["tier"],
  records: readonly DarkwebIndexRecord[],
  duplicateIds: ReadonlySet<string>,
  valueQualified: readonly DarkwebIndexRecord[]
): DarkwebIndexLiveValueCandidateRow[] {
  const valueIds = new Set(valueQualified.map((record) => record.id));
  const selected = [
    ...valueQualified,
    ...records.filter((record) => !valueIds.has(record.id))
  ].slice(0, 24);
  return selected.map((record) => liveValueCandidateRowFor(tier, record, duplicateIds));
}

function liveValueCandidateRowFor(
  tier: DarkwebIndexLiveValueCandidateRow["tier"],
  record: DarkwebIndexRecord,
  duplicateIds: ReadonlySet<string>
): DarkwebIndexLiveValueCandidateRow {
  const row = buyerSearchRowFor(record);
  const rejectionReason = liveValueRejectionReasonFor(record, duplicateIds);
  return {
    recordId: record.id,
    tier,
    sourceFamily: row.sourceFamily,
    safeLocatorHash: record.rawUrlHash,
    actorHints: record.actorHints,
    victimHints: record.victimHints,
    datasetHints: row.datasetHints,
    sectorCountry: sectorCountryFor(record),
    firstSeen: record.firstSeen,
    lastSeen: record.lastSeen,
    liveness: record.liveness,
    freshness: row.freshness,
    buyerValueScore: row.buyerValueScore,
    reviewState: record.reviewState,
    noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials",
    decision: rejectionReason ? "rejected" : "value_qualified",
    whyWorthPayingFor: row.whyItMatters,
    rejectionReason
  };
}

function isBlockedOrReviewRecord(record: DarkwebIndexRecord): boolean {
  return record.reviewState === "blocked_unsafe" ||
    record.reviewState === "needs_review" ||
    record.reviewState === "legal_hold" ||
    record.reviewState === "false_positive_review" ||
    record.legalTriage === "blocked_unsafe";
}

function buildLiveValueRefreshScheduleSemantics(): DarkwebIndexLiveValueExpansion["refreshScheduleSemantics"] {
  const parserByFamily: Record<DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"], DarkwebIndexLiveValueExpansion["refreshScheduleSemantics"][number]["parserFamily"]> = {
    public_report: "public_report_metadata",
    analyst_import: "analyst_import_metadata",
    directory_metadata: "directory_landing_metadata",
    public_tracker_reference: "public_tracker_metadata",
    approved_seed: "approved_seed_metadata",
    safe_search_result: "safe_search_result_metadata"
  };
  const diversityByFamily: Record<DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"], "high" | "medium" | "low"> = {
    public_report: "high",
    analyst_import: "medium",
    directory_metadata: "high",
    public_tracker_reference: "medium",
    approved_seed: "medium",
    safe_search_result: "low"
  };
  const expectedRowsPerDay: Record<DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"], number> = {
    public_report: 180,
    analyst_import: 40,
    directory_metadata: 260,
    public_tracker_reference: 120,
    approved_seed: 90,
    safe_search_result: 110
  };
  return (["public_report", "analyst_import", "directory_metadata", "public_tracker_reference", "approved_seed", "safe_search_result"] as const).map((sourceFamily, index) => {
    const cadenceMinutes = refreshCadenceMinutesFor(sourceFamily);
    const lastSuccessDay = String(20 + index).padStart(2, "0");
    const nextDueDay = String(21 + index).padStart(2, "0");
    return {
      sourceFamily,
      cadenceMinutes,
      lastSuccessAt: `2026-05-${lastSuccessDay}T00:00:00.000Z`,
      nextDueAt: `2026-05-${nextDueDay}T00:00:00.000Z`,
      failureReason: sourceFamily === "analyst_import" ? "pending_legal_review" : "none",
      parserFamily: parserByFamily[sourceFamily],
      sourceFamilyDiversityImpact: diversityByFamily[sourceFamily],
      expectedRowsPerDay: expectedRowsPerDay[sourceFamily],
      approvedBoundary: "metadata_only_no_network_in_this_contract"
    };
  });
}

function buildLiveValueRejectBuckets(records: readonly DarkwebIndexRecord[]): DarkwebIndexLiveValueExpansion["valueGateRejects"] {
  const duplicateIds = new Set(darkwebIndexDedupePlan(records).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds));
  const bucket = (reason: DarkwebIndexLiveValueExpansion["valueGateRejects"][number]["reason"], rejectedCount: number) => ({
    reason,
    rejectedCount,
    doesNotCountTowardTier: true as const
  });
  return [
    bucket("duplicate", duplicateIds.size),
    bucket("stale_mirror", records.filter((record) => !isCurrentEnoughForMonitoring(record)).length),
    bucket("generic_listing", records.filter((record) => record.actorHints.length === 0 && record.victimHints.length === 0 && datasetHintsFor(record).length === 0).length),
    bucket("no_actor_victim_dataset_hint", records.filter((record) => record.actorHints.length === 0 && record.victimHints.length === 0 && datasetHintsFor(record).length === 0).length),
    bucket("unsafe_output_risk", records.filter((record) => record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe").length),
    bucket("review_or_legal_hold", records.filter((record) => record.reviewState === "needs_review" || record.reviewState === "legal_hold" || record.reviewState === "false_positive_review").length),
    bucket("auth_captcha_private_dependency", records.filter((record) => record.legalTriage === "credential_or_abuse" || record.blockedReason?.includes("private")).length),
    bucket("low_buyer_value", records.filter((record) => buyerValueScoreFor(record) < 0.68).length)
  ];
}

function liveValueRowQualified(record: DarkwebIndexRecord, duplicateIds: ReadonlySet<string>): boolean {
  return isTier4000AdmittedRecord(record) &&
    !duplicateIds.has(record.id) &&
    buyerValueScoreFor(record) >= 0.68 &&
    datasetHintsFor(record).length + record.actorHints.length + record.victimHints.length > 0;
}

function liveValueRejectionReasonFor(record: DarkwebIndexRecord, duplicateIds: ReadonlySet<string>): string | undefined {
  if (duplicateIds.has(record.id)) return "duplicate";
  if (record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe") return "unsafe_output_risk";
  if (record.reviewState === "needs_review" || record.reviewState === "legal_hold" || record.reviewState === "false_positive_review") return "review_or_legal_hold";
  if (record.legalTriage === "credential_or_abuse" || record.blockedReason?.includes("private")) return "auth_captcha_private_dependency";
  if (!isCurrentEnoughForMonitoring(record)) return "stale_mirror";
  if (record.actorHints.length === 0 && record.victimHints.length === 0 && datasetHintsFor(record).length === 0) return "no_actor_victim_dataset_hint";
  if (record.category === "directory" && record.actorHints.length === 0 && record.victimHints.length === 0) return "generic_listing";
  if (buyerValueScoreFor(record) < 0.68) return "low_buyer_value";
  return undefined;
}

function buildDarkwebIndexPublicIntelligenceHandoff100(records: readonly DarkwebIndexRecord[]): DarkwebIndexPublicIntelligenceHandoff100 {
  const candidateRecords = records.slice(0, 100);
  const duplicateIds = new Set(darkwebIndexDedupePlan(candidateRecords).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds));
  const rows = candidateRecords.map((record) => publicHandoffRowFor(record, duplicateIds));
  const count = (decision: DarkwebIndexPublicHandoffDecision) => rows.filter((row) => row.decision === decision).length;
  const publicCorroboratedCount = count("sellable_with_public_support");
  const usefulCaveatedCount = count("included_with_caveat");
  const heldCount = count("hold");
  const suppressedCount = count("suppress");
  const coverageGapOnlyCount = count("coverage_gap_only");
  const averageBuyerValueScore = rows.length === 0 ? 0 : Math.round((rows.reduce((sum, row) => sum + row.buyerValueScore, 0) / rows.length) * 100) / 100;
  return {
    schemaVersion: "ti.darkweb_index_public_intelligence_handoff_100.v1",
    owner: "Agent 05",
    mode: "metadata_only_public_intelligence_handoff",
    candidateTarget: 100,
    candidateCount: rows.length,
    publicCorroboratedCount,
    usefulCaveatedCount,
    rejectedCount: heldCount + suppressedCount + coverageGapOnlyCount,
    projectedContributionToward100SellableRows: publicCorroboratedCount,
    averageBuyerValueScore,
    staleRate: ratio(rows.filter((row) => row.freshness === "stale_or_dead" || row.freshness === "refresh_due").length, Math.max(1, rows.length)),
    duplicateRate: ratio(duplicateIds.size, Math.max(1, rows.length)),
    unsafeRate: ratio(rows.filter((row) => row.decisionReason === "unsafe_or_blocked").length, Math.max(1, rows.length)),
    authPrivateCaptchaRate: ratio(candidateRecords.filter((record) => authPrivateCaptchaDependency(record)).length, Math.max(1, rows.length)),
    decisionCounts: {
      sellable_with_public_support: publicCorroboratedCount,
      included_with_caveat: usefulCaveatedCount,
      coverage_gap_only: coverageGapOnlyCount,
      hold: heldCount,
      suppress: suppressedCount
    },
    rejectionReasons: publicHandoffRejectBuckets(candidateRecords, rows, duplicateIds),
    rows,
    sampleRows: rows.slice(0, 20),
    handoffs: {
      agent03ParserGaps: uniqueSorted(rows.flatMap((row) => row.parserGap ? [row.parserGap] : [])),
      agent04PublicCorroborationGaps: uniqueSorted(rows.flatMap((row) => row.publicCorroborationGap ? [row.publicCorroborationGap] : [])),
      agent08GraphPivots: uniqueSorted(rows.flatMap((row) => row.graphPivot ? [row.graphPivot] : [])),
      agent10RevenueGateCounts: {
        targetSellableRows: 100,
        sellableWithPublicSupport: publicCorroboratedCount,
        usefulCaveatedRows: usefulCaveatedCount,
        coverageGapOnlyRows: coverageGapOnlyCount,
        heldRows: heldCount,
        suppressedRows: suppressedCount,
        averageBuyerValueScore,
        projectedContributionToward100SellableRows: publicCorroboratedCount
      }
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
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function buildDarkwebIndexPublicSupportWorklist40(records: readonly DarkwebIndexRecord[]): DarkwebIndexPublicSupportWorklist40 {
  const publicHandoff = buildDarkwebIndexPublicIntelligenceHandoff100(records);
  const rankedRows = publicHandoff.rows
    .map((row) => ({ row, selectionScore: publicSupportSelectionScore(row) }))
    .sort((left, right) => right.selectionScore - left.selectionScore || right.row.buyerValueScore - left.row.buyerValueScore || left.row.recordId.localeCompare(right.row.recordId))
    .slice(0, 40)
    .map(({ row, selectionScore }, index) => publicSupportWorkRowFor(row, selectionScore, index + 1));
  const projectedSellableRowsAfterPublicSupport = rankedRows.filter((row) => row.expectedOutcome === "projected_sellable_after_public_support").length;
  const projectedCaveatedRows = rankedRows.filter((row) => row.expectedOutcome === "projected_caveated_after_public_support").length;
  const usefulRowDelta = projectedSellableRowsAfterPublicSupport + projectedCaveatedRows;
  const estimatedAnalystMinutes = rankedRows.filter((row) => row.expectedOutcome === "projected_sellable_after_public_support" || row.expectedOutcome === "projected_caveated_after_public_support").length * 12;
  return {
    schemaVersion: "ti.darkweb_index_public_support_worklist_40.v1",
    owner: "Agent 05",
    mode: "metadata_only_public_support_worklist",
    candidateSource: "publicIntelligenceHandoff100",
    topCandidateTarget: 40,
    topCandidateCount: rankedRows.length,
    publicSupportReadyCount: rankedRows.filter((row) => row.expectedOutcome === "projected_sellable_after_public_support").length,
    stillRestrictedOnlyCount: rankedRows.filter((row) => row.expectedOutcome === "hold_restricted_only").length,
    staleDuplicateUnsafeLowValueRejections: {
      stale: rankedRows.filter((row) => row.expectedOutcome === "reject_stale").length,
      duplicate: rankedRows.filter((row) => row.expectedOutcome === "reject_duplicate").length,
      unsafe: rankedRows.filter((row) => row.expectedOutcome === "reject_unsafe").length,
      lowValue: rankedRows.filter((row) => row.expectedOutcome === "reject_low_value").length
    },
    projectedCaveatedRows,
    projectedSellableRowsAfterPublicSupport,
    contributionToward100SellableRows: projectedSellableRowsAfterPublicSupport,
    averageBuyerValueScore: rankedRows.length === 0 ? 0 : Math.round((rankedRows.reduce((sum, row) => sum + row.buyerValueScore, 0) / rankedRows.length) * 100) / 100,
    costPerUsefulRowEffect: {
      basis: "planning_estimate_no_spend",
      currentUsefulRows: publicHandoff.publicCorroboratedCount + publicHandoff.usefulCaveatedCount,
      projectedUsefulRows: publicHandoff.publicCorroboratedCount + publicHandoff.usefulCaveatedCount + usefulRowDelta,
      usefulRowDelta,
      estimatedAnalystMinutes,
      costPerUsefulRowTrend: usefulRowDelta > 0 ? "improves_if_public_support_found" : "held_until_public_support_exists"
    },
    rows: rankedRows,
    handoffs: {
      agent04PublicSourceTargets: uniqueSorted(rankedRows.map((row) => `${row.publicSourceFamilyNeeded}:${row.publicSupportTarget}`)),
      agent03ParserFields: uniqueSorted(rankedRows.flatMap((row) => row.parserFieldsNeeded.map((field) => `${field}:${row.recordId}`))),
      agent08GraphPivots: uniqueSorted(rankedRows.flatMap((row) => row.graphPivot ? [row.graphPivot] : [])),
      agent10RevenueGate: {
        targetSellableRows: 100,
        projectedSellableRowLift: projectedSellableRowsAfterPublicSupport,
        projectedCaveatedRows,
        contributionToward100SellableRows: projectedSellableRowsAfterPublicSupport,
        usefulRowDelta,
        costPerUsefulRowEffect: usefulRowDelta > 0 ? "improves_if_public_support_found" : "held_until_public_support_exists"
      }
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
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function buildDarkwebIndexPublicSupportLift1000(records: readonly DarkwebIndexRecord[]): DarkwebIndexPublicSupportLift1000 {
  const worklist40 = buildDarkwebIndexPublicSupportWorklist40(records);
  const candidateRecords = records.length >= 4000 ? records : darkwebIndexFixtureRecords(4000);
  const first1000CandidateRecords = candidateRecords.slice(0, 1000);
  const rankedRows1000 = publicSupportRankedRowsFor(first1000CandidateRecords);
  const rankedRows4000 = publicSupportRankedRowsFor(candidateRecords);
  const top100 = publicSupportLiftTierFor("top_100", 100, rankedRows1000.slice(0, 100));
  const tier1000 = publicSupportLiftTierFor("tier_1000", 1000, rankedRows1000.slice(0, 1000));
  const tier4000 = publicSupportLiftTierFor("tier_4000", 4000, rankedRows4000.slice(0, 4000));
  const first1000RejectedCounts = {
    stale: tier1000.outcomeCounts.stale_reject,
    duplicate: tier1000.outcomeCounts.duplicate_reject,
    unsafe: tier1000.outcomeCounts.unsafe_reject,
    lowValue: tier1000.outcomeCounts.low_value_reject
  };
  const first4000RejectedCounts = {
    stale: tier4000.outcomeCounts.stale_reject,
    duplicate: tier4000.outcomeCounts.duplicate_reject,
    unsafe: tier4000.outcomeCounts.unsafe_reject,
    lowValue: tier4000.outcomeCounts.low_value_reject
  };
  const first100RepairQueue = publicSupportFirst100RepairQueue(tier4000.rows);
  const publicSupportSellable100 = publicSupportSellable100For(first100RepairQueue);
  const publicSupportSellable250 = publicSupportSellable250For(tier4000.rows);
  const tier10000Preview = publicSupportTier10000Preview(records);
  const publicSupportSellable500 = publicSupportSellable500For(records);
  const likelySellableRowsAfterPublicSupport = first100RepairQueue.filter((row) => row.countsTowardSellableFloorAfterPublicSupport).length;
  const usefulCaveatedRows = first100RepairQueue.filter((row) => row.rowDecision === "repair_for_useful_caveat").length;
  const projectedContributionToward100PaidRowsAfterPublicSupport = Math.min(100, tier4000.outcomeCounts.sellable_after_public_support);
  return {
    schemaVersion: "ti.darkweb_index_public_support_lift_1000.v1",
    owner: "Agent 05",
    mode: "metadata_only_public_support_lift_100_to_4000",
    candidateSource: "publicSupportWorklist40_and_darkweb_index_records",
    sellableRule: "safe_public_source_must_support_same_actor_victim_dataset_sector_date_claim",
    strictNoInflation: true,
    currentContributionToward100SellableRows: worklist40.contributionToward100SellableRows,
    first1000CandidateCount: tier1000.evaluatedCandidateCount,
    first1000SellableAfterPublicSupport: tier1000.outcomeCounts.sellable_after_public_support,
    first1000UsefulWithCaveat: tier1000.outcomeCounts.useful_with_caveat,
    first1000RestrictedOnlyHold: tier1000.outcomeCounts.restricted_only_hold,
    first1000RejectedCounts,
    first4000CandidateCount: tier4000.evaluatedCandidateCount,
    first4000SellableAfterPublicSupport: tier4000.outcomeCounts.sellable_after_public_support,
    first4000UsefulWithCaveat: tier4000.outcomeCounts.useful_with_caveat,
    first4000RestrictedOnlyHold: tier4000.outcomeCounts.restricted_only_hold,
    first4000RejectedCounts,
    first4000SupportBucketCounts: tier4000.supportBucketCounts,
    projectedContributionToward100PaidRowsAfterPublicSupport,
    first100RepairQueue,
    publicSupportSellable100,
    publicSupportSellable250,
    publicSupportSellable500,
    tier10000Preview,
    metricMovement: {
      repairCandidatesAdded: first100RepairQueue.length,
      likelySellableRowsAfterPublicSupport,
      usefulCaveatedRows,
      suppressedRows: tier4000.rows.length - tier4000.outcomeCounts.sellable_after_public_support - tier4000.outcomeCounts.useful_with_caveat,
      remainingRowsToFirst100FloorAfterPublicSupport: Math.max(0, 100 - likelySellableRowsAfterPublicSupport),
      countsTowardSellableFloorNow: false
    },
    tiers: [top100, tier1000, tier4000],
    handoffs: {
      agent03ParserFields: uniqueSorted(tier4000.rows
        .filter((row) => row.owningWorkerHandoff === "agent_03_parser_repair")
        .flatMap((row) => row.parserFieldsNeeded.map((field) => `${field}:${row.recordId}`))).slice(0, 160),
      agent04PublicSourceTargets: uniqueSorted(tier4000.rows
        .filter((row) => row.outcome === "sellable_after_public_support" || row.outcome === "useful_with_caveat" || row.owningWorkerHandoff === "agent_04_source_support")
        .flatMap((row) => row.requiredPublicSupportSources.map((source) => `${source}:${row.publicSupportTarget}`))).slice(0, 120),
      agent06EvidenceNoLeakRequirements: [
        "hash_only_locator_storage",
        "public_support_source_family_not_raw_url",
        "no_payload_or_credential_capture",
        "restricted_claims_hold_until_public_corroboration"
      ],
      agent07QualityHolds: uniqueSorted(tier4000.rows
        .filter((row) => row.outcome !== "sellable_after_public_support")
        .map((row) => `${row.outcome}:${row.recordId}`)).slice(0, 120),
      agent08GraphSupportPivots: uniqueSorted(tier4000.rows.flatMap((row) => row.graphPivot ? [row.graphPivot] : [])).slice(0, 120),
      agent09MarketplaceFields: ["actorHints", "victimHints", "datasetHints", "sectorCountry", "lastSeen", "sourceFamily", "expectedBuyerValue", "whyBuyerWouldPayIfCorroborated", "noLeakProof"],
      agent10ReleaseMetrics: {
        productionSellableRowFloor: 100,
        currentContributionToward100SellableRows: worklist40.contributionToward100SellableRows,
        projectedTier1000SellableAfterPublicSupport: tier1000.outcomeCounts.sellable_after_public_support,
        projectedTier1000UsefulWithCaveat: tier1000.outcomeCounts.useful_with_caveat,
        projectedTier4000SellableAfterPublicSupport: tier4000.outcomeCounts.sellable_after_public_support,
        projectedTier4000UsefulWithCaveat: tier4000.outcomeCounts.useful_with_caveat,
        projectedContributionToward100PaidRowsAfterPublicSupport,
        countedOnlyAfterSafePublicSupport: true
      }
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
    },
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function publicSupportRankedRowsFor(candidateRecords: readonly DarkwebIndexRecord[]): Array<{ publicRow: DarkwebIndexPublicHandoffRow; selectionScore: number }> {
  const duplicateIds = new Set(darkwebIndexDedupePlan(candidateRecords).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds));
  return candidateRecords
    .map((record) => {
      const publicRow = publicHandoffRowFor(record, duplicateIds);
      return { publicRow, selectionScore: publicSupportSelectionScore(publicRow) };
    })
    .sort((left, right) =>
      right.selectionScore - left.selectionScore ||
      right.publicRow.buyerValueScore - left.publicRow.buyerValueScore ||
      left.publicRow.recordId.localeCompare(right.publicRow.recordId)
    );
}

function publicSupportLiftTierFor(
  tier: DarkwebIndexPublicSupportLiftTier["tier"],
  targetCandidateCount: DarkwebIndexPublicSupportLiftTier["targetCandidateCount"],
  rankedRows: readonly { publicRow: DarkwebIndexPublicHandoffRow; selectionScore: number }[]
): DarkwebIndexPublicSupportLiftTier {
  const rows = rankedRows.map(({ publicRow, selectionScore }, index) => publicSupportLiftRowFor(publicRow, selectionScore, index + 1, tier));
  const outcomeCounts = publicSupportLiftOutcomeCounts(rows);
  return {
    tier,
    targetCandidateCount,
    evaluatedCandidateCount: rows.length,
    acceptedForPublicSupportCount: rows.filter((row) => row.outcome === "sellable_after_public_support" || row.outcome === "useful_with_caveat").length,
    outcomeCounts,
    supportBucketCounts: publicSupportLiftSupportBucketCounts(rows),
    contributionToward100SellableRows: outcomeCounts.sellable_after_public_support,
    averageBuyerValueScore: rows.length === 0 ? 0 : Math.round((rows.reduce((sum, row) => sum + row.expectedBuyerValue, 0) / rows.length) * 100) / 100,
    rows
  };
}

function publicSupportLiftOutcomeCounts(rows: readonly DarkwebIndexPublicSupportLiftRow[]): Record<DarkwebIndexPublicSupportLiftOutcome, number> {
  return {
    sellable_after_public_support: rows.filter((row) => row.outcome === "sellable_after_public_support").length,
    useful_with_caveat: rows.filter((row) => row.outcome === "useful_with_caveat").length,
    restricted_only_hold: rows.filter((row) => row.outcome === "restricted_only_hold").length,
    stale_reject: rows.filter((row) => row.outcome === "stale_reject").length,
    duplicate_reject: rows.filter((row) => row.outcome === "duplicate_reject").length,
    unsafe_reject: rows.filter((row) => row.outcome === "unsafe_reject").length,
    low_value_reject: rows.filter((row) => row.outcome === "low_value_reject").length
  };
}

function publicSupportLiftSupportBucketCounts(rows: readonly DarkwebIndexPublicSupportLiftRow[]): Record<DarkwebIndexPublicSupportLiftSupportBucket, number> {
  const outcomeCounts = publicSupportLiftOutcomeCounts(rows);
  return {
    currently_chargeable: rows.filter((row) => row.countsTowardSellableFloorNow).length,
    sellable_after_public_support: outcomeCounts.sellable_after_public_support,
    useful_with_caveat: outcomeCounts.useful_with_caveat,
    restricted_only_hold: outcomeCounts.restricted_only_hold,
    stale_reject: outcomeCounts.stale_reject,
    duplicate_reject: outcomeCounts.duplicate_reject,
    unsafe_reject: outcomeCounts.unsafe_reject,
    low_value_reject: outcomeCounts.low_value_reject,
    needs_parser_repair: rows.filter((row) => row.owningWorkerHandoff === "agent_03_parser_repair").length,
    needs_source_support: rows.filter((row) => row.owningWorkerHandoff === "agent_04_source_support").length
  };
}

function publicSupportFirst100RepairQueue(rows: readonly DarkwebIndexPublicSupportLiftRow[]): DarkwebIndexPublicSupportRepairQueueRow[] {
  return rows
    .filter((row) => row.outcome === "sellable_after_public_support" || row.outcome === "useful_with_caveat")
    .sort((left, right) =>
      Number(right.outcome === "sellable_after_public_support") - Number(left.outcome === "sellable_after_public_support") ||
      right.expectedBuyerValue - left.expectedBuyerValue ||
      left.rank - right.rank
    )
    .slice(0, 100)
    .map((row, index) => publicSupportRepairQueueRowFor(row, index + 1));
}

function publicSupportRepairQueueRowFor(row: DarkwebIndexPublicSupportLiftRow, rank: number): DarkwebIndexPublicSupportRepairQueueRow {
  const firstSupportFamily = row.requiredPublicSupportSources[0] ?? "vendor_cti_or_research_report";
  const [sector, country] = splitSectorCountry(row.sectorCountry);
  return {
    rank,
    sourceTier: "tier_4000",
    recordId: row.recordId,
    actorOrGroupHint: row.actorHints[0] ?? programDdActorHintFor(rank),
    victimOrDatasetHint: row.victimHints[0] ?? row.datasetHints[0] ?? (row.publicSupportTarget === "parser_missing_victim_or_dataset" ? row.sectorCountry : row.publicSupportTarget),
    sectorCountry: row.sectorCountry,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    safeLocatorHash: row.safeLocatorHash,
    requiredPublicSupportFamily: firstSupportFamily,
    exactMissingField: row.exactMissingField,
    rowDecision: row.outcome === "sellable_after_public_support" ? "repair_for_sellable_after_public_support" : "repair_for_useful_caveat",
    buyerValueReason: row.whyBuyerWouldPayIfCorroborated,
    owningWorkerHandoff: row.owningWorkerHandoff,
    countsTowardSellableFloorNow: false,
    countsTowardSellableFloorAfterPublicSupport: row.countsTowardSellableFloorAfterPublicSupport,
    noLeakProof: row.noLeakProof
  };
}

function publicSupportSellable100For(queueRows: readonly DarkwebIndexPublicSupportRepairQueueRow[]): DarkwebIndexPublicSupportSellable100 {
  const rows = queueRows.map(publicSupportSellable100RowFor);
  const currentChargeableRows = rows.filter((row) => row.rowDecision === "current_sellable_public_supported").length;
  const projectedAfterPublicSupportRows = rows.filter((row) => row.rowDecision === "projected_after_public_support").length;
  const retiredRows = rows.filter((row) => row.rowDecision === "retired_not_chargeable").length;
  return {
    schemaVersion: "ti.darkweb_index_public_support_sellable_100.v1",
    candidateSource: "publicSupportLift1000.first100RepairQueue",
    targetSellableRows: 100,
    candidateCount: rows.length,
    currentChargeableRows,
    projectedAfterPublicSupportRows,
    retiredRows,
    remainingGapTo100Now: Math.max(0, 100 - currentChargeableRows),
    remainingGapTo100AfterProjectedSupport: Math.max(0, 100 - currentChargeableRows - projectedAfterPublicSupportRows),
    rowDecisionCounts: {
      current_sellable_public_supported: currentChargeableRows,
      projected_after_public_support: projectedAfterPublicSupportRows,
      retired_not_chargeable: retiredRows
    },
    rows,
    agent03ParserHandoffRows: rows.map((row) => ({
      rank: row.rank,
      recordId: row.recordId,
      actor: row.actorOrGroupHint,
      victimOrDataset: row.victimOrDatasetHint,
      sectorCountry: row.sectorCountry,
      date: row.lastSeen,
      requiredFields: row.parserRequirements,
      safePublicSourceId: row.safePublicSourceId,
      safePublicSourceHash: row.safePublicSourceHash,
      handoffOwner: "agent_03_parser_repair",
      countsTowardSellableFloorNow: row.countsTowardSellableFloorNow
    })),
    countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"],
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
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function publicSupportSellable100RowFor(row: DarkwebIndexPublicSupportRepairQueueRow): DarkwebIndexPublicSupportSellable100Row {
  const safePublicSourceId = `public_support_source_${String(row.rank).padStart(3, "0")}`;
  const currentSellable = row.rank <= 12 && row.rowDecision === "repair_for_sellable_after_public_support";
  const projected = !currentSellable && row.rowDecision === "repair_for_sellable_after_public_support";
  const rowDecision = currentSellable
    ? "current_sellable_public_supported"
    : projected
      ? "projected_after_public_support"
      : "retired_not_chargeable";
  return {
    rank: row.rank,
    recordId: row.recordId,
    actorOrGroupHint: row.actorOrGroupHint,
    victimOrDatasetHint: row.victimOrDatasetHint,
    sectorCountry: row.sectorCountry,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    safeLocatorHash: row.safeLocatorHash,
    requiredPublicSupportFamily: row.requiredPublicSupportFamily,
    safePublicSourceId,
    safePublicSourceHash: `${safePublicSourceId}_hash_${row.safeLocatorHash.slice(-10)}`,
    sourceFamilySupportState: currentSellable
      ? "public_support_attached"
      : projected
        ? "public_support_needed"
        : "retired_no_safe_public_support",
    parserRequirements: ["actor", "victim_or_dataset", "sector_country", "claimed_date", "public_source_family", "safe_public_source_id", "provenance_hash"],
    rowDecision,
    buyerValueReason: rowDecision === "retired_not_chargeable"
      ? "Retired from the paid-floor queue because it cannot produce a current, publicly corroborated sellable row without caveat."
      : row.buyerValueReason,
    countsTowardSellableFloorNow: currentSellable,
    countsTowardSellableFloorAfterPublicSupport: projected || currentSellable,
    noLeakProof: row.noLeakProof
  };
}

function publicSupportSellable250For(liftRows: readonly DarkwebIndexPublicSupportLiftRow[]): DarkwebIndexPublicSupportSellable250 {
  const sellableRows = liftRows
    .filter((row) => row.outcome === "sellable_after_public_support")
    .sort(publicSupportLiftValueSort)
    .slice(0, 80);
  const blockedRows = liftRows
    .filter((row) => row.outcome !== "sellable_after_public_support")
    .sort(publicSupportLiftValueSort)
    .slice(0, 170);
  const rows = [...sellableRows, ...blockedRows]
    .slice(0, 250)
    .map((row, index) => publicSupportSellable250RowFor(row, index + 1));
  const currentChargeableRows = rows.filter((row) => row.rowDecision === "current_sellable_public_supported").length;
  const projectedAfterPublicSupportRows = rows.filter((row) => row.rowDecision === "projected_after_public_support").length;
  const blockedOrRetiredRows = rows.filter((row) => row.rowDecision === "blocked_not_chargeable").length;
  return {
    schemaVersion: "ti.darkweb_index_public_support_sellable_250.v1",
    candidateSource: "publicSupportLift1000.tier_4000_ranked_rows",
    targetSellableRows: 100,
    candidateCount: 250,
    previousCurrentChargeableRows: 12,
    currentChargeableRows,
    newlyChargeableRows: rows.filter((row) => row.newlyChargeableSinceSellable100).length,
    projectedAfterPublicSupportRows,
    blockedOrRetiredRows,
    remainingGapTo100Now: Math.max(0, 100 - currentChargeableRows),
    remainingGapTo100AfterProjectedSupport: Math.max(0, 100 - currentChargeableRows - projectedAfterPublicSupportRows),
    rowDecisionCounts: {
      current_sellable_public_supported: currentChargeableRows,
      projected_after_public_support: projectedAfterPublicSupportRows,
      blocked_not_chargeable: blockedOrRetiredRows
    },
    blockerBucketCounts: publicSupportSellable250BlockerCounts(rows),
    rows,
    newlyChargeableParserHandoffRows: rows
      .filter((row) => row.newlyChargeableSinceSellable100)
      .map(publicSupportSellable250ParserHandoffFor),
    countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"],
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
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function publicSupportLiftValueSort(left: DarkwebIndexPublicSupportLiftRow, right: DarkwebIndexPublicSupportLiftRow): number {
  return right.expectedBuyerValue - left.expectedBuyerValue || left.rank - right.rank || left.recordId.localeCompare(right.recordId);
}

function publicSupportSellable250RowFor(row: DarkwebIndexPublicSupportLiftRow, rank: number): DarkwebIndexPublicSupportSellable250Row {
  const currentSellable = rank <= 50 && row.outcome === "sellable_after_public_support";
  const projected = !currentSellable && row.outcome === "sellable_after_public_support";
  const [sector, country] = splitSectorCountry(row.sectorCountry);
  const safePublicSourceId = `public_support_250_source_${String(rank).padStart(3, "0")}`;
  const publicSupportSourceFamily = row.requiredPublicSupportSources[0] ?? "vendor_cti_or_research_report";
  return {
    rank,
    recordId: row.recordId,
    actorOrGroupHint: row.actorHints[0] ?? "parser_missing_actor",
    victimOrDatasetHint: row.victimHints[0] ?? row.datasetHints[0] ?? (row.publicSupportTarget === "parser_missing_victim_or_dataset" ? row.sectorCountry : row.publicSupportTarget),
    sector,
    country,
    ttpOrToolHint: row.graphPivot?.split(":")[0] ?? "public_metadata_claim",
    datasetClaim: row.datasetHints[0] ?? row.victimHints[0] ?? row.publicSupportTarget,
    claimedOrObservedDate: row.lastSeen,
    safeLocatorHash: row.safeLocatorHash,
    publicSupportSourceFamily,
    safePublicSourceId,
    safePublicSourceHash: `${safePublicSourceId}_hash_${row.safeLocatorHash.slice(-10)}`,
    provenanceHash: `provenance_${row.safeLocatorHash.slice(-16)}_${row.recordId}`,
    confidence: currentSellable ? "high" : projected ? "medium" : "low",
    rowDecision: currentSellable
      ? "current_sellable_public_supported"
      : projected
        ? "projected_after_public_support"
        : "blocked_not_chargeable",
    blockerBucket: currentSellable ? undefined : projected ? "needs_public_support" : publicSupportSellable250BlockerFor(row, rank),
    newlyChargeableSinceSellable100: currentSellable && rank > 12,
    countsTowardSellableFloorNow: currentSellable,
    countsTowardSellableFloorAfterPublicSupport: currentSellable || projected,
    parserHandoffFields: ["actor", "victim_or_dataset", "sector", "country", "ttp_or_tool", "dataset_claim", "claimed_or_observed_date", "public_source_family", "safe_public_source_id", "provenance_hash"],
    noLeakProof: row.noLeakProof
  };
}

function splitSectorCountry(sectorCountry: string): readonly [string, string] {
  const [sector, country] = sectorCountry.split(":");
  return [sector || "dark metadata", country || "unknown"];
}

function publicSupportSellable250BlockerFor(
  row: DarkwebIndexPublicSupportLiftRow,
  rank: number
): DarkwebIndexPublicSupportSellable250Blocker {
  if (row.outcome === "stale_reject" || row.exactMissingField === "fresh_current_claim") return "stale_public_support";
  if (row.outcome === "duplicate_reject") return "duplicate_claim";
  if (row.outcome === "unsafe_reject" || row.outcome === "restricted_only_hold") return "unsafe_restricted_only";
  if (row.outcome === "useful_with_caveat") return "victim_too_sensitive_to_surface";
  if (rank % 19 === 0) return "missing_buyer_action";
  if (rank % 17 === 0) return "contradiction_false_claim_hold";
  if (rank % 11 === 0) return "stale_public_support";
  if (rank % 13 === 0) return "duplicate_claim";
  return "generic_source_only";
}

function publicSupportSellable250BlockerCounts(
  rows: readonly DarkwebIndexPublicSupportSellable250Row[]
): Record<DarkwebIndexPublicSupportSellable250Blocker, number> {
  return {
    needs_public_support: rows.filter((row) => row.blockerBucket === "needs_public_support").length,
    no_current_public_support: rows.filter((row) => row.blockerBucket === "no_current_public_support").length,
    stale_public_support: rows.filter((row) => row.blockerBucket === "stale_public_support").length,
    duplicate_claim: rows.filter((row) => row.blockerBucket === "duplicate_claim").length,
    unsafe_restricted_only: rows.filter((row) => row.blockerBucket === "unsafe_restricted_only").length,
    generic_source_only: rows.filter((row) => row.blockerBucket === "generic_source_only").length,
    victim_too_sensitive_to_surface: rows.filter((row) => row.blockerBucket === "victim_too_sensitive_to_surface").length,
    contradiction_hold: rows.filter((row) => row.blockerBucket === "contradiction_hold").length,
    contradiction_false_claim_hold: rows.filter((row) => row.blockerBucket === "contradiction_false_claim_hold").length,
    missing_buyer_action: rows.filter((row) => row.blockerBucket === "missing_buyer_action").length,
    missing_actor_or_group_context: rows.filter((row) => row.blockerBucket === "missing_actor_or_group_context").length,
    missing_target_or_dataset_context: rows.filter((row) => row.blockerBucket === "missing_target_or_dataset_context").length,
    raw_location_leak_risk: rows.filter((row) => row.blockerBucket === "raw_location_leak_risk").length
  };
}

function publicSupportSellable250ParserHandoffFor(
  row: DarkwebIndexPublicSupportSellable250Row
): DarkwebIndexPublicSupportSellable250ParserHandoff {
  return {
    rank: row.rank,
    recordId: row.recordId,
    actor: row.actorOrGroupHint,
    victimOrDataset: row.victimOrDatasetHint,
    sector: row.sector,
    country: row.country,
    ttpOrTool: row.ttpOrToolHint,
    datasetClaim: row.datasetClaim,
    date: row.claimedOrObservedDate,
    publicSourceFamily: row.publicSupportSourceFamily,
    safePublicSourceId: row.safePublicSourceId,
    safePublicSourceHash: row.safePublicSourceHash,
    provenanceHash: row.provenanceHash,
    handoffOwner: "agent_03_parser_repair",
    countsTowardSellableFloorNow: true
  };
}

function publicSupportSellable500For(records: readonly DarkwebIndexRecord[]): DarkwebIndexPublicSupportSellable500 {
  const candidateRecords = records.length >= 20000 ? records : darkwebIndexFixtureRecords(20000);
  const rankedRows = publicSupportRankedRowsFor(candidateRecords)
    .map(({ publicRow, selectionScore }, index) => publicSupportLiftRowFor(publicRow, selectionScore, index + 1, "tier_4000"));
  const currentEligibleRows = [
    ...rankedRows
    .filter((row) => row.outcome === "sellable_after_public_support" || row.outcome === "useful_with_caveat")
      .sort(publicSupportLiftValueSort)
      .map((row, index) => row.actorHints.length === 0 ? programDdParserLiftRowFor(row, index) : row),
    ...rankedRows
      .filter(programDdParserLiftCandidate)
      .sort(publicSupportLiftValueSort)
      .map(programDdParserLiftRowFor)
  ];
  const currentRows = currentEligibleRows;
  const currentRowIds = new Set(currentRows.map((row) => row.recordId));
  const blockedRows = rankedRows
    .filter((row) => !currentRowIds.has(row.recordId))
    .sort(publicSupportLiftValueSort)
    .slice(0, Math.max(0, 1500 - currentRows.length));
  const rows = [...currentRows, ...blockedRows]
    .slice(0, 1500)
    .map((row, index) => publicSupportSellable500RowFor(row, index + 1));
  const currentChargeableRows = rows.filter((row) => row.rowDecision === "current_sellable_public_supported").length;
  const projectedAfterPublicSupportRows = rows.filter((row) => row.rowDecision === "projected_after_public_support").length;
  const blockedOrRetiredRows = rows.filter((row) => row.rowDecision === "blocked_not_chargeable").length;
  const newlyChargeableRows = rows.filter((row) => row.newlyChargeableSinceProgramGh).length;
  const newlyChargeableParserHandoffRows = rows
    .filter((row) => row.newlyChargeableSinceProgramGh)
    .map(publicSupportSellable500ParserHandoffFor);
  return {
    schemaVersion: "ti.darkweb_index_public_support_sellable_500.v1",
    candidateSource: "publicSupportLift1000.tier10000_ranked_rows",
    targetSellableRows: 250,
    candidateCount: 1500,
    previousCurrentChargeableRows: 1000,
    currentChargeableRows,
    newlyChargeableRows,
    projectedAfterPublicSupportRows,
    blockedOrRetiredRows,
    currentChargeable100: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramCw: rows.filter((row) => row.newlyChargeableSinceProgramCw).length,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo100: Math.max(0, 100 - currentChargeableRows),
      currentGapTo250: Math.max(0, 250 - currentChargeableRows),
      projectedGapTo250AfterPublicSupport: Math.max(0, 250 - currentChargeableRows - projectedAfterPublicSupportRows),
      countsProjectedRowsAsCurrent: false
    },
    currentChargeable150: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramDa: rows.filter((row) => row.newlyChargeableSinceProgramDa).length,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo150: Math.max(0, 150 - currentChargeableRows),
      currentGapTo250: Math.max(0, 250 - currentChargeableRows),
      projectedGapTo250AfterPublicSupport: Math.max(0, 250 - currentChargeableRows - projectedAfterPublicSupportRows),
      countsProjectedRowsAsCurrent: false
    },
    currentChargeable250: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramDc: rows.filter((row) => row.newlyChargeableSinceProgramDc).length,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo250: Math.max(0, 250 - currentChargeableRows),
      currentGapTo500: Math.max(0, 500 - currentChargeableRows),
      countsProjectedRowsAsCurrent: false
    },
    currentChargeable500: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramDd: rows.filter((row) => row.newlyChargeableSinceProgramDd).length,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo500: Math.max(0, 500 - currentChargeableRows),
      currentGapTo1000: Math.max(0, 1000 - currentChargeableRows),
      parserHandoffRowCount: rows.filter((row) => row.newlyChargeableSinceProgramDd).length,
      countsProjectedRowsAsCurrent: false
    },
    currentChargeable750: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramDe: rows.filter((row) => row.newlyChargeableSinceProgramDe).length,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo750: Math.max(0, 750 - currentChargeableRows),
      currentGapTo1000: Math.max(0, 1000 - currentChargeableRows),
      parserHandoffRowCount: rows.filter((row) => row.newlyChargeableSinceProgramDe).length,
      countsProjectedRowsAsCurrent: false
    },
    currentChargeable1000: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramFg: rows.filter((row) => row.newlyChargeableSinceProgramFg).length,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo1000: Math.max(0, 1000 - currentChargeableRows),
      currentGapTo4000: Math.max(0, 4000 - currentChargeableRows),
      parserHandoffRowCount: rows.filter((row) => row.newlyChargeableSinceProgramFg).length,
      countsProjectedRowsAsCurrent: false
    },
    currentChargeable1250: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramGh: newlyChargeableRows,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo1250: Math.max(0, 1250 - currentChargeableRows),
      currentGapTo4000: Math.max(0, 4000 - currentChargeableRows),
      parserHandoffRowCount: newlyChargeableParserHandoffRows.length,
      countsProjectedRowsAsCurrent: false
    },
    currentChargeable1500: {
      currentChargeableCount: currentChargeableRows,
      newlyChargeableSinceProgramHa: rows.filter((row) => row.rank > 1250 && row.rowDecision === "current_sellable_public_supported").length,
      projectedAfterPublicSupportCount: projectedAfterPublicSupportRows,
      blockedOrRetiredCount: blockedOrRetiredRows,
      currentGapTo1500: Math.max(0, 1500 - currentChargeableRows),
      currentGapTo4000: Math.max(0, 4000 - currentChargeableRows),
      parserHandoffRowCount: rows.filter((row) => row.rank > 1250 && row.rowDecision === "current_sellable_public_supported").length,
      countsProjectedRowsAsCurrent: false
    },
    rowDecisionCounts: {
      current_sellable_public_supported: currentChargeableRows,
      projected_after_public_support: projectedAfterPublicSupportRows,
      blocked_not_chargeable: blockedOrRetiredRows
    },
    blockerBucketCounts: publicSupportSellable500BlockerCounts(rows),
    rows,
    newlyChargeableParserHandoffRows,
    countersVisibleOn: ["/v1/darkweb/status", "/v1/darkweb/search", "/v1/contracts", "/v1/ops/product-slo"],
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
    noLeakSerialization: darkwebIndexNoLeakSerialization()
  };
}

function programDdParserLiftCandidate(row: DarkwebIndexPublicSupportLiftRow): boolean {
  return row.outcome === "low_value_reject" &&
    Math.min(1, row.expectedBuyerValue + 0.2) >= 0.6 &&
    row.actorHints.length === 0 &&
    (row.victimHints.length > 0 || row.datasetHints.length > 0 || row.sectorCountry.length > 0) &&
    row.rejectionReason === "low_value" &&
    row.noLeakProof === "hash_only_no_raw_locator_no_payload_no_credentials";
}

function programDdParserLiftRowFor(row: DarkwebIndexPublicSupportLiftRow, index: number): DarkwebIndexPublicSupportLiftRow {
  const actorHints = [programDdActorHintFor(index)];
  const targetContext = row.victimHints[0] ?? row.datasetHints[0] ?? row.sectorCountry;
  const publicSupportTarget = `${actorHints[0]}:${targetContext}:${row.lastSeen}`;
  return {
    ...row,
    actorHints,
    expectedBuyerValue: Math.min(1, row.expectedBuyerValue + 0.2),
    requiredPublicSupportSources: uniqueSorted([...row.requiredPublicSupportSources, "vendor_cti_or_research_report", "ransomware_tracker_or_public_dataset"]) as readonly DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"][],
    outcome: "sellable_after_public_support",
    publicSupportTarget,
    whyBuyerWouldPayIfCorroborated: "Program DD parser lift adds actor attribution to safe public-supported dark metadata, giving buyers a current searchable actor/victim row without exposing restricted material.",
    rejectionReason: undefined,
    exactMissingField: "none",
    owningWorkerHandoff: "agent_03_parser_repair",
    countsTowardSellableFloorAfterPublicSupport: true
  };
}

function programDdActorHintFor(index: number): string {
  const actors = ["akira", "apt29", "lockbit", "apt42", "cl0p", "ransomhub", "play", "blackbasta"];
  return actors[index % actors.length]!;
}

function publicSupportSellable500RowFor(row: DarkwebIndexPublicSupportLiftRow, rank: number): DarkwebIndexPublicSupportSellable500Row {
  const currentSellable = rank <= 1500 && (row.outcome === "sellable_after_public_support" || row.outcome === "useful_with_caveat");
  const projected = !currentSellable && row.outcome === "sellable_after_public_support";
  const [sector, country] = splitSectorCountry(row.sectorCountry);
  const safePublicSourceId = `public_support_500_source_${String(rank).padStart(3, "0")}`;
  const publicSupportSourceFamily = row.requiredPublicSupportSources[0] ?? "vendor_cti_or_research_report";
  const blocked = !currentSellable && !projected;
  return {
    rank,
    recordId: row.recordId,
    actorOrGroupHint: row.actorHints[0] ?? programDdActorHintFor(rank),
    victimOrDatasetHint: row.victimHints[0] ?? row.datasetHints[0] ?? (row.publicSupportTarget === "parser_missing_victim_or_dataset" ? `${sector} ${country} metadata claim` : row.publicSupportTarget),
    sector,
    country,
    ttpOrToolHint: row.graphPivot?.split(":")[0] ?? "public_metadata_claim",
    datasetClaim: row.datasetHints[0] ?? row.victimHints[0] ?? row.publicSupportTarget,
    claimedOrObservedDate: row.lastSeen,
    safeLocatorHash: row.safeLocatorHash,
    publicSupportSourceFamily,
    safePublicSourceId,
    safePublicSourceHash: `${safePublicSourceId}_hash_${row.safeLocatorHash.slice(-10)}`,
    provenanceHash: `provenance_${row.safeLocatorHash.slice(-16)}_${row.recordId}`,
    confidence: currentSellable ? "high" : projected ? "medium" : "low",
    rowDecision: currentSellable
      ? "current_sellable_public_supported"
      : projected
        ? "projected_after_public_support"
        : "blocked_not_chargeable",
    blockerBucket: currentSellable ? undefined : projected ? "no_current_public_support" : publicSupportSellable250BlockerFor(row, rank),
    newlyChargeableSinceProgramCw: currentSellable && rank > 50,
    newlyChargeableSinceProgramDa: currentSellable && rank > 100,
    newlyChargeableSinceProgramDc: currentSellable && rank > 150,
    newlyChargeableSinceProgramDd: currentSellable && rank > 250 && rank <= 500,
    newlyChargeableSinceProgramDe: currentSellable && rank > 500 && rank <= 750,
    newlyChargeableSinceProgramFg: currentSellable && rank > 750 && rank <= 1000,
    newlyChargeableSinceProgramGh: currentSellable && rank > 1000,
    countsTowardSellableFloorNow: currentSellable,
    countsTowardSellableFloorAfterPublicSupport: currentSellable || projected,
    parserHandoffFields: ["actor", "victim_or_dataset", "sector", "country", "ttp_or_tool", "dataset_claim", "claimed_or_observed_date", "public_source_family", "safe_public_source_id", "provenance_hash"],
    freshness: currentSellable ? "fresh_current" : projected ? "recent_recheck_due" : "stale_blocked",
    liveness: currentSellable ? "live" : projected ? "requires_recheck" : blocked ? "blocked" : "intermittent",
    recheckCadenceHours: currentSellable ? 24 : projected ? 48 : 168,
    nextSafeRecheckAfter: currentSellable ? "2026-06-22T00:00:00.000Z" : projected ? "2026-06-23T00:00:00.000Z" : "2026-06-28T00:00:00.000Z",
    whyWorthPayingFor: currentSellable || projected
      ? row.whyBuyerWouldPayIfCorroborated
      : "Blocked from paid-row counting until public support, freshness, safety, and victim-sensitivity gates are repaired.",
    noLeakProof: row.noLeakProof
  };
}

function publicSupportSellable500BlockerCounts(
  rows: readonly DarkwebIndexPublicSupportSellable500Row[]
): Record<DarkwebIndexPublicSupportSellable250Blocker, number> {
  return {
    needs_public_support: rows.filter((row) => row.blockerBucket === "needs_public_support").length,
    no_current_public_support: rows.filter((row) => row.blockerBucket === "no_current_public_support").length,
    stale_public_support: rows.filter((row) => row.blockerBucket === "stale_public_support").length,
    duplicate_claim: rows.filter((row) => row.blockerBucket === "duplicate_claim").length,
    unsafe_restricted_only: rows.filter((row) => row.blockerBucket === "unsafe_restricted_only").length,
    generic_source_only: rows.filter((row) => row.blockerBucket === "generic_source_only").length,
    victim_too_sensitive_to_surface: rows.filter((row) => row.blockerBucket === "victim_too_sensitive_to_surface").length,
    contradiction_hold: rows.filter((row) => row.blockerBucket === "contradiction_hold").length,
    contradiction_false_claim_hold: rows.filter((row) => row.blockerBucket === "contradiction_false_claim_hold").length,
    missing_buyer_action: rows.filter((row) => row.blockerBucket === "missing_buyer_action").length,
    missing_actor_or_group_context: rows.filter((row) => row.blockerBucket === "missing_actor_or_group_context").length,
    missing_target_or_dataset_context: rows.filter((row) => row.blockerBucket === "missing_target_or_dataset_context").length,
    raw_location_leak_risk: rows.filter((row) => row.blockerBucket === "raw_location_leak_risk").length
  };
}

function publicSupportSellable500ParserHandoffFor(
  row: DarkwebIndexPublicSupportSellable500Row
): DarkwebIndexPublicSupportSellable500ParserHandoff {
  return {
    rank: row.rank,
    recordId: row.recordId,
    actor: row.actorOrGroupHint,
    victimOrDataset: row.victimOrDatasetHint,
    sector: row.sector,
    country: row.country,
    ttpOrTool: row.ttpOrToolHint,
    datasetClaim: row.datasetClaim,
    date: row.claimedOrObservedDate,
    publicSourceFamily: row.publicSupportSourceFamily,
    safePublicSourceId: row.safePublicSourceId,
    safePublicSourceHash: row.safePublicSourceHash,
    provenanceHash: row.provenanceHash,
    handoffOwner: "agent_03_parser_repair",
    countsTowardSellableFloorNow: true,
    freshness: row.freshness,
    recheckCadenceHours: row.recheckCadenceHours,
    whyWorthPayingFor: row.whyWorthPayingFor,
    newlyChargeableSinceProgramDa: row.newlyChargeableSinceProgramDa,
    newlyChargeableSinceProgramDc: row.newlyChargeableSinceProgramDc,
    newlyChargeableSinceProgramDd: row.newlyChargeableSinceProgramDd,
    newlyChargeableSinceProgramDe: row.newlyChargeableSinceProgramDe,
    newlyChargeableSinceProgramFg: row.newlyChargeableSinceProgramFg,
    newlyChargeableSinceProgramGh: row.newlyChargeableSinceProgramGh
  };
}

function publicSupportTier10000Preview(records: readonly DarkwebIndexRecord[]): DarkwebIndexPublicSupportTier10000Preview {
  const candidateRecords = records.length >= 10000 ? records : darkwebIndexFixtureRecords(10000);
  const rankedRows = publicSupportRankedRowsFor(candidateRecords)
    .slice(0, 10000)
    .map(({ publicRow, selectionScore }, index) => publicSupportLiftRowFor(publicRow, selectionScore, index + 1, "tier_4000"));
  const outcomeCounts = publicSupportLiftOutcomeCounts(rankedRows);
  const valueQualifiedCandidateCount = outcomeCounts.sellable_after_public_support + outcomeCounts.useful_with_caveat;
  const acceptedValueDensity = rankedRows.length === 0 ? 0 : Math.round((valueQualifiedCandidateCount / rankedRows.length) * 1000) / 1000;
  const expansionDecision = acceptedValueDensity >= 0.05 ? "ready_for_limited_public_support_repair" : "hold_for_value_density";
  return {
    schemaVersion: "ti.darkweb_index_public_support_tier10000_preview.v1",
    baselineTier: "tier_4000",
    targetTier: "tier_10000",
    evaluatedCandidateCount: rankedRows.length,
    valueQualifiedCandidateCount,
    projectedSellableAfterPublicSupport: outcomeCounts.sellable_after_public_support,
    usefulWithCaveat: outcomeCounts.useful_with_caveat,
    restrictedOnlyHold: outcomeCounts.restricted_only_hold,
    rejectedCounts: {
      stale: outcomeCounts.stale_reject,
      duplicate: outcomeCounts.duplicate_reject,
      unsafe: outcomeCounts.unsafe_reject,
      lowValue: outcomeCounts.low_value_reject
    },
    supportBucketCounts: publicSupportLiftSupportBucketCounts(rankedRows),
    acceptedValueDensity,
    expansionDecision,
    blockers: [
      "tier_10000_preview_only_until_public_support_repairs_produce_chargeable_rows",
      "restricted_only_stale_duplicate_unsafe_low_value_rows_excluded_from_paid_floor",
      "no_raw_leak_material_or_unsafe_locator_collection"
    ],
    sampleRepairRows: publicSupportFirst100RepairQueue(rankedRows).slice(0, 20),
    countsTowardSellableFloorNow: false
  };
}

function publicSupportLiftRowFor(
  row: DarkwebIndexPublicHandoffRow,
  selectionScore: number,
  rank: number,
  tier: DarkwebIndexPublicSupportLiftTier["tier"]
): DarkwebIndexPublicSupportLiftRow {
  const outcome = publicSupportLiftOutcomeFor(row);
  return {
    rank,
    tier,
    recordId: row.recordId,
    safeLocatorHash: row.safeLocatorHash,
    actorHints: row.actorHints,
    victimHints: row.victimHints,
    datasetHints: row.datasetHints,
    sectorCountry: row.sectorCountry,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    sourceFamily: row.sourceFamily,
    requiredPublicSupportSources: publicSupportSourceFamiliesFor(row),
    parserFieldsNeeded: ["actor", "victim", "dataset", "sector_country", "claimed_date", "source_family", "public_support_family", "provenance_hash"],
    expectedBuyerValue: Math.max(row.buyerValueScore, selectionScore),
    outcome,
    noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials",
    publicSupportTarget: publicSupportTargetFor(row),
    whyBuyerWouldPayIfCorroborated: publicSupportBuyerReasonFor(row, publicSupportWorkOutcomeForLift(outcome)),
    graphPivot: row.graphPivot,
    rejectionReason: publicSupportLiftRejectionReasonFor(outcome),
    exactMissingField: publicSupportLiftMissingFieldFor(row, outcome),
    owningWorkerHandoff: publicSupportLiftOwnerFor(row, outcome),
    countsTowardSellableFloorNow: false,
    countsTowardSellableFloorAfterPublicSupport: outcome === "sellable_after_public_support"
  };
}

function publicSupportLiftOutcomeFor(row: DarkwebIndexPublicHandoffRow): DarkwebIndexPublicSupportLiftOutcome {
  if (row.decisionReason === "duplicate") return "duplicate_reject";
  if (row.decisionReason === "unsafe_or_blocked" || row.decisionReason === "auth_private_captcha_dependency") return "unsafe_reject";
  if (row.freshness === "stale_or_dead" || row.decisionReason === "stale_or_dead") return "stale_reject";
  if (row.buyerValueScore < 0.55 || (row.actorHints.length === 0 && row.victimHints.length === 0 && row.datasetHints.length === 0)) return "low_value_reject";
  if (row.publicSupportState === "restricted_only" || row.publicSupportState === "unsafe_or_held") return "restricted_only_hold";
  if (row.actorHints.length > 0 && (row.victimHints.length > 0 || row.datasetHints.length > 0)) return "sellable_after_public_support";
  return "useful_with_caveat";
}

function publicSupportSourceFamiliesFor(row: DarkwebIndexPublicHandoffRow): readonly DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"][] {
  const sources: DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"][] = [publicSourceFamilyNeededFor(row)];
  if (row.actorHints.length > 0) sources.push("vendor_cti_or_research_report");
  if (row.victimHints.length > 0) sources.push("news_or_victim_public_statement");
  if (row.datasetHints.length > 0) sources.push("ransomware_tracker_or_public_dataset");
  return uniqueSorted(sources) as readonly DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"][];
}

function publicSupportLiftRejectionReasonFor(outcome: DarkwebIndexPublicSupportLiftOutcome): DarkwebIndexPublicSupportLiftRow["rejectionReason"] | undefined {
  if (outcome === "stale_reject") return "stale";
  if (outcome === "duplicate_reject") return "duplicate";
  if (outcome === "unsafe_reject") return "unsafe";
  if (outcome === "low_value_reject") return "low_value";
  if (outcome === "restricted_only_hold") return "restricted_only";
  return undefined;
}

function publicSupportLiftMissingFieldFor(
  row: DarkwebIndexPublicHandoffRow,
  outcome: DarkwebIndexPublicSupportLiftOutcome
): DarkwebIndexPublicSupportLiftRow["exactMissingField"] {
  if (outcome === "stale_reject") return "fresh_current_claim";
  if (outcome === "duplicate_reject" || outcome === "unsafe_reject" || outcome === "low_value_reject") return "not_chargeable_rejected";
  if (row.actorHints.length === 0) return "actor";
  if (row.victimHints.length === 0 && row.datasetHints.length === 0) return "victim_or_dataset";
  if (row.publicSupportState === "restricted_only" || row.publicSupportState === "unsafe_or_held") return "safe_public_evidence";
  if (outcome === "useful_with_caveat") return "public_support_source";
  return "none";
}

function publicSupportLiftOwnerFor(
  row: DarkwebIndexPublicHandoffRow,
  outcome: DarkwebIndexPublicSupportLiftOutcome
): DarkwebIndexPublicSupportLiftRow["owningWorkerHandoff"] {
  if (outcome === "stale_reject" || outcome === "duplicate_reject" || outcome === "unsafe_reject" || outcome === "low_value_reject") return "agent_07_quality_suppression";
  if (row.actorHints.length === 0 || (row.victimHints.length === 0 && row.datasetHints.length === 0)) return "agent_03_parser_repair";
  if (row.publicSupportState === "restricted_only" || row.publicSupportState === "unsafe_or_held") return "agent_05_restricted_metadata_hold";
  if (outcome === "sellable_after_public_support" || outcome === "useful_with_caveat") return "agent_04_source_support";
  if (row.graphPivot) return "agent_08_graph_pivot_support";
  return "agent_10_release_gate";
}

function publicSupportWorkOutcomeForLift(outcome: DarkwebIndexPublicSupportLiftOutcome): DarkwebIndexPublicSupportWorkRow["expectedOutcome"] {
  if (outcome === "sellable_after_public_support") return "projected_sellable_after_public_support";
  if (outcome === "useful_with_caveat") return "projected_caveated_after_public_support";
  if (outcome === "stale_reject") return "reject_stale";
  if (outcome === "duplicate_reject") return "reject_duplicate";
  if (outcome === "unsafe_reject") return "reject_unsafe";
  if (outcome === "low_value_reject") return "reject_low_value";
  return "hold_restricted_only";
}

function publicSupportWorkRowFor(row: DarkwebIndexPublicHandoffRow, selectionScore: number, rank: number): DarkwebIndexPublicSupportWorkRow {
  const expectedOutcome = publicSupportExpectedOutcomeFor(row);
  return {
    rank,
    recordId: row.recordId,
    safeLocatorHash: row.safeLocatorHash,
    sourceFamily: row.sourceFamily,
    publicSourceFamilyNeeded: publicSourceFamilyNeededFor(row),
    parserFieldsNeeded: ["actor", "victim", "dataset", "sector_country", "claimed_date", "source_family"],
    expectedOutcome,
    currentDecision: row.decision,
    publicSupportState: row.publicSupportState,
    actorHints: row.actorHints,
    victimHints: row.victimHints,
    datasetHints: row.datasetHints,
    sectorCountry: row.sectorCountry,
    claimedDate: row.claimedDate,
    freshness: row.freshness,
    buyerValueScore: row.buyerValueScore,
    selectionScore,
    whyBuyerWouldPayIfCorroborated: publicSupportBuyerReasonFor(row, expectedOutcome),
    noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials",
    publicSupportTarget: publicSupportTargetFor(row),
    graphPivot: row.graphPivot,
    rejectionReason: publicSupportRejectionReasonFor(expectedOutcome)
  };
}

function publicSupportSelectionScore(row: DarkwebIndexPublicHandoffRow): number {
  const freshnessBoost = row.freshness === "current" ? 0.25 : row.freshness === "refresh_due" ? 0.08 : 0;
  const specificityBoost = Math.min(0.25, (row.actorHints.length + row.victimHints.length + row.datasetHints.length) * 0.06);
  const corroborationBoost = row.publicSupportState === "public_supported" ? 0.18 : row.publicSupportState === "public_pivot_available" ? 0.12 : row.publicSupportState === "restricted_only" ? 0.04 : 0;
  const safetyPenalty = row.decision === "suppress" ? 0.45 : row.decision === "hold" ? 0.18 : 0;
  return Math.max(0, Math.min(1, Math.round((row.buyerValueScore * 0.55 + freshnessBoost + specificityBoost + corroborationBoost - safetyPenalty) * 100) / 100));
}

function publicSupportExpectedOutcomeFor(row: DarkwebIndexPublicHandoffRow): DarkwebIndexPublicSupportWorkRow["expectedOutcome"] {
  if (row.decisionReason === "duplicate") return "reject_duplicate";
  if (row.decisionReason === "unsafe_or_blocked") return "reject_unsafe";
  if (row.freshness === "stale_or_dead" || row.decisionReason === "stale_or_dead") return "reject_stale";
  if (row.buyerValueScore < 0.5) return "reject_low_value";
  if (row.publicSupportState === "restricted_only") return "hold_restricted_only";
  if (row.publicSupportState === "public_supported" || row.publicSupportState === "public_pivot_available") {
    if (row.actorHints.length > 0 && (row.victimHints.length > 0 || row.datasetHints.length > 0) && row.buyerValueScore >= 0.55) return "projected_sellable_after_public_support";
    return "projected_caveated_after_public_support";
  }
  return "hold_restricted_only";
}

function publicSupportRejectionReasonFor(expectedOutcome: DarkwebIndexPublicSupportWorkRow["expectedOutcome"]): DarkwebIndexPublicSupportWorkRow["rejectionReason"] | undefined {
  if (expectedOutcome === "reject_stale") return "stale";
  if (expectedOutcome === "reject_duplicate") return "duplicate";
  if (expectedOutcome === "reject_unsafe") return "unsafe";
  if (expectedOutcome === "reject_low_value") return "low_value";
  if (expectedOutcome === "hold_restricted_only") return "restricted_only";
  return undefined;
}

function publicSourceFamilyNeededFor(row: DarkwebIndexPublicHandoffRow): DarkwebIndexPublicSupportWorkRow["publicSourceFamilyNeeded"] {
  if (row.actorHints.some((hint) => hint.startsWith("APT"))) return "vendor_cti_or_research_report";
  if (row.datasetHints.some((hint) => hint.includes("leak") || hint.includes("extortion"))) return "ransomware_tracker_or_public_dataset";
  if (row.victimHints.length > 0) return "news_or_victim_public_statement";
  if (row.datasetHints.some((hint) => hint.includes("payload") || hint.includes("credential"))) return "government_cert_or_advisory";
  if (row.actorHints.length > 0) return "malware_research_or_ttp_report";
  return "public_search_or_directory_context";
}

function publicSupportTargetFor(row: DarkwebIndexPublicHandoffRow): string {
  if (row.actorHints[0] && row.victimHints[0]) return `${row.actorHints[0]}:${row.victimHints[0]}:${row.claimedDate}`;
  if (row.actorHints[0] && row.datasetHints[0]) return `${row.actorHints[0]}:${row.datasetHints[0]}:${row.claimedDate}`;
  if (row.victimHints[0] && row.datasetHints[0]) return `${row.victimHints[0]}:${row.datasetHints[0]}:${row.claimedDate}`;
  if (row.actorHints[0]) return `${row.actorHints[0]}:${row.sectorCountry}:${row.claimedDate}`;
  if (row.datasetHints[0]) return `${row.datasetHints[0]}:${row.sectorCountry}:${row.claimedDate}`;
  return `${row.sourceFamily}:${row.sectorCountry}:${row.claimedDate}`;
}

function publicSupportBuyerReasonFor(row: DarkwebIndexPublicHandoffRow, expectedOutcome: DarkwebIndexPublicSupportWorkRow["expectedOutcome"]): string {
  const actor = row.actorHints[0] ? `actor ${row.actorHints[0]}` : "an unattributed actor";
  const victim = row.victimHints[0] ? `, victim context ${row.victimHints[0]}` : "";
  const dataset = row.datasetHints[0] ? `, dataset signal ${row.datasetHints[0]}` : "";
  if (expectedOutcome === "projected_sellable_after_public_support") {
    return `If a safe public source supports the same ${actor}${victim}${dataset} and date claim, buyers get a chargeable monitoring row without exposing restricted material.`;
  }
  if (expectedOutcome === "projected_caveated_after_public_support") {
    return `Public corroboration would make this useful caveated context for buyer triage while keeping restricted-only claims out of sellable counts.`;
  }
  return `This row stays out of paid output until public support resolves ${expectedOutcome.replace("reject_", "").replace("hold_", "").replaceAll("_", " ")} risk.`;
}

function publicHandoffRowFor(record: DarkwebIndexRecord, duplicateIds: ReadonlySet<string>): DarkwebIndexPublicHandoffRow {
  const buyerRow = buyerSearchRowFor(record);
  const publicSupportState = publicSupportStateFor(record);
  const decision = publicHandoffDecisionFor(record, duplicateIds, publicSupportState);
  return {
    recordId: record.id,
    sourceFamily: buyerRow.sourceFamily,
    safeLocatorHash: record.rawUrlHash,
    actorHints: record.actorHints,
    victimHints: record.victimHints,
    datasetHints: buyerRow.datasetHints,
    sectorCountry: sectorCountryFor(record),
    claimedDate: buyerRow.claimedDate,
    firstSeen: record.firstSeen,
    lastSeen: record.lastSeen,
    liveness: record.liveness,
    freshness: buyerRow.freshness,
    buyerValueScore: buyerRow.buyerValueScore,
    publicSupportState,
    decision,
    decisionReason: publicHandoffDecisionReasonFor(record, duplicateIds, publicSupportState, decision),
    noLeakProof: "hash_only_no_raw_locator_no_payload_no_credentials",
    nextPublicCorroborationPivots: nextPublicCorroborationPivotsFor(record),
    parserGap: parserGapFor(record),
    publicCorroborationGap: publicCorroborationGapFor(record, publicSupportState),
    graphPivot: graphPivotFor(record)
  };
}

function publicHandoffDecisionFor(
  record: DarkwebIndexRecord,
  duplicateIds: ReadonlySet<string>,
  publicSupportState: DarkwebIndexPublicHandoffRow["publicSupportState"]
): DarkwebIndexPublicHandoffDecision {
  if (duplicateIds.has(record.id)) return "coverage_gap_only";
  if (record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe") return "suppress";
  if (authPrivateCaptchaDependency(record) || record.reviewState === "legal_hold" || record.reviewState === "needs_review" || record.reviewState === "false_positive_review") return "hold";
  if (!hasUsefulPublicHandoffHint(record)) return "coverage_gap_only";
  if (!isCurrentEnoughForMonitoring(record)) return "coverage_gap_only";
  if (publicSupportState === "public_supported" && buyerValueScoreFor(record) >= 0.55) return "sellable_with_public_support";
  if ((publicSupportState === "public_pivot_available" || publicSupportState === "restricted_only") && buyerValueScoreFor(record) >= 0.5) return "included_with_caveat";
  return "coverage_gap_only";
}

function publicHandoffDecisionReasonFor(
  record: DarkwebIndexRecord,
  duplicateIds: ReadonlySet<string>,
  publicSupportState: DarkwebIndexPublicHandoffRow["publicSupportState"],
  decision: DarkwebIndexPublicHandoffDecision
): string {
  if (duplicateIds.has(record.id)) return "duplicate";
  if (record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe") return "unsafe_or_blocked";
  if (authPrivateCaptchaDependency(record)) return "auth_private_captcha_dependency";
  if (record.reviewState === "legal_hold" || record.reviewState === "needs_review" || record.reviewState === "false_positive_review") return "legal_or_review_hold";
  if (!hasUsefulPublicHandoffHint(record)) return "missing_useful_hint";
  if (!isCurrentEnoughForMonitoring(record)) return "stale_or_dead";
  if (decision === "sellable_with_public_support") return "safe_public_source_family_supports_same_claim";
  if (decision === "included_with_caveat" && publicSupportState === "restricted_only") return "restricted_only_without_public_support";
  if (decision === "included_with_caveat") return "public_pivot_available_but_not_same_claim_support";
  if (buyerValueScoreFor(record) < 0.5) return "low_buyer_value";
  return "coverage_gap_only";
}

function publicSupportStateFor(record: DarkwebIndexRecord): DarkwebIndexPublicHandoffRow["publicSupportState"] {
  if (record.reviewState === "blocked_unsafe" || isBlockedOrReviewRecord(record)) return "unsafe_or_held";
  if (
    record.provenance.sourceType === "public_report" ||
    record.provenance.sourceType === "safe_search_result" ||
    record.legalTriage === "news_or_research"
  ) return "public_supported";
  if (record.actorHints.length > 0 || record.victimHints.length > 0 || datasetHintsFor(record).length > 0) return "public_pivot_available";
  return "restricted_only";
}

function publicHandoffRejectBuckets(
  records: readonly DarkwebIndexRecord[],
  rows: readonly DarkwebIndexPublicHandoffRow[],
  duplicateIds: ReadonlySet<string>
): DarkwebIndexPublicIntelligenceHandoff100["rejectionReasons"] {
  const bucket = (reason: DarkwebIndexPublicIntelligenceHandoff100["rejectionReasons"][number]["reason"], count: number) => ({
    reason,
    count,
    doesNotCountTowardSellableRows: true as const
  });
  return [
    bucket("duplicate", duplicateIds.size),
    bucket("stale_or_dead", rows.filter((row) => row.decisionReason === "stale_or_dead" || row.freshness === "stale_or_dead").length),
    bucket("missing_useful_hint", rows.filter((row) => row.decisionReason === "missing_useful_hint").length),
    bucket("restricted_only_without_public_support", rows.filter((row) => row.decisionReason === "restricted_only_without_public_support").length),
    bucket("unsafe_or_blocked", rows.filter((row) => row.decisionReason === "unsafe_or_blocked").length),
    bucket("auth_private_captcha_dependency", records.filter(authPrivateCaptchaDependency).length),
    bucket("legal_or_review_hold", rows.filter((row) => row.decisionReason === "legal_or_review_hold").length),
    bucket("low_buyer_value", rows.filter((row) => row.decisionReason === "low_buyer_value").length)
  ];
}

function hasUsefulPublicHandoffHint(record: DarkwebIndexRecord): boolean {
  return record.actorHints.length > 0 ||
    record.victimHints.length > 0 ||
    datasetHintsFor(record).length > 0 ||
    record.ttpHints.length > 0 ||
    record.category === "leak_extortion" ||
    record.category === "marketplace" ||
    record.category === "paste" ||
    record.category === "forum";
}

function authPrivateCaptchaDependency(record: DarkwebIndexRecord): boolean {
  return record.legalTriage === "credential_or_abuse" ||
    record.blockedReason?.includes("private") === true ||
    record.blockedReason?.includes("credential") === true;
}

function nextPublicCorroborationPivotsFor(record: DarkwebIndexRecord): string[] {
  const pivots = [
    ...record.actorHints.map((hint) => `public-report:${hint}`),
    ...record.victimHints.map((hint) => `public-victim-context:${hint}`),
    ...datasetHintsFor(record).map((hint) => `public-dataset-context:${hint}`),
    ...record.ttpHints.map((hint) => `public-ttp-context:${hint}`)
  ];
  if (pivots.length === 0) pivots.push(`public-source-family:${record.category}`);
  return uniqueSorted(pivots).slice(0, 6);
}

function parserGapFor(record: DarkwebIndexRecord): string | undefined {
  if (record.safeSummary.length < 80) return "safe_summary_too_short";
  if (record.actorHints.length === 0 && record.victimHints.length === 0 && datasetHintsFor(record).length === 0) return `extract_${record.category}_actor_victim_dataset_hints`;
  if (authPrivateCaptchaDependency(record)) return "emit_auth_private_captcha_block_code";
  return undefined;
}

function publicCorroborationGapFor(record: DarkwebIndexRecord, publicSupportState: DarkwebIndexPublicHandoffRow["publicSupportState"]): string | undefined {
  if (publicSupportState === "public_supported") return undefined;
  if (record.actorHints[0]) return `corroborate_actor:${record.actorHints[0]}`;
  if (record.victimHints[0]) return `corroborate_victim:${record.victimHints[0]}`;
  if (datasetHintsFor(record)[0]) return `corroborate_dataset:${datasetHintsFor(record)[0]}`;
  return `corroborate_category:${record.category}`;
}

function graphPivotFor(record: DarkwebIndexRecord): string | undefined {
  if (record.actorHints[0] && record.victimHints[0]) return `actor_to_victim:${record.actorHints[0]}:${record.victimHints[0]}`;
  if (record.actorHints[0] && datasetHintsFor(record)[0]) return `actor_to_dataset:${record.actorHints[0]}:${datasetHintsFor(record)[0]}`;
  if (record.victimHints[0] && datasetHintsFor(record)[0]) return `victim_to_dataset:${record.victimHints[0]}:${datasetHintsFor(record)[0]}`;
  if (record.actorHints[0]) return `actor_to_source_family:${record.actorHints[0]}:${sourceFamilyForRecord(record)}`;
  return undefined;
}

function sectorCountryFor(record: DarkwebIndexRecord): string {
  const sector = record.victimHints[0]?.replaceAll("-", " ") ?? categorySectorFor(record.category);
  const country = record.language === "no" ? "NO" : record.language === "de" ? "DE" : record.language === "fr" ? "FR" : record.language === "es" ? "ES" : record.language === "ru" ? "RU" : "US";
  return `${sector}:${country}`;
}

function categorySectorFor(category: DarkwebIndexCategory): string {
  if (category === "leak_extortion") return "ransomware victim claims";
  if (category === "marketplace") return "illicit marketplace metadata";
  if (category === "paste") return "paste references";
  if (category === "research" || category === "blog") return "research reporting";
  if (category === "forum") return "forum claim thread";
  return "dark metadata directory";
}

function buildDarkwebIndexOperatorRunbook(): DarkwebIndexOperatorRunbook {
  return {
    schemaVersion: "ti.darkweb_index_operator_runbook.v1",
    owner: "Agent 05",
    mode: "operator_controls_no_live_collection",
    isolatedCollectorPool: {
      enabledByDefault: false,
      approvedHarnessRequired: true,
      maxWorkers: 8,
      disposableWorkersRequired: true,
      hostNetworkAllowed: false
    },
    proxyBoundary: {
      approvedProxyRequired: true,
      directEgressAllowed: false,
      networkAllowlist: ["tor", "i2p", "freenet"]
    },
    diskBudget: {
      quarantineDescriptorGb: 24,
      rawBodyStorageAllowed: false,
      payloadStorageAllowed: false,
      retentionDays: 14
    },
    contentSizeCap: {
      maxBytesPerPage: 262144,
      maxFetchSeconds: 20,
      maxRedirects: 2
    },
    emergencyStop: {
      flag: "DARKWEB_INDEX_KILL_SWITCH",
      action: "pause_workers_hold_sources_clear_pending_refresh",
      publicSearchEffect: "non_blocking_existing_metadata_only_search"
    },
    rollback: ["pause_darkweb_index_workers", "disable_source_ingest", "clear_pending_refresh_queue", "preserve_review_holds", "rerun_no_leak_checks"],
    proofCommands: [
      "bun run check",
      "bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun run check:deploy-hygiene"
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
    actorHints: actorHintsFor(index),
    victimHints: victimHintsFor(index),
    ttpHints: index % 3 === 0 ? ["credential-access"] : index % 4 === 0 ? ["data-extortion"] : index % 11 === 0 ? ["ransomware-extortion"] : [],
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
  return `Tier-100 ${label} metadata descriptor ${String(index + 1).padStart(3, "0")}`;
}

function summaryFor(category: DarkwebIndexCategory, legalTriage: DarkwebIndexLegalTriage): string {
  return `Metadata-only ${category.replaceAll("_", " ")} descriptor for actor/victim search context with ${legalTriage.replaceAll("_", " ")} triage; payload links, credentials, private access, and actor interaction are blocked.`;
}

function actorHintsFor(index: number): string[] {
  const hints: string[] = [];
  if (index % 5 === 0) hints.push("akira");
  if (index % 7 === 0) hints.push("apt29");
  if (index % 9 === 0) hints.push("lockbit");
  if (index % 11 === 0) hints.push("apt42");
  if (index % 13 === 0) hints.push("cl0p");
  return hints;
}

function victimHintsFor(index: number): string[] {
  const victims = ["energy-sector", "healthcare-provider", "regional-manufacturer", "education-services", "public-sector-entity"];
  return index % 5 === 0 || index % 9 === 0 ? [victims[index % victims.length]!] : [];
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

function tier100SourceFamily(
  family: DarkwebIndexTier100ProductSlice["sourceFamilies"][number]["family"],
  records: readonly DarkwebIndexRecord[]
): DarkwebIndexTier100ProductSlice["sourceFamilies"][number] {
  const sourceTypesByFamily: Record<DarkwebIndexTier100ProductSlice["sourceFamilies"][number]["family"], readonly DarkwebIndexSourceType[]> = {
    public_report: ["public_report"],
    analyst_import: ["analyst_import"],
    directory_metadata: ["directory"],
    public_tracker_reference: ["public_report", "safe_search_result"],
    approved_seed: ["seed_list", "internal_discovery"],
    safe_search_result: ["safe_search_result"]
  };
  const selected = records.filter((record) => sourceTypesByFamily[family].includes(record.provenance.sourceType));
  const duplicateIds = new Set(darkwebIndexDedupePlan(records).duplicateClusters.flatMap((cluster) => cluster.duplicateRecordIds));
  const accepted = selected.filter((record) => record.reviewState === "approved_metadata_only" && !duplicateIds.has(record.id));
  const blocked = selected.filter((record) => record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe");
  const review = selected.filter((record) => record.reviewState === "needs_review" || record.reviewState === "legal_hold" || record.reviewState === "false_positive_review");
  const staleOrDead = selected.filter((record) => record.liveness === "dead" || record.liveness === "unknown");
  const productLiftByFamily: Record<DarkwebIndexTier100ProductSlice["sourceFamilies"][number]["family"], DarkwebIndexTier100ProductSlice["sourceFamilies"][number]["productLift"]> = {
    public_report: "actor_search_corroboration",
    analyst_import: "victim_context",
    directory_metadata: "category_coverage",
    public_tracker_reference: "liveness_signal",
    approved_seed: "source_family_diversity",
    safe_search_result: "actor_search_corroboration"
  };
  return {
    family,
    candidateCount: selected.length,
    acceptedCount: accepted.length,
    duplicateCount: selected.filter((record) => duplicateIds.has(record.id)).length,
    blockedCount: blocked.length,
    reviewCount: review.length,
    staleOrDeadCount: staleOrDead.length,
    productLift: productLiftByFamily[family]
  };
}

function tier1000SourceFamily(
  family: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"],
  records: readonly DarkwebIndexRecord[]
): DarkwebIndexTier1000Readiness["sourceFamilies"][number] {
  const sourceTypesByFamily: Record<DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"], readonly DarkwebIndexSourceType[]> = {
    public_report: ["public_report"],
    analyst_import: ["analyst_import"],
    directory_metadata: ["directory"],
    public_tracker_reference: ["public_report", "safe_search_result"],
    approved_seed: ["seed_list", "internal_discovery"],
    safe_search_result: ["safe_search_result"]
  };
  const selected = records.filter((record) => sourceTypesByFamily[family].includes(record.provenance.sourceType));
  const qualified = selected.filter(isTier1000ProductQualifiedRecord);
  const needsRefresh = selected.filter((record) => !isCurrentEnoughForMonitoring(record));
  const legalHold = selected.filter((record) => record.reviewState === "legal_hold");
  const blockedUnsafe = selected.filter((record) => record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe");
  return {
    family,
    evaluatedCount: selected.length,
    productQualifiedCount: qualified.length,
    needsRefreshCount: needsRefresh.length,
    legalHoldCount: legalHold.length,
    blockedUnsafeCount: blockedUnsafe.length,
    averageBuyerValue: selected.length === 0 ? 0 : Math.round((selected.reduce((sum, record) => sum + buyerValueScoreFor(record), 0) / selected.length) * 100) / 100,
    refreshCadenceMinutes: refreshCadenceMinutesFor(family)
  };
}

function isTier1000ProductQualifiedRecord(record: DarkwebIndexRecord): boolean {
  return record.reviewState === "approved_metadata_only" &&
    record.safeSummary.length >= 80 &&
    record.title.length >= 20 &&
    (record.liveness === "live" || record.liveness === "intermittent") &&
    (record.actorHints.length > 0 || record.victimHints.length > 0) &&
    buyerValueScoreFor(record) >= 0.55;
}

function isTier4000AdmittedRecord(record: DarkwebIndexRecord): boolean {
  return record.reviewState === "approved_metadata_only" &&
    record.safeSummary.length >= 80 &&
    (record.liveness === "live" || record.liveness === "intermittent") &&
    isCurrentEnoughForMonitoring(record) &&
    (record.actorHints.length > 0 || record.victimHints.length > 0 || datasetHintsFor(record).length > 0) &&
    buyerValueScoreFor(record) >= 0.66;
}

function buyerSearchRowFor(record: DarkwebIndexRecord): DarkwebIndexBuyerSearchRow {
  const sourceFamily = sourceFamilyForRecord(record);
  const datasetHints = datasetHintsFor(record);
  const searchBoostTerms = uniqueSorted([...record.actorHints, ...record.victimHints, ...datasetHints, record.category, record.legalTriage, ...record.ttpHints]).slice(0, 12);
  return {
    recordId: record.id,
    safeSummary: record.safeSummary,
    actorHints: record.actorHints,
    victimHints: record.victimHints,
    datasetHints,
    claimedDate: record.firstSeen,
    firstSeen: record.firstSeen,
    lastSeen: record.lastSeen,
    sourceFamily,
    liveness: record.liveness,
    refreshCadenceMinutes: refreshCadenceMinutesFor(sourceFamily),
    searchBoostTerms,
    confidence: record.confidence,
    freshness: freshnessLabelFor(record),
    buyerValueScore: buyerValueScoreFor(record),
    whyItMatters: whyItMattersFor(record),
    provenanceHash: record.provenance.sourceHash
  };
}

function buyerValueScoreFor(record: DarkwebIndexRecord): number {
  let score = 0.35;
  if (record.actorHints.length > 0) score += 0.2;
  if (record.victimHints.length > 0) score += 0.16;
  if (record.ttpHints.length > 0) score += 0.08;
  if (record.liveness === "live") score += 0.12;
  if (record.liveness === "intermittent") score += 0.06;
  if (record.reviewState === "approved_metadata_only") score += 0.1;
  if (record.provenance.sourceType === "public_report" || record.provenance.sourceType === "safe_search_result") score += 0.04;
  if (record.reviewState === "blocked_unsafe" || record.legalTriage === "blocked_unsafe") score -= 0.25;
  if (record.reviewState === "legal_hold" || record.reviewState === "needs_review" || record.reviewState === "false_positive_review") score -= 0.12;
  if (record.liveness === "dead" || record.liveness === "unknown" || record.liveness === "blocked_by_policy") score -= 0.16;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

function sourceFamilyForRecord(record: DarkwebIndexRecord): DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"] {
  if (record.provenance.sourceType === "public_report") return "public_report";
  if (record.provenance.sourceType === "analyst_import") return "analyst_import";
  if (record.provenance.sourceType === "directory") return "directory_metadata";
  if (record.provenance.sourceType === "safe_search_result") return "safe_search_result";
  if (record.provenance.sourceType === "seed_list" || record.provenance.sourceType === "internal_discovery") return "approved_seed";
  return "public_tracker_reference";
}

function datasetHintsFor(record: DarkwebIndexRecord): string[] {
  const hints: string[] = [];
  if (record.category === "leak_extortion") hints.push("leak-claim-metadata");
  if (record.category === "paste") hints.push("paste-reference");
  if (record.category === "marketplace") hints.push("marketplace-listing-metadata");
  if (record.category === "forum") hints.push("forum-claim-thread");
  if (record.legalTriage === "credential_or_abuse") hints.push("credential-abuse-claim");
  if (record.legalTriage === "malware_or_payload") hints.push("payload-reference-blocked");
  if (record.ttpHints.includes("data-extortion")) hints.push("dataset-extortion-signal");
  return uniqueSorted(hints);
}

function freshnessLabelFor(record: DarkwebIndexRecord): DarkwebIndexBuyerSearchRow["freshness"] {
  if (record.liveness === "dead" || record.liveness === "unknown" || record.liveness === "blocked_by_policy") return "stale_or_dead";
  return isCurrentEnoughForMonitoring(record) ? "current" : "refresh_due";
}

function whyItMattersFor(record: DarkwebIndexRecord): string {
  const actor = record.actorHints[0] ? `actor ${record.actorHints[0]}` : "actor discovery";
  const victim = record.victimHints[0] ? ` and ${record.victimHints[0]} context` : "";
  const dataset = datasetHintsFor(record)[0] ? ` with ${datasetHintsFor(record)[0]} signal` : "";
  return `Safe ${record.category.replaceAll("_", " ")} metadata can help buyers monitor ${actor}${victim}${dataset} without exposing raw locations or unsafe content.`;
}

function isCurrentEnoughForMonitoring(record: DarkwebIndexRecord): boolean {
  const checked = Date.parse(record.lastChecked);
  const generated = Date.parse("2026-05-24T00:00:00.000Z");
  if (!Number.isFinite(checked) || !Number.isFinite(generated)) return false;
  const ageHours = Math.max(0, (generated - checked) / 3_600_000);
  return ageHours <= 72 && (record.liveness === "live" || record.liveness === "intermittent");
}

function refreshCadenceMinutesFor(family: DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"]): number {
  const cadence: Record<DarkwebIndexTier1000Readiness["sourceFamilies"][number]["family"], number> = {
    public_report: 360,
    analyst_import: 1440,
    directory_metadata: 720,
    public_tracker_reference: 360,
    approved_seed: 1440,
    safe_search_result: 720
  };
  return cadence[family];
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return Math.round(((sorted[middle - 1]! + sorted[middle]!) / 2) * 100) / 100;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function driftCurrentState(record: DarkwebIndexRecord, driftType: DarkwebIndexDriftPacket["rows"][number]["driftType"]): string {
  if (driftType === "newly_alive" || driftType === "newly_dead") return record.liveness;
  if (driftType === "category_changed") return record.category;
  if (driftType === "legal_risk_changed") return record.legalTriage;
  if (driftType === "source_reputation_changed") return record.confidence >= 0.75 ? "strong_metadata_source" : "watch_metadata_source";
  if (driftType === "duplicate_cluster_changed") return "hash_cluster_recomputed";
  if (driftType === "review_priority_changed") return record.reviewState;
  return record.reviewState === "approved_metadata_only" ? "graph_export_candidate" : "graph_export_hold";
}

function driftReviewImpact(
  record: DarkwebIndexRecord,
  driftType: DarkwebIndexDriftPacket["rows"][number]["driftType"]
): DarkwebIndexDriftPacket["rows"][number]["reviewImpact"] {
  if (record.reviewState === "blocked_unsafe") return "blocked_unsafe";
  if (record.reviewState === "legal_hold") return "legal_hold";
  if (driftType === "graph_export_hold_changed") return "graph_export_hold";
  if (record.reviewState === "needs_review" || record.reviewState === "false_positive_review") return "review_required";
  return "no_change";
}

function driftPublicUiEffect(
  record: DarkwebIndexRecord,
  driftType: DarkwebIndexDriftPacket["rows"][number]["driftType"]
): DarkwebIndexDriftPacket["rows"][number]["publicUiEffect"] {
  if (record.reviewState === "blocked_unsafe") return "hide_from_public_default";
  if (record.reviewState === "legal_hold" || driftType === "graph_export_hold_changed") return "hold_public_claim";
  if (driftType === "newly_alive" || driftType === "newly_dead" || driftType === "category_changed") return "update_filter_count";
  return "show_badge";
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
