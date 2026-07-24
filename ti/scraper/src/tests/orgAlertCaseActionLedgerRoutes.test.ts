import { describe, expect, test } from "bun:test";
import {
  handleOrgAlertCaseActionLedgerRequest,
  ORG_ALERT_CASE_ACTION_LEDGER_ROUTE,
  ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE
} from "../api/orgAlertCaseActionLedgerRoutes.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import type { OrgAlertCaseActionReceipt } from "../product/orgAlertWorkflowBridge.ts";
import { InMemoryOrgAlertCaseActionLedgerRepository } from "../storage/orgAlertCaseActionLedgerPostgres.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("org alert case action ledger route contract", () => {
  test("records a case action receipt and exposes scoped audit fields", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const response = await route(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        receipt: readyActionReceipt(),
        recordedAt: "2026-06-29T15:05:00.000Z"
      })
    }), repository);
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      schemaVersion: "dwm.org_alert_case_action_ledger_api_write.v1",
      ok: true,
      created: true,
      record: {
        receiptId: readyActionReceipt().id,
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
        auditEventId: expect.stringMatching(/^org_alert_case_action_audit_/)
      },
      blockers: []
    });
    expect(JSON.stringify(body)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(body)).not.toContain("https://discord.com");
  });

  test("dedupes POST receipt replay and lists by alert or receipt", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const receipt = readyActionReceipt();
    const body = JSON.stringify({ tenantId: "tenant_acme", organizationId: "org_acme", receipt });
    const created = await route(new Request(routeUrl(), { method: "POST", body }), repository);
    const duplicate = await route(new Request(routeUrl(), { method: "POST", body }), repository);
    const byAlert = await route(new Request(routeUrl("?tenantId=tenant_acme&organizationId=org_acme&alertId=alert_acme_lumma")), repository);
    const byReceipt = await route(new Request(routeUrl(`?tenantId=tenant_acme&organizationId=org_acme&receiptId=${receipt.id}`)), repository);

    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ ok: true, created: false, record: { receiptId: receipt.id } });
    expect(await byAlert.json()).toMatchObject({
      schemaVersion: "dwm.org_alert_case_action_ledger_api_list.v1",
      ok: true,
      query: { alertId: "alert_acme_lumma" },
      records: [expect.objectContaining({ receiptId: receipt.id, organizationId: "org_acme" })],
      blockers: []
    });
    expect((await byReceipt.json() as any).records).toHaveLength(1);
  });

  test("honors tenant and organization headers for scoped reads", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const receipt = readyActionReceipt();
    await route(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", organizationId: "org_acme", receipt })
    }), repository);
    const response = await route(new Request(routeUrl("?casePath=/v1/cases/case_acme_lumma%3FalertId%3Dalert_acme_lumma"), {
      headers: {
        "x-tenant-id": "tenant_acme",
        "x-organization-id": "org_acme"
      }
    }), repository);
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.records).toEqual([expect.objectContaining({ receiptId: receipt.id })]);
  });

  test("blocks missing receipt, missing scope, and organization mismatch", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const missingReceipt = await route(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", organizationId: "org_acme" })
    }), repository);
    const missingScope = await route(new Request(routeUrl("?tenantId=tenant_acme")), repository);
    const orgMismatch = await route(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_acme",
        organizationId: "org_other",
        receipt: readyActionReceipt()
      })
    }), repository);

    expect(missingReceipt.status).toBe(400);
    expect(await missingReceipt.json()).toMatchObject({ error: { code: "missing_receipt" } });
    expect(missingScope.status).toBe(400);
    expect(await missingScope.json()).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: "missing_organization_scope", ownerLane: "case" })]
    });
    expect(orgMismatch.status).toBe(400);
    expect(await orgMismatch.json()).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: "organization_scope_mismatch", path: "receipt.organizationId" })]
    });
  });

  test("returns undefined for unrelated routes and rejects unsupported methods", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    expect(await handleOrgAlertCaseActionLedgerRequest(new Request("http://127.0.0.1/v1/health"), { repository })).toBeUndefined();

    const response = await route(new Request(routeUrl(), { method: "DELETE" }), repository);
    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ error: { code: "method_not_allowed" } });
  });

  test("is reachable through the scraper API server with a durable per-options repository", async () => {
    const options = {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    };
    const receipt = readyActionReceipt();
    const created = await handleApiRequest(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        receipt,
        recordedAt: "2026-06-29T15:05:00.000Z"
      })
    }), options);
    const listed = await handleApiRequest(new Request(routeUrl(`?tenantId=tenant_acme&organizationId=org_acme&receiptId=${receipt.id}`)), options);
    const listedBody = await listed.json() as any;

    expect(created.status).toBe(201);
    expect(listed.status).toBe(200);
    expect(listedBody).toMatchObject({
      ok: true,
      records: [expect.objectContaining({
        receiptId: receipt.id,
        alertIds: ["alert_acme_lumma"],
        auditEventId: expect.stringMatching(/^org_alert_case_action_audit_/)
      })]
    });
  });

  test("uses an injected server repository so integration can share the ledger", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const options = {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier(),
      orgAlertCaseActionLedgerRepository: repository
    };
    const receipt = readyActionReceipt();

    const created = await handleApiRequest(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        receipt
      })
    }), options);

    expect(created.status).toBe(201);
    expect(repository.listScoped("tenant_acme", "org_acme")).toEqual([
      expect.objectContaining({
        receiptId: receipt.id,
        alertIds: ["alert_acme_lumma"],
        tenantId: "tenant_acme",
        organizationId: "org_acme"
      })
    ]);
  });

  test("exposes case action receipts as timeline rows for case consumers", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const receipt = readyActionReceipt();
    await route(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", organizationId: "org_acme", receipt })
    }), repository);

    const response = await route(new Request(timelineUrl("?tenantId=tenant_acme&organizationId=org_acme&casePath=/v1/cases/case_acme_lumma%3FalertId%3Dalert_acme_lumma&alertId=alert_acme_lumma")), repository);
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      schemaVersion: "dwm.org_alert_case_action_timeline.v1",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      alertId: "alert_acme_lumma",
      blockers: []
    });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      eventType: "case_action_recorded",
      receiptId: receipt.id,
      related: {
        watchlistId: "watch_acme_domains",
        alertIds: ["alert_acme_lumma"],
        casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"]
      },
      provenance: {
        source: "org_alert_case_action_ledger",
        receiptId: receipt.id
      }
    });
    expect(body.rows[0].provenance.auditEventId).toMatch(/^org_alert_case_action_audit_/);
    expect(JSON.stringify(body)).not.toContain("https://discord.com");
  });

  test("timeline route blocks missing scope and mismatched filters", async () => {
    const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
    const receipt = readyActionReceipt();
    await route(new Request(routeUrl(), {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", organizationId: "org_acme", receipt })
    }), repository);

    const missingScope = await route(new Request(timelineUrl("?tenantId=tenant_acme")), repository);
    const mismatched = await route(new Request(timelineUrl("?tenantId=tenant_acme&organizationId=org_acme&casePath=/v1/cases/other&alertId=alert_other")), repository);

    expect(missingScope.status).toBe(400);
    expect(await missingScope.json()).toMatchObject({
      ok: false,
      blockers: [expect.objectContaining({ code: "missing_organization_scope", ownerLane: "case" })]
    });
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toMatchObject({
      ok: false,
      rows: [],
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: "record_case_path_mismatch", ownerLane: "case" }),
        expect.objectContaining({ code: "record_alert_mismatch", ownerLane: "case" })
      ])
    });
  });

  test("timeline route rejects unsupported methods", async () => {
    const response = await route(new Request(timelineUrl(), { method: "POST" }), new InMemoryOrgAlertCaseActionLedgerRepository());
    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ error: { code: "method_not_allowed" } });
  });
});

async function route(request: Request, repository: InMemoryOrgAlertCaseActionLedgerRepository): Promise<Response> {
  const response = await handleOrgAlertCaseActionLedgerRequest(request, { repository });
  if (!response) throw new Error("Expected org alert case action ledger route to handle request.");
  return response;
}

function routeUrl(query = ""): string {
  return `http://127.0.0.1${ORG_ALERT_CASE_ACTION_LEDGER_ROUTE}${query}`;
}

function timelineUrl(query = ""): string {
  return `http://127.0.0.1${ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE}${query}`;
}

function readyActionReceipt(): OrgAlertCaseActionReceipt {
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
