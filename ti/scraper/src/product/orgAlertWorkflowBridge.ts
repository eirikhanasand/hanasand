import { stableId, uniqueStrings } from "../utils.ts";
import {
  buildAlertWorkflowContract,
  validateAlertWorkflowPreservation,
  type DwmAlertWorkflowContract,
  type DwmAlertWorkflowPreservationBlocker
} from "./alertWorkflowContract.ts";
import type {
  TiSourceProvenanceAlertRebuildReceipt,
  TiSourceProvenanceAlertRebuildReceiptBlocker
} from "./sourceProvenanceTiPageContract.ts";

export const DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION = "dwm.org_alert_workflow_bridge.v1" as const;
export const DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION = "dwm.org_alert_webhook_fixture.v1" as const;
export const DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION = "dwm.org_alert_webhook_delivery_payload.v1" as const;
export const DWM_ORG_ALERT_SOURCE_EVIDENCE_SCHEMA_VERSION = "dwm.org_alert_source_evidence.v1" as const;
export const DWM_ORG_ALERT_WEBHOOK_RECONCILIATION_SCHEMA_VERSION = "dwm.org_alert_webhook_reconciliation.v1" as const;
export const DWM_ORG_ALERT_OPERATOR_READINESS_SCHEMA_VERSION = "dwm.org_alert_operator_readiness.v1" as const;
export const DWM_ORG_ALERT_CASE_ACTION_PACKET_SCHEMA_VERSION = "dwm.org_alert_case_action_packet.v1" as const;

export type OrgAlertWorkflowWatchlistRef = {
  watchlistId: string;
  watchlistItemId?: string;
  tenantId: string;
  organizationId: string;
  term: string;
  normalizedTerm?: string;
  status?: "active" | "paused" | "archived" | string;
  alertGeneratorKey?: string;
};

export type OrgAlertWorkflowBridgeReport = {
  schemaVersion: typeof DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  rows: OrgAlertWorkflowBridgeRow[];
  blockers: OrgAlertWorkflowBridgeBlocker[];
};

export type OrgAlertWorkflowBridgeRow = {
  rowId: string;
  watchlistId: string;
  watchlistItemId?: string;
  term: string;
  normalizedTerm: string;
  alertGeneratorKey?: string;
  matchedAlertIds: string[];
  alertDetailPaths: string[];
  casePaths: string[];
  sourceFamilies: string[];
  workflowEventCount: number;
  provenance: {
    evidenceCount: number;
    captureIds: string[];
    sourceIds: string[];
    contentHashes: string[];
  };
  eventPayloads: OrgAlertWorkflowBridgeEventPayload[];
  ready: boolean;
  blockerCodes: OrgAlertWorkflowBridgeBlocker["code"][];
};

export type OrgAlertWorkflowBridgeEventPayload = {
  schemaVersion: "dwm.org_alert_workflow_event_payload.v1";
  alertId: string;
  organizationId: string;
  tenantId: string;
  watchlistId: string;
  watchlistItemId?: string;
  alertGeneratorKey?: string;
  alertDetailPath?: string;
  casePaths: string[];
  sourceFamilies: string[];
  captureIds: string[];
  evidenceCount: number;
  workflowEventCount: number;
  dedupeKey?: string;
};

export type OrgAlertWorkflowBridgeBlocker = {
  code:
    | "inactive_watchlist"
    | "missing_alert_generation_ref"
    | "alert_not_generated"
    | "organization_scope_changed"
    | "alert_detail_route_unavailable"
    | "case_route_unavailable"
    | "provenance_missing"
    | "workflow_not_preserved";
  ownerLane: "watchlist" | "alert" | "case" | "source";
  rowId?: string;
  alertId?: string;
  watchlistId?: string;
  watchlistItemId?: string;
  path: string;
  message: string;
};

export type OrgAlertWebhookDestinationRef = {
  destinationId: string;
  tenantId: string;
  organizationId: string;
  kind?: "discord" | "webhook" | string;
  status?: "active" | "disabled" | "paused" | string;
  verified?: boolean;
};

export type OrgAlertWebhookFixtureContract = {
  schemaVersion: typeof DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  deliveries: OrgAlertWebhookFixtureDelivery[];
  blockers: OrgAlertWebhookFixtureBlocker[];
};

export type OrgAlertWebhookFixtureDelivery = {
  deliveryId: string;
  rowId: string;
  alertId: string;
  watchlistId: string;
  watchlistItemId?: string;
  ready: boolean;
  blockerCodes: OrgAlertWebhookFixtureBlocker["code"][];
  destinationIds: string[];
  destinationKinds: string[];
  payload: OrgAlertWebhookDeliveryPayload;
};

export type OrgAlertWebhookDeliveryPayload = {
  schemaVersion: typeof DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION;
  tenantId: string;
  organizationId: string;
  alertId: string;
  watchlistId: string;
  watchlistItemId?: string;
  webhookDestinationIds: string[];
  deliveryKind: string;
  alertDetailPath?: string;
  casePaths: string[];
  sourceFamilies: string[];
  captureIds: string[];
  evidenceCount: number;
  workflowEventCount: number;
  dedupeKey?: string;
  idempotencyKey: string;
};

export type OrgAlertWebhookFixtureBlocker = {
  code:
    | "bridge_row_not_ready"
    | "missing_alert_event_payload"
    | "missing_webhook_destination"
    | "webhook_destination_not_found"
    | "webhook_destination_scope_mismatch"
    | "webhook_destination_not_verified";
  ownerLane: "watchlist" | "alert" | "case" | "source" | "webhook" | "publicTI";
  rowId: string;
  alertId?: string;
  watchlistId: string;
  watchlistItemId?: string;
  destinationId?: string;
  path: string;
  message: string;
};

export type OrgAlertSourceRef = {
  sourceId: string;
  sourceFamily?: string;
  status?: "active" | "paused" | "archived" | "candidate" | string;
  lastCollectedAt?: string;
  updatedAt?: string;
};

export type OrgAlertCaptureRef = {
  captureId: string;
  sourceId: string;
  sourceFamily?: string;
  contentHash?: string;
  collectedAt?: string;
};

export type OrgAlertSourceProvenanceSummaryRef = {
  schemaVersion?: "dwm.alert_source_provenance.v1" | string;
  alertId?: string;
  tenantId?: string;
  organizationId?: string;
  sourceFamily?: string;
  sourceFamilies?: string[];
  captureIds?: string[];
  sourceIds?: string[];
  contentHashes?: string[];
  evidenceCount?: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
  evidenceExcerpts?: Array<{
    captureId?: string;
    sourceId?: string;
    sourceFamily?: string;
    observedAt?: string;
    contentHash?: string;
  }>;
  generationEvidenceWindow?: {
    captureIds?: string[];
    sourceFamilies?: string[];
    contentHashes?: string[];
    firstObservedAt?: string;
    lastObservedAt?: string;
  };
};

export type OrgAlertSourceEvidenceReport = {
  schemaVersion: typeof DWM_ORG_ALERT_SOURCE_EVIDENCE_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  maxAgeHours: number;
  rows: OrgAlertSourceEvidenceRow[];
  blockers: OrgAlertSourceEvidenceBlocker[];
};

export type OrgAlertSourceEvidenceRow = {
  rowId: string;
  alertIds: string[];
  watchlistId: string;
  watchlistItemId?: string;
  sourceFamilies: string[];
  sourceIds: string[];
  captureIds: string[];
  contentHashes: string[];
  newestEvidenceAt?: string;
  ageHours?: number;
  ready: boolean;
  blockerCodes: OrgAlertSourceEvidenceBlocker["code"][];
};

export type OrgAlertSourceEvidenceBlocker = {
  code:
    | "bridge_row_not_ready"
    | "missing_source_family"
    | "missing_source_provenance_summary"
    | "source_provenance_identity_mismatch"
    | "missing_source_ref"
    | "inactive_source"
    | "missing_capture_ref"
    | "content_hash_mismatch"
    | "stale_evidence";
  ownerLane: "alert" | "source";
  rowId: string;
  alertId?: string;
  watchlistId: string;
  watchlistItemId?: string;
  sourceId?: string;
  captureId?: string;
  path: string;
  message: string;
};

export type OrgAlertWebhookDeliveryAttemptRef = {
  deliveryId: string;
  tenantId: string;
  organizationId: string;
  alertId: string;
  webhookDestinationId: string;
  status?: "delivered" | "failed" | "queued" | "skipped" | string;
  idempotencyKey?: string;
  payloadHash?: string;
  endpointHash?: string;
  attemptedAt?: string;
  httpStatus?: number;
  dryRun?: boolean;
};

export type OrgAlertWebhookDeliveryReconciliation = {
  schemaVersion: typeof DWM_ORG_ALERT_WEBHOOK_RECONCILIATION_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  rows: OrgAlertWebhookDeliveryReconciliationRow[];
  blockers: OrgAlertWebhookDeliveryReconciliationBlocker[];
};

export type OrgAlertWebhookDeliveryReconciliationRow = {
  rowId: string;
  plannedDeliveryId: string;
  alertId: string;
  watchlistId: string;
  watchlistItemId?: string;
  destinationIds: string[];
  matchedDeliveryIds: string[];
  status: "delivered" | "blocked";
  ready: boolean;
  blockerCodes: OrgAlertWebhookDeliveryReconciliationBlocker["code"][];
  audit: {
    redacted: true;
    idempotencyKey: string;
    payloadHash?: string;
    endpointHashes: string[];
    attemptedAt: string[];
  };
};

export type OrgAlertWebhookDeliveryReconciliationBlocker = {
  code:
    | "fixture_delivery_not_ready"
    | "missing_delivery_attempt"
    | "duplicate_delivery_attempt"
    | "delivery_identity_mismatch"
    | "delivery_destination_mismatch"
    | "delivery_idempotency_mismatch"
    | "delivery_not_delivered"
    | "dry_run_delivery";
  ownerLane: "alert" | "webhook";
  rowId: string;
  plannedDeliveryId: string;
  alertId: string;
  destinationId?: string;
  deliveryId?: string;
  path: string;
  message: string;
};

export type OrgAlertOperatorReadinessPacket = {
  schemaVersion: typeof DWM_ORG_ALERT_OPERATOR_READINESS_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  rows: OrgAlertOperatorReadinessRow[];
  blockers: OrgAlertOperatorReadinessBlocker[];
  requiredReports: {
    sourceEvidence: boolean;
    sourceRebuildReceipt: boolean;
    webhookFixture: boolean;
    webhookReconciliation: boolean;
  };
};

export type OrgAlertOperatorReadinessRow = {
  rowId: string;
  watchlistId: string;
  watchlistItemId?: string;
  alertIds: string[];
  alertDetailPaths: string[];
  casePaths: string[];
  sourceFamilies: string[];
  captureIds: string[];
  webhookDestinationIds: string[];
  matchedDeliveryIds: string[];
  sourceRebuildReceiptIds: string[];
  stages: {
    workflowBridge: boolean;
    sourceEvidence: boolean;
    sourceRebuildReceipt: boolean | "not_required";
    webhookFixture: boolean;
    webhookReconciliation: boolean | "not_required";
  };
  ready: boolean;
  blockerCodes: string[];
};

export type OrgAlertOperatorReadinessBlocker = {
  code:
    | "missing_source_evidence_report"
    | "missing_source_rebuild_receipt_report"
    | "missing_webhook_fixture_report"
    | "missing_webhook_reconciliation_report"
    | OrgAlertWorkflowBridgeBlocker["code"]
    | OrgAlertSourceEvidenceBlocker["code"]
    | TiSourceProvenanceAlertRebuildReceiptBlocker["code"]
    | OrgAlertWebhookFixtureBlocker["code"]
    | OrgAlertWebhookDeliveryReconciliationBlocker["code"];
  ownerLane: "watchlist" | "alert" | "case" | "source" | "webhook" | "org" | "publicTI";
  stage: "workflow_bridge" | "source_evidence" | "source_rebuild_receipt" | "webhook_fixture" | "webhook_reconciliation";
  rowId?: string;
  alertId?: string;
  watchlistId?: string;
  watchlistItemId?: string;
  path: string;
  message: string;
};

export type OrgAlertCaseActionPacket = {
  schemaVersion: typeof DWM_ORG_ALERT_CASE_ACTION_PACKET_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  rows: OrgAlertCaseActionRow[];
  blockers: OrgAlertCaseActionBlocker[];
  payloadShape: string[];
};

export type OrgAlertCaseActionRow = {
  rowId: string;
  watchlistId: string;
  watchlistItemId?: string;
  alertIds: string[];
  casePaths: string[];
  alertDetailPaths: string[];
  webhookDestinationIds: string[];
  matchedDeliveryIds: string[];
  sourceFamilies: string[];
  captureCount: number;
  ready: boolean;
  allowedActions: OrgAlertCaseAction[];
  blockedActions: OrgAlertCaseAction[];
};

export type OrgAlertCaseAction = {
  action: "open_case" | "review_alert" | "review_delivery" | "restore_source_evidence" | "rebuild_alerts" | "deliver_webhook";
  ownerLane: "case" | "alert" | "source" | "webhook";
  route: string;
  method: "GET" | "POST";
  reason: string;
  blockerCodes: string[];
};

export type OrgAlertCaseActionBlocker = {
  code: OrgAlertOperatorReadinessBlocker["code"];
  ownerLane: OrgAlertOperatorReadinessBlocker["ownerLane"];
  rowId?: string;
  alertId?: string;
  watchlistId?: string;
  watchlistItemId?: string;
  path: string;
  message: string;
};

export function buildOrgAlertWorkflowBridgeReport(input: {
  tenantId: string;
  organizationId: string;
  watchlists: OrgAlertWorkflowWatchlistRef[];
  alerts: Record<string, any>[];
  previousAlerts?: Record<string, any>[];
  checkedAt?: string;
}): OrgAlertWorkflowBridgeReport {
  const checkedAt = input.checkedAt ?? new Date(0).toISOString();
  const previousByAlertId = new Map(
    (input.previousAlerts ?? []).map((alert) => [String(alert.id ?? ""), buildAlertWorkflowContract({ alert, checkedAt })])
  );
  const rows = input.watchlists.map((watchlist) => bridgeRow({
    watchlist,
    alerts: input.alerts,
    previousByAlertId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    checkedAt
  }));
  const blockers = rows.flatMap((row) => rowBlockers(row));
  return {
    schemaVersion: DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION,
    checkedAt,
    ok: blockers.length === 0,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    rows,
    blockers
  };
}

export function buildOrgAlertWebhookFixtureContract(input: {
  bridge: OrgAlertWorkflowBridgeReport;
  destinations: OrgAlertWebhookDestinationRef[];
  destinationIdsByWatchlistId?: Record<string, string[]>;
  destinationIdsByWatchlistItemId?: Record<string, string[]>;
  checkedAt?: string;
}): OrgAlertWebhookFixtureContract {
  const destinationById = new Map(input.destinations.map((destination) => [destination.destinationId, destination]));
  const deliveries = input.bridge.rows.flatMap((row) => {
    const payloads = row.eventPayloads.length ? row.eventPayloads : [undefined];
    return payloads.map((payload) => webhookDeliveryFor({
      row,
      payload,
      bridge: input.bridge,
      destinationById,
      destinationIds: destinationIdsForRow(row, input.destinationIdsByWatchlistId, input.destinationIdsByWatchlistItemId)
    }));
  });
  const blockers = deliveries.flatMap((delivery) => deliveryBlockers(delivery, input.bridge, destinationById));
  return {
    schemaVersion: DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION,
    checkedAt: input.checkedAt ?? input.bridge.checkedAt,
    ok: blockers.length === 0,
    tenantId: input.bridge.tenantId,
    organizationId: input.bridge.organizationId,
    deliveries,
    blockers
  };
}

export function reconcileOrgAlertWebhookDeliveries(input: {
  fixture: OrgAlertWebhookFixtureContract;
  attempts: OrgAlertWebhookDeliveryAttemptRef[];
  checkedAt?: string;
}): OrgAlertWebhookDeliveryReconciliation {
  const rows = input.fixture.deliveries.map((delivery) => reconcileDeliveryRow(delivery, input.fixture, input.attempts));
  const blockers = rows.flatMap((row) => reconciliationBlockers(row, input.fixture));
  return {
    schemaVersion: DWM_ORG_ALERT_WEBHOOK_RECONCILIATION_SCHEMA_VERSION,
    checkedAt: input.checkedAt ?? input.fixture.checkedAt,
    ok: blockers.length === 0,
    tenantId: input.fixture.tenantId,
    organizationId: input.fixture.organizationId,
    rows,
    blockers
  };
}

export function buildOrgAlertSourceEvidenceReport(input: {
  bridge: OrgAlertWorkflowBridgeReport;
  sources: OrgAlertSourceRef[];
  captures: OrgAlertCaptureRef[];
  sourceProvenanceSummaries?: OrgAlertSourceProvenanceSummaryRef[];
  checkedAt?: string;
  maxAgeHours?: number;
}): OrgAlertSourceEvidenceReport {
  const checkedAt = input.checkedAt ?? input.bridge.checkedAt;
  const maxAgeHours = input.maxAgeHours ?? 24;
  const sourceById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const captureById = new Map(input.captures.map((capture) => [capture.captureId, capture]));
  const summaryByAlertId = new Map((input.sourceProvenanceSummaries ?? []).map((summary) => [String(summary.alertId ?? ""), summary]));
  const rows = input.bridge.rows.map((row) => sourceEvidenceRow({
    row,
    sourceById,
    captureById,
    summaryByAlertId,
    tenantId: input.bridge.tenantId,
    organizationId: input.bridge.organizationId,
    checkedAt,
    maxAgeHours
  }));
  const blockers = rows.flatMap((row) => sourceEvidenceBlockers(row));
  return {
    schemaVersion: DWM_ORG_ALERT_SOURCE_EVIDENCE_SCHEMA_VERSION,
    checkedAt,
    ok: blockers.length === 0,
    tenantId: input.bridge.tenantId,
    organizationId: input.bridge.organizationId,
    maxAgeHours,
    rows,
    blockers
  };
}

export function buildOrgAlertOperatorReadinessPacket(input: {
  bridge: OrgAlertWorkflowBridgeReport;
  sourceEvidence?: OrgAlertSourceEvidenceReport;
  sourceRebuildReceipts?: TiSourceProvenanceAlertRebuildReceipt[];
  webhookFixture?: OrgAlertWebhookFixtureContract;
  webhookReconciliation?: OrgAlertWebhookDeliveryReconciliation;
  checkedAt?: string;
  requireSourceEvidence?: boolean;
  requireSourceRebuildReceipt?: boolean;
  requireWebhookFixture?: boolean;
  requireWebhookReconciliation?: boolean;
}): OrgAlertOperatorReadinessPacket {
  const requireSourceEvidence = input.requireSourceEvidence !== false;
  const requireSourceRebuildReceipt = input.requireSourceRebuildReceipt === true;
  const requireWebhookFixture = input.requireWebhookFixture !== false;
  const requireWebhookReconciliation = input.requireWebhookReconciliation === true;
  const rows = input.bridge.rows.map((row) => operatorReadinessRow({
    row,
    sourceEvidence: input.sourceEvidence,
    sourceRebuildReceipts: input.sourceRebuildReceipts,
    webhookFixture: input.webhookFixture,
    webhookReconciliation: input.webhookReconciliation,
    requireSourceEvidence,
    requireSourceRebuildReceipt,
    requireWebhookFixture,
    requireWebhookReconciliation
  }));
  const blockers = [
    ...(requireSourceEvidence && !input.sourceEvidence ? input.bridge.rows.map((row) => missingOperatorReportBlocker("missing_source_evidence_report", "source_evidence", "source", row)) : []),
    ...(requireSourceRebuildReceipt && !input.sourceRebuildReceipts?.length ? input.bridge.rows.map((row) => missingOperatorReportBlocker("missing_source_rebuild_receipt_report", "source_rebuild_receipt", "alert", row)) : []),
    ...(requireWebhookFixture && !input.webhookFixture ? input.bridge.rows.map((row) => missingOperatorReportBlocker("missing_webhook_fixture_report", "webhook_fixture", "webhook", row)) : []),
    ...(requireWebhookReconciliation && !input.webhookReconciliation ? input.bridge.rows.map((row) => missingOperatorReportBlocker("missing_webhook_reconciliation_report", "webhook_reconciliation", "webhook", row)) : []),
    ...input.bridge.blockers.map((blocker) => operatorBlocker("workflow_bridge", blocker)),
    ...(input.sourceEvidence?.blockers.map((blocker) => operatorBlocker("source_evidence", blocker)) ?? []),
    ...(input.sourceRebuildReceipts?.flatMap((receipt) => receipt.blockers.map((blocker) => operatorSourceRebuildReceiptBlocker(receipt, blocker, input.bridge.rows))) ?? []),
    ...(input.webhookFixture?.blockers.map((blocker) => operatorBlocker("webhook_fixture", blocker)) ?? []),
    ...(input.webhookReconciliation?.blockers.map((blocker) => operatorBlocker("webhook_reconciliation", blocker)) ?? [])
  ];
  return {
    schemaVersion: DWM_ORG_ALERT_OPERATOR_READINESS_SCHEMA_VERSION,
    checkedAt: input.checkedAt ?? input.webhookReconciliation?.checkedAt ?? input.webhookFixture?.checkedAt ?? input.sourceEvidence?.checkedAt ?? input.bridge.checkedAt,
    ok: blockers.length === 0 && rows.every((row) => row.ready),
    tenantId: input.bridge.tenantId,
    organizationId: input.bridge.organizationId,
    rows,
    blockers,
    requiredReports: {
      sourceEvidence: requireSourceEvidence,
      sourceRebuildReceipt: requireSourceRebuildReceipt,
      webhookFixture: requireWebhookFixture,
      webhookReconciliation: requireWebhookReconciliation
    }
  };
}

export function buildOrgAlertCaseActionPacket(input: {
  readiness: OrgAlertOperatorReadinessPacket;
  checkedAt?: string;
}): OrgAlertCaseActionPacket {
  const rows = input.readiness.rows.map(caseActionRow);
  const blockers = input.readiness.blockers.map((blocker) => ({
    code: blocker.code,
    ownerLane: blocker.ownerLane,
    rowId: blocker.rowId,
    alertId: blocker.alertId,
    watchlistId: blocker.watchlistId,
    watchlistItemId: blocker.watchlistItemId,
    path: blocker.path,
    message: blocker.message
  }));
  return {
    schemaVersion: DWM_ORG_ALERT_CASE_ACTION_PACKET_SCHEMA_VERSION,
    checkedAt: input.checkedAt ?? input.readiness.checkedAt,
    ok: input.readiness.ok && rows.every((row) => row.ready) && blockers.length === 0,
    tenantId: input.readiness.tenantId,
    organizationId: input.readiness.organizationId,
    rows,
    blockers,
    payloadShape: ["rows[].allowedActions", "rows[].blockedActions", "blockers[]"]
  };
}

function sourceEvidenceRow(input: {
  row: OrgAlertWorkflowBridgeRow;
  sourceById: Map<string, OrgAlertSourceRef>;
  captureById: Map<string, OrgAlertCaptureRef>;
  summaryByAlertId: Map<string, OrgAlertSourceProvenanceSummaryRef>;
  tenantId: string;
  organizationId: string;
  checkedAt: string;
  maxAgeHours: number;
}): OrgAlertSourceEvidenceRow {
  const captures = input.row.provenance.captureIds.map((captureId) => input.captureById.get(captureId)).filter(Boolean) as OrgAlertCaptureRef[];
  const summaries = input.row.matchedAlertIds.map((alertId) => input.summaryByAlertId.get(alertId)).filter(Boolean) as OrgAlertSourceProvenanceSummaryRef[];
  const missingSummary = input.summaryByAlertId.size > 0 && input.row.matchedAlertIds.some((alertId) => !input.summaryByAlertId.has(alertId));
  const identityMismatch = summaries.some((summary) => {
    const tenantId = String(summary.tenantId ?? "");
    const organizationId = String(summary.organizationId ?? "");
    return (tenantId && tenantId !== input.tenantId) || (organizationId && organizationId !== input.organizationId);
  });
  const sourceIds = uniqueStrings([
    ...input.row.provenance.sourceIds,
    ...captures.map((capture) => capture.sourceId),
    ...summaries.flatMap((summary) => asStringArray(summary.sourceIds)),
    ...summaries.flatMap((summary) => summary.evidenceExcerpts?.map((excerpt) => excerpt.sourceId).filter(Boolean).map(String) ?? [])
  ].filter(Boolean).map(String));
  const sources = sourceIds.map((sourceId) => input.sourceById.get(sourceId)).filter(Boolean) as OrgAlertSourceRef[];
  const sourceFamilies = uniqueStrings([
    ...input.row.sourceFamilies,
    ...sources.map((source) => source.sourceFamily),
    ...captures.map((capture) => capture.sourceFamily),
    ...summaries.flatMap((summary) => [
      ...asStringArray(summary.sourceFamily),
      ...asStringArray(summary.sourceFamilies),
      ...asStringArray(summary.generationEvidenceWindow?.sourceFamilies),
      ...(summary.evidenceExcerpts?.map((excerpt) => excerpt.sourceFamily).filter(Boolean).map(String) ?? [])
    ])
  ].filter(Boolean).map(String));
  const contentHashes = uniqueStrings([
    ...input.row.provenance.contentHashes,
    ...captures.map((capture) => capture.contentHash),
    ...summaries.flatMap((summary) => [
      ...asStringArray(summary.contentHashes),
      ...asStringArray(summary.generationEvidenceWindow?.contentHashes),
      ...(summary.evidenceExcerpts?.map((excerpt) => excerpt.contentHash).filter(Boolean).map(String) ?? [])
    ])
  ].filter(Boolean).map(String));
  const captureContentHashes = uniqueStrings(captures.map((capture) => capture.contentHash).filter(Boolean).map(String));
  const summaryContentHashes = uniqueStrings(summaries.flatMap((summary) => [
    ...asStringArray(summary.contentHashes),
    ...asStringArray(summary.generationEvidenceWindow?.contentHashes),
    ...(summary.evidenceExcerpts?.map((excerpt) => excerpt.contentHash).filter(Boolean).map(String) ?? [])
  ]));
  const summaryCaptureIds = uniqueStrings(summaries.flatMap((summary) => [
    ...asStringArray(summary.captureIds),
    ...asStringArray(summary.generationEvidenceWindow?.captureIds),
    ...(summary.evidenceExcerpts?.map((excerpt) => excerpt.captureId).filter(Boolean).map(String) ?? [])
  ]));
  const newestEvidenceAt = newestTimestamp([
    ...captures.map((capture) => capture.collectedAt),
    ...sources.map((source) => source.lastCollectedAt ?? source.updatedAt),
    ...summaries.map((summary) => summary.lastObservedAt ?? summary.generationEvidenceWindow?.lastObservedAt),
    ...summaries.flatMap((summary) => summary.evidenceExcerpts?.map((excerpt) => excerpt.observedAt) ?? [])
  ]);
  const ageHours = newestEvidenceAt ? hoursBetween(newestEvidenceAt, input.checkedAt) : undefined;
  const blockerCodes = uniqueStrings([
    !input.row.ready ? "bridge_row_not_ready" : undefined,
    sourceFamilies.length === 0 ? "missing_source_family" : undefined,
    missingSummary ? "missing_source_provenance_summary" : undefined,
    identityMismatch ? "source_provenance_identity_mismatch" : undefined,
    sourceIds.some((sourceId) => !input.sourceById.has(sourceId)) ? "missing_source_ref" : undefined,
    sources.some((source) => source.status !== "active") ? "inactive_source" : undefined,
    input.row.provenance.captureIds.some((captureId) => !input.captureById.has(captureId) && !summaryCaptureIds.includes(captureId)) ? "missing_capture_ref" : undefined,
    input.row.provenance.contentHashes.some((hash) => !captureContentHashes.includes(hash) && !summaryContentHashes.includes(hash)) ? "content_hash_mismatch" : undefined,
    ageHours === undefined || ageHours > input.maxAgeHours ? "stale_evidence" : undefined
  ].filter(Boolean).map(String)) as OrgAlertSourceEvidenceBlocker["code"][];

  return {
    rowId: input.row.rowId,
    alertIds: input.row.matchedAlertIds,
    watchlistId: input.row.watchlistId,
    watchlistItemId: input.row.watchlistItemId,
    sourceFamilies,
    sourceIds,
    captureIds: input.row.provenance.captureIds,
    contentHashes,
    newestEvidenceAt,
    ageHours,
    ready: blockerCodes.length === 0,
    blockerCodes
  };
}

function operatorReadinessRow(input: {
  row: OrgAlertWorkflowBridgeRow;
  sourceEvidence?: OrgAlertSourceEvidenceReport;
  sourceRebuildReceipts?: TiSourceProvenanceAlertRebuildReceipt[];
  webhookFixture?: OrgAlertWebhookFixtureContract;
  webhookReconciliation?: OrgAlertWebhookDeliveryReconciliation;
  requireSourceEvidence: boolean;
  requireSourceRebuildReceipt: boolean;
  requireWebhookFixture: boolean;
  requireWebhookReconciliation: boolean;
}): OrgAlertOperatorReadinessRow {
  const sourceRow = input.sourceEvidence?.rows.find((row) => row.rowId === input.row.rowId);
  const sourceRebuildReceipts = (input.sourceRebuildReceipts ?? []).filter((receipt) => receiptMatchesOperatorRow(receipt, input.row));
  const fixtureDeliveries = input.webhookFixture?.deliveries.filter((delivery) => delivery.rowId === input.row.rowId) ?? [];
  const reconciliationRows = input.webhookReconciliation?.rows.filter((row) => fixtureDeliveries.some((delivery) => delivery.deliveryId === row.plannedDeliveryId)) ?? [];
  const sourceReady = input.requireSourceEvidence ? sourceRow?.ready === true : (sourceRow?.ready ?? true);
  const sourceRebuildReady = input.requireSourceRebuildReceipt
    ? sourceRebuildReceipts.length > 0 && sourceRebuildReceipts.every((receipt) => receipt.ok)
    : (input.sourceRebuildReceipts ? sourceRebuildReceipts.length > 0 && sourceRebuildReceipts.every((receipt) => receipt.ok) : "not_required");
  const fixtureReady = input.requireWebhookFixture ? fixtureDeliveries.length > 0 && fixtureDeliveries.every((delivery) => delivery.ready) : (fixtureDeliveries.length ? fixtureDeliveries.every((delivery) => delivery.ready) : true);
  const reconciliationReady = input.requireWebhookReconciliation
    ? reconciliationRows.length > 0 && reconciliationRows.every((row) => row.ready)
    : (input.webhookReconciliation ? reconciliationRows.length > 0 && reconciliationRows.every((row) => row.ready) : "not_required");
  const blockerCodes = uniqueStrings([
    ...input.row.blockerCodes,
    ...(sourceRow?.blockerCodes ?? []),
    ...sourceRebuildReceipts.flatMap((receipt) => receipt.blockers.map((blocker) => blocker.code)),
    ...fixtureDeliveries.flatMap((delivery) => delivery.blockerCodes),
    ...reconciliationRows.flatMap((row) => row.blockerCodes),
    input.requireSourceEvidence && !sourceRow ? "missing_source_evidence_report" : undefined,
    input.requireSourceRebuildReceipt && sourceRebuildReceipts.length === 0 ? "missing_source_rebuild_receipt_report" : undefined,
    input.requireWebhookFixture && fixtureDeliveries.length === 0 ? "missing_webhook_fixture_report" : undefined,
    input.requireWebhookReconciliation && reconciliationRows.length === 0 ? "missing_webhook_reconciliation_report" : undefined
  ].filter(Boolean).map(String));

  return {
    rowId: input.row.rowId,
    watchlistId: input.row.watchlistId,
    watchlistItemId: input.row.watchlistItemId,
    alertIds: input.row.matchedAlertIds,
    alertDetailPaths: input.row.alertDetailPaths,
    casePaths: input.row.casePaths,
    sourceFamilies: sourceRow?.sourceFamilies ?? input.row.sourceFamilies,
    captureIds: sourceRow?.captureIds ?? input.row.provenance.captureIds,
    webhookDestinationIds: uniqueStrings(fixtureDeliveries.flatMap((delivery) => delivery.destinationIds)),
    matchedDeliveryIds: uniqueStrings(reconciliationRows.flatMap((row) => row.matchedDeliveryIds)),
    sourceRebuildReceiptIds: uniqueStrings(sourceRebuildReceipts.map((receipt) => receipt.id)),
    stages: {
      workflowBridge: input.row.ready,
      sourceEvidence: sourceReady,
      sourceRebuildReceipt: sourceRebuildReady,
      webhookFixture: fixtureReady,
      webhookReconciliation: reconciliationReady
    },
    ready: input.row.ready
      && sourceReady === true
      && (sourceRebuildReady === true || sourceRebuildReady === "not_required")
      && fixtureReady === true
      && (reconciliationReady === true || reconciliationReady === "not_required")
      && blockerCodes.length === 0,
    blockerCodes
  };
}

function caseActionRow(row: OrgAlertOperatorReadinessRow): OrgAlertCaseActionRow {
  const blockedActions = caseBlockedActions(row);
  const allowedActions = row.ready ? caseAllowedActions(row) : [];
  return {
    rowId: row.rowId,
    watchlistId: row.watchlistId,
    watchlistItemId: row.watchlistItemId,
    alertIds: row.alertIds,
    casePaths: row.casePaths,
    alertDetailPaths: row.alertDetailPaths,
    webhookDestinationIds: row.webhookDestinationIds,
    matchedDeliveryIds: row.matchedDeliveryIds,
    sourceFamilies: row.sourceFamilies,
    captureCount: row.captureIds.length,
    ready: row.ready,
    allowedActions,
    blockedActions
  };
}

function caseAllowedActions(row: OrgAlertOperatorReadinessRow): OrgAlertCaseAction[] {
  const alertId = row.alertIds[0] ?? "";
  const casePath = row.casePaths[0];
  const alertDetailPath = row.alertDetailPaths[0];
  const deliveryId = row.matchedDeliveryIds[0];
  return [
    {
      action: "open_case",
      ownerLane: "case",
      route: casePath ?? `/v1/cases?alertId=${encodeURIComponent(alertId)}`,
      method: "GET",
      reason: "Open the linked alert case.",
      blockerCodes: []
    },
    ...(alertDetailPath ? [{
      action: "review_alert" as const,
      ownerLane: "alert" as const,
      route: alertDetailPath,
      method: "GET" as const,
      reason: "Review the preserved alert detail.",
      blockerCodes: []
    }] : []),
    ...(deliveryId ? [{
      action: "review_delivery" as const,
      ownerLane: "webhook" as const,
      route: `/v1/dwm/webhook-deliveries/${encodeURIComponent(deliveryId)}`,
      method: "GET" as const,
      reason: "Review the matched webhook delivery.",
      blockerCodes: []
    }] : [])
  ];
}

function caseBlockedActions(row: OrgAlertOperatorReadinessRow): OrgAlertCaseAction[] {
  const blockerCodes = uniqueStrings(row.blockerCodes);
  const actions: OrgAlertCaseAction[] = [];
  const sourceBlockers = blockerCodes.filter((code) => code.includes("source") || code.includes("capture") || code.includes("provenance"));
  const webhookBlockers = blockerCodes.filter((code) => code.includes("webhook") || code.includes("delivery"));
  const alertBlockers = blockerCodes.filter((code) => code.includes("alert") || code.includes("rebuild"));
  if (sourceBlockers.length) {
    actions.push({
      action: "restore_source_evidence",
      ownerLane: "source",
      route: "/v1/dwm/source-requests",
      method: "POST",
      reason: "Restore source evidence before case action can continue.",
      blockerCodes: sourceBlockers
    });
  }
  if (webhookBlockers.length) {
    actions.push({
      action: "deliver_webhook",
      ownerLane: "webhook",
      route: "/v1/dwm/webhooks/deliver",
      method: "POST",
      reason: "Repair webhook delivery before case action can continue.",
      blockerCodes: webhookBlockers
    });
  }
  if (alertBlockers.length) {
    actions.push({
      action: "rebuild_alerts",
      ownerLane: "alert",
      route: "/v1/dwm/alerts/rebuild",
      method: "POST",
      reason: "Rebuild or repair alert workflow output.",
      blockerCodes: alertBlockers
    });
  }
  return actions;
}

function operatorBlocker(
  stage: OrgAlertOperatorReadinessBlocker["stage"],
  blocker: {
    code: OrgAlertOperatorReadinessBlocker["code"];
    ownerLane: OrgAlertOperatorReadinessBlocker["ownerLane"];
    rowId?: string;
    alertId?: string;
    watchlistId?: string;
    watchlistItemId?: string;
    path: string;
    message: string;
  }
): OrgAlertOperatorReadinessBlocker {
  return {
    code: blocker.code,
    ownerLane: blocker.ownerLane,
    stage,
    rowId: blocker.rowId,
    alertId: blocker.alertId,
    watchlistId: blocker.watchlistId,
    watchlistItemId: blocker.watchlistItemId,
    path: blocker.path,
    message: blocker.message
  };
}

function missingOperatorReportBlocker(
  code: Extract<OrgAlertOperatorReadinessBlocker["code"], "missing_source_evidence_report" | "missing_source_rebuild_receipt_report" | "missing_webhook_fixture_report" | "missing_webhook_reconciliation_report">,
  stage: OrgAlertOperatorReadinessBlocker["stage"],
  ownerLane: OrgAlertOperatorReadinessBlocker["ownerLane"],
  row: OrgAlertWorkflowBridgeRow
): OrgAlertOperatorReadinessBlocker {
  return {
    code,
    ownerLane,
    stage,
    rowId: row.rowId,
    alertId: row.matchedAlertIds[0],
    watchlistId: row.watchlistId,
    watchlistItemId: row.watchlistItemId,
    path: stage,
    message: operatorMissingReportMessage(code)
  };
}

function operatorSourceRebuildReceiptBlocker(
  receipt: TiSourceProvenanceAlertRebuildReceipt,
  blocker: TiSourceProvenanceAlertRebuildReceiptBlocker,
  rows: OrgAlertWorkflowBridgeRow[]
): OrgAlertOperatorReadinessBlocker {
  const row = rows.find((candidate) => receiptMatchesOperatorRow(receipt, candidate));
  return {
    code: blocker.code,
    ownerLane: blocker.ownerLane,
    stage: "source_rebuild_receipt",
    rowId: row?.rowId,
    alertId: receipt.matches.alertIds[0] ?? row?.matchedAlertIds[0],
    watchlistId: row?.watchlistId,
    watchlistItemId: row?.watchlistItemId,
    path: blocker.path,
    message: blocker.message
  };
}

function receiptMatchesOperatorRow(receipt: TiSourceProvenanceAlertRebuildReceipt, row: OrgAlertWorkflowBridgeRow): boolean {
  if (row.matchedAlertIds.some((alertId) => receipt.matches.alertIds.includes(alertId))) return true;
  return Boolean(row.watchlistItemId && receipt.matches.watchlistItemIds.includes(row.watchlistItemId));
}

function operatorMissingReportMessage(code: OrgAlertOperatorReadinessBlocker["code"]): string {
  if (code === "missing_source_evidence_report") return "Source evidence report is required for operator readiness.";
  if (code === "missing_source_rebuild_receipt_report") return "Source provenance alert rebuild receipt is required for operator readiness.";
  if (code === "missing_webhook_fixture_report") return "Webhook fixture report is required for operator readiness.";
  if (code === "missing_webhook_reconciliation_report") return "Webhook delivery reconciliation is required for operator readiness.";
  return "Required operator readiness report is missing.";
}

function sourceEvidenceBlockers(row: OrgAlertSourceEvidenceRow): OrgAlertSourceEvidenceBlocker[] {
  return row.blockerCodes.map((code) => ({
    code,
    ownerLane: code === "bridge_row_not_ready" ? "alert" : "source",
    rowId: row.rowId,
    alertId: row.alertIds[0],
    watchlistId: row.watchlistId,
    watchlistItemId: row.watchlistItemId,
    sourceId: row.sourceIds[0],
    captureId: row.captureIds[0],
    path: sourceEvidencePathFor(code),
    message: sourceEvidenceMessageFor(code)
  }));
}

function sourceEvidencePathFor(code: OrgAlertSourceEvidenceBlocker["code"]): string {
  if (code === "bridge_row_not_ready") return "bridge.rows[].ready";
  if (code === "missing_source_family") return "bridge.rows[].sourceFamilies";
  if (code === "missing_source_provenance_summary") return "sourceProvenanceSummaries[].alertId";
  if (code === "source_provenance_identity_mismatch") return "sourceProvenanceSummaries[].organizationId";
  if (code === "missing_source_ref") return "sources[].sourceId";
  if (code === "inactive_source") return "sources[].status";
  if (code === "missing_capture_ref") return "captures[].captureId";
  if (code === "content_hash_mismatch") return "captures[].contentHash";
  return "captures[].collectedAt";
}

function sourceEvidenceMessageFor(code: OrgAlertSourceEvidenceBlocker["code"]): string {
  if (code === "bridge_row_not_ready") return "Org alert workflow bridge row is not ready.";
  if (code === "missing_source_family") return "No source family is attached to the alert evidence.";
  if (code === "missing_source_provenance_summary") return "A matched alert is missing its persisted source provenance summary.";
  if (code === "source_provenance_identity_mismatch") return "Persisted source provenance summary does not match the alert organization.";
  if (code === "missing_source_ref") return "Alert provenance references a source that is not present in the source evidence set.";
  if (code === "inactive_source") return "One or more evidence sources are not active.";
  if (code === "missing_capture_ref") return "Alert provenance references a capture that is not present in the source evidence set.";
  if (code === "content_hash_mismatch") return "Capture hash does not match the alert provenance hash.";
  return "Alert evidence is older than the allowed freshness window.";
}

function bridgeRow(input: {
  watchlist: OrgAlertWorkflowWatchlistRef;
  alerts: Record<string, any>[];
  previousByAlertId: Map<string, DwmAlertWorkflowContract>;
  tenantId: string;
  organizationId: string;
  checkedAt: string;
}): OrgAlertWorkflowBridgeRow {
  const normalizedTerm = normalizeTerm(input.watchlist.normalizedTerm ?? input.watchlist.term);
  const rowId = stableId("org_alert_workflow_bridge_row", `${input.tenantId}:${input.organizationId}:${input.watchlist.watchlistId}:${input.watchlist.watchlistItemId ?? ""}:${normalizedTerm}`);
  const matchedAlerts = input.alerts
    .filter((alert) => alertMatchesWatchlist(alert, input.watchlist, normalizedTerm))
    .filter((alert) => alertBelongsToOrg(alert, input.tenantId, input.organizationId));
  const matchedContracts = matchedAlerts.map((alert) => buildAlertWorkflowContract({ alert, checkedAt: input.checkedAt }));

  const preservationBlockers = matchedContracts.flatMap((contract) => {
    const before = input.previousByAlertId.get(contract.alertId);
    if (!before) return [];
    return validateAlertWorkflowPreservation({ before, after: contract, checkedAt: input.checkedAt }).blockers;
  });
  const provenance = mergeProvenance(matchedContracts);
  const casePaths = uniqueStrings(matchedContracts.map((alert) => alert.casePath).filter(Boolean).map(String));
  const alertDetailPaths = uniqueStrings(matchedAlerts.map(alertDetailPathFor).filter(Boolean).map(String));
  const sourceFamilies = uniqueStrings(matchedAlerts.flatMap(sourceFamiliesForAlert));
  const eventPayloads = matchedAlerts.map((alert) => bridgeEventPayload({
    alert,
    watchlist: input.watchlist,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    casePaths,
    sourceFamilies
  }));
  const blockerCodes = uniqueStrings([
    input.watchlist.status && input.watchlist.status !== "active" ? "inactive_watchlist" : undefined,
    !input.watchlist.alertGeneratorKey ? "missing_alert_generation_ref" : undefined,
    matchedContracts.length === 0 ? "alert_not_generated" : undefined,
    matchedContracts.some((alert) => alert.organizationId && alert.organizationId !== input.organizationId) ? "organization_scope_changed" : undefined,
    matchedContracts.length > 0 && alertDetailPaths.length === 0 ? "alert_detail_route_unavailable" : undefined,
    matchedAlerts.length > 0 && casePaths.length === 0 ? "case_route_unavailable" : undefined,
    matchedAlerts.length > 0 && provenance.evidenceCount === 0 && provenance.captureIds.length === 0 ? "provenance_missing" : undefined,
    preservationBlockers.length > 0 ? "workflow_not_preserved" : undefined
  ].filter(Boolean).map(String)) as OrgAlertWorkflowBridgeBlocker["code"][];

  return {
    rowId,
    watchlistId: input.watchlist.watchlistId,
    watchlistItemId: input.watchlist.watchlistItemId,
    term: input.watchlist.term,
    normalizedTerm,
    alertGeneratorKey: input.watchlist.alertGeneratorKey,
    matchedAlertIds: uniqueStrings(matchedContracts.map((alert) => alert.alertId)),
    alertDetailPaths,
    casePaths,
    sourceFamilies,
    workflowEventCount: matchedContracts.reduce((total, alert) => total + alert.workflowEventCount, 0),
    provenance,
    eventPayloads,
    ready: blockerCodes.length === 0,
    blockerCodes
  };
}

function rowBlockers(row: OrgAlertWorkflowBridgeRow): OrgAlertWorkflowBridgeBlocker[] {
  return row.blockerCodes.map((code) => ({
    code,
    ownerLane: ownerLaneFor(code),
    rowId: row.rowId,
    watchlistId: row.watchlistId,
    watchlistItemId: row.watchlistItemId,
    alertId: row.matchedAlertIds[0],
    path: pathFor(code),
    message: messageFor(code)
  }));
}

function alertMatchesWatchlist(alert: Record<string, any>, watchlist: OrgAlertWorkflowWatchlistRef, normalizedTerm: string): boolean {
  const workflow = alert.workflowContext ?? {};
  const webhook = alert.webhookContext ?? {};
  const delivery = alert.deliveryReadinessContext ?? {};
  const alertGeneratorKeys = uniqueStrings([
    ...(workflow.alertGeneratorKeys ?? []),
    ...(webhook.alertGeneratorKeys ?? []),
    ...(delivery.alertGeneratorKeys ?? [])
  ].map(String).filter(Boolean));
  const watchlistIds = uniqueStrings([
    ...(alert.watchlistIds ?? []),
    ...(workflow.watchlistIds ?? []),
    ...(delivery.watchlistIds ?? [])
  ].map(String).filter(Boolean));
  const watchlistItemIds = uniqueStrings([
    ...(alert.watchlistItemIds ?? []),
    ...(workflow.watchlistItemIds ?? []),
    ...(delivery.watchlistItemIds ?? [])
  ].map(String).filter(Boolean));
  const terms = uniqueStrings([
    alert.matchedTerm?.value,
    alert.company,
    alert.matchContext?.term,
    workflow.matchedTerm,
    delivery.matchedTerm
  ].filter(Boolean).map((term) => normalizeTerm(String(term))));

  if (watchlist.alertGeneratorKey && alertGeneratorKeys.includes(watchlist.alertGeneratorKey)) return true;
  if (watchlist.watchlistItemId && watchlistItemIds.includes(watchlist.watchlistItemId)) return true;
  if (terms.includes(normalizedTerm)) return true;
  return !watchlist.watchlistItemId && watchlistIds.includes(watchlist.watchlistId);
}

function alertBelongsToOrg(alert: Record<string, any>, tenantId: string, organizationId: string): boolean {
  const workflow = alert.workflowContext ?? {};
  const webhook = alert.webhookContext ?? {};
  const delivery = alert.deliveryReadinessContext ?? {};
  const alertTenantId = String(alert.tenantId ?? workflow.tenantId ?? webhook.tenantId ?? delivery.tenantId ?? "");
  const alertOrganizationId = String(alert.organizationId ?? workflow.organizationId ?? webhook.organizationId ?? delivery.organizationId ?? "");
  return alertTenantId === tenantId && (!alertOrganizationId || alertOrganizationId === organizationId);
}

function alertDetailPathFor(alert: Record<string, any>): string | undefined {
  return [
    alert.alertDetailPath,
    alert.workflowContext?.alertDetailPath,
    alert.webhookContext?.alertDetailPath,
    alert.deliveryReadinessContext?.alertDetailPath,
    alert.alertCreatedEvent?.alertDetailPath,
    alert.alertUpdatedEvent?.alertDetailPath
  ].find((value) => typeof value === "string" && value.trim().length > 0);
}

function sourceFamiliesForAlert(alert: Record<string, any>): string[] {
  return uniqueStrings([
    alert.sourceFamily,
    alert.workflowContext?.sourceFamily,
    alert.webhookContext?.sourceFamily,
    alert.deliveryReadinessContext?.sourceFamily,
    ...(Array.isArray(alert.evidence) ? alert.evidence.map((item: any) => item.sourceFamily) : [])
  ].filter(Boolean).map(String));
}

function bridgeEventPayload(input: {
  alert: Record<string, any>;
  watchlist: OrgAlertWorkflowWatchlistRef;
  tenantId: string;
  organizationId: string;
  casePaths: string[];
  sourceFamilies: string[];
}): OrgAlertWorkflowBridgeEventPayload {
  const contract = buildAlertWorkflowContract({ alert: input.alert });
  return {
    schemaVersion: "dwm.org_alert_workflow_event_payload.v1",
    alertId: contract.alertId,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    watchlistId: input.watchlist.watchlistId,
    watchlistItemId: input.watchlist.watchlistItemId,
    alertGeneratorKey: input.watchlist.alertGeneratorKey,
    alertDetailPath: alertDetailPathFor(input.alert),
    casePaths: input.casePaths,
    sourceFamilies: input.sourceFamilies,
    captureIds: contract.provenance.captureIds,
    evidenceCount: contract.provenance.evidenceCount,
    workflowEventCount: contract.workflowEventCount,
    dedupeKey: contract.dedupeKey
  };
}

function webhookDeliveryFor(input: {
  row: OrgAlertWorkflowBridgeRow;
  payload?: OrgAlertWorkflowBridgeEventPayload;
  bridge: OrgAlertWorkflowBridgeReport;
  destinationById: Map<string, OrgAlertWebhookDestinationRef>;
  destinationIds: string[];
}): OrgAlertWebhookFixtureDelivery {
  const destinations = input.destinationIds.map((destinationId) => input.destinationById.get(destinationId)).filter(Boolean) as OrgAlertWebhookDestinationRef[];
  const destinationKinds = uniqueStrings(destinations.map((destination) => destination.kind ?? "webhook"));
  const alertId = input.payload?.alertId ?? input.row.matchedAlertIds[0] ?? "";
  const blockerCodes = uniqueStrings([
    !input.row.ready ? "bridge_row_not_ready" : undefined,
    !input.payload ? "missing_alert_event_payload" : undefined,
    input.destinationIds.length === 0 ? "missing_webhook_destination" : undefined,
    input.destinationIds.some((destinationId) => !input.destinationById.has(destinationId)) ? "webhook_destination_not_found" : undefined,
    destinations.some((destination) => destination.tenantId !== input.bridge.tenantId || destination.organizationId !== input.bridge.organizationId) ? "webhook_destination_scope_mismatch" : undefined,
    destinations.some((destination) => destination.status !== "active" || destination.verified !== true) ? "webhook_destination_not_verified" : undefined
  ].filter(Boolean).map(String)) as OrgAlertWebhookFixtureBlocker["code"][];

  return {
    deliveryId: stableId("org_alert_webhook_delivery", `${input.bridge.tenantId}:${input.bridge.organizationId}:${input.row.rowId}:${alertId}:${input.destinationIds.join(",")}`),
    rowId: input.row.rowId,
    alertId,
    watchlistId: input.row.watchlistId,
    watchlistItemId: input.row.watchlistItemId,
    ready: blockerCodes.length === 0,
    blockerCodes,
    destinationIds: input.destinationIds,
    destinationKinds,
    payload: {
      schemaVersion: DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION,
      tenantId: input.bridge.tenantId,
      organizationId: input.bridge.organizationId,
      alertId,
      watchlistId: input.row.watchlistId,
      watchlistItemId: input.row.watchlistItemId,
      webhookDestinationIds: input.destinationIds,
      deliveryKind: destinationKinds.includes("discord") ? "discord" : destinationKinds[0] ?? "webhook",
      alertDetailPath: input.payload?.alertDetailPath,
      casePaths: input.payload?.casePaths ?? input.row.casePaths,
      sourceFamilies: input.payload?.sourceFamilies ?? input.row.sourceFamilies,
      captureIds: input.payload?.captureIds ?? input.row.provenance.captureIds,
      evidenceCount: input.payload?.evidenceCount ?? input.row.provenance.evidenceCount,
      workflowEventCount: input.payload?.workflowEventCount ?? input.row.workflowEventCount,
      dedupeKey: input.payload?.dedupeKey,
      idempotencyKey: stableId("org_alert_webhook_idempotency", `${input.bridge.organizationId}:${alertId}:${input.row.watchlistId}:${input.row.watchlistItemId ?? ""}:${input.destinationIds.join(",")}`)
    }
  };
}

function destinationIdsForRow(
  row: OrgAlertWorkflowBridgeRow,
  byWatchlistId?: Record<string, string[]>,
  byWatchlistItemId?: Record<string, string[]>
): string[] {
  return uniqueStrings([
    ...(byWatchlistId?.[row.watchlistId] ?? []),
    ...(row.watchlistItemId ? byWatchlistItemId?.[row.watchlistItemId] ?? [] : [])
  ]);
}

function deliveryBlockers(
  delivery: OrgAlertWebhookFixtureDelivery,
  bridge: OrgAlertWorkflowBridgeReport,
  destinationById: Map<string, OrgAlertWebhookDestinationRef>
): OrgAlertWebhookFixtureBlocker[] {
  return delivery.blockerCodes.flatMap((code) => {
    if (code === "webhook_destination_not_found" || code === "webhook_destination_scope_mismatch" || code === "webhook_destination_not_verified") {
      const destinationIds = delivery.destinationIds.length ? delivery.destinationIds : [undefined];
      return destinationIds
        .filter((destinationId) => shouldReportDestinationBlocker(code, destinationId, bridge, destinationById))
        .map((destinationId) => webhookBlocker(code, delivery, destinationId));
    }
    return [webhookBlocker(code, delivery)];
  });
}

function shouldReportDestinationBlocker(
  code: OrgAlertWebhookFixtureBlocker["code"],
  destinationId: string | undefined,
  bridge: OrgAlertWorkflowBridgeReport,
  destinationById: Map<string, OrgAlertWebhookDestinationRef>
): boolean {
  if (!destinationId) return false;
  const destination = destinationById.get(destinationId);
  if (code === "webhook_destination_not_found") return !destination;
  if (!destination) return false;
  if (code === "webhook_destination_scope_mismatch") return destination.tenantId !== bridge.tenantId || destination.organizationId !== bridge.organizationId;
  if (code === "webhook_destination_not_verified") return destination.status !== "active" || destination.verified !== true;
  return false;
}

function webhookBlocker(
  code: OrgAlertWebhookFixtureBlocker["code"],
  delivery: OrgAlertWebhookFixtureDelivery,
  destinationId?: string
): OrgAlertWebhookFixtureBlocker {
  return {
    code,
    ownerLane: webhookOwnerLaneFor(code),
    rowId: delivery.rowId,
    alertId: delivery.alertId || undefined,
    watchlistId: delivery.watchlistId,
    watchlistItemId: delivery.watchlistItemId,
    destinationId,
    path: webhookPathFor(code),
    message: webhookMessageFor(code)
  };
}

function webhookOwnerLaneFor(code: OrgAlertWebhookFixtureBlocker["code"]): OrgAlertWebhookFixtureBlocker["ownerLane"] {
  if (code === "bridge_row_not_ready") return "alert";
  if (code === "missing_alert_event_payload") return "alert";
  return "webhook";
}

function webhookPathFor(code: OrgAlertWebhookFixtureBlocker["code"]): string {
  if (code === "bridge_row_not_ready") return "bridge.rows[].ready";
  if (code === "missing_alert_event_payload") return "bridge.rows[].eventPayloads";
  if (code === "missing_webhook_destination") return "destinationIdsByWatchlistId";
  if (code === "webhook_destination_scope_mismatch") return "destinations[].organizationId";
  if (code === "webhook_destination_not_verified") return "destinations[].verified";
  return "destinations[].destinationId";
}

function webhookMessageFor(code: OrgAlertWebhookFixtureBlocker["code"]): string {
  if (code === "bridge_row_not_ready") return "Org alert workflow bridge row is not ready for delivery.";
  if (code === "missing_alert_event_payload") return "Org alert workflow bridge row has no alert event payload.";
  if (code === "missing_webhook_destination") return "No webhook destination is mapped to this watchlist row.";
  if (code === "webhook_destination_scope_mismatch") return "Webhook destination does not belong to the alert organization.";
  if (code === "webhook_destination_not_verified") return "Webhook destination is not active and verified.";
  return "Webhook destination is not available.";
}

function reconcileDeliveryRow(
  delivery: OrgAlertWebhookFixtureDelivery,
  fixture: OrgAlertWebhookFixtureContract,
  attempts: OrgAlertWebhookDeliveryAttemptRef[]
): OrgAlertWebhookDeliveryReconciliationRow {
  const matches = attempts.filter((attempt) => attemptMatchesDelivery(delivery, fixture, attempt));
  const matchesByDestination = new Map(delivery.destinationIds.map((destinationId) => [
    destinationId,
    matches.filter((attempt) => attempt.webhookDestinationId === destinationId)
  ]));
  const blockerCodes = uniqueStrings([
    !delivery.ready ? "fixture_delivery_not_ready" : undefined,
    ...delivery.destinationIds.map((destinationId) => (matchesByDestination.get(destinationId)?.length ? undefined : "missing_delivery_attempt")),
    ...delivery.destinationIds.map((destinationId) => ((matchesByDestination.get(destinationId)?.length ?? 0) > 1 ? "duplicate_delivery_attempt" : undefined)),
    ...matches.map((attempt) => attempt.tenantId !== fixture.tenantId || attempt.organizationId !== fixture.organizationId || attempt.alertId !== delivery.alertId ? "delivery_identity_mismatch" : undefined),
    ...matches.map((attempt) => !delivery.destinationIds.includes(attempt.webhookDestinationId) ? "delivery_destination_mismatch" : undefined),
    ...matches.map((attempt) => attempt.idempotencyKey && attempt.idempotencyKey !== delivery.payload.idempotencyKey ? "delivery_idempotency_mismatch" : undefined),
    ...matches.map((attempt) => attempt.status !== "delivered" ? "delivery_not_delivered" : undefined),
    ...matches.map((attempt) => attempt.dryRun ? "dry_run_delivery" : undefined)
  ].filter(Boolean).map(String)) as OrgAlertWebhookDeliveryReconciliationBlocker["code"][];
  const endpointHashes = uniqueStrings(matches.map((attempt) => attempt.endpointHash).filter(Boolean).map(String));
  const attemptedAt = uniqueStrings(matches.map((attempt) => attempt.attemptedAt).filter(Boolean).map(String));

  return {
    rowId: stableId("org_alert_webhook_reconciliation_row", `${fixture.tenantId}:${fixture.organizationId}:${delivery.deliveryId}:${matches.map((attempt) => attempt.deliveryId).join(",")}`),
    plannedDeliveryId: delivery.deliveryId,
    alertId: delivery.alertId,
    watchlistId: delivery.watchlistId,
    watchlistItemId: delivery.watchlistItemId,
    destinationIds: delivery.destinationIds,
    matchedDeliveryIds: uniqueStrings(matches.map((attempt) => attempt.deliveryId)),
    status: blockerCodes.length === 0 ? "delivered" : "blocked",
    ready: blockerCodes.length === 0,
    blockerCodes,
    audit: {
      redacted: true,
      idempotencyKey: delivery.payload.idempotencyKey,
      payloadHash: matches.find((attempt) => attempt.payloadHash)?.payloadHash,
      endpointHashes,
      attemptedAt
    }
  };
}

function attemptMatchesDelivery(
  delivery: OrgAlertWebhookFixtureDelivery,
  fixture: OrgAlertWebhookFixtureContract,
  attempt: OrgAlertWebhookDeliveryAttemptRef
): boolean {
  if (attempt.idempotencyKey && attempt.idempotencyKey === delivery.payload.idempotencyKey) return true;
  if (attempt.tenantId !== fixture.tenantId) return false;
  if (attempt.organizationId !== fixture.organizationId) return false;
  if (attempt.alertId !== delivery.alertId) return false;
  return delivery.destinationIds.includes(attempt.webhookDestinationId);
}

function reconciliationBlockers(
  row: OrgAlertWebhookDeliveryReconciliationRow,
  fixture: OrgAlertWebhookFixtureContract
): OrgAlertWebhookDeliveryReconciliationBlocker[] {
  const delivery = fixture.deliveries.find((item) => item.deliveryId === row.plannedDeliveryId);
  return row.blockerCodes.flatMap((code) => {
    if (code === "missing_delivery_attempt" || code === "duplicate_delivery_attempt") {
      return row.destinationIds.map((destinationId) => reconciliationBlocker(code, row, destinationId));
    }
    if (code === "delivery_not_delivered" || code === "dry_run_delivery" || code === "delivery_idempotency_mismatch") {
      return row.matchedDeliveryIds.map((deliveryId) => reconciliationBlocker(code, row, undefined, deliveryId));
    }
    return [reconciliationBlocker(code, row, delivery?.destinationIds[0])];
  });
}

function reconciliationBlocker(
  code: OrgAlertWebhookDeliveryReconciliationBlocker["code"],
  row: OrgAlertWebhookDeliveryReconciliationRow,
  destinationId?: string,
  deliveryId?: string
): OrgAlertWebhookDeliveryReconciliationBlocker {
  return {
    code,
    ownerLane: code === "fixture_delivery_not_ready" || code === "delivery_identity_mismatch" ? "alert" : "webhook",
    rowId: row.rowId,
    plannedDeliveryId: row.plannedDeliveryId,
    alertId: row.alertId,
    destinationId,
    deliveryId,
    path: reconciliationPathFor(code),
    message: reconciliationMessageFor(code)
  };
}

function reconciliationPathFor(code: OrgAlertWebhookDeliveryReconciliationBlocker["code"]): string {
  if (code === "fixture_delivery_not_ready") return "fixture.deliveries[].ready";
  if (code === "missing_delivery_attempt") return "attempts";
  if (code === "duplicate_delivery_attempt") return "attempts[].webhookDestinationId";
  if (code === "delivery_identity_mismatch") return "attempts[].organizationId";
  if (code === "delivery_destination_mismatch") return "attempts[].webhookDestinationId";
  if (code === "delivery_idempotency_mismatch") return "attempts[].idempotencyKey";
  if (code === "dry_run_delivery") return "attempts[].dryRun";
  return "attempts[].status";
}

function reconciliationMessageFor(code: OrgAlertWebhookDeliveryReconciliationBlocker["code"]): string {
  if (code === "fixture_delivery_not_ready") return "Planned webhook delivery is not ready.";
  if (code === "missing_delivery_attempt") return "No webhook delivery attempt matched the planned destination.";
  if (code === "duplicate_delivery_attempt") return "More than one webhook delivery attempt matched the planned destination.";
  if (code === "delivery_identity_mismatch") return "Webhook delivery attempt identity does not match the planned organization alert.";
  if (code === "delivery_destination_mismatch") return "Webhook delivery attempt used an unexpected destination.";
  if (code === "delivery_idempotency_mismatch") return "Webhook delivery attempt idempotency key does not match the planned payload.";
  if (code === "dry_run_delivery") return "Webhook delivery attempt was a dry run.";
  return "Webhook delivery attempt was not delivered.";
}

function mergeProvenance(contracts: DwmAlertWorkflowContract[]): OrgAlertWorkflowBridgeRow["provenance"] {
  return {
    evidenceCount: contracts.reduce((total, contract) => total + contract.provenance.evidenceCount, 0),
    captureIds: uniqueStrings(contracts.flatMap((contract) => contract.provenance.captureIds)),
    sourceIds: uniqueStrings(contracts.flatMap((contract) => contract.provenance.sourceIds)),
    contentHashes: uniqueStrings(contracts.flatMap((contract) => contract.provenance.contentHashes))
  };
}

function ownerLaneFor(code: OrgAlertWorkflowBridgeBlocker["code"]): OrgAlertWorkflowBridgeBlocker["ownerLane"] {
  if (code === "inactive_watchlist" || code === "missing_alert_generation_ref") return "watchlist";
  if (code === "case_route_unavailable") return "case";
  if (code === "provenance_missing") return "source";
  return "alert";
}

function pathFor(code: OrgAlertWorkflowBridgeBlocker["code"]): string {
  if (code === "inactive_watchlist") return "watchlist.status";
  if (code === "missing_alert_generation_ref") return "watchlist.alertGeneratorKey";
  if (code === "alert_detail_route_unavailable") return "alert.alertDetailPath";
  if (code === "case_route_unavailable") return "alert.casePath";
  if (code === "provenance_missing") return "alert.provenance";
  if (code === "organization_scope_changed") return "alert.organizationId";
  if (code === "workflow_not_preserved") return "alert.workflow";
  return "alert.id";
}

function messageFor(code: OrgAlertWorkflowBridgeBlocker["code"]): string {
  if (code === "inactive_watchlist") return "Watchlist item is not active.";
  if (code === "missing_alert_generation_ref") return "Watchlist item is missing an alert generation reference.";
  if (code === "alert_detail_route_unavailable") return "Matched alert is missing a detail route.";
  if (code === "case_route_unavailable") return "Matched alert is missing a case route.";
  if (code === "provenance_missing") return "Matched alert is missing evidence provenance.";
  if (code === "organization_scope_changed") return "Matched alert does not belong to the requested organization.";
  if (code === "workflow_not_preserved") return "Matched alert dropped workflow state compared with the previous record.";
  return "No alert exists for this watchlist item.";
}

function normalizeTerm(value: string) {
  return String(value).trim().toLowerCase();
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

function newestTimestamp(values: Array<string | undefined>) {
  const timestamps = values
    .map((value) => Date.parse(String(value ?? "")))
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

function hoursBetween(from: string, to: string) {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return undefined;
  return Math.max(0, (toMs - fromMs) / 3600000);
}
