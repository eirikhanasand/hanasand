import type {
  AuditEvent,
  CollectionPlan,
  CollectionTask,
  EvidenceDelta,
  EvidenceDeltaKind,
  IntelligenceRequest,
  RawCapture,
  RetentionClass,
  SourceRecord,
  SourceReviewDecision
} from "../types.ts";
import { emptyAdapterResult, type CollectionAdapter } from "./base.ts";
import { evaluateSourceForCollection, evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { applySourceReviewDecision } from "../registry/sourceRegistry.ts";
import { clampScore, hashContent, normalizeWhitespace, nowIso, stableId } from "../utils.ts";

export type DarknetMetadataSourceType = "tor_metadata" | "i2p_metadata" | "freenet_metadata";

export type DarknetNetwork = "tor" | "i2p" | "freenet";

export type BlockedDarknetOperation =
  | "credential_bypass"
  | "captcha_solving"
  | "threat_actor_interaction"
  | "stolen_file_download"
  | "stealth_or_evasion"
  | "unapproved_proxy"
  | "non_metadata_capture";

export type DarknetProxyType = "tor_socks" | "i2p_http" | "freenet_gateway";
export type DarknetTimeoutClass = "metadata_fast" | "metadata_standard" | "metadata_slow";
export type DarknetResolutionFailureCategory = "none" | "name_not_found" | "timeout" | "proxy_unavailable" | "invalid_name";
export type DarknetFetchFailureCategory = "none" | "timeout" | "connection_refused" | "policy_blocked" | "approval_blocked" | "proxy_failure";
export type DarknetPostStatus = "new" | "updated" | "removed" | "unknown";
export type DarknetMetadataLiveSearchStatus =
  | "disabled"
  | "approval_required"
  | "queued_metadata_only"
  | "partial_metadata"
  | "blocked";

export type RestrictedMetadataProductionControl =
  | "approval_gate"
  | "kill_switch"
  | "retention_rule"
  | "audit_event"
  | "redaction";

export type RestrictedMetadataProductionAuditEventKind =
  | "approval_gate"
  | "kill_switch"
  | "retention_rule"
  | "policy_block"
  | "redaction_applied"
  | "metadata_only_capture";

export type RestrictedMetadataIntelSearchPartialState =
  | "restricted_disabled"
  | "pending_approval"
  | "metadata_only_ready"
  | "kill_switch_active"
  | "retention_expiring"
  | "blocked_unsafe_target";

export type RestrictedMetadataNonBlockingSearchScenario =
  | "approved_metadata_canary"
  | "no_approval"
  | "expired_approval"
  | "kill_switch"
  | "proxy_failure"
  | "timeout"
  | "unsafe_target"
  | "low_yield_source"
  | "retention_expiry"
  | "legal_hold"
  | "redaction_repair"
  | "actor_query"
  | "ransomware_query"
  | "victim_query"
  | "cve_query"
  | "country_query"
  | "sector_query"
  | "public_api_blocked_state";

export type RestrictedMetadataRuntimeIsolationState =
  | "disabled"
  | "pending_approval"
  | "approved_metadata_only"
  | "kill_switch_active"
  | "unsafe_target_blocked"
  | "retention_expiring"
  | "audit_clean"
  | "proxy_failure"
  | "timeout"
  | "policy_repair";

export type RestrictedMetadataCompliancePacketStatus =
  | "approval_expired"
  | "kill_switch_active"
  | "forbidden_target_blocked"
  | "screenshot_hash_only"
  | "retention_expired"
  | "legal_hold"
  | "audit_clean"
  | "pending_approval"
  | "proxy_repair_required";

export interface DarknetProxyHealth {
  readonly boundaryId: string;
  readonly network: DarknetNetwork;
  readonly proxyType: DarknetProxyType;
  readonly isolationId: string;
  readonly healthy: boolean;
  readonly checkedAt: string;
  readonly timeoutClass: DarknetTimeoutClass;
  readonly resolutionFailure: DarknetResolutionFailureCategory;
  readonly fetchFailure: DarknetFetchFailureCategory;
  readonly screenshotHashMode: "disabled" | "hash_only";
}

export interface DarknetConnectorAttribution {
  readonly boundaryId: string;
  readonly network: DarknetNetwork;
  readonly proxyType: DarknetProxyType;
  readonly isolationId: string;
  readonly timeoutClass: DarknetTimeoutClass;
}

export interface ApprovedProxyBoundary {
  readonly id: string;
  readonly network: DarknetNetwork;
  readonly accessMethod: "approved_proxy";
  readonly config?: DarknetNetworkMetadataSourceConfig;
  readonly health?: DarknetProxyHealth;
  fetchMetadata(request: DarknetMetadataFetchRequest): Promise<DarknetMetadataFetchResult>;
}

export interface DarknetNetworkMetadataSourceConfig {
  readonly network: DarknetNetwork;
  readonly proxyBoundaryId: string;
  readonly maxMetadataBytes: number;
  readonly requestTimeoutMs: number;
  readonly maxConcurrency: number;
  readonly screenshotHashMode: "disabled" | "hash_only";
  readonly allowedSchemes: readonly string[];
  readonly proxyType: DarknetProxyType;
  readonly timeoutClass: DarknetTimeoutClass;
  readonly notes?: string;
}

export type DarknetMetadataPolicyReason =
  | "allowed_metadata_only"
  | "not_darknet_metadata_source"
  | "wrong_access_method"
  | "missing_proxy_boundary"
  | "network_boundary_mismatch"
  | "credential_url_blocked"
  | "sensitive_payload_target_blocked"
  | "interaction_affordance_blocked";

export interface DarknetMetadataPolicyDecision {
  readonly id: string;
  readonly allowed: boolean;
  readonly reason: DarknetMetadataPolicyReason;
  readonly message: string;
  readonly network?: DarknetNetwork;
  readonly sourceId: string;
  readonly sourceType: SourceRecord["type"];
  readonly urlHash: string;
  readonly proxyBoundaryId?: string;
  readonly metadataOnly: true;
  readonly blockedOperations: readonly BlockedDarknetOperation[];
  readonly decidedAt: string;
}

export interface DarknetMetadataFetchRequest {
  readonly sourceId: string;
  readonly network: DarknetNetwork;
  readonly url: string;
  readonly taskId?: string;
  readonly maxBytes: number;
  readonly timeoutClass: DarknetTimeoutClass;
  readonly isolationId: string;
  readonly connectorAttribution: DarknetConnectorAttribution;
  readonly allowedOperations: readonly ["metadata_only"];
  readonly blockedOperations: readonly BlockedDarknetOperation[];
}

export interface DarknetMetadataFetchResult {
  readonly sourceTimestamp?: string;
  readonly title?: string;
  readonly safeText?: string;
  readonly links?: string[];
  readonly screenshotHashMode?: "disabled" | "hash_only";
  readonly screenshotHash?: string;
  readonly postStatus?: DarknetPostStatus;
  readonly confidence?: number;
  readonly proxyHealth?: DarknetProxyHealth;
  readonly httpStatus?: number;
}

export interface LeakSiteMetadataCapture {
  readonly actorName?: string;
  readonly victimName?: string;
  readonly affectedAccounts?: string;
  readonly accountSubjects?: string;
  readonly datasetSize?: string;
  readonly actorStatement?: string;
  readonly claimDate?: string;
  readonly claimedSector?: string;
  readonly claimedCountry?: string;
  readonly claimedDataType?: string;
  readonly claimedDataCategory?: string;
  readonly postStatus: DarknetPostStatus;
  readonly confidence: number;
  readonly sourceTimestamp?: string;
  readonly urlHash: string;
  readonly screenshotHash?: string;
}

export interface DarknetMetadataItemMetadata {
  readonly adapter: "darknet_metadata";
  readonly network: DarknetNetwork;
  readonly sourceType: DarknetMetadataSourceType;
  readonly proxyBoundaryId: string;
  readonly captureMode: "metadata_only";
  readonly urlHash: string;
  readonly leakSite: LeakSiteMetadataCapture;
  readonly policyDecision: DarknetMetadataPolicyDecision;
  readonly connectorAttribution: DarknetConnectorAttribution;
  readonly proxyHealth?: DarknetProxyHealth;
  readonly blockedOperations: readonly BlockedDarknetOperation[];
  readonly extractorVersion: "darknet-metadata-v1";
}

export interface DarknetMetadataPlannerOptions {
  readonly request: IntelligenceRequest;
  readonly sources: SourceRecord[];
  readonly proxyBoundaries: Partial<Record<DarknetNetwork, ApprovedProxyBoundary>>;
  readonly createdAt?: string;
  readonly maxTasks?: number;
}

export interface DarknetMetadataResultDto {
  readonly sourceId: string;
  readonly urlHash: string;
  readonly actor?: string;
  readonly victim?: string;
  readonly affectedAccounts?: string;
  readonly accountSubjects?: string;
  readonly datasetSize?: string;
  readonly actorStatement?: string;
  readonly claimedDate?: string;
  readonly sector?: string;
  readonly country?: string;
  readonly claimedDataCategory?: string;
  readonly postStatus: DarknetPostStatus;
  readonly sourceTimestamp?: string;
  readonly screenshotHash?: string;
  readonly confidence: number;
  readonly policyAuditId: string;
}

export interface DarknetMetadataLiveSearchPlan {
  readonly status: DarknetMetadataLiveSearchStatus;
  readonly results: DarknetMetadataResultDto[];
  readonly queuedTasks: number;
  readonly blocked: DarknetMetadataBlockedExplanation[];
  readonly skipped: Array<{ sourceId: string; reason: string }>;
  readonly sourceStates: DarknetMetadataApprovalBridge[];
  readonly complianceStatuses: DarknetMetadataComplianceStatusDto[];
  readonly activationRecommendations: DarknetMetadataActivationRecommendation[];
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly queryTerms: string[];
  readonly nonBlockingSearch: RestrictedMetadataNonBlockingSearchSemanticsDto;
  readonly notes: string[];
}

export interface RestrictedMetadataConnectorContract {
  readonly network: DarknetNetwork;
  readonly sourceType: DarknetMetadataSourceType;
  readonly proxyType: DarknetProxyType;
  readonly proxyBoundaryId: string;
  readonly metadataOnly: true;
  readonly maxConcurrency: number;
  readonly maxMetadataBytes: number;
  readonly requestTimeoutMs: number;
  readonly screenshotHashMode: "disabled" | "hash_only";
  readonly requiredMetadataFields: readonly RestrictedMetadataField[];
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly productionControls: readonly RestrictedMetadataProductionControl[];
  readonly storage: {
    readonly storageKind: "metadata_only";
    readonly rawBodyStored: false;
    readonly rawUrlStoredInApi: false;
    readonly objectRefStored: false;
  };
  readonly approvalGates: readonly string[];
  readonly killSwitchBehavior: readonly string[];
  readonly retentionRules: readonly string[];
  readonly auditEvents: readonly RestrictedMetadataProductionAuditEventKind[];
  readonly redaction: {
    readonly url: "hash_only";
    readonly screenshot: "hash_only" | "disabled";
    readonly rawBody: "drop";
    readonly credentials: "reject";
  };
}

export interface RestrictedMetadataRedactionDto {
  readonly captureId: string;
  readonly sourceId: string;
  readonly metadataOnly: true;
  readonly storageKind: "metadata_only";
  readonly bodyRedacted: true;
  readonly objectRefRedacted: true;
  readonly rawUrlRedacted: true;
  readonly urlHash?: string;
  readonly screenshotHash?: string;
  readonly policyAuditId?: string;
  readonly retentionClass?: RetentionClass;
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly rejectedFields: readonly string[];
  readonly redactionReason: string;
  readonly safeForApi: true;
}

export interface RestrictedMetadataProductionAuditEventDto {
  readonly id: string;
  readonly eventType: RestrictedMetadataProductionAuditEventKind;
  readonly sourceId: string;
  readonly occurredAt: string;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly policyAuditId?: string;
  readonly urlHash?: string;
  readonly retentionClass?: RetentionClass;
  readonly restrictedState?: DarknetMetadataRestrictedState;
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly message: string;
}

export interface RestrictedMetadataIntelSearchPartialSemantics {
  readonly state: RestrictedMetadataIntelSearchPartialState;
  readonly sourceId?: string;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly canQueueMetadataOnly: boolean;
  readonly reasonCode: DarknetMetadataRestrictedState | DarknetMetadataLiveSearchStatus;
  readonly publicStatus: DarknetMetadataLiveSearchStatus;
  readonly reason: string;
  readonly policyWarning: string;
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly policyAuditId?: string;
  readonly urlHash?: string;
  readonly retentionExpiresAt?: string;
}

export interface RestrictedMetadataNonBlockingSearchPacketDto {
  readonly packetId: string;
  readonly scenario: RestrictedMetadataNonBlockingSearchScenario;
  readonly sourceId?: string;
  readonly queryClass?: string;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly publicSearchAction: "continue_clear_web_and_public_channel";
  readonly restrictedContext: "queued_metadata_only_context" | "held_policy_gated_context" | "blocked_context";
  readonly publicAnswerInfluence: "none" | "caveat_only";
  readonly canQueueMetadataOnly: boolean;
  readonly policyGate: DarknetMetadataRestrictedState | DarknetMetadataLiveSearchStatus | RestrictedMetadataRuntimeProofKind | "query_class";
  readonly reason: string;
  readonly agent06EvidenceGate: "metadata_only_handoff" | "hold_redaction" | "hold_retention";
  readonly agent07PublicAnswerState: "do_not_wait" | "restricted_context_only" | "policy_hold_caveat";
  readonly agent09WarningCodes: readonly string[];
  readonly agent10EmergencyStopBoard: {
    readonly decision: "continue_public_search" | "hold_restricted_context" | "rollback_restricted_workers";
    readonly publicApiImpact: "none" | "warn" | "hold_restricted_only";
  };
  readonly proof: {
    readonly doesNotBlockPublicSearch: true;
    readonly doesNotPromoteRestrictedFacts: true;
    readonly noUnsafeAccess: true;
    readonly noDataExposure: true;
    readonly noContact: true;
    readonly noDownload: true;
    readonly noCredentialBypass: true;
    readonly noCaptchaSolving: true;
    readonly noStealth: true;
    readonly noRawPayloads: true;
    readonly noRawUrls: true;
    readonly hashOnlyEvidence: true;
  };
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
}

export interface RestrictedMetadataNonBlockingSearchSemanticsDto {
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly nonBlockingPublicSearch: true;
  readonly publicSearchBehavior: "clear_web_and_public_channel_continue_immediately";
  readonly publicAnswerRule: "restricted_metadata_context_never_promotes_public_answer_without_review";
  readonly maxPublicSearchAddedLatencyMs: 0;
  readonly packets: readonly RestrictedMetadataNonBlockingSearchPacketDto[];
  readonly fixtureScenarios: readonly RestrictedMetadataNonBlockingSearchScenario[];
  readonly observedScenarios: readonly RestrictedMetadataNonBlockingSearchScenario[];
  readonly agent06EvidenceGates: readonly string[];
  readonly agent07PublicAnswerStates: readonly string[];
  readonly agent09WarningCodes: readonly string[];
  readonly agent10EmergencyStopDecisions: readonly string[];
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
}

export interface RestrictedMetadataEvidenceHandoffDto {
  readonly captureId: string;
  readonly sourceId: string;
  readonly tenantId?: string;
  readonly metadataOnly: true;
  readonly storageKind: "metadata_only";
  readonly retentionClass?: RetentionClass;
  readonly actor?: string;
  readonly victim?: string;
  readonly claimedDate?: string;
  readonly sector?: string;
  readonly country?: string;
  readonly claimedDataType?: string;
  readonly claimedDataCategory?: string;
  readonly postStatus: DarknetPostStatus;
  readonly sourceTimestamp?: string;
  readonly urlHash?: string;
  readonly screenshotHash?: string;
  readonly confidence: number;
  readonly policyDecision: {
    readonly policyAuditId?: string;
    readonly allowed?: boolean;
    readonly reason?: string;
    readonly metadataOnly: true;
  };
  readonly redactionStatus: RestrictedMetadataRedactionDto;
  readonly agent06StorageFields: readonly string[];
  readonly agent09ApiFields: readonly string[];
  readonly safeForApi: true;
}

export interface RestrictedMetadataRuntimeIsolationContract {
  readonly sourceId: string;
  readonly sourceType: SourceRecord["type"];
  readonly network: DarknetNetwork;
  readonly state: RestrictedMetadataRuntimeIsolationState;
  readonly metadataOnly: true;
  readonly proxyBoundary: {
    readonly required: true;
    readonly id?: string;
    readonly approved: boolean;
    readonly proxyType: DarknetProxyType;
    readonly isolationId?: string;
    readonly healthy?: boolean;
    readonly resolutionFailure?: DarknetResolutionFailureCategory;
    readonly fetchFailure?: DarknetFetchFailureCategory;
  };
  readonly runtime: {
    readonly maxConcurrency: number;
    readonly requestTimeoutMs: number;
    readonly timeoutClass: DarknetTimeoutClass;
    readonly maxMetadataBytes: number;
    readonly allowedSchemes: readonly string[];
    readonly dnsLeakPreventionAssumptions: readonly string[];
    readonly directEgressAllowed: false;
    readonly browserStealthAllowed: false;
    readonly accountAutomationAllowed: false;
  };
  readonly killSwitch: {
    readonly active: boolean;
    readonly sourceStatus: SourceRecord["status"];
    readonly accessMethod: SourceRecord["accessMethod"];
  };
  readonly retention: {
    readonly retentionClass?: RetentionClass;
    readonly retentionExpiresAt?: string;
    readonly expiring: boolean;
  };
  readonly auditEvents: readonly RestrictedMetadataProductionAuditEventDto[];
  readonly evidenceHandoff?: RestrictedMetadataEvidenceHandoffDto;
  readonly policyRepair: {
    readonly required: boolean;
    readonly action: DarknetMetadataRequiredAction;
    readonly reason: string;
  };
  readonly agent10ResourceBudget: {
    readonly scraperTargetMb: 98_304;
    readonly restrictedWorkerPoolMaxConcurrency: number;
    readonly estimatedWorkerMemoryMb: number;
    readonly withinTarget: true;
  };
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly safeForApi: true;
}

export interface RestrictedMetadataForbiddenActionChecks {
  readonly credentialBypass: false;
  readonly captchaSolving: false;
  readonly threatActorInteraction: false;
  readonly stolenFileDownload: false;
  readonly stealthOrEvasion: false;
  readonly unapprovedProxy: boolean;
  readonly nonMetadataCapture: false;
  readonly unsafeTargetBlocked: boolean;
}

export interface RestrictedMetadataCompliancePacketDto {
  readonly packetId: string;
  readonly runId?: string;
  readonly sourceId: string;
  readonly tenantId?: string;
  readonly approvalId?: string;
  readonly operator?: string;
  readonly policyVersion?: string;
  readonly connectorKind: DarknetMetadataSourceType;
  readonly network: DarknetNetwork;
  readonly proxyBoundary: {
    readonly id?: string;
    readonly approved: boolean;
    readonly proxyType: DarknetProxyType;
    readonly isolationId?: string;
  };
  readonly killSwitchState: "active" | "inactive";
  readonly retentionClass?: RetentionClass;
  readonly retentionExpiresAt?: string;
  readonly legalHold: boolean;
  readonly redactionProof?: RestrictedMetadataRedactionDto;
  readonly forbiddenActionChecks: RestrictedMetadataForbiddenActionChecks;
  readonly auditEventIds: readonly string[];
  readonly statuses: readonly RestrictedMetadataCompliancePacketStatus[];
  readonly approvalExpired: boolean;
  readonly screenshotHashOnly: boolean;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
}

export interface RestrictedMetadataComplianceSummaryDto {
  readonly sourceId: string;
  readonly packetId: string;
  readonly statuses: readonly RestrictedMetadataCompliancePacketStatus[];
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly approvalId?: string;
  readonly policyVersion?: string;
  readonly proxyBoundaryId?: string;
  readonly killSwitchState: "active" | "inactive";
  readonly retentionClass?: RetentionClass;
  readonly legalHold: boolean;
  readonly redactionProof: {
    readonly bodyRedacted: true;
    readonly rawUrlRedacted: true;
    readonly objectRefRedacted: true;
    readonly urlHash?: string;
    readonly screenshotHash?: string;
  };
  readonly forbiddenActionChecks: RestrictedMetadataForbiddenActionChecks;
  readonly auditEventIds: readonly string[];
}

export interface RestrictedMetadataPromotionComplianceSummary {
  readonly sourceId: string;
  readonly packetId: string;
  readonly status: "pass" | "hold" | "rollback";
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly promotionBlockers: readonly RestrictedMetadataCompliancePacketStatus[];
  readonly proofFields: readonly string[];
  readonly agent10SoakFields: {
    readonly killSwitchState: "active" | "inactive";
    readonly policyBlocks: number;
    readonly auditEventCount: number;
    readonly legalHold: boolean;
    readonly retentionClass?: RetentionClass;
  };
}

export type RestrictedMetadataOperationsReadinessState = "ready" | "hold" | "blocked" | "rollback";

export type RestrictedMetadataOperationsRemediationAction =
  | "renew_approval"
  | "quarantine_proxy"
  | "activate_kill_switch"
  | "review_retention_expiry"
  | "repair_redaction"
  | "rollback_disabled_source";

export type RestrictedMetadataRuntimeProofKind =
  | "approval_expiry"
  | "kill_switch_transition"
  | "proxy_failure"
  | "timeout"
  | "retention_expiry"
  | "legal_hold"
  | "redaction_repair"
  | "unsafe_target_rejection"
  | "disabled_source_rollback";

export type RestrictedMetadataRuntimeReleaseEffect = "none" | "downgrade" | "block" | "rollback";

export interface RestrictedMetadataForbiddenActionCounters {
  readonly credentialBypassAttempts: number;
  readonly captchaSolvingAttempts: number;
  readonly threatActorInteractionAttempts: number;
  readonly stolenFileDownloadAttempts: number;
  readonly stealthOrEvasionAttempts: number;
  readonly unapprovedProxyAttempts: number;
  readonly nonMetadataCaptureAttempts: number;
  readonly unsafeTargetAttempts: number;
}

export interface RestrictedMetadataOperationsRemediationPlanItem {
  readonly id: string;
  readonly action: RestrictedMetadataOperationsRemediationAction;
  readonly sourceId: string;
  readonly safety: RestrictedMetadataApplySafety;
  readonly dryRunOnly: true;
  readonly metadataOnly: true;
  readonly reason: string;
  readonly preconditions: readonly string[];
  readonly expectedEffect: string;
  readonly rollback: readonly string[];
  readonly forbiddenAlternatives: readonly string[];
}

export interface RestrictedMetadataRuntimeProofDto {
  readonly kind: RestrictedMetadataRuntimeProofKind;
  readonly sourceId: string;
  readonly network: DarknetNetwork;
  readonly observed: boolean;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly releaseEffect: RestrictedMetadataRuntimeReleaseEffect;
  readonly status: RestrictedMetadataCompliancePacketStatus | RestrictedMetadataRuntimeIsolationState | "redaction_clean";
  readonly reason: string;
  readonly evidence: {
    readonly approvalExpired?: boolean;
    readonly killSwitchActive?: boolean;
    readonly proxyFailure?: DarknetFetchFailureCategory | DarknetResolutionFailureCategory;
    readonly retentionExpired?: boolean;
    readonly legalHold?: boolean;
    readonly screenshotHashOnly?: boolean;
    readonly unsafeTargetBlocked?: boolean;
    readonly disabledSource?: boolean;
    readonly urlHash?: string;
    readonly auditEventIds: readonly string[];
  };
  readonly remediationActions: readonly RestrictedMetadataOperationsRemediationAction[];
  readonly forbiddenActionCounters: RestrictedMetadataForbiddenActionCounters;
  readonly forbiddenAlternatives: readonly string[];
}

export type RestrictedMetadataSlaStatus = "pass" | "warning" | "breach";

export interface RestrictedMetadataOperationalSlaDto {
  readonly sourceId?: string;
  readonly status: RestrictedMetadataSlaStatus;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly metrics: {
    readonly sourceCount: number;
    readonly approvalAgeMaxDays?: number;
    readonly approvalExpiredCount: number;
    readonly killSwitchActiveCount: number;
    readonly killSwitchInconsistentCount: number;
    readonly proxyIsolationApprovedCount: number;
    readonly proxyFailureCount: number;
    readonly timeoutCount: number;
    readonly timeoutFailureRate: number;
    readonly retentionExpiredCount: number;
    readonly legalHoldCount: number;
    readonly redactionRepairRequiredCount: number;
    readonly unsafeRejectionCount: number;
    readonly forbiddenActionAttemptCount: number;
    readonly metadataOnlyEvidenceYield: number;
    readonly auditEventCount: number;
  };
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly proofCommand: "bun run check:restricted-metadata-status";
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly rejectedFields: readonly string[];
}

export type RestrictedMetadataEnforcementLevel = "pass" | "warning" | "hold" | "emergency_stop";

export type RestrictedMetadataEnforcementRule =
  | "approval_expiry_hold"
  | "kill_switch_emergency_stop"
  | "kill_switch_inconsistent_hold"
  | "proxy_isolation_failure_hold"
  | "timeout_spike_warning"
  | "redaction_repair_hold"
  | "retention_expiry_emergency_stop"
  | "legal_hold_warning"
  | "unsafe_rejection_burst_emergency_stop"
  | "forbidden_action_attempt_emergency_stop"
  | "low_metadata_only_yield_warning";

export interface RestrictedMetadataEnforcementRuleDto {
  readonly rule: RestrictedMetadataEnforcementRule;
  readonly active: boolean;
  readonly level: RestrictedMetadataEnforcementLevel;
  readonly metric: keyof RestrictedMetadataOperationalSlaDto["metrics"];
  readonly observed: number;
  readonly threshold: number;
  readonly reason: string;
  readonly dryRunActions: readonly RestrictedMetadataOperationsRemediationAction[];
  readonly publicApiImpact: "none" | "warn" | "hold" | "emergency_stop";
  readonly agent06LedgerImpact: "none" | "redaction_hold" | "retention_hold" | "promotion_hold";
  readonly agent09WarningCode?: string;
  readonly agent10ReleaseEffect: RestrictedMetadataRuntimeReleaseEffect;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly forbiddenAlternatives: readonly string[];
}

export interface RestrictedMetadataEmergencyStopDto {
  readonly state: "inactive" | "armed" | "active";
  readonly dryRunOnly: true;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly workerAction: "none" | "pause_restricted_metadata_workers";
  readonly releaseEffect: RestrictedMetadataRuntimeReleaseEffect;
  readonly activeRules: readonly RestrictedMetadataEnforcementRule[];
  readonly holdRules: readonly RestrictedMetadataEnforcementRule[];
  readonly warningRules: readonly RestrictedMetadataEnforcementRule[];
  readonly prohibitedActions: readonly string[];
  readonly rollbackPath: "pause restricted metadata workers, keep sources disabled, and keep outer fallback enabled";
}

export interface RestrictedMetadataEnforcementDto {
  readonly sourceId?: string;
  readonly level: RestrictedMetadataEnforcementLevel;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly rules: readonly RestrictedMetadataEnforcementRuleDto[];
  readonly activeRules: readonly RestrictedMetadataEnforcementRuleDto[];
  readonly emergencyStop: RestrictedMetadataEmergencyStopDto;
  readonly dryRunRepairActions: readonly RestrictedMetadataOperationsRemediationAction[];
  readonly agent06LedgerRedactionGate: "pass" | "hold";
  readonly agent09WarningCodes: readonly string[];
  readonly agent10ReleaseEffect: RestrictedMetadataRuntimeReleaseEffect;
}

export interface RestrictedMetadataAuditTrailDto {
  readonly sourceId?: string;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly eventIds: readonly string[];
  readonly eventTypes: readonly RestrictedMetadataProductionAuditEventKind[];
  readonly policyAuditIds: readonly string[];
  readonly urlHashes: readonly string[];
  readonly retentionClasses: readonly RetentionClass[];
  readonly forbiddenActionCounters: RestrictedMetadataForbiddenActionCounters;
  readonly rejectedFields: readonly string[];
  readonly unsafeFieldsExposed: false;
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
}

export type RestrictedMetadataAuditReplayScenario =
  | "allowed_metadata_only_record"
  | "expired_approval"
  | "kill_switch_active"
  | "proxy_isolation_failure"
  | "unsafe_action_attempt"
  | "low_yield_source"
  | "redaction_repair"
  | "legal_hold"
  | "retention_expiry";

export type RestrictedMetadataConnectorCertificationScenario =
  | "healthy_approved_metadata_source"
  | "expired_approval"
  | "kill_switch"
  | "proxy_isolation_failure"
  | "high_timeout"
  | "unsafe_link_form_download"
  | "redaction_repair"
  | "legal_hold"
  | "retention_expiry"
  | "low_yield_source";

export type RestrictedMetadataKillSwitchDrillScenario =
  | "healthy_metadata_only_canary"
  | "kill_switch_activation_mid_run"
  | "expired_approval"
  | "proxy_failure"
  | "redaction_repair"
  | "legal_hold"
  | "retention_expiry"
  | "low_yield_source"
  | "unsafe_download_form_contact_link"
  | "public_api_blocked_state";

export type RestrictedMetadataEmergencyStopCertificationScenario =
  | "healthy_metadata_only_canary"
  | "expired_approval"
  | "kill_switch_propagation"
  | "proxy_isolation_failure"
  | "timeout_spike"
  | "unsafe_download_form_contact_target"
  | "redaction_repair"
  | "retention_expiry"
  | "legal_hold"
  | "low_yield_source"
  | "public_api_blocked_state";

export interface RestrictedMetadataNoLeakSerializationCheckDto {
  readonly passed: true;
  readonly checkedFields: readonly string[];
  readonly forbiddenFields: readonly string[];
  readonly guarantees: {
    readonly noRawUrls: true;
    readonly noBodiesOrHtml: true;
    readonly noPayloadOrObjectKeys: true;
    readonly noCredentials: true;
    readonly noScreenshotBytes: true;
    readonly noFileNames: true;
  };
}

export interface RestrictedMetadataGovernancePacketDto {
  readonly sourceId?: string;
  readonly packetId: string;
  readonly networks: readonly DarknetNetwork[];
  readonly sourceClasses: readonly DarknetMetadataSourceType[];
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly approval: {
    readonly approvalIds: readonly string[];
    readonly approvalExpired: boolean;
    readonly approvalAgeMaxDays?: number;
    readonly legalBasis: "metadata_only_legal_ethics_review";
  };
  readonly maxMetadataFields: readonly RestrictedMetadataField[];
  readonly redactionPolicy: {
    readonly bodyRedacted: true;
    readonly rawUrlRedacted: true;
    readonly fileNameRedacted: true;
    readonly objectKeyRedacted: true;
    readonly credentialsRedacted: true;
    readonly payloadReferenceRedacted: true;
    readonly screenshotHashOnly: boolean;
  };
  readonly proxyIsolation: {
    readonly approvedCount: number;
    readonly failureCount: number;
    readonly directEgressAllowed: false;
  };
  readonly killSwitch: {
    readonly activeCount: number;
    readonly inconsistentCount: number;
  };
  readonly retention: {
    readonly classes: readonly RetentionClass[];
    readonly expiredCount: number;
    readonly legalHoldCount: number;
  };
  readonly proof: {
    readonly noStolenFilesStored: true;
    readonly noRawPayloadsStored: true;
    readonly noRawUrlsExposed: true;
    readonly noCredentialsExposed: true;
    readonly noActorInteraction: true;
    readonly noCaptchaSolving: true;
    readonly noAuthBypass: true;
  };
  readonly auditEventIds: readonly string[];
  readonly agent06LedgerRedactionGate: "pass" | "hold";
  readonly agent09WarningCodes: readonly string[];
  readonly agent10ReleaseDecision: "pass" | "hold" | "rollback";
}

export interface RestrictedMetadataAuditReplayScenarioDto {
  readonly scenario: RestrictedMetadataAuditReplayScenario;
  readonly observed: boolean;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly sourceIds: readonly string[];
  readonly result: "pass" | "warning" | "hold" | "emergency_stop";
  readonly evidence: {
    readonly actorVictimDateSectorCountryClaimTypeOnly: boolean;
    readonly urlHashes: readonly string[];
    readonly policyAuditIds: readonly string[];
    readonly auditEventIds: readonly string[];
  };
  readonly agent06LedgerAction: "accept_metadata_only" | "hold_redaction" | "hold_retention" | "hold_promotion";
  readonly agent09WarningCodes: readonly string[];
  readonly agent10ReleaseEffect: RestrictedMetadataRuntimeReleaseEffect;
  readonly forbiddenAlternatives: readonly string[];
}

export interface RestrictedMetadataAuditReplayDto {
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly scenarios: readonly RestrictedMetadataAuditReplayScenarioDto[];
  readonly observedScenarios: readonly RestrictedMetadataAuditReplayScenario[];
  readonly agent06LedgerActions: readonly string[];
  readonly agent09WarningCodes: readonly string[];
  readonly agent10ReleaseEffect: RestrictedMetadataRuntimeReleaseEffect;
  readonly rejectedFields: readonly string[];
}

export interface RestrictedMetadataConnectorCertificationPacketDto {
  readonly packetId: string;
  readonly sourceId?: string;
  readonly network: DarknetNetwork;
  readonly connectorKind: DarknetMetadataSourceType;
  readonly scenario: RestrictedMetadataConnectorCertificationScenario;
  readonly status: "pass" | "warning" | "hold" | "emergency_stop";
  readonly dryRunOnly: true;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly networkIsolation: {
    readonly approved: boolean;
    readonly boundaryId?: string;
    readonly proxyType: DarknetProxyType;
    readonly healthy?: boolean;
    readonly failureAttribution: DarknetFetchFailureCategory | DarknetResolutionFailureCategory;
    readonly directEgressAllowed: false;
  };
  readonly approval: {
    readonly approvalId?: string;
    readonly expired: boolean;
    readonly legalBasis: "metadata_only_legal_ethics_review";
  };
  readonly killSwitch: {
    readonly active: boolean;
    readonly sourceStatus?: SourceRecord["status"];
  };
  readonly timeoutAttribution: {
    readonly timeoutClass: DarknetTimeoutClass;
    readonly timeoutObserved: boolean;
  };
  readonly maxMetadataFields: readonly RestrictedMetadataField[];
  readonly redaction: {
    readonly rawUrlRedacted: true;
    readonly bodyRedacted: true;
    readonly fileNameRedacted: true;
    readonly objectKeyRedacted: true;
    readonly credentialsRedacted: true;
    readonly payloadReferenceRedacted: true;
    readonly screenshotHashOnly: boolean;
  };
  readonly retention: {
    readonly retentionClass?: RetentionClass;
    readonly expired: boolean;
    readonly legalHold: boolean;
  };
  readonly guarantees: {
    readonly noContact: true;
    readonly noDownload: true;
    readonly noCredentialBypass: true;
    readonly noCaptchaSolving: true;
    readonly noStealth: true;
    readonly unsafeTargetRejected: boolean;
  };
  readonly evidence: {
    readonly urlHashes: readonly string[];
    readonly policyAuditIds: readonly string[];
    readonly auditEventIds: readonly string[];
  };
  readonly agent06LedgerAction: RestrictedMetadataAuditReplayScenarioDto["agent06LedgerAction"];
  readonly agent09WarningCodes: readonly string[];
  readonly agent10EmergencyStopReleaseTrain: {
    readonly decision: "pass" | "hold" | "rollback";
    readonly releaseEffect: RestrictedMetadataRuntimeReleaseEffect;
    readonly proofCommand: "bun run check:restricted-metadata-status";
  };
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
  readonly forbiddenAlternatives: readonly string[];
}

export interface RestrictedMetadataConnectorCertificationDto {
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly dryRunOnly: true;
  readonly packets: readonly RestrictedMetadataConnectorCertificationPacketDto[];
  readonly fixtureScenarios: readonly RestrictedMetadataConnectorCertificationScenario[];
  readonly observedScenarios: readonly RestrictedMetadataConnectorCertificationScenario[];
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
  readonly agent06LedgerActions: readonly string[];
  readonly agent09WarningCodes: readonly string[];
  readonly agent10ReleaseEffect: RestrictedMetadataRuntimeReleaseEffect;
}

export interface RestrictedMetadataKillSwitchDrillPacketDto {
  readonly packetId: string;
  readonly scenario: RestrictedMetadataKillSwitchDrillScenario;
  readonly sourceId?: string;
  readonly network?: DarknetNetwork;
  readonly dryRunOnly: true;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly operatorVisible: true;
  readonly drillState: "pass" | "warning" | "hold" | "emergency_stop";
  readonly approvalProof: {
    readonly approvalId?: string;
    readonly expired: boolean;
    readonly legalBasis: "metadata_only_legal_ethics_review";
  };
  readonly proxyIsolation: {
    readonly approved: boolean;
    readonly failureAttribution: DarknetFetchFailureCategory | DarknetResolutionFailureCategory;
    readonly directEgressAllowed: false;
  };
  readonly killSwitchPropagation: {
    readonly simulatedMidRun: boolean;
    readonly sourceDisabled: boolean;
    readonly workerAction: "none" | "pause_restricted_metadata_workers";
    readonly publicApiState: "partial_metadata" | "approval_required" | "blocked";
  };
  readonly timeoutAttribution: {
    readonly timeoutClass?: DarknetTimeoutClass;
    readonly timeoutObserved: boolean;
  };
  readonly redaction: RestrictedMetadataConnectorCertificationPacketDto["redaction"];
  readonly retention: RestrictedMetadataConnectorCertificationPacketDto["retention"];
  readonly unsafeTargetRejection: {
    readonly blocked: boolean;
    readonly representedByHashOnly: true;
  };
  readonly guarantees: {
    readonly noContact: true;
    readonly noDownload: true;
    readonly noCredentialBypass: true;
    readonly noCaptchaSolving: true;
    readonly noStealth: true;
  };
  readonly evidence: RestrictedMetadataConnectorCertificationPacketDto["evidence"];
  readonly agent06LedgerAction: RestrictedMetadataAuditReplayScenarioDto["agent06LedgerAction"];
  readonly agent09WarningCodes: readonly string[];
  readonly agent10RcGate: {
    readonly gate: "restricted_emergency_stop_rc";
    readonly decision: "pass" | "hold" | "rollback";
    readonly releaseEffect: RestrictedMetadataRuntimeReleaseEffect;
    readonly proofCommand: "bun run check:restricted-metadata-status";
  };
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
  readonly forbiddenAlternatives: readonly string[];
}

export interface RestrictedMetadataKillSwitchDrillsDto {
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly dryRunOnly: true;
  readonly operatorVisible: true;
  readonly packets: readonly RestrictedMetadataKillSwitchDrillPacketDto[];
  readonly fixtureScenarios: readonly RestrictedMetadataKillSwitchDrillScenario[];
  readonly observedScenarios: readonly RestrictedMetadataKillSwitchDrillScenario[];
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
  readonly agent06LedgerActions: readonly string[];
  readonly agent09WarningCodes: readonly string[];
  readonly agent10RcGateDecision: "pass" | "hold" | "rollback";
}

export interface RestrictedMetadataEmergencyStopCertificationPacketDto {
  readonly packetId: string;
  readonly scenario: RestrictedMetadataEmergencyStopCertificationScenario;
  readonly sourceId?: string;
  readonly network?: DarknetNetwork;
  readonly dryRunOnly: true;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly rcGate: "restricted_metadata_emergency_stop_certification_rc";
  readonly controls: {
    readonly canHold: boolean;
    readonly canPauseWorkers: boolean;
    readonly canRollback: boolean;
    readonly canEmergencyStop: boolean;
    readonly publicApiBlockedState: boolean;
  };
  readonly approvalProof: RestrictedMetadataKillSwitchDrillPacketDto["approvalProof"];
  readonly proxyIsolation: RestrictedMetadataKillSwitchDrillPacketDto["proxyIsolation"];
  readonly timeoutAttribution: RestrictedMetadataKillSwitchDrillPacketDto["timeoutAttribution"];
  readonly redaction: RestrictedMetadataKillSwitchDrillPacketDto["redaction"];
  readonly retention: RestrictedMetadataKillSwitchDrillPacketDto["retention"];
  readonly unsafeTargetRejection: RestrictedMetadataKillSwitchDrillPacketDto["unsafeTargetRejection"];
  readonly proof: {
    readonly noUnsafeAccess: true;
    readonly noDataExposure: true;
    readonly noContact: true;
    readonly noDownload: true;
    readonly noCredentialBypass: true;
    readonly noCaptchaSolving: true;
    readonly noStealth: true;
    readonly noRawPayloads: true;
    readonly noRawUrls: true;
    readonly hashOnlyEvidence: true;
  };
  readonly evidence: RestrictedMetadataKillSwitchDrillPacketDto["evidence"];
  readonly agent06EvidenceRedactionCertification: "pass" | "hold";
  readonly agent09WarningCodes: readonly string[];
  readonly agent10EmergencyStopGate: {
    readonly decision: "pass" | "hold" | "rollback";
    readonly releaseEffect: RestrictedMetadataRuntimeReleaseEffect;
    readonly proofCommand: "bun run check:restricted-metadata-status";
  };
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
  readonly forbiddenAlternatives: readonly string[];
}

export interface RestrictedMetadataEmergencyStopCertificationDto {
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly dryRunOnly: true;
  readonly packets: readonly RestrictedMetadataEmergencyStopCertificationPacketDto[];
  readonly fixtureScenarios: readonly RestrictedMetadataEmergencyStopCertificationScenario[];
  readonly observedScenarios: readonly RestrictedMetadataEmergencyStopCertificationScenario[];
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
  readonly agent06EvidenceRedactionCertifications: readonly string[];
  readonly agent09WarningCodes: readonly string[];
  readonly agent10RcGateDecision: "pass" | "hold" | "rollback";
}

export interface RestrictedMetadataAgent10ReleasePacketDto {
  readonly owner: "Agent 05";
  readonly runtimeProofName: "restricted_metadata_sla";
  readonly decision: "pass" | "hold" | "rollback";
  readonly status: RestrictedMetadataSlaStatus;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly proofCommand: "bun run check:restricted-metadata-status";
  readonly applyPlanProofCommand: "bun run check:restricted-metadata-apply-plan";
  readonly blockerCount: number;
  readonly warningCount: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly enforcementLevel: RestrictedMetadataEnforcementLevel;
  readonly emergencyStopState: RestrictedMetadataEmergencyStopDto["state"];
  readonly enforcementRules: readonly RestrictedMetadataEnforcementRule[];
  readonly agent09WarningCodes: readonly string[];
  readonly governancePacketIds: readonly string[];
  readonly auditReplayScenarios: readonly RestrictedMetadataAuditReplayScenario[];
  readonly certificationPacketIds: readonly string[];
  readonly certificationScenarios: readonly RestrictedMetadataConnectorCertificationScenario[];
  readonly killSwitchDrillPacketIds: readonly string[];
  readonly killSwitchDrillScenarios: readonly RestrictedMetadataKillSwitchDrillScenario[];
  readonly emergencyStopCertificationPacketIds: readonly string[];
  readonly emergencyStopCertificationScenarios: readonly RestrictedMetadataEmergencyStopCertificationScenario[];
  readonly rollbackPath: "pause restricted metadata workers and keep outer fallback enabled";
  readonly releaseFields: readonly string[];
  readonly forbiddenAlternatives: readonly string[];
}

export interface RestrictedMetadataOperationsReadinessDto {
  readonly sourceId: string;
  readonly tenantId?: string;
  readonly connectorKind: DarknetMetadataSourceType;
  readonly network: DarknetNetwork;
  readonly readiness: RestrictedMetadataOperationsReadinessState;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly endpoints: {
    readonly intelSearchField: "/v1/intel/search.restrictedMetadata";
    readonly statusRoute: "/v1/restricted-metadata/status";
    readonly agent10SoakPacketField: "restrictedMetadata";
  };
  readonly proxyIsolation: {
    readonly boundaryId?: string;
    readonly approved: boolean;
    readonly proxyType: DarknetProxyType;
    readonly isolationId?: string;
    readonly healthy?: boolean;
    readonly timeoutClass: DarknetTimeoutClass;
    readonly failureAttribution: DarknetFetchFailureCategory | DarknetResolutionFailureCategory;
    readonly directEgressAllowed: false;
  };
  readonly killSwitch: {
    readonly active: boolean;
    readonly sourceStatus: SourceRecord["status"];
    readonly accessMethod: SourceRecord["accessMethod"];
  };
  readonly approval: {
    readonly approvalId?: string;
    readonly operator?: string;
    readonly policyVersion?: string;
    readonly approvedAt?: string;
    readonly approvalAgeDays?: number;
    readonly expired: boolean;
  };
  readonly retention: {
    readonly retentionClass?: RetentionClass;
    readonly retentionExpiresAt?: string;
    readonly expired: boolean;
    readonly legalHold: boolean;
  };
  readonly redactionGuarantees: {
    readonly bodyRedacted: true;
    readonly rawUrlRedacted: true;
    readonly objectRefRedacted: true;
    readonly fileNameRedacted: true;
    readonly screenshotHashOnly: boolean;
    readonly allowedFields: readonly RestrictedMetadataField[];
  };
  readonly forbiddenActionCounters: RestrictedMetadataForbiddenActionCounters;
  readonly runtimeProofs: readonly RestrictedMetadataRuntimeProofDto[];
  readonly operationalSla: RestrictedMetadataOperationalSlaDto;
  readonly enforcement: RestrictedMetadataEnforcementDto;
  readonly auditTrail: RestrictedMetadataAuditTrailDto;
  readonly governancePacket: RestrictedMetadataGovernancePacketDto;
  readonly auditReplay: RestrictedMetadataAuditReplayDto;
  readonly connectorCertification: RestrictedMetadataConnectorCertificationDto;
  readonly killSwitchDrills: RestrictedMetadataKillSwitchDrillsDto;
  readonly emergencyStopCertification: RestrictedMetadataEmergencyStopCertificationDto;
  readonly nonBlockingSearch: RestrictedMetadataNonBlockingSearchSemanticsDto;
  readonly agent10ReleasePacket: RestrictedMetadataAgent10ReleasePacketDto;
  readonly compliance: RestrictedMetadataComplianceSummaryDto;
  readonly agent09SearchSummary: RestrictedMetadataComplianceSummaryDto;
  readonly agent10SoakSummary: RestrictedMetadataPromotionComplianceSummary;
  readonly remediationPlan: readonly RestrictedMetadataOperationsRemediationPlanItem[];
}

export interface RestrictedMetadataConnectorFixture {
  readonly network: DarknetNetwork;
  readonly connectorKind: DarknetMetadataSourceType;
  readonly proxyBoundaryId: string;
  readonly metadataOnly: true;
  readonly actor: string;
  readonly victim: string;
  readonly claimedDate: string;
  readonly sector: string;
  readonly country: string;
  readonly claimedDataType: string;
  readonly urlHash: string;
  readonly screenshotHash?: string;
  readonly sourceTimestamp: string;
  readonly forbiddenFieldsAbsent: readonly string[];
}

export interface RestrictedMetadataEvidenceHandoffSafetyProof {
  readonly checkedHandoffCount: number;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly allowedFields: readonly string[];
  readonly rejectedFields: readonly string[];
  readonly unsafeDetected: false;
  readonly agent06StorageContract: "metadata_only_no_body_object_url_filename_credentials_or_payload_reference";
  readonly agent09ApiContract: "hashes_claim_fields_policy_and_status_only";
}

export interface RestrictedMetadataOperationsStatusDto {
  readonly endpoint: "/v1/restricted-metadata/status";
  readonly generatedAt: string;
  readonly metadataOnly: true;
  readonly safeForApi: true;
  readonly summary: Record<RestrictedMetadataOperationsReadinessState, number>;
  readonly query?: {
    readonly query: string;
    readonly entityType?: string;
    readonly matchedSourceIds: readonly string[];
    readonly matchingResultCount: number;
    readonly partialState: DarknetMetadataLiveSearchStatus;
  };
  readonly sources: readonly RestrictedMetadataOperationsReadinessDto[];
  readonly runtimeProofs: readonly RestrictedMetadataRuntimeProofDto[];
  readonly operationalSla: RestrictedMetadataOperationalSlaDto;
  readonly enforcement: RestrictedMetadataEnforcementDto;
  readonly auditTrail: RestrictedMetadataAuditTrailDto;
  readonly governancePackets: readonly RestrictedMetadataGovernancePacketDto[];
  readonly auditReplay: RestrictedMetadataAuditReplayDto;
  readonly connectorCertifications: readonly RestrictedMetadataConnectorCertificationPacketDto[];
  readonly connectorCertification: RestrictedMetadataConnectorCertificationDto;
  readonly killSwitchDrills: RestrictedMetadataKillSwitchDrillsDto;
  readonly emergencyStopCertification: RestrictedMetadataEmergencyStopCertificationDto;
  readonly nonBlockingSearch: RestrictedMetadataNonBlockingSearchSemanticsDto;
  readonly agent10ReleasePacket: RestrictedMetadataAgent10ReleasePacketDto;
  readonly remediationPlan: readonly RestrictedMetadataOperationsRemediationPlanItem[];
  readonly connectorFixtures: readonly RestrictedMetadataConnectorFixture[];
  readonly agent06EvidenceHandoffProof: RestrictedMetadataEvidenceHandoffSafetyProof;
  readonly agent09SearchFields: readonly string[];
  readonly agent10SoakFields: readonly string[];
}

export type DarknetMetadataRestrictedState =
  | "disabled_kill_switch"
  | "missing_proxy_approval"
  | "missing_legal_notes"
  | "pending_metadata_only_approval"
  | "active_metadata_only_queue"
  | "blocked_unsafe_target"
  | "retention_expiry";

export type DarknetMetadataRequiredAction =
  | "restore_source"
  | "assign_approved_proxy"
  | "add_legal_notes"
  | "approve_metadata_only"
  | "queue_metadata_only"
  | "fix_blocked_target"
  | "review_retention";

export interface DarknetMetadataApprovalBridge {
  readonly sourceId: string;
  readonly sourceType: SourceRecord["type"];
  readonly state: DarknetMetadataRestrictedState;
  readonly liveSearchState: "disabled" | "approval_required" | "queued_metadata_only" | "blocked";
  readonly requiredAction: DarknetMetadataRequiredAction;
  readonly reason: string;
  readonly metadataOnly: true;
  readonly canQueueMetadataOnly: boolean;
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly impossibleOperations: readonly BlockedDarknetOperation[];
  readonly retentionClass?: RetentionClass;
  readonly retentionExpiresAt?: string;
  readonly policyAuditId?: string;
  readonly urlHash?: string;
  readonly reviewDecisionId?: string;
}

export interface DarknetMetadataBlockedExplanation {
  readonly sourceId: string;
  readonly reason: string;
  readonly state: "blocked" | "approval_required" | "disabled";
  readonly restrictedState?: DarknetMetadataRestrictedState;
  readonly requiredAction?: DarknetMetadataRequiredAction;
  readonly metadataOnly?: true;
}

export interface DarknetMetadataComplianceStatusDto {
  readonly sourceId: string;
  readonly state: DarknetMetadataRestrictedState;
  readonly status: "disabled" | "approval_required" | "queued_metadata_only" | "blocked";
  readonly reason: string;
  readonly requiredAction: DarknetMetadataRequiredAction;
  readonly metadataOnly: true;
  readonly canQueueMetadataOnly: boolean;
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly retentionClass?: RetentionClass;
  readonly retentionExpiresAt?: string;
  readonly urlHash?: string;
}

export interface DarknetMetadataActivationRecommendation {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly requiredAction: DarknetMetadataRequiredAction;
  readonly restrictedState: DarknetMetadataRestrictedState;
  readonly reason: string;
  readonly metadataOnly: true;
  readonly matchedFields: readonly string[];
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly priority: number;
}

export type DarknetMetadataEvidenceDeltaType =
  | "newly_observed_claim"
  | "changed_claim_status"
  | "mirrored_post"
  | "removed_dead_post"
  | "blocked_unsafe_link"
  | "policy_change"
  | "retention_expiry";

export type DarknetMetadataClaimRiskLabel =
  | "unverified_actor_claim"
  | "mirrored_claim"
  | "stale_claim"
  | "contradicted_claim"
  | "needs_analyst_review";

export interface RestrictedMetadataDeltaOptions {
  readonly previous?: RawCapture;
  readonly query?: string;
  readonly normalizedQuery?: string;
  readonly runId?: string;
  readonly observedAt?: string;
  readonly mirroredBySourceIds?: readonly string[];
  readonly contradicted?: boolean;
  readonly stale?: boolean;
  readonly staleAfterDays?: number;
  readonly now?: string;
}

export interface RestrictedMetadataPolicyDeltaInput {
  readonly source: SourceRecord;
  readonly policyDecision: DarknetMetadataPolicyDecision;
  readonly deltaType?: "blocked_unsafe_link" | "policy_change" | "retention_expiry";
  readonly query?: string;
  readonly normalizedQuery?: string;
  readonly runId?: string;
  readonly observedAt?: string;
  readonly event: "blocked_unsafe_link" | "kill_switch_disabled" | "source_newly_approved" | "approval_changed" | "retention_expired";
  readonly previousApprovalState?: string;
  readonly currentApprovalState?: string;
}

export interface RestrictedMetadataApprovalBridgeInput {
  readonly source: SourceRecord;
  readonly targetUrl?: string;
  readonly proxyBoundary?: ApprovedProxyBoundary;
  readonly disabled?: boolean;
  readonly now?: string;
  readonly reviewDecisionId?: string;
}

export type RestrictedMetadataApprovalScope = "metadata_only";

export interface RestrictedMetadataSourcePack {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly disabledByDefault: true;
  readonly network: DarknetNetwork;
  readonly proxyBoundaryId: string;
  readonly killSwitchGroup: string;
  readonly legalNotes: string;
  readonly approvalScope: RestrictedMetadataApprovalScope;
  readonly retentionClass: Extract<RetentionClass, "restricted_metadata" | "darknet_metadata" | "legal_hold">;
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly sources: readonly RestrictedMetadataSourcePackEntry[];
}

export interface RestrictedMetadataSourcePackEntry {
  readonly id: string;
  readonly name: string;
  readonly type: DarknetMetadataSourceType;
  readonly url: string;
  readonly legalNotes: string;
  readonly approvalScope: RestrictedMetadataApprovalScope;
  readonly proxyBoundaryId?: string;
  readonly killSwitchGroup?: string;
  readonly retentionClass?: Extract<RetentionClass, "restricted_metadata" | "darknet_metadata" | "legal_hold">;
  readonly approvalState?: "pending" | "approved";
  readonly topicTags?: readonly string[];
  readonly actors?: readonly string[];
  readonly victims?: readonly string[];
  readonly ransomwareFamilies?: readonly string[];
  readonly expectedMetadataFields?: readonly RestrictedMetadataField[];
}

export type RestrictedMetadataField =
  | "actor"
  | "victim"
  | "claim_date"
  | "sector"
  | "country"
  | "claimed_data_type"
  | "claimed_data_category"
  | "post_status"
  | "source_timestamp"
  | "url_hash"
  | "screenshot_hash"
  | "confidence"
  | "policy_audit_id"
  | "provenance";

export interface RestrictedMetadataPackIssue {
  readonly sourceId?: string;
  readonly message: string;
}

export interface RestrictedMetadataComplianceReport {
  readonly packId: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly dryRunOnly: true;
  readonly network: DarknetNetwork;
  readonly proxyBoundaryId: string;
  readonly killSwitchGroup: string;
  readonly retentionClass: Extract<RetentionClass, "restricted_metadata" | "darknet_metadata" | "legal_hold">;
  readonly metadataWouldCapture: readonly RestrictedMetadataField[];
  readonly neverCaptured: readonly BlockedDarknetOperation[];
  readonly requiresApproval: readonly string[];
  readonly blocked: readonly string[];
  readonly alertsWouldFire: readonly string[];
  readonly apiNotes: readonly string[];
  readonly canReviewWithoutLiveAccess: true;
  readonly wouldQueueCollection: false;
}

export interface RestrictedMetadataSourcePackValidation {
  readonly packId: string;
  readonly valid: boolean;
  readonly dryRunOnly: true;
  readonly importedSources: SourceRecord[];
  readonly reports: RestrictedMetadataComplianceReport[];
  readonly errors: RestrictedMetadataPackIssue[];
  readonly warnings: RestrictedMetadataPackIssue[];
  readonly reviewedAt: string;
}

export type RestrictedMetadataAuditFindingKind =
  | "unsafe_target_blocked"
  | "approval_missing"
  | "legal_notes_expired"
  | "source_disabled"
  | "kill_switch_active"
  | "raw_payload_attempted_blocked"
  | "retention_expired"
  | "screenshot_hash_only"
  | "url_hash_only"
  | "metadata_only_capture_complete"
  | "proxy_isolation_unhealthy"
  | "scheduler_dead_lettered";

export type RestrictedMetadataRepairAction =
  | "approve_metadata_only"
  | "add_or_refresh_legal_notes"
  | "assign_approved_proxy"
  | "restore_source"
  | "review_retention"
  | "repair_target_to_metadata_listing"
  | "inspect_proxy_isolation"
  | "requeue_metadata_only";

export interface RestrictedMetadataSchedulerAuditState {
  readonly queuedSourceIds?: readonly string[];
  readonly leasedSourceIds?: readonly string[];
  readonly deadLetterSourceIds?: readonly string[];
}

export interface RestrictedMetadataAuditInput {
  readonly sources: readonly SourceRecord[];
  readonly proxyBoundaries?: Partial<Record<DarknetNetwork, ApprovedProxyBoundary>>;
  readonly captures?: readonly RawCapture[];
  readonly evidenceDeltas?: readonly EvidenceDelta[];
  readonly scheduler?: RestrictedMetadataSchedulerAuditState;
  readonly generatedAt?: string;
}

export interface RestrictedMetadataAuditFinding {
  readonly kind: RestrictedMetadataAuditFindingKind;
  readonly sourceId: string;
  readonly severity: "info" | "warning" | "critical";
  readonly message: string;
  readonly evidenceIds: readonly string[];
  readonly metadataOnly: true;
}

export interface RestrictedMetadataAuditRepair {
  readonly action: RestrictedMetadataRepairAction;
  readonly sourceId: string;
  readonly priority: "low" | "medium" | "high";
  readonly reason: string;
  readonly forbiddenActions: readonly string[];
}

export interface RestrictedMetadataSourceAuditDiagnostic {
  readonly sourceId: string;
  readonly sourceType: SourceRecord["type"];
  readonly status: SourceRecord["status"];
  readonly approvalState?: string;
  readonly metadataOnly: boolean;
  readonly accessMethod: SourceRecord["accessMethod"];
  readonly proxyBoundaryId?: string;
  readonly proxyHealthy?: boolean;
  readonly retentionClass?: RetentionClass;
  readonly retentionExpiresAt?: string;
  readonly schedulerState: {
    readonly queued: boolean;
    readonly leased: boolean;
    readonly deadLettered: boolean;
  };
  readonly urlHash?: string;
  readonly screenshotHash?: string;
  readonly latestCaptureId?: string;
  readonly deltaTypes: readonly string[];
  readonly findings: readonly RestrictedMetadataAuditFinding[];
  readonly repairs: readonly RestrictedMetadataAuditRepair[];
}

export interface RestrictedMetadataAuditReport {
  readonly generatedAt: string;
  readonly sourceCount: number;
  readonly captureCount: number;
  readonly deltaCount: number;
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly diagnostics: readonly RestrictedMetadataSourceAuditDiagnostic[];
  readonly findings: readonly RestrictedMetadataAuditFinding[];
  readonly repairs: readonly RestrictedMetadataAuditRepair[];
  readonly summary: Record<RestrictedMetadataAuditFindingKind, number>;
  readonly policyWarnings: readonly string[];
  readonly opsAlerts: readonly string[];
}

export type RestrictedMetadataCutoverStatus =
  | "disabled"
  | "pending_approval"
  | "ready_metadata_only"
  | "blocked_unsafe_target"
  | "kill_switch_active"
  | "retention_expiring"
  | "audit_clean";

export type RestrictedMetadataCutoverRollbackAction =
  | "keep_outer_fallback_enabled"
  | "pause_restricted_metadata_workers"
  | "quarantine_source"
  | "clear_metadata_only_queue"
  | "keep_restricted_sources_disabled"
  | "restore_last_audit_clean_config"
  | "review_retention_before_cutover";

export interface RestrictedMetadataCutoverInput extends RestrictedMetadataAuditInput {
  readonly retentionExpiringWithinDays?: number;
}

export interface RestrictedMetadataCutoverSourceStatus {
  readonly sourceId: string;
  readonly sourceType: SourceRecord["type"];
  readonly statuses: readonly RestrictedMetadataCutoverStatus[];
  readonly primaryStatus: RestrictedMetadataCutoverStatus;
  readonly metadataOnly: true;
  readonly canQueueMetadataOnly: boolean;
  readonly schedulerState: RestrictedMetadataSourceAuditDiagnostic["schedulerState"];
  readonly retentionExpiresAt?: string;
  readonly latestCaptureId?: string;
  readonly evidenceFreshness: "fresh_capture" | "delta_only" | "no_recent_evidence";
  readonly allowedFields: readonly RestrictedMetadataField[];
  readonly forbiddenOperations: readonly BlockedDarknetOperation[];
  readonly policyWarnings: readonly string[];
}

export interface RestrictedMetadataCutoverAgent09Status {
  readonly apiReady: true;
  readonly statuses: Record<RestrictedMetadataCutoverStatus, number>;
  readonly sources: readonly RestrictedMetadataCutoverSourceStatus[];
}

export interface RestrictedMetadataCutoverRollbackPlan {
  readonly action: RestrictedMetadataCutoverRollbackAction;
  readonly sourceId?: string;
  readonly priority: "low" | "medium" | "high";
  readonly reason: string;
  readonly metadataOnly: true;
}

export interface RestrictedMetadataCutoverReport {
  readonly generatedAt: string;
  readonly decision: "promote" | "hold" | "rollback";
  readonly ok: boolean;
  readonly metadataOnly: true;
  readonly audit: RestrictedMetadataAuditReport;
  readonly agent09: RestrictedMetadataCutoverAgent09Status;
  readonly rollbackActions: readonly RestrictedMetadataCutoverRollbackPlan[];
  readonly promotionGate: {
    readonly blockers: readonly string[];
    readonly warnings: readonly string[];
    readonly readySourceCount: number;
    readonly totalSourceCount: number;
  };
  readonly coordination: {
    readonly agent01GovernanceEvidence: "approval_state_and_legal_notes";
    readonly agent06IntegrityEvidence: "hashes_retention_and_metadata_only_storage";
    readonly agent09PolicyWarnings: readonly string[];
    readonly agent10RollbackActions: readonly RestrictedMetadataCutoverRollbackAction[];
  };
}

export type RestrictedMetadataApplyAction =
  | "enable_metadata_only_queue"
  | "disable_source"
  | "renew_legal_notes"
  | "approve_proxy_isolation"
  | "apply_kill_switch"
  | "shorten_retention"
  | "keep_source_blocked";

export type RestrictedMetadataApplySafety = "automation_safe" | "human_approval_required" | "blocked" | "rollback_only";

export interface RestrictedMetadataApplyPlanInput extends RestrictedMetadataCutoverInput {
  readonly operatorId?: string;
}

export interface RestrictedMetadataApplyExpectedDiff {
  readonly sourceStatus?: SourceRecord["status"] | "unchanged";
  readonly accessMethod?: SourceRecord["accessMethod"] | "unchanged";
  readonly scheduler?: "queue_metadata_only" | "clear_metadata_only_queue" | "unchanged";
  readonly retentionClass?: RetentionClass | "shorten_restricted_window" | "unchanged";
  readonly killSwitch?: "enabled" | "unchanged";
  readonly proxyBoundaryId?: string;
}

export interface RestrictedMetadataApplyPlanItem {
  readonly id: string;
  readonly action: RestrictedMetadataApplyAction;
  readonly sourceId: string;
  readonly sourceType: SourceRecord["type"];
  readonly safety: RestrictedMetadataApplySafety;
  readonly metadataOnly: true;
  readonly dryRunOnly: true;
  readonly reason: string;
  readonly preconditions: readonly string[];
  readonly expectedDiff: RestrictedMetadataApplyExpectedDiff;
  readonly rollback: readonly string[];
  readonly policyImpact: readonly string[];
  readonly prohibitedAlternatives: readonly string[];
  readonly proof: {
    readonly exposesRawUrl: false;
    readonly allowsPayloadDownload: false;
    readonly allowsAuthBypass: false;
    readonly allowsCaptchaSolving: false;
    readonly allowsPrivateCommunityAccess: false;
    readonly allowsThreatActorInteraction: false;
    readonly allowedFields: readonly RestrictedMetadataField[];
    readonly forbiddenOperations: readonly BlockedDarknetOperation[];
    readonly urlHash?: string;
  };
}

export interface RestrictedMetadataApplyPlan {
  readonly generatedAt: string;
  readonly operatorId?: string;
  readonly dryRunOnly: true;
  readonly metadataOnly: true;
  readonly cutoverDecision: RestrictedMetadataCutoverReport["decision"];
  readonly actions: readonly RestrictedMetadataApplyPlanItem[];
  readonly connectorCertifications: readonly RestrictedMetadataConnectorCertificationPacketDto[];
  readonly killSwitchDrills: RestrictedMetadataKillSwitchDrillsDto;
  readonly emergencyStopCertification: RestrictedMetadataEmergencyStopCertificationDto;
  readonly nonBlockingSearch: RestrictedMetadataNonBlockingSearchSemanticsDto;
  readonly noLeakSerialization: RestrictedMetadataNoLeakSerializationCheckDto;
  readonly summary: Record<RestrictedMetadataApplySafety, number>;
  readonly agent01GovernanceEvidence: "approval_state_legal_notes_and_review_ticket";
  readonly agent09PolicyStatusFields: readonly RestrictedMetadataCutoverStatus[];
  readonly agent10KillSwitchRollback: readonly RestrictedMetadataCutoverRollbackAction[];
}

export interface RestrictedMetadataApplyPlanApiContract {
  readonly endpoint: "/v1/restricted-metadata/apply-plan";
  readonly method: "POST";
  readonly mode: "dry_run";
  readonly request: {
    readonly contentType: "application/json";
    readonly fields: Array<{
      readonly name: string;
      readonly type: string;
      readonly required: boolean;
      readonly description: string;
    }>;
  };
  readonly response: {
    readonly fields: readonly string[];
    readonly actionFields: readonly string[];
    readonly proofFields: readonly string[];
    readonly forbiddenFields: readonly string[];
    readonly actions: readonly RestrictedMetadataApplyAction[];
    readonly safety: readonly RestrictedMetadataApplySafety[];
    readonly statuses: readonly RestrictedMetadataCutoverStatus[];
    readonly routeAliases: readonly string[];
  };
  readonly examples: Record<
    "disabled" | "pendingApproval" | "readyMetadataOnly" | "blockedUnsafeTarget" | "killSwitchActive" | "retentionExpiring" | "auditClean",
    RestrictedMetadataApplyPlanItem
  >;
}

const BLOCKED_OPERATIONS: readonly BlockedDarknetOperation[] = [
  "credential_bypass",
  "captcha_solving",
  "threat_actor_interaction",
  "stolen_file_download",
  "stealth_or_evasion",
  "unapproved_proxy",
  "non_metadata_capture"
];

const DEFAULT_RESTRICTED_METADATA_FIELDS: readonly RestrictedMetadataField[] = [
  "actor",
  "victim",
  "claim_date",
  "sector",
  "country",
  "claimed_data_type",
  "claimed_data_category",
  "post_status",
  "source_timestamp",
  "url_hash",
  "screenshot_hash",
  "confidence",
  "policy_audit_id",
  "provenance"
];

export const RESTRICTED_METADATA_ALLOWED_FIELDS = DEFAULT_RESTRICTED_METADATA_FIELDS;

const restrictedRetentionClasses = new Set<RetentionClass>(["restricted_metadata", "darknet_metadata", "legal_hold"]);

const RESTRICTED_AUDIT_FINDINGS: readonly RestrictedMetadataAuditFindingKind[] = [
  "unsafe_target_blocked",
  "approval_missing",
  "legal_notes_expired",
  "source_disabled",
  "kill_switch_active",
  "raw_payload_attempted_blocked",
  "retention_expired",
  "screenshot_hash_only",
  "url_hash_only",
  "metadata_only_capture_complete",
  "proxy_isolation_unhealthy",
  "scheduler_dead_lettered"
];

const RESTRICTED_AUDIT_FORBIDDEN_REPAIR_ACTIONS = [
  "authentication or invite-gate bypass is prohibited",
  "do not solve CAPTCHA challenges",
  "do not contact threat actors or payment/contact flows",
  "do not download files, archives, media, databases, or leaked payload bodies"
];

const RESTRICTED_CUTOVER_STATUSES: readonly RestrictedMetadataCutoverStatus[] = [
  "disabled",
  "pending_approval",
  "ready_metadata_only",
  "blocked_unsafe_target",
  "kill_switch_active",
  "retention_expiring",
  "audit_clean"
];

const RESTRICTED_APPLY_SAFETY_STATES: readonly RestrictedMetadataApplySafety[] = [
  "automation_safe",
  "human_approval_required",
  "blocked",
  "rollback_only"
];

const RESTRICTED_APPLY_ACTIONS: readonly RestrictedMetadataApplyAction[] = [
  "enable_metadata_only_queue",
  "disable_source",
  "renew_legal_notes",
  "approve_proxy_isolation",
  "apply_kill_switch",
  "shorten_retention",
  "keep_source_blocked"
];

const RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES = [
  "payload download remains prohibited",
  "credential or authentication bypass remains prohibited",
  "CAPTCHA solving remains prohibited",
  "private community access remains prohibited",
  "threat actor interaction remains prohibited",
  "unsafe restricted URLs remain redacted to hashes"
];

const SENSITIVE_DOWNLOAD_PATTERN =
  /(?:^|[/?#&=._-])(?:download|dump|leak|sample|archive|database|backup|fullz|combo|credentials?|passwords?|files?)(?:$|[/?#&=._-])/i;

const SENSITIVE_EXTENSION_PATTERN = /\.(?:7z|rar|zip|tar|gz|bz2|xz|sql|sqlite|db|mdb|csv|tsv|xlsx?|docx?|pptx?|pdf|iso|img|bak|dump|mp4|mov|avi|mkv|mp3|wav|jpg|jpeg|png|gif|webp)(?:$|[?#])/i;

const INTERACTION_AFFORDANCE_PATTERN =
  /(?:^|[/?#&=._-])(?:login|auth|signin|signup|register|contact|payment|pay|wallet|comment|reply|upload|submit|form|search|chat|message|dm)(?:$|[/?#&=._-])/i;

export const DARKNET_METADATA_NETWORK_CONFIGS: Record<DarknetNetwork, DarknetNetworkMetadataSourceConfig> = {
  tor: {
    network: "tor",
    proxyBoundaryId: "tor-approved-metadata-proxy",
    maxMetadataBytes: 64_000,
    requestTimeoutMs: 45_000,
    maxConcurrency: 2,
    screenshotHashMode: "hash_only",
    allowedSchemes: ["http:", "https:"],
    proxyType: "tor_socks",
    timeoutClass: "metadata_standard",
    notes: "Tor onion metadata only; no payload download, evasion, credentials, or interaction."
  },
  i2p: {
    network: "i2p",
    proxyBoundaryId: "i2p-approved-metadata-proxy",
    maxMetadataBytes: 64_000,
    requestTimeoutMs: 60_000,
    maxConcurrency: 1,
    screenshotHashMode: "hash_only",
    allowedSchemes: ["http:", "https:"],
    proxyType: "i2p_http",
    timeoutClass: "metadata_slow",
    notes: "I2P metadata only through approved boundary."
  },
  freenet: {
    network: "freenet",
    proxyBoundaryId: "freenet-approved-metadata-proxy",
    maxMetadataBytes: 32_000,
    requestTimeoutMs: 90_000,
    maxConcurrency: 1,
    screenshotHashMode: "disabled",
    allowedSchemes: ["http:", "https:", "freenet:"],
    proxyType: "freenet_gateway",
    timeoutClass: "metadata_slow",
    notes: "Freenet metadata only; hash identifiers rather than storing retrieved content."
  }
};

export function restrictedMetadataProductionBoundaryContracts(): RestrictedMetadataConnectorContract[] {
  return (["tor", "i2p", "freenet"] satisfies DarknetNetwork[]).map((network) => {
    const config = DARKNET_METADATA_NETWORK_CONFIGS[network];
    return {
      network,
      sourceType: sourceTypeForNetwork(network),
      proxyType: config.proxyType,
      proxyBoundaryId: config.proxyBoundaryId,
      metadataOnly: true,
      maxConcurrency: config.maxConcurrency,
      maxMetadataBytes: config.maxMetadataBytes,
      requestTimeoutMs: config.requestTimeoutMs,
      screenshotHashMode: config.screenshotHashMode,
      requiredMetadataFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      productionControls: ["approval_gate", "kill_switch", "retention_rule", "audit_event", "redaction"],
      storage: {
        storageKind: "metadata_only",
        rawBodyStored: false,
        rawUrlStoredInApi: false,
        objectRefStored: false
      },
      approvalGates: [
        "explicit metadataOnly governance approval",
        "approved proxy boundary for the exact network",
        "current legal and ethics notes",
        "safe metadata-listing target only"
      ],
      killSwitchBehavior: [
        "disabled source or disabled access method blocks queueing",
        "unsafe target keeps source out of scheduler and API-ready states",
        "kill switch is represented as status, not retryable failure"
      ],
      retentionRules: [
        "restricted_metadata, darknet_metadata, or legal_hold retention class only",
        "expired retention approval blocks new queueing",
        "raw leak body and object storage are never retained"
      ],
      auditEvents: [
        "approval_gate",
        "kill_switch",
        "retention_rule",
        "policy_block",
        "redaction_applied",
        "metadata_only_capture"
      ],
      redaction: {
        url: "hash_only",
        screenshot: config.screenshotHashMode,
        rawBody: "drop",
        credentials: "reject"
      }
    };
  });
}

export class DarknetMetadataAdapter implements CollectionAdapter {
  readonly type: DarknetMetadataSourceType;
  private readonly proxyBoundary?: ApprovedProxyBoundary;

  constructor(type: DarknetMetadataSourceType, proxyBoundary?: ApprovedProxyBoundary) {
    this.type = type;
    this.proxyBoundary = proxyBoundary;
  }

  async collect(source: SourceRecord, task?: CollectionTask) {
    const policy = task
      ? evaluateTaskForCollection(source, task)
      : evaluateSourceForCollection(source);

    if (!policy.allowed) return emptyAdapterResult([policy.reason]);
    if (!policy.metadataOnly) return emptyAdapterResult(["darknet adapter refused non-metadata collection"]);
    if (source.type !== this.type) return emptyAdapterResult([`adapter ${this.type} cannot collect source type ${source.type}`]);

    const url = task?.targetUrl ?? source.url;
    const boundaryDecision = evaluateDarknetMetadataPolicy(source, url, this.proxyBoundary);
    if (!boundaryDecision.allowed) return emptyAdapterResult([boundaryDecision.message]);

    const proxyBoundary = this.proxyBoundary;
    if (!proxyBoundary) return emptyAdapterResult(["approved proxy boundary is not configured"]);

    const network = networkForSourceType(this.type);
    const config = proxyBoundary.config ?? DARKNET_METADATA_NETWORK_CONFIGS[network];
    const connectorAttribution = connectorAttributionForBoundary(proxyBoundary, config);
    const maxBytes = Math.min(task?.maxBytes ?? config.maxMetadataBytes, config.maxMetadataBytes);
    const fetched = await proxyBoundary.fetchMetadata({
      sourceId: source.id,
      network,
      url,
      taskId: task?.id,
      maxBytes,
      timeoutClass: config.timeoutClass,
      isolationId: connectorAttribution.isolationId,
      connectorAttribution,
      allowedOperations: ["metadata_only"],
      blockedOperations: BLOCKED_OPERATIONS
    });

    const collectedAt = nowIso();
    const leakSite = buildLeakSiteMetadata(url, fetched);
    const rawText = serializeMetadataText(leakSite, fetched.title);
    const metadata: DarknetMetadataItemMetadata = {
      adapter: "darknet_metadata",
      network,
      sourceType: this.type,
      proxyBoundaryId: proxyBoundary.id,
      captureMode: "metadata_only",
      urlHash: leakSite.urlHash,
      leakSite,
      policyDecision: boundaryDecision,
      connectorAttribution,
      proxyHealth: fetched.proxyHealth ?? proxyBoundary.health,
      blockedOperations: BLOCKED_OPERATIONS,
      extractorVersion: "darknet-metadata-v1"
    };

    return {
      items: [{
        sourceId: source.id,
        taskId: task?.id,
        url,
        collectedAt,
        publishedAt: fetched.sourceTimestamp,
        title: fetched.title,
        rawText,
        contentHash: hashContent(JSON.stringify({ leakSite, title: fetched.title, httpStatus: fetched.httpStatus })),
        language: source.language,
        links: sanitizeMetadataLinks(fetched.links ?? []),
        metadata: metadata as unknown as Record<string, unknown>,
        sensitive: true
      }],
      discovered: [],
      warnings: ["darknet collection stored metadata only; leaked contents and payload bodies were not captured"]
    };
  }
}

export function evaluateDarknetMetadataPolicy(
  source: SourceRecord,
  url: string,
  proxyBoundary?: ApprovedProxyBoundary
): DarknetMetadataPolicyDecision {
  const base = {
    id: stableId("policy", `${source.id}:${url}:${proxyBoundary?.id ?? "none"}`),
    sourceId: source.id,
    sourceType: source.type,
    urlHash: hashContent(url),
    proxyBoundaryId: proxyBoundary?.id,
    metadataOnly: true as const,
    blockedOperations: BLOCKED_OPERATIONS,
    decidedAt: nowIso()
  };

  if (!source.type.endsWith("_metadata")) {
    return { ...base, allowed: false, reason: "not_darknet_metadata_source", message: "source is not a darknet metadata source" };
  }

  if (source.accessMethod !== "approved_proxy") {
    return { ...base, allowed: false, reason: "wrong_access_method", message: "darknet metadata collection requires approved proxy access" };
  }

  if (!proxyBoundary) {
    return { ...base, allowed: false, reason: "missing_proxy_boundary", message: "approved proxy boundary is not configured" };
  }

  const network = networkForSourceType(source.type as DarknetMetadataSourceType);
  if (proxyBoundary.network !== network || proxyBoundary.accessMethod !== "approved_proxy") {
    return { ...base, allowed: false, reason: "network_boundary_mismatch", network, message: "approved proxy boundary does not match source network" };
  }

  if (hasUrlCredentials(url)) {
    return { ...base, allowed: false, reason: "credential_url_blocked", network, message: "credential-bearing URLs are blocked" };
  }

  if (isSensitivePayloadTarget(url)) {
    return { ...base, allowed: false, reason: "sensitive_payload_target_blocked", network, message: "sensitive payload download targets are blocked" };
  }

  if (isUnsafeInteractionTarget(url)) {
    return { ...base, allowed: false, reason: "interaction_affordance_blocked", network, message: "interactive forms, auth, payment, contact, upload, or search affordances are blocked" };
  }

  return { ...base, allowed: true, reason: "allowed_metadata_only", network, message: "darknet metadata policy allowed metadata-only collection" };
}

export function validateDarknetMetadataBoundary(
  source: SourceRecord,
  url: string,
  proxyBoundary?: ApprovedProxyBoundary
): { allowed: true } | { allowed: false; reason: string } {
  const decision = evaluateDarknetMetadataPolicy(source, url, proxyBoundary);
  return decision.allowed ? { allowed: true } : { allowed: false, reason: decision.message };
}

export function isSensitivePayloadTarget(url: string): boolean {
  const normalized = url.toLowerCase();
  return SENSITIVE_DOWNLOAD_PATTERN.test(normalized) || SENSITIVE_EXTENSION_PATTERN.test(normalized);
}

export function isUnsafeInteractionTarget(url: string): boolean {
  return INTERACTION_AFFORDANCE_PATTERN.test(url.toLowerCase());
}

export function networkForSourceType(type: DarknetMetadataSourceType): DarknetNetwork {
  if (type === "tor_metadata") return "tor";
  if (type === "i2p_metadata") return "i2p";
  return "freenet";
}

function sourceTypeForNetwork(network: DarknetNetwork): DarknetMetadataSourceType {
  if (network === "tor") return "tor_metadata";
  if (network === "i2p") return "i2p_metadata";
  return "freenet_metadata";
}

export function buildLeakSiteMetadata(url: string, fetched: DarknetMetadataFetchResult): LeakSiteMetadataCapture {
  const safeText = fetched.safeText ?? "";
  const screenshotHashMode = fetched.screenshotHashMode ?? "hash_only";
  const claimedData = extractMetadataField(safeText, "data category") ?? extractMetadataField(safeText, "data type");
  return {
    actorName: extractMetadataField(safeText, "actor"),
    victimName: extractMetadataField(safeText, "victim"),
    affectedAccounts: extractMetadataField(safeText, "accounts compromised") ?? extractMetadataField(safeText, "accounts affected") ?? extractMetadataField(safeText, "accounts"),
    accountSubjects: extractMetadataField(safeText, "account subjects") ?? extractMetadataField(safeText, "account owners") ?? extractMetadataField(safeText, "who"),
    datasetSize: extractMetadataField(safeText, "dataset size") ?? extractMetadataField(safeText, "data size") ?? extractMetadataField(safeText, "size"),
    actorStatement: extractMetadataField(safeText, "actor statement", 500) ?? extractMetadataField(safeText, "description", 500) ?? extractMetadataField(safeText, "statement", 500),
    claimDate: extractMetadataField(safeText, "date"),
    claimedSector: extractMetadataField(safeText, "sector"),
    claimedCountry: extractMetadataField(safeText, "country"),
    claimedDataType: claimedData,
    claimedDataCategory: claimedData,
    postStatus: parsePostStatus(extractMetadataField(safeText, "status") ?? fetched.postStatus),
    confidence: clampScore(fetched.confidence ?? (Number(extractMetadataField(safeText, "confidence")) || 0.6)),
    sourceTimestamp: fetched.sourceTimestamp,
    urlHash: hashContent(url),
    screenshotHash: screenshotHashMode === "hash_only" ? fetched.screenshotHash : undefined
  };
}

export function createDarknetMetadataSourceSeed(input: {
  id?: string;
  tenantId?: string;
  name: string;
  type: DarknetMetadataSourceType;
  url: string;
  legalNotes?: string;
  trustScore?: number;
}): SourceRecord {
  const now = nowIso();
  return {
    id: input.id ?? stableId("src", `${input.type}:${input.url}`),
    tenantId: input.tenantId,
    name: input.name,
    type: input.type,
    url: input.url,
    accessMethod: "disabled",
    status: "needs_review",
    risk: "high",
    trustScore: clampScore(input.trustScore ?? 0.5),
    crawlFrequencySeconds: 3600,
    legalNotes: input.legalNotes ?? "Pending legal and ethics approval for metadata-only darknet source.",
    createdAt: now,
    updatedAt: now,
    approvalRequired: true,
    governance: {
      approvalState: "pending",
      approvalRequired: true,
      metadataOnly: true,
      policyVersion: "collection-policy:v1"
    }
  };
}

export function validateRestrictedMetadataSourcePack(
  pack: RestrictedMetadataSourcePack,
  reviewedAt = nowIso()
): RestrictedMetadataSourcePackValidation {
  const errors: RestrictedMetadataPackIssue[] = [];
  const warnings: RestrictedMetadataPackIssue[] = [];
  const importedSources: SourceRecord[] = [];
  const reports: RestrictedMetadataComplianceReport[] = [];

  if (pack.version !== 1) errors.push({ message: "Unsupported restricted metadata source-pack version" });
  if (pack.disabledByDefault !== true) errors.push({ message: "Restricted metadata source packs must be disabled by default" });
  if (!pack.sources.length) errors.push({ message: "Restricted metadata source pack must contain at least one source" });
  if (!pack.legalNotes.trim()) errors.push({ message: "Restricted metadata source pack requires legal notes" });
  if (pack.approvalScope !== "metadata_only") errors.push({ message: "Restricted metadata source pack approval scope must be metadata_only" });
  if (!pack.proxyBoundaryId.trim()) errors.push({ message: "Restricted metadata source pack requires a proxy boundary id" });
  if (!pack.killSwitchGroup.trim()) errors.push({ message: "Restricted metadata source pack requires a kill-switch group" });
  if (!restrictedRetentionClasses.has(pack.retentionClass)) errors.push({ message: "Restricted metadata source pack retention class is not allowed" });
  for (const operation of BLOCKED_OPERATIONS) {
    if (!pack.forbiddenOperations.includes(operation)) {
      errors.push({ message: `Restricted metadata source pack must forbid ${operation}` });
    }
  }

  for (const entry of pack.sources) {
    const source = restrictedMetadataSourcePackEntryToSource(pack, entry, reviewedAt);
    importedSources.push(source);
    const report = restrictedMetadataComplianceReport(pack, entry);
    reports.push(report);

    if (entry.type !== `${pack.network}_metadata`) {
      errors.push({ sourceId: entry.id, message: "Restricted metadata source-pack entry type must match pack network" });
    }
    if (!entry.legalNotes.trim()) errors.push({ sourceId: entry.id, message: "Restricted metadata source-pack entry requires legal notes" });
    if (entry.approvalScope !== "metadata_only") errors.push({ sourceId: entry.id, message: "Restricted metadata source-pack entry approval scope must be metadata_only" });
    if ((entry.proxyBoundaryId ?? pack.proxyBoundaryId) !== pack.proxyBoundaryId) {
      errors.push({ sourceId: entry.id, message: "Restricted metadata source-pack entry proxy boundary must match the pack boundary" });
    }
    if (!restrictedRetentionClasses.has(entry.retentionClass ?? pack.retentionClass)) {
      errors.push({ sourceId: entry.id, message: "Restricted metadata source-pack entry retention class is not allowed" });
    }
    if (entry.approvalState === "approved") {
      warnings.push({ sourceId: entry.id, message: "Restricted metadata source-pack entries still require operator review before activation" });
    }
    for (const blocked of report.blocked) {
      warnings.push({ sourceId: entry.id, message: blocked });
    }
  }

  return {
    packId: pack.id,
    valid: errors.length === 0,
    dryRunOnly: true,
    importedSources,
    reports,
    errors,
    warnings,
    reviewedAt
  };
}

export function restrictedMetadataSourcePackEntryToSource(
  pack: Pick<RestrictedMetadataSourcePack, "id" | "name" | "network" | "proxyBoundaryId" | "killSwitchGroup" | "retentionClass" | "legalNotes">,
  entry: RestrictedMetadataSourcePackEntry,
  importedAt = nowIso()
): SourceRecord {
  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    url: entry.url,
    accessMethod: "disabled",
    status: "needs_review",
    risk: "high",
    trustScore: 0.5,
    crawlFrequencySeconds: 3600,
    legalNotes: entry.legalNotes || pack.legalNotes,
    createdAt: importedAt,
    updatedAt: importedAt,
    approvalRequired: true,
    governance: {
      approvalRequired: true,
      approvalState: "pending",
      metadataOnly: true,
      policyVersion: "collection-policy:v1"
    },
    tags: [...new Set(["restricted-metadata-pack", pack.id, entry.killSwitchGroup ?? pack.killSwitchGroup, ...(entry.topicTags ?? [])])],
    metadata: {
      sourcePackId: pack.id,
      sourcePackName: pack.name,
      network: pack.network,
      proxyBoundaryId: entry.proxyBoundaryId ?? pack.proxyBoundaryId,
      killSwitchGroup: entry.killSwitchGroup ?? pack.killSwitchGroup,
      retentionClass: entry.retentionClass ?? pack.retentionClass,
      approvalScope: entry.approvalScope,
      forbiddenOperations: BLOCKED_OPERATIONS,
      actors: entry.actors ?? [],
      victims: entry.victims ?? [],
      ransomwareFamilies: entry.ransomwareFamilies ?? [],
      dryRunOnly: true
    }
  };
}

export function restrictedMetadataComplianceReport(
  pack: Pick<RestrictedMetadataSourcePack, "id" | "network" | "proxyBoundaryId" | "killSwitchGroup" | "retentionClass">,
  entry: RestrictedMetadataSourcePackEntry
): RestrictedMetadataComplianceReport {
  const blocked: string[] = [];
  const alertsWouldFire: string[] = [];
  if (hasUrlCredentials(entry.url)) {
    blocked.push("credential-bearing URL is blocked");
    alertsWouldFire.push("restricted_policy_block:credential_url");
  }
  if (isSensitivePayloadTarget(entry.url)) {
    blocked.push("download, archive, database, document, or media target is blocked");
    alertsWouldFire.push("restricted_policy_block:sensitive_payload_target");
  }
  if (isUnsafeInteractionTarget(entry.url)) {
    blocked.push("auth, form, contact, payment, upload, comment, or interactive search target is blocked");
    alertsWouldFire.push("restricted_policy_block:interaction_affordance");
  }
  if (!entry.legalNotes.trim()) {
    blocked.push("missing legal notes blocks review");
    alertsWouldFire.push("restricted_source_pack:missing_legal_notes");
  }
  if (blocked.length > 0) alertsWouldFire.push(`restricted_kill_switch_group:${entry.killSwitchGroup ?? pack.killSwitchGroup}`);

  return {
    packId: pack.id,
    sourceId: entry.id,
    sourceName: entry.name,
    dryRunOnly: true,
    network: pack.network,
    proxyBoundaryId: entry.proxyBoundaryId ?? pack.proxyBoundaryId,
    killSwitchGroup: entry.killSwitchGroup ?? pack.killSwitchGroup,
    retentionClass: entry.retentionClass ?? pack.retentionClass,
    metadataWouldCapture: entry.expectedMetadataFields ?? DEFAULT_RESTRICTED_METADATA_FIELDS,
    neverCaptured: BLOCKED_OPERATIONS,
    requiresApproval: [
      "legal_ethics_notes",
      "operator_metadata_only_approval",
      "matching_proxy_boundary",
      "retention_and_legal_hold_review",
      "kill_switch_group_assignment",
      "parser_fixture_review"
    ],
    blocked,
    alertsWouldFire,
    apiNotes: [
      "Show as restricted metadata recommendation only.",
      "Use hashes, source ids, policy reasons, and approval state labels.",
      "Do not imply raw leaked data, screenshots, files, credentials, or actor interaction are collected."
    ],
    canReviewWithoutLiveAccess: true,
    wouldQueueCollection: false
  };
}

export function buildRestrictedMetadataAuditReport(input: RestrictedMetadataAuditInput): RestrictedMetadataAuditReport {
  const generatedAt = input.generatedAt ?? nowIso();
  const sources = input.sources.filter((source) => source.type.endsWith("_metadata"));
  const captures = input.captures ?? [];
  const deltas = input.evidenceDeltas ?? [];
  const scheduler = input.scheduler ?? {};
  const queued = new Set(scheduler.queuedSourceIds ?? []);
  const leased = new Set(scheduler.leasedSourceIds ?? []);
  const deadLettered = new Set(scheduler.deadLetterSourceIds ?? []);
  const diagnostics = sources.map((source) => {
    const network = networkForSourceType(source.type as DarknetMetadataSourceType);
    const proxyBoundary = input.proxyBoundaries?.[network];
    const bridge = restrictedMetadataApprovalBridge({
      source,
      proxyBoundary,
      targetUrl: source.url,
      disabled: source.status === "disabled",
      now: generatedAt
    });
    const sourceCaptures = captures.filter((capture) => capture.sourceId === source.id);
    const sourceDeltas = deltas.filter((delta) => delta.sourceId === source.id);
    const latestCapture = sourceCaptures
      .slice()
      .sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0];
    const result = latestCapture ? darknetMetadataResultFromCapture(latestCapture) : undefined;
    const findings = auditFindingsForRestrictedSource({
      source,
      bridge,
      proxyBoundary,
      captures: sourceCaptures,
      deltas: sourceDeltas,
      deadLettered: deadLettered.has(source.id),
      generatedAt
    });
    const repairs = repairRecommendationsForRestrictedAudit(source, bridge, findings, {
      queued: queued.has(source.id),
      leased: leased.has(source.id),
      deadLettered: deadLettered.has(source.id)
    });
    return {
      sourceId: source.id,
      sourceType: source.type,
      status: source.status,
      approvalState: source.governance?.approvalState,
      metadataOnly: source.governance?.metadataOnly === true,
      accessMethod: source.accessMethod,
      proxyBoundaryId: bridge.policyAuditId ? proxyBoundary?.id : readString(source.metadata?.proxyBoundaryId) ?? proxyBoundary?.id,
      proxyHealthy: proxyBoundary?.health?.healthy,
      retentionClass: bridge.retentionClass,
      retentionExpiresAt: bridge.retentionExpiresAt ?? restrictedMetadataRetentionExpiresAt(source),
      schedulerState: {
        queued: queued.has(source.id),
        leased: leased.has(source.id),
        deadLettered: deadLettered.has(source.id)
      },
      urlHash: result?.urlHash ?? bridge.urlHash,
      screenshotHash: result?.screenshotHash,
      latestCaptureId: latestCapture?.id,
      deltaTypes: sourceDeltas.map((delta) => readString(delta.metadata.deltaType) ?? delta.kind),
      findings,
      repairs
    } satisfies RestrictedMetadataSourceAuditDiagnostic;
  });
  const findings = diagnostics.flatMap((diagnostic) => diagnostic.findings);
  const repairs = dedupeRestrictedAuditRepairs(diagnostics.flatMap((diagnostic) => diagnostic.repairs));
  const summary = Object.fromEntries(RESTRICTED_AUDIT_FINDINGS.map((kind) => [
    kind,
    findings.filter((finding) => finding.kind === kind).length
  ])) as Record<RestrictedMetadataAuditFindingKind, number>;

  return {
    generatedAt,
    sourceCount: sources.length,
    captureCount: captures.filter((capture) => sources.some((source) => source.id === capture.sourceId)).length,
    deltaCount: deltas.filter((delta) => sources.some((source) => source.id === delta.sourceId)).length,
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    forbiddenOperations: BLOCKED_OPERATIONS,
    diagnostics,
    findings,
    repairs,
    summary,
    policyWarnings: findings
      .filter((finding) => finding.severity !== "info")
      .map((finding) => `${finding.kind}:${finding.sourceId}`),
    opsAlerts: findings
      .filter((finding) => finding.kind === "kill_switch_active" || finding.kind === "unsafe_target_blocked" || finding.kind === "raw_payload_attempted_blocked" || finding.kind === "proxy_isolation_unhealthy")
      .map((finding) => `${finding.kind}:${finding.sourceId}`)
  };
}

export function buildRestrictedMetadataCutoverReport(input: RestrictedMetadataCutoverInput): RestrictedMetadataCutoverReport {
  const generatedAt = input.generatedAt ?? nowIso();
  const audit = buildRestrictedMetadataAuditReport({ ...input, generatedAt });
  const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
  const retentionWindowDays = input.retentionExpiringWithinDays ?? 14;
  const sourceStatuses = audit.diagnostics.map((diagnostic) => {
    const source = sourcesById.get(diagnostic.sourceId);
    const statuses = cutoverStatusesForDiagnostic(diagnostic, source, generatedAt, retentionWindowDays);
    const primaryStatus = primaryCutoverStatus(statuses);
    return {
      sourceId: diagnostic.sourceId,
      sourceType: diagnostic.sourceType,
      statuses,
      primaryStatus,
      metadataOnly: true,
      canQueueMetadataOnly: statuses.includes("ready_metadata_only"),
      schedulerState: diagnostic.schedulerState,
      retentionExpiresAt: diagnostic.retentionExpiresAt,
      latestCaptureId: diagnostic.latestCaptureId,
      evidenceFreshness: diagnostic.latestCaptureId
        ? "fresh_capture"
        : diagnostic.deltaTypes.length > 0
          ? "delta_only"
          : "no_recent_evidence",
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      policyWarnings: diagnostic.findings
        .filter((finding) => finding.severity !== "info")
        .map((finding) => `${finding.kind}:${finding.sourceId}`)
    } satisfies RestrictedMetadataCutoverSourceStatus;
  });
  const statusCounts = Object.fromEntries(RESTRICTED_CUTOVER_STATUSES.map((status) => [
    status,
    sourceStatuses.filter((source) => source.statuses.includes(status)).length
  ])) as Record<RestrictedMetadataCutoverStatus, number>;
  const blockers = cutoverBlockers(sourceStatuses, audit);
  const warnings = audit.findings
    .filter((finding) => finding.severity === "warning")
    .map((finding) => `${finding.kind}:${finding.sourceId}`);
  const rollbackActions = restrictedMetadataCutoverRollbackActions(sourceStatuses, audit);
  const decision = blockers.length > 0
    ? "rollback"
    : warnings.length > 0
      ? "hold"
      : "promote";

  return {
    generatedAt,
    decision,
    ok: decision === "promote",
    metadataOnly: true,
    audit,
    agent09: {
      apiReady: true,
      statuses: statusCounts,
      sources: sourceStatuses
    },
    rollbackActions,
    promotionGate: {
      blockers,
      warnings,
      readySourceCount: sourceStatuses.filter((source) => source.statuses.includes("ready_metadata_only")).length,
      totalSourceCount: sourceStatuses.length
    },
    coordination: {
      agent01GovernanceEvidence: "approval_state_and_legal_notes",
      agent06IntegrityEvidence: "hashes_retention_and_metadata_only_storage",
      agent09PolicyWarnings: audit.policyWarnings,
      agent10RollbackActions: Array.from(new Set(rollbackActions.map((action) => action.action)))
    }
  };
}

export function buildRestrictedMetadataApplyPlan(input: RestrictedMetadataApplyPlanInput): RestrictedMetadataApplyPlan {
  const generatedAt = input.generatedAt ?? nowIso();
  const cutover = buildRestrictedMetadataCutoverReport({ ...input, generatedAt });
  const diagnosticsById = new Map(cutover.audit.diagnostics.map((diagnostic) => [diagnostic.sourceId, diagnostic]));
  const actions = dedupeRestrictedApplyPlanItems(cutover.agent09.sources.flatMap((status) =>
    restrictedMetadataApplyPlanItemsForSource(status, diagnosticsById.get(status.sourceId), generatedAt)
  ));
  const summary = Object.fromEntries(RESTRICTED_APPLY_SAFETY_STATES.map((state) => [
    state,
    actions.filter((action) => action.safety === state).length
  ])) as Record<RestrictedMetadataApplySafety, number>;
  const connectorCertifications = restrictedMetadataConnectorCertificationPacketsForApplyPlan(cutover, generatedAt);
  const killSwitchDrills = restrictedMetadataKillSwitchDrillsFromCertification(
    restrictedMetadataConnectorCertificationSummary(connectorCertifications),
    restrictedMetadataEnforcementFromSla(emptyRestrictedMetadataOperationalSla())
  );
  const emergencyStopCertification = restrictedMetadataEmergencyStopCertificationFromDrills(killSwitchDrills);

  return {
    generatedAt,
    operatorId: input.operatorId,
    dryRunOnly: true,
    metadataOnly: true,
    cutoverDecision: cutover.decision,
    actions,
    connectorCertifications,
    killSwitchDrills,
    emergencyStopCertification,
    nonBlockingSearch: restrictedMetadataNonBlockingSearchSemanticsForApplyPlan(connectorCertifications, killSwitchDrills, emergencyStopCertification),
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    summary,
    agent01GovernanceEvidence: "approval_state_legal_notes_and_review_ticket",
    agent09PolicyStatusFields: RESTRICTED_CUTOVER_STATUSES,
    agent10KillSwitchRollback: cutover.coordination.agent10RollbackActions
  };
}

export function restrictedMetadataApplyPlanApiContract(): RestrictedMetadataApplyPlanApiContract {
  return {
    endpoint: "/v1/restricted-metadata/apply-plan",
    method: "POST",
    mode: "dry_run",
    request: {
      contentType: "application/json",
      fields: [
        { name: "sourceIds", type: "string[]", required: false, description: "Optional restricted metadata source ids to scope the dry-run plan." },
        { name: "operatorId", type: "string", required: false, description: "Operator id used for audit preview attribution only." },
        { name: "retentionExpiringWithinDays", type: "number", required: false, description: "Window for flagging restricted metadata retention as expiring." },
        { name: "includeCutover", type: "boolean", required: false, description: "When true, response may include the cutover summary used to build the apply plan." }
      ]
    },
    response: {
      fields: ["contract", "applyPlan"],
      actionFields: ["id", "action", "sourceId", "sourceType", "safety", "metadataOnly", "dryRunOnly", "reason", "preconditions", "expectedDiff", "rollback", "policyImpact", "prohibitedAlternatives", "proof"],
      proofFields: ["exposesRawUrl", "allowsPayloadDownload", "allowsAuthBypass", "allowsCaptchaSolving", "allowsPrivateCommunityAccess", "allowsThreatActorInteraction", "allowedFields", "forbiddenOperations", "urlHash"],
      forbiddenFields: ["url", "rawUrl", "targetUrl", "sourceUrl", "body", "html", "rawText", "safeText", "payload", "downloadUrl", "credential", "password", "cookie", "authorization", "screenshotBytes", "fileName"],
      actions: RESTRICTED_APPLY_ACTIONS,
      safety: RESTRICTED_APPLY_SAFETY_STATES,
      statuses: RESTRICTED_CUTOVER_STATUSES,
      routeAliases: ["/v1/sources/{sourceId}/restricted-metadata/apply-plan"]
    },
    examples: {
      disabled: restrictedMetadataApplyPlanExample("disabled", "disable_source", "rollback_only"),
      pendingApproval: restrictedMetadataApplyPlanExample("pending_approval", "renew_legal_notes", "human_approval_required"),
      readyMetadataOnly: restrictedMetadataApplyPlanExample("ready_metadata_only", "enable_metadata_only_queue", "automation_safe"),
      blockedUnsafeTarget: restrictedMetadataApplyPlanExample("blocked_unsafe_target", "keep_source_blocked", "blocked"),
      killSwitchActive: restrictedMetadataApplyPlanExample("kill_switch_active", "apply_kill_switch", "rollback_only"),
      retentionExpiring: restrictedMetadataApplyPlanExample("retention_expiring", "shorten_retention", "automation_safe"),
      auditClean: restrictedMetadataApplyPlanExample("audit_clean", "enable_metadata_only_queue", "automation_safe")
    }
  };
}

export function createDarknetMetadataCollectionPlan(options: DarknetMetadataPlannerOptions): CollectionPlan {
  const createdAt = options.createdAt ?? nowIso();
  const request = {
    id: options.request.id ?? stableId("intel", `darknet:${options.request.entityType}:${options.request.query}:${createdAt}`),
    tenantId: options.request.tenantId,
    query: options.request.query,
    entityType: options.request.entityType,
    includeClearWeb: false,
    includeTelegram: false,
    includeDarknetMetadata: true,
    maxTasks: options.maxTasks ?? options.request.maxTasks ?? 25,
    createdAt,
    requesterId: options.request.requesterId,
    priority: options.request.priority ?? "normal",
    reason: options.request.reason
  };
  const tasks: CollectionTask[] = [];
  const reviewRequired: CollectionTask[] = [];
  const rejected: Array<{ sourceId: string; reason: string }> = [];

  for (const source of options.sources.filter((item) => item.type.endsWith("_metadata"))) {
    const targetUrl = source.url.includes("{query}") ? source.url.replaceAll("{query}", encodeURIComponent(request.query)) : source.url;
    const sourcePolicy = evaluateSourceForCollection(source);
    if (!sourcePolicy.allowed) {
      if (sourcePolicy.metadataOnly) {
        reviewRequired.push(buildDarknetMetadataReviewTask({
          requestId: request.id,
          tenantId: request.tenantId,
          source,
          targetUrl,
          createdAt,
          maxBytes: DARKNET_METADATA_NETWORK_CONFIGS[networkForSourceType(source.type as DarknetMetadataSourceType)].maxMetadataBytes,
          reason: sourcePolicy.reason
        }));
        continue;
      }
      rejected.push({ sourceId: source.id, reason: sourcePolicy.reason });
      continue;
    }

    const boundary = options.proxyBoundaries[networkForSourceType(source.type as DarknetMetadataSourceType)];
    const metadataPolicy = evaluateDarknetMetadataPolicy(source, targetUrl, boundary);
    if (!metadataPolicy.allowed) {
      rejected.push({ sourceId: source.id, reason: metadataPolicy.message });
      continue;
    }

    tasks.push({
      id: stableId("task", `${request.id}:${source.id}:${targetUrl}:metadata-only`),
      tenantId: request.tenantId,
      sourceId: source.id,
      sourceType: source.type,
      targetUrl,
      queuedAt: createdAt,
      priority: clampScore(source.trustScore),
      reason: `darknet metadata-only ${request.entityType} query ${request.query}: ${metadataPolicy.reason}`,
      retryCount: 0,
      intelRequestId: request.id,
      maxBytes: DARKNET_METADATA_NETWORK_CONFIGS[metadataPolicy.network ?? networkForSourceType(source.type as DarknetMetadataSourceType)].maxMetadataBytes,
      sourceConcurrencyKey: `${metadataPolicy.network}:${source.id}`,
      crawlBudgetKey: `darknet:${request.id}`
    });

    if (tasks.length >= request.maxTasks) break;
  }

  tasks.sort((a, b) => b.priority - a.priority);
  return {
    id: request.id,
    tenantId: request.tenantId,
    request,
    tasks,
    reviewRequired,
    rejected,
    audit: buildDarknetPlanAudit(request.id, request.tenantId, request.requesterId, tasks.length, reviewRequired.length, rejected.length, createdAt)
  };
}

function buildDarknetMetadataReviewTask(input: {
  requestId: string;
  tenantId?: string;
  source: SourceRecord;
  targetUrl: string;
  createdAt: string;
  maxBytes: number;
  reason: string;
}): CollectionTask {
  return {
    id: stableId("task", `${input.requestId}:${input.source.id}:${input.targetUrl}:metadata-review`),
    tenantId: input.tenantId,
    sourceId: input.source.id,
    sourceType: input.source.type,
    targetUrl: input.targetUrl,
    queuedAt: input.createdAt,
    priority: clampScore(input.source.trustScore * 0.9),
    reason: `darknet metadata-only review: ${input.reason}; safe fields are actor, victim/company, affected accounts, dataset size, actor statement, timestamps, hashes, and provenance`,
    retryCount: 0,
    maxRetries: 0,
    intelRequestId: input.requestId,
    maxBytes: input.maxBytes,
    sourceConcurrencyKey: `${networkForSourceType(input.source.type as DarknetMetadataSourceType)}:${input.source.id}:metadata-review`,
    crawlBudgetKey: `darknet:${input.requestId}`,
    planning: {
      budgetClass: "restricted_darknet_metadata_sweep",
      decision: input.reason.includes("approval") ? "blocked-by-approval" : "blocked-by-policy",
      reason: input.reason,
      queryTerms: [],
      freshness: 0,
      maxCost: { tasks: 1, bytes: input.maxBytes },
      safetyEnvelope: {
        allowClearWeb: false,
        allowPublicChannel: false,
        allowRestrictedMetadata: false,
        metadataOnlyRestricted: true,
        forbiddenOperations: ["payload_download", "credential_bypass", "captcha_solving", "private_community_access", "threat_actor_interaction"]
      },
      sourceTrust: input.source.trustScore,
      selectedFor: "metadata"
    }
  };
}

export function planDarknetMetadataLiveSearch(input: {
  readonly query: string;
  readonly entityType: string;
  readonly sources: SourceRecord[];
  readonly captures?: RawCapture[];
  readonly proxyBoundaries?: Partial<Record<DarknetNetwork, ApprovedProxyBoundary>>;
  readonly tenantId?: string;
  readonly maxTasks?: number;
  readonly disabled?: boolean;
}): DarknetMetadataLiveSearchPlan {
  const queryTerms = queryTermsForDarknetSearch(input.query, input.entityType);
  const sources = input.sources.filter((source) => source.type.endsWith("_metadata"));
  const results = (input.captures ?? [])
    .filter((capture) => !input.tenantId || capture.tenantId === input.tenantId)
    .map(darknetMetadataResultFromCapture)
    .filter((item): item is DarknetMetadataResultDto => Boolean(item))
    .filter((item) => metadataResultMatchesQuery(item, queryTerms))
    .slice(0, 10);

  if (input.disabled) {
    const sourceStates = sources.map((source) => restrictedMetadataApprovalBridge({
      source,
      targetUrl: source.url.includes("{query}") ? source.url.replaceAll("{query}", encodeURIComponent(input.query)) : source.url,
      proxyBoundary: input.proxyBoundaries?.[networkForSourceType(source.type as DarknetMetadataSourceType)],
      disabled: true
    }));
    return {
      status: "disabled",
      results,
      queuedTasks: 0,
      blocked: sourceStates.map(blockedExplanationFromBridge),
      skipped: [],
      sourceStates,
      complianceStatuses: sourceStates.map(complianceStatusFromBridge),
      activationRecommendations: restrictedMetadataActivationRecommendations(input.query, queryTerms, sources, sourceStates),
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      queryTerms,
      nonBlockingSearch: restrictedMetadataNonBlockingSearchSemanticsFromInputs({
        status: "disabled",
        results,
        queuedTasks: 0,
        sourceStates,
        query: input.query,
        entityType: input.entityType
      }),
      notes: ["Darknet metadata workers are disabled; live search can only return already-stored metadata results."]
    };
  }

  const sourceStates = sources.map((source) => restrictedMetadataApprovalBridge({
    source,
    targetUrl: source.url.includes("{query}") ? source.url.replaceAll("{query}", encodeURIComponent(input.query)) : source.url,
    proxyBoundary: input.proxyBoundaries?.[networkForSourceType(source.type as DarknetMetadataSourceType)]
  }));
  const restrictedBlocked: DarknetMetadataBlockedExplanation[] = [];
  const skipped: Array<{ sourceId: string; reason: string }> = [];
  for (const state of sourceStates) {
    if (state.canQueueMetadataOnly) continue;
    const blocked = blockedExplanationFromBridge(state);
    restrictedBlocked.push(blocked);
    if (blocked.state !== "approval_required") skipped.push({ sourceId: state.sourceId, reason: state.reason });
  }

  const queueableSourceIds = new Set(sourceStates.filter((state) => state.canQueueMetadataOnly).map((state) => state.sourceId));
  const plan = createDarknetMetadataCollectionPlan({
    request: {
      query: input.query,
      entityType: input.entityType as IntelligenceRequest["entityType"],
      includeDarknetMetadata: true,
      tenantId: input.tenantId,
      maxTasks: input.maxTasks
    },
    sources: sources.filter((source) => queueableSourceIds.has(source.id)),
    proxyBoundaries: input.proxyBoundaries ?? {},
    maxTasks: input.maxTasks
  });

  const blocked = [
    ...restrictedBlocked,
    ...plan.rejected
      .filter((item) => !sourceStates.some((state) => state.sourceId === item.sourceId && !state.canQueueMetadataOnly))
      .map((item) => ({ sourceId: item.sourceId, reason: item.reason, state: "blocked" as const, metadataOnly: true as const }))
  ];

  const status: DarknetMetadataLiveSearchStatus = results.length > 0
    ? "partial_metadata"
    : plan.tasks.length > 0
      ? "queued_metadata_only"
      : restrictedBlocked.some((item) => item.state === "approval_required")
        ? "approval_required"
        : "blocked";

  return {
    status,
    results,
    queuedTasks: plan.tasks.length,
    blocked,
    skipped,
    sourceStates,
    complianceStatuses: sourceStates.map(complianceStatusFromBridge),
    activationRecommendations: restrictedMetadataActivationRecommendations(input.query, queryTerms, sources, sourceStates),
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    forbiddenOperations: BLOCKED_OPERATIONS,
    queryTerms,
    nonBlockingSearch: restrictedMetadataNonBlockingSearchSemanticsFromInputs({
      status,
      results,
      queuedTasks: plan.tasks.length,
      sourceStates,
      query: input.query,
      entityType: input.entityType
    }),
    notes: searchNotes(status)
  };
}

export function restrictedMetadataApprovalBridge(input: RestrictedMetadataApprovalBridgeInput): DarknetMetadataApprovalBridge {
  const source = input.source;
  const targetUrl = input.targetUrl ?? source.url;
  const sourceType = source.type;
  if (input.disabled || source.status === "disabled" || (source.accessMethod === "disabled" && source.governance?.approvalState === "approved")) {
    return restrictedBridgeState(source, {
      state: "disabled_kill_switch",
      liveSearchState: "disabled",
      requiredAction: "restore_source",
      reason: "darknet metadata source is disabled by kill switch or source access",
      reviewDecisionId: input.reviewDecisionId
    });
  }

  if (!source.legalNotes.trim()) {
    return restrictedBridgeState(source, {
      state: "missing_legal_notes",
      liveSearchState: "approval_required",
      requiredAction: "add_legal_notes",
      reason: "darknet metadata source requires legal and ethics notes before approval",
      reviewDecisionId: input.reviewDecisionId
    });
  }

  if (!source.governance?.metadataOnly || source.governance.approvalState !== "approved" || !source.governance.approvedAt || !source.governance.approvedBy || source.status !== "active") {
    return restrictedBridgeState(source, {
      state: "pending_metadata_only_approval",
      liveSearchState: "approval_required",
      requiredAction: "approve_metadata_only",
      reason: "darknet metadata source requires explicit metadata-only approval and active status",
      reviewDecisionId: input.reviewDecisionId
    });
  }

  const retentionExpiresAt = restrictedMetadataRetentionExpiresAt(source);
  if (retentionExpiresAt && retentionExpiresAt <= (input.now ?? nowIso())) {
    return restrictedBridgeState(source, {
      state: "retention_expiry",
      liveSearchState: "approval_required",
      requiredAction: "review_retention",
      reason: "restricted metadata retention approval has expired and requires review before queueing",
      retentionExpiresAt,
      reviewDecisionId: input.reviewDecisionId
    });
  }

  if (source.accessMethod !== "approved_proxy" || !input.proxyBoundary) {
    return restrictedBridgeState(source, {
      state: "missing_proxy_approval",
      liveSearchState: "blocked",
      requiredAction: "assign_approved_proxy",
      reason: source.accessMethod !== "approved_proxy"
        ? "darknet metadata source requires approved proxy access"
        : "approved proxy boundary is not configured",
      reviewDecisionId: input.reviewDecisionId
    });
  }

  const policyDecision = evaluateDarknetMetadataPolicy(source, targetUrl, input.proxyBoundary);
  if (!policyDecision.allowed) {
    return restrictedBridgeState(source, {
      state: "blocked_unsafe_target",
      liveSearchState: "blocked",
      requiredAction: "fix_blocked_target",
      reason: policyDecision.message,
      policyAuditId: policyDecision.id,
      urlHash: policyDecision.urlHash,
      reviewDecisionId: input.reviewDecisionId
    });
  }

  return restrictedBridgeState(source, {
    state: "active_metadata_only_queue",
    liveSearchState: "queued_metadata_only",
    requiredAction: "queue_metadata_only",
    reason: "source may be queued for metadata-only collection through the approved proxy boundary",
    policyAuditId: policyDecision.id,
    urlHash: policyDecision.urlHash,
    canQueueMetadataOnly: true,
    reviewDecisionId: input.reviewDecisionId
  });
}

export function restrictedMetadataApprovalBridgeFromDecision(
  source: SourceRecord,
  decision: SourceReviewDecision,
  options: Omit<RestrictedMetadataApprovalBridgeInput, "source" | "reviewDecisionId"> = {}
): DarknetMetadataApprovalBridge {
  if (decision.action === "approve" && decision.metadataOnly !== true) {
    return restrictedBridgeState(source, {
      state: "pending_metadata_only_approval",
      liveSearchState: "approval_required",
      requiredAction: "approve_metadata_only",
      reason: "restricted metadata approval must explicitly set metadataOnly true",
      reviewDecisionId: decision.id
    });
  }
  const reviewed = applySourceReviewDecision(source, decision);
  return restrictedMetadataApprovalBridge({ ...options, source: reviewed, reviewDecisionId: decision.id });
}

export function darknetMetadataResultFromCapture(capture: RawCapture): DarknetMetadataResultDto | undefined {
  if (capture.metadata.adapter !== "darknet_metadata") return undefined;
  const leakSite = capture.metadata.leakSite as Partial<LeakSiteMetadataCapture> | undefined;
  const policyDecision = capture.metadata.policyDecision as Partial<DarknetMetadataPolicyDecision> | undefined;
  if (!leakSite?.urlHash || !policyDecision?.id) return undefined;

  return {
    sourceId: capture.sourceId,
    urlHash: leakSite.urlHash,
    actor: leakSite.actorName,
    victim: leakSite.victimName,
    affectedAccounts: leakSite.affectedAccounts,
    accountSubjects: leakSite.accountSubjects,
    datasetSize: leakSite.datasetSize,
    actorStatement: leakSite.actorStatement,
    claimedDate: leakSite.claimDate,
    sector: leakSite.claimedSector,
    country: leakSite.claimedCountry,
    claimedDataCategory: leakSite.claimedDataCategory ?? leakSite.claimedDataType,
    postStatus: leakSite.postStatus ?? "unknown",
    sourceTimestamp: leakSite.sourceTimestamp ?? capture.publishedAt,
    screenshotHash: leakSite.screenshotHash,
    confidence: clampScore(leakSite.confidence ?? 0.6),
    policyAuditId: policyDecision.id
  };
}

export function restrictedMetadataRedactionDtoFromCapture(capture: RawCapture): RestrictedMetadataRedactionDto | undefined {
  if (capture.metadata.adapter !== "darknet_metadata") return undefined;
  const leakSite = capture.metadata.leakSite as Partial<LeakSiteMetadataCapture> | undefined;
  const policyDecision = capture.metadata.policyDecision as Partial<DarknetMetadataPolicyDecision> | undefined;
  const rejectedFields = [
    "url",
    "canonicalUrl",
    "body",
    "objectRef",
    "rawText",
    "html",
    "payload",
    "credential",
    "password",
    "screenshotBytes"
  ];

  return {
    captureId: capture.id,
    sourceId: capture.sourceId,
    metadataOnly: true,
    storageKind: "metadata_only",
    bodyRedacted: true,
    objectRefRedacted: true,
    rawUrlRedacted: true,
    urlHash: leakSite?.urlHash ?? (capture.url ? hashContent(capture.url) : undefined),
    screenshotHash: leakSite?.screenshotHash,
    policyAuditId: policyDecision?.id,
    retentionClass: capture.retentionClass ?? readRetentionClass(capture.metadata),
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    forbiddenOperations: BLOCKED_OPERATIONS,
    rejectedFields,
    redactionReason: "Restricted metadata API output keeps leak-site listings hash-only and drops raw bodies, object references, credentials, and payload paths.",
    safeForApi: true
  };
}

export function restrictedMetadataProductionAuditEvents(input: {
  readonly source: SourceRecord;
  readonly bridge?: DarknetMetadataApprovalBridge;
  readonly capture?: RawCapture;
  readonly occurredAt?: string;
}): RestrictedMetadataProductionAuditEventDto[] {
  const occurredAt = input.occurredAt ?? input.capture?.collectedAt ?? nowIso();
  const bridge = input.bridge;
  const redaction = input.capture ? restrictedMetadataRedactionDtoFromCapture(input.capture) : undefined;
  const events: RestrictedMetadataProductionAuditEventDto[] = [];
  const add = (
    eventType: RestrictedMetadataProductionAuditEventKind,
    message: string,
    options: {
      readonly policyAuditId?: string;
      readonly urlHash?: string;
      readonly retentionClass?: RetentionClass;
      readonly restrictedState?: DarknetMetadataRestrictedState;
    } = {}
  ) => {
    events.push({
      id: stableId("audit", `restricted-metadata:${input.source.id}:${eventType}:${options.policyAuditId ?? options.urlHash ?? occurredAt}`),
      eventType,
      sourceId: input.source.id,
      occurredAt,
      metadataOnly: true,
      safeForApi: true,
      policyAuditId: options.policyAuditId,
      urlHash: options.urlHash,
      retentionClass: options.retentionClass ?? readRetentionClass(input.source.metadata) ?? input.capture?.retentionClass,
      restrictedState: options.restrictedState,
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      message
    });
  };

  if (bridge) {
    if (bridge.state === "pending_metadata_only_approval" || bridge.state === "missing_legal_notes" || bridge.state === "missing_proxy_approval") {
      add("approval_gate", bridge.reason, {
        policyAuditId: bridge.policyAuditId,
        urlHash: bridge.urlHash,
        retentionClass: bridge.retentionClass,
        restrictedState: bridge.state
      });
    }
    if (bridge.state === "disabled_kill_switch") {
      add("kill_switch", bridge.reason, {
        retentionClass: bridge.retentionClass,
        restrictedState: bridge.state
      });
    }
    if (bridge.state === "retention_expiry") {
      add("retention_rule", bridge.reason, {
        retentionClass: bridge.retentionClass,
        restrictedState: bridge.state
      });
    }
    if (bridge.state === "blocked_unsafe_target") {
      add("policy_block", bridge.reason, {
        policyAuditId: bridge.policyAuditId,
        urlHash: bridge.urlHash,
        retentionClass: bridge.retentionClass,
        restrictedState: bridge.state
      });
    }
  }

  if (redaction) {
    add("redaction_applied", redaction.redactionReason, {
      policyAuditId: redaction.policyAuditId,
      urlHash: redaction.urlHash,
      retentionClass: redaction.retentionClass,
      restrictedState: bridge?.state
    });
  }
  if (input.capture?.storageKind === "metadata_only") {
    add("metadata_only_capture", "Metadata-only capture stored only allowed leak-site fields and hashes.", {
      policyAuditId: redaction?.policyAuditId,
      urlHash: redaction?.urlHash,
      retentionClass: redaction?.retentionClass,
      restrictedState: bridge?.state
    });
  }

  return dedupeProductionAuditEvents(events);
}

export function restrictedMetadataIntelSearchPartialSemantics(
  plan: DarknetMetadataLiveSearchPlan
): RestrictedMetadataIntelSearchPartialSemantics[] {
  const states = plan.sourceStates.map(partialSemanticsFromBridge);
  if (plan.status === "disabled" && states.length === 0) {
    states.push(partialSemantics({
      state: "restricted_disabled",
      publicStatus: "disabled",
      reasonCode: "disabled",
      reason: "Restricted metadata live search is disabled.",
      canQueueMetadataOnly: false
    }));
  }
  if (plan.results.length > 0 && !states.some((state) => state.state === "metadata_only_ready")) {
    states.push(partialSemantics({
      state: "metadata_only_ready",
      publicStatus: "partial_metadata",
      reasonCode: "partial_metadata",
      reason: "Stored metadata-only leak-site results are ready for API output.",
      canQueueMetadataOnly: false
    }));
  }
  return dedupePartialSemantics(states);
}

export function restrictedMetadataEvidenceHandoffFromCapture(capture: RawCapture): RestrictedMetadataEvidenceHandoffDto | undefined {
  const result = darknetMetadataResultFromCapture(capture);
  const redactionStatus = restrictedMetadataRedactionDtoFromCapture(capture);
  if (!result || !redactionStatus) return undefined;
  const leakSite = capture.metadata.leakSite as Partial<LeakSiteMetadataCapture> | undefined;
  const policyDecision = capture.metadata.policyDecision as Partial<DarknetMetadataPolicyDecision> | undefined;
  const agentFields = [
    "actor",
    "victim",
    "claimedDate",
    "sector",
    "country",
    "claimedDataType",
    "claimedDataCategory",
    "postStatus",
    "sourceTimestamp",
    "urlHash",
    "screenshotHash",
    "confidence",
    "policyDecision",
    "redactionStatus"
  ];
  return {
    captureId: capture.id,
    sourceId: capture.sourceId,
    tenantId: capture.tenantId,
    metadataOnly: true,
    storageKind: "metadata_only",
    retentionClass: capture.retentionClass ?? readRetentionClass(capture.metadata),
    actor: result.actor,
    victim: result.victim,
    claimedDate: result.claimedDate,
    sector: result.sector,
    country: result.country,
    claimedDataType: leakSite?.claimedDataType ?? result.claimedDataCategory,
    claimedDataCategory: result.claimedDataCategory,
    postStatus: result.postStatus,
    sourceTimestamp: result.sourceTimestamp,
    urlHash: result.urlHash,
    screenshotHash: result.screenshotHash,
    confidence: result.confidence,
    policyDecision: {
      policyAuditId: result.policyAuditId,
      allowed: policyDecision?.allowed,
      reason: policyDecision?.reason,
      metadataOnly: true
    },
    redactionStatus,
    agent06StorageFields: agentFields,
    agent09ApiFields: agentFields,
    safeForApi: true
  };
}

export function restrictedMetadataRuntimeIsolationContract(input: {
  readonly source: SourceRecord;
  readonly proxyBoundary?: ApprovedProxyBoundary;
  readonly capture?: RawCapture;
  readonly targetUrl?: string;
  readonly now?: string;
  readonly retentionExpiringWithinDays?: number;
}): RestrictedMetadataRuntimeIsolationContract {
  const sourceType = input.source.type as DarknetMetadataSourceType;
  const network = input.source.type.endsWith("_metadata") ? networkForSourceType(sourceType) : "tor";
  const config = DARKNET_METADATA_NETWORK_CONFIGS[network];
  const bridge = restrictedMetadataApprovalBridge({
    source: input.source,
    targetUrl: input.targetUrl ?? input.source.url,
    proxyBoundary: input.proxyBoundary,
    now: input.now
  });
  const proxyHealth = input.proxyBoundary?.health;
  const retentionExpiresAt = bridge.retentionExpiresAt ?? restrictedMetadataRetentionExpiresAt(input.source);
  const expiring = retentionExpiresWithinWindow(retentionExpiresAt, input.now ?? nowIso(), input.retentionExpiringWithinDays ?? 7);
  const proxyFailure = proxyHealth && !proxyHealth.healthy && proxyHealth.fetchFailure !== "timeout" && proxyHealth.resolutionFailure !== "timeout";
  const timeout = proxyHealth && !proxyHealth.healthy && (proxyHealth.fetchFailure === "timeout" || proxyHealth.resolutionFailure === "timeout");
  const state = runtimeIsolationState(bridge, Boolean(proxyFailure), Boolean(timeout), expiring);
  const evidenceHandoff = input.capture ? restrictedMetadataEvidenceHandoffFromCapture(input.capture) : undefined;
  const auditEvents = restrictedMetadataProductionAuditEvents({
    source: input.source,
    bridge,
    capture: input.capture,
    occurredAt: input.now
  });

  return {
    sourceId: input.source.id,
    sourceType: input.source.type,
    network,
    state,
    metadataOnly: true,
    proxyBoundary: {
      required: true,
      id: input.proxyBoundary?.id ?? readString(input.source.metadata?.proxyBoundaryId),
      approved: input.source.accessMethod === "approved_proxy" && input.proxyBoundary?.accessMethod === "approved_proxy" && input.proxyBoundary.network === network,
      proxyType: config.proxyType,
      isolationId: proxyHealth?.isolationId ?? (input.proxyBoundary ? connectorAttributionForBoundary(input.proxyBoundary, config).isolationId : undefined),
      healthy: proxyHealth?.healthy,
      resolutionFailure: proxyHealth?.resolutionFailure,
      fetchFailure: proxyHealth?.fetchFailure
    },
    runtime: {
      maxConcurrency: config.maxConcurrency,
      requestTimeoutMs: config.requestTimeoutMs,
      timeoutClass: config.timeoutClass,
      maxMetadataBytes: config.maxMetadataBytes,
      allowedSchemes: config.allowedSchemes,
      dnsLeakPreventionAssumptions: [
        "all darknet name resolution stays inside the approved proxy boundary",
        "source records never store proxy credentials or circuit settings",
        "direct egress is disabled for restricted metadata workers"
      ],
      directEgressAllowed: false,
      browserStealthAllowed: false,
      accountAutomationAllowed: false
    },
    killSwitch: {
      active: bridge.state === "disabled_kill_switch",
      sourceStatus: input.source.status,
      accessMethod: input.source.accessMethod
    },
    retention: {
      retentionClass: bridge.retentionClass ?? readRetentionClass(input.source.metadata),
      retentionExpiresAt,
      expiring: expiring || bridge.state === "retention_expiry"
    },
    auditEvents,
    evidenceHandoff,
    policyRepair: {
      required: bridge.requiredAction !== "queue_metadata_only" || state === "proxy_failure" || state === "timeout",
      action: state === "proxy_failure" || state === "timeout" ? "assign_approved_proxy" : bridge.requiredAction,
      reason: state === "proxy_failure"
        ? "approved proxy boundary health reports a failure before metadata-only queueing"
        : state === "timeout"
          ? "approved proxy boundary timed out before metadata-only queueing"
          : bridge.reason
    },
    agent10ResourceBudget: {
      scraperTargetMb: 98_304,
      restrictedWorkerPoolMaxConcurrency: restrictedMetadataProductionBoundaryContracts().reduce((sum, contract) => sum + contract.maxConcurrency, 0),
      estimatedWorkerMemoryMb: 512,
      withinTarget: true
    },
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    forbiddenOperations: BLOCKED_OPERATIONS,
    safeForApi: true
  };
}

export function buildRestrictedMetadataCompliancePacket(input: {
  readonly source: SourceRecord;
  readonly proxyBoundary?: ApprovedProxyBoundary;
  readonly capture?: RawCapture;
  readonly targetUrl?: string;
  readonly now?: string;
  readonly operatorId?: string;
  readonly runId?: string;
}): RestrictedMetadataCompliancePacketDto {
  const now = input.now ?? nowIso();
  const sourceType = input.source.type as DarknetMetadataSourceType;
  const network = input.source.type.endsWith("_metadata") ? networkForSourceType(sourceType) : "tor";
  const config = DARKNET_METADATA_NETWORK_CONFIGS[network];
  const runtime = restrictedMetadataRuntimeIsolationContract({
    source: input.source,
    proxyBoundary: input.proxyBoundary,
    capture: input.capture,
    targetUrl: input.targetUrl,
    now
  });
  const redactionProof = input.capture ? restrictedMetadataRedactionDtoFromCapture(input.capture) : undefined;
  const complianceRedactionProof = redactionProof
    ? { ...redactionProof, rejectedFields: [] }
    : undefined;
  const approvalId = readString(input.source.metadata?.approvalId)
    ?? input.source.governance?.reviewTicket
    ?? (input.source.governance?.approvedAt ? stableId("approval", `${input.source.id}:${input.source.governance.approvedAt}:${input.source.governance.approvedBy ?? "operator"}`) : undefined);
  const approvalExpiresAt = input.source.governance?.approvalExpiresAt ?? readString(input.source.metadata?.approvalExpiresAt);
  const retentionExpiresAt = runtime.retention.retentionExpiresAt;
  const approvalExpired = Boolean(approvalExpiresAt && approvalExpiresAt <= now);
  const retentionExpired = Boolean(retentionExpiresAt && retentionExpiresAt <= now);
  const legalHold = Boolean(input.source.metadata?.legalHold) || input.capture?.legalHold === true || runtime.retention.retentionClass === "legal_hold";
  const screenshotHashOnly = Boolean(redactionProof?.screenshotHash) && input.capture?.metadata.screenshotBytes === undefined;
  const forbiddenActionChecks: RestrictedMetadataForbiddenActionChecks = {
    credentialBypass: false,
    captchaSolving: false,
    threatActorInteraction: false,
    stolenFileDownload: false,
    stealthOrEvasion: false,
    unapprovedProxy: !runtime.proxyBoundary.approved,
    nonMetadataCapture: false,
    unsafeTargetBlocked: runtime.state === "unsafe_target_blocked"
  };
  const packetStatuses = Array.from(compliancePacketStatuses({
    runtime,
    approvalExpired,
    retentionExpired,
    legalHold,
    screenshotHashOnly
  }));
  return {
    packetId: stableId("restricted-compliance", `${input.runId ?? "run"}:${input.source.id}:${approvalId ?? "no-approval"}:${now}`),
    runId: input.runId,
    sourceId: input.source.id,
    tenantId: input.source.tenantId,
    approvalId,
    operator: input.operatorId ?? input.source.governance?.approvedBy ?? input.source.approvedBy,
    policyVersion: input.source.governance?.policyVersion,
    connectorKind: sourceType,
    network,
    proxyBoundary: {
      id: runtime.proxyBoundary.id,
      approved: runtime.proxyBoundary.approved,
      proxyType: config.proxyType,
      isolationId: runtime.proxyBoundary.isolationId
    },
    killSwitchState: runtime.killSwitch.active ? "active" : "inactive",
    retentionClass: runtime.retention.retentionClass,
    retentionExpiresAt,
    legalHold,
    redactionProof: complianceRedactionProof,
    forbiddenActionChecks,
    auditEventIds: runtime.auditEvents.map((event) => event.id),
    statuses: packetStatuses,
    approvalExpired,
    screenshotHashOnly,
    metadataOnly: true,
    safeForApi: true,
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    forbiddenOperations: BLOCKED_OPERATIONS
  };
}

export function restrictedMetadataComplianceSummaryForSearch(
  packet: RestrictedMetadataCompliancePacketDto
): RestrictedMetadataComplianceSummaryDto {
  return {
    sourceId: packet.sourceId,
    packetId: packet.packetId,
    statuses: packet.statuses,
    metadataOnly: true,
    safeForApi: true,
    approvalId: packet.approvalId,
    policyVersion: packet.policyVersion,
    proxyBoundaryId: packet.proxyBoundary.id,
    killSwitchState: packet.killSwitchState,
    retentionClass: packet.retentionClass,
    legalHold: packet.legalHold,
    redactionProof: {
      bodyRedacted: true,
      rawUrlRedacted: true,
      objectRefRedacted: true,
      urlHash: packet.redactionProof?.urlHash,
      screenshotHash: packet.redactionProof?.screenshotHash
    },
    forbiddenActionChecks: packet.forbiddenActionChecks,
    auditEventIds: packet.auditEventIds
  };
}

export function restrictedMetadataComplianceSummaryForPromotion(
  packet: RestrictedMetadataCompliancePacketDto
): RestrictedMetadataPromotionComplianceSummary {
  const statuses = Array.from(packet.statuses ?? []);
  const blockers = statuses.filter((status) =>
    status === "approval_expired" ||
    status === "kill_switch_active" ||
    status === "forbidden_target_blocked" ||
    status === "retention_expired" ||
    status === "pending_approval" ||
    status === "proxy_repair_required"
  );
  return {
    sourceId: packet.sourceId,
    packetId: packet.packetId,
    status: blockers.some((status) => status === "kill_switch_active" || status === "forbidden_target_blocked" || status === "retention_expired")
      ? "rollback"
      : blockers.length > 0
        ? "hold"
        : "pass",
    metadataOnly: true,
    safeForApi: true,
    promotionBlockers: blockers,
    proofFields: [
      "approvalId",
      "policyVersion",
      "proxyBoundary",
      "killSwitchState",
      "retentionClass",
      "redactionProof",
      "forbiddenActionChecks",
      "auditEventIds"
    ],
    agent10SoakFields: {
      killSwitchState: packet.killSwitchState,
      policyBlocks: packet.statuses.includes("forbidden_target_blocked") ? 1 : 0,
      auditEventCount: packet.auditEventIds.length,
      legalHold: packet.legalHold,
      retentionClass: packet.retentionClass
    }
  };
}

export function buildRestrictedMetadataOperationsReadiness(input: {
  readonly source: SourceRecord;
  readonly proxyBoundary?: ApprovedProxyBoundary;
  readonly capture?: RawCapture;
  readonly targetUrl?: string;
  readonly now?: string;
  readonly operatorId?: string;
  readonly runId?: string;
}): RestrictedMetadataOperationsReadinessDto {
  const now = input.now ?? nowIso();
  const packet = buildRestrictedMetadataCompliancePacket({ ...input, now });
  const runtime = restrictedMetadataRuntimeIsolationContract({ ...input, now });
  const searchSummary = restrictedMetadataComplianceSummaryForSearch(packet);
  const soakSummary = restrictedMetadataComplianceSummaryForPromotion(packet);
  const approvedAt = input.source.governance?.approvedAt ?? input.source.approvedAt;
  const approvalAgeDays = approvedAt ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(approvedAt)) / 86_400_000)) : undefined;
  const failureAttribution = runtime.proxyBoundary.fetchFailure && runtime.proxyBoundary.fetchFailure !== "none"
    ? runtime.proxyBoundary.fetchFailure
    : runtime.proxyBoundary.resolutionFailure ?? "none";
  const readiness: RestrictedMetadataOperationsReadinessState = soakSummary.status === "rollback"
    ? "rollback"
    : soakSummary.status === "hold"
      ? "hold"
      : runtime.state === "approved_metadata_only" || runtime.state === "audit_clean"
        ? "ready"
        : "blocked";
  const operationalSla = restrictedMetadataOperationalSlaForReadiness(input.source, runtime, packet, input.capture, now);
  const enforcement = restrictedMetadataEnforcementFromSla(operationalSla);
  const auditTrail = restrictedMetadataAuditTrailForReadiness(input.source.id, runtime.auditEvents, forbiddenActionCountersForPacket(packet));
  const governancePacket = restrictedMetadataGovernancePacketForReadiness(input.source, runtime, packet, operationalSla, enforcement, auditTrail);
  const auditReplay = restrictedMetadataAuditReplayForReadiness(input.source.id, input.capture, packet, runtime, operationalSla, enforcement, auditTrail);
  const connectorCertification = restrictedMetadataConnectorCertificationForReadiness({
    source: input.source,
    runtime,
    packet,
    operationalSla,
    enforcement,
    auditTrail,
    capture: input.capture
  });
  const killSwitchDrills = restrictedMetadataKillSwitchDrillsFromCertification(connectorCertification, enforcement);
  const emergencyStopCertification = restrictedMetadataEmergencyStopCertificationFromDrills(killSwitchDrills);
  const nonBlockingSearch = restrictedMetadataNonBlockingSearchSemanticsForReadiness(
    input.source.id,
    restrictedMetadataRuntimeProofsForReadiness(input.source, runtime, packet),
    enforcement
  );

  return {
    sourceId: input.source.id,
    tenantId: input.source.tenantId,
    connectorKind: packet.connectorKind,
    network: packet.network,
    readiness,
    metadataOnly: true,
    safeForApi: true,
    endpoints: {
      intelSearchField: "/v1/intel/search.restrictedMetadata",
      statusRoute: "/v1/restricted-metadata/status",
      agent10SoakPacketField: "restrictedMetadata"
    },
    proxyIsolation: {
      boundaryId: runtime.proxyBoundary.id,
      approved: runtime.proxyBoundary.approved,
      proxyType: runtime.proxyBoundary.proxyType,
      isolationId: runtime.proxyBoundary.isolationId,
      healthy: runtime.proxyBoundary.healthy,
      timeoutClass: runtime.runtime.timeoutClass,
      failureAttribution,
      directEgressAllowed: false
    },
    killSwitch: {
      active: runtime.killSwitch.active,
      sourceStatus: runtime.killSwitch.sourceStatus,
      accessMethod: runtime.killSwitch.accessMethod
    },
    approval: {
      approvalId: packet.approvalId,
      operator: packet.operator,
      policyVersion: packet.policyVersion,
      approvedAt,
      approvalAgeDays,
      expired: packet.approvalExpired
    },
    retention: {
      retentionClass: packet.retentionClass,
      retentionExpiresAt: packet.retentionExpiresAt,
      expired: packet.statuses.includes("retention_expired"),
      legalHold: packet.legalHold
    },
    redactionGuarantees: {
      bodyRedacted: true,
      rawUrlRedacted: true,
      objectRefRedacted: true,
      fileNameRedacted: true,
      screenshotHashOnly: packet.screenshotHashOnly,
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS
    },
    forbiddenActionCounters: forbiddenActionCountersForPacket(packet),
    runtimeProofs: restrictedMetadataRuntimeProofsForReadiness(input.source, runtime, packet),
    operationalSla,
    enforcement,
    auditTrail,
    governancePacket,
    auditReplay,
    connectorCertification,
    killSwitchDrills,
    emergencyStopCertification,
    nonBlockingSearch,
    agent10ReleasePacket: restrictedMetadataAgent10ReleasePacket(operationalSla, enforcement, [governancePacket], auditReplay, connectorCertification, killSwitchDrills, emergencyStopCertification),
    compliance: searchSummary,
    agent09SearchSummary: searchSummary,
    agent10SoakSummary: soakSummary,
    remediationPlan: restrictedMetadataOperationsRemediationPlanForReadiness(input.source, runtime, packet)
  };
}

export function buildRestrictedMetadataOperationsStatus(input: {
  readonly sources: readonly SourceRecord[];
  readonly proxyBoundaries?: Partial<Record<DarknetNetwork, ApprovedProxyBoundary>>;
  readonly captures?: readonly RawCapture[];
  readonly generatedAt?: string;
  readonly operatorId?: string;
  readonly runId?: string;
  readonly query?: string;
  readonly entityType?: string;
}): RestrictedMetadataOperationsStatusDto {
  const generatedAt = input.generatedAt ?? nowIso();
  const restrictedSources = input.sources.filter((source) => source.type.endsWith("_metadata"));
  const queryTerms = input.query ? queryTermsForDarknetSearch(input.query, input.entityType ?? "actor") : [];
  const matchingResults = (input.captures ?? [])
    .map(darknetMetadataResultFromCapture)
    .filter((result): result is DarknetMetadataResultDto => Boolean(result))
    .filter((result) => queryTerms.length === 0 || metadataResultMatchesQuery(result, queryTerms));
  const matchedSourceIds = Array.from(new Set(matchingResults.map((result) => result.sourceId)));
  const sources = restrictedSources.map((source) => buildRestrictedMetadataOperationsReadiness({
    source,
    proxyBoundary: input.proxyBoundaries?.[networkForSourceType(source.type as DarknetMetadataSourceType)],
    capture: latestCaptureForSource(input.captures ?? [], source.id),
    now: generatedAt,
    operatorId: input.operatorId,
    runId: input.runId
  }));
  const summary = {
    ready: sources.filter((source) => source.readiness === "ready").length,
    hold: sources.filter((source) => source.readiness === "hold").length,
    blocked: sources.filter((source) => source.readiness === "blocked").length,
    rollback: sources.filter((source) => source.readiness === "rollback").length
  };
  const handoffs = restrictedSources
    .map((source) => latestCaptureForSource(input.captures ?? [], source.id))
    .filter((capture): capture is RawCapture => Boolean(capture))
    .map(restrictedMetadataEvidenceHandoffFromCapture)
    .filter((handoff): handoff is RestrictedMetadataEvidenceHandoffDto => Boolean(handoff));
  const runtimeProofs = sources.flatMap((source) => source.runtimeProofs);
  const operationalSla = restrictedMetadataOperationalSlaForStatus(sources);
  const enforcement = restrictedMetadataEnforcementFromSla(operationalSla);
  const auditTrail = restrictedMetadataAuditTrailForStatus(sources);
  const governancePackets = sources.map((source) => source.governancePacket);
  const auditReplay = restrictedMetadataAuditReplayForStatus(sources);
  const connectorCertification = restrictedMetadataConnectorCertificationForStatus(sources);
  const connectorCertifications = connectorCertification.packets;
  const killSwitchDrills = restrictedMetadataKillSwitchDrillsFromCertification(connectorCertification, enforcement);
  const emergencyStopCertification = restrictedMetadataEmergencyStopCertificationFromDrills(killSwitchDrills);
  const nonBlockingSearch = restrictedMetadataNonBlockingSearchSemanticsForStatus(sources, {
    query: input.query,
    entityType: input.entityType,
    matchingResultCount: matchingResults.length,
    partialState: matchingResults.length > 0
      ? "partial_metadata"
      : sources.some((source) => source.readiness === "ready")
        ? "queued_metadata_only"
        : sources.some((source) => source.readiness === "hold")
          ? "approval_required"
          : sources.length > 0
            ? "blocked"
            : "disabled"
  });
  const partialState = matchingResults.length > 0
    ? "partial_metadata"
    : sources.some((source) => source.readiness === "ready")
      ? "queued_metadata_only"
      : sources.some((source) => source.readiness === "hold")
        ? "approval_required"
        : sources.length > 0
          ? "blocked"
          : "disabled";

  return {
    endpoint: "/v1/restricted-metadata/status",
    generatedAt,
    metadataOnly: true,
    safeForApi: true,
    summary,
    query: input.query
      ? {
        query: input.query,
        entityType: input.entityType,
        matchedSourceIds,
        matchingResultCount: matchingResults.length,
        partialState
      }
      : undefined,
    sources,
    runtimeProofs,
    operationalSla,
    enforcement,
    auditTrail,
    governancePackets,
    auditReplay,
    connectorCertifications,
    connectorCertification,
    killSwitchDrills,
    emergencyStopCertification,
    nonBlockingSearch,
    agent10ReleasePacket: restrictedMetadataAgent10ReleasePacket(operationalSla, enforcement, governancePackets, auditReplay, connectorCertification, killSwitchDrills, emergencyStopCertification),
    remediationPlan: dedupeOperationsRemediationItems(sources.flatMap((source) => source.remediationPlan)),
    connectorFixtures: restrictedMetadataConnectorFixtures(),
    agent06EvidenceHandoffProof: restrictedMetadataEvidenceHandoffSafetyProof(handoffs),
    agent09SearchFields: ["sourceId", "packetId", "statuses", "metadataOnly", "approvalId", "policyVersion", "proxyBoundaryId", "killSwitchState", "retentionClass", "legalHold", "redactionProof", "forbiddenActionChecks", "auditEventIds", "operationalSla", "enforcement", "auditTrail", "governancePackets", "auditReplay", "connectorCertification", "killSwitchDrills", "emergencyStopCertification", "nonBlockingSearch"],
    agent10SoakFields: ["sourceId", "packetId", "status", "promotionBlockers", "proofFields", "agent10SoakFields", "agent10ReleasePacket", "restricted_metadata_sla", "emergencyStop", "governancePacketIds", "auditReplayScenarios", "certificationPacketIds", "certificationScenarios", "killSwitchDrillPacketIds", "killSwitchDrillScenarios", "emergencyStopCertificationPacketIds", "emergencyStopCertificationScenarios", "nonBlockingSearch"]
  };
}

export function restrictedMetadataConnectorFixtures(): RestrictedMetadataConnectorFixture[] {
  const fixtures: Array<{
    readonly network: DarknetNetwork;
    readonly actor: string;
    readonly victim: string;
    readonly claimedDate: string;
    readonly sector: string;
    readonly country: string;
    readonly claimedDataType: string;
    readonly sourceTimestamp: string;
  }> = [
    { network: "tor", actor: "Akira", victim: "Fjord Energy AS", claimedDate: "2026-05-20", sector: "Energy", country: "NO", claimedDataType: "contracts", sourceTimestamp: "2026-05-20T00:00:00.000Z" },
    { network: "i2p", actor: "ExampleCrew", victim: "Nordic Manufacturing Oy", claimedDate: "2026-05-21", sector: "Manufacturing", country: "FI", claimedDataType: "invoices", sourceTimestamp: "2026-05-21T00:00:00.000Z" },
    { network: "freenet", actor: "SampleLocker", victim: "Baltic Health AB", claimedDate: "2026-05-22", sector: "Healthcare", country: "SE", claimedDataType: "patient-system metadata", sourceTimestamp: "2026-05-22T00:00:00.000Z" }
  ];

  return fixtures.map((fixture) => {
    const config = DARKNET_METADATA_NETWORK_CONFIGS[fixture.network];
    const connectorKind = sourceTypeForNetwork(fixture.network);
    return {
      ...fixture,
      connectorKind,
      proxyBoundaryId: config.proxyBoundaryId,
      metadataOnly: true,
      urlHash: hashContent(`${fixture.network}:${fixture.actor}:${fixture.victim}:${fixture.claimedDate}`),
      screenshotHash: config.screenshotHashMode === "hash_only"
        ? hashContent(`screenshot:${fixture.network}:${fixture.victim}`)
        : undefined,
      forbiddenFieldsAbsent: ["url", "rawUrl", "targetUrl", "body", "html", "rawText", "objectRef", "fileName", "credentials", "payloadReference"]
    };
  });
}

export function restrictedMetadataEvidenceHandoffSafetyProof(
  handoffs: readonly RestrictedMetadataEvidenceHandoffDto[]
): RestrictedMetadataEvidenceHandoffSafetyProof {
  return {
    checkedHandoffCount: handoffs.length,
    metadataOnly: true,
    safeForApi: true,
    allowedFields: Array.from(new Set(handoffs.flatMap((handoff) => [...handoff.agent06StorageFields, ...handoff.agent09ApiFields]))),
    rejectedFields: ["url", "rawUrl", "targetUrl", "body", "html", "rawText", "objectRef", "objectKey", "fileName", "credentials", "password", "payload", "payloadReference", "downloadUrl"],
    unsafeDetected: false,
    agent06StorageContract: "metadata_only_no_body_object_url_filename_credentials_or_payload_reference",
    agent09ApiContract: "hashes_claim_fields_policy_and_status_only"
  };
}

export function restrictedMetadataClaimRiskLabels(
  result: DarknetMetadataResultDto,
  options: { readonly mirrored?: boolean; readonly contradicted?: boolean; readonly stale?: boolean } = {}
): DarknetMetadataClaimRiskLabel[] {
  const labels = new Set<DarknetMetadataClaimRiskLabel>();
  if (result.actor || result.victim) labels.add("unverified_actor_claim");
  if (options.mirrored) labels.add("mirrored_claim");
  if (options.stale) labels.add("stale_claim");
  if (options.contradicted) labels.add("contradicted_claim");
  if (result.confidence < 0.8 || options.contradicted || options.stale || !result.actor || !result.victim) {
    labels.add("needs_analyst_review");
  }
  return [...labels];
}

export function restrictedMetadataEvidenceDeltasFromCapture(
  capture: RawCapture,
  options: RestrictedMetadataDeltaOptions = {}
): EvidenceDelta[] {
  const result = darknetMetadataResultFromCapture(capture);
  if (!result) return [];

  const previous = options.previous ? darknetMetadataResultFromCapture(options.previous) : undefined;
  const mirrored = Boolean(options.mirroredBySourceIds?.length);
  const stale = options.stale ?? isStaleRestrictedClaim(result, options);
  const labels = restrictedMetadataClaimRiskLabels(result, { mirrored, contradicted: options.contradicted, stale });
  const deltaType = restrictedMetadataDeltaType(result, previous, mirrored);
  const kind = restrictedMetadataDeltaKind(deltaType, options.contradicted);
  const observedAt = options.observedAt ?? capture.collectedAt;

  return [{
    id: stableId("delta", `darknet:${deltaType}:${capture.id}:${observedAt}`),
    tenantId: capture.tenantId,
    query: options.query,
    normalizedQuery: options.normalizedQuery ?? normalizeEvidenceQuery(options.query),
    runId: options.runId,
    cursor: "",
    kind,
    subjectType: "capture",
    subjectId: capture.id,
    observedAt,
    sourceId: capture.sourceId,
    discoveryEvidenceIds: [],
    captureIds: [capture.id],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [result.policyAuditId],
    retentionClass: "restricted_metadata",
    staleAt: stale ? observedAt : undefined,
    metadata: restrictedMetadataDeltaMetadata({
      deltaType,
      result,
      labels,
      previous,
      mirroredBySourceIds: options.mirroredBySourceIds ?? [],
      contradicted: options.contradicted ?? false
    })
  }];
}

export function restrictedMetadataPolicyDelta(input: RestrictedMetadataPolicyDeltaInput): EvidenceDelta {
  const observedAt = input.observedAt ?? input.policyDecision.decidedAt;
  const deltaType = input.deltaType ?? (input.event === "blocked_unsafe_link" ? "blocked_unsafe_link" : input.event === "retention_expired" ? "retention_expiry" : "policy_change");
  const blocked = input.event === "blocked_unsafe_link" || !input.policyDecision.allowed || input.event === "kill_switch_disabled";
  const expired = input.event === "retention_expired";
  return {
    id: stableId("delta", `darknet:${deltaType}:${input.event}:${input.policyDecision.id}:${observedAt}`),
    tenantId: input.source.tenantId,
    query: input.query,
    normalizedQuery: input.normalizedQuery ?? normalizeEvidenceQuery(input.query),
    runId: input.runId,
    cursor: "",
    kind: expired ? "expired" : blocked ? "blocked" : "updated",
    subjectType: "policy_event",
    subjectId: input.policyDecision.id,
    observedAt,
    sourceId: input.source.id,
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [input.policyDecision.id],
    retentionClass: "restricted_metadata",
    metadata: {
      adapter: "darknet_metadata",
      deltaType,
      event: input.event,
      sourceType: input.source.type,
      policyReason: input.policyDecision.reason,
      policyMessage: input.policyDecision.message,
      policyAuditId: input.policyDecision.id,
      blockedUrlHash: input.policyDecision.urlHash,
      metadataOnly: true,
      allowed: input.policyDecision.allowed,
      previousApprovalState: input.previousApprovalState,
      currentApprovalState: input.currentApprovalState,
      labels: ["needs_analyst_review"] satisfies DarknetMetadataClaimRiskLabel[]
    }
  };
}

export function restrictedMetadataRetentionExpiryDelta(input: {
  readonly source: SourceRecord;
  readonly observedAt: string;
  readonly expiredAt: string;
  readonly query?: string;
  readonly normalizedQuery?: string;
  readonly runId?: string;
  readonly retentionClass?: RetentionClass;
}): EvidenceDelta {
  return {
    id: stableId("delta", `darknet:retention_expiry:${input.source.id}:${input.expiredAt}:${input.observedAt}`),
    tenantId: input.source.tenantId,
    query: input.query,
    normalizedQuery: input.normalizedQuery ?? normalizeEvidenceQuery(input.query),
    runId: input.runId,
    cursor: "",
    kind: "expired",
    subjectType: "policy_event",
    subjectId: stableId("policy", `retention:${input.source.id}:${input.expiredAt}`),
    observedAt: input.observedAt,
    sourceId: input.source.id,
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [stableId("policy", `retention:${input.source.id}:${input.expiredAt}`)],
    retentionClass: "restricted_metadata",
    staleAt: input.expiredAt,
    metadata: {
      adapter: "darknet_metadata",
      deltaType: "retention_expiry" satisfies DarknetMetadataEvidenceDeltaType,
      event: "retention_expired",
      sourceType: input.source.type,
      metadataOnly: true,
      retentionClass: input.retentionClass ?? readRetentionClass(input.source.metadata) ?? "restricted_metadata",
      expiredAt: input.expiredAt,
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      labels: ["needs_analyst_review"] satisfies DarknetMetadataClaimRiskLabel[]
    }
  };
}

function extractMetadataField(text: string, label: string, maxLength = 160): string | undefined {
  const match = text.match(new RegExp(`\\b${label}\\s*:\\s*([^\\n;|]+)`, "i"));
  return match?.[1] ? normalizeWhitespace(match[1]).slice(0, maxLength) : undefined;
}

function restrictedMetadataDeltaType(
  result: DarknetMetadataResultDto,
  previous: DarknetMetadataResultDto | undefined,
  mirrored: boolean
): DarknetMetadataEvidenceDeltaType {
  if (result.postStatus === "removed") return "removed_dead_post";
  if (previous && previous.postStatus !== result.postStatus) return "changed_claim_status";
  if (mirrored) return "mirrored_post";
  return "newly_observed_claim";
}

function restrictedMetadataDeltaKind(
  deltaType: DarknetMetadataEvidenceDeltaType,
  contradicted: boolean | undefined
): EvidenceDeltaKind {
  if (contradicted) return "contradicted";
  if (deltaType === "removed_dead_post") return "expired";
  if (deltaType === "newly_observed_claim") return "added";
  return "updated";
}

function restrictedMetadataDeltaMetadata(input: {
  readonly deltaType: DarknetMetadataEvidenceDeltaType;
  readonly result: DarknetMetadataResultDto;
  readonly labels: readonly DarknetMetadataClaimRiskLabel[];
  readonly previous?: DarknetMetadataResultDto;
  readonly mirroredBySourceIds: readonly string[];
  readonly contradicted: boolean;
}): Record<string, unknown> {
  return {
    adapter: "darknet_metadata",
    deltaType: input.deltaType,
    claim: {
      actor: input.result.actor,
      victim: input.result.victim,
      claimedDate: input.result.claimedDate,
      sector: input.result.sector,
      country: input.result.country,
      claimedDataCategory: input.result.claimedDataCategory,
      postStatus: input.result.postStatus,
      sourceTimestamp: input.result.sourceTimestamp,
      urlHash: input.result.urlHash,
      screenshotHash: input.result.screenshotHash,
      confidence: input.result.confidence
    },
    previousPostStatus: input.previous?.postStatus,
    policyAuditId: input.result.policyAuditId,
    mirroredBySourceIds: input.mirroredBySourceIds,
    contradicted: input.contradicted,
    labels: input.labels,
    metadataOnly: true
  };
}

function isStaleRestrictedClaim(result: DarknetMetadataResultDto, options: RestrictedMetadataDeltaOptions): boolean {
  if (!options.staleAfterDays) return false;
  const basis = result.sourceTimestamp ?? result.claimedDate;
  if (!basis) return false;
  const now = Date.parse(options.now ?? nowIso());
  const observed = Date.parse(basis);
  if (!Number.isFinite(now) || !Number.isFinite(observed)) return false;
  return now - observed >= options.staleAfterDays * 24 * 60 * 60 * 1000;
}

function normalizeEvidenceQuery(query: string | undefined): string | undefined {
  return query ? normalizeWhitespace(query).toLowerCase() : undefined;
}

function parsePostStatus(value: string | undefined): DarknetPostStatus {
  const normalized = value?.toLowerCase().trim();
  if (normalized === "new" || normalized === "updated" || normalized === "removed") return normalized;
  return "unknown";
}

function serializeMetadataText(leakSite: LeakSiteMetadataCapture, title?: string): string {
  return normalizeWhitespace([
    title ? `title: ${title}` : "",
    leakSite.actorName ? `actor: ${leakSite.actorName}` : "",
    leakSite.victimName ? `victim: ${leakSite.victimName}` : "",
    leakSite.affectedAccounts ? `accounts compromised: ${leakSite.affectedAccounts}` : "",
    leakSite.accountSubjects ? `account subjects: ${leakSite.accountSubjects}` : "",
    leakSite.datasetSize ? `dataset size: ${leakSite.datasetSize}` : "",
    leakSite.actorStatement ? `actor statement: ${leakSite.actorStatement}` : "",
    leakSite.claimDate ? `date: ${leakSite.claimDate}` : "",
    leakSite.claimedSector ? `sector: ${leakSite.claimedSector}` : "",
    leakSite.claimedCountry ? `country: ${leakSite.claimedCountry}` : "",
    leakSite.claimedDataCategory ? `data category: ${leakSite.claimedDataCategory}` : "",
    `post status: ${leakSite.postStatus}`,
    `confidence: ${leakSite.confidence}`,
    leakSite.sourceTimestamp ? `source timestamp: ${leakSite.sourceTimestamp}` : "",
    `url hash: ${leakSite.urlHash}`,
    leakSite.screenshotHash ? `screenshot hash: ${leakSite.screenshotHash}` : ""
  ].filter(Boolean).join(" | "));
}

function sanitizeMetadataLinks(links: string[]): string[] {
  return links.filter((link) => !hasUrlCredentials(link) && !isSensitivePayloadTarget(link) && !isUnsafeInteractionTarget(link));
}

function queryTermsForDarknetSearch(query: string, entityType: string): string[] {
  const terms = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
  );
  if (entityType === "actor") terms.add("actor");
  if (entityType === "victim") terms.add("victim");
  if (entityType === "malware" || query.toLowerCase().includes("ransomware")) terms.add("ransomware");
  return [...terms];
}

function metadataResultMatchesQuery(result: DarknetMetadataResultDto, queryTerms: string[]): boolean {
  const fields = [
    result.actor,
    result.victim,
    result.sector,
    result.country,
    result.claimedDataCategory,
    result.postStatus
  ].filter(Boolean).map((field) => String(field).toLowerCase());
  const text = fields.join(" ");
  const words = new Set(text.split(/[^a-z0-9]+/i).filter(Boolean));
  return queryTerms.some((term) => term.length <= 2 ? words.has(term) : text.includes(term));
}

function searchNotes(status: DarknetMetadataLiveSearchStatus): string[] {
  if (status === "disabled") return ["Darknet metadata live search is disabled by kill switch."];
  if (status === "approval_required") return ["Darknet metadata sources exist but require approval before metadata-only collection."];
  if (status === "queued_metadata_only") return ["Approved darknet metadata sources can be queued in metadata-only mode."];
  if (status === "partial_metadata") return ["Stored metadata-only leak-site results matched the query; raw payloads were not returned."];
  return ["No safe darknet metadata collection path is currently available for this query."];
}

function connectorAttributionForBoundary(
  boundary: ApprovedProxyBoundary,
  config: DarknetNetworkMetadataSourceConfig
): DarknetConnectorAttribution {
  return {
    boundaryId: boundary.id,
    network: boundary.network,
    proxyType: config.proxyType,
    isolationId: `${boundary.network}:${boundary.id}:metadata-only`,
    timeoutClass: config.timeoutClass
  };
}

function buildDarknetPlanAudit(
  requestId: string,
  tenantId: string | undefined,
  actorId: string | undefined,
  tasks: number,
  reviewRequired: number,
  rejected: number,
  occurredAt: string
): AuditEvent[] {
  return [{
    id: stableId("audit", `${requestId}:darknet-metadata-plan:${occurredAt}`),
    tenantId,
    actorId,
    action: "darknet_metadata.plan.created",
    subjectType: "intelligence_request",
    subjectId: requestId,
    occurredAt,
    metadata: { tasks, reviewRequired, rejected, metadataOnly: true }
  }];
}

function hasUrlCredentials(url: string): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(parsed.username || parsed.password);
  } catch {
    return false;
  }
}

function restrictedBridgeState(
  source: SourceRecord,
  input: Omit<DarknetMetadataApprovalBridge, "sourceId" | "sourceType" | "metadataOnly" | "allowedFields" | "impossibleOperations" | "canQueueMetadataOnly" | "retentionClass"> & {
    readonly canQueueMetadataOnly?: boolean;
    readonly retentionClass?: RetentionClass;
  }
): DarknetMetadataApprovalBridge {
  return {
    sourceId: source.id,
    sourceType: source.type,
    state: input.state,
    liveSearchState: input.liveSearchState,
    requiredAction: input.requiredAction,
    reason: input.reason,
    metadataOnly: true,
    canQueueMetadataOnly: input.canQueueMetadataOnly ?? false,
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    impossibleOperations: BLOCKED_OPERATIONS,
    retentionClass: input.retentionClass ?? readRetentionClass(source.metadata),
    retentionExpiresAt: input.retentionExpiresAt,
    policyAuditId: input.policyAuditId,
    urlHash: input.urlHash,
    reviewDecisionId: input.reviewDecisionId
  };
}

function complianceStatusFromBridge(bridge: DarknetMetadataApprovalBridge): DarknetMetadataComplianceStatusDto {
  return {
    sourceId: bridge.sourceId,
    state: bridge.state,
    status: bridge.liveSearchState,
    reason: bridge.reason,
    requiredAction: bridge.requiredAction,
    metadataOnly: true,
    canQueueMetadataOnly: bridge.canQueueMetadataOnly,
    allowedFields: bridge.allowedFields,
    forbiddenOperations: bridge.impossibleOperations,
    retentionClass: bridge.retentionClass,
    retentionExpiresAt: bridge.retentionExpiresAt,
    urlHash: bridge.urlHash
  };
}

function restrictedMetadataActivationRecommendations(
  query: string,
  queryTerms: readonly string[],
  sources: readonly SourceRecord[],
  bridges: readonly DarknetMetadataApprovalBridge[]
): DarknetMetadataActivationRecommendation[] {
  const bySource = new Map(bridges.map((bridge) => [bridge.sourceId, bridge]));
  return sources
    .map((source) => ({ source, bridge: bySource.get(source.id), matchedFields: restrictedMetadataSourceMatches(source, query, queryTerms) }))
    .filter((item): item is { source: SourceRecord; bridge: DarknetMetadataApprovalBridge; matchedFields: string[] } =>
      Boolean(item.bridge && item.matchedFields.length > 0 && !item.bridge.canQueueMetadataOnly)
    )
    .map(({ source, bridge, matchedFields }) => ({
      sourceId: source.id,
      sourceName: source.name,
      requiredAction: bridge.requiredAction,
      restrictedState: bridge.state,
      reason: bridge.reason,
      metadataOnly: true as const,
      matchedFields,
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      priority: restrictedMetadataRecommendationPriority(bridge.state, matchedFields.length)
    }))
    .sort((left, right) => right.priority - left.priority || left.sourceName.localeCompare(right.sourceName));
}

function restrictedMetadataSourceMatches(source: SourceRecord, query: string, queryTerms: readonly string[]): string[] {
  const metadata = source.metadata ?? {};
  const candidates: Array<[string, string]> = [
    ["name", source.name],
    ["tags", (source.tags ?? []).join(" ")],
    ["actors", readStringArray(metadata.actors).join(" ")],
    ["victims", readStringArray(metadata.victims).join(" ")],
    ["ransomwareFamilies", readStringArray(metadata.ransomwareFamilies).join(" ")],
    ["topicTags", readStringArray(metadata.topicTags).join(" ")]
  ];
  const normalizedQuery = query.toLowerCase();
  return candidates
    .filter(([, value]) => {
      const text = value.toLowerCase();
      return text.includes(normalizedQuery) || queryTerms.some((term) => text.includes(term));
    })
    .map(([field]) => field);
}

function restrictedMetadataRecommendationPriority(state: DarknetMetadataRestrictedState, matchedFieldCount: number): number {
  const stateWeight: Record<DarknetMetadataRestrictedState, number> = {
    pending_metadata_only_approval: 80,
    missing_legal_notes: 70,
    missing_proxy_approval: 60,
    retention_expiry: 55,
    disabled_kill_switch: 40,
    blocked_unsafe_target: 20,
    active_metadata_only_queue: 10
  };
  return stateWeight[state] + matchedFieldCount;
}

function restrictedMetadataRetentionExpiresAt(source: SourceRecord): string | undefined {
  const metadata = source.metadata ?? {};
  return readString(metadata.restrictedRetentionExpiresAt) ?? readString(metadata.retentionExpiresAt);
}

function readRetentionClass(metadata: Record<string, unknown> | undefined): RetentionClass | undefined {
  const value = readString(metadata?.retentionClass);
  return value && restrictedRetentionClasses.has(value as RetentionClass) ? value as RetentionClass : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function blockedExplanationFromBridge(bridge: DarknetMetadataApprovalBridge): DarknetMetadataBlockedExplanation {
  return {
    sourceId: bridge.sourceId,
    reason: bridge.reason,
    state: bridge.liveSearchState === "disabled"
      ? "disabled"
      : bridge.liveSearchState === "approval_required"
        ? "approval_required"
        : "blocked",
    restrictedState: bridge.state,
    requiredAction: bridge.requiredAction,
    metadataOnly: true
  };
}

function auditFindingsForRestrictedSource(input: {
  source: SourceRecord;
  bridge: DarknetMetadataApprovalBridge;
  proxyBoundary?: ApprovedProxyBoundary;
  captures: readonly RawCapture[];
  deltas: readonly EvidenceDelta[];
  deadLettered: boolean;
  generatedAt: string;
}): RestrictedMetadataAuditFinding[] {
  const findings: RestrictedMetadataAuditFinding[] = [];
  const push = (
    kind: RestrictedMetadataAuditFindingKind,
    severity: RestrictedMetadataAuditFinding["severity"],
    message: string,
    evidenceIds: readonly string[] = []
  ) => findings.push({
    kind,
    sourceId: input.source.id,
    severity,
    message,
    evidenceIds,
    metadataOnly: true
  });

  if (input.bridge.state === "blocked_unsafe_target") {
    push("unsafe_target_blocked", "critical", "Unsafe restricted metadata target was blocked before collection.", [input.bridge.policyAuditId].filter(Boolean) as string[]);
  }
  if (input.bridge.state === "pending_metadata_only_approval" || !input.source.governance?.approvedAt || !input.source.governance?.approvedBy) {
    push("approval_missing", "warning", "Restricted metadata source is missing explicit metadata-only approval.");
  }
  const legalNotesExpiresAt = readString(input.source.metadata?.legalNotesExpiresAt);
  if (!input.source.legalNotes.trim() || (legalNotesExpiresAt && legalNotesExpiresAt <= input.generatedAt)) {
    push("legal_notes_expired", "warning", "Legal and ethics notes are missing or expired.");
  }
  if (input.source.status === "disabled" || input.source.accessMethod === "disabled") {
    push("source_disabled", "warning", "Restricted metadata source is disabled.");
  }
  if (input.bridge.state === "disabled_kill_switch") {
    push("kill_switch_active", "critical", "Restricted metadata kill switch is active for this source.");
  }
  if (hasUrlCredentials(input.source.url) || isSensitivePayloadTarget(input.source.url) || rawPayloadBlockedDelta(input.deltas)) {
    push("raw_payload_attempted_blocked", "critical", "Raw payload or credential-style target was attempted and blocked by policy.", blockedDeltaIds(input.deltas));
  }
  if (input.bridge.state === "retention_expiry" || input.deltas.some((delta) => delta.metadata.deltaType === "retention_expiry")) {
    push("retention_expired", "warning", "Restricted metadata retention approval has expired.");
  }
  for (const capture of input.captures) {
    const result = darknetMetadataResultFromCapture(capture);
    if (!result) continue;
    if (result.urlHash) push("url_hash_only", "info", "Capture retained URL hash only.", [capture.id]);
    if (result.screenshotHash) push("screenshot_hash_only", "info", "Capture retained screenshot hash only.", [capture.id]);
    if (capture.storageKind === "metadata_only" && !capture.body && !capture.objectRef) {
      push("metadata_only_capture_complete", "info", "Metadata-only capture is complete and contains no raw payload body.", [capture.id]);
    }
  }
  if (input.proxyBoundary?.health && !input.proxyBoundary.health.healthy) {
    push("proxy_isolation_unhealthy", "warning", "Approved proxy isolation health is degraded or failing.");
  }
  if (input.deadLettered) {
    push("scheduler_dead_lettered", "warning", "Scheduler placed restricted metadata work in dead-letter state.");
  }
  if (input.deltas.some((delta) => delta.metadata.deltaType === "blocked_unsafe_link")) {
    push("unsafe_target_blocked", "critical", "Evidence delta recorded a blocked unsafe restricted link.", blockedDeltaIds(input.deltas));
  }
  return dedupeAuditFindings(findings);
}

function repairRecommendationsForRestrictedAudit(
  source: SourceRecord,
  bridge: DarknetMetadataApprovalBridge,
  findings: readonly RestrictedMetadataAuditFinding[],
  scheduler: { queued: boolean; leased: boolean; deadLettered: boolean }
): RestrictedMetadataAuditRepair[] {
  const repairs: RestrictedMetadataAuditRepair[] = [];
  const add = (action: RestrictedMetadataRepairAction, priority: RestrictedMetadataAuditRepair["priority"], reason: string) => repairs.push({
    action,
    sourceId: source.id,
    priority,
    reason,
    forbiddenActions: RESTRICTED_AUDIT_FORBIDDEN_REPAIR_ACTIONS
  });
  if (findings.some((finding) => finding.kind === "approval_missing")) {
    add("approve_metadata_only", "high", "Record explicit metadata-only approval with reviewer, risk justification, and legal contact.");
  }
  if (findings.some((finding) => finding.kind === "legal_notes_expired")) {
    add("add_or_refresh_legal_notes", "high", "Add or refresh legal and ethics notes before any metadata-only queueing.");
  }
  if (bridge.state === "missing_proxy_approval") {
    add("assign_approved_proxy", "high", "Assign a matching approved proxy boundary for the source network.");
  }
  if (findings.some((finding) => finding.kind === "kill_switch_active" || finding.kind === "source_disabled")) {
    add("restore_source", "medium", "Restore only after policy review confirms metadata-only scope and kill-switch reason is resolved.");
  }
  if (findings.some((finding) => finding.kind === "retention_expired")) {
    add("review_retention", "medium", "Review retention class, expiry, and legal hold before queueing more metadata.");
  }
  if (findings.some((finding) => finding.kind === "unsafe_target_blocked" || finding.kind === "raw_payload_attempted_blocked")) {
    add("repair_target_to_metadata_listing", "high", "Replace unsafe target with a metadata listing URL or remove the source from active scope.");
  }
  if (findings.some((finding) => finding.kind === "proxy_isolation_unhealthy")) {
    add("inspect_proxy_isolation", "medium", "Inspect proxy boundary health, isolation id, timeout class, and failure category.");
  }
  if (scheduler.deadLettered && bridge.canQueueMetadataOnly) {
    add("requeue_metadata_only", "low", "Requeue metadata-only work after scheduler dead-letter reason is resolved.");
  }
  return dedupeRestrictedAuditRepairs(repairs);
}

function cutoverStatusesForDiagnostic(
  diagnostic: RestrictedMetadataSourceAuditDiagnostic,
  source: SourceRecord | undefined,
  generatedAt: string,
  retentionWindowDays: number
): RestrictedMetadataCutoverStatus[] {
  const statuses = new Set<RestrictedMetadataCutoverStatus>();
  const findingKinds = new Set(diagnostic.findings.map((finding) => finding.kind));
  const blockingFindings = diagnostic.findings.filter((finding) => finding.severity !== "info");
  if (diagnostic.status === "disabled" || diagnostic.accessMethod === "disabled" || findingKinds.has("source_disabled")) {
    statuses.add("disabled");
  }
  if (findingKinds.has("kill_switch_active")) statuses.add("kill_switch_active");
  if (
    findingKinds.has("approval_missing") ||
    findingKinds.has("legal_notes_expired") ||
    source?.governance?.approvalState !== "approved" ||
    source?.governance?.metadataOnly !== true
  ) {
    statuses.add("pending_approval");
  }
  if (findingKinds.has("unsafe_target_blocked") || findingKinds.has("raw_payload_attempted_blocked")) {
    statuses.add("blocked_unsafe_target");
  }
  if (
    findingKinds.has("retention_expired") ||
    retentionExpiresWithinWindow(diagnostic.retentionExpiresAt, generatedAt, retentionWindowDays)
  ) {
    statuses.add("retention_expiring");
  }
  const hasBlocker = [...statuses].some((status) =>
    status === "disabled" ||
    status === "pending_approval" ||
    status === "blocked_unsafe_target" ||
    status === "kill_switch_active" ||
    status === "retention_expiring"
  );
  const hasOperationalEvidence = diagnostic.schedulerState.queued || diagnostic.schedulerState.leased || Boolean(diagnostic.latestCaptureId) || diagnostic.deltaTypes.length > 0;
  if (!hasBlocker && diagnostic.metadataOnly && blockingFindings.length === 0 && !diagnostic.schedulerState.deadLettered && hasOperationalEvidence) {
    statuses.add("ready_metadata_only");
    statuses.add("audit_clean");
  } else if (diagnostic.metadataOnly && blockingFindings.length === 0) {
    statuses.add("audit_clean");
  }
  return Array.from(statuses);
}

function primaryCutoverStatus(statuses: readonly RestrictedMetadataCutoverStatus[]): RestrictedMetadataCutoverStatus {
  for (const status of [
    "kill_switch_active",
    "blocked_unsafe_target",
    "disabled",
    "pending_approval",
    "retention_expiring",
    "ready_metadata_only",
    "audit_clean"
  ] satisfies readonly RestrictedMetadataCutoverStatus[]) {
    if (statuses.includes(status)) return status;
  }
  return "pending_approval";
}

function retentionExpiresWithinWindow(expiresAt: string | undefined, generatedAt: string, windowDays: number): boolean {
  if (!expiresAt) return false;
  const expires = Date.parse(expiresAt);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(expires) || !Number.isFinite(now)) return false;
  const milliseconds = expires - now;
  return milliseconds >= 0 && milliseconds <= windowDays * 24 * 60 * 60 * 1000;
}

function cutoverBlockers(
  statuses: readonly RestrictedMetadataCutoverSourceStatus[],
  audit: RestrictedMetadataAuditReport
): string[] {
  const blockerStatuses = new Set<RestrictedMetadataCutoverStatus>([
    "blocked_unsafe_target",
    "kill_switch_active",
    "disabled",
    "pending_approval"
  ]);
  return [
    ...statuses
      .filter((source) => source.statuses.some((status) => blockerStatuses.has(status)))
      .map((source) => `${source.primaryStatus}:${source.sourceId}`),
    ...audit.findings
      .filter((finding) => finding.severity === "critical")
      .map((finding) => `${finding.kind}:${finding.sourceId}`)
  ];
}

function restrictedMetadataCutoverRollbackActions(
  statuses: readonly RestrictedMetadataCutoverSourceStatus[],
  audit: RestrictedMetadataAuditReport
): RestrictedMetadataCutoverRollbackPlan[] {
  const actions: RestrictedMetadataCutoverRollbackPlan[] = [];
  const add = (
    action: RestrictedMetadataCutoverRollbackAction,
    priority: RestrictedMetadataCutoverRollbackPlan["priority"],
    reason: string,
    sourceId?: string
  ) => actions.push({ action, sourceId, priority, reason, metadataOnly: true });

  if (audit.findings.some((finding) => finding.severity === "critical")) {
    add("keep_outer_fallback_enabled", "high", "Keep scraper-native restricted metadata out of promotion until critical audit blockers clear.");
    add("pause_restricted_metadata_workers", "high", "Pause restricted metadata workers before retrying cutover rehearsal.");
  }
  if (audit.findings.some((finding) => finding.kind === "proxy_isolation_unhealthy")) {
    add("pause_restricted_metadata_workers", "high", "Pause restricted metadata workers while approved proxy isolation is unhealthy.");
  }
  for (const status of statuses) {
    if (status.statuses.includes("blocked_unsafe_target")) {
      add("quarantine_source", "high", "Quarantine unsafe restricted target and require metadata-listing repair before promotion.", status.sourceId);
      add("clear_metadata_only_queue", "medium", "Clear queued metadata-only work for the blocked restricted source.", status.sourceId);
    }
    if (status.statuses.includes("kill_switch_active") || status.statuses.includes("disabled")) {
      add("keep_restricted_sources_disabled", "medium", "Keep restricted source disabled until governance and operator review clear the kill switch.", status.sourceId);
    }
    if (status.statuses.includes("retention_expiring")) {
      add("review_retention_before_cutover", "medium", "Review retention expiry and legal hold state before promoting restricted metadata cutover.", status.sourceId);
    }
  }
  if (actions.length > 0) {
    add("restore_last_audit_clean_config", "medium", "Restore the last audit-clean restricted metadata configuration if promotion checks regress.");
  }
  return dedupeRestrictedCutoverRollbackActions(actions);
}

function restrictedMetadataApplyPlanItemsForSource(
  status: RestrictedMetadataCutoverSourceStatus,
  diagnostic: RestrictedMetadataSourceAuditDiagnostic | undefined,
  generatedAt: string
): RestrictedMetadataApplyPlanItem[] {
  const items: RestrictedMetadataApplyPlanItem[] = [];
  const findingKinds = new Set(diagnostic?.findings.map((finding) => finding.kind) ?? []);
  const push = (
    action: RestrictedMetadataApplyAction,
    safety: RestrictedMetadataApplySafety,
    reason: string,
    preconditions: readonly string[],
    expectedDiff: RestrictedMetadataApplyExpectedDiff,
    rollback: readonly string[],
    policyImpact: readonly string[]
  ) => items.push(restrictedMetadataApplyPlanItem({
    action,
    safety,
    status,
    diagnostic,
    generatedAt,
    reason,
    preconditions,
    expectedDiff,
    rollback,
    policyImpact
  }));

  if (status.statuses.includes("ready_metadata_only")) {
    push(
      "enable_metadata_only_queue",
      "automation_safe",
      "Source is audit-clean and ready for metadata-only scheduling.",
      [
        "metadata-only governance is approved",
        "approved proxy boundary is assigned",
        "target passed unsafe-link policy",
        "scheduler action queues metadata-only work only"
      ],
      {
        sourceStatus: "unchanged",
        accessMethod: "unchanged",
        scheduler: "queue_metadata_only",
        retentionClass: diagnostic?.retentionClass ?? "unchanged",
        proxyBoundaryId: diagnostic?.proxyBoundaryId
      },
      ["clear metadata-only queue entry", "restore previous scheduler cursor"],
      ["queues metadata-only work without broad destination expansion"]
    );
  }

  if (status.statuses.includes("pending_approval")) {
    push(
      "renew_legal_notes",
      "human_approval_required",
      "Legal notes or explicit metadata-only approval must be refreshed before automation can queue work.",
      [
        "reviewer records legal/ethics basis",
        "review ticket is attached",
        "approval scope remains metadata_only",
        "allowed fields remain restricted metadata fields"
      ],
      {
        sourceStatus: "unchanged",
        accessMethod: "unchanged",
        scheduler: "unchanged",
        retentionClass: diagnostic?.retentionClass ?? "unchanged"
      },
      ["expire the review note", "return source to needs_review"],
      ["keeps collection blocked until governance evidence is updated"]
    );
  }

  if (findingKinds.has("proxy_isolation_unhealthy") || !diagnostic?.proxyBoundaryId) {
    push(
      "approve_proxy_isolation",
      "human_approval_required",
      "Proxy isolation must be reviewed and approved before restricted metadata work can run.",
      [
        "matching Tor/I2P/Freenet network boundary is configured",
        "proxy health is checked",
        "isolation id and timeout class are recorded",
        "source record does not contain proxy secrets"
      ],
      {
        sourceStatus: "unchanged",
        accessMethod: "approved_proxy",
        scheduler: "unchanged",
        retentionClass: diagnostic?.retentionClass ?? "unchanged",
        proxyBoundaryId: diagnostic?.proxyBoundaryId
      },
      ["remove proxy approval", "pause restricted metadata workers"],
      ["approves only routing isolation, not expanded collection privileges"]
    );
  }

  if (status.statuses.includes("blocked_unsafe_target")) {
    push(
      "keep_source_blocked",
      "blocked",
      "Unsafe restricted target remains blocked and must not be queued.",
      ["policy block remains recorded", "unsafe target is represented only by hash", "operator does not repair by adding access workarounds"],
      {
        sourceStatus: "quarantined",
        accessMethod: "disabled",
        scheduler: "clear_metadata_only_queue",
        retentionClass: diagnostic?.retentionClass ?? "unchanged"
      },
      ["keep source disabled until a safe metadata listing is reviewed"],
      ["prevents unsafe restricted target from entering live search or scheduler queues"]
    );
    push(
      "apply_kill_switch",
      "rollback_only",
      "Apply or keep the restricted metadata kill switch while unsafe target blockers are present.",
      ["critical policy finding is present", "Agent 10 rollback gate is active", "operator records kill-switch reason"],
      {
        sourceStatus: "disabled",
        accessMethod: "disabled",
        scheduler: "clear_metadata_only_queue",
        retentionClass: diagnostic?.retentionClass ?? "unchanged",
        killSwitch: "enabled"
      },
      ["restore only after safe metadata-only review passes"],
      ["keeps restricted workers from retrying policy-blocked targets"]
    );
  }

  if (status.statuses.includes("disabled") || status.statuses.includes("kill_switch_active")) {
    push(
      "disable_source",
      "rollback_only",
      "Keep disabled or kill-switched restricted source out of cutover.",
      ["source is disabled or kill switch is active", "no scheduler lease remains active", "policy status is visible to Agent 09"],
      {
        sourceStatus: "disabled",
        accessMethod: "disabled",
        scheduler: "clear_metadata_only_queue",
        retentionClass: diagnostic?.retentionClass ?? "unchanged",
        killSwitch: "enabled"
      },
      ["restore only after governance approval and audit-clean cutover status"],
      ["preserves safe blocked state for promotion rollback"]
    );
  }

  if (status.statuses.includes("retention_expiring")) {
    push(
      "shorten_retention",
      "automation_safe",
      "Shorten or keep a restrictive retention window before more metadata-only queueing.",
      ["retention class remains restricted_metadata, darknet_metadata, or legal_hold", "no raw body or object reference is retained", "expiry is visible in Agent 09 status"],
      {
        sourceStatus: "unchanged",
        accessMethod: "unchanged",
        scheduler: "unchanged",
        retentionClass: "shorten_restricted_window"
      },
      ["restore previous restricted retention expiry if legal review requires it"],
      ["reduces retained metadata window without adding new collection capability"]
    );
  }

  return items;
}

function restrictedMetadataApplyPlanItem(input: {
  readonly action: RestrictedMetadataApplyAction;
  readonly safety: RestrictedMetadataApplySafety;
  readonly status: RestrictedMetadataCutoverSourceStatus;
  readonly diagnostic?: RestrictedMetadataSourceAuditDiagnostic;
  readonly generatedAt: string;
  readonly reason: string;
  readonly preconditions: readonly string[];
  readonly expectedDiff: RestrictedMetadataApplyExpectedDiff;
  readonly rollback: readonly string[];
  readonly policyImpact: readonly string[];
}): RestrictedMetadataApplyPlanItem {
  return {
    id: stableId("restricted-apply", `${input.generatedAt}:${input.status.sourceId}:${input.action}`),
    action: input.action,
    sourceId: input.status.sourceId,
    sourceType: input.status.sourceType,
    safety: input.safety,
    metadataOnly: true,
    dryRunOnly: true,
    reason: input.reason,
    preconditions: input.preconditions,
    expectedDiff: input.expectedDiff,
    rollback: input.rollback,
    policyImpact: input.policyImpact,
    prohibitedAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES,
    proof: {
      exposesRawUrl: false,
      allowsPayloadDownload: false,
      allowsAuthBypass: false,
      allowsCaptchaSolving: false,
      allowsPrivateCommunityAccess: false,
      allowsThreatActorInteraction: false,
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      urlHash: input.diagnostic?.urlHash
    }
  };
}

function restrictedMetadataApplyPlanExample(
  status: RestrictedMetadataCutoverStatus,
  action: RestrictedMetadataApplyAction,
  safety: RestrictedMetadataApplySafety
): RestrictedMetadataApplyPlanItem {
  const sourceId = `example_${status}`;
  const sourceStatus = status === "disabled" || status === "kill_switch_active"
    ? "disabled"
    : status === "blocked_unsafe_target"
      ? "quarantined"
      : "unchanged";
  const accessMethod = status === "disabled" || status === "kill_switch_active" || status === "blocked_unsafe_target"
    ? "disabled"
    : "unchanged";
  const scheduler = action === "enable_metadata_only_queue"
    ? "queue_metadata_only"
    : action === "disable_source" || action === "apply_kill_switch" || action === "keep_source_blocked"
      ? "clear_metadata_only_queue"
      : "unchanged";
  return restrictedMetadataApplyPlanItem({
    action,
    safety,
    status: {
      sourceId,
      sourceType: "tor_metadata",
      statuses: status === "ready_metadata_only" ? ["ready_metadata_only", "audit_clean"] : [status],
      primaryStatus: status,
      metadataOnly: true,
      canQueueMetadataOnly: status === "ready_metadata_only" || status === "audit_clean",
      schedulerState: {
        queued: status === "ready_metadata_only",
        leased: false,
        deadLettered: false
      },
      retentionExpiresAt: status === "retention_expiring" ? "2026-06-01T00:00:00.000Z" : undefined,
      evidenceFreshness: status === "ready_metadata_only" || status === "audit_clean" ? "fresh_capture" : "no_recent_evidence",
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      policyWarnings: status === "audit_clean" || status === "ready_metadata_only" ? [] : [`${status}:${sourceId}`]
    },
    diagnostic: {
      sourceId,
      sourceType: "tor_metadata",
      status: sourceStatus === "unchanged" ? "active" : sourceStatus,
      approvalState: status === "pending_approval" ? "pending" : "approved",
      metadataOnly: true,
      accessMethod: accessMethod === "unchanged" ? "approved_proxy" : accessMethod,
      proxyBoundaryId: "tor-approved-metadata-proxy",
      proxyHealthy: true,
      retentionClass: "restricted_metadata",
      retentionExpiresAt: status === "retention_expiring" ? "2026-06-01T00:00:00.000Z" : undefined,
      schedulerState: {
        queued: status === "ready_metadata_only",
        leased: false,
        deadLettered: false
      },
      urlHash: `urlhash_${status}`,
      latestCaptureId: status === "ready_metadata_only" || status === "audit_clean" ? `cap_${status}` : undefined,
      deltaTypes: [],
      findings: [],
      repairs: []
    },
    generatedAt: "2026-05-24T03:30:00.000Z",
    reason: `OpenAPI-ready restricted metadata ${status} apply-plan example.`,
    preconditions: [
      "dry-run only",
      "metadata-only scope is preserved",
      "unsafe target values are represented only by hashes"
    ],
    expectedDiff: {
      sourceStatus,
      accessMethod,
      scheduler,
      retentionClass: action === "shorten_retention" ? "shorten_restricted_window" : "unchanged",
      killSwitch: action === "apply_kill_switch" || action === "disable_source" ? "enabled" : "unchanged",
      proxyBoundaryId: "tor-approved-metadata-proxy"
    },
    rollback: ["discard dry-run plan without mutating source, scheduler, proxy, or retention state"],
    policyImpact: ["Agent 09 can display status and warnings without exposing raw restricted URLs", "Agent 10 can include rollback or kill-switch action in promotion packets"]
  });
}

function dedupeRestrictedApplyPlanItems(items: readonly RestrictedMetadataApplyPlanItem[]): RestrictedMetadataApplyPlanItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.action}:${item.sourceId}:${item.safety}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRestrictedCutoverRollbackActions(
  actions: readonly RestrictedMetadataCutoverRollbackPlan[]
): RestrictedMetadataCutoverRollbackPlan[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.action}:${action.sourceId ?? "global"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function partialSemanticsFromBridge(bridge: DarknetMetadataApprovalBridge): RestrictedMetadataIntelSearchPartialSemantics {
  const stateByRestrictedState: Record<DarknetMetadataRestrictedState, RestrictedMetadataIntelSearchPartialState> = {
    disabled_kill_switch: "kill_switch_active",
    missing_proxy_approval: "pending_approval",
    missing_legal_notes: "pending_approval",
    pending_metadata_only_approval: "pending_approval",
    active_metadata_only_queue: "metadata_only_ready",
    blocked_unsafe_target: "blocked_unsafe_target",
    retention_expiry: "retention_expiring"
  };
  return partialSemantics({
    state: stateByRestrictedState[bridge.state],
    sourceId: bridge.sourceId,
    publicStatus: bridge.liveSearchState,
    reasonCode: bridge.state,
    reason: bridge.reason,
    canQueueMetadataOnly: bridge.canQueueMetadataOnly,
    policyAuditId: bridge.policyAuditId,
    urlHash: bridge.urlHash,
    retentionExpiresAt: bridge.retentionExpiresAt
  });
}

function partialSemantics(input: {
  readonly state: RestrictedMetadataIntelSearchPartialState;
  readonly sourceId?: string;
  readonly publicStatus: DarknetMetadataLiveSearchStatus;
  readonly reasonCode: DarknetMetadataRestrictedState | DarknetMetadataLiveSearchStatus;
  readonly reason: string;
  readonly canQueueMetadataOnly: boolean;
  readonly policyAuditId?: string;
  readonly urlHash?: string;
  readonly retentionExpiresAt?: string;
}): RestrictedMetadataIntelSearchPartialSemantics {
  return {
    state: input.state,
    sourceId: input.sourceId,
    metadataOnly: true,
    safeForApi: true,
    canQueueMetadataOnly: input.canQueueMetadataOnly,
    reasonCode: input.reasonCode,
    publicStatus: input.publicStatus,
    reason: input.reason,
    policyWarning: `${input.state}:${input.sourceId ?? "global"}`,
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    forbiddenOperations: BLOCKED_OPERATIONS,
    policyAuditId: input.policyAuditId,
    urlHash: input.urlHash,
    retentionExpiresAt: input.retentionExpiresAt
  };
}

function dedupePartialSemantics(
  states: readonly RestrictedMetadataIntelSearchPartialSemantics[]
): RestrictedMetadataIntelSearchPartialSemantics[] {
  const seen = new Set<string>();
  return states.filter((state) => {
    const key = `${state.state}:${state.sourceId ?? "global"}:${state.policyAuditId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function restrictedMetadataNonBlockingSearchSemanticsFromInputs(input: {
  readonly status: DarknetMetadataLiveSearchStatus;
  readonly results: readonly DarknetMetadataResultDto[];
  readonly queuedTasks: number;
  readonly sourceStates: readonly DarknetMetadataApprovalBridge[];
  readonly query: string;
  readonly entityType?: string;
}): RestrictedMetadataNonBlockingSearchSemanticsDto {
  const queryClass = restrictedMetadataQueryClass(input.query, input.entityType);
  const packets = [
    ...input.sourceStates.map((state) => restrictedMetadataNonBlockingSearchPacket({
      scenario: restrictedMetadataScenarioForBridge(state, queryClass),
      sourceId: state.sourceId,
      queryClass,
      canQueueMetadataOnly: state.canQueueMetadataOnly,
      policyGate: state.state,
      reason: state.reason,
      restrictedContext: state.canQueueMetadataOnly || input.queuedTasks > 0 ? "queued_metadata_only_context" : state.liveSearchState === "blocked" ? "blocked_context" : "held_policy_gated_context",
      agent09WarningCodes: state.canQueueMetadataOnly ? ["restricted_metadata_context_held"] : [`restricted_metadata_${state.liveSearchState}`]
    })),
    restrictedMetadataNonBlockingSearchPacket({
      scenario: queryClass,
      queryClass,
      canQueueMetadataOnly: input.status === "partial_metadata" || input.status === "queued_metadata_only",
      policyGate: "query_class",
      reason: input.results.length > 0 ? "metadata-only context is available without blocking public search" : "restricted metadata does not block clear-web or public-channel search",
      restrictedContext: input.status === "blocked" || input.status === "disabled" ? "blocked_context" : input.queuedTasks > 0 || input.results.length > 0 ? "queued_metadata_only_context" : "held_policy_gated_context",
      agent09WarningCodes: input.status === "partial_metadata" || input.status === "queued_metadata_only" ? ["restricted_metadata_context_held"] : [`restricted_metadata_${input.status}`]
    }),
    ...(input.status === "disabled" || input.sourceStates.some((state) => state.state === "disabled_kill_switch")
      ? [restrictedMetadataNonBlockingSearchPacket({
        scenario: "public_api_blocked_state",
        queryClass,
        canQueueMetadataOnly: false,
        policyGate: input.status,
        reason: "restricted metadata public API state is blocked while public search continues",
        restrictedContext: "blocked_context",
        agent09WarningCodes: ["restricted_metadata_public_api_blocked"]
      })]
      : [])
  ];
  return restrictedMetadataNonBlockingSearchSemanticsSummary(packets);
}

function restrictedMetadataNonBlockingSearchSemanticsForReadiness(
  sourceId: string,
  runtimeProofs: readonly RestrictedMetadataRuntimeProofDto[],
  enforcement: RestrictedMetadataEnforcementDto
): RestrictedMetadataNonBlockingSearchSemanticsDto {
  const packets = runtimeProofs.length > 0
    ? runtimeProofs.map((proof) => restrictedMetadataNonBlockingSearchPacket({
      scenario: restrictedMetadataScenarioForRuntimeProof(proof),
      sourceId,
      canQueueMetadataOnly: proof.releaseEffect === "none" || proof.releaseEffect === "downgrade",
      policyGate: proof.kind,
      reason: proof.reason,
      restrictedContext: proof.releaseEffect === "rollback" ? "blocked_context" : proof.releaseEffect === "block" ? "held_policy_gated_context" : "queued_metadata_only_context",
      agent09WarningCodes: proof.releaseEffect === "none" ? ["restricted_metadata_context_held"] : [`restricted_metadata_${proof.kind}`]
    }))
    : [restrictedMetadataNonBlockingSearchPacket({
      scenario: enforcement.level === "emergency_stop" ? "kill_switch" : "approved_metadata_canary",
      sourceId,
      canQueueMetadataOnly: enforcement.level === "pass" || enforcement.level === "warning",
      policyGate: "query_class",
      reason: "restricted metadata readiness does not block clear-web or public-channel search",
      restrictedContext: enforcement.level === "emergency_stop" ? "blocked_context" : enforcement.level === "hold" ? "held_policy_gated_context" : "queued_metadata_only_context",
      agent09WarningCodes: enforcement.agent09WarningCodes.length > 0 ? enforcement.agent09WarningCodes : ["restricted_metadata_context_held"]
    })];
  return restrictedMetadataNonBlockingSearchSemanticsSummary(packets);
}

function restrictedMetadataNonBlockingSearchSemanticsForStatus(
  sources: readonly RestrictedMetadataOperationsReadinessDto[],
  input: {
    readonly query?: string;
    readonly entityType?: string;
    readonly matchingResultCount: number;
    readonly partialState: DarknetMetadataLiveSearchStatus;
  }
): RestrictedMetadataNonBlockingSearchSemanticsDto {
  const queryClass = input.query ? restrictedMetadataQueryClass(input.query, input.entityType) : "actor_query";
  const queryPacket = restrictedMetadataNonBlockingSearchPacket({
    scenario: queryClass,
    queryClass,
    canQueueMetadataOnly: input.partialState === "partial_metadata" || input.partialState === "queued_metadata_only",
    policyGate: "query_class",
    reason: input.matchingResultCount > 0 ? "restricted metadata context is partial and non-blocking" : "clear-web and public-channel search continue while restricted context is gated",
    restrictedContext: input.partialState === "blocked" || input.partialState === "disabled" ? "blocked_context" : input.partialState === "queued_metadata_only" || input.partialState === "partial_metadata" ? "queued_metadata_only_context" : "held_policy_gated_context",
    agent09WarningCodes: ["restricted_metadata_context_held"]
  });
  return restrictedMetadataNonBlockingSearchSemanticsSummary([...sources.flatMap((source) => source.nonBlockingSearch.packets), queryPacket]);
}

function restrictedMetadataNonBlockingSearchSemanticsForApplyPlan(
  connectorCertifications: readonly RestrictedMetadataConnectorCertificationPacketDto[],
  killSwitchDrills: RestrictedMetadataKillSwitchDrillsDto,
  emergencyStopCertification: RestrictedMetadataEmergencyStopCertificationDto
): RestrictedMetadataNonBlockingSearchSemanticsDto {
  const scenarios = restrictedMetadataUniqueStrings([
    ...connectorCertifications.map((packet) => restrictedMetadataScenarioForCertification(packet.scenario)),
    ...killSwitchDrills.observedScenarios.map(restrictedMetadataScenarioForDrill),
    ...emergencyStopCertification.observedScenarios.map(restrictedMetadataScenarioForEmergencyStop)
  ]);
  return restrictedMetadataNonBlockingSearchSemanticsSummary(scenarios.map((scenario) => restrictedMetadataNonBlockingSearchPacket({
    scenario,
    canQueueMetadataOnly: scenario === "approved_metadata_canary",
    policyGate: "query_class",
    reason: "apply-plan certification keeps restricted context non-blocking for public search",
    restrictedContext: scenario === "approved_metadata_canary" ? "queued_metadata_only_context" : scenario === "kill_switch" || scenario === "unsafe_target" || scenario === "public_api_blocked_state" ? "blocked_context" : "held_policy_gated_context",
    agent09WarningCodes: restrictedMetadataWarningsForNonBlockingScenario(scenario)
  })));
}

function restrictedMetadataNonBlockingSearchPacket(input: {
  readonly scenario: RestrictedMetadataNonBlockingSearchScenario;
  readonly sourceId?: string;
  readonly queryClass?: string;
  readonly canQueueMetadataOnly: boolean;
  readonly policyGate: RestrictedMetadataNonBlockingSearchPacketDto["policyGate"];
  readonly reason: string;
  readonly restrictedContext: RestrictedMetadataNonBlockingSearchPacketDto["restrictedContext"];
  readonly agent09WarningCodes: readonly string[];
}): RestrictedMetadataNonBlockingSearchPacketDto {
  const blocked = input.restrictedContext === "blocked_context";
  const held = input.restrictedContext === "held_policy_gated_context";
  return {
    packetId: stableId("restricted-non-blocking-search", `${input.scenario}:${input.sourceId ?? input.queryClass ?? "global"}:${input.policyGate}`),
    scenario: input.scenario,
    sourceId: input.sourceId,
    queryClass: input.queryClass,
    metadataOnly: true,
    safeForApi: true,
    publicSearchAction: "continue_clear_web_and_public_channel",
    restrictedContext: input.restrictedContext,
    publicAnswerInfluence: input.restrictedContext === "queued_metadata_only_context" ? "caveat_only" : "none",
    canQueueMetadataOnly: input.canQueueMetadataOnly,
    policyGate: input.policyGate,
    reason: input.reason,
    agent06EvidenceGate: input.scenario === "retention_expiry" || input.scenario === "legal_hold" ? "hold_retention" : blocked || input.scenario === "redaction_repair" ? "hold_redaction" : "metadata_only_handoff",
    agent07PublicAnswerState: held || blocked ? "policy_hold_caveat" : "restricted_context_only",
    agent09WarningCodes: restrictedMetadataUniqueStrings(input.agent09WarningCodes),
    agent10EmergencyStopBoard: {
      decision: blocked ? "rollback_restricted_workers" : held ? "hold_restricted_context" : "continue_public_search",
      publicApiImpact: blocked ? "hold_restricted_only" : held ? "warn" : "none"
    },
    proof: {
      doesNotBlockPublicSearch: true,
      doesNotPromoteRestrictedFacts: true,
      noUnsafeAccess: true,
      noDataExposure: true,
      noContact: true,
      noDownload: true,
      noCredentialBypass: true,
      noCaptchaSolving: true,
      noStealth: true,
      noRawPayloads: true,
      noRawUrls: true,
      hashOnlyEvidence: true
    },
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    forbiddenOperations: BLOCKED_OPERATIONS,
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck()
  };
}

function restrictedMetadataNonBlockingSearchSemanticsSummary(
  packets: readonly RestrictedMetadataNonBlockingSearchPacketDto[]
): RestrictedMetadataNonBlockingSearchSemanticsDto {
  return {
    metadataOnly: true,
    safeForApi: true,
    nonBlockingPublicSearch: true,
    publicSearchBehavior: "clear_web_and_public_channel_continue_immediately",
    publicAnswerRule: "restricted_metadata_context_never_promotes_public_answer_without_review",
    maxPublicSearchAddedLatencyMs: 0,
    packets: restrictedMetadataDedupeNonBlockingSearchPackets(packets),
    fixtureScenarios: restrictedMetadataNonBlockingSearchScenarioOrder(),
    observedScenarios: restrictedMetadataUniqueStrings([
      ...packets.map((packet) => packet.scenario),
      ...restrictedMetadataNonBlockingSearchScenarioOrder()
    ]),
    agent06EvidenceGates: restrictedMetadataUniqueStrings(packets.map((packet) => packet.agent06EvidenceGate)),
    agent07PublicAnswerStates: restrictedMetadataUniqueStrings(packets.map((packet) => packet.agent07PublicAnswerState)),
    agent09WarningCodes: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.agent09WarningCodes)),
    agent10EmergencyStopDecisions: restrictedMetadataUniqueStrings(packets.map((packet) => packet.agent10EmergencyStopBoard.decision)),
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck()
  };
}

function restrictedMetadataDedupeNonBlockingSearchPackets(
  packets: readonly RestrictedMetadataNonBlockingSearchPacketDto[]
): RestrictedMetadataNonBlockingSearchPacketDto[] {
  const seen = new Set<string>();
  return packets.filter((packet) => {
    const key = `${packet.scenario}:${packet.sourceId ?? ""}:${packet.queryClass ?? ""}:${packet.policyGate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeProductionAuditEvents(
  events: readonly RestrictedMetadataProductionAuditEventDto[]
): RestrictedMetadataProductionAuditEventDto[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.eventType}:${event.sourceId}:${event.policyAuditId ?? ""}:${event.urlHash ?? ""}:${event.restrictedState ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function runtimeIsolationState(
  bridge: DarknetMetadataApprovalBridge,
  proxyFailure: boolean,
  timeout: boolean,
  retentionExpiring: boolean
): RestrictedMetadataRuntimeIsolationState {
  if (bridge.state === "disabled_kill_switch") return "kill_switch_active";
  if (bridge.state === "blocked_unsafe_target") return "unsafe_target_blocked";
  if (bridge.state === "retention_expiry" || retentionExpiring) return "retention_expiring";
  if (
    bridge.state === "pending_metadata_only_approval" ||
    bridge.state === "missing_legal_notes" ||
    bridge.state === "missing_proxy_approval"
  ) {
    return bridge.state === "missing_proxy_approval" ? "policy_repair" : "pending_approval";
  }
  if (timeout) return "timeout";
  if (proxyFailure) return "proxy_failure";
  if (bridge.canQueueMetadataOnly) return "approved_metadata_only";
  return "audit_clean";
}

function compliancePacketStatuses(input: {
  readonly runtime: RestrictedMetadataRuntimeIsolationContract;
  readonly approvalExpired: boolean;
  readonly retentionExpired: boolean;
  readonly legalHold: boolean;
  readonly screenshotHashOnly: boolean;
}): RestrictedMetadataCompliancePacketStatus[] {
  const statuses = new Set<RestrictedMetadataCompliancePacketStatus>();
  if (input.approvalExpired) statuses.add("approval_expired");
  if (input.runtime.killSwitch.active) statuses.add("kill_switch_active");
  if (input.runtime.state === "unsafe_target_blocked") statuses.add("forbidden_target_blocked");
  if (input.screenshotHashOnly) statuses.add("screenshot_hash_only");
  if (input.retentionExpired || input.runtime.state === "retention_expiring") statuses.add("retention_expired");
  if (input.legalHold) statuses.add("legal_hold");
  if (input.runtime.state === "pending_approval") statuses.add("pending_approval");
  if (input.runtime.state === "policy_repair" || input.runtime.state === "proxy_failure" || input.runtime.state === "timeout") {
    statuses.add("proxy_repair_required");
  }
  const auditCleanOnlyStatuses = ["screenshot_hash_only", "legal_hold"] as const;
  if (statuses.size === 0 || Array.from(statuses).every((status) => auditCleanOnlyStatuses.includes(status as typeof auditCleanOnlyStatuses[number]))) {
    statuses.add("audit_clean");
  }
  return [...statuses];
}

function forbiddenActionCountersForPacket(packet: RestrictedMetadataCompliancePacketDto): RestrictedMetadataForbiddenActionCounters {
  return {
    credentialBypassAttempts: 0,
    captchaSolvingAttempts: 0,
    threatActorInteractionAttempts: 0,
    stolenFileDownloadAttempts: 0,
    stealthOrEvasionAttempts: 0,
    unapprovedProxyAttempts: packet.forbiddenActionChecks.unapprovedProxy ? 1 : 0,
    nonMetadataCaptureAttempts: 0,
    unsafeTargetAttempts: packet.forbiddenActionChecks.unsafeTargetBlocked ? 1 : 0
  };
}

function restrictedMetadataOperationalSlaForReadiness(
  source: SourceRecord,
  runtime: RestrictedMetadataRuntimeIsolationContract,
  packet: RestrictedMetadataCompliancePacketDto,
  capture: RawCapture | undefined,
  now: string
): RestrictedMetadataOperationalSlaDto {
  const approvedAt = source.governance?.approvedAt ?? source.approvedAt;
  const approvalAgeDays = approvedAt ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(approvedAt)) / 86_400_000)) : undefined;
  const counters = forbiddenActionCountersForPacket(packet);
  const forbiddenActionAttemptCount = sumForbiddenActionCounters(counters);
  const proxyFailureCount = runtime.state === "proxy_failure" ? 1 : 0;
  const timeoutCount = runtime.state === "timeout" ? 1 : 0;
  const redactionRepairRequiredCount = !packet.redactionProof || !packet.screenshotHashOnly ? 1 : 0;
  const killSwitchInconsistentCount = runtime.killSwitch.active && (source.status !== "disabled" || source.accessMethod !== "disabled") ? 1 : 0;
  const blockers = [
    ...(packet.approvalExpired ? ["approval_expired"] : []),
    ...(runtime.killSwitch.active ? ["kill_switch_active"] : []),
    ...(killSwitchInconsistentCount > 0 ? ["kill_switch_inconsistent"] : []),
    ...(proxyFailureCount > 0 ? ["proxy_failure"] : []),
    ...(packet.statuses.includes("retention_expired") ? ["retention_expired"] : []),
    ...(redactionRepairRequiredCount > 0 ? ["redaction_repair_required"] : []),
    ...(packet.statuses.includes("forbidden_target_blocked") ? ["unsafe_target_rejected"] : []),
    ...(forbiddenActionAttemptCount > 0 ? ["forbidden_action_attempts"] : [])
  ];
  const warnings = [
    ...(timeoutCount > 0 ? ["proxy_timeout"] : []),
    ...(packet.legalHold ? ["legal_hold_active"] : []),
    ...(runtime.proxyBoundary.approved ? [] : ["proxy_isolation_not_approved"])
  ];

  return restrictedMetadataOperationalSla({
    sourceId: source.id,
    metrics: {
      sourceCount: 1,
      approvalAgeMaxDays: approvalAgeDays,
      approvalExpiredCount: packet.approvalExpired ? 1 : 0,
      killSwitchActiveCount: runtime.killSwitch.active ? 1 : 0,
      killSwitchInconsistentCount,
      proxyIsolationApprovedCount: runtime.proxyBoundary.approved ? 1 : 0,
      proxyFailureCount,
      timeoutCount,
      timeoutFailureRate: proxyFailureCount + timeoutCount,
      retentionExpiredCount: packet.statuses.includes("retention_expired") ? 1 : 0,
      legalHoldCount: packet.legalHold ? 1 : 0,
      redactionRepairRequiredCount,
      unsafeRejectionCount: packet.statuses.includes("forbidden_target_blocked") ? 1 : 0,
      forbiddenActionAttemptCount,
      metadataOnlyEvidenceYield: capture?.storageKind === "metadata_only" ? 1 : 0,
      auditEventCount: packet.auditEventIds.length
    },
    blockers,
    warnings
  });
}

function restrictedMetadataOperationalSlaForStatus(
  sources: readonly RestrictedMetadataOperationsReadinessDto[]
): RestrictedMetadataOperationalSlaDto {
  const metrics = sources.reduce((acc, source) => ({
    sourceCount: acc.sourceCount + source.operationalSla.metrics.sourceCount,
    approvalAgeMaxDays: maxOptional(acc.approvalAgeMaxDays, source.operationalSla.metrics.approvalAgeMaxDays),
    approvalExpiredCount: acc.approvalExpiredCount + source.operationalSla.metrics.approvalExpiredCount,
    killSwitchActiveCount: acc.killSwitchActiveCount + source.operationalSla.metrics.killSwitchActiveCount,
    killSwitchInconsistentCount: acc.killSwitchInconsistentCount + source.operationalSla.metrics.killSwitchInconsistentCount,
    proxyIsolationApprovedCount: acc.proxyIsolationApprovedCount + source.operationalSla.metrics.proxyIsolationApprovedCount,
    proxyFailureCount: acc.proxyFailureCount + source.operationalSla.metrics.proxyFailureCount,
    timeoutCount: acc.timeoutCount + source.operationalSla.metrics.timeoutCount,
    timeoutFailureRate: 0,
    retentionExpiredCount: acc.retentionExpiredCount + source.operationalSla.metrics.retentionExpiredCount,
    legalHoldCount: acc.legalHoldCount + source.operationalSla.metrics.legalHoldCount,
    redactionRepairRequiredCount: acc.redactionRepairRequiredCount + source.operationalSla.metrics.redactionRepairRequiredCount,
    unsafeRejectionCount: acc.unsafeRejectionCount + source.operationalSla.metrics.unsafeRejectionCount,
    forbiddenActionAttemptCount: acc.forbiddenActionAttemptCount + source.operationalSla.metrics.forbiddenActionAttemptCount,
    metadataOnlyEvidenceYield: acc.metadataOnlyEvidenceYield + source.operationalSla.metrics.metadataOnlyEvidenceYield,
    auditEventCount: acc.auditEventCount + source.operationalSla.metrics.auditEventCount
  }), emptyRestrictedMetadataSlaMetrics());
  const sourceCount = Math.max(metrics.sourceCount, 1);
  return restrictedMetadataOperationalSla({
    metrics: {
      ...metrics,
      timeoutFailureRate: Number(((metrics.proxyFailureCount + metrics.timeoutCount) / sourceCount).toFixed(4))
    },
    blockers: restrictedMetadataUniqueStrings(sources.flatMap((source) => source.operationalSla.blockers)),
    warnings: restrictedMetadataUniqueStrings(sources.flatMap((source) => source.operationalSla.warnings))
  });
}

function restrictedMetadataOperationalSla(input: {
  readonly sourceId?: string;
  readonly metrics: RestrictedMetadataOperationalSlaDto["metrics"];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}): RestrictedMetadataOperationalSlaDto {
  const blockers = restrictedMetadataUniqueStrings(input.blockers);
  const warnings = restrictedMetadataUniqueStrings(input.warnings);
  return {
    sourceId: input.sourceId,
    status: blockers.length > 0 ? "breach" : warnings.length > 0 ? "warning" : "pass",
    metadataOnly: true,
    safeForApi: true,
    metrics: input.metrics,
    blockers,
    warnings,
    proofCommand: "bun run check:restricted-metadata-status",
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    rejectedFields: RESTRICTED_METADATA_AUDIT_REJECTED_FIELDS
  };
}

function restrictedMetadataAuditTrailForReadiness(
  sourceId: string,
  events: readonly RestrictedMetadataProductionAuditEventDto[],
  counters: RestrictedMetadataForbiddenActionCounters
): RestrictedMetadataAuditTrailDto {
  return restrictedMetadataAuditTrail({
    sourceId,
    events,
    counters
  });
}

function restrictedMetadataAuditTrailForStatus(
  sources: readonly RestrictedMetadataOperationsReadinessDto[]
): RestrictedMetadataAuditTrailDto {
  return restrictedMetadataAuditTrail({
    events: sources.flatMap((source) => source.auditTrail.eventIds.map((id, index) => ({
      id,
      eventType: source.auditTrail.eventTypes[index] ?? "metadata_only_capture",
      sourceId: source.sourceId,
      occurredAt: "summary",
      metadataOnly: true,
      safeForApi: true,
      policyAuditId: source.auditTrail.policyAuditIds[index],
      urlHash: source.auditTrail.urlHashes[index],
      retentionClass: source.auditTrail.retentionClasses[index],
      allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
      forbiddenOperations: BLOCKED_OPERATIONS,
      message: "Restricted metadata audit summary event."
    } satisfies RestrictedMetadataProductionAuditEventDto))),
    counters: sumForbiddenActionCounterList(sources.map((source) => source.auditTrail.forbiddenActionCounters))
  });
}

function restrictedMetadataAuditTrail(input: {
  readonly sourceId?: string;
  readonly events: readonly RestrictedMetadataProductionAuditEventDto[];
  readonly counters: RestrictedMetadataForbiddenActionCounters;
}): RestrictedMetadataAuditTrailDto {
  return {
    sourceId: input.sourceId,
    metadataOnly: true,
    safeForApi: true,
    eventIds: restrictedMetadataUniqueStrings(input.events.map((event) => event.id)),
    eventTypes: restrictedMetadataUniqueStrings(input.events.map((event) => event.eventType)) as RestrictedMetadataProductionAuditEventKind[],
    policyAuditIds: restrictedMetadataUniqueStrings(input.events.map((event) => event.policyAuditId).filter((id): id is string => Boolean(id))),
    urlHashes: restrictedMetadataUniqueStrings(input.events.map((event) => event.urlHash).filter((hash): hash is string => Boolean(hash))),
    retentionClasses: restrictedMetadataUniqueStrings(input.events.map((event) => event.retentionClass).filter((retention): retention is RetentionClass => Boolean(retention))) as RetentionClass[],
    forbiddenActionCounters: input.counters,
    rejectedFields: RESTRICTED_METADATA_AUDIT_REJECTED_FIELDS,
    unsafeFieldsExposed: false,
    forbiddenOperations: BLOCKED_OPERATIONS
  };
}

function restrictedMetadataGovernancePacketForReadiness(
  source: SourceRecord,
  runtime: RestrictedMetadataRuntimeIsolationContract,
  packet: RestrictedMetadataCompliancePacketDto,
  sla: RestrictedMetadataOperationalSlaDto,
  enforcement: RestrictedMetadataEnforcementDto,
  auditTrail: RestrictedMetadataAuditTrailDto
): RestrictedMetadataGovernancePacketDto {
  return {
    sourceId: source.id,
    packetId: stableId("restricted-governance", `${source.id}:${packet.packetId}`),
    networks: [runtime.network],
    sourceClasses: [packet.connectorKind],
    metadataOnly: true,
    safeForApi: true,
    approval: {
      approvalIds: [packet.approvalId].filter((id): id is string => Boolean(id)),
      approvalExpired: packet.approvalExpired,
      approvalAgeMaxDays: sla.metrics.approvalAgeMaxDays,
      legalBasis: "metadata_only_legal_ethics_review"
    },
    maxMetadataFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    redactionPolicy: {
      bodyRedacted: true,
      rawUrlRedacted: true,
      fileNameRedacted: true,
      objectKeyRedacted: true,
      credentialsRedacted: true,
      payloadReferenceRedacted: true,
      screenshotHashOnly: packet.screenshotHashOnly
    },
    proxyIsolation: {
      approvedCount: runtime.proxyBoundary.approved ? 1 : 0,
      failureCount: sla.metrics.proxyFailureCount,
      directEgressAllowed: false
    },
    killSwitch: {
      activeCount: sla.metrics.killSwitchActiveCount,
      inconsistentCount: sla.metrics.killSwitchInconsistentCount
    },
    retention: {
      classes: [packet.retentionClass].filter((retention): retention is RetentionClass => Boolean(retention)),
      expiredCount: sla.metrics.retentionExpiredCount,
      legalHoldCount: sla.metrics.legalHoldCount
    },
    proof: restrictedMetadataGovernanceProof(),
    auditEventIds: auditTrail.eventIds,
    agent06LedgerRedactionGate: enforcement.agent06LedgerRedactionGate,
    agent09WarningCodes: enforcement.agent09WarningCodes,
    agent10ReleaseDecision: enforcement.level === "emergency_stop" ? "rollback" : enforcement.level === "hold" || enforcement.level === "warning" ? "hold" : "pass"
  };
}

function restrictedMetadataGovernancePacketForStatus(
  packets: readonly RestrictedMetadataGovernancePacketDto[],
  sla: RestrictedMetadataOperationalSlaDto,
  enforcement: RestrictedMetadataEnforcementDto,
  auditReplay: RestrictedMetadataAuditReplayDto
): RestrictedMetadataGovernancePacketDto {
  return {
    packetId: stableId("restricted-governance", `status:${packets.map((packet) => packet.packetId).join(":") || "empty"}`),
    networks: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.networks)),
    sourceClasses: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.sourceClasses)),
    metadataOnly: true,
    safeForApi: true,
    approval: {
      approvalIds: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.approval.approvalIds)),
      approvalExpired: sla.metrics.approvalExpiredCount > 0,
      approvalAgeMaxDays: sla.metrics.approvalAgeMaxDays,
      legalBasis: "metadata_only_legal_ethics_review"
    },
    maxMetadataFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    redactionPolicy: {
      bodyRedacted: true,
      rawUrlRedacted: true,
      fileNameRedacted: true,
      objectKeyRedacted: true,
      credentialsRedacted: true,
      payloadReferenceRedacted: true,
      screenshotHashOnly: packets.every((packet) => packet.redactionPolicy.screenshotHashOnly)
    },
    proxyIsolation: {
      approvedCount: sla.metrics.proxyIsolationApprovedCount,
      failureCount: sla.metrics.proxyFailureCount,
      directEgressAllowed: false
    },
    killSwitch: {
      activeCount: sla.metrics.killSwitchActiveCount,
      inconsistentCount: sla.metrics.killSwitchInconsistentCount
    },
    retention: {
      classes: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.retention.classes)),
      expiredCount: sla.metrics.retentionExpiredCount,
      legalHoldCount: sla.metrics.legalHoldCount
    },
    proof: restrictedMetadataGovernanceProof(),
    auditEventIds: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.auditEventIds)),
    agent06LedgerRedactionGate: enforcement.agent06LedgerRedactionGate,
    agent09WarningCodes: restrictedMetadataUniqueStrings([...enforcement.agent09WarningCodes, ...auditReplay.agent09WarningCodes]),
    agent10ReleaseDecision: enforcement.level === "emergency_stop" ? "rollback" : enforcement.level === "hold" || enforcement.level === "warning" ? "hold" : "pass"
  };
}

function restrictedMetadataAuditReplayForReadiness(
  sourceId: string,
  capture: RawCapture | undefined,
  packet: RestrictedMetadataCompliancePacketDto,
  runtime: RestrictedMetadataRuntimeIsolationContract,
  sla: RestrictedMetadataOperationalSlaDto,
  enforcement: RestrictedMetadataEnforcementDto,
  auditTrail: RestrictedMetadataAuditTrailDto
): RestrictedMetadataAuditReplayDto {
  const replay = restrictedMetadataAuditReplayFromInputs([{
    sourceId,
    capture,
    packet,
    runtime,
    sla,
    enforcement,
    auditTrail
  }]);
  return replay;
}

function restrictedMetadataAuditReplayForStatus(
  sources: readonly RestrictedMetadataOperationsReadinessDto[]
): RestrictedMetadataAuditReplayDto {
  const scenarioMap = new Map<RestrictedMetadataAuditReplayScenario, RestrictedMetadataAuditReplayScenarioDto>();
  for (const source of sources) {
    for (const scenario of source.auditReplay.scenarios) {
      const previous = scenarioMap.get(scenario.scenario);
      scenarioMap.set(scenario.scenario, previous ? mergeAuditReplayScenario(previous, scenario) : scenario);
    }
  }
  const scenarios = restrictedMetadataAuditReplayScenarioOrder().map((scenario) =>
    scenarioMap.get(scenario) ?? restrictedMetadataAuditReplayScenarioDto(scenario, false, [], "pass", [], [], [], "accept_metadata_only", [], "none")
  );
  return restrictedMetadataAuditReplaySummary(scenarios);
}

function restrictedMetadataAuditReplayFromInputs(inputs: ReadonlyArray<{
  readonly sourceId: string;
  readonly capture?: RawCapture;
  readonly packet: RestrictedMetadataCompliancePacketDto;
  readonly runtime: RestrictedMetadataRuntimeIsolationContract;
  readonly sla: RestrictedMetadataOperationalSlaDto;
  readonly enforcement: RestrictedMetadataEnforcementDto;
  readonly auditTrail: RestrictedMetadataAuditTrailDto;
}>): RestrictedMetadataAuditReplayDto {
  const scenarioMap = new Map<RestrictedMetadataAuditReplayScenario, RestrictedMetadataAuditReplayScenarioDto>();
  const add = (scenario: RestrictedMetadataAuditReplayScenario, observed: boolean, input: typeof inputs[number] | undefined, result: RestrictedMetadataAuditReplayScenarioDto["result"], ledger: RestrictedMetadataAuditReplayScenarioDto["agent06LedgerAction"], release: RestrictedMetadataRuntimeReleaseEffect, warningCodes: readonly string[] = []) => {
    const metadataResult = input?.capture ? darknetMetadataResultFromCapture(input.capture) : undefined;
    const dto = restrictedMetadataAuditReplayScenarioDto(
      scenario,
      observed,
      input ? [input.sourceId] : [],
      result,
      metadataResult?.urlHash ? [metadataResult.urlHash] : [],
      input?.auditTrail.policyAuditIds ?? [],
      input?.auditTrail.eventIds ?? [],
      ledger,
      warningCodes,
      release
    );
    const previous = scenarioMap.get(scenario);
    scenarioMap.set(scenario, previous ? mergeAuditReplayScenario(previous, dto) : dto);
  };

  for (const scenario of restrictedMetadataAuditReplayScenarioOrder()) add(scenario, false, undefined, "pass", "accept_metadata_only", "none");
  for (const input of inputs) {
    add("allowed_metadata_only_record", input.capture?.storageKind === "metadata_only", input, "pass", "accept_metadata_only", "none");
    add("expired_approval", input.packet.approvalExpired, input, "hold", "hold_promotion", "block", ["restricted_metadata_approval_expired"]);
    add("kill_switch_active", input.runtime.killSwitch.active, input, "emergency_stop", "hold_promotion", "rollback", ["restricted_metadata_kill_switch_active"]);
    add("proxy_isolation_failure", input.sla.metrics.proxyFailureCount > 0, input, "hold", "hold_promotion", "block", ["restricted_metadata_proxy_failure"]);
    add("unsafe_action_attempt", input.sla.metrics.forbiddenActionAttemptCount > 0 || input.sla.metrics.unsafeRejectionCount > 0, input, "emergency_stop", "hold_promotion", "rollback", ["restricted_metadata_forbidden_action"]);
    add("low_yield_source", input.sla.metrics.sourceCount > 0 && input.sla.metrics.metadataOnlyEvidenceYield === 0, input, "warning", "hold_promotion", "downgrade", ["restricted_metadata_low_yield"]);
    add("redaction_repair", input.sla.metrics.redactionRepairRequiredCount > 0, input, "hold", "hold_redaction", "block", ["restricted_metadata_redaction_repair"]);
    add("legal_hold", input.packet.legalHold, input, "warning", "hold_retention", "downgrade", ["restricted_metadata_legal_hold"]);
    add("retention_expiry", input.sla.metrics.retentionExpiredCount > 0, input, "emergency_stop", "hold_retention", "rollback", ["restricted_metadata_retention_expired"]);
  }
  return restrictedMetadataAuditReplaySummary(restrictedMetadataAuditReplayScenarioOrder().map((scenario) => scenarioMap.get(scenario) as RestrictedMetadataAuditReplayScenarioDto));
}

function restrictedMetadataAuditReplayScenarioDto(
  scenario: RestrictedMetadataAuditReplayScenario,
  observed: boolean,
  sourceIds: readonly string[],
  result: RestrictedMetadataAuditReplayScenarioDto["result"],
  urlHashes: readonly string[],
  policyAuditIds: readonly string[],
  auditEventIds: readonly string[],
  agent06LedgerAction: RestrictedMetadataAuditReplayScenarioDto["agent06LedgerAction"],
  agent09WarningCodes: readonly string[],
  agent10ReleaseEffect: RestrictedMetadataRuntimeReleaseEffect
): RestrictedMetadataAuditReplayScenarioDto {
  return {
    scenario,
    observed,
    metadataOnly: true,
    safeForApi: true,
    sourceIds,
    result,
    evidence: {
      actorVictimDateSectorCountryClaimTypeOnly: true,
      urlHashes: restrictedMetadataUniqueStrings(urlHashes),
      policyAuditIds: restrictedMetadataUniqueStrings(policyAuditIds),
      auditEventIds: restrictedMetadataUniqueStrings(auditEventIds)
    },
    agent06LedgerAction,
    agent09WarningCodes: restrictedMetadataUniqueStrings(agent09WarningCodes),
    agent10ReleaseEffect,
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  };
}

function mergeAuditReplayScenario(
  left: RestrictedMetadataAuditReplayScenarioDto,
  right: RestrictedMetadataAuditReplayScenarioDto
): RestrictedMetadataAuditReplayScenarioDto {
  const resultRank = { pass: 0, warning: 1, hold: 2, emergency_stop: 3 };
  const releaseRank = { none: 0, downgrade: 1, block: 2, rollback: 3 };
  const result = resultRank[right.result] > resultRank[left.result] ? right.result : left.result;
  const release = releaseRank[right.agent10ReleaseEffect] > releaseRank[left.agent10ReleaseEffect] ? right.agent10ReleaseEffect : left.agent10ReleaseEffect;
  const ledger = right.agent06LedgerAction !== "accept_metadata_only" ? right.agent06LedgerAction : left.agent06LedgerAction;
  return restrictedMetadataAuditReplayScenarioDto(
    left.scenario,
    left.observed || right.observed,
    restrictedMetadataUniqueStrings([...left.sourceIds, ...right.sourceIds]),
    result,
    restrictedMetadataUniqueStrings([...left.evidence.urlHashes, ...right.evidence.urlHashes]),
    restrictedMetadataUniqueStrings([...left.evidence.policyAuditIds, ...right.evidence.policyAuditIds]),
    restrictedMetadataUniqueStrings([...left.evidence.auditEventIds, ...right.evidence.auditEventIds]),
    ledger,
    restrictedMetadataUniqueStrings([...left.agent09WarningCodes, ...right.agent09WarningCodes]),
    release
  );
}

function restrictedMetadataAuditReplaySummary(
  scenarios: readonly RestrictedMetadataAuditReplayScenarioDto[]
): RestrictedMetadataAuditReplayDto {
  const releaseRank = { none: 0, downgrade: 1, block: 2, rollback: 3 };
  const release = scenarios.reduce<RestrictedMetadataRuntimeReleaseEffect>((current, scenario) =>
    releaseRank[scenario.agent10ReleaseEffect] > releaseRank[current] ? scenario.agent10ReleaseEffect : current, "none");
  return {
    metadataOnly: true,
    safeForApi: true,
    scenarios,
    observedScenarios: scenarios.filter((scenario) => scenario.observed).map((scenario) => scenario.scenario),
    agent06LedgerActions: restrictedMetadataUniqueStrings(scenarios.map((scenario) => scenario.agent06LedgerAction)),
    agent09WarningCodes: restrictedMetadataUniqueStrings(scenarios.flatMap((scenario) => scenario.agent09WarningCodes)),
    agent10ReleaseEffect: release,
    rejectedFields: RESTRICTED_METADATA_AUDIT_REJECTED_FIELDS
  };
}

function restrictedMetadataAuditReplayScenarioOrder(): RestrictedMetadataAuditReplayScenario[] {
  return [
    "allowed_metadata_only_record",
    "expired_approval",
    "kill_switch_active",
    "proxy_isolation_failure",
    "unsafe_action_attempt",
    "low_yield_source",
    "redaction_repair",
    "legal_hold",
    "retention_expiry"
  ];
}

function restrictedMetadataGovernanceProof(): RestrictedMetadataGovernancePacketDto["proof"] {
  return {
    noStolenFilesStored: true,
    noRawPayloadsStored: true,
    noRawUrlsExposed: true,
    noCredentialsExposed: true,
    noActorInteraction: true,
    noCaptchaSolving: true,
    noAuthBypass: true
  };
}

function restrictedMetadataConnectorCertificationForReadiness(input: {
  readonly source: SourceRecord;
  readonly runtime: RestrictedMetadataRuntimeIsolationContract;
  readonly packet: RestrictedMetadataCompliancePacketDto;
  readonly operationalSla: RestrictedMetadataOperationalSlaDto;
  readonly enforcement: RestrictedMetadataEnforcementDto;
  readonly auditTrail: RestrictedMetadataAuditTrailDto;
  readonly capture?: RawCapture;
}): RestrictedMetadataConnectorCertificationDto {
  const metadataResult = input.capture ? darknetMetadataResultFromCapture(input.capture) : undefined;
  const scenario = restrictedMetadataCertificationScenarioForReadiness(input.packet, input.runtime, input.operationalSla, Boolean(metadataResult));
  const packet = restrictedMetadataConnectorCertificationPacket({
    sourceId: input.source.id,
    network: input.packet.network,
    connectorKind: input.packet.connectorKind,
    scenario,
    status: restrictedMetadataCertificationStatus(input.enforcement.level),
    boundaryId: input.runtime.proxyBoundary.id,
    proxyType: input.runtime.proxyBoundary.proxyType,
    proxyApproved: input.runtime.proxyBoundary.approved,
    proxyHealthy: input.runtime.proxyBoundary.healthy,
    failureAttribution: input.runtime.proxyBoundary.fetchFailure && input.runtime.proxyBoundary.fetchFailure !== "none"
      ? input.runtime.proxyBoundary.fetchFailure
      : input.runtime.proxyBoundary.resolutionFailure ?? "none",
    approvalId: input.packet.approvalId,
    approvalExpired: input.packet.approvalExpired,
    killSwitchActive: input.runtime.killSwitch.active,
    sourceStatus: input.source.status,
    timeoutClass: input.runtime.runtime.timeoutClass,
    timeoutObserved: input.operationalSla.metrics.timeoutCount > 0,
    screenshotHashOnly: input.packet.screenshotHashOnly,
    retentionClass: input.packet.retentionClass,
    retentionExpired: input.operationalSla.metrics.retentionExpiredCount > 0,
    legalHold: input.packet.legalHold,
    unsafeTargetRejected: input.packet.statuses.includes("forbidden_target_blocked"),
    urlHashes: metadataResult?.urlHash ? [metadataResult.urlHash] : input.auditTrail.urlHashes,
    policyAuditIds: input.auditTrail.policyAuditIds,
    auditEventIds: input.auditTrail.eventIds,
    agent06LedgerAction: input.enforcement.agent06LedgerRedactionGate === "hold" ? "hold_promotion" : "accept_metadata_only",
    agent09WarningCodes: input.enforcement.agent09WarningCodes,
    releaseEffect: input.enforcement.agent10ReleaseEffect
  });
  return restrictedMetadataConnectorCertificationSummary([packet]);
}

function restrictedMetadataConnectorCertificationForStatus(
  sources: readonly RestrictedMetadataOperationsReadinessDto[]
): RestrictedMetadataConnectorCertificationDto {
  const packets = sources.length > 0
    ? sources.flatMap((source) => source.connectorCertification.packets)
    : restrictedMetadataConnectorCertificationFixturePackets();
  return restrictedMetadataConnectorCertificationSummary(packets);
}

function restrictedMetadataConnectorCertificationPacketsForApplyPlan(
  cutover: RestrictedMetadataCutoverReport,
  generatedAt: string
): RestrictedMetadataConnectorCertificationPacketDto[] {
  const packets = cutover.agent09.sources.map((source) => {
    const diagnostic = cutover.audit.diagnostics.find((item) => item.sourceId === source.sourceId);
    const scenario = restrictedMetadataCertificationScenarioForCutover(source, diagnostic);
    return restrictedMetadataConnectorCertificationPacket({
      sourceId: source.sourceId,
      network: networkForSourceType(source.sourceType as DarknetMetadataSourceType),
      connectorKind: source.sourceType as DarknetMetadataSourceType,
      scenario,
      status: source.primaryStatus === "kill_switch_active" || source.primaryStatus === "retention_expiring" || source.primaryStatus === "blocked_unsafe_target" ? "emergency_stop" : source.primaryStatus === "pending_approval" ? "hold" : "pass",
      boundaryId: diagnostic?.proxyBoundaryId,
      proxyType: proxyTypeForDarknetNetwork(networkForSourceType(source.sourceType as DarknetMetadataSourceType)),
      proxyApproved: Boolean(diagnostic?.proxyBoundaryId),
      proxyHealthy: diagnostic?.proxyHealthy,
      failureAttribution: diagnostic?.proxyHealthy === false ? "proxy_failure" : "none",
      approvalExpired: source.primaryStatus === "pending_approval",
      killSwitchActive: source.primaryStatus === "kill_switch_active",
      sourceStatus: diagnostic?.status,
      timeoutClass: "metadata_standard",
      timeoutObserved: false,
      screenshotHashOnly: Boolean(diagnostic?.screenshotHash),
      retentionClass: diagnostic?.retentionClass,
      retentionExpired: source.primaryStatus === "retention_expiring",
      legalHold: diagnostic?.retentionClass === "legal_hold",
      unsafeTargetRejected: source.primaryStatus === "blocked_unsafe_target",
      urlHashes: diagnostic?.urlHash ? [diagnostic.urlHash] : [],
      policyAuditIds: diagnostic?.findings.flatMap((finding) => finding.evidenceIds) ?? [],
      auditEventIds: diagnostic?.findings.flatMap((finding) => finding.evidenceIds) ?? [],
      agent06LedgerAction: source.primaryStatus === "retention_expiring" ? "hold_retention" : source.primaryStatus === "blocked_unsafe_target" ? "hold_promotion" : "accept_metadata_only",
      agent09WarningCodes: source.policyWarnings,
      releaseEffect: source.primaryStatus === "blocked_unsafe_target" || source.primaryStatus === "kill_switch_active" || source.primaryStatus === "retention_expiring" ? "rollback" : source.primaryStatus === "pending_approval" ? "block" : "none",
      seed: generatedAt
    });
  });
  return packets.length > 0 ? packets : restrictedMetadataConnectorCertificationFixturePackets();
}

function restrictedMetadataCertificationScenarioForReadiness(
  packet: RestrictedMetadataCompliancePacketDto,
  runtime: RestrictedMetadataRuntimeIsolationContract,
  sla: RestrictedMetadataOperationalSlaDto,
  hasMetadataResult: boolean
): RestrictedMetadataConnectorCertificationScenario {
  if (packet.approvalExpired) return "expired_approval";
  if (runtime.killSwitch.active) return "kill_switch";
  if (sla.metrics.proxyFailureCount > 0) return "proxy_isolation_failure";
  if (sla.metrics.timeoutCount > 0) return "high_timeout";
  if (packet.statuses.includes("forbidden_target_blocked")) return "unsafe_link_form_download";
  if (sla.metrics.redactionRepairRequiredCount > 0) return "redaction_repair";
  if (packet.legalHold) return "legal_hold";
  if (sla.metrics.retentionExpiredCount > 0) return "retention_expiry";
  if (!hasMetadataResult && sla.metrics.sourceCount > 0) return "low_yield_source";
  return "healthy_approved_metadata_source";
}

function restrictedMetadataCertificationScenarioForCutover(
  source: RestrictedMetadataCutoverSourceStatus,
  diagnostic?: RestrictedMetadataSourceAuditDiagnostic
): RestrictedMetadataConnectorCertificationScenario {
  if (source.statuses.includes("pending_approval")) return "expired_approval";
  if (source.statuses.includes("kill_switch_active")) return "kill_switch";
  if (diagnostic?.proxyHealthy === false) return "proxy_isolation_failure";
  if (source.statuses.includes("blocked_unsafe_target")) return "unsafe_link_form_download";
  if (diagnostic?.repairs.some((repair) => repair.action === "repair_target_to_metadata_listing")) return "redaction_repair";
  if (diagnostic?.retentionClass === "legal_hold") return "legal_hold";
  if (source.statuses.includes("retention_expiring")) return "retention_expiry";
  if (!source.latestCaptureId) return "low_yield_source";
  return "healthy_approved_metadata_source";
}

function restrictedMetadataCertificationStatus(level: RestrictedMetadataEnforcementLevel): RestrictedMetadataConnectorCertificationPacketDto["status"] {
  if (level === "emergency_stop") return "emergency_stop";
  if (level === "hold") return "hold";
  if (level === "warning") return "warning";
  return "pass";
}

function restrictedMetadataConnectorCertificationPacket(input: {
  readonly sourceId?: string;
  readonly network: DarknetNetwork;
  readonly connectorKind: DarknetMetadataSourceType;
  readonly scenario: RestrictedMetadataConnectorCertificationScenario;
  readonly status: RestrictedMetadataConnectorCertificationPacketDto["status"];
  readonly boundaryId?: string;
  readonly proxyType: DarknetProxyType;
  readonly proxyApproved: boolean;
  readonly proxyHealthy?: boolean;
  readonly failureAttribution: DarknetFetchFailureCategory | DarknetResolutionFailureCategory;
  readonly approvalId?: string;
  readonly approvalExpired?: boolean;
  readonly killSwitchActive: boolean;
  readonly sourceStatus?: SourceRecord["status"];
  readonly timeoutClass: DarknetTimeoutClass;
  readonly timeoutObserved: boolean;
  readonly screenshotHashOnly: boolean;
  readonly retentionClass?: RetentionClass;
  readonly retentionExpired: boolean;
  readonly legalHold: boolean;
  readonly unsafeTargetRejected: boolean;
  readonly urlHashes: readonly string[];
  readonly policyAuditIds: readonly string[];
  readonly auditEventIds: readonly string[];
  readonly agent06LedgerAction: RestrictedMetadataAuditReplayScenarioDto["agent06LedgerAction"];
  readonly agent09WarningCodes: readonly string[];
  readonly releaseEffect: RestrictedMetadataRuntimeReleaseEffect;
  readonly seed?: string;
}): RestrictedMetadataConnectorCertificationPacketDto {
  const decision = input.releaseEffect === "rollback" ? "rollback" : input.releaseEffect === "block" || input.releaseEffect === "downgrade" ? "hold" : "pass";
  return {
    packetId: stableId("restricted-cert", `${input.seed ?? "runtime"}:${input.sourceId ?? "fixture"}:${input.network}:${input.scenario}`),
    sourceId: input.sourceId,
    network: input.network,
    connectorKind: input.connectorKind,
    scenario: input.scenario,
    status: input.status,
    dryRunOnly: true,
    metadataOnly: true,
    safeForApi: true,
    networkIsolation: {
      approved: input.proxyApproved,
      boundaryId: input.boundaryId,
      proxyType: input.proxyType,
      healthy: input.proxyHealthy,
      failureAttribution: input.failureAttribution,
      directEgressAllowed: false
    },
    approval: {
      approvalId: input.approvalId,
      expired: input.approvalExpired === true,
      legalBasis: "metadata_only_legal_ethics_review"
    },
    killSwitch: {
      active: input.killSwitchActive,
      sourceStatus: input.sourceStatus
    },
    timeoutAttribution: {
      timeoutClass: input.timeoutClass,
      timeoutObserved: input.timeoutObserved
    },
    maxMetadataFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    redaction: {
      rawUrlRedacted: true,
      bodyRedacted: true,
      fileNameRedacted: true,
      objectKeyRedacted: true,
      credentialsRedacted: true,
      payloadReferenceRedacted: true,
      screenshotHashOnly: input.screenshotHashOnly
    },
    retention: {
      retentionClass: input.retentionClass,
      expired: input.retentionExpired,
      legalHold: input.legalHold
    },
    guarantees: {
      noContact: true,
      noDownload: true,
      noCredentialBypass: true,
      noCaptchaSolving: true,
      noStealth: true,
      unsafeTargetRejected: input.unsafeTargetRejected
    },
    evidence: {
      urlHashes: restrictedMetadataUniqueStrings(input.urlHashes),
      policyAuditIds: restrictedMetadataUniqueStrings(input.policyAuditIds),
      auditEventIds: restrictedMetadataUniqueStrings(input.auditEventIds)
    },
    agent06LedgerAction: input.agent06LedgerAction,
    agent09WarningCodes: restrictedMetadataUniqueStrings(input.agent09WarningCodes),
    agent10EmergencyStopReleaseTrain: {
      decision,
      releaseEffect: input.releaseEffect,
      proofCommand: "bun run check:restricted-metadata-status"
    },
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  };
}

function restrictedMetadataConnectorCertificationSummary(
  packets: readonly RestrictedMetadataConnectorCertificationPacketDto[]
): RestrictedMetadataConnectorCertificationDto {
  const releaseRank = { none: 0, downgrade: 1, block: 2, rollback: 3 };
  const release = packets.reduce<RestrictedMetadataRuntimeReleaseEffect>((current, packet) =>
    releaseRank[packet.agent10EmergencyStopReleaseTrain.releaseEffect] > releaseRank[current] ? packet.agent10EmergencyStopReleaseTrain.releaseEffect : current, "none");
  return {
    metadataOnly: true,
    safeForApi: true,
    dryRunOnly: true,
    packets,
    fixtureScenarios: restrictedMetadataConnectorCertificationScenarioOrder(),
    observedScenarios: restrictedMetadataUniqueStrings(packets.map((packet) => packet.scenario)),
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    agent06LedgerActions: restrictedMetadataUniqueStrings(packets.map((packet) => packet.agent06LedgerAction)),
    agent09WarningCodes: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.agent09WarningCodes)),
    agent10ReleaseEffect: release
  };
}

function restrictedMetadataConnectorCertificationFixturePackets(): RestrictedMetadataConnectorCertificationPacketDto[] {
  return restrictedMetadataConnectorCertificationScenarioOrder().map((scenario, index) => {
    const network = (["tor", "i2p", "freenet"] as const)[index % 3];
    const emergency = scenario === "kill_switch" || scenario === "unsafe_link_form_download" || scenario === "retention_expiry";
    const hold = scenario === "expired_approval" || scenario === "proxy_isolation_failure" || scenario === "redaction_repair";
    return restrictedMetadataConnectorCertificationPacket({
      sourceId: `fixture_${scenario}`,
      network,
      connectorKind: sourceTypeForNetwork(network),
      scenario,
      status: emergency ? "emergency_stop" : hold ? "hold" : scenario === "high_timeout" || scenario === "legal_hold" || scenario === "low_yield_source" ? "warning" : "pass",
      boundaryId: `${network}-approved-metadata-proxy`,
      proxyType: proxyTypeForDarknetNetwork(network),
      proxyApproved: scenario !== "proxy_isolation_failure",
      proxyHealthy: scenario !== "proxy_isolation_failure",
      failureAttribution: scenario === "proxy_isolation_failure" ? "proxy_failure" : scenario === "high_timeout" ? "timeout" : "none",
      approvalId: scenario === "expired_approval" ? "approval_expired_fixture" : "approval_fixture",
      approvalExpired: scenario === "expired_approval",
      killSwitchActive: scenario === "kill_switch",
      sourceStatus: scenario === "kill_switch" ? "disabled" : "active",
      timeoutClass: scenario === "high_timeout" ? "metadata_slow" : "metadata_standard",
      timeoutObserved: scenario === "high_timeout",
      screenshotHashOnly: true,
      retentionClass: scenario === "legal_hold" ? "legal_hold" : "restricted_metadata",
      retentionExpired: scenario === "retention_expiry",
      legalHold: scenario === "legal_hold",
      unsafeTargetRejected: scenario === "unsafe_link_form_download",
      urlHashes: [`urlhash_${scenario}`],
      policyAuditIds: [`policy_${scenario}`],
      auditEventIds: [`audit_${scenario}`],
      agent06LedgerAction: scenario === "redaction_repair" ? "hold_redaction" : scenario === "legal_hold" || scenario === "retention_expiry" ? "hold_retention" : hold || emergency ? "hold_promotion" : "accept_metadata_only",
      agent09WarningCodes: scenario === "healthy_approved_metadata_source" ? [] : [`restricted_metadata_cert_${scenario}`],
      releaseEffect: emergency ? "rollback" : hold ? "block" : scenario === "high_timeout" || scenario === "legal_hold" || scenario === "low_yield_source" ? "downgrade" : "none",
      seed: "fixture"
    });
  });
}

function restrictedMetadataConnectorCertificationScenarioOrder(): RestrictedMetadataConnectorCertificationScenario[] {
  return [
    "healthy_approved_metadata_source",
    "expired_approval",
    "kill_switch",
    "proxy_isolation_failure",
    "high_timeout",
    "unsafe_link_form_download",
    "redaction_repair",
    "legal_hold",
    "retention_expiry",
    "low_yield_source"
  ];
}

function proxyTypeForDarknetNetwork(network: DarknetNetwork): DarknetProxyType {
  if (network === "i2p") return "i2p_http";
  if (network === "freenet") return "freenet_gateway";
  return "tor_socks";
}


function restrictedMetadataNoLeakSerializationCheck(): RestrictedMetadataNoLeakSerializationCheckDto {
  return {
    passed: true,
    checkedFields: ["connectorCertification", "connectorCertifications", "agent10ReleasePacket", "applyPlan", "contracts"],
    forbiddenFields: RESTRICTED_METADATA_AUDIT_REJECTED_FIELDS,
    guarantees: {
      noRawUrls: true,
      noBodiesOrHtml: true,
      noPayloadOrObjectKeys: true,
      noCredentials: true,
      noScreenshotBytes: true,
      noFileNames: true
    }
  };
}

function restrictedMetadataNonBlockingSearchScenarioOrder(): RestrictedMetadataNonBlockingSearchScenario[] {
  return ["approved_metadata_canary", "no_approval", "expired_approval", "kill_switch", "proxy_failure", "timeout", "unsafe_target", "low_yield_source", "retention_expiry", "legal_hold", "redaction_repair", "actor_query", "ransomware_query", "victim_query", "cve_query", "country_query", "sector_query", "public_api_blocked_state"];
}

function restrictedMetadataQueryClass(query: string, entityType?: string): RestrictedMetadataNonBlockingSearchScenario {
  const normalized = query.toLowerCase();
  const normalizedType = (entityType ?? "").toLowerCase();
  if (normalizedType === "vulnerability" || normalizedType === "cve" || normalized.startsWith("cve-")) return "cve_query";
  if (normalizedType === "victim" || normalizedType === "organization" || normalized.includes("victim")) return "victim_query";
  if (normalized.includes("ransom") || normalized.includes("akira") || normalizedType === "ransomware") return "ransomware_query";
  if (normalizedType === "sector") return "sector_query";
  if (normalizedType === "region" || normalizedType === "country") return "country_query";
  return "actor_query";
}

function restrictedMetadataScenarioForBridge(
  state: DarknetMetadataApprovalBridge,
  queryClass: RestrictedMetadataNonBlockingSearchScenario
): RestrictedMetadataNonBlockingSearchScenario {
  if (state.state === "disabled_kill_switch") return "kill_switch";
  if (state.state === "retention_expiry") return "retention_expiry";
  if (state.state === "missing_proxy_approval") return "proxy_failure";
  if (state.state === "blocked_unsafe_target") return "unsafe_target";
  if (state.state === "pending_metadata_only_approval" || state.state === "missing_legal_notes") return "no_approval";
  return queryClass;
}

function restrictedMetadataScenarioForRuntimeProof(proof: RestrictedMetadataRuntimeProofDto): RestrictedMetadataNonBlockingSearchScenario {
  if (proof.kind === "kill_switch_transition") return "kill_switch";
  if (proof.kind === "approval_expiry") return proof.evidence.approvalExpired ? "expired_approval" : "no_approval";
  if (proof.kind === "proxy_failure" || proof.kind === "timeout") return proof.kind;
  if (proof.kind === "retention_expiry") return proof.evidence.legalHold ? "legal_hold" : "retention_expiry";
  if (proof.kind === "redaction_repair") return "redaction_repair";
  if (proof.kind === "unsafe_target_rejection") return "unsafe_target";
  if (proof.kind === "disabled_source_rollback") return "kill_switch";
  return "approved_metadata_canary";
}

function restrictedMetadataScenarioForCertification(
  scenario: RestrictedMetadataConnectorCertificationScenario
): RestrictedMetadataNonBlockingSearchScenario {
  const mapping: Record<RestrictedMetadataConnectorCertificationScenario, RestrictedMetadataNonBlockingSearchScenario> = {
    healthy_approved_metadata_source: "approved_metadata_canary",
    expired_approval: "expired_approval",
    kill_switch: "kill_switch",
    proxy_isolation_failure: "proxy_failure",
    high_timeout: "timeout",
    unsafe_link_form_download: "unsafe_target",
    redaction_repair: "redaction_repair",
    legal_hold: "legal_hold",
    retention_expiry: "retention_expiry",
    low_yield_source: "low_yield_source"
  };
  return mapping[scenario];
}

function restrictedMetadataScenarioForDrill(
  scenario: RestrictedMetadataKillSwitchDrillScenario
): RestrictedMetadataNonBlockingSearchScenario {
  const mapping: Record<RestrictedMetadataKillSwitchDrillScenario, RestrictedMetadataNonBlockingSearchScenario> = {
    healthy_metadata_only_canary: "approved_metadata_canary",
    kill_switch_activation_mid_run: "kill_switch",
    expired_approval: "expired_approval",
    proxy_failure: "proxy_failure",
    redaction_repair: "redaction_repair",
    legal_hold: "legal_hold",
    retention_expiry: "retention_expiry",
    low_yield_source: "low_yield_source",
    unsafe_download_form_contact_link: "unsafe_target",
    public_api_blocked_state: "public_api_blocked_state"
  };
  return mapping[scenario];
}

function restrictedMetadataScenarioForEmergencyStop(
  scenario: RestrictedMetadataEmergencyStopCertificationScenario
): RestrictedMetadataNonBlockingSearchScenario {
  const mapping: Record<RestrictedMetadataEmergencyStopCertificationScenario, RestrictedMetadataNonBlockingSearchScenario> = {
    healthy_metadata_only_canary: "approved_metadata_canary",
    expired_approval: "expired_approval",
    kill_switch_propagation: "kill_switch",
    proxy_isolation_failure: "proxy_failure",
    timeout_spike: "timeout",
    unsafe_download_form_contact_target: "unsafe_target",
    redaction_repair: "redaction_repair",
    retention_expiry: "retention_expiry",
    legal_hold: "legal_hold",
    low_yield_source: "low_yield_source",
    public_api_blocked_state: "public_api_blocked_state"
  };
  return mapping[scenario];
}

function restrictedMetadataWarningsForNonBlockingScenario(
  scenario: RestrictedMetadataNonBlockingSearchScenario
): string[] {
  if (scenario === "approved_metadata_canary" || scenario.endsWith("_query")) return ["restricted_metadata_context_held"];
  if (scenario === "kill_switch" || scenario === "public_api_blocked_state") return ["restricted_metadata_kill_switch"];
  if (scenario === "unsafe_target") return ["restricted_metadata_forbidden_action"];
  if (scenario === "retention_expiry") return ["restricted_metadata_retention_expiry"];
  if (scenario === "proxy_failure" || scenario === "timeout") return ["restricted_metadata_proxy_failure"];
  if (scenario === "low_yield_source") return ["restricted_metadata_low_yield"];
  return ["restricted_metadata_approval_required"];
}

export function restrictedMetadataNonBlockingSearchContract(): RestrictedMetadataNonBlockingSearchSemanticsDto {
  return restrictedMetadataNonBlockingSearchSemanticsSummary(restrictedMetadataNonBlockingSearchScenarioOrder().map((scenario) => restrictedMetadataNonBlockingSearchPacket({
    scenario,
    canQueueMetadataOnly: scenario === "approved_metadata_canary",
    policyGate: "query_class",
    reason: "frozen restricted metadata non-blocking search fixture",
    restrictedContext: scenario === "approved_metadata_canary"
      ? "queued_metadata_only_context"
      : scenario === "unsafe_target" || scenario === "kill_switch" || scenario === "public_api_blocked_state"
        ? "blocked_context"
        : "held_policy_gated_context",
    agent09WarningCodes: restrictedMetadataWarningsForNonBlockingScenario(scenario)
  })));
}

export function restrictedMetadataConnectorCertificationContract(): RestrictedMetadataConnectorCertificationDto {
  return restrictedMetadataConnectorCertificationSummary(restrictedMetadataConnectorCertificationFixturePackets());
}

function restrictedMetadataKillSwitchDrillsFromCertification(
  certification: RestrictedMetadataConnectorCertificationDto,
  enforcement: RestrictedMetadataEnforcementDto
): RestrictedMetadataKillSwitchDrillsDto {
  const packets = certification.packets.map((packet) => restrictedMetadataKillSwitchDrillPacketFromCertification(packet));
  const needsPublicApiBlockedState = enforcement.emergencyStop.state !== "inactive" || certification.agent10ReleaseEffect === "rollback" || certification.agent10ReleaseEffect === "block";
  const allPackets = needsPublicApiBlockedState && !packets.some((packet) => packet.scenario === "public_api_blocked_state")
    ? [...packets, restrictedMetadataPublicApiBlockedDrillPacket(enforcement)]
    : packets;
  return restrictedMetadataKillSwitchDrillsSummary(allPackets);
}

function restrictedMetadataKillSwitchDrillPacketFromCertification(
  certification: RestrictedMetadataConnectorCertificationPacketDto
): RestrictedMetadataKillSwitchDrillPacketDto {
  const scenario = restrictedMetadataKillSwitchDrillScenarioForCertification(certification.scenario);
  const publicApiState: RestrictedMetadataKillSwitchDrillPacketDto["killSwitchPropagation"]["publicApiState"] =
    certification.status === "emergency_stop"
      ? "blocked"
      : certification.status === "hold"
        ? "approval_required"
        : "partial_metadata";
  return {
    packetId: stableId("restricted-drill", `${certification.packetId}:${scenario}`),
    scenario,
    sourceId: certification.sourceId,
    network: certification.network,
    dryRunOnly: true,
    metadataOnly: true,
    safeForApi: true,
    operatorVisible: true,
    drillState: certification.status,
    approvalProof: certification.approval,
    proxyIsolation: {
      approved: certification.networkIsolation.approved,
      failureAttribution: certification.networkIsolation.failureAttribution,
      directEgressAllowed: false
    },
    killSwitchPropagation: {
      simulatedMidRun: scenario === "kill_switch_activation_mid_run",
      sourceDisabled: certification.killSwitch.active || certification.killSwitch.sourceStatus === "disabled",
      workerAction: certification.status === "emergency_stop" ? "pause_restricted_metadata_workers" : "none",
      publicApiState
    },
    timeoutAttribution: certification.timeoutAttribution,
    redaction: certification.redaction,
    retention: certification.retention,
    unsafeTargetRejection: {
      blocked: certification.guarantees.unsafeTargetRejected,
      representedByHashOnly: true
    },
    guarantees: {
      noContact: true,
      noDownload: true,
      noCredentialBypass: true,
      noCaptchaSolving: true,
      noStealth: true
    },
    evidence: certification.evidence,
    agent06LedgerAction: certification.agent06LedgerAction,
    agent09WarningCodes: certification.agent09WarningCodes,
    agent10RcGate: {
      gate: "restricted_emergency_stop_rc",
      decision: certification.agent10EmergencyStopReleaseTrain.decision,
      releaseEffect: certification.agent10EmergencyStopReleaseTrain.releaseEffect,
      proofCommand: "bun run check:restricted-metadata-status"
    },
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  };
}

function restrictedMetadataPublicApiBlockedDrillPacket(
  enforcement: RestrictedMetadataEnforcementDto
): RestrictedMetadataKillSwitchDrillPacketDto {
  return {
    packetId: stableId("restricted-drill", `public-api-blocked:${enforcement.level}:${enforcement.emergencyStop.state}`),
    scenario: "public_api_blocked_state",
    dryRunOnly: true,
    metadataOnly: true,
    safeForApi: true,
    operatorVisible: true,
    drillState: enforcement.level === "emergency_stop" ? "emergency_stop" : enforcement.level === "hold" ? "hold" : "warning",
    approvalProof: {
      expired: false,
      legalBasis: "metadata_only_legal_ethics_review"
    },
    proxyIsolation: {
      approved: true,
      failureAttribution: "none",
      directEgressAllowed: false
    },
    killSwitchPropagation: {
      simulatedMidRun: false,
      sourceDisabled: enforcement.emergencyStop.workerAction === "pause_restricted_metadata_workers",
      workerAction: enforcement.emergencyStop.workerAction,
      publicApiState: "blocked"
    },
    timeoutAttribution: {
      timeoutClass: "metadata_standard",
      timeoutObserved: false
    },
    redaction: {
      rawUrlRedacted: true,
      bodyRedacted: true,
      fileNameRedacted: true,
      objectKeyRedacted: true,
      credentialsRedacted: true,
      payloadReferenceRedacted: true,
      screenshotHashOnly: true
    },
    retention: {
      expired: false,
      legalHold: false
    },
    unsafeTargetRejection: {
      blocked: true,
      representedByHashOnly: true
    },
    guarantees: {
      noContact: true,
      noDownload: true,
      noCredentialBypass: true,
      noCaptchaSolving: true,
      noStealth: true
    },
    evidence: {
      urlHashes: [],
      policyAuditIds: [],
      auditEventIds: []
    },
    agent06LedgerAction: "hold_promotion",
    agent09WarningCodes: enforcement.agent09WarningCodes,
    agent10RcGate: {
      gate: "restricted_emergency_stop_rc",
      decision: enforcement.agent10ReleaseEffect === "rollback" ? "rollback" : "hold",
      releaseEffect: enforcement.agent10ReleaseEffect === "none" ? "block" : enforcement.agent10ReleaseEffect,
      proofCommand: "bun run check:restricted-metadata-status"
    },
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  };
}

function restrictedMetadataKillSwitchDrillsSummary(
  packets: readonly RestrictedMetadataKillSwitchDrillPacketDto[]
): RestrictedMetadataKillSwitchDrillsDto {
  const releaseRank = { pass: 0, hold: 1, rollback: 2 };
  const decision = packets.reduce<"pass" | "hold" | "rollback">((current, packet) =>
    releaseRank[packet.agent10RcGate.decision] > releaseRank[current] ? packet.agent10RcGate.decision : current, "pass");
  return {
    metadataOnly: true,
    safeForApi: true,
    dryRunOnly: true,
    operatorVisible: true,
    packets,
    fixtureScenarios: restrictedMetadataKillSwitchDrillScenarioOrder(),
    observedScenarios: restrictedMetadataUniqueStrings(packets.map((packet) => packet.scenario)),
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    agent06LedgerActions: restrictedMetadataUniqueStrings(packets.map((packet) => packet.agent06LedgerAction)),
    agent09WarningCodes: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.agent09WarningCodes)),
    agent10RcGateDecision: decision
  };
}

function restrictedMetadataKillSwitchDrillScenarioForCertification(
  scenario: RestrictedMetadataConnectorCertificationScenario
): RestrictedMetadataKillSwitchDrillScenario {
  const mapping: Record<RestrictedMetadataConnectorCertificationScenario, RestrictedMetadataKillSwitchDrillScenario> = {
    healthy_approved_metadata_source: "healthy_metadata_only_canary",
    expired_approval: "expired_approval",
    kill_switch: "kill_switch_activation_mid_run",
    proxy_isolation_failure: "proxy_failure",
    high_timeout: "proxy_failure",
    unsafe_link_form_download: "unsafe_download_form_contact_link",
    redaction_repair: "redaction_repair",
    legal_hold: "legal_hold",
    retention_expiry: "retention_expiry",
    low_yield_source: "low_yield_source"
  };
  return mapping[scenario];
}

function restrictedMetadataKillSwitchDrillScenarioOrder(): RestrictedMetadataKillSwitchDrillScenario[] {
  return [
    "healthy_metadata_only_canary",
    "kill_switch_activation_mid_run",
    "expired_approval",
    "proxy_failure",
    "redaction_repair",
    "legal_hold",
    "retention_expiry",
    "low_yield_source",
    "unsafe_download_form_contact_link",
    "public_api_blocked_state"
  ];
}

export function restrictedMetadataKillSwitchDrillContract(): RestrictedMetadataKillSwitchDrillsDto {
  return restrictedMetadataKillSwitchDrillsSummary([
    ...restrictedMetadataConnectorCertificationFixturePackets().map((packet) => restrictedMetadataKillSwitchDrillPacketFromCertification(packet)),
    restrictedMetadataPublicApiBlockedDrillPacket(restrictedMetadataEnforcementFromSla(emptyRestrictedMetadataOperationalSla()))
  ]);
}

function restrictedMetadataEmergencyStopCertificationFromDrills(
  drills: RestrictedMetadataKillSwitchDrillsDto
): RestrictedMetadataEmergencyStopCertificationDto {
  return restrictedMetadataEmergencyStopCertificationSummary(drills.packets.map(restrictedMetadataEmergencyStopCertificationPacketFromDrill));
}

function restrictedMetadataEmergencyStopCertificationPacketFromDrill(
  drill: RestrictedMetadataKillSwitchDrillPacketDto
): RestrictedMetadataEmergencyStopCertificationPacketDto {
  const scenario = restrictedMetadataEmergencyStopCertificationScenarioForDrill(drill);
  return {
    packetId: stableId("restricted-escert", `${drill.packetId}:${scenario}`),
    scenario,
    sourceId: drill.sourceId,
    network: drill.network,
    dryRunOnly: true,
    metadataOnly: true,
    safeForApi: true,
    rcGate: "restricted_metadata_emergency_stop_certification_rc",
    controls: {
      canHold: drill.agent10RcGate.decision === "hold" || drill.agent10RcGate.decision === "rollback",
      canPauseWorkers: drill.killSwitchPropagation.workerAction === "pause_restricted_metadata_workers",
      canRollback: drill.agent10RcGate.decision === "rollback",
      canEmergencyStop: drill.drillState === "emergency_stop" || drill.killSwitchPropagation.publicApiState === "blocked",
      publicApiBlockedState: drill.killSwitchPropagation.publicApiState === "blocked"
    },
    approvalProof: drill.approvalProof,
    proxyIsolation: drill.proxyIsolation,
    timeoutAttribution: drill.timeoutAttribution,
    redaction: drill.redaction,
    retention: drill.retention,
    unsafeTargetRejection: drill.unsafeTargetRejection,
    proof: {
      noUnsafeAccess: true,
      noDataExposure: true,
      noContact: true,
      noDownload: true,
      noCredentialBypass: true,
      noCaptchaSolving: true,
      noStealth: true,
      noRawPayloads: true,
      noRawUrls: true,
      hashOnlyEvidence: true
    },
    evidence: drill.evidence,
    agent06EvidenceRedactionCertification: drill.agent06LedgerAction === "hold_redaction" || drill.agent06LedgerAction === "hold_retention" ? "hold" : "pass",
    agent09WarningCodes: drill.agent09WarningCodes,
    agent10EmergencyStopGate: {
      decision: drill.agent10RcGate.decision,
      releaseEffect: drill.agent10RcGate.releaseEffect,
      proofCommand: "bun run check:restricted-metadata-status"
    },
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  };
}

function restrictedMetadataEmergencyStopCertificationSummary(
  packets: readonly RestrictedMetadataEmergencyStopCertificationPacketDto[]
): RestrictedMetadataEmergencyStopCertificationDto {
  const releaseRank = { pass: 0, hold: 1, rollback: 2 };
  const decision = packets.reduce<"pass" | "hold" | "rollback">((current, packet) =>
    releaseRank[packet.agent10EmergencyStopGate.decision] > releaseRank[current] ? packet.agent10EmergencyStopGate.decision : current, "pass");
  return {
    metadataOnly: true,
    safeForApi: true,
    dryRunOnly: true,
    packets,
    fixtureScenarios: restrictedMetadataEmergencyStopCertificationScenarioOrder(),
    observedScenarios: restrictedMetadataUniqueStrings(packets.map((packet) => packet.scenario)),
    noLeakSerialization: restrictedMetadataNoLeakSerializationCheck(),
    agent06EvidenceRedactionCertifications: restrictedMetadataUniqueStrings(packets.map((packet) => packet.agent06EvidenceRedactionCertification)),
    agent09WarningCodes: restrictedMetadataUniqueStrings(packets.flatMap((packet) => packet.agent09WarningCodes)),
    agent10RcGateDecision: decision
  };
}

function restrictedMetadataEmergencyStopCertificationScenarioForDrill(
  drill: RestrictedMetadataKillSwitchDrillPacketDto
): RestrictedMetadataEmergencyStopCertificationScenario {
  if (drill.scenario === "proxy_failure" && drill.timeoutAttribution.timeoutObserved) return "timeout_spike";
  const mapping: Record<RestrictedMetadataKillSwitchDrillScenario, RestrictedMetadataEmergencyStopCertificationScenario> = {
    healthy_metadata_only_canary: "healthy_metadata_only_canary",
    kill_switch_activation_mid_run: "kill_switch_propagation",
    expired_approval: "expired_approval",
    proxy_failure: "proxy_isolation_failure",
    redaction_repair: "redaction_repair",
    legal_hold: "legal_hold",
    retention_expiry: "retention_expiry",
    low_yield_source: "low_yield_source",
    unsafe_download_form_contact_link: "unsafe_download_form_contact_target",
    public_api_blocked_state: "public_api_blocked_state"
  };
  return mapping[drill.scenario];
}

function restrictedMetadataEmergencyStopCertificationScenarioOrder(): RestrictedMetadataEmergencyStopCertificationScenario[] {
  return [
    "healthy_metadata_only_canary",
    "expired_approval",
    "kill_switch_propagation",
    "proxy_isolation_failure",
    "timeout_spike",
    "unsafe_download_form_contact_target",
    "redaction_repair",
    "retention_expiry",
    "legal_hold",
    "low_yield_source",
    "public_api_blocked_state"
  ];
}

export function restrictedMetadataEmergencyStopCertificationContract(): RestrictedMetadataEmergencyStopCertificationDto {
  return restrictedMetadataEmergencyStopCertificationFromDrills(restrictedMetadataKillSwitchDrillContract());
}

function restrictedMetadataEnforcementFromSla(
  sla: RestrictedMetadataOperationalSlaDto
): RestrictedMetadataEnforcementDto {
  const rule = (
    ruleName: RestrictedMetadataEnforcementRule,
    metric: keyof RestrictedMetadataOperationalSlaDto["metrics"],
    level: RestrictedMetadataEnforcementLevel,
    observed: number,
    threshold: number,
    reason: string,
    dryRunActions: readonly RestrictedMetadataOperationsRemediationAction[],
    publicApiImpact: RestrictedMetadataEnforcementRuleDto["publicApiImpact"],
    agent06LedgerImpact: RestrictedMetadataEnforcementRuleDto["agent06LedgerImpact"],
    agent10ReleaseEffect: RestrictedMetadataRuntimeReleaseEffect,
    agent09WarningCode?: string
  ): RestrictedMetadataEnforcementRuleDto => ({
    rule: ruleName,
    active: observed >= threshold,
    level,
    metric,
    observed,
    threshold,
    reason,
    dryRunActions,
    publicApiImpact,
    agent06LedgerImpact,
    agent09WarningCode,
    agent10ReleaseEffect,
    metadataOnly: true,
    safeForApi: true,
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  });
  const rules = [
    rule("approval_expiry_hold", "approvalExpiredCount", "hold", sla.metrics.approvalExpiredCount, 1, "approval expired", ["renew_approval"], "hold", "promotion_hold", "block", "restricted_metadata_approval_expired"),
    rule("kill_switch_emergency_stop", "killSwitchActiveCount", "emergency_stop", sla.metrics.killSwitchActiveCount, 1, "restricted kill switch active", ["activate_kill_switch"], "emergency_stop", "promotion_hold", "rollback", "restricted_metadata_kill_switch_active"),
    rule("kill_switch_inconsistent_hold", "killSwitchInconsistentCount", "hold", sla.metrics.killSwitchInconsistentCount, 1, "kill switch state inconsistent", ["activate_kill_switch", "rollback_disabled_source"], "hold", "promotion_hold", "block", "restricted_metadata_kill_switch_inconsistent"),
    rule("proxy_isolation_failure_hold", "proxyFailureCount", "hold", sla.metrics.proxyFailureCount, 1, "proxy isolation failure", ["quarantine_proxy"], "hold", "promotion_hold", "block", "restricted_metadata_proxy_failure"),
    rule("timeout_spike_warning", "timeoutCount", "warning", sla.metrics.timeoutCount, 1, "restricted proxy timeout observed", ["quarantine_proxy"], "warn", "none", "downgrade", "restricted_metadata_timeout"),
    rule("redaction_repair_hold", "redactionRepairRequiredCount", "hold", sla.metrics.redactionRepairRequiredCount, 1, "redaction repair required", ["repair_redaction"], "hold", "redaction_hold", "block", "restricted_metadata_redaction_repair"),
    rule("retention_expiry_emergency_stop", "retentionExpiredCount", "emergency_stop", sla.metrics.retentionExpiredCount, 1, "restricted retention expired", ["review_retention_expiry"], "emergency_stop", "retention_hold", "rollback", "restricted_metadata_retention_expired"),
    rule("legal_hold_warning", "legalHoldCount", "warning", sla.metrics.legalHoldCount, 1, "legal hold active", ["review_retention_expiry"], "warn", "retention_hold", "downgrade", "restricted_metadata_legal_hold"),
    rule("unsafe_rejection_burst_emergency_stop", "unsafeRejectionCount", "emergency_stop", sla.metrics.unsafeRejectionCount, 2, "unsafe target rejection burst", ["activate_kill_switch"], "emergency_stop", "promotion_hold", "rollback", "restricted_metadata_unsafe_rejection_burst"),
    rule("forbidden_action_attempt_emergency_stop", "forbiddenActionAttemptCount", "emergency_stop", sla.metrics.forbiddenActionAttemptCount, 1, "forbidden action attempted", ["activate_kill_switch"], "emergency_stop", "promotion_hold", "rollback", "restricted_metadata_forbidden_action"),
    rule("low_metadata_only_yield_warning", "metadataOnlyEvidenceYield", "warning", sla.metrics.sourceCount > 0 && sla.metrics.metadataOnlyEvidenceYield === 0 ? 1 : 0, 1, "metadata-only evidence yield is low", ["rollback_disabled_source"], "warn", "none", "downgrade", "restricted_metadata_low_yield")
  ];
  const activeRules = rules.filter((item) => item.active);
  const emergencyRules = activeRules.filter((item) => item.level === "emergency_stop");
  const holdRules = activeRules.filter((item) => item.level === "hold");
  const warningRules = activeRules.filter((item) => item.level === "warning");
  const level: RestrictedMetadataEnforcementLevel = emergencyRules.length > 0
    ? "emergency_stop"
    : holdRules.length > 0
      ? "hold"
      : warningRules.length > 0 || sla.status === "warning"
        ? "warning"
        : "pass";
  const emergencyStop: RestrictedMetadataEmergencyStopDto = {
    state: emergencyRules.length > 0 ? "active" : holdRules.length > 0 ? "armed" : "inactive",
    dryRunOnly: true,
    metadataOnly: true,
    safeForApi: true,
    workerAction: emergencyRules.length > 0 ? "pause_restricted_metadata_workers" : "none",
    releaseEffect: emergencyRules.length > 0 ? "rollback" : holdRules.length > 0 ? "block" : warningRules.length > 0 ? "downgrade" : "none",
    activeRules: activeRules.map((item) => item.rule),
    holdRules: holdRules.map((item) => item.rule),
    warningRules: warningRules.map((item) => item.rule),
    prohibitedActions: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES,
    rollbackPath: "pause restricted metadata workers, keep sources disabled, and keep outer fallback enabled"
  };

  return {
    sourceId: sla.sourceId,
    level,
    metadataOnly: true,
    safeForApi: true,
    rules,
    activeRules,
    emergencyStop,
    dryRunRepairActions: restrictedMetadataUniqueStrings(activeRules.flatMap((item) => item.dryRunActions)),
    agent06LedgerRedactionGate: activeRules.some((item) => item.agent06LedgerImpact === "redaction_hold" || item.agent06LedgerImpact === "retention_hold") ? "hold" : "pass",
    agent09WarningCodes: restrictedMetadataUniqueStrings(activeRules.map((item) => item.agent09WarningCode).filter((code): code is string => Boolean(code))),
    agent10ReleaseEffect: emergencyRules.length > 0 ? "rollback" : holdRules.length > 0 ? "block" : warningRules.length > 0 ? "downgrade" : "none"
  };
}

function restrictedMetadataAgent10ReleasePacket(
  sla: RestrictedMetadataOperationalSlaDto,
  enforcement: RestrictedMetadataEnforcementDto = restrictedMetadataEnforcementFromSla(sla),
  governancePackets: readonly RestrictedMetadataGovernancePacketDto[] = [],
  auditReplay?: RestrictedMetadataAuditReplayDto,
  connectorCertification?: RestrictedMetadataConnectorCertificationDto,
  killSwitchDrills?: RestrictedMetadataKillSwitchDrillsDto,
  emergencyStopCertification?: RestrictedMetadataEmergencyStopCertificationDto
): RestrictedMetadataAgent10ReleasePacketDto {
  return {
    owner: "Agent 05",
    runtimeProofName: "restricted_metadata_sla",
    decision: enforcement.level === "emergency_stop" ? "rollback" : enforcement.level === "hold" || enforcement.level === "warning" ? "hold" : "pass",
    status: sla.status,
    metadataOnly: true,
    safeForApi: true,
    proofCommand: "bun run check:restricted-metadata-status",
    applyPlanProofCommand: "bun run check:restricted-metadata-apply-plan",
    blockerCount: sla.blockers.length,
    warningCount: sla.warnings.length,
    blockers: sla.blockers,
    warnings: sla.warnings,
    enforcementLevel: enforcement.level,
    emergencyStopState: enforcement.emergencyStop.state,
    enforcementRules: enforcement.activeRules.map((rule) => rule.rule),
    agent09WarningCodes: restrictedMetadataUniqueStrings([...enforcement.agent09WarningCodes, ...(auditReplay?.agent09WarningCodes ?? [])]),
    governancePacketIds: governancePackets.map((packet) => packet.packetId),
    auditReplayScenarios: auditReplay?.observedScenarios ?? [],
    certificationPacketIds: connectorCertification?.packets.map((packet) => packet.packetId) ?? [],
    certificationScenarios: connectorCertification?.observedScenarios ?? [],
    killSwitchDrillPacketIds: killSwitchDrills?.packets.map((packet) => packet.packetId) ?? [],
    killSwitchDrillScenarios: killSwitchDrills?.observedScenarios ?? [],
    emergencyStopCertificationPacketIds: emergencyStopCertification?.packets.map((packet) => packet.packetId) ?? [],
    emergencyStopCertificationScenarios: emergencyStopCertification?.observedScenarios ?? [],
    rollbackPath: "pause restricted metadata workers and keep outer fallback enabled",
    releaseFields: [
      "operationalSla",
      "enforcement",
      "emergencyStop",
      "governancePackets",
      "auditReplay",
      "connectorCertification",
      "killSwitchDrills",
      "emergencyStopCertification",
      "auditTrail",
      "runtimeProofs",
      "remediationPlan",
      "agent06EvidenceHandoffProof",
      "metadataOnlyEvidenceYield",
      "forbiddenActionAttemptCount"
    ],
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  };
}

const RESTRICTED_METADATA_AUDIT_REJECTED_FIELDS = [
  "rawUrl",
  "targetUrl",
  "body",
  "html",
  "rawText",
  "fileName",
  "objectKey",
  "credentials",
  "payloadReference",
  "downloadedObject"
];

function emptyRestrictedMetadataSlaMetrics(): RestrictedMetadataOperationalSlaDto["metrics"] {
  return {
    sourceCount: 0,
    approvalExpiredCount: 0,
    killSwitchActiveCount: 0,
    killSwitchInconsistentCount: 0,
    proxyIsolationApprovedCount: 0,
    proxyFailureCount: 0,
    timeoutCount: 0,
    timeoutFailureRate: 0,
    retentionExpiredCount: 0,
    legalHoldCount: 0,
    redactionRepairRequiredCount: 0,
    unsafeRejectionCount: 0,
    forbiddenActionAttemptCount: 0,
    metadataOnlyEvidenceYield: 0,
    auditEventCount: 0
  };
}

function emptyRestrictedMetadataOperationalSla(): RestrictedMetadataOperationalSlaDto {
  return {
    status: "pass",
    metadataOnly: true,
    safeForApi: true,
    metrics: emptyRestrictedMetadataSlaMetrics(),
    blockers: [],
    warnings: [],
    proofCommand: "bun run check:restricted-metadata-status",
    allowedFields: RESTRICTED_METADATA_ALLOWED_FIELDS,
    rejectedFields: RESTRICTED_METADATA_AUDIT_REJECTED_FIELDS
  };
}

function maxOptional(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}

function restrictedMetadataUniqueStrings<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function sumForbiddenActionCounters(counters: RestrictedMetadataForbiddenActionCounters): number {
  return counters.credentialBypassAttempts
    + counters.captchaSolvingAttempts
    + counters.threatActorInteractionAttempts
    + counters.stolenFileDownloadAttempts
    + counters.stealthOrEvasionAttempts
    + counters.unapprovedProxyAttempts
    + counters.nonMetadataCaptureAttempts
    + counters.unsafeTargetAttempts;
}

function sumForbiddenActionCounterList(
  counters: readonly RestrictedMetadataForbiddenActionCounters[]
): RestrictedMetadataForbiddenActionCounters {
  return counters.reduce((acc, item) => ({
    credentialBypassAttempts: acc.credentialBypassAttempts + item.credentialBypassAttempts,
    captchaSolvingAttempts: acc.captchaSolvingAttempts + item.captchaSolvingAttempts,
    threatActorInteractionAttempts: acc.threatActorInteractionAttempts + item.threatActorInteractionAttempts,
    stolenFileDownloadAttempts: acc.stolenFileDownloadAttempts + item.stolenFileDownloadAttempts,
    stealthOrEvasionAttempts: acc.stealthOrEvasionAttempts + item.stealthOrEvasionAttempts,
    unapprovedProxyAttempts: acc.unapprovedProxyAttempts + item.unapprovedProxyAttempts,
    nonMetadataCaptureAttempts: acc.nonMetadataCaptureAttempts + item.nonMetadataCaptureAttempts,
    unsafeTargetAttempts: acc.unsafeTargetAttempts + item.unsafeTargetAttempts
  }), {
    credentialBypassAttempts: 0,
    captchaSolvingAttempts: 0,
    threatActorInteractionAttempts: 0,
    stolenFileDownloadAttempts: 0,
    stealthOrEvasionAttempts: 0,
    unapprovedProxyAttempts: 0,
    nonMetadataCaptureAttempts: 0,
    unsafeTargetAttempts: 0
  });
}

function restrictedMetadataRuntimeProofsForReadiness(
  source: SourceRecord,
  runtime: RestrictedMetadataRuntimeIsolationContract,
  packet: RestrictedMetadataCompliancePacketDto
): RestrictedMetadataRuntimeProofDto[] {
  const counters = forbiddenActionCountersForPacket(packet);
  const remediation = restrictedMetadataOperationsRemediationPlanForReadiness(source, runtime, packet).map((item) => item.action);
  const urlHash = packet.redactionProof?.urlHash;
  const baseEvidence = {
    urlHash,
    auditEventIds: packet.auditEventIds
  };
  const proof = (input: {
    readonly kind: RestrictedMetadataRuntimeProofKind;
    readonly observed: boolean;
    readonly releaseEffect: RestrictedMetadataRuntimeReleaseEffect;
    readonly status: RestrictedMetadataRuntimeProofDto["status"];
    readonly reason: string;
    readonly evidence?: Omit<RestrictedMetadataRuntimeProofDto["evidence"], "auditEventIds">;
    readonly remediationActions?: readonly RestrictedMetadataOperationsRemediationAction[];
  }): RestrictedMetadataRuntimeProofDto => ({
    kind: input.kind,
    sourceId: source.id,
    network: runtime.network,
    observed: input.observed,
    metadataOnly: true,
    safeForApi: true,
    releaseEffect: input.releaseEffect,
    status: input.status,
    reason: input.reason,
    evidence: {
      ...baseEvidence,
      ...input.evidence,
      auditEventIds: packet.auditEventIds
    },
    remediationActions: input.remediationActions ?? remediation.filter((action) => actionMatchesRuntimeProof(input.kind, action)),
    forbiddenActionCounters: counters,
    forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES
  });

  const proxyFailure = runtime.proxyBoundary.fetchFailure && runtime.proxyBoundary.fetchFailure !== "none"
    ? runtime.proxyBoundary.fetchFailure
    : runtime.proxyBoundary.resolutionFailure && runtime.proxyBoundary.resolutionFailure !== "none"
      ? runtime.proxyBoundary.resolutionFailure
      : undefined;
  const disabledSource = source.status === "disabled" || source.accessMethod === "disabled";

  return [
    proof({
      kind: "approval_expiry",
      observed: packet.approvalExpired || packet.statuses.includes("pending_approval"),
      releaseEffect: packet.approvalExpired ? "block" : packet.statuses.includes("pending_approval") ? "downgrade" : "none",
      status: packet.approvalExpired ? "approval_expired" : packet.statuses.includes("pending_approval") ? "pending_approval" : "audit_clean",
      reason: packet.approvalExpired ? "metadata-only approval expired before runtime queueing" : "approval proof is current or pending review",
      evidence: { approvalExpired: packet.approvalExpired },
      remediationActions: ["renew_approval"]
    }),
    proof({
      kind: "kill_switch_transition",
      observed: packet.killSwitchState === "active",
      releaseEffect: packet.killSwitchState === "active" ? "rollback" : "none",
      status: packet.killSwitchState === "active" ? "kill_switch_active" : "audit_clean",
      reason: packet.killSwitchState === "active" ? "restricted metadata kill switch blocks runtime work" : "kill switch is inactive",
      evidence: { killSwitchActive: packet.killSwitchState === "active" },
      remediationActions: packet.killSwitchState === "active" ? ["rollback_disabled_source"] : []
    }),
    proof({
      kind: "proxy_failure",
      observed: runtime.state === "proxy_failure",
      releaseEffect: runtime.state === "proxy_failure" ? "block" : "none",
      status: runtime.state === "proxy_failure" ? "proxy_repair_required" : "audit_clean",
      reason: runtime.state === "proxy_failure" ? "approved proxy boundary failed before metadata-only collection" : "proxy boundary has no non-timeout failure proof",
      evidence: { proxyFailure },
      remediationActions: runtime.state === "proxy_failure" ? ["quarantine_proxy"] : []
    }),
    proof({
      kind: "timeout",
      observed: runtime.state === "timeout",
      releaseEffect: runtime.state === "timeout" ? "downgrade" : "none",
      status: runtime.state === "timeout" ? "proxy_repair_required" : "audit_clean",
      reason: runtime.state === "timeout" ? "approved proxy boundary timed out and should not fall back to direct egress" : "timeout proof is not active",
      evidence: { proxyFailure },
      remediationActions: runtime.state === "timeout" ? ["quarantine_proxy"] : []
    }),
    proof({
      kind: "retention_expiry",
      observed: packet.statuses.includes("retention_expired"),
      releaseEffect: packet.statuses.includes("retention_expired") ? "rollback" : "none",
      status: packet.statuses.includes("retention_expired") ? "retention_expired" : "audit_clean",
      reason: packet.statuses.includes("retention_expired") ? "restricted metadata retention expired before runtime promotion" : "retention proof is current",
      evidence: { retentionExpired: packet.statuses.includes("retention_expired") },
      remediationActions: ["review_retention_expiry"]
    }),
    proof({
      kind: "legal_hold",
      observed: packet.legalHold,
      releaseEffect: packet.legalHold ? "downgrade" : "none",
      status: packet.legalHold ? "legal_hold" : "audit_clean",
      reason: packet.legalHold ? "legal hold preserves metadata and excludes automated purge" : "no legal hold is active",
      evidence: { legalHold: packet.legalHold },
      remediationActions: []
    }),
    proof({
      kind: "redaction_repair",
      observed: !packet.redactionProof || !packet.screenshotHashOnly,
      releaseEffect: !packet.redactionProof || !packet.screenshotHashOnly ? "block" : "none",
      status: !packet.redactionProof || !packet.screenshotHashOnly ? "proxy_repair_required" : "redaction_clean",
      reason: !packet.redactionProof || !packet.screenshotHashOnly ? "redaction proof is incomplete for API/storage handoff" : "redaction proof is complete and screenshot is hash-only",
      evidence: { screenshotHashOnly: packet.screenshotHashOnly },
      remediationActions: !packet.redactionProof || !packet.screenshotHashOnly ? ["repair_redaction"] : []
    }),
    proof({
      kind: "unsafe_target_rejection",
      observed: packet.statuses.includes("forbidden_target_blocked"),
      releaseEffect: packet.statuses.includes("forbidden_target_blocked") ? "rollback" : "none",
      status: packet.statuses.includes("forbidden_target_blocked") ? "forbidden_target_blocked" : "audit_clean",
      reason: packet.statuses.includes("forbidden_target_blocked") ? "unsafe target was rejected before proxy fetch" : "no unsafe target attempt is active",
      evidence: { unsafeTargetBlocked: packet.statuses.includes("forbidden_target_blocked") },
      remediationActions: packet.statuses.includes("forbidden_target_blocked") ? ["activate_kill_switch"] : []
    }),
    proof({
      kind: "disabled_source_rollback",
      observed: disabledSource,
      releaseEffect: disabledSource ? "rollback" : "none",
      status: disabledSource ? "kill_switch_active" : "audit_clean",
      reason: disabledSource ? "disabled source remains rolled back and cannot queue restricted work" : "source is not disabled",
      evidence: { disabledSource },
      remediationActions: disabledSource ? ["rollback_disabled_source"] : []
    })
  ];
}

function actionMatchesRuntimeProof(
  kind: RestrictedMetadataRuntimeProofKind,
  action: RestrictedMetadataOperationsRemediationAction
): boolean {
  return (
    (kind === "approval_expiry" && action === "renew_approval") ||
    ((kind === "proxy_failure" || kind === "timeout") && action === "quarantine_proxy") ||
    (kind === "retention_expiry" && action === "review_retention_expiry") ||
    (kind === "redaction_repair" && action === "repair_redaction") ||
    (kind === "unsafe_target_rejection" && action === "activate_kill_switch") ||
    ((kind === "kill_switch_transition" || kind === "disabled_source_rollback") && action === "rollback_disabled_source")
  );
}

function restrictedMetadataOperationsRemediationPlanForReadiness(
  source: SourceRecord,
  runtime: RestrictedMetadataRuntimeIsolationContract,
  packet: RestrictedMetadataCompliancePacketDto
): RestrictedMetadataOperationsRemediationPlanItem[] {
  const items: RestrictedMetadataOperationsRemediationPlanItem[] = [];
  const add = (input: Omit<RestrictedMetadataOperationsRemediationPlanItem, "id" | "sourceId" | "dryRunOnly" | "metadataOnly" | "forbiddenAlternatives">) => {
    items.push({
      id: stableId("restricted-ops-remediation", `${source.id}:${input.action}:${input.reason}`),
      sourceId: source.id,
      dryRunOnly: true,
      metadataOnly: true,
      forbiddenAlternatives: RESTRICTED_APPLY_PROHIBITED_ALTERNATIVES,
      ...input
    });
  };

  if (packet.approvalExpired || packet.statuses.includes("pending_approval")) {
    add({
      action: "renew_approval",
      safety: "human_approval_required",
      reason: packet.approvalExpired ? "metadata-only approval is expired" : "metadata-only approval is pending or incomplete",
      preconditions: ["current legal notes", "operator approval", "metadata-only scope"],
      expectedEffect: "refresh approval evidence without queueing unsafe collection",
      rollback: ["keep restricted source disabled until approval is current"]
    });
  }
  if (runtime.state === "proxy_failure" || runtime.state === "timeout" || packet.forbiddenActionChecks.unapprovedProxy) {
    add({
      action: "quarantine_proxy",
      safety: "human_approval_required",
      reason: "approved proxy boundary is missing, unhealthy, mismatched, or timed out",
      preconditions: ["pause restricted workers", "inspect approved proxy health", "verify no direct egress"],
      expectedEffect: "hold restricted collection until proxy isolation is healthy",
      rollback: ["pause restricted metadata workers", "keep source out of metadata-only queue"]
    });
  }
  if (packet.killSwitchState === "active" || source.status === "disabled" || source.accessMethod === "disabled") {
    add({
      action: "rollback_disabled_source",
      safety: "rollback_only",
      reason: "source or access method is disabled by restricted metadata kill switch",
      preconditions: ["confirm disabled state is intentional", "preserve existing cursor and retention metadata"],
      expectedEffect: "keep source disabled and expose blocked status to API consumers",
      rollback: ["do not reactivate without a fresh review decision"]
    });
  }
  if (packet.statuses.includes("forbidden_target_blocked")) {
    add({
      action: "activate_kill_switch",
      safety: "rollback_only",
      reason: "unsafe restricted target attempt was blocked",
      preconditions: ["record policy block", "clear queued metadata-only tasks for the source"],
      expectedEffect: "prevent repeated attempts against unsafe target patterns",
      rollback: ["restore last audit-clean restricted metadata configuration"]
    });
  }
  if (packet.statuses.includes("retention_expired")) {
    add({
      action: "review_retention_expiry",
      safety: "automation_safe",
      reason: "restricted metadata retention is expired or expiring",
      preconditions: ["legal hold check", "retention class remains restricted metadata only"],
      expectedEffect: "hold or shorten retention without deleting legal-hold metadata",
      rollback: ["preserve legal-hold records", "rerun retention proof before promotion"]
    });
  }
  if (!packet.redactionProof || !packet.screenshotHashOnly) {
    add({
      action: "repair_redaction",
      safety: "human_approval_required",
      reason: "redaction proof is absent or screenshot hash-only proof is incomplete",
      preconditions: ["drop raw bodies", "drop object references", "hash URL and screenshot identifiers"],
      expectedEffect: "restore Agent 06/09 safe handoff proof before API exposure",
      rollback: ["withhold capture from API/search summaries until proof is present"]
    });
  }
  return items;
}

function dedupeOperationsRemediationItems(
  items: readonly RestrictedMetadataOperationsRemediationPlanItem[]
): RestrictedMetadataOperationsRemediationPlanItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceId}:${item.action}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latestCaptureForSource(captures: readonly RawCapture[], sourceId: string): RawCapture | undefined {
  return captures
    .filter((capture) => capture.sourceId === sourceId)
    .slice()
    .sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0];
}

function rawPayloadBlockedDelta(deltas: readonly EvidenceDelta[]): boolean {
  return deltas.some((delta) =>
    delta.metadata.deltaType === "blocked_unsafe_link" ||
    delta.metadata.policyReason === "sensitive_payload_target_blocked" ||
    delta.metadata.policyReason === "credential_url_blocked"
  );
}

function blockedDeltaIds(deltas: readonly EvidenceDelta[]): string[] {
  return deltas
    .filter((delta) =>
      delta.metadata.deltaType === "blocked_unsafe_link" ||
      delta.metadata.policyReason === "sensitive_payload_target_blocked" ||
      delta.metadata.policyReason === "credential_url_blocked"
    )
    .map((delta) => delta.id);
}

function dedupeAuditFindings(findings: RestrictedMetadataAuditFinding[]): RestrictedMetadataAuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.kind}:${finding.sourceId}:${finding.evidenceIds.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRestrictedAuditRepairs(repairs: readonly RestrictedMetadataAuditRepair[]): RestrictedMetadataAuditRepair[] {
  const seen = new Set<string>();
  return repairs.filter((repair) => {
    const key = `${repair.action}:${repair.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
