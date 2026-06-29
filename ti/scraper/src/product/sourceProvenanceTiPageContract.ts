import { stableId, uniqueStrings } from "../utils.ts";

export const TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION = "ti.source_provenance_page_contract.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERTABILITY_BRIDGE_SCHEMA_VERSION = "ti.source_provenance_alertability_bridge.v1" as const;
export const TI_SOURCE_PROVENANCE_ORG_WATCHLIST_CANDIDATE_SCHEMA_VERSION = "organization.watchlist_alert_terms_export.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_REBUILD_REQUEST_SCHEMA_VERSION = "ti.source_provenance_alert_rebuild_request.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_REBUILD_READINESS_SCHEMA_VERSION = "ti.source_provenance_alert_rebuild_readiness.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION = "ti.source_provenance_alert_rebuild_receipt.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_PROFILE_CONTRACT_SCHEMA_VERSION = "ti.source_provenance_actor_profile_contract.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_PROFILE_GAP_SOURCE_PLAN_SCHEMA_VERSION = "ti.source_provenance_actor_profile_gap_source_plan.v1" as const;
export const TI_SOURCE_PROVENANCE_ACTOR_PROFILE_SOURCE_UPDATE_WORKFLOW_SCHEMA_VERSION = "ti.source_provenance_actor_profile_source_update_workflow.v1" as const;

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
