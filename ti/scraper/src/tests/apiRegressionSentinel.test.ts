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
      "/v1/dwm/watchlists",
      "/v1/dwm/alerts/generation-readiness",
      "/v1/dwm/alerts/:alertId/case-handoff",
      "/v1/cases/:caseId/action-replay-export",
      "/v1/cases/:caseId/handoff-actions",
      "/v1/cases/:caseId/handoff-action",
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

  test("publishes safe receipt schema discoverability for integration consumers", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const receipts = new Map(contract.receiptSchemas.map((receipt: any) => [receipt.id, receipt]));

    expect(receipts.get("org_alert_case_action_receipt")).toMatchObject({
      ownerLane: "case",
      schemas: {
        receipt: "dwm.org_alert_case_action_receipt.v1",
        auditEvent: "dwm.org_alert_case_action_audit_event.v1",
        ledgerWrite: "dwm.org_alert_case_action_ledger_api_write.v1",
        ledgerList: "dwm.org_alert_case_action_ledger_api_list.v1",
        timeline: "dwm.org_alert_case_action_timeline.v1"
      },
      routes: expect.arrayContaining(["/v1/dwm/org-alert-case-actions", "/v1/dwm/org-alert-case-actions/timeline"]),
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "alertId", "casePath", "receiptId"]),
      requiredFields: expect.arrayContaining(["receiptId", "auditEventId", "idempotencyKey", "dedupeKey"]),
      blockerCodes: expect.arrayContaining(["missing_tenant_scope", "organization_scope_mismatch"]),
      downstreamConsumers: expect.arrayContaining([
        expect.objectContaining({ ownerLane: "dashboard", route: "/dashboard" }),
        expect.objectContaining({ ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver" })
      ]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(receipts.get("webhook_delivery_receipts")).toMatchObject({
      ownerLane: "webhook",
      schemas: {
        event: "dwm.webhook_event_contract.v1",
        supportHandoff: "dwm.webhook_event_support_handoff.v1",
        supportActionRequest: "dwm.webhook_support_action_request.v1",
        retryAudit: "dwm.webhook_dispatch_retry_audit.v1"
      },
      routes: expect.arrayContaining(["/v1/dwm/webhooks/deliver", "/api/organizations/:id/webhooks"]),
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "alertId", "caseId", "webhookDestinationId"]),
      requiredFields: expect.arrayContaining(["delivery.endpointHash", "evidence.evidenceCount"]),
      blockerCodes: expect.arrayContaining(["missing_webhook_destination", "unsupported_destination"]),
      downstreamConsumers: expect.arrayContaining([
        expect.objectContaining({ ownerLane: "case", route: "/v1/cases/:caseId" }),
        expect.objectContaining({ ownerLane: "support", route: "/api/admin/support/readiness" })
      ])
    });
    expect(receipts.get("source_provenance_receipts")).toMatchObject({
      ownerLane: "source",
      schemas: {
        alertRebuildReceipt: "ti.source_provenance_alert_rebuild_receipt.v1",
        actorEnrichmentGapReceipt: "ti.source_provenance_actor_enrichment_gap_receipt.v1",
        sourcePackIntakeReceipt: "ti.source_provenance_source_pack_intake_receipt.v1",
        sourceActivationDecisionReceipt: "ti.source_provenance_source_activation_decision_receipt.v1"
      },
      routes: expect.arrayContaining(["/v1/dwm/source-requests/readiness", "/v1/dwm/alerts/rebuild", "/ti"]),
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "sourceIds", "captureIds", "contentHashes"]),
      blockerCodes: expect.arrayContaining(["source_inactive", "missing_source_provenance"]),
      downstreamConsumers: expect.arrayContaining([
        expect.objectContaining({ ownerLane: "alert", route: "/v1/dwm/alerts/rebuild" }),
        expect.objectContaining({ ownerLane: "publicTI", route: "/ti" })
      ])
    });
    expect(receipts.get("support_action_receipts")).toMatchObject({
      ownerLane: "support",
      schemas: {
        executionHandoff: "support.action_execution_handoff.v1",
        executorReadiness: "support.action_executor_readiness.v1"
      },
      routes: expect.arrayContaining(["/api/admin/support/readiness", "/api/admin/support/organizations/:id/access-recovery"]),
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "actorId", "action", "idempotencyKey"]),
      requiredFields: expect.arrayContaining(["executorReadiness.ready", "audit.blockerCode"]),
      blockerCodes: expect.arrayContaining(["support_executor_unavailable", "helpdesk_audit_unavailable"])
    });

    for (const receipt of contract.receiptSchemas) {
      expect(receipt.safeOutput).toEqual({
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      });
    }
    const serialized = JSON.stringify(contract.receiptSchemas);
    expect(serialized).not.toContain("https://discord.com");
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("rawText");
    expect(serialized).not.toContain("password");
  });

  test("indexes receipt schema ids for direct integration lookup", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const rows = new Map(contract.schemaLookup.rows.map((row: any) => [row.schemaId, row]));

    expect(contract.schemaLookup).toMatchObject({
      schemaVersion: "ti.api_contract_schema_lookup.v1",
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(rows.get("dwm.org_alert_case_action_receipt.v1")).toMatchObject({
      contractId: "org_alert_case_action_receipt",
      ownerLane: "case",
      route: "/v1/dwm/org-alert-case-actions",
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "alertId", "casePath", "receiptId"]),
      blockerCodes: expect.arrayContaining(["missing_tenant_scope", "organization_scope_mismatch"]),
      downstreamConsumers: expect.arrayContaining([
        expect.objectContaining({ ownerLane: "dashboard", route: "/dashboard" }),
        expect.objectContaining({ ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver" })
      ]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(rows.get("dwm.webhook_event_contract.v1")).toMatchObject({
      contractId: "webhook_delivery_receipts",
      ownerLane: "webhook",
      route: "/v1/dwm/webhooks/deliver",
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "alertId", "caseId", "webhookDestinationId"]),
      blockerCodes: expect.arrayContaining(["missing_webhook_destination", "unsupported_destination"])
    });
    expect(rows.get("ti.source_provenance_alert_rebuild_receipt.v1")).toMatchObject({
      contractId: "source_provenance_receipts",
      ownerLane: "source",
      route: "/v1/dwm/alerts/rebuild",
      downstreamConsumers: expect.arrayContaining([
        expect.objectContaining({ ownerLane: "alert", route: "/v1/dwm/alerts/rebuild" }),
        expect.objectContaining({ ownerLane: "publicTI", route: "/ti" })
      ])
    });
    expect(rows.get("support.action_execution_handoff.v1")).toMatchObject({
      contractId: "support_action_receipts",
      ownerLane: "support",
      route: "/api/admin/support/readiness",
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "actorId", "idempotencyKey"])
    });
    const serialized = JSON.stringify(contract.schemaLookup);
    expect(serialized).not.toContain("https://discord.com");
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("rawText");
    expect(serialized).not.toContain("password");
  });

  test("publishes the shared watchlist alert export contract for org and alert consumers", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const exportSurface = contract.surfaces.find((surface: any) => surface.id === "shared_watchlist_alert_export");

    expect(contract.routeInventory.routes).toEqual(expect.arrayContaining([
      { method: "GET", path: "/v1/dwm/watchlists" },
      { method: "POST", path: "/v1/dwm/watchlists" },
      { method: "GET", path: "/v1/dwm/alerts/generation-readiness" }
    ]));
    expect(exportSurface).toMatchObject({
      ownerLane: "org",
      route: "/v1/dwm/watchlists",
      downstreamRoutes: {
        alertGenerationReadiness: "/v1/dwm/alerts/generation-readiness",
        alertRebuild: "/v1/dwm/alerts/rebuild",
        webhookDelivery: "/v1/dwm/webhooks/deliver"
      },
      methods: ["GET", "POST"],
      schemas: {
        export: "organization.shared_watchlist_alert_generation_export.v1",
        consumers: "organization.shared_watchlist_alert_generation_consumers.v1",
        runtimeWatchlist: "organization.watchlist_alert_generation.v1"
      },
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "member.role", "member.status"]),
      writeFields: expect.arrayContaining(["organizationId", "terms", "webhookDestinationId", "reason"]),
      recordFields: expect.arrayContaining(["watchlistId", "watchlistItemId", "alertGeneratorKey", "lifecycle.status", "dedupe.key"]),
      consumerFields: expect.arrayContaining(["runtimeWatchlists", "termExport.alertGeneratorKeys", "blockers.code"]),
      blockerCodes: expect.arrayContaining(["not_member", "member_inactive", "role_not_allowed", "term_org_mismatch", "no_active_watchlist_terms"]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false
      }
    });
    expect(JSON.stringify(exportSurface)).not.toContain("https://discord.com");
    expect(JSON.stringify(exportSurface)).not.toContain("rawText");
    expect(JSON.stringify(exportSurface)).not.toContain("password");
  });

  test("publishes the alert case handoff contract for workflow consumers", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const handoffSurface = contract.surfaces.find((surface: any) => surface.id === "alert_case_handoff");

    expect(handoffSurface).toMatchObject({
      ownerLane: "case",
      route: "/v1/dwm/alerts/:alertId/case-handoff",
      methods: ["POST"],
      schemas: {
        handoff: "dwm.alert_case_handoff.v1",
        case: "analyst.case_detail.v1"
      },
      scopeFields: expect.arrayContaining(["organizationId", "alertId", "caseId", "watchlistIds", "watchlistItemIds"]),
      writeFields: expect.arrayContaining(["assignedOwner", "note", "idempotencyKey"]),
      recordFields: expect.arrayContaining(["alertId", "caseId", "casePath", "webhookDestinationIds", "captureIds", "sourceIds", "contentHashes", "auditEventId", "workflowEventId", "dedupeKey", "deliveryDedupeKey", "replayState", "readiness", "consumerActions"]),
      caseDetailFields: expect.arrayContaining(["alertCaseHandoffContext", "handoffActionReadiness", "handoffActionReadiness.actions.alertReplay", "handoffActionReadiness.actions.webhookDryRun"]),
      consumerActions: expect.arrayContaining([
        expect.objectContaining({ id: "alertReplay", route: "/v1/dwm/alerts/:alertId/replay" }),
        expect.objectContaining({ id: "webhookDryRun", route: "/v1/dwm/webhooks/deliver" })
      ]),
      blockerCodes: expect.arrayContaining(["alert_not_found", "missing_alert_provenance", "missing_webhook_destination", "case_read_only_member"])
    });
    expect(JSON.stringify(handoffSurface)).not.toContain("https://discord.com");
  });

  test("publishes the case handoff action receipt contract for workflow consumers", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const receiptSurface = contract.surfaces.find((surface: any) => surface.id === "case_handoff_action_receipt");

    expect(contract.routeInventory.routes).toEqual(expect.arrayContaining([
      { method: "GET", path: "/v1/cases/:caseId/action-replay-export" },
      { method: "GET", path: "/v1/cases/:caseId/handoff-actions" },
      { method: "POST", path: "/v1/cases/:caseId/handoff-action" }
    ]));
    expect(receiptSurface).toMatchObject({
      ownerLane: "case",
      route: "/v1/cases/:caseId/handoff-action",
      historyRoute: "/v1/cases/:caseId/handoff-actions",
      replayExportRoute: "/v1/cases/:caseId/action-replay-export",
      methods: ["GET", "POST"],
      schemas: {
        receipt: "dwm.case_handoff_action_receipt.v1",
        history: "dwm.case_handoff_action_history.v1",
        replayExport: "dwm.case_action_replay_export.v1",
        readiness: "dwm.case_handoff_action_readiness.v1",
        detail: "analyst.case_detail.v1"
      },
      scopeFields: expect.arrayContaining(["organizationId", "caseId", "alertId", "actionId"]),
      writeFields: expect.arrayContaining(["actionId", "note", "idempotencyKey"]),
      queryFields: expect.arrayContaining(["actionId", "idempotencyKey", "dedupeKey", "actor", "eventAction"]),
      recordFields: expect.arrayContaining(["receiptId", "caseId", "alertId", "actionId", "auditEventId", "workflowEventId", "idempotencyKey", "dedupeKey", "captureIds", "sourceIds", "contentHashes"]),
      blockerCodes: expect.arrayContaining(["case_not_found", "missing_case_alert", "handoff_action_not_ready", "case_read_only_member", "missing_webhook_destination"])
    });
    expect(JSON.stringify(receiptSurface)).not.toContain("https://discord.com");
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
