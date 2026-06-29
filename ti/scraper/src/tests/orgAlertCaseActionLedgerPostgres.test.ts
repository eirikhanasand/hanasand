import { describe, expect, test } from "bun:test";
import {
  buildOrgAlertCaseActionPacket,
  buildOrgAlertCaseActionReceipt,
  buildOrgAlertOperatorReadinessPacket,
  buildOrgAlertSourceEvidenceReport,
  buildOrgAlertWebhookFixtureContract,
  buildOrgAlertWorkflowBridgeReport,
  recordOrgAlertCaseActionReceipt
} from "../product/orgAlertWorkflowBridge.ts";
import {
  InMemoryOrgAlertCaseActionLedgerRepository,
  orgAlertCaseActionLedgerRecordFromPostgresRows,
  orgAlertCaseActionLedgerRecordToPostgresRows
} from "../storage/orgAlertCaseActionLedgerPostgres.ts";
import fixture from "./fixtures/org-alert-workflow-bridge-happy.json";

describe("org alert case action ledger postgres adapter", () => {
  test("round-trips case action ledger rows with redacted audit metadata", () => {
    const record = readyLedgerRecord();
    const rows = orgAlertCaseActionLedgerRecordToPostgresRows(record);
    const roundTrip = orgAlertCaseActionLedgerRecordFromPostgresRows(rows);

    expect(rows.ledgerRows).toEqual([expect.objectContaining({
      id: record.id,
      schema_version: "dwm.org_alert_case_action_ledger.v1",
      receipt_id: record.receiptId,
      tenant_id: "tenant_acme",
      organization_id: "org_acme",
      watchlist_id: "watch_acme_domains",
      watchlist_item_id: "watch_item_acme_com",
      alert_ids: ["alert_acme_lumma"],
      case_paths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
      action: "open_case",
      execution: "ready",
      owner_lane: "case",
      method: "GET",
      analyst_id: "analyst_acme",
      receipt_ok: true,
      blocked_by_codes: []
    })]);
    expect(rows.auditRows).toEqual([expect.objectContaining({
      schema_version: "dwm.org_alert_case_action_audit_event.v1",
      tenant_id: "tenant_acme",
      organization_id: "org_acme",
      receipt_id: record.receiptId,
      raw_evidence_exposed: false,
      webhook_secret_exposed: false
    })]);
    expect(roundTrip).toMatchObject({
      id: record.id,
      receiptId: record.receiptId,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      action: "open_case",
      execution: "ready",
      auditEvent: expect.objectContaining({
        receiptId: record.receiptId,
        safeOutput: {
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      })
    });
    expect(JSON.stringify(rows)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(rows)).not.toContain("https://discord.com");
  });

  test("dedupes case action receipts and lists only scoped records", () => {
    const record = readyLedgerRecord();
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const created = repository.upsert(record);
    const duplicate = repository.upsert(record);

    expect(created).toMatchObject({ created: true, record: { receiptId: record.receiptId } });
    expect(duplicate).toMatchObject({ created: false, record: { receiptId: record.receiptId } });
    expect(repository.getByReceiptId("tenant_acme", "org_acme", record.receiptId)).toMatchObject({
      receiptId: record.receiptId,
      organizationId: "org_acme"
    });
    expect(repository.getByReceiptId("tenant_acme", "org_other", record.receiptId)).toBeUndefined();
    expect(repository.listByAlertId("tenant_acme", "org_acme", "alert_acme_lumma")).toHaveLength(1);
    expect(repository.listByAlertId("tenant_acme", "org_other", "alert_acme_lumma")).toEqual([]);
    expect(repository.listByCasePath("tenant_acme", "org_acme", "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma")).toHaveLength(1);
  });

  test("rejects missing audit rows during persistence replay", () => {
    const rows = orgAlertCaseActionLedgerRecordToPostgresRows(readyLedgerRecord());
    expect(() => orgAlertCaseActionLedgerRecordFromPostgresRows({
      ...rows,
      auditRows: []
    })).toThrow("Org alert case action audit row is missing.");
  });
});

function readyLedgerRecord() {
  const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
  const sourceEvidence = buildOrgAlertSourceEvidenceReport({
    bridge,
    sources: sourceRefs(),
    captures: [],
    sourceProvenanceSummaries: [sourceProvenanceSummary()],
    checkedAt: "2026-06-29T15:00:00.000Z"
  });
  const webhookFixture = buildOrgAlertWebhookFixtureContract({
    bridge,
    destinations: [webhookDestination()],
    destinationIdsByWatchlistId: { watch_acme_domains: ["webhook_discord"] }
  });
  const readiness = buildOrgAlertOperatorReadinessPacket({
    bridge,
    sourceEvidence,
    webhookFixture
  });
  const packet = buildOrgAlertCaseActionPacket({ readiness, checkedAt: "2026-06-29T15:03:00.000Z" });
  const receipt = buildOrgAlertCaseActionReceipt({
    packet,
    action: "open_case",
    analystId: "analyst_acme",
    checkedAt: "2026-06-29T15:04:00.000Z"
  });
  const result = recordOrgAlertCaseActionReceipt({
    records: [],
    receipt,
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    recordedAt: "2026-06-29T15:05:00.000Z"
  });
  if (!result.record) throw new Error("Expected case action ledger record.");
  return result.record;
}

function webhookDestination() {
  return {
    destinationId: "webhook_discord",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    kind: "discord",
    status: "active",
    verified: true,
    endpointUrl: "https://discord.com/api/webhooks/acme/token"
  };
}

function sourceRefs() {
  return [{
    sourceId: "src_acme_tg",
    sourceFamily: "telegram_public",
    status: "active",
    lastCollectedAt: "2026-06-29T14:10:00.000Z"
  }, {
    sourceId: "src_acme_forum",
    sourceFamily: "darkweb_metadata",
    status: "active",
    lastCollectedAt: "2026-06-29T14:30:00.000Z"
  }];
}

function sourceProvenanceSummary() {
  return {
    schemaVersion: "dwm.alert_source_provenance.v1",
    alertId: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceFamily: "telegram_public",
    sourceFamilies: ["telegram_public", "darkweb_metadata"],
    captureIds: ["cap_acme_initial", "cap_acme_followup"],
    sourceIds: ["src_acme_tg", "src_acme_forum"],
    contentHashes: ["hash_acme_initial", "hash_acme_followup"],
    evidenceCount: 2,
    firstObservedAt: "2026-06-29T14:05:00.000Z",
    lastObservedAt: "2026-06-29T14:30:00.000Z",
    generationEvidenceWindow: {
      captureIds: ["cap_acme_initial", "cap_acme_followup"],
      sourceFamilies: ["telegram_public", "darkweb_metadata"],
      contentHashes: ["hash_acme_initial", "hash_acme_followup"],
      firstObservedAt: "2026-06-29T14:05:00.000Z",
      lastObservedAt: "2026-06-29T14:30:00.000Z"
    }
  };
}
