import { describe, expect, test } from "bun:test";
import {
  buildOrgAlertWorkflowBridgeReport,
  recordOrgAlertCaseActionReceipt,
  type OrgAlertCaseActionReceipt
} from "../product/orgAlertWorkflowBridge.ts";

describe("org alert workflow bridge", () => {
  test("connects an exact organization watchlist to retained alert provenance and case state", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [watchlist()],
      previousAlerts: [alert()],
      alerts: [alert()],
      checkedAt: "2026-06-29T14:00:00.000Z"
    });

    expect(report).toMatchObject({
      schemaVersion: "dwm.org_alert_workflow_bridge.v1",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      blockers: [],
      rows: [{
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        normalizedTerm: "acme.com",
        matchedAlertIds: ["alert_acme_lumma"],
        alertDetailPaths: ["/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme"],
        casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
        sourceFamilies: ["telegram_public"],
        workflowEventCount: 1,
        provenance: {
          evidenceCount: 1,
          captureIds: ["cap_acme_initial"],
          sourceIds: ["src_acme_tg"],
          contentHashes: ["hash_acme_initial"]
        },
        ready: true,
        blockerCodes: []
      }]
    });
  });

  test("does not attribute a foreign organization alert to the requested watchlist", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [watchlist()],
      alerts: [{ ...alert(), organizationId: "org_foreign" }],
      checkedAt: "2026-06-29T14:00:00.000Z"
    });

    expect(report.ok).toBe(false);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      matchedAlertIds: [],
      alertDetailPaths: [],
      casePaths: [],
      provenance: { evidenceCount: 0, captureIds: [], sourceIds: [], contentHashes: [] },
      ready: false,
      blockerCodes: ["alert_not_generated"]
    });
    expect(report.blockers).toEqual([
      expect.objectContaining({ code: "alert_not_generated", ownerLane: "alert" })
    ]);
  });

  test("records a ready receipt idempotently and rejects a tenant mismatch", () => {
    const receipt = readyReceipt();
    const first = recordOrgAlertCaseActionReceipt({
      records: [],
      receipt,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      recordedAt: "2026-06-29T15:05:00.000Z"
    });
    const replay = recordOrgAlertCaseActionReceipt({
      records: first.records,
      receipt,
      tenantId: "tenant_acme",
      organizationId: "org_acme"
    });
    const mismatch = recordOrgAlertCaseActionReceipt({
      records: [],
      receipt,
      tenantId: "tenant_foreign",
      organizationId: "org_acme"
    });

    expect(first).toMatchObject({
      ok: true,
      created: true,
      record: {
        receiptId: receipt.id,
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        receiptOk: true,
        auditEvent: {
          receiptId: receipt.id,
          safeOutput: { rawEvidenceExposed: false, webhookSecretExposed: false }
        }
      }
    });
    expect(replay).toMatchObject({ ok: true, created: false, record: { receiptId: receipt.id } });
    expect(mismatch).toMatchObject({
      ok: false,
      created: false,
      blockers: [expect.objectContaining({ code: "tenant_scope_mismatch", path: "receipt.tenantId" })]
    });
  });
});

function watchlist() {
  return {
    watchlistId: "watch_acme_domains",
    watchlistItemId: "watch_item_acme_com",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    term: "acme.com",
    status: "active",
    alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_com:domain:acme.com"
  };
}

function alert() {
  return {
    id: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceFamily: "telegram_public",
    matchedTerm: { kind: "domain", value: "acme.com" },
    watchlistIds: ["watch_acme_domains"],
    watchlistItemIds: ["watch_item_acme_com"],
    alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme",
    reviewState: "route_to_customer",
    deliveryState: "ready_to_send",
    workflowStatus: "triaged",
    assignedOwner: "ir-lead",
    caseId: "case_acme_lumma",
    casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    provenance: { captureIds: ["cap_acme_initial"] },
    workflowContext: {
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      sourceFamily: "telegram_public",
      alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme",
      alertGeneratorKeys: ["org:org_acme:watchlist:watch_item_acme_com:domain:acme.com"],
      watchlistIds: ["watch_acme_domains"],
      watchlistItemIds: ["watch_item_acme_com"],
      captureIds: ["cap_acme_initial"],
      evidenceCount: 1,
      caseId: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"
    },
    workflowEvents: [{ id: "event_triage", at: "2026-06-29T12:00:00.000Z" }],
    evidence: [{
      id: "evidence_acme_initial",
      sourceId: "src_acme_tg",
      contentHash: "hash_acme_initial",
      sourceFamily: "telegram_public"
    }]
  };
}

function readyReceipt(): OrgAlertCaseActionReceipt {
  return {
    schemaVersion: "dwm.org_alert_case_action_receipt.v1",
    id: "receipt_acme_open_case",
    checkedAt: "2026-06-29T15:04:00.000Z",
    ok: true,
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    rowId: "row_acme_domains",
    watchlistId: "watch_acme_domains",
    watchlistItemId: "watch_item_acme_com",
    alertIds: ["alert_acme_lumma"],
    casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
    action: "open_case",
    execution: "ready",
    ownerLane: "case",
    route: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    method: "GET",
    analyst: { analystId: "analyst_acme" },
    blockedByCodes: [],
    blockers: [],
    payloadShape: ["action", "execution", "route", "blockedByCodes", "blockers[]"]
  };
}
