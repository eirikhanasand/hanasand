import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("DWM alert case handoff route", () => {
  test("opens and reuses an org-scoped case from a provenanced alert", async () => {
    const { options, store } = fixtureRuntime();

    const created = await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open a case for this watched-domain exposure.",
      idempotencyKey: "alert-case-handoff-001"
    });
    const createdPayload = await created.json() as any;
    const duplicate = await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open a case for this watched-domain exposure.",
      idempotencyKey: "alert-case-handoff-001"
    });
    const duplicatePayload = await duplicate.json() as any;
    const detail = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_alert_acme?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detailPayload = await detail.json() as any;

    expect(created.status).toBe(201);
    expect(createdPayload.case).toMatchObject({
      id: "case_alert_acme",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      status: "open",
      assignedOwner: "owner@acme.com"
    });
    expect(createdPayload.alertCaseHandoff).toMatchObject({
      schemaVersion: "dwm.alert_case_handoff.v1",
      route: "/v1/dwm/alerts/alert_acme/case-handoff",
      method: "POST",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      caseId: "case_alert_acme",
      casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
      webhookDestinationIds: ["webhook_acme_discord"],
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      workflowState: {
        caseStatus: "open",
        replayState: "recorded",
        idempotencyKey: "alert-case-handoff-001",
        dedupeKey: expect.stringMatching(/^dwm_alert_case_handoff_/)
      },
      readiness: {
        replayReady: true,
        webhookDryRunReady: true,
        blockerCodes: []
      },
      consumerActions: {
        alertReplay: {
          route: "/v1/dwm/alerts/alert_acme/replay",
          method: "POST",
          body: {
            organizationId: "org_acme",
            caseId: "case_alert_acme",
            casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
            expectedWorkflowEventCount: 2
          }
        },
        webhookDryRun: {
          route: "/v1/dwm/webhooks/deliver",
          method: "POST",
          body: {
            organizationId: "org_acme",
            alertId: "alert_acme",
            caseId: "case_alert_acme",
            webhookDestinationId: "webhook_acme_discord",
            webhookDestinationIds: ["webhook_acme_discord"],
            dryRun: true,
            limit: 1
          }
        }
      },
      provenance: {
        source: "dwm_alert",
        alertId: "alert_acme",
        caseId: "case_alert_acme",
        auditEventId: expect.stringMatching(/^case_workflow_audit_/),
        workflowEventId: expect.stringMatching(/^case_event_/),
        captureIds: ["cap_acme_1"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_1"],
        sourceFamilies: ["telegram_public"],
        evidenceCount: 1,
        blockers: []
      }
    });
    expect(detail.status).toBe(200);
    expect(detailPayload.alertCaseHandoffContext).toMatchObject({
      schemaVersion: "dwm.alert_case_handoff.v1",
      route: "/v1/dwm/alerts/alert_acme/case-handoff",
      caseId: "case_alert_acme",
      alertId: "alert_acme",
      webhookDestinationIds: ["webhook_acme_discord"],
      workflowState: {
        caseStatus: "open",
        replayState: "reused",
        dedupeKey: expect.stringMatching(/^dwm_alert_case_handoff_/)
      },
      readiness: {
        replayReady: true,
        webhookDryRunReady: true,
        blockerCodes: []
      },
      consumerActions: {
        alertReplay: {
          route: "/v1/dwm/alerts/alert_acme/replay",
          method: "POST",
          body: {
            organizationId: "org_acme",
            caseId: "case_alert_acme",
            expectedWorkflowEventCount: 2
          }
        },
        webhookDryRun: {
          route: "/v1/dwm/webhooks/deliver",
          method: "POST",
          body: {
            organizationId: "org_acme",
            alertId: "alert_acme",
            caseId: "case_alert_acme",
            webhookDestinationId: "webhook_acme_discord",
            dryRun: true
          }
        }
      },
      provenance: {
        captureIds: ["cap_acme_1"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_1"],
        blockers: []
      }
    });
    expect(detailPayload.handoffActionReadiness).toMatchObject({
      schemaVersion: "dwm.case_handoff_action_readiness.v1",
      generatedFrom: "dwm.alert_case_handoff.v1",
      caseId: "case_alert_acme",
      alertId: "alert_acme",
      organizationId: "org_acme",
      readyActionIds: ["alertReplay", "webhookDryRun"],
      actions: {
        alertReplay: {
          ready: true,
          route: "/v1/dwm/alerts/alert_acme/replay",
          method: "POST",
          body: {
            organizationId: "org_acme",
            caseId: "case_alert_acme",
            expectedWorkflowEventCount: 2
          },
          blockerCodes: []
        },
        webhookDryRun: {
          ready: true,
          route: "/v1/dwm/webhooks/deliver",
          method: "POST",
          body: {
            organizationId: "org_acme",
            alertId: "alert_acme",
            caseId: "case_alert_acme",
            webhookDestinationId: "webhook_acme_discord",
            dryRun: true
          },
          blockerCodes: []
        }
      },
      provenance: {
        captureIds: ["cap_acme_1"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_1"],
        evidenceCount: 1
      },
      blockerCodes: []
    });
    (store as any).saveDwmWebhookDelivery({
      id: "delivery_dry_run_case_alert_acme",
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      alertId: "alert_acme",
      watchlistId: "watch_acme",
      webhookDestinationId: "webhook_acme_discord",
      endpointHash: "endpoint_hash",
      dedupeKey: "delivery_alert_acme_webhook",
      attemptedAt: "2026-06-29T14:03:00.000Z",
      dryRun: true,
      payloadHash: "payload_hash",
      deliveryKind: "discord",
      status: "dry_run",
      httpStatus: 0
    });
    const receiptDetail = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_alert_acme?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const receiptDetailPayload = await receiptDetail.json() as any;
    expect(receiptDetail.status).toBe(200);
    expect(receiptDetailPayload.handoffActionReadiness.actions.webhookDryRun).toMatchObject({
      latestDryRunDeliveryId: "delivery_dry_run_case_alert_acme",
      latestDryRunAt: "2026-06-29T14:03:00.000Z",
      latestDryRunStatus: "dry_run"
    });
    const replayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme&actionId=webhookDryRun");
    const replayExportPayload = await replayExport.json() as any;
    expect(replayExport.status).toBe(200);
    expect(replayExportPayload.webhookDryRunReadiness).toMatchObject({
      schemaVersion: "dwm.case_webhook_dry_run_replay_readiness.v1",
      route: "/v1/dwm/webhooks/deliver",
      method: "POST",
      caseId: "case_alert_acme",
      alertId: "alert_acme",
      organizationId: "org_acme",
      destinationIds: ["webhook_acme_discord"],
      readyForReplay: true,
      receiptAvailable: true,
      notificationLinked: false,
      blockerCodes: [],
      latestDelivery: {
        id: "delivery_dry_run_case_alert_acme",
        webhookDestinationId: "webhook_acme_discord",
        status: "dry_run",
        attemptedAt: "2026-06-29T14:03:00.000Z",
        endpointHash: "endpoint_hash",
        payloadHash: "payload_hash",
        dedupeKey: "delivery_alert_acme_webhook",
        dryRun: true
      },
      auditSafety: {
        metadataOnly: true,
        endpointSecretExposed: false,
        payloadBodyExposed: false
      }
    });
    expect(replayExportPayload.webhookDryRunReadiness.deliveryReceipts).toHaveLength(1);
    expect(replayExportPayload.replayPlan).toMatchObject({
      dryRunDeliveryReceiptCount: 1
    });
    expect(JSON.stringify(replayExportPayload.webhookDryRunReadiness)).not.toContain("discord.com");
    const viewerDetail = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_alert_acme?organizationId=org_acme", {
      headers: { "x-user-email": "viewer@acme.com" }
    }), options);
    const viewerDetailPayload = await viewerDetail.json() as any;
    expect(viewerDetail.status).toBe(200);
    expect(viewerDetailPayload.handoffActionReadiness).toMatchObject({
      readyActionIds: [],
      actions: {
        alertReplay: {
          ready: false,
          blockerCodes: ["case_read_only_member"]
        },
        webhookDryRun: {
          ready: false,
          blockerCodes: ["case_read_only_member"]
        }
      },
      blockerCodes: ["case_read_only_member"]
    });
    expect(duplicate.status).toBe(200);
    expect(duplicatePayload.alertCaseHandoff).toMatchObject({
      caseId: "case_alert_acme",
      workflowState: {
        replayState: "reused",
        idempotencyKey: "alert-case-handoff-001",
        dedupeKey: createdPayload.alertCaseHandoff.workflowState.dedupeKey
      },
      provenance: {
        captureIds: ["cap_acme_1"]
      }
    });
    expect((store as any).getCase("case_alert_acme").workflowEvents).toHaveLength(1);
    const escalated = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "escalate",
      assignedOwner: "admin@acme.com",
      note: "Escalate after confirming matched watchlist evidence.",
      idempotencyKey: "case-transition-escalate-001"
    });
    const escalatedPayload = await escalated.json() as any;
    const reusedAfterTransition = await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Attempt to reopen an already escalated case.",
      idempotencyKey: "alert-case-handoff-after-escalate"
    });
    const reusedAfterTransitionPayload = await reusedAfterTransition.json() as any;
    expect(escalated.status).toBe(200);
    expect(escalatedPayload).toMatchObject({
      replayed: false,
      duplicate: false,
      case: {
        id: "case_alert_acme",
        status: "escalated",
        assignedOwner: "admin@acme.com",
        lastDecision: "Escalate after confirming matched watchlist evidence."
      },
      workflowTransition: {
        action: "escalate",
        fromStatus: "open",
        toStatus: "escalated",
        fromOwner: "owner@acme.com",
        toOwner: "admin@acme.com",
        workflowState: {
          idempotencyKey: "case-transition-escalate-001"
        }
      },
      alert: {
        id: "alert_acme",
        caseId: "case_alert_acme",
        reviewState: "route_to_customer",
        assignedOwner: "admin@acme.com"
      }
    });
    expect(reusedAfterTransition.status).toBe(200);
    expect(reusedAfterTransitionPayload).toMatchObject({
      case: {
        id: "case_alert_acme",
        status: "escalated",
        assignedOwner: "admin@acme.com",
        lastDecision: "Escalate after confirming matched watchlist evidence."
      },
      alertCaseHandoff: {
        caseId: "case_alert_acme",
        workflowState: {
          caseStatus: "escalated",
          replayState: "reused",
          idempotencyKey: "alert-case-handoff-after-escalate"
        },
        provenance: {
          captureIds: ["cap_acme_1"],
          sourceIds: ["src_acme_tg"],
          contentHashes: ["hash_acme_1"]
        }
      }
    });
    expect((store as any).getCase("case_alert_acme").workflowEvents.map((event: any) => event.action)).toEqual([
      "open",
      "escalate"
    ]);
    expect((store as any).getDwmAlert("alert_acme").caseId).toBe("case_alert_acme");
    expect(JSON.stringify({ createdPayload, duplicatePayload })).not.toContain("https://discord.com");
  });

  test("keeps case handoff usable while blocking webhook dry-run without a destination", async () => {
    const { options, store } = fixtureRuntime();
    store.saveDwmAlert({
      ...provenancedAlert(),
      id: "alert_no_destination",
      caseIdCandidate: "case_alert_no_destination",
      casePath: "/v1/cases/case_alert_no_destination?alertId=alert_no_destination",
      workflowContext: {
        ...provenancedAlert().workflowContext,
        caseIdCandidate: "case_alert_no_destination",
        casePath: "/v1/cases/case_alert_no_destination?alertId=alert_no_destination",
        webhookDestinationIds: []
      },
      webhookContext: undefined,
      deliveryReadinessContext: undefined
    });

    const created = await postHandoff(options, "alert_no_destination", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open a case before webhook routing is configured."
    });
    const createdPayload = await created.json() as any;
    const detail = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_alert_no_destination?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detailPayload = await detail.json() as any;

    expect(created.status).toBe(201);
    expect(createdPayload.alertCaseHandoff).toMatchObject({
      caseId: "case_alert_no_destination",
      alertId: "alert_no_destination",
      webhookDestinationIds: [],
      readiness: {
        replayReady: true,
        webhookDryRunReady: false,
        blockerCodes: ["missing_webhook_destination"],
        blockers: [{
          code: "missing_webhook_destination",
          path: "alert.workflowContext.webhookDestinationIds"
        }]
      },
      consumerActions: {
        alertReplay: {
          route: "/v1/dwm/alerts/alert_no_destination/replay",
          body: {
            organizationId: "org_acme",
            caseId: "case_alert_no_destination"
          }
        },
        webhookDryRun: {
          route: "/v1/dwm/webhooks/deliver",
          body: {
            organizationId: "org_acme",
            alertId: "alert_no_destination",
            caseId: "case_alert_no_destination",
            webhookDestinationIds: [],
            dryRun: true
          }
        }
      }
    });
    expect(detail.status).toBe(200);
    expect(detailPayload.alertCaseHandoffContext.readiness).toMatchObject({
      replayReady: true,
      webhookDryRunReady: false,
      blockerCodes: ["missing_webhook_destination"]
    });
    expect(detailPayload.handoffActionReadiness).toMatchObject({
      readyActionIds: ["alertReplay"],
      actions: {
        alertReplay: {
          ready: true,
          route: "/v1/dwm/alerts/alert_no_destination/replay",
          blockerCodes: []
        },
        webhookDryRun: {
          ready: false,
          route: "/v1/dwm/webhooks/deliver",
          blockerCodes: ["missing_webhook_destination"],
          body: {
            organizationId: "org_acme",
            alertId: "alert_no_destination",
            caseId: "case_alert_no_destination",
            webhookDestinationIds: []
          }
        }
      },
      blockerCodes: ["missing_webhook_destination"]
    });
    expect((store as any).getCase("case_alert_no_destination").organizationId).toBe("org_acme");
  });

  test("records delivered webhook customer notifications in case replay export", async () => {
    const { options, store } = fixtureRuntime();
    await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open case before customer notification.",
      idempotencyKey: "alert-case-handoff-customer-notification"
    });

    const noDelivery = await postCustomerNotification(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      webhookDeliveryId: "delivery_delivered_case_alert_acme",
      rationale: "Customer notification should require a delivered webhook."
    });
    const noDeliveryPayload = await noDelivery.json() as any;
    (store as any).saveDwmWebhookDelivery({
      id: "delivery_delivered_case_alert_acme",
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      alertId: "alert_acme",
      watchlistId: "watch_acme",
      webhookDestinationId: "webhook_acme_discord",
      endpointHash: "endpoint_hash_delivered",
      dedupeKey: "delivery_alert_acme_webhook_delivered",
      attemptedAt: "2026-06-29T14:10:00.000Z",
      dryRun: false,
      payloadHash: "payload_hash_delivered",
      deliveryKind: "discord",
      status: "delivered",
      httpStatus: 204
    });
    const viewerDenied = await postCustomerNotification(options, "case_alert_acme", "viewer@acme.com", {
      organizationId: "org_acme",
      webhookDeliveryId: "delivery_delivered_case_alert_acme",
      rationale: "Viewer should not record customer notification."
    });
    const viewerDeniedPayload = await viewerDenied.json() as any;
    const notification = await postCustomerNotification(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      webhookDeliveryId: "delivery_delivered_case_alert_acme",
      rationale: "Customer notified from delivered webhook receipt."
    });
    const notificationPayload = await notification.json() as any;
    const duplicate = await postCustomerNotification(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      webhookDeliveryId: "delivery_delivered_case_alert_acme",
      rationale: "Duplicate should reuse existing notification receipt."
    });
    const duplicatePayload = await duplicate.json() as any;
    const replayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme");
    const replayExportPayload = await replayExport.json() as any;

    expect(noDelivery.status).toBe(400);
    expect(noDeliveryPayload.error).toMatchObject({ code: "missing_delivered_webhook" });
    expect(viewerDenied.status).toBe(403);
    expect(viewerDeniedPayload.error).toMatchObject({ code: "case_read_only_member" });
    expect(notification.status).toBe(201);
    expect(notificationPayload).toMatchObject({
      created: true,
      receipt: {
        schemaVersion: "analyst.case_customer_notification.v1",
        caseId: "case_alert_acme",
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme",
        actor: "owner@acme.com",
        deliveryMode: "webhook_delivery",
        rationale: "Customer notified from delivered webhook receipt.",
        webhookDeliveryId: "delivery_delivered_case_alert_acme",
        webhookDestinationId: "webhook_acme_discord",
        webhookStatus: "delivered",
        evidence: {
          evidenceCount: 1,
          deliveryCount: 1,
          delivered: true,
          contentHashes: ["hash_acme_1"],
          sourceIds: ["src_acme_tg"]
        }
      },
      case: {
        id: "case_alert_acme",
        deliveryState: "delivered",
        lastDecision: "Customer notified from delivered webhook receipt."
      }
    });
    expect(duplicate.status).toBe(200);
    expect(duplicatePayload).toMatchObject({
      created: false,
      receipt: {
        id: notificationPayload.receipt.id,
        webhookDeliveryId: "delivery_delivered_case_alert_acme"
      }
    });
    expect(replayExport.status).toBe(200);
    expect(replayExportPayload).toMatchObject({
      replayPlan: {
        customerNotificationCount: 1,
        deliveredWebhookReceiptCount: 1,
        customerNotificationRecorded: true
      },
      customerNotificationReadiness: {
        schemaVersion: "dwm.case_customer_notification_readiness.v1",
        route: "/v1/cases/case_alert_acme/customer-notification",
        method: "POST",
        readyForRecord: false,
        blocked: false,
        notificationRecorded: true,
        deliveredWebhookAvailable: true,
        blockerCodes: [],
        latestDelivery: {
          id: "delivery_delivered_case_alert_acme",
          webhookDestinationId: "webhook_acme_discord",
          status: "delivered",
          endpointHash: "endpoint_hash_delivered",
          payloadHash: "payload_hash_delivered"
        },
        linkedNotificationReceipts: [expect.objectContaining({
          id: notificationPayload.receipt.id,
          webhookDeliveryId: "delivery_delivered_case_alert_acme",
          webhookStatus: "delivered"
        })]
      }
    });
    expect(replayExportPayload.nextAnalystActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "record_customer_notification", ready: false, blocked: false, blockerCodes: [] })
    ]));
    expect(replayExportPayload.auditTimeline.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rowType: "customer_notification",
        action: "customer_notified",
        rationale: "Customer notified from delivered webhook receipt.",
        delivery: expect.objectContaining({
          deliveryMode: "webhook_delivery",
          webhookDeliveryId: "delivery_delivered_case_alert_acme",
          webhookDestinationId: "webhook_acme_discord",
          webhookStatus: "delivered"
        }),
        provenance: expect.objectContaining({
          source: "case_customer_notification",
          sourceIds: ["src_acme_tg"],
          contentHashes: ["hash_acme_1"],
          evidenceCount: 1
        })
      })
    ]));
    expect(JSON.stringify(replayExportPayload)).not.toContain("discord.com");
  });

  test("records analyst notes without changing case state and includes them in replay export", async () => {
    const { options, store } = fixtureRuntime();
    await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open case before analyst note.",
      idempotencyKey: "alert-case-handoff-note"
    });

    const note = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "note",
      note: "Validated source evidence and waiting for customer delivery.",
      idempotencyKey: "case-note-001"
    });
    const notePayload = await note.json() as any;
    const duplicate = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "note",
      note: "Duplicate note should replay the existing event.",
      idempotencyKey: "case-note-001"
    });
    const duplicatePayload = await duplicate.json() as any;
    const missingNote = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "note",
      idempotencyKey: "case-note-missing"
    });
    const missingNotePayload = await missingNote.json() as any;
    const viewerNote = await patchCase(options, "case_alert_acme", "viewer@acme.com", {
      organizationId: "org_acme",
      action: "note",
      note: "Viewer should not mutate a case.",
      idempotencyKey: "case-note-viewer"
    });
    const viewerNotePayload = await viewerNote.json() as any;
    const detail = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_alert_acme?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detailPayload = await detail.json() as any;
    const replayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme&eventAction=note");
    const replayExportPayload = await replayExport.json() as any;

    expect(note.status).toBe(200);
    expect(notePayload).toMatchObject({
      replayed: false,
      duplicate: false,
      case: {
        id: "case_alert_acme",
        status: "open",
        assignedOwner: "owner@acme.com",
        lastDecision: "Validated source evidence and waiting for customer delivery."
      },
      workflowTransition: {
        action: "note",
        fromStatus: "open",
        toStatus: "open",
        fromOwner: "owner@acme.com",
        toOwner: "owner@acme.com",
        workflowState: {
          status: "open",
          assignedOwner: "owner@acme.com",
          idempotencyKey: "case-note-001"
        }
      }
    });
    expect(duplicate.status).toBe(200);
    expect(duplicatePayload).toMatchObject({
      replayed: true,
      duplicate: true,
      event: {
        action: "note",
        idempotencyKey: "case-note-001",
        note: "Validated source evidence and waiting for customer delivery."
      },
      case: {
        status: "open",
        assignedOwner: "owner@acme.com"
      }
    });
    expect(missingNote.status).toBe(400);
    expect(missingNotePayload.error).toMatchObject({ code: "missing_note" });
    expect(viewerNote.status).toBe(403);
    expect(viewerNotePayload.error).toMatchObject({ code: "case_read_only_member" });
    expect(detail.status).toBe(200);
    expect(detailPayload.nextAllowedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "note", method: "PATCH", requiresRationale: true, enabled: true }),
      expect.objectContaining({ id: "escalate", method: "PATCH", requiresRationale: true, enabled: true })
    ]));
    expect(replayExport.status).toBe(200);
    expect(replayExportPayload).toMatchObject({
      filters: {
        eventAction: "note"
      },
      replayPlan: {
        workflowTransitionCount: 1,
        handoffReceiptCount: 0,
        customerNotificationCount: 0,
        auditTimelineRowCount: 1
      },
      auditTimeline: {
        summary: {
          rowCount: 1,
          workflowTransitionCount: 1,
          handoffReceiptCount: 0,
          customerNotificationCount: 0,
          actions: ["note"]
        },
        rows: [expect.objectContaining({
          rowType: "workflow_transition",
          action: "note",
          actor: "case-api",
          rationale: "Validated source evidence and waiting for customer delivery.",
          workflow: expect.objectContaining({
            fromStatus: "open",
            toStatus: "open",
            fromOwner: "owner@acme.com",
            toOwner: "owner@acme.com",
            currentStatus: "open",
            currentOwner: "owner@acme.com"
          }),
          replay: expect.objectContaining({
            idempotencyKey: "case-note-001",
            replayState: "recorded",
            auditEventId: expect.stringMatching(/^case_workflow_audit_/),
            workflowEventId: expect.stringMatching(/^case_event_/)
          })
        })]
      }
    });
    expect((store as any).getCase("case_alert_acme").workflowEvents.map((event: any) => event.action)).toEqual([
      "open",
      "note"
    ]);
  });

  test("assigns cases to active members while preserving workflow replay state", async () => {
    const { options, store } = fixtureRuntime();
    await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open case before assignment.",
      idempotencyKey: "alert-case-handoff-assign"
    });

    const assigned = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "assign",
      assignedOwner: "admin@acme.com",
      note: "Assign to admin for customer delivery.",
      idempotencyKey: "case-assign-admin-001"
    });
    const assignedPayload = await assigned.json() as any;
    const duplicate = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "assign",
      assignedOwner: "member@acme.com",
      note: "Duplicate assignment should replay the first owner.",
      idempotencyKey: "case-assign-admin-001"
    });
    const duplicatePayload = await duplicate.json() as any;
    const missingOwner = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "assign",
      note: "Assignment without an owner should fail.",
      idempotencyKey: "case-assign-missing-owner"
    });
    const missingOwnerPayload = await missingOwner.json() as any;
    const viewerOwner = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "assign",
      assignedOwner: "viewer@acme.com",
      idempotencyKey: "case-assign-viewer-owner"
    });
    const viewerOwnerPayload = await viewerOwner.json() as any;
    const viewerActor = await patchCase(options, "case_alert_acme", "viewer@acme.com", {
      organizationId: "org_acme",
      action: "assign",
      assignedOwner: "admin@acme.com",
      idempotencyKey: "case-assign-viewer-actor"
    });
    const viewerActorPayload = await viewerActor.json() as any;
    const replayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme&eventAction=assign");
    const replayExportPayload = await replayExport.json() as any;

    expect(assigned.status).toBe(200);
    expect(assignedPayload).toMatchObject({
      replayed: false,
      duplicate: false,
      case: {
        id: "case_alert_acme",
        status: "open",
        assignedOwner: "admin@acme.com",
        lastDecision: "Assign to admin for customer delivery."
      },
      workflowTransition: {
        action: "assign",
        fromStatus: "open",
        toStatus: "open",
        fromOwner: "owner@acme.com",
        toOwner: "admin@acme.com",
        workflowState: {
          status: "open",
          assignedOwner: "admin@acme.com",
          idempotencyKey: "case-assign-admin-001"
        }
      },
      alert: {
        id: "alert_acme",
        caseId: "case_alert_acme",
        assignedOwner: "admin@acme.com"
      }
    });
    expect(duplicate.status).toBe(200);
    expect(duplicatePayload).toMatchObject({
      replayed: true,
      duplicate: true,
      event: {
        action: "assign",
        idempotencyKey: "case-assign-admin-001",
        toOwner: "admin@acme.com"
      },
      case: {
        status: "open",
        assignedOwner: "admin@acme.com"
      }
    });
    expect(missingOwner.status).toBe(400);
    expect(missingOwnerPayload.error).toMatchObject({ code: "missing_assigned_owner" });
    expect(viewerOwner.status).toBe(400);
    expect(viewerOwnerPayload.error).toMatchObject({ code: "invalid_case_owner_role" });
    expect(viewerActor.status).toBe(403);
    expect(viewerActorPayload.error).toMatchObject({ code: "case_read_only_member" });
    expect(replayExport.status).toBe(200);
    expect(replayExportPayload).toMatchObject({
      filters: {
        eventAction: "assign"
      },
      replayPlan: {
        workflowTransitionCount: 1,
        auditTimelineRowCount: 1
      },
      auditTimeline: {
        summary: {
          rowCount: 1,
          actions: ["assign"]
        },
        rows: [expect.objectContaining({
          rowType: "workflow_transition",
          action: "assign",
          rationale: "Assign to admin for customer delivery.",
          workflow: expect.objectContaining({
            fromStatus: "open",
            toStatus: "open",
            fromOwner: "owner@acme.com",
            toOwner: "admin@acme.com",
            currentStatus: "open",
            currentOwner: "admin@acme.com"
          }),
          replay: expect.objectContaining({
            idempotencyKey: "case-assign-admin-001",
            replayState: "recorded",
            auditEventId: expect.stringMatching(/^case_workflow_audit_/),
            workflowEventId: expect.stringMatching(/^case_event_/)
          })
        })]
      }
    });
    expect((store as any).getCase("case_alert_acme").workflowEvents.map((event: any) => event.action)).toEqual([
      "open",
      "assign"
    ]);
  });

  test("marks false positives with rationale and preserves reopen audit history", async () => {
    const { options, store } = fixtureRuntime();
    await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open case before false-positive review.",
      idempotencyKey: "alert-case-handoff-false-positive"
    });

    const missingRationale = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "false_positive",
      idempotencyKey: "case-false-positive-missing-rationale"
    });
    const missingRationalePayload = await missingRationale.json() as any;
    const falsePositive = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "false_positive",
      note: "Corporate domain match was benign vendor chatter.",
      idempotencyKey: "case-false-positive-001"
    });
    const falsePositivePayload = await falsePositive.json() as any;
    const detailAfterFalsePositive = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_alert_acme?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detailAfterFalsePositivePayload = await detailAfterFalsePositive.json() as any;
    const blockedEscalate = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "escalate",
      note: "Should reopen before escalating.",
      idempotencyKey: "case-escalate-after-false-positive"
    });
    const blockedEscalatePayload = await blockedEscalate.json() as any;
    const reopened = await patchCase(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      action: "reopen",
      note: "New source evidence requires review.",
      idempotencyKey: "case-reopen-false-positive-001"
    });
    const reopenedPayload = await reopened.json() as any;
    const replayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme");
    const replayExportPayload = await replayExport.json() as any;

    expect(missingRationale.status).toBe(400);
    expect(missingRationalePayload.error).toMatchObject({ code: "missing_decision_rationale" });
    expect(falsePositive.status).toBe(200);
    expect(falsePositivePayload).toMatchObject({
      case: {
        id: "case_alert_acme",
        status: "false_positive",
        assignedOwner: "owner@acme.com",
        lastDecision: "Corporate domain match was benign vendor chatter."
      },
      workflowTransition: {
        action: "false_positive",
        note: "Corporate domain match was benign vendor chatter.",
        idempotencyKey: "case-false-positive-001",
        replayState: "recorded",
        auditEventId: expect.stringMatching(/^case_workflow_audit_/),
        eventId: expect.stringMatching(/^case_event_/),
        fromStatus: "open",
        toStatus: "false_positive",
        workflowState: {
          status: "false_positive",
          idempotencyKey: "case-false-positive-001"
        }
      },
      alert: {
        id: "alert_acme",
        reviewState: "false_positive",
        deliveryState: "muted"
      }
    });
    expect(detailAfterFalsePositive.status).toBe(200);
    expect(detailAfterFalsePositivePayload.nextAllowedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "note", enabled: true }),
      expect.objectContaining({ id: "assign", enabled: false }),
      expect.objectContaining({ id: "escalate", enabled: false }),
      expect.objectContaining({ id: "suppress", enabled: false }),
      expect.objectContaining({ id: "false_positive", enabled: false }),
      expect.objectContaining({ id: "reopen", enabled: true })
    ]));
    expect(blockedEscalate.status).toBe(409);
    expect(blockedEscalatePayload.error).toMatchObject({
      code: "invalid_case_transition",
      fromStatus: "false_positive",
      requestedAction: "escalate"
    });
    expect(reopened.status).toBe(200);
    expect(reopenedPayload).toMatchObject({
      case: {
        id: "case_alert_acme",
        status: "open",
        assignedOwner: "owner@acme.com",
        lastDecision: "New source evidence requires review."
      },
      workflowTransition: {
        action: "reopen",
        note: "New source evidence requires review.",
        idempotencyKey: "case-reopen-false-positive-001",
        replayState: "recorded",
        auditEventId: expect.stringMatching(/^case_workflow_audit_/),
        eventId: expect.stringMatching(/^case_event_/),
        fromStatus: "false_positive",
        toStatus: "open",
        workflowState: {
          status: "open",
          idempotencyKey: "case-reopen-false-positive-001"
        }
      },
      alert: {
        id: "alert_acme",
        reviewState: "reviewing"
      }
    });
    expect(replayExport.status).toBe(200);
    expect(replayExportPayload.workflowTransitions.map((transition: any) => transition.action)).toEqual([
      "open",
      "false_positive",
      "reopen"
    ]);
    expect(replayExportPayload.workflowTransitionHistory).toMatchObject({
      schemaVersion: "dwm.case_workflow_transition_history.v1",
      caseId: "case_alert_acme",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      ready: true,
      currentState: {
        status: "open",
        assignedOwner: "owner@acme.com",
        lastDecision: "New source evidence requires review."
      },
      summary: {
        transitionCount: 3,
        decisionTransitionCount: 2,
        actions: ["open", "false_positive", "reopen"],
        actors: ["case-api"],
        latestTransition: expect.objectContaining({
          action: "reopen",
          note: "New source evidence requires review.",
          idempotencyKey: "case-reopen-false-positive-001",
          replayState: "recorded",
          auditEventId: expect.stringMatching(/^case_workflow_audit_/),
          eventId: expect.stringMatching(/^case_event_/)
        }),
        decisionRationales: [
          expect.objectContaining({
            action: "false_positive",
            rationale: "Corporate domain match was benign vendor chatter.",
            auditEventId: expect.stringMatching(/^case_workflow_audit_/)
          }),
          expect.objectContaining({
            action: "reopen",
            rationale: "New source evidence requires review.",
            auditEventId: expect.stringMatching(/^case_workflow_audit_/)
          })
        ]
      },
      auditSafety: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false
      }
    });
    expect(replayExportPayload.auditTimeline.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rowType: "workflow_transition",
        action: "false_positive",
        rationale: "Corporate domain match was benign vendor chatter.",
        workflow: expect.objectContaining({
          fromStatus: "open",
          toStatus: "false_positive"
        }),
        replay: expect.objectContaining({
          idempotencyKey: "case-false-positive-001",
          auditEventId: expect.stringMatching(/^case_workflow_audit_/)
        })
      }),
      expect.objectContaining({
        rowType: "workflow_transition",
        action: "reopen",
        rationale: "New source evidence requires review.",
        workflow: expect.objectContaining({
          fromStatus: "false_positive",
          toStatus: "open"
        }),
        replay: expect.objectContaining({
          idempotencyKey: "case-reopen-false-positive-001",
          auditEventId: expect.stringMatching(/^case_workflow_audit_/)
        })
      })
    ]));
    expect((store as any).getCase("case_alert_acme").workflowEvents.map((event: any) => event.action)).toEqual([
      "open",
      "false_positive",
      "reopen"
    ]);
  });

  test("records idempotent case handoff action receipts with org access gates", async () => {
    const { options, store } = fixtureRuntime();
    await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open case for action receipt testing.",
      idempotencyKey: "alert-case-handoff-receipt"
    });

    const ownerReplay = await postHandoffAction(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      actionId: "alertReplay",
      note: "Record replay delegation.",
      idempotencyKey: "case-action-replay-001"
    });
    const ownerReplayPayload = await ownerReplay.json() as any;
    const duplicateReplay = await postHandoffAction(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      actionId: "alertReplay",
      note: "Record replay delegation again.",
      idempotencyKey: "case-action-replay-001"
    });
    const duplicateReplayPayload = await duplicateReplay.json() as any;
    const adminDryRun = await postHandoffAction(options, "case_alert_acme", "admin@acme.com", {
      organizationId: "org_acme",
      actionId: "webhookDryRun",
      note: "Record dry-run delivery delegation.",
      idempotencyKey: "case-action-webhook-001"
    });
    const adminDryRunPayload = await adminDryRun.json() as any;
    const memberReplay = await postHandoffAction(options, "case_alert_acme", "member@acme.com", {
      organizationId: "org_acme",
      action: "alert_replay",
      note: "Record member replay delegation.",
      idempotencyKey: "case-action-replay-member"
    });
    const memberReplayPayload = await memberReplay.json() as any;
    const viewerDenied = await postHandoffAction(options, "case_alert_acme", "viewer@acme.com", {
      organizationId: "org_acme",
      actionId: "alertReplay",
      idempotencyKey: "case-action-viewer-denied"
    });
    const viewerDeniedPayload = await viewerDenied.json() as any;
    const wrongOrg = await postHandoffAction(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_other",
      actionId: "alertReplay",
      idempotencyKey: "case-action-wrong-org"
    });
    const wrongOrgPayload = await wrongOrg.json() as any;

    expect(ownerReplay.status).toBe(201);
    expect(ownerReplayPayload.receipt).toMatchObject({
      schemaVersion: "dwm.case_handoff_action_receipt.v1",
      caseId: "case_alert_acme",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      actionId: "alertReplay",
      actor: "owner@acme.com",
      route: "/v1/dwm/alerts/alert_acme/replay",
      method: "POST",
      idempotencyKey: "case-action-replay-001",
      execution: {
        state: "recorded",
        dryRun: false,
        delegated: true
      },
      provenance: {
        captureIds: ["cap_acme_1"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_1"],
        evidenceCount: 1,
        blockerCodes: []
      }
    });
    expect(ownerReplayPayload.workflowTransition).toMatchObject({
      action: "handoff_alert_replay",
      workflowState: {
        status: "open",
        idempotencyKey: "case-action-replay-001",
        replayState: "recorded"
      },
      provenance: {
        auditEventId: expect.stringMatching(/^case_workflow_audit_/),
        eventId: expect.stringMatching(/^case_event_/)
      }
    });
    expect(duplicateReplay.status).toBe(200);
    expect(duplicateReplayPayload).toMatchObject({
      created: false,
      duplicate: true,
      receipt: {
        id: ownerReplayPayload.receipt.id,
        actionId: "alertReplay",
        idempotencyKey: "case-action-replay-001"
      }
    });
    expect(adminDryRun.status).toBe(201);
    expect(adminDryRunPayload.receipt).toMatchObject({
      actionId: "webhookDryRun",
      actor: "admin@acme.com",
      route: "/v1/dwm/webhooks/deliver",
      method: "POST",
      idempotencyKey: "case-action-webhook-001",
      dedupeKey: "delivery_alert_acme_webhook",
      execution: {
        state: "recorded",
        dryRun: true,
        delegated: true
      }
    });
    expect(memberReplay.status).toBe(201);
    expect(memberReplayPayload.receipt).toMatchObject({
      actionId: "alertReplay",
      actor: "member@acme.com",
      idempotencyKey: "case-action-replay-member"
    });
    expect(viewerDenied.status).toBe(403);
    expect(viewerDeniedPayload.error).toMatchObject({ code: "case_read_only_member" });
    expect(wrongOrg.status).toBe(404);
    expect(wrongOrgPayload.error).toMatchObject({ code: "case_not_found" });

    const saved = (store as any).getCase("case_alert_acme");
    expect(saved.handoffActionReceipts).toHaveLength(3);
    expect(saved.workflowEvents.filter((event: any) => event.action.startsWith("handoff_"))).toHaveLength(3);
    expect((store as any).getDwmAlert("alert_acme").caseId).toBe("case_alert_acme");
    const detail = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_alert_acme?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const detailPayload = await detail.json() as any;
    expect(detail.status).toBe(200);
    expect(detailPayload.handoffActionReceiptContext).toMatchObject({
      receiptCount: 3,
      actionIds: ["alertReplay", "webhookDryRun"],
      route: "/v1/cases/:caseId/handoff-action"
    });
    expect(detailPayload.handoffActionReceipts.map((receipt: any) => receipt.id)).toEqual(expect.arrayContaining([
      ownerReplayPayload.receipt.id,
      adminDryRunPayload.receipt.id,
      memberReplayPayload.receipt.id
    ]));

    const ownerHistory = await getHandoffActions(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme");
    const ownerHistoryPayload = await ownerHistory.json() as any;
    const viewerHistory = await getHandoffActions(options, "case_alert_acme", "viewer@acme.com", "organizationId=org_acme&actionId=webhookDryRun");
    const viewerHistoryPayload = await viewerHistory.json() as any;
    const idempotencyHistory = await getHandoffActions(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme&idempotencyKey=case-action-replay-001");
    const idempotencyHistoryPayload = await idempotencyHistory.json() as any;
    const wrongOrgHistory = await getHandoffActions(options, "case_alert_acme", "owner@acme.com", "organizationId=org_other");
    const wrongOrgHistoryPayload = await wrongOrgHistory.json() as any;

    expect(ownerHistory.status).toBe(200);
    expect(ownerHistoryPayload).toMatchObject({
      schemaVersion: "dwm.case_handoff_action_history.v1",
      caseId: "case_alert_acme",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      summary: {
        receiptCount: 3,
        totalReceiptCount: 3,
        actionIds: expect.arrayContaining(["alertReplay", "webhookDryRun"]),
        latestByAction: {
          webhookDryRun: expect.objectContaining({ idempotencyKey: "case-action-webhook-001" })
        }
      },
      handoffActionReadiness: {
        readyActionIds: ["alertReplay", "webhookDryRun"]
      },
      auditSafety: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false
      }
    });
    expect(["case-action-replay-001", "case-action-replay-member"]).toContain(ownerHistoryPayload.summary.latestByAction.alertReplay.idempotencyKey);
    expect(ownerHistoryPayload.receipts).toHaveLength(3);
    expect(JSON.stringify(ownerHistoryPayload)).not.toContain("rawText");
    expect(viewerHistory.status).toBe(200);
    expect(viewerHistoryPayload).toMatchObject({
      access: {
        role: "viewer",
        readOnly: true
      },
      filters: {
        actionId: "webhookDryRun"
      },
      summary: {
        receiptCount: 1,
        totalReceiptCount: 3
      },
      handoffActionReadiness: {
        readyActionIds: [],
        actions: {
          webhookDryRun: {
            ready: false,
            blockerCodes: ["case_read_only_member"]
          }
        }
      }
    });
    expect(viewerHistoryPayload.receipts).toEqual([expect.objectContaining({ actionId: "webhookDryRun", idempotencyKey: "case-action-webhook-001" })]);
    expect(idempotencyHistory.status).toBe(200);
    expect(idempotencyHistoryPayload.receipts).toEqual([expect.objectContaining({
      actionId: "alertReplay",
      idempotencyKey: "case-action-replay-001",
      provenance: expect.objectContaining({
        captureIds: ["cap_acme_1"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_1"]
      })
    })]);
    expect(wrongOrgHistory.status).toBe(404);
    expect(wrongOrgHistoryPayload.error).toMatchObject({ code: "case_not_found" });

    const replayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme");
    const replayExportPayload = await replayExport.json() as any;
    const filteredReplayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_acme&idempotencyKey=case-action-replay-001");
    const filteredReplayExportPayload = await filteredReplayExport.json() as any;
    const viewerReplayExport = await getActionReplayExport(options, "case_alert_acme", "viewer@acme.com", "organizationId=org_acme&actionId=webhookDryRun");
    const viewerReplayExportPayload = await viewerReplayExport.json() as any;
    store.saveCase({
      ...(store as any).getCase("case_alert_acme"),
      id: "case_alert_unassigned",
      assignedOwner: undefined
    });
    const unassignedReplayExport = await getActionReplayExport(options, "case_alert_unassigned", "owner@acme.com", "organizationId=org_acme");
    const unassignedReplayExportPayload = await unassignedReplayExport.json() as any;
    const wrongOrgReplayExport = await getActionReplayExport(options, "case_alert_acme", "owner@acme.com", "organizationId=org_other");
    const wrongOrgReplayExportPayload = await wrongOrgReplayExport.json() as any;

    expect(replayExport.status).toBe(200);
    expect(replayExportPayload).toMatchObject({
      schemaVersion: "dwm.case_action_replay_export.v1",
      caseId: "case_alert_acme",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      replayPlan: {
        workflowTransitionCount: 4,
        handoffReceiptCount: 3,
        customerNotificationCount: 0,
        auditTimelineRowCount: 7,
        alertReasonReady: true,
        organizationAccessReady: true,
        publicTiHandoffReady: true,
        sourceHandoffReady: true,
        supportRecoveryReady: true,
        replayable: true,
        blockerCodes: []
      },
      alertReasonContext: {
        schemaVersion: "dwm.case_alert_reason_context.v1",
        caseId: "case_alert_acme",
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        alertId: "alert_acme",
        ready: true,
        alert: {
          id: "alert_acme",
          severity: "high",
          confidence: 0.92,
          company: "Acme",
          sourceFamily: "telegram_public",
          dedupeKey: "dwm_alert_acme"
        },
        watchlistMatch: {
          value: "acme.com",
          kind: "domain",
          watchlistIds: ["watch_acme"],
          watchlistItemIds: ["watch_item_acme_domain"],
          matchBasis: "watchlist_capture_text"
        },
        source: {
          sourceFamily: "telegram_public",
          selectedCaptureIds: ["cap_acme_1"],
          evidenceCount: 1,
          evidenceObservedAt: ["2026-06-29T14:01:00.000Z"]
        },
        evidence: [expect.objectContaining({
          id: "ev_acme_1",
          sourceId: "src_acme_tg",
          sourceFamily: "telegram_public",
          observedAt: "2026-06-29T14:01:00.000Z",
          contentHash: "hash_acme_1",
          captureId: "cap_acme_1"
        })],
        provenance: {
          captureIds: ["cap_acme_1"],
          sourceIds: ["src_acme_tg"],
          contentHashes: ["hash_acme_1"],
          sourceFamilies: ["telegram_public"],
          evidenceCount: 1,
          blockers: []
        },
        blockerCodes: [],
        auditSafety: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      },
      organizationAccessReadiness: {
        schemaVersion: "dwm.case_org_access_replay_readiness.v1",
        route: "/v1/cases/case_alert_acme",
        organizationRoute: "/api/organizations/org_acme/members",
        available: true,
        ready: true,
        readyForReview: true,
        readyForMutation: true,
        state: "ready_for_case_actions",
        caseId: "case_alert_acme",
        organizationId: "org_acme",
        alertId: "alert_acme",
        member: {
          memberId: "member_owner",
          role: "owner",
          status: "active",
          readOnly: false
        },
        visibility: {
          allowed: true,
          reason: null,
          alertVisibilityPolicy: "members",
          allowedRoles: ["owner", "admin", "analyst", "member", "viewer"]
        },
        noEnumeration: true,
        blockerCodes: []
      },
      publicTiHandoffReadiness: {
        schemaVersion: "dwm.case_public_ti_handoff_replay_readiness.v1",
        route: "/api/ti/search",
        publicRoute: "/ti/acme.com",
        available: true,
        ready: true,
        redacted: true,
        caseId: "case_alert_acme",
        organizationId: "org_acme",
        alertId: "alert_acme",
        query: "acme.com",
        sourceFamily: "telegram_public",
        alertGenerationRefCount: 1,
        stableFields: ["sourceFamily", "provenanceCaptureIds", "alertGenerationRefCount"],
        gapFields: ["state", "provenanceGapCodes"],
        provenance: {
          captureIds: ["cap_acme_1"],
          sourceIds: ["src_acme_tg"],
          selectedCaptureIds: ["cap_acme_1"],
          evidenceCount: 1
        },
        blockerCodes: []
      },
      sourceHandoffReadiness: {
        schemaVersion: "dwm.case_source_handoff_replay_readiness.v1",
        sourceSchemaVersion: "dwm.alert_source_handoff_readiness.v1",
        available: true,
        ready: true,
        state: "ready_for_consumers",
        sourceFamily: "telegram_public",
        selectedCaptureIds: ["cap_acme_1"],
        evidenceCount: 1,
        provenanceCaptureIds: ["cap_acme_1"],
        provenanceSourceIds: ["src_acme_tg"],
        provenanceGapCodes: [],
        blockerCodes: [],
        consumers: {
          case: {
            ready: true,
            casePath: "/v1/cases/case_alert_acme?alertId=alert_acme"
          },
          webhook: {
            ready: true,
            selectedWebhookDestinationId: "webhook_acme_discord",
            deliveryDedupeKey: "delivery_alert_acme_webhook",
            blockerCodes: []
          },
          publicTi: {
            ready: true,
            redacted: true,
            alertGenerationRefCount: 1,
            sourceFamily: "telegram_public"
          }
        }
      },
      supportRecoveryReadiness: {
        schemaVersion: "dwm.case_support_recovery_readiness.v1",
        route: "/api/admin/support/readiness",
        recoveryRoute: "/api/admin/support/organizations/org_acme/access-recovery",
        method: "POST",
        available: true,
        ready: true,
        state: "ready_for_support_review",
        caseId: "case_alert_acme",
        organizationId: "org_acme",
        alertId: "alert_acme",
        assignedOwner: "owner@acme.com",
        workflowStatus: "open",
        source: {
          sourceFamily: "telegram_public",
          selectedCaptureIds: ["cap_acme_1"],
          provenanceCaptureIds: ["cap_acme_1"],
          provenanceSourceIds: ["src_acme_tg"],
          contentHashes: ["hash_acme_1"],
          evidenceCount: 1
        },
        webhook: {
          readyForReplay: true,
          receiptAvailable: false,
          destinationIds: ["webhook_acme_discord"]
        },
        requiredFields: ["organizationId", "caseId", "alertId", "assignedOwner", "audit.reason", "idempotencyKey"],
        blockerCodes: []
      },
      provenance: {
        captureIds: ["cap_acme_1"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_1"],
        evidenceCount: 1
      },
      auditSafety: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false
      }
    });
    expect(replayExportPayload.workflowTransitions.map((transition: any) => transition.action)).toEqual([
      "open",
      "handoff_alert_replay",
      "handoff_webhook_dry_run",
      "handoff_alert_replay"
    ]);
    expect(replayExportPayload.auditTimeline).toMatchObject({
      schemaVersion: "dwm.case_replay_audit_timeline.v1",
      caseId: "case_alert_acme",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      summary: {
        rowCount: 7,
        workflowTransitionCount: 4,
        handoffReceiptCount: 3,
        customerNotificationCount: 0,
        actions: expect.arrayContaining(["open", "handoff_alert_replay", "handoff_webhook_dry_run", "alertReplay", "webhookDryRun"]),
        rowTypes: expect.arrayContaining(["workflow_transition", "handoff_action_receipt"])
      },
      auditSafety: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false
      }
    });
    expect(replayExportPayload.auditTimeline.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rowType: "workflow_transition",
        action: "open",
        actor: "case-api",
        rationale: "Open case for action receipt testing.",
        workflow: expect.objectContaining({
          toStatus: "open",
          currentStatus: "open",
          currentOwner: "owner@acme.com"
        }),
        replay: expect.objectContaining({
          idempotencyKey: "alert-case-handoff-receipt",
          workflowEventId: expect.stringMatching(/^case_event_/)
        })
      }),
      expect.objectContaining({
        rowType: "handoff_action_receipt",
        action: "alertReplay",
        actor: "owner@acme.com",
        handoffAction: expect.objectContaining({
          receiptId: ownerReplayPayload.receipt.id,
          route: "/v1/dwm/alerts/alert_acme/replay",
          method: "POST"
        }),
        replay: expect.objectContaining({
          idempotencyKey: "case-action-replay-001",
          auditEventId: expect.stringMatching(/^case_workflow_audit_/),
          workflowEventId: expect.stringMatching(/^case_event_/)
        }),
        provenance: expect.objectContaining({
          captureIds: ["cap_acme_1"],
          sourceIds: ["src_acme_tg"],
          contentHashes: ["hash_acme_1"],
          evidenceCount: 1
        })
      }),
      expect.objectContaining({
        rowType: "handoff_action_receipt",
        action: "webhookDryRun",
        actor: "admin@acme.com",
        replay: expect.objectContaining({
          idempotencyKey: "case-action-webhook-001",
          dedupeKey: "delivery_alert_acme_webhook"
        })
      })
    ]));
    expect(replayExportPayload.handoffActionHistory.receipts).toHaveLength(3);
    expect(replayExportPayload.nextAnalystActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "review_org_access", ownerLane: "org", ready: true, blocked: false }),
      expect.objectContaining({ id: "review_source_handoff", ownerLane: "source", ready: true, blocked: false }),
      expect.objectContaining({ id: "review_public_ti_handoff", ownerLane: "publicTI", ready: true, blocked: false, publicRoute: "/ti/acme.com" }),
      expect.objectContaining({ id: "replay_alert", ownerLane: "alert", ready: true, blocked: false }),
      expect.objectContaining({ id: "test_webhook_delivery", ownerLane: "webhook", ready: true, blocked: false }),
      expect.objectContaining({ id: "record_customer_notification", ownerLane: "case", ready: false, blocked: true, blockerCodes: ["missing_delivered_webhook"] }),
      expect.objectContaining({ id: "verify_support_recovery", ownerLane: "support", ready: true, blocked: false })
    ]));
    expect(JSON.stringify(replayExportPayload)).not.toContain("rawText");
    expect(filteredReplayExport.status).toBe(200);
    expect(filteredReplayExportPayload).toMatchObject({
      filters: {
        idempotencyKey: "case-action-replay-001"
      },
      replayPlan: {
        workflowTransitionCount: 1,
        workflowTransitionHistoryReady: true,
        handoffReceiptCount: 1,
        auditTimelineRowCount: 2
      }
    });
    expect(filteredReplayExportPayload.workflowTransitions[0]).toMatchObject({
      action: "handoff_alert_replay",
      workflowState: {
        idempotencyKey: "case-action-replay-001"
      }
    });
    expect(filteredReplayExportPayload.auditTimeline).toMatchObject({
      filters: {
        idempotencyKey: "case-action-replay-001"
      },
      summary: {
        rowCount: 2,
        workflowTransitionCount: 1,
        handoffReceiptCount: 1,
        customerNotificationCount: 0
      }
    });
    expect(filteredReplayExportPayload.auditTimeline.rows.map((row: any) => row.rowType)).toEqual(expect.arrayContaining([
      "workflow_transition",
      "handoff_action_receipt"
    ]));
    expect(viewerReplayExport.status).toBe(200);
    expect(viewerReplayExportPayload).toMatchObject({
      access: {
        role: "viewer",
        readOnly: true
      },
      filters: {
        actionId: "webhookDryRun"
      },
      replayPlan: {
        handoffReceiptCount: 1,
        replayable: false,
        blockerCodes: ["case_read_only_member"]
      },
      organizationAccessReadiness: {
        ready: false,
        readyForReview: true,
        readyForMutation: false,
        state: "read_only",
        member: {
          memberId: "member_viewer",
          role: "viewer",
          status: "active",
          readOnly: true
        },
        blockerCodes: ["case_read_only_member"]
      },
      handoffActionReadiness: {
        readyActionIds: [],
        actions: {
          webhookDryRun: {
            ready: false,
            blockerCodes: ["case_read_only_member"]
          }
        }
      },
      supportRecoveryReadiness: {
        ready: false,
        blockerCodes: ["case_read_only_member"]
      }
    });
    expect(viewerReplayExportPayload.nextAnalystActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "review_org_access", ownerLane: "org", ready: false, blocked: true, blockerCodes: ["case_read_only_member"] }),
      expect.objectContaining({ id: "verify_support_recovery", ownerLane: "support", ready: false, blocked: true, blockerCodes: ["case_read_only_member"] })
    ]));
    expect(unassignedReplayExport.status).toBe(200);
    expect(unassignedReplayExportPayload.workflowTransitions.map((transition: any) => transition.action)).toEqual([
      "open",
      "handoff_alert_replay",
      "handoff_webhook_dry_run",
      "handoff_alert_replay"
    ]);
    expect(unassignedReplayExportPayload).toMatchObject({
      caseId: "case_alert_unassigned",
      replayPlan: {
        supportRecoveryReady: false,
        workflowTransitionHistoryReady: true,
        workflowTransitionCount: 4
      },
      supportRecoveryReadiness: {
        ready: false,
        blockerCodes: ["missing_case_owner"]
      }
    });
    expect(wrongOrgReplayExport.status).toBe(404);
    expect(wrongOrgReplayExportPayload.error).toMatchObject({ code: "case_not_found" });
  });

  test("blocks handoff action receipts for missing alert, missing destination, and unsupported actions", async () => {
    const { options, store } = fixtureRuntime();
    await postHandoff(options, "alert_acme", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open case for receipt blockers.",
      idempotencyKey: "alert-case-handoff-blockers"
    });
    store.saveCase({
      ...(store as any).getCase("case_alert_acme"),
      id: "case_missing_alert",
      alertId: "alert_missing",
      sourceId: "alert_missing",
      workflowEvents: []
    });
    store.saveDwmAlert({
      ...provenancedAlert(),
      id: "alert_no_destination",
      caseIdCandidate: "case_alert_no_destination",
      casePath: "/v1/cases/case_alert_no_destination?alertId=alert_no_destination",
      workflowContext: {
        ...provenancedAlert().workflowContext,
        caseIdCandidate: "case_alert_no_destination",
        casePath: "/v1/cases/case_alert_no_destination?alertId=alert_no_destination",
        webhookDestinationIds: []
      },
      webhookContext: undefined,
      deliveryReadinessContext: undefined
    });
    await postHandoff(options, "alert_no_destination", {
      organizationId: "org_acme",
      assignedOwner: "owner@acme.com",
      note: "Open no-destination case.",
      idempotencyKey: "alert-case-handoff-no-destination"
    });

    const missingAlert = await postHandoffAction(options, "case_missing_alert", "owner@acme.com", {
      organizationId: "org_acme",
      actionId: "alertReplay",
      idempotencyKey: "case-action-missing-alert"
    });
    const missingAlertPayload = await missingAlert.json() as any;
    const missingDestination = await postHandoffAction(options, "case_alert_no_destination", "owner@acme.com", {
      organizationId: "org_acme",
      actionId: "webhookDryRun",
      idempotencyKey: "case-action-missing-destination"
    });
    const missingDestinationPayload = await missingDestination.json() as any;
    const unsupported = await postHandoffAction(options, "case_alert_acme", "owner@acme.com", {
      organizationId: "org_acme",
      actionId: "sendEverything",
      idempotencyKey: "case-action-unsupported"
    });
    const unsupportedPayload = await unsupported.json() as any;

    expect(missingAlert.status).toBe(409);
    expect(missingAlertPayload.error).toMatchObject({ code: "missing_case_alert" });
    expect(missingDestination.status).toBe(409);
    expect(missingDestinationPayload).toMatchObject({
      error: { code: "handoff_action_not_ready" },
      actionId: "webhookDryRun",
      blockerCodes: ["missing_webhook_destination"],
      handoffActionReadiness: {
        readyActionIds: ["alertReplay"],
        actions: {
          webhookDryRun: {
            ready: false,
            blockerCodes: ["missing_webhook_destination"]
          }
        }
      }
    });
    expect(unsupported.status).toBe(400);
    expect(unsupportedPayload.error).toMatchObject({ code: "unsupported_handoff_action" });
    expect((store as any).getCase("case_alert_no_destination").handoffActionReceipts ?? []).toEqual([]);
    store.saveCase({
      ...(store as any).getCase("case_alert_acme"),
      id: "case_no_org_scope",
      tenantId: "default",
      organizationId: undefined,
      alertId: "alert_missing",
      sourceId: "alert_missing",
      assignedOwner: "owner@acme.com",
      workflowEvents: []
    });
    const noOrgReplayExport = await getActionReplayExport(options, "case_no_org_scope", "owner@acme.com", "tenantId=default");
    const noOrgReplayExportPayload = await noOrgReplayExport.json() as any;
    const missingAlertReplayExport = await getActionReplayExport(options, "case_missing_alert", "owner@acme.com", "organizationId=org_acme");
    const missingAlertReplayExportPayload = await missingAlertReplayExport.json() as any;
    expect(noOrgReplayExport.status).toBe(200);
    expect(noOrgReplayExportPayload).toMatchObject({
      caseId: "case_no_org_scope",
      organizationAccessReadiness: {
        available: false,
        ready: false,
        readyForReview: true,
        readyForMutation: false,
        state: "missing_organization_scope",
        blockerCodes: ["missing_organization_scope"]
      },
      replayPlan: {
        organizationAccessReady: false,
        workflowTransitionCount: 0
      }
    });
    expect(missingAlertReplayExport.status).toBe(200);
    expect(missingAlertReplayExportPayload).toMatchObject({
      schemaVersion: "dwm.case_action_replay_export.v1",
      caseId: "case_missing_alert",
      alertId: "alert_missing",
      sourceHandoffReadiness: {
        available: false,
        ready: false,
        state: "missing_source_handoff_readiness",
        blockerCodes: ["missing_alert_source_handoff_readiness"]
      },
      replayPlan: {
        organizationAccessReady: true,
        alertReasonReady: false,
        publicTiHandoffReady: false,
        sourceHandoffReady: false,
        supportRecoveryReady: false,
        replayable: false,
        blockerCodes: ["missing_case_alert"]
      },
      publicTiHandoffReadiness: {
        available: false,
        ready: false,
        publicRoute: "/ti",
        blockerCodes: ["missing_alert_source_handoff_readiness", "public_ti_handoff_not_ready"]
      },
      alertReasonContext: {
        ready: false,
        caseId: "case_missing_alert",
        alertId: "alert_missing",
        evidence: [],
        provenance: {
          captureIds: [],
          sourceIds: [],
          contentHashes: [],
          evidenceCount: 0
        },
        blockerCodes: expect.arrayContaining(["missing_case_alert", "missing_watchlist_match", "missing_watchlist_id", "missing_source_evidence", "missing_alert_source_handoff_readiness"])
      },
      supportRecoveryReadiness: {
        ready: false,
        state: "blocked",
        blockerCodes: ["missing_case_alert", "missing_alert_source_handoff_readiness"]
      },
      provenance: {
        captureIds: [],
        sourceIds: [],
        contentHashes: [],
        evidenceCount: 0
      }
    });
    expect(missingAlertReplayExportPayload.handoffActionReadiness).toBeUndefined();
  });

  test("blocks missing provenance, wrong org, and read-only members", async () => {
    const { options, store } = fixtureRuntime();
    store.saveDwmAlert({
      ...provenancedAlert(),
      id: "alert_no_provenance",
      evidence: [],
      workflowContext: undefined,
      provenance: undefined
    });

    const missingProvenance = await postHandoff(options, "alert_no_provenance", {
      organizationId: "org_acme",
      note: "Should not open without provenance."
    });
    const missingPayload = await missingProvenance.json() as any;
    const wrongOrg = await postHandoff(options, "alert_acme", {
      organizationId: "org_other",
      note: "Wrong organization should not see this alert."
    });
    const wrongOrgPayload = await wrongOrg.json() as any;
    const viewer = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/alert_acme/case-handoff", {
      method: "POST",
      headers: { "x-user-email": "viewer@acme.com" },
      body: JSON.stringify({ organizationId: "org_acme", note: "Viewer cannot open cases." })
    }), options);
    const viewerPayload = await viewer.json() as any;
    const missingCase = await handleApiRequest(new Request("http://127.0.0.1/v1/cases/case_missing?organizationId=org_acme", {
      headers: { "x-user-email": "owner@acme.com" }
    }), options);
    const missingCasePayload = await missingCase.json() as any;

    expect(missingProvenance.status).toBe(409);
    expect(missingPayload.error).toMatchObject({ code: "missing_alert_provenance" });
    expect(missingPayload.blockers.map((blocker: any) => blocker.code)).toEqual(expect.arrayContaining(["missing_capture_provenance", "missing_source_provenance", "missing_content_hash"]));
    expect(wrongOrg.status).toBe(404);
    expect(wrongOrgPayload.error).toMatchObject({ code: "alert_not_found" });
    expect(viewer.status).toBe(403);
    expect(viewerPayload.error).toMatchObject({ code: "case_read_only_member" });
    expect(missingCase.status).toBe(404);
    expect(missingCasePayload.error).toMatchObject({ code: "case_not_found" });
    expect((store as any).listCases()).toEqual([]);
  });
});

async function postHandoff(options: ReturnType<typeof fixtureRuntime>["options"], alertId: string, body: Record<string, unknown>) {
  return handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alertId}/case-handoff`, {
    method: "POST",
    headers: { "x-user-email": "owner@acme.com" },
    body: JSON.stringify(body)
  }), options);
}

async function postHandoffAction(options: ReturnType<typeof fixtureRuntime>["options"], caseId: string, email: string, body: Record<string, unknown>) {
  return handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${caseId}/handoff-action`, {
    method: "POST",
    headers: { "x-user-email": email },
    body: JSON.stringify(body)
  }), options);
}

async function postCustomerNotification(options: ReturnType<typeof fixtureRuntime>["options"], caseId: string, email: string, body: Record<string, unknown>) {
  return handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${caseId}/customer-notification`, {
    method: "POST",
    headers: { "x-user-email": email },
    body: JSON.stringify(body)
  }), options);
}

async function patchCase(options: ReturnType<typeof fixtureRuntime>["options"], caseId: string, email: string, body: Record<string, unknown>) {
  return handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${caseId}`, {
    method: "PATCH",
    headers: { "x-user-email": email },
    body: JSON.stringify(body)
  }), options);
}

async function getHandoffActions(options: ReturnType<typeof fixtureRuntime>["options"], caseId: string, email: string, query: string) {
  return handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${caseId}/handoff-actions?${query}`, {
    headers: { "x-user-email": email }
  }), options);
}

async function getActionReplayExport(options: ReturnType<typeof fixtureRuntime>["options"], caseId: string, email: string, query: string) {
  return handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${caseId}/action-replay-export?${query}`, {
    headers: { "x-user-email": email }
  }), options);
}

function fixtureRuntime() {
  const store = new InMemoryScraperStore();
  store.saveOrganization({ id: "org_acme", tenantId: "tenant_acme", name: "Acme", slug: "acme", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganization({ id: "org_other", tenantId: "tenant_other", name: "Other", slug: "other", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_owner", organizationId: "org_acme", email: "owner@acme.com", role: "owner", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_admin", organizationId: "org_acme", email: "admin@acme.com", role: "admin", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_member", organizationId: "org_acme", email: "member@acme.com", role: "member", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_viewer", organizationId: "org_acme", email: "viewer@acme.com", role: "viewer", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveDwmAlert(provenancedAlert());
  return { store, options: { store, frontier: new FocusedFrontier() } };
}

function provenancedAlert() {
  return {
    id: "alert_acme",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    severity: "high",
    confidence: 0.92,
    company: "Acme",
    matchedTerm: { value: "acme.com", kind: "domain" },
    dedupeKey: "dwm_alert_acme",
    caseIdCandidate: "case_alert_acme",
    casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
    recommendedRoute: "case",
    workflowContext: {
      organizationId: "org_acme",
      caseIdCandidate: "case_alert_acme",
      casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_acme_1"],
      sourceIds: ["src_acme_tg"],
      evidenceCount: 1,
      webhookDestinationIds: ["webhook_acme_discord"]
    },
    webhookContext: {
      organizationId: "org_acme",
      webhookDestinationIds: ["webhook_acme_discord"],
      captureIds: ["cap_acme_1"],
      sourceIds: ["src_acme_tg"],
      evidenceCount: 1
    },
    deliveryReadinessContext: {
      webhookDestinationIds: ["webhook_acme_discord"],
      deliveryDedupeKey: "delivery_alert_acme_webhook"
    },
    sourceHandoffReadiness: {
      schemaVersion: "dwm.alert_source_handoff_readiness.v1",
      ready: true,
      state: "ready_for_consumers",
      sourceFamily: "telegram_public",
      selectedCaptureIds: ["cap_acme_1"],
      evidenceCount: 1,
      provenanceCaptureIds: ["cap_acme_1"],
      provenanceSourceIds: ["src_acme_tg"],
      provenanceGapCodes: [],
      webhookConsumer: {
        ready: true,
        deliveryReady: true,
        delivered: false,
        deliveryDedupeKey: "delivery_alert_acme_webhook",
        selectedWebhookDestinationId: "webhook_acme_discord",
        webhookDestinationIds: ["webhook_acme_discord"],
        createdEventDispatchReady: true,
        deliveryHistoryRefs: [],
        blockerCodes: []
      },
      caseConsumer: {
        ready: true,
        caseIdCandidate: "case_alert_acme",
        caseId: "case_alert_acme",
        casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
        idempotencyKey: "alert-case-handoff-source-ready",
        blockerCodes: []
      },
      publicTiConsumer: {
        ready: true,
        redacted: true,
        alertGenerationRefCount: 1,
        sourceFamily: "telegram_public",
        stableFields: ["sourceFamily", "provenanceCaptureIds", "alertGenerationRefCount"],
        gapFields: ["state", "provenanceGapCodes"]
      },
      stableFields: ["sourceFamily", "selectedCaptureIds", "provenanceCaptureIds", "webhookConsumer.selectedWebhookDestinationId", "caseConsumer.casePath"],
      gapFields: ["state", "provenanceGapCodes", "webhookConsumer.blockerCodes", "caseConsumer.blockerCodes"]
    },
    watchlistIds: ["watch_acme"],
    watchlistItemIds: ["watch_item_acme_domain"],
    workflowEvents: [{
      id: "alert_event_created",
      at: "2026-06-29T14:01:00.000Z",
      action: "created"
    }],
    evidence: [{
      id: "ev_acme_1",
      sourceId: "src_acme_tg",
      sourceFamily: "telegram_public",
      observedAt: "2026-06-29T14:01:00.000Z",
      contentHash: "hash_acme_1",
      provenance: { captureId: "cap_acme_1", sourceId: "src_acme_tg" }
    }],
    provenance: {
      matchBasis: "watchlist_capture_text",
      captureIds: ["cap_acme_1"],
      sourceIds: ["src_acme_tg"],
      contentHashes: ["hash_acme_1"],
      sourceFamilies: ["telegram_public"],
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"]
    }
  };
}
