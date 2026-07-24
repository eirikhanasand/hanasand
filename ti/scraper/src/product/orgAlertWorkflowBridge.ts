import { stableId, uniqueStrings } from "../utils.ts";
import {
  buildAlertWorkflowContract,
  validateAlertWorkflowPreservation,
  type DwmAlertWorkflowContract
} from "./alertWorkflowContract.ts";

export const DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION = "dwm.org_alert_workflow_bridge.v1" as const;
export const DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION = "dwm.org_alert_case_action_receipt.v1" as const;
export const DWM_ORG_ALERT_CASE_ACTION_LEDGER_SCHEMA_VERSION = "dwm.org_alert_case_action_ledger.v1" as const;
export const DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION = "dwm.org_alert_case_action_audit_event.v1" as const;

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

export type OrgAlertCaseAction = {
  action: "open_case" | "review_alert" | "review_delivery" | "restore_source_evidence" | "rebuild_alerts" | "deliver_webhook";
  ownerLane: "case" | "alert" | "source" | "webhook";
  route: string;
  method: "GET" | "POST";
  reason: string;
  blockerCodes: string[];
};

export type OrgAlertCaseActionReceipt = {
  schemaVersion: typeof DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION;
  id: string;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  rowId?: string;
  watchlistId?: string;
  watchlistItemId?: string;
  alertIds: string[];
  casePaths: string[];
  action: OrgAlertCaseAction["action"];
  execution: "ready" | "repair_required" | "blocked";
  ownerLane?: OrgAlertCaseAction["ownerLane"];
  route?: string;
  method?: OrgAlertCaseAction["method"];
  analyst?: {
    analystId?: string;
    rationale?: string;
  };
  blockedByCodes: string[];
  blockers: OrgAlertCaseActionReceiptBlocker[];
  payloadShape: string[];
};

export type OrgAlertCaseActionReceiptBlocker = {
  code: "row_not_found" | "action_not_available" | "missing_rationale";
  ownerLane: "case" | "alert" | "source" | "webhook";
  rowId?: string;
  path: string;
  message: string;
};

export type OrgAlertCaseActionLedgerRecord = {
  schemaVersion: typeof DWM_ORG_ALERT_CASE_ACTION_LEDGER_SCHEMA_VERSION;
  id: string;
  receiptId: string;
  dedupeKey: string;
  recordedAt: string;
  tenantId: string;
  organizationId: string;
  rowId?: string;
  watchlistId?: string;
  watchlistItemId?: string;
  alertIds: string[];
  casePaths: string[];
  action: OrgAlertCaseAction["action"];
  execution: OrgAlertCaseActionReceipt["execution"];
  ownerLane?: OrgAlertCaseAction["ownerLane"];
  route?: string;
  method?: OrgAlertCaseAction["method"];
  analystId?: string;
  rationaleRecorded: boolean;
  receiptOk: boolean;
  blockedByCodes: string[];
  auditEvent: OrgAlertCaseActionAuditEvent;
};

export type OrgAlertCaseActionAuditEvent = {
  schemaVersion: typeof DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION;
  id: string;
  at: string;
  tenantId: string;
  organizationId: string;
  receiptId: string;
  action: OrgAlertCaseAction["action"];
  execution: OrgAlertCaseActionReceipt["execution"];
  ownerLane?: OrgAlertCaseAction["ownerLane"];
  alertIds: string[];
  casePaths: string[];
  watchlistId?: string;
  watchlistItemId?: string;
  analystId?: string;
  blockedByCodes: string[];
  route?: string;
  safeOutput: {
    rawEvidenceExposed: false;
    webhookSecretExposed: false;
  };
};

export type OrgAlertCaseActionLedgerBlocker = {
  code: "duplicate_receipt" | "receipt_not_ready" | "tenant_scope_mismatch" | "organization_scope_mismatch";
  ownerLane: "case" | "alert" | "source" | "webhook";
  receiptId: string;
  path: string;
  message: string;
};

export type OrgAlertCaseActionLedgerResult = {
  ok: boolean;
  created: boolean;
  record?: OrgAlertCaseActionLedgerRecord;
  records: OrgAlertCaseActionLedgerRecord[];
  blockers: OrgAlertCaseActionLedgerBlocker[];
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

export function recordOrgAlertCaseActionReceipt(input: {
  records: OrgAlertCaseActionLedgerRecord[];
  receipt: OrgAlertCaseActionReceipt;
  tenantId: string;
  organizationId: string;
  recordedAt?: string;
  allowBlockedReceipt?: boolean;
}): OrgAlertCaseActionLedgerResult {
  const existing = input.records.find((record) => record.receiptId === input.receipt.id);
  if (existing) {
    return {
      ok: true,
      created: false,
      record: existing,
      records: input.records,
      blockers: []
    };
  }

  const blockers = caseActionLedgerBlockers(input.receipt, {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    allowBlockedReceipt: input.allowBlockedReceipt === true
  });
  if (blockers.length) {
    return {
      ok: false,
      created: false,
      records: input.records,
      blockers
    };
  }

  const recordedAt = input.recordedAt ?? input.receipt.checkedAt;
  const record = caseActionLedgerRecord(input.receipt, recordedAt);
  return {
    ok: true,
    created: true,
    record,
    records: [...input.records, record],
    blockers: []
  };
}

function caseActionLedgerRecord(receipt: OrgAlertCaseActionReceipt, recordedAt: string): OrgAlertCaseActionLedgerRecord {
  const dedupeKey = stableId("org_alert_case_action_dedupe", `${receipt.tenantId}:${receipt.organizationId}:${receipt.id}`);
  return {
    schemaVersion: DWM_ORG_ALERT_CASE_ACTION_LEDGER_SCHEMA_VERSION,
    id: stableId("org_alert_case_action_ledger", `${dedupeKey}:${recordedAt}`),
    receiptId: receipt.id,
    dedupeKey,
    recordedAt,
    tenantId: receipt.tenantId,
    organizationId: receipt.organizationId,
    rowId: receipt.rowId,
    watchlistId: receipt.watchlistId,
    watchlistItemId: receipt.watchlistItemId,
    alertIds: receipt.alertIds,
    casePaths: receipt.casePaths,
    action: receipt.action,
    execution: receipt.execution,
    ownerLane: receipt.ownerLane,
    route: receipt.route,
    method: receipt.method,
    analystId: receipt.analyst?.analystId,
    rationaleRecorded: Boolean(receipt.analyst?.rationale?.trim()),
    receiptOk: receipt.ok,
    blockedByCodes: receipt.blockedByCodes,
    auditEvent: caseActionAuditEvent(receipt, recordedAt, dedupeKey)
  };
}

function caseActionAuditEvent(
  receipt: OrgAlertCaseActionReceipt,
  recordedAt: string,
  dedupeKey: string
): OrgAlertCaseActionAuditEvent {
  return {
    schemaVersion: DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION,
    id: stableId("org_alert_case_action_audit", `${dedupeKey}:${recordedAt}`),
    at: recordedAt,
    tenantId: receipt.tenantId,
    organizationId: receipt.organizationId,
    receiptId: receipt.id,
    action: receipt.action,
    execution: receipt.execution,
    ownerLane: receipt.ownerLane,
    alertIds: receipt.alertIds,
    casePaths: receipt.casePaths,
    watchlistId: receipt.watchlistId,
    watchlistItemId: receipt.watchlistItemId,
    analystId: receipt.analyst?.analystId,
    blockedByCodes: receipt.blockedByCodes,
    route: receipt.route,
    safeOutput: {
      rawEvidenceExposed: false,
      webhookSecretExposed: false
    }
  };
}

function caseActionLedgerBlockers(
  receipt: OrgAlertCaseActionReceipt,
  input: { tenantId: string; organizationId: string; allowBlockedReceipt: boolean }
): OrgAlertCaseActionLedgerBlocker[] {
  return [
    receipt.tenantId !== input.tenantId
      ? caseActionLedgerBlocker(
          "tenant_scope_mismatch",
          receipt.ownerLane ?? "case",
          receipt.id,
          "receipt.tenantId",
          "Case action receipt tenant does not match ledger scope."
        )
      : undefined,
    receipt.organizationId !== input.organizationId
      ? caseActionLedgerBlocker(
          "organization_scope_mismatch",
          receipt.ownerLane ?? "case",
          receipt.id,
          "receipt.organizationId",
          "Case action receipt organization does not match ledger scope."
        )
      : undefined,
    !receipt.ok && !input.allowBlockedReceipt
      ? caseActionLedgerBlocker(
          "receipt_not_ready",
          receipt.ownerLane ?? "case",
          receipt.id,
          "receipt.ok",
          "Case action receipt has unresolved blockers."
        )
      : undefined
  ].filter(Boolean) as OrgAlertCaseActionLedgerBlocker[];
}

function caseActionLedgerBlocker(
  code: OrgAlertCaseActionLedgerBlocker["code"],
  ownerLane: OrgAlertCaseActionLedgerBlocker["ownerLane"],
  receiptId: string,
  path: string,
  message: string
): OrgAlertCaseActionLedgerBlocker {
  return { code, ownerLane, receiptId, path, message };
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
  const rowId = stableId(
    "org_alert_workflow_bridge_row",
    `${input.tenantId}:${input.organizationId}:${input.watchlist.watchlistId}:${input.watchlist.watchlistItemId ?? ""}:${normalizedTerm}`
  );
  const matchedAlerts = input.alerts
    .filter((alert) => alertMatchesWatchlist(alert, input.watchlist, normalizedTerm))
    .filter((alert) => alertBelongsToOrg(alert, input.tenantId, input.organizationId));
  const matchedContracts = matchedAlerts.map((alert) =>
    buildAlertWorkflowContract({ alert, checkedAt: input.checkedAt })
  );

  const preservationBlockers = matchedContracts.flatMap((contract) => {
    const before = input.previousByAlertId.get(contract.alertId);
    if (!before) return [];
    return validateAlertWorkflowPreservation({ before, after: contract, checkedAt: input.checkedAt }).blockers;
  });
  const provenance = mergeProvenance(matchedContracts);
  const casePaths = uniqueStrings(matchedContracts.map((alert) => alert.casePath).filter(Boolean).map(String));
  const alertDetailPaths = uniqueStrings(matchedAlerts.map(alertDetailPathFor).filter(Boolean).map(String));
  const sourceFamilies = uniqueStrings(matchedAlerts.flatMap(sourceFamiliesForAlert));
  const eventPayloads = matchedAlerts.map((alert) =>
    bridgeEventPayload({
      alert,
      watchlist: input.watchlist,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      casePaths,
      sourceFamilies
    })
  );
  const blockerCodes = uniqueStrings(
    [
      input.watchlist.status && input.watchlist.status !== "active" ? "inactive_watchlist" : undefined,
      !input.watchlist.alertGeneratorKey ? "missing_alert_generation_ref" : undefined,
      matchedContracts.length === 0 ? "alert_not_generated" : undefined,
      matchedContracts.some((alert) => alert.organizationId && alert.organizationId !== input.organizationId)
        ? "organization_scope_changed"
        : undefined,
      matchedContracts.length > 0 && alertDetailPaths.length === 0
        ? "alert_detail_route_unavailable"
        : undefined,
      matchedAlerts.length > 0 && casePaths.length === 0 ? "case_route_unavailable" : undefined,
      matchedAlerts.length > 0 && provenance.evidenceCount === 0 && provenance.captureIds.length === 0
        ? "provenance_missing"
        : undefined,
      preservationBlockers.length > 0 ? "workflow_not_preserved" : undefined
    ]
      .filter(Boolean)
      .map(String)
  ) as OrgAlertWorkflowBridgeBlocker["code"][];

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

function alertMatchesWatchlist(
  alert: Record<string, any>,
  watchlist: OrgAlertWorkflowWatchlistRef,
  normalizedTerm: string
): boolean {
  const workflow = alert.workflowContext ?? {};
  const webhook = alert.webhookContext ?? {};
  const delivery = alert.deliveryReadinessContext ?? {};
  const alertGeneratorKeys = uniqueStrings(
    [
      ...(workflow.alertGeneratorKeys ?? []),
      ...(webhook.alertGeneratorKeys ?? []),
      ...(delivery.alertGeneratorKeys ?? [])
    ]
      .map(String)
      .filter(Boolean)
  );
  const watchlistIds = uniqueStrings(
    [
      ...(alert.watchlistIds ?? []),
      ...(workflow.watchlistIds ?? []),
      ...(delivery.watchlistIds ?? [])
    ]
      .map(String)
      .filter(Boolean)
  );
  const watchlistItemIds = uniqueStrings(
    [
      ...(alert.watchlistItemIds ?? []),
      ...(workflow.watchlistItemIds ?? []),
      ...(delivery.watchlistItemIds ?? [])
    ]
      .map(String)
      .filter(Boolean)
  );
  const terms = uniqueStrings(
    [
      alert.matchedTerm?.value,
      alert.company,
      alert.matchContext?.term,
      workflow.matchedTerm,
      delivery.matchedTerm
    ]
      .filter(Boolean)
      .map((term) => normalizeTerm(String(term)))
  );

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
  const alertOrganizationId = String(
    alert.organizationId ?? workflow.organizationId ?? webhook.organizationId ?? delivery.organizationId ?? ""
  );
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
  return uniqueStrings(
    [
      alert.sourceFamily,
      alert.workflowContext?.sourceFamily,
      alert.webhookContext?.sourceFamily,
      alert.deliveryReadinessContext?.sourceFamily,
      ...(Array.isArray(alert.evidence) ? alert.evidence.map((item: any) => item.sourceFamily) : [])
    ]
      .filter(Boolean)
      .map(String)
  );
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
  if (code === "workflow_not_preserved") {
    return "Matched alert dropped workflow state compared with the previous record.";
  }
  return "No alert exists for this watchlist item.";
}

function normalizeTerm(value: string) {
  return String(value).trim().toLowerCase();
}
