import { describe, expect, test } from "bun:test";
import {
  TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
  buildSourceProvenanceAlertabilityBridge,
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
