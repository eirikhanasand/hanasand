import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { contractIndex, productReadinessContractCopyGuard, productReadinessIntegrationGate, productReadinessReceiptMatrixCoverage } from "../api/contractsRoute.ts";
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
    expect(rows.get("hanasand.product_readiness.receipt_matrix.v1")).toMatchObject({
      contractId: "product_readiness_receipt_matrix",
      ownerLane: "integration",
      route: "/v1/contracts",
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "member.role", "member.status", "capabilityId", "ownerLane"]),
      blockerCodes: expect.arrayContaining(["missing_contract_reference", "missing_contract_ids", "unsafe_receipt_matrix_row"]),
      downstreamConsumers: expect.arrayContaining([
        expect.objectContaining({ ownerLane: "integration", route: "/v1/contracts" }),
        expect.objectContaining({ ownerLane: "dashboard", route: "/dashboard" })
      ]),
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

  test("publishes product readiness receipt matrix discoverability", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    });
    const contract = await response.json() as any;
    const matrixSurface = contract.surfaces.find((surface: any) => surface.id === "product_readiness_receipt_matrix");
    const matrix = contract.productReadinessReceiptMatrix;
    const coverage = contract.productReadinessReceiptMatrixCoverage;
    const copyGuard = contract.productReadinessContractCopyGuard;
    const integrationGate = contract.productReadinessIntegrationGate;
    const matrixRows = JSON.parse(JSON.stringify(matrix.rows));
    const rows = new Map(matrixRows.map((row: any) => [row.capabilityId, row]));
    const knownSchemaIds = new Set<string>([
      ...contract.schemaLookup.rows.map((row: any) => row.schemaId),
      ...contract.receiptSchemas.flatMap((receipt: any) => Object.values(receipt.schemas)),
      ...matrixRows.flatMap((row: any) => row.schemaIds)
    ]);

    expect(matrixSurface).toMatchObject({
      ownerLane: "integration",
      route: "/v1/contracts",
      schemas: {
        matrix: "hanasand.product_readiness.receipt_matrix.v1",
        aggregate: "hanasand.product_readiness.v1"
      },
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "member.role", "member.status", "capabilityId"]),
      recordFields: expect.arrayContaining(["customerWorkflowIds", "contractIds", "schemaIds", "receiptSchemaIds", "blockerCodes", "downstreamOwners", "safeOutput"]),
      blockerCodes: expect.arrayContaining(["missing_contract_reference", "missing_contract_ids", "unsafe_receipt_matrix_row"]),
      downstreamConsumers: expect.arrayContaining([
        expect.objectContaining({ ownerLane: "integration", route: "/v1/contracts" }),
        expect.objectContaining({ ownerLane: "dashboard", route: "/dashboard" }),
        expect.objectContaining({ ownerLane: "support", route: "/api/admin/support/readiness" })
      ]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(matrix).toMatchObject({
      schemaVersion: "hanasand.product_readiness.receipt_matrix.v1",
      aggregateSchemaVersion: "hanasand.product_readiness.v1",
      route: "/v1/contracts",
      reportField: "productReadinessReceiptMatrix",
      producer: "buildProductReadinessReceiptMatrix",
      validator: "validateProductReadinessReceiptMatrix"
    });
    expect(coverage).toMatchObject({
      schemaVersion: "hanasand.product_readiness.receipt_matrix_coverage.v1",
      matrixSchemaVersion: "hanasand.product_readiness.receipt_matrix.v1",
      route: "/v1/contracts",
      ok: true,
      rowCount: 9,
      requiredCustomerWorkflowIds: [
        "org_membership",
        "shared_watchlists",
        "alert_generation",
        "webhook_delivery",
        "case_workflow",
        "source_health",
        "public_ti_handoff"
      ],
      requiredReceiptCapabilityIds: ["alert_case_workflow", "source_activation", "support_controls", "webhook_delivery"],
      requiredReceiptSchemaIdsByCapability: {
        source_activation: expect.arrayContaining(["ti.source_provenance_alert_rebuild_receipt.v1"]),
        alert_case_workflow: expect.arrayContaining(["dwm.org_alert_case_action_receipt.v1"]),
        webhook_delivery: expect.arrayContaining(["dwm.webhook_event_contract.v1"]),
        support_controls: expect.arrayContaining(["support.action_execution_handoff.v1"])
      },
      missingCapabilityIds: [],
      missingCustomerWorkflowIds: [],
      matrixSchemaLookupPresent: true,
      blockerCodes: [],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(coverage.diffRows.every((row: any) => row.ok)).toBe(true);
    expect(copyGuard).toMatchObject({
      schemaVersion: "hanasand.product_readiness.contract_copy_guard.v1",
      route: "/v1/contracts",
      ok: true,
      violationCount: 0,
      violations: [],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(copyGuard.scannedFieldCount).toBeGreaterThan(0);
    expect(integrationGate).toMatchObject({
      schemaVersion: "hanasand.product_readiness.integration_gate.v1",
      route: "/v1/contracts",
      ok: true,
      decision: "pass",
      checkCount: 2,
      blockerCodes: [],
      checks: expect.arrayContaining([
        expect.objectContaining({
          id: "receipt_matrix_coverage",
          ownerLane: "integration",
          artifact: "productReadinessReceiptMatrixCoverage",
          ok: true
        }),
        expect.objectContaining({
          id: "contract_copy_guard",
          ownerLane: "integration",
          artifact: "productReadinessContractCopyGuard",
          ok: true
        })
      ]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(matrixRows.map((row: any) => row.capabilityId).sort()).toEqual([
      "alert_case_workflow",
      "dashboard_operator_workspace",
      "organization_lifecycle",
      "public_ti_actor_handoff",
      "shared_watchlists",
      "source_activation",
      "support_controls",
      "webhook_delivery",
      "website_product_surface"
    ]);
    for (const row of matrixRows) {
      expect(Array.isArray(row.contractIds)).toBe(true);
      expect(row.contractIds).not.toHaveLength(0);
      expect(Array.isArray(row.customerWorkflowIds)).toBe(true);
      expect(row.customerWorkflowIds).not.toHaveLength(0);
      expect(Array.isArray(row.schemaIds)).toBe(true);
      expect(row.schemaIds).not.toHaveLength(0);
      expect(Array.isArray(row.scopeFields)).toBe(true);
      expect(row.scopeFields).not.toHaveLength(0);
      expect(Array.isArray(row.downstreamConsumers)).toBe(true);
      expect(row.downstreamConsumers).not.toHaveLength(0);
      expect(row.missingContract).toBe(false);
      expect(row.safeOutput).toEqual({
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      });
      for (const schemaId of [...row.schemaIds, ...row.receiptSchemaIds]) {
        expect(knownSchemaIds.has(schemaId)).toBe(true);
      }
    }
    expect(rows.get("shared_watchlists")).toMatchObject({
      ownerLane: "watchlist",
      customerWorkflowIds: expect.arrayContaining(["shared_watchlists", "alert_generation"]),
      readinessRoute: "GET /api/organizations/:id/watchlists/alert-terms",
      contractIds: expect.arrayContaining(["shared_watchlist_alert_export", "shared_watchlist_alert_generation"]),
      schemaIds: expect.arrayContaining([
        "organization.shared_watchlist_alert_generation_export.v1",
        "organization.shared_watchlist_alert_generation_consumers.v1",
        "organization.shared_watchlist_readiness_proof.v1"
      ]),
      blockerCodes: expect.arrayContaining(["not_member", "role_not_allowed", "no_active_watchlist_terms"]),
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "member.role", "member.status", "watchlistItemIds"]),
      downstreamOwners: expect.arrayContaining(["alert", "webhook", "dashboard"])
    });
    expect(rows.get("alert_case_workflow")).toMatchObject({
      ownerLane: "alert",
      customerWorkflowIds: expect.arrayContaining(["alert_generation", "case_workflow", "webhook_delivery"]),
      contractIds: expect.arrayContaining(["org_scoped_alert_case_workflow", "org_alert_case_workflow", "org_alert_case_action_receipt"]),
      receiptSchemaIds: expect.arrayContaining(["dwm.org_alert_case_action_receipt.v1", "dwm.org_alert_case_action_audit_event.v1"]),
      downstreamOwners: expect.arrayContaining(["case", "webhook", "dashboard"])
    });
    expect(rows.get("webhook_delivery")).toMatchObject({
      ownerLane: "webhook",
      customerWorkflowIds: ["webhook_delivery"],
      contractIds: expect.arrayContaining(["webhook_delivery_receipts"]),
      receiptSchemaIds: expect.arrayContaining(["dwm.webhook_event_contract.v1", "dwm.webhook_support_action_request.v1", "dwm.webhook_dispatch_retry_audit.v1"]),
      downstreamOwners: expect.arrayContaining(["dashboard", "support"])
    });
    expect(rows.get("source_activation")).toMatchObject({
      ownerLane: "source",
      customerWorkflowIds: expect.arrayContaining(["source_health", "alert_generation", "public_ti_handoff"]),
      receiptSchemaIds: expect.arrayContaining([
        "ti.source_provenance_alert_rebuild_receipt.v1",
        "ti.source_provenance_actor_enrichment_gap_receipt.v1",
        "ti.source_provenance_source_pack_intake_receipt.v1",
        "ti.source_provenance_source_activation_decision_receipt.v1"
      ]),
      downstreamOwners: expect.arrayContaining(["alert", "publicTI"])
    });
    const serialized = JSON.stringify(matrix);
    expect(serialized).not.toContain("https://discord.com");
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("webhookUrl");
    expect(serialized).not.toContain("rawText");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("dashboard slop");
    expect(serialized).not.toContain("control room");
    expect(serialized).not.toContain("how this feeds");
    expect(serialized).not.toContain("named examples");
  });

  test("rejects prompt-shaped product readiness contract labels before UI adoption", () => {
    const contract = contractIndex() as any;
    const broken = JSON.parse(JSON.stringify({
      surfaces: contract.surfaces,
      schemaLookup: contract.schemaLookup,
      productReadinessReceiptMatrix: contract.productReadinessReceiptMatrix
    }));
    broken.productReadinessReceiptMatrix.rows[0].blockerCodes.push("dashboard slop");
    broken.productReadinessReceiptMatrix.rows[1].downstreamConsumers[0].requiredFields.push("how this feeds");
    broken.surfaces.find((surface: any) => surface.id === "product_readiness_receipt_matrix").recordFields.push("named examples");
    broken.schemaLookup.rows[0].blockerCodes.push("control room");

    const guard = productReadinessContractCopyGuard(broken);

    expect(guard).toMatchObject({
      schemaVersion: "hanasand.product_readiness.contract_copy_guard.v1",
      route: "/v1/contracts",
      ok: false,
      violationCount: 4,
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(guard.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "productReadinessReceiptMatrix",
        capabilityId: "organization_lifecycle",
        term: "dashboard slop"
      }),
      expect.objectContaining({
        source: "productReadinessReceiptMatrix",
        capabilityId: "shared_watchlists",
        term: "how this feeds"
      }),
      expect.objectContaining({
        source: "surface",
        path: expect.stringContaining("recordFields"),
        term: "named examples"
      }),
      expect.objectContaining({
        source: "schemaLookup",
        path: expect.stringContaining("blockerCodes"),
        term: "control room"
      })
    ]));
  });

  test("builds a product readiness integration gate from coverage and copy guard artifacts", () => {
    const contract = contractIndex() as any;
    const brokenMatrix = JSON.parse(JSON.stringify(contract.productReadinessReceiptMatrix));
    brokenMatrix.rows[2].receiptSchemaIds = [];
    const coverage = productReadinessReceiptMatrixCoverage(
      brokenMatrix,
      contract.receiptSchemas,
      contract.schemaLookup.rows
    );
    const brokenCopy = JSON.parse(JSON.stringify({
      surfaces: contract.surfaces,
      schemaLookup: contract.schemaLookup,
      productReadinessReceiptMatrix: contract.productReadinessReceiptMatrix
    }));
    brokenCopy.productReadinessReceiptMatrix.rows[0].blockerCodes.push("signal");
    const copyGuard = productReadinessContractCopyGuard(brokenCopy);

    const gate = productReadinessIntegrationGate({ coverage, copyGuard });

    expect(gate).toMatchObject({
      schemaVersion: "hanasand.product_readiness.integration_gate.v1",
      route: "/v1/contracts",
      ok: false,
      decision: "hold",
      checkCount: 2,
      blockerCodes: expect.arrayContaining(["missing_required_receipt_schema", "copy_guard_signal"]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(gate.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "receipt_matrix_coverage",
        ok: false,
        evidence: expect.objectContaining({
          failingRows: expect.arrayContaining([
            expect.objectContaining({
              capabilityId: "source_activation",
              missingRequiredReceiptSchemaIds: expect.arrayContaining(["ti.source_provenance_alert_rebuild_receipt.v1"])
            })
          ])
        })
      }),
      expect.objectContaining({
        id: "contract_copy_guard",
        ok: false,
        evidence: expect.objectContaining({
          violationCount: 1,
          violations: expect.arrayContaining([
            expect.objectContaining({ capabilityId: "organization_lifecycle", term: "signal" })
          ])
        })
      })
    ]));
  });

  test("reports stale or unsafe product readiness matrix references", () => {
    const contract = contractIndex() as any;
    const brokenMatrix = JSON.parse(JSON.stringify(contract.productReadinessReceiptMatrix));
    brokenMatrix.rows = brokenMatrix.rows.filter((row: any) => row.capabilityId !== "website_product_surface");
    brokenMatrix.rows[0].contractIds = [];
    brokenMatrix.rows[0].customerWorkflowIds = [];
    brokenMatrix.rows[1].receiptSchemaIds = ["unknown.receipt.v1"];
    brokenMatrix.rows[2].receiptSchemaIds = ["ti.source_provenance_alert_rebuild_receipt.v1"];
    brokenMatrix.rows[2].downstreamConsumers = [];
    brokenMatrix.rows[3].safeOutput.rawEvidenceExposed = true;
    brokenMatrix.safeOutput.webhookSecretExposed = true;

    const coverage = productReadinessReceiptMatrixCoverage(
      brokenMatrix,
      contract.receiptSchemas,
      contract.schemaLookup.rows.filter((row: any) => row.schemaId !== "hanasand.product_readiness.receipt_matrix.v1")
    );
    const rows = new Map(coverage.diffRows.map((row: any) => [row.capabilityId, row]));

    expect(coverage).toMatchObject({
      ok: false,
      missingCapabilityIds: ["website_product_surface"],
      matrixSchemaLookupPresent: false,
      blockerCodes: expect.arrayContaining([
        "missing_capability_row",
        "missing_contract_ids",
        "missing_customer_workflow_ids",
        "stale_receipt_schema_reference",
        "missing_required_receipt_schema",
        "missing_downstream_consumers",
        "unsafe_receipt_matrix_row",
        "unsafe_receipt_matrix",
        "missing_matrix_schema_lookup"
      ]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(rows.get("organization_lifecycle")).toMatchObject({
      ok: false,
      missingContractIds: ["contractIds"],
      missingCustomerWorkflowIds: ["customerWorkflowIds"],
      blockerCodes: expect.arrayContaining(["missing_contract_ids", "missing_customer_workflow_ids"])
    });
    expect(rows.get("shared_watchlists")).toMatchObject({
      ok: false,
      unindexedReceiptSchemaIds: ["unknown.receipt.v1"],
      blockerCodes: expect.arrayContaining(["stale_receipt_schema_reference"])
    });
    expect(rows.get("source_activation")).toMatchObject({
      ok: false,
      missingRequiredReceiptSchemaIds: expect.arrayContaining([
        "ti.source_provenance_actor_enrichment_gap_receipt.v1",
        "ti.source_provenance_source_pack_intake_receipt.v1",
        "ti.source_provenance_source_activation_decision_receipt.v1"
      ]),
      missingDownstreamConsumers: ["downstreamConsumers"],
      blockerCodes: expect.arrayContaining(["missing_required_receipt_schema", "missing_downstream_consumers"])
    });
    expect(rows.get("alert_case_workflow")).toMatchObject({
      ok: false,
      unsafeFields: ["safeOutput.rawEvidenceExposed"],
      blockerCodes: expect.arrayContaining(["unsafe_receipt_matrix_row"])
    });
    const serialized = JSON.stringify(coverage);
    expect(serialized).not.toContain("https://discord.com");
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("webhookUrl");
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
        organizationAccessReadiness: "dwm.case_org_access_replay_readiness.v1",
        webhookReplayFixture: "dwm.case_to_webhook_replay_readiness_fixture.v1",
        publicTiHandoffReadiness: "dwm.case_public_ti_handoff_replay_readiness.v1",
        webhookDryRunReadiness: "dwm.case_webhook_dry_run_replay_readiness.v1",
        sourceHandoffReadiness: "dwm.case_source_handoff_replay_readiness.v1",
        supportRecoveryReadiness: "dwm.case_support_recovery_readiness.v1",
        readiness: "dwm.case_handoff_action_readiness.v1",
        detail: "analyst.case_detail.v1"
      },
      scopeFields: expect.arrayContaining(["organizationId", "caseId", "alertId", "actionId"]),
      writeFields: expect.arrayContaining(["actionId", "note", "idempotencyKey"]),
      queryFields: expect.arrayContaining(["actionId", "idempotencyKey", "dedupeKey", "actor", "eventAction"]),
      recordFields: expect.arrayContaining(["receiptId", "caseId", "alertId", "actionId", "auditEventId", "workflowEventId", "idempotencyKey", "dedupeKey", "captureIds", "sourceIds", "contentHashes", "webhookDeliveryId", "webhookDestinationId", "endpointHash", "payloadHash", "organizationAccessReadiness", "publicTiHandoffReadiness", "sourceFamily", "sourceHandoffReadiness", "supportRecoveryReadiness", "nextAnalystActions"]),
      blockerCodes: expect.arrayContaining(["case_not_found", "missing_case_alert", "handoff_action_not_ready", "case_read_only_member", "missing_webhook_destination", "missing_webhook_dry_run_receipt", "missing_alert_source_handoff_readiness", "public_ti_handoff_not_ready", "missing_case_owner", "case_closed"])
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
