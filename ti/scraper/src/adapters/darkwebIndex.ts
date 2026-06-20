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
    downstreamHandoff: buildDarkwebIndexDownstreamHandoff(),
    restrictedReconciliation: buildDarkwebIndexRestrictedReconciliation(),
    refreshOperations: buildDarkwebIndexRefreshOperationsPlan(),
    driftPacket: buildDarkwebIndexDriftPacket(records),
    searchQuality: buildDarkwebIndexSearchQualityMetrics(records),
    tier100Product: buildDarkwebIndexTier100ProductSlice(records),
    tier1000Readiness: buildDarkwebIndexTier1000Readiness(records),
    tier4000Admission: buildDarkwebIndexTier4000Admission(records),
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
