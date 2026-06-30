import { describe, expect, test } from "bun:test";
import {
  ORG_READINESS_LIFECYCLE_BLOCKER_SCHEMA_VERSION,
  ORG_READINESS_LIFECYCLE_SCHEMA_VERSION,
  ORG_SHARED_WATCHLIST_READINESS_PROOF_SCHEMA_VERSION,
  buildOrgReadinessLifecycle,
  buildOrgReadinessLifecycleExamples,
  buildOrgSharedWatchlistReadinessProof,
  type OrgReadinessLifecycleExampleId,
  type OrgReadinessLifecycleOwnerLane
} from "../product/orgReadinessLifecycle.ts";

describe("organization readiness lifecycle contract", () => {
  test("summarizes the org-to-customer workflow with stable owner lanes and blockers", () => {
    const lifecycle = buildOrgReadinessLifecycle({
      generatedAt: "2026-06-29T13:00:00.000Z",
      organizationId: "org_contract",
      tenantId: "tenant_contract",
      organizationExists: true,
      activeOwnerCount: 1,
      activeAdminCount: 1,
      activeMemberCount: 5,
      pendingInviteCount: 3,
      sharedWatchlistExport: {
        available: true,
        activeTermCount: 2,
        canGenerateAlerts: true,
        schemaVersion: "organization.shared_watchlist_alert_generation_export.v1",
        consumerSchemaVersion: "organization.shared_watchlist_alert_generation_consumers.v1",
        exportedWatchlistCount: 1,
        alertGeneratorKeyCount: 2,
        memberRole: "analyst",
        memberStatus: "active",
        route: "/v1/dwm/watchlists",
        downstreamRoutes: {
          alertGenerationReadiness: "/v1/dwm/alerts/generation-readiness",
          alertRebuild: "/v1/dwm/alerts/rebuild",
          webhookDelivery: "/v1/dwm/webhooks/deliver"
        }
      },
      entitlement: { persistedPolicy: true, status: "active" },
      source: { ready: true, activeSourceCount: 2 },
      alertMatching: { ready: true, probeId: "alert.matching.contract" },
      webhook: { ready: true, verifiedDestinationCount: 1 },
      helpdesk: { ready: true, auditAvailable: true, executorAvailable: true },
      analystHandoff: { compatible: true }
    });

    expect(lifecycle.schemaVersion).toBe(ORG_READINESS_LIFECYCLE_SCHEMA_VERSION);
    expect(lifecycle.status).toBe("ready");
    expect(lifecycle.nextAction).toBe("start_customer_monitoring_workflow");
    expect(lifecycle.blockerCodes).toEqual([]);
    expect(Object.values(lifecycle.stages).map((stage) => stage.ownerLane)).toEqual([
      "org",
      "org",
      "org",
      "watchlist",
      "entitlement",
      "source",
      "alert",
      "webhook",
      "helpdesk",
      "analyst-handoff"
    ]);
    expect(lifecycle.stages.shared_watchlist_export).toMatchObject({
      sourceContract: "organization.shared_watchlist_alert_generation_export.v1",
      route: "/v1/dwm/watchlists",
      probeId: "org.watchlist_export"
    });
  });

  test("aggregates shared watchlist export readiness for alert dashboard and webhook consumers", () => {
    const proof = buildOrgSharedWatchlistReadinessProof({
      generatedAt: "2026-06-29T13:02:00.000Z",
      organizationId: "org_shared_ready",
      tenantId: "tenant_shared_ready",
      organizationExists: true,
      activeOwnerCount: 1,
      activeAdminCount: 1,
      activeMemberCount: 3,
      pendingInviteCount: 0,
      sharedWatchlistExport: {
        available: true,
        activeTermCount: 4,
        canGenerateAlerts: true,
        schemaVersion: "organization.shared_watchlist_alert_generation_export.v1",
        consumerSchemaVersion: "organization.shared_watchlist_alert_generation_consumers.v1",
        exportedWatchlistCount: 2,
        alertGeneratorKeyCount: 4,
        memberRole: "admin",
        memberStatus: "active",
        route: "/v1/dwm/watchlists",
        downstreamRoutes: {
          alertGenerationReadiness: "/v1/dwm/alerts/generation-readiness",
          alertRebuild: "/v1/dwm/alerts/rebuild",
          webhookDelivery: "/v1/dwm/webhooks/deliver"
        }
      },
      entitlement: { persistedPolicy: true, status: "active" },
      source: { ready: true, activeSourceCount: 2 },
      alertMatching: { ready: true, probeId: "alert.matching.ready" },
      webhook: { ready: true, verifiedDestinationCount: 1 },
      helpdesk: { ready: true, auditAvailable: true, executorAvailable: true },
      analystHandoff: { compatible: true }
    });

    expect(proof).toMatchObject({
      schemaVersion: ORG_SHARED_WATCHLIST_READINESS_PROOF_SCHEMA_VERSION,
      state: "ready",
      sourceContract: "organization.shared_watchlist_alert_generation_export.v1",
      consumerContract: "organization.shared_watchlist_alert_generation_consumers.v1",
      ownerLane: "watchlist",
      memberScope: {
        role: "admin",
        status: "active",
        allowed: true
      },
      termExport: {
        activeTermCount: 4,
        exportedWatchlistCount: 2,
        alertGeneratorKeyCount: 4
      },
      routes: {
        watchlists: "/v1/dwm/watchlists",
        alertGenerationReadiness: "/v1/dwm/alerts/generation-readiness",
        alertRebuild: "/v1/dwm/alerts/rebuild",
        webhookDelivery: "/v1/dwm/webhooks/deliver"
      },
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(proof.blockers).toEqual([]);
    expect(proof.consumerReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "dashboard",
        route: "/v1/dwm/watchlists",
        requiredFields: expect.arrayContaining(["state", "member.role", "blockers.code"])
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        route: "/v1/dwm/alerts/generation-readiness",
        requiredFields: expect.arrayContaining(["runtimeWatchlists", "termExport.alertGeneratorKeys"])
      }),
      expect.objectContaining({
        consumer: "webhook",
        route: "/v1/dwm/webhooks/deliver",
        requiredFields: expect.arrayContaining(["runtimeWatchlists[].webhookDestinationId"])
      })
    ]));
    expect(JSON.stringify(proof)).not.toContain("https://discord.com");
    expect(JSON.stringify(proof)).not.toContain("rawText");
    expect(JSON.stringify(proof)).not.toContain("password");
  });

  test("keeps blocked shared watchlist export proof metadata-only for denied member scope", () => {
    const proof = buildOrgSharedWatchlistReadinessProof({
      generatedAt: "2026-06-29T13:03:00.000Z",
      organizationId: "org_shared_blocked",
      tenantId: "tenant_shared_blocked",
      organizationExists: true,
      activeOwnerCount: 1,
      activeAdminCount: 0,
      activeMemberCount: 2,
      pendingInviteCount: 0,
      sharedWatchlistExport: {
        available: false,
        activeTermCount: 0,
        canGenerateAlerts: false,
        blockerCodes: ["role_not_allowed"],
        schemaVersion: "organization.shared_watchlist_alert_generation_export.v1",
        consumerSchemaVersion: "organization.shared_watchlist_alert_generation_consumers.v1",
        memberRole: "viewer",
        memberStatus: "active",
        route: "/v1/dwm/watchlists"
      },
      entitlement: { persistedPolicy: true, status: "active" },
      source: { ready: true, activeSourceCount: 1 },
      alertMatching: { ready: false, blockerCodes: ["no_active_watchlist_terms"] },
      webhook: { ready: false, verifiedDestinationCount: 0, blockerCodes: ["webhook_not_verified"] },
      helpdesk: { ready: true, auditAvailable: true, executorAvailable: true },
      analystHandoff: { compatible: true }
    });

    expect(proof.state).toBe("blocked");
    expect(proof.memberScope).toMatchObject({
      role: "viewer",
      status: "active",
      allowed: false
    });
    expect(proof.blockers).toEqual([expect.objectContaining({
      schemaVersion: ORG_READINESS_LIFECYCLE_BLOCKER_SCHEMA_VERSION,
      ownerLane: "watchlist",
      code: "role_not_allowed",
      sourceContract: "organization.shared_watchlist_alert_generation_export.v1",
      route: "/v1/dwm/watchlists",
      nextAction: "export_shared_watchlist_terms"
    })]);
    expect(proof.termExport).toMatchObject({
      activeTermCount: 0,
      exportedWatchlistCount: 0,
      alertGeneratorKeyCount: 0
    });
    expect(proof.safeOutput).toMatchObject({
      metadataOnly: true,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    });
  });

  test("publishes typed lifecycle examples for downstream org readiness adoption", () => {
    const contract = buildOrgReadinessLifecycleExamples({ generatedAt: "2026-06-29T13:05:00.000Z" });
    expect(contract.schemaVersion).toBe("organization.readiness_lifecycle.examples.v1");
    const examples = new Map(contract.examples.map((item) => [item.id, item.lifecycle]));
    const required: OrgReadinessLifecycleExampleId[] = [
      "good_org",
      "no_policy_provisional_org",
      "missing_shared_watchlist_export",
      "entitlement_denied",
      "source_inactive",
      "alert_matching_unavailable",
      "webhook_not_verified",
      "helpdesk_audit_unavailable",
      "handoff_incompatible"
    ];
    for (const id of required) expect(examples.has(id)).toBe(true);

    expect(examples.get("good_org")).toMatchObject({ status: "ready", blockerCodes: [] });
    expect(examples.get("no_policy_provisional_org")).toMatchObject({
      status: "provisional",
      stages: {
        entitlement_readiness: {
          ownerLane: "entitlement",
          status: "provisional",
          blockerCodes: [],
          nextAction: "persist_entitlement_policy"
        }
      }
    });
    expect(examples.get("no_policy_provisional_org")?.stages.entitlement_readiness.supportText).toContain("not enterprise-ready");

    expect(examples.get("missing_shared_watchlist_export")?.stages.shared_watchlist_export.blockers[0]).toMatchObject({
      schemaVersion: ORG_READINESS_LIFECYCLE_BLOCKER_SCHEMA_VERSION,
      ownerLane: "watchlist",
      code: "missing_shared_watchlist_export",
      sourceContract: "organization.shared_watchlist_alert_generation_export.v1",
      route: "/v1/dwm/watchlists"
    });
    expect(examples.get("entitlement_denied")?.stages.entitlement_readiness.blockers[0]).toMatchObject({
      ownerLane: "entitlement",
      code: "alert_rebuilds_today",
      sourceContract: "dwm.entitlement_readiness.v1"
    });
    expect(examples.get("source_inactive")?.stages.source_readiness.blockers[0]).toMatchObject({
      ownerLane: "source",
      code: "source_inactive"
    });
    expect(examples.get("alert_matching_unavailable")?.stages.alert_matching_readiness.blockers[0]).toMatchObject({
      ownerLane: "alert",
      code: "alert_matching_unavailable",
      probeId: "alert.matching.unavailable"
    });
    expect(examples.get("webhook_not_verified")?.stages.webhook_destination_readiness.blockers[0]).toMatchObject({
      ownerLane: "webhook",
      code: "webhook_not_verified"
    });
    expect(examples.get("helpdesk_audit_unavailable")?.stages.helpdesk_support_readiness.blockers[0]).toMatchObject({
      ownerLane: "helpdesk",
      code: "helpdesk_audit_unavailable"
    });
    expect(examples.get("handoff_incompatible")?.stages.analyst_handoff_compatibility.blockers[0]).toMatchObject({
      ownerLane: "analyst-handoff",
      code: "handoff_incompatible"
    });

    const ownerLanes = new Set<OrgReadinessLifecycleOwnerLane>();
    for (const lifecycle of examples.values()) {
      for (const stage of Object.values(lifecycle.stages)) ownerLanes.add(stage.ownerLane);
    }
    expect(Array.from(ownerLanes).sort()).toEqual([
      "alert",
      "analyst-handoff",
      "entitlement",
      "helpdesk",
      "org",
      "source",
      "watchlist",
      "webhook"
    ]);
  });

  test("keeps support text redacted and entitlement blockers separate from org membership blockers", () => {
    const lifecycle = buildOrgReadinessLifecycle({
      generatedAt: "2026-06-29T13:10:00.000Z",
      organizationId: "org_blocked",
      tenantId: "tenant_blocked",
      organizationExists: true,
      activeOwnerCount: 0,
      activeAdminCount: 0,
      activeMemberCount: 2,
      pendingInviteCount: 1,
      sharedWatchlistExport: { available: true, activeTermCount: 1, canGenerateAlerts: true },
      entitlement: { persistedPolicy: true, status: "active", blockerCodes: ["watch_terms"] },
      source: { ready: true, activeSourceCount: 1 },
      alertMatching: { ready: true },
      webhook: { ready: true, verifiedDestinationCount: 1 },
      helpdesk: { ready: true, auditAvailable: true, executorAvailable: true },
      analystHandoff: { compatible: true }
    });

    expect(lifecycle.status).toBe("blocked");
    expect(lifecycle.stages.member_roles.blockers[0]).toMatchObject({
      ownerLane: "org",
      code: "missing_active_owner",
      sourceContract: "organization.lifecycle_readiness.v1"
    });
    expect(lifecycle.stages.entitlement_readiness.blockers[0]).toMatchObject({
      ownerLane: "entitlement",
      code: "watch_terms",
      sourceContract: "dwm.entitlement_readiness.v1"
    });
    expect(JSON.stringify(lifecycle)).not.toContain("@");
    expect(JSON.stringify(lifecycle)).not.toContain("prompt");
    expect(JSON.stringify(lifecycle)).not.toContain("raw");
  });
});
