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
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_gap_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_EXPORT_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_coverage_export.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_HANDOFF_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_coverage_handoff.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CONSUMER_READINESS_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_consumer_readiness_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_ALERT_READINESS_BRIDGE_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_source_alert_readiness_bridge.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_PARSER_STATUS_AUDIT_PACKET_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_parser_status_audit_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_PROFILE_SOURCE_UPDATE_WORKFLOW_SCHEMA_VERSION = "ti.source_provenance_actor_profile_source_update_workflow.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_REQUEST_SCHEMA_VERSION = "ti.source_provenance_source_pack_intake_request.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_source_pack_intake_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_ACTIVATION_READINESS_SCHEMA_VERSION = "ti.source_provenance_source_pack_activation_readiness.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_AUDIT_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_activation_audit_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_source_activation_decision_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_GROWTH_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_growth_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_CATALOG_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_catalog_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_READINESS_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_alert_readiness_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_DEDUPE_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_alert_dedupe_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_HEALTH_DRILLDOWN_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_health_drilldown_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_INTELLIGENCE_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_intelligence_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_OPERATOR_REMEDIATION_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_operator_remediation_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_EXECUTION_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_action_execution_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_AUDIT_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_action_audit_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_DRILLDOWN_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_action_drilldown_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_ALERT_BRIDGE_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_action_alert_bridge_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_READINESS_EXPORT_SCHEMA_VERSION = "ti.source_provenance_source_pack_fixture_readiness_export.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_RETRY_POLICY_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_retry_policy_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_CANDIDATE_VALIDATION_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_source_candidate_validation_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_SOURCE_COVERAGE_PORTFOLIO_SCHEMA_VERSION = "ti.source_provenance_actor_source_coverage_portfolio.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_ALERT_PREREQUISITE_PACKET_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_alert_prerequisite_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_HEALTH_EVENT_PACKET_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_source_health_event_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_HEALTH_MONITORING_FILTER_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_health_monitoring_filter_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_LIFECYCLE_CLEANUP_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_pack_lifecycle_cleanup_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_SCRAPER_ENRICHMENT_LIFECYCLE_SCHEMA_VERSION = "ti.source_provenance_scraper_enrichment_lifecycle.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION = "ti.source_provenance_source_freshness_gap_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION = "ti.source_provenance_parser_health_alert_packet.v1" as const;
export const TI_SOURCE_PROVENANCE_PARSER_HEALTH_PROVENANCE_SUMMARY_SCHEMA_VERSION = "ti.source_provenance_parser_health_provenance_summary.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_HANDOFF_STATE_SCHEMA_VERSION = "ti.source_provenance_alert_handoff_state.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION = "ti.source_provenance_source_ops_action_queue.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_OPS_FIXTURE_BUNDLE_SCHEMA_VERSION = "ti.source_provenance_source_ops_fixture_bundle.v1" as const;
export const TI_SOURCE_PROVENANCE_PUBLIC_TI_SOURCE_OPS_PROJECTION_SCHEMA_VERSION = "ti.source_provenance_public_ti_source_ops_projection.v1" as const;
export const TI_SOURCE_PROVENANCE_PROJECTION_WATCHLIST_RELEVANCE_SCHEMA_VERSION = "ti.source_provenance_projection_watchlist_relevance.v1" as const;

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

export type TiSourceProvenanceActorEnrichmentGapReceipt = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  actorProfileContractId: string;
  sourcePlanId?: string;
  parserHealthProvenanceSummaryId?: string;
  rows: TiSourceProvenanceActorEnrichmentGapReceiptRow[];
  coverage: {
    totalGaps: number;
    candidateBackedGaps: number;
    readyFamilies: number;
    blockedFamilies: number;
    retryableGaps: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    lastSuccessAt?: string;
    lastFailureAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "sourceOps";
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

export type TiSourceProvenanceActorEnrichmentGapReceiptRow = {
  rowId: string;
  gapCode: TiSourceProvenanceActorProfileGap["code"];
  field: TiSourceProvenanceActorProfileGap["field"];
  ownerLane: TiSourceProvenanceActorProfileGap["ownerLane"] | "parser" | "policy";
  status: "candidate_ready" | "parser_retry" | "policy_blocked" | "missing_candidate" | "source_ready";
  candidateId?: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserState?: TiSourceProvenanceParserHealthProvenanceFamilyRow["parserState"];
  parserStatus?: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  activationState?: TiSourceProvenanceActorProfileSourceUpdateTask["activationState"];
  nextAction: "request_candidate" | "test_source" | "retry_parser" | "request_policy_approval" | "inspect_source_health";
  nextRetryAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  coverageCounts: {
    activationTestsQueued: number;
    parserRetriesQueued: number;
    policyReviewsRequired: number;
    alertableCandidates: number;
  };
  provenance: {
    actorProfileContractId: string;
    sourcePlanId?: string;
    parserHealthProvenanceSummaryId?: string;
    sourceHealthProofIds: string[];
    activationDecisionIds: string[];
    fixtureBacked: true;
  };
};

export type TiSourceProvenanceActorEnrichmentCoverageExport = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_EXPORT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  actorEnrichmentGapReceiptId: string;
  coverageRows: TiSourceProvenanceActorEnrichmentCoverageExportRow[];
  blockers: TiSourceProvenanceActorEnrichmentCoverageExportBlocker[];
  summary: {
    fieldCount: number;
    coveredFieldCount: number;
    blockedFieldCount: number;
    retryableFieldCount: number;
    alertableFamilyCount: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    lastSuccessAt?: string;
    lastFailureAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "sourceOps";
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

export type TiSourceProvenanceActorEnrichmentCoverageExportRow = {
  rowId: string;
  field: TiSourceProvenanceActorProfileGap["field"];
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  coverageState: "covered" | "pending" | "retry" | "blocked";
  parserStatus?: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  lastSuccessAt?: string;
  lastFailureAt?: string;
  nextRetryAt?: string;
  alertableCandidates: number;
  blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
  provenance: {
    actorEnrichmentGapReceiptId: string;
    gapReceiptRowId?: string;
    sourceHealthProofIds: string[];
    activationDecisionIds: string[];
    fixtureBacked: true;
  };
};

export type TiSourceProvenanceActorEnrichmentCoverageExportBlocker = {
  code: "missing_candidate" | "parser_retry" | "policy_blocked" | "coverage_pending";
  ownerLane: "source" | "parser" | "policy" | "publicTI";
  field: TiSourceProvenanceActorProfileGap["field"];
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  nextAction: TiSourceProvenanceActorEnrichmentGapReceiptRow["nextAction"];
  nextRetryAt?: string;
  provenanceRef: string;
};

export type TiSourceProvenanceActorEnrichmentCoverageHandoff = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_HANDOFF_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  actorEnrichmentCoverageExportId: string;
  publicTi: {
    ready: boolean;
    route: string;
    fields: TiSourceProvenanceActorEnrichmentCoverageHandoffField[];
  };
  alertGeneration: {
    ready: boolean;
    route: {
      method: "POST";
      path: string;
      body: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
    rows: TiSourceProvenanceActorEnrichmentCoverageHandoffAlertRow[];
  };
  sourceOps: {
    ready: boolean;
    actions: TiSourceProvenanceActorEnrichmentCoverageHandoffAction[];
  };
  summary: {
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    coveredFieldCount: number;
    pendingFieldCount: number;
    retryableFieldCount: number;
    blockedFieldCount: number;
    alertableFieldCount: number;
    lastSuccessAt?: string;
    lastFailureAt?: string;
    nextRetryAt?: string;
    blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "sourceOps";
    ready: boolean;
    requiredFields: string[];
  }>;
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceActorEnrichmentCoverageHandoffField = {
  field: TiSourceProvenanceActorProfileGap["field"];
  state: TiSourceProvenanceActorEnrichmentCoverageExportRow["coverageState"];
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus?: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  lastSuccessAt?: string;
  lastFailureAt?: string;
  nextRetryAt?: string;
  alertableCandidates: number;
  blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
  provenance: {
    actorEnrichmentCoverageExportId: string;
    coverageRowId: string;
    sourceHealthProofIds: string[];
    activationDecisionIds: string[];
    fixtureBacked: true;
  };
};

export type TiSourceProvenanceActorEnrichmentCoverageHandoffAlertRow = {
  field: TiSourceProvenanceActorProfileGap["field"];
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  matchable: boolean;
  parserStatus?: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  retryReady: boolean;
  nextRetryAt?: string;
  blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
  provenanceIds: {
    actorEnrichmentCoverageExportId: string;
    coverageRowId: string;
    sourceHealthProofIds: string[];
    activationDecisionIds: string[];
  };
};

export type TiSourceProvenanceActorEnrichmentCoverageHandoffAction = {
  action: "inspect" | "retry" | "request_policy_approval" | "review_candidate";
  field: TiSourceProvenanceActorProfileGap["field"];
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  blockerCode: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"];
  parserStatus?: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  nextRetryAt?: string;
  provenanceRef: string;
};

export type TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CONSUMER_READINESS_RECEIPT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  actorEnrichmentCoverageHandoffId: string;
  rows: TiSourceProvenanceActorEnrichmentConsumerReadinessRow[];
  blockerSummary: TiSourceProvenanceActorEnrichmentConsumerReadinessBlocker[];
  sourceHealth: {
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    coveredFieldCount: number;
    pendingFieldCount: number;
    retryableFieldCount: number;
    blockedFieldCount: number;
    alertableFieldCount: number;
    lastSuccessAt?: string;
    lastFailureAt?: string;
    nextRetryAt?: string;
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
    crossOrgDataIncluded: false;
  };
};

export type TiSourceProvenanceActorEnrichmentConsumerReadinessRow = {
  consumer: "publicTI" | "alertGeneration" | "sourceOps";
  ready: boolean;
  state: "ready" | "blocked" | "action_required";
  route?: string;
  sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  coverageCounts: {
    covered: number;
    pending: number;
    retryable: number;
    blocked: number;
    alertable: number;
  };
  retry: {
    retryable: boolean;
    nextRetryAt?: string;
    retryFields: TiSourceProvenanceActorProfileGap["field"][];
  };
  blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
  provenanceIds: {
    actorEnrichmentCoverageHandoffId: string;
    coverageExportId: string;
    sourceHealthProofIds: string[];
    activationDecisionIds: string[];
  };
};

export type TiSourceProvenanceActorEnrichmentConsumerReadinessBlocker = {
  code: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"];
  consumer: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["consumer"];
  field: TiSourceProvenanceActorProfileGap["field"];
  ownerLane: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["ownerLane"];
  action: TiSourceProvenanceActorEnrichmentCoverageHandoffAction["action"];
  nextRetryAt?: string;
  provenanceRef: string;
};

export type TiSourceProvenanceActorEnrichmentSourceAlertReadinessBridge = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_ALERT_READINESS_BRIDGE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  consumerReadinessReceiptId: string;
  readiness: {
    state: "ready" | "partial" | "blocked";
    publicTI: boolean;
    alertGeneration: boolean;
    sourceOpsActionRequired: boolean;
  };
  publicTi: {
    ready: boolean;
    route?: string;
    coverageCounts: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["coverageCounts"];
    blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
    provenanceIds: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["provenanceIds"];
  };
  alertGeneration: {
    ready: boolean;
    route?: string;
    matchableFieldCount: number;
    retryable: boolean;
    nextRetryAt?: string;
    blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
    provenanceIds: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["provenanceIds"];
  };
  sourceHealth: TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt["sourceHealth"];
  operatorActions: TiSourceProvenanceActorEnrichmentSourceAlertReadinessAction[];
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "sourceOps";
    ready: boolean;
    requiredFields: string[];
  }>;
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
    crossOrgDataIncluded: false;
  };
};

export type TiSourceProvenanceActorEnrichmentSourceAlertReadinessAction = {
  action: TiSourceProvenanceActorEnrichmentCoverageHandoffAction["action"];
  consumer: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["consumer"];
  field: TiSourceProvenanceActorProfileGap["field"];
  blockerCode: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"];
  ownerLane: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["ownerLane"];
  nextRetryAt?: string;
  provenanceRef: string;
};

export type TiSourceProvenanceActorEnrichmentParserStatusAuditPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_PARSER_STATUS_AUDIT_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  consumerReadinessReceiptId: string;
  events: TiSourceProvenanceActorEnrichmentParserStatusAuditEvent[];
  summary: {
    totalEvents: number;
    readyConsumers: number;
    blockedConsumers: number;
    actionRequiredEvents: number;
    retryableEvents: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    blockerCodes: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];
    lastSuccessAt?: string;
    lastFailureAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "sourceOps";
    ready: boolean;
    requiredFields: string[];
  }>;
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
    crossOrgDataIncluded: false;
  };
};

export type TiSourceProvenanceActorEnrichmentParserStatusAuditEvent = {
  eventId: string;
  eventType: "consumer_readiness" | "blocker_action";
  consumer: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["consumer"];
  state: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["state"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  coverageCounts: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["coverageCounts"];
  retry: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["retry"];
  blockerCode?: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"];
  field?: TiSourceProvenanceActorProfileGap["field"];
  ownerLane?: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["ownerLane"];
  action?: TiSourceProvenanceActorEnrichmentCoverageHandoffAction["action"];
  lastSuccessAt?: string;
  lastFailureAt?: string;
  provenanceIds: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["provenanceIds"];
  provenanceRef?: string;
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

export type TiSourceProvenanceSourceActivationAuditPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_AUDIT_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourcePackActivationReadinessId: string;
  events: TiSourceProvenanceSourceActivationAuditEvent[];
  summary: {
    eventCount: number;
    readyToTest: number;
    retryScheduled: number;
    policyBlocked: number;
    parserReady: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "sourceOps" | "publicTI" | "alertGeneration";
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

export type TiSourceProvenanceSourceActivationAuditEvent = {
  eventId: string;
  candidateId: string;
  sourceId?: string;
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  status: "ready_to_test" | "retry_scheduled" | "policy_blocked";
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  activationState: TiSourceProvenanceActorProfileSourceUpdateTask["activationState"];
  decision: "queue_activation_test" | "retry_parser" | "request_policy_review";
  reason: string;
  nextRetryAt?: string;
  provenance: {
    sourcePackActivationReadinessId: string;
    activationActionId: string;
    sourceHealthProofId: string;
    fixtureBacked: true;
  };
  route: TiSourceProvenanceSourcePackActivationAction["route"];
  alertability: {
    canGenerateAlertEvidence: boolean;
    blockedByPolicy: boolean;
    blockedByParser: boolean;
  };
};

export type TiSourceProvenanceSourceActivationDecisionReceipt = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceActivationAuditPacketId: string;
  decisions: TiSourceProvenanceSourceActivationDecision[];
  familyCoverage: Array<{
    family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
    activationTestsQueued: number;
    parserRetriesQueued: number;
    policyReviewsRequired: number;
    alertableCandidates: number;
  }>;
  summary: {
    decisionCount: number;
    activationTestsQueued: number;
    parserRetriesQueued: number;
    policyReviewsRequired: number;
    alertableCandidates: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    lastSuccessAt?: string;
    lastFailureAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "sourceOps" | "publicTI" | "alertGeneration";
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

export type TiSourceProvenanceSourceActivationDecision = {
  decisionId: string;
  eventId: string;
  candidateId: string;
  sourceId?: string;
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  outcome: "activation_test_queued" | "parser_retry_queued" | "policy_review_required";
  status: "accepted" | "retry_scheduled" | "blocked";
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  activationState: TiSourceProvenanceActorProfileSourceUpdateTask["activationState"];
  lastSuccessAt?: string;
  lastFailureAt?: string;
  nextRetryAt?: string;
  reason: string;
  provenance: {
    sourceActivationAuditPacketId: string;
    sourcePackActivationReadinessId: string;
    activationActionId: string;
    sourceHealthProofId: string;
    fixtureBacked: true;
  };
  alertability: TiSourceProvenanceSourceActivationAuditEvent["alertability"];
  route: TiSourceProvenanceSourceActivationAuditEvent["route"];
};

export type TiSourceProvenanceSourcePackFixtureGrowthPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_GROWTH_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceActivationDecisionReceiptId: string;
  rows: TiSourceProvenanceSourcePackFixtureGrowthRow[];
  summary: {
    rowCount: number;
    actorEnrichmentUpdates: number;
    alertReadyCaptures: number;
    healthySources: number;
    degradedSources: number;
    staleSources: number;
    blockedSources: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    newestFreshnessAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "sourceOps";
    ready: boolean;
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
    requiredFields: string[];
  }>;
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
    crossOrgDataIncluded: false;
  };
};

export type TiSourceProvenanceSourcePackFixtureGrowthRow = {
  rowId: string;
  rowType: "actor_enrichment_update" | "alert_ready_capture" | "source_blocker";
  actor: string;
  publicTiRoute: string;
  sourceId?: string;
  candidateId: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: "healthy" | "degraded" | "stale" | "blocked";
  freshness: {
    state: "fresh" | "stale" | "missing";
    observedAt?: string;
    nextRetryAt?: string;
  };
  retry: {
    retryable: boolean;
    nextRetryAt?: string;
    policyReviewRequired: boolean;
  };
  blockerReason?: string;
  downstreamRoutes: {
    publicTI: string;
    alertGeneration: string;
    sourceOps: string;
  };
  provenance: {
    sourceActivationDecisionReceiptId: string;
    sourceActivationAuditPacketId: string;
    sourcePackActivationReadinessId: string;
    activationActionId: string;
    sourceHealthProofId: string;
    captureId: string;
    contentHash: string;
    fixtureBacked: true;
  };
};

export type TiSourceProvenanceSourcePackFixtureCatalogPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_CATALOG_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureGrowthPacketIds: string[];
  rows: TiSourceProvenanceSourcePackFixtureCatalogRow[];
  summary: {
    rowCount: number;
    actorCount: number;
    alertReadyRows: number;
    blockedRows: number;
    averageConfidence: number;
    actors: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
    coverageTags: string[];
    newestObservedAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureGrowthPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureCatalogRow = {
  catalogRowId: string;
  growthRowId: string;
  sourcePackFixtureGrowthPacketId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  rowType: TiSourceProvenanceSourcePackFixtureGrowthRow["rowType"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"];
  observedAt?: string;
  nextRetryAt?: string;
  confidence: number;
  coverageTags: string[];
  downstreamRoutes: TiSourceProvenanceSourcePackFixtureGrowthRow["downstreamRoutes"];
  provenance: {
    sourceActivationDecisionReceiptId: string;
    sourceActivationAuditPacketId: string;
    sourcePackActivationReadinessId: string;
    activationActionId: string;
    sourceHealthProofId: string;
    captureId: string;
    contentHash: string;
    fixtureBacked: true;
  };
};

export type TiSourceProvenanceSourcePackFixtureAlertReadinessPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_READINESS_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureCatalogPacketId: string;
  rows: TiSourceProvenanceSourcePackFixtureAlertReadinessRow[];
  summary: {
    rowCount: number;
    readyRows: number;
    partialRows: number;
    blockedRows: number;
    averageConfidence: number;
    actors: string[];
    publicTiRoutes: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
    coverageTags: string[];
    prerequisiteCodes: TiSourceProvenanceSourcePackFixtureAlertReadinessPrerequisite["code"][];
    newestObservedAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureCatalogPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureAlertReadinessRow = {
  readinessRowId: string;
  catalogRowId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  rowType: TiSourceProvenanceSourcePackFixtureGrowthRow["rowType"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"];
  alertReadiness: "ready" | "partial" | "blocked";
  observedAt?: string;
  nextRetryAt?: string;
  confidence: number;
  coverageTags: string[];
  prerequisites: TiSourceProvenanceSourcePackFixtureAlertReadinessPrerequisite[];
  remediation: {
    action: "queue_alert_rebuild" | "retry_parser" | "request_policy_review" | "materialize_watchlist_terms" | "inspect_source_health";
    ownerLane: "alert" | "parser" | "policy" | "source" | "org";
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
    reason: string;
  };
  downstreamRoutes: TiSourceProvenanceSourcePackFixtureCatalogRow["downstreamRoutes"];
  provenance: TiSourceProvenanceSourcePackFixtureCatalogRow["provenance"];
};

export type TiSourceProvenanceSourcePackFixtureAlertReadinessPrerequisite = {
  code: "parser_retry_required" | "policy_review_required" | "watchlist_materialization_required" | "parser_health_inspection_required";
  ownerLane: "parser" | "policy" | "org" | "source";
  nextAction: "retry_parser" | "request_policy_review" | "materialize_watchlist_terms" | "inspect_source_health";
  reason: string;
  nextRetryAt?: string;
  route: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenanceSourcePackFixtureAlertDedupePacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_DEDUPE_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureAlertReadinessPacketId: string;
  rows: TiSourceProvenanceSourcePackFixtureAlertDedupeRow[];
  summary: {
    rowCount: number;
    canonicalReadyRows: number;
    duplicateRows: number;
    heldRows: number;
    actors: string[];
    publicTiRoutes: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    blockerCodes: TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode[];
    newestObservedAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureAlertReadinessPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode =
  | "duplicate_fixture_capture"
  | "missing_provenance"
  | "not_alert_ready"
  | "parser_retry_required"
  | "policy_review_required"
  | "watchlist_materialization_required"
  | "parser_health_inspection_required";

export type TiSourceProvenanceSourcePackFixtureAlertDedupeRow = {
  dedupeRowId: string;
  readinessRowId: string;
  dedupeKey: string;
  dedupeState: "canonical" | "duplicate" | "held";
  alertEligibility: "ready" | "held";
  actor: string;
  publicTiRoute: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"];
  alertReadiness: TiSourceProvenanceSourcePackFixtureAlertReadinessRow["alertReadiness"];
  confidence: number;
  observedAt?: string;
  nextRetryAt?: string;
  blockerCodes: TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode[];
  duplicateOf?: string;
  action: {
    action: "queue_alert_rebuild" | "suppress_duplicate" | "resolve_prerequisite" | "inspect_provenance";
    ownerLane: "alert" | "source" | "parser" | "policy" | "org";
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  };
  downstreamRoutes: TiSourceProvenanceSourcePackFixtureAlertReadinessRow["downstreamRoutes"];
  provenance: TiSourceProvenanceSourcePackFixtureAlertReadinessRow["provenance"];
};

export type TiSourceProvenanceSourcePackFixtureHealthDrilldownPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_HEALTH_DRILLDOWN_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureAlertDedupePacketId: string;
  rows: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[];
  filters: TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter[];
  summary: {
    rowCount: number;
    activeRows: number;
    retryableRows: number;
    policyBlockedRows: number;
    duplicateRows: number;
    alertReadyRows: number;
    actors: string[];
    publicTiRoutes: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
    activationStates: TiSourceProvenanceSourcePackFixtureHealthDrilldownActivationState[];
    failureCodes: TiSourceProvenanceSourcePackFixtureHealthDrilldownFailureCode[];
    newestObservedAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureAlertDedupePacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureHealthDrilldownActivationState =
  | "active"
  | "retry_scheduled"
  | "policy_blocked"
  | "suppressed_duplicate"
  | "pending_watchlist"
  | "inspect_required";

export type TiSourceProvenanceSourcePackFixtureHealthDrilldownFailureCode =
  | TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode
  | "none";

export type TiSourceProvenanceSourcePackFixtureHealthDrilldownRow = {
  drilldownRowId: string;
  dedupeRowId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"];
  activationState: TiSourceProvenanceSourcePackFixtureHealthDrilldownActivationState;
  alertEligibility: TiSourceProvenanceSourcePackFixtureAlertDedupeRow["alertEligibility"];
  confidence: number;
  observedAt?: string;
  retry: {
    retryable: boolean;
    nextRetryAt?: string;
    backoffReason?: string;
  };
  failure: {
    code: TiSourceProvenanceSourcePackFixtureHealthDrilldownFailureCode;
    ownerLane: "alert" | "source" | "parser" | "policy" | "org";
    reason: string;
    nextAction: "queue_alert_rebuild" | "suppress_duplicate" | "retry_parser" | "request_policy_review" | "materialize_watchlist_terms" | "inspect_source_health";
  };
  downstreamRoutes: TiSourceProvenanceSourcePackFixtureAlertDedupeRow["downstreamRoutes"];
  provenance: TiSourceProvenanceSourcePackFixtureAlertDedupeRow["provenance"];
};

export type TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter = {
  filterId: string;
  kind: "actor" | "source_family" | "parser_status" | "health_state" | "activation_state" | "failure_code" | "retry_window" | "alert_eligibility";
  value: string;
  count: number;
  readyCount: number;
  heldCount: number;
  operatorAction: {
    action: "inspect" | "retry_parser" | "request_policy_review" | "suppress_duplicate" | "queue_alert_rebuild";
    ownerLane: "sourceOps" | "parser" | "policy" | "source" | "alert";
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  };
};

export type TiSourceProvenanceSourcePackFixtureIntelligencePacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_INTELLIGENCE_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureHealthDrilldownPacketId: string;
  actorRows: TiSourceProvenanceSourcePackFixtureIntelligenceActorRow[];
  summary: {
    actorCount: number;
    readyActors: number;
    partialActors: number;
    blockedActors: number;
    aliasCount: number;
    indicatorCount: number;
    techniqueCount: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    coverageStates: TiSourceProvenanceSourcePackFixtureIntelligenceActorRow["coverageState"][];
    gapCodes: TiSourceProvenanceSourcePackFixtureIntelligenceGap["code"][];
    newestObservedAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureHealthDrilldownPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureIntelligenceActorRow = {
  actor: string;
  publicTiRoute: string;
  coverageState: "ready" | "partial" | "blocked";
  aliases: string[];
  sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  confidence: number;
  freshness: {
    state: "fresh" | "stale" | "missing";
    newestObservedAt?: string;
    nextRetryAt?: string;
  };
  indicators: TiSourceProvenanceSourcePackFixtureIntelligenceIndicator[];
  ttps: TiSourceProvenanceSourcePackFixtureIntelligenceTtp[];
  gaps: TiSourceProvenanceSourcePackFixtureIntelligenceGap[];
  downstreamRoutes: {
    publicTI: string;
    alertGeneration: string;
    sourceOps: string;
  };
  provenance: {
    sourcePackFixtureHealthDrilldownPacketId: string;
    drilldownRowIds: string[];
    captureIds: string[];
    contentHashes: string[];
    fixtureBacked: true;
  };
};

export type TiSourceProvenanceSourcePackFixtureIntelligenceIndicator = {
  type: "domain" | "infrastructure" | "watchlist_term";
  value: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  confidence: number;
  provenanceId: string;
  fixtureBacked: true;
};

export type TiSourceProvenanceSourcePackFixtureIntelligenceTtp = {
  techniqueId: string;
  name: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  confidence: number;
  provenanceId: string;
  fixtureBacked: true;
};

export type TiSourceProvenanceSourcePackFixtureIntelligenceGap = {
  code: TiSourceProvenanceSourcePackFixtureHealthDrilldownFailureCode | "missing_indicator_coverage";
  ownerLane: "alert" | "source" | "parser" | "policy" | "org";
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  reason: string;
  nextAction: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow["failure"]["nextAction"];
  route: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenanceSourcePackFixtureOperatorRemediationPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_OPERATOR_REMEDIATION_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureIntelligencePacketId: string;
  actions: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction[];
  summary: {
    actionCount: number;
    retryParser: number;
    policyReviews: number;
    watchlistMaterialization: number;
    sourceInspections: number;
    actors: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    priorityStates: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["priority"][];
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "dashboard" | "sourceOps" | "support" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureIntelligencePacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureOperatorRemediationAction = {
  actionId: string;
  actor: string;
  publicTiRoute: string;
  action: "retry_parser" | "request_policy_review" | "materialize_watchlist_terms" | "inspect_source_health";
  ownerLane: "parser" | "policy" | "org" | "source";
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  gapCode: TiSourceProvenanceSourcePackFixtureIntelligenceGap["code"];
  priority: "high" | "medium" | "low";
  reason: string;
  retry: {
    retryable: boolean;
    nextRetryAt?: string;
  };
  route: TiSourceProvenanceSourcePackFixtureIntelligenceGap["route"];
  provenance: {
    sourcePackFixtureIntelligencePacketId: string;
    captureIds: string[];
    contentHashes: string[];
    fixtureBacked: true;
  };
};

export type TiSourceProvenanceSourcePackFixtureActionExecutionPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_EXECUTION_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureOperatorRemediationPacketId: string;
  rows: TiSourceProvenanceSourcePackFixtureActionExecutionRow[];
  summary: {
    rowCount: number;
    dryRunExecutable: number;
    blockedRows: number;
    retryWaiting: number;
    policyReviews: number;
    sourceInspections: number;
    watchlistMaterialization: number;
    actors: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    ownerLanes: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"][];
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "support" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureOperatorRemediationPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureActionExecutionRow = {
  rowId: string;
  actionId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["action"];
  executionState: "ready" | "retry_waiting" | "policy_review_required" | "inspection_required";
  ownerLane: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"];
  priority: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["priority"];
  canExecuteDryRun: boolean;
  typedFailureReason?: {
    code: "retry_window_pending" | "policy_review_required" | "source_health_inspection_required";
    ownerLane: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"];
    field: string;
    reason: string;
    nextAction: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["action"];
  };
  retry: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["retry"];
  downstreamReadiness: {
    publicTI: boolean;
    alertGeneration: boolean;
    dashboard: boolean;
    sourceOps: boolean;
    support: boolean;
  };
  route: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["route"];
  provenance: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["provenance"] & {
    sourcePackFixtureOperatorRemediationPacketId: string;
  };
};

export type TiSourceProvenanceSourcePackFixtureActionAuditPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_AUDIT_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureActionExecutionPacketId: string;
  events: TiSourceProvenanceSourcePackFixtureActionAuditEvent[];
  summary: {
    eventCount: number;
    readyEvents: number;
    blockedEvents: number;
    parserRetryEvents: number;
    policyReviewEvents: number;
    inspectionEvents: number;
    alertReadyEvents: number;
    publicTiReadyEvents: number;
    actors: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    ownerLanes: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"][];
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "support" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureActionExecutionPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureActionAuditEvent = {
  eventId: string;
  rowId: string;
  actionId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["action"];
  eventType: "dry_run_ready" | "retry_waiting" | "policy_review_required" | "inspection_required";
  ownerLane: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"];
  priority: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["priority"];
  occurredAt: string;
  retry: TiSourceProvenanceSourcePackFixtureActionExecutionRow["retry"];
  typedFailureReason?: TiSourceProvenanceSourcePackFixtureActionExecutionRow["typedFailureReason"];
  downstreamReadiness: TiSourceProvenanceSourcePackFixtureActionExecutionRow["downstreamReadiness"];
  route: TiSourceProvenanceSourcePackFixtureActionExecutionRow["route"];
  provenance: TiSourceProvenanceSourcePackFixtureActionExecutionRow["provenance"] & {
    sourcePackFixtureActionExecutionPacketId: string;
  };
};

export type TiSourceProvenanceSourcePackFixtureActionDrilldownPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_DRILLDOWN_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureActionAuditPacketId: string;
  drilldownRows: TiSourceProvenanceSourcePackFixtureActionDrilldownRow[];
  filters: TiSourceProvenanceSourcePackFixtureActionDrilldownFilter[];
  summary: {
    rowCount: number;
    readyRows: number;
    degradedRows: number;
    blockedRows: number;
    alertReadyRows: number;
    publicTiReadyRows: number;
    retryableRows: number;
    actors: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStates: TiSourceProvenanceSourcePackFixtureActionDrilldownRow["parserState"][];
    healthStates: TiSourceProvenanceSourcePackFixtureActionDrilldownRow["healthState"][];
    activationStates: TiSourceProvenanceSourcePackFixtureActionDrilldownRow["activationState"][];
    failureCodes: NonNullable<TiSourceProvenanceSourcePackFixtureActionDrilldownRow["failure"]>["code"][];
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "support" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureActionAuditPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureActionDrilldownRow = {
  rowId: string;
  eventId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  ownerLane: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"];
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["action"];
  priority: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["priority"];
  parserState: "healthy" | "retry_scheduled" | "policy_blocked" | "inspection_required";
  healthState: "active" | "degraded" | "blocked";
  activationState: "ready" | "retry_waiting" | "policy_review_required" | "inspect_required";
  affectedConsumers: Array<"publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "support">;
  retry: TiSourceProvenanceSourcePackFixtureActionAuditEvent["retry"];
  failure?: {
    code: NonNullable<TiSourceProvenanceSourcePackFixtureActionAuditEvent["typedFailureReason"]>["code"];
    ownerLane: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"];
    field: string;
    reason: string;
    nextAction: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["action"];
  };
  route: TiSourceProvenanceSourcePackFixtureActionAuditEvent["route"];
  provenance: TiSourceProvenanceSourcePackFixtureActionAuditEvent["provenance"] & {
    sourcePackFixtureActionAuditPacketId: string;
  };
};

export type TiSourceProvenanceSourcePackFixtureActionDrilldownFilter = {
  kind: "actor" | "source_family" | "parser_state" | "health_state" | "activation_state" | "failure_code" | "affected_consumer" | "owner_lane";
  value: string;
  count: number;
  operatorAction: {
    action: "retry_parser" | "request_policy_review" | "inspect_source_health" | "materialize_watchlist_terms" | "review_group";
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  };
};

export type TiSourceProvenanceSourcePackFixtureActionAlertBridgePacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_ALERT_BRIDGE_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourcePackFixtureActionDrilldownPacketId: string;
  rows: TiSourceProvenanceSourcePackFixtureActionAlertBridgeRow[];
  summary: {
    rowCount: number;
    alertReadyRows: number;
    publicTiReadyRows: number;
    blockedRows: number;
    degradedRows: number;
    missingPrerequisiteCount: number;
    actors: string[];
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    coverageStates: TiSourceProvenanceSourcePackFixtureActionAlertBridgeRow["coverageState"][];
    blockerCodes: TiSourceProvenanceSourcePackFixtureActionAlertBridgePrerequisite["code"][];
    matchableFields: string[];
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "support" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureActionDrilldownPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackFixtureActionAlertBridgeRow = {
  rowId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  coverageState: "alert_ready" | "public_ti_only" | "degraded" | "blocked";
  alertReadiness: "ready" | "blocked";
  publicTiReadiness: "ready" | "blocked";
  matchableFields: string[];
  freshness: {
    state: "fresh" | "stale";
    nextRetryAt?: string;
  };
  missingPrerequisites: TiSourceProvenanceSourcePackFixtureActionAlertBridgePrerequisite[];
  route: TiSourceProvenanceSourcePackFixtureActionDrilldownRow["route"];
  provenance: TiSourceProvenanceSourcePackFixtureActionDrilldownRow["provenance"] & {
    sourcePackFixtureActionDrilldownPacketId: string;
  };
};

export type TiSourceProvenanceSourcePackFixtureActionAlertBridgePrerequisite = {
  code: NonNullable<TiSourceProvenanceSourcePackFixtureActionDrilldownRow["failure"]>["code"] | "source_not_alert_ready";
  ownerLane: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"] | "alert";
  field: string;
  reason: string;
  nextAction: TiSourceProvenanceSourcePackFixtureActionDrilldownRow["action"] | "queue_alert_rebuild";
};

export type TiSourceProvenanceSourcePackFixtureReadinessExport = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_READINESS_EXPORT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourcePackFixtureGrowthPacketId: string;
  readiness: {
    publicTI: boolean;
    alertGeneration: boolean;
    dashboard: boolean;
    sourceOps: boolean;
    integration: boolean;
  };
  rows: TiSourceProvenanceSourcePackFixtureReadinessRow[];
  blockers: TiSourceProvenanceSourcePackFixtureReadinessBlocker[];
  summary: {
    rowCount: number;
    readyRows: number;
    degradedRows: number;
    staleRows: number;
    blockedRows: number;
    alertReadyCaptures: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    freshnessStates: Array<TiSourceProvenanceSourcePackFixtureGrowthRow["freshness"]["state"]>;
    nextRetryAt?: string;
    newestFreshnessAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "integration";
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
    crossOrgDataIncluded: false;
  };
};

export type TiSourceProvenanceSourcePackFixtureReadinessRow = {
  rowId: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"];
  freshnessState: TiSourceProvenanceSourcePackFixtureGrowthRow["freshness"]["state"];
  retryable: boolean;
  downstreamConsumerRoutes: TiSourceProvenanceSourcePackFixtureGrowthRow["downstreamRoutes"];
  provenance: TiSourceProvenanceSourcePackFixtureGrowthRow["provenance"];
  blockerReason?: string;
  readyFor: Array<"publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "integration">;
};

export type TiSourceProvenanceSourcePackFixtureReadinessBlocker = {
  code: "parser_retry_scheduled" | "policy_review_required" | "degraded_parser" | "missing_alert_capture";
  ownerLane: "parser" | "policy" | "source" | "alert";
  rowId?: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  reason: string;
  nextAction: "retry_parser" | "request_policy_approval" | "inspect_source_health" | "queue_fixture_capture";
  nextRetryAt?: string;
  route: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenanceSourcePackRetryPolicyPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_RETRY_POLICY_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourcePackFixtureReadinessExportId: string;
  retryRows: TiSourceProvenanceSourcePackRetryPolicyRow[];
  summary: {
    rowCount: number;
    retryNow: number;
    retryLater: number;
    policyReviewRequired: number;
    inspectOnly: number;
    alertReady: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
    nextRetryAt?: string;
    newestFreshnessAt?: string;
  };
  consumers: Array<{
    consumer: "sourceOps" | "dashboard" | "alertGeneration" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackFixtureReadinessExport["safeOutput"];
};

export type TiSourceProvenanceSourcePackRetryPolicyRow = {
  rowId: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"];
  freshnessState: TiSourceProvenanceSourcePackFixtureGrowthRow["freshness"]["state"];
  retryState: "retry_now" | "retry_later" | "policy_review_required" | "inspect_only" | "alert_ready";
  blockerCode?: TiSourceProvenanceSourcePackFixtureReadinessBlocker["code"];
  blockerReason?: string;
  nextRetryAt?: string;
  downstreamConsumerRoutes: TiSourceProvenanceSourcePackFixtureReadinessRow["downstreamConsumerRoutes"];
  provenance: TiSourceProvenanceSourcePackFixtureReadinessRow["provenance"];
  action: {
    action: "retry_parser" | "request_policy_approval" | "inspect_source_health" | "queue_alert_rebuild";
    ownerLane: "parser" | "policy" | "source" | "alert";
    route: TiSourceProvenanceSourcePackFixtureReadinessBlocker["route"];
  };
};

export type TiSourceProvenanceSourceCandidateValidationReceipt = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_CANDIDATE_VALIDATION_RECEIPT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourcePackRetryPolicyPacketId: string;
  validations: TiSourceProvenanceSourceCandidateValidationRow[];
  summary: {
    validationCount: number;
    accepted: number;
    retryGated: number;
    policyGated: number;
    inspectOnly: number;
    alertReady: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
    blockerCodes: Array<TiSourceProvenanceSourcePackRetryPolicyRow["blockerCode"]>;
    nextRetryAt?: string;
    newestFreshnessAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "sourceOps" | "integration";
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
  safeOutput: TiSourceProvenanceSourcePackRetryPolicyPacket["safeOutput"];
};

export type TiSourceProvenanceSourceCandidateValidationRow = {
  validationId: string;
  retryPolicyRowId: string;
  candidateState: "accepted" | "retry_gated" | "policy_gated" | "inspect_only";
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
  healthState: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"];
  freshnessState: TiSourceProvenanceSourcePackFixtureGrowthRow["freshness"]["state"];
  validation: {
    allowedForPublicTI: boolean;
    allowedForAlertGeneration: boolean;
    allowedForDashboard: boolean;
    allowedForIntegration: boolean;
    reason: string;
    blockerCode?: TiSourceProvenanceSourcePackRetryPolicyRow["blockerCode"];
    nextRetryAt?: string;
  };
  downstreamRoutes: TiSourceProvenanceSourcePackRetryPolicyRow["downstreamConsumerRoutes"];
  provenance: TiSourceProvenanceSourcePackRetryPolicyRow["provenance"];
};

export type TiSourceProvenanceActorSourceCoveragePortfolio = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_SOURCE_COVERAGE_PORTFOLIO_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  actorRows: TiSourceProvenanceActorSourceCoveragePortfolioRow[];
  summary: {
    actorCount: number;
    readyActors: number;
    partialActors: number;
    blockedActors: number;
    alertReadyActors: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
    blockerCodes: Array<TiSourceProvenanceSourcePackRetryPolicyRow["blockerCode"]>;
    newestFreshnessAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "integration";
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
  safeOutput: TiSourceProvenanceSourceCandidateValidationReceipt["safeOutput"];
};

export type TiSourceProvenanceActorSourceCoveragePortfolioRow = {
  actor: string;
  publicTiRoute: string;
  sourceCandidateValidationReceiptId: string;
  status: TiSourceProvenanceSourceCandidateValidationReceipt["status"];
  readiness: {
    publicTI: boolean;
    alertGeneration: boolean;
    dashboard: boolean;
    integration: boolean;
  };
  coverageCounts: {
    accepted: number;
    retryGated: number;
    policyGated: number;
    inspectOnly: number;
    alertReady: number;
  };
  sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  freshness: {
    newestFreshnessAt?: string;
    nextRetryAt?: string;
  };
  blockers: Array<{
    code?: TiSourceProvenanceSourcePackRetryPolicyRow["blockerCode"];
    sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
    reason: string;
  }>;
  downstreamRoutes: {
    publicTI: string;
    alertGeneration: string;
    dashboard: string;
    integration: string;
  };
  provenance: {
    validationIds: string[];
    captureIds: string[];
    contentHashes: string[];
    sourceHealthProofIds: string[];
  };
};

export type TiSourceProvenanceActorEnrichmentAlertPrerequisitePacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_ALERT_PREREQUISITE_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  actorRows: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow[];
  summary: {
    actorCount: number;
    readyActors: number;
    partialActors: number;
    blockedActors: number;
    alertReadyActors: number;
    prerequisiteCount: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
    prerequisiteCodes: TiSourceProvenanceActorEnrichmentAlertPrerequisite["code"][];
    newestFreshnessAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "integration";
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
  safeOutput: TiSourceProvenanceActorSourceCoveragePortfolio["safeOutput"];
};

export type TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow = {
  actor: string;
  publicTiRoute: string;
  sourceCandidateValidationReceiptId: string;
  alertReadiness: "ready" | "partial" | "blocked";
  readiness: TiSourceProvenanceActorSourceCoveragePortfolioRow["readiness"];
  coverageCounts: TiSourceProvenanceActorSourceCoveragePortfolioRow["coverageCounts"];
  sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  healthStates: TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  freshness: TiSourceProvenanceActorSourceCoveragePortfolioRow["freshness"];
  missingPrerequisites: TiSourceProvenanceActorEnrichmentAlertPrerequisite[];
  downstreamRoutes: TiSourceProvenanceActorSourceCoveragePortfolioRow["downstreamRoutes"];
  provenance: TiSourceProvenanceActorSourceCoveragePortfolioRow["provenance"];
};

export type TiSourceProvenanceActorEnrichmentAlertPrerequisite = {
  code:
    | "parser_retry_required"
    | "policy_review_required"
    | "parser_health_inspection_required"
    | "watchlist_materialization_required";
  ownerLane: "parser" | "policy" | "source" | "org";
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  reason: string;
  nextAction: {
    action: "retry_parser" | "request_policy_review" | "inspect_parser_health" | "materialize_watchlist_terms";
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  };
};

export type TiSourceProvenanceActorEnrichmentSourceHealthEventPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_HEALTH_EVENT_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  actorEnrichmentAlertPrerequisitePacketId: string;
  events: TiSourceProvenanceActorEnrichmentSourceHealthEvent[];
  summary: {
    eventCount: number;
    accepted: number;
    retryGated: number;
    policyGated: number;
    inspectOnly: number;
    healthy: number;
    degraded: number;
    stale: number;
    blocked: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    parserStatuses: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
    affectedActorPages: string[];
    affectedAlertFamilies: string[];
    newestLastRunAt?: string;
    newestLastSuccessAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "dashboard" | "integration";
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
  safeOutput: TiSourceProvenanceActorEnrichmentAlertPrerequisitePacket["safeOutput"];
};

export type TiSourceProvenanceActorEnrichmentSourceHealthEvent = {
  eventId: string;
  actor: string;
  publicTiRoute: string;
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  candidateValidation: {
    state: "accepted" | "retry_gated" | "policy_gated" | "inspect_only";
    policyStatus: "allowed" | "metadata_only_review_required" | "blocked";
    parserCompatible: boolean;
    expectedActorCoverage: string[];
    expectedEntityCoverage: string[];
    rejectionReason?: string;
  };
  parserHealth: {
    parserStatus: TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"];
    healthState: "healthy" | "degraded" | "stale" | "blocked";
    lastRunAt: string;
    lastSuccessAt?: string;
    staleThresholdMinutes: number;
    failureReason?: string;
    nextRetryAt?: string;
  };
  activationTest: {
    state: "active" | "retry_scheduled" | "policy_blocked" | "inspection_required";
    testResult: "passed" | "failed" | "not_run";
    route: TiSourceProvenanceActorEnrichmentAlertPrerequisite["nextAction"]["route"];
  };
  affected: {
    actorPages: string[];
    alertFamilies: string[];
  };
  downstreamRoutes: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow["downstreamRoutes"];
  provenance: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow["provenance"];
};

export type TiSourceProvenanceSourceHealthMonitoringFilterPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_HEALTH_MONITORING_FILTER_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourceHealthEventPacketId: string;
  filters: TiSourceProvenanceSourceHealthMonitoringFilter[];
  summary: {
    filterCount: number;
    eventCount: number;
    sourceFamilyFilters: number;
    candidateStateFilters: number;
    parserHealthFilters: number;
    actorPageFilters: number;
    alertFamilyFilters: number;
    retryWindowFilters: number;
    retryableEvents: number;
    policyBlockedEvents: number;
    staleEvents: number;
    healthyEvents: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    candidateStates: TiSourceProvenanceActorEnrichmentSourceHealthEvent["candidateValidation"]["state"][];
    parserHealthStates: TiSourceProvenanceActorEnrichmentSourceHealthEvent["parserHealth"]["healthState"][];
    affectedActorPages: string[];
    affectedAlertFamilies: string[];
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "sourceOps" | "dashboard" | "publicTI" | "alertGeneration" | "integration";
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
  safeOutput: TiSourceProvenanceActorEnrichmentSourceHealthEventPacket["safeOutput"];
};

export type TiSourceProvenanceSourceHealthMonitoringFilter = {
  filterId: string;
  kind: "source_family" | "candidate_state" | "parser_health" | "parser_status" | "affected_actor_page" | "alert_family" | "retry_window";
  value: string;
  count: number;
  readyCount: number;
  blockedCount: number;
  retryableCount: number;
  affectedActorPages: string[];
  affectedAlertFamilies: string[];
  sampleEventIds: string[];
  operatorAction: {
    action: "inspect" | "retry" | "request_policy_review" | "queue_alert_rebuild" | "review_gap";
    ownerLane: "source" | "parser" | "policy" | "alert";
    reason: string;
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  };
};

export type TiSourceProvenanceSourcePackLifecycleCleanupPacket = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_PACK_LIFECYCLE_CLEANUP_PACKET_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  status: "ready" | "partial" | "blocked";
  tenantId: string;
  organizationId?: string;
  sourceHealthMonitoringFilterPacketId: string;
  cleanupRows: TiSourceProvenanceSourcePackLifecycleCleanupRow[];
  summary: {
    cleanupCount: number;
    retryParser: number;
    policyReview: number;
    alertRebuild: number;
    inspectGap: number;
    sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
    affectedActorPages: string[];
    affectedAlertFamilies: string[];
    blockedCount: number;
    retryableCount: number;
    readyCount: number;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "sourceOps" | "dashboard" | "alertGeneration" | "integration";
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
  safeOutput: TiSourceProvenanceSourceHealthMonitoringFilterPacket["safeOutput"];
};

export type TiSourceProvenanceSourcePackLifecycleCleanupRow = {
  cleanupId: string;
  filterId: string;
  filterKind: TiSourceProvenanceSourceHealthMonitoringFilter["kind"];
  filterValue: string;
  lifecycleState: "retry_ready" | "policy_review_required" | "alert_rebuild_ready" | "gap_review_required" | "inspect_required";
  priority: "high" | "medium" | "low";
  eventCount: number;
  readyCount: number;
  blockedCount: number;
  retryableCount: number;
  affectedActorPages: string[];
  affectedAlertFamilies: string[];
  sourceFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  sampleEventIds: string[];
  remediation: TiSourceProvenanceSourceHealthMonitoringFilter["operatorAction"];
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

export type TiSourceProvenanceParserHealthProvenanceSummary = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_PARSER_HEALTH_PROVENANCE_SUMMARY_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute?: string;
  parserHealthAlertPacketId: string;
  sourceActivationDecisionReceiptId?: string;
  familyRows: TiSourceProvenanceParserHealthProvenanceFamilyRow[];
  summary: {
    familyCount: number;
    healthyFamilyCount: number;
    parserAlertCount: number;
    retryableCount: number;
    policyBlockedCount: number;
    activationTestsQueued: number;
    alertableCandidates: number;
    lastSuccessAt?: string;
    lastFailureAt?: string;
    nextRetryAt?: string;
  };
  consumers: Array<{
    consumer: "publicTI" | "alertGeneration" | "sourceOps";
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

export type TiSourceProvenanceParserHealthProvenanceFamilyRow = {
  family: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  parserState: "ready" | "not_ready" | "retry_scheduled" | "blocked";
  parserAlertCount: number;
  activationTestsQueued: number;
  parserRetriesQueued: number;
  policyReviewsRequired: number;
  alertableCandidates: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  nextRetryAt?: string;
  blockers: Array<{
    code: "parser_retry_scheduled" | "policy_blocked" | "parser_not_ready" | "freshness_missing";
    ownerLane: "source" | "parser" | "policy" | "publicTI";
    nextAction: TiSourceProvenanceScraperEnrichmentLifecycleStage["nextAction"];
    alertId?: string;
  }>;
  provenance: {
    parserHealthAlertPacketId: string;
    sourceActivationDecisionReceiptId?: string;
    sourceHealthProofIds: string[];
    activationDecisionIds: string[];
    fixtureBacked: true;
  };
  readiness: {
    publicTI: boolean;
    alertGeneration: boolean;
    sourceOps: boolean;
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

export type TiSourceProvenanceSourceOpsFixtureBundle = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_SOURCE_OPS_FIXTURE_BUNDLE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  expectedActor?: string;
  publicTiRoute?: string;
  packetRefs: {
    sourceFreshnessGapPacketId: string;
    parserHealthAlertPacketId: string;
    sourceOpsActionQueueId: string;
  };
  readiness: {
    publicTI: boolean;
    dashboard: boolean;
    sourceOps: boolean;
    alertGeneration: boolean;
    operatorActionCount: number;
    validationIssueCount: number;
  };
  sourceHealth: {
    sourceFamilies: string[];
    parserAlertCount: number;
    freshnessState: TiSourceProvenanceSourceFreshnessGapPacket["freshness"]["state"];
    nextRetryAt?: string;
  };
  operatorActions: TiSourceProvenanceSourceOpsActionQueueRow[];
  validationIssues: TiSourceProvenanceSourceOpsFixtureValidationIssue[];
  fixtureContracts: Array<{
    consumer: "publicTI" | "dashboard" | "sourceOps" | "alertGeneration";
    route: string;
    requiredFields: string[];
    sourceSchemas: string[];
    liveNetworkFetch: false;
  }>;
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceSourceOpsFixtureValidationIssue = {
  code: "wrong_actor_query" | "duplicate_candidate" | "unsupported_source_family";
  severity: "blocking" | "warning";
  ownerLane: "publicTI" | "source";
  sourceFamily?: string;
  expectedActor?: string;
  actualActor?: string;
  duplicateOf?: string;
  path: string;
  nextAction: "retry_query" | "suppress_duplicate" | "review_source_family";
  route: {
    method: "GET" | "POST";
    path: string;
    body?: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
};

export type TiSourceProvenancePublicTiSourceOpsProjection = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_PUBLIC_TI_SOURCE_OPS_PROJECTION_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  sourceOpsFixtureBundleId: string;
  pageReadiness: {
    state: "ready" | "partial" | "blocked";
    canRender: true;
    publicTI: boolean;
    dashboard: boolean;
    sourceOps: boolean;
    alertGeneration: boolean;
  };
  sourceCoverage: {
    families: string[];
    freshnessState: TiSourceProvenanceSourceOpsFixtureBundle["sourceHealth"]["freshnessState"];
    parserAlertCount: number;
    operatorActionCount: number;
    validationIssueCount: number;
    nextRetryAt?: string;
  };
  provenanceRows: TiSourceProvenancePublicTiSourceOpsProjectionRow[];
  enrichmentGaps: TiSourceProvenancePublicTiSourceOpsProjectionGap[];
  consumerContracts: TiSourceProvenanceSourceOpsFixtureBundle["fixtureContracts"];
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenancePublicTiSourceOpsProjectionRow = {
  rowId: string;
  sourceFamily?: string;
  state: "ready" | "needs_action" | "validation_blocked";
  reasonCode?: string;
  ownerLane: "source" | "parser" | "policy" | "publicTI" | "alert" | "case";
  parserStatus?: {
    state?: string;
    failureReason?: string;
  };
  freshness?: {
    state: TiSourceProvenanceSourceOpsActionQueueRow["freshness"]["state"];
    newestEvidenceAt?: string;
    ageDays?: number;
  };
  provenance: {
    sourceOpsFixtureBundleId: string;
    sourceFreshnessGapPacketId: string;
    parserHealthAlertPacketId: string;
    sourceOpsActionQueueId: string;
    sourceHealthProofId?: string;
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

export type TiSourceProvenancePublicTiSourceOpsProjectionGap = {
  code: string;
  ownerLane: "source" | "parser" | "policy" | "publicTI" | "alert" | "case";
  sourceFamily?: string;
  nextAction: string;
  route: TiSourceProvenancePublicTiSourceOpsProjectionRow["route"];
};

export type TiSourceProvenanceProjectionWatchlistRelevance = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_PROJECTION_WATCHLIST_RELEVANCE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  publicTiRoute: string;
  publicTiSourceOpsProjectionId: string;
  canCreateWatchlistTerms: boolean;
  canRequestAlertGeneration: boolean;
  watchlistTerms: TiSourceProvenanceProjectionWatchlistTerm[];
  blockers: TiSourceProvenanceProjectionWatchlistBlocker[];
  nextActions: Array<{
    action: "repair_source_ops" | "retry_parser" | "review_validation_issue" | "materialize_watchlist_terms" | "request_alert_rebuild";
    ownerLane: "source" | "parser" | "publicTI" | "org" | "alert";
    reasonCode: string;
    route: {
      method: "GET" | "POST";
      path: string;
      body?: Record<string, unknown>;
      dryRunSupported: true;
      liveNetworkFetch: false;
    };
  }>;
  alertRequestPreview: {
    method: "POST";
    path: "/v1/dwm/alerts/rebuild";
    body: {
      tenantId: string;
      organizationId?: string;
      actor: string;
      watchlistItemIds: string[];
      alertGeneratorKeys: string[];
      sourceProjectionId: string;
      dryRun: true;
    };
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
  payloadShape: string[];
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
};

export type TiSourceProvenanceProjectionWatchlistTerm = {
  termId: string;
  watchlistItemId: string;
  alertGeneratorKey: string;
  kind: "actor" | "source_family";
  term: string;
  sourceFamilies: string[];
  confidence: number;
  provenance: {
    publicTiSourceOpsProjectionId: string;
    sourceOpsFixtureBundleId: string;
    sourceFreshnessGapPacketId: string;
    parserHealthAlertPacketId: string;
    sourceOpsActionQueueId: string;
    fixtureBacked: true;
  };
  alertGenerationRef: {
    schemaVersion: "organization.watchlist_alert_generation_ref.v1";
    source: "public_ti_source_ops_projection";
    organizationId?: string;
    term: string;
    key: string;
  };
};

export type TiSourceProvenanceProjectionWatchlistBlocker = {
  code:
    | "projection_not_ready"
    | "missing_organization_scope"
    | "parser_gap_blocking"
    | "source_validation_blocking"
    | "no_watchlist_terms";
  ownerLane: "source" | "parser" | "publicTI" | "org";
  path: string;
  reasonCode?: string;
  sourceFamily?: string;
  nextAction: string;
  route: TiSourceProvenancePublicTiSourceOpsProjectionGap["route"];
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
  lifecycle: {
    currentState: "ready" | "blocked";
    requestedTransition?: TiSourceProvenanceAlertHandoffTransition;
    allowedTransitions: TiSourceProvenanceAlertHandoffTransition[];
    invalidTransition?: TiSourceProvenanceAlertHandoffTransition;
  };
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
  code: "missing_org_scope" | "source_org_mismatch" | "parser_health_blocked" | "duplicate_alert_id" | "invalid_transition";
  ownerLane: "org" | "source" | "alert" | "webhook" | "publicTI";
  path: string;
  message: string;
  alertId?: string;
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"];
  requestedTransition?: TiSourceProvenanceAlertHandoffTransition;
};

export type TiSourceProvenanceAlertHandoffTransition =
  | "request_alert_generation"
  | "refresh_public_ti"
  | "prepare_webhook_dry_run"
  | "repair_source";

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

export function buildSourceProvenanceActorEnrichmentGapReceipt(input: {
  profile: TiSourceProvenanceActorProfileContract;
  sourcePlan?: TiSourceProvenanceActorProfileGapSourcePlan;
  parserHealthSummary?: TiSourceProvenanceParserHealthProvenanceSummary;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentGapReceipt {
  const generatedAt = input.generatedAt ?? input.parserHealthSummary?.generatedAt ?? input.sourcePlan?.generatedAt ?? input.profile.generatedAt;
  const rows = input.profile.gaps.map((gap) => actorEnrichmentGapReceiptRow(input.profile, gap, input.sourcePlan, input.parserHealthSummary));
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily).filter(Boolean).map(String)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_gap_receipt", `${input.profile.id}:${input.sourcePlan?.id ?? ""}:${input.parserHealthSummary?.id ?? ""}:${generatedAt}:${rows.map((row) => `${row.field}:${row.status}`).join(",")}`),
    generatedAt,
    ok: rows.length === 0,
    tenantId: input.profile.tenantId,
    organizationId: input.profile.organizationId,
    actor: input.profile.actor,
    publicTiRoute: input.profile.publicTiRoute,
    actorProfileContractId: input.profile.id,
    sourcePlanId: input.sourcePlan?.id,
    parserHealthProvenanceSummaryId: input.parserHealthSummary?.id,
    rows,
    coverage: {
      totalGaps: rows.length,
      candidateBackedGaps: rows.filter((row) => row.candidateId).length,
      readyFamilies: rows.filter((row) => row.status === "source_ready" || row.status === "candidate_ready").length,
      blockedFamilies: rows.filter((row) => row.status === "policy_blocked").length,
      retryableGaps: rows.filter((row) => row.status === "parser_retry").length,
      sourceFamilies,
      lastSuccessAt: newestTimestamp(rows.map((row) => row.lastSuccessAt)),
      lastFailureAt: newestTimestamp(rows.map((row) => row.lastFailureAt)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.nextRetryAt))
    },
    consumers: actorEnrichmentGapReceiptConsumers(input.profile, rows),
    payloadShape: [
      "rows[].gapCode",
      "rows[].field",
      "rows[].status",
      "rows[].sourceFamily",
      "rows[].parserState",
      "rows[].coverageCounts",
      "rows[].provenance",
      "coverage.sourceFamilies",
      "coverage.nextRetryAt"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceActorEnrichmentCoverageExport(input: {
  gapReceipt: TiSourceProvenanceActorEnrichmentGapReceipt;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentCoverageExport {
  const generatedAt = input.generatedAt ?? input.gapReceipt.generatedAt;
  const coverageRows = actorEnrichmentCoverageRows(input.gapReceipt);
  const blockers = actorEnrichmentCoverageBlockers(coverageRows);
  const sourceFamilies = uniqueStrings(coverageRows.map((row) => row.sourceFamily).filter(Boolean).map(String)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_EXPORT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_coverage_export", `${input.gapReceipt.id}:${generatedAt}:${coverageRows.map((row) => `${row.field}:${row.coverageState}`).join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.gapReceipt.tenantId,
    organizationId: input.gapReceipt.organizationId,
    actor: input.gapReceipt.actor,
    publicTiRoute: input.gapReceipt.publicTiRoute,
    actorEnrichmentGapReceiptId: input.gapReceipt.id,
    coverageRows,
    blockers,
    summary: {
      fieldCount: coverageRows.length,
      coveredFieldCount: coverageRows.filter((row) => row.coverageState === "covered").length,
      blockedFieldCount: coverageRows.filter((row) => row.coverageState === "blocked").length,
      retryableFieldCount: coverageRows.filter((row) => row.coverageState === "retry").length,
      alertableFamilyCount: coverageRows.filter((row) => row.alertableCandidates > 0).length,
      sourceFamilies,
      lastSuccessAt: newestTimestamp(coverageRows.map((row) => row.lastSuccessAt)),
      lastFailureAt: newestTimestamp(coverageRows.map((row) => row.lastFailureAt)),
      nextRetryAt: earliestTimestamp(coverageRows.map((row) => row.nextRetryAt))
    },
    consumers: actorEnrichmentCoverageConsumers(input.gapReceipt, coverageRows, blockers),
    payloadShape: [
      "coverageRows[].field",
      "coverageRows[].coverageState",
      "coverageRows[].sourceFamily",
      "coverageRows[].parserStatus",
      "coverageRows[].provenance",
      "blockers[].code",
      "summary.sourceFamilies",
      "summary.nextRetryAt"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceActorEnrichmentCoverageHandoff(input: {
  coverageExport: TiSourceProvenanceActorEnrichmentCoverageExport;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentCoverageHandoff {
  const generatedAt = input.generatedAt ?? input.coverageExport.generatedAt;
  const fields = input.coverageExport.coverageRows.map((row) => actorEnrichmentCoverageHandoffField(input.coverageExport, row));
  const alertRows = input.coverageExport.coverageRows.map((row) => actorEnrichmentCoverageHandoffAlertRow(input.coverageExport, row));
  const actions = input.coverageExport.blockers.map(actorEnrichmentCoverageHandoffAction);
  const alertRoute = input.coverageExport.consumers.find((consumer) => consumer.consumer === "alertGeneration")?.route;
  const sourceOpsReady = actions.length > 0;
  const alertGenerationReady = input.coverageExport.consumers.find((consumer) => consumer.consumer === "alertGeneration")?.ready === true;
  const publicTiReady = input.coverageExport.consumers.find((consumer) => consumer.consumer === "publicTI")?.ready === true;
  const blockerCodes = uniqueStrings(input.coverageExport.blockers.map((blocker) => blocker.code)) as TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_HANDOFF_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_coverage_handoff", `${input.coverageExport.id}:${generatedAt}:${fields.map((field) => `${field.field}:${field.state}`).join(",")}`),
    generatedAt,
    ok: input.coverageExport.ok,
    tenantId: input.coverageExport.tenantId,
    organizationId: input.coverageExport.organizationId,
    actor: input.coverageExport.actor,
    publicTiRoute: input.coverageExport.publicTiRoute,
    actorEnrichmentCoverageExportId: input.coverageExport.id,
    publicTi: {
      ready: publicTiReady,
      route: input.coverageExport.publicTiRoute,
      fields
    },
    alertGeneration: {
      ready: alertGenerationReady,
      route: {
        method: "POST",
        path: alertRoute?.path ?? "/v1/dwm/alerts/rebuild",
        body: alertRoute?.body ?? {
          tenantId: input.coverageExport.tenantId,
          organizationId: input.coverageExport.organizationId,
          actor: input.coverageExport.actor,
          actorEnrichmentCoverageExportId: input.coverageExport.id,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      },
      rows: alertRows
    },
    sourceOps: {
      ready: sourceOpsReady,
      actions
    },
    summary: {
      sourceFamilies: input.coverageExport.summary.sourceFamilies,
      coveredFieldCount: input.coverageExport.summary.coveredFieldCount,
      pendingFieldCount: input.coverageExport.coverageRows.filter((row) => row.coverageState === "pending").length,
      retryableFieldCount: input.coverageExport.summary.retryableFieldCount,
      blockedFieldCount: input.coverageExport.summary.blockedFieldCount,
      alertableFieldCount: input.coverageExport.coverageRows.filter((row) => row.alertableCandidates > 0).length,
      lastSuccessAt: input.coverageExport.summary.lastSuccessAt,
      lastFailureAt: input.coverageExport.summary.lastFailureAt,
      nextRetryAt: input.coverageExport.summary.nextRetryAt,
      blockerCodes
    },
    consumers: [{
      consumer: "publicTI",
      ready: publicTiReady,
      requiredFields: ["publicTi.fields[].field", "publicTi.fields[].state", "publicTi.fields[].provenance"]
    }, {
      consumer: "alertGeneration",
      ready: alertGenerationReady,
      requiredFields: ["alertGeneration.rows[].matchable", "alertGeneration.rows[].provenanceIds", "summary.blockerCodes"]
    }, {
      consumer: "sourceOps",
      ready: sourceOpsReady,
      requiredFields: ["sourceOps.actions[].action", "sourceOps.actions[].blockerCode", "sourceOps.actions[].provenanceRef"]
    }],
    payloadShape: [
      "publicTi.fields[]",
      "alertGeneration.rows[]",
      "sourceOps.actions[]",
      "summary.sourceFamilies",
      "summary.blockerCodes"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt(input: {
  handoff: TiSourceProvenanceActorEnrichmentCoverageHandoff;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt {
  const generatedAt = input.generatedAt ?? input.handoff.generatedAt;
  const rows = actorEnrichmentConsumerReadinessRows(input.handoff);
  const blockerSummary = actorEnrichmentConsumerReadinessBlockers(input.handoff, rows);
  const parserStatuses = uniqueStrings(input.handoff.publicTi.fields.map((field) => field.parserStatus).filter(Boolean).map(String)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CONSUMER_READINESS_RECEIPT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_consumer_readiness_receipt", `${input.handoff.id}:${generatedAt}:${rows.map((row) => `${row.consumer}:${row.state}`).join(",")}`),
    generatedAt,
    ok: rows.filter((row) => row.consumer !== "sourceOps").every((row) => row.ready) && blockerSummary.length === 0,
    tenantId: input.handoff.tenantId,
    organizationId: input.handoff.organizationId,
    actor: input.handoff.actor,
    publicTiRoute: input.handoff.publicTiRoute,
    actorEnrichmentCoverageHandoffId: input.handoff.id,
    rows,
    blockerSummary,
    sourceHealth: {
      sourceFamilies: input.handoff.summary.sourceFamilies,
      parserStatuses,
      coveredFieldCount: input.handoff.summary.coveredFieldCount,
      pendingFieldCount: input.handoff.summary.pendingFieldCount,
      retryableFieldCount: input.handoff.summary.retryableFieldCount,
      blockedFieldCount: input.handoff.summary.blockedFieldCount,
      alertableFieldCount: input.handoff.summary.alertableFieldCount,
      lastSuccessAt: input.handoff.summary.lastSuccessAt,
      lastFailureAt: input.handoff.summary.lastFailureAt,
      nextRetryAt: input.handoff.summary.nextRetryAt
    },
    payloadShape: [
      "rows[].consumer",
      "rows[].state",
      "rows[].coverageCounts",
      "rows[].retry",
      "rows[].provenanceIds",
      "blockerSummary[]",
      "sourceHealth"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false,
      crossOrgDataIncluded: false
    }
  };
}

export function buildSourceProvenanceActorEnrichmentSourceAlertReadinessBridge(input: {
  receipt: TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentSourceAlertReadinessBridge {
  const generatedAt = input.generatedAt ?? input.receipt.generatedAt;
  const publicTiRow = actorEnrichmentConsumerRow(input.receipt, "publicTI");
  const alertRow = actorEnrichmentConsumerRow(input.receipt, "alertGeneration");
  const sourceOpsRow = actorEnrichmentConsumerRow(input.receipt, "sourceOps");
  const operatorActions = input.receipt.blockerSummary.map(actorEnrichmentSourceAlertReadinessAction);
  const state = publicTiRow.ready && alertRow.ready
    ? "ready"
    : (publicTiRow.ready || alertRow.ready || sourceOpsRow.ready ? "partial" : "blocked");

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_ALERT_READINESS_BRIDGE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_source_alert_readiness_bridge", `${input.receipt.id}:${generatedAt}:${state}`),
    generatedAt,
    ok: state === "ready" && operatorActions.length === 0,
    tenantId: input.receipt.tenantId,
    organizationId: input.receipt.organizationId,
    actor: input.receipt.actor,
    publicTiRoute: input.receipt.publicTiRoute,
    consumerReadinessReceiptId: input.receipt.id,
    readiness: {
      state,
      publicTI: publicTiRow.ready,
      alertGeneration: alertRow.ready,
      sourceOpsActionRequired: sourceOpsRow.ready && operatorActions.length > 0
    },
    publicTi: {
      ready: publicTiRow.ready,
      route: publicTiRow.route,
      coverageCounts: publicTiRow.coverageCounts,
      blockerCodes: publicTiRow.blockerCodes,
      provenanceIds: publicTiRow.provenanceIds
    },
    alertGeneration: {
      ready: alertRow.ready,
      route: alertRow.route,
      matchableFieldCount: alertRow.coverageCounts.alertable,
      retryable: alertRow.retry.retryable,
      nextRetryAt: alertRow.retry.nextRetryAt,
      blockerCodes: alertRow.blockerCodes,
      provenanceIds: alertRow.provenanceIds
    },
    sourceHealth: input.receipt.sourceHealth,
    operatorActions,
    consumers: [{
      consumer: "publicTI",
      ready: publicTiRow.ready,
      requiredFields: ["publicTi.coverageCounts", "publicTi.provenanceIds", "readiness.publicTI"]
    }, {
      consumer: "alertGeneration",
      ready: alertRow.ready,
      requiredFields: ["alertGeneration.matchableFieldCount", "alertGeneration.provenanceIds", "readiness.alertGeneration"]
    }, {
      consumer: "sourceOps",
      ready: sourceOpsRow.ready,
      requiredFields: ["operatorActions[]", "sourceHealth", "readiness.sourceOpsActionRequired"]
    }],
    payloadShape: [
      "readiness",
      "publicTi",
      "alertGeneration",
      "sourceHealth",
      "operatorActions[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false,
      crossOrgDataIncluded: false
    }
  };
}

export function buildSourceProvenanceActorEnrichmentParserStatusAuditPacket(input: {
  receipt: TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentParserStatusAuditPacket {
  const generatedAt = input.generatedAt ?? input.receipt.generatedAt;
  const events = [
    ...input.receipt.rows.map((row) => actorEnrichmentParserAuditConsumerEvent(input.receipt, row)),
    ...input.receipt.blockerSummary.map((blocker) => actorEnrichmentParserAuditBlockerEvent(input.receipt, blocker))
  ];
  const blockerCodes = uniqueStrings(events.map((event) => event.blockerCode).filter(Boolean).map(String)) as TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_PARSER_STATUS_AUDIT_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_parser_status_audit_packet", `${input.receipt.id}:${generatedAt}:${events.map((event) => `${event.consumer}:${event.eventType}:${event.parserStatus}`).join(",")}`),
    generatedAt,
    ok: input.receipt.ok && events.every((event) => event.blockerCode === undefined),
    tenantId: input.receipt.tenantId,
    organizationId: input.receipt.organizationId,
    actor: input.receipt.actor,
    publicTiRoute: input.receipt.publicTiRoute,
    consumerReadinessReceiptId: input.receipt.id,
    events,
    summary: {
      totalEvents: events.length,
      readyConsumers: input.receipt.rows.filter((row) => row.ready).length,
      blockedConsumers: input.receipt.rows.filter((row) => !row.ready && row.consumer !== "sourceOps").length,
      actionRequiredEvents: events.filter((event) => event.state === "action_required").length,
      retryableEvents: events.filter((event) => event.retry.retryable || event.blockerCode === "parser_retry").length,
      sourceFamilies: input.receipt.sourceHealth.sourceFamilies,
      parserStatuses: uniqueStrings(events.map((event) => event.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][],
      blockerCodes,
      lastSuccessAt: input.receipt.sourceHealth.lastSuccessAt,
      lastFailureAt: input.receipt.sourceHealth.lastFailureAt,
      nextRetryAt: input.receipt.sourceHealth.nextRetryAt
    },
    consumers: [{
      consumer: "publicTI",
      ready: actorEnrichmentConsumerRow(input.receipt, "publicTI").ready,
      requiredFields: ["events[].consumer", "events[].parserStatus", "events[].provenanceIds"]
    }, {
      consumer: "alertGeneration",
      ready: actorEnrichmentConsumerRow(input.receipt, "alertGeneration").ready,
      requiredFields: ["events[].retry", "events[].blockerCode", "summary.retryableEvents"]
    }, {
      consumer: "sourceOps",
      ready: actorEnrichmentConsumerRow(input.receipt, "sourceOps").state === "ready" || input.receipt.blockerSummary.length > 0,
      requiredFields: ["events[].action", "events[].ownerLane", "events[].provenanceRef"]
    }],
    payloadShape: [
      "events[].eventType",
      "events[].consumer",
      "events[].parserStatus",
      "events[].retry",
      "events[].blockerCode",
      "events[].provenanceIds",
      "summary"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false,
      crossOrgDataIncluded: false
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

export function buildSourceProvenanceSourceActivationAuditPacket(input: {
  activationReadiness: TiSourceProvenanceSourcePackActivationReadiness;
  generatedAt?: string;
}): TiSourceProvenanceSourceActivationAuditPacket {
  const generatedAt = input.generatedAt ?? input.activationReadiness.generatedAt;
  const events = input.activationReadiness.actions.map((action) => sourceActivationAuditEvent(input.activationReadiness, action));
  const sourceFamilies = uniqueStrings(events.map((event) => event.family)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const readyToTest = events.filter((event) => event.status === "ready_to_test").length;
  const retryScheduled = events.filter((event) => event.status === "retry_scheduled").length;
  const policyBlocked = events.filter((event) => event.status === "policy_blocked").length;

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_AUDIT_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_activation_audit_packet", `${input.activationReadiness.id}:${generatedAt}:${events.map((event) => `${event.candidateId}:${event.status}`).join(",")}`),
    generatedAt,
    ok: events.length > 0 && readyToTest > 0,
    tenantId: input.activationReadiness.tenantId,
    organizationId: input.activationReadiness.organizationId,
    actor: input.activationReadiness.actor,
    sourcePackActivationReadinessId: input.activationReadiness.id,
    events,
    summary: {
      eventCount: events.length,
      readyToTest,
      retryScheduled,
      policyBlocked,
      parserReady: events.filter((event) => event.parserStatus === "ready").length,
      sourceFamilies,
      nextRetryAt: earliestTimestamp(events.map((event) => event.nextRetryAt))
    },
    consumers: sourceActivationAuditConsumers(input.activationReadiness, events),
    payloadShape: [
      "events[].candidateId",
      "events[].family",
      "events[].status",
      "events[].decision",
      "events[].parserStatus",
      "events[].provenance",
      "events[].route",
      "events[].alertability",
      "summary.sourceFamilies",
      "summary.nextRetryAt"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceSourceActivationDecisionReceipt(input: {
  auditPacket: TiSourceProvenanceSourceActivationAuditPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourceActivationDecisionReceipt {
  const generatedAt = input.generatedAt ?? input.auditPacket.generatedAt;
  const decisions = input.auditPacket.events.map((event) => sourceActivationDecision(input.auditPacket, event, generatedAt));
  const familyCoverage = sourceActivationDecisionFamilyCoverage(decisions);
  const sourceFamilies = uniqueStrings(decisions.map((decision) => decision.family)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const activationTestsQueued = decisions.filter((decision) => decision.outcome === "activation_test_queued").length;
  const parserRetriesQueued = decisions.filter((decision) => decision.outcome === "parser_retry_queued").length;
  const policyReviewsRequired = decisions.filter((decision) => decision.outcome === "policy_review_required").length;
  const alertableCandidates = decisions.filter((decision) => decision.alertability.canGenerateAlertEvidence).length;

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_activation_decision_receipt", `${input.auditPacket.id}:${generatedAt}:${decisions.map((decision) => `${decision.candidateId}:${decision.outcome}`).join(",")}`),
    generatedAt,
    ok: activationTestsQueued > 0,
    tenantId: input.auditPacket.tenantId,
    organizationId: input.auditPacket.organizationId,
    actor: input.auditPacket.actor,
    sourceActivationAuditPacketId: input.auditPacket.id,
    decisions,
    familyCoverage,
    summary: {
      decisionCount: decisions.length,
      activationTestsQueued,
      parserRetriesQueued,
      policyReviewsRequired,
      alertableCandidates,
      sourceFamilies,
      lastSuccessAt: newestTimestamp(decisions.map((decision) => decision.lastSuccessAt)),
      lastFailureAt: newestTimestamp(decisions.map((decision) => decision.lastFailureAt)),
      nextRetryAt: earliestTimestamp(decisions.map((decision) => decision.nextRetryAt))
    },
    consumers: sourceActivationDecisionConsumers(input.auditPacket, decisions),
    payloadShape: [
      "decisions[].candidateId",
      "decisions[].outcome",
      "decisions[].parserStatus",
      "decisions[].activationState",
      "decisions[].lastSuccessAt",
      "decisions[].lastFailureAt",
      "decisions[].nextRetryAt",
      "decisions[].provenance",
      "familyCoverage[]",
      "summary.alertableCandidates"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceSourcePackFixtureGrowthPacket(input: {
  decisionReceipt: TiSourceProvenanceSourceActivationDecisionReceipt;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureGrowthPacket {
  const generatedAt = input.generatedAt ?? input.decisionReceipt.generatedAt;
  const rows = input.decisionReceipt.decisions.flatMap((decision) => sourcePackFixtureGrowthRows(input.decisionReceipt, decision, generatedAt));
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(rows.map((row) => row.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const alertReadyCaptures = rows.filter((row) => row.rowType === "alert_ready_capture").length;
  const actorEnrichmentUpdates = rows.filter((row) => row.rowType === "actor_enrichment_update").length;

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_GROWTH_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_growth_packet", `${input.decisionReceipt.id}:${generatedAt}:${rows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: actorEnrichmentUpdates > 0 && alertReadyCaptures > 0,
    tenantId: input.decisionReceipt.tenantId,
    organizationId: input.decisionReceipt.organizationId,
    actor: input.decisionReceipt.actor,
    sourceActivationDecisionReceiptId: input.decisionReceipt.id,
    rows,
    summary: {
      rowCount: rows.length,
      actorEnrichmentUpdates,
      alertReadyCaptures,
      healthySources: rows.filter((row) => row.healthState === "healthy").length,
      degradedSources: rows.filter((row) => row.healthState === "degraded").length,
      staleSources: rows.filter((row) => row.healthState === "stale").length,
      blockedSources: rows.filter((row) => row.healthState === "blocked").length,
      sourceFamilies,
      parserStatuses,
      newestFreshnessAt: newestTimestamp(rows.map((row) => row.freshness.observedAt)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.retry.nextRetryAt))
    },
    consumers: sourcePackFixtureGrowthConsumers(input.decisionReceipt, rows),
    payloadShape: [
      "rows[].rowType",
      "rows[].sourceFamily",
      "rows[].parserStatus",
      "rows[].healthState",
      "rows[].freshness",
      "rows[].retry",
      "rows[].blockerReason",
      "rows[].downstreamRoutes",
      "rows[].provenance",
      "summary"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false,
      crossOrgDataIncluded: false
    }
  };
}

export function buildSourceProvenanceSourcePackFixtureCatalogPacket(input: {
  growthPackets: TiSourceProvenanceSourcePackFixtureGrowthPacket[];
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureCatalogPacket {
  const generatedAt = input.generatedAt ?? newestTimestamp(input.growthPackets.map((packet) => packet.generatedAt)) ?? new Date(0).toISOString();
  const rows = input.growthPackets.flatMap((packet) => packet.rows.map((row) => sourcePackFixtureCatalogRow(packet, row)));
  const alertReadyRows = rows.filter((row) => row.rowType === "alert_ready_capture").length;
  const blockedRows = rows.filter((row) => row.rowType === "source_blocker" || row.healthState === "blocked").length;
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(rows.map((row) => row.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const healthStates = uniqueStrings(rows.map((row) => row.healthState)) as TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  const coverageTags = uniqueStrings(rows.flatMap((row) => row.coverageTags));
  const averageConfidence = rows.length > 0 ? Number((rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length).toFixed(2)) : 0;
  const status = rows.length === 0 ? "blocked" : blockedRows === 0 ? "ready" : alertReadyRows > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_CATALOG_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_catalog_packet", `${generatedAt}:${input.growthPackets.map((packet) => packet.id).join(",")}:${rows.map((row) => row.catalogRowId).join(",")}`),
    generatedAt,
    ok: rows.length > 0,
    status,
    tenantId: input.growthPackets[0]?.tenantId ?? "",
    organizationId: input.growthPackets[0]?.organizationId,
    sourcePackFixtureGrowthPacketIds: input.growthPackets.map((packet) => packet.id),
    rows,
    summary: {
      rowCount: rows.length,
      actorCount: uniqueStrings(rows.map((row) => row.actor)).length,
      alertReadyRows,
      blockedRows,
      averageConfidence,
      actors: uniqueStrings(rows.map((row) => row.actor)),
      sourceFamilies,
      parserStatuses,
      healthStates,
      coverageTags,
      newestObservedAt: newestTimestamp(rows.map((row) => row.observedAt)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.nextRetryAt))
    },
    consumers: sourcePackFixtureCatalogConsumers(rows),
    payloadShape: [
      "rows[].actor",
      "rows[].publicTiRoute",
      "rows[].sourceFamily",
      "rows[].rowType",
      "rows[].parserStatus",
      "rows[].healthState",
      "rows[].observedAt",
      "rows[].confidence",
      "rows[].coverageTags",
      "rows[].downstreamRoutes",
      "rows[].provenance",
      "summary"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false,
      crossOrgDataIncluded: false
    }
  };
}

export function buildSourceProvenanceSourcePackFixtureAlertReadinessPacket(input: {
  catalog: TiSourceProvenanceSourcePackFixtureCatalogPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureAlertReadinessPacket {
  const generatedAt = input.generatedAt ?? input.catalog.generatedAt;
  const rows = input.catalog.rows.map(sourcePackFixtureAlertReadinessRow);
  const readyRows = rows.filter((row) => row.alertReadiness === "ready").length;
  const partialRows = rows.filter((row) => row.alertReadiness === "partial").length;
  const blockedRows = rows.filter((row) => row.alertReadiness === "blocked").length;
  const averageConfidence = rows.length > 0 ? Number((rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length).toFixed(2)) : 0;
  const status = rows.length === 0 || readyRows === 0 ? "blocked" : blockedRows === 0 && partialRows === 0 ? "ready" : "partial";
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(rows.map((row) => row.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const healthStates = uniqueStrings(rows.map((row) => row.healthState)) as TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  const prerequisiteCodes = uniqueStrings(rows.flatMap((row) => row.prerequisites.map((prerequisite) => prerequisite.code))) as TiSourceProvenanceSourcePackFixtureAlertReadinessPrerequisite["code"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_READINESS_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_alert_readiness_packet", `${input.catalog.id}:${generatedAt}:${rows.map((row) => row.readinessRowId).join(",")}`),
    generatedAt,
    ok: readyRows > 0,
    status,
    tenantId: input.catalog.tenantId,
    organizationId: input.catalog.organizationId,
    sourcePackFixtureCatalogPacketId: input.catalog.id,
    rows,
    summary: {
      rowCount: rows.length,
      readyRows,
      partialRows,
      blockedRows,
      averageConfidence,
      actors: uniqueStrings(rows.map((row) => row.actor)),
      publicTiRoutes: uniqueStrings(rows.map((row) => row.publicTiRoute)),
      sourceFamilies,
      parserStatuses,
      healthStates,
      coverageTags: uniqueStrings(rows.flatMap((row) => row.coverageTags)),
      prerequisiteCodes,
      newestObservedAt: newestTimestamp(rows.map((row) => row.observedAt)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.nextRetryAt))
    },
    consumers: sourcePackFixtureAlertReadinessConsumers(rows),
    payloadShape: [
      "rows[].actor",
      "rows[].publicTiRoute",
      "rows[].sourceFamily",
      "rows[].parserStatus",
      "rows[].healthState",
      "rows[].alertReadiness",
      "rows[].coverageTags",
      "rows[].prerequisites",
      "rows[].remediation",
      "rows[].downstreamRoutes",
      "rows[].provenance",
      "summary"
    ],
    safeOutput: input.catalog.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureAlertDedupePacket(input: {
  alertReadiness: TiSourceProvenanceSourcePackFixtureAlertReadinessPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureAlertDedupePacket {
  const generatedAt = input.generatedAt ?? input.alertReadiness.generatedAt;
  const seen = new Map<string, string>();
  const rows = input.alertReadiness.rows.map((row) => sourcePackFixtureAlertDedupeRow(row, seen));
  const canonicalReadyRows = rows.filter((row) => row.dedupeState === "canonical" && row.alertEligibility === "ready").length;
  const duplicateRows = rows.filter((row) => row.dedupeState === "duplicate").length;
  const heldRows = rows.filter((row) => row.alertEligibility === "held").length;
  const blockerCodes = uniqueStrings(rows.flatMap((row) => row.blockerCodes)) as TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode[];
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const status = rows.length === 0 || canonicalReadyRows === 0 ? "blocked" : heldRows === 0 && duplicateRows === 0 ? "ready" : "partial";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_DEDUPE_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_alert_dedupe_packet", `${input.alertReadiness.id}:${generatedAt}:${rows.map((row) => row.dedupeRowId).join(",")}`),
    generatedAt,
    ok: canonicalReadyRows > 0,
    status,
    tenantId: input.alertReadiness.tenantId,
    organizationId: input.alertReadiness.organizationId,
    sourcePackFixtureAlertReadinessPacketId: input.alertReadiness.id,
    rows,
    summary: {
      rowCount: rows.length,
      canonicalReadyRows,
      duplicateRows,
      heldRows,
      actors: uniqueStrings(rows.map((row) => row.actor)),
      publicTiRoutes: uniqueStrings(rows.map((row) => row.publicTiRoute)),
      sourceFamilies,
      blockerCodes,
      newestObservedAt: newestTimestamp(rows.map((row) => row.observedAt)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.nextRetryAt))
    },
    consumers: sourcePackFixtureAlertDedupeConsumers(rows),
    payloadShape: [
      "rows[].actor",
      "rows[].publicTiRoute",
      "rows[].sourceFamily",
      "rows[].dedupeKey",
      "rows[].dedupeState",
      "rows[].alertEligibility",
      "rows[].blockerCodes",
      "rows[].duplicateOf",
      "rows[].action",
      "rows[].downstreamRoutes",
      "rows[].provenance",
      "summary"
    ],
    safeOutput: input.alertReadiness.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureHealthDrilldownPacket(input: {
  dedupe: TiSourceProvenanceSourcePackFixtureAlertDedupePacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureHealthDrilldownPacket {
  const generatedAt = input.generatedAt ?? input.dedupe.generatedAt;
  const rows = input.dedupe.rows.map(sourcePackFixtureHealthDrilldownRow);
  const filters = sourcePackFixtureHealthDrilldownFilters(rows);
  const activeRows = rows.filter((row) => row.activationState === "active").length;
  const retryableRows = rows.filter((row) => row.retry.retryable).length;
  const policyBlockedRows = rows.filter((row) => row.activationState === "policy_blocked").length;
  const duplicateRows = rows.filter((row) => row.activationState === "suppressed_duplicate").length;
  const alertReadyRows = rows.filter((row) => row.alertEligibility === "ready").length;
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(rows.map((row) => row.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const healthStates = uniqueStrings(rows.map((row) => row.healthState)) as TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  const activationStates = uniqueStrings(rows.map((row) => row.activationState)) as TiSourceProvenanceSourcePackFixtureHealthDrilldownActivationState[];
  const failureCodes = uniqueStrings(rows.map((row) => row.failure.code)) as TiSourceProvenanceSourcePackFixtureHealthDrilldownFailureCode[];
  const status = rows.length === 0 || activeRows === 0 ? "blocked" : rows.some((row) => row.activationState !== "active") ? "partial" : "ready";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_HEALTH_DRILLDOWN_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_health_drilldown_packet", `${input.dedupe.id}:${generatedAt}:${rows.map((row) => row.drilldownRowId).join(",")}`),
    generatedAt,
    ok: activeRows > 0,
    status,
    tenantId: input.dedupe.tenantId,
    organizationId: input.dedupe.organizationId,
    sourcePackFixtureAlertDedupePacketId: input.dedupe.id,
    rows,
    filters,
    summary: {
      rowCount: rows.length,
      activeRows,
      retryableRows,
      policyBlockedRows,
      duplicateRows,
      alertReadyRows,
      actors: uniqueStrings(rows.map((row) => row.actor)),
      publicTiRoutes: uniqueStrings(rows.map((row) => row.publicTiRoute)),
      sourceFamilies,
      parserStatuses,
      healthStates,
      activationStates,
      failureCodes,
      newestObservedAt: newestTimestamp(rows.map((row) => row.observedAt)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.retry.nextRetryAt))
    },
    consumers: sourcePackFixtureHealthDrilldownConsumers(rows),
    payloadShape: [
      "rows[].actor",
      "rows[].publicTiRoute",
      "rows[].sourceFamily",
      "rows[].parserStatus",
      "rows[].healthState",
      "rows[].activationState",
      "rows[].retry",
      "rows[].failure",
      "rows[].downstreamRoutes",
      "rows[].provenance",
      "filters[]",
      "summary"
    ],
    safeOutput: input.dedupe.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureIntelligencePacket(input: {
  drilldown: TiSourceProvenanceSourcePackFixtureHealthDrilldownPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureIntelligencePacket {
  const generatedAt = input.generatedAt ?? input.drilldown.generatedAt;
  const actorRows = sourcePackFixtureIntelligenceRows(input.drilldown);
  const readyActors = actorRows.filter((row) => row.coverageState === "ready").length;
  const partialActors = actorRows.filter((row) => row.coverageState === "partial").length;
  const blockedActors = actorRows.filter((row) => row.coverageState === "blocked").length;
  const sourceFamilies = uniqueStrings(actorRows.flatMap((row) => row.sourceFamilies)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const coverageStates = uniqueStrings(actorRows.map((row) => row.coverageState)) as TiSourceProvenanceSourcePackFixtureIntelligenceActorRow["coverageState"][];
  const gapCodes = uniqueStrings(actorRows.flatMap((row) => row.gaps.map((gap) => gap.code))) as TiSourceProvenanceSourcePackFixtureIntelligenceGap["code"][];
  const status = actorRows.length === 0 || readyActors + partialActors === 0 ? "blocked" : blockedActors === 0 && partialActors === 0 ? "ready" : "partial";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_INTELLIGENCE_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_intelligence_packet", `${input.drilldown.id}:${generatedAt}:${actorRows.map((row) => `${row.actor}:${row.coverageState}`).join(",")}`),
    generatedAt,
    ok: readyActors + partialActors > 0,
    status,
    tenantId: input.drilldown.tenantId,
    organizationId: input.drilldown.organizationId,
    sourcePackFixtureHealthDrilldownPacketId: input.drilldown.id,
    actorRows,
    summary: {
      actorCount: actorRows.length,
      readyActors,
      partialActors,
      blockedActors,
      aliasCount: actorRows.reduce((sum, row) => sum + row.aliases.length, 0),
      indicatorCount: actorRows.reduce((sum, row) => sum + row.indicators.length, 0),
      techniqueCount: actorRows.reduce((sum, row) => sum + row.ttps.length, 0),
      sourceFamilies,
      coverageStates,
      gapCodes,
      newestObservedAt: newestTimestamp(actorRows.map((row) => row.freshness.newestObservedAt)),
      nextRetryAt: earliestTimestamp(actorRows.map((row) => row.freshness.nextRetryAt))
    },
    consumers: sourcePackFixtureIntelligenceConsumers(actorRows),
    payloadShape: [
      "actorRows[].actor",
      "actorRows[].aliases",
      "actorRows[].coverageState",
      "actorRows[].sourceFamilies",
      "actorRows[].confidence",
      "actorRows[].freshness",
      "actorRows[].indicators",
      "actorRows[].ttps",
      "actorRows[].gaps",
      "actorRows[].downstreamRoutes",
      "actorRows[].provenance",
      "summary"
    ],
    safeOutput: input.drilldown.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureOperatorRemediationPacket(input: {
  intelligence: TiSourceProvenanceSourcePackFixtureIntelligencePacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureOperatorRemediationPacket {
  const generatedAt = input.generatedAt ?? input.intelligence.generatedAt;
  const actions = sourcePackFixtureOperatorRemediationActions(input.intelligence);
  const sourceFamilies = uniqueStrings(actions.flatMap((action) => action.sourceFamily ? [action.sourceFamily] : [])) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const priorityStates = uniqueStrings(actions.map((action) => action.priority)) as TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["priority"][];

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_OPERATOR_REMEDIATION_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_operator_remediation_packet", `${input.intelligence.id}:${generatedAt}:${actions.map((action) => action.actionId).join(",")}`),
    generatedAt,
    ok: actions.length > 0,
    status: actions.length > 0 ? "ready" : "blocked",
    tenantId: input.intelligence.tenantId,
    organizationId: input.intelligence.organizationId,
    sourcePackFixtureIntelligencePacketId: input.intelligence.id,
    actions,
    summary: {
      actionCount: actions.length,
      retryParser: actions.filter((action) => action.action === "retry_parser").length,
      policyReviews: actions.filter((action) => action.action === "request_policy_review").length,
      watchlistMaterialization: actions.filter((action) => action.action === "materialize_watchlist_terms").length,
      sourceInspections: actions.filter((action) => action.action === "inspect_source_health").length,
      actors: uniqueStrings(actions.map((action) => action.actor)),
      sourceFamilies,
      priorityStates,
      nextRetryAt: earliestTimestamp(actions.map((action) => action.retry.nextRetryAt))
    },
    consumers: sourcePackFixtureOperatorRemediationConsumers(actions),
    payloadShape: [
      "actions[].actor",
      "actions[].publicTiRoute",
      "actions[].action",
      "actions[].ownerLane",
      "actions[].sourceFamily",
      "actions[].gapCode",
      "actions[].priority",
      "actions[].retry",
      "actions[].route",
      "actions[].provenance",
      "summary"
    ],
    safeOutput: input.intelligence.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureActionExecutionPacket(input: {
  remediation: TiSourceProvenanceSourcePackFixtureOperatorRemediationPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureActionExecutionPacket {
  const generatedAt = input.generatedAt ?? input.remediation.generatedAt;
  const rows = input.remediation.actions.map((action) => sourcePackFixtureActionExecutionRow(input.remediation, action));
  const sourceFamilies = uniqueStrings(rows.flatMap((row) => row.sourceFamily ? [row.sourceFamily] : [])) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const ownerLanes = uniqueStrings(rows.map((row) => row.ownerLane)) as TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"][];
  const blockedRows = rows.filter((row) => row.executionState !== "ready").length;

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_EXECUTION_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_action_execution_packet", `${input.remediation.id}:${generatedAt}:${rows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: rows.length > 0,
    status: rows.length === 0 ? "blocked" : blockedRows > 0 ? "partial" : "ready",
    tenantId: input.remediation.tenantId,
    organizationId: input.remediation.organizationId,
    sourcePackFixtureOperatorRemediationPacketId: input.remediation.id,
    rows,
    summary: {
      rowCount: rows.length,
      dryRunExecutable: rows.filter((row) => row.canExecuteDryRun).length,
      blockedRows,
      retryWaiting: rows.filter((row) => row.executionState === "retry_waiting").length,
      policyReviews: rows.filter((row) => row.executionState === "policy_review_required").length,
      sourceInspections: rows.filter((row) => row.executionState === "inspection_required").length,
      watchlistMaterialization: rows.filter((row) => row.action === "materialize_watchlist_terms").length,
      actors: uniqueStrings(rows.map((row) => row.actor)),
      sourceFamilies,
      ownerLanes,
      nextRetryAt: earliestTimestamp(rows.map((row) => row.retry.nextRetryAt))
    },
    consumers: sourcePackFixtureActionExecutionConsumers(rows),
    payloadShape: [
      "rows[].actor",
      "rows[].publicTiRoute",
      "rows[].sourceFamily",
      "rows[].action",
      "rows[].executionState",
      "rows[].typedFailureReason",
      "rows[].downstreamReadiness",
      "rows[].route",
      "rows[].provenance",
      "summary"
    ],
    safeOutput: input.remediation.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureActionAuditPacket(input: {
  execution: TiSourceProvenanceSourcePackFixtureActionExecutionPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureActionAuditPacket {
  const generatedAt = input.generatedAt ?? input.execution.generatedAt;
  const events = input.execution.rows.map((row) => sourcePackFixtureActionAuditEvent(input.execution, row, generatedAt));
  const sourceFamilies = uniqueStrings(events.flatMap((event) => event.sourceFamily ? [event.sourceFamily] : [])) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const ownerLanes = uniqueStrings(events.map((event) => event.ownerLane)) as TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["ownerLane"][];
  const blockedEvents = events.filter((event) => event.eventType !== "dry_run_ready").length;

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_AUDIT_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_action_audit_packet", `${input.execution.id}:${generatedAt}:${events.map((event) => event.eventId).join(",")}`),
    generatedAt,
    ok: events.length > 0,
    status: events.length === 0 ? "blocked" : blockedEvents > 0 ? "partial" : "ready",
    tenantId: input.execution.tenantId,
    organizationId: input.execution.organizationId,
    sourcePackFixtureActionExecutionPacketId: input.execution.id,
    events,
    summary: {
      eventCount: events.length,
      readyEvents: events.filter((event) => event.eventType === "dry_run_ready").length,
      blockedEvents,
      parserRetryEvents: events.filter((event) => event.eventType === "retry_waiting").length,
      policyReviewEvents: events.filter((event) => event.eventType === "policy_review_required").length,
      inspectionEvents: events.filter((event) => event.eventType === "inspection_required").length,
      alertReadyEvents: events.filter((event) => event.downstreamReadiness.alertGeneration).length,
      publicTiReadyEvents: events.filter((event) => event.downstreamReadiness.publicTI).length,
      actors: uniqueStrings(events.map((event) => event.actor)),
      sourceFamilies,
      ownerLanes,
      nextRetryAt: earliestTimestamp(events.map((event) => event.retry.nextRetryAt))
    },
    consumers: sourcePackFixtureActionAuditConsumers(events),
    payloadShape: [
      "events[].actor",
      "events[].publicTiRoute",
      "events[].sourceFamily",
      "events[].action",
      "events[].eventType",
      "events[].typedFailureReason",
      "events[].downstreamReadiness",
      "events[].route",
      "events[].provenance",
      "summary"
    ],
    safeOutput: input.execution.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureActionDrilldownPacket(input: {
  audit: TiSourceProvenanceSourcePackFixtureActionAuditPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureActionDrilldownPacket {
  const generatedAt = input.generatedAt ?? input.audit.generatedAt;
  const drilldownRows = input.audit.events.map((event) => sourcePackFixtureActionDrilldownRow(input.audit, event));
  const sourceFamilies = uniqueStrings(drilldownRows.flatMap((row) => row.sourceFamily ? [row.sourceFamily] : [])) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStates = uniqueStrings(drilldownRows.map((row) => row.parserState)) as TiSourceProvenanceSourcePackFixtureActionDrilldownRow["parserState"][];
  const healthStates = uniqueStrings(drilldownRows.map((row) => row.healthState)) as TiSourceProvenanceSourcePackFixtureActionDrilldownRow["healthState"][];
  const activationStates = uniqueStrings(drilldownRows.map((row) => row.activationState)) as TiSourceProvenanceSourcePackFixtureActionDrilldownRow["activationState"][];
  const failureCodes = uniqueStrings(drilldownRows.flatMap((row) => row.failure ? [row.failure.code] : [])) as NonNullable<TiSourceProvenanceSourcePackFixtureActionDrilldownRow["failure"]>["code"][];
  const blockedRows = drilldownRows.filter((row) => row.healthState === "blocked").length;
  const degradedRows = drilldownRows.filter((row) => row.healthState === "degraded").length;

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_DRILLDOWN_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_action_drilldown_packet", `${input.audit.id}:${generatedAt}:${drilldownRows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: drilldownRows.length > 0,
    status: drilldownRows.length === 0 ? "blocked" : (blockedRows > 0 || degradedRows > 0 ? "partial" : "ready"),
    tenantId: input.audit.tenantId,
    organizationId: input.audit.organizationId,
    sourcePackFixtureActionAuditPacketId: input.audit.id,
    drilldownRows,
    filters: sourcePackFixtureActionDrilldownFilters(drilldownRows),
    summary: {
      rowCount: drilldownRows.length,
      readyRows: drilldownRows.filter((row) => row.activationState === "ready").length,
      degradedRows,
      blockedRows,
      alertReadyRows: drilldownRows.filter((row) => row.affectedConsumers.includes("alertGeneration")).length,
      publicTiReadyRows: drilldownRows.filter((row) => row.affectedConsumers.includes("publicTI")).length,
      retryableRows: drilldownRows.filter((row) => row.retry.retryable).length,
      actors: uniqueStrings(drilldownRows.map((row) => row.actor)),
      sourceFamilies,
      parserStates,
      healthStates,
      activationStates,
      failureCodes,
      nextRetryAt: earliestTimestamp(drilldownRows.map((row) => row.retry.nextRetryAt))
    },
    consumers: sourcePackFixtureActionDrilldownConsumers(drilldownRows),
    payloadShape: [
      "drilldownRows[].actor",
      "drilldownRows[].publicTiRoute",
      "drilldownRows[].sourceFamily",
      "drilldownRows[].parserState",
      "drilldownRows[].healthState",
      "drilldownRows[].activationState",
      "drilldownRows[].failure",
      "drilldownRows[].affectedConsumers",
      "drilldownRows[].route",
      "drilldownRows[].provenance",
      "filters",
      "summary"
    ],
    safeOutput: input.audit.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureActionAlertBridgePacket(input: {
  drilldown: TiSourceProvenanceSourcePackFixtureActionDrilldownPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureActionAlertBridgePacket {
  const generatedAt = input.generatedAt ?? input.drilldown.generatedAt;
  const rows = input.drilldown.drilldownRows.map((row) => sourcePackFixtureActionAlertBridgeRow(input.drilldown, row));
  const sourceFamilies = uniqueStrings(rows.flatMap((row) => row.sourceFamily ? [row.sourceFamily] : [])) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const coverageStates = uniqueStrings(rows.map((row) => row.coverageState)) as TiSourceProvenanceSourcePackFixtureActionAlertBridgeRow["coverageState"][];
  const blockerCodes = uniqueStrings(rows.flatMap((row) => row.missingPrerequisites.map((prerequisite) => prerequisite.code))) as TiSourceProvenanceSourcePackFixtureActionAlertBridgePrerequisite["code"][];
  const matchableFields = uniqueStrings(rows.flatMap((row) => row.matchableFields));
  const alertReadyRows = rows.filter((row) => row.alertReadiness === "ready").length;
  const publicTiReadyRows = rows.filter((row) => row.publicTiReadiness === "ready").length;

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ACTION_ALERT_BRIDGE_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_action_alert_bridge_packet", `${input.drilldown.id}:${generatedAt}:${rows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: rows.length > 0,
    status: rows.length === 0 ? "blocked" : alertReadyRows > 0 && rows.some((row) => row.alertReadiness === "blocked") ? "partial" : alertReadyRows > 0 ? "ready" : "blocked",
    tenantId: input.drilldown.tenantId,
    organizationId: input.drilldown.organizationId,
    sourcePackFixtureActionDrilldownPacketId: input.drilldown.id,
    rows,
    summary: {
      rowCount: rows.length,
      alertReadyRows,
      publicTiReadyRows,
      blockedRows: rows.filter((row) => row.coverageState === "blocked").length,
      degradedRows: rows.filter((row) => row.coverageState === "degraded").length,
      missingPrerequisiteCount: rows.reduce((sum, row) => sum + row.missingPrerequisites.length, 0),
      actors: uniqueStrings(rows.map((row) => row.actor)),
      sourceFamilies,
      coverageStates,
      blockerCodes,
      matchableFields,
      nextRetryAt: earliestTimestamp(rows.map((row) => row.freshness.nextRetryAt))
    },
    consumers: sourcePackFixtureActionAlertBridgeConsumers(rows),
    payloadShape: [
      "rows[].actor",
      "rows[].publicTiRoute",
      "rows[].sourceFamily",
      "rows[].coverageState",
      "rows[].alertReadiness",
      "rows[].publicTiReadiness",
      "rows[].matchableFields",
      "rows[].freshness",
      "rows[].missingPrerequisites",
      "rows[].provenance",
      "summary"
    ],
    safeOutput: input.drilldown.safeOutput
  };
}

export function buildSourceProvenanceSourcePackFixtureReadinessExport(input: {
  packet: TiSourceProvenanceSourcePackFixtureGrowthPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackFixtureReadinessExport {
  const generatedAt = input.generatedAt ?? input.packet.generatedAt;
  const rows = input.packet.rows.map(sourcePackFixtureReadinessRow);
  const blockers = sourcePackFixtureReadinessBlockers(input.packet);
  const alertReadyCaptures = input.packet.rows.filter((row) => row.rowType === "alert_ready_capture").length;
  const publicTiReady = rows.some((row) => row.readyFor.includes("publicTI"));
  const alertReady = alertReadyCaptures > 0;
  const sourceOpsReady = rows.length > 0 || blockers.length > 0;
  const dashboardReady = sourceOpsReady && rows.every((row) => row.provenance.contentHash && row.provenance.captureId);
  const integrationReady = publicTiReady && alertReady && dashboardReady;
  const status = integrationReady && blockers.length === 0 ? "ready" : (publicTiReady || alertReady || sourceOpsReady ? "partial" : "blocked");

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_READINESS_EXPORT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_fixture_readiness_export", `${input.packet.id}:${generatedAt}:${rows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: integrationReady,
    status,
    tenantId: input.packet.tenantId,
    organizationId: input.packet.organizationId,
    actor: input.packet.actor,
    sourcePackFixtureGrowthPacketId: input.packet.id,
    readiness: {
      publicTI: publicTiReady,
      alertGeneration: alertReady,
      dashboard: dashboardReady,
      sourceOps: sourceOpsReady,
      integration: integrationReady
    },
    rows,
    blockers,
    summary: {
      rowCount: rows.length,
      readyRows: rows.filter((row) => row.healthState === "healthy").length,
      degradedRows: rows.filter((row) => row.healthState === "degraded").length,
      staleRows: rows.filter((row) => row.healthState === "stale").length,
      blockedRows: rows.filter((row) => row.healthState === "blocked").length,
      alertReadyCaptures,
      sourceFamilies: input.packet.summary.sourceFamilies,
      parserStatuses: input.packet.summary.parserStatuses,
      freshnessStates: uniqueStrings(rows.map((row) => row.freshnessState)) as Array<TiSourceProvenanceSourcePackFixtureGrowthRow["freshness"]["state"]>,
      nextRetryAt: input.packet.summary.nextRetryAt,
      newestFreshnessAt: input.packet.summary.newestFreshnessAt
    },
    consumers: sourcePackFixtureReadinessConsumers(input.packet, {
      publicTI: publicTiReady,
      alertGeneration: alertReady,
      dashboard: dashboardReady,
      sourceOps: sourceOpsReady,
      integration: integrationReady
    }),
    payloadShape: [
      "readiness",
      "rows[].sourceFamily",
      "rows[].parserStatus",
      "rows[].healthState",
      "rows[].freshnessState",
      "rows[].retryable",
      "rows[].downstreamConsumerRoutes",
      "rows[].provenance",
      "blockers[]",
      "summary"
    ],
    safeOutput: input.packet.safeOutput
  };
}

export function buildSourceProvenanceSourcePackRetryPolicyPacket(input: {
  readinessExport: TiSourceProvenanceSourcePackFixtureReadinessExport;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackRetryPolicyPacket {
  const generatedAt = input.generatedAt ?? input.readinessExport.generatedAt;
  const retryRows = input.readinessExport.rows.flatMap((row) => sourcePackRetryPolicyRows(input.readinessExport, row));
  const retryNow = retryRows.filter((row) => row.retryState === "retry_now").length;
  const retryLater = retryRows.filter((row) => row.retryState === "retry_later").length;
  const policyReviewRequired = retryRows.filter((row) => row.retryState === "policy_review_required").length;
  const alertReady = retryRows.filter((row) => row.retryState === "alert_ready").length;
  const inspectOnly = retryRows.filter((row) => row.retryState === "inspect_only").length;
  const sourceFamilies = uniqueStrings(retryRows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(retryRows.map((row) => row.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const healthStates = uniqueStrings(retryRows.map((row) => row.healthState)) as TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  const status = alertReady > 0 && policyReviewRequired === 0 && retryLater === 0 ? "ready" : retryRows.length > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_RETRY_POLICY_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_retry_policy_packet", `${input.readinessExport.id}:${generatedAt}:${retryRows.map((row) => `${row.rowId}:${row.retryState}`).join(",")}`),
    generatedAt,
    ok: alertReady > 0,
    status,
    tenantId: input.readinessExport.tenantId,
    organizationId: input.readinessExport.organizationId,
    actor: input.readinessExport.actor,
    sourcePackFixtureReadinessExportId: input.readinessExport.id,
    retryRows,
    summary: {
      rowCount: retryRows.length,
      retryNow,
      retryLater,
      policyReviewRequired,
      inspectOnly,
      alertReady,
      sourceFamilies,
      parserStatuses,
      healthStates,
      nextRetryAt: earliestTimestamp(retryRows.map((row) => row.nextRetryAt)),
      newestFreshnessAt: input.readinessExport.summary.newestFreshnessAt
    },
    consumers: sourcePackRetryPolicyConsumers(input.readinessExport, {
      sourceOps: retryRows.length > 0,
      dashboard: retryRows.length > 0,
      alertGeneration: alertReady > 0,
      integration: retryRows.length > 0 && input.readinessExport.readiness.integration
    }),
    payloadShape: [
      "retryRows[].sourceFamily",
      "retryRows[].parserStatus",
      "retryRows[].healthState",
      "retryRows[].freshnessState",
      "retryRows[].retryState",
      "retryRows[].blockerCode",
      "retryRows[].nextRetryAt",
      "retryRows[].downstreamConsumerRoutes",
      "retryRows[].provenance",
      "retryRows[].action",
      "summary"
    ],
    safeOutput: input.readinessExport.safeOutput
  };
}

export function buildSourceProvenanceSourceCandidateValidationReceipt(input: {
  retryPolicyPacket: TiSourceProvenanceSourcePackRetryPolicyPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourceCandidateValidationReceipt {
  const generatedAt = input.generatedAt ?? input.retryPolicyPacket.generatedAt;
  const validations = input.retryPolicyPacket.retryRows.map((row) => sourceCandidateValidationRow(input.retryPolicyPacket, row));
  const accepted = validations.filter((row) => row.candidateState === "accepted").length;
  const retryGated = validations.filter((row) => row.candidateState === "retry_gated").length;
  const policyGated = validations.filter((row) => row.candidateState === "policy_gated").length;
  const inspectOnly = validations.filter((row) => row.candidateState === "inspect_only").length;
  const alertReady = validations.filter((row) => row.validation.allowedForAlertGeneration).length;
  const sourceFamilies = uniqueStrings(validations.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(validations.map((row) => row.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const healthStates = uniqueStrings(validations.map((row) => row.healthState)) as TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  const blockerCodes = uniqueStrings(validations.map((row) => row.validation.blockerCode).filter(Boolean).map(String)) as Array<TiSourceProvenanceSourcePackRetryPolicyRow["blockerCode"]>;
  const publicTiReady = validations.some((row) => row.validation.allowedForPublicTI);
  const integrationReady = validations.length > 0 && validations.every((row) => row.validation.allowedForIntegration);
  const status = alertReady > 0 && policyGated === 0 && retryGated === 0 ? "ready" : validations.length > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_CANDIDATE_VALIDATION_RECEIPT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_candidate_validation_receipt", `${input.retryPolicyPacket.id}:${generatedAt}:${validations.map((row) => `${row.retryPolicyRowId}:${row.candidateState}`).join(",")}`),
    generatedAt,
    ok: publicTiReady && alertReady > 0,
    status,
    tenantId: input.retryPolicyPacket.tenantId,
    organizationId: input.retryPolicyPacket.organizationId,
    actor: input.retryPolicyPacket.actor,
    sourcePackRetryPolicyPacketId: input.retryPolicyPacket.id,
    validations,
    summary: {
      validationCount: validations.length,
      accepted,
      retryGated,
      policyGated,
      inspectOnly,
      alertReady,
      sourceFamilies,
      parserStatuses,
      healthStates,
      blockerCodes,
      nextRetryAt: input.retryPolicyPacket.summary.nextRetryAt,
      newestFreshnessAt: input.retryPolicyPacket.summary.newestFreshnessAt
    },
    consumers: sourceCandidateValidationConsumers(input.retryPolicyPacket, {
      publicTI: publicTiReady,
      alertGeneration: alertReady > 0,
      dashboard: validations.length > 0,
      sourceOps: retryGated > 0 || policyGated > 0 || inspectOnly > 0,
      integration: integrationReady
    }),
    payloadShape: [
      "validations[].candidateState",
      "validations[].sourceFamily",
      "validations[].parserStatus",
      "validations[].healthState",
      "validations[].freshnessState",
      "validations[].validation",
      "validations[].downstreamRoutes",
      "validations[].provenance",
      "summary"
    ],
    safeOutput: input.retryPolicyPacket.safeOutput
  };
}

export function buildSourceProvenanceActorSourceCoveragePortfolio(input: {
  validationReceipts: TiSourceProvenanceSourceCandidateValidationReceipt[];
  generatedAt?: string;
}): TiSourceProvenanceActorSourceCoveragePortfolio {
  const generatedAt = input.generatedAt ?? newestTimestamp(input.validationReceipts.map((receipt) => receipt.generatedAt)) ?? new Date(0).toISOString();
  const actorRows = input.validationReceipts.map(actorSourceCoveragePortfolioRow);
  const alertReadyActors = actorRows.filter((row) => row.readiness.alertGeneration).length;
  const readyActors = actorRows.filter((row) => row.status === "ready").length;
  const partialActors = actorRows.filter((row) => row.status === "partial").length;
  const blockedActors = actorRows.filter((row) => row.status === "blocked").length;
  const sourceFamilies = uniqueStrings(actorRows.flatMap((row) => row.sourceFamilies)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(actorRows.flatMap((row) => row.parserStatuses)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const healthStates = uniqueStrings(actorRows.flatMap((row) => row.healthStates)) as TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  const blockerCodes = uniqueStrings(actorRows.flatMap((row) => row.blockers.map((blocker) => blocker.code).filter(Boolean).map(String))) as Array<TiSourceProvenanceSourcePackRetryPolicyRow["blockerCode"]>;
  const status = actorRows.length === 0 ? "blocked" : blockedActors === 0 && partialActors === 0 ? "ready" : alertReadyActors > 0 || partialActors > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_SOURCE_COVERAGE_PORTFOLIO_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_source_coverage_portfolio", `${generatedAt}:${actorRows.map((row) => `${row.actor}:${row.sourceCandidateValidationReceiptId}:${row.status}`).join(",")}`),
    generatedAt,
    ok: alertReadyActors > 0,
    status,
    tenantId: input.validationReceipts[0]?.tenantId ?? "",
    organizationId: input.validationReceipts[0]?.organizationId,
    actorRows,
    summary: {
      actorCount: actorRows.length,
      readyActors,
      partialActors,
      blockedActors,
      alertReadyActors,
      sourceFamilies,
      parserStatuses,
      healthStates,
      blockerCodes,
      newestFreshnessAt: newestTimestamp(actorRows.map((row) => row.freshness.newestFreshnessAt)),
      nextRetryAt: earliestTimestamp(actorRows.map((row) => row.freshness.nextRetryAt))
    },
    consumers: actorSourceCoveragePortfolioConsumers(actorRows),
    payloadShape: [
      "actorRows[].actor",
      "actorRows[].publicTiRoute",
      "actorRows[].readiness",
      "actorRows[].coverageCounts",
      "actorRows[].sourceFamilies",
      "actorRows[].parserStatuses",
      "actorRows[].healthStates",
      "actorRows[].freshness",
      "actorRows[].blockers",
      "actorRows[].downstreamRoutes",
      "actorRows[].provenance",
      "summary"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false,
      crossOrgDataIncluded: false
    }
  };
}

export function buildSourceProvenanceActorEnrichmentAlertPrerequisitePacket(input: {
  portfolio: TiSourceProvenanceActorSourceCoveragePortfolio;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentAlertPrerequisitePacket {
  const generatedAt = input.generatedAt ?? input.portfolio.generatedAt;
  const actorRows = input.portfolio.actorRows.map(actorEnrichmentAlertPrerequisiteRow);
  const readyActors = actorRows.filter((row) => row.alertReadiness === "ready").length;
  const partialActors = actorRows.filter((row) => row.alertReadiness === "partial").length;
  const blockedActors = actorRows.filter((row) => row.alertReadiness === "blocked").length;
  const alertReadyActors = actorRows.filter((row) => row.coverageCounts.alertReady > 0).length;
  const prerequisiteCount = actorRows.reduce((sum, row) => sum + row.missingPrerequisites.length, 0);
  const sourceFamilies = uniqueStrings(actorRows.flatMap((row) => row.sourceFamilies)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(actorRows.flatMap((row) => row.parserStatuses)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const healthStates = uniqueStrings(actorRows.flatMap((row) => row.healthStates)) as TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"][];
  const prerequisiteCodes = uniqueStrings(actorRows.flatMap((row) => row.missingPrerequisites.map((prerequisite) => prerequisite.code))) as TiSourceProvenanceActorEnrichmentAlertPrerequisite["code"][];
  const status = actorRows.length === 0 ? "blocked" : blockedActors === 0 && partialActors === 0 ? "ready" : alertReadyActors > 0 || partialActors > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_ALERT_PREREQUISITE_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_alert_prerequisite_packet", `${generatedAt}:${input.portfolio.id}:${actorRows.map((row) => `${row.actor}:${row.alertReadiness}:${row.missingPrerequisites.map((prerequisite) => prerequisite.code).join("|")}`).join(",")}`),
    generatedAt,
    ok: alertReadyActors > 0,
    status,
    tenantId: input.portfolio.tenantId,
    organizationId: input.portfolio.organizationId,
    actorRows,
    summary: {
      actorCount: actorRows.length,
      readyActors,
      partialActors,
      blockedActors,
      alertReadyActors,
      prerequisiteCount,
      sourceFamilies,
      parserStatuses,
      healthStates,
      prerequisiteCodes,
      newestFreshnessAt: newestTimestamp(actorRows.map((row) => row.freshness.newestFreshnessAt)),
      nextRetryAt: earliestTimestamp(actorRows.map((row) => row.freshness.nextRetryAt))
    },
    consumers: actorEnrichmentAlertPrerequisiteConsumers(actorRows),
    payloadShape: [
      "actorRows[].actor",
      "actorRows[].publicTiRoute",
      "actorRows[].alertReadiness",
      "actorRows[].coverageCounts",
      "actorRows[].sourceFamilies",
      "actorRows[].parserStatuses",
      "actorRows[].healthStates",
      "actorRows[].freshness",
      "actorRows[].missingPrerequisites",
      "actorRows[].downstreamRoutes",
      "actorRows[].provenance",
      "summary"
    ],
    safeOutput: input.portfolio.safeOutput
  };
}

export function buildSourceProvenanceActorEnrichmentSourceHealthEventPacket(input: {
  alertPrerequisitePacket: TiSourceProvenanceActorEnrichmentAlertPrerequisitePacket;
  generatedAt?: string;
}): TiSourceProvenanceActorEnrichmentSourceHealthEventPacket {
  const generatedAt = input.generatedAt ?? input.alertPrerequisitePacket.generatedAt;
  const events = input.alertPrerequisitePacket.actorRows.flatMap((row) => actorEnrichmentSourceHealthEvents(row, generatedAt));
  const accepted = events.filter((event) => event.candidateValidation.state === "accepted").length;
  const retryGated = events.filter((event) => event.candidateValidation.state === "retry_gated").length;
  const policyGated = events.filter((event) => event.candidateValidation.state === "policy_gated").length;
  const inspectOnly = events.filter((event) => event.candidateValidation.state === "inspect_only").length;
  const healthy = events.filter((event) => event.parserHealth.healthState === "healthy").length;
  const degraded = events.filter((event) => event.parserHealth.healthState === "degraded").length;
  const stale = events.filter((event) => event.parserHealth.healthState === "stale").length;
  const blocked = events.filter((event) => event.parserHealth.healthState === "blocked").length;
  const sourceFamilies = uniqueStrings(events.map((event) => event.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const parserStatuses = uniqueStrings(events.map((event) => event.parserHealth.parserStatus)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const affectedActorPages = uniqueStrings(events.flatMap((event) => event.affected.actorPages));
  const affectedAlertFamilies = uniqueStrings(events.flatMap((event) => event.affected.alertFamilies));
  const status = events.length === 0 ? "blocked" : blocked === 0 && stale === 0 && degraded === 0 ? "ready" : accepted > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_HEALTH_EVENT_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_actor_enrichment_source_health_event_packet", `${generatedAt}:${input.alertPrerequisitePacket.id}:${events.map((event) => `${event.actor}:${event.sourceFamily}:${event.candidateValidation.state}:${event.parserHealth.healthState}`).join(",")}`),
    generatedAt,
    ok: accepted > 0,
    status,
    tenantId: input.alertPrerequisitePacket.tenantId,
    organizationId: input.alertPrerequisitePacket.organizationId,
    actorEnrichmentAlertPrerequisitePacketId: input.alertPrerequisitePacket.id,
    events,
    summary: {
      eventCount: events.length,
      accepted,
      retryGated,
      policyGated,
      inspectOnly,
      healthy,
      degraded,
      stale,
      blocked,
      sourceFamilies,
      parserStatuses,
      affectedActorPages,
      affectedAlertFamilies,
      newestLastRunAt: newestTimestamp(events.map((event) => event.parserHealth.lastRunAt)),
      newestLastSuccessAt: newestTimestamp(events.map((event) => event.parserHealth.lastSuccessAt)),
      nextRetryAt: earliestTimestamp(events.map((event) => event.parserHealth.nextRetryAt))
    },
    consumers: actorEnrichmentSourceHealthEventConsumers(events),
    payloadShape: [
      "events[].actor",
      "events[].publicTiRoute",
      "events[].sourceFamily",
      "events[].candidateValidation",
      "events[].parserHealth",
      "events[].activationTest",
      "events[].affected",
      "events[].downstreamRoutes",
      "events[].provenance",
      "summary"
    ],
    safeOutput: input.alertPrerequisitePacket.safeOutput
  };
}

export function buildSourceProvenanceSourceHealthMonitoringFilterPacket(input: {
  sourceHealthEventPacket: TiSourceProvenanceActorEnrichmentSourceHealthEventPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourceHealthMonitoringFilterPacket {
  const generatedAt = input.generatedAt ?? input.sourceHealthEventPacket.generatedAt;
  const events = input.sourceHealthEventPacket.events;
  const filters = [
    ...sourceHealthMonitoringFiltersForKind(events, "source_family", (event) => event.sourceFamily),
    ...sourceHealthMonitoringFiltersForKind(events, "candidate_state", (event) => event.candidateValidation.state),
    ...sourceHealthMonitoringFiltersForKind(events, "parser_health", (event) => event.parserHealth.healthState),
    ...sourceHealthMonitoringFiltersForKind(events, "parser_status", (event) => event.parserHealth.parserStatus),
    ...sourceHealthMonitoringFiltersForKind(events, "affected_actor_page", (event) => event.affected.actorPages),
    ...sourceHealthMonitoringFiltersForKind(events, "alert_family", (event) => event.affected.alertFamilies),
    ...sourceHealthMonitoringFiltersForKind(events, "retry_window", (event) => event.parserHealth.nextRetryAt ? ["retry_scheduled"] : [])
  ];
  const retryableEvents = events.filter((event) => event.candidateValidation.state === "retry_gated").length;
  const policyBlockedEvents = events.filter((event) => event.candidateValidation.state === "policy_gated").length;
  const staleEvents = events.filter((event) => event.parserHealth.healthState === "stale").length;
  const healthyEvents = events.filter((event) => event.parserHealth.healthState === "healthy").length;
  const sourceFamilies = uniqueStrings(events.map((event) => event.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const candidateStates = uniqueStrings(events.map((event) => event.candidateValidation.state)) as TiSourceProvenanceActorEnrichmentSourceHealthEvent["candidateValidation"]["state"][];
  const parserHealthStates = uniqueStrings(events.map((event) => event.parserHealth.healthState)) as TiSourceProvenanceActorEnrichmentSourceHealthEvent["parserHealth"]["healthState"][];
  const affectedActorPages = uniqueStrings(events.flatMap((event) => event.affected.actorPages));
  const affectedAlertFamilies = uniqueStrings(events.flatMap((event) => event.affected.alertFamilies));
  const status = filters.length === 0 ? "blocked" : policyBlockedEvents === 0 && retryableEvents === 0 && staleEvents === 0 ? "ready" : healthyEvents > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_HEALTH_MONITORING_FILTER_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_health_monitoring_filter_packet", `${generatedAt}:${input.sourceHealthEventPacket.id}:${filters.map((filter) => `${filter.kind}:${filter.value}:${filter.count}`).join(",")}`),
    generatedAt,
    ok: filters.length > 0,
    status,
    tenantId: input.sourceHealthEventPacket.tenantId,
    organizationId: input.sourceHealthEventPacket.organizationId,
    sourceHealthEventPacketId: input.sourceHealthEventPacket.id,
    filters,
    summary: {
      filterCount: filters.length,
      eventCount: events.length,
      sourceFamilyFilters: filters.filter((filter) => filter.kind === "source_family").length,
      candidateStateFilters: filters.filter((filter) => filter.kind === "candidate_state").length,
      parserHealthFilters: filters.filter((filter) => filter.kind === "parser_health").length,
      actorPageFilters: filters.filter((filter) => filter.kind === "affected_actor_page").length,
      alertFamilyFilters: filters.filter((filter) => filter.kind === "alert_family").length,
      retryWindowFilters: filters.filter((filter) => filter.kind === "retry_window").length,
      retryableEvents,
      policyBlockedEvents,
      staleEvents,
      healthyEvents,
      sourceFamilies,
      candidateStates,
      parserHealthStates,
      affectedActorPages,
      affectedAlertFamilies,
      nextRetryAt: input.sourceHealthEventPacket.summary.nextRetryAt
    },
    consumers: sourceHealthMonitoringFilterConsumers(filters),
    payloadShape: [
      "filters[].kind",
      "filters[].value",
      "filters[].count",
      "filters[].readyCount",
      "filters[].blockedCount",
      "filters[].retryableCount",
      "filters[].affectedActorPages",
      "filters[].affectedAlertFamilies",
      "filters[].sampleEventIds",
      "filters[].operatorAction",
      "summary"
    ],
    safeOutput: input.sourceHealthEventPacket.safeOutput
  };
}

export function buildSourceProvenanceSourcePackLifecycleCleanupPacket(input: {
  monitoringFilterPacket: TiSourceProvenanceSourceHealthMonitoringFilterPacket;
  generatedAt?: string;
}): TiSourceProvenanceSourcePackLifecycleCleanupPacket {
  const generatedAt = input.generatedAt ?? input.monitoringFilterPacket.generatedAt;
  const cleanupRows = input.monitoringFilterPacket.filters
    .map(sourcePackLifecycleCleanupRow)
    .filter((row): row is TiSourceProvenanceSourcePackLifecycleCleanupRow => Boolean(row));
  const retryParser = cleanupRows.filter((row) => row.lifecycleState === "retry_ready").length;
  const policyReview = cleanupRows.filter((row) => row.lifecycleState === "policy_review_required").length;
  const alertRebuild = cleanupRows.filter((row) => row.lifecycleState === "alert_rebuild_ready").length;
  const inspectGap = cleanupRows.filter((row) => row.lifecycleState === "gap_review_required").length;
  const status = cleanupRows.length === 0 ? "blocked" : retryParser === 0 && policyReview === 0 && inspectGap === 0 ? "ready" : alertRebuild > 0 ? "partial" : "blocked";

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_LIFECYCLE_CLEANUP_PACKET_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_pack_lifecycle_cleanup_packet", `${generatedAt}:${input.monitoringFilterPacket.id}:${cleanupRows.map((row) => `${row.filterKind}:${row.filterValue}:${row.lifecycleState}`).join(",")}`),
    generatedAt,
    ok: cleanupRows.length > 0,
    status,
    tenantId: input.monitoringFilterPacket.tenantId,
    organizationId: input.monitoringFilterPacket.organizationId,
    sourceHealthMonitoringFilterPacketId: input.monitoringFilterPacket.id,
    cleanupRows,
    summary: {
      cleanupCount: cleanupRows.length,
      retryParser,
      policyReview,
      alertRebuild,
      inspectGap,
      sourceFamilies: uniqueStrings(cleanupRows.flatMap((row) => row.sourceFamilies)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][],
      affectedActorPages: uniqueStrings(cleanupRows.flatMap((row) => row.affectedActorPages)),
      affectedAlertFamilies: uniqueStrings(cleanupRows.flatMap((row) => row.affectedAlertFamilies)),
      blockedCount: cleanupRows.reduce((sum, row) => sum + row.blockedCount, 0),
      retryableCount: cleanupRows.reduce((sum, row) => sum + row.retryableCount, 0),
      readyCount: cleanupRows.reduce((sum, row) => sum + row.readyCount, 0),
      nextRetryAt: input.monitoringFilterPacket.summary.nextRetryAt
    },
    consumers: sourcePackLifecycleCleanupConsumers(cleanupRows),
    payloadShape: [
      "cleanupRows[].filterKind",
      "cleanupRows[].filterValue",
      "cleanupRows[].lifecycleState",
      "cleanupRows[].priority",
      "cleanupRows[].affectedActorPages",
      "cleanupRows[].affectedAlertFamilies",
      "cleanupRows[].sampleEventIds",
      "cleanupRows[].remediation",
      "summary"
    ],
    safeOutput: input.monitoringFilterPacket.safeOutput
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

export function buildSourceProvenanceParserHealthProvenanceSummary(input: {
  parserHealthPacket: TiSourceProvenanceParserHealthAlertPacket;
  activationDecisionReceipt?: TiSourceProvenanceSourceActivationDecisionReceipt;
  generatedAt?: string;
}): TiSourceProvenanceParserHealthProvenanceSummary {
  const generatedAt = input.generatedAt ?? input.parserHealthPacket.generatedAt;
  const familyRows = parserHealthProvenanceFamilyRows(input.parserHealthPacket, input.activationDecisionReceipt);
  const parserAlertCount = familyRows.reduce((sum, row) => sum + row.parserAlertCount, 0);
  const retryableCount = familyRows.filter((row) => row.parserState === "retry_scheduled").length;
  const policyBlockedCount = familyRows.filter((row) => row.parserState === "blocked").length;
  const activationTestsQueued = familyRows.reduce((sum, row) => sum + row.activationTestsQueued, 0);
  const alertableCandidates = familyRows.reduce((sum, row) => sum + row.alertableCandidates, 0);

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_PARSER_HEALTH_PROVENANCE_SUMMARY_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_parser_health_provenance_summary", `${input.parserHealthPacket.id}:${input.activationDecisionReceipt?.id ?? ""}:${generatedAt}:${familyRows.map((row) => `${row.family}:${row.parserState}`).join(",")}`),
    generatedAt,
    ok: parserAlertCount === 0 && familyRows.every((row) => row.readiness.publicTI),
    tenantId: input.parserHealthPacket.tenantId,
    organizationId: input.parserHealthPacket.organizationId,
    actor: input.parserHealthPacket.actor,
    publicTiRoute: input.parserHealthPacket.publicTiRoute,
    parserHealthAlertPacketId: input.parserHealthPacket.id,
    sourceActivationDecisionReceiptId: input.activationDecisionReceipt?.id,
    familyRows,
    summary: {
      familyCount: familyRows.length,
      healthyFamilyCount: familyRows.filter((row) => row.parserState === "ready").length,
      parserAlertCount,
      retryableCount,
      policyBlockedCount,
      activationTestsQueued,
      alertableCandidates,
      lastSuccessAt: newestTimestamp(familyRows.map((row) => row.lastSuccessAt)),
      lastFailureAt: newestTimestamp(familyRows.map((row) => row.lastFailureAt)),
      nextRetryAt: earliestTimestamp(familyRows.map((row) => row.nextRetryAt))
    },
    consumers: parserHealthProvenanceSummaryConsumers(input.parserHealthPacket, familyRows),
    payloadShape: [
      "familyRows[].family",
      "familyRows[].parserState",
      "familyRows[].activationTestsQueued",
      "familyRows[].alertableCandidates",
      "familyRows[].blockers",
      "familyRows[].provenance",
      "summary.lastSuccessAt",
      "summary.lastFailureAt",
      "summary.nextRetryAt"
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

export function buildSourceProvenanceSourceOpsFixtureBundle(input: {
  freshnessPacket: TiSourceProvenanceSourceFreshnessGapPacket;
  parserHealthPacket: TiSourceProvenanceParserHealthAlertPacket;
  actionQueue: TiSourceProvenanceSourceOpsActionQueue;
  expectedActor?: string;
  validationIssues?: Array<{
    code: TiSourceProvenanceSourceOpsFixtureValidationIssue["code"];
    sourceFamily?: string;
    duplicateOf?: string;
    path?: string;
  }>;
  generatedAt?: string;
}): TiSourceProvenanceSourceOpsFixtureBundle {
  const generatedAt = input.generatedAt ?? input.actionQueue.generatedAt;
  const validationIssues = uniqueSourceOpsFixtureValidationIssues([
    ...sourceOpsActorValidationIssues(input.actionQueue, input.expectedActor),
    ...(input.validationIssues ?? []).map((issue) => sourceOpsFixtureValidationIssue(input.actionQueue, issue))
  ]);
  const issueBlocking = validationIssues.some((issue) => issue.severity === "blocking");
  const dashboardConsumer = input.actionQueue.consumers.find((consumer) => consumer.consumer === "dashboard");
  const sourceOpsConsumer = input.actionQueue.consumers.find((consumer) => consumer.consumer === "sourceOps");

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_OPS_FIXTURE_BUNDLE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_source_ops_fixture_bundle", `${input.actionQueue.id}:${input.expectedActor ?? ""}:${validationIssues.map((issue) => `${issue.code}:${issue.sourceFamily ?? ""}:${issue.duplicateOf ?? ""}`).join("|")}:${generatedAt}`),
    generatedAt,
    ok: input.actionQueue.ok && !issueBlocking,
    tenantId: input.actionQueue.tenantId,
    organizationId: input.actionQueue.organizationId,
    actor: input.actionQueue.actor,
    expectedActor: input.expectedActor,
    publicTiRoute: input.actionQueue.publicTiRoute,
    packetRefs: {
      sourceFreshnessGapPacketId: input.freshnessPacket.id,
      parserHealthAlertPacketId: input.parserHealthPacket.id,
      sourceOpsActionQueueId: input.actionQueue.id
    },
    readiness: {
      publicTI: input.actionQueue.summary.publicTiReady && !issueBlocking,
      dashboard: dashboardConsumer?.ready === true,
      sourceOps: sourceOpsConsumer?.ready === true,
      alertGeneration: input.actionQueue.summary.alertGenerationReady && !issueBlocking,
      operatorActionCount: input.actionQueue.summary.actionCount,
      validationIssueCount: validationIssues.length
    },
    sourceHealth: {
      sourceFamilies: uniqueStrings([
        ...input.actionQueue.summary.sourceFamilies,
        ...input.parserHealthPacket.summary.sourceFamilies,
        ...validationIssues.map((issue) => issue.sourceFamily).filter(Boolean).map(String)
      ]),
      parserAlertCount: input.parserHealthPacket.summary.alertCount,
      freshnessState: input.freshnessPacket.freshness.state,
      nextRetryAt: earliestTimestamp([
        input.actionQueue.summary.nextRetryAt,
        input.parserHealthPacket.summary.nextRetryAt
      ])
    },
    operatorActions: input.actionQueue.rows,
    validationIssues,
    fixtureContracts: sourceOpsFixtureContracts(input.actionQueue, input.freshnessPacket, input.parserHealthPacket),
    payloadShape: [
      "packetRefs.sourceFreshnessGapPacketId",
      "packetRefs.parserHealthAlertPacketId",
      "packetRefs.sourceOpsActionQueueId",
      "readiness.publicTI",
      "readiness.sourceOps",
      "sourceHealth.sourceFamilies",
      "operatorActions[].route",
      "validationIssues[].code"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenancePublicTiSourceOpsProjection(input: {
  bundle: TiSourceProvenanceSourceOpsFixtureBundle;
  generatedAt?: string;
}): TiSourceProvenancePublicTiSourceOpsProjection {
  const generatedAt = input.generatedAt ?? input.bundle.generatedAt;
  const provenanceRows = [
    ...input.bundle.operatorActions.map((action) => publicTiProjectionRowFromAction(input.bundle, action, generatedAt)),
    ...input.bundle.validationIssues.map((issue) => publicTiProjectionRowFromValidationIssue(input.bundle, issue, generatedAt))
  ];
  const enrichmentGaps = [
    ...input.bundle.operatorActions.map((action) => publicTiProjectionGapFromAction(action)),
    ...input.bundle.validationIssues.map((issue) => publicTiProjectionGapFromValidationIssue(issue))
  ];
  const publicRoute = input.bundle.publicTiRoute ?? `/ti/${encodeURIComponent(input.bundle.actor)}`;
  const hasBlockingValidation = input.bundle.validationIssues.some((issue) => issue.severity === "blocking");
  const state = input.bundle.readiness.publicTI && input.bundle.readiness.alertGeneration && !hasBlockingValidation
    ? "ready"
    : (input.bundle.readiness.sourceOps || input.bundle.readiness.dashboard ? "partial" : "blocked");

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_PUBLIC_TI_SOURCE_OPS_PROJECTION_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_public_ti_source_ops_projection", `${input.bundle.id}:${generatedAt}:${state}:${provenanceRows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: state === "ready",
    tenantId: input.bundle.tenantId,
    organizationId: input.bundle.organizationId,
    actor: input.bundle.actor,
    publicTiRoute: publicRoute,
    sourceOpsFixtureBundleId: input.bundle.id,
    pageReadiness: {
      state,
      canRender: true,
      publicTI: input.bundle.readiness.publicTI && !hasBlockingValidation,
      dashboard: input.bundle.readiness.dashboard,
      sourceOps: input.bundle.readiness.sourceOps,
      alertGeneration: input.bundle.readiness.alertGeneration && !hasBlockingValidation
    },
    sourceCoverage: {
      families: input.bundle.sourceHealth.sourceFamilies,
      freshnessState: input.bundle.sourceHealth.freshnessState,
      parserAlertCount: input.bundle.sourceHealth.parserAlertCount,
      operatorActionCount: input.bundle.readiness.operatorActionCount,
      validationIssueCount: input.bundle.readiness.validationIssueCount,
      nextRetryAt: input.bundle.sourceHealth.nextRetryAt
    },
    provenanceRows,
    enrichmentGaps,
    consumerContracts: input.bundle.fixtureContracts,
    payloadShape: [
      "pageReadiness.state",
      "sourceCoverage.families",
      "sourceCoverage.freshnessState",
      "provenanceRows[].provenance",
      "provenanceRows[].route",
      "enrichmentGaps[].code",
      "consumerContracts[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

export function buildSourceProvenanceProjectionWatchlistRelevance(input: {
  projection: TiSourceProvenancePublicTiSourceOpsProjection;
  generatedAt?: string;
}): TiSourceProvenanceProjectionWatchlistRelevance {
  const generatedAt = input.generatedAt ?? input.projection.generatedAt;
  const watchlistTerms = input.projection.ok ? projectionWatchlistTerms(input.projection) : [];
  const blockers = projectionWatchlistBlockers(input.projection, watchlistTerms);
  const watchlistItemIds = watchlistTerms.map((term) => term.watchlistItemId);
  const alertGeneratorKeys = watchlistTerms.map((term) => term.alertGeneratorKey);

  return {
    schemaVersion: TI_SOURCE_PROVENANCE_PROJECTION_WATCHLIST_RELEVANCE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_projection_watchlist_relevance", `${input.projection.id}:${generatedAt}:${watchlistTerms.map((term) => term.termId).join(",")}:${blockers.map((blocker) => blocker.code).join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.projection.tenantId,
    organizationId: input.projection.organizationId,
    actor: input.projection.actor,
    publicTiRoute: input.projection.publicTiRoute,
    publicTiSourceOpsProjectionId: input.projection.id,
    canCreateWatchlistTerms: blockers.length === 0 && watchlistTerms.length > 0,
    canRequestAlertGeneration: blockers.length === 0 && watchlistTerms.length > 0,
    watchlistTerms,
    blockers,
    nextActions: projectionWatchlistNextActions(input.projection, blockers, watchlistTerms),
    alertRequestPreview: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: input.projection.tenantId,
        organizationId: input.projection.organizationId,
        actor: input.projection.actor,
        watchlistItemIds,
        alertGeneratorKeys,
        sourceProjectionId: input.projection.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    payloadShape: [
      "watchlistTerms[].alertGenerationRef",
      "watchlistTerms[].provenance",
      "blockers[].code",
      "nextActions[].route",
      "alertRequestPreview.body.watchlistItemIds",
      "alertRequestPreview.body.alertGeneratorKeys"
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
  requestedTransition?: TiSourceProvenanceAlertHandoffTransition;
  generatedAt?: string;
}): TiSourceProvenanceAlertHandoffState {
  const packet = input.packet;
  const generatedAt = input.generatedAt ?? packet.generatedAt;
  const consumers = new Map(packet.consumers.map((consumer) => [consumer.consumer, consumer]));
  const alertGeneration = consumers.get("alertGeneration") ?? fallbackParserHealthConsumer("alertGeneration", packet);
  const publicTi = consumers.get("publicTI") ?? fallbackParserHealthConsumer("publicTI", packet);
  const webhook = consumers.get("webhook") ?? fallbackParserHealthConsumer("webhook", packet);
  const sourceOps = consumers.get("sourceOps") ?? fallbackParserHealthConsumer("sourceOps", packet);
  const baseAllowedTransitions = alertHandoffAllowedTransitions(packet, alertGeneration, publicTi, webhook);
  const structuralBlockers = uniqueAlertHandoffStateBlockers([
    ...alertHandoffOrgBlockers(packet, input.expectedOrganizationId),
    ...packet.rows.map((row) => alertHandoffStateBlocker("parser_health_blocked", "source", "rows[]", "Parser or freshness state blocks alert handoff.", row.alertId, row.sourceFamily)),
    ...duplicateAlertHandoffBlockers(packet.rows)
  ]);
  const allowedTransitions = structuralBlockers.some((blocker) => blocker.code === "missing_org_scope" || blocker.code === "source_org_mismatch" || blocker.code === "duplicate_alert_id")
    ? baseAllowedTransitions.filter((transition) => transition === "repair_source")
    : baseAllowedTransitions;
  const blockers = uniqueAlertHandoffStateBlockers([
    ...structuralBlockers,
    ...alertHandoffTransitionBlockers(input.requestedTransition, allowedTransitions)
  ]);
  const state = blockers.length === 0 && packet.summary.alertGenerationReady ? "ready" : "blocked";

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
    state,
    lifecycle: {
      currentState: state,
      requestedTransition: input.requestedTransition,
      allowedTransitions,
      invalidTransition: input.requestedTransition && !allowedTransitions.includes(input.requestedTransition) ? input.requestedTransition : undefined
    },
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
        requiredFields: ["tenantId", "organizationId", "actor", "parserHealthAlertPacketId", "alertGeneration.ready", "lifecycle.allowedTransitions"],
        sourceSchema: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION
      },
      publicTi: {
        requiredFields: ["actor", "publicTiRoute", "publicTi.ready", "lifecycle.currentState", "blockers[]"],
        sourceSchema: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION
      },
      webhook: {
        requiredFields: ["organizationId", "webhook.sourceAlertRows", "sourceOps.nextActions", "lifecycle.invalidTransition", "safeOutput"],
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

function parserHealthProvenanceFamilyRows(
  packet: TiSourceProvenanceParserHealthAlertPacket,
  receipt?: TiSourceProvenanceSourceActivationDecisionReceipt
): TiSourceProvenanceParserHealthProvenanceSummary["familyRows"] {
  const families = uniqueStrings([
    ...packet.rows.map((row) => row.sourceFamily),
    ...(receipt?.summary.sourceFamilies ?? [])
  ]) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  if (!families.length && packet.ok) return [];

  return families.map((family) => {
    const parserRows = packet.rows.filter((row) => row.sourceFamily === family);
    const decisions = (receipt?.decisions ?? []).filter((decision) => decision.family === family);
    const parserState = parserHealthProvenanceParserState(parserRows, decisions);
    const blockers = parserRows.map((row) => ({
      code: row.alertType,
      ownerLane: row.enrichmentGap.ownerLane,
      nextAction: row.enrichmentGap.nextAction,
      alertId: row.alertId
    }));
    const alertableCandidates = decisions.filter((decision) => decision.alertability.canGenerateAlertEvidence).length;

    return {
      family,
      parserState,
      parserAlertCount: parserRows.length,
      activationTestsQueued: decisions.filter((decision) => decision.outcome === "activation_test_queued").length,
      parserRetriesQueued: decisions.filter((decision) => decision.outcome === "parser_retry_queued").length,
      policyReviewsRequired: decisions.filter((decision) => decision.outcome === "policy_review_required").length,
      alertableCandidates,
      lastSuccessAt: newestTimestamp(decisions.map((decision) => decision.lastSuccessAt)),
      lastFailureAt: newestTimestamp([
        ...decisions.map((decision) => decision.lastFailureAt),
        ...parserRows.map((row) => row.provenance.evidenceGeneratedAt)
      ]),
      nextRetryAt: earliestTimestamp([
        ...decisions.map((decision) => decision.nextRetryAt),
        ...parserRows.map((row) => row.retryState.nextRetryAt)
      ]),
      blockers,
      provenance: {
        parserHealthAlertPacketId: packet.id,
        sourceActivationDecisionReceiptId: receipt?.id,
        sourceHealthProofIds: uniqueStrings([
          ...parserRows.map((row) => row.provenance.sourceHealthProofId),
          ...decisions.map((decision) => decision.provenance.sourceHealthProofId)
        ]),
        activationDecisionIds: uniqueStrings(decisions.map((decision) => decision.decisionId)),
        fixtureBacked: true
      },
      readiness: {
        publicTI: parserRows.length === 0 && (decisions.length === 0 || decisions.some((decision) => decision.status === "accepted")),
        alertGeneration: parserRows.length === 0 && alertableCandidates > 0,
        sourceOps: decisions.length > 0 || parserRows.length > 0
      }
    };
  });
}

function parserHealthProvenanceParserState(
  parserRows: TiSourceProvenanceParserHealthAlertRow[],
  decisions: TiSourceProvenanceSourceActivationDecision[]
): TiSourceProvenanceParserHealthProvenanceFamilyRow["parserState"] {
  if (parserRows.some((row) => row.alertType === "policy_blocked")) return "blocked";
  if (parserRows.some((row) => row.alertType === "parser_retry_scheduled")) return "retry_scheduled";
  if (parserRows.some((row) => row.alertType === "parser_not_ready" || row.alertType === "freshness_missing")) return "not_ready";
  if (decisions.some((decision) => decision.parserStatus === "ready" || decision.alertability.canGenerateAlertEvidence)) return "ready";
  return "not_ready";
}

function parserHealthProvenanceSummaryConsumers(
  packet: TiSourceProvenanceParserHealthAlertPacket,
  familyRows: TiSourceProvenanceParserHealthProvenanceFamilyRow[]
): TiSourceProvenanceParserHealthProvenanceSummary["consumers"] {
  const publicReady = familyRows.length === 0
    ? packet.summary.alertGenerationReady
    : familyRows.some((row) => row.readiness.publicTI);
  const alertReady = familyRows.some((row) => row.readiness.alertGeneration) && familyRows.every((row) => row.parserAlertCount === 0);
  return [{
    consumer: "publicTI",
    ready: publicReady,
    requiredFields: ["familyRows[].family", "familyRows[].parserState", "familyRows[].provenance", "safeOutput.liveNetworkScrapeStarted"],
    route: {
      method: "GET",
      path: packet.publicTiRoute ?? `/ti/${encodeURIComponent(packet.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: alertReady,
    requiredFields: ["familyRows[].alertableCandidates", "familyRows[].blockers", "summary.nextRetryAt"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: packet.tenantId,
        organizationId: packet.organizationId,
        actor: packet.actor,
        parserHealthAlertPacketId: packet.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: true,
    requiredFields: ["familyRows[].blockers", "familyRows[].nextRetryAt", "familyRows[].provenance.sourceHealthProofIds"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        parserHealthAlertPacketId: packet.id,
        includeHealthSummary: true,
        dryRun: true
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

function alertHandoffAllowedTransitions(
  packet: TiSourceProvenanceParserHealthAlertPacket,
  alertGeneration: TiSourceProvenanceParserHealthAlertConsumer,
  publicTi: TiSourceProvenanceParserHealthAlertConsumer,
  webhook: TiSourceProvenanceParserHealthAlertConsumer
): TiSourceProvenanceAlertHandoffTransition[] {
  return [
    alertGeneration.ready && packet.summary.alertGenerationReady ? "request_alert_generation" : undefined,
    publicTi.ready ? "refresh_public_ti" : undefined,
    webhook.ready ? "prepare_webhook_dry_run" : undefined,
    packet.rows.length > 0 ? "repair_source" : undefined
  ].filter(Boolean) as TiSourceProvenanceAlertHandoffTransition[];
}

function alertHandoffTransitionBlockers(
  requestedTransition: TiSourceProvenanceAlertHandoffTransition | undefined,
  allowedTransitions: TiSourceProvenanceAlertHandoffTransition[]
): TiSourceProvenanceAlertHandoffStateBlocker[] {
  if (!requestedTransition || allowedTransitions.includes(requestedTransition)) return [];
  return [{
    code: "invalid_transition",
    ownerLane: alertHandoffTransitionOwner(requestedTransition),
    path: "lifecycle.requestedTransition",
    message: "Requested alert handoff transition is not available for the current source state.",
    requestedTransition
  }];
}

function alertHandoffTransitionOwner(
  transition: TiSourceProvenanceAlertHandoffTransition
): TiSourceProvenanceAlertHandoffStateBlocker["ownerLane"] {
  if (transition === "request_alert_generation") return "alert";
  if (transition === "refresh_public_ti") return "publicTI";
  if (transition === "prepare_webhook_dry_run") return "webhook";
  return "source";
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
  sourceFamily?: TiSourceProvenanceActorProfileGapSourceCandidate["family"],
  requestedTransition?: TiSourceProvenanceAlertHandoffTransition
): TiSourceProvenanceAlertHandoffStateBlocker {
  return { code, ownerLane, path, message, alertId, sourceFamily, requestedTransition };
}

function uniqueAlertHandoffStateBlockers(
  blockers: TiSourceProvenanceAlertHandoffStateBlocker[]
): TiSourceProvenanceAlertHandoffStateBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}:${blocker.alertId ?? ""}:${blocker.sourceFamily ?? ""}:${blocker.requestedTransition ?? ""}`;
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

function sourceOpsActorValidationIssues(
  queue: TiSourceProvenanceSourceOpsActionQueue,
  expectedActor?: string
): TiSourceProvenanceSourceOpsFixtureValidationIssue[] {
  if (!expectedActor || expectedActor.toLowerCase() === queue.actor.toLowerCase()) return [];
  return [sourceOpsFixtureValidationIssue(queue, {
    code: "wrong_actor_query",
    path: "actor"
  }, expectedActor)];
}

function sourceOpsFixtureValidationIssue(
  queue: TiSourceProvenanceSourceOpsActionQueue,
  issue: {
    code: TiSourceProvenanceSourceOpsFixtureValidationIssue["code"];
    sourceFamily?: string;
    duplicateOf?: string;
    path?: string;
  },
  expectedActor?: string
): TiSourceProvenanceSourceOpsFixtureValidationIssue {
  const nextAction = sourceOpsFixtureIssueNextAction(issue.code);
  return {
    code: issue.code,
    severity: issue.code === "duplicate_candidate" ? "warning" : "blocking",
    ownerLane: issue.code === "wrong_actor_query" ? "publicTI" : "source",
    sourceFamily: issue.sourceFamily,
    expectedActor,
    actualActor: issue.code === "wrong_actor_query" ? queue.actor : undefined,
    duplicateOf: issue.duplicateOf,
    path: issue.path ?? sourceOpsFixtureIssuePath(issue.code),
    nextAction,
    route: sourceOpsFixtureIssueRoute(queue, nextAction, issue)
  };
}

function sourceOpsFixtureIssueNextAction(
  code: TiSourceProvenanceSourceOpsFixtureValidationIssue["code"]
): TiSourceProvenanceSourceOpsFixtureValidationIssue["nextAction"] {
  if (code === "wrong_actor_query") return "retry_query";
  if (code === "duplicate_candidate") return "suppress_duplicate";
  return "review_source_family";
}

function sourceOpsFixtureIssuePath(
  code: TiSourceProvenanceSourceOpsFixtureValidationIssue["code"]
): string {
  if (code === "wrong_actor_query") return "actor";
  if (code === "duplicate_candidate") return "sourcePack.candidates[].duplicateOf";
  return "sourcePack.candidates[].sourceFamily";
}

function sourceOpsFixtureIssueRoute(
  queue: TiSourceProvenanceSourceOpsActionQueue,
  nextAction: TiSourceProvenanceSourceOpsFixtureValidationIssue["nextAction"],
  issue: { sourceFamily?: string; duplicateOf?: string }
): TiSourceProvenanceSourceOpsFixtureValidationIssue["route"] {
  if (nextAction === "retry_query") {
    return {
      method: "GET",
      path: `/ti/${encodeURIComponent(queue.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    };
  }
  return {
    method: "POST",
    path: "/v1/dwm/source-requests",
    body: {
      action: nextAction,
      sourceFamily: issue.sourceFamily,
      duplicateOf: issue.duplicateOf,
      dryRun: true
    },
    dryRunSupported: true,
    liveNetworkFetch: false
  };
}

function sourceOpsFixtureContracts(
  queue: TiSourceProvenanceSourceOpsActionQueue,
  freshnessPacket: TiSourceProvenanceSourceFreshnessGapPacket,
  parserHealthPacket: TiSourceProvenanceParserHealthAlertPacket
): TiSourceProvenanceSourceOpsFixtureBundle["fixtureContracts"] {
  return [{
    consumer: "publicTI",
    route: freshnessPacket.publicTiRoute ?? `/ti/${encodeURIComponent(freshnessPacket.actor)}`,
    requiredFields: ["readiness.publicTI", "sourceHealth.freshnessState", "packetRefs.sourceFreshnessGapPacketId"],
    sourceSchemas: [
      TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION,
      TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION
    ],
    liveNetworkFetch: false
  }, {
    consumer: "dashboard",
    route: `/dashboard/ti/sources?actor=${encodeURIComponent(queue.actor)}`,
    requiredFields: ["operatorActions[].action", "operatorActions[].route", "validationIssues[].code"],
    sourceSchemas: [
      TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION,
      TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION
    ],
    liveNetworkFetch: false
  }, {
    consumer: "sourceOps",
    route: "/v1/dwm/source-requests",
    requiredFields: ["operatorActions[].ownerLane", "operatorActions[].retryState", "operatorActions[].provenance"],
    sourceSchemas: [
      TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION
    ],
    liveNetworkFetch: false
  }, {
    consumer: "alertGeneration",
    route: "/v1/dwm/alerts/rebuild",
    requiredFields: ["readiness.alertGeneration", "packetRefs.parserHealthAlertPacketId", "sourceHealth.parserAlertCount"],
    sourceSchemas: [
      TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION,
      parserHealthPacket.schemaVersion
    ],
    liveNetworkFetch: false
  }];
}

function uniqueSourceOpsFixtureValidationIssues(
  issues: TiSourceProvenanceSourceOpsFixtureValidationIssue[]
): TiSourceProvenanceSourceOpsFixtureValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.sourceFamily ?? ""}:${issue.expectedActor ?? ""}:${issue.actualActor ?? ""}:${issue.duplicateOf ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function publicTiProjectionRowFromAction(
  bundle: TiSourceProvenanceSourceOpsFixtureBundle,
  action: TiSourceProvenanceSourceOpsActionQueueRow,
  generatedAt: string
): TiSourceProvenancePublicTiSourceOpsProjectionRow {
  return {
    rowId: stableId("ti_source_provenance_public_ti_source_ops_row", `${bundle.id}:${action.actionId}:${generatedAt}`),
    sourceFamily: action.sourceFamily,
    state: "needs_action",
    reasonCode: action.reasonCode,
    ownerLane: action.ownerLane,
    parserStatus: action.parserStatus,
    freshness: action.freshness,
    provenance: {
      sourceOpsFixtureBundleId: bundle.id,
      sourceFreshnessGapPacketId: bundle.packetRefs.sourceFreshnessGapPacketId,
      parserHealthAlertPacketId: bundle.packetRefs.parserHealthAlertPacketId,
      sourceOpsActionQueueId: bundle.packetRefs.sourceOpsActionQueueId,
      sourceHealthProofId: action.provenance.sourceHealthProofId,
      fixtureBacked: true
    },
    route: action.route,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function publicTiProjectionRowFromValidationIssue(
  bundle: TiSourceProvenanceSourceOpsFixtureBundle,
  issue: TiSourceProvenanceSourceOpsFixtureValidationIssue,
  generatedAt: string
): TiSourceProvenancePublicTiSourceOpsProjectionRow {
  return {
    rowId: stableId("ti_source_provenance_public_ti_source_ops_validation_row", `${bundle.id}:${issue.code}:${issue.sourceFamily ?? ""}:${issue.expectedActor ?? ""}:${issue.actualActor ?? ""}:${generatedAt}`),
    sourceFamily: issue.sourceFamily,
    state: "validation_blocked",
    reasonCode: issue.code,
    ownerLane: issue.ownerLane,
    provenance: {
      sourceOpsFixtureBundleId: bundle.id,
      sourceFreshnessGapPacketId: bundle.packetRefs.sourceFreshnessGapPacketId,
      parserHealthAlertPacketId: bundle.packetRefs.parserHealthAlertPacketId,
      sourceOpsActionQueueId: bundle.packetRefs.sourceOpsActionQueueId,
      fixtureBacked: true
    },
    route: issue.route,
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function publicTiProjectionGapFromAction(
  action: TiSourceProvenanceSourceOpsActionQueueRow
): TiSourceProvenancePublicTiSourceOpsProjectionGap {
  return {
    code: action.reasonCode,
    ownerLane: action.ownerLane,
    sourceFamily: action.sourceFamily,
    nextAction: action.action,
    route: action.route
  };
}

function publicTiProjectionGapFromValidationIssue(
  issue: TiSourceProvenanceSourceOpsFixtureValidationIssue
): TiSourceProvenancePublicTiSourceOpsProjectionGap {
  return {
    code: issue.code,
    ownerLane: issue.ownerLane,
    sourceFamily: issue.sourceFamily,
    nextAction: issue.nextAction,
    route: issue.route
  };
}

function projectionWatchlistTerms(
  projection: TiSourceProvenancePublicTiSourceOpsProjection
): TiSourceProvenanceProjectionWatchlistTerm[] {
  const sourceFamilies = projection.sourceCoverage.families;
  const actorTerm = projectionWatchlistTerm(projection, "actor", projection.actor, sourceFamilies);
  const familyTerms = sourceFamilies.map((family) => projectionWatchlistTerm(projection, "source_family", family, [family]));
  return [actorTerm, ...familyTerms].filter((term): term is TiSourceProvenanceProjectionWatchlistTerm => Boolean(term));
}

function projectionWatchlistTerm(
  projection: TiSourceProvenancePublicTiSourceOpsProjection,
  kind: TiSourceProvenanceProjectionWatchlistTerm["kind"],
  term: string | undefined,
  sourceFamilies: string[]
): TiSourceProvenanceProjectionWatchlistTerm | undefined {
  if (!term) return undefined;
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return undefined;
  const termId = stableId("ti_source_provenance_projection_watchlist_term", `${projection.id}:${kind}:${normalizedTerm}`);
  const watchlistItemId = stableId("org_watchlist_item", `${projection.organizationId ?? ""}:${kind}:${normalizedTerm}`);
  const alertGeneratorKey = `org:${projection.organizationId ?? "unknown"}:source_projection:${watchlistItemId}:${kind}:${normalizedTerm.toLowerCase()}`;
  return {
    termId,
    watchlistItemId,
    alertGeneratorKey,
    kind,
    term: normalizedTerm,
    sourceFamilies,
    confidence: projection.pageReadiness.state === "ready" ? 0.91 : 0.5,
    provenance: {
      publicTiSourceOpsProjectionId: projection.id,
      sourceOpsFixtureBundleId: projection.sourceOpsFixtureBundleId,
      sourceFreshnessGapPacketId: projection.provenanceRows[0]?.provenance.sourceFreshnessGapPacketId ?? projection.sourceOpsFixtureBundleId,
      parserHealthAlertPacketId: projection.provenanceRows[0]?.provenance.parserHealthAlertPacketId ?? projection.sourceOpsFixtureBundleId,
      sourceOpsActionQueueId: projection.provenanceRows[0]?.provenance.sourceOpsActionQueueId ?? projection.sourceOpsFixtureBundleId,
      fixtureBacked: true
    },
    alertGenerationRef: {
      schemaVersion: "organization.watchlist_alert_generation_ref.v1",
      source: "public_ti_source_ops_projection",
      organizationId: projection.organizationId,
      term: normalizedTerm,
      key: alertGeneratorKey
    }
  };
}

function projectionWatchlistBlockers(
  projection: TiSourceProvenancePublicTiSourceOpsProjection,
  watchlistTerms: TiSourceProvenanceProjectionWatchlistTerm[]
): TiSourceProvenanceProjectionWatchlistBlocker[] {
  return uniqueProjectionWatchlistBlockers([
    !projection.organizationId
      ? projectionWatchlistBlocker("missing_organization_scope", "org", "organizationId", "materialize_watchlist_terms", projection.publicTiRoute)
      : undefined,
    !projection.ok
      ? projectionWatchlistBlocker("projection_not_ready", "publicTI", "pageReadiness.state", "repair_source_ops", projection.publicTiRoute)
      : undefined,
    ...projection.enrichmentGaps.map((gap) => projectionWatchlistBlockerForGap(gap)),
    watchlistTerms.length === 0
      ? projectionWatchlistBlocker("no_watchlist_terms", "publicTI", "watchlistTerms", "materialize_watchlist_terms", projection.publicTiRoute)
      : undefined
  ].filter(Boolean) as TiSourceProvenanceProjectionWatchlistBlocker[]);
}

function projectionWatchlistBlockerForGap(
  gap: TiSourceProvenancePublicTiSourceOpsProjectionGap
): TiSourceProvenanceProjectionWatchlistBlocker {
  const code = gap.code === "parser_retry_scheduled"
    ? "parser_gap_blocking"
    : (gap.code === "wrong_actor_query" || gap.code === "unsupported_source_family" || gap.code === "duplicate_candidate"
      ? "source_validation_blocking"
      : "projection_not_ready");
  return {
    code,
    ownerLane: gap.ownerLane === "parser" ? "parser" : gap.ownerLane === "publicTI" ? "publicTI" : "source",
    path: "enrichmentGaps[]",
    reasonCode: gap.code,
    sourceFamily: gap.sourceFamily,
    nextAction: gap.nextAction,
    route: gap.route
  };
}

function projectionWatchlistBlocker(
  code: TiSourceProvenanceProjectionWatchlistBlocker["code"],
  ownerLane: TiSourceProvenanceProjectionWatchlistBlocker["ownerLane"],
  path: string,
  nextAction: string,
  publicTiRoute: string
): TiSourceProvenanceProjectionWatchlistBlocker {
  return {
    code,
    ownerLane,
    path,
    nextAction,
    route: {
      method: "GET",
      path: publicTiRoute,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function projectionWatchlistNextActions(
  projection: TiSourceProvenancePublicTiSourceOpsProjection,
  blockers: TiSourceProvenanceProjectionWatchlistBlocker[],
  watchlistTerms: TiSourceProvenanceProjectionWatchlistTerm[]
): TiSourceProvenanceProjectionWatchlistRelevance["nextActions"] {
  if (blockers.length === 0 && watchlistTerms.length > 0) {
    return [{
      action: "request_alert_rebuild",
      ownerLane: "alert",
      reasonCode: "watchlist_terms_ready",
      route: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          actor: projection.actor,
          organizationId: projection.organizationId,
          sourceProjectionId: projection.id,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  return uniqueProjectionWatchlistActions(blockers.map((blocker) => ({
    action: projectionWatchlistAction(blocker),
    ownerLane: projectionWatchlistActionOwner(blocker),
    reasonCode: blocker.reasonCode ?? blocker.code,
    route: blocker.route
  })));
}

function projectionWatchlistAction(
  blocker: TiSourceProvenanceProjectionWatchlistBlocker
): TiSourceProvenanceProjectionWatchlistRelevance["nextActions"][number]["action"] {
  if (blocker.reasonCode === "parser_retry_scheduled") return "retry_parser";
  if (blocker.code === "source_validation_blocking") return "review_validation_issue";
  if (blocker.code === "no_watchlist_terms" || blocker.code === "missing_organization_scope") return "materialize_watchlist_terms";
  return "repair_source_ops";
}

function projectionWatchlistActionOwner(
  blocker: TiSourceProvenanceProjectionWatchlistBlocker
): TiSourceProvenanceProjectionWatchlistRelevance["nextActions"][number]["ownerLane"] {
  if (blocker.ownerLane === "org") return "org";
  if (blocker.ownerLane === "parser") return "parser";
  if (blocker.ownerLane === "publicTI") return "publicTI";
  return "source";
}

function uniqueProjectionWatchlistBlockers(
  blockers: TiSourceProvenanceProjectionWatchlistBlocker[]
): TiSourceProvenanceProjectionWatchlistBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.path}:${blocker.reasonCode ?? ""}:${blocker.sourceFamily ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueProjectionWatchlistActions(
  actions: TiSourceProvenanceProjectionWatchlistRelevance["nextActions"]
): TiSourceProvenanceProjectionWatchlistRelevance["nextActions"] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.action}:${action.ownerLane}:${action.reasonCode}`;
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

function actorEnrichmentGapReceiptRow(
  profile: TiSourceProvenanceActorProfileContract,
  gap: TiSourceProvenanceActorProfileGap,
  sourcePlan: TiSourceProvenanceActorProfileGapSourcePlan | undefined,
  parserHealthSummary: TiSourceProvenanceParserHealthProvenanceSummary | undefined
): TiSourceProvenanceActorEnrichmentGapReceiptRow {
  const candidate = gap.field === "sourceProvenance"
    ? undefined
    : sourcePlan?.candidates.find((item) => item.field === gap.field);
  const familyRow = candidate
    ? parserHealthSummary?.familyRows.find((row) => row.family === candidate.family)
    : undefined;
  const status = actorEnrichmentGapReceiptStatus(candidate, familyRow);
  return {
    rowId: stableId("ti_source_provenance_actor_enrichment_gap_receipt_row", `${profile.id}:${gap.code}:${candidate?.candidateId ?? ""}:${status}`),
    gapCode: gap.code,
    field: gap.field,
    ownerLane: actorEnrichmentGapReceiptOwnerLane(gap, status),
    status,
    candidateId: candidate?.candidateId,
    sourceFamily: candidate?.family,
    parserState: familyRow?.parserState,
    parserStatus: actorEnrichmentGapReceiptParserStatus(familyRow),
    activationState: candidate?.activationState,
    nextAction: actorEnrichmentGapReceiptNextAction(candidate, familyRow, status),
    nextRetryAt: familyRow?.nextRetryAt,
    lastSuccessAt: familyRow?.lastSuccessAt,
    lastFailureAt: familyRow?.lastFailureAt,
    coverageCounts: {
      activationTestsQueued: familyRow?.activationTestsQueued ?? 0,
      parserRetriesQueued: familyRow?.parserRetriesQueued ?? 0,
      policyReviewsRequired: familyRow?.policyReviewsRequired ?? (candidate?.activationState === "blocked" ? 1 : 0),
      alertableCandidates: familyRow?.alertableCandidates ?? 0
    },
    provenance: {
      actorProfileContractId: profile.id,
      sourcePlanId: sourcePlan?.id,
      parserHealthProvenanceSummaryId: parserHealthSummary?.id,
      sourceHealthProofIds: familyRow?.provenance.sourceHealthProofIds ?? [],
      activationDecisionIds: familyRow?.provenance.activationDecisionIds ?? [],
      fixtureBacked: true
    }
  };
}

function actorEnrichmentGapReceiptStatus(
  candidate: TiSourceProvenanceActorProfileGapSourceCandidate | undefined,
  familyRow: TiSourceProvenanceParserHealthProvenanceFamilyRow | undefined
): TiSourceProvenanceActorEnrichmentGapReceiptRow["status"] {
  if (!candidate) return "missing_candidate";
  if (candidate.activationState === "blocked" || familyRow?.parserState === "blocked") return "policy_blocked";
  if (familyRow?.parserState === "retry_scheduled") return "parser_retry";
  if (familyRow?.parserState === "ready") return "source_ready";
  return "candidate_ready";
}

function actorEnrichmentGapReceiptOwnerLane(
  gap: TiSourceProvenanceActorProfileGap,
  status: TiSourceProvenanceActorEnrichmentGapReceiptRow["status"]
): TiSourceProvenanceActorEnrichmentGapReceiptRow["ownerLane"] {
  if (status === "parser_retry") return "parser";
  if (status === "policy_blocked") return "policy";
  return gap.ownerLane;
}

function actorEnrichmentGapReceiptParserStatus(
  familyRow: TiSourceProvenanceParserHealthProvenanceFamilyRow | undefined
): TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"] | undefined {
  if (!familyRow) return undefined;
  if (familyRow.parserState === "ready") return "ready";
  if (familyRow.parserState === "retry_scheduled") return "retry_scheduled";
  if (familyRow.parserState === "blocked") return "blocked";
  return "not_tested";
}

function actorEnrichmentGapReceiptNextAction(
  candidate: TiSourceProvenanceActorProfileGapSourceCandidate | undefined,
  familyRow: TiSourceProvenanceParserHealthProvenanceFamilyRow | undefined,
  status: TiSourceProvenanceActorEnrichmentGapReceiptRow["status"]
): TiSourceProvenanceActorEnrichmentGapReceiptRow["nextAction"] {
  if (!candidate) return "request_candidate";
  if (status === "policy_blocked") return "request_policy_approval";
  if (status === "parser_retry") return "retry_parser";
  if (status === "source_ready") return "inspect_source_health";
  if (familyRow?.parserState === "not_ready") return "test_source";
  return candidate.nextAction === "approval_required" ? "request_policy_approval" : "test_source";
}

function actorEnrichmentGapReceiptConsumers(
  profile: TiSourceProvenanceActorProfileContract,
  rows: TiSourceProvenanceActorEnrichmentGapReceiptRow[]
): TiSourceProvenanceActorEnrichmentGapReceipt["consumers"] {
  const hasRetry = rows.some((row) => row.status === "parser_retry");
  const hasPolicyBlocker = rows.some((row) => row.status === "policy_blocked");
  const hasCandidateCoverage = rows.some((row) => row.candidateId);
  return [{
    consumer: "publicTI",
    ready: rows.length === 0 || hasCandidateCoverage,
    requiredFields: ["rows[].field", "rows[].status", "rows[].provenance", "coverage.sourceFamilies"],
    route: {
      method: "GET",
      path: profile.publicTiRoute,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: rows.length === 0 || (!hasRetry && !hasPolicyBlocker && hasCandidateCoverage),
    requiredFields: ["rows[].coverageCounts.alertableCandidates", "rows[].nextRetryAt", "rows[].provenance.activationDecisionIds"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: profile.tenantId,
        organizationId: profile.organizationId,
        actor: profile.actor,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: rows.length > 0,
    requiredFields: ["rows[].nextAction", "rows[].sourceFamily", "rows[].parserState", "rows[].provenance.sourceHealthProofIds"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        actorProfileContractId: profile.id,
        includeActorGapReceipt: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function actorEnrichmentCoverageRows(
  receipt: TiSourceProvenanceActorEnrichmentGapReceipt
): TiSourceProvenanceActorEnrichmentCoverageExportRow[] {
  if (!receipt.rows.length) {
    return [{
      rowId: stableId("ti_source_provenance_actor_enrichment_coverage_row", `${receipt.id}:all_fields:covered`),
      field: "sourceProvenance",
      coverageState: "covered",
      alertableCandidates: 0,
      blockerCodes: [],
      provenance: {
        actorEnrichmentGapReceiptId: receipt.id,
        sourceHealthProofIds: [],
        activationDecisionIds: [],
        fixtureBacked: true
      }
    }];
  }
  return receipt.rows.map((row) => {
    const coverageState = actorEnrichmentCoverageState(row);
    const blockerCodes = actorEnrichmentCoverageBlockerCodes(row, coverageState);
    return {
      rowId: stableId("ti_source_provenance_actor_enrichment_coverage_row", `${receipt.id}:${row.rowId}:${coverageState}`),
      field: row.field,
      sourceFamily: row.sourceFamily,
      coverageState,
      parserStatus: row.parserStatus,
      lastSuccessAt: row.lastSuccessAt,
      lastFailureAt: row.lastFailureAt,
      nextRetryAt: row.nextRetryAt,
      alertableCandidates: row.coverageCounts.alertableCandidates,
      blockerCodes,
      provenance: {
        actorEnrichmentGapReceiptId: receipt.id,
        gapReceiptRowId: row.rowId,
        sourceHealthProofIds: row.provenance.sourceHealthProofIds,
        activationDecisionIds: row.provenance.activationDecisionIds,
        fixtureBacked: true
      }
    };
  });
}

function actorEnrichmentCoverageState(
  row: TiSourceProvenanceActorEnrichmentGapReceiptRow
): TiSourceProvenanceActorEnrichmentCoverageExportRow["coverageState"] {
  if (row.status === "source_ready") return "covered";
  if (row.status === "parser_retry") return "retry";
  if (row.status === "policy_blocked") return "blocked";
  return "pending";
}

function actorEnrichmentCoverageBlockerCodes(
  row: TiSourceProvenanceActorEnrichmentGapReceiptRow,
  coverageState: TiSourceProvenanceActorEnrichmentCoverageExportRow["coverageState"]
): TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"][] {
  if (coverageState === "covered") return [];
  if (row.status === "missing_candidate") return ["missing_candidate"];
  if (row.status === "parser_retry") return ["parser_retry"];
  if (row.status === "policy_blocked") return ["policy_blocked"];
  return ["coverage_pending"];
}

function actorEnrichmentCoverageBlockers(
  rows: TiSourceProvenanceActorEnrichmentCoverageExportRow[]
): TiSourceProvenanceActorEnrichmentCoverageExportBlocker[] {
  return rows.flatMap((row) => row.blockerCodes.map((code) => ({
    code,
    ownerLane: actorEnrichmentCoverageBlockerOwner(code),
    field: row.field,
    sourceFamily: row.sourceFamily,
    nextAction: actorEnrichmentCoverageBlockerNextAction(code),
    nextRetryAt: row.nextRetryAt,
    provenanceRef: row.provenance.gapReceiptRowId ?? row.provenance.actorEnrichmentGapReceiptId
  })));
}

function actorEnrichmentCoverageBlockerOwner(
  code: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"]
): TiSourceProvenanceActorEnrichmentCoverageExportBlocker["ownerLane"] {
  if (code === "parser_retry") return "parser";
  if (code === "policy_blocked") return "policy";
  if (code === "missing_candidate") return "source";
  return "publicTI";
}

function actorEnrichmentCoverageBlockerNextAction(
  code: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"]
): TiSourceProvenanceActorEnrichmentCoverageExportBlocker["nextAction"] {
  if (code === "parser_retry") return "retry_parser";
  if (code === "policy_blocked") return "request_policy_approval";
  if (code === "missing_candidate") return "request_candidate";
  return "inspect_source_health";
}

function actorEnrichmentCoverageConsumers(
  receipt: TiSourceProvenanceActorEnrichmentGapReceipt,
  rows: TiSourceProvenanceActorEnrichmentCoverageExportRow[],
  blockers: TiSourceProvenanceActorEnrichmentCoverageExportBlocker[]
): TiSourceProvenanceActorEnrichmentCoverageExport["consumers"] {
  const hasCovered = rows.some((row) => row.coverageState === "covered");
  const hasRetryOrPolicy = blockers.some((blocker) => blocker.code === "parser_retry" || blocker.code === "policy_blocked");
  return [{
    consumer: "publicTI",
    ready: hasCovered,
    requiredFields: ["coverageRows[].field", "coverageRows[].coverageState", "coverageRows[].provenance", "blockers[].code"],
    route: {
      method: "GET",
      path: receipt.publicTiRoute,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasCovered && !hasRetryOrPolicy,
    requiredFields: ["coverageRows[].alertableCandidates", "coverageRows[].provenance.activationDecisionIds", "summary.nextRetryAt"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: receipt.tenantId,
        organizationId: receipt.organizationId,
        actor: receipt.actor,
        actorEnrichmentGapReceiptId: receipt.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: blockers.length > 0,
    requiredFields: ["blockers[].nextAction", "coverageRows[].sourceFamily", "coverageRows[].parserStatus", "coverageRows[].provenance.sourceHealthProofIds"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        actorEnrichmentGapReceiptId: receipt.id,
        includeCoverageExport: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function actorEnrichmentCoverageHandoffField(
  coverageExport: TiSourceProvenanceActorEnrichmentCoverageExport,
  row: TiSourceProvenanceActorEnrichmentCoverageExportRow
): TiSourceProvenanceActorEnrichmentCoverageHandoffField {
  return {
    field: row.field,
    state: row.coverageState,
    sourceFamily: row.sourceFamily,
    parserStatus: row.parserStatus,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    nextRetryAt: row.nextRetryAt,
    alertableCandidates: row.alertableCandidates,
    blockerCodes: row.blockerCodes,
    provenance: {
      actorEnrichmentCoverageExportId: coverageExport.id,
      coverageRowId: row.rowId,
      sourceHealthProofIds: row.provenance.sourceHealthProofIds,
      activationDecisionIds: row.provenance.activationDecisionIds,
      fixtureBacked: true
    }
  };
}

function actorEnrichmentCoverageHandoffAlertRow(
  coverageExport: TiSourceProvenanceActorEnrichmentCoverageExport,
  row: TiSourceProvenanceActorEnrichmentCoverageExportRow
): TiSourceProvenanceActorEnrichmentCoverageHandoffAlertRow {
  return {
    field: row.field,
    sourceFamily: row.sourceFamily,
    matchable: row.coverageState === "covered" && row.alertableCandidates > 0,
    parserStatus: row.parserStatus,
    retryReady: row.coverageState === "retry" && Boolean(row.nextRetryAt),
    nextRetryAt: row.nextRetryAt,
    blockerCodes: row.blockerCodes,
    provenanceIds: {
      actorEnrichmentCoverageExportId: coverageExport.id,
      coverageRowId: row.rowId,
      sourceHealthProofIds: row.provenance.sourceHealthProofIds,
      activationDecisionIds: row.provenance.activationDecisionIds
    }
  };
}

function actorEnrichmentCoverageHandoffAction(
  blocker: TiSourceProvenanceActorEnrichmentCoverageExportBlocker
): TiSourceProvenanceActorEnrichmentCoverageHandoffAction {
  return {
    action: actorEnrichmentCoverageHandoffActionName(blocker.code),
    field: blocker.field,
    sourceFamily: blocker.sourceFamily,
    blockerCode: blocker.code,
    nextRetryAt: blocker.nextRetryAt,
    provenanceRef: blocker.provenanceRef
  };
}

function actorEnrichmentCoverageHandoffActionName(
  code: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"]
): TiSourceProvenanceActorEnrichmentCoverageHandoffAction["action"] {
  if (code === "parser_retry") return "retry";
  if (code === "policy_blocked") return "request_policy_approval";
  if (code === "missing_candidate") return "review_candidate";
  return "inspect";
}

function actorEnrichmentConsumerReadinessRows(
  handoff: TiSourceProvenanceActorEnrichmentCoverageHandoff
): TiSourceProvenanceActorEnrichmentConsumerReadinessRow[] {
  const sourceFamilies = handoff.summary.sourceFamilies;
  const parserStatuses = uniqueStrings(handoff.publicTi.fields.map((field) => field.parserStatus).filter(Boolean).map(String)) as TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"][];
  const sourceHealthProofIds = uniqueStrings(handoff.publicTi.fields.flatMap((field) => field.provenance.sourceHealthProofIds));
  const activationDecisionIds = uniqueStrings(handoff.publicTi.fields.flatMap((field) => field.provenance.activationDecisionIds));
  const retryFields = handoff.publicTi.fields.filter((field) => field.state === "retry").map((field) => field.field);
  const counts = {
    covered: handoff.summary.coveredFieldCount,
    pending: handoff.summary.pendingFieldCount,
    retryable: handoff.summary.retryableFieldCount,
    blocked: handoff.summary.blockedFieldCount,
    alertable: handoff.summary.alertableFieldCount
  };

  return [{
    consumer: "publicTI",
    ready: handoff.publicTi.ready,
    state: handoff.publicTi.ready ? "ready" : "blocked",
    route: handoff.publicTi.route,
    sourceFamilies,
    parserStatuses,
    coverageCounts: counts,
    retry: {
      retryable: retryFields.length > 0,
      nextRetryAt: handoff.summary.nextRetryAt,
      retryFields
    },
    blockerCodes: handoff.summary.blockerCodes,
    provenanceIds: {
      actorEnrichmentCoverageHandoffId: handoff.id,
      coverageExportId: handoff.actorEnrichmentCoverageExportId,
      sourceHealthProofIds,
      activationDecisionIds
    }
  }, {
    consumer: "alertGeneration",
    ready: handoff.alertGeneration.ready,
    state: handoff.alertGeneration.ready ? "ready" : "blocked",
    route: handoff.alertGeneration.route.path,
    sourceFamilies,
    parserStatuses,
    coverageCounts: counts,
    retry: {
      retryable: retryFields.length > 0,
      nextRetryAt: handoff.summary.nextRetryAt,
      retryFields
    },
    blockerCodes: handoff.summary.blockerCodes,
    provenanceIds: {
      actorEnrichmentCoverageHandoffId: handoff.id,
      coverageExportId: handoff.actorEnrichmentCoverageExportId,
      sourceHealthProofIds,
      activationDecisionIds
    }
  }, {
    consumer: "sourceOps",
    ready: handoff.sourceOps.ready,
    state: handoff.sourceOps.ready ? "action_required" : "ready",
    route: "/v1/dwm/source-requests",
    sourceFamilies,
    parserStatuses,
    coverageCounts: counts,
    retry: {
      retryable: retryFields.length > 0,
      nextRetryAt: handoff.summary.nextRetryAt,
      retryFields
    },
    blockerCodes: handoff.summary.blockerCodes,
    provenanceIds: {
      actorEnrichmentCoverageHandoffId: handoff.id,
      coverageExportId: handoff.actorEnrichmentCoverageExportId,
      sourceHealthProofIds,
      activationDecisionIds
    }
  }];
}

function actorEnrichmentConsumerReadinessBlockers(
  handoff: TiSourceProvenanceActorEnrichmentCoverageHandoff,
  rows: TiSourceProvenanceActorEnrichmentConsumerReadinessRow[]
): TiSourceProvenanceActorEnrichmentConsumerReadinessBlocker[] {
  const readinessByConsumer = new Map(rows.map((row) => [row.consumer, row]));
  const blockedConsumers = rows.filter((row) => !row.ready && row.consumer !== "sourceOps").map((row) => row.consumer);
  const sourceOpsConsumers: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["consumer"][] = handoff.sourceOps.ready ? ["sourceOps"] : [];
  return handoff.sourceOps.actions.flatMap((action) => [...blockedConsumers, ...sourceOpsConsumers].map((consumer) => ({
    code: action.blockerCode,
    consumer,
    field: action.field,
    ownerLane: actorEnrichmentCoverageBlockerOwner(action.blockerCode),
    action: action.action,
    nextRetryAt: action.nextRetryAt ?? readinessByConsumer.get(consumer)?.retry.nextRetryAt,
    provenanceRef: action.provenanceRef
  })));
}

function actorEnrichmentConsumerRow(
  receipt: TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt,
  consumer: TiSourceProvenanceActorEnrichmentConsumerReadinessRow["consumer"]
): TiSourceProvenanceActorEnrichmentConsumerReadinessRow {
  return receipt.rows.find((row) => row.consumer === consumer) ?? {
    consumer,
    ready: false,
    state: "blocked",
    sourceFamilies: [],
    parserStatuses: [],
    coverageCounts: {
      covered: 0,
      pending: 0,
      retryable: 0,
      blocked: 0,
      alertable: 0
    },
    retry: {
      retryable: false,
      retryFields: []
    },
    blockerCodes: ["coverage_pending"],
    provenanceIds: {
      actorEnrichmentCoverageHandoffId: receipt.actorEnrichmentCoverageHandoffId,
      coverageExportId: receipt.actorEnrichmentCoverageHandoffId,
      sourceHealthProofIds: [],
      activationDecisionIds: []
    }
  };
}

function actorEnrichmentSourceAlertReadinessAction(
  blocker: TiSourceProvenanceActorEnrichmentConsumerReadinessBlocker
): TiSourceProvenanceActorEnrichmentSourceAlertReadinessAction {
  return {
    action: blocker.action,
    consumer: blocker.consumer,
    field: blocker.field,
    blockerCode: blocker.code,
    ownerLane: blocker.ownerLane,
    nextRetryAt: blocker.nextRetryAt,
    provenanceRef: blocker.provenanceRef
  };
}

function actorEnrichmentParserAuditConsumerEvent(
  receipt: TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt,
  row: TiSourceProvenanceActorEnrichmentConsumerReadinessRow
): TiSourceProvenanceActorEnrichmentParserStatusAuditEvent {
  const parserStatus = row.ready || row.state === "ready" ? "ready" : row.parserStatuses[0] ?? "not_tested";
  return {
    eventId: stableId("ti_source_provenance_actor_enrichment_parser_status_audit_event", `${receipt.id}:${row.consumer}:consumer:${parserStatus}`),
    eventType: "consumer_readiness",
    consumer: row.consumer,
    state: row.state,
    parserStatus,
    sourceFamilies: row.sourceFamilies,
    coverageCounts: row.coverageCounts,
    retry: row.retry,
    lastSuccessAt: receipt.sourceHealth.lastSuccessAt,
    lastFailureAt: receipt.sourceHealth.lastFailureAt,
    provenanceIds: row.provenanceIds
  };
}

function actorEnrichmentParserAuditBlockerEvent(
  receipt: TiSourceProvenanceActorEnrichmentConsumerReadinessReceipt,
  blocker: TiSourceProvenanceActorEnrichmentConsumerReadinessBlocker
): TiSourceProvenanceActorEnrichmentParserStatusAuditEvent {
  const row = actorEnrichmentConsumerRow(receipt, blocker.consumer);
  const parserStatus = actorEnrichmentParserStatusForBlocker(blocker.code, row);
  return {
    eventId: stableId("ti_source_provenance_actor_enrichment_parser_status_audit_event", `${receipt.id}:${blocker.consumer}:${blocker.field}:${blocker.code}`),
    eventType: "blocker_action",
    consumer: blocker.consumer,
    state: row.state,
    parserStatus,
    sourceFamilies: row.sourceFamilies,
    coverageCounts: row.coverageCounts,
    retry: {
      retryable: row.retry.retryable || blocker.code === "parser_retry",
      nextRetryAt: blocker.nextRetryAt ?? row.retry.nextRetryAt,
      retryFields: row.retry.retryFields.includes(blocker.field) ? row.retry.retryFields : [...row.retry.retryFields, blocker.field]
    },
    blockerCode: blocker.code,
    field: blocker.field,
    ownerLane: blocker.ownerLane,
    action: blocker.action,
    lastSuccessAt: receipt.sourceHealth.lastSuccessAt,
    lastFailureAt: receipt.sourceHealth.lastFailureAt,
    provenanceIds: row.provenanceIds,
    provenanceRef: blocker.provenanceRef
  };
}

function actorEnrichmentParserStatusForBlocker(
  code: TiSourceProvenanceActorEnrichmentCoverageExportBlocker["code"],
  row: TiSourceProvenanceActorEnrichmentConsumerReadinessRow
): TiSourceProvenanceActorProfileSourceUpdateTask["parserStatus"] {
  if (code === "parser_retry") return "retry_scheduled";
  if (code === "policy_blocked") return "blocked";
  if (code === "missing_candidate") return "not_tested";
  return row.parserStatuses[0] ?? "not_tested";
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

function sourceActivationAuditEvent(
  readiness: TiSourceProvenanceSourcePackActivationReadiness,
  action: TiSourceProvenanceSourcePackActivationAction
): TiSourceProvenanceSourceActivationAuditEvent {
  const status = action.action === "test_source"
    ? "ready_to_test"
    : action.action === "retry_parser"
      ? "retry_scheduled"
      : "policy_blocked";
  const decision = action.action === "test_source"
    ? "queue_activation_test"
    : action.action === "retry_parser"
      ? "retry_parser"
      : "request_policy_review";

  return {
    eventId: stableId("ti_source_provenance_source_activation_audit_event", `${readiness.id}:${action.actionId}:${status}`),
    candidateId: action.candidateId,
    sourceId: action.sourceId,
    family: action.family,
    status,
    parserStatus: action.parserStatus,
    activationState: action.activationState,
    decision,
    reason: action.reason,
    nextRetryAt: action.nextRetryAt,
    provenance: {
      sourcePackActivationReadinessId: readiness.id,
      activationActionId: action.actionId,
      sourceHealthProofId: stableId("ti_source_provenance_source_activation_health", `${readiness.id}:${action.family}`),
      fixtureBacked: true
    },
    route: action.route,
    alertability: {
      canGenerateAlertEvidence: status === "ready_to_test" && action.parserStatus === "ready",
      blockedByPolicy: status === "policy_blocked",
      blockedByParser: status === "retry_scheduled" || action.parserStatus === "failed" || action.parserStatus === "retry_scheduled"
    }
  };
}

function sourceActivationAuditConsumers(
  readiness: TiSourceProvenanceSourcePackActivationReadiness,
  events: TiSourceProvenanceSourceActivationAuditEvent[]
): TiSourceProvenanceSourceActivationAuditPacket["consumers"] {
  const hasReadyEvent = events.some((event) => event.status === "ready_to_test");
  const hasPolicyBlocker = events.some((event) => event.status === "policy_blocked");
  const hasRetry = events.some((event) => event.status === "retry_scheduled");
  return [{
    consumer: "sourceOps",
    ready: events.length > 0,
    requiredFields: ["events[].candidateId", "events[].status", "events[].route", "summary.nextRetryAt"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackActivationReadinessId: readiness.id,
        includeAuditEvents: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "publicTI",
    ready: hasReadyEvent && !hasPolicyBlocker,
    requiredFields: ["events[].family", "events[].alertability", "events[].provenance"],
    route: {
      method: "GET",
      path: `/ti/${encodeURIComponent(readiness.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasReadyEvent && !hasPolicyBlocker && !hasRetry,
    requiredFields: ["events[].sourceId", "events[].alertability.canGenerateAlertEvidence", "events[].parserStatus"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: readiness.tenantId,
        organizationId: readiness.organizationId,
        actor: readiness.actor,
        sourcePackActivationReadinessId: readiness.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourceActivationDecision(
  auditPacket: TiSourceProvenanceSourceActivationAuditPacket,
  event: TiSourceProvenanceSourceActivationAuditEvent,
  generatedAt: string
): TiSourceProvenanceSourceActivationDecision {
  const outcome = event.status === "ready_to_test"
    ? "activation_test_queued"
    : event.status === "retry_scheduled"
      ? "parser_retry_queued"
      : "policy_review_required";
  const status = outcome === "activation_test_queued"
    ? "accepted"
    : outcome === "parser_retry_queued"
      ? "retry_scheduled"
      : "blocked";
  return {
    decisionId: stableId("ti_source_provenance_source_activation_decision", `${auditPacket.id}:${event.eventId}:${outcome}`),
    eventId: event.eventId,
    candidateId: event.candidateId,
    sourceId: event.sourceId,
    family: event.family,
    outcome,
    status,
    parserStatus: event.parserStatus,
    activationState: event.activationState,
    lastSuccessAt: event.alertability.canGenerateAlertEvidence ? generatedAt : undefined,
    lastFailureAt: event.alertability.blockedByParser || event.alertability.blockedByPolicy ? generatedAt : undefined,
    nextRetryAt: event.nextRetryAt,
    reason: event.reason,
    provenance: {
      sourceActivationAuditPacketId: auditPacket.id,
      sourcePackActivationReadinessId: event.provenance.sourcePackActivationReadinessId,
      activationActionId: event.provenance.activationActionId,
      sourceHealthProofId: event.provenance.sourceHealthProofId,
      fixtureBacked: true
    },
    alertability: event.alertability,
    route: event.route
  };
}

function sourceActivationDecisionFamilyCoverage(
  decisions: TiSourceProvenanceSourceActivationDecision[]
): TiSourceProvenanceSourceActivationDecisionReceipt["familyCoverage"] {
  const families = uniqueStrings(decisions.map((decision) => decision.family)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  return families.map((family) => {
    const familyDecisions = decisions.filter((decision) => decision.family === family);
    return {
      family,
      activationTestsQueued: familyDecisions.filter((decision) => decision.outcome === "activation_test_queued").length,
      parserRetriesQueued: familyDecisions.filter((decision) => decision.outcome === "parser_retry_queued").length,
      policyReviewsRequired: familyDecisions.filter((decision) => decision.outcome === "policy_review_required").length,
      alertableCandidates: familyDecisions.filter((decision) => decision.alertability.canGenerateAlertEvidence).length
    };
  });
}

function sourceActivationDecisionConsumers(
  auditPacket: TiSourceProvenanceSourceActivationAuditPacket,
  decisions: TiSourceProvenanceSourceActivationDecision[]
): TiSourceProvenanceSourceActivationDecisionReceipt["consumers"] {
  const hasAccepted = decisions.some((decision) => decision.status === "accepted");
  const hasAlertable = decisions.some((decision) => decision.alertability.canGenerateAlertEvidence);
  const hasBlockingPolicy = decisions.some((decision) => decision.status === "blocked");
  const hasRetry = decisions.some((decision) => decision.status === "retry_scheduled");
  return [{
    consumer: "sourceOps",
    ready: decisions.length > 0,
    requiredFields: ["decisions[].outcome", "decisions[].route", "familyCoverage[]", "summary.nextRetryAt"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourceActivationAuditPacketId: auditPacket.id,
        includeDecisionReceipt: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "publicTI",
    ready: hasAccepted,
    requiredFields: ["decisions[].family", "decisions[].provenance", "familyCoverage[].alertableCandidates"],
    route: {
      method: "GET",
      path: `/ti/${encodeURIComponent(auditPacket.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasAlertable && !hasBlockingPolicy && !hasRetry,
    requiredFields: ["decisions[].sourceId", "decisions[].alertability", "decisions[].lastSuccessAt"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: auditPacket.tenantId,
        organizationId: auditPacket.organizationId,
        actor: auditPacket.actor,
        sourceActivationAuditPacketId: auditPacket.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureGrowthRows(
  receipt: TiSourceProvenanceSourceActivationDecisionReceipt,
  decision: TiSourceProvenanceSourceActivationDecision,
  generatedAt: string
): TiSourceProvenanceSourcePackFixtureGrowthRow[] {
  const primaryRow = sourcePackFixtureGrowthRow(receipt, decision, generatedAt, decision.status === "accepted" ? "actor_enrichment_update" : "source_blocker");
  if (!decision.alertability.canGenerateAlertEvidence) return [primaryRow];
  return [
    primaryRow,
    sourcePackFixtureGrowthRow(receipt, decision, generatedAt, "alert_ready_capture")
  ];
}

function sourcePackFixtureGrowthRow(
  receipt: TiSourceProvenanceSourceActivationDecisionReceipt,
  decision: TiSourceProvenanceSourceActivationDecision,
  generatedAt: string,
  rowType: TiSourceProvenanceSourcePackFixtureGrowthRow["rowType"]
): TiSourceProvenanceSourcePackFixtureGrowthRow {
  const healthState = sourcePackFixtureGrowthHealthState(decision);
  const captureId = stableId("ti_source_provenance_fixture_capture", `${receipt.id}:${decision.decisionId}:${rowType}`);
  const publicTiRoute = `/ti/${encodeURIComponent(receipt.actor)}`;
  return {
    rowId: stableId("ti_source_provenance_source_pack_fixture_growth_row", `${receipt.id}:${decision.decisionId}:${rowType}`),
    rowType,
    actor: receipt.actor,
    publicTiRoute,
    sourceId: decision.sourceId,
    candidateId: decision.candidateId,
    sourceFamily: decision.family,
    parserStatus: decision.parserStatus,
    healthState,
    freshness: {
      state: healthState === "healthy" || healthState === "degraded" ? "fresh" : healthState === "stale" ? "stale" : "missing",
      observedAt: decision.status === "accepted" ? decision.lastSuccessAt ?? generatedAt : undefined,
      nextRetryAt: decision.nextRetryAt
    },
    retry: {
      retryable: decision.status === "retry_scheduled",
      nextRetryAt: decision.nextRetryAt,
      policyReviewRequired: decision.status === "blocked"
    },
    blockerReason: decision.status === "accepted" ? undefined : decision.reason,
    downstreamRoutes: {
      publicTI: publicTiRoute,
      alertGeneration: "/v1/dwm/alerts/rebuild",
      sourceOps: "/v1/dwm/source-requests"
    },
    provenance: {
      sourceActivationDecisionReceiptId: receipt.id,
      sourceActivationAuditPacketId: decision.provenance.sourceActivationAuditPacketId,
      sourcePackActivationReadinessId: decision.provenance.sourcePackActivationReadinessId,
      activationActionId: decision.provenance.activationActionId,
      sourceHealthProofId: decision.provenance.sourceHealthProofId,
      captureId,
      contentHash: stableId("ti_source_provenance_fixture_capture_hash", `${captureId}:${decision.family}:${decision.parserStatus}:${healthState}`),
      fixtureBacked: true
    }
  };
}

function sourcePackFixtureGrowthHealthState(
  decision: TiSourceProvenanceSourceActivationDecision
): TiSourceProvenanceSourcePackFixtureGrowthRow["healthState"] {
  if (decision.status === "blocked") return "blocked";
  if (decision.status === "retry_scheduled") return "stale";
  if (decision.alertability.canGenerateAlertEvidence) return "healthy";
  return "degraded";
}

function sourcePackFixtureGrowthConsumers(
  receipt: TiSourceProvenanceSourceActivationDecisionReceipt,
  rows: TiSourceProvenanceSourcePackFixtureGrowthRow[]
): TiSourceProvenanceSourcePackFixtureGrowthPacket["consumers"] {
  const hasActorUpdate = rows.some((row) => row.rowType === "actor_enrichment_update");
  const hasAlertReadyCapture = rows.some((row) => row.rowType === "alert_ready_capture");
  const hasActionableBlocker = rows.some((row) => row.rowType === "source_blocker");
  return [{
    consumer: "publicTI",
    ready: hasActorUpdate,
    route: {
      method: "GET",
      path: `/ti/${encodeURIComponent(receipt.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    requiredFields: ["rows[].publicTiRoute", "rows[].freshness", "rows[].provenance.contentHash"]
  }, {
    consumer: "alertGeneration",
    ready: hasAlertReadyCapture,
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: receipt.tenantId,
        organizationId: receipt.organizationId,
        actor: receipt.actor,
        sourceActivationDecisionReceiptId: receipt.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    requiredFields: ["rows[].rowType", "rows[].provenance.captureId", "rows[].provenance.contentHash"]
  }, {
    consumer: "sourceOps",
    ready: hasActionableBlocker || hasActorUpdate,
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourceActivationDecisionReceiptId: receipt.id,
        includeFixtureGrowth: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    requiredFields: ["rows[].healthState", "rows[].retry", "rows[].blockerReason"]
  }];
}

function sourcePackFixtureCatalogRow(
  packet: TiSourceProvenanceSourcePackFixtureGrowthPacket,
  row: TiSourceProvenanceSourcePackFixtureGrowthRow
): TiSourceProvenanceSourcePackFixtureCatalogRow {
  return {
    catalogRowId: stableId("ti_source_provenance_source_pack_fixture_catalog_row", `${packet.id}:${row.rowId}`),
    growthRowId: row.rowId,
    sourcePackFixtureGrowthPacketId: packet.id,
    actor: row.actor,
    publicTiRoute: row.publicTiRoute,
    sourceFamily: row.sourceFamily,
    rowType: row.rowType,
    parserStatus: row.parserStatus,
    healthState: row.healthState,
    observedAt: row.freshness.observedAt,
    nextRetryAt: row.freshness.nextRetryAt ?? row.retry.nextRetryAt,
    confidence: sourcePackFixtureCatalogConfidence(row),
    coverageTags: sourcePackFixtureCatalogCoverageTags(row),
    downstreamRoutes: row.downstreamRoutes,
    provenance: row.provenance
  };
}

function sourcePackFixtureCatalogConfidence(row: TiSourceProvenanceSourcePackFixtureGrowthRow): number {
  if (row.healthState === "blocked") return 0.2;
  if (row.healthState === "stale") return 0.5;
  if (row.healthState === "degraded") return row.rowType === "alert_ready_capture" ? 0.72 : 0.64;
  if (row.rowType === "alert_ready_capture") return 0.9;
  return 0.86;
}

function sourcePackFixtureCatalogCoverageTags(row: TiSourceProvenanceSourcePackFixtureGrowthRow): string[] {
  const tags = new Set<string>();
  if (row.rowType === "actor_enrichment_update") {
    tags.add("actor_profile");
    tags.add("source_provenance");
  }
  if (row.rowType === "alert_ready_capture") {
    tags.add("alertable_fields");
    tags.add("watchlist_terms");
  }
  if (row.rowType === "source_blocker") {
    tags.add("enrichment_gap");
    tags.add("source_health_blocker");
  }
  if (row.sourceFamily === "actor_page") tags.add("actor_metadata");
  if (row.sourceFamily === "public_advisory") tags.add("public_advisory");
  if (row.sourceFamily === "telegram_public") tags.add("telegram_public");
  if (row.sourceFamily === "darkweb_metadata") tags.add("metadata_only");
  if (row.parserStatus === "retry_scheduled") tags.add("retry_backoff");
  if (row.healthState === "stale") tags.add("stale_source");
  if (row.healthState === "degraded") tags.add("parser_degraded");
  if (row.healthState === "blocked") tags.add("policy_blocked");
  return [...tags].sort();
}

function sourcePackFixtureCatalogConsumers(
  rows: TiSourceProvenanceSourcePackFixtureCatalogRow[]
): TiSourceProvenanceSourcePackFixtureCatalogPacket["consumers"] {
  const hasRows = rows.length > 0;
  const hasAlertReady = rows.some((row) => row.rowType === "alert_ready_capture");
  return [{
    consumer: "publicTI",
    ready: hasRows,
    requiredFields: ["rows[].actor", "rows[].publicTiRoute", "rows[].coverageTags", "rows[].provenance", "summary"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasAlertReady,
    requiredFields: ["rows[].rowType", "rows[].coverageTags", "rows[].confidence", "rows[].downstreamRoutes.alertGeneration"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeFixtureCatalog: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["rows[].sourceFamily", "rows[].parserStatus", "rows[].healthState", "summary.coverageTags"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeFixtureCatalog: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "safeOutput", "sourcePackFixtureGrowthPacketIds", "rows[].provenance", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationFixtureCatalog: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureAlertReadinessRow(
  row: TiSourceProvenanceSourcePackFixtureCatalogRow
): TiSourceProvenanceSourcePackFixtureAlertReadinessRow {
  const prerequisites = sourcePackFixtureAlertReadinessPrerequisites(row);
  const isAlertCapture = row.rowType === "alert_ready_capture" && row.coverageTags.includes("alertable_fields") && row.coverageTags.includes("watchlist_terms");
  const alertReadiness: TiSourceProvenanceSourcePackFixtureAlertReadinessRow["alertReadiness"] = isAlertCapture && prerequisites.length === 0
    ? "ready"
    : prerequisites.some((prerequisite) => prerequisite.code === "parser_retry_required" || prerequisite.code === "policy_review_required")
      ? "blocked"
      : "partial";

  return {
    readinessRowId: stableId("ti_source_provenance_source_pack_fixture_alert_readiness_row", `${row.catalogRowId}:${alertReadiness}:${prerequisites.map((prerequisite) => prerequisite.code).join(",")}`),
    catalogRowId: row.catalogRowId,
    actor: row.actor,
    publicTiRoute: row.publicTiRoute,
    sourceFamily: row.sourceFamily,
    rowType: row.rowType,
    parserStatus: row.parserStatus,
    healthState: row.healthState,
    alertReadiness,
    observedAt: row.observedAt,
    nextRetryAt: row.nextRetryAt,
    confidence: row.confidence,
    coverageTags: row.coverageTags,
    prerequisites,
    remediation: sourcePackFixtureAlertReadinessRemediation(row, prerequisites, alertReadiness),
    downstreamRoutes: row.downstreamRoutes,
    provenance: row.provenance
  };
}

function sourcePackFixtureAlertReadinessPrerequisites(
  row: TiSourceProvenanceSourcePackFixtureCatalogRow
): TiSourceProvenanceSourcePackFixtureAlertReadinessPrerequisite[] {
  if (row.parserStatus === "retry_scheduled" || row.healthState === "stale") {
    return [{
      code: "parser_retry_required",
      ownerLane: "parser",
      nextAction: "retry_parser",
      reason: "Parser retry is required before this source can produce alertable evidence.",
      nextRetryAt: row.nextRetryAt,
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          catalogRowId: row.catalogRowId,
          action: "retry_parser",
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  if (row.parserStatus === "blocked" || row.healthState === "blocked" || row.coverageTags.includes("policy_blocked")) {
    return [{
      code: "policy_review_required",
      ownerLane: "policy",
      nextAction: "request_policy_review",
      reason: "Policy approval is required before this metadata source can be promoted beyond safe fixture evidence.",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          catalogRowId: row.catalogRowId,
          action: "request_policy_review",
          metadataOnly: row.coverageTags.includes("metadata_only"),
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  if (row.healthState === "degraded" || row.parserStatus === "not_tested") {
    return [{
      code: "parser_health_inspection_required",
      ownerLane: "source",
      nextAction: "inspect_source_health",
      reason: "Parser health must be inspected before this fixture row can be treated as alert-ready.",
      route: {
        method: "GET",
        path: "/v1/dwm/source-requests",
        body: {
          catalogRowId: row.catalogRowId,
          includeSourceHealth: true,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  if (!row.coverageTags.includes("alertable_fields") || !row.coverageTags.includes("watchlist_terms")) {
    return [{
      code: "watchlist_materialization_required",
      ownerLane: "org",
      nextAction: "materialize_watchlist_terms",
      reason: "Watchlist terms and alertable fields must be materialized before this enrichment row can create customer alerts.",
      route: {
        method: "POST",
        path: "/v1/organizations/watchlists/terms",
        body: {
          actor: row.actor,
          publicTiRoute: row.publicTiRoute,
          sourceFamily: row.sourceFamily,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    }];
  }
  return [];
}

function sourcePackFixtureAlertReadinessRemediation(
  row: TiSourceProvenanceSourcePackFixtureCatalogRow,
  prerequisites: TiSourceProvenanceSourcePackFixtureAlertReadinessPrerequisite[],
  alertReadiness: TiSourceProvenanceSourcePackFixtureAlertReadinessRow["alertReadiness"]
): TiSourceProvenanceSourcePackFixtureAlertReadinessRow["remediation"] {
  const firstPrerequisite = prerequisites[0];
  if (alertReadiness === "ready") {
    return {
      action: "queue_alert_rebuild",
      ownerLane: "alert",
      route: {
        method: "POST",
        path: row.downstreamRoutes.alertGeneration,
        body: {
          catalogRowId: row.catalogRowId,
          actor: row.actor,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      },
      reason: "Fixture capture has watchlist terms, alertable fields, healthy parser status, and provenance IDs."
    };
  }
  if (firstPrerequisite) {
    return {
      action: firstPrerequisite.nextAction,
      ownerLane: firstPrerequisite.ownerLane,
      route: firstPrerequisite.route,
      reason: firstPrerequisite.reason
    };
  }
  return {
    action: "inspect_source_health",
    ownerLane: "source",
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        catalogRowId: row.catalogRowId,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    reason: "Source readiness needs operator inspection before alert generation."
  };
}

function sourcePackFixtureAlertReadinessConsumers(
  rows: TiSourceProvenanceSourcePackFixtureAlertReadinessRow[]
): TiSourceProvenanceSourcePackFixtureAlertReadinessPacket["consumers"] {
  const hasRows = rows.length > 0;
  const hasReadyRows = rows.some((row) => row.alertReadiness === "ready");
  return [{
    consumer: "publicTI",
    ready: hasRows,
    requiredFields: ["rows[].actor", "rows[].publicTiRoute", "rows[].sourceFamily", "rows[].provenance", "summary"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasReadyRows,
    requiredFields: ["rows[].alertReadiness", "rows[].coverageTags", "rows[].remediation", "rows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeFixtureAlertReadiness: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["rows[].parserStatus", "rows[].healthState", "rows[].prerequisites", "summary.prerequisiteCodes"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeFixtureAlertReadiness: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "sourcePackFixtureCatalogPacketId", "rows[].remediation", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationFixtureAlertReadiness: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureAlertDedupeRow(
  row: TiSourceProvenanceSourcePackFixtureAlertReadinessRow,
  seen: Map<string, string>
): TiSourceProvenanceSourcePackFixtureAlertDedupeRow {
  const dedupeKey = sourcePackFixtureAlertDedupeKey(row);
  const missingProvenance = !row.provenance.captureId || !row.provenance.contentHash;
  const duplicateOf = seen.get(dedupeKey);
  if (!duplicateOf && !missingProvenance) seen.set(dedupeKey, row.readinessRowId);
  const blockerCodes = sourcePackFixtureAlertDedupeBlockerCodes(row, duplicateOf, missingProvenance);
  const dedupeState: TiSourceProvenanceSourcePackFixtureAlertDedupeRow["dedupeState"] = duplicateOf
    ? "duplicate"
    : blockerCodes.length === 0
      ? "canonical"
      : "held";
  const alertEligibility: TiSourceProvenanceSourcePackFixtureAlertDedupeRow["alertEligibility"] = dedupeState === "canonical" && row.alertReadiness === "ready"
    ? "ready"
    : "held";

  return {
    dedupeRowId: stableId("ti_source_provenance_source_pack_fixture_alert_dedupe_row", `${row.readinessRowId}:${dedupeKey}:${dedupeState}:${blockerCodes.join(",")}`),
    readinessRowId: row.readinessRowId,
    dedupeKey,
    dedupeState,
    alertEligibility,
    actor: row.actor,
    publicTiRoute: row.publicTiRoute,
    sourceFamily: row.sourceFamily,
    parserStatus: row.parserStatus,
    healthState: row.healthState,
    alertReadiness: row.alertReadiness,
    confidence: row.confidence,
    observedAt: row.observedAt,
    nextRetryAt: row.nextRetryAt,
    blockerCodes,
    duplicateOf,
    action: sourcePackFixtureAlertDedupeAction(row, dedupeState, blockerCodes, duplicateOf),
    downstreamRoutes: row.downstreamRoutes,
    provenance: row.provenance
  };
}

function sourcePackFixtureAlertDedupeKey(row: TiSourceProvenanceSourcePackFixtureAlertReadinessRow): string {
  return [
    row.actor,
    row.sourceFamily,
    row.rowType,
    row.provenance.captureId || "missing_capture",
    row.provenance.contentHash || "missing_hash"
  ].join(":");
}

function sourcePackFixtureAlertDedupeBlockerCodes(
  row: TiSourceProvenanceSourcePackFixtureAlertReadinessRow,
  duplicateOf: string | undefined,
  missingProvenance: boolean
): TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode[] {
  const codes = new Set<TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode>();
  if (duplicateOf) codes.add("duplicate_fixture_capture");
  if (missingProvenance) codes.add("missing_provenance");
  if (row.alertReadiness !== "ready") codes.add("not_alert_ready");
  for (const prerequisite of row.prerequisites) codes.add(prerequisite.code);
  return [...codes];
}

function sourcePackFixtureAlertDedupeAction(
  row: TiSourceProvenanceSourcePackFixtureAlertReadinessRow,
  dedupeState: TiSourceProvenanceSourcePackFixtureAlertDedupeRow["dedupeState"],
  blockerCodes: TiSourceProvenanceSourcePackFixtureAlertDedupeBlockerCode[],
  duplicateOf: string | undefined
): TiSourceProvenanceSourcePackFixtureAlertDedupeRow["action"] {
  if (dedupeState === "canonical" && row.alertReadiness === "ready") {
    return {
      action: "queue_alert_rebuild",
      ownerLane: "alert",
      route: {
        method: "POST",
        path: row.downstreamRoutes.alertGeneration,
        body: {
          readinessRowId: row.readinessRowId,
          dedupeKey: sourcePackFixtureAlertDedupeKey(row),
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (dedupeState === "duplicate") {
    return {
      action: "suppress_duplicate",
      ownerLane: "source",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          readinessRowId: row.readinessRowId,
          duplicateOf,
          action: "suppress_duplicate",
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (blockerCodes.includes("missing_provenance")) {
    return {
      action: "inspect_provenance",
      ownerLane: "source",
      route: {
        method: "GET",
        path: "/v1/dwm/source-requests",
        body: {
          readinessRowId: row.readinessRowId,
          includeProvenance: true,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  const prerequisite = row.prerequisites[0];
  return {
    action: "resolve_prerequisite",
    ownerLane: prerequisite?.ownerLane ?? "source",
    route: prerequisite?.route ?? {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        readinessRowId: row.readinessRowId,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourcePackFixtureAlertDedupeConsumers(
  rows: TiSourceProvenanceSourcePackFixtureAlertDedupeRow[]
): TiSourceProvenanceSourcePackFixtureAlertDedupePacket["consumers"] {
  const hasRows = rows.length > 0;
  const hasCanonicalReadyRows = rows.some((row) => row.dedupeState === "canonical" && row.alertEligibility === "ready");
  return [{
    consumer: "publicTI",
    ready: hasRows,
    requiredFields: ["rows[].actor", "rows[].publicTiRoute", "rows[].sourceFamily", "rows[].provenance", "summary"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasCanonicalReadyRows,
    requiredFields: ["rows[].dedupeKey", "rows[].dedupeState", "rows[].alertEligibility", "rows[].action", "rows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeFixtureAlertDedupe: true,
        canonicalOnly: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["rows[].blockerCodes", "rows[].duplicateOf", "rows[].action", "summary.blockerCodes"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeFixtureAlertDedupe: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "sourcePackFixtureAlertReadinessPacketId", "rows[].dedupeKey", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationFixtureAlertDedupe: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureHealthDrilldownRow(
  row: TiSourceProvenanceSourcePackFixtureAlertDedupeRow
): TiSourceProvenanceSourcePackFixtureHealthDrilldownRow {
  const activationState = sourcePackFixtureHealthDrilldownActivationState(row);
  const failure = sourcePackFixtureHealthDrilldownFailure(row, activationState);
  return {
    drilldownRowId: stableId("ti_source_provenance_source_pack_fixture_health_drilldown_row", `${row.dedupeRowId}:${activationState}:${failure.code}`),
    dedupeRowId: row.dedupeRowId,
    actor: row.actor,
    publicTiRoute: row.publicTiRoute,
    sourceFamily: row.sourceFamily,
    parserStatus: row.parserStatus,
    healthState: row.healthState,
    activationState,
    alertEligibility: row.alertEligibility,
    confidence: row.confidence,
    observedAt: row.observedAt,
    retry: {
      retryable: activationState === "retry_scheduled",
      nextRetryAt: activationState === "retry_scheduled" ? row.nextRetryAt : undefined,
      backoffReason: activationState === "retry_scheduled" ? "parser_retry_required" : undefined
    },
    failure,
    downstreamRoutes: row.downstreamRoutes,
    provenance: row.provenance
  };
}

function sourcePackFixtureHealthDrilldownActivationState(
  row: TiSourceProvenanceSourcePackFixtureAlertDedupeRow
): TiSourceProvenanceSourcePackFixtureHealthDrilldownActivationState {
  if (row.alertEligibility === "ready" && row.dedupeState === "canonical") return "active";
  if (row.blockerCodes.includes("duplicate_fixture_capture")) return "suppressed_duplicate";
  if (row.blockerCodes.includes("parser_retry_required")) return "retry_scheduled";
  if (row.blockerCodes.includes("policy_review_required")) return "policy_blocked";
  if (row.blockerCodes.includes("watchlist_materialization_required")) return "pending_watchlist";
  return "inspect_required";
}

function sourcePackFixtureHealthDrilldownFailure(
  row: TiSourceProvenanceSourcePackFixtureAlertDedupeRow,
  activationState: TiSourceProvenanceSourcePackFixtureHealthDrilldownActivationState
): TiSourceProvenanceSourcePackFixtureHealthDrilldownRow["failure"] {
  const code = row.blockerCodes.find((blockerCode) => blockerCode !== "not_alert_ready") ?? row.blockerCodes[0] ?? "none";
  if (activationState === "active") {
    return {
      code: "none",
      ownerLane: "alert",
      reason: "Source fixture is canonical, alert-ready, and backed by provenance IDs.",
      nextAction: "queue_alert_rebuild"
    };
  }
  if (activationState === "suppressed_duplicate") {
    return {
      code,
      ownerLane: "source",
      reason: "Duplicate fixture capture is held so alert rebuilds only consume the canonical row.",
      nextAction: "suppress_duplicate"
    };
  }
  if (activationState === "retry_scheduled") {
    return {
      code,
      ownerLane: "parser",
      reason: "Parser retry/backoff must complete before this source can produce alert-ready evidence.",
      nextAction: "retry_parser"
    };
  }
  if (activationState === "policy_blocked") {
    return {
      code,
      ownerLane: "policy",
      reason: "Policy review is required before this source can move beyond safe metadata.",
      nextAction: "request_policy_review"
    };
  }
  if (activationState === "pending_watchlist") {
    return {
      code,
      ownerLane: "org",
      reason: "Watchlist terms or alertable fields are not yet materialized for this enrichment row.",
      nextAction: "materialize_watchlist_terms"
    };
  }
  return {
    code,
    ownerLane: "source",
    reason: "Source health or provenance needs inspection before activation changes.",
    nextAction: "inspect_source_health"
  };
}

function sourcePackFixtureHealthDrilldownFilters(
  rows: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter[] {
  return [
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "actor", (row) => [row.actor]),
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "source_family", (row) => [row.sourceFamily]),
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "parser_status", (row) => [row.parserStatus]),
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "health_state", (row) => [row.healthState]),
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "activation_state", (row) => [row.activationState]),
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "failure_code", (row) => [row.failure.code]),
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "retry_window", (row) => row.retry.nextRetryAt ? ["retry_scheduled"] : []),
    ...sourcePackFixtureHealthDrilldownFiltersForKind(rows, "alert_eligibility", (row) => [row.alertEligibility])
  ];
}

function sourcePackFixtureHealthDrilldownFiltersForKind(
  rows: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[],
  kind: TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter["kind"],
  valueForRow: (row: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow) => string[]
): TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter[] {
  const grouped = new Map<string, TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[]>();
  for (const row of rows) {
    for (const value of valueForRow(row)) {
      const current = grouped.get(value) ?? [];
      current.push(row);
      grouped.set(value, current);
    }
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, groupedRows]) => sourcePackFixtureHealthDrilldownFilter(kind, value, groupedRows));
}

function sourcePackFixtureHealthDrilldownFilter(
  kind: TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter["kind"],
  value: string,
  rows: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter {
  return {
    filterId: stableId("ti_source_provenance_source_pack_fixture_health_drilldown_filter", `${kind}:${value}:${rows.map((row) => row.drilldownRowId).join(",")}`),
    kind,
    value,
    count: rows.length,
    readyCount: rows.filter((row) => row.alertEligibility === "ready").length,
    heldCount: rows.filter((row) => row.alertEligibility === "held").length,
    operatorAction: sourcePackFixtureHealthDrilldownFilterAction(kind, value, rows)
  };
}

function sourcePackFixtureHealthDrilldownFilterAction(
  kind: TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter["kind"],
  value: string,
  rows: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureHealthDrilldownFilter["operatorAction"] {
  const hasRetry = rows.some((row) => row.activationState === "retry_scheduled");
  const hasPolicy = rows.some((row) => row.activationState === "policy_blocked");
  const hasDuplicate = rows.some((row) => row.activationState === "suppressed_duplicate");
  const allReady = rows.every((row) => row.alertEligibility === "ready");
  const baseBody = {
    filterKind: kind,
    filterValue: value,
    dryRun: true
  };
  if (hasRetry) {
    return {
      action: "retry_parser",
      ownerLane: "parser",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: { ...baseBody, action: "retry_parser" },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (hasPolicy) {
    return {
      action: "request_policy_review",
      ownerLane: "policy",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: { ...baseBody, action: "request_policy_review" },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (hasDuplicate) {
    return {
      action: "suppress_duplicate",
      ownerLane: "source",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: { ...baseBody, action: "suppress_duplicate" },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (allReady) {
    return {
      action: "queue_alert_rebuild",
      ownerLane: "alert",
      route: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: { ...baseBody, canonicalOnly: true },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  return {
    action: "inspect",
    ownerLane: "sourceOps",
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { ...baseBody, includeFixtureHealthDrilldown: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourcePackFixtureHealthDrilldownConsumers(
  rows: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureHealthDrilldownPacket["consumers"] {
  const hasRows = rows.length > 0;
  const hasReadyRows = rows.some((row) => row.alertEligibility === "ready");
  const hasActions = rows.some((row) => row.activationState !== "active");
  return [{
    consumer: "publicTI",
    ready: hasRows,
    requiredFields: ["rows[].actor", "rows[].publicTiRoute", "rows[].sourceFamily", "rows[].failure", "summary"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasReadyRows,
    requiredFields: ["rows[].alertEligibility", "rows[].provenance", "rows[].downstreamRoutes", "summary.alertReadyRows"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeFixtureHealthDrilldown: true,
        canonicalOnly: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["rows[].activationState", "rows[].retry", "rows[].failure", "filters[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeFixtureHealthDrilldown: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: hasActions,
    requiredFields: ["rows[].activationState", "rows[].retry", "rows[].failure.nextAction", "filters[].operatorAction"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeOperatorFilters: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "sourcePackFixtureAlertDedupePacketId", "safeOutput", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationFixtureHealthDrilldown: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureIntelligenceRows(
  packet: TiSourceProvenanceSourcePackFixtureHealthDrilldownPacket
): TiSourceProvenanceSourcePackFixtureIntelligenceActorRow[] {
  const byActor = new Map<string, TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[]>();
  for (const row of packet.rows) {
    const current = byActor.get(row.actor) ?? [];
    current.push(row);
    byActor.set(row.actor, current);
  }
  return [...byActor.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([actor, rows]) => sourcePackFixtureIntelligenceActorRow(packet, actor, rows));
}

function sourcePackFixtureIntelligenceActorRow(
  packet: TiSourceProvenanceSourcePackFixtureHealthDrilldownPacket,
  actor: string,
  rows: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureIntelligenceActorRow {
  const activeRows = rows.filter((row) => row.activationState === "active");
  const gaps = rows
    .filter((row) => row.failure.code !== "none")
    .map(sourcePackFixtureIntelligenceGap);
  const coverageState: TiSourceProvenanceSourcePackFixtureIntelligenceActorRow["coverageState"] = activeRows.length === 0
    ? "blocked"
    : gaps.length > 0
      ? "partial"
      : "ready";
  const sourceFamilies = uniqueStrings(rows.map((row) => row.sourceFamily)) as TiSourceProvenanceActorProfileGapSourceCandidate["family"][];
  const activeConfidence = activeRows.length > 0 ? activeRows.reduce((sum, row) => sum + row.confidence, 0) / activeRows.length : 0;
  const representativeRow = activeRows[0] ?? rows[0];
  return {
    actor,
    publicTiRoute: representativeRow?.publicTiRoute ?? `/ti/${encodeURIComponent(actor)}`,
    coverageState,
    aliases: sourcePackFixtureIntelligenceAliases(actor),
    sourceFamilies,
    confidence: Number(activeConfidence.toFixed(2)),
    freshness: {
      state: activeRows.length > 0 ? "fresh" : rows.some((row) => row.retry.nextRetryAt) ? "stale" : "missing",
      newestObservedAt: newestTimestamp(rows.map((row) => row.observedAt)),
      nextRetryAt: earliestTimestamp(rows.map((row) => row.retry.nextRetryAt))
    },
    indicators: activeRows.flatMap((row) => sourcePackFixtureIntelligenceIndicators(actor, row)),
    ttps: activeRows.flatMap((row) => sourcePackFixtureIntelligenceTtps(actor, row)),
    gaps,
    downstreamRoutes: representativeRow?.downstreamRoutes ?? {
      publicTI: `/ti/${encodeURIComponent(actor)}`,
      alertGeneration: "/v1/dwm/alerts/rebuild",
      sourceOps: "/v1/dwm/source-requests"
    },
    provenance: {
      sourcePackFixtureHealthDrilldownPacketId: packet.id,
      drilldownRowIds: rows.map((row) => row.drilldownRowId),
      captureIds: uniqueStrings(rows.map((row) => row.provenance.captureId)),
      contentHashes: uniqueStrings(rows.map((row) => row.provenance.contentHash)),
      fixtureBacked: true
    }
  };
}

function sourcePackFixtureIntelligenceAliases(actor: string): string[] {
  if (actor.toLowerCase() === "apt29") return ["APT29", "Nobelium", "Cozy Bear"];
  if (actor.toLowerCase() === "akira") return ["Akira"];
  return [actor];
}

function sourcePackFixtureIntelligenceIndicators(
  actor: string,
  row: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow
): TiSourceProvenanceSourcePackFixtureIntelligenceIndicator[] {
  const actorKey = actor.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "actor";
  const values = actor.toLowerCase() === "apt29"
    ? [{
      type: "infrastructure" as const,
      value: "apt29-c2.example.invalid"
    }, {
      type: "watchlist_term" as const,
      value: "nobelium-watchlist.example.invalid"
    }]
    : actor.toLowerCase() === "akira"
      ? [{
        type: "domain" as const,
        value: "akira-leaksite.example.invalid"
      }, {
        type: "watchlist_term" as const,
        value: "akira-ransom-note.example.invalid"
      }]
      : [{
        type: "watchlist_term" as const,
        value: `${actorKey}.example.invalid`
      }];
  return values.map((indicator) => ({
    ...indicator,
    sourceFamily: row.sourceFamily,
    confidence: row.confidence,
    provenanceId: row.provenance.captureId,
    fixtureBacked: true
  }));
}

function sourcePackFixtureIntelligenceTtps(
  actor: string,
  row: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow
): TiSourceProvenanceSourcePackFixtureIntelligenceTtp[] {
  const values = actor.toLowerCase() === "apt29"
    ? [{
      techniqueId: "T1566",
      name: "Phishing"
    }, {
      techniqueId: "T1090",
      name: "Proxy"
    }]
    : actor.toLowerCase() === "akira"
      ? [{
        techniqueId: "T1486",
        name: "Data Encrypted for Impact"
      }, {
        techniqueId: "T1490",
        name: "Inhibit System Recovery"
      }]
      : [{
        techniqueId: "T1589",
        name: "Gather Victim Identity Information"
      }];
  return values.map((ttp) => ({
    ...ttp,
    sourceFamily: row.sourceFamily,
    confidence: row.confidence,
    provenanceId: row.provenance.sourceHealthProofId,
    fixtureBacked: true
  }));
}

function sourcePackFixtureIntelligenceGap(
  row: TiSourceProvenanceSourcePackFixtureHealthDrilldownRow
): TiSourceProvenanceSourcePackFixtureIntelligenceGap {
  return {
    code: row.failure.code,
    ownerLane: row.failure.ownerLane,
    sourceFamily: row.sourceFamily,
    reason: row.failure.reason,
    nextAction: row.failure.nextAction,
    route: {
      method: row.failure.nextAction === "queue_alert_rebuild" ? "POST" : row.failure.nextAction === "inspect_source_health" ? "GET" : "POST",
      path: row.failure.nextAction === "queue_alert_rebuild" ? row.downstreamRoutes.alertGeneration : "/v1/dwm/source-requests",
      body: {
        actor: row.actor,
        sourceFamily: row.sourceFamily,
        activationState: row.activationState,
        action: row.failure.nextAction,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourcePackFixtureIntelligenceConsumers(
  actorRows: TiSourceProvenanceSourcePackFixtureIntelligenceActorRow[]
): TiSourceProvenanceSourcePackFixtureIntelligencePacket["consumers"] {
  const hasRows = actorRows.length > 0;
  const hasIndicators = actorRows.some((row) => row.indicators.length > 0);
  const hasGaps = actorRows.some((row) => row.gaps.length > 0);
  return [{
    consumer: "publicTI",
    ready: hasRows,
    requiredFields: ["actorRows[].aliases", "actorRows[].indicators", "actorRows[].ttps", "actorRows[].freshness", "actorRows[].provenance"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasIndicators,
    requiredFields: ["actorRows[].indicators", "actorRows[].confidence", "actorRows[].gaps", "actorRows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeFixtureIntelligence: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["actorRows[].coverageState", "actorRows[].sourceFamilies", "actorRows[].gaps", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeFixtureIntelligence: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: hasGaps,
    requiredFields: ["actorRows[].gaps[].nextAction", "actorRows[].gaps[].route", "actorRows[].freshness.nextRetryAt"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeFixtureIntelligenceGaps: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "sourcePackFixtureHealthDrilldownPacketId", "safeOutput", "actorRows[].provenance"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationFixtureIntelligence: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureOperatorRemediationActions(
  packet: TiSourceProvenanceSourcePackFixtureIntelligencePacket
): TiSourceProvenanceSourcePackFixtureOperatorRemediationAction[] {
  const actions = new Map<string, TiSourceProvenanceSourcePackFixtureOperatorRemediationAction>();
  for (const actorRow of packet.actorRows) {
    for (const gap of actorRow.gaps) {
      if (gap.nextAction === "queue_alert_rebuild" || gap.nextAction === "suppress_duplicate") continue;
      const key = `${actorRow.actor}:${gap.sourceFamily ?? ""}:${gap.code}:${gap.nextAction}`;
      const existing = actions.get(key);
      const action = sourcePackFixtureOperatorRemediationAction(packet, actorRow, gap);
      if (!existing) {
        actions.set(key, action);
        continue;
      }
      actions.set(key, {
        ...existing,
        provenance: {
          ...existing.provenance,
          captureIds: uniqueStrings([...existing.provenance.captureIds, ...action.provenance.captureIds]),
          contentHashes: uniqueStrings([...existing.provenance.contentHashes, ...action.provenance.contentHashes])
        }
      });
    }
  }
  return [...actions.values()].sort((a, b) => sourcePackFixtureOperatorRemediationPriorityRank(a.priority) - sourcePackFixtureOperatorRemediationPriorityRank(b.priority) || a.actor.localeCompare(b.actor));
}

function sourcePackFixtureOperatorRemediationAction(
  packet: TiSourceProvenanceSourcePackFixtureIntelligencePacket,
  actorRow: TiSourceProvenanceSourcePackFixtureIntelligenceActorRow,
  gap: TiSourceProvenanceSourcePackFixtureIntelligenceGap
): TiSourceProvenanceSourcePackFixtureOperatorRemediationAction {
  const action = sourcePackFixtureOperatorRemediationActionName(gap.nextAction);
  const priority = sourcePackFixtureOperatorRemediationPriority(gap.code, action);
  return {
    actionId: stableId("ti_source_provenance_source_pack_fixture_operator_remediation_action", `${packet.id}:${actorRow.actor}:${gap.sourceFamily ?? ""}:${gap.code}:${action}`),
    actor: actorRow.actor,
    publicTiRoute: actorRow.publicTiRoute,
    action,
    ownerLane: gap.ownerLane === "alert" ? "source" : gap.ownerLane,
    sourceFamily: gap.sourceFamily,
    gapCode: gap.code,
    priority,
    reason: gap.reason,
    retry: {
      retryable: action === "retry_parser",
      nextRetryAt: action === "retry_parser" ? actorRow.freshness.nextRetryAt : undefined
    },
    route: gap.route,
    provenance: {
      sourcePackFixtureIntelligencePacketId: packet.id,
      captureIds: actorRow.provenance.captureIds,
      contentHashes: actorRow.provenance.contentHashes,
      fixtureBacked: true
    }
  };
}

function sourcePackFixtureOperatorRemediationActionName(
  nextAction: TiSourceProvenanceSourcePackFixtureIntelligenceGap["nextAction"]
): TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["action"] {
  if (nextAction === "retry_parser") return "retry_parser";
  if (nextAction === "request_policy_review") return "request_policy_review";
  if (nextAction === "materialize_watchlist_terms") return "materialize_watchlist_terms";
  return "inspect_source_health";
}

function sourcePackFixtureOperatorRemediationPriority(
  code: TiSourceProvenanceSourcePackFixtureIntelligenceGap["code"],
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["action"]
): TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["priority"] {
  if (action === "request_policy_review" || code === "policy_review_required") return "high";
  if (action === "retry_parser" || code === "parser_retry_required") return "high";
  if (action === "materialize_watchlist_terms") return "medium";
  return "low";
}

function sourcePackFixtureOperatorRemediationPriorityRank(
  priority: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction["priority"]
): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function sourcePackFixtureOperatorRemediationConsumers(
  actions: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction[]
): TiSourceProvenanceSourcePackFixtureOperatorRemediationPacket["consumers"] {
  const hasActions = actions.length > 0;
  return [{
    consumer: "dashboard",
    ready: hasActions,
    requiredFields: ["actions[].actor", "actions[].action", "actions[].priority", "actions[].route", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeFixtureOperatorRemediation: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: hasActions,
    requiredFields: ["actions[].ownerLane", "actions[].retry", "actions[].provenance", "actions[].gapCode"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeSourceOpsRemediationQueue: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "support",
    ready: hasActions,
    requiredFields: ["actions[].publicTiRoute", "actions[].reason", "actions[].route", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeSupportRemediationQueue: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasActions,
    requiredFields: ["schemaVersion", "sourcePackFixtureIntelligencePacketId", "actions[].actionId", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationFixtureOperatorRemediation: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureActionExecutionRow(
  packet: TiSourceProvenanceSourcePackFixtureOperatorRemediationPacket,
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction
): TiSourceProvenanceSourcePackFixtureActionExecutionRow {
  const executionState = sourcePackFixtureActionExecutionState(action);
  return {
    rowId: stableId("ti_source_provenance_source_pack_fixture_action_execution_row", `${packet.id}:${action.actionId}:${executionState}`),
    actionId: action.actionId,
    actor: action.actor,
    publicTiRoute: action.publicTiRoute,
    sourceFamily: action.sourceFamily,
    action: action.action,
    executionState,
    ownerLane: action.ownerLane,
    priority: action.priority,
    canExecuteDryRun: action.route.dryRunSupported && action.route.liveNetworkFetch === false,
    typedFailureReason: sourcePackFixtureActionExecutionFailure(action, executionState),
    retry: action.retry,
    downstreamReadiness: sourcePackFixtureActionExecutionDownstreamReadiness(action, executionState),
    route: action.route,
    provenance: {
      ...action.provenance,
      sourcePackFixtureOperatorRemediationPacketId: packet.id
    }
  };
}

function sourcePackFixtureActionExecutionState(
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction
): TiSourceProvenanceSourcePackFixtureActionExecutionRow["executionState"] {
  if (action.action === "retry_parser") return "retry_waiting";
  if (action.action === "request_policy_review") return "policy_review_required";
  if (action.action === "inspect_source_health") return "inspection_required";
  return "ready";
}

function sourcePackFixtureActionExecutionFailure(
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction,
  executionState: TiSourceProvenanceSourcePackFixtureActionExecutionRow["executionState"]
): TiSourceProvenanceSourcePackFixtureActionExecutionRow["typedFailureReason"] {
  if (executionState === "ready") return undefined;
  if (executionState === "retry_waiting") {
    return {
      code: "retry_window_pending",
      ownerLane: "parser",
      field: "retry.nextRetryAt",
      reason: action.retry.nextRetryAt ? "Parser retry is scheduled and must complete before this source can produce fresh alertable enrichment." : "Parser retry is required before this source can produce fresh alertable enrichment.",
      nextAction: action.action
    };
  }
  if (executionState === "policy_review_required") {
    return {
      code: "policy_review_required",
      ownerLane: "policy",
      field: "sourceFamily",
      reason: "Policy review is required before restricted metadata can be promoted beyond safe source-pack metadata.",
      nextAction: action.action
    };
  }
  return {
    code: "source_health_inspection_required",
    ownerLane: "source",
    field: "route.body",
    reason: "Source health inspection is required before this row can be treated as current coverage.",
    nextAction: action.action
  };
}

function sourcePackFixtureActionExecutionDownstreamReadiness(
  action: TiSourceProvenanceSourcePackFixtureOperatorRemediationAction,
  executionState: TiSourceProvenanceSourcePackFixtureActionExecutionRow["executionState"]
): TiSourceProvenanceSourcePackFixtureActionExecutionRow["downstreamReadiness"] {
  const ready = executionState === "ready";
  return {
    publicTI: ready || action.action === "inspect_source_health",
    alertGeneration: ready,
    dashboard: true,
    sourceOps: true,
    support: true
  };
}

function sourcePackFixtureActionExecutionConsumers(
  rows: TiSourceProvenanceSourcePackFixtureActionExecutionRow[]
): TiSourceProvenanceSourcePackFixtureActionExecutionPacket["consumers"] {
  const hasRows = rows.length > 0;
  const hasAlertReadyRows = rows.some((row) => row.downstreamReadiness.alertGeneration);
  return [{
    consumer: "publicTI",
    ready: rows.some((row) => row.downstreamReadiness.publicTI),
    requiredFields: ["rows[].actor", "rows[].publicTiRoute", "rows[].sourceFamily", "rows[].executionState", "rows[].typedFailureReason"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionExecution: true, consumer: "publicTI", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasAlertReadyRows,
    requiredFields: ["rows[].actor", "rows[].action", "rows[].downstreamReadiness", "rows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionExecution: true, consumer: "alertGeneration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["summary", "rows[].priority", "rows[].route", "rows[].typedFailureReason"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionExecution: true, consumer: "dashboard", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: hasRows,
    requiredFields: ["rows[].ownerLane", "rows[].canExecuteDryRun", "rows[].retry", "rows[].route"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionExecution: true, consumer: "sourceOps", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "support",
    ready: hasRows,
    requiredFields: ["rows[].publicTiRoute", "rows[].typedFailureReason", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionExecution: true, consumer: "support", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "sourcePackFixtureOperatorRemediationPacketId", "rows[].rowId", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionExecution: true, consumer: "integration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureActionAuditEvent(
  packet: TiSourceProvenanceSourcePackFixtureActionExecutionPacket,
  row: TiSourceProvenanceSourcePackFixtureActionExecutionRow,
  occurredAt: string
): TiSourceProvenanceSourcePackFixtureActionAuditEvent {
  return {
    eventId: stableId("ti_source_provenance_source_pack_fixture_action_audit_event", `${packet.id}:${row.rowId}:${row.executionState}:${occurredAt}`),
    rowId: row.rowId,
    actionId: row.actionId,
    actor: row.actor,
    publicTiRoute: row.publicTiRoute,
    sourceFamily: row.sourceFamily,
    action: row.action,
    eventType: sourcePackFixtureActionAuditEventType(row.executionState),
    ownerLane: row.ownerLane,
    priority: row.priority,
    occurredAt,
    retry: row.retry,
    typedFailureReason: row.typedFailureReason,
    downstreamReadiness: row.downstreamReadiness,
    route: row.route,
    provenance: {
      ...row.provenance,
      sourcePackFixtureActionExecutionPacketId: packet.id
    }
  };
}

function sourcePackFixtureActionAuditEventType(
  executionState: TiSourceProvenanceSourcePackFixtureActionExecutionRow["executionState"]
): TiSourceProvenanceSourcePackFixtureActionAuditEvent["eventType"] {
  if (executionState === "ready") return "dry_run_ready";
  if (executionState === "retry_waiting") return "retry_waiting";
  if (executionState === "policy_review_required") return "policy_review_required";
  return "inspection_required";
}

function sourcePackFixtureActionAuditConsumers(
  events: TiSourceProvenanceSourcePackFixtureActionAuditEvent[]
): TiSourceProvenanceSourcePackFixtureActionAuditPacket["consumers"] {
  const hasEvents = events.length > 0;
  const alertReady = events.some((event) => event.downstreamReadiness.alertGeneration);
  const publicTiReady = events.some((event) => event.downstreamReadiness.publicTI);
  return [{
    consumer: "publicTI",
    ready: publicTiReady,
    requiredFields: ["events[].actor", "events[].publicTiRoute", "events[].eventType", "events[].typedFailureReason"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAudit: true, consumer: "publicTI", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: alertReady,
    requiredFields: ["events[].actor", "events[].sourceFamily", "events[].downstreamReadiness", "events[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAudit: true, consumer: "alertGeneration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasEvents,
    requiredFields: ["summary", "events[].eventType", "events[].priority", "events[].route"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAudit: true, consumer: "dashboard", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: hasEvents,
    requiredFields: ["events[].ownerLane", "events[].retry", "events[].typedFailureReason", "events[].route"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAudit: true, consumer: "sourceOps", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "support",
    ready: hasEvents,
    requiredFields: ["events[].publicTiRoute", "events[].typedFailureReason", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAudit: true, consumer: "support", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasEvents,
    requiredFields: ["schemaVersion", "sourcePackFixtureActionExecutionPacketId", "events[].eventId", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAudit: true, consumer: "integration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureActionDrilldownRow(
  packet: TiSourceProvenanceSourcePackFixtureActionAuditPacket,
  event: TiSourceProvenanceSourcePackFixtureActionAuditEvent
): TiSourceProvenanceSourcePackFixtureActionDrilldownRow {
  return {
    rowId: stableId("ti_source_provenance_source_pack_fixture_action_drilldown_row", `${packet.id}:${event.eventId}:${event.eventType}`),
    eventId: event.eventId,
    actor: event.actor,
    publicTiRoute: event.publicTiRoute,
    sourceFamily: event.sourceFamily,
    ownerLane: event.ownerLane,
    action: event.action,
    priority: event.priority,
    parserState: sourcePackFixtureActionDrilldownParserState(event),
    healthState: sourcePackFixtureActionDrilldownHealthState(event),
    activationState: sourcePackFixtureActionDrilldownActivationState(event),
    affectedConsumers: sourcePackFixtureActionDrilldownAffectedConsumers(event),
    retry: event.retry,
    failure: event.typedFailureReason ? {
      code: event.typedFailureReason.code,
      ownerLane: event.typedFailureReason.ownerLane,
      field: event.typedFailureReason.field,
      reason: event.typedFailureReason.reason,
      nextAction: event.typedFailureReason.nextAction
    } : undefined,
    route: event.route,
    provenance: {
      ...event.provenance,
      sourcePackFixtureActionAuditPacketId: packet.id
    }
  };
}

function sourcePackFixtureActionDrilldownParserState(
  event: TiSourceProvenanceSourcePackFixtureActionAuditEvent
): TiSourceProvenanceSourcePackFixtureActionDrilldownRow["parserState"] {
  if (event.eventType === "retry_waiting") return "retry_scheduled";
  if (event.eventType === "policy_review_required") return "policy_blocked";
  if (event.eventType === "inspection_required") return "inspection_required";
  return "healthy";
}

function sourcePackFixtureActionDrilldownHealthState(
  event: TiSourceProvenanceSourcePackFixtureActionAuditEvent
): TiSourceProvenanceSourcePackFixtureActionDrilldownRow["healthState"] {
  if (event.eventType === "dry_run_ready") return "active";
  if (event.eventType === "retry_waiting" || event.eventType === "inspection_required") return "degraded";
  return "blocked";
}

function sourcePackFixtureActionDrilldownActivationState(
  event: TiSourceProvenanceSourcePackFixtureActionAuditEvent
): TiSourceProvenanceSourcePackFixtureActionDrilldownRow["activationState"] {
  if (event.eventType === "dry_run_ready") return "ready";
  if (event.eventType === "retry_waiting") return "retry_waiting";
  if (event.eventType === "policy_review_required") return "policy_review_required";
  return "inspect_required";
}

function sourcePackFixtureActionDrilldownAffectedConsumers(
  event: TiSourceProvenanceSourcePackFixtureActionAuditEvent
): TiSourceProvenanceSourcePackFixtureActionDrilldownRow["affectedConsumers"] {
  const consumers: TiSourceProvenanceSourcePackFixtureActionDrilldownRow["affectedConsumers"] = ["dashboard", "sourceOps", "support"];
  if (event.downstreamReadiness.publicTI) consumers.push("publicTI");
  if (event.downstreamReadiness.alertGeneration) consumers.push("alertGeneration");
  return consumers;
}

function sourcePackFixtureActionDrilldownFilters(
  rows: TiSourceProvenanceSourcePackFixtureActionDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureActionDrilldownFilter[] {
  return [
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "actor", (row) => [row.actor]),
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "source_family", (row) => row.sourceFamily ? [row.sourceFamily] : []),
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "parser_state", (row) => [row.parserState]),
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "health_state", (row) => [row.healthState]),
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "activation_state", (row) => [row.activationState]),
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "failure_code", (row) => row.failure ? [row.failure.code] : []),
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "affected_consumer", (row) => row.affectedConsumers),
    ...sourcePackFixtureActionDrilldownFiltersForKind(rows, "owner_lane", (row) => [row.ownerLane])
  ];
}

function sourcePackFixtureActionDrilldownFiltersForKind(
  rows: TiSourceProvenanceSourcePackFixtureActionDrilldownRow[],
  kind: TiSourceProvenanceSourcePackFixtureActionDrilldownFilter["kind"],
  valueForRow: (row: TiSourceProvenanceSourcePackFixtureActionDrilldownRow) => string[]
): TiSourceProvenanceSourcePackFixtureActionDrilldownFilter[] {
  const grouped = new Map<string, TiSourceProvenanceSourcePackFixtureActionDrilldownRow[]>();
  for (const row of rows) {
    for (const value of valueForRow(row)) {
      const current = grouped.get(value) ?? [];
      current.push(row);
      grouped.set(value, current);
    }
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, groupedRows]) => sourcePackFixtureActionDrilldownFilter(kind, value, groupedRows));
}

function sourcePackFixtureActionDrilldownFilter(
  kind: TiSourceProvenanceSourcePackFixtureActionDrilldownFilter["kind"],
  value: string,
  rows: TiSourceProvenanceSourcePackFixtureActionDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureActionDrilldownFilter {
  return {
    kind,
    value,
    count: rows.length,
    operatorAction: sourcePackFixtureActionDrilldownFilterAction(kind, value, rows)
  };
}

function sourcePackFixtureActionDrilldownFilterAction(
  kind: TiSourceProvenanceSourcePackFixtureActionDrilldownFilter["kind"],
  value: string,
  rows: TiSourceProvenanceSourcePackFixtureActionDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureActionDrilldownFilter["operatorAction"] {
  const first = rows[0];
  const action = kind === "failure_code" && value === "retry_window_pending"
    ? "retry_parser"
    : kind === "failure_code" && value === "policy_review_required"
      ? "request_policy_review"
      : kind === "failure_code" && value === "source_health_inspection_required"
        ? "inspect_source_health"
        : first?.activationState === "ready"
          ? "materialize_watchlist_terms"
          : "review_group";
  return {
    action,
    route: {
      method: action === "review_group" ? "GET" : "POST",
      path: "/v1/dwm/source-requests",
      body: {
        filterKind: kind,
        filterValue: value,
        action,
        sourceFamilies: uniqueStrings(rows.flatMap((row) => row.sourceFamily ? [row.sourceFamily] : [])),
        actors: uniqueStrings(rows.map((row) => row.actor)),
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourcePackFixtureActionDrilldownConsumers(
  rows: TiSourceProvenanceSourcePackFixtureActionDrilldownRow[]
): TiSourceProvenanceSourcePackFixtureActionDrilldownPacket["consumers"] {
  const hasRows = rows.length > 0;
  const alertReady = rows.some((row) => row.affectedConsumers.includes("alertGeneration"));
  const publicTiReady = rows.some((row) => row.affectedConsumers.includes("publicTI"));
  return [{
    consumer: "publicTI",
    ready: publicTiReady,
    requiredFields: ["drilldownRows[].actor", "drilldownRows[].publicTiRoute", "drilldownRows[].healthState", "drilldownRows[].failure"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionDrilldown: true, consumer: "publicTI", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: alertReady,
    requiredFields: ["drilldownRows[].sourceFamily", "drilldownRows[].activationState", "drilldownRows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionDrilldown: true, consumer: "alertGeneration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["filters", "summary", "drilldownRows[].parserState", "drilldownRows[].healthState"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionDrilldown: true, consumer: "dashboard", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: hasRows,
    requiredFields: ["filters[].operatorAction", "drilldownRows[].retry", "drilldownRows[].route"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionDrilldown: true, consumer: "sourceOps", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "support",
    ready: hasRows,
    requiredFields: ["drilldownRows[].publicTiRoute", "drilldownRows[].failure", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionDrilldown: true, consumer: "support", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "sourcePackFixtureActionAuditPacketId", "drilldownRows[].rowId", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionDrilldown: true, consumer: "integration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureActionAlertBridgeRow(
  packet: TiSourceProvenanceSourcePackFixtureActionDrilldownPacket,
  row: TiSourceProvenanceSourcePackFixtureActionDrilldownRow
): TiSourceProvenanceSourcePackFixtureActionAlertBridgeRow {
  const alertReady = row.affectedConsumers.includes("alertGeneration");
  const publicTiReady = row.affectedConsumers.includes("publicTI");
  return {
    rowId: stableId("ti_source_provenance_source_pack_fixture_action_alert_bridge_row", `${packet.id}:${row.rowId}:${row.activationState}`),
    actor: row.actor,
    publicTiRoute: row.publicTiRoute,
    sourceFamily: row.sourceFamily,
    coverageState: sourcePackFixtureActionAlertBridgeCoverageState(row),
    alertReadiness: alertReady ? "ready" : "blocked",
    publicTiReadiness: publicTiReady ? "ready" : "blocked",
    matchableFields: sourcePackFixtureActionAlertBridgeMatchableFields(row),
    freshness: {
      state: row.healthState === "active" ? "fresh" : "stale",
      nextRetryAt: row.retry.nextRetryAt
    },
    missingPrerequisites: sourcePackFixtureActionAlertBridgePrerequisites(row),
    route: row.route,
    provenance: {
      ...row.provenance,
      sourcePackFixtureActionDrilldownPacketId: packet.id
    }
  };
}

function sourcePackFixtureActionAlertBridgeCoverageState(
  row: TiSourceProvenanceSourcePackFixtureActionDrilldownRow
): TiSourceProvenanceSourcePackFixtureActionAlertBridgeRow["coverageState"] {
  if (row.affectedConsumers.includes("alertGeneration")) return "alert_ready";
  if (row.healthState === "blocked") return "blocked";
  if (row.affectedConsumers.includes("publicTI")) return "public_ti_only";
  return "degraded";
}

function sourcePackFixtureActionAlertBridgeMatchableFields(
  row: TiSourceProvenanceSourcePackFixtureActionDrilldownRow
): string[] {
  const fields = ["actor", "source_family", "public_ti_route", "provenance_hash"];
  if (row.affectedConsumers.includes("alertGeneration")) fields.push("watchlist_term", "indicator", "ttp");
  if (row.affectedConsumers.includes("publicTI")) fields.push("actor_alias", "source_freshness");
  return uniqueStrings(fields);
}

function sourcePackFixtureActionAlertBridgePrerequisites(
  row: TiSourceProvenanceSourcePackFixtureActionDrilldownRow
): TiSourceProvenanceSourcePackFixtureActionAlertBridgePrerequisite[] {
  const prerequisites: TiSourceProvenanceSourcePackFixtureActionAlertBridgePrerequisite[] = [];
  if (row.failure) {
    prerequisites.push({
      code: row.failure.code,
      ownerLane: row.failure.ownerLane,
      field: row.failure.field,
      reason: row.failure.reason,
      nextAction: row.failure.nextAction
    });
  }
  if (!row.affectedConsumers.includes("alertGeneration")) {
    prerequisites.push({
      code: "source_not_alert_ready",
      ownerLane: "alert",
      field: "affectedConsumers",
      reason: "Source coverage is not yet eligible for alert generation.",
      nextAction: "queue_alert_rebuild"
    });
  }
  return prerequisites;
}

function sourcePackFixtureActionAlertBridgeConsumers(
  rows: TiSourceProvenanceSourcePackFixtureActionAlertBridgeRow[]
): TiSourceProvenanceSourcePackFixtureActionAlertBridgePacket["consumers"] {
  const hasRows = rows.length > 0;
  const alertReady = rows.some((row) => row.alertReadiness === "ready");
  const publicTiReady = rows.some((row) => row.publicTiReadiness === "ready");
  return [{
    consumer: "publicTI",
    ready: publicTiReady,
    requiredFields: ["rows[].actor", "rows[].publicTiRoute", "rows[].coverageState", "rows[].freshness", "rows[].missingPrerequisites"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAlertBridge: true, consumer: "publicTI", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: alertReady,
    requiredFields: ["rows[].sourceFamily", "rows[].alertReadiness", "rows[].matchableFields", "rows[].provenance"],
    route: {
      method: "POST",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAlertBridge: true, consumer: "alertGeneration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["summary", "rows[].coverageState", "rows[].missingPrerequisites"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAlertBridge: true, consumer: "dashboard", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: hasRows,
    requiredFields: ["rows[].freshness", "rows[].route", "rows[].missingPrerequisites"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAlertBridge: true, consumer: "sourceOps", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "support",
    ready: hasRows,
    requiredFields: ["rows[].publicTiRoute", "rows[].missingPrerequisites", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAlertBridge: true, consumer: "support", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "sourcePackFixtureActionDrilldownPacketId", "rows[].rowId", "safeOutput"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: { includeFixtureActionAlertBridge: true, consumer: "integration", dryRun: true },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureReadinessRow(
  row: TiSourceProvenanceSourcePackFixtureGrowthRow
): TiSourceProvenanceSourcePackFixtureReadinessRow {
  const readyFor: TiSourceProvenanceSourcePackFixtureReadinessRow["readyFor"] = ["dashboard", "sourceOps", "integration"];
  if (row.rowType === "actor_enrichment_update") readyFor.push("publicTI");
  if (row.rowType === "alert_ready_capture") readyFor.push("alertGeneration");
  return {
    rowId: row.rowId,
    sourceFamily: row.sourceFamily,
    parserStatus: row.parserStatus,
    healthState: row.healthState,
    freshnessState: row.freshness.state,
    retryable: row.retry.retryable,
    downstreamConsumerRoutes: row.downstreamRoutes,
    provenance: row.provenance,
    blockerReason: row.blockerReason,
    readyFor: uniqueStrings(readyFor) as TiSourceProvenanceSourcePackFixtureReadinessRow["readyFor"]
  };
}

function sourcePackFixtureReadinessBlockers(
  packet: TiSourceProvenanceSourcePackFixtureGrowthPacket
): TiSourceProvenanceSourcePackFixtureReadinessBlocker[] {
  const blockers = packet.rows.flatMap((row): TiSourceProvenanceSourcePackFixtureReadinessBlocker[] => {
    if (row.healthState === "stale") {
      return [{
        code: "parser_retry_scheduled",
        ownerLane: "parser",
        rowId: row.rowId,
        sourceFamily: row.sourceFamily,
        reason: row.blockerReason ?? "Parser retry is scheduled before this source can produce fresh enrichment.",
        nextAction: "retry_parser",
        nextRetryAt: row.retry.nextRetryAt,
        route: {
          method: "POST",
          path: row.downstreamRoutes.sourceOps,
          body: {
            action: "retry",
            candidateId: row.candidateId,
            dryRun: true
          },
          dryRunSupported: true,
          liveNetworkFetch: false
        }
      }];
    }
    if (row.healthState === "blocked") {
      return [{
        code: "policy_review_required",
        ownerLane: "policy",
        rowId: row.rowId,
        sourceFamily: row.sourceFamily,
        reason: row.blockerReason ?? "Policy review is required before this source can be activated.",
        nextAction: "request_policy_approval",
        route: {
          method: "POST",
          path: row.downstreamRoutes.sourceOps,
          body: {
            action: "request_approval",
            candidateId: row.candidateId,
            dryRun: true
          },
          dryRunSupported: true,
          liveNetworkFetch: false
        }
      }];
    }
    if (row.healthState === "degraded") {
      return [{
        code: "degraded_parser",
        ownerLane: "source",
        rowId: row.rowId,
        sourceFamily: row.sourceFamily,
        reason: "Fixture source can update actor coverage but is not alert-ready until parser health is complete.",
        nextAction: "inspect_source_health",
        route: {
          method: "GET",
          path: row.downstreamRoutes.sourceOps,
          body: {
            candidateId: row.candidateId,
            includeSourceHealth: true,
            dryRun: true
          },
          dryRunSupported: true,
          liveNetworkFetch: false
        }
      }];
    }
    return [];
  });
  if (packet.summary.alertReadyCaptures > 0) return blockers;
  return [...blockers, {
    code: "missing_alert_capture",
    ownerLane: "alert",
    reason: "No fixture capture is ready for alert generation.",
    nextAction: "queue_fixture_capture",
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: packet.actor,
        sourcePackFixtureGrowthPacketId: packet.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackFixtureReadinessConsumers(
  packet: TiSourceProvenanceSourcePackFixtureGrowthPacket,
  readiness: TiSourceProvenanceSourcePackFixtureReadinessExport["readiness"]
): TiSourceProvenanceSourcePackFixtureReadinessExport["consumers"] {
  return [{
    consumer: "publicTI",
    ready: readiness.publicTI,
    requiredFields: ["rows[].readyFor", "rows[].freshnessState", "rows[].provenance.contentHash"],
    route: {
      method: "GET",
      path: `/ti/${encodeURIComponent(packet.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: readiness.alertGeneration,
    requiredFields: ["rows[].readyFor", "rows[].provenance.captureId", "rows[].provenance.contentHash"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: packet.tenantId,
        organizationId: packet.organizationId,
        actor: packet.actor,
        sourcePackFixtureGrowthPacketId: packet.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: readiness.dashboard,
    requiredFields: ["readiness", "summary", "blockers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        actor: packet.actor,
        includeFixtureReadiness: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: readiness.sourceOps,
    requiredFields: ["blockers[].nextAction", "blockers[].route", "rows[].healthState"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackFixtureGrowthPacketId: packet.id,
        includeSourceActions: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: readiness.integration,
    requiredFields: ["schemaVersion", "safeOutput", "consumers[]", "rows[].provenance"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackFixtureGrowthPacketId: packet.id,
        includeIntegrationProof: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackRetryPolicyRows(
  readinessExport: TiSourceProvenanceSourcePackFixtureReadinessExport,
  row: TiSourceProvenanceSourcePackFixtureReadinessRow
): TiSourceProvenanceSourcePackRetryPolicyRow[] {
  const blocker = readinessExport.blockers.find((item) => item.rowId === row.rowId);
  if (row.readyFor.includes("alertGeneration")) {
    return [sourcePackRetryPolicyRow(readinessExport, row, blocker, "alert_ready")];
  }
  if (row.healthState === "healthy") return [];
  if (row.healthState === "stale") {
    return [sourcePackRetryPolicyRow(readinessExport, row, blocker, "retry_later")];
  }
  if (row.healthState === "blocked") {
    return [sourcePackRetryPolicyRow(readinessExport, row, blocker, "policy_review_required")];
  }
  return [sourcePackRetryPolicyRow(readinessExport, row, blocker, "inspect_only")];
}

function sourcePackRetryPolicyRow(
  readinessExport: TiSourceProvenanceSourcePackFixtureReadinessExport,
  row: TiSourceProvenanceSourcePackFixtureReadinessRow,
  blocker: TiSourceProvenanceSourcePackFixtureReadinessBlocker | undefined,
  retryState: TiSourceProvenanceSourcePackRetryPolicyRow["retryState"]
): TiSourceProvenanceSourcePackRetryPolicyRow {
  return {
    rowId: stableId("ti_source_provenance_source_pack_retry_policy_row", `${readinessExport.id}:${row.rowId}:${retryState}`),
    sourceFamily: row.sourceFamily,
    parserStatus: row.parserStatus,
    healthState: row.healthState,
    freshnessState: row.freshnessState,
    retryState,
    blockerCode: blocker?.code,
    blockerReason: blocker?.reason ?? row.blockerReason,
    nextRetryAt: blocker?.nextRetryAt,
    downstreamConsumerRoutes: row.downstreamConsumerRoutes,
    provenance: row.provenance,
    action: sourcePackRetryPolicyAction(row, blocker, retryState)
  };
}

function sourcePackRetryPolicyAction(
  row: TiSourceProvenanceSourcePackFixtureReadinessRow,
  blocker: TiSourceProvenanceSourcePackFixtureReadinessBlocker | undefined,
  retryState: TiSourceProvenanceSourcePackRetryPolicyRow["retryState"]
): TiSourceProvenanceSourcePackRetryPolicyRow["action"] {
  if (retryState === "alert_ready") {
    return {
      action: "queue_alert_rebuild",
      ownerLane: "alert",
      route: {
        method: "POST",
        path: row.downstreamConsumerRoutes.alertGeneration,
        body: {
          sourceHealthProofId: row.provenance.sourceHealthProofId,
          captureId: row.provenance.captureId,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (blocker) {
    return {
      action: blocker.nextAction === "request_policy_approval" ? "request_policy_approval" : blocker.nextAction === "retry_parser" ? "retry_parser" : "inspect_source_health",
      ownerLane: blocker.ownerLane === "alert" ? "alert" : blocker.ownerLane,
      route: blocker.route
    };
  }
  return {
    action: "inspect_source_health",
    ownerLane: "source",
    route: {
      method: "GET",
      path: row.downstreamConsumerRoutes.sourceOps,
      body: {
        sourceHealthProofId: row.provenance.sourceHealthProofId,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourcePackRetryPolicyConsumers(
  readinessExport: TiSourceProvenanceSourcePackFixtureReadinessExport,
  readiness: {
    sourceOps: boolean;
    dashboard: boolean;
    alertGeneration: boolean;
    integration: boolean;
  }
): TiSourceProvenanceSourcePackRetryPolicyPacket["consumers"] {
  return [{
    consumer: "sourceOps",
    ready: readiness.sourceOps,
    requiredFields: ["retryRows[].retryState", "retryRows[].action", "retryRows[].blockerCode"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackFixtureReadinessExportId: readinessExport.id,
        includeRetryPolicy: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: readiness.dashboard,
    requiredFields: ["summary", "retryRows[].healthState", "retryRows[].downstreamConsumerRoutes"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackFixtureReadinessExportId: readinessExport.id,
        includeReadinessSummary: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: readiness.alertGeneration,
    requiredFields: ["retryRows[].action.route", "retryRows[].provenance.captureId", "retryRows[].provenance.contentHash"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: readinessExport.actor,
        sourcePackFixtureReadinessExportId: readinessExport.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: readiness.integration,
    requiredFields: ["schemaVersion", "safeOutput", "summary", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackFixtureReadinessExportId: readinessExport.id,
        includeIntegrationProof: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourceCandidateValidationRow(
  packet: TiSourceProvenanceSourcePackRetryPolicyPacket,
  row: TiSourceProvenanceSourcePackRetryPolicyRow
): TiSourceProvenanceSourceCandidateValidationRow {
  const candidateState = sourceCandidateValidationState(row);
  return {
    validationId: stableId("ti_source_provenance_source_candidate_validation", `${packet.id}:${row.rowId}:${candidateState}`),
    retryPolicyRowId: row.rowId,
    candidateState,
    sourceFamily: row.sourceFamily,
    parserStatus: row.parserStatus,
    healthState: row.healthState,
    freshnessState: row.freshnessState,
    validation: {
      allowedForPublicTI: candidateState === "accepted" || candidateState === "inspect_only",
      allowedForAlertGeneration: row.retryState === "alert_ready",
      allowedForDashboard: true,
      allowedForIntegration: true,
      reason: sourceCandidateValidationReason(row, candidateState),
      blockerCode: row.blockerCode,
      nextRetryAt: row.nextRetryAt
    },
    downstreamRoutes: row.downstreamConsumerRoutes,
    provenance: row.provenance
  };
}

function sourceCandidateValidationState(
  row: TiSourceProvenanceSourcePackRetryPolicyRow
): TiSourceProvenanceSourceCandidateValidationRow["candidateState"] {
  if (row.retryState === "alert_ready") return "accepted";
  if (row.retryState === "retry_now" || row.retryState === "retry_later") return "retry_gated";
  if (row.retryState === "policy_review_required") return "policy_gated";
  return "inspect_only";
}

function sourceCandidateValidationReason(
  row: TiSourceProvenanceSourcePackRetryPolicyRow,
  state: TiSourceProvenanceSourceCandidateValidationRow["candidateState"]
): string {
  if (state === "accepted") return "Fixture capture is parser-ready, provenance-backed, and alert generation can consume it.";
  if (state === "retry_gated") return row.blockerReason ?? "Parser retry must complete before this source can produce fresh enrichment.";
  if (state === "policy_gated") return row.blockerReason ?? "Policy approval is required before this source can be activated.";
  return row.blockerReason ?? "Source can enrich public TI but needs parser health inspection before alert generation.";
}

function sourceCandidateValidationConsumers(
  packet: TiSourceProvenanceSourcePackRetryPolicyPacket,
  readiness: {
    publicTI: boolean;
    alertGeneration: boolean;
    dashboard: boolean;
    sourceOps: boolean;
    integration: boolean;
  }
): TiSourceProvenanceSourceCandidateValidationReceipt["consumers"] {
  return [{
    consumer: "publicTI",
    ready: readiness.publicTI,
    requiredFields: ["validations[].validation.allowedForPublicTI", "validations[].provenance.contentHash"],
    route: {
      method: "GET",
      path: `/ti/${encodeURIComponent(packet.actor)}`,
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: readiness.alertGeneration,
    requiredFields: ["validations[].validation.allowedForAlertGeneration", "validations[].provenance.captureId", "validations[].provenance.contentHash"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actor: packet.actor,
        sourcePackRetryPolicyPacketId: packet.id,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: readiness.dashboard,
    requiredFields: ["summary", "validations[].candidateState", "validations[].validation.reason"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackRetryPolicyPacketId: packet.id,
        includeValidationReceipt: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "sourceOps",
    ready: readiness.sourceOps,
    requiredFields: ["validations[].validation.blockerCode", "validations[].validation.nextRetryAt", "validations[].downstreamRoutes"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackRetryPolicyPacketId: packet.id,
        includeSourceActions: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: readiness.integration,
    requiredFields: ["schemaVersion", "safeOutput", "payloadShape", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        sourcePackRetryPolicyPacketId: packet.id,
        includeIntegrationProof: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function actorSourceCoveragePortfolioRow(
  receipt: TiSourceProvenanceSourceCandidateValidationReceipt
): TiSourceProvenanceActorSourceCoveragePortfolioRow {
  const publicTiRoute = `/ti/${encodeURIComponent(receipt.actor)}`;
  const publicTiConsumer = receipt.consumers.find((consumer) => consumer.consumer === "publicTI");
  const alertConsumer = receipt.consumers.find((consumer) => consumer.consumer === "alertGeneration");
  const dashboardConsumer = receipt.consumers.find((consumer) => consumer.consumer === "dashboard");
  const integrationConsumer = receipt.consumers.find((consumer) => consumer.consumer === "integration");
  return {
    actor: receipt.actor,
    publicTiRoute,
    sourceCandidateValidationReceiptId: receipt.id,
    status: receipt.status,
    readiness: {
      publicTI: publicTiConsumer?.ready === true,
      alertGeneration: alertConsumer?.ready === true,
      dashboard: dashboardConsumer?.ready === true,
      integration: integrationConsumer?.ready === true
    },
    coverageCounts: {
      accepted: receipt.summary.accepted,
      retryGated: receipt.summary.retryGated,
      policyGated: receipt.summary.policyGated,
      inspectOnly: receipt.summary.inspectOnly,
      alertReady: receipt.summary.alertReady
    },
    sourceFamilies: receipt.summary.sourceFamilies,
    parserStatuses: receipt.summary.parserStatuses,
    healthStates: receipt.summary.healthStates,
    freshness: {
      newestFreshnessAt: receipt.summary.newestFreshnessAt,
      nextRetryAt: receipt.summary.nextRetryAt
    },
    blockers: receipt.validations
      .filter((validation) => validation.validation.blockerCode)
      .map((validation) => ({
        code: validation.validation.blockerCode,
        sourceFamily: validation.sourceFamily,
        reason: validation.validation.reason
      })),
    downstreamRoutes: {
      publicTI: publicTiConsumer?.route.path ?? publicTiRoute,
      alertGeneration: alertConsumer?.route.path ?? "/v1/dwm/alerts/rebuild",
      dashboard: dashboardConsumer?.route.path ?? "/v1/dwm/source-requests",
      integration: integrationConsumer?.route.path ?? "/v1/dwm/source-requests"
    },
    provenance: {
      validationIds: receipt.validations.map((validation) => validation.validationId),
      captureIds: uniqueStrings(receipt.validations.map((validation) => validation.provenance.captureId)),
      contentHashes: uniqueStrings(receipt.validations.map((validation) => validation.provenance.contentHash)),
      sourceHealthProofIds: uniqueStrings(receipt.validations.map((validation) => validation.provenance.sourceHealthProofId))
    }
  };
}

function actorSourceCoveragePortfolioConsumers(
  actorRows: TiSourceProvenanceActorSourceCoveragePortfolioRow[]
): TiSourceProvenanceActorSourceCoveragePortfolio["consumers"] {
  const publicTiReady = actorRows.some((row) => row.readiness.publicTI);
  const alertReady = actorRows.some((row) => row.readiness.alertGeneration);
  const dashboardReady = actorRows.length > 0 && actorRows.every((row) => row.readiness.dashboard);
  const integrationReady = actorRows.length > 0 && actorRows.every((row) => row.readiness.integration);
  return [{
    consumer: "publicTI",
    ready: publicTiReady,
    requiredFields: ["actorRows[].publicTiRoute", "actorRows[].provenance.contentHashes", "actorRows[].freshness"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: alertReady,
    requiredFields: ["actorRows[].coverageCounts.alertReady", "actorRows[].provenance.captureIds", "actorRows[].downstreamRoutes.alertGeneration"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actors: actorRows.map((row) => row.actor),
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: dashboardReady,
    requiredFields: ["actorRows[].readiness", "actorRows[].blockers", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeActorCoveragePortfolio: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: integrationReady,
    requiredFields: ["schemaVersion", "safeOutput", "actorRows[].provenance", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationProof: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function actorEnrichmentAlertPrerequisiteRow(
  row: TiSourceProvenanceActorSourceCoveragePortfolioRow
): TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow {
  const missingPrerequisites = actorEnrichmentAlertPrerequisites(row);
  const alertReadiness: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow["alertReadiness"] = row.coverageCounts.alertReady === 0
    ? "blocked"
    : missingPrerequisites.length > 0
      ? "partial"
      : "ready";
  return {
    actor: row.actor,
    publicTiRoute: row.publicTiRoute,
    sourceCandidateValidationReceiptId: row.sourceCandidateValidationReceiptId,
    alertReadiness,
    readiness: row.readiness,
    coverageCounts: row.coverageCounts,
    sourceFamilies: row.sourceFamilies,
    parserStatuses: row.parserStatuses,
    healthStates: row.healthStates,
    freshness: row.freshness,
    missingPrerequisites,
    downstreamRoutes: row.downstreamRoutes,
    provenance: row.provenance
  };
}

function actorEnrichmentAlertPrerequisites(
  row: TiSourceProvenanceActorSourceCoveragePortfolioRow
): TiSourceProvenanceActorEnrichmentAlertPrerequisite[] {
  const prerequisites: TiSourceProvenanceActorEnrichmentAlertPrerequisite[] = [];
  for (const blocker of row.blockers) {
    if (blocker.code === "parser_retry_scheduled") {
      prerequisites.push({
        code: "parser_retry_required",
        ownerLane: "parser",
        sourceFamily: blocker.sourceFamily,
        reason: blocker.reason,
        nextAction: {
          action: "retry_parser",
          route: {
            method: "POST",
            path: "/v1/dwm/source-requests",
            body: {
              actor: row.actor,
              sourceFamily: blocker.sourceFamily,
              action: "retry_parser",
              dryRun: true
            },
            dryRunSupported: true,
            liveNetworkFetch: false
          }
        }
      });
    } else if (blocker.code === "policy_review_required") {
      prerequisites.push({
        code: "policy_review_required",
        ownerLane: "policy",
        sourceFamily: blocker.sourceFamily,
        reason: blocker.reason,
        nextAction: {
          action: "request_policy_review",
          route: {
            method: "POST",
            path: "/v1/dwm/source-requests",
            body: {
              actor: row.actor,
              sourceFamily: blocker.sourceFamily,
              action: "request_policy_review",
              metadataOnly: true,
              dryRun: true
            },
            dryRunSupported: true,
            liveNetworkFetch: false
          }
        }
      });
    } else if (blocker.code === "degraded_parser") {
      prerequisites.push({
        code: "parser_health_inspection_required",
        ownerLane: "source",
        sourceFamily: blocker.sourceFamily,
        reason: blocker.reason,
        nextAction: {
          action: "inspect_parser_health",
          route: {
            method: "GET",
            path: "/v1/dwm/source-requests",
            body: {
              actor: row.actor,
              sourceFamily: blocker.sourceFamily,
              includeSourceHealth: true,
              dryRun: true
            },
            dryRunSupported: true,
            liveNetworkFetch: false
          }
        }
      });
    }
  }
  if (row.coverageCounts.alertReady === 0) {
    prerequisites.push({
      code: "watchlist_materialization_required",
      ownerLane: "org",
      reason: "No validated source row can produce alert-ready watchlist matches for this actor yet.",
      nextAction: {
        action: "materialize_watchlist_terms",
        route: {
          method: "POST",
          path: "/v1/organizations/watchlists/terms",
          body: {
            actor: row.actor,
            publicTiRoute: row.publicTiRoute,
            dryRun: true
          },
          dryRunSupported: true,
          liveNetworkFetch: false
        }
      }
    });
  }
  return prerequisites;
}

function actorEnrichmentAlertPrerequisiteConsumers(
  actorRows: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow[]
): TiSourceProvenanceActorEnrichmentAlertPrerequisitePacket["consumers"] {
  const publicTiReady = actorRows.some((row) => row.readiness.publicTI);
  const alertReady = actorRows.some((row) => row.coverageCounts.alertReady > 0);
  const dashboardReady = actorRows.length > 0 && actorRows.every((row) => row.readiness.dashboard);
  const integrationReady = actorRows.length > 0 && actorRows.every((row) => row.readiness.integration);
  return [{
    consumer: "publicTI",
    ready: publicTiReady,
    requiredFields: ["actorRows[].publicTiRoute", "actorRows[].sourceFamilies", "actorRows[].freshness", "actorRows[].missingPrerequisites"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: alertReady,
    requiredFields: ["actorRows[].coverageCounts.alertReady", "actorRows[].provenance.captureIds", "actorRows[].missingPrerequisites", "actorRows[].downstreamRoutes.alertGeneration"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        actors: actorRows.map((row) => row.actor),
        includePrerequisites: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: dashboardReady,
    requiredFields: ["actorRows[].alertReadiness", "actorRows[].missingPrerequisites", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeActorAlertPrerequisites: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: integrationReady,
    requiredFields: ["schemaVersion", "safeOutput", "actorRows[].provenance", "actorRows[].missingPrerequisites", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeActorAlertPrerequisitePacket: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function actorEnrichmentSourceHealthEvents(
  row: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow,
  generatedAt: string
): TiSourceProvenanceActorEnrichmentSourceHealthEvent[] {
  const events: TiSourceProvenanceActorEnrichmentSourceHealthEvent[] = [];
  if (row.coverageCounts.alertReady > 0) {
    const sourceFamily = row.sourceFamilies[0] ?? "actor_page";
    events.push({
      eventId: stableId("ti_source_provenance_actor_enrichment_source_health_event", `${row.actor}:${sourceFamily}:accepted:${row.sourceCandidateValidationReceiptId}`),
      actor: row.actor,
      publicTiRoute: row.publicTiRoute,
      sourceFamily,
      candidateValidation: {
        state: "accepted",
        policyStatus: "allowed",
        parserCompatible: true,
        expectedActorCoverage: [row.actor],
        expectedEntityCoverage: ["actor_profile", "source_provenance", "alertable_fields"]
      },
      parserHealth: {
        parserStatus: "ready",
        healthState: "healthy",
        lastRunAt: row.freshness.newestFreshnessAt ?? generatedAt,
        lastSuccessAt: row.freshness.newestFreshnessAt ?? generatedAt,
        staleThresholdMinutes: 1440
      },
      activationTest: {
        state: "active",
        testResult: "passed",
        route: {
          method: "POST",
          path: "/v1/dwm/source-requests",
          body: {
            actor: row.actor,
            sourceFamily,
            action: "test_source",
            dryRun: true
          },
          dryRunSupported: true,
          liveNetworkFetch: false
        }
      },
      affected: {
        actorPages: [row.publicTiRoute],
        alertFamilies: ["watchlist_terms", "actor_enrichment"]
      },
      downstreamRoutes: row.downstreamRoutes,
      provenance: row.provenance
    });
  }

  for (const prerequisite of row.missingPrerequisites) {
    const sourceFamily = prerequisite.sourceFamily ?? row.sourceFamilies[0] ?? "actor_page";
    events.push({
      eventId: stableId("ti_source_provenance_actor_enrichment_source_health_event", `${row.actor}:${sourceFamily}:${prerequisite.code}:${row.sourceCandidateValidationReceiptId}`),
      actor: row.actor,
      publicTiRoute: row.publicTiRoute,
      sourceFamily,
      candidateValidation: actorEnrichmentSourceHealthCandidateValidation(row, prerequisite, sourceFamily),
      parserHealth: actorEnrichmentSourceHealthParserHealth(row, prerequisite),
      activationTest: actorEnrichmentSourceHealthActivationTest(prerequisite),
      affected: {
        actorPages: [row.publicTiRoute],
        alertFamilies: actorEnrichmentSourceHealthAlertFamilies(prerequisite)
      },
      downstreamRoutes: row.downstreamRoutes,
      provenance: row.provenance
    });
  }

  return events;
}

function actorEnrichmentSourceHealthCandidateValidation(
  row: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow,
  prerequisite: TiSourceProvenanceActorEnrichmentAlertPrerequisite,
  sourceFamily: TiSourceProvenanceActorProfileGapSourceCandidate["family"]
): TiSourceProvenanceActorEnrichmentSourceHealthEvent["candidateValidation"] {
  if (prerequisite.code === "policy_review_required") {
    return {
      state: "policy_gated",
      policyStatus: "metadata_only_review_required",
      parserCompatible: false,
      expectedActorCoverage: [row.actor],
      expectedEntityCoverage: ["metadata_only_source", "source_provenance"],
      rejectionReason: prerequisite.reason
    };
  }
  if (prerequisite.code === "parser_retry_required") {
    return {
      state: "retry_gated",
      policyStatus: "allowed",
      parserCompatible: true,
      expectedActorCoverage: [row.actor],
      expectedEntityCoverage: ["actor_profile", "campaign_freshness", "alertable_fields"],
      rejectionReason: prerequisite.reason
    };
  }
  if (prerequisite.code === "watchlist_materialization_required") {
    return {
      state: "inspect_only",
      policyStatus: "allowed",
      parserCompatible: true,
      expectedActorCoverage: [row.actor],
      expectedEntityCoverage: ["watchlist_terms", "alertable_fields"],
      rejectionReason: prerequisite.reason
    };
  }
  return {
    state: "inspect_only",
    policyStatus: "allowed",
    parserCompatible: true,
    expectedActorCoverage: [row.actor],
    expectedEntityCoverage: sourceFamily === "darkweb_metadata" ? ["metadata_only_source", "source_provenance"] : ["actor_profile", "source_provenance"],
    rejectionReason: prerequisite.reason
  };
}

function actorEnrichmentSourceHealthParserHealth(
  row: TiSourceProvenanceActorEnrichmentAlertPrerequisiteRow,
  prerequisite: TiSourceProvenanceActorEnrichmentAlertPrerequisite
): TiSourceProvenanceActorEnrichmentSourceHealthEvent["parserHealth"] {
  if (prerequisite.code === "parser_retry_required") {
    return {
      parserStatus: "retry_scheduled",
      healthState: "stale",
      lastRunAt: row.freshness.newestFreshnessAt ?? row.freshness.nextRetryAt ?? new Date(0).toISOString(),
      staleThresholdMinutes: 360,
      failureReason: prerequisite.reason,
      nextRetryAt: row.freshness.nextRetryAt
    };
  }
  if (prerequisite.code === "policy_review_required") {
    return {
      parserStatus: "blocked",
      healthState: "blocked",
      lastRunAt: row.freshness.newestFreshnessAt ?? new Date(0).toISOString(),
      staleThresholdMinutes: 1440,
      failureReason: prerequisite.reason
    };
  }
  if (prerequisite.code === "watchlist_materialization_required") {
    return {
      parserStatus: "ready",
      healthState: "degraded",
      lastRunAt: row.freshness.newestFreshnessAt ?? new Date(0).toISOString(),
      staleThresholdMinutes: 1440,
      failureReason: prerequisite.reason
    };
  }
  return {
    parserStatus: "not_tested",
    healthState: "degraded",
    lastRunAt: row.freshness.newestFreshnessAt ?? new Date(0).toISOString(),
    staleThresholdMinutes: 1440,
    failureReason: prerequisite.reason
  };
}

function actorEnrichmentSourceHealthActivationTest(
  prerequisite: TiSourceProvenanceActorEnrichmentAlertPrerequisite
): TiSourceProvenanceActorEnrichmentSourceHealthEvent["activationTest"] {
  if (prerequisite.code === "parser_retry_required") {
    return {
      state: "retry_scheduled",
      testResult: "failed",
      route: prerequisite.nextAction.route
    };
  }
  if (prerequisite.code === "policy_review_required") {
    return {
      state: "policy_blocked",
      testResult: "not_run",
      route: prerequisite.nextAction.route
    };
  }
  return {
    state: "inspection_required",
    testResult: "not_run",
    route: prerequisite.nextAction.route
  };
}

function actorEnrichmentSourceHealthAlertFamilies(
  prerequisite: TiSourceProvenanceActorEnrichmentAlertPrerequisite
): string[] {
  if (prerequisite.code === "policy_review_required") return ["restricted_metadata", "watchlist_terms"];
  if (prerequisite.code === "parser_retry_required") return ["campaign_freshness", "watchlist_terms"];
  if (prerequisite.code === "watchlist_materialization_required") return ["watchlist_terms"];
  return ["actor_enrichment", "watchlist_terms"];
}

function actorEnrichmentSourceHealthEventConsumers(
  events: TiSourceProvenanceActorEnrichmentSourceHealthEvent[]
): TiSourceProvenanceActorEnrichmentSourceHealthEventPacket["consumers"] {
  const hasEvents = events.length > 0;
  const hasAccepted = events.some((event) => event.candidateValidation.state === "accepted");
  return [{
    consumer: "publicTI",
    ready: hasAccepted,
    requiredFields: ["events[].publicTiRoute", "events[].parserHealth", "events[].provenance", "summary"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasAccepted,
    requiredFields: ["events[].affected.alertFamilies", "events[].candidateValidation", "events[].activationTest", "events[].downstreamRoutes.alertGeneration"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeSourceHealthEvents: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasEvents,
    requiredFields: ["events[].candidateValidation", "events[].parserHealth", "events[].activationTest", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeSourceHealthEvents: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasEvents,
    requiredFields: ["schemaVersion", "safeOutput", "events[].provenance", "events[].parserHealth", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationSourceHealthEvents: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourceHealthMonitoringFiltersForKind(
  events: TiSourceProvenanceActorEnrichmentSourceHealthEvent[],
  kind: TiSourceProvenanceSourceHealthMonitoringFilter["kind"],
  valueSelector: (event: TiSourceProvenanceActorEnrichmentSourceHealthEvent) => string | string[] | undefined
): TiSourceProvenanceSourceHealthMonitoringFilter[] {
  const grouped = new Map<string, TiSourceProvenanceActorEnrichmentSourceHealthEvent[]>();
  for (const event of events) {
    const values = valueSelector(event);
    const normalizedValues = Array.isArray(values) ? values : values ? [values] : [];
    for (const value of normalizedValues) {
      const rows = grouped.get(value) ?? [];
      rows.push(event);
      grouped.set(value, rows);
    }
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, rows]) => sourceHealthMonitoringFilter(kind, value, rows));
}

function sourceHealthMonitoringFilter(
  kind: TiSourceProvenanceSourceHealthMonitoringFilter["kind"],
  value: string,
  rows: TiSourceProvenanceActorEnrichmentSourceHealthEvent[]
): TiSourceProvenanceSourceHealthMonitoringFilter {
  const readyCount = rows.filter((row) => row.candidateValidation.state === "accepted").length;
  const blockedCount = rows.filter((row) => row.candidateValidation.state === "policy_gated" || row.parserHealth.healthState === "blocked").length;
  const retryableCount = rows.filter((row) => row.candidateValidation.state === "retry_gated" || row.activationTest.state === "retry_scheduled").length;
  return {
    filterId: stableId("ti_source_provenance_source_health_monitoring_filter", `${kind}:${value}:${rows.map((row) => row.eventId).join(",")}`),
    kind,
    value,
    count: rows.length,
    readyCount,
    blockedCount,
    retryableCount,
    affectedActorPages: uniqueStrings(rows.flatMap((row) => row.affected.actorPages)),
    affectedAlertFamilies: uniqueStrings(rows.flatMap((row) => row.affected.alertFamilies)),
    sampleEventIds: rows.slice(0, 5).map((row) => row.eventId),
    operatorAction: sourceHealthMonitoringFilterAction(kind, value, rows)
  };
}

function sourceHealthMonitoringFilterAction(
  kind: TiSourceProvenanceSourceHealthMonitoringFilter["kind"],
  value: string,
  rows: TiSourceProvenanceActorEnrichmentSourceHealthEvent[]
): TiSourceProvenanceSourceHealthMonitoringFilter["operatorAction"] {
  if (kind === "alert_family" || kind === "affected_actor_page") {
    return {
      action: "review_gap",
      ownerLane: "source",
      reason: "Review source coverage gaps before routing the affected actor page or alert family.",
      route: {
        method: "GET",
        path: "/v1/dwm/source-requests",
        body: {
          filterKind: kind,
          filterValue: value,
          includeSourceHealthEvents: true,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  const retryRow = rows.find((row) => row.candidateValidation.state === "retry_gated");
  if (retryRow || kind === "retry_window" || value === "retry_gated" || value === "stale") {
    return {
      action: "retry",
      ownerLane: "parser",
      reason: "Retry parser/source health tests for stale or retry-gated source events.",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          eventIds: rows.map((row) => row.eventId),
          action: "retry_parser",
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  const policyRow = rows.find((row) => row.candidateValidation.state === "policy_gated");
  if (policyRow || value === "policy_gated" || value === "blocked" || value === "darkweb_metadata") {
    return {
      action: "request_policy_review",
      ownerLane: "policy",
      reason: "Review metadata-only policy gates before source activation or alert generation.",
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          eventIds: rows.map((row) => row.eventId),
          action: "request_policy_review",
          metadataOnly: true,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  if (rows.some((row) => row.candidateValidation.state === "accepted")) {
    return {
      action: "queue_alert_rebuild",
      ownerLane: "alert",
      reason: "Accepted source health events can be used to dry-run alert rebuild readiness.",
      route: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          eventIds: rows.map((row) => row.eventId),
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    };
  }
  return {
    action: "inspect",
    ownerLane: "source",
    reason: "Inspect source health events and parser status before activation changes.",
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        filterKind: kind,
        filterValue: value,
        includeSourceHealthEvents: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  };
}

function sourceHealthMonitoringFilterConsumers(
  filters: TiSourceProvenanceSourceHealthMonitoringFilter[]
): TiSourceProvenanceSourceHealthMonitoringFilterPacket["consumers"] {
  const hasFilters = filters.length > 0;
  const hasReady = filters.some((filter) => filter.readyCount > 0);
  return [{
    consumer: "sourceOps",
    ready: hasFilters,
    requiredFields: ["filters[].kind", "filters[].value", "filters[].operatorAction", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeMonitoringFilters: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasFilters,
    requiredFields: ["filters[].count", "filters[].affectedActorPages", "filters[].affectedAlertFamilies", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeSourceHealthMonitoringFilters: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "publicTI",
    ready: hasReady,
    requiredFields: ["filters[].affectedActorPages", "filters[].operatorAction", "summary.affectedActorPages"],
    route: {
      method: "GET",
      path: "/ti/:query",
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasReady,
    requiredFields: ["filters[].affectedAlertFamilies", "filters[].operatorAction", "summary.affectedAlertFamilies"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeSourceHealthMonitoringFilters: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasFilters,
    requiredFields: ["schemaVersion", "safeOutput", "filters[].sampleEventIds", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationMonitoringFilters: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
}

function sourcePackLifecycleCleanupRow(
  filter: TiSourceProvenanceSourceHealthMonitoringFilter
): TiSourceProvenanceSourcePackLifecycleCleanupRow | undefined {
  const lifecycleState = sourcePackLifecycleCleanupState(filter);
  if (!lifecycleState) return undefined;
  const sourceFamilies = sourcePackLifecycleCleanupSourceFamilies(filter);
  return {
    cleanupId: stableId("ti_source_provenance_source_pack_lifecycle_cleanup", `${filter.filterId}:${lifecycleState}`),
    filterId: filter.filterId,
    filterKind: filter.kind,
    filterValue: filter.value,
    lifecycleState,
    priority: sourcePackLifecycleCleanupPriority(filter, lifecycleState),
    eventCount: filter.count,
    readyCount: filter.readyCount,
    blockedCount: filter.blockedCount,
    retryableCount: filter.retryableCount,
    affectedActorPages: filter.affectedActorPages,
    affectedAlertFamilies: filter.affectedAlertFamilies,
    sourceFamilies,
    sampleEventIds: filter.sampleEventIds,
    remediation: filter.operatorAction
  };
}

function sourcePackLifecycleCleanupState(
  filter: TiSourceProvenanceSourceHealthMonitoringFilter
): TiSourceProvenanceSourcePackLifecycleCleanupRow["lifecycleState"] | undefined {
  if (filter.operatorAction.action === "retry") return "retry_ready";
  if (filter.operatorAction.action === "request_policy_review") return "policy_review_required";
  if (filter.operatorAction.action === "queue_alert_rebuild") return "alert_rebuild_ready";
  if (filter.operatorAction.action === "review_gap") return "gap_review_required";
  if (filter.operatorAction.action === "inspect") return "inspect_required";
  return undefined;
}

function sourcePackLifecycleCleanupPriority(
  filter: TiSourceProvenanceSourceHealthMonitoringFilter,
  lifecycleState: TiSourceProvenanceSourcePackLifecycleCleanupRow["lifecycleState"]
): TiSourceProvenanceSourcePackLifecycleCleanupRow["priority"] {
  if (lifecycleState === "policy_review_required" || filter.blockedCount > 0) return "high";
  if (lifecycleState === "retry_ready" || filter.retryableCount > 0) return "high";
  if (lifecycleState === "gap_review_required") return "medium";
  if (lifecycleState === "alert_rebuild_ready") return "medium";
  return "low";
}

function sourcePackLifecycleCleanupSourceFamilies(
  filter: TiSourceProvenanceSourceHealthMonitoringFilter
): TiSourceProvenanceActorProfileGapSourceCandidate["family"][] {
  const knownFamilies: TiSourceProvenanceActorProfileGapSourceCandidate["family"][] = [
    "actor_page",
    "public_advisory",
    "telegram_public",
    "darkweb_metadata"
  ];
  if (filter.kind === "source_family" && knownFamilies.includes(filter.value as TiSourceProvenanceActorProfileGapSourceCandidate["family"])) {
    return [filter.value as TiSourceProvenanceActorProfileGapSourceCandidate["family"]];
  }
  if (filter.value === "restricted_metadata") return ["darkweb_metadata"];
  if (filter.value === "campaign_freshness") return ["telegram_public", "public_advisory"];
  if (filter.value === "actor_enrichment") return ["actor_page", "public_advisory"];
  return [];
}

function sourcePackLifecycleCleanupConsumers(
  cleanupRows: TiSourceProvenanceSourcePackLifecycleCleanupRow[]
): TiSourceProvenanceSourcePackLifecycleCleanupPacket["consumers"] {
  const hasRows = cleanupRows.length > 0;
  const hasAlertReady = cleanupRows.some((row) => row.lifecycleState === "alert_rebuild_ready");
  return [{
    consumer: "sourceOps",
    ready: hasRows,
    requiredFields: ["cleanupRows[].lifecycleState", "cleanupRows[].priority", "cleanupRows[].remediation", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeLifecycleCleanup: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "dashboard",
    ready: hasRows,
    requiredFields: ["cleanupRows[].affectedActorPages", "cleanupRows[].affectedAlertFamilies", "cleanupRows[].sampleEventIds", "summary"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeSourcePackLifecycleCleanup: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "alertGeneration",
    ready: hasAlertReady,
    requiredFields: ["cleanupRows[].lifecycleState", "cleanupRows[].remediation.route", "summary.affectedAlertFamilies"],
    route: {
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        includeLifecycleCleanup: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }, {
    consumer: "integration",
    ready: hasRows,
    requiredFields: ["schemaVersion", "safeOutput", "cleanupRows[].sampleEventIds", "consumers[]"],
    route: {
      method: "GET",
      path: "/v1/dwm/source-requests",
      body: {
        includeIntegrationLifecycleCleanup: true,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    }
  }];
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
