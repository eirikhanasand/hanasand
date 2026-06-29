import { describe, expect, test } from "bun:test";
import {
  TI_SOURCE_PROVENANCE_ACTOR_PROFILE_CONTRACT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_PROFILE_GAP_SOURCE_PLAN_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_PROFILE_SOURCE_UPDATE_WORKFLOW_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_ENRICHMENT_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CASE_HANDOFF_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_REBUILD_READINESS_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_REBUILD_REQUEST_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_ACTIVATION_READINESS_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_REQUEST_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SCRAPER_ENRICHMENT_LIFECYCLE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_HANDOFF_STATE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_OPS_FIXTURE_BUNDLE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PUBLIC_TI_SOURCE_OPS_PROJECTION_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_WATCHLIST_ALERT_BRIDGE_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
  buildSourceProvenanceAlertabilityBridge,
  buildSourceProvenanceActorProfileContract,
  buildSourceProvenanceActorProfileGapSourcePlan,
  buildSourceProvenanceActorProfileSourceUpdateWorkflow,
  buildSourceProvenanceActorEnrichmentCaseHandoff,
  buildSourceProvenanceAlertEnrichmentPacket,
  buildSourceProvenanceAlertRebuildReceipt,
  buildSourceProvenanceAlertRebuildReadiness,
  buildSourceProvenanceAlertRebuildRequest,
  buildSourceProvenanceSourcePackActivationReadiness,
  buildSourceProvenanceSourcePackIntakeRequest,
  buildSourceProvenanceSourcePackIntakeReceipt,
  buildSourceProvenanceScraperEnrichmentLifecycle,
  buildSourceProvenanceSourceFreshnessGapPacket,
  buildSourceProvenanceParserHealthAlertPacket,
  buildSourceProvenanceAlertHandoffState,
  buildSourceProvenanceSourceOpsActionQueue,
  buildSourceProvenanceSourceOpsFixtureBundle,
  buildSourceProvenancePublicTiSourceOpsProjection,
  buildSourceProvenanceWatchlistAlertBridgePacket,
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

  test("packages source provenance watchlist terms for alert rebuild consumers", () => {
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
      requestId: "req_bridge_packet"
    });
    const request = buildSourceProvenanceAlertRebuildRequest({
      candidate,
      sourceContractId: contract.id
    });
    const packet = buildSourceProvenanceWatchlistAlertBridgePacket({
      candidate,
      request,
      generatedAt: "2026-06-29T12:01:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_WATCHLIST_ALERT_BRIDGE_PACKET_SCHEMA_VERSION,
      generatedAt: "2026-06-29T12:01:00.000Z",
      ok: true,
      redacted: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      watchlistId: "watch_public_ti_apt29",
      sourceBridgeId: bridge.id,
      sourceCandidateId: candidate.id,
      alertRebuildRequestId: request.id,
      bridge: {
        source: "public_ti_source_provenance",
        from: "organization.watchlist_alert_terms_export.v1",
        to: "/v1/dwm/alerts/rebuild",
        dryRunOnly: true,
        liveNetworkFetch: false
      },
      watchlist: {
        activeTermCount: 1,
        watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
        alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
        terms: [{
          watchlistItemId: candidate.activeTerms[0].watchlistItemId,
          term: "APT29",
          normalizedTerm: "apt29",
          kind: "actor",
          alertGeneratorKey: candidate.activeTerms[0].alertGeneratorKey,
          captureIds: ["cap_telegram_apt29"],
          sourceIds: ["src_telegram"],
          contentHashes: ["hash_telegram_apt29"]
        }]
      },
      alertRequest: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          watchlistId: "watch_public_ti_apt29",
          dryRun: true
        }
      },
      blockers: [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "watchlist.watchlistItemIds",
      "watchlist.alertGeneratorKeys",
      "alertRequest.body.sourceBridgeId",
      "blockers[]"
    ]));
    expect(packet.nextActions).toEqual([
      expect.objectContaining({ action: "request_alert_rebuild", ownerLane: "alert" })
    ]);
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
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

  test("proves alert rebuild response preserves source provenance and case handoff", () => {
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
      requestId: "req_source_rebuild_receipt"
    });
    const request = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
    const receipt = buildSourceProvenanceAlertRebuildReceipt({
      request,
      response: {
        rebuiltAt: "2026-06-29T12:03:00.000Z",
        savedAlertCount: 1,
        dryRun: true,
        alerts: [{
          id: "alert_apt29_source_provenance",
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          workflowContext: {
            watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
            alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
            sourceBridgeId: bridge.id,
            caseId: "case_apt29_source_provenance",
            casePath: "/dashboard/dwm/cases/case_apt29_source_provenance"
          }
        }]
      }
    });

    expect(receipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourceCandidateId: candidate.id,
      sourceBridgeId: bridge.id,
      alertRebuildRequestId: request.id,
      response: {
        source: "dwm_alert_rebuild",
        rebuiltAt: "2026-06-29T12:03:00.000Z",
        savedAlertCount: 1,
        dryRun: true
      },
      matches: {
        alertIds: ["alert_apt29_source_provenance"],
        watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
        alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
        sourceBridgeIds: [bridge.id]
      },
      caseHandoffRows: [{
        alertId: "alert_apt29_source_provenance",
        caseId: "case_apt29_source_provenance",
        casePath: "/dashboard/dwm/cases/case_apt29_source_provenance",
        ready: true
      }],
      blockers: []
    });
    expect(receipt.payloadShape).toEqual(expect.arrayContaining([
      "matches.alertIds",
      "matches.watchlistItemIds",
      "matches.alertGeneratorKeys",
      "caseHandoffRows[]",
      "blockers[]"
    ]));
    expect(JSON.stringify(receipt)).not.toContain("rawText");
    expect(JSON.stringify(receipt)).not.toContain("password");
  });

  test("packages alert enrichment provenance for public TI and analyst workflow consumers", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow(), {
        ...sourceRow(),
        sourceId: "src_public_advisory",
        sourceFamily: "public_advisory",
        captureId: "cap_public_advisory_apt29",
        contentHash: "hash_public_advisory_apt29",
        provenance: "Public advisory links APT29 to phishing infrastructure.",
        relationship: "targeting",
        confidence: 0.8
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract, includeSourceFamilies: false, includeRelationships: false });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({
      bridge,
      watchlistId: "watch_public_ti_apt29",
      requestId: "req_source_alert_enrichment"
    });
    const request = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
    const receipt = buildSourceProvenanceAlertRebuildReceipt({
      request,
      response: {
        rebuiltAt: "2026-06-29T12:03:00.000Z",
        savedAlertCount: 1,
        dryRun: true,
        alerts: [{
          id: "alert_apt29_source_enrichment",
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          workflowContext: {
            watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
            alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
            sourceBridgeId: bridge.id,
            caseId: "case_apt29_source_enrichment",
            casePath: "/dashboard/dwm/cases/case_apt29_source_enrichment"
          }
        }]
      }
    });
    const packet = buildSourceProvenanceAlertEnrichmentPacket({
      contract,
      receipt,
      generatedAt: "2026-06-29T12:04:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ALERT_ENRICHMENT_PACKET_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      sourceContractId: contract.id,
      sourceBridgeId: bridge.id,
      alertRebuildReceiptId: receipt.id,
      coverage: {
        sourceFamilies: expect.arrayContaining(["telegram_public", "public_advisory"]),
        sourceIds: expect.arrayContaining(["src_telegram", "src_public_advisory"]),
        captureIds: expect.arrayContaining(["cap_telegram_apt29", "cap_public_advisory_apt29"]),
        contentHashes: expect.arrayContaining(["hash_telegram_apt29", "hash_public_advisory_apt29"]),
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        averageConfidence: 0.83
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(packet.alertRows).toEqual([expect.objectContaining({
      alertId: "alert_apt29_source_enrichment",
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      sourceBridgeId: bridge.id,
      sourceFamilies: expect.arrayContaining(["telegram_public", "public_advisory"]),
      captureIds: expect.arrayContaining(["cap_telegram_apt29", "cap_public_advisory_apt29"]),
      watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
      alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
      confidence: 0.83,
      freshness: {
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        state: "fresh"
      },
      caseHandoff: {
        caseId: "case_apt29_source_enrichment",
        casePath: "/dashboard/dwm/cases/case_apt29_source_enrichment",
        ready: true
      },
      readyForAnalystWorkflow: true
    })]);
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "alertRows[].sourceFamilies",
      "alertRows[].freshness",
      "alertRows[].caseHandoff",
      "coverage.sourceFamilies"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("packages actor enrichment into a case-ready analyst handoff", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow(), {
        ...sourceRow(),
        sourceId: "src_public_advisory",
        sourceFamily: "public_advisory",
        captureId: "cap_public_advisory_apt29",
        contentHash: "hash_public_advisory_apt29",
        provenance: "Public advisory links APT29 to phishing infrastructure.",
        relationship: "targeting",
        confidence: 0.8
      }]
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract, includeSourceFamilies: false, includeRelationships: false });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({
      bridge,
      watchlistId: "watch_public_ti_apt29",
      requestId: "req_source_case_handoff"
    });
    const request = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
    const receipt = buildSourceProvenanceAlertRebuildReceipt({
      request,
      response: {
        rebuiltAt: "2026-06-29T12:03:00.000Z",
        savedAlertCount: 1,
        dryRun: true,
        alerts: [{
          id: "alert_apt29_case_handoff",
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          workflowContext: {
            watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
            alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
            sourceBridgeId: bridge.id,
            caseId: "case_apt29_case_handoff",
            casePath: "/dashboard/dwm/cases/case_apt29_case_handoff"
          }
        }]
      }
    });
    const enrichment = buildSourceProvenanceAlertEnrichmentPacket({ contract, receipt });
    const handoff = buildSourceProvenanceActorEnrichmentCaseHandoff({
      enrichment,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });

    expect(handoff).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CASE_HANDOFF_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      alertEnrichmentPacketId: enrichment.id,
      blockers: [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(handoff.rows).toEqual([expect.objectContaining({
      alertId: "alert_apt29_case_handoff",
      caseId: "case_apt29_case_handoff",
      casePath: "/dashboard/dwm/cases/case_apt29_case_handoff",
      publicTiRoute: "/ti/APT29",
      sourceBridgeId: bridge.id,
      sourceFamilies: expect.arrayContaining(["telegram_public", "public_advisory"]),
      captureIds: expect.arrayContaining(["cap_telegram_apt29", "cap_public_advisory_apt29"]),
      contentHashes: expect.arrayContaining(["hash_telegram_apt29", "hash_public_advisory_apt29"]),
      nextCaseAction: "open_case_with_actor_context",
      ready: true,
      casePayload: {
        redacted: true,
        route: "/dashboard/dwm/cases/case_apt29_case_handoff",
        requiredFields: expect.arrayContaining(["alertId", "caseId", "actor", "publicTiRoute"]),
        provenanceFields: expect.arrayContaining(["sourceBridgeId", "captureIds", "contentHashes"])
      },
      blockerCodes: []
    })]);
    expect(handoff.payloadShape).toEqual(expect.arrayContaining([
      "rows[].caseId",
      "rows[].publicTiRoute",
      "rows[].sourceBridgeId",
      "rows[].casePayload"
    ]));
    expect(JSON.stringify(handoff)).not.toContain("rawText");
    expect(JSON.stringify(handoff)).not.toContain("password");
  });

  test("blocks actor enrichment case handoff without org scope source provenance or case identity", () => {
    const enrichment = {
      schemaVersion: TI_SOURCE_PROVENANCE_ALERT_ENRICHMENT_PACKET_SCHEMA_VERSION,
      id: "ti_source_provenance_alert_enrichment_packet_blocked",
      generatedAt: "2026-06-29T12:05:00.000Z",
      ok: false,
      tenantId: "tenant_acme",
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      sourceContractId: "contract_blocked",
      sourceBridgeId: "bridge_blocked",
      alertRebuildReceiptId: "receipt_blocked",
      alertRows: [{
        alertId: "alert_missing_case",
        actor: "APT29",
        publicTiRoute: "/ti/APT29",
        sourceBridgeId: "bridge_blocked",
        sourceFamilies: [],
        sourceIds: [],
        captureIds: [],
        contentHashes: [],
        watchlistItemIds: [],
        alertGeneratorKeys: [],
        confidence: 0,
        freshness: { state: "missing" as const },
        readyForAnalystWorkflow: false
      }],
      coverage: {
        sourceFamilies: [],
        sourceIds: [],
        captureIds: [],
        contentHashes: [],
        averageConfidence: 0
      },
      payloadShape: [],
      safeOutput: {
        rawTargetsExposed: false as const,
        restrictedMetadataLeaked: false as const,
        privateTelegramContentExposed: false as const,
        liveNetworkScrapeStarted: false as const
      }
    };

    const handoff = buildSourceProvenanceActorEnrichmentCaseHandoff({ enrichment });

    expect(handoff.ok).toBe(false);
    expect(handoff.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_organization_scope", ownerLane: "org", path: "enrichment.organizationId" }),
      expect.objectContaining({ code: "missing_case_handoff", ownerLane: "case", alertId: "alert_missing_case" }),
      expect.objectContaining({ code: "missing_case_path", ownerLane: "case", alertId: "alert_missing_case" }),
      expect.objectContaining({ code: "missing_source_provenance", ownerLane: "source", alertId: "alert_missing_case" })
    ]));
    expect(handoff.rows).toEqual([expect.objectContaining({
      alertId: "alert_missing_case",
      ready: false,
      nextCaseAction: "repair_case_handoff",
      blockerCodes: expect.arrayContaining(["missing_case_handoff", "missing_case_path", "missing_source_provenance"])
    })]);
  });

  test("builds source-backed public TI actor profile fields with provenance and freshness", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [
        sourceRow(),
        {
          ...sourceRow(),
          sourceId: "src_public_advisory",
          sourceFamily: "public_advisory",
          captureId: "cap_public_advisory_apt29",
          contentHash: "hash_public_advisory_apt29",
          provenance: "Public advisory links APT29 to phishing infrastructure and defense evasion techniques.",
          relationship: "targeting",
          confidence: 0.8
        },
        {
          ...sourceRow(),
          sourceId: "src_actor_page",
          sourceFamily: "actor_page",
          captureId: "cap_actor_page_apt29",
          contentHash: "hash_actor_page_apt29",
          provenance: "Actor page records Nobelium aliases, espionage motivation, and campaign history.",
          relationship: "tooling",
          confidence: 0.74
        }
      ]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: {
        aliases: ["APT29", "Nobelium"],
        motivations: ["espionage"],
        sectors: ["government", "technology"],
        regions: ["North America", "Europe"],
        infrastructure: ["example.com"],
        techniques: ["phishing", "defense evasion"],
        campaigns: ["diplomatic phishing"]
      }
    });

    expect(profile).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_PROFILE_CONTRACT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      gaps: [],
      coverage: {
        sourceFamilies: expect.arrayContaining(["telegram_public", "public_advisory", "actor_page"]),
        sourceIds: expect.arrayContaining(["src_telegram", "src_public_advisory", "src_actor_page"]),
        captureIds: expect.arrayContaining(["cap_telegram_apt29", "cap_public_advisory_apt29", "cap_actor_page_apt29"]),
        contentHashes: expect.arrayContaining(["hash_telegram_apt29", "hash_public_advisory_apt29", "hash_actor_page_apt29"]),
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        averageConfidence: 0.8
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(profile.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "aliases",
        values: expect.arrayContaining(["APT29", "Nobelium"]),
        ready: true,
        provenanceRefs: expect.arrayContaining([expect.objectContaining({ sourceId: "src_telegram", captureId: "cap_telegram_apt29" })])
      }),
      expect.objectContaining({
        field: "infrastructure",
        values: ["example.com"],
        ready: true,
        sourceFamilies: expect.arrayContaining(["public_advisory"])
      }),
      expect.objectContaining({
        field: "techniques",
        values: expect.arrayContaining(["phishing", "defense evasion"]),
        ready: true,
        sourceFamilies: expect.arrayContaining(["public_advisory", "actor_page"])
      }),
      expect.objectContaining({
        field: "campaigns",
        values: ["diplomatic phishing"],
        ready: true,
        sourceFamilies: expect.arrayContaining(["telegram_public", "public_advisory"])
      })
    ]));
    expect(profile.payloadShape).toEqual(expect.arrayContaining([
      "fields[].values",
      "fields[].provenanceRefs",
      "coverage.sourceFamilies",
      "gaps[]"
    ]));
    expect(JSON.stringify(profile)).not.toContain("rawText");
    expect(JSON.stringify(profile)).not.toContain("password");
  });

  test("reports public TI actor profile gaps when source-backed fields are missing", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow({
        actor: "APT28",
        sourceId: "src_actor_page_apt28",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt28",
        contentHash: "hash_actor_page_apt28",
        provenance: "Actor page fixture confirms APT28 alias only.",
        relationship: "actor_activity",
        confidence: 0.7
      })]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });

    expect(profile.ok).toBe(false);
    expect(profile.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "aliases",
        values: expect.arrayContaining(["APT28", "Fancy Bear"]),
        ready: true
      }),
      expect.objectContaining({
        field: "infrastructure",
        values: [],
        ready: false,
        provenanceRefs: []
      })
    ]));
    expect(profile.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_motivations", field: "motivations", ownerLane: "publicTI" }),
      expect.objectContaining({ code: "missing_sectors", field: "sectors", ownerLane: "publicTI" }),
      expect.objectContaining({ code: "missing_regions", field: "regions", ownerLane: "publicTI" }),
      expect.objectContaining({ code: "missing_infrastructure", field: "infrastructure", ownerLane: "publicTI" }),
      expect.objectContaining({ code: "missing_techniques", field: "techniques", ownerLane: "publicTI" }),
      expect.objectContaining({ code: "missing_campaigns", field: "campaigns", ownerLane: "publicTI" })
    ]));
  });

  test("plans safe source-pack candidates for missing actor profile gaps without network fetches", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow({
        actor: "APT28",
        sourceId: "src_actor_page_apt28",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt28",
        contentHash: "hash_actor_page_apt28",
        provenance: "Actor page fixture confirms APT28 alias only.",
        relationship: "actor_activity",
        confidence: 0.7
      })]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({
      profile,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });

    expect(plan).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_PROFILE_GAP_SOURCE_PLAN_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      profileContractId: profile.id,
      gapsCovered: expect.arrayContaining(["motivations", "sectors", "regions", "infrastructure", "techniques", "campaigns"]),
      remainingGaps: [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        privateTelegramAccessRequested: false
      }
    });
    expect(plan.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "motivations",
        family: "actor_page",
        parserProfile: "actor_page_metadata",
        expectedCaptureType: "actor_metadata",
        activationState: "candidate",
        nextAction: "request_candidate",
        policyBoundary: expect.objectContaining({
          publicOnly: true,
          metadataOnly: true,
          liveNetworkFetch: false,
          noCredentials: true
        })
      }),
      expect.objectContaining({
        field: "campaigns",
        family: "telegram_public",
        parserProfile: "public_channel_handoff",
        expectedCaptureType: "public_channel_metadata",
        activationState: "candidate",
        policyBoundary: expect.objectContaining({
          publicOnly: true,
          noAutoJoin: true,
          noRepliesOrReactions: true
        })
      }),
      expect.objectContaining({
        field: "infrastructure",
        family: "darkweb_metadata",
        parserProfile: "restricted_metadata",
        expectedCaptureType: "restricted_metadata",
        activationState: "blocked",
        nextAction: "approval_required",
        policyBoundary: expect.objectContaining({
          publicOnly: false,
          metadataOnly: true,
          restricted: true,
          requiresGovernance: true,
          liveNetworkFetch: false
        })
      })
    ]));
    expect(plan.payloadShape).toEqual(expect.arrayContaining([
      "candidates[].parserProfile",
      "candidates[].policyBoundary",
      "remainingGaps[]"
    ]));
    expect(JSON.stringify(plan)).not.toContain("rawText");
    expect(JSON.stringify(plan)).not.toContain("password");
  });

  test("builds offline source update workflow with parser health retry and policy blockers", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow({
        actor: "APT28",
        sourceId: "src_actor_page_apt28",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt28",
        contentHash: "hash_actor_page_apt28",
        provenance: "Actor page fixture confirms APT28 alias only.",
        relationship: "actor_activity",
        confidence: 0.7
      })]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({ profile });
    const campaignCandidate = plan.candidates.find((candidate) => candidate.field === "campaigns");
    const sectorCandidate = plan.candidates.find((candidate) => candidate.field === "sectors");
    expect(campaignCandidate).toBeDefined();
    expect(sectorCandidate).toBeDefined();

    const workflow = buildSourceProvenanceActorProfileSourceUpdateWorkflow({
      plan,
      generatedAt: "2026-06-29T12:10:00.000Z",
      health: [{
        candidateId: campaignCandidate!.candidateId,
        parserStatus: "failed",
        lastRun: {
          runId: "run_campaign_parser_1",
          status: "failed",
          finishedAt: "2026-06-29T12:07:00.000Z",
          failureReason: "fixture parser found no campaign timestamp"
        },
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        failureReason: "fixture parser found no campaign timestamp"
      }, {
        candidateId: sectorCandidate!.candidateId,
        parserStatus: "ready",
        lastRun: {
          runId: "run_sector_parser_1",
          status: "passed",
          finishedAt: "2026-06-29T12:06:00.000Z"
        }
      }]
    });

    expect(workflow).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_PROFILE_SOURCE_UPDATE_WORKFLOW_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      sourcePlanId: plan.id,
      health: {
        totalCandidates: plan.candidates.length,
        blocked: 1,
        failed: 1,
        families: expect.arrayContaining([
          expect.objectContaining({ family: "telegram_public", failed: 1 }),
          expect.objectContaining({ family: "darkweb_metadata", blocked: 1 }),
          expect.objectContaining({ family: "public_advisory", readyToTest: expect.any(Number) })
        ])
      },
      offlineContract: {
        canRunOffline: true,
        liveNetworkFetch: false,
        fixtureBacked: true,
        safeUpdatePath: "/v1/dwm/source-requests"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(workflow.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateId: campaignCandidate!.candidateId,
        family: "telegram_public",
        parserStatus: "failed",
        activationState: "failed",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        retryable: true,
        nextOperatorAction: "retry_parser",
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          liveNetworkFetch: false,
          body: expect.objectContaining({ action: "retry", dryRun: true })
        })
      }),
      expect.objectContaining({
        field: "infrastructure",
        family: "darkweb_metadata",
        parserStatus: "blocked",
        activationState: "blocked",
        retryable: false,
        nextOperatorAction: "request_policy_approval",
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "request_approval", dryRun: true })
        })
      }),
      expect.objectContaining({
        candidateId: sectorCandidate!.candidateId,
        family: "public_advisory",
        parserStatus: "ready",
        activationState: "ready_to_test",
        retryable: false,
        nextOperatorAction: "test_parser"
      })
    ]));
    expect(workflow.payloadShape).toEqual(expect.arrayContaining([
      "tasks[].parserStatus",
      "tasks[].nextRetryAt",
      "health.families[]"
    ]));
    expect(JSON.stringify(workflow)).not.toContain("rawText");
    expect(JSON.stringify(workflow)).not.toContain("password");
  });

  test("builds dry-run source-pack intake request from actor source update workflow", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow({
        actor: "APT28",
        sourceId: "src_actor_page_apt28",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt28",
        contentHash: "hash_actor_page_apt28",
        provenance: "Actor page fixture confirms APT28 alias only.",
        relationship: "actor_activity",
        confidence: 0.7
      })]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({ profile });
    const campaignCandidate = plan.candidates.find((candidate) => candidate.field === "campaigns");
    const sectorCandidate = plan.candidates.find((candidate) => candidate.field === "sectors");
    expect(campaignCandidate).toBeDefined();
    expect(sectorCandidate).toBeDefined();
    const workflow = buildSourceProvenanceActorProfileSourceUpdateWorkflow({
      plan,
      health: [{
        candidateId: campaignCandidate!.candidateId,
        parserStatus: "retry_scheduled",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        failureReason: "fixture parser found no campaign timestamp"
      }, {
        candidateId: sectorCandidate!.candidateId,
        parserStatus: "ready"
      }]
    });
    const request = buildSourceProvenanceSourcePackIntakeRequest({
      workflow,
      generatedAt: "2026-06-29T12:15:00.000Z"
    });

    expect(request).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_REQUEST_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourceUpdateWorkflowId: workflow.id,
      route: {
        method: "POST",
        path: "/v1/dwm/source-requests",
        body: {
          action: "source_pack_intake",
          sourcePackLabel: "APT28 enrichment source pack",
          dryRun: true,
          actor: "APT28",
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          candidates: expect.any(Array)
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      },
      summary: {
        candidateCount: plan.candidates.length,
        blocked: 2,
        retryable: 1,
        families: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      offlineContract: {
        fixtureBacked: true,
        liveNetworkFetch: false,
        liveProbeOptIn: true
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(request.acceptedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateId: sectorCandidate!.candidateId,
        family: "public_advisory",
        type: "public_url",
        targetRef: "https://example.com/security/advisory/apt28-sectors",
        parserStatus: "ready",
        activationState: "ready_to_test",
        validation: expect.objectContaining({ allowed: true })
      })
    ]));
    expect(request.route.body.candidates).toEqual(request.acceptedCandidates);
    expect(request.retryCandidates).toEqual([expect.objectContaining({
      candidateId: campaignCandidate!.candidateId,
      family: "telegram_public",
      targetRef: "@apt28_public_updates",
      type: "telegram_channel",
      validation: expect.objectContaining({
        allowed: false,
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      })
    })]);
    expect(request.blockedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "telegram_public",
        validation: expect.objectContaining({ allowed: false })
      }),
      expect.objectContaining({
        family: "darkweb_metadata",
        targetRef: "metadata://darkweb/apt28/infrastructure",
        type: "restricted_metadata",
        policyBoundary: expect.objectContaining({
          metadataOnly: true,
          restricted: true,
          requiresGovernance: true,
          liveNetworkFetch: false
        }),
        validation: expect.objectContaining({
          allowed: false,
          reason: "Candidate requires policy approval before intake."
        })
      })
    ]));
    expect(request.payloadShape).toEqual(expect.arrayContaining([
      "route.body.candidates[]",
      "blockedCandidates[]",
      "offlineContract"
    ]));
    expect(JSON.stringify(request)).not.toContain("rawText");
    expect(JSON.stringify(request)).not.toContain("password");
  });

  test("builds source-pack intake receipt with actionable source health", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow({
        actor: "APT28",
        sourceId: "src_actor_page_apt28",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt28",
        contentHash: "hash_actor_page_apt28",
        provenance: "Actor page fixture confirms APT28 alias only.",
        relationship: "actor_activity",
        confidence: 0.7
      })]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({ profile });
    const campaignCandidate = plan.candidates.find((candidate) => candidate.field === "campaigns");
    const sectorCandidate = plan.candidates.find((candidate) => candidate.field === "sectors");
    expect(campaignCandidate).toBeDefined();
    expect(sectorCandidate).toBeDefined();
    const workflow = buildSourceProvenanceActorProfileSourceUpdateWorkflow({
      plan,
      health: [{
        candidateId: campaignCandidate!.candidateId,
        parserStatus: "retry_scheduled",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        failureReason: "fixture parser found no campaign timestamp"
      }, {
        candidateId: sectorCandidate!.candidateId,
        parserStatus: "ready"
      }]
    });
    const request = buildSourceProvenanceSourcePackIntakeRequest({ workflow });
    const receipt = buildSourceProvenanceSourcePackIntakeReceipt({
      request,
      generatedAt: "2026-06-29T12:20:00.000Z"
    });

    expect(receipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourcePackIntakeRequestId: request.id,
      sourceHealth: {
        queuedForReview: request.acceptedCandidates.length,
        blockedByPolicy: request.blockedCandidates.length - request.retryCandidates.length,
        retryScheduled: request.retryCandidates.length,
        parserReady: 1,
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        families: expect.arrayContaining([
          expect.objectContaining({ family: "public_advisory", queuedForReview: expect.any(Number), parserReady: 1 }),
          expect.objectContaining({ family: "telegram_public", retryScheduled: 1 }),
          expect.objectContaining({ family: "darkweb_metadata", blockedByPolicy: 1 })
        ])
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(receipt.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateId: sectorCandidate!.candidateId,
        family: "public_advisory",
        status: "queued_for_review",
        parserStatus: "ready",
        activationState: "ready_to_test",
        sourceId: expect.stringMatching(/^ti_source_candidate_source_/),
        testJobId: expect.stringMatching(/^ti_source_candidate_test_job_/)
      }),
      expect.objectContaining({
        candidateId: campaignCandidate!.candidateId,
        family: "telegram_public",
        status: "retry_scheduled",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        failureReason: "fixture parser found no campaign timestamp"
      }),
      expect.objectContaining({
        family: "darkweb_metadata",
        status: "blocked_by_policy",
        parserStatus: "blocked",
        failureReason: "Candidate requires policy approval before intake.",
        policyBoundary: expect.objectContaining({
          metadataOnly: true,
          requiresGovernance: true,
          liveNetworkFetch: false
        })
      })
    ]));
    expect(receipt.payloadShape).toEqual(expect.arrayContaining([
      "rows[].status",
      "rows[].nextRetryAt",
      "sourceHealth.families[]"
    ]));
    expect(JSON.stringify(receipt)).not.toContain("rawText");
    expect(JSON.stringify(receipt)).not.toContain("password");
  });

  test("builds source-pack activation readiness actions from intake receipt", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow({
        actor: "APT28",
        sourceId: "src_actor_page_apt28",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt28",
        contentHash: "hash_actor_page_apt28",
        provenance: "Actor page fixture confirms APT28 alias only.",
        relationship: "actor_activity",
        confidence: 0.7
      })]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({ profile });
    const campaignCandidate = plan.candidates.find((candidate) => candidate.field === "campaigns");
    const sectorCandidate = plan.candidates.find((candidate) => candidate.field === "sectors");
    expect(campaignCandidate).toBeDefined();
    expect(sectorCandidate).toBeDefined();
    const workflow = buildSourceProvenanceActorProfileSourceUpdateWorkflow({
      plan,
      health: [{
        candidateId: campaignCandidate!.candidateId,
        parserStatus: "retry_scheduled",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        failureReason: "fixture parser found no campaign timestamp"
      }, {
        candidateId: sectorCandidate!.candidateId,
        parserStatus: "ready"
      }]
    });
    const request = buildSourceProvenanceSourcePackIntakeRequest({ workflow });
    const receipt = buildSourceProvenanceSourcePackIntakeReceipt({ request });
    const readiness = buildSourceProvenanceSourcePackActivationReadiness({
      receipt,
      generatedAt: "2026-06-29T12:25:00.000Z"
    });

    expect(readiness).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_ACTIVATION_READINESS_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourcePackIntakeReceiptId: receipt.id,
      sourceHealth: receipt.sourceHealth,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(readiness.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "test_source",
        candidateId: sectorCandidate!.candidateId,
        family: "public_advisory",
        parserStatus: "ready",
        activationState: "ready_to_test",
        sourceId: expect.stringMatching(/^ti_source_candidate_source_/),
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          liveNetworkFetch: false,
          body: expect.objectContaining({ action: "test", dryRun: true })
        })
      }),
      expect.objectContaining({
        action: "retry_parser",
        candidateId: campaignCandidate!.candidateId,
        family: "telegram_public",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "retry", dryRun: true })
        })
      }),
      expect.objectContaining({
        action: "request_policy_approval",
        family: "darkweb_metadata",
        parserStatus: "blocked",
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "request_approval", dryRun: true })
        })
      })
    ]));
    expect(readiness.payloadShape).toEqual(expect.arrayContaining([
      "actions[].route",
      "actions[].nextRetryAt",
      "sourceHealth"
    ]));
    expect(JSON.stringify(readiness)).not.toContain("rawText");
    expect(JSON.stringify(readiness)).not.toContain("password");
  });

  test("codifies scraper enrichment lifecycle from source intake through actor case handoff", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow({
        actor: "APT28",
        sourceId: "src_actor_page_apt28",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt28",
        contentHash: "hash_actor_page_apt28",
        provenance: "Actor page fixture confirms APT28 alias only.",
        relationship: "actor_activity",
        confidence: 0.7
      }), sourceRow({
        actor: "APT28",
        sourceId: "src_public_advisory_apt28",
        sourceFamily: "public_advisory",
        captureId: "cap_public_advisory_apt28",
        contentHash: "hash_public_advisory_apt28",
        provenance: "Public advisory fixture links APT28 to phishing infrastructure.",
        relationship: "targeting",
        confidence: 0.82
      })]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({ profile });
    const campaignCandidate = plan.candidates.find((candidate) => candidate.field === "campaigns");
    const sectorCandidate = plan.candidates.find((candidate) => candidate.field === "sectors");
    expect(campaignCandidate).toBeDefined();
    expect(sectorCandidate).toBeDefined();
    const workflow = buildSourceProvenanceActorProfileSourceUpdateWorkflow({
      plan,
      health: [{
        candidateId: campaignCandidate!.candidateId,
        parserStatus: "retry_scheduled",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        failureReason: "fixture parser found no campaign timestamp"
      }, {
        candidateId: sectorCandidate!.candidateId,
        parserStatus: "ready"
      }]
    });
    const request = buildSourceProvenanceSourcePackIntakeRequest({ workflow });
    const receipt = buildSourceProvenanceSourcePackIntakeReceipt({ request });
    const readiness = buildSourceProvenanceSourcePackActivationReadiness({
      receipt,
      generatedAt: "2026-06-29T12:25:00.000Z"
    });
    const bridge = buildSourceProvenanceAlertabilityBridge({ contract, includeSourceFamilies: false, includeRelationships: false });
    const candidate = buildSourceProvenanceOrgWatchlistCandidate({
      bridge,
      watchlistId: "watch_public_ti_apt28",
      requestId: "req_scraper_lifecycle"
    });
    const rebuildRequest = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
    const rebuildReceipt = buildSourceProvenanceAlertRebuildReceipt({
      request: rebuildRequest,
      response: {
        rebuiltAt: "2026-06-29T12:30:00.000Z",
        savedAlertCount: 1,
        dryRun: true,
        alerts: [{
          id: "alert_apt28_lifecycle",
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          workflowContext: {
            watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
            alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
            sourceBridgeId: bridge.id,
            caseId: "case_apt28_lifecycle",
            casePath: "/dashboard/dwm/cases/case_apt28_lifecycle"
          }
        }]
      }
    });
    const enrichment = buildSourceProvenanceAlertEnrichmentPacket({ contract, receipt: rebuildReceipt });
    const handoff = buildSourceProvenanceActorEnrichmentCaseHandoff({ enrichment });
    const lifecycle = buildSourceProvenanceScraperEnrichmentLifecycle({
      activationReadiness: readiness,
      caseHandoff: handoff,
      generatedAt: "2026-06-29T12:35:00.000Z"
    });

    expect(lifecycle).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SCRAPER_ENRICHMENT_LIFECYCLE_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      sourcePackActivationReadinessId: readiness.id,
      actorCaseHandoffId: handoff.id,
      sourceHealth: readiness.sourceHealth,
      enrichmentFreshness: {
        state: "fresh",
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        readyCaseRows: 1,
        blockedCaseRows: 0
      },
      docsAsContract: {
        noLiveNetworkByDefault: true,
        fixtureBacked: true,
        liveProbeOptIn: true
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(lifecycle.stages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: "candidate_intake",
        status: "complete",
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          liveNetworkFetch: false,
          body: expect.objectContaining({ action: "source_pack_intake", dryRun: true })
        })
      }),
      expect.objectContaining({
        stage: "policy_validation",
        status: "blocked",
        nextAction: "request_policy_approval"
      }),
      expect.objectContaining({
        stage: "activation_test",
        status: "ready",
        route: expect.objectContaining({
          liveNetworkFetch: false,
          body: expect.objectContaining({ action: "test", dryRun: true })
        })
      }),
      expect.objectContaining({
        stage: "retry_backoff",
        status: "retry_scheduled",
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "retry", dryRun: true })
        })
      }),
      expect.objectContaining({
        stage: "case_handoff",
        status: "complete",
        evidenceRefs: expect.objectContaining({
          alertIds: ["alert_apt28_lifecycle"],
          captureIds: expect.arrayContaining(["cap_actor_page_apt28", "cap_public_advisory_apt28"])
        })
      })
    ]));
    expect(lifecycle.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "policy_approval_required",
        ownerLane: "policy",
        candidateId: expect.stringMatching(/^ti_source_provenance_actor_profile_gap_candidate_/)
      }),
      expect.objectContaining({
        code: "parser_retry_scheduled",
        ownerLane: "parser",
        candidateId: campaignCandidate!.candidateId,
        retryAfter: "2026-06-29T12:37:00.000Z"
      })
    ]));
    expect(lifecycle.payloadShape).toEqual(expect.arrayContaining([
      "stages[].route",
      "sourceHealth",
      "enrichmentFreshness",
      "blockers[]"
    ]));
    expect(JSON.stringify(lifecycle)).not.toContain("rawText");
    expect(JSON.stringify(lifecycle)).not.toContain("password");
  });

  test("exports source freshness and gap packet for public TI, dashboard, and alert consumers", () => {
    const { lifecycle, readiness, handoff } = buildFreshSourceLifecycle();
    const packet = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      ownerLane: "source",
      sourcePackActivationReadinessId: readiness.id,
      actorCaseHandoffId: handoff.id,
      freshness: {
        state: "fresh",
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        maxAgeDays: 7
      },
      sourceHealth: readiness.sourceHealth,
      gaps: [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ownerLane: "publicTI",
        ready: true,
        route: expect.objectContaining({
          path: "/ti/APT28",
          liveNetworkFetch: false
        }),
        requiredFields: expect.arrayContaining(["freshness.newestEvidenceAt", "sourceHealth"])
      }),
      expect.objectContaining({
        consumer: "dashboard",
        ownerLane: "dashboard",
        ready: true,
        requiredFields: expect.arrayContaining(["gaps[].code", "lifecycle.blockedStages"])
      }),
      expect.objectContaining({
        consumer: "alertRebuild",
        ownerLane: "alert",
        ready: true,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({
            actor: "APT28",
            organizationId: "org_acme",
            dryRun: true
          }),
          liveNetworkFetch: false
        })
      })
    ]));
    expect(packet.lifecycle).toMatchObject({
      blockedStages: [],
      nextTransitions: ["test_source"]
    });
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "freshness.state",
      "gaps[].code",
      "consumers[].route"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("reports stale source evidence, parser retry, policy, and case handoff gaps", () => {
    const { lifecycle } = buildBlockedSourceLifecycle();
    const packet = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });

    expect(packet.ok).toBe(false);
    expect(packet.freshness).toMatchObject({
      state: "stale",
      newestEvidenceAt: "2026-06-01T10:15:00.000Z",
      maxAgeDays: 7
    });
    expect(packet.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "stale_source_evidence",
        ownerLane: "source",
        stage: "enrichment_freshness",
        path: "enrichmentFreshness.newestEvidenceAt",
        nextAction: "inspect_source_health"
      }),
      expect.objectContaining({
        code: "parser_retry_scheduled",
        ownerLane: "parser",
        stage: "retry_backoff",
        nextAction: "retry_parser",
        retryAfter: "2026-06-29T12:37:00.000Z"
      }),
      expect.objectContaining({
        code: "policy_approval_required",
        ownerLane: "policy",
        stage: "policy_validation",
        nextAction: "request_policy_approval"
      }),
      expect.objectContaining({
        code: "case_handoff_blocked",
        ownerLane: "case",
        stage: "case_handoff",
        path: "alertRows[].caseHandoff.caseId",
        nextAction: "open_case_handoff",
        alertId: "alert_apt28_stale"
      })
    ]));
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ready: false,
        reason: "Actor page needs fresh, case-ready source evidence."
      }),
      expect.objectContaining({
        consumer: "alertRebuild",
        ready: false,
        reason: "Alert rebuild should wait for source freshness and case handoff repair."
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        requiredFields: expect.arrayContaining(["gaps[].retryAfter", "lifecycle.nextTransitions"])
      })
    ]));
    expect(packet.lifecycle.blockedStages).toEqual(expect.arrayContaining([
      "policy_validation",
      "retry_backoff",
      "case_handoff"
    ]));
    expect(packet.lifecycle.nextTransitions).toEqual(expect.arrayContaining([
      "request_policy_approval",
      "retry_parser",
      "open_case_handoff"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("reports missing source freshness with typed operator next actions", () => {
    const { lifecycle } = buildFreshSourceLifecycle();
    const missingLifecycle = {
      ...lifecycle,
      id: `${lifecycle.id}:missing_freshness`,
      actorCaseHandoffId: undefined,
      enrichmentFreshness: {
        state: "missing" as const,
        readyCaseRows: 0,
        blockedCaseRows: 0
      },
      stages: lifecycle.stages.map((stage) => stage.stage === "enrichment_freshness"
        ? {
          ...stage,
          status: "blocked" as const,
          nextAction: "repair_provenance" as const
        }
        : stage)
    };
    const packet = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle: missingLifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION,
      ok: false,
      freshness: {
        state: "missing",
        maxAgeDays: 7
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(packet.freshness.newestEvidenceAt).toBeUndefined();
    expect(packet.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "missing_fresh_evidence",
        ownerLane: "publicTI",
        stage: "enrichment_freshness",
        path: "enrichmentFreshness.newestEvidenceAt",
        nextAction: "wait_for_case_handoff"
      })
    ]));
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ownerLane: "publicTI",
        ready: false,
        route: expect.objectContaining({
          path: "/ti/APT28",
          liveNetworkFetch: false
        })
      }),
      expect.objectContaining({
        consumer: "dashboard",
        ownerLane: "dashboard",
        ready: false,
        requiredFields: expect.arrayContaining(["gaps[].nextAction", "lifecycle.blockedStages"])
      }),
      expect.objectContaining({
        consumer: "alertRebuild",
        ownerLane: "alert",
        ready: false,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ dryRun: true }),
          liveNetworkFetch: false
        })
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ownerLane: "source",
        ready: true,
        requiredFields: expect.arrayContaining(["gaps[].candidateId", "lifecycle.nextTransitions"])
      })
    ]));
    expect(packet.lifecycle.blockedStages).toEqual(["enrichment_freshness"]);
    expect(packet.lifecycle.nextTransitions).toEqual(["test_source", "repair_provenance"]);
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("builds parser health alerts from lifecycle state for source ops and alert generation", () => {
    const { lifecycle } = buildBlockedSourceLifecycle();
    const packet = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      lifecycleId: lifecycle.id,
      sourcePackActivationReadinessId: lifecycle.sourcePackActivationReadinessId,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(packet.summary).toMatchObject({
      alertCount: 3,
      sourceFamilies: expect.arrayContaining(["actor_page", "darkweb_metadata", "telegram_public"]),
      retryableCount: 1,
      policyBlockedCount: 1,
      freshnessBlockedCount: 0,
      alertGenerationReady: false,
      nextRetryAt: "2026-06-29T12:37:00.000Z"
    });
    expect(packet.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        alertType: "parser_retry_scheduled",
        severity: "blocking",
        policyStatus: "allowed",
        parserStatus: expect.objectContaining({
          state: "retry_scheduled",
          failureReason: "Parser test is retryable and must wait for the next retry window."
        }),
        retryState: expect.objectContaining({
          retryable: true,
          nextRetryAt: "2026-06-29T12:37:00.000Z",
          nextAction: "retry_parser"
        }),
        provenance: expect.objectContaining({
          lifecycleId: lifecycle.id,
          sourcePackActivationReadinessId: lifecycle.sourcePackActivationReadinessId,
          stage: "retry_backoff",
          fixtureBacked: true,
          sourceHealthProofId: expect.any(String)
        }),
        freshness: expect.objectContaining({
          state: "fresh",
          newestEvidenceAt: "2026-06-01T10:15:00.000Z"
        }),
        enrichmentGap: expect.objectContaining({
          type: "parser_retry",
          ownerLane: "parser",
          nextAction: "retry_parser"
        }),
        alertGenerationImpact: expect.objectContaining({
          ready: false,
          webhookConsumable: true,
          publicTiReady: false
        }),
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          body: expect.objectContaining({ action: "retry", dryRun: true }),
          liveNetworkFetch: false
        }),
        safeOutput: expect.objectContaining({ liveNetworkScrapeStarted: false })
      }),
      expect.objectContaining({
        alertType: "policy_blocked",
        policyStatus: "approval_required",
        parserStatus: expect.objectContaining({ state: "blocked" }),
        retryState: expect.objectContaining({
          retryable: false,
          nextAction: "request_policy_approval"
        }),
        enrichmentGap: expect.objectContaining({
          type: "policy_validation",
          ownerLane: "policy"
        }),
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "request_approval", dryRun: true })
        })
      })
    ]));
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ready: false,
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: false,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ dryRun: true }),
          liveNetworkFetch: false
        })
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        requiredFields: expect.arrayContaining(["rows[].route", "rows[].retryState"])
      }),
      expect.objectContaining({
        consumer: "webhook",
        ready: true,
        route: expect.objectContaining({
          path: "/v1/dwm/webhooks/dry-run",
          liveNetworkFetch: false
        })
      })
    ]));
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "rows[].sourceFamily",
      "rows[].parserStatus",
      "rows[].provenance",
      "rows[].alertGenerationImpact"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("keeps parser health alert packet ready when lifecycle has fresh tested evidence", () => {
    const { lifecycle } = buildFreshSourceLifecycle();
    const packet = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION,
      ok: true,
      summary: {
        alertCount: 0,
        sourceFamilies: [],
        retryableCount: 0,
        policyBlockedCount: 0,
        freshnessBlockedCount: 0,
        alertGenerationReady: true
      },
      rows: [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true }),
      expect.objectContaining({ consumer: "sourceOps", ready: true }),
      expect.objectContaining({ consumer: "webhook", ready: false })
    ]));
  });

  test("packages parser health alert handoff state for alert public TI and source consumers", () => {
    const { lifecycle } = buildFreshSourceLifecycle();
    const packet = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const handoff = buildSourceProvenanceAlertHandoffState({
      packet,
      expectedOrganizationId: "org_acme",
      requestedTransition: "request_alert_generation",
      generatedAt: "2026-06-29T12:47:00.000Z"
    });

    expect(handoff).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ALERT_HANDOFF_STATE_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      parserHealthAlertPacketId: packet.id,
      state: "ready",
      lifecycle: {
        currentState: "ready",
        requestedTransition: "request_alert_generation",
        allowedTransitions: expect.arrayContaining(["request_alert_generation", "refresh_public_ti"])
      },
      alertGeneration: {
        ready: true,
        sourceFamilies: [],
        blockedAlertIds: [],
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ organizationId: "org_acme", dryRun: true }),
          liveNetworkFetch: false
        })
      },
      publicTi: {
        ready: true,
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      },
      webhook: {
        ready: false,
        sourceAlertRows: []
      },
      sourceOps: {
        ready: true,
        nextActions: [],
        routes: []
      },
      blockers: [],
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(handoff.consumerContracts).toMatchObject({
      alertGeneration: {
        requiredFields: expect.arrayContaining(["organizationId", "parserHealthAlertPacketId", "alertGeneration.ready"]),
        sourceSchema: TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION
      },
      publicTi: {
        requiredFields: expect.arrayContaining(["publicTiRoute", "blockers[]"])
      },
      sourceOps: {
        requiredFields: expect.arrayContaining(["sourceOps.routes", "sourceOps.nextActions"])
      }
    });
    expect(JSON.stringify(handoff)).not.toContain("rawText");
    expect(JSON.stringify(handoff)).not.toContain("password");
  });

  test("blocks parser health alert handoff state on source org mismatch duplicate alerts and parser gaps", () => {
    const { lifecycle } = buildBlockedSourceLifecycle();
    const packet = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const duplicatedPacket = {
      ...packet,
      rows: [...packet.rows, packet.rows[0]]
    };
    const handoff = buildSourceProvenanceAlertHandoffState({
      packet: duplicatedPacket,
      expectedOrganizationId: "org_other",
      requestedTransition: "request_alert_generation",
      generatedAt: "2026-06-29T12:47:00.000Z"
    });

    expect(handoff.ok).toBe(false);
    expect(handoff.state).toBe("blocked");
    expect(handoff.lifecycle).toMatchObject({
      currentState: "blocked",
      requestedTransition: "request_alert_generation",
      allowedTransitions: ["repair_source"],
      invalidTransition: "request_alert_generation"
    });
    expect(handoff.alertGeneration).toMatchObject({
      ready: false,
      sourceFamilies: expect.arrayContaining(["actor_page", "darkweb_metadata", "telegram_public"]),
      blockedAlertIds: expect.arrayContaining([packet.rows[0].alertId]),
      nextRetryAt: "2026-06-29T12:37:00.000Z"
    });
    expect(handoff.webhook).toMatchObject({
      ready: false,
      sourceAlertRows: expect.arrayContaining([packet.rows[0].alertId])
    });
    expect(handoff.sourceOps).toMatchObject({
      ready: true,
      nextActions: expect.arrayContaining(["retry_parser", "request_policy_approval"])
    });
    expect(handoff.sourceOps.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "/v1/dwm/source-requests",
        body: expect.objectContaining({ action: "retry", dryRun: true })
      }),
      expect.objectContaining({
        path: "/v1/dwm/source-requests",
        body: expect.objectContaining({ action: "request_approval", dryRun: true })
      })
    ]));
    expect(handoff.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "source_org_mismatch",
        ownerLane: "source",
        path: "organizationId"
      }),
      expect.objectContaining({
        code: "parser_health_blocked",
        ownerLane: "source",
        path: "rows[]",
        alertId: packet.rows[0].alertId
      }),
      expect.objectContaining({
        code: "duplicate_alert_id",
        ownerLane: "alert",
        path: "rows[].alertId",
        alertId: packet.rows[0].alertId
      }),
      expect.objectContaining({
        code: "invalid_transition",
        ownerLane: "alert",
        path: "lifecycle.requestedTransition",
        requestedTransition: "request_alert_generation"
      })
    ]));
    expect(handoff.consumerContracts.webhook.requiredFields).toEqual(expect.arrayContaining([
      "webhook.sourceAlertRows",
      "sourceOps.nextActions"
    ]));
    expect(JSON.stringify(handoff)).not.toContain("rawText");
    expect(JSON.stringify(handoff)).not.toContain("password");
  });

  test("builds source operations action queue from freshness and parser health gaps", () => {
    const { lifecycle } = buildBlockedSourceLifecycle();
    const freshnessPacket = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const queue = buildSourceProvenanceSourceOpsActionQueue({
      freshnessPacket,
      parserHealthPacket,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });

    expect(queue).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      sourceFreshnessGapPacketId: freshnessPacket.id,
      parserHealthAlertPacketId: parserHealthPacket.id,
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(queue.summary).toMatchObject({
      retryCount: expect.any(Number),
      approvalCount: expect.any(Number),
      refreshCount: expect.any(Number),
      repairCount: expect.any(Number),
      publicTiReady: false,
      alertGenerationReady: false,
      nextRetryAt: "2026-06-29T12:37:00.000Z"
    });
    expect(queue.summary.actionCount).toBeGreaterThanOrEqual(4);
    expect(queue.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "retry_parser",
        priority: "high",
        ownerLane: "parser",
        reasonCode: "parser_retry_scheduled",
        retryState: expect.objectContaining({
          retryable: true,
          nextRetryAt: "2026-06-29T12:37:00.000Z"
        }),
        parserStatus: expect.objectContaining({
          state: "retry_scheduled"
        }),
        provenance: expect.objectContaining({
          sourceFreshnessGapPacketId: freshnessPacket.id,
          parserHealthAlertPacketId: parserHealthPacket.id,
          parserHealthAlertId: expect.any(String),
          sourceHealthProofId: expect.any(String),
          fixtureBacked: true
        }),
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          body: expect.objectContaining({ action: "retry", dryRun: true }),
          liveNetworkFetch: false
        })
      }),
      expect.objectContaining({
        action: "request_policy_approval",
        ownerLane: "policy",
        reasonCode: "policy_blocked",
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "request_approval", dryRun: true })
        })
      }),
      expect.objectContaining({
        action: "queue_source_refresh",
        ownerLane: "source",
        reasonCode: "stale_source_evidence",
        freshness: expect.objectContaining({
          state: "stale",
          newestEvidenceAt: "2026-06-01T10:15:00.000Z"
        })
      }),
      expect.objectContaining({
        action: "repair_provenance",
        ownerLane: "case",
        reasonCode: "case_handoff_blocked"
      })
    ]));
    expect(queue.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        route: expect.objectContaining({ path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        consumer: "dashboard",
        ready: true,
        requiredFields: expect.arrayContaining(["rows[].ownerLane", "rows[].parserStatus"])
      }),
      expect.objectContaining({
        consumer: "publicTI",
        ready: false
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: false,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ dryRun: true })
        })
      })
    ]));
    expect(queue.payloadShape).toEqual(expect.arrayContaining([
      "rows[].action",
      "rows[].route",
      "summary.publicTiReady",
      "summary.alertGenerationReady"
    ]));
    expect(JSON.stringify(queue)).not.toContain("rawText");
    expect(JSON.stringify(queue)).not.toContain("password");
  });

  test("keeps source operations action queue empty when freshness and parser health are ready", () => {
    const { lifecycle } = buildFreshSourceLifecycle();
    const freshnessPacket = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const queue = buildSourceProvenanceSourceOpsActionQueue({
      freshnessPacket,
      parserHealthPacket,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });

    expect(queue).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION,
      ok: true,
      rows: [],
      summary: {
        actionCount: 0,
        retryCount: 0,
        approvalCount: 0,
        refreshCount: 0,
        repairCount: 0,
        sourceFamilies: [],
        publicTiReady: true,
        alertGenerationReady: true
      },
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
    expect(queue.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "sourceOps", ready: true }),
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true })
    ]));
  });

  test("packages source operations fixture bundle with validation blockers for downstream consumers", () => {
    const { lifecycle } = buildBlockedSourceLifecycle();
    const freshnessPacket = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const actionQueue = buildSourceProvenanceSourceOpsActionQueue({
      freshnessPacket,
      parserHealthPacket,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const bundle = buildSourceProvenanceSourceOpsFixtureBundle({
      freshnessPacket,
      parserHealthPacket,
      actionQueue,
      expectedActor: "LockBit",
      validationIssues: [{
        code: "duplicate_candidate",
        sourceFamily: "telegram_public",
        duplicateOf: "src_existing_public_telegram"
      }, {
        code: "unsupported_source_family",
        sourceFamily: "pastebin_dump"
      }],
      generatedAt: "2026-06-29T12:48:00.000Z"
    });

    expect(bundle).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_OPS_FIXTURE_BUNDLE_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      expectedActor: "LockBit",
      packetRefs: {
        sourceFreshnessGapPacketId: freshnessPacket.id,
        parserHealthAlertPacketId: parserHealthPacket.id,
        sourceOpsActionQueueId: actionQueue.id
      },
      readiness: {
        publicTI: false,
        dashboard: true,
        sourceOps: true,
        alertGeneration: false,
        operatorActionCount: actionQueue.summary.actionCount,
        validationIssueCount: 3
      },
      sourceHealth: {
        parserAlertCount: parserHealthPacket.summary.alertCount,
        freshnessState: "stale",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(bundle.sourceHealth.sourceFamilies).toEqual(expect.arrayContaining([
      "actor_page",
      "darkweb_metadata",
      "telegram_public",
      "pastebin_dump"
    ]));
    expect(bundle.operatorActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "retry_parser",
        route: expect.objectContaining({ liveNetworkFetch: false })
      }),
      expect.objectContaining({
        action: "request_policy_approval",
        route: expect.objectContaining({ liveNetworkFetch: false })
      })
    ]));
    expect(bundle.validationIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "wrong_actor_query",
        severity: "blocking",
        ownerLane: "publicTI",
        expectedActor: "LockBit",
        actualActor: "APT28",
        nextAction: "retry_query",
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        code: "duplicate_candidate",
        severity: "warning",
        ownerLane: "source",
        sourceFamily: "telegram_public",
        duplicateOf: "src_existing_public_telegram",
        nextAction: "suppress_duplicate",
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          body: expect.objectContaining({ action: "suppress_duplicate", dryRun: true }),
          liveNetworkFetch: false
        })
      }),
      expect.objectContaining({
        code: "unsupported_source_family",
        severity: "blocking",
        ownerLane: "source",
        sourceFamily: "pastebin_dump",
        nextAction: "review_source_family",
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "review_source_family", dryRun: true })
        })
      })
    ]));
    expect(bundle.fixtureContracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        route: "/ti/APT28",
        liveNetworkFetch: false,
        requiredFields: expect.arrayContaining(["readiness.publicTI", "sourceHealth.freshnessState"])
      }),
      expect.objectContaining({
        consumer: "dashboard",
        route: "/dashboard/ti/sources?actor=APT28",
        requiredFields: expect.arrayContaining(["operatorActions[].action", "validationIssues[].code"])
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        route: "/v1/dwm/source-requests",
        sourceSchemas: expect.arrayContaining([TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION])
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        route: "/v1/dwm/alerts/rebuild",
        sourceSchemas: expect.arrayContaining([TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION])
      })
    ]));
    expect(bundle.payloadShape).toEqual(expect.arrayContaining([
      "packetRefs.sourceFreshnessGapPacketId",
      "operatorActions[].route",
      "validationIssues[].code"
    ]));
    expect(JSON.stringify(bundle)).not.toContain("rawText");
    expect(JSON.stringify(bundle)).not.toContain("password");
  });

  test("keeps source operations fixture bundle ready for fresh ransomware actor evidence", () => {
    const { lifecycle } = buildFreshSourceLifecycle({ actor: "LockBit" });
    const freshnessPacket = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const actionQueue = buildSourceProvenanceSourceOpsActionQueue({
      freshnessPacket,
      parserHealthPacket,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const bundle = buildSourceProvenanceSourceOpsFixtureBundle({
      freshnessPacket,
      parserHealthPacket,
      actionQueue,
      expectedActor: "LockBit",
      generatedAt: "2026-06-29T12:48:00.000Z"
    });

    expect(bundle).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_OPS_FIXTURE_BUNDLE_SCHEMA_VERSION,
      ok: true,
      actor: "LockBit",
      expectedActor: "LockBit",
      readiness: {
        publicTI: true,
        dashboard: true,
        sourceOps: true,
        alertGeneration: true,
        operatorActionCount: 0,
        validationIssueCount: 0
      },
      sourceHealth: {
        sourceFamilies: [],
        parserAlertCount: 0,
        freshnessState: "fresh"
      },
      operatorActions: [],
      validationIssues: [],
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
  });

  test("projects source operations bundle into public TI consumable enrichment rows", () => {
    const { lifecycle } = buildBlockedSourceLifecycle();
    const freshnessPacket = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const actionQueue = buildSourceProvenanceSourceOpsActionQueue({
      freshnessPacket,
      parserHealthPacket,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const bundle = buildSourceProvenanceSourceOpsFixtureBundle({
      freshnessPacket,
      parserHealthPacket,
      actionQueue,
      expectedActor: "LockBit",
      validationIssues: [{
        code: "duplicate_candidate",
        sourceFamily: "telegram_public",
        duplicateOf: "src_existing_public_telegram"
      }, {
        code: "unsupported_source_family",
        sourceFamily: "pastebin_dump"
      }],
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const projection = buildSourceProvenancePublicTiSourceOpsProjection({
      bundle,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });

    expect(projection).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PUBLIC_TI_SOURCE_OPS_PROJECTION_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      sourceOpsFixtureBundleId: bundle.id,
      pageReadiness: {
        state: "partial",
        canRender: true,
        publicTI: false,
        dashboard: true,
        sourceOps: true,
        alertGeneration: false
      },
      sourceCoverage: {
        freshnessState: "stale",
        parserAlertCount: parserHealthPacket.summary.alertCount,
        operatorActionCount: actionQueue.summary.actionCount,
        validationIssueCount: 3,
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(projection.sourceCoverage.families).toEqual(expect.arrayContaining([
      "actor_page",
      "darkweb_metadata",
      "telegram_public",
      "pastebin_dump"
    ]));
    expect(projection.provenanceRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        state: "needs_action",
        reasonCode: "parser_retry_scheduled",
        ownerLane: "parser",
        parserStatus: expect.objectContaining({ state: "retry_scheduled" }),
        provenance: expect.objectContaining({
          sourceOpsFixtureBundleId: bundle.id,
          sourceFreshnessGapPacketId: freshnessPacket.id,
          parserHealthAlertPacketId: parserHealthPacket.id,
          sourceOpsActionQueueId: actionQueue.id,
          fixtureBacked: true
        }),
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          body: expect.objectContaining({ action: "retry", dryRun: true }),
          liveNetworkFetch: false
        })
      }),
      expect.objectContaining({
        state: "validation_blocked",
        reasonCode: "wrong_actor_query",
        ownerLane: "publicTI",
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        state: "validation_blocked",
        reasonCode: "unsupported_source_family",
        sourceFamily: "pastebin_dump"
      })
    ]));
    expect(projection.enrichmentGaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "parser_retry_scheduled",
        ownerLane: "parser",
        nextAction: "retry_parser"
      }),
      expect.objectContaining({
        code: "wrong_actor_query",
        ownerLane: "publicTI",
        nextAction: "retry_query"
      }),
      expect.objectContaining({
        code: "unsupported_source_family",
        ownerLane: "source",
        nextAction: "review_source_family"
      })
    ]));
    expect(projection.consumerContracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        requiredFields: expect.arrayContaining(["readiness.publicTI", "sourceHealth.freshnessState"])
      }),
      expect.objectContaining({
        consumer: "dashboard",
        requiredFields: expect.arrayContaining(["operatorActions[].action", "validationIssues[].code"])
      })
    ]));
    expect(projection.payloadShape).toEqual(expect.arrayContaining([
      "pageReadiness.state",
      "sourceCoverage.families",
      "provenanceRows[].route",
      "enrichmentGaps[].code"
    ]));
    expect(JSON.stringify(projection)).not.toContain("rawText");
    expect(JSON.stringify(projection)).not.toContain("password");
  });

  test("projects ready ransomware actor source operations without enrichment gaps", () => {
    const { lifecycle } = buildFreshSourceLifecycle({ actor: "LockBit" });
    const freshnessPacket = buildSourceProvenanceSourceFreshnessGapPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:45:00.000Z",
      maxAgeDays: 7
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const actionQueue = buildSourceProvenanceSourceOpsActionQueue({
      freshnessPacket,
      parserHealthPacket,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const bundle = buildSourceProvenanceSourceOpsFixtureBundle({
      freshnessPacket,
      parserHealthPacket,
      actionQueue,
      expectedActor: "LockBit",
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const projection = buildSourceProvenancePublicTiSourceOpsProjection({
      bundle,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });

    expect(projection).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PUBLIC_TI_SOURCE_OPS_PROJECTION_SCHEMA_VERSION,
      ok: true,
      actor: "LockBit",
      publicTiRoute: "/ti/LockBit",
      pageReadiness: {
        state: "ready",
        canRender: true,
        publicTI: true,
        dashboard: true,
        sourceOps: true,
        alertGeneration: true
      },
      sourceCoverage: {
        families: [],
        freshnessState: "fresh",
        parserAlertCount: 0,
        operatorActionCount: 0,
        validationIssueCount: 0
      },
      provenanceRows: [],
      enrichmentGaps: [],
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
  });

  test("blocks alert rebuild receipt when response loses provenance or case handoff", () => {
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
    const request = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
    const receipt = buildSourceProvenanceAlertRebuildReceipt({
      request,
      response: {
        rebuiltAt: "2026-06-29T12:03:00.000Z",
        savedAlertCount: 1,
        dryRun: true,
        alerts: [{
          id: "alert_unmatched",
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          watchlistItemIds: ["org_watchlist_item_other"],
          alertGeneratorKeys: ["org:org_acme:watchlist:other"],
          sourceBridgeId: "ti_source_provenance_alertability_other"
        }]
      }
    });

    expect(receipt.ok).toBe(false);
    expect(receipt.matches).toMatchObject({
      alertIds: ["alert_unmatched"],
      watchlistItemIds: [],
      alertGeneratorKeys: [],
      sourceBridgeIds: []
    });
    expect(receipt.caseHandoffRows).toEqual([
      expect.objectContaining({
        alertId: "alert_unmatched",
        ready: false
      })
    ]);
    expect(receipt.blockers.map((blocker) => `${blocker.code}:${blocker.ownerLane}:${blocker.path}`)).toEqual(expect.arrayContaining([
      "missing_watchlist_item_match:org:response.alerts[].watchlistItemIds",
      "missing_alert_generation_ref_match:alert:response.alerts[].alertGeneratorKeys",
      "missing_source_bridge_match:source:response.alerts[].sourceBridgeId",
      "missing_case_handoff:case:response.alerts[].caseId"
    ]));
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

    const packet = buildSourceProvenanceWatchlistAlertBridgePacket({ candidate, request });
    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_WATCHLIST_ALERT_BRIDGE_PACKET_SCHEMA_VERSION,
      ok: false,
      redacted: true,
      watchlist: {
        activeTermCount: 0,
        watchlistItemIds: [],
        alertGeneratorKeys: [],
        terms: []
      },
      alertRequest: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          tenantId: "tenant_acme",
          watchlistItemIds: [],
          alertGeneratorKeys: [],
          dryRun: true
        }
      }
    });
    expect(packet.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "source_provenance_not_ready", ownerLane: "source" }),
      expect.objectContaining({ code: "watchlist_candidate_blocked", ownerLane: "publicTI" }),
      expect.objectContaining({ code: "missing_alert_generation_refs", ownerLane: "alert" })
    ]));
    expect(packet.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "repair_source_provenance", ownerLane: "source" }),
      expect.objectContaining({ action: "materialize_watchlist_terms", ownerLane: "org" }),
      expect.objectContaining({ action: "request_alert_rebuild", ownerLane: "alert" })
    ]));
    expect(JSON.stringify(packet)).not.toContain("cap_telegram_apt29");
    expect(JSON.stringify(packet)).not.toContain("hash_telegram_apt29");
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

function buildFreshSourceLifecycle(input: { actor?: string } = {}) {
  const actor = input.actor ?? "APT28";
  const actorSlug = actor.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const route = `/ti/${encodeURIComponent(actor)}`;
  const contract = buildSourceProvenanceTiPageContract({
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    actor,
    generatedAt: "2026-06-29T12:00:00.000Z",
    rows: [sourceRow({
      actor,
      sourceId: `src_actor_page_${actorSlug}`,
      sourceFamily: "actor_page",
      captureId: `cap_actor_page_${actorSlug}`,
      contentHash: `hash_actor_page_${actorSlug}`,
      provenance: `Actor page fixture confirms ${actor} alias and campaign metadata.`,
      relationship: "actor_activity",
      confidence: 0.82,
      route
    }), sourceRow({
      actor,
      sourceId: `src_public_advisory_${actorSlug}`,
      sourceFamily: "public_advisory",
      captureId: `cap_public_advisory_${actorSlug}`,
      contentHash: `hash_public_advisory_${actorSlug}`,
      provenance: `Public advisory fixture links ${actor} to government targeting.`,
      relationship: "targeting",
      confidence: 0.88,
      route
    })]
  });
  const profile = buildSourceProvenanceActorProfileContract({
    contract,
    values: {
      aliases: actor === "APT28" ? ["APT28", "Fancy Bear"] : [actor],
      motivations: ["espionage"],
      regions: ["Ukraine"],
      infrastructure: ["phishing domains"],
      techniques: ["T1566"],
      campaigns: ["phishing campaign"]
    }
  });
  const plan = buildSourceProvenanceActorProfileGapSourcePlan({ profile });
  const sectorCandidate = plan.candidates.find((candidate) => candidate.field === "sectors");
  expect(sectorCandidate).toBeDefined();
  const workflow = buildSourceProvenanceActorProfileSourceUpdateWorkflow({
    plan,
    health: [{ candidateId: sectorCandidate!.candidateId, parserStatus: "ready" }]
  });
  const request = buildSourceProvenanceSourcePackIntakeRequest({ workflow });
  const receipt = buildSourceProvenanceSourcePackIntakeReceipt({ request });
  const readiness = buildSourceProvenanceSourcePackActivationReadiness({
    receipt,
    generatedAt: "2026-06-29T12:25:00.000Z"
  });
  const bridge = buildSourceProvenanceAlertabilityBridge({ contract, includeSourceFamilies: false, includeRelationships: false });
  const candidate = buildSourceProvenanceOrgWatchlistCandidate({
    bridge,
    watchlistId: `watch_public_ti_${actorSlug}`,
    requestId: "req_source_freshness"
  });
  const rebuildRequest = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
  const rebuildReceipt = buildSourceProvenanceAlertRebuildReceipt({
    request: rebuildRequest,
    response: {
      rebuiltAt: "2026-06-29T12:30:00.000Z",
      savedAlertCount: 1,
      dryRun: true,
      alerts: [{
        id: `alert_${actorSlug}_fresh`,
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        workflowContext: {
          watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
          alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
          sourceBridgeId: bridge.id,
          caseId: `case_${actorSlug}_fresh`,
          casePath: `/dashboard/dwm/cases/case_${actorSlug}_fresh`
        }
      }]
    }
  });
  const enrichment = buildSourceProvenanceAlertEnrichmentPacket({ contract, receipt: rebuildReceipt });
  const handoff = buildSourceProvenanceActorEnrichmentCaseHandoff({ enrichment });
  const lifecycle = buildSourceProvenanceScraperEnrichmentLifecycle({
    activationReadiness: readiness,
    caseHandoff: handoff,
    generatedAt: "2026-06-29T12:35:00.000Z"
  });
  return { contract, readiness, handoff, lifecycle };
}

function buildBlockedSourceLifecycle() {
  const contract = buildSourceProvenanceTiPageContract({
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    actor: "APT28",
    generatedAt: "2026-06-29T12:00:00.000Z",
    rows: [sourceRow({
      actor: "APT28",
      sourceId: "src_actor_page_apt28",
      sourceFamily: "actor_page",
      captureId: "cap_actor_page_apt28",
      capturedAt: "2026-06-01T10:15:00.000Z",
      contentHash: "hash_actor_page_apt28",
      provenance: "Older public actor-page fixture mentions APT28 infrastructure.",
      relationship: "actor_activity",
      confidence: 0.78,
      route: "/ti/APT28"
    })]
  });
  const profile = buildSourceProvenanceActorProfileContract({
    contract,
    values: { aliases: ["APT28", "Fancy Bear"] }
  });
  const plan = buildSourceProvenanceActorProfileGapSourcePlan({ profile });
  const campaignCandidate = plan.candidates.find((candidate) => candidate.field === "campaigns");
  const sectorCandidate = plan.candidates.find((candidate) => candidate.field === "sectors");
  expect(campaignCandidate).toBeDefined();
  expect(sectorCandidate).toBeDefined();
  const workflow = buildSourceProvenanceActorProfileSourceUpdateWorkflow({
    plan,
    health: [{
      candidateId: campaignCandidate!.candidateId,
      parserStatus: "retry_scheduled",
      nextRetryAt: "2026-06-29T12:37:00.000Z",
      failureReason: "fixture parser found no campaign timestamp"
    }, {
      candidateId: sectorCandidate!.candidateId,
      parserStatus: "ready"
    }]
  });
  const request = buildSourceProvenanceSourcePackIntakeRequest({ workflow });
  const receipt = buildSourceProvenanceSourcePackIntakeReceipt({ request });
  const readiness = buildSourceProvenanceSourcePackActivationReadiness({
    receipt,
    generatedAt: "2026-06-29T12:25:00.000Z"
  });
  const bridge = buildSourceProvenanceAlertabilityBridge({ contract, includeSourceFamilies: false, includeRelationships: false });
  const candidate = buildSourceProvenanceOrgWatchlistCandidate({
    bridge,
    watchlistId: "watch_public_ti_apt28",
    requestId: "req_source_freshness_blocked"
  });
  const rebuildRequest = buildSourceProvenanceAlertRebuildRequest({ candidate, sourceContractId: contract.id });
  const rebuildReceipt = buildSourceProvenanceAlertRebuildReceipt({
    request: rebuildRequest,
    response: {
      rebuiltAt: "2026-06-29T12:30:00.000Z",
      savedAlertCount: 1,
      dryRun: true,
      alerts: [{
        id: "alert_apt28_stale",
        tenantId: "tenant_acme",
        organizationId: "org_acme",
        workflowContext: {
          watchlistItemIds: [candidate.activeTerms[0].watchlistItemId],
          alertGeneratorKeys: [candidate.activeTerms[0].alertGeneratorKey],
          sourceBridgeId: bridge.id
        }
      }]
    }
  });
  const enrichment = buildSourceProvenanceAlertEnrichmentPacket({ contract, receipt: rebuildReceipt });
  const handoff = buildSourceProvenanceActorEnrichmentCaseHandoff({ enrichment });
  const lifecycle = buildSourceProvenanceScraperEnrichmentLifecycle({
    activationReadiness: readiness,
    caseHandoff: handoff,
    generatedAt: "2026-06-29T12:35:00.000Z"
  });
  return { contract, readiness, handoff, lifecycle };
}

function sourceRow(overrides: Partial<ReturnType<typeof sourceRowBase>> = {}) {
  return {
    ...sourceRowBase(),
    ...overrides
  };
}

function sourceRowBase() {
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
