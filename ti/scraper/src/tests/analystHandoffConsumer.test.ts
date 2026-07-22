import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  buildOrgScopedAlertWatchlistReadiness,
  orgWatchlistTermsToAlertGenerationRequest,
  persistedAlertToCaseHandoffPayload,
  persistedAlertToWebhookTriggerContext,
  publicTiArtifactToOrgWatchlistCreate,
} from "../product/analystHandoff.ts";
import {
  ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
  ANALYST_HANDOFF_CONTRACT_VERSIONS,
  ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION,
  PRODUCT_READINESS_FORBIDDEN_LANGUAGE,
  buildAnalystHandoffValidationReport,
  buildProductReadinessReceiptMatrix,
  validateAnalystHandoffConsumerBundle,
  validateBetaReadinessArtifact,
  validateProductReadinessAggregateArtifact,
  validateProductReadinessReceiptMatrix,
  type BetaReadinessArtifact,
  type AnalystHandoffConsumerBlockerCode,
  type AnalystHandoffConsumerBundle,
  type DwmWebhookDestinationLifecycleContract,
  type DwmWebhookAuditEventContract,
  type OrgWatchlistAlertTermsExportContract,
  type ProductReadinessAggregate,
  type ProductReadinessReceiptMatrix,
} from "../product/analystHandoffConsumer.ts";
import { buildDwmProductSnapshot, type DwmAlert } from "../product/dwmProduct.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_consumer_tg",
  name: "Consumer contract Telegram",
  type: "telegram_public",
  url: "https://t.me/consumer_contract",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.84,
  legalNotes: "Public channel preview only.",
  tenantId: "tenant_acme",
  createdAt: "2026-06-29T00:00:00.000Z",
  updatedAt: "2026-06-29T00:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_consumer_acme",
  sourceId: source.id,
  tenantId: "tenant_acme",
  url: "https://t.me/consumer_contract/11",
  collectedAt: "2026-06-29T00:03:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-consumer-acme",
  sensitive: false,
  body: "Lumma C2 broker channel mentions acme.com Okta sessions and a live AWS IAM key escrow offer.",
  metadata: { adapter: "telegram_public", channel: "consumer_contract", actorName: "Lumma C2", messageId: 11 }
} as RawCapture;

describe("analyst handoff consumer validation", () => {
  test("validates adapter output against org alert terms and webhook audit contracts without UI imports", () => {
    const watchlist = publicTiArtifactToOrgWatchlistCreate({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      requestedByUserId: "user_analyst",
      query: "Lumma C2",
      artifact: {
        id: "artifact_lumma_acme",
        kind: "tool",
        label: "Lumma C2",
        confidence: 91,
        freshness: "2026-06-29T00:10:00.000Z",
        provenance: ["public TI profile", "telegram broker-room capture"],
        watchlistTerms: [{ kind: "domain", value: "acme.com", notes: "Observed in Lumma C2 broker-room context." }]
      },
      generatedAt: "2026-06-29T00:10:00.000Z"
    });
    expect(watchlist.ok).toBe(true);
    if (!watchlist.ok) throw new Error("watchlist adapter failed");

    const generation = orgWatchlistTermsToAlertGenerationRequest({
      parent: watchlist.value.handoff,
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      webhookDestinationIds: ["webhook_discord"],
      createdAt: "2026-06-29T00:11:00.000Z"
    });
    expect(generation.ok).toBe(true);
    if (!generation.ok) throw new Error("generation adapter failed");

    const alert = alertFixture({
      caseIdCandidate: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme"
    });
    const caseHandoff = persistedAlertToCaseHandoffPayload({
      parent: generation.value.handoff,
      alert,
      requestedByUserId: "user_analyst",
      createdAt: "2026-06-29T00:12:00.000Z"
    });
    expect(caseHandoff.ok).toBe(true);
    if (!caseHandoff.ok) throw new Error("case handoff adapter failed");

    const webhook = persistedAlertToWebhookTriggerContext({
      parent: caseHandoff.value.handoff,
      alert,
      requestedByUserId: "user_analyst",
      dryRun: true,
      createdAt: "2026-06-29T00:13:00.000Z"
    });
    expect(webhook.ok).toBe(true);
    if (!webhook.ok) throw new Error("webhook adapter failed");

    const bundle: AnalystHandoffConsumerBundle = {
      schemaVersion: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
      generatedAt: "2026-06-29T00:14:00.000Z",
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z",
      entitlement: { schemaVersion: "dwm.entitlement_read_model.v1", allowed: true, feature: "dwm_alert_generation", plan: "enterprise" },
      membership: {
        userId: "user_analyst",
        organizationId: "org_acme",
        role: "admin",
        status: "active",
        allowedRoles: ["owner", "admin", "analyst"]
      },
      sourceReadiness: sourceReadiness(true),
      caseRoute: caseRoute(true),
      stages: {
        publicTi: watchlist.value,
        orgWatchlist: {
          ...generation.value,
          termsExport: orgTermsExport()
        },
        caseHandoff: caseHandoff.value,
        webhookTrigger: {
          ...webhook.value,
          auditEvents: webhookAuditEvents(webhook.value.request.body.idempotencyKey),
          destinationLifecycle: webhookLifecycle()
        }
      }
    };

    const validation = validateAnalystHandoffConsumerBundle(bundle);
    expect(validation.ok).toBe(true);
    expect(validation.blockers).toEqual([]);
    expect(validation.identity).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      requestedByUserId: "user_analyst",
      actorQuery: "lumma c2",
      artifactId: "artifact_lumma_acme",
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      alertId: "dwm_alert_acme",
      caseIdCandidate: "case_acme_lumma",
      webhookDestinationIds: ["webhook_discord"]
    });
    expect(validation.contracts).toEqual({
      publicTiSatisfied: true,
      orgAlertTermsSatisfied: true,
      alertRequestSatisfied: true,
      caseHandoffSatisfied: true,
      webhookTriggerSatisfied: true,
      webhookAuditSatisfied: true,
      webhookDestinationLifecycleSatisfied: true,
      sourceReadinessSatisfied: true,
      caseRouteAvailable: true
    });
  });

  test("checked-in happy fixture validates the full consumer chain", () => {
    const fixture = loadFixture("analyst-handoff-happy.json");
    const validation = validateAnalystHandoffConsumerBundle(fixture);
    expect(validation.ok).toBe(true);
    expect(validation.contracts.orgAlertTermsSatisfied).toBe(true);
    expect(validation.contracts.webhookAuditSatisfied).toBe(true);
    expect(validation.identity?.alertId).toBe("dwm_alert_acme");
  });

  test("checked-in blocker fixture reports typed consumer blockers", () => {
    const fixture = loadFixture("analyst-handoff-blockers.json");
    const validation = validateAnalystHandoffConsumerBundle(fixture);
    expect(validation.ok).toBe(false);
    const codes = new Set(validation.blockers.map((item) => item.code));
    const expected: AnalystHandoffConsumerBlockerCode[] = [
      "missing_org",
      "missing_provenance",
      "stale_evidence",
      "missing_watchlist_id",
      "missing_watchlist_item",
      "absent_alert_id",
      "entitlement_blocked",
      "nonmember",
      "identity_mismatch",
      "alert_generation_ref_mismatch",
      "org_terms_contract_mismatch",
      "webhook_trigger_contract_mismatch",
      "webhook_audit_contract_mismatch",
      "case_route_unavailable"
    ];
    for (const code of expected) expect(codes.has(code)).toBe(true);
  });

  test("reports partial success when org alert request is valid but webhook lifecycle is missing", () => {
    const fixture = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    delete fixture.stages.webhookTrigger?.destinationLifecycle;
    const validation = validateAnalystHandoffConsumerBundle(fixture);
    expect(validation.ok).toBe(false);
    expect(validation.contracts.orgAlertTermsSatisfied).toBe(true);
    expect(validation.contracts.alertRequestSatisfied).toBe(true);
    expect(validation.contracts.caseHandoffSatisfied).toBe(true);
    expect(validation.contracts.webhookTriggerSatisfied).toBe(true);
    expect(validation.contracts.webhookDestinationLifecycleSatisfied).toBe(false);
    expect(validation.blockers.map(item => item.code)).toContain("webhook_destination_lifecycle_mismatch");
  });

  test("reports partial success when alert handoff is valid but case route is absent", () => {
    const fixture = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    delete fixture.caseRoute;
    delete fixture.stages.caseHandoff;
    const validation = validateAnalystHandoffConsumerBundle(fixture);
    expect(validation.ok).toBe(false);
    expect(validation.contracts.alertRequestSatisfied).toBe(true);
    expect(validation.contracts.webhookTriggerSatisfied).toBe(true);
    expect(validation.contracts.caseHandoffSatisfied).toBe(false);
    expect(validation.contracts.caseRouteAvailable).toBe(false);
    expect(validation.blockers.map(item => item.code)).toContain("case_route_unavailable");
  });

  test("keeps fresh source provenance distinct from entitlement and membership blockers", () => {
    const fixture = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    fixture.entitlement = {
      schemaVersion: "dwm.entitlement_read_model.v1",
      allowed: false,
      reason: "Plan does not include DWM alert rebuilds.",
      feature: "dwm_alert_generation",
      plan: "starter"
    };
    fixture.membership = {
      userId: "user_external",
      organizationId: "org_acme",
      role: "viewer",
      status: "active",
      allowedRoles: ["owner", "admin", "analyst"]
    };
    fixture.sourceReadiness = sourceReadiness(true);
    const validation = validateAnalystHandoffConsumerBundle(fixture);
    expect(validation.ok).toBe(false);
    const codes = validation.blockers.map(item => item.code);
    expect(codes).toContain("entitlement_blocked");
    expect(codes).toContain("nonmember");
    expect(codes).not.toContain("source_worker_not_ready");
    expect(validation.contracts.sourceReadinessSatisfied).toBe(true);
  });

  test("builds lane-owned readiness reports for downstream adoption", () => {
    const happy = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    const report = buildAnalystHandoffValidationReport({
      checkedAt: "2026-06-29T01:00:00.000Z",
      results: [
        { file: "happy.json", bundle: happy },
        { file: "missing-org-ref.json", bundle: withMissingOrgRef(happy) },
        { file: "missing-alert-request.json", bundle: withMissingAlertRequest(happy) },
        { file: "missing-case-route.json", bundle: withMissingCaseRoute(happy) },
        { file: "stale-source.json", bundle: withStaleSource(happy) },
        { file: "entitlement-denied.json", bundle: withEntitlementDenied(happy) },
        { file: "webhook-lifecycle-missing.json", bundle: withMissingWebhookLifecycle(happy) },
        { file: "public-ti-provenance-missing.json", bundle: withPublicTiMissingProvenance(happy) },
        { file: "helpdesk-unavailable.json", bundle: withHelpdeskUnavailable(happy) }
      ]
    });

    expect(report.schemaVersion).toBe(ANALYST_HANDOFF_VALIDATION_REPORT_SCHEMA_VERSION);
    expect(report.contractVersions).toEqual(ANALYST_HANDOFF_CONTRACT_VERSIONS);
    expect(report.ok).toBe(false);
    expect(report.bundleCount).toBe(9);
    expect(report.passedCount).toBe(1);
    expect(report.failedCount).toBe(8);
    expect(report.productReadiness.org.blockerCodes).toContain("alert_generation_ref_mismatch");
    expect(report.productReadiness.alert.blockerCodes).toContain("missing_watchlist_id");
    expect(report.productReadiness.source.blockerCodes).toContain("source_worker_not_ready");
    expect(report.productReadiness.entitlement.blockerCodes).toContain("entitlement_blocked");
    expect(report.productReadiness.webhook.blockerCodes).toContain("webhook_destination_lifecycle_mismatch");
    expect(report.productReadiness.case.blockerCodes).toContain("case_route_unavailable");
    expect(report.productReadiness.publicTI.blockerCodes).toContain("missing_provenance");
    expect(report.productReadiness.helpdesk.blockerCodes).toContain("helpdesk_action_unavailable");

    const publicTiResult = report.results.find((item) => item.file === "public-ti-provenance-missing.json");
    expect(publicTiResult?.productReadiness.publicTI.recommendedOwnerLane).toBe("publicTI");
    expect(publicTiResult?.blockers.some((item) => item.ownerLane === "publicTI")).toBe(true);
  });

  test("includes compatibility action metadata from entitlement, source, and helpdesk contracts", () => {
    const happy = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    happy.compatibility = {
      entitlementBlockers: [{
        schemaVersion: "dwm.entitlement_blocker.v1",
        ownerLane: "entitlement",
        actionId: "alert_rebuild",
        action: "rebuild_dwm_alerts",
        blockerCode: "alert_rebuilds_per_day",
        blockedAction: "rebuild_dwm_alerts",
        status: "blocked",
        route: "/v1/dwm/alerts/rebuild",
        requestId: "req-entitlement",
        nextStep: "Upgrade plan or wait for quota reset.",
        supportText: "Alert rebuild quota reached.",
        dashboardText: "Alert rebuild quota reached.",
        source: "entitlement"
      }],
      sourceActions: [{
        schemaVersion: "dwm.source_pack_action_contract.v1",
        mode: "prepare",
        action: "activate",
        requestedAction: "approve",
        allowed: false,
        idempotencyKey: "source-action-key",
        sourcePackId: "pack_telegram",
        candidateId: "candidate_private_channel",
        blockers: [{ code: "stale_worker", severity: "blocking", message: "source worker is stale", retryable: true }]
      }],
      supportActions: [{
        schemaVersion: "support.action_execution_handoff.v1",
        executable: false,
        action: "access_recovery",
        idempotencyKey: "support-key",
        correlationId: "req-support",
        requestId: "req-support",
        blockers: ["missing_approval"],
        execution: { method: "POST", path: "/api/admin/support/organizations/org_acme/access-recovery" },
        audit: { blockerCode: "missing_approval" }
      }]
    };
    const report = buildAnalystHandoffValidationReport({
      checkedAt: "2026-06-29T01:10:00.000Z",
      results: [{ file: "compatibility.json", bundle: happy }]
    });

    expect(report.ok).toBe(false);
    expect(report.productReadiness.entitlement.blockerCodes).toContain("entitlement_blocked");
    expect(report.productReadiness.source.blockerCodes).toContain("source_worker_not_ready");
    expect(report.productReadiness.helpdesk.blockerCodes).toContain("helpdesk_action_unavailable");
    expect(report.results[0]?.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ownerLane: "entitlement",
        action: "rebuild_dwm_alerts",
        route: "/v1/dwm/alerts/rebuild",
        evidenceSchemaVersion: "dwm.entitlement_blocker.v1"
      }),
      expect.objectContaining({
        ownerLane: "source",
        action: "activate",
        route: "dwm_source_pack_action",
        evidenceSchemaVersion: "dwm.source_pack_action_contract.v1"
      }),
      expect.objectContaining({
        ownerLane: "helpdesk",
        action: "access_recovery",
        route: "/api/admin/support/organizations/org_acme/access-recovery",
        evidenceSchemaVersion: "support.action_execution_handoff.v1"
      })
    ]));
  });

  test("emits deploy-gate rows for Worker 3 without custom parsing", () => {
    const happy = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    happy.deployGateEvidence = {
      publicTiReadiness: [{
        schemaVersion: "ti.public_actor.readiness.v1",
        state: "ready",
        backedIds: {
          organizationIds: ["org_acme"],
          watchlistIds: ["watch_acme"],
          alertIds: ["dwm_alert_acme"],
          casePaths: ["/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme"],
          captureIds: ["cap_consumer_acme"],
          webhookDestinationIds: ["webhook_discord"]
        },
        blockers: []
      }],
      webhookDestinations: [{
        schemaVersion: "dwm.webhook.destination_admin_proof_row.v1",
        destinationId: "webhook_discord",
        orgId: "org_acme",
        access: { canRead: true, canManage: true, memberSafe: false },
        health: { ready: true, status: "ready", adminProofBlockers: [] },
        retry: { retryable: false, lastErrorCategory: null }
      }],
      orgLifecycle: [{
        schemaVersion: "organization.lifecycle_readiness.v1",
        organizationId: "org_acme",
        tenantId: "tenant_acme",
        readyForOnboarding: true,
        typedBlockers: [],
        watchlistReadiness: { ready: true },
        alertExportReadiness: { ready: true, route: "GET /api/organizations/:id/watchlists/alert-terms" }
      }],
      orgAlertWatchlistReadiness: [buildOrgScopedAlertWatchlistReadiness({
        adapter: happy.stages.orgWatchlist!,
        checkedAt: "2026-06-29T01:19:00.000Z"
      })],
      supportExecutor: [{
        schemaVersion: "support.action_executor_readiness.v1",
        ready: true,
        action: "invite_assist",
        mutationMode: "no_mutation_readiness",
        noMutation: true,
        executableByExistingEndpoint: true,
        blockers: [],
        executorContract: {
          method: "POST",
          path: "/api/admin/support/organizations/org_acme/invite-assist",
          requiredHeaders: ["authorization", "x-request-id", "x-idempotency-key"],
          requiredBody: ["organizationId", "email", "reason"]
        }
      }]
    };

    const blocked = clone(happy);
    blocked.deployGateEvidence = {
      publicTiReadiness: [{
        schemaVersion: "ti.public_actor.readiness.v1",
        state: "blocked",
        backedIds: { organizationIds: [], alertIds: [], casePaths: [], webhookDestinationIds: [] },
        blockers: [{ code: "missing_org", ownerLane: "org", route: "/dashboard/dwm" }]
      }],
      webhookDestinations: [{
        schemaVersion: "dwm.webhook.destination_admin_proof_row.v1",
        destinationId: "webhook_missing",
        orgId: "org_acme",
        access: { canRead: true, canManage: false, memberSafe: true },
        health: { ready: false, status: "blocked", adminProofBlockers: [{ code: "no_live_endpoint" }] },
        retry: { retryable: false, lastErrorCategory: "configuration" }
      }],
      orgLifecycle: [{
        schemaVersion: "organization.lifecycle_readiness.v1",
        organizationId: "org_acme",
        tenantId: "tenant_acme",
        readyForOnboarding: false,
        typedBlockers: ["watchlist_setup_required", "alert_export_unavailable"],
        watchlistReadiness: { ready: false },
        alertExportReadiness: { ready: false, route: "GET /api/organizations/:id/watchlists/alert-terms" }
      }],
      orgAlertWatchlistReadiness: [{
        schemaVersion: "organization.watchlist_alert_readiness.v1",
        ok: false,
        ownerLane: "alert",
        capability: "org_scoped_watchlist_alert_generation",
        checkedAt: "2026-06-29T01:19:00.000Z",
        route: "POST /v1/dwm/alerts/rebuild",
        routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "org_scoped_alert_case_workflow",
        expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
        proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/analystHandoff.test.ts",
        payloadShape: ["tenantId", "organizationId", "watchlistId", "watchlistItemIds", "publicTiHandoffId"],
        blockers: [{
          code: "missing_org",
          field: "organizationId",
          detail: "Org watchlist export is unavailable.",
          recoverable: true,
          ownerLane: "org",
          route: "GET /api/organizations/:id/watchlists/alert-terms",
          action: "export_shared_watchlist_terms"
        }],
        downstream: {
          caseRoute: "/v1/cases",
          webhookRoute: "/v1/dwm/webhooks/deliver",
          requiresOrgScopedWatchlist: true,
          requiresActiveWatchlistItems: true
        }
      }],
      supportExecutor: [{
        schemaVersion: "support.action_executor_readiness.v1",
        ready: false,
        action: "access_recovery",
        mutationMode: "no_mutation_readiness",
        noMutation: true,
        executableByExistingEndpoint: false,
        blockers: ["mutation_unavailable"],
        executorContract: {
          method: "POST",
          path: "/api/admin/support/organizations/org_acme/access-recovery",
          requiredHeaders: ["authorization", "x-request-id", "x-idempotency-key"],
          requiredBody: ["organizationId", "userId", "reason"]
        }
      }]
    };

    const report = buildAnalystHandoffValidationReport({
      checkedAt: "2026-06-29T01:20:00.000Z",
      results: [
        { file: "happy-worker3.json", bundle: happy },
        { file: "owner-blockers-worker3.json", bundle: blocked }
      ]
    });

    expect(report.deployGate.schemaVersion).toBe("hanasand.analyst_handoff.deploy_gate_assertions.v1");
    expect(report.deployGate.requiredContractVersions).toEqual(ANALYST_HANDOFF_CONTRACT_VERSIONS);
    expect(report.deployGate.ownerLaneMap).toMatchObject({
      org: "org",
      alert: "alert",
      webhook: "webhook",
      publicTI: "publicTI",
      helpdesk: "helpdesk"
    });
    expect(report.deployGate.rows.map((row) => row.kind)).toEqual(expect.arrayContaining([
      "public_ti_readiness",
      "org_alert_watchlist_readiness",
      "alert_case_handoff",
      "webhook_destination",
      "org_lifecycle",
      "support_executor"
    ]));
    expect(report.deployGate.rows.every((row) =>
      row.schemaVersion
      && row.ownerLane
      && Array.isArray(row.blockerCodes)
      && Array.isArray(row.requiredFields)
    )).toBe(true);
    expect(report.deployGate.rows.some((row) => row.kind === "public_ti_readiness" && row.ownerLane === "publicTI" && row.blockerCodes.includes("missing_org") && row.route === "/dashboard/dwm")).toBe(true);
    expect(report.deployGate.rows.some((row) =>
      row.kind === "org_alert_watchlist_readiness"
      && row.schemaVersion === "organization.watchlist_alert_readiness.v1"
      && row.route === "POST /v1/dwm/alerts/rebuild"
      && row.identity?.watchlistId === "watch_acme"
      && row.requiredFields.includes("request.body.watchlistItemIds")
    )).toBe(true);
    expect(report.deployGate.rows.some((row) =>
      row.kind === "org_alert_watchlist_readiness"
      && row.ownerLane === "org"
      && row.blockerCodes.includes("missing_org")
      && row.route === "POST /v1/dwm/alerts/rebuild"
    )).toBe(true);
    expect(report.deployGate.rows.some((row) => row.kind === "alert_case_handoff" && row.route === "/v1/cases" && row.identity?.alertId === "dwm_alert_acme")).toBe(true);
    expect(report.deployGate.rows.some((row) => row.kind === "webhook_destination" && row.ownerLane === "webhook" && row.blockerCodes.includes("no_live_endpoint"))).toBe(true);
    expect(report.deployGate.rows.some((row) => row.kind === "org_lifecycle" && row.ownerLane === "org" && row.blockerCodes.includes("watchlist_setup_required"))).toBe(true);
    expect(report.deployGate.rows.some((row) => row.kind === "support_executor" && row.ownerLane === "helpdesk" && row.action === "access_recovery" && row.route === "/api/admin/support/organizations/org_acme/access-recovery")).toBe(true);
    expect(report.readinessMatrix.schemaVersion).toBe("hanasand.analyst_handoff.readiness_matrix.v1");
    expect(report.readinessMatrix.rows.map((row) => row.id).sort()).toEqual([
      "discord_webhook_destination_delivery",
      "entitlement_policy_readiness",
      "org_scoped_alert_case_workflow",
      "organization_onboarding_lifecycle",
      "public_ti_actor_handoff",
      "shared_watchlist_alert_export",
      "source_activation_and_provenance",
      "support_admin_recovery_controls"
    ]);
    expect(report.readinessMatrix.rows.find((row) => row.id === "organization_onboarding_lifecycle")).toMatchObject({
      ownerLane: "org",
      status: "blocked",
      currentProofArtifact: {
        schemaVersion: "organization.lifecycle_readiness.v1",
        artifactId: "deploy_gate.org_lifecycle"
      },
      requiredRoute: "GET /api/organizations/:id/readiness-lifecycle",
      requiredProbe: "org.lifecycle_readiness",
      customerVisible: true,
      deployRisk: "high"
    });
    expect(report.readinessMatrix.rows.find((row) => row.id === "shared_watchlist_alert_export")).toMatchObject({
      ownerLane: "org",
      status: "ready",
      currentProofArtifact: {
        schemaVersion: "organization.watchlist_alert_terms_export.v1",
        artifactId: "org_watchlist.alert_terms_export"
      },
      requiredAction: "export_shared_watchlist_terms"
    });
    expect(report.readinessMatrix.rows.find((row) => row.id === "org_scoped_alert_case_workflow")).toMatchObject({
      ownerLane: "alert",
      status: "blocked",
      currentProofArtifact: {
        schemaVersion: "organization.watchlist_alert_readiness.v1",
        artifactId: "deploy_gate.org_alert_watchlist_readiness"
      },
      blockingGaps: ["missing_org"],
      requiredRoute: "/v1/cases",
      requiredAction: "create_case_from_org_alert"
    });
    expect(report.readinessMatrix.rows.find((row) => row.id === "source_activation_and_provenance")).toMatchObject({
      ownerLane: "source",
      status: "ready",
      requiredAction: "activate_source_pack"
    });
    expect(report.readinessMatrix.rows.find((row) => row.id === "discord_webhook_destination_delivery")).toMatchObject({
      ownerLane: "webhook",
      status: "blocked",
      blockingGaps: ["no_live_endpoint"],
      requiredAction: "deliver_dwm_webhook"
    });
    expect(report.readinessMatrix.rows.find((row) => row.id === "support_admin_recovery_controls")).toMatchObject({
      ownerLane: "helpdesk",
      status: "blocked",
      customerVisible: false,
      requiredAction: "prepare_support_recovery_action"
    });
    expect(report.readinessMatrix.rows.find((row) => row.id === "public_ti_actor_handoff")).toMatchObject({
      ownerLane: "publicTI",
      status: "blocked",
      blockingGaps: ["missing_org"]
    });
    expect(report.readinessMatrix.rows.find((row) => row.id === "entitlement_policy_readiness")).toMatchObject({
      ownerLane: "entitlement",
      status: "ready",
      requiredRoute: "GET /v1/organizations/:id/entitlements/readiness"
    });
    expect(report.betaDeployGateCoverage.schemaVersion).toBe("hanasand.beta_readiness.deploy_gate_coverage.v1");
    expect(report.betaDeployGateCoverage.rowCount).toBe(report.betaReadiness.rowCount);
    expect(report.betaDeployGateCoverage.rows.every((row) =>
      row.route
      && row.routeHandler
      && row.storageModule
      && row.proofRowId
      && row.expectedAdapter
      && row.payloadShape.length
      && row.proofCommand
      && row.productProofArtifactId
    )).toBe(true);
    expect(report.betaDeployGateCoverage.rows.find((row) => row.capabilityId === "generate_alert")).toMatchObject({
      ownerLane: "alert",
      route: "POST /v1/dwm/alerts/rebuild",
      expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
      requiredDeployGateKinds: ["org_alert_watchlist_readiness"],
      matchedDeployGateKinds: ["org_alert_watchlist_readiness"],
      integrationStatus: "blocked",
      blockerCodes: ["missing_org"]
    });
    expect(report.betaDeployGateCoverage.rows.find((row) => row.capabilityId === "configure_destinations")).toMatchObject({
      ownerLane: "webhook",
      requiredDeployGateKinds: ["webhook_destination"],
      matchedDeployGateKinds: ["webhook_destination"],
      blockerCodes: ["no_live_endpoint"]
    });
    expect(report.betaDeployGateCoverage.rows.find((row) => row.capabilityId === "create_shared_watchlist")).toMatchObject({
      ownerLane: "watchlist",
      integrationStatus: "product_proof_only",
      requiredDeployGateKinds: [],
      matchedDeployGateKinds: []
    });
  });

  test("emits a product readiness aggregate for Worker 3 and UI consumers", () => {
    const fixture = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    const report = buildAnalystHandoffValidationReport({
      checkedAt: "2026-06-29T01:40:00.000Z",
      results: [{ file: "customer-org.json", bundle: fixture }]
    });
    const aggregate = report.productReadinessAggregate;

    expect(aggregate.schemaVersion).toBe("hanasand.product_readiness.v1");
    expect(report.productReadinessReceiptMatrix.schemaVersion).toBe("hanasand.product_readiness.receipt_matrix.v1");
    expect(report.productReadinessReceiptMatrix.checkedAt).toBe("2026-06-29T01:40:00.000Z");
    expect(report.productReadinessReceiptMatrix.ok).toBe(true);
    expect(validateProductReadinessReceiptMatrix(report.productReadinessReceiptMatrix)).toMatchObject({ ok: true, blockerCodes: [] });
    expect(aggregate.checkedAt).toBe("2026-06-29T01:40:00.000Z");
    expect(aggregate.ok).toBe(true);
    expect(aggregate.rowCount).toBe(9);
    expect(aggregate.customerVisibleBlockedCount).toBe(0);
    expect(aggregate.rows.map((row) => row.id).sort()).toEqual([
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
    expect(aggregate.rows.every((row) =>
      row.workflowContract?.route
      && row.workflowContract.routeHandler
      && row.workflowContract.storageModule
      && row.workflowContract.proofRowId
      && row.workflowContract.testName
      && row.workflowContract.expectedAdapter
      && row.workflowContract.payloadShape.length
      && row.workflowContract.proofCommand
      && row.workflowContract.contractReferences?.length
    )).toBe(true);
    expect(validateProductReadinessAggregateArtifact(aggregate).ok).toBe(true);
    expect(aggregate.rows.find((row) => row.id === "organization_lifecycle")).toMatchObject({
      workflowContract: {
        route: "GET /api/organizations/:id/readiness-lifecycle",
        routeHandler: "api/src/handlers/organizations.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "organization_lifecycle",
        expectedAdapter: "organizationLifecycleReadiness"
      }
    });
    expect(aggregate.rows.find((row) => row.id === "shared_watchlists")).toMatchObject({
      workflowContract: {
        route: "GET /api/organizations/:id/watchlists/alert-terms",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "shared_watchlist_alert_export",
        expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
        contractReferences: [expect.objectContaining({
          contractId: "shared_watchlist_alert_generation",
          schemaVersions: expect.arrayContaining([
            "organization.shared_watchlist_alert_generation_export.v1",
            "organization.shared_watchlist_alert_generation_consumers.v1",
            "organization.shared_watchlist_readiness_proof.v1"
          ]),
          routes: expect.arrayContaining([
            "GET /api/organizations/:id/watchlists/alert-terms",
            "/v1/dwm/alerts/generation-readiness"
          ]),
          blockerCodes: expect.arrayContaining(["not_member", "role_not_allowed", "no_active_watchlist_terms"]),
          scopeFields: expect.arrayContaining(["tenantId", "organizationId", "member.role", "member.status", "watchlistItemIds"]),
          downstreamConsumers: expect.arrayContaining([
            expect.objectContaining({
              ownerLane: "alert",
              route: "/v1/dwm/alerts/generation-readiness",
              requiredFields: expect.arrayContaining(["runtimeWatchlists", "termExport.alertGeneratorKeys"])
            }),
            expect.objectContaining({
              ownerLane: "webhook",
              route: "/v1/dwm/webhooks/deliver",
              requiredFields: expect.arrayContaining(["runtimeWatchlists[].webhookDestinationId"])
            })
          ]),
          safeOutput: {
            metadataOnly: true,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
            crossOrgDataExposed: false
          }
        })]
      }
    });
    expect(aggregate.rows.find((row) => row.id === "dashboard_operator_workspace")).toMatchObject({
      ownerLane: "dashboard",
      customerVisibleState: "ready",
      uiQualityProofExists: true,
      proofArtifact: {
        schemaVersion: "hanasand.ui_quality_proof.v1",
        artifactId: "dashboard.render_proof.operator_workspace",
        route: "/dashboard"
      },
      workflowContract: {
        route: "/dashboard",
        routeHandler: "dashboard.operator_workspace",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "dashboard_operator_workspace"
      }
    });
    expect(aggregate.rows.find((row) => row.id === "source_activation")?.workflowContract.contractReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        receiptSchemaIds: expect.arrayContaining([
          "ti.source_provenance_alert_rebuild_receipt.v1",
          "ti.source_provenance_actor_enrichment_gap_receipt.v1",
          "ti.source_provenance_source_pack_intake_receipt.v1",
          "ti.source_provenance_source_activation_decision_receipt.v1"
        ]),
        routes: expect.arrayContaining(["GET /v1/dwm/source-requests/readiness", "POST /v1/dwm/source-requests/actions"]),
        blockerCodes: expect.arrayContaining(["source_inactive", "missing_source_provenance"]),
        downstreamConsumers: expect.arrayContaining([
          expect.objectContaining({ ownerLane: "alert", route: "POST /v1/dwm/alerts/rebuild" }),
          expect.objectContaining({ ownerLane: "publicTI", route: "/ti" })
        ])
      })
    ]));
    expect(aggregate.rows.find((row) => row.id === "website_product_surface")).toMatchObject({
      ownerLane: "website",
      customerVisibleState: "ready",
      uiQualityProofExists: true,
      requiredNextAction: "capture_website_product_surface_ui_proof",
      workflowContract: {
        route: "/",
        routeHandler: "website.product_surface",
        proofRowId: "website_product_surface"
      }
    });
    expect(aggregate.rows.find((row) => row.id === "webhook_delivery")).toMatchObject({
      ownerLane: "webhook",
      customerVisibleState: "ready",
      requiredNextAction: "verify_discord_webhook_destination",
      workflowContract: {
        route: "POST /api/organizations/:id/webhooks -> POST /v1/dwm/webhooks/deliver",
        proofRowId: "webhook_destination",
        expectedAdapter: "persistedAlertToWebhookTriggerContext",
        contractReferences: [expect.objectContaining({
          contractId: "webhook_delivery",
          schemaVersions: expect.arrayContaining(["dwm.webhook.destination_lifecycle.v1", "dwm.webhook.audit_event.v1"]),
          routes: expect.arrayContaining(["POST /api/organizations/:id/webhooks", "POST /v1/dwm/webhooks/deliver"]),
          blockerCodes: expect.arrayContaining(["missing_webhook_destination", "unsupported_destination"]),
          scopeFields: expect.arrayContaining(["organizationId", "destinationId", "alertId", "casePath"])
        })]
      }
    });
    expect(aggregate.rows.find((row) => row.id === "alert_case_workflow")?.workflowContract.contractReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        schemaVersions: expect.arrayContaining(["dwm.alert_case_handoff.v1", "analyst.case_detail.v1"]),
        receiptSchemaIds: expect.arrayContaining([
          "dwm.org_alert_case_action_receipt.v1",
          "dwm.org_alert_case_action_audit_event.v1"
        ]),
        downstreamConsumers: expect.arrayContaining([
          expect.objectContaining({ ownerLane: "case", route: "PATCH /v1/cases/:caseId" }),
          expect.objectContaining({ ownerLane: "dashboard", route: "/dashboard" })
        ])
      })
    ]));
    expect(aggregate.rows.find((row) => row.id === "support_controls")?.workflowContract.contractReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contractId: "support_recovery_receipts",
        receiptSchemaIds: expect.arrayContaining([
          "support.action_execution_handoff.v1",
          "support.action_executor_readiness.v1"
        ]),
        scopeFields: expect.arrayContaining(["tenantId", "organizationId", "actorId", "idempotencyKey"])
      })
    ]));
    const serialized = JSON.stringify(aggregate);
    expect(serialized).not.toContain("\"stages\"");
    expect(serialized).not.toContain("\"deployGate\"");
    expect(serialized).not.toContain("\"readinessMatrix\"");
  });

  test("emits a receipt matrix that maps product workflows to contracts and receipt schemas", () => {
    const fixture = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    const report = buildAnalystHandoffValidationReport({
      checkedAt: "2026-06-29T01:45:00.000Z",
      results: [{ file: "customer-org.json", bundle: fixture }]
    });
    const matrix = report.productReadinessReceiptMatrix;
    const serializedMatrix = JSON.stringify(matrix);

    expect(matrix).toMatchObject({
      schemaVersion: "hanasand.product_readiness.receipt_matrix.v1",
      checkedAt: "2026-06-29T01:45:00.000Z",
      ok: true,
      rowCount: 9,
      missingContractCount: 0
    });
    expect(validateProductReadinessReceiptMatrix(matrix)).toMatchObject({ ok: true, blockerCodes: [] });
    expect(serializedMatrix).not.toContain("webhookUrl");
    expect(serializedMatrix).not.toContain("token");
    expect(serializedMatrix).not.toContain("rawHtml");
    expect(matrix.rows.every((row) =>
      row.safeOutput.metadataOnly
      && !row.safeOutput.rawEvidenceExposed
      && !row.safeOutput.webhookSecretExposed
      && !row.safeOutput.crossOrgDataExposed
    )).toBe(true);
    expect(matrix.rows.map((row) => row.id).sort()).toEqual(report.productReadinessAggregate.rows.map((row) => row.id).sort());
    expect(matrix.rows.find((row) => row.id === "shared_watchlists")).toMatchObject({
      readinessRoute: "GET /api/organizations/:id/watchlists/alert-terms",
      contractIds: expect.arrayContaining(["shared_watchlist_alert_export", "shared_watchlist_alert_generation"]),
      schemaIds: expect.arrayContaining([
        "organization.shared_watchlist_alert_generation_export.v1",
        "organization.shared_watchlist_alert_generation_consumers.v1",
        "organization.shared_watchlist_readiness_proof.v1"
      ]),
      blockerCodes: expect.arrayContaining(["not_member", "role_not_allowed", "no_active_watchlist_terms"]),
      scopeFields: expect.arrayContaining(["tenantId", "organizationId", "member.role", "member.status", "watchlistItemIds"]),
      downstreamOwners: expect.arrayContaining(["alert", "webhook", "dashboard"]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(matrix.rows.find((row) => row.id === "source_activation")).toMatchObject({
      receiptSchemaIds: expect.arrayContaining([
        "ti.source_provenance_alert_rebuild_receipt.v1",
        "ti.source_provenance_actor_enrichment_gap_receipt.v1",
        "ti.source_provenance_source_pack_intake_receipt.v1",
        "ti.source_provenance_source_activation_decision_receipt.v1"
      ]),
      downstreamOwners: expect.arrayContaining(["alert", "publicTI"])
    });
    expect(matrix.rows.find((row) => row.id === "alert_case_workflow")).toMatchObject({
      contractIds: expect.arrayContaining(["org_scoped_alert_case_workflow", "org_alert_case_workflow"]),
      receiptSchemaIds: expect.arrayContaining([
        "dwm.org_alert_case_action_receipt.v1",
        "dwm.org_alert_case_action_audit_event.v1"
      ]),
      downstreamOwners: expect.arrayContaining(["case", "webhook", "dashboard"])
    });
    expect(matrix.rows.find((row) => row.id === "webhook_delivery")).toMatchObject({
      contractIds: expect.arrayContaining(["webhook_destination"]),
      receiptSchemaIds: [],
      downstreamOwners: expect.arrayContaining(["dashboard", "support"])
    });

    const brokenAggregate = clone(report.productReadinessAggregate) as ProductReadinessAggregate;
    brokenAggregate.rows[1] = {
      ...brokenAggregate.rows[1]!,
      workflowContract: {
        ...brokenAggregate.rows[1]!.workflowContract,
        contractReferences: []
      }
    };
    const brokenMatrix = buildProductReadinessReceiptMatrix(brokenAggregate, "2026-06-29T01:46:00.000Z");
    expect(brokenMatrix).toMatchObject({
      ok: false,
      missingContractCount: 1
    });
    expect(brokenMatrix.rows.find((row) => row.id === "shared_watchlists")).toMatchObject({
      missingContract: true,
      blockerCodes: expect.arrayContaining(["missing_contract_reference"])
    });
    expect(validateProductReadinessReceiptMatrix(brokenMatrix).blockerCodes).toContain("missing_contract_reference");

    const unsafeMatrix = clone(matrix) as ProductReadinessReceiptMatrix;
    unsafeMatrix.rows[0] = {
      ...unsafeMatrix.rows[0]!,
      safeOutput: {
        ...unsafeMatrix.rows[0]!.safeOutput,
        webhookSecretExposed: true
      }
    };
    expect(validateProductReadinessReceiptMatrix(unsafeMatrix).blockerCodes).toContain("unsafe_receipt_matrix_row");
  });

  test("validates checked-in product readiness fixtures for green-ish and blocked paths", () => {
    const greenish = loadFixture("product-readiness-greenish.json") as ProductReadinessAggregate;
    const blocked = loadFixture("product-readiness-blocked.json") as ProductReadinessAggregate;

    expect(validateProductReadinessAggregateArtifact(greenish)).toMatchObject({ ok: true, blockerCodes: [] });
    expect(greenish.ok).toBe(true);
    expect(greenish.rows.find((row) => row.id === "shared_watchlists")).toMatchObject({
      ownerLane: "watchlist",
      customerVisibleState: "ready",
      proofArtifact: { schemaVersion: "organization.watchlist_alert_terms_export.v1" },
      workflowContract: {
        route: "GET /api/organizations/:id/watchlists/alert-terms",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "shared_watchlist_alert_export"
      }
    });
    expect(greenish.rows.find((row) => row.id === "webhook_delivery")).toMatchObject({
      ownerLane: "webhook",
      customerVisibleState: "ready",
      requiredNextAction: "verify_discord_webhook_destination",
      workflowContract: {
        route: "POST /api/organizations/:id/webhooks -> POST /v1/dwm/webhooks/deliver",
        testName: "dwmWebhookDelivery.test.ts"
      }
    });
    expect(greenish.rows.every((row) => row.workflowContract.proofRowId && row.workflowContract.payloadShape.length)).toBe(true);

    expect(validateProductReadinessAggregateArtifact(blocked)).toMatchObject({ ok: true, blockerCodes: [] });
    expect(blocked.ok).toBe(false);
    expect(blocked.customerVisibleBlockedCount).toBe(4);
    expect(blocked.rows.find((row) => row.id === "source_activation")?.blockers).toContain("source_policy_inactive");
    expect(blocked.rows.find((row) => row.id === "webhook_delivery")?.blockers).toContain("missing_webhook_destination");
    expect(blocked.rows.find((row) => row.id === "dashboard_operator_workspace")?.blockers).toContain("missing_dashboard_ui_quality_proof");
    expect(blocked.rows.find((row) => row.id === "website_product_surface")?.blockers).toContain("missing_website_ui_quality_proof");
    const serialized = JSON.stringify(blocked);
    expect(serialized).not.toContain("\"stages\"");
    expect(serialized).not.toContain("\"compatibility\"");
    expect(serialized).not.toContain("\"deployGateEvidence\"");
  });

  test("emits beta readiness for the end-to-end organization monitoring workflow", () => {
    const fixture = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    const report = buildAnalystHandoffValidationReport({
      checkedAt: "2026-06-29T02:30:00.000Z",
      results: [{ file: "customer-org.json", bundle: fixture }]
    });
    const beta = report.betaReadiness;

    expect(beta.schemaVersion).toBe("hanasand.beta_readiness.v1");
    expect(beta.ok).toBe(true);
    expect(beta.status).toBe("nearly_sellable");
    expect(beta.customerWorkflow).toBe("organization_threat_monitoring");
    expect(beta.rows.map((row) => row.id)).toEqual([
      "create_organization",
      "invite_teammate",
      "create_shared_watchlist",
      "activate_source_coverage",
      "generate_alert",
      "configure_destinations",
      "work_alert",
      "open_link_case",
      "deliver_discord_webhook",
      "support_access_recovery",
      "public_ti_actor_relevance"
    ]);
    expect(beta.rows.every((row) => row.persistenceMode === "real_persistence")).toBe(true);
    expect(beta.rows.every((row) =>
      row.expectedAdapter
      && row.payloadShape.length
      && row.proofCommand
      && row.workflowContract?.route
      && row.workflowContract.routeHandler
      && row.workflowContract.storageModule
      && row.workflowContract.proofRowId
      && row.workflowContract.testName
    )).toBe(true);
    expect(beta.rows.find((row) => row.id === "invite_teammate")).toMatchObject({
      ownerLane: "support",
      customerVisibleState: "ready",
      requiredNextAction: "verify_team_invitation_action",
      expectedAdapter: "supportActionExecutorReadiness",
      workflowContract: {
        route: "POST /api/admin/support/organizations/:id/invites",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "support_executor"
      }
    });
    expect(beta.rows.find((row) => row.id === "create_shared_watchlist")).toMatchObject({
      workflowContract: {
        route: "GET /api/organizations/:id/watchlists/alert-terms",
        routeHandler: "api/src/handlers/organizations.ts",
        storageModule: "api/src/utils/organizations.ts",
        proofRowId: "shared_watchlist_alert_export"
      }
    });
    expect(beta.rows.find((row) => row.id === "generate_alert")).toMatchObject({
      workflowContract: {
        route: "POST /v1/dwm/alerts/rebuild",
        routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "org_scoped_alert_case_workflow"
      }
    });
    expect(beta.rows.find((row) => row.id === "work_alert")).toMatchObject({
      ownerLane: "dashboard",
      uiQualityProofStatus: "present",
      customerVisibleState: "ready",
      workflowContract: {
        route: "/dashboard",
        routeHandler: "dashboard.operator_workspace",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
        proofRowId: "dashboard_operator_workspace"
      }
    });
    expect(beta.rows.find((row) => row.id === "open_link_case")).toMatchObject({
      ownerLane: "alert",
      expectedAdapter: "persistedAlertToCaseHandoffPayload",
      customerVisibleState: "ready",
      workflowContract: {
        route: "POST /v1/cases",
        routeHandler: "ti/scraper/src/api/caseRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts"
      }
    });
    expect(beta.rows.find((row) => row.id === "deliver_discord_webhook")).toMatchObject({
      ownerLane: "webhook",
      expectedAdapter: "persistedAlertToWebhookTriggerContext",
      customerVisibleState: "ready",
      workflowContract: {
        route: "POST /v1/dwm/webhooks/deliver",
        routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts",
        storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts"
      }
    });
    expect(beta.rows.find((row) => row.id === "public_ti_actor_relevance")).toMatchObject({
      ownerLane: "publicTI",
      customerVisibleState: "ready",
      requiredNextAction: "verify_source_backed_ti_coverage",
      workflowContract: {
        route: "/ti",
        routeHandler: "ti.actor_profile_surface",
        storageModule: "api/src/utils/ti/search.ts",
        proofRowId: "public_ti_actor_handoff"
      }
    });
    expect(validateBetaReadinessArtifact(beta)).toMatchObject({ ok: true, blockerCodes: [] });
    expect(report.betaDeployGateCoverage).toMatchObject({
      schemaVersion: "hanasand.beta_readiness.deploy_gate_coverage.v1",
      ok: true,
      uncoveredCount: 0,
      rowCount: beta.rowCount
    });
    expect(report.betaDeployGateCoverage.rows.find((row) => row.capabilityId === "generate_alert")).toMatchObject({
      integrationStatus: "covered",
      requiredDeployGateKinds: ["org_alert_watchlist_readiness"],
      matchedDeployGateKinds: ["org_alert_watchlist_readiness"],
      blockerCodes: []
    });
    const serialized = JSON.stringify(beta);
    expect(serialized).not.toContain("\"stages\"");
    expect(serialized).not.toContain("\"deployGate\"");
    expect(serialized).not.toContain("\"productReadinessAggregate\"");
  });

  test("validates beta readiness fixtures for nearly-sellable and blocked org paths", () => {
    const nearlySellable = loadFixture("beta-readiness-nearly-sellable.json") as BetaReadinessArtifact;
    const blocked = loadFixture("beta-readiness-blocked.json") as BetaReadinessArtifact;

    expect(validateBetaReadinessArtifact(nearlySellable)).toMatchObject({ ok: true, blockerCodes: [] });
    expect(nearlySellable.ok).toBe(true);
    expect(nearlySellable.rows.find((row) => row.id === "configure_destinations")).toMatchObject({
      ownerLane: "webhook",
      persistenceMode: "real_persistence",
      customerVisibleState: "ready",
      workflowContract: {
        route: "POST /api/organizations/:id/webhooks",
        routeHandler: "api/src/handlers/dwm/webhooks.ts",
        storageModule: "api/src/utils/dwm/webhooks.ts",
        proofRowId: "webhook_destination"
      }
    });
    expect(nearlySellable.rows.every((row) => row.workflowContract.proofRowId && row.workflowContract.testName)).toBe(true);

    expect(validateBetaReadinessArtifact(blocked)).toMatchObject({ ok: true, blockerCodes: [] });
    expect(blocked.ok).toBe(false);
    expect(blocked.rows.find((row) => row.id === "generate_alert")?.blockers).toContain("source_coverage_required_for_alert_generation");
    expect(blocked.rows.find((row) => row.id === "configure_destinations")?.blockers).toContain("missing_webhook_destination");
    expect(blocked.rows.find((row) => row.id === "work_alert")?.uiQualityProofStatus).toBe("missing");
    expect(blocked.rows.find((row) => row.id === "public_ti_actor_relevance")?.blockers).toContain("source_policy_inactive");
    const serialized = JSON.stringify(blocked);
    expect(serialized).not.toContain("\"stages\"");
    expect(serialized).not.toContain("\"compatibility\"");
    expect(serialized).not.toContain("\"deployGateEvidence\"");
  });

  test("keeps validator modules free of UI, network, and database imports", () => {
    const consumerSource = readFileSync(new URL("../product/analystHandoffConsumer.ts", import.meta.url), "utf8");
    const validatorSource = readFileSync(new URL("../../scripts/validateAnalystHandoffBundles.ts", import.meta.url), "utf8");
    const combined = `${consumerSource}\n${validatorSource}`;

    expect(combined).not.toContain("frontend/");
    expect(combined).not.toContain("next/");
    expect(combined).not.toContain("#db");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("axios");
    expect(combined).not.toContain("postgres");
  });

  test("keeps readiness matrix rows free of prompt-shaped presentation language", () => {
    const fixture = clone(loadFixture("analyst-handoff-happy.json") as AnalystHandoffConsumerBundle);
    const report = buildAnalystHandoffValidationReport({
      checkedAt: "2026-06-29T01:30:00.000Z",
      results: [{ file: "customer-org.json", bundle: fixture }]
    });
    for (const row of report.readinessMatrix.rows) {
      const uiFacing = [
        row.capability,
        row.currentProofArtifact.artifactId,
        row.requiredRoute,
        row.requiredAction,
        row.requiredProbe,
        ...row.blockingGaps
      ].filter(Boolean).join(" ").toLowerCase();
      for (const phrase of PRODUCT_READINESS_FORBIDDEN_LANGUAGE) expect(uiFacing).not.toContain(phrase);
    }
    for (const row of report.productReadinessAggregate.rows) {
      const uiFacing = [
        row.capabilityLabel,
        row.requiredNextAction,
        row.proofArtifact.artifactId,
        ...row.blockers
      ].filter(Boolean).join(" ").toLowerCase();
      for (const phrase of PRODUCT_READINESS_FORBIDDEN_LANGUAGE) expect(uiFacing).not.toContain(phrase);
    }
    const badAggregate = clone(report.productReadinessAggregate) as ProductReadinessAggregate;
    badAggregate.rows[0] = {
      ...badAggregate.rows[0]!,
      capabilityLabel: "Dashboard slop control room"
    };
    expect(validateProductReadinessAggregateArtifact(badAggregate).blockerCodes).toContain("prompt_shaped_language");
    const badProductWorkflow = clone(report.productReadinessAggregate) as ProductReadinessAggregate;
    delete (badProductWorkflow.rows[0] as Partial<(typeof badProductWorkflow.rows)[number]>).workflowContract;
    expect(validateProductReadinessAggregateArtifact(badProductWorkflow).blockerCodes).toContain("missing_workflow_contract");
    const unsafeContractReference = clone(report.productReadinessAggregate) as ProductReadinessAggregate;
    unsafeContractReference.rows[1] = {
      ...unsafeContractReference.rows[1]!,
      workflowContract: {
        ...unsafeContractReference.rows[1]!.workflowContract,
        contractReferences: [{
          contractId: "",
          ownerLane: "watchlist",
          schemaVersions: [],
          receiptSchemaIds: [],
          routes: [],
          blockerCodes: [],
          scopeFields: [],
          downstreamConsumers: [],
          safeOutput: {
            metadataOnly: true,
            rawEvidenceExposed: true,
            webhookSecretExposed: false,
            crossOrgDataExposed: false
          } as any
        }]
      }
    };
    expect(validateProductReadinessAggregateArtifact(unsafeContractReference).blockerCodes).toEqual(expect.arrayContaining([
      "missing_contract_schema_ids",
      "missing_receipt_schema_ids",
      "missing_contract_routes",
      "missing_contract_scope_fields",
      "unsafe_contract_reference"
    ]));
    const badBeta = clone(report.betaReadiness) as BetaReadinessArtifact;
    badBeta.rows[0] = {
      ...badBeta.rows[0]!,
      capabilityLabel: "Control room signal"
    };
    expect(validateBetaReadinessArtifact(badBeta).blockerCodes).toContain("prompt_shaped_language");
    const missingWorkflowContract = clone(report.betaReadiness) as BetaReadinessArtifact;
    delete (missingWorkflowContract.rows[0] as Partial<(typeof missingWorkflowContract.rows)[number]>).workflowContract;
    expect(validateBetaReadinessArtifact(missingWorkflowContract).blockerCodes).toContain("missing_workflow_contract");
  });
});

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

function orgTermsExport(): OrgWatchlistAlertTermsExportContract {
  return {
    schemaVersion: "organization.watchlist_alert_terms_export.v1",
    organizationId: "org_acme",
    tenantId: "tenant_acme",
    member: {
      userId: "user_analyst",
      role: "admin",
      status: "active"
    },
    allowedViewerRoles: ["owner", "admin", "analyst"],
    activeTerms: [{
      watchlistItemId: "watch_item_acme_domain",
      itemId: "item_acme_domain",
      termFamily: "domain",
      term: "acme.com",
      source: "organization_shared_watchlist",
      alertGenerationRef: {
        schemaVersion: "organization.watchlist_alert_generation_ref.v1",
        source: "organization_shared_watchlist",
        organizationId: "org_acme",
        tenantId: "tenant_acme",
        ownerOrganizationId: "org_acme",
        watchlistId: "watch_item_acme_domain",
        watchlistItemId: "watch_item_acme_domain",
        itemId: "item_acme_domain",
        termFamily: "domain",
        category: "domain",
        term: "acme.com",
        normalizedTerm: "acme.com",
        status: "active",
        lifecycle: {
          status: "active",
          reason: "Consumer contract fixture.",
          requestId: "req-consumer-watchlist",
          createdBy: "user_analyst",
          updatedBy: "user_analyst"
        },
        dedupe: {
          scope: "organization_watchlist_term",
          key: "org:org_acme:watchlist:watch_item_acme_domain:domain:acme.com",
          parts: {
            organizationId: "org_acme",
            tenantId: "tenant_acme",
            watchlistItemId: "watch_item_acme_domain",
            termFamily: "domain",
            normalizedTerm: "acme.com"
          }
        }
      },
      alertGenerationReference: {
        schemaVersion: "organization.watchlist_item_alert_reference.v1",
        organizationId: "org_acme",
        tenantId: "tenant_acme",
        watchlistItemId: "watch_item_acme_domain",
        itemId: "item_acme_domain",
        termFamily: "domain",
        term: "acme.com",
        status: "active"
      }
    }],
    activeWatchlistTerms: [{
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      watchlistItemId: "watch_item_acme_domain",
      itemId: "item_acme_domain",
      termFamily: "domain",
      term: "acme.com",
      status: "active"
    }],
    blockedReasons: [],
    canGenerateAlerts: true
  };
}

function webhookAuditEvents(idempotencyKey: string): DwmWebhookAuditEventContract[] {
  return [{
    schemaVersion: "dwm.webhook.audit_event.v1",
    auditEventId: "audit_webhook_acme",
    action: "delivery.dry_run",
    orgId: "org_acme",
    actorId: "user_analyst",
    destinationId: "webhook_discord",
    deliveryId: "delivery_acme",
    delivery: {
      alertId: "dwm_alert_acme",
      eventType: "darkweb.monitoring.match",
      status: "dry_run",
      dryRun: true,
      idempotencyKey,
      watchlistId: "watch_acme",
      route: "identity_response",
      casePath: "/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme"
    },
    createdAt: "2026-06-29T00:13:30.000Z"
  }];
}

function webhookLifecycle(): DwmWebhookDestinationLifecycleContract[] {
  return [{
    schemaVersion: "dwm.webhook.destination_lifecycle.v1",
    destinationId: "webhook_discord",
    orgId: "org_acme",
    type: "discord",
    label: "Discord SOC",
    status: "active",
    enabled: true,
    access: {
      role: "admin",
      canReadStatus: true,
      canManage: true,
      canUpdate: true,
      canTest: true,
      canDisable: true,
      memberSafe: false
    },
    lifecycle: {
      lastDryRun: { deliveryId: "delivery_acme" },
      lastTest: null,
      lastReplay: null,
      lastDelivery: null,
      lastFailure: null,
      lastLiveDisabled: null
    },
    retry: {
      retryable: false,
      nextRetryAt: null,
      attemptCount: 1,
      lastErrorCategory: null,
      reason: null,
      deliveryId: "delivery_acme",
      dedupeKey: "dwm_dedupe_acme"
    },
    health: {
      status: "ready",
      ready: true,
      blockers: [],
      liveDeliveryEnabled: false,
      idempotencyCoverage: { covered: true }
    },
    auditEventContracts: webhookAuditEvents("dwm_webhook_trigger_acme"),
    updatedAt: "2026-06-29T00:13:30.000Z",
    createdAt: "2026-06-29T00:00:00.000Z"
  }];
}

function sourceReadiness(ready: boolean) {
  return {
    schemaVersion: "dwm.source_worker_readiness.v1" as const,
    ready,
    freshProvenance: ready,
    sourceIds: ready ? ["src_consumer_tg"] : [],
    blockers: ready ? [] : ["source worker is behind"],
    checkedAt: "2026-06-29T00:13:00.000Z"
  };
}

function caseRoute(available: boolean) {
  return {
    schemaVersion: "case.route_availability.v1" as const,
    available,
    path: "/v1/cases" as const,
    methods: available ? ["POST" as const] : [],
    reason: available ? undefined : "Case API route is not mounted.",
    checkedAt: "2026-06-29T00:13:00.000Z"
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withMissingOrgRef(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  if (fixture.stages.orgWatchlist?.termsExport?.activeTerms?.[0]) {
    delete fixture.stages.orgWatchlist.termsExport.activeTerms[0].alertGenerationRef;
  }
  return fixture;
}

function withMissingAlertRequest(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  if (fixture.stages.orgWatchlist?.request.body) fixture.stages.orgWatchlist.request.body.watchlistId = "";
  if (fixture.stages.caseHandoff?.request.body) fixture.stages.caseHandoff.request.body.alertId = "";
  if (fixture.stages.webhookTrigger?.request.body) fixture.stages.webhookTrigger.request.body.alertId = "";
  return fixture;
}

function withMissingCaseRoute(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  delete fixture.caseRoute;
  return fixture;
}

function withStaleSource(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  fixture.sourceReadiness = {
    schemaVersion: "dwm.source_worker_readiness.v1",
    ready: false,
    freshProvenance: false,
    sourceIds: [],
    blockers: ["source health stale"],
    checkedAt: "2026-06-29T01:00:00.000Z"
  };
  return fixture;
}

function withEntitlementDenied(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  fixture.entitlement = {
    schemaVersion: "dwm.entitlement_read_model.v1",
    allowed: false,
    reason: "Plan limit reached.",
    feature: "dwm_alert_generation",
    plan: "trial"
  };
  return fixture;
}

function withMissingWebhookLifecycle(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  delete fixture.stages.webhookTrigger?.destinationLifecycle;
  return fixture;
}

function withPublicTiMissingProvenance(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  fixture.publicTi = {
    schemaVersion: "ti.public_actor.authenticated_bridge.v1",
    source: "public-ti",
    action: "create_watchlist",
    artifactId: "artifact_lumma_acme",
    query: "Lumma C2",
    generatedAt: "2026-06-29T00:14:00.000Z",
    artifact: {
      id: "artifact_lumma_acme",
      kind: "tool",
      label: "Lumma C2",
      freshness: "2026-06-29T00:10:00.000Z",
      provenance: [],
      watchlistTerms: [{ kind: "domain", value: "acme.com" }]
    },
    orgRequired: true,
    sourceRequired: true,
    stale: false,
    missing: ["provenance"],
    blockers: [{ code: "source_required", detail: "Attach source provenance." }]
  };
  return fixture;
}

function withHelpdeskUnavailable(input: AnalystHandoffConsumerBundle): AnalystHandoffConsumerBundle {
  const fixture = clone(input);
  fixture.helpdeskAction = {
    schemaVersion: "helpdesk.action_availability.v1",
    available: false,
    action: "open_case",
    route: "/v1/cases",
    reason: "Helpdesk case workflow is not mounted.",
    checkedAt: "2026-06-29T01:00:00.000Z"
  };
  return fixture;
}

function alertFixture(overrides: { organizationId?: string; caseIdCandidate?: string; casePath?: string } = {}): DwmAlert & {
  tenantId: string;
  organizationId: string;
  watchlistIds: string[];
  watchlistItemIds: string[];
  workflowContext: Record<string, unknown>;
  webhookContext: Record<string, unknown>;
  caseIdCandidate?: string;
  casePath?: string;
} {
  const snapshot = buildDwmProductSnapshot({
    tenantId: "tenant_acme",
    watchlist: [{ kind: "domain", value: "acme.com" }],
    sources: [source],
    captures: [capture],
    generatedAt: "2026-06-29T00:10:00.000Z"
  });
  const alert = snapshot.alerts[0];
  return {
    ...alert,
    id: "dwm_alert_acme",
    dedupeKey: "dwm_dedupe_acme",
    webhookDelivery: { ...alert.webhookDelivery, dedupeKey: "dwm_dedupe_acme" },
    tenantId: "tenant_acme",
    organizationId: overrides.organizationId || "org_acme",
    watchlistIds: ["watch_acme"],
    watchlistItemIds: ["watch_item_acme_domain"],
    caseIdCandidate: overrides.caseIdCandidate,
    casePath: overrides.casePath,
    workflowContext: {
      tenantId: "tenant_acme",
      organizationId: overrides.organizationId || "org_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_consumer_acme"],
      caseIdCandidate: overrides.caseIdCandidate,
      casePath: overrides.casePath,
      dedupeKey: "dwm_dedupe_acme",
      recommendedRoute: "identity_response",
      webhookDestinationIds: ["webhook_discord"]
    },
    webhookContext: {
      tenantId: "tenant_acme",
      organizationId: overrides.organizationId || "org_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_consumer_acme"],
      evidenceCount: 1,
      dedupeKey: "dwm_dedupe_acme",
      recommendedRoute: "identity_response",
      caseIdCandidate: overrides.caseIdCandidate,
      casePath: overrides.casePath,
      webhookDestinationIds: ["webhook_discord"]
    }
  };
}
