import { describe, expect, test } from "bun:test";
import {
  ACTOR_ORG_RELEVANCE_CASE_EVIDENCE_PACKET_SCHEMA_VERSION,
  buildActorOrgRelevanceCaseEvidencePacket,
  buildActorOrgRelevanceReviewRecord,
  createActorOrgRelevanceAlertGenerationRequest,
  createActorOrgRelevanceCaseHandoffRequest,
  materializeActorOrgRelevanceWatchlist
} from "../product/actorOrgRelevanceQueue.ts";

describe("actor org relevance case evidence packet", () => {
  test("packages actor enrichment and source provenance for case handoff consumers", () => {
    const record = buildActorOrgRelevanceReviewRecord({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      requestedByUserId: "user_ti",
      orgRelevance: readyRelevance() as any,
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z",
      generatedAt: "2026-06-29T09:30:00.000Z"
    });
    const watchlist = materializeActorOrgRelevanceWatchlist({
      record,
      materialize: {
        actorId: "user_ti",
        webhookDestinationId: "webhook_soc",
        generatedAt: "2026-06-29T10:17:00.000Z"
      }
    });
    expect(watchlist.ok).toBe(true);
    if (!watchlist.ok) throw new Error("watchlist materialization failed");

    const alertGeneration = createActorOrgRelevanceAlertGenerationRequest({
      record: watchlist.record,
      watchlist: watchlist.watchlist,
      request: {
        actorId: "user_ti",
        generatedAt: "2026-06-29T10:18:00.000Z"
      }
    });
    expect(alertGeneration.ok).toBe(true);
    if (!alertGeneration.ok) throw new Error("alert generation request failed");

    const caseHandoff = createActorOrgRelevanceCaseHandoffRequest({
      record: alertGeneration.record,
      request: {
        actorId: "user_ti",
        generatedAt: "2026-06-29T10:19:00.000Z"
      }
    });
    expect(caseHandoff.ok).toBe(true);
    if (!caseHandoff.ok) throw new Error("case handoff request failed");

    const packet = buildActorOrgRelevanceCaseEvidencePacket({
      record: caseHandoff.record,
      generatedAt: "2026-06-29T10:20:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: ACTOR_ORG_RELEVANCE_CASE_EVIDENCE_PACKET_SCHEMA_VERSION,
      generatedAt: "2026-06-29T10:20:00.000Z",
      ok: true,
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      reviewId: record.id,
      actorId: "actor:apt29-microsoft",
      query: "apt29 microsoft",
      redacted: true,
      actor: {
        canonicalName: "APT29",
        aliases: ["Midnight Blizzard", "Nobelium"],
        actorClass: "State-linked espionage actor",
        sectors: ["Technology"],
        regions: ["United States"],
        motivations: ["Strategic intelligence collection"]
      },
      caseHandoff: {
        receiptId: caseHandoff.receipt.id,
        alertGenerationReceiptId: alertGeneration.receipt.id,
        method: "POST",
        route: "/v1/cases",
        casePath: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
        alertId: "dwm_alert_microsoft",
        caseIdCandidate: "case_microsoft_apt29",
        recommendedRoute: "analyst_review",
        priority: "high"
      },
      watchlist: {
        terms: [{ kind: "company", value: "Microsoft" }],
        watchlistItemIds: ["watch_microsoft"]
      },
      evidence: {
        redacted: true,
        evidenceCount: 1,
        captureIds: ["capture_microsoft_apt29"],
        sourceIds: ["microsoft"],
        sourceFamilies: ["public_advisory"],
        provenance: [{
          sourceId: "microsoft",
          sourceName: "Microsoft",
          captureId: "capture_microsoft_apt29",
          provenance: "https://www.microsoft.com/en-us/security/blog/",
          confidence: 0.84,
          supportsTerms: ["Microsoft"]
        }]
      },
      routes: {
        review: `/v1/ti/actor-org-relevance/${record.id}`,
        publicTi: "/ti/apt29%20microsoft",
        case: "/v1/cases/case_microsoft_apt29?alertId=dwm_alert_microsoft",
        alertGeneration: `/v1/ti/actor-org-relevance/${record.id}/alert-generation-request`,
        webhookTrigger: `/v1/ti/actor-org-relevance/${record.id}/webhook-trigger-request`
      },
      blockers: [],
      nextActions: []
    });
    expect(packet.caseHandoff?.idempotencyKey).toMatch(/^actor_org_relevance_case_handoff_idempotency_/);
    expect(JSON.stringify(packet)).not.toContain("payloadBody");
    expect(JSON.stringify(packet)).not.toContain("rawEvidence");
    const serialized = JSON.stringify(packet).toLowerCase();
    for (const phrase of [["control", "room"], ["dashboard", "slop"]]) {
      expect(serialized).not.toContain(phrase.join(" "));
    }
  });

  test("blocks case evidence packet before alert and case receipts exist", () => {
    const record = buildActorOrgRelevanceReviewRecord({
      tenantId: "tenant_microsoft",
      organizationId: "org_microsoft",
      requestedByUserId: "user_ti",
      orgRelevance: readyRelevance() as any,
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z",
      generatedAt: "2026-06-29T09:30:00.000Z"
    });

    const packet = buildActorOrgRelevanceCaseEvidencePacket({
      record,
      generatedAt: "2026-06-29T10:00:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: ACTOR_ORG_RELEVANCE_CASE_EVIDENCE_PACKET_SCHEMA_VERSION,
      ok: false,
      caseHandoff: undefined,
      evidence: {
        evidenceCount: 0,
        captureIds: [],
        sourceIds: [],
        sourceFamilies: []
      }
    });
    expect(packet.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_alert_generation_receipt", ownerLane: "alert", path: "record.alertGenerationReceipts" }),
      expect.objectContaining({ code: "missing_case_handoff_receipt", ownerLane: "case", path: "record.caseHandoffReceipts" })
    ]));
    expect(packet.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "prepare_alert_generation",
        route: `/v1/ti/actor-org-relevance/${record.id}/alert-generation-request`
      }),
      expect.objectContaining({
        action: "prepare_case_handoff",
        route: `/v1/ti/actor-org-relevance/${record.id}/case-handoff-request`
      })
    ]));
  });
});

function readyRelevance() {
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
      kind: "company",
      value: "Microsoft",
      route: "organization_watchlist",
      casePath: "/dashboard/dwm?organizationId=org_microsoft&watchlistItemId=watch_microsoft"
    }],
    candidateTerms: [{
      kind: "company",
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
