import { describe, expect, test } from "bun:test";
import { buildDwmOrgAlertPipelineProof } from "../storage/dwmAlertRepository.ts";
import { orgWatchlistContractToRuntimeDwmWatchlists } from "../storage/dwmOrgWatchlistBridge.ts";
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
      caseReady: true,
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
    expect(proof.consumerAdapters.webhook.stableFields).toContain("alerts.deliveryHistoryRefs");
    expect(proof.consumerAdapters.publicTI.gapFields).toContain("readiness.sourceFamilyGaps.blockerCode");
    expect(proof.consumerAdapters.analystPortal.workflowFields).toContain("readiness.zeroAlertProof.watchlistTerms");
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
});
