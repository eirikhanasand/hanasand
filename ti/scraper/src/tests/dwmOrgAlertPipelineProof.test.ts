import { describe, expect, test } from "bun:test";
import { buildDwmOrgAlertPipelineProof, buildDwmSourceProjectionAlertReadinessProof } from "../storage/dwmAlertRepository.ts";
import { orgWatchlistContractToRuntimeDwmWatchlists } from "../storage/dwmOrgWatchlistBridge.ts";
import type { TiSourceProvenancePublicTiSourceOpsProjection } from "../product/sourceProvenanceTiPageContract.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_pipeline_tg",
  name: "Pipeline public Telegram",
  type: "telegram_public",
  url: "https://t.me/pipeline_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.83,
  legalNotes: "Public channel preview only.",
  createdAt: "2026-06-28T16:00:00.000Z",
  updatedAt: "2026-06-28T16:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_pipeline_acme",
  sourceId: source.id,
  url: "https://t.me/pipeline_public/15",
  collectedAt: "2026-06-28T16:03:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-pipeline-acme",
  sensitive: false,
  body: "acme.com appeared in public Telegram chatter tied to fresh credential resale.",
  metadata: { adapter: "telegram_public", channel: "pipeline_public", messageId: 15 }
} as RawCapture;

const nonmatchCapture: RawCapture = {
  id: "cap_pipeline_quiet",
  sourceId: source.id,
  url: "https://t.me/pipeline_public/16",
  collectedAt: "2026-06-28T16:05:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-pipeline-quiet",
  sensitive: false,
  body: "quiet.example appeared in public Telegram chatter, but no customer watchlist term was present.",
  metadata: { adapter: "telegram_public", channel: "pipeline_public", messageId: 16 }
} as RawCapture;

function watchlists() {
  const runtime = orgWatchlistContractToRuntimeDwmWatchlists({
    schemaVersion: "organization.watchlist_alert_generation.v1",
    organizationId: "org_pipeline",
    tenantId: "tenant_pipeline",
    entitlementStatus: "active",
    visibilityPolicy: "members",
    downstreamAuthorization: {
      organizationLifecycleState: "active",
      visibility: { allowed: true, reason: null, allowedRoles: ["owner", "admin", "analyst", "viewer"] },
      downstream: { alertGeneration: { canExportActiveTerms: true, blockerCodes: [] } }
    },
    activeTerms: [{
      watchlistId: "watch_pipeline_acme",
      watchlistItemId: "watch_item_pipeline_acme",
      kind: "domain",
      term: "acme.com",
      status: "active"
    }]
  });
  return runtime.map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_pipeline_discord" }));
}

function publicTiSourceProjection(input: {
  organizationId?: string;
  state?: "ready" | "partial" | "blocked";
  freshnessState?: "fresh" | "stale" | "missing";
  actor?: string;
  gaps?: Array<{ code: string; ownerLane: "source" | "parser" | "policy" | "publicTI" | "alert" | "case"; sourceFamily?: string; nextAction?: string; path?: string }>;
} = {}): TiSourceProvenancePublicTiSourceOpsProjection {
  const state = input.state ?? "ready";
  const actor = input.actor ?? "LockBit";
  const organizationId = input.organizationId ?? "org_pipeline";
  const gaps = input.gaps ?? [];
  return {
    schemaVersion: "ti.source_provenance_public_ti_source_ops_projection.v1",
    id: `projection_${organizationId}_${state}`,
    generatedAt: "2026-06-28T16:02:00.000Z",
    ok: state === "ready" && gaps.length === 0,
    tenantId: "tenant_pipeline",
    organizationId,
    actor,
    publicTiRoute: `/ti/${encodeURIComponent(actor)}`,
    sourceOpsFixtureBundleId: "fixture_pipeline_lockbit",
    pageReadiness: {
      state,
      canRender: true,
      publicTI: state !== "blocked",
      dashboard: true,
      sourceOps: true,
      alertGeneration: state === "ready"
    },
    sourceCoverage: {
      families: ["telegram_public"],
      freshnessState: input.freshnessState ?? "fresh",
      parserAlertCount: 0,
      operatorActionCount: state === "ready" ? 0 : 1,
      validationIssueCount: gaps.length
    },
    provenanceRows: [{
      rowId: "projection_row_pipeline",
      sourceFamily: "telegram_public",
      state: state === "ready" ? "ready" : "validation_blocked",
      reasonCode: gaps[0]?.code,
      ownerLane: gaps[0]?.ownerLane ?? "source",
      provenance: {
        sourceOpsFixtureBundleId: "fixture_pipeline_lockbit",
        sourceFreshnessGapPacketId: "freshness_packet_pipeline",
        parserHealthAlertPacketId: "parser_packet_pipeline",
        sourceOpsActionQueueId: "action_queue_pipeline",
        fixtureBacked: true
      },
      route: {
        method: "GET",
        path: `/ti/${encodeURIComponent(actor)}`,
        dryRunSupported: true,
        liveNetworkFetch: false
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    }],
    enrichmentGaps: gaps.map((gap) => ({
      code: gap.code,
      ownerLane: gap.ownerLane,
      sourceFamily: gap.sourceFamily,
      nextAction: gap.nextAction ?? "review_source_family",
      route: {
        method: "POST",
        path: gap.path ?? "/v1/dwm/source-requests",
        body: { dryRun: true },
        dryRunSupported: true,
        liveNetworkFetch: false
      }
    })),
    consumerContracts: [{
      consumer: "publicTI",
      route: `/ti/${encodeURIComponent(actor)}`,
      liveNetworkFetch: false,
      requiredFields: ["readiness.publicTI", "sourceHealth.freshnessState"],
      sourceSchemas: ["ti.source_provenance_source_ops_fixture_bundle.v1"]
    }, {
      consumer: "dashboard",
      route: `/dashboard/ti/sources?actor=${encodeURIComponent(actor)}`,
      liveNetworkFetch: false,
      requiredFields: ["operatorActions[].action", "validationIssues[].code"],
      sourceSchemas: ["ti.source_provenance_source_ops_action_queue.v1"]
    }, {
      consumer: "alertGeneration",
      route: "/v1/dwm/alerts/rebuild",
      liveNetworkFetch: false,
      requiredFields: ["readiness.alertGeneration", "packetRefs.parserHealthAlertPacketId"],
      sourceSchemas: ["ti.source_provenance_parser_health_alert_packet.v1"]
    }],
    payloadShape: [
      "pageReadiness.state",
      "sourceCoverage.families",
      "provenanceRows[].provenance",
      "enrichmentGaps[].code",
      "consumerContracts[]"
    ],
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function deliveredPipelineProof() {
  const [watchlist] = watchlists();
  const alertGeneratorKey = watchlist.orgWatchlistTerms?.[0]?.alertGeneratorKey;
  const alert = {
    id: "alert_pipeline_acme",
    tenantId: "tenant_pipeline",
    organizationId: "org_pipeline",
    sourceFamily: "telegram_public",
    dedupeKey: "dedupe_pipeline_acme",
    severity: "high",
    confidence: 0.86,
    company: "acme.com",
    matchedTerm: { kind: "domain", value: "acme.com" },
    evidence: [{
      id: "evidence_pipeline_acme",
      sourceId: source.id,
      sourceName: source.name,
      sourceFamily: "telegram_public",
      contentHash: capture.contentHash,
      observedAt: capture.collectedAt,
      excerpt: "acme.com appeared in public Telegram chatter."
    }],
    provenance: {
      captureIds: [capture.id],
      sourceIds: [source.id],
      matchBasis: "bounded_text_or_metadata",
      generatedAt: "2026-06-28T16:04:00.000Z"
    },
    workflowStatus: "open",
    reviewState: "route_to_customer",
    deliveryState: "delivered",
    deliveredAt: "2026-06-28T16:06:00.000Z",
    caseIdCandidate: "case_pipeline_acme",
    casePath: "/v1/cases/case_pipeline_acme?alertId=alert_pipeline_acme",
    watchlistIds: [watchlist.id],
    watchlistItemIds: ["watch_item_pipeline_acme"],
    workflowContext: {
      organizationId: "org_pipeline",
      tenantId: "tenant_pipeline",
      sourceFamily: "telegram_public",
      alertGeneratorKeys: [alertGeneratorKey],
      watchlistIds: [watchlist.id],
      watchlistItemIds: ["watch_item_pipeline_acme"],
      captureIds: [capture.id],
      webhookDestinationIds: ["webhook_pipeline_discord"],
      evidenceCount: 1,
      caseIdCandidate: "case_pipeline_acme",
      casePath: "/v1/cases/case_pipeline_acme?alertId=alert_pipeline_acme"
    },
    deliveryReadinessContext: {
      schemaVersion: "dwm.alert_delivery_persistence.v1",
      alertId: "alert_pipeline_acme",
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      ready: true,
      state: "delivered",
      sourceFamily: "telegram_public",
      selectedCaptureIds: [capture.id],
      webhookDestinationIds: ["webhook_pipeline_discord"],
      alertGeneratorKeys: [alertGeneratorKey],
      watchlistIds: [watchlist.id],
      watchlistItemIds: ["watch_item_pipeline_acme"],
      evidenceCount: 1,
      caseIdCandidate: "case_pipeline_acme",
      casePath: "/v1/cases/case_pipeline_acme?alertId=alert_pipeline_acme",
      deliveryDedupeKey: "dedupe_pipeline_acme",
      deliveryHistoryRefs: ["delivery_pipeline_acme"],
      lastDeliveryStatus: "delivered"
    },
    updatedAt: "2026-06-28T16:06:00.000Z",
    workflowEvents: []
  };

  return buildDwmOrgAlertPipelineProof({
    watchlists: [watchlist],
    alerts: [alert],
    deliveries: [{
      id: "delivery_pipeline_acme",
      alertId: "alert_pipeline_acme",
      webhookDestinationId: "webhook_pipeline_discord",
      status: "delivered",
      attemptedAt: "2026-06-28T16:06:00.000Z"
    }],
    tenantId: "tenant_pipeline",
    organizationId: "org_pipeline",
    sources: [source],
    captures: [capture],
    generatedAt: "2026-06-28T16:07:00.000Z"
  });
}

describe("dwm org alert pipeline proof", () => {
  test("maps org watchlist readiness to persisted alert case and webhook workflow proof", () => {
    const [watchlist] = watchlists();
    const alertGeneratorKey = watchlist.orgWatchlistTerms?.[0]?.alertGeneratorKey;
    const alert = {
      id: "alert_pipeline_acme",
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      sourceFamily: "telegram_public",
      dedupeKey: "dedupe_pipeline_acme",
      severity: "high",
      confidence: 0.86,
      company: "acme.com",
      matchedTerm: { kind: "domain", value: "acme.com" },
      evidence: [{
        id: "evidence_pipeline_acme",
        sourceId: source.id,
        sourceName: source.name,
        sourceFamily: "telegram_public",
        contentHash: capture.contentHash,
        observedAt: capture.collectedAt,
        excerpt: "acme.com appeared in public Telegram chatter.",
        provenance: { captureId: capture.id, sourceId: source.id }
      }],
      provenance: {
        captureIds: [capture.id],
        sourceIds: [source.id],
        matchBasis: "bounded_text_or_metadata",
        generatedAt: "2026-06-28T16:04:00.000Z"
      },
      workflowStatus: "open",
      reviewState: "route_to_customer",
      deliveryState: "delivered",
      assignedOwner: "analyst-pipeline",
      deliveredAt: "2026-06-28T16:06:00.000Z",
      caseIdCandidate: "case_pipeline_acme",
      casePath: "/v1/cases/case_pipeline_acme?alertId=alert_pipeline_acme",
      watchlistIds: [watchlist.id],
      watchlistItemIds: ["watch_item_pipeline_acme"],
      workflowContext: {
        organizationId: "org_pipeline",
        tenantId: "tenant_pipeline",
        sourceFamily: "telegram_public",
        alertGeneratorKeys: [alertGeneratorKey],
        watchlistIds: [watchlist.id],
        watchlistItemIds: ["watch_item_pipeline_acme"],
        captureIds: [capture.id],
        webhookDestinationIds: ["webhook_pipeline_discord"],
        evidenceCount: 1,
        caseIdCandidate: "case_pipeline_acme",
        casePath: "/v1/cases/case_pipeline_acme?alertId=alert_pipeline_acme"
      },
      deliveryReadinessContext: {
        schemaVersion: "dwm.alert_delivery_persistence.v1",
        alertId: "alert_pipeline_acme",
        tenantId: "tenant_pipeline",
        organizationId: "org_pipeline",
        ready: true,
        state: "delivered",
        sourceFamily: "telegram_public",
        selectedCaptureIds: [capture.id],
        webhookDestinationIds: ["webhook_pipeline_discord"],
        alertGeneratorKeys: [alertGeneratorKey],
        watchlistIds: [watchlist.id],
        watchlistItemIds: ["watch_item_pipeline_acme"],
        evidenceCount: 1,
        caseIdCandidate: "case_pipeline_acme",
        casePath: "/v1/cases/case_pipeline_acme?alertId=alert_pipeline_acme",
        deliveryDedupeKey: "dedupe_pipeline_acme",
        deliveryHistoryRefs: ["delivery_pipeline_acme"],
        lastDeliveryStatus: "delivered"
      },
      updatedAt: "2026-06-28T16:06:00.000Z",
      workflowEvents: [{
        id: "evt_pipeline_triaged",
        at: "2026-06-28T16:05:00.000Z",
        actor: "analyst-pipeline",
        toWorkflowStatus: "triaged",
        note: "Reviewed source provenance and linked customer case."
      }]
    };

    const proof = buildDwmOrgAlertPipelineProof({
      watchlists: [watchlist],
      alerts: [alert],
      deliveries: [{
        id: "delivery_pipeline_acme",
        alertId: "alert_pipeline_acme",
        webhookDestinationId: "webhook_pipeline_discord",
        status: "delivered",
        attemptedAt: "2026-06-28T16:06:00.000Z"
      }],
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      sources: [source],
      captures: [capture],
      generatedAt: "2026-06-28T16:07:00.000Z"
    });

    expect(proof).toMatchObject({
      schemaVersion: "dwm.org_alert_pipeline_proof.v1",
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      state: "ready_for_operator_workflow",
      readiness: {
        readyForRebuild: true,
        readyForCustomerDelivery: true,
        blockerCodes: []
      },
      routes: {
        readiness: "/v1/dwm/alerts/generation-readiness",
        rebuild: "/v1/dwm/alerts/rebuild",
        alerts: "/v1/dwm/alerts",
        cases: "/v1/cases",
        webhookDelivery: "/v1/dwm/webhooks/deliver"
      }
    });
    expect(proof.candidates[0]).toMatchObject({
      normalizedTerm: "acme.com",
      matchedAlertIds: ["alert_pipeline_acme"],
      caseReady: true,
      deliveryReady: true,
      delivered: true,
      blockerCodes: []
    });
    expect(proof.alerts[0]).toMatchObject({
      alertId: "alert_pipeline_acme",
      sourceFamily: "telegram_public",
      selectedCaptureIds: [capture.id],
      evidenceCount: 1,
      provenanceCaptureIds: [capture.id],
      provenanceSourceIds: [source.id],
      provenanceGapCodes: ["missing_source_url"],
      workflowStatus: "open",
      assignedOwner: "analyst-pipeline",
      workflowEventCount: 1,
      caseReady: true,
      caseIdCandidate: "case_pipeline_acme",
      casePath: "/v1/cases/case_pipeline_acme?alertId=alert_pipeline_acme",
      caseHandoffIdempotencyKey: expect.stringMatching(/^dwm_case_handoff_/),
      deliveryReady: true,
      delivered: true,
      deliveryHistoryRefs: ["delivery_pipeline_acme"]
    });
    expect(proof.consumerAdapters).toMatchObject({
      schemaVersion: "dwm.org_alert_pipeline_consumer_adapters.v1",
      dashboard: {
        canConsume: true,
        route: "/v1/dwm/alerts"
      },
      webhook: {
        canConsume: true,
        route: "/v1/dwm/webhooks/deliver"
      },
      publicTI: {
        canConsume: true,
        redacted: true
      },
      analystPortal: {
        canConsume: true,
        route: "/v1/dwm/alerts"
      }
    });
    expect(proof.consumerAdapters.dashboard.stableFields).toContain("readiness.zeroAlertProof");
    expect(proof.consumerAdapters.dashboard.stableFields).toContain("alerts.provenanceGapCodes");
    expect(proof.consumerAdapters.dashboard.stableFields).toContain("alerts.workflowStatus");
    expect(proof.consumerAdapters.dashboard.stableFields).toContain("alerts.casePath");
    expect(proof.consumerAdapters.webhook.stableFields).toContain("alerts.deliveryHistoryRefs");
    expect(proof.consumerAdapters.webhook.stableFields).toContain("alerts.selectedCaptureIds");
    expect(proof.consumerAdapters.publicTI.gapFields).toContain("readiness.sourceFamilyGaps.blockerCode");
    expect(proof.consumerAdapters.publicTI.stableFields).toContain("alerts.provenanceGapCodes");
    expect(proof.consumerAdapters.analystPortal.workflowFields).toContain("readiness.zeroAlertProof.watchlistTerms");
    expect(proof.consumerAdapters.analystPortal.workflowFields).toContain("alerts.workflowEventCount");
    expect(proof.consumerAdapters.analystPortal.stableFields).toContain("alerts.caseHandoffIdempotencyKey");
    expect(proof.gaps).toEqual([]);
  });

  test("reports generated gaps without leaking sibling org alerts", () => {
    const [watchlist] = watchlists();
    const siblingAlert = {
      id: "alert_sibling",
      tenantId: "tenant_pipeline",
      organizationId: "org_sibling",
      workflowContext: { alertGeneratorKeys: watchlist.orgWatchlistTerms?.map((term) => term.alertGeneratorKey) },
      deliveryReadinessContext: { selectedCaptureIds: [capture.id] }
    };

    const proof = buildDwmOrgAlertPipelineProof({
      watchlists: [watchlist],
      alerts: [siblingAlert],
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      sources: [source],
      captures: [capture],
      generatedAt: "2026-06-28T16:08:00.000Z"
    });

    expect(proof.state).toBe("ready_to_generate_alerts");
    expect(proof.alerts).toEqual([]);
    expect(proof.candidates[0]).toMatchObject({
      normalizedTerm: "acme.com",
      matchedAlertIds: [],
      caseReady: false,
      deliveryReady: false,
      blockerCodes: ["alert_not_generated"]
    });
    expect(proof.gaps).toEqual([expect.objectContaining({
      code: "alert_not_generated",
      ownerLane: "alert_generation",
      route: "/v1/dwm/alerts/rebuild",
      candidateId: proof.candidates[0].candidateId
    })]);
  });

  test("surfaces zero-alert source-family blockers for consumer lanes without fake alert rows", () => {
    const [watchlist] = watchlists();

    const proof = buildDwmOrgAlertPipelineProof({
      watchlists: [watchlist],
      alerts: [],
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      sources: [source],
      captures: [nonmatchCapture],
      generatedAt: "2026-06-28T16:09:00.000Z"
    });

    expect(proof).toMatchObject({
      schemaVersion: "dwm.org_alert_pipeline_proof.v1",
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      state: "blocked_before_rebuild",
      alerts: [],
      readiness: {
        readyForRebuild: true,
        readyForCustomerDelivery: false,
        blockerCodes: expect.arrayContaining(["no_matching_captures", "missing_evidence"]),
        zeroAlertProof: {
          schemaVersion: "dwm.zero_alert_proof.v1",
          zeroAlert: true,
          state: "blocked_no_matching_capture",
          expectedAlertDelta: 0,
          routes: {
            readiness: "/v1/dwm/alerts/readiness",
            rebuild: "/v1/dwm/alerts/rebuild",
            alerts: "/v1/dwm/alerts"
          },
          nextAction: "Add or collect a recent capture containing the active watchlist term."
        }
      }
    });
    expect(proof.readiness.sourceFamilyGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        schemaVersion: "dwm.alert_source_family_gap.v1",
        sourceFamily: "telegram_public",
        state: "active_no_match",
        active: true,
        blockerCode: "no_matching_captures",
        watchlistIds: [watchlist.id]
      }),
      expect.objectContaining({
        schemaVersion: "dwm.alert_source_family_gap.v1",
        sourceFamily: "darkweb_metadata",
        state: "inactive_or_unconfigured",
        blockerCode: "source_family_inactive",
        watchlistIds: [watchlist.id]
      })
    ]));
    expect(proof.readiness.zeroAlertProof.watchlistTerms).toEqual([expect.objectContaining({
      term: "acme.com",
      watchlistIds: [watchlist.id],
      watchlistItemIds: ["watch_item_pipeline_acme"],
      hasMatchingCaptures: false,
      sourceFamilies: [],
      captureRefCount: 0
    })]);
    expect(proof.gaps).toEqual([
      expect.objectContaining({
        code: "readiness_blocked",
        ownerLane: "source_operations",
        route: "/v1/dwm/alerts/generation-readiness",
        blockerCodes: expect.arrayContaining(["no_matching_captures", "missing_evidence"])
      }),
      expect.objectContaining({
        code: "alert_not_generated",
        ownerLane: "alert_generation",
        route: "/v1/dwm/alerts/rebuild",
        blockerCodes: ["alert_not_generated"]
      })
    ]);
    expect(proof.consumerAdapters).toMatchObject({
      schemaVersion: "dwm.org_alert_pipeline_consumer_adapters.v1",
      dashboard: { canConsume: true, route: "/v1/dwm/alerts" },
      webhook: { canConsume: false, route: "/v1/dwm/webhooks/deliver" },
      publicTI: { canConsume: true, redacted: true },
      analystPortal: { canConsume: false, route: "/v1/dwm/alerts" }
    });
    expect(proof.consumerAdapters.dashboard.gapFields).toEqual(expect.arrayContaining([
      "readiness.zeroAlertProof.nextAction",
      "readiness.sourceFamilyGaps.blockerCode",
      "gaps.ownerLane"
    ]));
    expect(proof.consumerAdapters.publicTI.stableFields).toContain("readiness.sourceFamilyGaps");
    expect(proof.consumerAdapters.webhook.gapFields).toContain("gaps.route");
  });

  test("joins public TI source projection with org alert pipeline readiness for downstream consumers", () => {
    const pipeline = deliveredPipelineProof();
    const proof = buildDwmSourceProjectionAlertReadinessProof({
      sourceProjection: publicTiSourceProjection(),
      alertPipeline: pipeline,
      generatedAt: "2026-06-28T16:09:00.000Z"
    });

    expect(proof).toMatchObject({
      schemaVersion: "dwm.source_projection_alert_readiness.v1",
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      actor: "LockBit",
      state: "ready_for_customer_delivery",
      ownerLane: "webhook_delivery",
      sourceProjection: {
        pageReadiness: {
          state: "ready",
          publicTI: true,
          dashboard: true,
          alertGeneration: true
        },
        sourceCoverage: {
          freshnessState: "fresh",
          families: ["telegram_public"]
        },
        provenanceRowCount: 1,
        enrichmentGapCount: 0
      },
      alertPipeline: {
        state: "ready_for_operator_workflow",
        readyForRebuild: true,
        readyForCustomerDelivery: true,
        candidateCount: 1,
        alertCount: 1,
        zeroAlertState: "alerts_expected"
      },
      downstreamRoutes: {
        publicTI: "/ti/LockBit",
        dashboard: "/v1/dwm/alerts",
        alertReadiness: "/v1/dwm/alerts/generation-readiness",
        alertRebuild: "/v1/dwm/alerts/rebuild",
        webhookDelivery: "/v1/dwm/webhooks/deliver"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(proof.blockers).toEqual([]);
    expect(proof.provenanceRefs).toMatchObject({
      sourceOpsFixtureBundleId: "fixture_pipeline_lockbit",
      sourceFreshnessGapPacketIds: ["freshness_packet_pipeline"],
      parserHealthAlertPacketIds: ["parser_packet_pipeline"],
      sourceOpsActionQueueIds: ["action_queue_pipeline"],
      alertIds: ["alert_pipeline_acme"],
      deliveryHistoryRefs: ["delivery_pipeline_acme"]
    });
    expect(proof.consumerContracts).toMatchObject({
      schemaVersion: "dwm.source_projection_alert_readiness_consumers.v1",
      publicTI: { canConsume: true, redacted: true },
      dashboard: { canConsume: true, route: "/v1/dwm/alerts" },
      alertGeneration: { canConsume: true, route: "/v1/dwm/alerts/rebuild" },
      webhook: { canConsume: true, route: "/v1/dwm/webhooks/deliver" }
    });
    expect(proof.consumerContracts.dashboard.stableFields).toContain("provenanceRefs.alertCandidateIds");
    expect(proof.consumerContracts.webhook.stableFields).toContain("provenanceRefs.deliveryHistoryRefs");
    expect(proof.consumerContracts.publicTI.gapFields).toContain("blockers.ownerLane");
    expect(JSON.stringify(proof)).not.toContain("rawText");
    expect(JSON.stringify(proof)).not.toContain("password");
  });

  test("blocks source projection alert readiness on wrong org stale source and unsupported source family", () => {
    const pipeline = deliveredPipelineProof();
    const proof = buildDwmSourceProjectionAlertReadinessProof({
      sourceProjection: publicTiSourceProjection({
        organizationId: "org_other",
        state: "partial",
        freshnessState: "stale",
        gaps: [{
          code: "duplicate_candidate",
          ownerLane: "source",
          sourceFamily: "telegram_public",
          nextAction: "suppress_duplicate"
        }, {
          code: "unsupported_source_family",
          ownerLane: "source",
          sourceFamily: "pastebin_dump",
          nextAction: "review_source_family"
        }]
      }),
      alertPipeline: pipeline,
      generatedAt: "2026-06-28T16:10:00.000Z"
    });

    expect(proof.state).toBe("blocked");
    expect(proof.ownerLane).toBe("org_foundation");
    expect(proof.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "org_mismatch",
        ownerLane: "org_foundation",
        route: "/v1/dwm/alerts/generation-readiness"
      }),
      expect.objectContaining({
        code: "source_projection_partial",
        ownerLane: "source_operations",
        route: "/ti/LockBit"
      }),
      expect.objectContaining({
        code: "stale_source",
        ownerLane: "source_operations",
        route: "/v1/dwm/source-requests"
      }),
      expect.objectContaining({
        code: "duplicate_candidate",
        sourceFamily: "telegram_public"
      }),
      expect.objectContaining({
        code: "unsupported_source_family",
        sourceFamily: "pastebin_dump"
      })
    ]));
    expect(proof.consumerContracts.alertGeneration.canConsume).toBe(false);
    expect(proof.consumerContracts.webhook.canConsume).toBe(false);
    expect(proof.sourceProjection.sourceCoverage).toMatchObject({
      freshnessState: "stale",
      validationIssueCount: 2
    });
  });

  test("reports zero-alert no-match readiness without inventing alert or webhook rows", () => {
    const [watchlist] = watchlists();
    const pipeline = buildDwmOrgAlertPipelineProof({
      watchlists: [watchlist],
      tenantId: "tenant_pipeline",
      organizationId: "org_pipeline",
      sources: [source],
      captures: [nonmatchCapture],
      generatedAt: "2026-06-28T16:11:00.000Z"
    });
    const proof = buildDwmSourceProjectionAlertReadinessProof({
      sourceProjection: publicTiSourceProjection(),
      alertPipeline: pipeline,
      generatedAt: "2026-06-28T16:12:00.000Z"
    });

    expect(proof.state).toBe("zero_alert_no_match");
    expect(proof.alertPipeline).toMatchObject({
      readyForRebuild: true,
      readyForCustomerDelivery: false,
      alertCount: 0,
      zeroAlertState: "blocked_no_matching_capture"
    });
    expect(proof.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "alert_readiness_blocked",
        ownerLane: "source_operations",
        blockerCodes: expect.arrayContaining(["no_matching_captures"])
      }),
      expect.objectContaining({
        code: "zero_alert_no_match",
        ownerLane: "alert_generation",
        route: "/v1/dwm/alerts/rebuild"
      })
    ]));
    expect(proof.provenanceRefs.alertIds).toEqual([]);
    expect(proof.provenanceRefs.deliveryHistoryRefs).toEqual([]);
    expect(proof.consumerContracts.dashboard.canConsume).toBe(true);
    expect(proof.consumerContracts.publicTI.canConsume).toBe(true);
    expect(proof.consumerContracts.webhook.canConsume).toBe(false);
  });
});
