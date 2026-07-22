export const TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_alert_rebuild_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_actor_enrichment_gap_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_source_pack_intake_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_source_activation_decision_receipt.v1" as const;

type SafeSourceOutput = {
  rawTargetsExposed: false;
  restrictedMetadataLeaked: false;
  privateTelegramContentExposed: false;
  liveNetworkScrapeStarted: false;
};

type SourceActionRoute = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  dryRunSupported: true;
  liveNetworkFetch: false;
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
  safeOutput: SafeSourceOutput;
};

export type TiSourceProvenancePublicTiSourceOpsProjection = {
  schemaVersion: "ti.source_provenance_public_ti_source_ops_projection.v1";
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
    freshnessState: "fresh" | "stale" | "missing";
    parserAlertCount: number;
    operatorActionCount: number;
    validationIssueCount: number;
    nextRetryAt?: string;
  };
  provenanceRows: Array<{
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
      state: "fresh" | "stale" | "missing";
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
    route: SourceActionRoute;
    safeOutput: SafeSourceOutput;
  }>;
  enrichmentGaps: Array<{
    code: string;
    ownerLane: "source" | "parser" | "policy" | "publicTI" | "alert" | "case";
    sourceFamily?: string;
    nextAction: string;
    route: SourceActionRoute;
  }>;
  consumerContracts: Array<{
    consumer: "publicTI" | "dashboard" | "sourceOps" | "alertGeneration";
    route: string;
    requiredFields: string[];
    sourceSchemas: string[];
    liveNetworkFetch: false;
  }>;
  payloadShape: string[];
  safeOutput: SafeSourceOutput;
};
