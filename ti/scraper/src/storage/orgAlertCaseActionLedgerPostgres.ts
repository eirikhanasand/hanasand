import type {
  OrgAlertCaseActionAuditEvent,
  OrgAlertCaseActionLedgerRecord
} from "../product/orgAlertWorkflowBridge.ts";

export type OrgAlertCaseActionLedgerPostgresRows = {
  ledgerRows: OrgAlertCaseActionLedgerPostgresRow[];
  auditRows: OrgAlertCaseActionAuditPostgresRow[];
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
