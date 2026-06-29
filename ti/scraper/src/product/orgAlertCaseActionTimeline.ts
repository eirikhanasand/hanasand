import type { OrgAlertCaseActionLedgerApiRecord } from "../storage/orgAlertCaseActionLedgerPostgres.ts";
import { stableId, uniqueStrings } from "../utils.ts";

export const DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION = "dwm.org_alert_case_action_timeline.v1" as const;

export type OrgAlertCaseActionTimelineReport = {
  schemaVersion: typeof DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION;
  generatedAt: string;
  ok: boolean;
  tenantId?: string;
  organizationId?: string;
  casePath?: string;
  alertId?: string;
  rows: OrgAlertCaseActionTimelineRow[];
  blockers: OrgAlertCaseActionTimelineBlocker[];
  payloadShape: string[];
};

export type OrgAlertCaseActionTimelineRow = {
  id: string;
  eventType: "case_action_recorded";
  at: string;
  tenantId: string;
  organizationId: string;
  receiptId: string;
  action: string;
  execution: string;
  ownerLane?: string;
  route?: string;
  method?: string;
  analystId?: string;
  related: {
    watchlistId?: string;
    watchlistItemId?: string;
    alertIds: string[];
    casePaths: string[];
  };
  replay: {
    replayState: "recorded" | "blocked";
    idempotencyKey: string;
    dedupeKey: string;
    duplicate: false;
  };
  provenance: {
    source: "org_alert_case_action_ledger";
    recordId: string;
    receiptId: string;
    auditEventId: string;
    receiptOk: boolean;
    blockedByCodes: string[];
  };
};

export type OrgAlertCaseActionTimelineBlocker = {
  code:
    | "missing_tenant_scope"
    | "missing_organization_scope"
    | "record_scope_mismatch"
    | "record_case_path_mismatch"
    | "record_alert_mismatch"
    | "record_missing_audit_event"
    | "duplicate_receipt";
  ownerLane: "case";
  path: string;
  message: string;
  receiptId?: string;
  recordId?: string;
};

export function buildOrgAlertCaseActionTimeline(input: {
  tenantId?: string;
  organizationId?: string;
  casePath?: string;
  alertId?: string;
  records: OrgAlertCaseActionLedgerApiRecord[];
  generatedAt?: string;
}): OrgAlertCaseActionTimelineReport {
  const blockers = scopeBlockers(input.tenantId, input.organizationId);
  if (blockers.length) {
    return report(input, [], blockers);
  }

  const tenantId = String(input.tenantId);
  const organizationId = String(input.organizationId);
  const seenReceipts = new Set<string>();
  const rows: OrgAlertCaseActionTimelineRow[] = [];

  for (const record of input.records) {
    const recordBlockers = recordBlockersFor(record, { tenantId, organizationId, casePath: input.casePath, alertId: input.alertId }, seenReceipts);
    blockers.push(...recordBlockers);
    if (recordBlockers.length === 0) rows.push(timelineRow(record));
    seenReceipts.add(record.receiptId);
  }

  rows.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return report(input, rows, blockers);
}

function report(
  input: {
    tenantId?: string;
    organizationId?: string;
    casePath?: string;
    alertId?: string;
    generatedAt?: string;
  },
  rows: OrgAlertCaseActionTimelineRow[],
  blockers: OrgAlertCaseActionTimelineBlocker[]
): OrgAlertCaseActionTimelineReport {
  return {
    schemaVersion: DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
    ok: blockers.length === 0,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    casePath: input.casePath,
    alertId: input.alertId,
    rows,
    blockers,
    payloadShape: [
      "rows[].related.alertIds",
      "rows[].related.casePaths",
      "rows[].replay.dedupeKey",
      "rows[].replay.idempotencyKey",
      "rows[].provenance.recordId",
      "rows[].provenance.auditEventId",
      "blockers[]"
    ]
  };
}

function timelineRow(record: OrgAlertCaseActionLedgerApiRecord): OrgAlertCaseActionTimelineRow {
  return {
    id: stableId("org_alert_case_action_timeline", `${record.tenantId}:${record.organizationId}:${record.receiptId}:${record.auditEventId}`),
    eventType: "case_action_recorded",
    at: record.recordedAt,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    receiptId: record.receiptId,
    action: record.action,
    execution: record.execution,
    ownerLane: record.ownerLane,
    route: record.route,
    method: record.method,
    analystId: record.analystId,
    related: {
      watchlistId: record.watchlistId,
      watchlistItemId: record.watchlistItemId,
      alertIds: uniqueStrings(record.alertIds),
      casePaths: uniqueStrings(record.casePaths)
    },
    replay: replayStateFor(record),
    provenance: {
      source: "org_alert_case_action_ledger",
      recordId: record.id,
      receiptId: record.receiptId,
      auditEventId: record.auditEventId,
      receiptOk: record.receiptOk,
      blockedByCodes: uniqueStrings(record.blockedByCodes)
    }
  };
}

function replayStateFor(record: OrgAlertCaseActionLedgerApiRecord): OrgAlertCaseActionTimelineRow["replay"] {
  return {
    replayState: record.receiptOk && record.blockedByCodes.length === 0 ? "recorded" : "blocked",
    idempotencyKey: record.receiptId,
    dedupeKey: stableId("org_alert_case_action_replay", `${record.tenantId}:${record.organizationId}:${record.receiptId}`),
    duplicate: false
  };
}

function recordBlockersFor(
  record: OrgAlertCaseActionLedgerApiRecord,
  scope: { tenantId: string; organizationId: string; casePath?: string; alertId?: string },
  seenReceipts: Set<string>
): OrgAlertCaseActionTimelineBlocker[] {
  const blockers: OrgAlertCaseActionTimelineBlocker[] = [];
  if (record.tenantId !== scope.tenantId || record.organizationId !== scope.organizationId) {
    blockers.push(blocker("record_scope_mismatch", "records[].tenantId", "Ledger record belongs to another tenant or organization.", record));
  }
  if (scope.casePath && !record.casePaths.includes(scope.casePath)) {
    blockers.push(blocker("record_case_path_mismatch", "records[].casePaths", "Ledger record is not linked to the requested case path.", record));
  }
  if (scope.alertId && !record.alertIds.includes(scope.alertId)) {
    blockers.push(blocker("record_alert_mismatch", "records[].alertIds", "Ledger record is not linked to the requested alert.", record));
  }
  if (!record.auditEventId) {
    blockers.push(blocker("record_missing_audit_event", "records[].auditEventId", "Ledger record is missing its audit event id.", record));
  }
  if (seenReceipts.has(record.receiptId)) {
    blockers.push(blocker("duplicate_receipt", "records[].receiptId", "Ledger records must be unique by receipt id.", record));
  }
  return blockers;
}

function scopeBlockers(tenantId: string | undefined, organizationId: string | undefined): OrgAlertCaseActionTimelineBlocker[] {
  return [
    !tenantId ? blocker("missing_tenant_scope", "tenantId", "Timeline requires a tenant scope.") : undefined,
    !organizationId ? blocker("missing_organization_scope", "organizationId", "Timeline requires an organization scope.") : undefined
  ].filter(Boolean) as OrgAlertCaseActionTimelineBlocker[];
}

function blocker(
  code: OrgAlertCaseActionTimelineBlocker["code"],
  path: string,
  message: string,
  record?: OrgAlertCaseActionLedgerApiRecord
): OrgAlertCaseActionTimelineBlocker {
  return {
    code,
    ownerLane: "case",
    path,
    message,
    receiptId: record?.receiptId,
    recordId: record?.id
  };
}
