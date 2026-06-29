import { describe, expect, test } from "bun:test";
import {
  DWM_WEBHOOK_EVENT_CHAIN_SCHEMA_VERSION,
  DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
  DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION,
  DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
  buildCaseCustomerNotificationEventContract,
  buildWebhookEventSupportHandoff,
  buildWebhookSupportActionRequest,
  buildWebhookDeliveryEventContract,
  validateWebhookEventChain
} from "../product/webhookEventContract.ts";
import fixture from "./fixtures/webhook-event-chain-happy.json";

describe("webhook event contract", () => {
  test("builds and validates delivered webhook to customer notification chain", () => {
    const alert = alertFixture();
    const delivery = deliveryFixture();
    const receipt = notificationReceiptFixture();
    const deliveryEvent = buildWebhookDeliveryEventContract({ delivery, alert, actor: "analyst_acme" });
    const notificationEvent = buildCaseCustomerNotificationEventContract({ receipt, caseRecord: caseFixture(), alert });
    const chain = validateWebhookEventChain({
      deliveryEvent,
      customerNotificationEvent: notificationEvent,
      checkedAt: "2026-06-29T12:30:00.000Z"
    });

    expect(deliveryEvent).toMatchObject({
      schemaVersion: DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
      eventKind: "webhook.delivery_recorded",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      webhookDeliveryId: "delivery_acme_lumma",
      webhookDestinationId: "webhook_discord",
      status: "delivered",
      delivery: {
        deliveryKind: "discord",
        dryRun: false,
        payloadHash: "payload_hash_acme"
      },
      evidence: {
        evidenceCount: 1,
        captureIds: ["capture_acme_lumma"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_lumma"]
      }
    });
    expect(notificationEvent).toMatchObject({
      eventKind: "case.customer_notification_recorded",
      webhookDeliveryId: "delivery_acme_lumma",
      customerNotification: {
        deliveryMode: "webhook_delivery",
        rationale: "Customer SOC acknowledged delivered Discord evidence."
      }
    });
    expect(chain).toMatchObject({
      schemaVersion: DWM_WEBHOOK_EVENT_CHAIN_SCHEMA_VERSION,
      ok: true,
      blockers: [],
      identity: {
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme_lumma",
        caseId: "case_acme_lumma",
        webhookDeliveryId: "delivery_acme_lumma",
        webhookDestinationId: "webhook_discord",
        dedupeKey: "dedupe_acme_lumma"
      }
    });
    expect(chain.events).toHaveLength(2);
  });

  test("builds redacted support handoff for verified webhook notification chain", () => {
    const deliveryEvent = buildWebhookDeliveryEventContract({ delivery: deliveryFixture(), alert: alertFixture(), actor: "analyst_acme" });
    const notificationEvent = buildCaseCustomerNotificationEventContract({ receipt: notificationReceiptFixture(), caseRecord: caseFixture(), alert: alertFixture() });
    const chain = validateWebhookEventChain({
      deliveryEvent,
      customerNotificationEvent: notificationEvent,
      checkedAt: "2026-06-29T12:30:00.000Z"
    });
    const handoff = buildWebhookEventSupportHandoff({ chain });

    expect(handoff).toMatchObject({
      schemaVersion: DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      webhookDeliveryId: "delivery_acme_lumma",
      webhookDestinationId: "webhook_discord",
      helpdesk: {
        redacted: true,
        lookupKey: "org_acme",
        supportAction: "inspect_webhook_delivery",
        routeHints: {
          caseDetail: "/v1/cases/case_acme_lumma",
          alertDetail: "/v1/dwm/alerts/alert_acme_lumma",
          webhookDelivery: "/v1/dwm/webhook-deliveries/delivery_acme_lumma"
        },
        customerVisible: false
      },
      audit: {
        eventType: "dwm.webhook.customer_notification_chain_checked",
        outcome: "verified",
        actorIds: ["analyst_acme"],
        deliveryMode: "webhook_delivery",
        deliveryKind: "discord",
        blockerCodes: [],
        ownerLanes: []
      },
      evidence: {
        redacted: true,
        evidenceCount: 1,
        captureIds: ["capture_acme_lumma"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_lumma"],
        endpointHash: "endpoint_hash_acme",
        payloadHash: "payload_hash_acme"
      },
      nextActions: []
    });
    expect(JSON.stringify(handoff)).not.toContain("https://discord.com");
    expect(JSON.stringify(handoff)).not.toContain("Customer SOC acknowledged");
  });

  test("builds support action preparation request from verified webhook handoff", () => {
    const chain = validateWebhookEventChain({
      deliveryEvent: buildWebhookDeliveryEventContract({ delivery: deliveryFixture(), alert: alertFixture(), actor: "analyst_acme" }),
      customerNotificationEvent: buildCaseCustomerNotificationEventContract({ receipt: notificationReceiptFixture(), caseRecord: caseFixture(), alert: alertFixture() }),
      checkedAt: "2026-06-29T12:30:00.000Z"
    });
    const request = buildWebhookSupportActionRequest({
      handoff: buildWebhookEventSupportHandoff({ chain }),
      requestId: "req_support_webhook"
    });

    expect(request).toMatchObject({
      schemaVersion: DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
      ok: true,
      adminSupportContract: {
        schemaVersion: "support.action_prepare.v1",
        method: "GET",
        route: "/api/admin/support/inspect",
        query: {
          org: "org_acme",
          entity: "delivery_acme_lumma",
          entityType: "dwm_webhook_delivery",
          action: "support.webhook.inspect_delivery",
          prepareAction: "inspect_webhook_delivery",
          requestId: "req_support_webhook"
        }
      },
      target: {
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme_lumma",
        caseId: "case_acme_lumma",
        webhookDeliveryId: "delivery_acme_lumma",
        webhookDestinationId: "webhook_discord"
      },
      redaction: {
        required: true,
        attestation: "support_safe_metadata_only"
      },
      auditPreview: {
        actionType: "support.webhook.inspect_delivery",
        source: "dwm.webhook_event_support_handoff",
        outcome: "prepared",
        blockerCodes: [],
        supportAction: "inspect_webhook_delivery"
      },
      blockers: []
    });
    expect(request.adminSupportContract.query.idempotencyKey).toMatch(/^dwm_webhook_support_action_/);
    expect(JSON.stringify(request)).not.toContain("https://discord.com");
  });

  test("validates checked-in fixture as integration proof", () => {
    const chain = validateWebhookEventChain({
      deliveryEvent: fixture.events[0] as any,
      customerNotificationEvent: fixture.events[1] as any,
      checkedAt: fixture.checkedAt
    });
    expect(chain.ok).toBe(true);
    expect(chain.identity).toMatchObject(fixture.identity);
    expect(chain.events.map((event) => event.eventKind)).toEqual(["webhook.delivery_recorded", "case.customer_notification_recorded"]);
  });

  test("returns owner-coded blockers for dry run mismatched or missing provenance chains", () => {
    const alert = {
      ...alertFixture(),
      evidence: [],
      provenance: { captureIds: [] },
      workflowContext: { ...alertFixture().workflowContext, captureIds: [], evidenceCount: 0 }
    };
    const deliveryEvent = buildWebhookDeliveryEventContract({
      delivery: { ...deliveryFixture(), id: "delivery_failed", status: "failed", dryRun: true, webhookDestinationId: "webhook_a" },
      alert
    });
    const notificationEvent = buildCaseCustomerNotificationEventContract({
      receipt: {
        ...notificationReceiptFixture(),
        webhookDeliveryId: "delivery_other",
        webhookDestinationId: "webhook_b",
        evidence: { evidenceCount: 0, sourceIds: [], contentHashes: [] }
      },
      caseRecord: caseFixture(),
      alert
    });
    const chain = validateWebhookEventChain({
      deliveryEvent,
      customerNotificationEvent: notificationEvent,
      checkedAt: "2026-06-29T12:31:00.000Z"
    });
    const codes = chain.blockers.map((item) => item.code);
    expect(chain.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      "delivery_not_delivered",
      "dry_run_delivery",
      "identity_mismatch",
      "notification_delivery_mismatch",
      "missing_provenance"
    ]));
    expect(chain.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerLane: "webhook", path: "deliveryEvent.status" }),
      expect.objectContaining({ ownerLane: "case", path: "customerNotificationEvent.webhookDeliveryId" }),
      expect.objectContaining({ ownerLane: "source", path: "deliveryEvent.evidence" })
    ]));
  });

  test("maps blocked webhook event chain to support-safe next actions", () => {
    const alert = {
      ...alertFixture(),
      evidence: [],
      provenance: { captureIds: [] },
      workflowContext: { ...alertFixture().workflowContext, captureIds: [], evidenceCount: 0 }
    };
    const deliveryEvent = buildWebhookDeliveryEventContract({
      delivery: { ...deliveryFixture(), id: "delivery_failed", status: "failed", dryRun: true, webhookDestinationId: "webhook_a" },
      alert
    });
    const notificationEvent = buildCaseCustomerNotificationEventContract({
      receipt: {
        ...notificationReceiptFixture(),
        webhookDeliveryId: "delivery_other",
        webhookDestinationId: "webhook_b",
        evidence: { evidenceCount: 0, sourceIds: [], contentHashes: [] }
      },
      caseRecord: caseFixture(),
      alert
    });
    const chain = validateWebhookEventChain({
      deliveryEvent,
      customerNotificationEvent: notificationEvent,
      checkedAt: "2026-06-29T12:31:00.000Z"
    });
    const handoff = buildWebhookEventSupportHandoff({ chain });

    expect(handoff).toMatchObject({
      ok: false,
      helpdesk: {
        redacted: true,
        supportAction: "restore_webhook_delivery_chain",
        customerVisible: false
      },
      audit: {
        outcome: "blocked",
        blockerCodes: expect.arrayContaining([
          "delivery_not_delivered",
          "dry_run_delivery",
          "identity_mismatch",
          "notification_delivery_mismatch",
          "missing_provenance"
        ]),
        ownerLanes: expect.arrayContaining(["webhook", "case", "source"])
      }
    });
    expect(handoff.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ ownerLane: "webhook", blockerCode: "delivery_not_delivered", action: "retry_delivery" }),
      expect.objectContaining({ ownerLane: "webhook", blockerCode: "dry_run_delivery", action: "record_live_delivery" }),
      expect.objectContaining({ ownerLane: "case", blockerCode: "notification_delivery_mismatch", action: "resolve_identity" }),
      expect.objectContaining({ ownerLane: "source", blockerCode: "missing_provenance", action: "restore_provenance" })
    ]));
  });

  test("blocks support action preparation when webhook handoff still has unresolved work", () => {
    const alert = {
      ...alertFixture(),
      evidence: [],
      provenance: { captureIds: [] },
      workflowContext: { ...alertFixture().workflowContext, captureIds: [], evidenceCount: 0 }
    };
    const chain = validateWebhookEventChain({
      deliveryEvent: buildWebhookDeliveryEventContract({
        delivery: { ...deliveryFixture(), status: "failed", dryRun: true },
        alert
      }),
      customerNotificationEvent: buildCaseCustomerNotificationEventContract({
        receipt: { ...notificationReceiptFixture(), evidence: { evidenceCount: 0, sourceIds: [], contentHashes: [] } },
        caseRecord: caseFixture(),
        alert
      }),
      checkedAt: "2026-06-29T12:31:00.000Z"
    });
    const request = buildWebhookSupportActionRequest({
      handoff: buildWebhookEventSupportHandoff({ chain }),
      requestId: "req_support_blocked"
    });

    expect(request).toMatchObject({
      ok: false,
      adminSupportContract: {
        query: {
          action: "support.webhook.restore_delivery_chain",
          prepareAction: "restore_webhook_delivery_chain"
        }
      },
      auditPreview: {
        outcome: "blocked",
        supportAction: "restore_webhook_delivery_chain",
        blockerCodes: expect.arrayContaining(["delivery_not_delivered", "dry_run_delivery", "missing_provenance"])
      }
    });
    expect(request.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "handoff_blocked", ownerLane: "webhook", path: "deliveryEvent.status" }),
      expect.objectContaining({ code: "handoff_blocked", ownerLane: "source", path: "deliveryEvent.evidence" })
    ]));
  });
});

function alertFixture() {
  return {
    id: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    caseId: "case_acme_lumma",
    caseIdCandidate: "case_acme_lumma",
    dedupeKey: "dedupe_acme_lumma",
    provenance: { captureIds: ["capture_acme_lumma"] },
    workflowContext: {
      organizationId: "org_acme",
      captureIds: ["capture_acme_lumma"],
      evidenceCount: 1,
      dedupeKey: "dedupe_acme_lumma"
    },
    evidence: [{
      id: "evidence_acme_lumma",
      sourceId: "src_acme_tg",
      contentHash: "hash_acme_lumma"
    }]
  };
}

function deliveryFixture() {
  return {
    id: "delivery_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    alertId: "alert_acme_lumma",
    caseId: "case_acme_lumma",
    webhookDestinationId: "webhook_discord",
    status: "delivered",
    deliveryKind: "discord",
    attemptedAt: "2026-06-29T12:00:00.000Z",
    httpStatus: 204,
    endpointHash: "endpoint_hash_acme",
    payloadHash: "payload_hash_acme",
    dedupeKey: "dedupe_acme_lumma",
    idempotencyKey: "idem_acme_lumma",
    dryRun: false
  };
}

function notificationReceiptFixture() {
  return {
    id: "notification_acme_lumma",
    caseId: "case_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    alertId: "alert_acme_lumma",
    at: "2026-06-29T12:05:00.000Z",
    actor: "analyst_acme",
    deliveryMode: "webhook_delivery",
    rationale: "Customer SOC acknowledged delivered Discord evidence.",
    idempotencyKey: "notif_idem_acme_lumma",
    webhookDeliveryId: "delivery_acme_lumma",
    webhookDestinationId: "webhook_discord",
    webhookStatus: "delivered",
    evidence: {
      evidenceCount: 1,
      sourceIds: ["src_acme_tg"],
      contentHashes: ["hash_acme_lumma"],
      captureIds: ["capture_acme_lumma"]
    }
  };
}

function caseFixture() {
  return {
    id: "case_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    alertId: "alert_acme_lumma"
  };
}
