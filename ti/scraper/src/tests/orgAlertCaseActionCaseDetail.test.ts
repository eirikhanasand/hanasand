import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import {
  InMemoryOrgAlertCaseActionLedgerRepository,
  writeOrgAlertCaseActionLedgerApiRecord
} from "../storage/orgAlertCaseActionLedgerPostgres.ts";

describe("org alert case action ledger in case detail", () => {
  test("adds recorded case actions to org-scoped case detail timeline", async () => {
    const { options } = fixtureRuntime();
    writeOrgAlertCaseActionLedgerApiRecord({
      repository: options.orgAlertCaseActionLedgerRepository,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      receipt: actionReceipt(),
      recordedAt: "2026-06-29T15:06:00.000Z"
    });

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_acme_lumma?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detail = await response.json() as any;
    const actionEvent = detail.timeline.find((event: any) => event.eventType === "case.action_recorded");

    expect(response.status).toBe(200);
    expect(detail.caseActionLedgerContext).toMatchObject({
      ok: true,
      eventCount: 1,
      blockerCount: 0,
      route: "/v1/dwm/org-alert-case-actions/timeline"
    });
    expect(actionEvent).toMatchObject({
      title: "open case",
      actor: "analyst_acme",
      source: "case",
      related: {
        caseId: "case_acme_lumma",
        alertId: "alert_acme_lumma",
        watchlistIds: ["watch_acme_domains"],
        watchlistItemIds: ["watch_item_acme_com"],
        caseActionReceiptId: "receipt_acme_open_case",
        caseActionAuditEventId: expect.stringMatching(/^org_alert_case_action_audit_/),
        caseActionReplayState: "recorded",
        caseActionIdempotencyKey: "receipt_acme_open_case",
        caseActionDedupeKey: expect.stringMatching(/^org_alert_case_action_replay_/)
      },
      workflowState: {
        action: "open_case",
        execution: "ready",
        replayState: "recorded",
        idempotencyKey: "receipt_acme_open_case",
        dedupeKey: expect.stringMatching(/^org_alert_case_action_replay_/)
      },
      provenance: {
        source: "org_alert_case_action_ledger",
        receiptId: "receipt_acme_open_case",
        receiptOk: true
      }
    });
    expect(JSON.stringify(detail)).not.toContain("https://discord.com");
  });

  test("adds latest case action state to the org-scoped case queue", async () => {
    const { options } = fixtureRuntime();
    writeOrgAlertCaseActionLedgerApiRecord({
      repository: options.orgAlertCaseActionLedgerRepository,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      receipt: actionReceipt(),
      recordedAt: "2026-06-29T15:06:00.000Z"
    });

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/cases?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: "case_acme_lumma",
      caseActionLedgerContext: {
        ok: true,
        eventCount: 1,
        blockerCount: 0,
        route: "/v1/dwm/org-alert-case-actions/timeline"
      },
      latestCaseAction: {
        eventType: "case.action_recorded",
        related: {
          caseActionReceiptId: "receipt_acme_open_case",
          caseActionAuditEventId: expect.stringMatching(/^org_alert_case_action_audit_/),
          caseActionReplayState: "recorded",
          caseActionIdempotencyKey: "receipt_acme_open_case",
          caseActionDedupeKey: expect.stringMatching(/^org_alert_case_action_replay_/)
        },
        workflowState: {
          action: "open_case",
          execution: "ready",
          replayState: "recorded",
          idempotencyKey: "receipt_acme_open_case",
          dedupeKey: expect.stringMatching(/^org_alert_case_action_replay_/)
        },
        provenance: {
          source: "org_alert_case_action_ledger",
          receiptId: "receipt_acme_open_case"
        }
      }
    });
    expect(payload.items[0].latestEvent.eventType).toBe("case.action_recorded");
  });

  test("filters the case queue by recorded case action text and time window", async () => {
    const { options } = fixtureRuntime();
    writeOrgAlertCaseActionLedgerApiRecord({
      repository: options.orgAlertCaseActionLedgerRepository,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      receipt: actionReceipt(),
      recordedAt: "2026-06-29T15:06:00.000Z"
    });

    const byReceipt = await listCases(options, "q=receipt_acme_open_case");
    const byAudit = await listCases(options, "q=org_alert_case_action_audit");
    const byReceiptFilter = await listCases(options, "caseActionReceiptId=receipt_acme_open_case");
    const auditId = byReceiptFilter.payload.items[0].latestCaseAction.related.caseActionAuditEventId;
    const replayDedupeKey = byReceiptFilter.payload.items[0].latestCaseAction.related.caseActionDedupeKey;
    const byAuditFilter = await listCases(options, `caseActionAuditEventId=${encodeURIComponent(auditId)}`);
    const byReplayState = await listCases(options, "caseActionReplayState=recorded");
    const byIdempotencyKey = await listCases(options, "caseActionIdempotencyKey=receipt_acme_open_case");
    const byDedupeKey = await listCases(options, `caseActionDedupeKey=${encodeURIComponent(replayDedupeKey)}`);
    const byReplayDedupe = await listCases(options, `q=${encodeURIComponent(replayDedupeKey)}`);
    const byWindow = await listCases(options, `from=${encodeURIComponent("2026-06-29T15:05:00.000Z")}&to=${encodeURIComponent("2026-06-29T15:07:00.000Z")}`);
    const outsideWindow = await listCases(options, `from=${encodeURIComponent("2026-06-29T16:00:00.000Z")}&to=${encodeURIComponent("2026-06-29T17:00:00.000Z")}`);
    const unrelatedQuery = await listCases(options, "q=receipt_other_open_case");
    const wrongReceipt = await listCases(options, "caseActionReceiptId=receipt_other_open_case");
    const wrongAudit = await listCases(options, "caseActionAuditEventId=audit_missing");
    const wrongReplayState = await listCases(options, "caseActionReplayState=blocked");

    expect(byReceipt.payload.items).toHaveLength(1);
    expect(byReceipt.payload.items[0].latestCaseAction.related.caseActionReceiptId).toBe("receipt_acme_open_case");
    expect(byAudit.payload.items).toHaveLength(1);
    expect(byReceiptFilter.payload.items).toHaveLength(1);
    expect(byAuditFilter.payload.items).toHaveLength(1);
    expect(byReplayState.payload.items).toHaveLength(1);
    expect(byReplayState.payload.filters.caseActionReplayState).toBe("recorded");
    expect(byIdempotencyKey.payload.items).toHaveLength(1);
    expect(byDedupeKey.payload.items).toHaveLength(1);
    expect(byReplayDedupe.payload.items).toHaveLength(1);
    expect(byWindow.payload.items).toHaveLength(1);
    expect(outsideWindow.payload.items).toEqual([]);
    expect(unrelatedQuery.payload.items).toEqual([]);
    expect(wrongReceipt.payload.items).toEqual([]);
    expect(wrongAudit.payload.items).toEqual([]);
    expect(wrongReplayState.payload.items).toEqual([]);
  });

  test("does not leak case actions to the wrong organization or nonmembers", async () => {
    const { options } = fixtureRuntime();
    writeOrgAlertCaseActionLedgerApiRecord({
      repository: options.orgAlertCaseActionLedgerRepository,
      tenantId: "tenant_acme",
      organizationId: "org_other",
      receipt: actionReceipt({ organizationId: "org_other", receiptId: "receipt_other_open_case" }),
      recordedAt: "2026-06-29T15:06:00.000Z"
    });

    const detailResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_acme_lumma?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detail = await detailResponse.json() as any;
    const deniedResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_acme_lumma?organizationId=org_acme"), options);
    const denied = await deniedResponse.json() as any;
    const deniedListResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/cases?organizationId=org_acme"), options);
    const deniedList = await deniedListResponse.json() as any;

    expect(detailResponse.status).toBe(200);
    expect(detail.caseActionLedgerContext).toMatchObject({ ok: true, eventCount: 0, blockerCount: 0 });
    expect(detail.timeline.some((event: any) => event.related?.caseActionReceiptId === "receipt_other_open_case")).toBe(false);
    expect(deniedResponse.status).toBe(403);
    expect(denied.error).toMatchObject({ code: "organization_visibility_denied", reason: "not_member" });
    expect(deniedListResponse.status).toBe(403);
    expect(deniedList.error).toMatchObject({ code: "organization_visibility_denied", reason: "not_member" });
  });
});

async function listCases(options: ReturnType<typeof fixtureRuntime>["options"], query: string) {
  const response = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases?organizationId=org_acme&${query}`, {
    headers: { "x-user-email": "owner@acme.com" }
  }), options);
  return { response, payload: await response.json() as any };
}

function fixtureRuntime() {
  const store = new InMemoryScraperStore();
  store.saveOrganization({ id: "org_acme", tenantId: "tenant_acme", name: "Acme", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganization({ id: "org_other", tenantId: "tenant_acme", name: "Other", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_owner", organizationId: "org_acme", email: "owner@acme.com", role: "owner", status: "active" });
  store.saveDwmAlert({
    id: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    severity: "high",
    confidence: 0.92,
    company: "Acme",
    matchedTerm: { value: "acme.com" },
    dedupeKey: "dwm_alert_acme_lumma",
    caseId: "case_acme_lumma",
    casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    workflowContext: {
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      watchlistIds: ["watch_acme_domains"],
      watchlistItemIds: ["watch_item_acme_com"]
    },
    provenance: {
      sourceFamilies: ["telegram_public"],
      captureIds: ["cap_acme_lumma"],
      sourceIds: ["src_acme_tg"],
      contentHashes: ["hash_acme_lumma"]
    },
    workflowEvents: []
  });
  store.saveCase({
    id: "case_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceType: "dwm_alert",
    sourceId: "alert_acme_lumma",
    alertId: "alert_acme_lumma",
    title: "Acme exposure",
    summary: "Review Acme exposure.",
    priority: "high",
    status: "open",
    assignedOwner: "owner@acme.com",
    createdAt: "2026-06-29T15:00:00.000Z",
    updatedAt: "2026-06-29T15:00:00.000Z",
    workflowEvents: []
  });
  return {
    options: {
      store,
      frontier: new FocusedFrontier(),
      orgAlertCaseActionLedgerRepository: new InMemoryOrgAlertCaseActionLedgerRepository()
    }
  };
}

function actionReceipt(input: { organizationId?: string; receiptId?: string } = {}) {
  const organizationId = input.organizationId ?? "org_acme";
  const receiptId = input.receiptId ?? "receipt_acme_open_case";
  return {
    schemaVersion: "dwm.org_alert_case_action_receipt.v1",
    id: receiptId,
    checkedAt: "2026-06-29T15:05:00.000Z",
    ok: true,
    tenantId: "tenant_acme",
    organizationId,
    rowId: `row_${organizationId}`,
    watchlistId: "watch_acme_domains",
    watchlistItemId: "watch_item_acme_com",
    alertIds: ["alert_acme_lumma"],
    casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
    action: "open_case",
    execution: "ready",
    ownerLane: "case",
    route: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    method: "GET",
    analyst: {
      analystId: "analyst_acme",
      rationale: "Recorded in the case workspace."
    },
    blockedByCodes: [],
    blockers: [],
    payloadShape: ["action", "execution", "route", "blockedByCodes", "blockers[]"]
  } as any;
}
