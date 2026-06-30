import { describe, expect, test } from "bun:test";
import { buildCaseWebhookReplayReadinessFixture } from "../product/caseReplayWebhookReadinessFixture.ts";

describe("case replay webhook readiness fixture", () => {
  test("builds no-network webhook replay rows from a case replay export", () => {
    const fixture = buildCaseWebhookReplayReadinessFixture(happyReplayExport(), { checkedAt: "2026-06-30T04:30:00.000Z" });

    expect(fixture).toMatchObject({
      schemaVersion: "dwm.case_to_webhook_replay_readiness_fixture.v1",
      checkedAt: "2026-06-30T04:30:00.000Z",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      caseId: "case_alert_acme",
      alertId: "alert_acme",
      ready: true,
      deliveryCount: 1,
      blockerCodes: [],
      plannedDeliveries: [
        expect.objectContaining({
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          caseId: "case_alert_acme",
          alertId: "alert_acme",
          webhookDestinationId: "webhook_acme_discord",
          ready: true,
          dryRun: true,
          route: "/v1/dwm/webhooks/deliver",
          sourceFamily: "telegram_public",
          provenance: {
            captureIds: ["cap_acme_1"],
            sourceIds: ["src_acme_tg"],
            contentHashes: ["hash_acme_1"],
            evidenceCount: 1
          },
          workflow: {
            status: "open",
            assignedOwner: "owner@acme.com",
            transitionCount: 2,
            handoffReceiptCount: 1
          },
          blockerCodes: []
        })
      ],
      nextAnalystActions: [
        expect.objectContaining({ id: "review_org_access", ownerLane: "org", ready: true }),
        expect.objectContaining({ id: "test_webhook_delivery", ownerLane: "webhook", ready: true }),
        expect.objectContaining({ id: "record_customer_notification", ownerLane: "case", ready: false })
      ],
      safeOutput: {
        metadataOnly: true,
        endpointSecretExposed: false,
        payloadBodyExposed: false,
        rawEvidenceExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(JSON.stringify(fixture)).not.toContain("https://discord.com");
    expect(JSON.stringify(fixture)).not.toContain("rawText");
  });

  test("keeps absent org and webhook readiness as typed blockers", () => {
    const fixture = buildCaseWebhookReplayReadinessFixture({
      ...happyReplayExport(),
      organizationId: undefined,
      organizationAccessReadiness: {
        ready: false,
        readyForMutation: false,
        blockerCodes: ["missing_organization_scope"]
      },
      webhookDryRunReadiness: {
        readyForReplay: false,
        destinationIds: [],
        blockerCodes: ["missing_webhook_destination", "missing_webhook_dry_run_receipt"]
      },
      sourceHandoffReadiness: {
        ready: false,
        blockerCodes: ["missing_alert_source_handoff_readiness"],
        consumers: { webhook: { ready: false } }
      }
    }, { checkedAt: "2026-06-30T04:31:00.000Z" });

    expect(fixture).toMatchObject({
      ready: false,
      organizationId: undefined,
      deliveryCount: 0,
      plannedDeliveries: [],
      blockerCodes: expect.arrayContaining([
        "missing_organization_scope",
        "missing_webhook_destination",
        "missing_webhook_dry_run_receipt",
        "missing_alert_source_handoff_readiness"
      ])
    });
  });
});

function happyReplayExport() {
  return {
    schemaVersion: "dwm.case_action_replay_export.v1",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    caseId: "case_alert_acme",
    alertId: "alert_acme",
    workflowState: {
      status: "open",
      assignedOwner: "owner@acme.com"
    },
    organizationAccessReadiness: {
      ready: true,
      readyForMutation: true,
      blockerCodes: []
    },
    sourceHandoffReadiness: {
      ready: true,
      sourceFamily: "telegram_public",
      evidenceCount: 1,
      blockerCodes: [],
      consumers: {
        webhook: {
          ready: true,
          webhookDestinationIds: ["webhook_acme_discord"]
        }
      }
    },
    webhookDryRunReadiness: {
      route: "/v1/dwm/webhooks/deliver",
      method: "POST",
      readyForReplay: true,
      destinationIds: ["webhook_acme_discord"],
      blockerCodes: []
    },
    provenance: {
      captureIds: ["cap_acme_1"],
      sourceIds: ["src_acme_tg"],
      contentHashes: ["hash_acme_1"],
      evidenceCount: 1
    },
    workflowTransitions: [
      { action: "open" },
      { action: "handoff_webhook_dry_run" }
    ],
    handoffActionHistory: {
      receipts: [{ actionId: "webhookDryRun" }]
    },
    nextAnalystActions: [
      { id: "review_org_access", ownerLane: "org", route: "/api/organizations/org_acme/members", ready: true, blocked: false, blockerCodes: [] },
      { id: "test_webhook_delivery", ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", ready: true, blocked: false, blockerCodes: [] },
      { id: "record_customer_notification", ownerLane: "case", route: "/v1/cases/case_alert_acme/customer-notification", ready: false, blocked: true, blockerCodes: ["missing_webhook_dry_run_receipt"] }
    ]
  };
}
