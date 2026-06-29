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
});
