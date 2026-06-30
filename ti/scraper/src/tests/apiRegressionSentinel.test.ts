import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("api regression sentinel", () => {
  test("keeps the compact buyer-visible route inventory available", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    expect(contract.routeInventory.routes.map((route: any) => route.path)).toEqual(expect.arrayContaining([
      "/v1/intel/search",
      "/api/ti/search",
      "/v1/darkweb/search",
      "/v1/ops/product-slo",
      "/v1/cases/:caseId",
      "/v1/dwm/org-alert-case-actions",
      "/v1/dwm/org-alert-case-actions/timeline"
    ]));
    expect(contract.semantics.noCredentialCollection).toBe(true);
  });

  test("publishes the org alert case action ledger contract for workflow consumers", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const ledgerSurface = contract.surfaces.find((surface: any) => surface.id === "org_alert_case_action_ledger");

    expect(contract.schemaVersion).toBe("ti.api_contract_index.compact.v4");
    expect(contract.routeInventory.routes).toEqual(expect.arrayContaining([
      { method: "GET", path: "/v1/dwm/org-alert-case-actions" },
      { method: "POST", path: "/v1/dwm/org-alert-case-actions" },
      { method: "GET", path: "/v1/dwm/org-alert-case-actions/timeline" }
    ]));
    expect(ledgerSurface).toMatchObject({
      ownerLane: "case",
      timelineRoute: "/v1/dwm/org-alert-case-actions/timeline",
      schemas: {
        list: "dwm.org_alert_case_action_ledger_api_list.v1",
        write: "dwm.org_alert_case_action_ledger_api_write.v1",
        timeline: "dwm.org_alert_case_action_timeline.v1"
      },
      scopeFields: ["tenantId", "organizationId"],
      queryFields: ["receiptId", "alertId", "casePath"],
      recordFields: expect.arrayContaining(["receiptId", "watchlistId", "alertIds", "casePaths", "auditEventId", "replayState", "idempotencyKey", "dedupeKey"]),
      caseQueueFilters: expect.arrayContaining(["caseActionIdempotencyKey", "caseActionDedupeKey", "caseActionReplayState"]),
      blockerCodes: expect.arrayContaining(["missing_tenant_scope", "missing_organization_scope", "organization_scope_mismatch"]),
      routeErrorCodes: expect.arrayContaining(["missing_receipt", "method_not_allowed"]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false
      }
    });
    expect(JSON.stringify(contract)).not.toContain("https://discord.com");
    expect(JSON.stringify(contract)).not.toContain("authorization:");
  });

  test("publishes the case workflow transition contract for workflow consumers", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const transitionSurface = contract.surfaces.find((surface: any) => surface.id === "case_workflow_transition");

    expect(transitionSurface).toMatchObject({
      ownerLane: "case",
      route: "/v1/cases/:caseId",
      methods: ["PATCH"],
      schemas: {
        transition: "analyst.case_workflow_transition.v1",
        detail: "analyst.case_detail.v1"
      },
      scopeFields: expect.arrayContaining(["organizationId", "caseId", "alertId"]),
      writeFields: expect.arrayContaining(["action", "assignedOwner", "note", "idempotencyKey"]),
      recordFields: expect.arrayContaining(["caseId", "alertId", "auditEventId", "eventId", "idempotencyKey", "dedupeKey", "replayState"]),
      blockerCodes: expect.arrayContaining(["organization_visibility_denied", "case_read_only_member", "invalid_case_transition", "unsupported_case_action"])
    });
    expect(JSON.stringify(transitionSurface)).not.toContain("https://discord.com");
  });
});
