import { describe, expect, test } from "bun:test";
import {
  ANALYST_HANDOFF_SCHEMA_VERSION,
  ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION,
  AnalystHandoffIdentityMismatchError,
  buildActorOrgRelevanceReadinessReport,
  buildActorWatchlistCandidateHandoff,
  buildAlertCaseHandoff,
  buildAlertWebhookTriggerHandoff,
  buildOrgScopedAlertWatchlistReadiness,
  buildWatchlistAlertGenerationHandoff,
  orgWatchlistTermsToAlertGenerationRequest,
  persistedAlertToCaseHandoffPayload,
  persistedAlertToWebhookTriggerContext,
  publicTiOrgRelevanceToAnalystHandoff,
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
  tenantId: "tenant_acme",
  createdAt: "2026-06-28T16:00:00.000Z",
  updatedAt: "2026-06-28T16:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_handoff_acme",
  sourceId: source.id,
  tenantId: "tenant_acme",
  url: "https://t.me/handoff_public/99",
  publishedAt: "2026-06-28T16:02:00.000Z",
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

  test("builds org-scoped watchlist alert readiness from the alert generation adapter", () => {
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

    const generation = orgWatchlistTermsToAlertGenerationRequest({
      parent: watchlist.value.handoff,
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      webhookDestinationIds: ["webhook_discord"],
      createdAt: "2026-06-28T16:11:00.000Z"
    });
    const readiness = buildOrgScopedAlertWatchlistReadiness({
      adapter: generation,
      checkedAt: "2026-06-28T16:12:00.000Z"
    });

    expect(readiness).toMatchObject({
      schemaVersion: ORG_ALERT_WATCHLIST_READINESS_SCHEMA_VERSION,
      ok: true,
      ownerLane: "alert",
      capability: "org_scoped_watchlist_alert_generation",
      checkedAt: "2026-06-28T16:12:00.000Z",
      route: "POST /v1/dwm/alerts/rebuild",
      routeHandler: "ti/scraper/src/api/dwmWorkflowRoutes.ts",
      storageModule: "ti/scraper/src/storage/dwmAlertRepository.ts",
      proofRowId: "org_scoped_alert_case_workflow",
      expectedAdapter: "orgWatchlistTermsToAlertGenerationRequest",
      proofCommand: "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun test src/tests/analystHandoff.test.ts",
      payloadShape: ["tenantId", "organizationId", "watchlistId", "watchlistItemIds", "publicTiHandoffId"],
      blockers: [],
      request: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          watchlistId: "watch_acme",
          watchlistItemIds: ["watch_item_acme_domain"],
          publicTiHandoffId: watchlist.value.handoff.handoffId
        }
      },
      handoff: {
        parentHandoffId: watchlist.value.handoff.handoffId,
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        watchlistId: "watch_acme",
        watchlistItemIds: ["watch_item_acme_domain"],
        webhookDestinationIds: ["webhook_discord"]
      },
      downstream: {
        caseRoute: "/v1/cases",
        webhookRoute: "/v1/dwm/webhooks/deliver",
        requiresOrgScopedWatchlist: true,
        requiresActiveWatchlistItems: true
      }
    });
    const serialized = JSON.stringify(readiness).toLowerCase();
    for (const phrase of ["control room", "how this feeds", "signal", "named examples", "dashboard slop", "acceptance criteria"]) {
      expect(serialized).not.toContain(phrase);
    }
  });

  test("returns typed org and alert blockers for incomplete watchlist alert readiness", () => {
    const parent = buildActorWatchlistCandidateHandoff({
      tenantId: "tenant_acme",
      query: "Lumma C2",
      artifact: { id: "artifact_lumma_acme", kind: "tool", label: "Lumma C2", provenance: ["public TI profile"] },
      terms: [{ kind: "domain", value: "acme.com" }],
      generatedAt: "2026-06-28T16:10:00.000Z"
    });
    const generation = orgWatchlistTermsToAlertGenerationRequest({
      parent,
      createdAt: "2026-06-28T16:11:00.000Z"
    });
    expect(generation.ok).toBe(false);
    const readiness = buildOrgScopedAlertWatchlistReadiness({
      adapter: generation,
      checkedAt: "2026-06-28T16:12:00.000Z"
    });

    expect(readiness.ok).toBe(false);
    expect(readiness.request).toBeUndefined();
    expect(readiness.handoff).toBeUndefined();
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing_org",
        ownerLane: "org",
        route: "GET /api/organizations/:id/watchlists/alert-terms",
        action: "export_shared_watchlist_terms"
      }),
      expect.objectContaining({
        code: "missing_watchlist_id",
        ownerLane: "alert",
        route: "POST /v1/dwm/alerts/rebuild",
        action: "rebuild_org_scoped_dwm_alerts"
      }),
      expect.objectContaining({
        code: "missing_watchlist_item",
        ownerLane: "alert",
        route: "POST /v1/dwm/alerts/rebuild",
        action: "rebuild_org_scoped_dwm_alerts"
      })
    ]));
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

  test("converts public actor org relevance into watchlist, alert, case, and webhook handoffs", () => {
    const relevance = publicTiOrgRelevanceFixture();
    const handoff = publicTiOrgRelevanceToAnalystHandoff({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      requestedByUserId: "user_ti",
      orgRelevance: relevance,
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z"
    });

    expect(handoff.ok).toBe(true);
    if (!handoff.ok) throw new Error("org relevance adapter failed");

    expect(handoff.value.schemaVersion).toBe("hanasand.actor_org_relevance_handoff.v1");
    expect(handoff.value.watchlist.request.body).toMatchObject({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      source: "public_ti",
      actorQuery: "apt29 microsoft",
      artifactId: "actor:apt29-microsoft",
      terms: [{ kind: "company", value: "Microsoft" }]
    });
    expect(handoff.value.alertGeneration.request.body).toMatchObject({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      watchlistId: "watchlist_microsoft",
      watchlistItemIds: ["watch_microsoft"]
    });
    expect(handoff.value.caseHandoff.request.body).toMatchObject({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      alertId: "dwm_alert_microsoft",
      caseIdCandidate: "case_microsoft_apt29",
      casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      captureIds: ["capture_microsoft_apt29"],
      watchlistItemIds: ["watch_microsoft"]
    });
    expect(handoff.value.webhookTrigger.request.body).toMatchObject({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      alertId: "dwm_alert_microsoft",
      webhookDestinationIds: ["webhook_soc"],
      captureIds: ["capture_microsoft_apt29"],
      dryRun: true
    });
    expect(handoff.value.webhookTrigger.idempotencyKey).toBe(handoff.value.webhookTrigger.request.body.idempotencyKey);
    expect(handoff.value.webhookTrigger.handoff.identity).toMatchObject({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      requestedByUserId: "user_ti",
      actorQuery: "apt29 microsoft",
      artifactId: "actor:apt29-microsoft",
      watchlistId: "watchlist_microsoft",
      watchlistItemIds: ["watch_microsoft"],
      alertId: "dwm_alert_microsoft",
      caseIdCandidate: "case_microsoft_apt29",
      webhookDestinationIds: ["webhook_soc"]
    });
    expect(handoff.value.sourceEvidence[0]).toMatchObject({
      sourceId: "microsoft",
      captureId: "capture_microsoft_apt29",
      provenance: "https://www.microsoft.com/en-us/security/blog/"
    });
    expect(handoff.value.affectedEntities.vendors?.[0]).toMatchObject({
      value: "Microsoft",
      matched: true,
      watchlistItemIds: ["watch_microsoft"],
      alertIds: ["dwm_alert_microsoft"]
    });
    expect(handoff.value.handoffRows.every(row => row.sourceFamily && Array.isArray(row.provenanceRefs))).toBe(true);

    for (const phrase of ["control room", "how this feeds", "signal", "named examples", "dashboard slop", "acceptance criteria"]) {
      expect(JSON.stringify(relevance).toLowerCase()).not.toContain(phrase);
      expect(JSON.stringify(handoff.value).toLowerCase()).not.toContain(phrase);
    }
  });

  test("returns collection blockers for incomplete public actor org relevance", () => {
    const broken = publicTiOrgRelevanceToAnalystHandoff({
      tenantId: "tenant_microsoft",
      orgRelevance: {
        ...publicTiOrgRelevanceFixture(),
        freshness: {
          generatedAt: "2026-06-29T08:00:00.000Z",
          lastSeen: "2026-01-01T00:00:00.000Z",
          stale: true,
          reason: "Old source."
        },
        organizationRefs: [],
        sourceEvidence: [],
        alertCaseRefs: [],
        handoffRows: []
      },
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z"
    });

    expect(broken.ok).toBe(false);
    if (broken.ok) throw new Error("expected broken org relevance handoff");
    const codes = new Set(broken.blockers.map(blocker => blocker.code));
    expect(codes.has("missing_org")).toBe(true);
    expect(codes.has("missing_watchlist_id")).toBe(true);
    expect(codes.has("missing_watchlist_item")).toBe(true);
    expect(codes.has("missing_provenance")).toBe(true);
    expect(codes.has("stale_evidence")).toBe(true);
    expect(codes.has("absent_alert_id")).toBe(true);
    expect(codes.has("missing_case_route")).toBe(true);
    expect(codes.has("missing_webhook_destination")).toBe(true);
    expect(broken.partial?.state).toBe("blocked");
  });

  test("builds machine-readable actor org relevance readiness rows for integration", () => {
    const report = buildActorOrgRelevanceReadinessReport({
      checkedAt: "2026-06-29T09:00:00.000Z",
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z",
      results: [{
        file: "apt29-microsoft.json",
        tenantId: "tenant_microsoft",
        organizationId: "org_microsoft",
        requestedByUserId: "user_ti",
        orgRelevance: publicTiOrgRelevanceFixture()
      }, {
        file: "blocked.json",
        tenantId: "tenant_microsoft",
        orgRelevance: {
          ...publicTiOrgRelevanceFixture(),
          actorIdentity: undefined,
          sourceCoverage: [],
          affectedEntities: {
            vendors: [],
            domains: [],
            regions: []
          },
          organizationRefs: [],
          sourceEvidence: [],
          alertCaseRefs: [],
          handoffRows: [],
          freshness: {
            generatedAt: "2026-06-29T08:00:00.000Z",
            lastSeen: "2026-01-01T00:00:00.000Z",
            stale: true,
            reason: "Old source."
          }
        }
      }]
    });

    expect(report.schemaVersion).toBe("hanasand.actor_org_relevance.readiness_report.v1");
    expect(report.checkedAt).toBe("2026-06-29T09:00:00.000Z");
    expect(report.ok).toBe(false);
    expect(report.readyCount).toBe(1);
    expect(report.blockedCount).toBe(1);
    const ready = report.rows.find(row => row.file === "apt29-microsoft.json");
    expect(ready).toMatchObject({
      ok: true,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      actor: {
        canonicalName: "APT29",
        aliasCount: 2,
        sectorCount: 1,
        regionCount: 1,
        sourceCoverageCount: 1
      },
      handoffs: { watchlist: true, alertGeneration: true, caseHandoff: true, webhookTrigger: true },
      coverage: {
        organizationRefs: 1,
        watchlistTerms: 1,
        sourceEvidence: 1,
        affectedVendors: 1,
        affectedDomains: 1,
        affectedRegions: 1,
        relatedAlerts: 1,
        relatedCases: 1,
        webhookDestinations: 1
      }
    });
    expect(ready?.provenance.some(row => row.sourceId === "microsoft" && row.captureId === "capture_microsoft_apt29")).toBe(true);
    expect(ready?.enrichmentGaps).toEqual([]);
    const blocked = report.rows.find(row => row.file === "blocked.json");
    const expectedGapCodes = [
      "missing_actor_aliases",
      "missing_provenance",
      "missing_source_coverage",
      "missing_target_regions",
      "missing_target_sectors",
      "stale_evidence"
    ] as const;
    expect(blocked?.enrichmentGaps.map(gap => gap.code).sort()).toEqual([...expectedGapCodes].sort());
    expect(report.productReadiness.org.blockerCodes).toContain("missing_org");
    expect(report.productReadiness.source.blockerCodes).toContain("missing_provenance");
    expect(report.productReadiness.case.blockerCodes).toContain("missing_case_route");
    expect(report.productReadiness.webhook.blockerCodes).toContain("missing_webhook_destination");
  });
});

function publicTiOrgRelevanceFixture() {
  return {
    schemaVersion: "ti.public_actor.org_relevance.v1",
    state: "ready",
    actorId: "actor:apt29-microsoft",
    query: "apt29 microsoft",
    generatedAt: "2026-06-29T08:00:00.000Z",
    actorIdentity: {
      canonicalName: "APT29",
      aliases: ["Midnight Blizzard", "Nobelium"],
      actorClass: "State-linked espionage actor",
      sectors: ["Technology"],
      regions: ["United States"],
      motivations: ["Strategic intelligence collection"]
    },
    freshness: {
      generatedAt: "2026-06-29T08:00:00.000Z",
      lastSeen: "2026-06-29T00:00:00.000Z",
      stale: false,
      reason: "Fresh source evidence is attached."
    },
    sourceCoverage: [{
      sourceId: "microsoft",
      sourceName: "Microsoft",
      sourceFamily: "vendor_disclosure",
      status: "active",
      lastCollectedAt: "2026-06-29T00:00:00.000Z",
      coverage: "primary",
      captureIds: ["capture_microsoft_apt29"]
    }],
    organizationRefs: [{
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      watchlistId: "watchlist_microsoft",
      watchlistItemId: "watch_microsoft",
      kind: "company" as const,
      value: "Microsoft",
      route: "organization_watchlist",
      casePath: "/dashboard/dwm?organizationId=org_microsoft&watchlistItemId=watch_microsoft"
    }],
    candidateTerms: [{
      kind: "company" as const,
      value: "Microsoft",
      notes: "Source reporting names Microsoft identity activity.",
      matched: true,
      sourceEvidenceRefs: ["microsoft", "capture_microsoft_apt29", "https://www.microsoft.com/en-us/security/blog/"]
    }],
    sourceEvidence: [{
      sourceId: "microsoft",
      sourceName: "Microsoft",
      provenance: "https://www.microsoft.com/en-us/security/blog/",
      captureId: "capture_microsoft_apt29",
      confidence: 0.84,
      supportsTerms: ["Microsoft"]
    }],
    alertCaseRefs: [{
      alertId: "dwm_alert_microsoft",
      casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      caseIdCandidate: "case_microsoft_apt29",
      organizationId: "org_microsoft",
      tenantId: "tenant_microsoft",
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: ["webhook_soc"]
    }],
    affectedEntities: {
      vendors: [{
        value: "Microsoft",
        matched: true,
        provenanceRefs: ["microsoft", "capture_microsoft_apt29"],
        watchlistItemIds: ["watch_microsoft"],
        alertIds: ["dwm_alert_microsoft"]
      }],
      domains: [{
        value: "microsoft.com",
        matched: false,
        provenanceRefs: ["capture_microsoft_apt29"],
        watchlistItemIds: [],
        alertIds: ["dwm_alert_microsoft"]
      }],
      regions: [{
        value: "United States",
        matched: false,
        provenanceRefs: ["capture_microsoft_apt29"],
        watchlistItemIds: [],
        alertIds: ["dwm_alert_microsoft"]
      }]
    },
    handoffRows: [{
      rowId: "watchlist:watch_microsoft",
      kind: "watchlist_match",
      state: "ready",
      ownerLane: "org",
      label: "Microsoft",
      action: "Open saved watchlist item",
      route: "/dashboard/dwm",
      sourceFamily: "watchlist",
      provenanceRefs: ["watchlist_microsoft", "watch_microsoft"],
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      watchlistId: "watchlist_microsoft",
      watchlistItemId: "watch_microsoft",
      captureIds: [],
      webhookDestinationIds: [],
      blockers: []
    }, {
      rowId: "source:microsoft:capture_microsoft_apt29",
      kind: "source_evidence",
      state: "ready",
      ownerLane: "source",
      label: "Microsoft",
      action: "Use capture as evidence",
      route: "/dashboard/ti/enrichment",
      sourceFamily: "vendor_disclosure",
      provenanceRefs: ["microsoft", "capture_microsoft_apt29", "https://www.microsoft.com/en-us/security/blog/"],
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: [],
      blockers: []
    }, {
      rowId: "alert:dwm_alert_microsoft",
      kind: "alert_case",
      state: "ready",
      ownerLane: "case",
      label: "dwm_alert_microsoft",
      action: "Open related case",
      route: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      sourceFamily: "case",
      provenanceRefs: ["dwm_alert_microsoft", "case_microsoft_apt29", "capture_microsoft_apt29"],
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      alertId: "dwm_alert_microsoft",
      casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: ["webhook_soc"],
      blockers: []
    }, {
      rowId: "webhook:dwm_alert_microsoft",
      kind: "webhook_delivery",
      state: "ready",
      ownerLane: "webhook",
      label: "dwm_alert_microsoft",
      action: "Prepare delivery dry run",
      route: "/v1/dwm/webhooks/deliver",
      sourceFamily: "webhook",
      provenanceRefs: ["dwm_alert_microsoft", "capture_microsoft_apt29", "webhook_soc"],
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      alertId: "dwm_alert_microsoft",
      casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
      captureIds: ["capture_microsoft_apt29"],
      webhookDestinationIds: ["webhook_soc"],
      blockers: []
    }],
    blockers: []
  };
}

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
    generatedAt: "2026-06-28T16:10:00.000Z"
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
