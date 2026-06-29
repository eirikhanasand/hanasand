import { describe, expect, test } from "bun:test";
import {
  DWM_ORG_ALERT_CASE_ACTION_PACKET_SCHEMA_VERSION,
  DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION,
  DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION,
  DWM_ORG_ALERT_WEBHOOK_RECONCILIATION_SCHEMA_VERSION,
  DWM_ORG_ALERT_OPERATOR_READINESS_SCHEMA_VERSION,
  DWM_ORG_ALERT_SOURCE_EVIDENCE_SCHEMA_VERSION,
  DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION,
  buildOrgAlertCaseActionPacket,
  buildOrgAlertOperatorReadinessPacket,
  buildOrgAlertWebhookFixtureContract,
  buildOrgAlertSourceEvidenceReport,
  buildOrgAlertWorkflowBridgeReport,
  reconcileOrgAlertWebhookDeliveries
} from "../product/orgAlertWorkflowBridge.ts";
import fixture from "./fixtures/org-alert-workflow-bridge-happy.json";

describe("org alert workflow bridge", () => {
  test("connects org watchlist rows to preserved alert case workflow", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [watchlistFixture()],
      previousAlerts: [alertFixture()],
      alerts: [{
        ...alertFixture(),
        workflowContext: {
          ...alertFixture().workflowContext,
          captureIds: ["cap_acme_initial", "cap_acme_followup"],
          evidenceCount: 2
        },
        provenance: { captureIds: ["cap_acme_initial", "cap_acme_followup"] },
        evidence: [...alertFixture().evidence, {
          id: "evidence_acme_followup",
          sourceId: "src_acme_forum",
          contentHash: "hash_acme_followup",
          sourceFamily: "darkweb_metadata"
        }]
      }],
      checkedAt: "2026-06-29T14:00:00.000Z"
    });

    expect(report).toMatchObject({
      schemaVersion: DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      blockers: [],
      rows: [{
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        normalizedTerm: "acme.com",
        alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_com:domain:acme.com",
        matchedAlertIds: ["alert_acme_lumma"],
        alertDetailPaths: ["/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma"],
        casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        workflowEventCount: 2,
        eventPayloads: [{
          schemaVersion: "dwm.org_alert_workflow_event_payload.v1",
          alertId: "alert_acme_lumma",
          organizationId: "org_acme",
          tenantId: "tenant_acme",
          watchlistId: "watch_acme_domains",
          watchlistItemId: "watch_item_acme_com",
          alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_com:domain:acme.com",
          alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
          sourceFamilies: ["telegram_public", "darkweb_metadata"],
          captureIds: ["cap_acme_initial", "cap_acme_followup"],
          evidenceCount: 2,
          workflowEventCount: 2,
          dedupeKey: "dedupe_acme_lumma"
        }],
        ready: true,
        blockerCodes: []
      }]
    });
    expect(report.rows[0].provenance).toEqual({
      evidenceCount: 2,
      captureIds: ["cap_acme_initial", "cap_acme_followup"],
      sourceIds: ["src_acme_tg", "src_acme_forum"],
      contentHashes: ["hash_acme_initial", "hash_acme_followup"]
    });
  });

  test("validates checked-in bridge fixture", () => {
    const report = buildOrgAlertWorkflowBridgeReport(fixture as any);
    expect(report.ok).toBe(true);
    expect(report.rows[0]).toMatchObject({
      watchlistItemId: "watch_item_acme_com",
      matchedAlertIds: ["alert_acme_lumma"],
      ready: true
    });
  });

  test("builds a scoped webhook fixture from org alert workflow rows", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const contract = buildOrgAlertWebhookFixtureContract({
      bridge,
      destinations: [webhookDestination()],
      destinationIdsByWatchlistId: {
        watch_acme_domains: ["webhook_discord"]
      }
    });

    expect(contract).toMatchObject({
      schemaVersion: DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      blockers: [],
      deliveries: [{
        alertId: "alert_acme_lumma",
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        ready: true,
        blockerCodes: [],
        destinationIds: ["webhook_discord"],
        destinationKinds: ["discord"],
        payload: {
          schemaVersion: DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION,
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          alertId: "alert_acme_lumma",
          watchlistId: "watch_acme_domains",
          watchlistItemId: "watch_item_acme_com",
          webhookDestinationIds: ["webhook_discord"],
          deliveryKind: "discord",
          alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
          casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
          sourceFamilies: ["telegram_public", "darkweb_metadata"],
          captureIds: ["cap_acme_initial", "cap_acme_followup"],
          evidenceCount: 2,
          workflowEventCount: 2
        }
      }]
    });
    expect(contract.deliveries[0].payload.idempotencyKey).toMatch(/^org_alert_webhook_idempotency_/);
    expect(JSON.stringify(contract)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(contract)).not.toContain("https://discord.com");
  });

  test("reconciles planned webhook fixture delivery with delivered attempts", () => {
    const fixtureContract = happyWebhookFixtureContract();
    const reconciliation = reconcileOrgAlertWebhookDeliveries({
      fixture: fixtureContract,
      attempts: [webhookAttemptFixture(fixtureContract.deliveries[0].payload.idempotencyKey)],
      checkedAt: "2026-06-29T14:30:00.000Z"
    });

    expect(reconciliation).toMatchObject({
      schemaVersion: DWM_ORG_ALERT_WEBHOOK_RECONCILIATION_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      blockers: [],
      rows: [{
        alertId: "alert_acme_lumma",
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        destinationIds: ["webhook_discord"],
        matchedDeliveryIds: ["delivery_acme_lumma"],
        status: "delivered",
        ready: true,
        blockerCodes: [],
        audit: {
          redacted: true,
          idempotencyKey: fixtureContract.deliveries[0].payload.idempotencyKey,
          payloadHash: "payload_hash_acme",
          endpointHashes: ["endpoint_hash_acme"],
          attemptedAt: ["2026-06-29T14:25:00.000Z"]
        }
      }]
    });
    expect(JSON.stringify(reconciliation)).not.toContain("https://discord.com");
  });

  test("builds one operator readiness packet for alert source and webhook workflow", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const sourceEvidence = buildOrgAlertSourceEvidenceReport({
      bridge,
      sources: sourceRefs(),
      captures: [],
      sourceProvenanceSummaries: [sourceProvenanceSummary()],
      checkedAt: "2026-06-29T15:00:00.000Z"
    });
    const webhookFixture = buildOrgAlertWebhookFixtureContract({
      bridge,
      destinations: [webhookDestination()],
      destinationIdsByWatchlistId: { watch_acme_domains: ["webhook_discord"] }
    });
    const webhookReconciliation = reconcileOrgAlertWebhookDeliveries({
      fixture: webhookFixture,
      attempts: [webhookAttemptFixture(webhookFixture.deliveries[0].payload.idempotencyKey)],
      checkedAt: "2026-06-29T15:01:00.000Z"
    });
    const packet = buildOrgAlertOperatorReadinessPacket({
      bridge,
      sourceEvidence,
      webhookFixture,
      webhookReconciliation,
      requireWebhookReconciliation: true
    });

    expect(packet).toMatchObject({
      schemaVersion: DWM_ORG_ALERT_OPERATOR_READINESS_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      blockers: [],
      requiredReports: {
        sourceEvidence: true,
        webhookFixture: true,
        webhookReconciliation: true
      },
      rows: [{
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        alertIds: ["alert_acme_lumma"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        captureIds: ["cap_acme_initial", "cap_acme_followup"],
        webhookDestinationIds: ["webhook_discord"],
        matchedDeliveryIds: ["delivery_acme_lumma"],
        stages: {
          workflowBridge: true,
          sourceEvidence: true,
          webhookFixture: true,
          webhookReconciliation: true
        },
        ready: true,
        blockerCodes: []
      }]
    });
  });

  test("includes source provenance rebuild receipt proof in operator readiness", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const sourceEvidence = buildOrgAlertSourceEvidenceReport({
      bridge,
      sources: sourceRefs(),
      captures: [],
      sourceProvenanceSummaries: [sourceProvenanceSummary()],
      checkedAt: "2026-06-29T15:00:00.000Z"
    });
    const webhookFixture = buildOrgAlertWebhookFixtureContract({
      bridge,
      destinations: [webhookDestination()],
      destinationIdsByWatchlistId: { watch_acme_domains: ["webhook_discord"] }
    });
    const packet = buildOrgAlertOperatorReadinessPacket({
      bridge,
      sourceEvidence,
      sourceRebuildReceipts: [sourceRebuildReceipt()],
      webhookFixture,
      requireSourceRebuildReceipt: true
    });

    expect(packet).toMatchObject({
      ok: true,
      requiredReports: {
        sourceEvidence: true,
        sourceRebuildReceipt: true,
        webhookFixture: true,
        webhookReconciliation: false
      },
      rows: [{
        alertIds: ["alert_acme_lumma"],
        sourceRebuildReceiptIds: ["receipt_source_rebuild_acme_lumma"],
        stages: {
          workflowBridge: true,
          sourceEvidence: true,
          sourceRebuildReceipt: true,
          webhookFixture: true,
          webhookReconciliation: "not_required"
        },
        ready: true,
        blockerCodes: []
      }]
    });
  });

  test("builds case action packet from ready operator workflow", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const sourceEvidence = buildOrgAlertSourceEvidenceReport({
      bridge,
      sources: sourceRefs(),
      captures: [],
      sourceProvenanceSummaries: [sourceProvenanceSummary()],
      checkedAt: "2026-06-29T15:00:00.000Z"
    });
    const webhookFixture = buildOrgAlertWebhookFixtureContract({
      bridge,
      destinations: [webhookDestination()],
      destinationIdsByWatchlistId: { watch_acme_domains: ["webhook_discord"] }
    });
    const webhookReconciliation = reconcileOrgAlertWebhookDeliveries({
      fixture: webhookFixture,
      attempts: [webhookAttemptFixture(webhookFixture.deliveries[0].payload.idempotencyKey)],
      checkedAt: "2026-06-29T15:01:00.000Z"
    });
    const readiness = buildOrgAlertOperatorReadinessPacket({
      bridge,
      sourceEvidence,
      webhookFixture,
      webhookReconciliation,
      requireWebhookReconciliation: true
    });
    const packet = buildOrgAlertCaseActionPacket({ readiness, checkedAt: "2026-06-29T15:03:00.000Z" });

    expect(packet).toMatchObject({
      schemaVersion: DWM_ORG_ALERT_CASE_ACTION_PACKET_SCHEMA_VERSION,
      checkedAt: "2026-06-29T15:03:00.000Z",
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      blockers: [],
      rows: [{
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        alertIds: ["alert_acme_lumma"],
        casePaths: ["/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"],
        alertDetailPaths: ["/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma"],
        webhookDestinationIds: ["webhook_discord"],
        matchedDeliveryIds: ["delivery_acme_lumma"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        captureCount: 2,
        ready: true,
        blockedActions: []
      }]
    });
    expect(packet.rows[0].allowedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "open_case",
        ownerLane: "case",
        route: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
        method: "GET"
      }),
      expect.objectContaining({
        action: "review_alert",
        ownerLane: "alert",
        route: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
        method: "GET"
      }),
      expect.objectContaining({
        action: "review_delivery",
        ownerLane: "webhook",
        route: "/v1/dwm/webhook-deliveries/delivery_acme_lumma",
        method: "GET"
      })
    ]));
    expect(packet.payloadShape).toEqual(expect.arrayContaining(["rows[].allowedActions", "rows[].blockedActions", "blockers[]"]));
    expect(JSON.stringify(packet)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(packet)).not.toContain("https://discord.com");
  });

  test("requires source rebuild receipts when operator readiness depends on alert creation proof", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const packet = buildOrgAlertOperatorReadinessPacket({
      bridge,
      requireSourceEvidence: false,
      requireWebhookFixture: false,
      requireSourceRebuildReceipt: true,
      checkedAt: "2026-06-29T15:03:00.000Z"
    });

    expect(packet.ok).toBe(false);
    expect(packet.rows[0]).toMatchObject({
      sourceRebuildReceiptIds: [],
      stages: {
        sourceEvidence: true,
        sourceRebuildReceipt: false,
        webhookFixture: true,
        webhookReconciliation: "not_required"
      },
      ready: false,
      blockerCodes: ["missing_source_rebuild_receipt_report"]
    });
    expect(packet.blockers).toEqual([
      expect.objectContaining({
        code: "missing_source_rebuild_receipt_report",
        ownerLane: "alert",
        stage: "source_rebuild_receipt",
        watchlistItemId: "watch_item_acme_com"
      })
    ]);
  });

  test("keeps missing operator readiness reports as owner-coded blockers", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const packet = buildOrgAlertOperatorReadinessPacket({
      bridge,
      requireWebhookReconciliation: true,
      checkedAt: "2026-06-29T15:02:00.000Z"
    });

    expect(packet.ok).toBe(false);
    expect(packet.rows[0]).toMatchObject({
      watchlistItemId: "watch_item_acme_com",
      stages: {
        workflowBridge: true,
        sourceEvidence: false,
        webhookFixture: false,
        webhookReconciliation: false
      },
      ready: false,
      blockerCodes: expect.arrayContaining([
        "missing_source_evidence_report",
        "missing_webhook_fixture_report",
        "missing_webhook_reconciliation_report"
      ])
    });
    expect(packet.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_source_evidence_report", ownerLane: "source", stage: "source_evidence" }),
      expect.objectContaining({ code: "missing_webhook_fixture_report", ownerLane: "webhook", stage: "webhook_fixture" }),
      expect.objectContaining({ code: "missing_webhook_reconciliation_report", ownerLane: "webhook", stage: "webhook_reconciliation" })
    ]));
  });

  test("maps blocked operator readiness into case source webhook repair actions", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const readiness = buildOrgAlertOperatorReadinessPacket({
      bridge,
      requireWebhookReconciliation: true,
      checkedAt: "2026-06-29T15:02:00.000Z"
    });
    const packet = buildOrgAlertCaseActionPacket({ readiness });

    expect(packet.ok).toBe(false);
    expect(packet.rows[0]).toMatchObject({
      ready: false,
      allowedActions: []
    });
    expect(packet.rows[0].blockedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "restore_source_evidence",
        ownerLane: "source",
        route: "/v1/dwm/source-requests",
        blockerCodes: expect.arrayContaining(["missing_source_evidence_report"])
      }),
      expect.objectContaining({
        action: "deliver_webhook",
        ownerLane: "webhook",
        route: "/v1/dwm/webhooks/deliver",
        blockerCodes: expect.arrayContaining(["missing_webhook_fixture_report", "missing_webhook_reconciliation_report"])
      })
    ]));
    expect(packet.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_source_evidence_report", ownerLane: "source", path: "source_evidence" }),
      expect.objectContaining({ code: "missing_webhook_fixture_report", ownerLane: "webhook", path: "webhook_fixture" })
    ]));
    expect(JSON.stringify(packet)).not.toContain("hash_acme_initial");
    expect(JSON.stringify(packet)).not.toContain("https://discord.com");
  });

  test("proves bridge rows are backed by fresh source evidence", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const report = buildOrgAlertSourceEvidenceReport({
      bridge,
      sources: sourceRefs(),
      captures: captureRefs(),
      checkedAt: "2026-06-29T15:00:00.000Z",
      maxAgeHours: 24
    });

    expect(report).toMatchObject({
      schemaVersion: DWM_ORG_ALERT_SOURCE_EVIDENCE_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      maxAgeHours: 24,
      blockers: [],
      rows: [{
        watchlistId: "watch_acme_domains",
        watchlistItemId: "watch_item_acme_com",
        alertIds: ["alert_acme_lumma"],
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        sourceIds: ["src_acme_tg", "src_acme_forum"],
        captureIds: ["cap_acme_initial", "cap_acme_followup"],
        contentHashes: ["hash_acme_initial", "hash_acme_followup"],
        newestEvidenceAt: "2026-06-29T14:30:00.000Z",
        ageHours: 0.5,
        ready: true,
        blockerCodes: []
      }]
    });
  });

  test("accepts persisted alert source provenance summaries as evidence input", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const report = buildOrgAlertSourceEvidenceReport({
      bridge,
      sources: sourceRefs(),
      captures: [],
      sourceProvenanceSummaries: [sourceProvenanceSummary()],
      checkedAt: "2026-06-29T15:00:00.000Z",
      maxAgeHours: 24
    });

    expect(report).toMatchObject({
      ok: true,
      rows: [{
        watchlistItemId: "watch_item_acme_com",
        sourceFamilies: ["telegram_public", "darkweb_metadata"],
        sourceIds: ["src_acme_tg", "src_acme_forum"],
        captureIds: ["cap_acme_initial", "cap_acme_followup"],
        contentHashes: ["hash_acme_initial", "hash_acme_followup"],
        newestEvidenceAt: "2026-06-29T14:30:00.000Z",
        ageHours: 0.5,
        ready: true,
        blockerCodes: []
      }]
    });
  });

  test("blocks persisted source provenance summaries from another organization", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const report = buildOrgAlertSourceEvidenceReport({
      bridge,
      sources: sourceRefs(),
      captures: [],
      sourceProvenanceSummaries: [{
        ...sourceProvenanceSummary(),
        organizationId: "org_other"
      }],
      checkedAt: "2026-06-29T15:00:00.000Z",
      maxAgeHours: 24
    });

    expect(report.ok).toBe(false);
    expect(report.rows[0]).toMatchObject({
      watchlistItemId: "watch_item_acme_com",
      ready: false,
      blockerCodes: ["source_provenance_identity_mismatch"]
    });
    expect(report.blockers).toEqual([
      expect.objectContaining({
        code: "source_provenance_identity_mismatch",
        ownerLane: "source",
        path: "sourceProvenanceSummaries[].organizationId"
      })
    ]);
  });

  test("blocks source evidence when captures are missing or stale", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const report = buildOrgAlertSourceEvidenceReport({
      bridge,
      sources: [{
        ...sourceRefs()[0],
        status: "paused",
        lastCollectedAt: "2026-06-26T14:00:00.000Z"
      }],
      captures: [{
        ...captureRefs()[0],
        collectedAt: "2026-06-26T14:00:00.000Z"
      }],
      checkedAt: "2026-06-29T15:00:00.000Z",
      maxAgeHours: 24
    });

    expect(report.ok).toBe(false);
    expect(report.rows[0]).toMatchObject({
      watchlistItemId: "watch_item_acme_com",
      ready: false,
      blockerCodes: expect.arrayContaining([
        "missing_source_ref",
        "inactive_source",
        "missing_capture_ref",
        "content_hash_mismatch",
        "stale_evidence"
      ])
    });
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_source_ref", ownerLane: "source", path: "sources[].sourceId" }),
      expect.objectContaining({ code: "inactive_source", ownerLane: "source", path: "sources[].status" }),
      expect.objectContaining({ code: "missing_capture_ref", ownerLane: "source", path: "captures[].captureId" }),
      expect.objectContaining({ code: "content_hash_mismatch", ownerLane: "source", path: "captures[].contentHash" }),
      expect.objectContaining({ code: "stale_evidence", ownerLane: "source", path: "captures[].collectedAt" })
    ]));
  });

  test("returns owner-coded blockers for rows that cannot reach analyst workflow", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [{
        ...watchlistFixture(),
        status: "paused",
        alertGeneratorKey: undefined
      }, {
        ...watchlistFixture(),
        watchlistItemId: "watch_item_acme_vendor",
        term: "acme vendor portal",
        normalizedTerm: "acme vendor portal",
        alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_vendor:vendor:acme-vendor-portal"
      }],
      alerts: [{
        ...alertFixture(),
        caseId: undefined,
        casePath: undefined,
        workflowContext: {
          ...alertFixture().workflowContext,
          caseId: undefined,
          casePath: undefined,
          captureIds: [],
          evidenceCount: 0
        },
        provenance: { captureIds: [] },
        evidence: []
      }],
      checkedAt: "2026-06-29T14:05:00.000Z"
    });

    expect(report.ok).toBe(false);
    expect(report.rows).toEqual([
      expect.objectContaining({
        watchlistItemId: "watch_item_acme_com",
        ready: false,
        blockerCodes: expect.arrayContaining([
          "inactive_watchlist",
          "missing_alert_generation_ref",
          "case_route_unavailable",
          "provenance_missing"
        ])
      }),
      expect.objectContaining({
        watchlistItemId: "watch_item_acme_vendor",
        ready: false,
        blockerCodes: ["alert_not_generated"]
      })
    ]);
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "inactive_watchlist", ownerLane: "watchlist", path: "watchlist.status" }),
      expect.objectContaining({ code: "case_route_unavailable", ownerLane: "case", path: "alert.casePath" }),
      expect.objectContaining({ code: "provenance_missing", ownerLane: "source", path: "alert.provenance" }),
      expect.objectContaining({ code: "alert_not_generated", ownerLane: "alert", path: "alert.id" })
    ]));
  });

  test("does not bridge overlapping watchlist terms across organizations", () => {
    const report = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [watchlistFixture()],
      alerts: [{
        ...alertFixture(),
        tenantId: "tenant_other",
        organizationId: "org_other",
        workflowContext: {
          ...alertFixture().workflowContext,
          tenantId: "tenant_other",
          organizationId: "org_other"
        }
      }],
      checkedAt: "2026-06-29T14:10:00.000Z"
    });

    expect(report.ok).toBe(false);
    expect(report.rows[0]).toMatchObject({
      watchlistItemId: "watch_item_acme_com",
      matchedAlertIds: [],
      alertDetailPaths: [],
      eventPayloads: [],
      blockerCodes: ["alert_not_generated"]
    });
  });

  test("blocks webhook fixture delivery when destination belongs to another organization", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
    const contract = buildOrgAlertWebhookFixtureContract({
      bridge,
      destinations: [{
        ...webhookDestination(),
        organizationId: "org_other"
      }],
      destinationIdsByWatchlistId: {
        watch_acme_domains: ["webhook_discord"]
      }
    });

    expect(contract.ok).toBe(false);
    expect(contract.deliveries[0]).toMatchObject({
      ready: false,
      destinationIds: ["webhook_discord"],
      blockerCodes: ["webhook_destination_scope_mismatch"]
    });
    expect(contract.blockers).toEqual([
      expect.objectContaining({
        code: "webhook_destination_scope_mismatch",
        ownerLane: "webhook",
        destinationId: "webhook_discord",
        path: "destinations[].organizationId"
      })
    ]);
    expect(contract.deliveries[0].payload.organizationId).toBe("org_acme");
  });

  test("blocks webhook reconciliation for failed dry-run or mismatched idempotency attempts", () => {
    const fixtureContract = happyWebhookFixtureContract();
    const reconciliation = reconcileOrgAlertWebhookDeliveries({
      fixture: fixtureContract,
      attempts: [{
        ...webhookAttemptFixture("wrong_idempotency"),
        status: "failed",
        dryRun: true
      }]
    });

    expect(reconciliation.ok).toBe(false);
    expect(reconciliation.rows[0]).toMatchObject({
      ready: false,
      status: "blocked",
      matchedDeliveryIds: ["delivery_acme_lumma"],
      blockerCodes: expect.arrayContaining([
        "delivery_idempotency_mismatch",
        "delivery_not_delivered",
        "dry_run_delivery"
      ])
    });
    expect(reconciliation.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "delivery_idempotency_mismatch", ownerLane: "webhook", path: "attempts[].idempotencyKey" }),
      expect.objectContaining({ code: "delivery_not_delivered", ownerLane: "webhook", path: "attempts[].status" }),
      expect.objectContaining({ code: "dry_run_delivery", ownerLane: "webhook", path: "attempts[].dryRun" })
    ]));
  });

  test("blocks webhook reconciliation when idempotency match points at another organization", () => {
    const fixtureContract = happyWebhookFixtureContract();
    const reconciliation = reconcileOrgAlertWebhookDeliveries({
      fixture: fixtureContract,
      attempts: [{
        ...webhookAttemptFixture(fixtureContract.deliveries[0].payload.idempotencyKey),
        tenantId: "tenant_other",
        organizationId: "org_other"
      }]
    });

    expect(reconciliation.ok).toBe(false);
    expect(reconciliation.rows[0]).toMatchObject({
      ready: false,
      matchedDeliveryIds: ["delivery_acme_lumma"],
      blockerCodes: ["delivery_identity_mismatch"]
    });
    expect(reconciliation.blockers).toEqual([
      expect.objectContaining({
        code: "delivery_identity_mismatch",
        ownerLane: "alert",
        alertId: "alert_acme_lumma",
        path: "attempts[].organizationId"
      })
    ]);
  });

  test("blocks webhook fixture delivery when the bridge has no alert event payload", () => {
    const bridge = buildOrgAlertWorkflowBridgeReport({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlists: [watchlistFixture()],
      alerts: [],
      checkedAt: "2026-06-29T14:20:00.000Z"
    });
    const contract = buildOrgAlertWebhookFixtureContract({
      bridge,
      destinations: [webhookDestination()],
      destinationIdsByWatchlistId: {
        watch_acme_domains: ["webhook_discord"]
      }
    });

    expect(contract.ok).toBe(false);
    expect(contract.deliveries[0]).toMatchObject({
      ready: false,
      alertId: "",
      blockerCodes: ["bridge_row_not_ready", "missing_alert_event_payload"]
    });
    expect(contract.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "bridge_row_not_ready", ownerLane: "alert", path: "bridge.rows[].ready" }),
      expect.objectContaining({ code: "missing_alert_event_payload", ownerLane: "alert", path: "bridge.rows[].eventPayloads" })
    ]));
  });
});

function watchlistFixture() {
  return {
    watchlistId: "watch_acme_domains",
    watchlistItemId: "watch_item_acme_com",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    term: "acme.com",
    normalizedTerm: "acme.com",
    status: "active",
    alertGeneratorKey: "org:org_acme:watchlist:watch_item_acme_com:domain:acme.com"
  };
}

function alertFixture() {
  return {
    id: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceFamily: "telegram_public",
    matchedTerm: { kind: "domain", value: "acme.com" },
    watchlistIds: ["watch_acme_domains"],
    watchlistItemIds: ["watch_item_acme_com"],
    alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
    reviewState: "route_to_customer",
    deliveryState: "ready_to_send",
    workflowStatus: "triaged",
    assignedOwner: "ir-lead",
    caseId: "case_acme_lumma",
    casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
    dedupeKey: "dedupe_acme_lumma",
    provenance: { captureIds: ["cap_acme_initial"] },
    workflowContext: {
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      alertDetailPath: "/v1/dwm/alerts/alert_acme_lumma?organizationId=org_acme&dedupeKey=dedupe_acme_lumma",
      sourceFamily: "telegram_public",
      alertGeneratorKeys: ["org:org_acme:watchlist:watch_item_acme_com:domain:acme.com"],
      watchlistIds: ["watch_acme_domains"],
      watchlistItemIds: ["watch_item_acme_com"],
      captureIds: ["cap_acme_initial"],
      evidenceCount: 1,
      caseId: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma"
    },
    workflowEvents: [{
      id: "event_triage",
      at: "2026-06-29T12:00:00.000Z"
    }, {
      id: "event_escalate",
      at: "2026-06-29T12:05:00.000Z"
    }],
    evidence: [{
      id: "evidence_acme_initial",
      sourceId: "src_acme_tg",
      contentHash: "hash_acme_initial",
      sourceFamily: "telegram_public"
    }]
  };
}

function webhookDestination() {
  return {
    destinationId: "webhook_discord",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    kind: "discord",
    status: "active",
    verified: true,
    endpointUrl: "https://discord.com/api/webhooks/acme/token"
  };
}

function sourceRefs() {
  return [{
    sourceId: "src_acme_tg",
    sourceFamily: "telegram_public",
    status: "active",
    lastCollectedAt: "2026-06-29T14:10:00.000Z"
  }, {
    sourceId: "src_acme_forum",
    sourceFamily: "darkweb_metadata",
    status: "active",
    lastCollectedAt: "2026-06-29T14:30:00.000Z"
  }];
}

function captureRefs() {
  return [{
    captureId: "cap_acme_initial",
    sourceId: "src_acme_tg",
    sourceFamily: "telegram_public",
    contentHash: "hash_acme_initial",
    collectedAt: "2026-06-29T14:05:00.000Z"
  }, {
    captureId: "cap_acme_followup",
    sourceId: "src_acme_forum",
    sourceFamily: "darkweb_metadata",
    contentHash: "hash_acme_followup",
    collectedAt: "2026-06-29T14:30:00.000Z"
  }];
}

function sourceRebuildReceipt() {
  return {
    schemaVersion: "ti.source_provenance_alert_rebuild_receipt.v1" as const,
    id: "receipt_source_rebuild_acme_lumma",
    generatedAt: "2026-06-29T15:00:00.000Z",
    ok: true,
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceCandidateId: "candidate_public_ti_acme",
    sourceBridgeId: "ti_source_provenance_alertability_acme",
    alertRebuildRequestId: "request_source_rebuild_acme_lumma",
    response: {
      source: "dwm_alert_rebuild" as const,
      rebuiltAt: "2026-06-29T14:58:00.000Z",
      savedAlertCount: 1,
      dryRun: true
    },
    matches: {
      alertIds: ["alert_acme_lumma"],
      watchlistItemIds: ["watch_item_acme_com"],
      alertGeneratorKeys: ["org:org_acme:watchlist:watch_item_acme_com:domain:acme.com"],
      sourceBridgeIds: ["ti_source_provenance_alertability_acme"]
    },
    caseHandoffRows: [{
      alertId: "alert_acme_lumma",
      caseId: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=alert_acme_lumma",
      ready: true
    }],
    blockers: [],
    payloadShape: [
      "response.savedAlertCount",
      "matches.alertIds",
      "caseHandoffRows[]",
      "blockers[]"
    ],
    safeOutput: {
      rawTargetsExposed: false as const,
      restrictedMetadataLeaked: false as const,
      privateTelegramContentExposed: false as const,
      liveNetworkScrapeStarted: false as const
    }
  };
}

function sourceProvenanceSummary() {
  return {
    schemaVersion: "dwm.alert_source_provenance.v1",
    alertId: "alert_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    sourceFamily: "telegram_public",
    sourceFamilies: ["telegram_public", "darkweb_metadata"],
    captureIds: ["cap_acme_initial", "cap_acme_followup"],
    sourceIds: ["src_acme_tg", "src_acme_forum"],
    contentHashes: ["hash_acme_initial", "hash_acme_followup"],
    evidenceCount: 2,
    firstObservedAt: "2026-06-29T14:05:00.000Z",
    lastObservedAt: "2026-06-29T14:30:00.000Z",
    evidenceExcerpts: [{
      captureId: "cap_acme_initial",
      sourceId: "src_acme_tg",
      sourceFamily: "telegram_public",
      observedAt: "2026-06-29T14:05:00.000Z",
      contentHash: "hash_acme_initial"
    }, {
      captureId: "cap_acme_followup",
      sourceId: "src_acme_forum",
      sourceFamily: "darkweb_metadata",
      observedAt: "2026-06-29T14:30:00.000Z",
      contentHash: "hash_acme_followup"
    }],
    generationEvidenceWindow: {
      captureIds: ["cap_acme_initial", "cap_acme_followup"],
      sourceFamilies: ["telegram_public", "darkweb_metadata"],
      contentHashes: ["hash_acme_initial", "hash_acme_followup"],
      firstObservedAt: "2026-06-29T14:05:00.000Z",
      lastObservedAt: "2026-06-29T14:30:00.000Z"
    }
  };
}

function happyWebhookFixtureContract() {
  const bridge = buildOrgAlertWorkflowBridgeReport(fixture as any);
  return buildOrgAlertWebhookFixtureContract({
    bridge,
    destinations: [webhookDestination()],
    destinationIdsByWatchlistId: {
      watch_acme_domains: ["webhook_discord"]
    }
  });
}

function webhookAttemptFixture(idempotencyKey: string) {
  return {
    deliveryId: "delivery_acme_lumma",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    alertId: "alert_acme_lumma",
    webhookDestinationId: "webhook_discord",
    status: "delivered",
    idempotencyKey,
    payloadHash: "payload_hash_acme",
    endpointHash: "endpoint_hash_acme",
    attemptedAt: "2026-06-29T14:25:00.000Z",
    httpStatus: 204,
    dryRun: false
  };
}
