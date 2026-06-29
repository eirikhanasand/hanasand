import { describe, expect, test } from "bun:test";
import { buildOrgAlertCaseActionTimeline } from "../product/orgAlertCaseActionTimeline.ts";
import type { OrgAlertCaseActionLedgerApiRecord } from "../storage/orgAlertCaseActionLedgerPostgres.ts";

describe("org alert case action timeline adapter", () => {
  test("builds org-scoped case timeline rows with audit provenance", () => {
    const report = buildOrgAlertCaseActionTimeline({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      alertId: "alert_acme_lumma",
      records: [ledgerRecord({ recordedAt: "2026-06-29T15:05:00.000Z" })],
      generatedAt: "2026-06-29T15:10:00.000Z"
    });

    expect(report).toMatchObject({
      schemaVersion: "dwm.org_alert_case_action_timeline.v1",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      alertId: "alert_acme_lumma",
      rows: [expect.objectContaining({
        eventType: "case_action_recorded",
        at: "2026-06-29T15:05:00.000Z",
        receiptId: "receipt_acme_open_case",
        action: "open_case",
        execution: "ready",
        analystId: "analyst_acme",
        related: {
          watchlistId: "watch_acme_domains",
          watchlistItemId: "watch_item_acme_com",
          alertIds: ["alert_acme_lumma"],
          casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"]
        },
        provenance: {
          source: "org_alert_case_action_ledger",
          recordId: "ledger_acme_open_case",
          receiptId: "receipt_acme_open_case",
          auditEventId: "audit_acme_open_case",
          receiptOk: true,
          blockedByCodes: []
        }
      })],
      blockers: []
    });
    expect(report.payloadShape).toEqual(expect.arrayContaining(["rows[].provenance.auditEventId", "blockers[]"]));
    expect(JSON.stringify(report)).not.toContain("https://discord.com");
  });

  test("blocks records from the wrong organization and missing audit events", () => {
    const report = buildOrgAlertCaseActionTimeline({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      records: [
        ledgerRecord({ id: "ledger_other", organizationId: "org_other" }),
        ledgerRecord({ id: "ledger_no_audit", receiptId: "receipt_no_audit", auditEventId: "" })
      ]
    });

    expect(report.ok).toBe(false);
    expect(report.rows).toEqual([]);
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "record_scope_mismatch", ownerLane: "case", recordId: "ledger_other" }),
      expect.objectContaining({ code: "record_missing_audit_event", ownerLane: "case", recordId: "ledger_no_audit" })
    ]));
  });

  test("blocks missing scope, duplicate receipts, and mismatched case or alert filters", () => {
    const missingScope = buildOrgAlertCaseActionTimeline({
      tenantId: "tenant_acme",
      records: [ledgerRecord()]
    });
    const filtered = buildOrgAlertCaseActionTimeline({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      casePath: "/v1/cases/other",
      alertId: "alert_other",
      records: [
        ledgerRecord({ id: "ledger_first" }),
        ledgerRecord({ id: "ledger_duplicate" })
      ]
    });

    expect(missingScope).toMatchObject({
      ok: false,
      rows: [],
      blockers: [expect.objectContaining({ code: "missing_organization_scope", path: "organizationId" })]
    });
    expect(filtered.ok).toBe(false);
    expect(filtered.rows).toEqual([]);
    expect(filtered.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "record_case_path_mismatch", recordId: "ledger_first" }),
      expect.objectContaining({ code: "record_alert_mismatch", recordId: "ledger_first" }),
      expect.objectContaining({ code: "duplicate_receipt", recordId: "ledger_duplicate" })
    ]));
  });
});

function ledgerRecord(overrides: Partial<OrgAlertCaseActionLedgerApiRecord> = {}): OrgAlertCaseActionLedgerApiRecord {
  return {
    id: "ledger_acme_open_case",
    receiptId: "receipt_acme_open_case",
    recordedAt: "2026-06-29T15:05:00.000Z",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    watchlistId: "watch_acme_domains",
    watchlistItemId: "watch_item_acme_com",
    alertIds: ["alert_acme_lumma"],
    casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
    action: "open_case",
    execution: "ready",
    ownerLane: "case",
    route: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    method: "GET",
    analystId: "analyst_acme",
    receiptOk: true,
    blockedByCodes: [],
    auditEventId: "audit_acme_open_case",
    ...overrides
  };
}
