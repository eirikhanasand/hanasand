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

function fixtureRuntime() {
  const store = new InMemoryScraperStore();
  store.saveOrganization({ id: "org_acme", tenantId: "tenant_acme", name: "Acme", slug: "acme", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganization({ id: "org_other", tenantId: "tenant_other", name: "Other", slug: "other", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
  store.saveOrganizationMember({ id: "member_owner", organizationId: "org_acme", email: "owner@acme.com", role: "owner", status: "active", createdAt: "2026-06-29T14:00:00.000Z", updatedAt: "2026-06-29T14:00:00.000Z" });
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
