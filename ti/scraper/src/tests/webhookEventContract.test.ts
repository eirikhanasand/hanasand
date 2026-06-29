import { describe, expect, test } from "bun:test";
import {
  DWM_WEBHOOK_EVENT_CHAIN_SCHEMA_VERSION,
  DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
  DWM_WEBHOOK_DISPATCH_READINESS_SCHEMA_VERSION,
  DWM_WEBHOOK_DISPATCH_REPLAY_HISTORY_SCHEMA_VERSION,
  DWM_WEBHOOK_DISPATCH_REPLAY_REQUEST_SCHEMA_VERSION,
  DWM_WEBHOOK_DISPATCH_RETRY_AUDIT_SCHEMA_VERSION,
  DWM_WEBHOOK_DISPATCH_SUPPORT_PACKET_SCHEMA_VERSION,
  DWM_WEBHOOK_DESTINATION_ACTION_REQUEST_SCHEMA_VERSION,
  DWM_WEBHOOK_DESTINATION_LIFECYCLE_PROOF_SCHEMA_VERSION,
  DWM_WEBHOOK_DELIVERY_PERSISTENCE_PROOF_SCHEMA_VERSION,
  DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION,
  DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
  buildCaseCustomerNotificationEventContract,
  buildWebhookDestinationActionRequest,
  buildWebhookDestinationLifecycleProof,
  buildWebhookDeliveryPersistenceProof,
  buildWebhookDispatchReadiness,
  buildWebhookDispatchReplayHistory,
  buildWebhookDispatchReplayRequest,
  buildWebhookDispatchRetryAudit,
  buildWebhookDispatchSupportPacket,
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

  test("builds webhook dispatch readiness from a persisted alert and active destination", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });

    expect(readiness).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_READINESS_SCHEMA_VERSION,
      checkedAt: "2026-06-29T12:20:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      dedupeKey: "dedupe_acme_lumma",
      dispatch: {
        method: "POST",
        route: "/v1/dwm/webhooks/deliver",
        dryRun: false,
        destinationIds: ["webhook_discord"],
        destinationKinds: ["discord"],
        redacted: true
      },
      evidence: {
        redacted: true,
        evidenceCount: 1,
        captureIds: ["capture_acme_lumma"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_lumma"]
      },
      blockers: [],
      nextActions: []
    });
    expect(readiness.dispatch.payloadShape).toEqual(expect.arrayContaining([
      "alertId",
      "organizationId",
      "caseId",
      "webhookDestinationIds",
      "evidence.captureIds",
      "idempotencyKey"
    ]));
    expect(readiness.dispatch.idempotencyKey).toMatch(/^dwm_webhook_dispatch_/);
    expect(JSON.stringify(readiness)).not.toContain("https://discord.com");
    expect(JSON.stringify(readiness)).not.toContain("payloadBody");
  });

  test("builds org-scoped destination lifecycle proof with test and retry state", () => {
    const proof = buildWebhookDestinationLifecycleProof({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      generatedAt: "2026-06-29T12:18:00.000Z",
      destinations: [
        { ...destinationFixture(), label: "SOC Discord", channelLabel: "#alerts", endpointHint: "https://discord.com/api/webhooks/123/secret" },
        { id: "webhook_disabled", tenantId: "tenant_acme", organizationId: "org_acme", status: "disabled", deliveryKind: "discord" },
        { ...destinationFixture(), id: "webhook_other", organizationId: "org_other", endpointHint: "https://discord.com/api/webhooks/999/secret" }
      ],
      deliveries: [
        { ...deliveryFixture(), id: "delivery_test", eventType: "dwm.alert.test", dryRun: true, status: "dry_run", attemptedAt: "2026-06-29T12:10:00.000Z" },
        { ...deliveryFixture(), id: "delivery_retry", status: "failed", replay: true, attemptedAt: "2026-06-29T12:12:00.000Z", nextRetryAt: "2026-06-29T12:20:00.000Z", errorClass: "upstream_5xx", responseSummary: "token=secret" },
        { ...deliveryFixture(), id: "delivery_other", organizationId: "org_other", webhookDestinationId: "webhook_other" }
      ]
    });

    expect(proof).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DESTINATION_LIFECYCLE_PROOF_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:18:00.000Z",
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      redacted: true,
      summary: {
        destinationCount: 2,
        enabledCount: 1,
        disabledCount: 1,
        verifiedTestCount: 1,
        retryScheduledCount: 1,
        blockedCount: 1
      },
      blockers: []
    });
    const active = proof.destinations.find((item) => item.id === "webhook_discord");
    const disabled = proof.destinations.find((item) => item.id === "webhook_disabled");
    expect(active).toMatchObject({
      label: "SOC Discord",
      channelLabel: "#alerts",
      enabled: true,
      redactedEndpoint: {
        endpointHash: "endpoint_hash_acme",
        endpointHint: "https://discord.com/api/webhooks/123/...",
        endpointExposed: false
      },
      lastTest: {
        deliveryId: "delivery_test",
        status: "dry_run",
        dryRun: true,
        payloadHash: "payload_hash_acme"
      },
      lastDelivery: {
        deliveryId: "delivery_retry",
        status: "failed",
        replay: true,
        responseSummary: "token=[redacted]"
      },
      retry: {
        retryable: true,
        nextRetryAt: "2026-06-29T12:20:00.000Z",
        attemptCount: 2,
        lastErrorCategory: "upstream_5xx"
      }
    });
    expect(active?.routes.test).toBe("/v1/dwm/webhook-destinations/webhook_discord/test");
    expect(disabled?.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "destination_disabled", blocking: true }),
      expect.objectContaining({ code: "missing_endpoint", blocking: true })
    ]));
    expect(proof.destinations.map((item) => item.id)).not.toContain("webhook_other");
    expect(JSON.stringify(proof)).not.toContain("https://discord.com/api/webhooks/123/secret");
    expect(JSON.stringify(proof)).not.toContain("delivery_other");
    expect(JSON.stringify(proof)).not.toContain("secret");
  });

  test("blocks destination lifecycle proof when no destination matches org scope", () => {
    const proof = buildWebhookDestinationLifecycleProof({
      tenantId: "tenant_acme",
      organizationId: "org_missing",
      destinations: [destinationFixture()],
      deliveries: [deliveryFixture()]
    });

    expect(proof).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DESTINATION_LIFECYCLE_PROOF_SCHEMA_VERSION,
      ok: false,
      summary: {
        destinationCount: 0,
        enabledCount: 0,
        disabledCount: 0
      },
      blockers: [expect.objectContaining({ code: "org_scope_empty", ownerLane: "webhook", path: "destinations[].organizationId" })]
    });
    expect(proof.destinations).toEqual([]);
  });

  test("builds no-network destination test action request from lifecycle proof", () => {
    const proof = buildWebhookDestinationLifecycleProof({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      generatedAt: "2026-06-29T12:18:00.000Z",
      destinations: [
        { ...destinationFixture(), label: "SOC Discord", channelLabel: "#alerts", endpointHint: "https://discord.com/api/webhooks/123/secret" }
      ],
      deliveries: [
        { ...deliveryFixture(), id: "delivery_test", eventType: "dwm.alert.test", dryRun: true, status: "dry_run", attemptedAt: "2026-06-29T12:10:00.000Z" }
      ]
    });
    const request = buildWebhookDestinationActionRequest({
      proof,
      destinationId: "webhook_discord",
      action: "test_destination",
      requestId: "req_destination_test",
      generatedAt: "2026-06-29T12:19:00.000Z"
    });

    expect(request).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DESTINATION_ACTION_REQUEST_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:19:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      destinationId: "webhook_discord",
      redacted: true,
      action: "test_destination",
      request: {
        method: "POST",
        route: "/v1/dwm/webhook-destinations/webhook_discord/test",
        canSend: true,
        noNetwork: true,
        liveSendEnabled: false,
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          destinationId: "webhook_discord",
          action: "test_destination",
          dryRun: true,
          live: false,
          requestId: "req_destination_test"
        }
      },
      proof: {
        lifecycleProofId: proof.id,
        currentStatus: "active",
        enabled: true,
        lastTestStatus: "dry_run",
        redactedEndpoint: {
          endpointHash: "endpoint_hash_acme",
          endpointHint: "https://discord.com/api/webhooks/123/...",
          endpointExposed: false
        }
      },
      auditPreview: {
        eventType: "dwm.webhook.destination_action_prepared",
        outcome: "prepared",
        nextAuditAction: "destination.test_requested",
        blockerCodes: []
      },
      blockers: []
    });
    expect(request.request.body?.idempotencyKey).toMatch(/^dwm_webhook_destination_action_/);
    expect(JSON.stringify(request)).not.toContain("https://discord.com/api/webhooks/123/secret");
    expect(JSON.stringify(request)).not.toContain("secret");
  });

  test("blocks destination action requests without org-scoped destination proof", () => {
    const proof = buildWebhookDestinationLifecycleProof({
      tenantId: "tenant_acme",
      organizationId: "org_missing",
      destinations: [destinationFixture()],
      deliveries: [deliveryFixture()]
    });
    const request = buildWebhookDestinationActionRequest({
      proof,
      destinationId: "webhook_discord",
      action: "test_destination",
      requestId: "req_destination_missing"
    });

    expect(request).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DESTINATION_ACTION_REQUEST_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_missing",
      destinationId: "webhook_discord",
      action: "test_destination",
      request: {
        method: "POST",
        route: "/v1/dwm/webhook-destinations/webhook_discord/test",
        canSend: false,
        noNetwork: true,
        liveSendEnabled: false
      },
      auditPreview: {
        outcome: "blocked",
        nextAuditAction: "destination.review_blocked",
        blockerCodes: ["org_scope_empty", "destination_missing"]
      },
      blockers: [
        expect.objectContaining({ code: "org_scope_empty", ownerLane: "webhook" }),
        expect.objectContaining({ code: "destination_missing", ownerLane: "webhook" })
      ]
    });
    expect(request.request.body).toBeUndefined();
  });

  test("packages webhook dispatch readiness for admin support inspection", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });
    const packet = buildWebhookDispatchSupportPacket({
      readiness,
      requestId: "req_webhook_dispatch_support",
      generatedAt: "2026-06-29T12:22:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_SUPPORT_PACKET_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:22:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      redacted: true,
      support: {
        schemaVersion: "support.action_prepare.v1",
        method: "GET",
        route: "/api/admin/support/inspect",
        probeId: "support.webhook.dispatch_readiness",
        entityType: "dwm_webhook_dispatch",
        action: "support.webhook.inspect_dispatch",
        prepareAction: "inspect_webhook_dispatch",
        requestId: "req_webhook_dispatch_support",
        customerVisible: false
      },
      target: {
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme_lumma",
        caseId: "case_acme_lumma",
        destinationIds: ["webhook_discord"],
        dedupeKey: "dedupe_acme_lumma"
      },
      proof: {
        readinessSchemaVersion: DWM_WEBHOOK_DISPATCH_READINESS_SCHEMA_VERSION,
        readinessId: readiness.id,
        checkedAt: "2026-06-29T12:20:00.000Z",
        dispatchRoute: "/v1/dwm/webhooks/deliver",
        dispatchDryRun: false,
        evidenceSummary: {
          evidenceCount: 1,
          captureCount: 1,
          sourceCount: 1,
          contentHashCount: 1
        }
      },
      auditPreview: {
        actionType: "support.webhook.inspect_dispatch",
        source: "dwm.webhook_dispatch_readiness",
        outcome: "prepared",
        blockerCodes: [],
        ownerLanes: []
      },
      blockers: [],
      nextActions: []
    });
    expect(packet.support.idempotencyKey).toMatch(/^dwm_webhook_dispatch_support_/);
    expect(packet.proof.payloadShape).toEqual(expect.arrayContaining(["alertId", "organizationId", "webhookDestinationIds", "idempotencyKey"]));
    expect(JSON.stringify(packet)).not.toContain("https://discord.com");
    expect(JSON.stringify(packet)).not.toContain("payloadBody");
    expect(JSON.stringify(packet)).not.toContain("hash_acme_lumma");
  });

  test("builds a redacted webhook dispatch replay request from readiness", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({
      readiness,
      requestId: "req_webhook_dispatch_replay",
      generatedAt: "2026-06-29T12:24:00.000Z"
    });

    expect(replay).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_REPLAY_REQUEST_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:24:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      redacted: true,
      request: {
        method: "POST",
        route: "/v1/dwm/webhooks/deliver",
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          alertId: "alert_acme_lumma",
          caseId: "case_acme_lumma",
          dedupeKey: "dedupe_acme_lumma",
          webhookDestinationIds: ["webhook_discord"],
          evidenceCaptureIds: ["capture_acme_lumma"],
          dryRun: true,
          reason: "webhook_dispatch_dry_run",
          requestId: "req_webhook_dispatch_replay"
        },
        redacted: true
      },
      target: {
        readinessId: readiness.id,
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme_lumma",
        caseId: "case_acme_lumma",
        destinationIds: ["webhook_discord"],
        dedupeKey: "dedupe_acme_lumma"
      },
      evidenceSummary: {
        redacted: true,
        evidenceCount: 1,
        captureCount: 1,
        sourceCount: 1,
        contentHashCount: 1
      },
      blockers: [],
      nextActions: []
    });
    expect(replay.request.body.idempotencyKey).toMatch(/^dwm_webhook_dispatch_replay_/);
    expect(replay.request.payloadShape).toEqual(expect.arrayContaining(["alertId", "organizationId", "webhookDestinationIds", "evidenceCaptureIds", "dryRun", "idempotencyKey"]));
    expect(JSON.stringify(replay)).not.toContain("https://discord.com");
    expect(JSON.stringify(replay)).not.toContain("payloadBody");
    expect(JSON.stringify(replay)).not.toContain("endpoint_hash_acme");
    expect(JSON.stringify(replay)).not.toContain("hash_acme_lumma");
  });

  test("builds redacted replay delivery history from persisted attempts", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({
      readiness,
      requestId: "req_webhook_dispatch_replay",
      generatedAt: "2026-06-29T12:24:00.000Z"
    });
    const history = buildWebhookDispatchReplayHistory({
      readiness,
      replayRequest: replay,
      generatedAt: "2026-06-29T12:25:00.000Z",
      deliveries: [
        {
          ...deliveryFixture(),
          id: "delivery_replay_retry",
          status: "failed",
          dryRun: true,
          replay: true,
          attemptedAt: "2026-06-29T12:23:00.000Z",
          nextRetryAt: "2026-06-29T12:28:00.000Z",
          errorCategory: "upstream_5xx",
          responseSummary: "Discord rejected https://discord.com/api/webhooks/123/token token=secret",
          idempotencyKey: replay.request.body.idempotencyKey
        },
        {
          ...deliveryFixture(),
          id: "delivery_replay_delivered",
          status: "delivered",
          dryRun: false,
          replay: true,
          attemptedAt: "2026-06-29T12:22:00.000Z",
          idempotencyKey: "prior_replay_idem"
        },
        {
          ...deliveryFixture(),
          id: "delivery_other_org",
          organizationId: "org_other",
          webhookDestinationId: "webhook_other"
        }
      ]
    });

    expect(history).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_REPLAY_HISTORY_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:25:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      redacted: true,
      request: {
        replayRequestId: replay.id,
        route: "/v1/dwm/webhooks/deliver",
        dryRun: true,
        idempotencyKey: replay.request.body.idempotencyKey,
        redacted: true
      },
      history: {
        redacted: true,
        attemptCount: 2,
        deliveredCount: 1,
        failedCount: 1,
        dryRunCount: 1,
        liveCount: 1,
        replayCount: 2,
        latestStatus: "failed",
        latestAttemptedAt: "2026-06-29T12:23:00.000Z"
      },
      retry: {
        retryable: true,
        nextRetryAt: "2026-06-29T12:28:00.000Z",
        attemptCount: 2,
        lastErrorCategory: "upstream_5xx"
      },
      auditPreview: {
        eventType: "dwm.webhook.dispatch_replay_history_checked",
        outcome: "ready",
        replayRequestId: replay.id,
        blockerCodes: []
      },
      blockers: []
    });
    expect(history.history.attempts.map((item) => item.deliveryId)).toEqual(["delivery_replay_retry", "delivery_replay_delivered"]);
    expect(history.history.attempts[0].responseSummary).toBe("Discord rejected https://discord.com/api/webhooks/[redacted] token=[redacted]");
    expect(history.request.payloadShape).toEqual(expect.arrayContaining(["alertId", "webhookDestinationIds", "dryRun", "idempotencyKey"]));
    expect(JSON.stringify(history)).not.toContain("https://discord.com/api/webhooks/123/token");
    expect(JSON.stringify(history)).not.toContain("secret");
    expect(JSON.stringify(history)).not.toContain("delivery_other_org");
    expect(JSON.stringify(history)).not.toContain("endpoint_hash_acme");
    expect(JSON.stringify(history)).not.toContain("payloadBody");
  });

  test("builds delivery persistence proof with redacted payload preview audit and retry metadata", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({
      readiness,
      requestId: "req_webhook_dispatch_replay",
      generatedAt: "2026-06-29T12:24:00.000Z"
    });
    const deliveries = [
      {
        ...deliveryFixture(),
        id: "delivery_replay_retry",
        status: "failed",
        dryRun: true,
        replay: true,
        attemptedAt: "2026-06-29T12:23:00.000Z",
        createdAt: "2026-06-29T12:22:59.000Z",
        updatedAt: "2026-06-29T12:23:01.000Z",
        nextRetryAt: "2026-06-29T12:28:00.000Z",
        errorCategory: "upstream_5xx",
        responseSummary: "Discord rejected https://discord.com/api/webhooks/123/token token=secret",
        payloadPreview: "Lumma alert for org_acme via https://discord.com/api/webhooks/123/token secret=supersecret",
        auditEventId: "audit_retry_scheduled",
        idempotencyKey: replay.request.body.idempotencyKey
      },
      {
        ...deliveryFixture(),
        id: "delivery_replay_delivered",
        status: "delivered",
        dryRun: false,
        replay: true,
        attemptedAt: "2026-06-29T12:22:00.000Z",
        payloadPreview: "Lumma delivered to Discord channel #alerts",
        auditEventId: "audit_delivery_delivered",
        idempotencyKey: "prior_replay_idem"
      },
      {
        ...deliveryFixture(),
        id: "delivery_other_org",
        organizationId: "org_other",
        webhookDestinationId: "webhook_other",
        payloadPreview: "Other org should not leak"
      }
    ];
    const history = buildWebhookDispatchReplayHistory({
      readiness,
      replayRequest: replay,
      generatedAt: "2026-06-29T12:25:00.000Z",
      deliveries
    });
    const proof = buildWebhookDeliveryPersistenceProof({
      history,
      deliveries,
      generatedAt: "2026-06-29T12:27:00.000Z"
    });

    expect(proof).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DELIVERY_PERSISTENCE_PROOF_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:27:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      redacted: true,
      ledger: {
        redacted: true,
        rowCount: 2,
        persistedCount: 1,
        failedCount: 1,
        retryScheduledCount: 1,
        rows: [
          expect.objectContaining({
            deliveryId: "delivery_replay_retry",
            destinationId: "webhook_discord",
            organizationId: "org_acme",
            alertId: "alert_acme_lumma",
            caseId: "case_acme_lumma",
            status: "failed",
            dryRun: true,
            replay: true,
            dedupeKey: "dedupe_acme_lumma",
            idempotencyKey: replay.request.body.idempotencyKey,
            payloadHash: "payload_hash_acme",
            payloadPreview: "Lumma alert for org_acme via https://discord.com/api/webhooks/[redacted] secret=[redacted]",
            errorCategory: "upstream_5xx",
            responseSummary: "Discord rejected https://discord.com/api/webhooks/[redacted] token=[redacted]",
            retry: {
              eligible: true,
              attemptCount: 1,
              nextRetryAt: "2026-06-29T12:28:00.000Z"
            },
            audit: {
              eventType: "dwm.webhook.delivery_persisted",
              outcome: "retry_scheduled",
              auditEventId: "audit_retry_scheduled"
            },
            timestamps: {
              createdAt: "2026-06-29T12:22:59.000Z",
              updatedAt: "2026-06-29T12:23:01.000Z",
              attemptedAt: "2026-06-29T12:23:00.000Z"
            }
          }),
          expect.objectContaining({
            deliveryId: "delivery_replay_delivered",
            status: "delivered",
            dryRun: false,
            replay: true,
            payloadPreview: "Lumma delivered to Discord channel #alerts",
            retry: {
              eligible: false,
              attemptCount: 2
            },
            audit: {
              eventType: "dwm.webhook.delivery_persisted",
              outcome: "persisted",
              auditEventId: "audit_delivery_delivered"
            }
          })
        ]
      },
      auditPreview: {
        eventType: "dwm.webhook.delivery_persistence_checked",
        outcome: "ready",
        blockerCodes: [],
        auditEventIds: ["audit_retry_scheduled", "audit_delivery_delivered"]
      },
      blockers: []
    });
    expect(JSON.stringify(proof)).not.toContain("https://discord.com/api/webhooks/123/token");
    expect(JSON.stringify(proof)).not.toContain("supersecret");
    expect(JSON.stringify(proof)).not.toContain("delivery_other_org");
    expect(JSON.stringify(proof)).not.toContain("Other org should not leak");
  });

  test("blocks delivery persistence proof when no attempt rows were persisted", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({
      readiness,
      requestId: "req_webhook_dispatch_replay",
      generatedAt: "2026-06-29T12:24:00.000Z"
    });
    const history = buildWebhookDispatchReplayHistory({
      readiness,
      replayRequest: replay,
      deliveries: []
    });
    const proof = buildWebhookDeliveryPersistenceProof({ history });

    expect(proof).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DELIVERY_PERSISTENCE_PROOF_SCHEMA_VERSION,
      ok: false,
      ledger: {
        rowCount: 0,
        persistedCount: 0,
        failedCount: 0,
        retryScheduledCount: 0,
        rows: []
      },
      auditPreview: {
        outcome: "blocked",
        blockerCodes: ["missing_delivery_attempt"],
        auditEventIds: []
      },
      blockers: [expect.objectContaining({
        code: "missing_delivery_attempt",
        ownerLane: "webhook",
        path: "history.attempts"
      })]
    });
  });

  test("builds no-network retry audit request from replay history", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({
      readiness,
      requestId: "req_webhook_dispatch_replay",
      generatedAt: "2026-06-29T12:24:00.000Z"
    });
    const history = buildWebhookDispatchReplayHistory({
      readiness,
      replayRequest: replay,
      deliveries: [{
        ...deliveryFixture(),
        id: "delivery_replay_retry",
        status: "failed",
        dryRun: true,
        replay: true,
        nextRetryAt: "2026-06-29T12:28:00.000Z",
        errorCategory: "upstream_5xx"
      }]
    });
    const retryAudit = buildWebhookDispatchRetryAudit({
      history,
      requestId: "req_retry_audit",
      generatedAt: "2026-06-29T12:26:00.000Z"
    });

    expect(retryAudit).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_RETRY_AUDIT_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:26:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      redacted: true,
      retry: {
        eligible: true,
        nextRetryAt: "2026-06-29T12:28:00.000Z",
        attemptCount: 1,
        lastErrorCategory: "upstream_5xx"
      },
      request: {
        method: "POST",
        route: "/v1/dwm/webhooks/deliver",
        canSend: true,
        noNetwork: true,
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          alertId: "alert_acme_lumma",
          caseId: "case_acme_lumma",
          dedupeKey: "dedupe_acme_lumma",
          webhookDestinationIds: ["webhook_discord"],
          dryRun: true,
          reason: "webhook_dispatch_retry",
          requestId: "req_retry_audit"
        }
      },
      auditPreview: {
        eventType: "dwm.webhook.dispatch_retry_prepared",
        outcome: "prepared",
        replayHistoryId: history.id,
        nextAuditAction: "delivery.retry_requested",
        blockerCodes: []
      },
      blockers: []
    });
    expect(retryAudit.request.body?.idempotencyKey).toMatch(/^dwm_webhook_dispatch_retry_/);
    expect(JSON.stringify(retryAudit)).not.toContain("https://discord.com");
    expect(JSON.stringify(retryAudit)).not.toContain("payloadBody");
    expect(JSON.stringify(retryAudit)).not.toContain("endpoint_hash_acme");
  });

  test("blocks webhook dispatch without case provenance active destination or duplicate-safe state", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: {
        ...alertFixture(),
        caseId: undefined,
        caseIdCandidate: undefined,
        status: "suppressed",
        evidence: [],
        provenance: { captureIds: [] },
        workflowContext: { ...alertFixture().workflowContext, captureIds: [], evidenceCount: 0 }
      },
      destinations: [{ ...destinationFixture(), organizationId: "org_other", status: "disabled" }],
      existingDeliveries: [{ ...deliveryFixture(), status: "delivered" }],
      checkedAt: "2026-06-29T12:21:00.000Z"
    });

    expect(readiness).toMatchObject({
      ok: false,
      dispatch: {
        route: "/v1/dwm/webhooks/deliver",
        destinationIds: ["webhook_discord"],
        redacted: true
      }
    });
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_case_id", ownerLane: "case", path: "alert.caseId" }),
      expect.objectContaining({ code: "missing_provenance", ownerLane: "source", path: "alert.evidence" }),
      expect.objectContaining({ code: "disabled_destination", ownerLane: "webhook", path: "destinations[].status" }),
      expect.objectContaining({ code: "destination_scope_mismatch", ownerLane: "webhook", path: "destinations[].organizationId" }),
      expect.objectContaining({ code: "suppressed_alert", ownerLane: "alert", path: "alert.status" }),
      expect.objectContaining({ code: "duplicate_delivered_dedupe", ownerLane: "webhook", path: "existingDeliveries[].dedupeKey" })
    ]));
    expect(readiness.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "link_case", blockerCode: "missing_case_id" }),
      expect.objectContaining({ action: "restore_provenance", blockerCode: "missing_provenance" }),
      expect.objectContaining({ action: "enable_destination", blockerCode: "disabled_destination" }),
      expect.objectContaining({ action: "resolve_destination_scope", blockerCode: "destination_scope_mismatch" }),
      expect.objectContaining({ action: "review_alert", blockerCode: "suppressed_alert" }),
      expect.objectContaining({ action: "inspect_existing_delivery", blockerCode: "duplicate_delivered_dedupe" })
    ]));
    expect(JSON.stringify(readiness)).not.toContain("https://discord.com");
  });

  test("keeps blocked webhook dispatch replay requests non-executable and actionable", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: {
        ...alertFixture(),
        caseId: undefined,
        caseIdCandidate: undefined,
        status: "suppressed",
        evidence: [],
        provenance: { captureIds: [] },
        workflowContext: { ...alertFixture().workflowContext, captureIds: [], evidenceCount: 0 }
      },
      destinations: [{ ...destinationFixture(), organizationId: "org_other", status: "disabled" }],
      existingDeliveries: [{ ...deliveryFixture(), status: "delivered" }],
      checkedAt: "2026-06-29T12:21:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({
      readiness,
      requestId: "req_webhook_dispatch_replay_blocked",
      dryRun: false
    });

    expect(replay).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_REPLAY_REQUEST_SCHEMA_VERSION,
      ok: false,
      request: {
        method: "POST",
        route: "/v1/dwm/webhooks/deliver",
        body: {
          alertId: "alert_acme_lumma",
          webhookDestinationIds: ["webhook_discord"],
          evidenceCaptureIds: [],
          dryRun: false,
          reason: "webhook_dispatch_replay",
          requestId: "req_webhook_dispatch_replay_blocked"
        },
        redacted: true
      },
      evidenceSummary: {
        evidenceCount: 0,
        captureCount: 0,
        sourceCount: 0,
        contentHashCount: 0
      }
    });
    expect(replay.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_case_id", ownerLane: "case", path: "alert.caseId" }),
      expect.objectContaining({ code: "missing_provenance", ownerLane: "source", path: "alert.evidence" }),
      expect.objectContaining({ code: "disabled_destination", ownerLane: "webhook", path: "destinations[].status" }),
      expect.objectContaining({ code: "suppressed_alert", ownerLane: "alert", path: "alert.status" })
    ]));
    expect(replay.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "link_case", blockerCode: "missing_case_id" }),
      expect.objectContaining({ action: "restore_provenance", blockerCode: "missing_provenance" }),
      expect.objectContaining({ action: "enable_destination", blockerCode: "disabled_destination" })
    ]));
    expect(JSON.stringify(replay)).not.toContain("https://discord.com");
    expect(JSON.stringify(replay)).not.toContain("payloadBody");
    expect(JSON.stringify(replay)).not.toContain("hash_acme_lumma");
  });

  test("keeps blocked replay history non-executable and owner-coded", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: {
        ...alertFixture(),
        caseId: undefined,
        caseIdCandidate: undefined,
        status: "suppressed",
        evidence: [],
        provenance: { captureIds: [] },
        workflowContext: { ...alertFixture().workflowContext, captureIds: [], evidenceCount: 0 }
      },
      destinations: [{ ...destinationFixture(), organizationId: "org_other", status: "disabled" }],
      existingDeliveries: [{ ...deliveryFixture(), status: "delivered" }],
      checkedAt: "2026-06-29T12:21:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({
      readiness,
      requestId: "req_webhook_dispatch_replay_blocked",
      dryRun: false
    });
    const history = buildWebhookDispatchReplayHistory({
      readiness,
      replayRequest: replay,
      deliveries: [{ ...deliveryFixture(), status: "delivered", replay: true }]
    });

    expect(history).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_REPLAY_HISTORY_SCHEMA_VERSION,
      ok: false,
      request: {
        replayRequestId: replay.id,
        route: "/v1/dwm/webhooks/deliver",
        dryRun: false,
        redacted: true
      },
      history: {
        attemptCount: 1,
        deliveredCount: 1,
        replayCount: 1
      },
      auditPreview: {
        outcome: "blocked",
        blockerCodes: expect.arrayContaining(["missing_case_id", "missing_provenance", "disabled_destination", "suppressed_alert"])
      }
    });
    expect(history.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_case_id", ownerLane: "case", path: "alert.caseId" }),
      expect.objectContaining({ code: "missing_provenance", ownerLane: "source", path: "alert.evidence" }),
      expect.objectContaining({ code: "disabled_destination", ownerLane: "webhook", path: "destinations[].status" })
    ]));
    expect(history.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "link_case", blockerCode: "missing_case_id" }),
      expect.objectContaining({ action: "restore_provenance", blockerCode: "missing_provenance" }),
      expect.objectContaining({ action: "enable_destination", blockerCode: "disabled_destination" })
    ]));
    expect(JSON.stringify(history)).not.toContain("https://discord.com");
    expect(JSON.stringify(history)).not.toContain("payloadBody");
    expect(JSON.stringify(history)).not.toContain("hash_acme_lumma");
  });

  test("blocks retry audit requests without retryable replay history", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: alertFixture(),
      destinations: [destinationFixture()],
      checkedAt: "2026-06-29T12:20:00.000Z"
    });
    const replay = buildWebhookDispatchReplayRequest({ readiness });
    const history = buildWebhookDispatchReplayHistory({
      readiness,
      replayRequest: replay,
      deliveries: [{ ...deliveryFixture(), status: "delivered", replay: true }]
    });
    const retryAudit = buildWebhookDispatchRetryAudit({ history });

    expect(retryAudit).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_RETRY_AUDIT_SCHEMA_VERSION,
      ok: false,
      retry: {
        eligible: false,
        attemptCount: 1
      },
      request: {
        canSend: false,
        noNetwork: true,
        body: undefined
      },
      auditPreview: {
        outcome: "blocked",
        nextAuditAction: "delivery.retry_blocked",
        blockerCodes: ["retry_not_eligible"]
      }
    });
    expect(retryAudit.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "retry_not_eligible", ownerLane: "webhook", path: "history.retry.retryable" })
    ]));
    expect(JSON.stringify(retryAudit)).not.toContain("https://discord.com");
    expect(JSON.stringify(retryAudit)).not.toContain("payloadBody");
  });

  test("keeps blocked webhook dispatch support packet actionable and redacted", () => {
    const readiness = buildWebhookDispatchReadiness({
      alert: {
        ...alertFixture(),
        caseId: undefined,
        caseIdCandidate: undefined,
        status: "suppressed",
        evidence: [],
        provenance: { captureIds: [] },
        workflowContext: { ...alertFixture().workflowContext, captureIds: [], evidenceCount: 0 }
      },
      destinations: [{ ...destinationFixture(), organizationId: "org_other", status: "disabled" }],
      existingDeliveries: [{ ...deliveryFixture(), status: "delivered" }],
      checkedAt: "2026-06-29T12:21:00.000Z"
    });
    const packet = buildWebhookDispatchSupportPacket({
      readiness,
      requestId: "req_webhook_dispatch_blocked"
    });

    expect(packet).toMatchObject({
      schemaVersion: DWM_WEBHOOK_DISPATCH_SUPPORT_PACKET_SCHEMA_VERSION,
      ok: false,
      support: {
        route: "/api/admin/support/inspect",
        probeId: "support.webhook.dispatch_readiness",
        action: "support.webhook.resolve_dispatch_blocker",
        prepareAction: "resolve_webhook_dispatch_blocker",
        requestId: "req_webhook_dispatch_blocked",
        customerVisible: false
      },
      auditPreview: {
        outcome: "blocked",
        actionType: "support.webhook.resolve_dispatch_blocker",
        blockerCodes: expect.arrayContaining([
          "missing_case_id",
          "missing_provenance",
          "disabled_destination",
          "destination_scope_mismatch",
          "suppressed_alert",
          "duplicate_delivered_dedupe"
        ]),
        ownerLanes: expect.arrayContaining(["case", "source", "webhook", "alert"])
      },
      proof: {
        evidenceSummary: {
          evidenceCount: 0,
          captureCount: 0,
          sourceCount: 0,
          contentHashCount: 0
        }
      }
    });
    expect(packet.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_case_id", ownerLane: "case", path: "alert.caseId" }),
      expect.objectContaining({ code: "missing_provenance", ownerLane: "source", path: "alert.evidence" }),
      expect.objectContaining({ code: "disabled_destination", ownerLane: "webhook", path: "destinations[].status" }),
      expect.objectContaining({ code: "suppressed_alert", ownerLane: "alert", path: "alert.status" })
    ]));
    expect(packet.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "link_case", blockerCode: "missing_case_id" }),
      expect.objectContaining({ action: "restore_provenance", blockerCode: "missing_provenance" }),
      expect.objectContaining({ action: "enable_destination", blockerCode: "disabled_destination" })
    ]));
    expect(JSON.stringify(packet)).not.toContain("https://discord.com");
    expect(JSON.stringify(packet)).not.toContain("payloadBody");
    expect(JSON.stringify(packet)).not.toContain("hash_acme_lumma");
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

function destinationFixture() {
  return {
    id: "webhook_discord",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    status: "active",
    deliveryKind: "discord",
    endpointHash: "endpoint_hash_acme"
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
