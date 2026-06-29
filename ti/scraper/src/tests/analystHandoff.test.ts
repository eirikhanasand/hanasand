import { describe, expect, test } from "bun:test";
import {
  ANALYST_HANDOFF_SCHEMA_VERSION,
  AnalystHandoffIdentityMismatchError,
  buildActorWatchlistCandidateHandoff,
  buildAlertCaseHandoff,
  buildAlertWebhookTriggerHandoff,
  buildWatchlistAlertGenerationHandoff,
  orgWatchlistTermsToAlertGenerationRequest,
  persistedAlertToCaseHandoffPayload,
  persistedAlertToWebhookTriggerContext,
  publicTiArtifactToOrgWatchlistCreate,
  type AnalystHandoffBlockerCode
} from "../product/analystHandoff.ts";
import { buildDwmProductSnapshot, type DwmAlert } from "../product/dwmProduct.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_handoff_tg",
  name: "Handoff public Telegram",
  type: "telegram_public",
  url: "https://t.me/handoff_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.82,
  legalNotes: "Public channel preview only.",
  createdAt: "2026-06-28T16:00:00.000Z",
  updatedAt: "2026-06-28T16:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_handoff_acme",
  sourceId: source.id,
  url: "https://t.me/handoff_public/99",
  collectedAt: "2026-06-28T16:03:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-handoff-acme",
  sensitive: false,
  body: "Lumma C2 public Telegram chatter says acme.com Okta live cookie and AWS IAM key exposure is being brokered.",
  metadata: { adapter: "telegram_public", channel: "handoff_public", actorName: "Lumma C2", messageId: 99 }
} as RawCapture;

describe("analyst handoff contract", () => {
  test("carries one identity from public actor artifact through watchlist, alert, case, and webhook handoff", () => {
    const generatedAt = "2026-06-28T16:10:00.000Z";
    const actorHandoff = buildActorWatchlistCandidateHandoff({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      requestedByUserId: "user_analyst",
      query: "Lumma C2",
      artifact: {
        id: "artifact_lumma_acme",
        kind: "tool",
        label: "Lumma C2",
        confidence: 88,
        freshness: generatedAt,
        provenance: ["public TI profile", "telegram broker-room capture"]
      },
      terms: [{ kind: "domain", value: "acme.com", notes: "Observed in Lumma C2 broker-room context." }],
      generatedAt
    });

    const generationHandoff = buildWatchlistAlertGenerationHandoff({
      parent: actorHandoff,
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      webhookDestinationIds: ["webhook_discord"],
      createdAt: "2026-06-28T16:11:00.000Z"
    });

    const alert = alertFixture({
      caseIdCandidate: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme"
    });
    const caseHandoff = buildAlertCaseHandoff({
      parent: generationHandoff,
      alert,
      requestedByUserId: "user_analyst",
      createdAt: "2026-06-28T16:12:00.000Z"
    });
    const webhookHandoff = buildAlertWebhookTriggerHandoff({
      parent: caseHandoff,
      alert,
      requestedByUserId: "user_analyst",
      dryRun: true,
      createdAt: "2026-06-28T16:13:00.000Z"
    });

    expect(actorHandoff.schemaVersion).toBe(ANALYST_HANDOFF_SCHEMA_VERSION);
    expect(generationHandoff.parentHandoffId).toBe(actorHandoff.handoffId);
    expect(caseHandoff.parentHandoffId).toBe(generationHandoff.handoffId);
    expect(webhookHandoff.parentHandoffId).toBe(caseHandoff.handoffId);

    for (const handoff of [actorHandoff, generationHandoff, caseHandoff, webhookHandoff]) {
      expect(handoff.identity).toMatchObject({
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        requestedByUserId: "user_analyst",
        actorQuery: "lumma c2",
        actorName: "Lumma C2",
        artifactId: "artifact_lumma_acme",
        artifactKind: "tool",
        normalizedWatchTerm: "acme.com",
        watchTermKind: "domain"
      });
    }

    expect(webhookHandoff.identity).toMatchObject({
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      alertId: "dwm_alert_acme",
      alertDedupeKey: "dwm_dedupe_acme",
      sourceFamily: "telegram_public",
      captureIds: ["cap_handoff_acme"],
      caseIdCandidate: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme",
      webhookDestinationIds: ["webhook_discord"]
    });
    expect(generationHandoff.payload.body).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      publicTiHandoffId: actorHandoff.handoffId
    });
    expect(caseHandoff.payload.body).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "dwm_alert_acme",
      dedupeKey: "dwm_dedupe_acme",
      caseIdCandidate: "case_acme_lumma",
      recommendedRoute: "identity_response",
      captureIds: ["cap_handoff_acme"],
      watchlistItemIds: ["watch_item_acme_domain"]
    });
    expect(webhookHandoff.payload.body).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "dwm_alert_acme",
      dedupeKey: "dwm_dedupe_acme",
      recommendedRoute: "identity_response",
      webhookDestinationIds: ["webhook_discord"],
      captureIds: ["cap_handoff_acme"],
      evidenceCount: 1,
      dryRun: true
    });
  });

  test("rejects identity drift instead of silently creating ad hoc handoff params", () => {
    const parent = buildActorWatchlistCandidateHandoff({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      query: "Lumma C2",
      artifact: { id: "artifact_lumma_acme", kind: "tool", label: "Lumma C2" },
      terms: [{ kind: "domain", value: "acme.com" }],
      generatedAt: "2026-06-28T16:10:00.000Z"
    });
    const alert = alertFixture({ organizationId: "org_other" });

    expect(() => buildAlertCaseHandoff({ parent, alert })).toThrow(AnalystHandoffIdentityMismatchError);
  });

  test("adapter layer emits stable requests and webhook idempotency without UI glue", () => {
    const watchlist = publicTiArtifactToOrgWatchlistCreate({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      requestedByUserId: "user_analyst",
      query: "Lumma C2",
      artifact: {
        id: "artifact_lumma_acme",
        kind: "tool",
        label: "Lumma C2",
        confidence: 88,
        freshness: "2026-06-28T16:10:00.000Z",
        provenance: ["public TI profile", "telegram broker-room capture"],
        watchlistTerms: [{ kind: "domain", value: "acme.com", notes: "Observed in Lumma C2 broker-room context." }]
      },
      generatedAt: "2026-06-28T16:10:00.000Z"
    });
    expect(watchlist.ok).toBe(true);
    if (!watchlist.ok) throw new Error("watchlist adapter failed");
    expect(watchlist.value.request).toMatchObject({
      method: "POST",
      path: "/v1/dwm/watchlists",
      body: {
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        requestedByUserId: "user_analyst",
        actorQuery: "Lumma C2",
        artifactId: "artifact_lumma_acme",
        terms: [{ kind: "domain", value: "acme.com" }]
      }
    });

    const generation = orgWatchlistTermsToAlertGenerationRequest({
      parent: watchlist.value.handoff,
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      webhookDestinationIds: ["webhook_discord"],
      createdAt: "2026-06-28T16:11:00.000Z"
    });
    expect(generation.ok).toBe(true);
    if (!generation.ok) throw new Error("generation adapter failed");
    expect(generation.value.request.body).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      publicTiHandoffId: watchlist.value.handoff.handoffId
    });

    const alert = alertFixture({
      caseIdCandidate: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme"
    });
    const casePayload = persistedAlertToCaseHandoffPayload({
      parent: generation.value.handoff,
      alert,
      requestedByUserId: "user_analyst",
      createdAt: "2026-06-28T16:12:00.000Z"
    });
    expect(casePayload.ok).toBe(true);
    if (!casePayload.ok) throw new Error("case adapter failed");
    expect(casePayload.value.request.body).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "dwm_alert_acme",
      caseIdCandidate: "case_acme_lumma",
      captureIds: ["cap_handoff_acme"],
      watchlistItemIds: ["watch_item_acme_domain"]
    });

    const webhook = persistedAlertToWebhookTriggerContext({
      parent: casePayload.value.handoff,
      alert,
      requestedByUserId: "user_analyst",
      dryRun: true,
      createdAt: "2026-06-28T16:13:00.000Z"
    });
    expect(webhook.ok).toBe(true);
    if (!webhook.ok) throw new Error("webhook adapter failed");
    expect(webhook.value.request.body).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "dwm_alert_acme",
      dedupeKey: "dwm_dedupe_acme",
      webhookDestinationIds: ["webhook_discord"],
      captureIds: ["cap_handoff_acme"],
      dryRun: true
    });
    expect(webhook.value.idempotencyKey).toMatch(/^dwm_webhook_trigger_/);
    expect(webhook.value.idempotencyKey).toBe(webhook.value.request.body.idempotencyKey);
    expect(webhook.value.handoff.identity).toMatchObject({
      requestedByUserId: "user_analyst",
      actorQuery: "lumma c2",
      artifactId: "artifact_lumma_acme",
      watchlistId: "watch_acme",
      alertId: "dwm_alert_acme",
      caseIdCandidate: "case_acme_lumma"
    });
  });

  test("adapters return typed blockers for missing org, stale evidence, missing provenance, absent alert id, and unsupported artifacts", () => {
    const publicFailure = publicTiArtifactToOrgWatchlistCreate({
      tenantId: "tenant_acme",
      query: "Lumma C2",
      artifact: {
        id: "artifact_bad",
        kind: "note",
        label: "Unsupported note",
        freshness: "2026-01-01T00:00:00.000Z",
        watchlistTerms: []
      },
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z"
    });
    expect(publicFailure.ok).toBe(false);
    if (publicFailure.ok) throw new Error("expected public failure");
    const publicBlockers: AnalystHandoffBlockerCode[] = [
      "missing_org",
      "missing_provenance",
      "missing_watchlist_term",
      "stale_evidence",
      "unsupported_actor_artifact"
    ];
    expect(publicFailure.blockers.map(item => item.code).sort()).toEqual(publicBlockers.sort());

    const alertWithoutId = { ...alertFixture(), id: "" };
    const alertFailure = persistedAlertToCaseHandoffPayload({
      alert: {
        ...alertWithoutId,
        organizationId: undefined,
        workflowContext: { ...alertWithoutId.workflowContext, organizationId: undefined, captureIds: [] },
        webhookContext: { ...alertWithoutId.webhookContext, organizationId: undefined, captureIds: [] },
        provenance: { ...alertWithoutId.provenance, captureIds: [], sourceIds: [] },
        lastSeenAt: "2026-01-01T00:00:00.000Z"
      },
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z"
    });
    expect(alertFailure.ok).toBe(false);
    if (alertFailure.ok) throw new Error("expected alert failure");
    const alertBlockers: AnalystHandoffBlockerCode[] = [
      "absent_alert_id",
      "missing_org",
      "missing_provenance",
      "stale_evidence"
    ];
    expect(alertFailure.blockers.map(item => item.code).sort()).toEqual(alertBlockers.sort());
  });
});

function alertFixture(overrides: { organizationId?: string; caseIdCandidate?: string; casePath?: string } = {}): DwmAlert & {
  tenantId: string;
  organizationId: string;
  watchlistIds: string[];
  watchlistItemIds: string[];
  workflowContext: Record<string, unknown>;
  webhookContext: Record<string, unknown>;
  caseIdCandidate?: string;
  casePath?: string;
} {
  const snapshot = buildDwmProductSnapshot({
    tenantId: "tenant_acme",
    watchlist: [{ kind: "domain", value: "acme.com" }],
    sources: [source],
    captures: [capture],
    generatedAt: "2026-06-28T16:10:00.000Z",
    includeDemoIfEmpty: false
  });
  const alert = snapshot.alerts[0];
  return {
    ...alert,
    id: "dwm_alert_acme",
    dedupeKey: "dwm_dedupe_acme",
    webhookDelivery: { ...alert.webhookDelivery, dedupeKey: "dwm_dedupe_acme" },
    tenantId: "tenant_acme",
    organizationId: overrides.organizationId || "org_acme",
    watchlistIds: ["watch_acme"],
    watchlistItemIds: ["watch_item_acme_domain"],
    caseIdCandidate: overrides.caseIdCandidate,
    casePath: overrides.casePath,
    workflowContext: {
      tenantId: "tenant_acme",
      organizationId: overrides.organizationId || "org_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_handoff_acme"],
      caseIdCandidate: overrides.caseIdCandidate,
      casePath: overrides.casePath,
      dedupeKey: "dwm_dedupe_acme",
      recommendedRoute: "identity_response",
      webhookDestinationIds: ["webhook_discord"]
    },
    webhookContext: {
      tenantId: "tenant_acme",
      organizationId: overrides.organizationId || "org_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_handoff_acme"],
      evidenceCount: 1,
      dedupeKey: "dwm_dedupe_acme",
      recommendedRoute: "identity_response",
      caseIdCandidate: overrides.caseIdCandidate,
      casePath: overrides.casePath,
      webhookDestinationIds: ["webhook_discord"]
    }
  };
}
