import { describe, expect, test } from "bun:test";
import {
  TI_SOURCE_PROVENANCE_ALERT_REBUILD_READINESS_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_REBUILD_REQUEST_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
  buildSourceProvenanceAlertabilityBridge,
  buildSourceProvenanceAlertRebuildReadiness,
  buildSourceProvenanceAlertRebuildRequest,
  buildSourceProvenanceOrgWatchlistCandidate,
  buildSourceProvenanceTiPageContract
} from "../product/sourceProvenanceTiPageContract.ts";
import { orgWatchlistContractToRuntimeDwmWatchlists } from "../storage/dwmOrgWatchlistBridge.ts";

describe("source provenance TI page contract", () => {
  test("builds public TI page provenance payload from fresh source evidence", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow(), {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceName: "Actor profile",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        provenance: "Actor profile cites campaign and infrastructure observations.",
        confidence: 0.74,
        relationship: "infrastructure"
      }]
    });

    expect(contract).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      page: {
        route: "/ti/APT29",
        customerVisible: true,
        redacted: true
      },
      summary: {
        sourceCount: 2,
        captureCount: 2,
        activeSourceCount: 2,
        sourceFamilies: ["telegram_public", "actor_page"],
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        averageConfidence: 0.8,
        actionRequiredCount: 0,
        operatorActionTypes: []
      },
      blockers: [],
      operatorActions: []
    });
    expect(contract.rows).toEqual([
      expect.objectContaining({
        sourceId: "src_telegram",
        captureId: "cap_telegram_apt29",
        contentHash: "hash_telegram_apt29",
        confidence: 0.86,
        ready: true,
        blockerCodes: [],
        operatorActions: []
      }),
      expect.objectContaining({
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        relationship: "infrastructure",
        ready: true
      })
    ]);
    expect(contract.page.payloadShape).toEqual(expect.arrayContaining(["rows[].sourceId", "rows[].captureId", "rows[].contentHash", "blockers[]"]));
    expect(JSON.stringify(contract)).not.toContain("rawText");
    expect(JSON.stringify(contract)).not.toContain("password");
  });

  test("returns owner-coded blockers for incomplete stale or cross-org provenance", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      maxAgeDays: 30,
      rows: [{
        ...sourceRow(),
        sourceId: undefined,
        captureId: undefined,
        contentHash: undefined,
        provenance: undefined,
        capturedAt: "2025-01-01T00:00:00.000Z",
        sourceStatus: "paused"
      }, {
        ...sourceRow(),
        organizationId: "org_other",
        captureId: "cap_other_org",
        contentHash: "hash_other_org"
      }]
    });

    expect(contract.ok).toBe(false);
    expect(contract.rows[0]).toMatchObject({
      ready: false,
      blockerCodes: expect.arrayContaining([
        "missing_source_id",
        "missing_capture_id",
        "missing_content_hash",
        "missing_provenance",
        "inactive_source",
        "stale_evidence"
      ])
    });
    expect(contract.rows[1]).toMatchObject({
      ready: false,
      blockerCodes: ["organization_scope_mismatch"]
    });
    expect(contract.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_source_id", ownerLane: "source", path: "rows[].sourceId" }),
      expect.objectContaining({ code: "stale_evidence", ownerLane: "source", path: "rows[].capturedAt" }),
      expect.objectContaining({ code: "organization_scope_mismatch", ownerLane: "publicTI", path: "rows[].organizationId" })
    ]));
    expect(contract.summary).toMatchObject({
      actionRequiredCount: 2,
      operatorActionTypes: expect.arrayContaining([
        "attach_source_identity",
        "record_capture",
        "record_content_hash",
        "record_provenance",
        "review_source_activation",
        "retry_capture",
        "fix_organization_scope"
      ])
    });
    expect(contract.operatorActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "record_capture",
        ownerLane: "source",
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          dryRunSupported: true,
          liveNetworkFetch: false,
          body: expect.objectContaining({ action: "record_capture", actor: "APT29", dryRun: true })
        }),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      }),
      expect.objectContaining({
        action: "fix_organization_scope",
        ownerLane: "publicTI",
        route: expect.objectContaining({
          path: "/v1/actor-org-relevance/review",
          liveNetworkFetch: false
        })
      })
    ]));
    expect(contract.rows[0].operatorActions.map((action) => action.action)).toEqual(expect.arrayContaining([
      "attach_source_identity",
      "record_capture",
      "record_content_hash",
      "record_provenance",
      "review_source_activation",
      "retry_capture"
    ]));
    expect(JSON.stringify(contract.operatorActions)).not.toContain("password");
    expect(JSON.stringify(contract.operatorActions)).not.toContain("rawText");
  });

  test("bridges ready source provenance into alertable watchlist terms", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow(), {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        relationship: "infrastructure",
        confidence: 0.74
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract });

    expect(bridge).toMatchObject({
      schemaVersion: "ti.source_provenance_alertability_bridge.v1",
      ok: true,
      canCreateWatchlistTerms: true,
      canRequestAlertGeneration: true,
      sourceContractId: contract.id,
      blockers: []
    });
    expect(bridge.watchlistTerms).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: "APT29",
        kind: "actor",
        sourceIds: expect.arrayContaining(["src_telegram", "src_actor_page"]),
        captureIds: expect.arrayContaining(["cap_telegram_apt29", "cap_actor_page_apt29"]),
        alertGenerationRef: expect.objectContaining({
          schemaVersion: "organization.watchlist_alert_generation_ref.v1",
          organizationId: "org_acme",
          source: "public_ti_source_provenance"
        })
      }),
      expect.objectContaining({ value: "telegram_public", kind: "source_family" }),
      expect.objectContaining({ value: "infrastructure", kind: "relationship" })
    ]));
    expect(bridge.payloadShape).toEqual(expect.arrayContaining(["watchlistTerms[].alertGenerationRef", "watchlistTerms[].captureIds", "blockers[]"]));
  });

  test("maps alertable source provenance to an org watchlist alert terms export", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow()]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract, includeSourceFamilies: false, includeRelationships: false });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({
      bridge,
      watchlistId: "watch_public_ti_apt29",
      createdBy: "analyst@acme.example",
      requestId: "req_source_provenance_1",
      reason: "Materialize public TI actor coverage."
    });

    expect(candidate).toMatchObject({
      schemaVersion: "organization.watchlist_alert_terms_export.v1",
      artifactId: "ti_source_provenance.org_watchlist_candidate",
      ok: true,
      redacted: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlistId: "watch_public_ti_apt29",
      canGenerateAlerts: true,
      blockedReasons: [],
      blockers: []
    });
    expect(candidate.payloadShape).toEqual(expect.arrayContaining([
      "activeTerms[].alertGenerationRef",
      "activeTerms[].provenanceRefs",
      "blockers[]"
    ]));
    expect(candidate.activeTerms).toEqual([
      expect.objectContaining({
        organizationId: "org_acme",
        tenantId: "tenant_acme",
        watchlistId: "watch_public_ti_apt29",
        kind: "actor",
        termFamily: "actor",
        term: "APT29",
        value: "APT29",
        status: "active",
        createdBy: "analyst@acme.example",
        lifecycleReason: "Materialize public TI actor coverage.",
        lifecycleRequestId: "req_source_provenance_1",
        provenanceRefs: expect.objectContaining({
          sourceContractId: contract.id,
          sourceBridgeId: bridge.id,
          sourceIds: ["src_telegram"],
          captureIds: ["cap_telegram_apt29"],
          contentHashes: ["hash_telegram_apt29"],
          confidence: 0.86
        }),
        alertGenerationRef: expect.objectContaining({
          schemaVersion: "organization.watchlist_alert_generation_ref.v1",
          source: "organization_shared_watchlist",
          organizationId: "org_acme",
          tenantId: "tenant_acme",
          ownerOrganizationId: "org_acme",
          watchlistId: "watch_public_ti_apt29",
          termFamily: "actor",
          category: "actor",
          term: "APT29",
          normalizedTerm: "apt29",
          status: "active",
          lifecycle: expect.objectContaining({
            status: "active",
            requestId: "req_source_provenance_1",
            createdBy: "analyst@acme.example"
          }),
          dedupe: expect.objectContaining({
            scope: "organization_watchlist_term",
            parts: expect.objectContaining({
              organizationId: "org_acme",
              tenantId: "tenant_acme",
              termFamily: "actor",
              normalizedTerm: "apt29"
            })
          })
        })
      })
    ]);
    expect(candidate.activeTerms[0].alertGeneratorKey).toBe(candidate.activeTerms[0].alertGenerationRef.dedupe.key);
    const runtimeWatchlists = orgWatchlistContractToRuntimeDwmWatchlists({
      organizationId: candidate.organizationId ?? "",
      tenantId: candidate.tenantId,
      activeTerms: candidate.activeTerms,
      canGenerateAlerts: candidate.canGenerateAlerts,
      blockedReasons: candidate.blockedReasons
    });
    expect(runtimeWatchlists[0]).toMatchObject({
      id: "watch_public_ti_apt29",
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      status: "active",
      orgWatchlistTerms: [expect.objectContaining({
        term: "APT29",
        termFamily: "actor",
        alertGeneratorKey: candidate.activeTerms[0].alertGeneratorKey,
        alertGenerationRef: expect.objectContaining({
          schemaVersion: "organization.watchlist_alert_generation_ref.v1",
          organizationId: "org_acme"
        })
      })]
    });
    expect(JSON.stringify(candidate)).not.toContain("rawText");
    expect(JSON.stringify(candidate)).not.toContain("password");
  });

  test("maps source provenance watchlist candidate to alert rebuild request", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow()]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract, includeSourceFamilies: false, includeRelationships: false });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({
      bridge,
      watchlistId: "watch_public_ti_apt29"
    });
    const request = buildSourceProvenanceAlertRebuildRequest({
      candidate,
      sourceContractId: contract.id
    });

    expect(request).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ALERT_REBUILD_REQUEST_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourceCandidateId: candidate.id,
      blockers: [],
      request: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          watchlistId: "watch_public_ti_apt29",
          watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
          alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
          sourceBridgeId: bridge.id,
          sourceContractId: contract.id,
          dryRun: true
        }
      }
    });
    expect(request.payloadShape).toEqual(expect.arrayContaining([
      "request.body.watchlistItemIds",
      "request.body.alertGeneratorKeys",
      "blockers[]"
    ]));
    expect(JSON.stringify(request)).not.toContain("rawText");
    expect(JSON.stringify(request)).not.toContain("password");
  });

  test("packages source provenance into alert rebuild readiness for downstream alert workflow", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow(), {
        ...sourceRow(),
        sourceId: "src_public_advisory",
        sourceName: "Public advisory",
        sourceFamily: "public_advisory",
        captureId: "cap_public_advisory_apt29",
        contentHash: "hash_public_advisory_apt29",
        provenance: "Public advisory links APT29 to observed phishing infrastructure.",
        relationship: "targeting",
        confidence: 0.78
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({
      bridge,
      watchlistId: "watch_public_ti_apt29",
      requestId: "req_source_rebuild_ready"
    });
    const request = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
    const readiness = buildSourceProvenanceAlertRebuildReadiness({ contract, bridge, candidate, request });

    expect(readiness).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ALERT_REBUILD_READINESS_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      sourceContractId: contract.id,
      sourceBridgeId: bridge.id,
      watchlistCandidateId: candidate.id,
      alertRebuildRequestId: request.id,
      sourceCoverage: {
        sourceFamilies: expect.arrayContaining(["telegram_public", "public_advisory"]),
        sourceIds: expect.arrayContaining(["src_telegram", "src_public_advisory"]),
        captureIds: expect.arrayContaining(["cap_telegram_apt29", "cap_public_advisory_apt29"]),
        contentHashes: expect.arrayContaining(["hash_telegram_apt29", "hash_public_advisory_apt29"]),
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        averageConfidence: 0.82
      },
      readiness: {
        canCreateWatchlistTerms: true,
        canGenerateAlerts: true,
        canRequestAlertRebuild: true,
        dryRunOnly: true,
        liveNetworkFetch: false
      },
      alertRequest: expect.objectContaining({
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: expect.objectContaining({
          dryRun: true,
          alertGeneratorKeys: expect.arrayContaining(candidate.activeTerms.map((term) => term.alertGeneratorKey))
        })
      }),
      blockers: [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(readiness.nextOperatorActions).toEqual([
      expect.objectContaining({
        action: "request_alert_rebuild",
        ownerLane: "alert",
        route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false })
      })
    ]);
    expect(readiness.payloadShape).toEqual(expect.arrayContaining([
      "sourceCoverage.sourceFamilies",
      "alertRequest.body.alertGeneratorKeys",
      "nextOperatorActions[]"
    ]));
    expect(JSON.stringify(readiness)).not.toContain("rawText");
    expect(JSON.stringify(readiness)).not.toContain("password");
  });

  test("blocks alertability when source provenance is not ready or org scope is absent", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [{
        ...sourceRow(),
        organizationId: undefined,
        captureId: undefined,
        contentHash: undefined
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract });

    expect(bridge.ok).toBe(false);
    expect(bridge.canCreateWatchlistTerms).toBe(false);
    expect(bridge.canRequestAlertGeneration).toBe(false);
    expect(bridge.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_organization_scope", ownerLane: "org" }),
      expect.objectContaining({ code: "source_provenance_not_ready", ownerLane: "source" })
    ]));
  });

  test("does not emit org watchlist terms when provenance alertability is blocked", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [{
        ...sourceRow(),
        organizationId: undefined,
        captureId: undefined,
        contentHash: undefined
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({ bridge });

    expect(candidate).toMatchObject({
      schemaVersion: "organization.watchlist_alert_terms_export.v1",
      ok: false,
      canGenerateAlerts: false,
      activeTerms: [],
      blockedReasons: expect.arrayContaining(["missing_organization_scope", "source_provenance_not_ready"])
    });
    expect(candidate.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_organization_scope", ownerLane: "org" }),
      expect.objectContaining({ code: "source_provenance_not_ready", ownerLane: "source" })
    ]));
    expect(JSON.stringify(candidate)).not.toContain("cap_telegram_apt29");
    expect(JSON.stringify(candidate)).not.toContain("hash_telegram_apt29");
  });

  test("blocks alert rebuild request when source provenance candidate is not materialized", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [{
        ...sourceRow(),
        organizationId: undefined,
        captureId: undefined,
        contentHash: undefined
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({ bridge });
    const request = buildSourceProvenanceAlertRebuildRequest({ candidate });

    expect(request.ok).toBe(false);
    expect(request.request).toMatchObject({
      method: "POST",
      path: "/v1/dwm/alerts/rebuild",
      body: {
        tenantId: "tenant_acme",
        watchlistItemIds: [],
        alertGeneratorKeys: [],
        sourceBridgeId: bridge.id,
        dryRun: true
      }
    });
    expect(request.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "watchlist_candidate_blocked", ownerLane: "publicTI", path: "candidate.ok" }),
      expect.objectContaining({ code: "missing_organization_scope", ownerLane: "org", path: "candidate.organizationId" }),
      expect.objectContaining({ code: "missing_watchlist_id", ownerLane: "org", path: "candidate.watchlistId" }),
      expect.objectContaining({ code: "missing_watchlist_items", ownerLane: "org", path: "candidate.activeTerms[].watchlistItemId" }),
      expect.objectContaining({ code: "missing_alert_generation_refs", ownerLane: "alert", path: "candidate.activeTerms[].alertGeneratorKey" })
    ]));
  });

  test("keeps alert rebuild readiness blocked until source provenance is complete", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [{
        ...sourceRow(),
        organizationId: undefined,
        captureId: undefined,
        contentHash: undefined,
        provenance: undefined,
        sourceStatus: "paused"
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({ bridge });
    const request = buildSourceProvenanceAlertRebuildRequest({ candidate });
    const readiness = buildSourceProvenanceAlertRebuildReadiness({ contract, bridge, candidate, request });

    expect(readiness.ok).toBe(false);
    expect(readiness.sourceCoverage).toMatchObject({
      sourceFamilies: [],
      sourceIds: [],
      captureIds: [],
      contentHashes: [],
      averageConfidence: 0
    });
    expect(readiness.readiness).toMatchObject({
      canCreateWatchlistTerms: false,
      canGenerateAlerts: false,
      canRequestAlertRebuild: false,
      dryRunOnly: true,
      liveNetworkFetch: false
    });
    expect(readiness.nextOperatorActions).toEqual([
      expect.objectContaining({
        action: "fix_source_provenance",
        ownerLane: "source",
        route: expect.objectContaining({ path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      })
    ]);
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_capture_id", path: "rows[].captureId" }),
      expect.objectContaining({ code: "missing_content_hash", path: "rows[].contentHash" }),
      expect.objectContaining({ code: "missing_provenance", path: "rows[].provenance" }),
      expect.objectContaining({ code: "inactive_source", path: "rows[].sourceStatus" }),
      expect.objectContaining({ code: "watchlist_candidate_blocked", path: "candidate.ok" }),
      expect.objectContaining({ code: "missing_alert_generation_refs", path: "candidate.activeTerms[].alertGeneratorKey" })
    ]));
    expect(JSON.stringify(readiness)).not.toContain("rawText");
    expect(JSON.stringify(readiness)).not.toContain("password");
  });
});

function sourceRow() {
  return {
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    actor: "APT29",
    sourceId: "src_telegram",
    sourceName: "Public Telegram channel",
    sourceFamily: "telegram_public",
    sourceStatus: "active",
    captureId: "cap_telegram_apt29",
    capturedAt: "2026-06-29T10:15:00.000Z",
    contentHash: "hash_telegram_apt29",
    provenance: "Public channel capture mentions APT29 infrastructure and phishing activity.",
    confidence: 0.86,
    route: "/ti/APT29",
    relationship: "actor_activity"
  };
}
