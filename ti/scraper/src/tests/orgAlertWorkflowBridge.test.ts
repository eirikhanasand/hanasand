import { describe, expect, test } from "bun:test";
import {
  DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION,
  buildOrgAlertWorkflowBridgeReport
} from "../product/orgAlertWorkflowBridge.ts";
import fixture from "./fixtures/org-alert-workflow-bridge-happy.json";

describe("org alert workflow bridge", () => {
  test("connects org watchlist rows to preserved alert case workflow", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [watchlistFixture()],
      previousAlerts: [alertFixture()],
      alerts: [{
        ...alertFixture(),
        workflowContext: {
          ...alertFixture().workflowContext,
          captureIds: ["cap_acme_initial", "cap_acme_followup"],
          evidenceCount: 2
        },
        provenance: { captureIds: ["cap_acme_initial", "cap_acme_followup"] },
        evidence: [...alertFixture().evidence, {
          id: "evidence_acme_followup",
          sourceId: "src_acme_forum",
          contentHash: "hash_acme_followup",
          sourceFamily: "darkweb_metadata"
        }]
      }],
      checkedAt: "2026-06-29T14:00:00.000Z"
    });

    expect(report).toMatchObject({
      schemaVersion: DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      blockers: [],
      rows: [{
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        normalizedTerm: "acme.com",
        alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_com:domain:acme.com",
        matchedAlertIds: ["alert_acme_lumma"],
        alertDetailPaths: ["/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma"],
        casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        workflowEventCount: 2,
        eventPayloads: [{
          schemaVersion: "dwm.org_alert_workflow_event_payload.v1",
          alertId: "alert_acme_lumma",
          organizationId: "org_acme",
          tenantId: "tenant_acme",
          watchlistId: "watch_acme_domains",
          watchlistItemId: "watch_item_acme_com",
          alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_com:domain:acme.com",
          alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
          sourceFamilies: ["telegram_public", "darkweb_metadata"],
          captureIds: ["cap_acme_initial", "cap_acme_followup"],
          evidenceCount: 2,
          workflowEventCount: 2,
          dedupeKey: "dedupe_acme_lumma"
        }],
        ready: true,
        blockerCodes: []
      }]
    });
    expect(report.rows[0].provenance).toEqual({
      evidenceCount: 2,
      captureIds: ["cap_acme_initial", "cap_acme_followup"],
      sourceIds: ["src_acme_tg", "src_acme_forum"],
      contentHashes: ["hash_acme_initial", "hash_acme_followup"]
    });
  });

  test("validates checked-in bridge fixture", () => {
    const report = buildOrgAlertWorkflowBridgeReport(fixture as any);
    expect(report.ok).toBe(true);
    expect(report.rows[0]).toMatchObject({
      watchlistItemId: "watch_item_acme_com",
      matchedAlertIds: ["alert_acme_lumma"],
      ready: true
    });
  });

  test("returns owner-coded blockers for rows that cannot reach analyst workflow", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [{
        ...watchlistFixture(),
        status: "paused",
        alertGeneratorKey: undefined
      }, {
        ...watchlistFixture(),
        watchlistItemId: "watch_item_acme_vendor",
        term: "acme vendor portal",
        normalizedTerm: "acme vendor portal",
        alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_vendor:vendor:acme-vendor-portal"
      }],
      alerts: [{
        ...alertFixture(),
        caseId: undefined,
        casePath: undefined,
        workflowContext: {
          ...alertFixture().workflowContext,
          caseId: undefined,
          casePath: undefined,
          captureIds: [],
          evidenceCount: 0
        },
        provenance: { captureIds: [] },
        evidence: []
      }],
      checkedAt: "2026-06-29T14:05:00.000Z"
    });

    expect(report.ok).toBe(false);
    expect(report.rows).toEqual([
      expect.objectContaining({
        watchlistItemId: "watch_item_acme_com",
        ready: false,
        blockerCodes: expect.arrayContaining([
          "inactive_watchlist",
          "missing_alert_generation_ref",
          "case_route_unavailable",
          "provenance_missing"
        ])
      }),
      expect.objectContaining({
        watchlistItemId: "watch_item_acme_vendor",
        ready: false,
        blockerCodes: ["alert_not_generated"]
      })
    ]);
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "inactive_watchlist", ownerLane: "watchlist", path: "watchlist.status" }),
      expect.objectContaining({ code: "case_route_unavailable", ownerLane: "case", path: "alert.casePath" }),
      expect.objectContaining({ code: "provenance_missing", ownerLane: "source", path: "alert.provenance" }),
      expect.objectContaining({ code: "alert_not_generated", ownerLane: "alert", path: "alert.id" })
    ]));
  });

  test("does not bridge overlapping watchlist terms across organizations", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [watchlistFixture()],
      alerts: [{
        ...alertFixture(),
        tenantId: "tenant_other",
        organizationId: "org_other",
        workflowContext: {
          ...alertFixture().workflowContext,
          tenantId: "tenant_other",
          organizationId: "org_other"
        }
      }],
      checkedAt: "2026-06-29T14:10:00.000Z"
    });

    expect(report.ok).toBe(false);
    expect(report.rows[0]).toMatchObject({
      watchlistItemId: "watch_item_acme_com",
      matchedAlertIds: [],
      alertDetailPaths: [],
      eventPayloads: [],
      blockerCodes: ["alert_not_generated"]
    });
  });
});

function watchlistFixture() {
  return {
    watchlistId: "watch_acme_domains",
    watchlistItemId: "watch_item_acme_com",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    term: "acme.com",
    normalizedTerm: "acme.com",
    status: "active",
    alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_com:domain:acme.com"
  };
}

function alertFixture() {
  return {
    id: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceFamily: "telegram_public",
    matchedTerm: { kind: "domain", value: "acme.com" },
    watchlistIds: ["watch_acme_domains"],
    watchlistItemIds: ["watch_item_acme_com"],
    alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
    reviewState: "route_to_customer",
    deliveryState: "ready_to_send",
    workflowStatus: "triaged",
    assignedOwner: "ir-lead",
    caseId: "case_acme_lumma",
    casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    dedupeKey: "dedupe_acme_lumma",
    provenance: { captureIds: ["cap_acme_initial"] },
    workflowContext: {
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
      sourceFamily: "telegram_public",
      alertGeneratorKeys: ["org:org_acme:watchlist:watch_item_acme_com:domain:acme.com"],
      watchlistIds: ["watch_acme_domains"],
      watchlistItemIds: ["watch_item_acme_com"],
      captureIds: ["cap_acme_initial"],
      evidenceCount: 1,
      caseId: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"
    },
    workflowEvents: [{
      id: "event_triage",
      at: "2026-06-29T12:00:00.000Z"
    }, {
      id: "event_escalate",
      at: "2026-06-29T12:05:00.000Z"
    }],
    evidence: [{
      id: "evidence_acme_initial",
      sourceId: "src_acme_tg",
      contentHash: "hash_acme_initial",
      sourceFamily: "telegram_public"
    }]
  };
}
