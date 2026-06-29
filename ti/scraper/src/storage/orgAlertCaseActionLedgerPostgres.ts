import type {
  OrgAlertCaseActionLedgerBlocker,
  OrgAlertCaseActionAuditEvent,
  OrgAlertCaseActionLedgerRecord,
  OrgAlertCaseActionReceipt
} from "../product/orgAlertWorkflowBridge.ts";
import { recordOrgAlertCaseActionReceipt } from "../product/orgAlertWorkflowBridge.ts";

export const DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION = "dwm.org_alert_case_action_ledger_api_list.v1" as const;
export const DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION = "dwm.org_alert_case_action_ledger_api_write.v1" as const;

export type OrgAlertCaseActionLedgerPostgresRows = {
  ledgerRows: OrgAlertCaseActionLedgerPostgresRow[];
  auditRows: OrgAlertCaseActionAuditPostgresRow[];
};

export type OrgAlertCaseActionLedgerApiBlocker = {
  code: "missing_tenant_scope" | "missing_organization_scope" | OrgAlertCaseActionLedgerBlocker["code"];
  ownerLane: "case" | "alert" | "source" | "webhook";
  path: string;
  message: string;
};

export type OrgAlertCaseActionLedgerApiListResponse = {
  schemaVersion: typeof DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION;
  ok: boolean;
  statusCode: 200 | 400;
  tenantId?: string;
  organizationId?: string;
  query: {
    receiptId?: string;
    alertId?: string;
    casePath?: string;
  };
  records: OrgAlertCaseActionLedgerApiRecord[];
  blockers: OrgAlertCaseActionLedgerApiBlocker[];
  payloadShape: string[];
};

export type OrgAlertCaseActionLedgerApiWriteResponse = {
  schemaVersion: typeof DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION;
  ok: boolean;
  statusCode: 200 | 201 | 400;
  created: boolean;
  tenantId?: string;
  organizationId?: string;
  record?: OrgAlertCaseActionLedgerApiRecord;
  blockers: OrgAlertCaseActionLedgerApiBlocker[];
  payloadShape: string[];
};

export type OrgAlertCaseActionLedgerApiRecord = {
  id: string;
  receiptId: string;
  recordedAt: string;
  tenantId: string;
  organizationId: string;
  watchlistId?: string;
  watchlistItemId?: string;
  alertIds: string[];
  casePaths: string[];
  action: string;
  execution: string;
  ownerLane?: string;
  route?: string;
  method?: string;
  analystId?: string;
  receiptOk: boolean;
  blockedByCodes: string[];
  auditEventId: string;
};

export type OrgAlertCaseActionLedgerPostgresRow = {
  id: string;
  schema_version: string;
  receipt_id: string;
  dedupe_key: string;
  recorded_at: string;
  tenant_id: string;
  organization_id: string;
  row_id?: string;
  watchlist_id?: string;
  watchlist_item_id?: string;
  alert_ids: string[];
  case_paths: string[];
  action: string;
  execution: string;
  owner_lane?: string;
  route?: string;
  method?: string;
  analyst_id?: string;
  rationale_recorded: boolean;
  receipt_ok: boolean;
  blocked_by_codes: string[];
  audit_event_id: string;
};

export type OrgAlertCaseActionAuditPostgresRow = {
  id: string;
  schema_version: string;
  at: string;
  tenant_id: string;
  organization_id: string;
  receipt_id: string;
  action: string;
  execution: string;
  owner_lane?: string;
  alert_ids: string[];
  case_paths: string[];
  watchlist_id?: string;
  watchlist_item_id?: string;
  analyst_id?: string;
  blocked_by_codes: string[];
  route?: string;
  raw_evidence_exposed: false;
  webhook_secret_exposed: false;
};

export class InMemoryOrgAlertCaseActionLedgerRepository {
  private readonly rowsByReceiptId = new Map<string, OrgAlertCaseActionLedgerPostgresRows>();

  constructor(seed: OrgAlertCaseActionLedgerRecord[] = []) {
    for (const record of seed) this.upsert(record);
  }

  upsert(record: OrgAlertCaseActionLedgerRecord): { created: boolean; record: OrgAlertCaseActionLedgerRecord } {
    const existing = this.getByReceiptId(record.tenantId, record.organizationId, record.receiptId);
    if (existing) return { created: false, record: existing };
    this.rowsByReceiptId.set(record.receiptId, orgAlertCaseActionLedgerRecordToPostgresRows(record));
    return { created: true, record };
  }

  getByReceiptId(tenantId: string, organizationId: string, receiptId: string): OrgAlertCaseActionLedgerRecord | undefined {
    const rows = this.rowsByReceiptId.get(receiptId);
    if (!rows) return undefined;
    const record = orgAlertCaseActionLedgerRecordFromPostgresRows(rows);
    return record.tenantId === tenantId && record.organizationId === organizationId ? record : undefined;
  }

  listByAlertId(tenantId: string, organizationId: string, alertId: string): OrgAlertCaseActionLedgerRecord[] {
    return this.listScoped(tenantId, organizationId)
      .filter((record) => record.alertIds.includes(alertId));
  }

  listByCasePath(tenantId: string, organizationId: string, casePath: string): OrgAlertCaseActionLedgerRecord[] {
    return this.listScoped(tenantId, organizationId)
      .filter((record) => record.casePaths.includes(casePath));
  }

  listScoped(tenantId: string, organizationId: string): OrgAlertCaseActionLedgerRecord[] {
    return [...this.rowsByReceiptId.values()]
      .map(orgAlertCaseActionLedgerRecordFromPostgresRows)
      .filter((record) => record.tenantId === tenantId && record.organizationId === organizationId)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  }
}

export function buildOrgAlertCaseActionLedgerApiList(input: {
  repository: InMemoryOrgAlertCaseActionLedgerRepository;
  tenantId?: string;
  organizationId?: string;
  receiptId?: string;
  alertId?: string;
  casePath?: string;
}): OrgAlertCaseActionLedgerApiListResponse {
  const blockers = scopeBlockers(input.tenantId, input.organizationId);
  if (blockers.length) {
    return {
      schemaVersion: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION,
      ok: false,
      statusCode: 400,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      query: { receiptId: input.receiptId, alertId: input.alertId, casePath: input.casePath },
      records: [],
      blockers,
      payloadShape: apiListPayloadShape()
    };
  }

  const tenantId = String(input.tenantId);
  const organizationId = String(input.organizationId);
  const records = input.receiptId
    ? [input.repository.getByReceiptId(tenantId, organizationId, input.receiptId)].filter(Boolean) as OrgAlertCaseActionLedgerRecord[]
    : input.alertId
      ? input.repository.listByAlertId(tenantId, organizationId, input.alertId)
      : input.casePath
        ? input.repository.listByCasePath(tenantId, organizationId, input.casePath)
        : input.repository.listScoped(tenantId, organizationId);

  return {
    schemaVersion: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION,
    ok: true,
    statusCode: 200,
    tenantId,
    organizationId,
    query: { receiptId: input.receiptId, alertId: input.alertId, casePath: input.casePath },
    records: records.map(apiRecord),
    blockers: [],
    payloadShape: apiListPayloadShape()
  };
}

export function writeOrgAlertCaseActionLedgerApiRecord(input: {
  repository: InMemoryOrgAlertCaseActionLedgerRepository;
  receipt: OrgAlertCaseActionReceipt;
  tenantId?: string;
  organizationId?: string;
  recordedAt?: string;
  allowBlockedReceipt?: boolean;
}): OrgAlertCaseActionLedgerApiWriteResponse {
  const blockers = scopeBlockers(input.tenantId, input.organizationId);
  if (blockers.length) {
    return {
      schemaVersion: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION,
      ok: false,
      statusCode: 400,
      created: false,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      blockers,
      payloadShape: apiWritePayloadShape()
    };
  }

  const tenantId = String(input.tenantId);
  const organizationId = String(input.organizationId);
  const recorded = recordOrgAlertCaseActionReceipt({
    records: input.repository.listScoped(tenantId, organizationId),
    receipt: input.receipt,
    tenantId,
    organizationId,
    recordedAt: input.recordedAt,
    allowBlockedReceipt: input.allowBlockedReceipt
  });
  if (!recorded.ok || !recorded.record) {
    return {
      schemaVersion: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION,
      ok: false,
      statusCode: 400,
      created: false,
      tenantId,
      organizationId,
      blockers: recorded.blockers.map(apiBlockerFromLedgerBlocker),
      payloadShape: apiWritePayloadShape()
    };
  }

  const persisted = input.repository.upsert(recorded.record);
  return {
    schemaVersion: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION,
    ok: true,
    statusCode: persisted.created ? 201 : 200,
    created: persisted.created,
    tenantId,
    organizationId,
    record: apiRecord(persisted.record),
    blockers: [],
    payloadShape: apiWritePayloadShape()
  };
}

export function orgAlertCaseActionLedgerRecordToPostgresRows(record: OrgAlertCaseActionLedgerRecord): OrgAlertCaseActionLedgerPostgresRows {
  return {
    ledgerRows: [{
      id: record.id,
      schema_version: record.schemaVersion,
      receipt_id: record.receiptId,
      dedupe_key: record.dedupeKey,
      recorded_at: record.recordedAt,
      tenant_id: record.tenantId,
      organization_id: record.organizationId,
      row_id: record.rowId,
      watchlist_id: record.watchlistId,
      watchlist_item_id: record.watchlistItemId,
      alert_ids: [...record.alertIds],
      case_paths: [...record.casePaths],
      action: record.action,
      execution: record.execution,
      owner_lane: record.ownerLane,
      route: record.route,
      method: record.method,
      analyst_id: record.analystId,
      rationale_recorded: record.rationaleRecorded,
      receipt_ok: record.receiptOk,
      blocked_by_codes: [...record.blockedByCodes],
      audit_event_id: record.auditEvent.id
    }],
    auditRows: [orgAlertCaseActionAuditEventToPostgresRow(record.auditEvent)]
  };
}

export function orgAlertCaseActionLedgerRecordFromPostgresRows(rows: OrgAlertCaseActionLedgerPostgresRows): OrgAlertCaseActionLedgerRecord {
  const row = rows.ledgerRows[0];
  if (!row) throw new Error("Org alert case action ledger row is missing.");
  const auditRow = rows.auditRows.find((candidate) => candidate.id === row.audit_event_id || candidate.receipt_id === row.receipt_id);
  if (!auditRow) throw new Error("Org alert case action audit row is missing.");
  return {
    schemaVersion: row.schema_version as OrgAlertCaseActionLedgerRecord["schemaVersion"],
    id: row.id,
    receiptId: row.receipt_id,
    dedupeKey: row.dedupe_key,
    recordedAt: row.recorded_at,
    tenantId: row.tenant_id,
    organizationId: row.organization_id,
    rowId: row.row_id,
    watchlistId: row.watchlist_id,
    watchlistItemId: row.watchlist_item_id,
    alertIds: [...row.alert_ids],
    casePaths: [...row.case_paths],
    action: row.action as OrgAlertCaseActionLedgerRecord["action"],
    execution: row.execution as OrgAlertCaseActionLedgerRecord["execution"],
    ownerLane: row.owner_lane as OrgAlertCaseActionLedgerRecord["ownerLane"],
    route: row.route,
    method: row.method as OrgAlertCaseActionLedgerRecord["method"],
    analystId: row.analyst_id,
    rationaleRecorded: row.rationale_recorded,
    receiptOk: row.receipt_ok,
    blockedByCodes: [...row.blocked_by_codes],
    auditEvent: orgAlertCaseActionAuditEventFromPostgresRow(auditRow)
  };
}

export function orgAlertCaseActionAuditEventToPostgresRow(event: OrgAlertCaseActionAuditEvent): OrgAlertCaseActionAuditPostgresRow {
  return {
    id: event.id,
    schema_version: event.schemaVersion,
    at: event.at,
    tenant_id: event.tenantId,
    organization_id: event.organizationId,
    receipt_id: event.receiptId,
    action: event.action,
    execution: event.execution,
    owner_lane: event.ownerLane,
    alert_ids: [...event.alertIds],
    case_paths: [...event.casePaths],
    watchlist_id: event.watchlistId,
    watchlist_item_id: event.watchlistItemId,
    analyst_id: event.analystId,
    blocked_by_codes: [...event.blockedByCodes],
    route: event.route,
    raw_evidence_exposed: false,
    webhook_secret_exposed: false
  };
}

export function orgAlertCaseActionAuditEventFromPostgresRow(row: OrgAlertCaseActionAuditPostgresRow): OrgAlertCaseActionAuditEvent {
  return {
    schemaVersion: row.schema_version as OrgAlertCaseActionAuditEvent["schemaVersion"],
    id: row.id,
    at: row.at,
    tenantId: row.tenant_id,
    organizationId: row.organization_id,
    receiptId: row.receipt_id,
    action: row.action as OrgAlertCaseActionAuditEvent["action"],
    execution: row.execution as OrgAlertCaseActionAuditEvent["execution"],
    ownerLane: row.owner_lane as OrgAlertCaseActionAuditEvent["ownerLane"],
    alertIds: [...row.alert_ids],
    casePaths: [...row.case_paths],
    watchlistId: row.watchlist_id,
    watchlistItemId: row.watchlist_item_id,
    analystId: row.analyst_id,
    blockedByCodes: [...row.blocked_by_codes],
    route: row.route,
    safeOutput: {
      rawEvidenceExposed: false,
      webhookSecretExposed: false
    }
  };
}

function apiRecord(record: OrgAlertCaseActionLedgerRecord): OrgAlertCaseActionLedgerApiRecord {
  return {
    id: record.id,
    receiptId: record.receiptId,
    recordedAt: record.recordedAt,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    watchlistId: record.watchlistId,
    watchlistItemId: record.watchlistItemId,
    alertIds: [...record.alertIds],
    casePaths: [...record.casePaths],
    action: record.action,
    execution: record.execution,
    ownerLane: record.ownerLane,
    route: record.route,
    method: record.method,
    analystId: record.analystId,
    receiptOk: record.receiptOk,
    blockedByCodes: [...record.blockedByCodes],
    auditEventId: record.auditEvent.id
  };
}

function scopeBlockers(tenantId: string | undefined, organizationId: string | undefined): OrgAlertCaseActionLedgerApiBlocker[] {
  return [
    !tenantId ? apiBlocker("missing_tenant_scope", "case", "tenantId", "Tenant scope is required for case action ledger access.") : undefined,
    !organizationId ? apiBlocker("missing_organization_scope", "case", "organizationId", "Organization scope is required for case action ledger access.") : undefined
  ].filter(Boolean) as OrgAlertCaseActionLedgerApiBlocker[];
}

function apiBlockerFromLedgerBlocker(blocker: OrgAlertCaseActionLedgerBlocker): OrgAlertCaseActionLedgerApiBlocker {
  return {
    code: blocker.code,
    ownerLane: blocker.ownerLane,
    path: blocker.path,
    message: blocker.message
  };
}

function apiBlocker(
  code: OrgAlertCaseActionLedgerApiBlocker["code"],
  ownerLane: OrgAlertCaseActionLedgerApiBlocker["ownerLane"],
  path: string,
  message: string
): OrgAlertCaseActionLedgerApiBlocker {
  return { code, ownerLane, path, message };
}

function apiListPayloadShape(): string[] {
  return ["records[].receiptId", "records[].alertIds", "records[].casePaths", "records[].auditEventId", "blockers[]"];
}

function apiWritePayloadShape(): string[] {
  return ["created", "record.receiptId", "record.auditEventId", "blockers[]"];
}
