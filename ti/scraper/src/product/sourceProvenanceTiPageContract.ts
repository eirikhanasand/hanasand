import { stableId, uniqueStrings } from "../utils.ts";

export const TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION = "ti.source_provenance_page_contract.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERTABILITY_BRIDGE_SCHEMA_VERSION = "ti.source_provenance_alertability_bridge.v1" as const;
export const TI_SOURCE_PROVENANCE_ORG_WATCHLIST_CANDIDATE_SCHEMA_VERSION = "organization.watchlist_alert_terms_export.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_REBUILD_REQUEST_SCHEMA_VERSION = "ti.source_provenance_alert_rebuild_request.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_REBUILD_READINESS_SCHEMA_VERSION = "ti.source_provenance_alert_rebuild_readiness.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_alert_rebuild_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_ENRICHMENT_PACKET_SCHEMA_VERSION = "ti.source_provenance_alert_enrichment_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CASE_HANDOFF_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_case_handoff.v1" as const;
export const TI_SOURCE_PROVENANCE_WATCHLIST_ALERT_BRIDGE_PACKET_SCHEMA_VERSION = "ti.source_provenance_watchlist_alert_bridge_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_PROFILE_CONTRACT_SCHEMA_VERSION = "ti.source_provenance_actor_profile_contract.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_PROFILE_GAP_SOURCE_PLAN_SCHEMA_VERSION = "ti.source_provenance_actor_profile_gap_source_plan.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_PROFILE_SOURCE_UPDATE_WORKFLOW_SCHEMA_VERSION = "ti.source_provenance_actor_profile_source_update_workflow.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_REQUEST_SCHEMA_VERSION = "ti.source_provenance_source_pack_intake_request.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_source_pack_intake_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_ACTIVATION_READINESS_SCHEMA_VERSION = "ti.source_provenance_source_pack_activation_readiness.v1" as const;
export const TI_SOURCE_PROVENANCE_SCRAPER_ENRICHMENT_LIFECYCLE_SCHEMA_VERSION = "ti.source_provenance_scraper_enrichment_lifecycle.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_freshness_gap_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION = "ti.source_provenance_parser_health_alert_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_HANDOFF_STATE_SCHEMA_VERSION = "ti.source_provenance_alert_handoff_state.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION = "ti.source_provenance_source_ops_action_queue.v1" as const;

export type TiSourceProvenanceInputRow = {
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceId?: string;
  sourceName?: string;
  sourceFamily?: string;
  sourceStatus?: "active" | "paused" | "disabled" | string;
  captureId?: string;
  capturedAt?: string;
  collectedAt?: string;
  contentHash?: string;
  provenance?: string;
  confidence?: number;
  route?: string;
  relationship?: "actor_activity" | "targeting" | "infrastructure" | "tooling" | "victim" | string;
};

export type TiSourceProvenancePageContract = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  page: {
    route: string;
    payloadShape: string[];
    customerVisible: true;
    redacted: true;
  };
  summary: {
    sourceCount: number;
    captureCount: number;
    activeSourceCount: number;
    sourceFamilies: string[];
    newestEvidenceAt?: string;
    averageConfidence: number;
    actionRequiredCount: number;
    operatorActionTypes: string[];
  };
  rows: TiSourceProvenancePageRow[];
  blockers: TiSourceProvenancePageBlocker[];
  operatorActions: TiSourceProvenancePageAction[];
};

export type TiSourceProvenancePageRow = {
  rowId: string;
  sourceId?: string;
  sourceName?: string;
  sourceFamily?: string;
  sourceStatus?: string;
  captureId?: string;
  capturedAt?: string;
  contentHash?: string;
  provenance?: string;
  relationship?: string;
  confidence: number;
  route?: string;
  ready: boolean;
  blockerCodes: TiSourceProvenancePageBlocker["code"][];
  operatorActions: TiSourceProvenancePageAction[];
};

export type TiSourceProvenancePageBlocker = {
  code:
    | "missing_source_id"
    | "missing_capture_id"
    | "missing_content_hash"
    | "missing_provenance"
    | "inactive_source"
    | "stale_evidence"
    | "organization_scope_mismatch";
  ownerLane: "source" | "publicTI";
  rowId: string;
  sourceId?: string;
  captureId?: string;
  path: string;
  message: string;
};

export type TiSourceProvenanceAlertabilityBridge = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ALERTABILITY_BRIDGE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceContractId: string;
  canCreateWatchlistTerms: boolean;
  canRequestAlertGeneration: boolean;
  payloadShape: string[];
  watchlistTerms: TiSourceProvenanceAlertabilityTerm[];
  blockers: TiSourceProvenanceAlertabilityBlocker[];
};

export type TiSourceProvenanceAlertabilityTerm = {
  termId: string;
  value: string;
  kind: "actor" | "source_family" | "relationship";
  sourceIds: string[];
  captureIds: string[];
  contentHashes: string[];
  confidence: number;
  alertGenerationRef: {
    schemaVersion: "organization.watchlist_alert_generation_ref.v1";
    key: string;
    organizationId?: string;
    term: string;
    source: "public_ti_source_provenance";
  };
};

export type TiSourceProvenanceAlertabilityBlocker = {
  code: "source_provenance_not_ready" | "no_alertable_terms" | "missing_organization_scope";
  ownerLane: "source" | "publicTI" | "org";
  path: string;
  message: string;
};

export type TiSourceProvenanceOrgWatchlistCandidate = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ORG_WATCHLIST_CANDIDATE_SCHEMA_VERSION;
  artifactId: "ti_source_provenance.org_watchlist_candidate";
  id: string;
  generatedAt: string;
  ok: boolean;
  redacted: true;
  tenantId: string;
  organizationId?: string;
  watchlistId?: string;
  sourceBridgeId: string;
  canGenerateAlerts: boolean;
  payloadShape: string[];
  activeTerms: TiSourceProvenanceOrgWatchlistCandidateTerm[];
  blockedReasons: TiSourceProvenanceAlertabilityBlocker["code"][];
  blockers: TiSourceProvenanceAlertabilityBlocker[];
};

export type TiSourceProvenanceOrgWatchlistCandidateTerm = {
  watchlistId: string;
  watchlistItemId: string;
  itemId: string;
  organizationId: string;
  tenantId: string;
  kind: "actor" | "keyword";
  category: "actor" | "keyword";
  termFamily: "actor" | "keyword";
  term: string;
  value: string;
  terms: string[];
  status: "active";
  createdBy?: string;
  updatedBy: null;
  lifecycleReason: string | null;
  lifecycleRequestId: string | null;
  provenanceRefs: {
    sourceContractId: string;
    sourceBridgeId: string;
    sourceTermId: string;
    sourceIds: string[];
    captureIds: string[];
    contentHashes: string[];
    confidence: number;
  };
  alertGeneratorKey: string;
  alertGenerationRef: {
    schemaVersion: "organization.watchlist_alert_generation_ref.v1";
    source: "organization_shared_watchlist";
    organizationId: string;
    tenantId: string;
    ownerOrganizationId: string;
    watchlistId: string;
    watchlistItemId: string;
    itemId: string;
    termFamily: "actor" | "keyword";
    category: "actor" | "keyword";
    term: string;
    normalizedTerm: string;
    status: "active";
    lifecycle: {
      status: "active";
      reason: string | null;
      requestId: string | null;
      createdBy?: string;
      updatedBy: null;
    };
    dedupe: {
      scope: "organization_watchlist_term";
      key: string;
      parts: {
        organizationId: string;
        tenantId: string;
        watchlistItemId: string;
        termFamily: "actor" | "keyword";
        normalizedTerm: string;
      };
    };
  };
};

export type TiSourceProvenanceAlertRebuildRequest = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ALERT_REBUILD_REQUEST_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  sourceCandidateId: string;
  request: {
    method: "POST";
    path: "/v1/dwm/alerts/rebuild";
    body: {
      tenantId: string;
      organizationId?: string;
      watchlistId?: string;
      watchlistItemIds: string[];
      alertGeneratorKeys: string[];
      sourceBridgeId: string;
      sourceContractId?: string;
      dryRun: true;
    };
  };
  payloadShape: string[];
  blockers: TiSourceProvenanceAlertRebuildRequestBlocker[];
};

export type TiSourceProvenanceAlertRebuildRequestBlocker = {
  code: "watchlist_candidate_blocked" | "missing_organization_scope" | "missing_watchlist_id" | "missing_watchlist_items" | "missing_alert_generation_refs";
  ownerLane: "publicTI" | "org" | "alert";
  path: string;
  message: string;
};

export type TiSourceProvenanceWatchlistAlertBridgePacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_WATCHLIST_ALERT_BRIDGE_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  redacted: true;
  tenantId: string;
  organizationId?: string;
  watchlistId?: string;
  sourceBridgeId: string;
  sourceCandidateId: string;
  alertRebuildRequestId: string;
  bridge: {
    source: "public_ti_source_provenance";
    from: "organization.watchlist_alert_terms_export.v1";
    to: "/v1/dwm/alerts/rebuild";
    dryRunOnly: true;
    liveNetworkFetch: false;
  };
  watchlist: {
    activeTermCount: number;
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
    terms: Array<{
      watchlistItemId: string;
      term: string;
      normalizedTerm: string;
      kind: "actor" | "keyword";
      alertGeneratorKey: string;
      captureIds: string[];
      sourceIds: string[];
      contentHashes: string[];
    }>;
  };
  alertRequest: TiSourceProvenanceAlertRebuildRequest["request"];
  payloadShape: string[];
  blockers: Array<TiSourceProvenanceAlertabilityBlocker | TiSourceProvenanceAlertRebuildRequestBlocker>;
  nextActions: Array<{
    ownerLane: "source" | "publicTI" | "org" | "alert";
    action: "repair_source_provenance" | "materialize_watchlist_terms" | "request_alert_rebuild";
    blockerCode?: string;
    route: {
      method: "POST";
      path: string;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  }>;
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceAlertRebuildReadiness = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ALERT_REBUILD_READINESS_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceContractId: string;
  sourceBridgeId: string;
  watchlistCandidateId: string;
  alertRebuildRequestId: string;
  sourceCoverage: {
    sourceFamilies: string[];
    sourceIds: string[];
    captureIds: string[];
    contentHashes: string[];
    newestEvidenceAt?: string;
    averageConfidence: number;
  };
  alertRequest: TiSourceProvenanceAlertRebuildRequest["request"];
  readiness: {
    canCreateWatchlistTerms: boolean;
    canGenerateAlerts: boolean;
    canRequestAlertRebuild: boolean;
    dryRunOnly: true;
    liveNetworkFetch: false;
  };
  nextOperatorActions: Array<{
    action: "fix_source_provenance" | "materialize_watchlist_terms" | "request_alert_rebuild";
    ownerLane: "source" | "org" | "alert";
    reason: string;
    route: {
      method: "POST";
      path: string;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  }>;
  blockers: Array<TiSourceProvenancePageBlocker | TiSourceProvenanceAlertabilityBlocker | TiSourceProvenanceAlertRebuildRequestBlocker>;
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceAlertRebuildReceipt = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  sourceCandidateId: string;
  sourceBridgeId: string;
  alertRebuildRequestId: string;
  response: {
    source: "dwm_alert_rebuild";
    rebuiltAt?: string;
    savedAlertCount: number;
    dryRun: boolean;
  };
  matches: {
    alertIds: string[];
    watchlistItemIds: string[];
    alertGeneratorKeys: string[];
    sourceBridgeIds: string[];
  };
  caseHandoffRows: Array<{
    alertId: string;
    caseId?: string;
    casePath?: string;
    ready: boolean;
  }>;
  blockers: TiSourceProvenanceAlertRebuildReceiptBlocker[];
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceAlertRebuildReceiptBlocker = {
  code:
    | "request_blocked"
    | "missing_rebuild_response"
    | "tenant_mismatch"
    | "organization_mismatch"
    | "no_alerts_saved"
    | "missing_watchlist_item_match"
    | "missing_alert_generation_ref_match"
    | "missing_source_bridge_match"
    | "missing_case_handoff";
  ownerLane: "publicTI" | "org" | "source" | "alert" | "case";
  path: string;
  message: string;
};

export type TiSourceProvenanceAlertEnrichmentPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ALERT_ENRICHMENT_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  sourceContractId: string;
  sourceBridgeId: string;
  alertRebuildReceiptId: string;
  alertRows: TiSourceProvenanceAlertEnrichmentRow[];
  coverage: {
    sourceFamilies: string[];
    sourceIds: string[];
    captureIds: string[];
    contentHashes: string[];
    newestEvidenceAt?: string;
    averageConfidence: number;
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceAlertEnrichmentRow = {
  alertId: string;
  actor: string;
  publicTiRoute: string;
  sourceBridgeId: string;
  sourceFamilies: string[];
  sourceIds: string[];
  captureIds: string[];
  contentHashes: string[];
  watchlistItemIds: string[];
  alertGeneratorKeys: string[];
  confidence: number;
  freshness: {
    newestEvidenceAt?: string;
    state: "fresh" | "missing";
  };
  caseHandoff?: {
    caseId?: string;
    casePath?: string;
    ready: boolean;
  };
  readyForAnalystWorkflow: boolean;
};

export type TiSourceProvenanceActorEnrichmentCaseHandoff = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CASE_HANDOFF_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  alertEnrichmentPacketId: string;
  rows: TiSourceProvenanceActorEnrichmentCaseHandoffRow[];
  blockers: TiSourceProvenanceActorEnrichmentCaseHandoffBlocker[];
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceActorEnrichmentCaseHandoffRow = {
  alertId: string;
  caseId?: string;
  casePath?: string;
  actor: string;
  publicTiRoute: string;
  sourceBridgeId: string;
  sourceFamilies: string[];
  sourceIds: string[];
  captureIds: string[];
  contentHashes: string[];
  watchlistItemIds: string[];
  alertGeneratorKeys: string[];
  confidence: number;
  freshness: TiSourceProvenanceAlertEnrichmentRow["freshness"];
  ready: boolean;
  nextCaseAction: "open_case_with_actor_context" | "repair_case_handoff";
  casePayload: {
    redacted: true;
    route?: string;
    requiredFields: string[];
    provenanceFields: string[];
  };
  blockerCodes: TiSourceProvenanceActorEnrichmentCaseHandoffBlocker["code"][];
};

export type TiSourceProvenanceActorEnrichmentCaseHandoffBlocker = {
  code:
    | "missing_organization_scope"
    | "missing_alert_rows"
    | "missing_case_handoff"
    | "missing_case_path"
    | "missing_source_provenance"
    | "alert_enrichment_blocked";
  ownerLane: "org" | "alert" | "case" | "source" | "publicTI";
  alertId?: string;
  path: string;
  message: string;
};

export type TiSourceProvenanceAlertRebuildResponse = {
  rebuiltAt?: string;
  savedAlertCount?: number;
  dryRun?: boolean;
  alerts?: TiSourceProvenanceAlertRebuildResponseAlert[];
};

export type TiSourceProvenanceAlertRebuildResponseAlert = {
  id?: string;
  alertId?: string;
  tenantId?: string;
  organizationId?: string;
  watchlistItemIds?: string[];
  alertGeneratorKeys?: string[];
  sourceBridgeId?: string;
  sourceBridgeIds?: string[];
  caseId?: string;
  casePath?: string;
  workflowContext?: {
    watchlistItemIds?: string[];
    alertGeneratorKeys?: string[];
    sourceBridgeId?: string;
    sourceBridgeIds?: string[];
    caseId?: string;
    casePath?: string;
  };
  routingContext?: {
    caseId?: string;
    casePath?: string;
  };
  evidenceSummary?: {
    sourceBridgeId?: string;
    sourceBridgeIds?: string[];
  };
};

export type TiSourceProvenanceActorProfileFieldName =
  | "aliases"
  | "motivations"
  | "sectors"
  | "regions"
  | "infrastructure"
  | "techniques"
  | "campaigns";

export type TiSourceProvenanceActorProfileContract = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_PROFILE_CONTRACT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  fields: TiSourceProvenanceActorProfileField[];
  gaps: TiSourceProvenanceActorProfileGap[];
  coverage: {
    sourceFamilies: string[];
    sourceIds: string[];
    captureIds: string[];
    contentHashes: string[];
    newestEvidenceAt?: string;
    averageConfidence: number;
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceActorProfileField = {
  field: TiSourceProvenanceActorProfileFieldName;
  values: string[];
  confidence: number;
  sourceFamilies: string[];
  provenanceRefs: Array<{
    sourceId?: string;
    captureId?: string;
    contentHash?: string;
    sourceFamily?: string;
    capturedAt?: string;
    confidence: number;
  }>;
  freshness?: {
    newestEvidenceAt?: string;
    state: "fresh" | "missing";
  };
  ready: boolean;
};

export type TiSourceProvenanceActorProfileGap = {
  code: `missing_${TiSourceProvenanceActorProfileFieldName}` | "source_provenance_not_ready";
  field: TiSourceProvenanceActorProfileFieldName | "sourceProvenance";
  ownerLane: "source" | "publicTI";
  message: string;
  retryable: boolean;
};

export type TiSourceProvenanceActorProfileGapSourcePlan = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_PROFILE_GAP_SOURCE_PLAN_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  profileContractId: string;
  candidates: TiSourceProvenanceActorProfileGapSourceCandidate[];
  gapsCovered: TiSourceProvenanceActorProfileFieldName[];
  remainingGaps: TiSourceProvenanceActorProfileGap[];
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
    privateTelegramAccessRequested: false;
  };
};

export type TiSourceProvenanceActorProfileGapSourceCandidate = {
  candidateId: string;
  field: TiSourceProvenanceActorProfileFieldName;
  sourcePackLabel: string;
  family: "actor_page" | "public_advisory" | "telegram_public" | "darkweb_metadata";
  parserProfile: "actor_page_metadata" | "public_advisory" | "public_channel_handoff" | "restricted_metadata";
  expectedCaptureType: "actor_metadata" | "advisory_metadata" | "public_channel_metadata" | "restricted_metadata";
  activationState: "candidate" | "blocked";
  nextAction: "request_candidate" | "approval_required";
  reason: string;
  policyBoundary: {
    publicOnly: boolean;
    metadataOnly: boolean;
    restricted: boolean;
    requiresGovernance: boolean;
    noCredentials: true;
    noAutoJoin: true;
    noRepliesOrReactions: true;
    noMediaDownloads: true;
    liveNetworkFetch: false;
  };
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceActorProfileSourceUpdateWorkflow = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_PROFILE_SOURCE_UPDATE_WORKFLOW_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  sourcePlanId: string;
  tasks: TiSourceProvenanceActorProfileSourceUpdateTask[];
  health: {
    totalCandidates: number;
    readyToTest: number;
    blocked: number;
    retryScheduled: number;
    failed: number;
    families: Array<{
      family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
      candidates: number;
      readyToTest: number;
      blocked: number;
      retryScheduled: number;
      failed: number;
    }>;
  };
  offlineContract: {
    canRunOffline: true;
    liveNetworkFetch: false;
    fixtureBacked: true;
    safeUpdatePath: "/v1/dwm/source-requests";
    note: "Fixture-backed source update planning records parser, activation, and retry state without starting collection.";
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceActorProfileSourceUpdateTask = {
  taskId: string;
  candidateId: string;
  field: TiSourceProvenanceActorProfileFieldName;
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserProfile: TiSourceProvenanceActorProfileGapSourceCandidate["parserProfile"];
  parserStatus: "not_tested" | "ready" | "failed" | "retry_scheduled" | "blocked";
  activationState: "candidate" | "blocked" | "ready_to_test" | "retry_scheduled" | "failed";
  lastRun?: {
    runId: string;
    status: "passed" | "failed" | "blocked";
    finishedAt: string;
    failureReason?: string;
  };
  nextRetryAt?: string;
  failureReason?: string;
  retryable: boolean;
  nextOperatorAction: "test_parser" | "retry_parser" | "request_policy_approval" | "review_failure";
  route: {
    method: "POST";
    path: "/v1/dwm/source-requests";
    body: {
      action: "test" | "retry" | "request_approval";
      candidateId: string;
      dryRun: true;
    };
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenanceActorProfileSourceUpdateHealthInput = {
  candidateId: string;
  parserStatus?: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  lastRun?: TiSourceProvenanceActorProfileSourceUpdateTask["lastRun"];
  nextRetryAt?: string;
  failureReason?: string;
};

export type TiSourceProvenanceSourcePackIntakeRequest = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_REQUEST_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceUpdateWorkflowId: string;
  route: {
    method: "POST";
    path: "/v1/dwm/source-requests";
    body: {
      action: "source_pack_intake";
      sourcePackLabel: string;
      dryRun: true;
      actor: string;
      tenantId: string;
      organizationId?: string;
      candidates: TiSourceProvenanceSourcePackIntakeCandidate[];
    };
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
  acceptedCandidates: TiSourceProvenanceSourcePackIntakeCandidate[];
  blockedCandidates: TiSourceProvenanceSourcePackIntakeCandidate[];
  retryCandidates: TiSourceProvenanceSourcePackIntakeCandidate[];
  summary: {
    candidateCount: number;
    accepted: number;
    blocked: number;
    retryable: number;
    families: string[];
    nextRetryAt?: string;
  };
  offlineContract: {
    fixtureBacked: true;
    liveNetworkFetch: false;
    liveProbeOptIn: true;
    note: "This request is dry-run safe. Production collection requires a separate explicit activation/test action.";
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceSourcePackIntakeCandidate = {
  candidateId: string;
  field: TiSourceProvenanceActorProfileFieldName;
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  targetRef: string;
  type: "public_url" | "telegram_channel" | "restricted_metadata";
  parserProfile: TiSourceProvenanceActorProfileGapSourceCandidate["parserProfile"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  activationState: TiSourceProvenanceActorProfileSourceUpdateTask["activationState"];
  policyBoundary: TiSourceProvenanceActorProfileGapSourceCandidate["policyBoundary"];
  validation: {
    allowed: boolean;
    reason: string;
    failureReason?: string;
    nextRetryAt?: string;
  };
};

export type TiSourceProvenanceSourcePackIntakeReceipt = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourcePackIntakeRequestId: string;
  rows: TiSourceProvenanceSourcePackIntakeReceiptRow[];
  sourceHealth: {
    queuedForReview: number;
    blockedByPolicy: number;
    retryScheduled: number;
    parserReady: number;
    families: Array<{
      family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
      queuedForReview: number;
      blockedByPolicy: number;
      retryScheduled: number;
      parserReady: number;
    }>;
    nextRetryAt?: string;
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceSourcePackIntakeReceiptRow = {
  candidateId: string;
  sourceId?: string;
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  field: TiSourceProvenanceActorProfileFieldName;
  targetRef: string;
  status: "queued_for_review" | "blocked_by_policy" | "retry_scheduled";
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  activationState: TiSourceProvenanceActorProfileSourceUpdateTask["activationState"];
  testJobId?: string;
  failureReason?: string;
  nextRetryAt?: string;
  policyBoundary: TiSourceProvenanceActorProfileGapSourceCandidate["policyBoundary"];
};

export type TiSourceProvenanceSourcePackActivationReadiness = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_ACTIVATION_READINESS_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourcePackIntakeReceiptId: string;
  actions: TiSourceProvenanceSourcePackActivationAction[];
  sourceHealth: TiSourceProvenanceSourcePackIntakeReceipt["sourceHealth"];
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceSourcePackActivationAction = {
  actionId: string;
  action: "test_source" | "retry_parser" | "request_policy_approval";
  candidateId: string;
  sourceId?: string;
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  activationState: TiSourceProvenanceActorProfileSourceUpdateTask["activationState"];
  reason: string;
  nextRetryAt?: string;
  route: {
    method: "POST";
    path: "/v1/dwm/source-requests";
    body: {
      action: "test" | "retry" | "request_approval";
      candidateId: string;
      sourceId?: string;
      dryRun: true;
    };
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenanceScraperEnrichmentLifecycle = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SCRAPER_ENRICHMENT_LIFECYCLE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute?: string;
  sourcePackActivationReadinessId: string;
  actorCaseHandoffId?: string;
  stages: TiSourceProvenanceScraperEnrichmentLifecycleStage[];
  sourceHealth: TiSourceProvenanceSourcePackActivationReadiness["sourceHealth"];
  enrichmentFreshness: {
    state: "fresh" | "missing";
    newestEvidenceAt?: string;
    readyCaseRows: number;
    blockedCaseRows: number;
  };
  docsAsContract: {
    noLiveNetworkByDefault: true;
    fixtureBacked: true;
    liveProbeOptIn: true;
    lifecycle: Array<
      | "candidate_intake"
      | "policy_validation"
      | "activation_test"
      | "fetch_parse"
      | "retry_backoff"
      | "source_health"
      | "provenance"
      | "enrichment_freshness"
      | "case_handoff"
    >;
  };
  blockers: TiSourceProvenanceScraperEnrichmentLifecycleBlocker[];
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceScraperEnrichmentLifecycleStage = {
  stage:
    | "candidate_intake"
    | "policy_validation"
    | "activation_test"
    | "fetch_parse"
    | "retry_backoff"
    | "source_health"
    | "provenance"
    | "enrichment_freshness"
    | "case_handoff";
  status: "complete" | "ready" | "blocked" | "retry_scheduled";
  ownerLane: "source" | "parser" | "publicTI" | "alert" | "case" | "policy";
  evidenceRefs: {
    candidateIds: string[];
    sourceIds: string[];
    captureIds: string[];
    alertIds: string[];
  };
  nextAction: "review_candidates" | "request_policy_approval" | "test_source" | "retry_parser" | "inspect_source_health" | "repair_provenance" | "open_case_handoff" | "wait_for_case_handoff";
  route?: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenanceScraperEnrichmentLifecycleBlocker = {
  code: "no_testable_source" | "policy_approval_required" | "parser_retry_scheduled" | "case_handoff_blocked";
  ownerLane: "source" | "parser" | "case" | "policy";
  path: string;
  message: string;
  candidateId?: string;
  alertId?: string;
  retryAfter?: string;
};

export type TiSourceProvenanceSourceFreshnessGapPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute?: string;
  ownerLane: "source";
  sourcePackActivationReadinessId: string;
  actorCaseHandoffId?: string;
  freshness: {
    state: "fresh" | "stale" | "missing";
    newestEvidenceAt?: string;
    maxAgeDays: number;
    ageDays?: number;
  };
  sourceHealth: TiSourceProvenanceScraperEnrichmentLifecycle["sourceHealth"];
  gaps: TiSourceProvenanceSourceFreshnessGap[];
  consumers: TiSourceProvenanceSourceFreshnessGapConsumer[];
  lifecycle: {
    stages: TiSourceProvenanceScraperEnrichmentLifecycleStage["stage"][];
    blockedStages: TiSourceProvenanceScraperEnrichmentLifecycleStage["stage"][];
    nextTransitions: TiSourceProvenanceScraperEnrichmentLifecycleStage["nextAction"][];
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceSourceFreshnessGap = {
  code:
    | "missing_fresh_evidence"
    | "stale_source_evidence"
    | TiSourceProvenanceScraperEnrichmentLifecycleBlocker["code"];
  ownerLane: "source" | "parser" | "case" | "policy" | "publicTI" | "alert";
  stage?: TiSourceProvenanceScraperEnrichmentLifecycleStage["stage"];
  path: string;
  message: string;
  nextAction: TiSourceProvenanceScraperEnrichmentLifecycleStage["nextAction"];
  candidateId?: string;
  alertId?: string;
  retryAfter?: string;
};

export type TiSourceProvenanceSourceFreshnessGapConsumer = {
  consumer: "publicTI" | "dashboard" | "alertRebuild" | "sourceOps";
  ownerLane: "publicTI" | "dashboard" | "alert" | "source";
  ready: boolean;
  reason: string;
  route: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
  requiredFields: string[];
};

export type TiSourceProvenanceParserHealthAlertPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute?: string;
  lifecycleId: string;
  sourcePackActivationReadinessId: string;
  rows: TiSourceProvenanceParserHealthAlertRow[];
  summary: {
    alertCount: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    retryableCount: number;
    policyBlockedCount: number;
    freshnessBlockedCount: number;
    alertGenerationReady: boolean;
    nextRetryAt?: string;
  };
  consumers: TiSourceProvenanceParserHealthAlertConsumer[];
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceParserHealthAlertRow = {
  alertId: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  alertType: "parser_retry_scheduled" | "policy_blocked" | "parser_not_ready" | "freshness_missing";
  severity: "info" | "warning" | "blocking";
  sourceIds: string[];
  candidateIds: string[];
  policyStatus: "allowed" | "approval_required";
  parserStatus: {
    state: "ready" | "not_ready" | "retry_scheduled" | "blocked";
    parserReadyCount: number;
    failureReason?: string;
  };
  retryState: {
    retryable: boolean;
    nextRetryAt?: string;
    nextAction: "retry_parser" | "request_policy_approval" | "test_source" | "repair_provenance";
  };
  provenance: {
    lifecycleId: string;
    sourcePackActivationReadinessId: string;
    stage: TiSourceProvenanceScraperEnrichmentLifecycleStage["stage"];
    evidenceGeneratedAt: string;
    sourceHealthProofId: string;
    fixtureBacked: true;
  };
  freshness: {
    state: TiSourceProvenanceScraperEnrichmentLifecycle["enrichmentFreshness"]["state"];
    newestEvidenceAt?: string;
    readyCaseRows: number;
    blockedCaseRows: number;
  };
  enrichmentGap: {
    type: "parser_retry" | "policy_validation" | "parser_readiness" | "freshness";
    ownerLane: "source" | "parser" | "policy" | "publicTI";
    nextAction: TiSourceProvenanceScraperEnrichmentLifecycleStage["nextAction"];
  };
  alertGenerationImpact: {
    ready: boolean;
    blockedAlertRows: number;
    webhookConsumable: boolean;
    publicTiReady: boolean;
  };
  route: {
    method: "POST";
    path: "/v1/dwm/source-requests";
    body: {
      action: "retry" | "request_approval" | "test" | "source_health";
      sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
      dryRun: true;
    };
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceParserHealthAlertConsumer = {
  consumer: "publicTI" | "alertGeneration" | "sourceOps" | "webhook";
  ready: boolean;
  requiredFields: string[];
  route: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenanceSourceOpsActionQueue = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute?: string;
  sourceFreshnessGapPacketId: string;
  parserHealthAlertPacketId: string;
  rows: TiSourceProvenanceSourceOpsActionQueueRow[];
  summary: {
    actionCount: number;
    retryCount: number;
    approvalCount: number;
    refreshCount: number;
    repairCount: number;
    sourceFamilies: string[];
    nextRetryAt?: string;
    publicTiReady: boolean;
    alertGenerationReady: boolean;
  };
  consumers: Array<{
    consumer: "sourceOps" | "publicTI" | "dashboard" | "alertGeneration";
    ready: boolean;
    requiredFields: string[];
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  }>;
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceSourceOpsActionQueueRow = {
  actionId: string;
  action:
    | "retry_parser"
    | "request_policy_approval"
    | "test_source"
    | "repair_provenance"
    | "queue_source_refresh"
    | "inspect_source_health";
  priority: "high" | "medium" | "low";
  ownerLane: "source" | "parser" | "policy" | "publicTI" | "alert" | "case";
  sourceFamily?: string;
  candidateIds: string[];
  sourceIds: string[];
  reasonCode: string;
  retryState: {
    retryable: boolean;
    nextRetryAt?: string;
  };
  parserStatus: {
    state?: string;
    failureReason?: string;
  };
  freshness: {
    state: TiSourceProvenanceSourceFreshnessGapPacket["freshness"]["state"];
    newestEvidenceAt?: string;
    ageDays?: number;
  };
  provenance: {
    sourceFreshnessGapPacketId: string;
    parserHealthAlertPacketId: string;
    parserHealthAlertId?: string;
    sourceHealthProofId?: string;
    gapCode?: string;
    fixtureBacked: true;
  };
  route: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceAlertHandoffState = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ALERT_HANDOFF_STATE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute?: string;
  parserHealthAlertPacketId: string;
  state: "ready" | "blocked";
  alertGeneration: {
    ready: boolean;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    blockedAlertIds: string[];
    nextRetryAt?: string;
    route: TiSourceProvenanceParserHealthAlertConsumer["route"];
  };
  publicTi: {
    ready: boolean;
    route: TiSourceProvenanceParserHealthAlertConsumer["route"];
    requiredFields: string[];
  };
  webhook: {
    ready: boolean;
    route: TiSourceProvenanceParserHealthAlertConsumer["route"];
    sourceAlertRows: string[];
  };
  sourceOps: {
    ready: boolean;
    nextActions: TiSourceProvenanceParserHealthAlertRow["retryState"]["nextAction"][];
    routes: TiSourceProvenanceParserHealthAlertRow["route"][];
  };
  blockers: TiSourceProvenanceAlertHandoffStateBlocker[];
  consumerContracts: {
    alertGeneration: {
      requiredFields: string[];
      sourceSchema: typeof TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION;
    };
    publicTi: {
      requiredFields: string[];
      sourceSchema: typeof TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION;
    };
    webhook: {
      requiredFields: string[];
      sourceSchema: typeof TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION;
    };
    sourceOps: {
      requiredFields: string[];
      sourceSchema: typeof TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION;
    };
  };
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceAlertHandoffStateBlocker = {
  code: "missing_org_scope" | "source_org_mismatch" | "parser_health_blocked" | "duplicate_alert_id";
  ownerLane: "org" | "source" | "alert";
  path: string;
  message: string;
  alertId?: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
};

export type TiSourceProvenancePageAction = {
  action:
    | "attach_source_identity"
    | "record_capture"
    | "record_content_hash"
    | "record_provenance"
    | "retry_capture"
    | "review_source_activation"
    | "fix_organization_scope";
  ownerLane: "source" | "publicTI";
  rowId: string;
  sourceId?: string;
  captureId?: string;
  reason: string;
  route: {
    method: "POST";
    path: string;
    body: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export function buildSourceProvenanceTiPageContract(input: {
  tenantId: string;
  organizationId?: string;
  actor: string;
  rows: TiSourceProvenanceInputRow[];
  generatedAt?: string;
  maxAgeDays?: number;
}): TiSourceProvenancePageContract {
  const generatedAt = input.generatedAt ?? new Date(0).toISOString();
  const maxAgeDays = input.maxAgeDays ?? 180;
  const rows = input.rows.map((row) => provenancePageRow({
    row,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    generatedAt,
    maxAgeDays
  }));
  const blockers = rows.flatMap(rowBlockers);
  const operatorActions = uniqueActionRows(rows.flatMap((row) => row.operatorActions));
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_page", `${input.tenantId}:${input.organizationId ?? ""}:${input.actor}:${generatedAt}:${rows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    actor: input.actor,
    page: {
      route: `/ti/${encodeURIComponent(input.actor)}`,
      payloadShape: ["actor", "summary", "rows[].sourceId", "rows[].captureId", "rows[].contentHash", "rows[].provenance", "blockers[]"],
      customerVisible: true,
      redacted: true
    },
    summary: {
      sourceCount: uniqueStrings(rows.map((row) => row.sourceId).filter(Boolean).map(String)).length,
      captureCount: uniqueStrings(rows.map((row) => row.captureId).filter(Boolean).map(String)).length,
      activeSourceCount: uniqueStrings(rows.filter((row) => row.sourceStatus === "active").map((row) => row.sourceId).filter(Boolean).map(String)).length,
      sourceFamilies: uniqueStrings(rows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      newestEvidenceAt: newestTimestamp(rows.map((row) => row.capturedAt)),
      averageConfidence: average(rows.map((row) => row.confidence)),
      actionRequiredCount: rows.filter((row) => !row.ready).length,
      operatorActionTypes: uniqueStrings(operatorActions.map((action) => action.action))
    },
    rows,
    blockers,
    operatorActions
  };
}

export function buildSourceProvenanceAlertabilityBridge(input: {
  contract: TiSourceProvenancePageContract;
  includeSourceFamilies?: boolean;
  includeRelationships?: boolean;
  generatedAt?: string;
}): TiSourceProvenanceAlertabilityBridge {
  const generatedAt = input.generatedAt ?? input.contract.generatedAt;
  const watchlistTerms = alertabilityTerms(input.contract, {
    includeSourceFamilies: input.includeSourceFamilies ?? true,
    includeRelationships: input.includeRelationships ?? true
  });
  const blockers = alertabilityBlockers(input.contract, watchlistTerms);
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ALERTABILITY_BRIDGE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_alertability", `${input.contract.id}:${generatedAt}:${watchlistTerms.map((term) => term.termId).join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.contract.tenantId,
    organizationId: input.contract.organizationId,
    actor: input.contract.actor,
    sourceContractId: input.contract.id,
    canCreateWatchlistTerms: blockers.length === 0,
    canRequestAlertGeneration: blockers.length === 0,
    payloadShape: ["watchlistTerms[].value", "watchlistTerms[].kind", "watchlistTerms[].alertGenerationRef", "watchlistTerms[].captureIds", "blockers[]"],
    watchlistTerms,
    blockers
  };
}

export function buildSourceProvenanceOrgWatchlistCandidate(input: {
  bridge: TiSourceProvenanceAlertabilityBridge;
  watchlistId?: string;
  createdBy?: string;
  requestId?: string;
  reason?: string | null;
  generatedAt?: string;
}): TiSourceProvenanceOrgWatchlistCandidate {
  const generatedAt = input.generatedAt ?? input.bridge.generatedAt;
  const watchlistId = input.watchlistId ?? (input.bridge.organizationId
    ? stableId("org_watchlist_public_ti", `${input.bridge.organizationId}:${input.bridge.sourceContractId}`)
    : undefined);
  const activeTerms = input.bridge.ok && input.bridge.organizationId && watchlistId
    ? input.bridge.watchlistTerms.map((term) => orgWatchlistCandidateTerm({
      bridge: input.bridge,
      term,
      watchlistId,
      createdBy: input.createdBy,
      requestId: input.requestId,
      reason: input.reason ?? "Created from public TI source provenance."
    }))
    : [];
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ORG_WATCHLIST_CANDIDATE_SCHEMA_VERSION,
    artifactId: "ti_source_provenance.org_watchlist_candidate",
    id: stableId("ti_source_provenance_org_watchlist_candidate", `${input.bridge.id}:${watchlistId ?? ""}:${generatedAt}`),
    generatedAt,
    ok: input.bridge.ok && activeTerms.length > 0,
    redacted: true,
    tenantId: input.bridge.tenantId,
    organizationId: input.bridge.organizationId,
    watchlistId,
    sourceBridgeId: input.bridge.id,
    canGenerateAlerts: input.bridge.ok && activeTerms.length > 0,
    payloadShape: [
      "organizationId",
      "tenantId",
      "watchlistId",
      "activeTerms[].alertGenerationRef",
      "activeTerms[].provenanceRefs",
      "blockers[]"
    ],
    activeTerms,
    blockedReasons: input.bridge.blockers.map((blocker) => blocker.code),
    blockers: input.bridge.blockers
  };
}

export function buildSourceProvenanceAlertRebuildRequest(input: {
  candidate: TiSourceProvenanceOrgWatchlistCandidate;
  sourceContractId?: string;
  generatedAt?: string;
}): TiSourceProvenanceAlertRebuildRequest {
  const generatedAt = input.generatedAt ?? input.candidate.generatedAt;
  const alertGeneratorKeys = uniqueStrings(input.candidate.activeTerms.map((term) => term.alertGeneratorKey).filter(Boolean));
  const watchlistItemIds = uniqueStrings(input.candidate.activeTerms.map((term) => term.watchlistItemId).filter(Boolean));
  const blockers = alertRebuildRequestBlockers(input.candidate, watchlistItemIds, alertGeneratorKeys);
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ALERT_REBUILD_REQUEST_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_alert_rebuild_request", `${input.candidate.id}:${generatedAt}:${watchlistItemIds.join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.candidate.tenantId,
    organizationId: input.candidate.organizationId,
    sourceCandidateId: input.candidate.id,
    request: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: input.candidate.tenantId,
        organizationId: input.candidate.organizationId,
        watchlistId: input.candidate.watchlistId,
        watchlistItemIds,
        alertGeneratorKeys,
        sourceBridgeId: input.candidate.sourceBridgeId,
        sourceContractId: input.sourceContractId,
        dryRun: true
      }
    },
    payloadShape: [
      "request.method",
      "request.path",
      "request.body.organizationId",
      "request.body.watchlistId",
      "request.body.watchlistItemIds",
      "request.body.alertGeneratorKeys",
      "blockers[]"
    ],
    blockers
  };
}

export function buildSourceProvenanceWatchlistAlertBridgePacket(input: {
  candidate: TiSourceProvenanceOrgWatchlistCandidate;
  request: TiSourceProvenanceAlertRebuildRequest;
  generatedAt?: string;
}): TiSourceProvenanceWatchlistAlertBridgePacket {
  const generatedAt = input.generatedAt ?? input.request.generatedAt;
  const watchlistItemIds = uniqueStrings(input.candidate.activeTerms.map((term) => term.watchlistItemId).filter(Boolean));
  const alertGeneratorKeys = uniqueStrings(input.candidate.activeTerms.map((term) => term.alertGeneratorKey).filter(Boolean));
  const blockers = [
    ...input.candidate.blockers,
    ...input.request.blockers
  ];
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_WATCHLIST_ALERT_BRIDGE_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_watchlist_alert_bridge_packet", `${input.candidate.id}:${input.request.id}:${generatedAt}`),
    generatedAt,
    ok: input.candidate.ok && input.request.ok && blockers.length === 0,
    redacted: true,
    tenantId: input.candidate.tenantId,
    organizationId: input.candidate.organizationId,
    watchlistId: input.candidate.watchlistId,
    sourceBridgeId: input.candidate.sourceBridgeId,
    sourceCandidateId: input.candidate.id,
    alertRebuildRequestId: input.request.id,
    bridge: {
      source: "public_ti_source_provenance",
      from: "organization.watchlist_alert_terms_export.v1",
      to: "/v1/dwm/alerts/rebuild",
      dryRunOnly: true,
      liveNetworkFetch: false
    },
    watchlist: {
      activeTermCount: input.candidate.activeTerms.length,
      watchlistItemIds,
      alertGeneratorKeys,
      terms: input.candidate.activeTerms.map((term) => ({
        watchlistItemId: term.watchlistItemId,
        term: term.term,
        normalizedTerm: term.alertGenerationRef.normalizedTerm,
        kind: term.kind,
        alertGeneratorKey: term.alertGeneratorKey,
        captureIds: term.provenanceRefs.captureIds,
        sourceIds: term.provenanceRefs.sourceIds,
        contentHashes: term.provenanceRefs.contentHashes
      }))
    },
    alertRequest: input.request.request,
    payloadShape: [
      "watchlist.watchlistItemIds",
      "watchlist.alertGeneratorKeys",
      "watchlist.terms[].captureIds",
      "watchlist.terms[].sourceIds",
      "alertRequest.body.dryRun",
      "alertRequest.body.sourceBridgeId",
      "blockers[]"
    ],
    blockers,
    nextActions: sourceProvenanceWatchlistAlertBridgeActions(blockers),
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceAlertRebuildReadiness(input: {
  contract: TiSourceProvenancePageContract;
  bridge: TiSourceProvenanceAlertabilityBridge;
  candidate: TiSourceProvenanceOrgWatchlistCandidate;
  request: TiSourceProvenanceAlertRebuildRequest;
  generatedAt?: string;
}): TiSourceProvenanceAlertRebuildReadiness {
  const generatedAt = input.generatedAt ?? input.request.generatedAt;
  const readyRows = input.contract.rows.filter((row) => row.ready);
  const blockers = [
    ...input.contract.blockers,
    ...input.bridge.blockers,
    ...input.candidate.blockers,
    ...input.request.blockers
  ];
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ALERT_REBUILD_READINESS_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_alert_rebuild_readiness", `${input.contract.id}:${input.bridge.id}:${input.candidate.id}:${input.request.id}:${generatedAt}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.contract.tenantId,
    organizationId: input.contract.organizationId,
    actor: input.contract.actor,
    sourceContractId: input.contract.id,
    sourceBridgeId: input.bridge.id,
    watchlistCandidateId: input.candidate.id,
    alertRebuildRequestId: input.request.id,
    sourceCoverage: {
      sourceFamilies: uniqueStrings(readyRows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      sourceIds: uniqueStrings(readyRows.map((row) => row.sourceId).filter(Boolean).map(String)),
      captureIds: uniqueStrings(readyRows.map((row) => row.captureId).filter(Boolean).map(String)),
      contentHashes: uniqueStrings(readyRows.map((row) => row.contentHash).filter(Boolean).map(String)),
      newestEvidenceAt: newestTimestamp(readyRows.map((row) => row.capturedAt)),
      averageConfidence: average(readyRows.map((row) => row.confidence))
    },
    alertRequest: input.request.request,
    readiness: {
      canCreateWatchlistTerms: input.bridge.canCreateWatchlistTerms,
      canGenerateAlerts: input.candidate.canGenerateAlerts,
      canRequestAlertRebuild: input.request.ok,
      dryRunOnly: true,
      liveNetworkFetch: false
    },
    nextOperatorActions: sourceProvenanceAlertRebuildActions(input.contract, input.candidate, input.request),
    blockers: uniqueBlockers(blockers),
    payloadShape: [
      "sourceCoverage.sourceFamilies",
      "sourceCoverage.captureIds",
      "sourceCoverage.contentHashes",
      "readiness.canRequestAlertRebuild",
      "alertRequest.body.alertGeneratorKeys",
      "nextOperatorActions[]",
      "blockers[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceAlertRebuildReceipt(input: {
  request: TiSourceProvenanceAlertRebuildRequest;
  response?: TiSourceProvenanceAlertRebuildResponse;
  generatedAt?: string;
}): TiSourceProvenanceAlertRebuildReceipt {
  const generatedAt = input.generatedAt ?? input.response?.rebuiltAt ?? input.request.generatedAt;
  const responseAlerts = input.response?.alerts ?? [];
  const savedAlertIds = uniqueStrings(responseAlerts.map((alert) => alert.id ?? alert.alertId).filter(Boolean).map(String));
  const responseWatchlistItemIds = uniqueStrings(responseAlerts.flatMap(alertWatchlistItemIds));
  const responseAlertGeneratorKeys = uniqueStrings(responseAlerts.flatMap(alertGeneratorKeys));
  const responseSourceBridgeIds = uniqueStrings(responseAlerts.flatMap(alertSourceBridgeIds));
  const expectedWatchlistItemIds = input.request.request.body.watchlistItemIds;
  const expectedAlertGeneratorKeys = input.request.request.body.alertGeneratorKeys;
  const expectedSourceBridgeId = input.request.request.body.sourceBridgeId;
  const matchedWatchlistItemIds = expectedWatchlistItemIds.filter((id) => responseWatchlistItemIds.includes(id));
  const matchedAlertGeneratorKeys = expectedAlertGeneratorKeys.filter((key) => responseAlertGeneratorKeys.includes(key));
  const matchedSourceBridgeIds = responseSourceBridgeIds.includes(expectedSourceBridgeId) ? [expectedSourceBridgeId] : [];
  const caseHandoffRows = responseAlerts.map((alert) => {
    const alertId = String(alert.id ?? alert.alertId ?? "");
    const caseId = alert.caseId ?? alert.workflowContext?.caseId ?? alert.routingContext?.caseId;
    const casePath = alert.casePath ?? alert.workflowContext?.casePath ?? alert.routingContext?.casePath;
    return {
      alertId,
      caseId,
      casePath,
      ready: Boolean(alertId && caseId && casePath)
    };
  }).filter((row) => row.alertId);
  const blockers = alertRebuildReceiptBlockers({
    request: input.request,
    response: input.response,
    savedAlertIds,
    matchedWatchlistItemIds,
    matchedAlertGeneratorKeys,
    matchedSourceBridgeIds,
    caseHandoffRows
  });

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_alert_rebuild_receipt", `${input.request.id}:${generatedAt}:${savedAlertIds.join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.request.tenantId,
    organizationId: input.request.organizationId,
    sourceCandidateId: input.request.sourceCandidateId,
    sourceBridgeId: expectedSourceBridgeId,
    alertRebuildRequestId: input.request.id,
    response: {
      source: "dwm_alert_rebuild",
      rebuiltAt: input.response?.rebuiltAt,
      savedAlertCount: input.response?.savedAlertCount ?? savedAlertIds.length,
      dryRun: input.response?.dryRun ?? input.request.request.body.dryRun
    },
    matches: {
      alertIds: savedAlertIds,
      watchlistItemIds: matchedWatchlistItemIds,
      alertGeneratorKeys: matchedAlertGeneratorKeys,
      sourceBridgeIds: matchedSourceBridgeIds
    },
    caseHandoffRows,
    blockers,
    payloadShape: [
      "response.savedAlertCount",
      "matches.alertIds",
      "matches.watchlistItemIds",
      "matches.alertGeneratorKeys",
      "matches.sourceBridgeIds",
      "caseHandoffRows[]",
      "blockers[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceAlertEnrichmentPacket(input: {
  contract: TiSourceProvenancePageContract;
  receipt: TiSourceProvenanceAlertRebuildReceipt;
  generatedAt?: string;
}): TiSourceProvenanceAlertEnrichmentPacket {
  const generatedAt = input.generatedAt ?? input.receipt.generatedAt;
  const readyRows = input.contract.rows.filter((row) => row.ready);
  const newestEvidenceAt = newestTimestamp(readyRows.map((row) => row.capturedAt));
  const rows = input.receipt.matches.alertIds.map((alertId) => {
    const caseHandoff = input.receipt.caseHandoffRows.find((row) => row.alertId === alertId);
    return {
      alertId,
      actor: input.contract.actor,
      publicTiRoute: input.contract.page.route,
      sourceBridgeId: input.receipt.sourceBridgeId,
      sourceFamilies: uniqueStrings(readyRows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      sourceIds: uniqueStrings(readyRows.map((row) => row.sourceId).filter(Boolean).map(String)),
      captureIds: uniqueStrings(readyRows.map((row) => row.captureId).filter(Boolean).map(String)),
      contentHashes: uniqueStrings(readyRows.map((row) => row.contentHash).filter(Boolean).map(String)),
      watchlistItemIds: input.receipt.matches.watchlistItemIds,
      alertGeneratorKeys: input.receipt.matches.alertGeneratorKeys,
      confidence: average(readyRows.map((row) => row.confidence)),
      freshness: {
        newestEvidenceAt,
        state: newestEvidenceAt ? "fresh" as const : "missing" as const
      },
      caseHandoff: caseHandoff ? {
        caseId: caseHandoff.caseId,
        casePath: caseHandoff.casePath,
        ready: caseHandoff.ready
      } : undefined,
      readyForAnalystWorkflow: Boolean(input.receipt.ok && caseHandoff?.ready)
    };
  });

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ALERT_ENRICHMENT_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_alert_enrichment_packet", `${input.receipt.id}:${input.contract.id}:${generatedAt}`),
    generatedAt,
    ok: input.receipt.ok && input.contract.ok && rows.length > 0 && rows.every((row) => row.readyForAnalystWorkflow),
    tenantId: input.contract.tenantId,
    organizationId: input.contract.organizationId,
    actor: input.contract.actor,
    publicTiRoute: input.contract.page.route,
    sourceContractId: input.contract.id,
    sourceBridgeId: input.receipt.sourceBridgeId,
    alertRebuildReceiptId: input.receipt.id,
    alertRows: rows,
    coverage: {
      sourceFamilies: uniqueStrings(readyRows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      sourceIds: uniqueStrings(readyRows.map((row) => row.sourceId).filter(Boolean).map(String)),
      captureIds: uniqueStrings(readyRows.map((row) => row.captureId).filter(Boolean).map(String)),
      contentHashes: uniqueStrings(readyRows.map((row) => row.contentHash).filter(Boolean).map(String)),
      newestEvidenceAt,
      averageConfidence: average(readyRows.map((row) => row.confidence))
    },
    payloadShape: [
      "alertRows[].alertId",
      "alertRows[].sourceFamilies",
      "alertRows[].captureIds",
      "alertRows[].contentHashes",
      "alertRows[].freshness",
      "alertRows[].caseHandoff",
      "coverage.sourceFamilies"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceActorEnrichmentCaseHandoff(input: {
  enrichment: TiSourceProvenanceAlertEnrichmentPacket;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentCaseHandoff {
  const generatedAt = input.generatedAt ?? input.enrichment.generatedAt;
  const rowBlockers = input.enrichment.alertRows.flatMap((row) => actorEnrichmentCaseHandoffRowBlockers(row));
  const blockers = actorEnrichmentCaseHandoffBlockers(input.enrichment, rowBlockers);
  const rows = input.enrichment.alertRows.map((row) => {
    const blockerCodes = actorEnrichmentCaseHandoffRowBlockers(row).map((blocker) => blocker.code);
    const ready = blockerCodes.length === 0 && Boolean(input.enrichment.organizationId);
    return {
      alertId: row.alertId,
      caseId: row.caseHandoff?.caseId,
      casePath: row.caseHandoff?.casePath,
      actor: row.actor,
      publicTiRoute: row.publicTiRoute,
      sourceBridgeId: row.sourceBridgeId,
      sourceFamilies: row.sourceFamilies,
      sourceIds: row.sourceIds,
      captureIds: row.captureIds,
      contentHashes: row.contentHashes,
      watchlistItemIds: row.watchlistItemIds,
      alertGeneratorKeys: row.alertGeneratorKeys,
      confidence: row.confidence,
      freshness: row.freshness,
      ready,
      nextCaseAction: ready ? "open_case_with_actor_context" as const : "repair_case_handoff" as const,
      casePayload: {
        redacted: true as const,
        route: row.caseHandoff?.casePath,
        requiredFields: [
          "alertId",
          "caseId",
          "actor",
          "publicTiRoute",
          "watchlistItemIds",
          "alertGeneratorKeys"
        ],
        provenanceFields: [
          "sourceBridgeId",
          "sourceFamilies",
          "sourceIds",
          "captureIds",
          "contentHashes",
          "freshness"
        ]
      },
      blockerCodes
    };
  });

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CASE_HANDOFF_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_case_handoff", `${input.enrichment.id}:${generatedAt}`),
    generatedAt,
    ok: blockers.length === 0 && rows.length > 0,
    tenantId: input.enrichment.tenantId,
    organizationId: input.enrichment.organizationId,
    actor: input.enrichment.actor,
    publicTiRoute: input.enrichment.publicTiRoute,
    alertEnrichmentPacketId: input.enrichment.id,
    rows,
    blockers,
    payloadShape: [
      "rows[].alertId",
      "rows[].caseId",
      "rows[].casePath",
      "rows[].publicTiRoute",
      "rows[].sourceBridgeId",
      "rows[].captureIds",
      "rows[].contentHashes",
      "rows[].casePayload"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceActorProfileContract(input: {
  contract: TiSourceProvenancePageContract;
  values?: Partial<Record<TiSourceProvenanceActorProfileFieldName, string[]>>;
  generatedAt?: string;
}): TiSourceProvenanceActorProfileContract {
  const generatedAt = input.generatedAt ?? input.contract.generatedAt;
  const readyRows = input.contract.rows.filter((row) => row.ready);
  const fields = actorProfileFieldSpecs(input.contract.actor, input.values ?? {}).map((spec) => {
    const rows = rowsForActorProfileField(spec.field, readyRows);
    const values = uniqueStrings(spec.values);
    return {
      field: spec.field,
      values,
      confidence: rows.length > 0 ? average(rows.map((row) => row.confidence)) : 0,
      sourceFamilies: uniqueStrings(rows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      provenanceRefs: rows.map((row) => ({
        sourceId: row.sourceId,
        captureId: row.captureId,
        contentHash: row.contentHash,
        sourceFamily: row.sourceFamily,
        capturedAt: row.capturedAt,
        confidence: row.confidence
      })),
      freshness: {
        newestEvidenceAt: newestTimestamp(rows.map((row) => row.capturedAt)),
        state: rows.length > 0 ? "fresh" as const : "missing" as const
      },
      ready: values.length > 0 && rows.length > 0
    };
  });
  const gaps = [
    ...(!input.contract.ok ? [{
      code: "source_provenance_not_ready" as const,
      field: "sourceProvenance" as const,
      ownerLane: "source" as const,
      message: "Source provenance must be complete before the public TI actor profile can be trusted.",
      retryable: true
    }] : []),
    ...fields.filter((field) => !field.ready).map((field) => ({
      code: `missing_${field.field}` as const,
      field: field.field,
      ownerLane: "publicTI" as const,
      message: `Public TI actor profile is missing source-backed ${field.field}.`,
      retryable: true
    }))
  ];
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_PROFILE_CONTRACT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_profile", `${input.contract.id}:${generatedAt}:${fields.map((field) => `${field.field}:${field.values.join(",")}`).join("|")}`),
    generatedAt,
    ok: gaps.length === 0,
    tenantId: input.contract.tenantId,
    organizationId: input.contract.organizationId,
    actor: input.contract.actor,
    publicTiRoute: input.contract.page.route,
    fields,
    gaps,
    coverage: {
      sourceFamilies: uniqueStrings(readyRows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      sourceIds: uniqueStrings(readyRows.map((row) => row.sourceId).filter(Boolean).map(String)),
      captureIds: uniqueStrings(readyRows.map((row) => row.captureId).filter(Boolean).map(String)),
      contentHashes: uniqueStrings(readyRows.map((row) => row.contentHash).filter(Boolean).map(String)),
      newestEvidenceAt: newestTimestamp(readyRows.map((row) => row.capturedAt)),
      averageConfidence: average(readyRows.map((row) => row.confidence))
    },
    payloadShape: [
      "fields[].field",
      "fields[].values",
      "fields[].provenanceRefs",
      "fields[].freshness",
      "coverage.sourceFamilies",
      "gaps[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceActorProfileGapSourcePlan(input: {
  profile: TiSourceProvenanceActorProfileContract;
  generatedAt?: string;
}): TiSourceProvenanceActorProfileGapSourcePlan {
  const generatedAt = input.generatedAt ?? input.profile.generatedAt;
  const fieldGaps = input.profile.gaps.filter((gap): gap is TiSourceProvenanceActorProfileGap & { field: TiSourceProvenanceActorProfileFieldName } => gap.field !== "sourceProvenance");
  const candidates = fieldGaps.map((gap) => actorProfileGapSourceCandidate(input.profile, gap.field));
  const gapsCovered = candidates.reduce<TiSourceProvenanceActorProfileFieldName[]>((fields, candidate) => {
    if (!fields.includes(candidate.field)) fields.push(candidate.field);
    return fields;
  }, []);
  const remainingGaps = input.profile.gaps.filter((gap) => gap.field === "sourceProvenance" || !gapsCovered.includes(gap.field));

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_PROFILE_GAP_SOURCE_PLAN_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_profile_gap_source_plan", `${input.profile.id}:${generatedAt}:${gapsCovered.join(",")}`),
    generatedAt,
    ok: remainingGaps.length === 0,
    tenantId: input.profile.tenantId,
    organizationId: input.profile.organizationId,
    actor: input.profile.actor,
    publicTiRoute: input.profile.publicTiRoute,
    profileContractId: input.profile.id,
    candidates,
    gapsCovered,
    remainingGaps,
    payloadShape: [
      "candidates[].field",
      "candidates[].family",
      "candidates[].parserProfile",
      "candidates[].policyBoundary",
      "candidates[].activationState",
      "remainingGaps[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false,
      privateTelegramAccessRequested: false
    }
  };
}

export function buildSourceProvenanceActorProfileSourceUpdateWorkflow(input: {
  plan: TiSourceProvenanceActorProfileGapSourcePlan;
  health?: TiSourceProvenanceActorProfileSourceUpdateHealthInput[];
  generatedAt?: string;
}): TiSourceProvenanceActorProfileSourceUpdateWorkflow {
  const generatedAt = input.generatedAt ?? input.plan.generatedAt;
  const healthByCandidate = new Map((input.health ?? []).map((item) => [item.candidateId, item]));
  const tasks = input.plan.candidates.map((candidate) => actorProfileSourceUpdateTask(candidate, healthByCandidate.get(candidate.candidateId)));

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_PROFILE_SOURCE_UPDATE_WORKFLOW_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_profile_source_update_workflow", `${input.plan.id}:${generatedAt}:${tasks.map((task) => `${task.candidateId}:${task.parserStatus}`).join("|")}`),
    generatedAt,
    ok: tasks.length > 0 && tasks.every((task) => task.parserStatus !== "failed" && task.activationState !== "failed"),
    tenantId: input.plan.tenantId,
    organizationId: input.plan.organizationId,
    actor: input.plan.actor,
    publicTiRoute: input.plan.publicTiRoute,
    sourcePlanId: input.plan.id,
    tasks,
    health: actorProfileSourceUpdateHealth(tasks),
    offlineContract: {
      canRunOffline: true,
      liveNetworkFetch: false,
      fixtureBacked: true,
      safeUpdatePath: "/v1/dwm/source-requests",
      note: "Fixture-backed source update planning records parser, activation, and retry state without starting collection."
    },
    payloadShape: [
      "tasks[].candidateId",
      "tasks[].parserStatus",
      "tasks[].activationState",
      "tasks[].lastRun",
      "tasks[].nextRetryAt",
      "health.families[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceSourcePackIntakeRequest(input: {
  workflow: TiSourceProvenanceActorProfileSourceUpdateWorkflow;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackIntakeRequest {
  const generatedAt = input.generatedAt ?? input.workflow.generatedAt;
  const candidates = input.workflow.tasks.map((task) => sourcePackIntakeCandidate(input.workflow, task));
  const acceptedCandidates = candidates.filter((candidate) => candidate.validation.allowed);
  const blockedCandidates = candidates.filter((candidate) => !candidate.validation.allowed);
  const retryCandidates = candidates.filter((candidate) => candidate.validation.nextRetryAt);

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_REQUEST_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_intake_request", `${input.workflow.id}:${generatedAt}:${candidates.map((candidate) => candidate.candidateId).join(",")}`),
    generatedAt,
    ok: acceptedCandidates.length > 0,
    tenantId: input.workflow.tenantId,
    organizationId: input.workflow.organizationId,
    actor: input.workflow.actor,
    sourceUpdateWorkflowId: input.workflow.id,
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: {
        action: "source_pack_intake",
        sourcePackLabel: `${input.workflow.actor} enrichment source pack`,
        dryRun: true,
        actor: input.workflow.actor,
        tenantId: input.workflow.tenantId,
        organizationId: input.workflow.organizationId,
        candidates: acceptedCandidates
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    acceptedCandidates,
    blockedCandidates,
    retryCandidates,
    summary: {
      candidateCount: candidates.length,
      accepted: acceptedCandidates.length,
      blocked: blockedCandidates.length,
      retryable: retryCandidates.length,
      families: uniqueStrings(candidates.map((candidate) => candidate.family)),
      nextRetryAt: earliestTimestamp(retryCandidates.map((candidate) => candidate.validation.nextRetryAt))
    },
    offlineContract: {
      fixtureBacked: true,
      liveNetworkFetch: false,
      liveProbeOptIn: true,
      note: "This request is dry-run safe. Production collection requires a separate explicit activation/test action."
    },
    payloadShape: [
      "route.body.candidates[]",
      "acceptedCandidates[]",
      "blockedCandidates[]",
      "retryCandidates[]",
      "summary.families",
      "offlineContract"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceSourcePackIntakeReceipt(input: {
  request: TiSourceProvenanceSourcePackIntakeRequest;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackIntakeReceipt {
  const generatedAt = input.generatedAt ?? input.request.generatedAt;
  const rows = [
    ...input.request.acceptedCandidates.map((candidate) => sourcePackIntakeReceiptRow(candidate, "queued_for_review")),
    ...input.request.blockedCandidates
      .filter((candidate) => !candidate.validation.nextRetryAt)
      .map((candidate) => sourcePackIntakeReceiptRow(candidate, "blocked_by_policy")),
    ...input.request.retryCandidates.map((candidate) => sourcePackIntakeReceiptRow(candidate, "retry_scheduled"))
  ];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_intake_receipt", `${input.request.id}:${generatedAt}:${rows.map((row) => `${row.candidateId}:${row.status}`).join(",")}`),
    generatedAt,
    ok: input.request.ok && rows.some((row) => row.status === "queued_for_review"),
    tenantId: input.request.tenantId,
    organizationId: input.request.organizationId,
    actor: input.request.actor,
    sourcePackIntakeRequestId: input.request.id,
    rows,
    sourceHealth: sourcePackIntakeReceiptHealth(rows),
    payloadShape: [
      "rows[].candidateId",
      "rows[].sourceId",
      "rows[].status",
      "rows[].parserStatus",
      "rows[].activationState",
      "rows[].nextRetryAt",
      "sourceHealth.families[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceSourcePackActivationReadiness(input: {
  receipt: TiSourceProvenanceSourcePackIntakeReceipt;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackActivationReadiness {
  const generatedAt = input.generatedAt ?? input.receipt.generatedAt;
  const actions = input.receipt.rows.map(sourcePackActivationAction);

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_ACTIVATION_READINESS_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_activation_readiness", `${input.receipt.id}:${generatedAt}:${actions.map((action) => `${action.candidateId}:${action.action}`).join(",")}`),
    generatedAt,
    ok: actions.length > 0 && actions.some((action) => action.action === "test_source"),
    tenantId: input.receipt.tenantId,
    organizationId: input.receipt.organizationId,
    actor: input.receipt.actor,
    sourcePackIntakeReceiptId: input.receipt.id,
    actions,
    sourceHealth: input.receipt.sourceHealth,
    payloadShape: [
      "actions[].action",
      "actions[].candidateId",
      "actions[].sourceId",
      "actions[].route",
      "actions[].nextRetryAt",
      "sourceHealth"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceScraperEnrichmentLifecycle(input: {
  activationReadiness: TiSourceProvenanceSourcePackActivationReadiness;
  caseHandoff?: TiSourceProvenanceActorEnrichmentCaseHandoff;
  generatedAt?: string;
}): TiSourceProvenanceScraperEnrichmentLifecycle {
  const generatedAt = input.generatedAt ?? input.activationReadiness.generatedAt;
  const actions = input.activationReadiness.actions;
  const testActions = actions.filter((action) => action.action === "test_source");
  const retryActions = actions.filter((action) => action.action === "retry_parser");
  const approvalActions = actions.filter((action) => action.action === "request_policy_approval");
  const caseRows = input.caseHandoff?.rows ?? [];
  const readyCaseRows = caseRows.filter((row) => row.ready);
  const blockedCaseRows = caseRows.filter((row) => !row.ready);
  const blockers = uniqueLifecycleBlockers([
    ...(testActions.length === 0
      ? [{
          code: "no_testable_source" as const,
          ownerLane: "source" as const,
          path: "activationReadiness.actions",
          message: "No source candidate is ready for a dry-run parser/source health test."
        }]
      : []),
    ...approvalActions.map((action) => ({
      code: "policy_approval_required" as const,
      ownerLane: "policy" as const,
      path: "activationReadiness.actions[].route.body.action",
      message: "Restricted metadata candidate requires policy approval before activation.",
      candidateId: action.candidateId
    })),
    ...retryActions.map((action) => ({
      code: "parser_retry_scheduled" as const,
      ownerLane: "parser" as const,
      path: "activationReadiness.actions[].nextRetryAt",
      message: "Parser test is retryable and must wait for the next retry window.",
      candidateId: action.candidateId,
      retryAfter: action.nextRetryAt
    })),
    ...((input.caseHandoff && !input.caseHandoff.ok)
      ? input.caseHandoff.blockers.map((blocker) => ({
          code: "case_handoff_blocked" as const,
          ownerLane: "case" as const,
          path: blocker.path,
          message: blocker.message,
          alertId: blocker.alertId
        }))
      : [])
  ]);
  const newestEvidenceAt = newestTimestamp(caseRows.map((row) => row.freshness.newestEvidenceAt));
  const freshnessState = newestEvidenceAt ? "fresh" : "missing";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SCRAPER_ENRICHMENT_LIFECYCLE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_scraper_enrichment_lifecycle", `${input.activationReadiness.id}:${input.caseHandoff?.id ?? ""}:${generatedAt}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.activationReadiness.tenantId,
    organizationId: input.activationReadiness.organizationId,
    actor: input.activationReadiness.actor,
    publicTiRoute: input.caseHandoff?.publicTiRoute,
    sourcePackActivationReadinessId: input.activationReadiness.id,
    actorCaseHandoffId: input.caseHandoff?.id,
    stages: sourceProvenanceLifecycleStages({
      activationReadiness: input.activationReadiness,
      caseHandoff: input.caseHandoff,
      testActions,
      retryActions,
      approvalActions,
      blockedCaseRows,
      freshnessState
    }),
    sourceHealth: input.activationReadiness.sourceHealth,
    enrichmentFreshness: {
      state: freshnessState,
      newestEvidenceAt,
      readyCaseRows: readyCaseRows.length,
      blockedCaseRows: blockedCaseRows.length
    },
    docsAsContract: {
      noLiveNetworkByDefault: true,
      fixtureBacked: true,
      liveProbeOptIn: true,
      lifecycle: [
        "candidate_intake",
        "policy_validation",
        "activation_test",
        "fetch_parse",
        "retry_backoff",
        "source_health",
        "provenance",
        "enrichment_freshness",
        "case_handoff"
      ]
    },
    blockers,
    payloadShape: [
      "stages[].stage",
      "stages[].status",
      "stages[].route",
      "sourceHealth",
      "enrichmentFreshness",
      "blockers[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceSourceFreshnessGapPacket(input: {
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle;
  generatedAt?: string;
  maxAgeDays?: number;
}): TiSourceProvenanceSourceFreshnessGapPacket {
  const generatedAt = input.generatedAt ?? input.lifecycle.generatedAt;
  const maxAgeDays = input.maxAgeDays ?? 14;
  const newestEvidenceAt = input.lifecycle.enrichmentFreshness.newestEvidenceAt;
  const ageDays = newestEvidenceAt ? daysBetween(newestEvidenceAt, generatedAt) : undefined;
  const freshnessState = !newestEvidenceAt
    ? "missing"
    : (ageDays !== undefined && ageDays > maxAgeDays ? "stale" : "fresh");
  const gaps = uniqueSourceFreshnessGaps([
    ...sourceFreshnessEvidenceGaps(input.lifecycle, freshnessState, maxAgeDays, ageDays),
    ...input.lifecycle.blockers.map((blocker) => sourceFreshnessLifecycleGap(blocker, input.lifecycle))
  ]);
  const blockedStages = uniqueStrings(input.lifecycle.stages
    .filter((stage) => stage.status === "blocked" || stage.status === "retry_scheduled")
    .map((stage) => stage.stage)) as TiSourceProvenanceScraperEnrichmentLifecycleStage["stage"][];
  const nextTransitions = uniqueStrings(input.lifecycle.stages
    .filter((stage) => stage.status !== "complete")
    .map((stage) => stage.nextAction)) as TiSourceProvenanceScraperEnrichmentLifecycleStage["nextAction"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_freshness_gap_packet", `${input.lifecycle.id}:${generatedAt}:${maxAgeDays}`),
    generatedAt,
    ok: gaps.length === 0,
    tenantId: input.lifecycle.tenantId,
    organizationId: input.lifecycle.organizationId,
    actor: input.lifecycle.actor,
    publicTiRoute: input.lifecycle.publicTiRoute,
    ownerLane: "source",
    sourcePackActivationReadinessId: input.lifecycle.sourcePackActivationReadinessId,
    actorCaseHandoffId: input.lifecycle.actorCaseHandoffId,
    freshness: {
      state: freshnessState,
      newestEvidenceAt,
      maxAgeDays,
      ageDays: ageDays === undefined ? undefined : Number(ageDays.toFixed(3))
    },
    sourceHealth: input.lifecycle.sourceHealth,
    gaps,
    consumers: sourceFreshnessConsumers(input.lifecycle, gaps),
    lifecycle: {
      stages: input.lifecycle.stages.map((stage) => stage.stage),
      blockedStages,
      nextTransitions
    },
    payloadShape: [
      "freshness.state",
      "freshness.newestEvidenceAt",
      "sourceHealth",
      "gaps[].code",
      "consumers[].route",
      "lifecycle.nextTransitions"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceParserHealthAlertPacket(input: {
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle;
  generatedAt?: string;
}): TiSourceProvenanceParserHealthAlertPacket {
  const generatedAt = input.generatedAt ?? input.lifecycle.generatedAt;
  const rows = input.lifecycle.sourceHealth.families.flatMap((family) => parserHealthAlertRows(input.lifecycle, family, generatedAt));
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const nextRetryAt = earliestTimestamp(rows.map((row) => row.retryState.nextRetryAt));
  const alertGenerationReady = rows.length === 0 && input.lifecycle.enrichmentFreshness.state === "fresh";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_parser_health_alert_packet", `${input.lifecycle.id}:${generatedAt}:${rows.map((row) => `${row.sourceFamily}:${row.alertType}`).join("|")}`),
    generatedAt,
    ok: rows.length === 0,
    tenantId: input.lifecycle.tenantId,
    organizationId: input.lifecycle.organizationId,
    actor: input.lifecycle.actor,
    publicTiRoute: input.lifecycle.publicTiRoute,
    lifecycleId: input.lifecycle.id,
    sourcePackActivationReadinessId: input.lifecycle.sourcePackActivationReadinessId,
    rows,
    summary: {
      alertCount: rows.length,
      sourceFamilies,
      retryableCount: rows.filter((row) => row.retryState.retryable).length,
      policyBlockedCount: rows.filter((row) => row.alertType === "policy_blocked").length,
      freshnessBlockedCount: rows.filter((row) => row.alertType === "freshness_missing").length,
      alertGenerationReady,
      nextRetryAt
    },
    consumers: parserHealthAlertConsumers(input.lifecycle, rows, alertGenerationReady),
    payloadShape: [
      "rows[].sourceFamily",
      "rows[].policyStatus",
      "rows[].parserStatus",
      "rows[].retryState",
      "rows[].provenance",
      "rows[].freshness",
      "rows[].enrichmentGap",
      "rows[].alertGenerationImpact"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceSourceOpsActionQueue(input: {
  freshnessPacket: TiSourceProvenanceSourceFreshnessGapPacket;
  parserHealthPacket: TiSourceProvenanceParserHealthAlertPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourceOpsActionQueue {
  const generatedAt = input.generatedAt ?? input.parserHealthPacket.generatedAt;
  const rows = uniqueSourceOpsActionRows([
    ...input.parserHealthPacket.rows.map((row) => sourceOpsActionRowFromParserAlert(input.freshnessPacket, input.parserHealthPacket, row, generatedAt)),
    ...input.freshnessPacket.gaps.map((gap) => sourceOpsActionRowFromFreshnessGap(input.freshnessPacket, input.parserHealthPacket, gap, generatedAt))
  ]);
  const publicTiConsumer = input.freshnessPacket.consumers.find((consumer) => consumer.consumer === "publicTI");
  const alertConsumer = input.freshnessPacket.consumers.find((consumer) => consumer.consumer === "alertRebuild");

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_ops_action_queue", `${input.freshnessPacket.id}:${input.parserHealthPacket.id}:${generatedAt}:${rows.map((row) => row.actionId).join(",")}`),
    generatedAt,
    ok: rows.length === 0,
    tenantId: input.freshnessPacket.tenantId,
    organizationId: input.freshnessPacket.organizationId,
    actor: input.freshnessPacket.actor,
    publicTiRoute: input.freshnessPacket.publicTiRoute,
    sourceFreshnessGapPacketId: input.freshnessPacket.id,
    parserHealthAlertPacketId: input.parserHealthPacket.id,
    rows,
    summary: {
      actionCount: rows.length,
      retryCount: rows.filter((row) => row.action === "retry_parser").length,
      approvalCount: rows.filter((row) => row.action === "request_policy_approval").length,
      refreshCount: rows.filter((row) => row.action === "queue_source_refresh" || row.action === "inspect_source_health").length,
      repairCount: rows.filter((row) => row.action === "repair_provenance").length,
      sourceFamilies: uniqueStrings(rows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.retryState.nextRetryAt)),
      publicTiReady: publicTiConsumer?.ready === true,
      alertGenerationReady: alertConsumer?.ready === true && input.parserHealthPacket.summary.alertGenerationReady
    },
    consumers: sourceOpsActionQueueConsumers(input.freshnessPacket, rows),
    payloadShape: [
      "rows[].action",
      "rows[].ownerLane",
      "rows[].sourceFamily",
      "rows[].parserStatus",
      "rows[].freshness",
      "rows[].provenance",
      "rows[].route",
      "summary.publicTiReady",
      "summary.alertGenerationReady"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceAlertHandoffState(input: {
  packet: TiSourceProvenanceParserHealthAlertPacket;
  expectedOrganizationId?: string;
  generatedAt?: string;
}): TiSourceProvenanceAlertHandoffState {
  const packet = input.packet;
  const generatedAt = input.generatedAt ?? packet.generatedAt;
  const consumers = new Map(packet.consumers.map((consumer) => [consumer.consumer, consumer]));
  const alertGeneration = consumers.get("alertGeneration") ?? fallbackParserHealthConsumer("alertGeneration", packet);
  const publicTi = consumers.get("publicTI") ?? fallbackParserHealthConsumer("publicTI", packet);
  const webhook = consumers.get("webhook") ?? fallbackParserHealthConsumer("webhook", packet);
  const sourceOps = consumers.get("sourceOps") ?? fallbackParserHealthConsumer("sourceOps", packet);
  const blockers = uniqueAlertHandoffStateBlockers([
    ...alertHandoffOrgBlockers(packet, input.expectedOrganizationId),
    ...packet.rows.map((row) => alertHandoffStateBlocker("parser_health_blocked", "source", "rows[]", "Parser or freshness state blocks alert handoff.", row.alertId, row.sourceFamily)),
    ...duplicateAlertHandoffBlockers(packet.rows)
  ]);

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ALERT_HANDOFF_STATE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_alert_handoff_state", `${packet.id}:${input.expectedOrganizationId ?? ""}:${generatedAt}`),
    generatedAt,
    ok: blockers.length === 0 && packet.summary.alertGenerationReady,
    tenantId: packet.tenantId,
    organizationId: packet.organizationId,
    actor: packet.actor,
    publicTiRoute: packet.publicTiRoute,
    parserHealthAlertPacketId: packet.id,
    state: blockers.length === 0 && packet.summary.alertGenerationReady ? "ready" : "blocked",
    alertGeneration: {
      ready: alertGeneration.ready && blockers.length === 0,
      sourceFamilies: packet.summary.sourceFamilies,
      blockedAlertIds: uniqueStrings(packet.rows.map((row) => row.alertId)),
      nextRetryAt: packet.summary.nextRetryAt,
      route: alertGeneration.route
    },
    publicTi: {
      ready: publicTi.ready && blockers.length === 0,
      route: publicTi.route,
      requiredFields: publicTi.requiredFields
    },
    webhook: {
      ready: webhook.ready && blockers.every((blocker) => blocker.code !== "source_org_mismatch" && blocker.code !== "missing_org_scope"),
      route: webhook.route,
      sourceAlertRows: packet.rows.map((row) => row.alertId)
    },
    sourceOps: {
      ready: sourceOps.ready || packet.rows.length > 0,
      nextActions: uniqueStrings(packet.rows.map((row) => row.retryState.nextAction)) as TiSourceProvenanceParserHealthAlertRow["retryState"]["nextAction"][],
      routes: uniqueParserHealthRoutes(packet.rows.map((row) => row.route))
    },
    blockers,
    consumerContracts: {
      alertGeneration: {
        requiredFields: ["tenantId", "organizationId", "actor", "parserHealthAlertPacketId", "alertGeneration.ready"],
        sourceSchema: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION
      },
      publicTi: {
        requiredFields: ["actor", "publicTiRoute", "publicTi.ready", "blockers[]"],
        sourceSchema: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION
      },
      webhook: {
        requiredFields: ["organizationId", "webhook.sourceAlertRows", "sourceOps.nextActions", "safeOutput"],
        sourceSchema: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION
      },
      sourceOps: {
        requiredFields: ["sourceOps.routes", "sourceOps.nextActions", "rows[].route"],
        sourceSchema: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION
      }
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function provenancePageRow(input: {
  row: TiSourceProvenanceInputRow;
  tenantId: string;
  organizationId?: string;
  generatedAt: string;
  maxAgeDays: number;
}): TiSourceProvenancePageRow {
  const row = input.row;
  const capturedAt = row.capturedAt ?? row.collectedAt;
  const rowId = stableId("ti_source_provenance_row", `${input.tenantId}:${input.organizationId ?? ""}:${row.actor}:${row.sourceId ?? ""}:${row.captureId ?? ""}:${row.contentHash ?? ""}`);
  const blockerCodes = uniqueStrings([
    !row.sourceId ? "missing_source_id" : undefined,
    !row.captureId ? "missing_capture_id" : undefined,
    !row.contentHash ? "missing_content_hash" : undefined,
    !row.provenance ? "missing_provenance" : undefined,
    row.sourceStatus && row.sourceStatus !== "active" ? "inactive_source" : undefined,
    capturedAt && daysBetween(capturedAt, input.generatedAt) > input.maxAgeDays ? "stale_evidence" : undefined,
    row.tenantId !== input.tenantId || (input.organizationId && row.organizationId && row.organizationId !== input.organizationId) ? "organization_scope_mismatch" : undefined
  ].filter(Boolean).map(String)) as TiSourceProvenancePageBlocker["code"][];

  return {
    rowId,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    sourceFamily: row.sourceFamily,
    sourceStatus: row.sourceStatus,
    captureId: row.captureId,
    capturedAt,
    contentHash: row.contentHash,
    provenance: row.provenance,
    relationship: row.relationship,
    confidence: clampConfidence(row.confidence),
    route: row.route,
    ready: blockerCodes.length === 0,
    blockerCodes,
    operatorActions: blockerCodes.map((code) => operatorActionForBlocker(code, rowId, row))
  };
}

function rowBlockers(row: TiSourceProvenancePageRow): TiSourceProvenancePageBlocker[] {
  return row.blockerCodes.map((code) => ({
    code,
    ownerLane: code === "organization_scope_mismatch" ? "publicTI" : "source",
    rowId: row.rowId,
    sourceId: row.sourceId,
    captureId: row.captureId,
    path: blockerPath(code),
    message: blockerMessage(code)
  }));
}

function alertabilityTerms(
  contract: TiSourceProvenancePageContract,
  options: { includeSourceFamilies: boolean; includeRelationships: boolean }
): TiSourceProvenanceAlertabilityTerm[] {
  const readyRows = contract.rows.filter((row) => row.ready);
  const terms = [
    termFromRows(contract, "actor", contract.actor, readyRows),
    ...(options.includeSourceFamilies
      ? uniqueStrings(readyRows.map((row) => row.sourceFamily).filter(Boolean).map(String)).map((family) => termFromRows(contract, "source_family", family, readyRows.filter((row) => row.sourceFamily === family)))
      : []),
    ...(options.includeRelationships
      ? uniqueStrings(readyRows.map((row) => row.relationship).filter(Boolean).map(String)).map((relationship) => termFromRows(contract, "relationship", relationship, readyRows.filter((row) => row.relationship === relationship)))
      : [])
  ];
  return terms.filter((term): term is TiSourceProvenanceAlertabilityTerm => Boolean(term));
}

function termFromRows(
  contract: TiSourceProvenancePageContract,
  kind: TiSourceProvenanceAlertabilityTerm["kind"],
  value: string | undefined,
  rows: TiSourceProvenancePageRow[]
): TiSourceProvenanceAlertabilityTerm | undefined {
  if (!value || rows.length === 0) return undefined;
  const normalizedValue = value.trim();
  if (!normalizedValue) return undefined;
  const termId = stableId("ti_source_provenance_alert_term", `${contract.tenantId}:${contract.organizationId ?? ""}:${contract.actor}:${kind}:${normalizedValue}`);
  return {
    termId,
    value: normalizedValue,
    kind,
    sourceIds: uniqueStrings(rows.map((row) => row.sourceId).filter(Boolean).map(String)),
    captureIds: uniqueStrings(rows.map((row) => row.captureId).filter(Boolean).map(String)),
    contentHashes: uniqueStrings(rows.map((row) => row.contentHash).filter(Boolean).map(String)),
    confidence: average(rows.map((row) => row.confidence)),
    alertGenerationRef: {
      schemaVersion: "organization.watchlist_alert_generation_ref.v1",
      key: stableId("org_watchlist_alert_generation", `${contract.organizationId ?? ""}:${kind}:${normalizedValue}:${termId}`),
      organizationId: contract.organizationId,
      term: normalizedValue,
      source: "public_ti_source_provenance"
    }
  };
}

function alertabilityBlockers(
  contract: TiSourceProvenancePageContract,
  terms: TiSourceProvenanceAlertabilityTerm[]
): TiSourceProvenanceAlertabilityBlocker[] {
  const blockers: TiSourceProvenanceAlertabilityBlocker[] = [];
  if (!contract.organizationId) {
    blockers.push({
      code: "missing_organization_scope",
      ownerLane: "org",
      path: "contract.organizationId",
      message: "Watchlist alertability requires organization scope."
    });
  }
  if (!contract.ok) {
    blockers.push({
      code: "source_provenance_not_ready",
      ownerLane: "source",
      path: "contract.blockers",
      message: "Source provenance must be ready before creating alertable watchlist terms."
    });
  }
  if (terms.length === 0) {
    blockers.push({
      code: "no_alertable_terms",
      ownerLane: "publicTI",
      path: "watchlistTerms",
      message: "No alertable terms were produced from source provenance."
    });
  }
  return blockers;
}

function orgWatchlistCandidateTerm(input: {
  bridge: TiSourceProvenanceAlertabilityBridge;
  term: TiSourceProvenanceAlertabilityTerm;
  watchlistId: string;
  createdBy?: string;
  requestId?: string;
  reason: string | null;
}): TiSourceProvenanceOrgWatchlistCandidateTerm {
  const organizationId = String(input.bridge.organizationId);
  const termFamily = input.term.kind === "actor" ? "actor" : "keyword";
  const normalizedTerm = input.term.value.toLowerCase();
  const watchlistItemId = stableId("org_watchlist_item", `${organizationId}:${termFamily}:${input.term.value}`);
  const key = `org:${organizationId}:watchlist:${watchlistItemId}:${termFamily}:${normalizedTerm}`;
  return {
    watchlistId: input.watchlistId,
    watchlistItemId,
    itemId: watchlistItemId,
    organizationId,
    tenantId: input.bridge.tenantId,
    kind: termFamily,
    category: termFamily,
    termFamily,
    term: input.term.value,
    value: input.term.value,
    terms: [input.term.value],
    status: "active",
    createdBy: input.createdBy,
    updatedBy: null,
    lifecycleReason: input.reason,
    lifecycleRequestId: input.requestId ?? null,
    provenanceRefs: {
      sourceContractId: input.bridge.sourceContractId,
      sourceBridgeId: input.bridge.id,
      sourceTermId: input.term.termId,
      sourceIds: input.term.sourceIds,
      captureIds: input.term.captureIds,
      contentHashes: input.term.contentHashes,
      confidence: input.term.confidence
    },
    alertGeneratorKey: key,
    alertGenerationRef: {
      schemaVersion: "organization.watchlist_alert_generation_ref.v1",
      source: "organization_shared_watchlist",
      organizationId,
      tenantId: input.bridge.tenantId,
      ownerOrganizationId: organizationId,
      watchlistId: input.watchlistId,
      watchlistItemId,
      itemId: watchlistItemId,
      termFamily,
      category: termFamily,
      term: input.term.value,
      normalizedTerm,
      status: "active",
      lifecycle: {
        status: "active",
        reason: input.reason,
        requestId: input.requestId ?? null,
        createdBy: input.createdBy,
        updatedBy: null
      },
      dedupe: {
        scope: "organization_watchlist_term",
        key,
        parts: {
          organizationId,
          tenantId: input.bridge.tenantId,
          watchlistItemId,
          termFamily,
          normalizedTerm
        }
      }
    }
  };
}

function alertRebuildRequestBlockers(
  candidate: TiSourceProvenanceOrgWatchlistCandidate,
  watchlistItemIds: string[],
  alertGeneratorKeys: string[]
): TiSourceProvenanceAlertRebuildRequestBlocker[] {
  return [
    !candidate.ok ? alertRebuildBlocker("watchlist_candidate_blocked", "publicTI", "candidate.ok", "Source provenance watchlist candidate is blocked.") : undefined,
    !candidate.organizationId ? alertRebuildBlocker("missing_organization_scope", "org", "candidate.organizationId", "Alert rebuild requires organization scope.") : undefined,
    !candidate.watchlistId ? alertRebuildBlocker("missing_watchlist_id", "org", "candidate.watchlistId", "Alert rebuild requires a persisted or planned watchlist id.") : undefined,
    watchlistItemIds.length === 0 ? alertRebuildBlocker("missing_watchlist_items", "org", "candidate.activeTerms[].watchlistItemId", "Alert rebuild requires watchlist item ids.") : undefined,
    alertGeneratorKeys.length === 0 ? alertRebuildBlocker("missing_alert_generation_refs", "alert", "candidate.activeTerms[].alertGeneratorKey", "Alert rebuild requires alert generation refs.") : undefined
  ].filter(Boolean) as TiSourceProvenanceAlertRebuildRequestBlocker[];
}

function alertRebuildBlocker(
  code: TiSourceProvenanceAlertRebuildRequestBlocker["code"],
  ownerLane: TiSourceProvenanceAlertRebuildRequestBlocker["ownerLane"],
  path: string,
  message: string
): TiSourceProvenanceAlertRebuildRequestBlocker {
  return { code, ownerLane, path, message };
}

function alertRebuildReceiptBlockers(input: {
  request: TiSourceProvenanceAlertRebuildRequest;
  response?: TiSourceProvenanceAlertRebuildResponse;
  savedAlertIds: string[];
  matchedWatchlistItemIds: string[];
  matchedAlertGeneratorKeys: string[];
  matchedSourceBridgeIds: string[];
  caseHandoffRows: TiSourceProvenanceAlertRebuildReceipt["caseHandoffRows"];
}): TiSourceProvenanceAlertRebuildReceiptBlocker[] {
  return [
    !input.request.ok ? alertRebuildReceiptBlocker("request_blocked", "publicTI", "request.ok", "Alert rebuild receipt requires an unblocked rebuild request.") : undefined,
    !input.response ? alertRebuildReceiptBlocker("missing_rebuild_response", "alert", "response", "Alert rebuild receipt requires a rebuild response.") : undefined,
    input.response?.alerts?.some((alert) => alert.tenantId && alert.tenantId !== input.request.tenantId)
      ? alertRebuildReceiptBlocker("tenant_mismatch", "alert", "response.alerts[].tenantId", "Alert response includes a tenant mismatch.")
      : undefined,
    input.response?.alerts?.some((alert) => alert.organizationId && alert.organizationId !== input.request.organizationId)
      ? alertRebuildReceiptBlocker("organization_mismatch", "org", "response.alerts[].organizationId", "Alert response includes an organization mismatch.")
      : undefined,
    input.savedAlertIds.length === 0 ? alertRebuildReceiptBlocker("no_alerts_saved", "alert", "response.alerts[].id", "Alert rebuild did not return saved alert ids.") : undefined,
    input.request.request.body.watchlistItemIds.length > 0 && input.matchedWatchlistItemIds.length === 0
      ? alertRebuildReceiptBlocker("missing_watchlist_item_match", "org", "response.alerts[].watchlistItemIds", "Alert rebuild response did not match requested watchlist item ids.")
      : undefined,
    input.request.request.body.alertGeneratorKeys.length > 0 && input.matchedAlertGeneratorKeys.length === 0
      ? alertRebuildReceiptBlocker("missing_alert_generation_ref_match", "alert", "response.alerts[].alertGeneratorKeys", "Alert rebuild response did not match requested alert generation refs.")
      : undefined,
    input.matchedSourceBridgeIds.length === 0 ? alertRebuildReceiptBlocker("missing_source_bridge_match", "source", "response.alerts[].sourceBridgeId", "Alert rebuild response did not preserve source bridge provenance.") : undefined,
    input.savedAlertIds.length > 0 && !input.caseHandoffRows.some((row) => row.ready)
      ? alertRebuildReceiptBlocker("missing_case_handoff", "case", "response.alerts[].caseId", "Saved alerts need case handoff ids and paths before analyst workflow can continue.")
      : undefined
  ].filter(Boolean) as TiSourceProvenanceAlertRebuildReceiptBlocker[];
}

function alertRebuildReceiptBlocker(
  code: TiSourceProvenanceAlertRebuildReceiptBlocker["code"],
  ownerLane: TiSourceProvenanceAlertRebuildReceiptBlocker["ownerLane"],
  path: string,
  message: string
): TiSourceProvenanceAlertRebuildReceiptBlocker {
  return { code, ownerLane, path, message };
}

function actorEnrichmentCaseHandoffBlockers(
  enrichment: TiSourceProvenanceAlertEnrichmentPacket,
  rowBlockers: TiSourceProvenanceActorEnrichmentCaseHandoffBlocker[]
): TiSourceProvenanceActorEnrichmentCaseHandoffBlocker[] {
  return [
    !enrichment.organizationId
      ? actorEnrichmentCaseHandoffBlocker("missing_organization_scope", "org", "enrichment.organizationId", "Actor enrichment case handoff requires organization scope.")
      : undefined,
    enrichment.alertRows.length === 0
      ? actorEnrichmentCaseHandoffBlocker("missing_alert_rows", "alert", "enrichment.alertRows", "Actor enrichment case handoff requires at least one enriched alert row.")
      : undefined,
    !enrichment.ok && rowBlockers.length === 0
      ? actorEnrichmentCaseHandoffBlocker("alert_enrichment_blocked", "publicTI", "enrichment.ok", "Actor enrichment packet is not ready for case handoff.")
      : undefined,
    ...rowBlockers
  ].filter(Boolean) as TiSourceProvenanceActorEnrichmentCaseHandoffBlocker[];
}

function actorEnrichmentCaseHandoffRowBlockers(row: TiSourceProvenanceAlertEnrichmentRow): TiSourceProvenanceActorEnrichmentCaseHandoffBlocker[] {
  return [
    !row.caseHandoff?.caseId
      ? actorEnrichmentCaseHandoffBlocker("missing_case_handoff", "case", "alertRows[].caseHandoff.caseId", "Enriched alert row needs a case id before analyst handoff.", row.alertId)
      : undefined,
    !row.caseHandoff?.casePath
      ? actorEnrichmentCaseHandoffBlocker("missing_case_path", "case", "alertRows[].caseHandoff.casePath", "Enriched alert row needs a case path before analyst handoff.", row.alertId)
      : undefined,
    row.sourceIds.length === 0 || row.captureIds.length === 0 || row.contentHashes.length === 0
      ? actorEnrichmentCaseHandoffBlocker("missing_source_provenance", "source", "alertRows[].sourceIds", "Actor enrichment case handoff requires source ids, capture ids, and content hashes.", row.alertId)
      : undefined
  ].filter(Boolean) as TiSourceProvenanceActorEnrichmentCaseHandoffBlocker[];
}

function actorEnrichmentCaseHandoffBlocker(
  code: TiSourceProvenanceActorEnrichmentCaseHandoffBlocker["code"],
  ownerLane: TiSourceProvenanceActorEnrichmentCaseHandoffBlocker["ownerLane"],
  path: string,
  message: string,
  alertId?: string
): TiSourceProvenanceActorEnrichmentCaseHandoffBlocker {
  return { code, ownerLane, path, message, alertId };
}

function sourceProvenanceLifecycleStages(input: {
  activationReadiness: TiSourceProvenanceSourcePackActivationReadiness;
  caseHandoff?: TiSourceProvenanceActorEnrichmentCaseHandoff;
  testActions: TiSourceProvenanceSourcePackActivationAction[];
  retryActions: TiSourceProvenanceSourcePackActivationAction[];
  approvalActions: TiSourceProvenanceSourcePackActivationAction[];
  blockedCaseRows: TiSourceProvenanceActorEnrichmentCaseHandoffRow[];
  freshnessState: "fresh" | "missing";
}): TiSourceProvenanceScraperEnrichmentLifecycleStage[] {
  const actions = input.activationReadiness.actions;
  const allCandidateIds = uniqueStrings(actions.map((action) => action.candidateId));
  const allSourceIds = uniqueStrings(actions.map((action) => action.sourceId).filter(Boolean).map(String));
  const caseCaptureIds = uniqueStrings((input.caseHandoff?.rows ?? []).flatMap((row) => row.captureIds));
  const caseAlertIds = uniqueStrings((input.caseHandoff?.rows ?? []).map((row) => row.alertId));
  const firstTestAction = input.testActions[0];
  const firstRetryAction = input.retryActions[0];
  const firstApprovalAction = input.approvalActions[0];

  return [
    {
      stage: "candidate_intake",
      status: actions.length > 0 ? "complete" : "blocked",
      ownerLane: "source",
      evidenceRefs: lifecycleEvidenceRefs(allCandidateIds, allSourceIds, [], []),
      nextAction: "review_candidates",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: { action: "source_pack_intake", dryRun: true },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    },
    {
      stage: "policy_validation",
      status: input.approvalActions.length > 0 ? "blocked" : "complete",
      ownerLane: "policy",
      evidenceRefs: lifecycleEvidenceRefs(input.approvalActions.map((action) => action.candidateId), [], [], []),
      nextAction: input.approvalActions.length > 0 ? "request_policy_approval" : "test_source",
      route: firstApprovalAction?.route
    },
    {
      stage: "activation_test",
      status: input.testActions.length > 0 ? "ready" : "blocked",
      ownerLane: "source",
      evidenceRefs: lifecycleEvidenceRefs(input.testActions.map((action) => action.candidateId), input.testActions.map((action) => action.sourceId).filter(Boolean).map(String), [], []),
      nextAction: "test_source",
      route: firstTestAction?.route
    },
    {
      stage: "fetch_parse",
      status: input.testActions.length > 0 ? "ready" : "blocked",
      ownerLane: "parser",
      evidenceRefs: lifecycleEvidenceRefs(input.testActions.map((action) => action.candidateId), input.testActions.map((action) => action.sourceId).filter(Boolean).map(String), [], []),
      nextAction: "test_source",
      route: firstTestAction?.route
    },
    {
      stage: "retry_backoff",
      status: input.retryActions.length > 0 ? "retry_scheduled" : "complete",
      ownerLane: "parser",
      evidenceRefs: lifecycleEvidenceRefs(input.retryActions.map((action) => action.candidateId), input.retryActions.map((action) => action.sourceId).filter(Boolean).map(String), [], []),
      nextAction: input.retryActions.length > 0 ? "retry_parser" : "inspect_source_health",
      route: firstRetryAction?.route
    },
    {
      stage: "source_health",
      status: input.activationReadiness.sourceHealth.blockedByPolicy > 0 || input.activationReadiness.sourceHealth.retryScheduled > 0 ? "ready" : "complete",
      ownerLane: "source",
      evidenceRefs: lifecycleEvidenceRefs(allCandidateIds, allSourceIds, [], []),
      nextAction: "inspect_source_health",
      route: {
        method: "GET",
        path: "/v1/dwm/source-requests",
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    },
    {
      stage: "provenance",
      status: caseCaptureIds.length > 0 ? "complete" : "blocked",
      ownerLane: "publicTI",
      evidenceRefs: lifecycleEvidenceRefs([], allSourceIds, caseCaptureIds, caseAlertIds),
      nextAction: caseCaptureIds.length > 0 ? "open_case_handoff" : "repair_provenance"
    },
    {
      stage: "enrichment_freshness",
      status: input.freshnessState === "fresh" ? "complete" : "blocked",
      ownerLane: "publicTI",
      evidenceRefs: lifecycleEvidenceRefs([], allSourceIds, caseCaptureIds, caseAlertIds),
      nextAction: input.freshnessState === "fresh" ? "open_case_handoff" : "repair_provenance"
    },
    {
      stage: "case_handoff",
      status: input.caseHandoff ? (input.blockedCaseRows.length > 0 || !input.caseHandoff.ok ? "blocked" : "complete") : "ready",
      ownerLane: "case",
      evidenceRefs: lifecycleEvidenceRefs([], allSourceIds, caseCaptureIds, caseAlertIds),
      nextAction: input.caseHandoff ? "open_case_handoff" : "wait_for_case_handoff"
    }
  ];
}

function lifecycleEvidenceRefs(
  candidateIds: string[],
  sourceIds: string[],
  captureIds: string[],
  alertIds: string[]
): TiSourceProvenanceScraperEnrichmentLifecycleStage["evidenceRefs"] {
  return {
    candidateIds: uniqueStrings(candidateIds),
    sourceIds: uniqueStrings(sourceIds),
    captureIds: uniqueStrings(captureIds),
    alertIds: uniqueStrings(alertIds)
  };
}

function uniqueLifecycleBlockers(
  blockers: TiSourceProvenanceScraperEnrichmentLifecycleBlocker[]
): TiSourceProvenanceScraperEnrichmentLifecycleBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}:${blocker.candidateId ?? ""}:${blocker.alertId ?? ""}:${blocker.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceFreshnessEvidenceGaps(
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle,
  freshnessState: TiSourceProvenanceSourceFreshnessGapPacket["freshness"]["state"],
  maxAgeDays: number,
  ageDays?: number
): TiSourceProvenanceSourceFreshnessGap[] {
  if (freshnessState === "fresh") return [];
  if (freshnessState === "missing") {
    return [{
      code: "missing_fresh_evidence",
      ownerLane: "publicTI",
      stage: "enrichment_freshness",
      path: "enrichmentFreshness.newestEvidenceAt",
      message: "No case-ready source evidence is available for this actor.",
      nextAction: lifecycle.actorCaseHandoffId ? "repair_provenance" : "wait_for_case_handoff"
    }];
  }
  return [{
    code: "stale_source_evidence",
    ownerLane: "source",
    stage: "enrichment_freshness",
    path: "enrichmentFreshness.newestEvidenceAt",
    message: `Newest case-ready source evidence is older than ${maxAgeDays} days.`,
    nextAction: "inspect_source_health",
    retryAfter: ageDays === undefined ? undefined : `${Number(ageDays.toFixed(3))}d`
  }];
}

function sourceFreshnessLifecycleGap(
  blocker: TiSourceProvenanceScraperEnrichmentLifecycleBlocker,
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle
): TiSourceProvenanceSourceFreshnessGap {
  const stage = sourceFreshnessGapStage(blocker.code);
  const stageRow = lifecycle.stages.find((candidate) => candidate.stage === stage);
  return {
    code: blocker.code,
    ownerLane: blocker.ownerLane,
    stage,
    path: blocker.path,
    message: blocker.message,
    nextAction: stageRow?.nextAction ?? sourceFreshnessGapNextAction(blocker.code),
    candidateId: blocker.candidateId,
    alertId: blocker.alertId,
    retryAfter: blocker.retryAfter
  };
}

function sourceFreshnessGapStage(
  code: TiSourceProvenanceScraperEnrichmentLifecycleBlocker["code"]
): TiSourceProvenanceScraperEnrichmentLifecycleStage["stage"] {
  if (code === "policy_approval_required") return "policy_validation";
  if (code === "parser_retry_scheduled") return "retry_backoff";
  if (code === "case_handoff_blocked") return "case_handoff";
  return "activation_test";
}

function sourceFreshnessGapNextAction(
  code: TiSourceProvenanceScraperEnrichmentLifecycleBlocker["code"]
): TiSourceProvenanceScraperEnrichmentLifecycleStage["nextAction"] {
  if (code === "policy_approval_required") return "request_policy_approval";
  if (code === "parser_retry_scheduled") return "retry_parser";
  if (code === "case_handoff_blocked") return "open_case_handoff";
  return "test_source";
}

function sourceFreshnessConsumers(
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle,
  gaps: TiSourceProvenanceSourceFreshnessGap[]
): TiSourceProvenanceSourceFreshnessGapConsumer[] {
  const hasSourceOrPolicyGap = gaps.some((gap) => gap.ownerLane === "source" || gap.ownerLane === "parser" || gap.ownerLane === "policy");
  const hasEvidenceGap = gaps.some((gap) => gap.code === "missing_fresh_evidence" || gap.code === "stale_source_evidence");
  const hasCaseGap = gaps.some((gap) => gap.ownerLane === "case");
  const sourceOpsReady = hasSourceOrPolicyGap
    || hasEvidenceGap
    || lifecycle.sourceHealth.queuedForReview > 0
    || lifecycle.sourceHealth.parserReady > 0
    || lifecycle.sourceHealth.retryScheduled > 0
    || lifecycle.sourceHealth.blockedByPolicy > 0;
  const publicReady = gaps.length === 0;
  const alertReady = !hasSourceOrPolicyGap && !hasEvidenceGap && !hasCaseGap;

  return [{
    consumer: "publicTI",
    ownerLane: "publicTI",
    ready: publicReady,
    reason: publicReady ? "Actor page can show source-backed coverage." : "Actor page needs fresh, case-ready source evidence.",
    route: {
      method: "GET",
      path: lifecycle.publicTiRoute ?? `/ti/${encodeURIComponent(lifecycle.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    requiredFields: ["actor", "publicTiRoute", "freshness.newestEvidenceAt", "sourceHealth"]
  }, {
    consumer: "dashboard",
    ownerLane: "dashboard",
    ready: gaps.length === 0,
    reason: gaps.length === 0 ? "Operator source status can be rendered without additional gap checks." : "Operator source status should show blocked stages and next actions.",
    route: {
      method: "GET",
      path: `/dashboard/ti/sources?actor=${encodeURIComponent(lifecycle.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    requiredFields: ["gaps[].code", "gaps[].nextAction", "lifecycle.blockedStages", "sourceHealth"]
  }, {
    consumer: "alertRebuild",
    ownerLane: "alert",
    ready: alertReady,
    reason: alertReady ? "Alert rebuild can use fresh actor/source evidence." : "Alert rebuild should wait for source freshness and case handoff repair.",
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: lifecycle.actor,
        organizationId: lifecycle.organizationId,
        dryRun: true,
        sourceFreshnessPacketId: stableId("ti_source_provenance_source_freshness_gap_packet_ref", lifecycle.id)
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    requiredFields: ["tenantId", "organizationId", "actor", "freshness.state", "sourcePackActivationReadinessId"]
  }, {
    consumer: "sourceOps",
    ownerLane: "source",
    ready: sourceOpsReady,
    reason: sourceOpsReady ? "Source operations have dry-run actions or source health to inspect." : "Source operations needs candidate intake before activation work can continue.",
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    requiredFields: ["sourceHealth", "gaps[].candidateId", "gaps[].retryAfter", "lifecycle.nextTransitions"]
  }];
}

function parserHealthAlertRows(
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle,
  family: TiSourceProvenanceSourcePackIntakeReceipt["sourceHealth"]["families"][number],
  generatedAt: string
): TiSourceProvenanceParserHealthAlertRow[] {
  const rows: TiSourceProvenanceParserHealthAlertRow[] = [];
  if (family.blockedByPolicy > 0) rows.push(parserHealthAlertRow(lifecycle, family, "policy_blocked", generatedAt));
  if (family.retryScheduled > 0) rows.push(parserHealthAlertRow(lifecycle, family, "parser_retry_scheduled", generatedAt));
  if (family.parserReady === 0 && family.queuedForReview > 0 && family.blockedByPolicy === 0 && family.retryScheduled === 0) {
    rows.push(parserHealthAlertRow(lifecycle, family, "parser_not_ready", generatedAt));
  }
  if (lifecycle.enrichmentFreshness.state === "missing") rows.push(parserHealthAlertRow(lifecycle, family, "freshness_missing", generatedAt));
  return uniqueParserHealthAlertRows(rows);
}

function parserHealthAlertRow(
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle,
  family: TiSourceProvenanceSourcePackIntakeReceipt["sourceHealth"]["families"][number],
  alertType: TiSourceProvenanceParserHealthAlertRow["alertType"],
  generatedAt: string
): TiSourceProvenanceParserHealthAlertRow {
  const evidenceRefs = lifecycleEvidenceRefsForFamily(lifecycle);
  const retryBlocker = lifecycle.blockers.find((blocker) => blocker.code === "parser_retry_scheduled");
  const policyBlocker = lifecycle.blockers.find((blocker) => blocker.code === "policy_approval_required");
  const stage = parserHealthAlertStage(alertType);
  const parserState = parserHealthAlertParserState(alertType);
  const nextAction = parserHealthAlertNextAction(alertType);
  const sourceHealthProofId = stableId("ti_source_provenance_parser_health_source_health", `${lifecycle.id}:${family.family}:${family.queuedForReview}:${family.blockedByPolicy}:${family.retryScheduled}:${family.parserReady}`);

  return {
    alertId: stableId("ti_source_provenance_parser_health_alert", `${lifecycle.id}:${family.family}:${alertType}:${generatedAt}`),
    sourceFamily: family.family,
    alertType,
    severity: alertType === "parser_not_ready" ? "warning" : "blocking",
    sourceIds: evidenceRefs.sourceIds,
    candidateIds: evidenceRefs.candidateIds,
    policyStatus: family.blockedByPolicy > 0 || alertType === "policy_blocked" ? "approval_required" : "allowed",
    parserStatus: {
      state: parserState,
      parserReadyCount: family.parserReady,
      failureReason: alertType === "parser_retry_scheduled"
        ? retryBlocker?.message
        : (alertType === "policy_blocked" ? policyBlocker?.message : undefined)
    },
    retryState: {
      retryable: alertType === "parser_retry_scheduled",
      nextRetryAt: alertType === "parser_retry_scheduled" ? retryBlocker?.retryAfter : undefined,
      nextAction
    },
    provenance: {
      lifecycleId: lifecycle.id,
      sourcePackActivationReadinessId: lifecycle.sourcePackActivationReadinessId,
      stage,
      evidenceGeneratedAt: generatedAt,
      sourceHealthProofId,
      fixtureBacked: true
    },
    freshness: {
      state: lifecycle.enrichmentFreshness.state,
      newestEvidenceAt: lifecycle.enrichmentFreshness.newestEvidenceAt,
      readyCaseRows: lifecycle.enrichmentFreshness.readyCaseRows,
      blockedCaseRows: lifecycle.enrichmentFreshness.blockedCaseRows
    },
    enrichmentGap: {
      type: parserHealthAlertGapType(alertType),
      ownerLane: parserHealthAlertOwnerLane(alertType),
      nextAction
    },
    alertGenerationImpact: {
      ready: false,
      blockedAlertRows: Math.max(1, lifecycle.enrichmentFreshness.blockedCaseRows),
      webhookConsumable: alertType === "parser_retry_scheduled" || alertType === "policy_blocked",
      publicTiReady: false
    },
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: {
        action: parserHealthAlertRouteAction(alertType),
        sourceFamily: family.family,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function parserHealthAlertStage(
  alertType: TiSourceProvenanceParserHealthAlertRow["alertType"]
): TiSourceProvenanceScraperEnrichmentLifecycleStage["stage"] {
  if (alertType === "policy_blocked") return "policy_validation";
  if (alertType === "parser_retry_scheduled") return "retry_backoff";
  if (alertType === "freshness_missing") return "enrichment_freshness";
  return "activation_test";
}

function parserHealthAlertParserState(
  alertType: TiSourceProvenanceParserHealthAlertRow["alertType"]
): TiSourceProvenanceParserHealthAlertRow["parserStatus"]["state"] {
  if (alertType === "policy_blocked") return "blocked";
  if (alertType === "parser_retry_scheduled") return "retry_scheduled";
  if (alertType === "parser_not_ready") return "not_ready";
  return "ready";
}

function parserHealthAlertNextAction(
  alertType: TiSourceProvenanceParserHealthAlertRow["alertType"]
): TiSourceProvenanceParserHealthAlertRow["retryState"]["nextAction"] {
  if (alertType === "policy_blocked") return "request_policy_approval";
  if (alertType === "parser_retry_scheduled") return "retry_parser";
  if (alertType === "freshness_missing") return "repair_provenance";
  return "test_source";
}

function parserHealthAlertGapType(
  alertType: TiSourceProvenanceParserHealthAlertRow["alertType"]
): TiSourceProvenanceParserHealthAlertRow["enrichmentGap"]["type"] {
  if (alertType === "policy_blocked") return "policy_validation";
  if (alertType === "parser_retry_scheduled") return "parser_retry";
  if (alertType === "freshness_missing") return "freshness";
  return "parser_readiness";
}

function parserHealthAlertOwnerLane(
  alertType: TiSourceProvenanceParserHealthAlertRow["alertType"]
): TiSourceProvenanceParserHealthAlertRow["enrichmentGap"]["ownerLane"] {
  if (alertType === "policy_blocked") return "policy";
  if (alertType === "parser_retry_scheduled") return "parser";
  if (alertType === "freshness_missing") return "publicTI";
  return "source";
}

function parserHealthAlertRouteAction(
  alertType: TiSourceProvenanceParserHealthAlertRow["alertType"]
): TiSourceProvenanceParserHealthAlertRow["route"]["body"]["action"] {
  if (alertType === "policy_blocked") return "request_approval";
  if (alertType === "parser_retry_scheduled") return "retry";
  if (alertType === "freshness_missing") return "source_health";
  return "test";
}

function lifecycleEvidenceRefsForFamily(
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle
): { candidateIds: string[]; sourceIds: string[] } {
  return {
    candidateIds: uniqueStrings(lifecycle.stages.flatMap((stage) => stage.evidenceRefs.candidateIds)),
    sourceIds: uniqueStrings(lifecycle.stages.flatMap((stage) => stage.evidenceRefs.sourceIds))
  };
}

function parserHealthAlertConsumers(
  lifecycle: TiSourceProvenanceScraperEnrichmentLifecycle,
  rows: TiSourceProvenanceParserHealthAlertRow[],
  alertGenerationReady: boolean
): TiSourceProvenanceParserHealthAlertConsumer[] {
  return [{
    consumer: "publicTI",
    ready: rows.length === 0 && lifecycle.enrichmentFreshness.state === "fresh",
    requiredFields: ["rows[].sourceFamily", "rows[].parserStatus", "rows[].freshness", "safeOutput.liveNetworkScrapeStarted"],
    route: {
      method: "GET",
      path: lifecycle.publicTiRoute ?? `/ti/${encodeURIComponent(lifecycle.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: alertGenerationReady,
    requiredFields: ["rows[].alertGenerationImpact", "rows[].provenance", "rows[].retryState"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: lifecycle.actor,
        organizationId: lifecycle.organizationId,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: rows.length > 0 || lifecycle.sourceHealth.queuedForReview > 0,
    requiredFields: ["rows[].route", "rows[].policyStatus", "rows[].retryState"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "webhook",
    ready: rows.some((row) => row.alertGenerationImpact.webhookConsumable),
    requiredFields: ["rows[].alertId", "rows[].sourceFamily", "rows[].alertType", "rows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/webhooks/dry-run",
      body: {
        actor: lifecycle.actor,
        dryRun: true,
        sourceAlertRows: rows.map((row) => row.alertId)
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function fallbackParserHealthConsumer(
  consumer: TiSourceProvenanceParserHealthAlertConsumer["consumer"],
  packet: TiSourceProvenanceParserHealthAlertPacket
): TiSourceProvenanceParserHealthAlertConsumer {
  if (consumer === "publicTI") {
    return {
      consumer,
      ready: false,
      requiredFields: ["actor", "publicTiRoute", "safeOutput"],
      route: {
        method: "GET",
        path: packet.publicTiRoute ?? `/ti/${encodeURIComponent(packet.actor)}`,
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (consumer === "alertGeneration") {
    return {
      consumer,
      ready: false,
      requiredFields: ["summary.alertGenerationReady", "rows[]"],
      route: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: { actor: packet.actor, organizationId: packet.organizationId, dryRun: true },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (consumer === "webhook") {
    return {
      consumer,
      ready: false,
      requiredFields: ["rows[].alertId", "rows[].provenance"],
      route: {
        method: "POST",
        path: "/v1/dwm/webhooks/dry-run",
        body: { actor: packet.actor, dryRun: true, sourceAlertRows: [] },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  return {
    consumer,
    ready: false,
    requiredFields: ["rows[].route", "rows[].retryState"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function alertHandoffOrgBlockers(
  packet: TiSourceProvenanceParserHealthAlertPacket,
  expectedOrganizationId?: string
): TiSourceProvenanceAlertHandoffStateBlocker[] {
  if (!packet.organizationId) {
    return [alertHandoffStateBlocker("missing_org_scope", "org", "organizationId", "Alert handoff state requires organization scope.")];
  }
  if (expectedOrganizationId && expectedOrganizationId !== packet.organizationId) {
    return [alertHandoffStateBlocker("source_org_mismatch", "source", "organizationId", "Parser health packet belongs to a different organization.")];
  }
  return [];
}

function duplicateAlertHandoffBlockers(
  rows: TiSourceProvenanceParserHealthAlertRow[]
): TiSourceProvenanceAlertHandoffStateBlocker[] {
  const seen = new Set<string>();
  const duplicates: TiSourceProvenanceAlertHandoffStateBlocker[] = [];
  for (const row of rows) {
    if (!seen.has(row.alertId)) {
      seen.add(row.alertId);
      continue;
    }
    duplicates.push(alertHandoffStateBlocker("duplicate_alert_id", "alert", "rows[].alertId", "Parser health packet repeats an alert handoff row.", row.alertId, row.sourceFamily));
  }
  return duplicates;
}

function alertHandoffStateBlocker(
  code: TiSourceProvenanceAlertHandoffStateBlocker["code"],
  ownerLane: TiSourceProvenanceAlertHandoffStateBlocker["ownerLane"],
  path: string,
  message: string,
  alertId?: string,
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"]
): TiSourceProvenanceAlertHandoffStateBlocker {
  return { code, ownerLane, path, message, alertId, sourceFamily };
}

function uniqueAlertHandoffStateBlockers(
  blockers: TiSourceProvenanceAlertHandoffStateBlocker[]
): TiSourceProvenanceAlertHandoffStateBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}:${blocker.alertId ?? ""}:${blocker.sourceFamily ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueParserHealthRoutes(
  routes: TiSourceProvenanceParserHealthAlertRow["route"][]
): TiSourceProvenanceParserHealthAlertRow["route"][] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = `${route.path}:${route.body.action}:${route.body.sourceFamily}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueParserHealthAlertRows(
  rows: TiSourceProvenanceParserHealthAlertRow[]
): TiSourceProvenanceParserHealthAlertRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.sourceFamily}:${row.alertType}:${row.retryState.nextRetryAt ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceOpsActionRowFromParserAlert(
  freshnessPacket: TiSourceProvenanceSourceFreshnessGapPacket,
  parserHealthPacket: TiSourceProvenanceParserHealthAlertPacket,
  alert: TiSourceProvenanceParserHealthAlertRow,
  generatedAt: string
): TiSourceProvenanceSourceOpsActionQueueRow {
  const action = sourceOpsActionForParserAlert(alert);
  return {
    actionId: stableId("ti_source_provenance_source_ops_action", `${parserHealthPacket.id}:${alert.alertId}:${action}:${generatedAt}`),
    action,
    priority: alert.severity === "blocking" ? "high" : "medium",
    ownerLane: alert.enrichmentGap.ownerLane,
    sourceFamily: alert.sourceFamily,
    candidateIds: alert.candidateIds,
    sourceIds: alert.sourceIds,
    reasonCode: alert.alertType,
    retryState: {
      retryable: alert.retryState.retryable,
      nextRetryAt: alert.retryState.nextRetryAt
    },
    parserStatus: {
      state: alert.parserStatus.state,
      failureReason: alert.parserStatus.failureReason
    },
    freshness: {
      state: freshnessPacket.freshness.state,
      newestEvidenceAt: freshnessPacket.freshness.newestEvidenceAt,
      ageDays: freshnessPacket.freshness.ageDays
    },
    provenance: {
      sourceFreshnessGapPacketId: freshnessPacket.id,
      parserHealthAlertPacketId: parserHealthPacket.id,
      parserHealthAlertId: alert.alertId,
      sourceHealthProofId: alert.provenance.sourceHealthProofId,
      fixtureBacked: true
    },
    route: sourceOpsRouteForAction(action, alert.sourceFamily, alert.candidateIds[0]),
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceOpsActionRowFromFreshnessGap(
  freshnessPacket: TiSourceProvenanceSourceFreshnessGapPacket,
  parserHealthPacket: TiSourceProvenanceParserHealthAlertPacket,
  gap: TiSourceProvenanceSourceFreshnessGap,
  generatedAt: string
): TiSourceProvenanceSourceOpsActionQueueRow {
  const action = sourceOpsActionForFreshnessGap(gap);
  return {
    actionId: stableId("ti_source_provenance_source_ops_action", `${freshnessPacket.id}:${gap.code}:${gap.candidateId ?? ""}:${gap.alertId ?? ""}:${action}:${generatedAt}`),
    action,
    priority: gap.ownerLane === "source" || gap.ownerLane === "parser" || gap.ownerLane === "policy" ? "high" : "medium",
    ownerLane: gap.ownerLane,
    candidateIds: uniqueStrings([gap.candidateId].filter(Boolean).map(String)),
    sourceIds: [],
    reasonCode: gap.code,
    retryState: {
      retryable: gap.nextAction === "retry_parser",
      nextRetryAt: gap.retryAfter
    },
    parserStatus: {
      state: gap.nextAction === "retry_parser" ? "retry_scheduled" : undefined,
      failureReason: gap.message
    },
    freshness: {
      state: freshnessPacket.freshness.state,
      newestEvidenceAt: freshnessPacket.freshness.newestEvidenceAt,
      ageDays: freshnessPacket.freshness.ageDays
    },
    provenance: {
      sourceFreshnessGapPacketId: freshnessPacket.id,
      parserHealthAlertPacketId: parserHealthPacket.id,
      gapCode: gap.code,
      fixtureBacked: true
    },
    route: sourceOpsRouteForAction(action, undefined, gap.candidateId),
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function sourceOpsActionForParserAlert(
  alert: TiSourceProvenanceParserHealthAlertRow
): TiSourceProvenanceSourceOpsActionQueueRow["action"] {
  if (alert.alertType === "parser_retry_scheduled") return "retry_parser";
  if (alert.alertType === "policy_blocked") return "request_policy_approval";
  if (alert.alertType === "freshness_missing") return "repair_provenance";
  return "test_source";
}

function sourceOpsActionForFreshnessGap(
  gap: TiSourceProvenanceSourceFreshnessGap
): TiSourceProvenanceSourceOpsActionQueueRow["action"] {
  if (gap.nextAction === "retry_parser") return "retry_parser";
  if (gap.nextAction === "request_policy_approval") return "request_policy_approval";
  if (gap.nextAction === "repair_provenance" || gap.nextAction === "wait_for_case_handoff" || gap.nextAction === "open_case_handoff") return "repair_provenance";
  if (gap.code === "stale_source_evidence") return "queue_source_refresh";
  if (gap.nextAction === "inspect_source_health") return "inspect_source_health";
  return "test_source";
}

function sourceOpsRouteForAction(
  action: TiSourceProvenanceSourceOpsActionQueueRow["action"],
  sourceFamily?: string,
  candidateId?: string
): TiSourceProvenanceSourceOpsActionQueueRow["route"] {
  if (action === "inspect_source_health") {
    return {
      method: "GET",
      path: "/v1/dwm/source-requests",
      dryRunSupported: true,
      liveNetworkFetch: false
    };
  }
  return {
    method: "POST",
    path: "/v1/dwm/source-requests",
    body: {
      action: sourceOpsRouteAction(action),
      sourceFamily,
      candidateId,
      dryRun: true
    },
    dryRunSupported: true,
    liveNetworkFetch: false
  };
}

function sourceOpsRouteAction(
  action: TiSourceProvenanceSourceOpsActionQueueRow["action"]
): string {
  if (action === "request_policy_approval") return "request_approval";
  if (action === "retry_parser") return "retry";
  if (action === "test_source") return "test";
  if (action === "queue_source_refresh") return "source_health";
  if (action === "repair_provenance") return "source_health";
  return "source_health";
}

function sourceOpsActionQueueConsumers(
  freshnessPacket: TiSourceProvenanceSourceFreshnessGapPacket,
  rows: TiSourceProvenanceSourceOpsActionQueueRow[]
): TiSourceProvenanceSourceOpsActionQueue["consumers"] {
  return [{
    consumer: "sourceOps",
    ready: true,
    requiredFields: ["rows[].action", "rows[].route", "rows[].provenance", "rows[].retryState"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "publicTI",
    ready: rows.length === 0 && freshnessPacket.freshness.state === "fresh",
    requiredFields: ["summary.publicTiReady", "rows[].freshness", "rows[].reasonCode"],
    route: {
      method: "GET",
      path: freshnessPacket.publicTiRoute ?? `/ti/${encodeURIComponent(freshnessPacket.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: true,
    requiredFields: ["rows[].ownerLane", "rows[].sourceFamily", "rows[].parserStatus", "safeOutput.liveNetworkScrapeStarted"],
    route: {
      method: "GET",
      path: `/dashboard/ti/sources?actor=${encodeURIComponent(freshnessPacket.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: rows.length === 0,
    requiredFields: ["summary.alertGenerationReady", "rows[].reasonCode", "rows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: freshnessPacket.actor,
        organizationId: freshnessPacket.organizationId,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function uniqueSourceOpsActionRows(
  rows: TiSourceProvenanceSourceOpsActionQueueRow[]
): TiSourceProvenanceSourceOpsActionQueueRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.action}:${row.reasonCode}:${row.sourceFamily ?? ""}:${row.candidateIds.join(",")}:${row.retryState.nextRetryAt ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSourceFreshnessGaps(
  gaps: TiSourceProvenanceSourceFreshnessGap[]
): TiSourceProvenanceSourceFreshnessGap[] {
  const seen = new Set<string>();
  return gaps.filter((gap) => {
    const key = `${gap.code}:${gap.path}:${gap.candidateId ?? ""}:${gap.alertId ?? ""}:${gap.nextAction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function alertWatchlistItemIds(alert: TiSourceProvenanceAlertRebuildResponseAlert): string[] {
  return uniqueStrings([
    ...(alert.watchlistItemIds ?? []),
    ...(alert.workflowContext?.watchlistItemIds ?? [])
  ]);
}

function alertGeneratorKeys(alert: TiSourceProvenanceAlertRebuildResponseAlert): string[] {
  return uniqueStrings([
    ...(alert.alertGeneratorKeys ?? []),
    ...(alert.workflowContext?.alertGeneratorKeys ?? [])
  ]);
}

function alertSourceBridgeIds(alert: TiSourceProvenanceAlertRebuildResponseAlert): string[] {
  return uniqueStrings([
    alert.sourceBridgeId,
    ...(alert.sourceBridgeIds ?? []),
    alert.workflowContext?.sourceBridgeId,
    ...(alert.workflowContext?.sourceBridgeIds ?? []),
    alert.evidenceSummary?.sourceBridgeId,
    ...(alert.evidenceSummary?.sourceBridgeIds ?? [])
  ].filter(Boolean).map(String));
}

function actorProfileFieldSpecs(
  actor: string,
  values: Partial<Record<TiSourceProvenanceActorProfileFieldName, string[]>>
): Array<{ field: TiSourceProvenanceActorProfileFieldName; values: string[] }> {
  return [
    { field: "aliases", values: values.aliases ?? [actor] },
    { field: "motivations", values: values.motivations ?? [] },
    { field: "sectors", values: values.sectors ?? [] },
    { field: "regions", values: values.regions ?? [] },
    { field: "infrastructure", values: values.infrastructure ?? [] },
    { field: "techniques", values: values.techniques ?? [] },
    { field: "campaigns", values: values.campaigns ?? [] }
  ];
}

function actorProfileGapSourceCandidate(
  profile: TiSourceProvenanceActorProfileContract,
  field: TiSourceProvenanceActorProfileFieldName
): TiSourceProvenanceActorProfileGapSourceCandidate {
  const mapping = actorProfileGapSourceMapping(field);
  const policyBoundary = {
    publicOnly: !mapping.restricted,
    metadataOnly: mapping.metadataOnly,
    restricted: mapping.restricted,
    requiresGovernance: mapping.restricted,
    noCredentials: true as const,
    noAutoJoin: true as const,
    noRepliesOrReactions: true as const,
    noMediaDownloads: true as const,
    liveNetworkFetch: false as const
  };

  return {
    candidateId: stableId("ti_source_provenance_actor_profile_gap_candidate", `${profile.id}:${field}:${mapping.family}:${mapping.parserProfile}`),
    field,
    sourcePackLabel: `${profile.actor} ${field} source coverage`,
    family: mapping.family,
    parserProfile: mapping.parserProfile,
    expectedCaptureType: mapping.expectedCaptureType,
    activationState: mapping.restricted ? "blocked" : "candidate",
    nextAction: mapping.restricted ? "approval_required" : "request_candidate",
    reason: mapping.reason,
    policyBoundary,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function actorProfileGapSourceMapping(field: TiSourceProvenanceActorProfileFieldName): Pick<TiSourceProvenanceActorProfileGapSourceCandidate, "family" | "parserProfile" | "expectedCaptureType" | "reason"> & {
  restricted: boolean;
  metadataOnly: boolean;
} {
  if (field === "motivations" || field === "aliases") {
    return {
      family: "actor_page",
      parserProfile: "actor_page_metadata",
      expectedCaptureType: "actor_metadata",
      restricted: false,
      metadataOnly: true,
      reason: "Actor-page metadata can close identity and motivation gaps without collecting private content."
    };
  }
  if (field === "sectors" || field === "regions" || field === "techniques") {
    return {
      family: "public_advisory",
      parserProfile: "public_advisory",
      expectedCaptureType: "advisory_metadata",
      restricted: false,
      metadataOnly: true,
      reason: "Public advisory metadata can close targeting and technique gaps with timestamped provenance."
    };
  }
  if (field === "infrastructure") {
    return {
      family: "darkweb_metadata",
      parserProfile: "restricted_metadata",
      expectedCaptureType: "restricted_metadata",
      restricted: true,
      metadataOnly: true,
      reason: "Infrastructure gaps may need restricted metadata review; the plan keeps capture metadata-only until governance approves activation."
    };
  }
  return {
    family: "telegram_public",
    parserProfile: "public_channel_handoff",
    expectedCaptureType: "public_channel_metadata",
    restricted: false,
    metadataOnly: true,
    reason: "Public Telegram metadata can close campaign freshness gaps without auto-joining channels or exposing private content."
  };
}

function actorProfileSourceUpdateTask(
  candidate: TiSourceProvenanceActorProfileGapSourceCandidate,
  health?: TiSourceProvenanceActorProfileSourceUpdateHealthInput
): TiSourceProvenanceActorProfileSourceUpdateTask {
  const parserStatus = sourceUpdateParserStatus(candidate, health);
  const activationState = sourceUpdateActivationState(candidate, parserStatus);
  const action = sourceUpdateAction(parserStatus, activationState);
  return {
    taskId: stableId("ti_source_provenance_actor_profile_source_update_task", `${candidate.candidateId}:${parserStatus}:${activationState}`),
    candidateId: candidate.candidateId,
    field: candidate.field,
    family: candidate.family,
    parserProfile: candidate.parserProfile,
    parserStatus,
    activationState,
    lastRun: health?.lastRun,
    nextRetryAt: health?.nextRetryAt,
    failureReason: health?.failureReason ?? health?.lastRun?.failureReason,
    retryable: parserStatus === "failed" || parserStatus === "retry_scheduled",
    nextOperatorAction: action,
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: {
        action: action === "retry_parser" ? "retry" : action === "request_policy_approval" ? "request_approval" : "test",
        candidateId: candidate.candidateId,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourceUpdateParserStatus(
  candidate: TiSourceProvenanceActorProfileGapSourceCandidate,
  health?: TiSourceProvenanceActorProfileSourceUpdateHealthInput
): TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"] {
  if (candidate.activationState === "blocked") return "blocked";
  if (health?.parserStatus) return health.parserStatus;
  return "not_tested";
}

function sourceUpdateActivationState(
  candidate: TiSourceProvenanceActorProfileGapSourceCandidate,
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"]
): TiSourceProvenanceActorProfileSourceUpdateTask["activationState"] {
  if (candidate.activationState === "blocked" || parserStatus === "blocked") return "blocked";
  if (parserStatus === "ready") return "ready_to_test";
  if (parserStatus === "retry_scheduled") return "retry_scheduled";
  if (parserStatus === "failed") return "failed";
  return "candidate";
}

function sourceUpdateAction(
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"],
  activationState: TiSourceProvenanceActorProfileSourceUpdateTask["activationState"]
): TiSourceProvenanceActorProfileSourceUpdateTask["nextOperatorAction"] {
  if (activationState === "blocked") return "request_policy_approval";
  if (parserStatus === "failed" || parserStatus === "retry_scheduled") return "retry_parser";
  if (activationState === "failed") return "review_failure";
  return "test_parser";
}

function actorProfileSourceUpdateHealth(
  tasks: TiSourceProvenanceActorProfileSourceUpdateTask[]
): TiSourceProvenanceActorProfileSourceUpdateWorkflow["health"] {
  const familyNames = tasks.reduce<Array<TiSourceProvenanceActorProfileGapSourceCandidate["family"]>>((items, task) => {
    if (!items.includes(task.family)) items.push(task.family);
    return items;
  }, []);
  const families = familyNames.map((family) => {
    const familyTasks = tasks.filter((task) => task.family === family);
    return {
      family,
      candidates: familyTasks.length,
      readyToTest: familyTasks.filter((task) => task.activationState === "ready_to_test" || task.activationState === "candidate").length,
      blocked: familyTasks.filter((task) => task.activationState === "blocked").length,
      retryScheduled: familyTasks.filter((task) => task.activationState === "retry_scheduled").length,
      failed: familyTasks.filter((task) => task.activationState === "failed").length
    };
  });

  return {
    totalCandidates: tasks.length,
    readyToTest: tasks.filter((task) => task.activationState === "ready_to_test" || task.activationState === "candidate").length,
    blocked: tasks.filter((task) => task.activationState === "blocked").length,
    retryScheduled: tasks.filter((task) => task.activationState === "retry_scheduled").length,
    failed: tasks.filter((task) => task.activationState === "failed").length,
    families
  };
}

function sourcePackIntakeCandidate(
  workflow: TiSourceProvenanceActorProfileSourceUpdateWorkflow,
  task: TiSourceProvenanceActorProfileSourceUpdateTask
): TiSourceProvenanceSourcePackIntakeCandidate {
  const blocked = task.activationState === "blocked" || task.parserStatus === "blocked";
  const retryBlocked = task.parserStatus === "failed" || task.parserStatus === "retry_scheduled";
  const allowed = !blocked && !retryBlocked;

  return {
    candidateId: task.candidateId,
    field: task.field,
    family: task.family,
    targetRef: sourcePackIntakeTargetRef(workflow.actor, task),
    type: sourcePackIntakeType(task.family),
    parserProfile: task.parserProfile,
    parserStatus: task.parserStatus,
    activationState: task.activationState,
    policyBoundary: sourcePackIntakePolicyBoundary(task.family),
    validation: {
      allowed,
      reason: allowed
        ? "Candidate can be submitted as a dry-run source-pack intake row."
        : blocked
          ? "Candidate requires policy approval before intake."
          : "Candidate has parser retry state and should not be submitted until retry/test succeeds.",
      failureReason: task.failureReason,
      nextRetryAt: task.nextRetryAt
    }
  };
}

function sourcePackIntakeType(family: TiSourceProvenanceActorProfileGapSourceCandidate["family"]): TiSourceProvenanceSourcePackIntakeCandidate["type"] {
  if (family === "telegram_public") return "telegram_channel";
  if (family === "darkweb_metadata") return "restricted_metadata";
  return "public_url";
}

function sourcePackIntakeTargetRef(actor: string, task: TiSourceProvenanceActorProfileSourceUpdateTask): string {
  const normalizedActor = actor.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "actor";
  if (task.family === "telegram_public") return `@${normalizedActor}_public_updates`;
  if (task.family === "darkweb_metadata") return `metadata://darkweb/${normalizedActor}/${task.field}`;
  if (task.family === "actor_page") return `https://example.com/threat-actors/${normalizedActor}`;
  return `https://example.com/security/advisory/${normalizedActor}-${task.field}`;
}

function sourcePackIntakePolicyBoundary(
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"]
): TiSourceProvenanceActorProfileGapSourceCandidate["policyBoundary"] {
  const restricted = family === "darkweb_metadata";
  return {
    publicOnly: !restricted,
    metadataOnly: true,
    restricted,
    requiresGovernance: restricted,
    noCredentials: true,
    noAutoJoin: true,
    noRepliesOrReactions: true,
    noMediaDownloads: true,
    liveNetworkFetch: false
  };
}

function sourcePackIntakeReceiptRow(
  candidate: TiSourceProvenanceSourcePackIntakeCandidate,
  status: TiSourceProvenanceSourcePackIntakeReceiptRow["status"]
): TiSourceProvenanceSourcePackIntakeReceiptRow {
  return {
    candidateId: candidate.candidateId,
    sourceId: status === "queued_for_review" ? stableId("ti_source_candidate_source", `${candidate.candidateId}:${candidate.targetRef}`) : undefined,
    family: candidate.family,
    field: candidate.field,
    targetRef: candidate.targetRef,
    status,
    parserStatus: candidate.parserStatus,
    activationState: candidate.activationState,
    testJobId: status === "queued_for_review" ? stableId("ti_source_candidate_test_job", `${candidate.candidateId}:${candidate.parserProfile}`) : undefined,
    failureReason: candidate.validation.failureReason ?? (!candidate.validation.allowed ? candidate.validation.reason : undefined),
    nextRetryAt: candidate.validation.nextRetryAt,
    policyBoundary: candidate.policyBoundary
  };
}

function sourcePackIntakeReceiptHealth(
  rows: TiSourceProvenanceSourcePackIntakeReceiptRow[]
): TiSourceProvenanceSourcePackIntakeReceipt["sourceHealth"] {
  const families = rows.reduce<Array<TiSourceProvenanceActorProfileGapSourceCandidate["family"]>>((items, row) => {
    if (!items.includes(row.family)) items.push(row.family);
    return items;
  }, []).map((family) => {
    const familyRows = rows.filter((row) => row.family === family);
    return {
      family,
      queuedForReview: familyRows.filter((row) => row.status === "queued_for_review").length,
      blockedByPolicy: familyRows.filter((row) => row.status === "blocked_by_policy").length,
      retryScheduled: familyRows.filter((row) => row.status === "retry_scheduled").length,
      parserReady: familyRows.filter((row) => row.parserStatus === "ready").length
    };
  });

  return {
    queuedForReview: rows.filter((row) => row.status === "queued_for_review").length,
    blockedByPolicy: rows.filter((row) => row.status === "blocked_by_policy").length,
    retryScheduled: rows.filter((row) => row.status === "retry_scheduled").length,
    parserReady: rows.filter((row) => row.parserStatus === "ready").length,
    families,
    nextRetryAt: earliestTimestamp(rows.map((row) => row.nextRetryAt))
  };
}

function sourcePackActivationAction(row: TiSourceProvenanceSourcePackIntakeReceiptRow): TiSourceProvenanceSourcePackActivationAction {
  const action = row.status === "queued_for_review"
    ? "test_source"
    : row.status === "retry_scheduled"
      ? "retry_parser"
      : "request_policy_approval";
  return {
    actionId: stableId("ti_source_provenance_source_pack_activation_action", `${row.candidateId}:${row.status}:${row.sourceId ?? ""}`),
    action,
    candidateId: row.candidateId,
    sourceId: row.sourceId,
    family: row.family,
    parserStatus: row.parserStatus,
    activationState: row.activationState,
    reason: sourcePackActivationReason(row),
    nextRetryAt: row.nextRetryAt,
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: {
        action: action === "test_source" ? "test" : action === "retry_parser" ? "retry" : "request_approval",
        candidateId: row.candidateId,
        sourceId: row.sourceId,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourcePackActivationReason(row: TiSourceProvenanceSourcePackIntakeReceiptRow): string {
  if (row.status === "queued_for_review") return "Candidate has a queued source row and can run fixture-backed parser/source health test.";
  if (row.status === "retry_scheduled") return row.failureReason ?? "Parser retry is scheduled before candidate can be tested again.";
  return row.failureReason ?? "Policy approval is required before this source can be activated.";
}

function rowsForActorProfileField(
  field: TiSourceProvenanceActorProfileFieldName,
  rows: TiSourceProvenancePageRow[]
): TiSourceProvenancePageRow[] {
  return rows.filter((row) => {
    const relationship = String(row.relationship ?? "");
    const family = String(row.sourceFamily ?? "");
    if (field === "aliases") return true;
    if (field === "motivations") return relationship === "actor_activity" || family === "actor_page";
    if (field === "sectors" || field === "regions") return relationship === "targeting" || family === "public_advisory" || family === "darkweb_metadata";
    if (field === "infrastructure") return relationship === "infrastructure" || family === "public_advisory" || family === "darkweb_onion";
    if (field === "techniques") return relationship === "tooling" || family === "actor_page" || family === "public_advisory";
    return relationship === "actor_activity" || family === "telegram_public" || family === "public_advisory";
  });
}

function sourceProvenanceAlertRebuildActions(
  contract: TiSourceProvenancePageContract,
  candidate: TiSourceProvenanceOrgWatchlistCandidate,
  request: TiSourceProvenanceAlertRebuildRequest
): TiSourceProvenanceAlertRebuildReadiness["nextOperatorActions"] {
  if (!contract.ok) {
    return [{
      action: "fix_source_provenance",
      ownerLane: "source",
      reason: "Source evidence needs complete provenance, capture ids, content hashes, active source state, and current freshness before alert rebuild.",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  if (!candidate.ok) {
    return [{
      action: "materialize_watchlist_terms",
      ownerLane: "org",
      reason: "Source-backed watchlist terms must be materialized before alert rebuild can be requested.",
      route: {
        method: "POST",
        path: "/v1/organizations/watchlists/terms",
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  return [{
    action: "request_alert_rebuild",
    ownerLane: "alert",
    reason: request.ok ? "Dry-run alert rebuild request is ready for the alert workflow lane." : "Alert rebuild request still has typed blockers.",
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourceProvenanceWatchlistAlertBridgeActions(
  blockers: Array<TiSourceProvenanceAlertabilityBlocker | TiSourceProvenanceAlertRebuildRequestBlocker>
): TiSourceProvenanceWatchlistAlertBridgePacket["nextActions"] {
  if (!blockers.length) {
    return [{
      ownerLane: "alert",
      action: "request_alert_rebuild",
      route: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  return uniqueBlockers(blockers).map((blocker) => {
    const action = blocker.ownerLane === "source" || blocker.ownerLane === "publicTI"
      ? "repair_source_provenance"
      : blocker.ownerLane === "org"
        ? "materialize_watchlist_terms"
        : "request_alert_rebuild";
    const path = action === "repair_source_provenance"
      ? "/v1/dwm/source-requests"
      : action === "materialize_watchlist_terms"
        ? "/v1/organizations/watchlists/terms"
        : "/v1/dwm/alerts/rebuild";
    return {
      ownerLane: blocker.ownerLane,
      action,
      blockerCode: blocker.code,
      route: {
        method: "POST",
        path,
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  });
}

function uniqueBlockers<T extends { code: string; path: string; message: string }>(blockers: T[]): T[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}:${blocker.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function blockerPath(code: TiSourceProvenancePageBlocker["code"]): string {
  if (code === "missing_source_id") return "rows[].sourceId";
  if (code === "missing_capture_id") return "rows[].captureId";
  if (code === "missing_content_hash") return "rows[].contentHash";
  if (code === "missing_provenance") return "rows[].provenance";
  if (code === "inactive_source") return "rows[].sourceStatus";
  if (code === "organization_scope_mismatch") return "rows[].organizationId";
  return "rows[].capturedAt";
}

function blockerMessage(code: TiSourceProvenancePageBlocker["code"]): string {
  if (code === "missing_source_id") return "Source evidence is missing source identity.";
  if (code === "missing_capture_id") return "Source evidence is missing capture identity.";
  if (code === "missing_content_hash") return "Source evidence is missing content hash.";
  if (code === "missing_provenance") return "Source evidence is missing provenance text.";
  if (code === "inactive_source") return "Source evidence came from an inactive source.";
  if (code === "organization_scope_mismatch") return "Source evidence belongs to another organization.";
  return "Source evidence is older than the accepted freshness window.";
}

function operatorActionForBlocker(code: TiSourceProvenancePageBlocker["code"], rowId: string, row: TiSourceProvenanceInputRow): TiSourceProvenancePageAction {
  const action = actionTypeForBlocker(code);
  return {
    action,
    ownerLane: code === "organization_scope_mismatch" ? "publicTI" : "source",
    rowId,
    sourceId: row.sourceId,
    captureId: row.captureId,
    reason: blockerMessage(code),
    route: {
      method: "POST",
      path: action === "fix_organization_scope" ? "/v1/actor-org-relevance/review" : "/v1/dwm/source-requests",
      body: {
        action,
        actor: row.actor,
        sourceId: row.sourceId,
        captureId: row.captureId,
        sourceFamily: row.sourceFamily,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function actionTypeForBlocker(code: TiSourceProvenancePageBlocker["code"]): TiSourceProvenancePageAction["action"] {
  if (code === "missing_source_id") return "attach_source_identity";
  if (code === "missing_capture_id") return "record_capture";
  if (code === "missing_content_hash") return "record_content_hash";
  if (code === "missing_provenance") return "record_provenance";
  if (code === "inactive_source") return "review_source_activation";
  if (code === "organization_scope_mismatch") return "fix_organization_scope";
  return "retry_capture";
}

function uniqueActionRows(actions: TiSourceProvenancePageAction[]): TiSourceProvenancePageAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.rowId}:${action.action}:${action.sourceId ?? ""}:${action.captureId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function newestTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function earliestTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(0);
}

function daysBetween(start: string, end: string): number {
  const deltaMs = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(deltaMs)) return Number.POSITIVE_INFINITY;
  return deltaMs / 86_400_000;
}

function clampConfidence(value: unknown): number {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, numberValue));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(3));
}
