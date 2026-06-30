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
  TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_AUDIT_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_REQUEST_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_GROWTH_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_CATALOG_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_READINESS_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_DEDUPE_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_HEALTH_DRILLDOWN_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_INTELLIGENCE_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_READINESS_EXPORT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_RETRY_POLICY_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_CANDIDATE_VALIDATION_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_SOURCE_COVERAGE_PORTFOLIO_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_ALERT_PREREQUISITE_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_HEALTH_EVENT_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_HEALTH_MONITORING_FILTER_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_LIFECYCLE_CLEANUP_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SCRAPER_ENRICHMENT_LIFECYCLE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_FRESHNESS_GAP_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PARSER_HEALTH_ALERT_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PARSER_HEALTH_PROVENANCE_SUMMARY_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_HANDOFF_STATE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_OPS_ACTION_QUEUE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_OPS_FIXTURE_BUNDLE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PUBLIC_TI_SOURCE_OPS_PROJECTION_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PROJECTION_WATCHLIST_RELEVANCE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_WATCHLIST_ALERT_BRIDGE_PACKET_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_EXPORT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_HANDOFF_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CONSUMER_READINESS_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_ALERT_READINESS_BRIDGE_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_PARSER_STATUS_AUDIT_PACKET_SCHEMA_VERSION,
  buildSourceProvenanceAlertabilityBridge,
  buildSourceProvenanceActorProfileContract,
  buildSourceProvenanceActorProfileGapSourcePlan,
  buildSourceProvenanceActorEnrichmentGapReceipt,
  buildSourceProvenanceActorEnrichmentCoverageExport,
  buildSourceProvenanceActorEnrichmentCoverageHandoff,
  buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt,
  buildSourceProvenanceActorEnrichmentSourceAlertReadinessBridge,
  buildSourceProvenanceActorEnrichmentParserStatusAuditPacket,
  buildSourceProvenanceActorProfileSourceUpdateWorkflow,
  buildSourceProvenanceActorEnrichmentCaseHandoff,
  buildSourceProvenanceAlertEnrichmentPacket,
  buildSourceProvenanceAlertRebuildReceipt,
  buildSourceProvenanceAlertRebuildReadiness,
  buildSourceProvenanceAlertRebuildRequest,
  buildSourceProvenanceSourcePackActivationReadiness,
  buildSourceProvenanceSourceActivationAuditPacket,
  buildSourceProvenanceSourceActivationDecisionReceipt,
  buildSourceProvenanceSourcePackFixtureGrowthPacket,
  buildSourceProvenanceSourcePackFixtureCatalogPacket,
  buildSourceProvenanceSourcePackFixtureAlertReadinessPacket,
  buildSourceProvenanceSourcePackFixtureAlertDedupePacket,
  buildSourceProvenanceSourcePackFixtureHealthDrilldownPacket,
  buildSourceProvenanceSourcePackFixtureIntelligencePacket,
  buildSourceProvenanceSourcePackFixtureReadinessExport,
  buildSourceProvenanceSourcePackRetryPolicyPacket,
  buildSourceProvenanceSourceCandidateValidationReceipt,
  buildSourceProvenanceActorSourceCoveragePortfolio,
  buildSourceProvenanceActorEnrichmentAlertPrerequisitePacket,
  buildSourceProvenanceActorEnrichmentSourceHealthEventPacket,
  buildSourceProvenanceSourceHealthMonitoringFilterPacket,
  buildSourceProvenanceSourcePackLifecycleCleanupPacket,
  buildSourceProvenanceSourcePackIntakeRequest,
  buildSourceProvenanceSourcePackIntakeReceipt,
  buildSourceProvenanceScraperEnrichmentLifecycle,
  buildSourceProvenanceSourceFreshnessGapPacket,
  buildSourceProvenanceParserHealthAlertPacket,
  buildSourceProvenanceParserHealthProvenanceSummary,
  buildSourceProvenanceAlertHandoffState,
  buildSourceProvenanceSourceOpsActionQueue,
  buildSourceProvenanceSourceOpsFixtureBundle,
  buildSourceProvenancePublicTiSourceOpsProjection,
  buildSourceProvenanceProjectionWatchlistRelevance,
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

  test("records actor enrichment gap receipt with parser source health provenance", () => {
    const { contract, readiness, lifecycle } = buildBlockedSourceLifecycle();
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({
      profile,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const parserSummary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const receipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      sourcePlan: plan,
      parserHealthSummary: parserSummary,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });

    expect(receipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      actorProfileContractId: profile.id,
      sourcePlanId: plan.id,
      parserHealthProvenanceSummaryId: parserSummary.id,
      coverage: {
        totalGaps: 6,
        candidateBackedGaps: 6,
        readyFamilies: 4,
        blockedFamilies: 1,
        retryableGaps: 1,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "darkweb_metadata", "telegram_public"]),
        lastSuccessAt: "2026-06-29T12:46:00.000Z",
        lastFailureAt: "2026-06-29T12:47:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
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
        gapCode: "missing_campaigns",
        field: "campaigns",
        status: "parser_retry",
        sourceFamily: "telegram_public",
        parserState: "retry_scheduled",
        parserStatus: "retry_scheduled",
        nextAction: "retry_parser",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        coverageCounts: expect.objectContaining({
          parserRetriesQueued: 1,
          alertableCandidates: 0
        }),
        provenance: expect.objectContaining({
          actorProfileContractId: profile.id,
          sourcePlanId: plan.id,
          parserHealthProvenanceSummaryId: parserSummary.id,
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array),
          fixtureBacked: true
        })
      }),
      expect.objectContaining({
        gapCode: "missing_infrastructure",
        field: "infrastructure",
        status: "policy_blocked",
        ownerLane: "policy",
        sourceFamily: "darkweb_metadata",
        nextAction: "request_policy_approval",
        coverageCounts: expect.objectContaining({
          policyReviewsRequired: 1
        })
      }),
      expect.objectContaining({
        gapCode: "missing_sectors",
        field: "sectors",
        status: "source_ready",
        sourceFamily: "public_advisory",
        parserState: "ready",
        nextAction: "inspect_source_health",
        lastSuccessAt: "2026-06-29T12:46:00.000Z",
        coverageCounts: expect.objectContaining({
          activationTestsQueued: 3,
          alertableCandidates: 1
        })
      })
    ]));
    expect(receipt.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ready: true,
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: false,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ dryRun: true })
        })
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        requiredFields: expect.arrayContaining(["rows[].provenance.sourceHealthProofIds"])
      })
    ]));
    expect(receipt.payloadShape).toEqual(expect.arrayContaining([
      "rows[].status",
      "rows[].coverageCounts",
      "rows[].provenance",
      "coverage.nextRetryAt"
    ]));
    expect(JSON.stringify(receipt)).not.toContain("rawText");
    expect(JSON.stringify(receipt)).not.toContain("password");
  });

  test("keeps actor enrichment gap receipt ready when profile has backed coverage", () => {
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
        provenance: "Public advisory links APT29 to phishing infrastructure and defense evasion techniques.",
        relationship: "targeting",
        confidence: 0.8
      }, {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        provenance: "Actor page records Nobelium aliases, espionage motivation, and campaign history.",
        relationship: "tooling",
        confidence: 0.74
      }]
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
    const receipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });

    expect(receipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
      ok: true,
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      rows: [],
      coverage: {
        totalGaps: 0,
        candidateBackedGaps: 0,
        readyFamilies: 0,
        blockedFamilies: 0,
        retryableGaps: 0,
        sourceFamilies: []
      },
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
    expect(receipt.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true }),
      expect.objectContaining({ consumer: "sourceOps", ready: false })
    ]));
  });

  test("exports actor enrichment coverage with blocker provenance for public TI and alerts", () => {
    const { contract, readiness, lifecycle } = buildBlockedSourceLifecycle();
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({
      profile,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const parserSummary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      sourcePlan: plan,
      parserHealthSummary: parserSummary,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverage = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });

    expect(coverage).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_EXPORT_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      actorEnrichmentGapReceiptId: gapReceipt.id,
      summary: {
        fieldCount: 6,
        coveredFieldCount: 3,
        blockedFieldCount: 1,
        retryableFieldCount: 1,
        alertableFamilyCount: 3,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "darkweb_metadata", "telegram_public"]),
        lastSuccessAt: "2026-06-29T12:46:00.000Z",
        lastFailureAt: "2026-06-29T12:47:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(coverage.coverageRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "motivations",
        sourceFamily: "actor_page",
        coverageState: "pending",
        parserStatus: "not_tested",
        blockerCodes: ["coverage_pending"]
      }),
      expect.objectContaining({
        field: "campaigns",
        sourceFamily: "telegram_public",
        coverageState: "retry",
        parserStatus: "retry_scheduled",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        blockerCodes: ["parser_retry"],
        provenance: expect.objectContaining({
          actorEnrichmentGapReceiptId: gapReceipt.id,
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array),
          fixtureBacked: true
        })
      }),
      expect.objectContaining({
        field: "infrastructure",
        sourceFamily: "darkweb_metadata",
        coverageState: "blocked",
        blockerCodes: ["policy_blocked"]
      }),
      expect.objectContaining({
        field: "sectors",
        sourceFamily: "public_advisory",
        coverageState: "covered",
        alertableCandidates: 1,
        blockerCodes: []
      })
    ]));
    expect(coverage.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "coverage_pending",
        ownerLane: "publicTI",
        field: "motivations",
        sourceFamily: "actor_page",
        nextAction: "inspect_source_health"
      }),
      expect.objectContaining({
        code: "parser_retry",
        ownerLane: "parser",
        field: "campaigns",
        sourceFamily: "telegram_public",
        nextAction: "retry_parser",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      }),
      expect.objectContaining({
        code: "policy_blocked",
        ownerLane: "policy",
        field: "infrastructure",
        sourceFamily: "darkweb_metadata",
        nextAction: "request_policy_approval"
      })
    ]));
    expect(coverage.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ready: true,
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: false,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ dryRun: true })
        })
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        requiredFields: expect.arrayContaining(["blockers[].nextAction"])
      })
    ]));
    expect(coverage.payloadShape).toEqual(expect.arrayContaining([
      "coverageRows[].coverageState",
      "coverageRows[].provenance",
      "blockers[].code",
      "summary.nextRetryAt"
    ]));
    expect(JSON.stringify(coverage)).not.toContain("rawText");
    expect(JSON.stringify(coverage)).not.toContain("password");
  });

  test("keeps actor enrichment coverage export ready when actor profile has no gaps", () => {
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
        provenance: "Public advisory links APT29 to phishing infrastructure and defense evasion techniques.",
        relationship: "targeting",
        confidence: 0.8
      }, {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        provenance: "Actor page records Nobelium aliases, espionage motivation, and campaign history.",
        relationship: "tooling",
        confidence: 0.74
      }]
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
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverage = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });

    expect(coverage).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_EXPORT_SCHEMA_VERSION,
      ok: true,
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      actorEnrichmentGapReceiptId: gapReceipt.id,
      blockers: [],
      summary: {
        fieldCount: 1,
        coveredFieldCount: 1,
        blockedFieldCount: 0,
        retryableFieldCount: 0,
        alertableFamilyCount: 0,
        sourceFamilies: []
      },
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
    expect(coverage.coverageRows).toEqual([
      expect.objectContaining({
        field: "sourceProvenance",
        coverageState: "covered",
        blockerCodes: [],
        provenance: expect.objectContaining({
          actorEnrichmentGapReceiptId: gapReceipt.id,
          fixtureBacked: true
        })
      })
    ]);
    expect(coverage.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true }),
      expect.objectContaining({ consumer: "sourceOps", ready: false })
    ]));
  });

  test("hands off actor enrichment coverage to public TI and alert consumers without network fetches", () => {
    const { contract, readiness, lifecycle } = buildBlockedSourceLifecycle();
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({
      profile,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const parserSummary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      sourcePlan: plan,
      parserHealthSummary: parserSummary,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });

    expect(handoff).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_HANDOFF_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      actorEnrichmentCoverageExportId: coverageExport.id,
      publicTi: {
        ready: true,
        route: "/ti/APT28"
      },
      alertGeneration: {
        ready: false,
        route: expect.objectContaining({
          method: "POST",
          path: "/v1/dwm/alerts/rebuild",
          liveNetworkFetch: false,
          body: expect.objectContaining({
            tenantId: "tenant_acme",
            organizationId: "org_acme",
            actor: "APT28",
            actorEnrichmentGapReceiptId: gapReceipt.id,
            dryRun: true
          })
        })
      },
      sourceOps: {
        ready: true
      },
      summary: {
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "darkweb_metadata", "telegram_public"]),
        coveredFieldCount: 3,
        pendingFieldCount: 1,
        retryableFieldCount: 1,
        blockedFieldCount: 1,
        alertableFieldCount: 3,
        lastSuccessAt: "2026-06-29T12:46:00.000Z",
        lastFailureAt: "2026-06-29T12:47:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        blockerCodes: expect.arrayContaining(["coverage_pending", "parser_retry", "policy_blocked"])
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(handoff.publicTi.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "sectors",
        state: "covered",
        sourceFamily: "public_advisory",
        parserStatus: "ready",
        alertableCandidates: 1,
        provenance: expect.objectContaining({
          actorEnrichmentCoverageExportId: coverageExport.id,
          coverageRowId: expect.any(String),
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array),
          fixtureBacked: true
        })
      }),
      expect.objectContaining({
        field: "campaigns",
        state: "retry",
        sourceFamily: "telegram_public",
        parserStatus: "retry_scheduled",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        blockerCodes: ["parser_retry"]
      }),
      expect.objectContaining({
        field: "infrastructure",
        state: "blocked",
        sourceFamily: "darkweb_metadata",
        blockerCodes: ["policy_blocked"]
      })
    ]));
    expect(handoff.alertGeneration.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: "sectors",
        matchable: true,
        sourceFamily: "public_advisory",
        provenanceIds: expect.objectContaining({
          actorEnrichmentCoverageExportId: coverageExport.id,
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array)
        })
      }),
      expect.objectContaining({
        field: "campaigns",
        matchable: false,
        retryReady: true,
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        blockerCodes: ["parser_retry"]
      })
    ]));
    expect(handoff.sourceOps.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "inspect",
        field: "motivations",
        blockerCode: "coverage_pending",
        provenanceRef: expect.any(String)
      }),
      expect.objectContaining({
        action: "retry",
        field: "campaigns",
        sourceFamily: "telegram_public",
        blockerCode: "parser_retry",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      }),
      expect.objectContaining({
        action: "request_policy_approval",
        field: "infrastructure",
        sourceFamily: "darkweb_metadata",
        blockerCode: "policy_blocked"
      })
    ]));
    expect(handoff.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: false }),
      expect.objectContaining({ consumer: "sourceOps", ready: true })
    ]));
    expect(JSON.stringify(handoff)).not.toContain("rawText");
    expect(JSON.stringify(handoff)).not.toContain("password");
  });

  test("keeps actor enrichment coverage handoff ready when all fields are backed", () => {
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
        provenance: "Public advisory records APT29 infrastructure and targeting coverage.",
        relationship: "targeting",
        confidence: 0.8
      }]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: {
        aliases: ["APT29", "Nobelium"],
        motivations: ["espionage"],
        sectors: ["government"],
        regions: ["Europe"],
        infrastructure: ["example.com"],
        techniques: ["phishing"],
        campaigns: ["diplomatic phishing"]
      }
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });

    expect(handoff).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_COVERAGE_HANDOFF_SCHEMA_VERSION,
      ok: true,
      actor: "APT29",
      publicTi: {
        ready: true,
        fields: [expect.objectContaining({
          field: "sourceProvenance",
          state: "covered",
          alertableCandidates: 0,
          blockerCodes: []
        })]
      },
      alertGeneration: {
        ready: true,
        rows: [expect.objectContaining({
          field: "sourceProvenance",
          matchable: false,
          retryReady: false,
          blockerCodes: []
        })]
      },
      sourceOps: {
        ready: false,
        actions: []
      },
      summary: {
        coveredFieldCount: 1,
        pendingFieldCount: 0,
        retryableFieldCount: 0,
        blockedFieldCount: 0,
        alertableFieldCount: 0,
        blockerCodes: []
      },
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
  });

  test("receipts actor enrichment consumer readiness from coverage handoff", () => {
    const { contract, readiness, lifecycle } = buildBlockedSourceLifecycle();
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({
      profile,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const parserSummary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      sourcePlan: plan,
      parserHealthSummary: parserSummary,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });
    const receipt = buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt({
      handoff,
      generatedAt: "2026-06-29T12:52:00.000Z"
    });

    expect(receipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CONSUMER_READINESS_RECEIPT_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      actorEnrichmentCoverageHandoffId: handoff.id,
      sourceHealth: {
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "darkweb_metadata", "telegram_public"]),
        parserStatuses: expect.arrayContaining(["not_tested", "ready", "blocked", "retry_scheduled"]),
        coveredFieldCount: 3,
        pendingFieldCount: 1,
        retryableFieldCount: 1,
        blockedFieldCount: 1,
        alertableFieldCount: 3,
        lastSuccessAt: "2026-06-29T12:46:00.000Z",
        lastFailureAt: "2026-06-29T12:47:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(receipt.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ready: true,
        state: "ready",
        route: "/ti/APT28",
        sourceFamilies: expect.arrayContaining(["public_advisory", "telegram_public"]),
        coverageCounts: {
          covered: 3,
          pending: 1,
          retryable: 1,
          blocked: 1,
          alertable: 3
        },
        retry: {
          retryable: true,
          nextRetryAt: "2026-06-29T12:37:00.000Z",
          retryFields: ["campaigns"]
        },
        blockerCodes: expect.arrayContaining(["coverage_pending", "parser_retry", "policy_blocked"]),
        provenanceIds: expect.objectContaining({
          actorEnrichmentCoverageHandoffId: handoff.id,
          coverageExportId: coverageExport.id,
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array)
        })
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: false,
        state: "blocked",
        route: "/v1/dwm/alerts/rebuild",
        parserStatuses: expect.arrayContaining(["retry_scheduled", "blocked"])
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        state: "action_required",
        route: "/v1/dwm/source-requests"
      })
    ]));
    expect(receipt.blockerSummary).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "parser_retry",
        consumer: "alertGeneration",
        field: "campaigns",
        ownerLane: "parser",
        action: "retry",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        provenanceRef: expect.any(String)
      }),
      expect.objectContaining({
        code: "policy_blocked",
        consumer: "sourceOps",
        field: "infrastructure",
        ownerLane: "policy",
        action: "request_policy_approval"
      })
    ]));
    expect(receipt.payloadShape).toEqual(expect.arrayContaining([
      "rows[].coverageCounts",
      "rows[].retry",
      "rows[].provenanceIds",
      "sourceHealth"
    ]));
    expect(JSON.stringify(receipt)).not.toContain("rawText");
    expect(JSON.stringify(receipt)).not.toContain("password");
  });

  test("keeps actor enrichment consumer readiness receipt ready for backed coverage", () => {
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
        provenance: "Public advisory records APT29 infrastructure and targeting coverage.",
        relationship: "targeting",
        confidence: 0.8
      }, {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        provenance: "Actor page records Nobelium aliases and source provenance coverage.",
        relationship: "actor_activity",
        confidence: 0.78
      }]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: {
        aliases: ["APT29", "Nobelium"],
        motivations: ["espionage"],
        sectors: ["government"],
        regions: ["Europe"],
        infrastructure: ["example.com"],
        techniques: ["phishing"],
        campaigns: ["diplomatic phishing"]
      }
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });
    const receipt = buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt({
      handoff,
      generatedAt: "2026-06-29T12:52:00.000Z"
    });

    expect(receipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_CONSUMER_READINESS_RECEIPT_SCHEMA_VERSION,
      ok: true,
      actor: "APT29",
      sourceHealth: {
        sourceFamilies: [],
        parserStatuses: [],
        coveredFieldCount: 1,
        pendingFieldCount: 0,
        retryableFieldCount: 0,
        blockedFieldCount: 0,
        alertableFieldCount: 0
      },
      blockerSummary: [],
      safeOutput: {
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(receipt.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, state: "ready", blockerCodes: [] }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, state: "ready", blockerCodes: [] }),
      expect.objectContaining({ consumer: "sourceOps", ready: false, state: "ready", blockerCodes: [] })
    ]));
  });

  test("bridges source readiness receipt into public TI and alert readiness", () => {
    const { contract, readiness, lifecycle } = buildBlockedSourceLifecycle();
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({
      profile,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const parserSummary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      sourcePlan: plan,
      parserHealthSummary: parserSummary,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });
    const receipt = buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt({
      handoff,
      generatedAt: "2026-06-29T12:52:00.000Z"
    });
    const bridge = buildSourceProvenanceActorEnrichmentSourceAlertReadinessBridge({
      receipt,
      generatedAt: "2026-06-29T12:53:00.000Z"
    });

    expect(bridge).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_ALERT_READINESS_BRIDGE_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      consumerReadinessReceiptId: receipt.id,
      readiness: {
        state: "partial",
        publicTI: true,
        alertGeneration: false,
        sourceOpsActionRequired: true
      },
      publicTi: {
        ready: true,
        route: "/ti/APT28",
        coverageCounts: {
          covered: 3,
          pending: 1,
          retryable: 1,
          blocked: 1,
          alertable: 3
        },
        blockerCodes: expect.arrayContaining(["coverage_pending", "parser_retry", "policy_blocked"]),
        provenanceIds: expect.objectContaining({
          actorEnrichmentCoverageHandoffId: handoff.id,
          coverageExportId: coverageExport.id,
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array)
        })
      },
      alertGeneration: {
        ready: false,
        route: "/v1/dwm/alerts/rebuild",
        matchableFieldCount: 3,
        retryable: true,
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        blockerCodes: expect.arrayContaining(["coverage_pending", "parser_retry", "policy_blocked"])
      },
      sourceHealth: {
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "darkweb_metadata", "telegram_public"]),
        parserStatuses: expect.arrayContaining(["not_tested", "ready", "blocked", "retry_scheduled"]),
        lastFailureAt: "2026-06-29T12:47:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(bridge.operatorActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "retry",
        consumer: "alertGeneration",
        field: "campaigns",
        blockerCode: "parser_retry",
        ownerLane: "parser",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        provenanceRef: expect.any(String)
      }),
      expect.objectContaining({
        action: "request_policy_approval",
        consumer: "sourceOps",
        field: "infrastructure",
        blockerCode: "policy_blocked",
        ownerLane: "policy"
      })
    ]));
    expect(bridge.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: false }),
      expect.objectContaining({ consumer: "sourceOps", ready: true })
    ]));
    expect(JSON.stringify(bridge)).not.toContain("rawText");
    expect(JSON.stringify(bridge)).not.toContain("password");
  });

  test("keeps source alert readiness bridge ready for backed coverage", () => {
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
        provenance: "Public advisory records APT29 infrastructure and targeting coverage.",
        relationship: "targeting",
        confidence: 0.8
      }, {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        provenance: "Actor page records Nobelium aliases and source provenance coverage.",
        relationship: "actor_activity",
        confidence: 0.78
      }]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: {
        aliases: ["APT29", "Nobelium"],
        motivations: ["espionage"],
        sectors: ["government"],
        regions: ["Europe"],
        infrastructure: ["example.com"],
        techniques: ["phishing"],
        campaigns: ["diplomatic phishing"]
      }
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });
    const receipt = buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt({
      handoff,
      generatedAt: "2026-06-29T12:52:00.000Z"
    });
    const bridge = buildSourceProvenanceActorEnrichmentSourceAlertReadinessBridge({
      receipt,
      generatedAt: "2026-06-29T12:53:00.000Z"
    });

    expect(bridge).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_ALERT_READINESS_BRIDGE_SCHEMA_VERSION,
      ok: true,
      actor: "APT29",
      readiness: {
        state: "ready",
        publicTI: true,
        alertGeneration: true,
        sourceOpsActionRequired: false
      },
      publicTi: {
        ready: true,
        coverageCounts: {
          covered: 1,
          pending: 0,
          retryable: 0,
          blocked: 0,
          alertable: 0
        },
        blockerCodes: []
      },
      alertGeneration: {
        ready: true,
        matchableFieldCount: 0,
        retryable: false,
        blockerCodes: []
      },
      operatorActions: [],
      safeOutput: {
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
  });

  test("builds parser status audit events from actor enrichment readiness", () => {
    const { contract, readiness, lifecycle } = buildBlockedSourceLifecycle();
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: { aliases: ["APT28", "Fancy Bear"] }
    });
    const plan = buildSourceProvenanceActorProfileGapSourcePlan({
      profile,
      generatedAt: "2026-06-29T12:05:00.000Z"
    });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const parserSummary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      sourcePlan: plan,
      parserHealthSummary: parserSummary,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });
    const receipt = buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt({
      handoff,
      generatedAt: "2026-06-29T12:52:00.000Z"
    });
    const packet = buildSourceProvenanceActorEnrichmentParserStatusAuditPacket({
      receipt,
      generatedAt: "2026-06-29T12:54:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_PARSER_STATUS_AUDIT_PACKET_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      consumerReadinessReceiptId: receipt.id,
      summary: {
        readyConsumers: 2,
        blockedConsumers: 1,
        actionRequiredEvents: 4,
        retryableEvents: expect.any(Number),
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "darkweb_metadata", "telegram_public"]),
        parserStatuses: expect.arrayContaining(["not_tested", "ready", "retry_scheduled", "blocked"]),
        blockerCodes: expect.arrayContaining(["coverage_pending", "parser_retry", "policy_blocked"]),
        lastSuccessAt: "2026-06-29T12:46:00.000Z",
        lastFailureAt: "2026-06-29T12:47:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(packet.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "consumer_readiness",
        consumer: "publicTI",
        state: "ready",
        parserStatus: "ready",
        coverageCounts: expect.objectContaining({ covered: 3, retryable: 1, blocked: 1 }),
        provenanceIds: expect.objectContaining({
          actorEnrichmentCoverageHandoffId: handoff.id,
          coverageExportId: coverageExport.id,
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array)
        })
      }),
      expect.objectContaining({
        eventType: "blocker_action",
        consumer: "alertGeneration",
        field: "campaigns",
        blockerCode: "parser_retry",
        ownerLane: "parser",
        action: "retry",
        parserStatus: "retry_scheduled",
        retry: expect.objectContaining({
          retryable: true,
          nextRetryAt: "2026-06-29T12:37:00.000Z",
          retryFields: expect.arrayContaining(["campaigns"])
        }),
        provenanceRef: expect.any(String)
      }),
      expect.objectContaining({
        eventType: "blocker_action",
        consumer: "sourceOps",
        field: "infrastructure",
        blockerCode: "policy_blocked",
        ownerLane: "policy",
        action: "request_policy_approval",
        parserStatus: "blocked"
      })
    ]));
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: false }),
      expect.objectContaining({ consumer: "sourceOps", ready: true })
    ]));
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "events[].parserStatus",
      "events[].retry",
      "events[].provenanceIds",
      "summary"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("keeps parser status audit packet ready for backed actor coverage", () => {
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
        provenance: "Public advisory records APT29 infrastructure and targeting coverage.",
        relationship: "targeting",
        confidence: 0.8
      }, {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        provenance: "Actor page records Nobelium aliases and source provenance coverage.",
        relationship: "actor_activity",
        confidence: 0.78
      }]
    });
    const profile = buildSourceProvenanceActorProfileContract({
      contract,
      values: {
        aliases: ["APT29", "Nobelium"],
        motivations: ["espionage"],
        sectors: ["government"],
        regions: ["Europe"],
        infrastructure: ["example.com"],
        techniques: ["phishing"],
        campaigns: ["diplomatic phishing"]
      }
    });
    const gapReceipt = buildSourceProvenanceActorEnrichmentGapReceipt({
      profile,
      generatedAt: "2026-06-29T12:49:00.000Z"
    });
    const coverageExport = buildSourceProvenanceActorEnrichmentCoverageExport({
      gapReceipt,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const handoff = buildSourceProvenanceActorEnrichmentCoverageHandoff({
      coverageExport,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });
    const receipt = buildSourceProvenanceActorEnrichmentConsumerReadinessReceipt({
      handoff,
      generatedAt: "2026-06-29T12:52:00.000Z"
    });
    const packet = buildSourceProvenanceActorEnrichmentParserStatusAuditPacket({
      receipt,
      generatedAt: "2026-06-29T12:54:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_PARSER_STATUS_AUDIT_PACKET_SCHEMA_VERSION,
      ok: true,
      actor: "APT29",
      summary: {
        totalEvents: 3,
        readyConsumers: 2,
        blockedConsumers: 0,
        actionRequiredEvents: 0,
        retryableEvents: 0,
        sourceFamilies: [],
        parserStatuses: ["ready"],
        blockerCodes: []
      },
      safeOutput: {
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(packet.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", eventType: "consumer_readiness", parserStatus: "ready" }),
      expect.objectContaining({ consumer: "alertGeneration", eventType: "consumer_readiness", parserStatus: "ready" }),
      expect.objectContaining({ consumer: "sourceOps", eventType: "consumer_readiness", state: "ready", parserStatus: "ready" })
    ]));
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

  test("builds source activation audit events from readiness without network collection", () => {
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
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:26:00.000Z"
    });

    expect(auditPacket).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_AUDIT_PACKET_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourcePackActivationReadinessId: readiness.id,
      summary: {
        readyToTest: 4,
        retryScheduled: 1,
        policyBlocked: 1,
        parserReady: 1,
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(auditPacket.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "ready_to_test",
        decision: "queue_activation_test",
        family: "public_advisory",
        parserStatus: "ready",
        alertability: {
          canGenerateAlertEvidence: true,
          blockedByPolicy: false,
          blockedByParser: false
        },
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "test", dryRun: true }),
          liveNetworkFetch: false
        }),
        provenance: expect.objectContaining({
          sourcePackActivationReadinessId: readiness.id,
          fixtureBacked: true
        })
      }),
      expect.objectContaining({
        status: "retry_scheduled",
        decision: "retry_parser",
        family: "telegram_public",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        alertability: expect.objectContaining({
          canGenerateAlertEvidence: false,
          blockedByParser: true
        })
      }),
      expect.objectContaining({
        status: "policy_blocked",
        decision: "request_policy_review",
        family: "darkweb_metadata",
        alertability: expect.objectContaining({
          canGenerateAlertEvidence: false,
          blockedByPolicy: true
        })
      })
    ]));
    expect(auditPacket.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        route: expect.objectContaining({ liveNetworkFetch: false })
      }),
      expect.objectContaining({
        consumer: "publicTI",
        ready: false,
        requiredFields: expect.arrayContaining(["events[].provenance"])
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
    expect(auditPacket.payloadShape).toEqual(expect.arrayContaining([
      "events[].provenance",
      "events[].alertability",
      "summary.nextRetryAt"
    ]));
    expect(JSON.stringify(auditPacket)).not.toContain("rawText");
    expect(JSON.stringify(auditPacket)).not.toContain("password");
  });

  test("records source activation decision receipts for public TI and alert consumers", () => {
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
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:26:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:27:00.000Z"
    });

    expect(decisionReceipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourceActivationAuditPacketId: auditPacket.id,
      summary: {
        decisionCount: 6,
        activationTestsQueued: 4,
        parserRetriesQueued: 1,
        policyReviewsRequired: 1,
        alertableCandidates: 1,
        lastSuccessAt: "2026-06-29T12:27:00.000Z",
        lastFailureAt: "2026-06-29T12:27:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(decisionReceipt.familyCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "public_advisory",
        activationTestsQueued: 3,
        alertableCandidates: 1
      }),
      expect.objectContaining({
        family: "telegram_public",
        parserRetriesQueued: 1,
        policyReviewsRequired: 0
      }),
      expect.objectContaining({
        family: "darkweb_metadata",
        activationTestsQueued: 0,
        policyReviewsRequired: 1
      })
    ]));
    expect(decisionReceipt.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        outcome: "activation_test_queued",
        status: "accepted",
        family: "public_advisory",
        parserStatus: "ready",
        lastSuccessAt: "2026-06-29T12:27:00.000Z",
        provenance: expect.objectContaining({
          sourceActivationAuditPacketId: auditPacket.id,
          sourcePackActivationReadinessId: readiness.id,
          fixtureBacked: true
        }),
        alertability: expect.objectContaining({ canGenerateAlertEvidence: true })
      }),
      expect.objectContaining({
        outcome: "parser_retry_queued",
        status: "retry_scheduled",
        family: "telegram_public",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        lastFailureAt: "2026-06-29T12:27:00.000Z"
      }),
      expect.objectContaining({
        outcome: "policy_review_required",
        status: "blocked",
        family: "darkweb_metadata",
        lastFailureAt: "2026-06-29T12:27:00.000Z"
      })
    ]));
    expect(decisionReceipt.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          liveNetworkFetch: false
        })
      }),
      expect.objectContaining({
        consumer: "publicTI",
        ready: true,
        requiredFields: expect.arrayContaining(["decisions[].provenance"])
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
    expect(decisionReceipt.payloadShape).toEqual(expect.arrayContaining([
      "decisions[].lastSuccessAt",
      "decisions[].lastFailureAt",
      "familyCoverage[]",
      "summary.alertableCandidates"
    ]));
    expect(JSON.stringify(decisionReceipt)).not.toContain("rawText");
    expect(JSON.stringify(decisionReceipt)).not.toContain("password");
  });

  test("builds no-network source-pack fixture growth for actor enrichment and alert captures", () => {
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
    const readiness = buildSourceProvenanceSourcePackActivationReadiness({ receipt });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({ activationReadiness: readiness });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:27:00.000Z"
    });
    const packet = buildSourceProvenanceSourcePackFixtureGrowthPacket({
      decisionReceipt,
      generatedAt: "2026-06-29T12:28:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_GROWTH_PACKET_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourceActivationDecisionReceiptId: decisionReceipt.id,
      summary: {
        actorEnrichmentUpdates: 4,
        alertReadyCaptures: 1,
        healthySources: 2,
        degradedSources: 3,
        staleSources: 1,
        blockedSources: 1,
        sourceFamilies: expect.arrayContaining(["public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        newestFreshnessAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(packet.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rowType: "actor_enrichment_update",
        sourceFamily: "public_advisory",
        parserStatus: "ready",
        healthState: "healthy",
        publicTiRoute: "/ti/APT28",
        freshness: expect.objectContaining({ state: "fresh", observedAt: "2026-06-29T12:27:00.000Z" }),
        downstreamRoutes: {
          publicTI: "/ti/APT28",
          alertGeneration: "/v1/dwm/alerts/rebuild",
          sourceOps: "/v1/dwm/source-requests"
        },
        provenance: expect.objectContaining({
          sourceActivationDecisionReceiptId: decisionReceipt.id,
          sourceActivationAuditPacketId: auditPacket.id,
          sourcePackActivationReadinessId: readiness.id,
          captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
          contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/),
          fixtureBacked: true
        })
      }),
      expect.objectContaining({
        rowType: "alert_ready_capture",
        sourceFamily: "public_advisory",
        healthState: "healthy",
        provenance: expect.objectContaining({
          captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
          contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/)
        })
      }),
      expect.objectContaining({
        rowType: "source_blocker",
        sourceFamily: "telegram_public",
        parserStatus: "retry_scheduled",
        healthState: "stale",
        freshness: expect.objectContaining({ state: "stale", nextRetryAt: "2026-06-29T12:37:00.000Z" }),
        retry: {
          retryable: true,
          nextRetryAt: "2026-06-29T12:37:00.000Z",
          policyReviewRequired: false
        },
        blockerReason: "fixture parser found no campaign timestamp"
      }),
      expect.objectContaining({
        rowType: "source_blocker",
        sourceFamily: "darkweb_metadata",
        parserStatus: "blocked",
        healthState: "blocked",
        freshness: expect.objectContaining({ state: "missing" }),
        retry: expect.objectContaining({ retryable: false, policyReviewRequired: true }),
        blockerReason: "Candidate requires policy approval before intake."
      })
    ]));
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ready: true,
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false }),
        requiredFields: expect.arrayContaining(["rows[].freshness", "rows[].provenance.contentHash"])
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: true,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ sourceActivationDecisionReceiptId: decisionReceipt.id, dryRun: true })
        })
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        requiredFields: expect.arrayContaining(["rows[].healthState", "rows[].retry", "rows[].blockerReason"])
      })
    ]));
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "rows[].healthState",
      "rows[].downstreamRoutes",
      "rows[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("catalogs no-network source-pack fixtures for APT and ransomware coverage", () => {
    const aptGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_catalog",
      captureId: "cap_actor_page_apt29_catalog",
      contentHash: "hash_actor_page_apt29_catalog",
      provenance: "Actor page fixture gives APT29 source pack catalog coverage with backed provenance.",
      relationship: "actor_activity"
    });
    const ransomwareGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_catalog",
      captureId: "cap_public_advisory_akira_catalog",
      contentHash: "hash_public_advisory_akira_catalog",
      provenance: "Public advisory fixture gives Akira ransomware source pack catalog coverage.",
      relationship: "targeting"
    });
    const catalog = buildSourceProvenanceSourcePackFixtureCatalogPacket({
      growthPackets: [aptGrowthPacket, ransomwareGrowthPacket],
      generatedAt: "2026-06-29T13:10:00.000Z"
    });

    expect(catalog).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_CATALOG_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourcePackFixtureGrowthPacketIds: [aptGrowthPacket.id, ransomwareGrowthPacket.id],
      summary: {
        actorCount: 2,
        actors: expect.arrayContaining(["APT29", "Akira"]),
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        coverageTags: expect.arrayContaining([
          "actor_profile",
          "source_provenance",
          "alertable_fields",
          "watchlist_terms",
          "actor_metadata",
          "public_advisory",
          "telegram_public",
          "metadata_only",
          "retry_backoff",
          "policy_blocked"
        ]),
        newestObservedAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(catalog.summary.rowCount).toBe(catalog.rows.length);
    expect(catalog.summary.alertReadyRows).toBe(2);
    expect(catalog.summary.blockedRows >= 2).toBe(true);
    expect(catalog.summary.averageConfidence > 0.5).toBe(true);

    const aptAlertRow = catalog.rows.find((row) => row.actor === "APT29" && row.rowType === "alert_ready_capture");
    const ransomwareProfileRow = catalog.rows.find((row) => row.actor === "Akira" && row.sourceFamily === "public_advisory" && row.rowType === "actor_enrichment_update");
    const telegramRetryRow = catalog.rows.find((row) => row.actor === "APT29" && row.sourceFamily === "telegram_public" && row.healthState === "stale");
    const metadataBlockedRow = catalog.rows.find((row) => row.actor === "Akira" && row.sourceFamily === "darkweb_metadata" && row.healthState === "blocked");

    expect(aptAlertRow).toMatchObject({
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      rowType: "alert_ready_capture",
      parserStatus: "ready",
      healthState: "healthy",
      observedAt: "2026-06-29T12:27:00.000Z",
      confidence: 0.9,
      coverageTags: expect.arrayContaining(["alertable_fields", "watchlist_terms"]),
      downstreamRoutes: expect.objectContaining({
        publicTI: "/ti/APT29",
        alertGeneration: "/v1/dwm/alerts/rebuild"
      }),
      provenance: expect.objectContaining({
        captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
        contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/),
        fixtureBacked: true
      })
    });
    expect(ransomwareProfileRow).toMatchObject({
      actor: "Akira",
      publicTiRoute: "/ti/Akira",
      sourceFamily: "public_advisory",
      confidence: 0.86,
      coverageTags: expect.arrayContaining(["actor_profile", "source_provenance", "public_advisory"])
    });
    expect(telegramRetryRow).toMatchObject({
      actor: "APT29",
      sourceFamily: "telegram_public",
      healthState: "stale",
      nextRetryAt: "2026-06-29T12:37:00.000Z",
      coverageTags: expect.arrayContaining(["retry_backoff", "stale_source", "telegram_public"])
    });
    expect(metadataBlockedRow).toMatchObject({
      actor: "Akira",
      sourceFamily: "darkweb_metadata",
      healthState: "blocked",
      confidence: 0.2,
      coverageTags: expect.arrayContaining(["metadata_only", "policy_blocked", "source_health_blocker"])
    });
    expect(catalog.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/:query", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, requiredFields: expect.arrayContaining(["rows[].confidence", "rows[].coverageTags"]) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["rows[].sourceFamily", "rows[].parserStatus", "rows[].healthState"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["sourcePackFixtureGrowthPacketIds", "rows[].provenance", "consumers[]"]) })
    ]));
    expect(catalog.payloadShape).toEqual(expect.arrayContaining([
      "rows[].confidence",
      "rows[].coverageTags",
      "rows[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(catalog)).not.toContain("rawText");
    expect(JSON.stringify(catalog)).not.toContain("password");
  });

  test("bridges source-pack fixture catalog into alert readiness handoff", () => {
    const aptGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_alert_bridge",
      captureId: "cap_actor_page_apt29_alert_bridge",
      contentHash: "hash_actor_page_apt29_alert_bridge",
      provenance: "Actor page fixture gives APT29 alert readiness bridge coverage.",
      relationship: "actor_activity"
    });
    const ransomwareGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_alert_bridge",
      captureId: "cap_public_advisory_akira_alert_bridge",
      contentHash: "hash_public_advisory_akira_alert_bridge",
      provenance: "Public advisory fixture gives Akira alert readiness bridge coverage.",
      relationship: "targeting"
    });
    const catalog = buildSourceProvenanceSourcePackFixtureCatalogPacket({
      growthPackets: [aptGrowthPacket, ransomwareGrowthPacket],
      generatedAt: "2026-06-29T13:20:00.000Z"
    });
    const handoff = buildSourceProvenanceSourcePackFixtureAlertReadinessPacket({
      catalog,
      generatedAt: "2026-06-29T13:21:00.000Z"
    });

    expect(handoff).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_READINESS_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourcePackFixtureCatalogPacketId: catalog.id,
      summary: {
        rowCount: catalog.rows.length,
        readyRows: 2,
        actors: expect.arrayContaining(["APT29", "Akira"]),
        publicTiRoutes: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        coverageTags: expect.arrayContaining(["alertable_fields", "watchlist_terms", "retry_backoff", "policy_blocked", "metadata_only"]),
        prerequisiteCodes: expect.arrayContaining([
          "watchlist_materialization_required",
          "parser_health_inspection_required",
          "parser_retry_required",
          "policy_review_required"
        ]),
        newestObservedAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(handoff.summary.partialRows >= 2).toBe(true);
    expect(handoff.summary.blockedRows >= 2).toBe(true);
    expect(handoff.summary.averageConfidence > 0.5).toBe(true);

    const readyAptRow = handoff.rows.find((row) => row.actor === "APT29" && row.alertReadiness === "ready");
    const staleTelegramRow = handoff.rows.find((row) => row.actor === "APT29" && row.sourceFamily === "telegram_public" && row.healthState === "stale");
    const blockedMetadataRow = handoff.rows.find((row) => row.actor === "Akira" && row.sourceFamily === "darkweb_metadata");
    const profileRow = handoff.rows.find((row) => row.actor === "APT29" && row.rowType === "actor_enrichment_update" && row.healthState === "healthy");

    expect(readyAptRow).toMatchObject({
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      rowType: "alert_ready_capture",
      parserStatus: "ready",
      healthState: "healthy",
      alertReadiness: "ready",
      confidence: 0.9,
      coverageTags: expect.arrayContaining(["alertable_fields", "watchlist_terms"]),
      prerequisites: [],
      remediation: expect.objectContaining({
        action: "queue_alert_rebuild",
        ownerLane: "alert",
        route: expect.objectContaining({
          method: "POST",
          path: "/v1/dwm/alerts/rebuild",
          liveNetworkFetch: false
        })
      }),
      provenance: expect.objectContaining({
        captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
        contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/),
        fixtureBacked: true
      })
    });
    expect(staleTelegramRow).toMatchObject({
      actor: "APT29",
      sourceFamily: "telegram_public",
      alertReadiness: "blocked",
      nextRetryAt: "2026-06-29T12:37:00.000Z",
      prerequisites: [expect.objectContaining({
        code: "parser_retry_required",
        ownerLane: "parser",
        nextAction: "retry_parser",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        route: expect.objectContaining({ path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      })],
      remediation: expect.objectContaining({
        action: "retry_parser",
        ownerLane: "parser"
      })
    });
    expect(blockedMetadataRow).toMatchObject({
      actor: "Akira",
      sourceFamily: "darkweb_metadata",
      alertReadiness: "blocked",
      coverageTags: expect.arrayContaining(["metadata_only", "policy_blocked"]),
      prerequisites: [expect.objectContaining({
        code: "policy_review_required",
        ownerLane: "policy",
        nextAction: "request_policy_review",
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          body: expect.objectContaining({ metadataOnly: true, dryRun: true }),
          liveNetworkFetch: false
        })
      })],
      remediation: expect.objectContaining({
        action: "request_policy_review",
        ownerLane: "policy"
      })
    });
    expect(profileRow).toMatchObject({
      actor: "APT29",
      alertReadiness: "partial",
      prerequisites: [expect.objectContaining({
        code: "watchlist_materialization_required",
        ownerLane: "org",
        nextAction: "materialize_watchlist_terms",
        route: expect.objectContaining({ path: "/v1/organizations/watchlists/terms", liveNetworkFetch: false })
      })]
    });
    expect(handoff.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/:query", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["rows[].prerequisites", "summary.prerequisiteCodes"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["sourcePackFixtureCatalogPacketId", "rows[].remediation", "safeOutput"]) })
    ]));
    expect(handoff.payloadShape).toEqual(expect.arrayContaining([
      "rows[].alertReadiness",
      "rows[].prerequisites",
      "rows[].remediation",
      "rows[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(handoff)).not.toContain("rawText");
    expect(JSON.stringify(handoff)).not.toContain("password");
  });

  test("dedupes fixture alert readiness rows before alert rebuild consumers", () => {
    const aptGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_dedupe",
      captureId: "cap_actor_page_apt29_dedupe",
      contentHash: "hash_actor_page_apt29_dedupe",
      provenance: "Actor page fixture gives APT29 dedupe coverage.",
      relationship: "actor_activity"
    });
    const ransomwareGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_dedupe",
      captureId: "cap_public_advisory_akira_dedupe",
      contentHash: "hash_public_advisory_akira_dedupe",
      provenance: "Public advisory fixture gives Akira dedupe coverage.",
      relationship: "targeting"
    });
    const catalog = buildSourceProvenanceSourcePackFixtureCatalogPacket({
      growthPackets: [aptGrowthPacket, ransomwareGrowthPacket],
      generatedAt: "2026-06-29T13:30:00.000Z"
    });
    const handoff = buildSourceProvenanceSourcePackFixtureAlertReadinessPacket({
      catalog,
      generatedAt: "2026-06-29T13:31:00.000Z"
    });
    const readyAptRow = handoff.rows.find((row) => row.actor === "APT29" && row.alertReadiness === "ready");
    expect(readyAptRow).toBeDefined();
    const duplicatedHandoff = {
      ...handoff,
      rows: [...handoff.rows, {
        ...readyAptRow!,
        readinessRowId: `${readyAptRow!.readinessRowId}_duplicate`
      }]
    };
    const packet = buildSourceProvenanceSourcePackFixtureAlertDedupePacket({
      alertReadiness: duplicatedHandoff,
      generatedAt: "2026-06-29T13:32:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_ALERT_DEDUPE_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourcePackFixtureAlertReadinessPacketId: handoff.id,
      summary: {
        rowCount: handoff.rows.length + 1,
        canonicalReadyRows: 2,
        duplicateRows: 1,
        actors: expect.arrayContaining(["APT29", "Akira"]),
        publicTiRoutes: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        blockerCodes: expect.arrayContaining([
          "duplicate_fixture_capture",
          "not_alert_ready",
          "parser_retry_required",
          "policy_review_required",
          "watchlist_materialization_required"
        ]),
        newestObservedAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(packet.summary.heldRows >= 5).toBe(true);

    const canonicalAptRows = packet.rows.filter((row) => row.actor === "APT29" && row.dedupeState === "canonical" && row.alertEligibility === "ready");
    const duplicateAptRow = packet.rows.find((row) => row.actor === "APT29" && row.dedupeState === "duplicate");
    const heldPolicyRow = packet.rows.find((row) => row.actor === "Akira" && row.sourceFamily === "darkweb_metadata");
    const heldParserRow = packet.rows.find((row) => row.actor === "APT29" && row.sourceFamily === "telegram_public");

    expect(canonicalAptRows.length).toBe(1);
    expect(canonicalAptRows[0]).toMatchObject({
      actor: "APT29",
      dedupeState: "canonical",
      alertEligibility: "ready",
      blockerCodes: [],
      action: expect.objectContaining({
        action: "queue_alert_rebuild",
        ownerLane: "alert",
        route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false })
      }),
      provenance: expect.objectContaining({
        captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
        contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/),
        fixtureBacked: true
      })
    });
    expect(duplicateAptRow).toMatchObject({
      actor: "APT29",
      dedupeState: "duplicate",
      alertEligibility: "held",
      duplicateOf: canonicalAptRows[0].readinessRowId,
      blockerCodes: expect.arrayContaining(["duplicate_fixture_capture"]),
      action: expect.objectContaining({
        action: "suppress_duplicate",
        ownerLane: "source",
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          body: expect.objectContaining({ action: "suppress_duplicate", dryRun: true }),
          liveNetworkFetch: false
        })
      })
    });
    expect(duplicateAptRow!.dedupeKey).toBe(canonicalAptRows[0].dedupeKey);
    expect(heldPolicyRow).toMatchObject({
      actor: "Akira",
      sourceFamily: "darkweb_metadata",
      dedupeState: "held",
      alertEligibility: "held",
      blockerCodes: expect.arrayContaining(["not_alert_ready", "policy_review_required"]),
      action: expect.objectContaining({
        action: "resolve_prerequisite",
        ownerLane: "policy"
      })
    });
    expect(heldParserRow).toMatchObject({
      actor: "APT29",
      sourceFamily: "telegram_public",
      dedupeState: "held",
      alertEligibility: "held",
      nextRetryAt: "2026-06-29T12:37:00.000Z",
      blockerCodes: expect.arrayContaining(["not_alert_ready", "parser_retry_required"]),
      action: expect.objectContaining({
        action: "resolve_prerequisite",
        ownerLane: "parser"
      })
    });
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/:query", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, requiredFields: expect.arrayContaining(["rows[].dedupeKey", "rows[].dedupeState", "rows[].alertEligibility"]) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["rows[].blockerCodes", "rows[].duplicateOf", "rows[].action"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["sourcePackFixtureAlertReadinessPacketId", "rows[].dedupeKey", "safeOutput"]) })
    ]));
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "rows[].dedupeKey",
      "rows[].dedupeState",
      "rows[].alertEligibility",
      "rows[].blockerCodes",
      "rows[].action",
      "summary"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("builds source-pack fixture health drilldown filters for operators and downstream consumers", () => {
    const aptGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_drilldown",
      captureId: "cap_actor_page_apt29_drilldown",
      contentHash: "hash_actor_page_apt29_drilldown",
      provenance: "Actor page fixture gives APT29 source health drilldown coverage.",
      relationship: "actor_activity"
    });
    const ransomwareGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_drilldown",
      captureId: "cap_public_advisory_akira_drilldown",
      contentHash: "hash_public_advisory_akira_drilldown",
      provenance: "Public advisory fixture gives Akira source health drilldown coverage.",
      relationship: "targeting"
    });
    const catalog = buildSourceProvenanceSourcePackFixtureCatalogPacket({
      growthPackets: [aptGrowthPacket, ransomwareGrowthPacket],
      generatedAt: "2026-06-29T13:40:00.000Z"
    });
    const handoff = buildSourceProvenanceSourcePackFixtureAlertReadinessPacket({
      catalog,
      generatedAt: "2026-06-29T13:41:00.000Z"
    });
    const readyAptRow = handoff.rows.find((row) => row.actor === "APT29" && row.alertReadiness === "ready");
    expect(readyAptRow).toBeDefined();
    const dedupe = buildSourceProvenanceSourcePackFixtureAlertDedupePacket({
      alertReadiness: {
        ...handoff,
        rows: [...handoff.rows, {
          ...readyAptRow!,
          readinessRowId: `${readyAptRow!.readinessRowId}_duplicate`
        }]
      },
      generatedAt: "2026-06-29T13:42:00.000Z"
    });
    const drilldown = buildSourceProvenanceSourcePackFixtureHealthDrilldownPacket({
      dedupe,
      generatedAt: "2026-06-29T13:43:00.000Z"
    });

    expect(drilldown).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_HEALTH_DRILLDOWN_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourcePackFixtureAlertDedupePacketId: dedupe.id,
      summary: {
        rowCount: dedupe.rows.length,
        activeRows: 2,
        retryableRows: 2,
        policyBlockedRows: 2,
        duplicateRows: 1,
        alertReadyRows: 2,
        actors: expect.arrayContaining(["APT29", "Akira"]),
        publicTiRoutes: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        activationStates: expect.arrayContaining(["active", "retry_scheduled", "policy_blocked", "suppressed_duplicate", "pending_watchlist", "inspect_required"]),
        failureCodes: expect.arrayContaining(["none", "duplicate_fixture_capture", "parser_retry_required", "policy_review_required", "watchlist_materialization_required", "parser_health_inspection_required"]),
        newestObservedAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });

    const activeAptRow = drilldown.rows.find((row) => row.actor === "APT29" && row.activationState === "active");
    const retryTelegramRow = drilldown.rows.find((row) => row.actor === "APT29" && row.sourceFamily === "telegram_public");
    const policyMetadataRow = drilldown.rows.find((row) => row.actor === "Akira" && row.sourceFamily === "darkweb_metadata");
    const duplicateRow = drilldown.rows.find((row) => row.activationState === "suppressed_duplicate");
    const watchlistRow = drilldown.rows.find((row) => row.actor === "APT29" && row.activationState === "pending_watchlist");

    expect(activeAptRow).toMatchObject({
      actor: "APT29",
      activationState: "active",
      alertEligibility: "ready",
      retry: { retryable: false },
      failure: {
        code: "none",
        ownerLane: "alert",
        nextAction: "queue_alert_rebuild"
      },
      provenance: expect.objectContaining({
        fixtureBacked: true,
        captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
        contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/)
      })
    });
    expect(retryTelegramRow).toMatchObject({
      actor: "APT29",
      sourceFamily: "telegram_public",
      activationState: "retry_scheduled",
      retry: {
        retryable: true,
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        backoffReason: "parser_retry_required"
      },
      failure: {
        code: "parser_retry_required",
        ownerLane: "parser",
        nextAction: "retry_parser"
      }
    });
    expect(policyMetadataRow).toMatchObject({
      actor: "Akira",
      sourceFamily: "darkweb_metadata",
      activationState: "policy_blocked",
      failure: {
        code: "policy_review_required",
        ownerLane: "policy",
        nextAction: "request_policy_review"
      }
    });
    expect(duplicateRow).toMatchObject({
      activationState: "suppressed_duplicate",
      alertEligibility: "held",
      failure: {
        code: "duplicate_fixture_capture",
        ownerLane: "source",
        nextAction: "suppress_duplicate"
      }
    });
    expect(watchlistRow).toMatchObject({
      activationState: "pending_watchlist",
      failure: {
        code: "watchlist_materialization_required",
        ownerLane: "org",
        nextAction: "materialize_watchlist_terms"
      }
    });

    expect(drilldown.filters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "activation_state",
        value: "retry_scheduled",
        count: 2,
        operatorAction: expect.objectContaining({
          action: "retry_parser",
          ownerLane: "parser",
          route: expect.objectContaining({ path: "/v1/dwm/source-requests", liveNetworkFetch: false })
        })
      }),
      expect.objectContaining({
        kind: "activation_state",
        value: "policy_blocked",
        count: 2,
        operatorAction: expect.objectContaining({ action: "request_policy_review", ownerLane: "policy" })
      }),
      expect.objectContaining({
        kind: "activation_state",
        value: "suppressed_duplicate",
        count: 1,
        operatorAction: expect.objectContaining({ action: "suppress_duplicate", ownerLane: "source" })
      }),
      expect.objectContaining({
        kind: "alert_eligibility",
        value: "ready",
        count: 2,
        operatorAction: expect.objectContaining({ action: "queue_alert_rebuild", ownerLane: "alert" })
      })
    ]));
    expect(drilldown.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/:query", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, requiredFields: expect.arrayContaining(["rows[].alertEligibility", "rows[].provenance"]) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["rows[].activationState", "rows[].retry", "rows[].failure", "filters[]"]) }),
      expect.objectContaining({ consumer: "sourceOps", ready: true, requiredFields: expect.arrayContaining(["filters[].operatorAction"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["sourcePackFixtureAlertDedupePacketId", "safeOutput"]) })
    ]));
    expect(drilldown.payloadShape).toEqual(expect.arrayContaining([
      "rows[].activationState",
      "rows[].retry",
      "rows[].failure",
      "filters[]",
      "summary"
    ]));
    expect(JSON.stringify(drilldown)).not.toContain("rawText");
    expect(JSON.stringify(drilldown)).not.toContain("password");
  });

  test("exports fixture intelligence rows for public TI and alert readiness without network fetches", () => {
    const aptGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_intelligence",
      captureId: "cap_actor_page_apt29_intelligence",
      contentHash: "hash_actor_page_apt29_intelligence",
      provenance: "Actor page fixture gives APT29 public TI intelligence coverage.",
      relationship: "actor_activity"
    });
    const ransomwareGrowthPacket = buildActorFixtureGrowthPacket({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_intelligence",
      captureId: "cap_public_advisory_akira_intelligence",
      contentHash: "hash_public_advisory_akira_intelligence",
      provenance: "Public advisory fixture gives Akira alert intelligence coverage.",
      relationship: "targeting"
    });
    const catalog = buildSourceProvenanceSourcePackFixtureCatalogPacket({
      growthPackets: [aptGrowthPacket, ransomwareGrowthPacket],
      generatedAt: "2026-06-29T13:50:00.000Z"
    });
    const handoff = buildSourceProvenanceSourcePackFixtureAlertReadinessPacket({
      catalog,
      generatedAt: "2026-06-29T13:51:00.000Z"
    });
    const dedupe = buildSourceProvenanceSourcePackFixtureAlertDedupePacket({
      alertReadiness: handoff,
      generatedAt: "2026-06-29T13:52:00.000Z"
    });
    const drilldown = buildSourceProvenanceSourcePackFixtureHealthDrilldownPacket({
      dedupe,
      generatedAt: "2026-06-29T13:53:00.000Z"
    });
    const intelligence = buildSourceProvenanceSourcePackFixtureIntelligencePacket({
      drilldown,
      generatedAt: "2026-06-29T13:54:00.000Z"
    });

    expect(intelligence).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_INTELLIGENCE_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourcePackFixtureHealthDrilldownPacketId: drilldown.id,
      summary: {
        actorCount: 2,
        readyActors: 0,
        partialActors: 2,
        blockedActors: 0,
        aliasCount: 4,
        indicatorCount: 4,
        techniqueCount: 4,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        coverageStates: ["partial"],
        gapCodes: expect.arrayContaining([
          "parser_retry_required",
          "policy_review_required",
          "watchlist_materialization_required",
          "parser_health_inspection_required"
        ]),
        newestObservedAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });

    const aptRow = intelligence.actorRows.find((row) => row.actor === "APT29");
    const akiraRow = intelligence.actorRows.find((row) => row.actor === "Akira");

    expect(intelligence.actorRows.map((row) => row.actor)).toEqual(expect.arrayContaining(["APT29", "Akira"]));
    expect(aptRow).toBeDefined();
    expect(akiraRow).toBeDefined();
    expect(Array.isArray(aptRow?.provenance?.captureIds)).toBe(true);
    expect(Array.isArray(aptRow?.provenance?.contentHashes)).toBe(true);
    expect((aptRow?.provenance?.captureIds.length ?? 0) >= 4).toBe(true);
    expect((aptRow?.provenance?.contentHashes.length ?? 0) >= 4).toBe(true);
    expect(aptRow).toMatchObject({
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      coverageState: "partial",
      aliases: ["APT29", "Nobelium", "Cozy Bear"],
      sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
      confidence: 0.9,
      freshness: {
        state: "fresh",
        newestObservedAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      indicators: expect.arrayContaining([
        expect.objectContaining({
          type: "infrastructure",
          value: "apt29-c2.example.invalid",
          confidence: 0.9,
          fixtureBacked: true
        }),
        expect.objectContaining({
          type: "watchlist_term",
          value: "nobelium-watchlist.example.invalid",
          fixtureBacked: true
        })
      ]),
      ttps: expect.arrayContaining([
        expect.objectContaining({ techniqueId: "T1566", name: "Phishing", fixtureBacked: true }),
        expect.objectContaining({ techniqueId: "T1090", name: "Proxy", fixtureBacked: true })
      ]),
      gaps: expect.arrayContaining([
        expect.objectContaining({ code: "parser_retry_required", ownerLane: "parser", nextAction: "retry_parser" }),
        expect.objectContaining({ code: "watchlist_materialization_required", ownerLane: "org", nextAction: "materialize_watchlist_terms" })
      ]),
      provenance: expect.objectContaining({
        sourcePackFixtureHealthDrilldownPacketId: drilldown.id,
        fixtureBacked: true
      })
    });

    expect(akiraRow).toMatchObject({
      actor: "Akira",
      publicTiRoute: "/ti/Akira",
      coverageState: "partial",
      aliases: ["Akira"],
      indicators: expect.arrayContaining([
        expect.objectContaining({ type: "domain", value: "akira-leaksite.example.invalid", fixtureBacked: true }),
        expect.objectContaining({ type: "watchlist_term", value: "akira-ransom-note.example.invalid", fixtureBacked: true })
      ]),
      ttps: expect.arrayContaining([
        expect.objectContaining({ techniqueId: "T1486", name: "Data Encrypted for Impact", fixtureBacked: true }),
        expect.objectContaining({ techniqueId: "T1490", name: "Inhibit System Recovery", fixtureBacked: true })
      ]),
      gaps: expect.arrayContaining([
        expect.objectContaining({ code: "policy_review_required", ownerLane: "policy", nextAction: "request_policy_review" }),
        expect.objectContaining({ code: "parser_health_inspection_required", ownerLane: "source", nextAction: "inspect_source_health" })
      ])
    });
    expect(intelligence.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, requiredFields: expect.arrayContaining(["actorRows[].aliases", "actorRows[].indicators", "actorRows[].ttps"]) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["actorRows[].coverageState", "actorRows[].sourceFamilies", "actorRows[].gaps"]) }),
      expect.objectContaining({ consumer: "sourceOps", ready: true, requiredFields: expect.arrayContaining(["actorRows[].gaps[].nextAction", "actorRows[].freshness.nextRetryAt"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["sourcePackFixtureHealthDrilldownPacketId", "actorRows[].provenance"]) })
    ]));
    expect(intelligence.payloadShape).toEqual(expect.arrayContaining([
      "actorRows[].aliases",
      "actorRows[].indicators",
      "actorRows[].ttps",
      "actorRows[].freshness",
      "actorRows[].gaps",
      "actorRows[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(intelligence)).not.toContain("rawText");
    expect(JSON.stringify(intelligence)).not.toContain("password");
  });

  test("exports source-pack fixture readiness for dashboard integration and alerts", () => {
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
    const readiness = buildSourceProvenanceSourcePackActivationReadiness({ receipt });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({ activationReadiness: readiness });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:27:00.000Z"
    });
    const growthPacket = buildSourceProvenanceSourcePackFixtureGrowthPacket({
      decisionReceipt,
      generatedAt: "2026-06-29T12:28:00.000Z"
    });
    const readinessExport = buildSourceProvenanceSourcePackFixtureReadinessExport({
      packet: growthPacket,
      generatedAt: "2026-06-29T12:29:00.000Z"
    });

    expect(readinessExport).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_FIXTURE_READINESS_EXPORT_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourcePackFixtureGrowthPacketId: growthPacket.id,
      readiness: {
        publicTI: true,
        alertGeneration: true,
        dashboard: true,
        sourceOps: true,
        integration: true
      },
      summary: {
        rowCount: growthPacket.rows.length,
        readyRows: 2,
        degradedRows: 3,
        staleRows: 1,
        blockedRows: 1,
        alertReadyCaptures: 1,
        sourceFamilies: expect.arrayContaining(["public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        freshnessStates: expect.arrayContaining(["fresh", "stale", "missing"]),
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        newestFreshnessAt: "2026-06-29T12:28:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(readinessExport.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceFamily: "public_advisory",
        parserStatus: "ready",
        healthState: "healthy",
        freshnessState: "fresh",
        retryable: false,
        readyFor: expect.arrayContaining(["publicTI", "dashboard", "sourceOps", "integration"]),
        downstreamConsumerRoutes: {
          publicTI: "/ti/APT28",
          alertGeneration: "/v1/dwm/alerts/rebuild",
          sourceOps: "/v1/dwm/source-requests"
        },
        provenance: expect.objectContaining({
          captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
          contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/)
        })
      }),
      expect.objectContaining({
        sourceFamily: "public_advisory",
        parserStatus: "ready",
        healthState: "healthy",
        freshnessState: "fresh",
        retryable: false,
        readyFor: expect.arrayContaining(["alertGeneration", "dashboard", "sourceOps", "integration"]),
        provenance: expect.objectContaining({
          captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
          contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/)
        })
      }),
      expect.objectContaining({
        sourceFamily: "telegram_public",
        parserStatus: "retry_scheduled",
        healthState: "stale",
        freshnessState: "stale",
        retryable: true,
        blockerReason: "fixture parser found no campaign timestamp"
      }),
      expect.objectContaining({
        sourceFamily: "darkweb_metadata",
        parserStatus: "blocked",
        healthState: "blocked",
        freshnessState: "missing",
        blockerReason: "Candidate requires policy approval before intake."
      }),
      expect.objectContaining({
        healthState: "degraded",
        parserStatus: "not_tested",
        readyFor: expect.arrayContaining(["publicTI", "dashboard", "sourceOps", "integration"])
      })
    ]));
    expect(readinessExport.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "parser_retry_scheduled",
        ownerLane: "parser",
        sourceFamily: "telegram_public",
        nextAction: "retry_parser",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        route: expect.objectContaining({
          path: "/v1/dwm/source-requests",
          liveNetworkFetch: false,
          body: expect.objectContaining({ action: "retry", dryRun: true })
        })
      }),
      expect.objectContaining({
        code: "policy_review_required",
        ownerLane: "policy",
        sourceFamily: "darkweb_metadata",
        nextAction: "request_policy_approval",
        route: expect.objectContaining({
          body: expect.objectContaining({ action: "request_approval", dryRun: true })
        })
      }),
      expect.objectContaining({
        code: "degraded_parser",
        ownerLane: "source",
        nextAction: "inspect_source_health"
      })
    ]));
    expect(readinessExport.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["readiness", "summary", "blockers[]"]) }),
      expect.objectContaining({ consumer: "sourceOps", ready: true, requiredFields: expect.arrayContaining(["blockers[].nextAction", "blockers[].route"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["schemaVersion", "safeOutput", "consumers[]", "rows[].provenance"]) })
    ]));
    expect(readinessExport.payloadShape).toEqual(expect.arrayContaining([
      "readiness",
      "rows[].downstreamConsumerRoutes",
      "rows[].provenance",
      "blockers[]",
      "summary"
    ]));
    expect(JSON.stringify(readinessExport)).not.toContain("rawText");
    expect(JSON.stringify(readinessExport)).not.toContain("password");
  });

  test("builds source-pack retry policy from fixture readiness for source ops and alerts", () => {
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
    const activationReadiness = buildSourceProvenanceSourcePackActivationReadiness({ receipt });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({ activationReadiness });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:27:00.000Z"
    });
    const growthPacket = buildSourceProvenanceSourcePackFixtureGrowthPacket({
      decisionReceipt,
      generatedAt: "2026-06-29T12:28:00.000Z"
    });
    const readinessExport = buildSourceProvenanceSourcePackFixtureReadinessExport({
      packet: growthPacket,
      generatedAt: "2026-06-29T12:29:00.000Z"
    });
    const policyPacket = buildSourceProvenanceSourcePackRetryPolicyPacket({
      readinessExport,
      generatedAt: "2026-06-29T12:30:00.000Z"
    });

    expect(policyPacket).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_RETRY_POLICY_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourcePackFixtureReadinessExportId: readinessExport.id,
      summary: {
        rowCount: 6,
        retryNow: 0,
        retryLater: 1,
        policyReviewRequired: 1,
        inspectOnly: 3,
        alertReady: 1,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        newestFreshnessAt: "2026-06-29T12:28:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(policyPacket.retryRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceFamily: "public_advisory",
        parserStatus: "ready",
        healthState: "healthy",
        freshnessState: "fresh",
        retryState: "alert_ready",
        downstreamConsumerRoutes: {
          publicTI: "/ti/APT28",
          alertGeneration: "/v1/dwm/alerts/rebuild",
          sourceOps: "/v1/dwm/source-requests"
        },
        provenance: expect.objectContaining({
          captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
          contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/)
        }),
        action: expect.objectContaining({
          action: "queue_alert_rebuild",
          ownerLane: "alert",
          route: expect.objectContaining({
            path: "/v1/dwm/alerts/rebuild",
            liveNetworkFetch: false,
            body: expect.objectContaining({ dryRun: true })
          })
        })
      }),
      expect.objectContaining({
        sourceFamily: "telegram_public",
        parserStatus: "retry_scheduled",
        healthState: "stale",
        retryState: "retry_later",
        blockerCode: "parser_retry_scheduled",
        blockerReason: "fixture parser found no campaign timestamp",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        action: expect.objectContaining({
          action: "retry_parser",
          ownerLane: "parser",
          route: expect.objectContaining({
            path: "/v1/dwm/source-requests",
            body: expect.objectContaining({ action: "retry", dryRun: true })
          })
        })
      }),
      expect.objectContaining({
        sourceFamily: "darkweb_metadata",
        parserStatus: "blocked",
        healthState: "blocked",
        retryState: "policy_review_required",
        blockerCode: "policy_review_required",
        action: expect.objectContaining({
          action: "request_policy_approval",
          ownerLane: "policy"
        })
      }),
      expect.objectContaining({
        parserStatus: "not_tested",
        healthState: "degraded",
        retryState: "inspect_only",
        blockerCode: "degraded_parser",
        action: expect.objectContaining({
          action: "inspect_source_health",
          ownerLane: "source"
        })
      })
    ]));
    expect(policyPacket.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        requiredFields: expect.arrayContaining(["retryRows[].retryState", "retryRows[].action", "retryRows[].blockerCode"])
      }),
      expect.objectContaining({
        consumer: "dashboard",
        ready: true,
        requiredFields: expect.arrayContaining(["summary", "retryRows[].healthState", "retryRows[].downstreamConsumerRoutes"])
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: true,
        route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        consumer: "integration",
        ready: true,
        requiredFields: expect.arrayContaining(["schemaVersion", "safeOutput", "summary", "consumers[]"])
      })
    ]));
    expect(policyPacket.payloadShape).toEqual(expect.arrayContaining([
      "retryRows[].retryState",
      "retryRows[].downstreamConsumerRoutes",
      "retryRows[].provenance",
      "retryRows[].action",
      "summary"
    ]));
    expect(JSON.stringify(policyPacket)).not.toContain("rawText");
    expect(JSON.stringify(policyPacket)).not.toContain("password");
  });

  test("receipts source candidate validation from retry policy for public TI alerts dashboard and integration", () => {
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
    const activationReadiness = buildSourceProvenanceSourcePackActivationReadiness({ receipt });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({ activationReadiness });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:27:00.000Z"
    });
    const growthPacket = buildSourceProvenanceSourcePackFixtureGrowthPacket({
      decisionReceipt,
      generatedAt: "2026-06-29T12:28:00.000Z"
    });
    const readinessExport = buildSourceProvenanceSourcePackFixtureReadinessExport({
      packet: growthPacket,
      generatedAt: "2026-06-29T12:29:00.000Z"
    });
    const policyPacket = buildSourceProvenanceSourcePackRetryPolicyPacket({
      readinessExport,
      generatedAt: "2026-06-29T12:30:00.000Z"
    });
    const validationReceipt = buildSourceProvenanceSourceCandidateValidationReceipt({
      retryPolicyPacket: policyPacket,
      generatedAt: "2026-06-29T12:31:00.000Z"
    });

    expect(validationReceipt).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_CANDIDATE_VALIDATION_RECEIPT_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      sourcePackRetryPolicyPacketId: policyPacket.id,
      summary: {
        validationCount: policyPacket.retryRows.length,
        accepted: 1,
        retryGated: 1,
        policyGated: 1,
        inspectOnly: 3,
        alertReady: 1,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        blockerCodes: expect.arrayContaining(["parser_retry_scheduled", "policy_review_required", "degraded_parser"]),
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        newestFreshnessAt: "2026-06-29T12:28:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(validationReceipt.validations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidateState: "accepted",
        sourceFamily: "public_advisory",
        parserStatus: "ready",
        healthState: "healthy",
        freshnessState: "fresh",
        validation: {
          allowedForPublicTI: true,
          allowedForAlertGeneration: true,
          allowedForDashboard: true,
          allowedForIntegration: true,
          reason: "Fixture capture is parser-ready, provenance-backed, and alert generation can consume it.",
          blockerCode: undefined,
          nextRetryAt: undefined
        },
        downstreamRoutes: {
          publicTI: "/ti/APT28",
          alertGeneration: "/v1/dwm/alerts/rebuild",
          sourceOps: "/v1/dwm/source-requests"
        },
        provenance: expect.objectContaining({
          captureId: expect.stringMatching(/^ti_source_provenance_fixture_capture_/),
          contentHash: expect.stringMatching(/^ti_source_provenance_fixture_capture_hash_/)
        })
      }),
      expect.objectContaining({
        candidateState: "retry_gated",
        sourceFamily: "telegram_public",
        parserStatus: "retry_scheduled",
        healthState: "stale",
        validation: expect.objectContaining({
          allowedForPublicTI: false,
          allowedForAlertGeneration: false,
          blockerCode: "parser_retry_scheduled",
          nextRetryAt: "2026-06-29T12:37:00.000Z"
        })
      }),
      expect.objectContaining({
        candidateState: "policy_gated",
        sourceFamily: "darkweb_metadata",
        parserStatus: "blocked",
        healthState: "blocked",
        validation: expect.objectContaining({
          allowedForPublicTI: false,
          allowedForAlertGeneration: false,
          blockerCode: "policy_review_required"
        })
      }),
      expect.objectContaining({
        candidateState: "inspect_only",
        parserStatus: "not_tested",
        healthState: "degraded",
        validation: expect.objectContaining({
          allowedForPublicTI: true,
          allowedForAlertGeneration: false,
          blockerCode: "degraded_parser"
        })
      })
    ]));
    expect(validationReceipt.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["summary", "validations[].candidateState", "validations[].validation.reason"]) }),
      expect.objectContaining({ consumer: "sourceOps", ready: true, requiredFields: expect.arrayContaining(["validations[].validation.blockerCode", "validations[].validation.nextRetryAt", "validations[].downstreamRoutes"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["schemaVersion", "safeOutput", "payloadShape", "consumers[]"]) })
    ]));
    expect(validationReceipt.payloadShape).toEqual(expect.arrayContaining([
      "validations[].candidateState",
      "validations[].validation",
      "validations[].downstreamRoutes",
      "validations[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(validationReceipt)).not.toContain("rawText");
    expect(JSON.stringify(validationReceipt)).not.toContain("password");
  });

  test("exports actor source coverage portfolio for APT and ransomware fixtures", () => {
    const aptReceipt = buildActorValidationReceiptFixture({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29",
      captureId: "cap_actor_page_apt29_portfolio",
      contentHash: "hash_actor_page_apt29_portfolio",
      provenance: "Actor page fixture links APT29 to phishing infrastructure and public advisory coverage.",
      relationship: "actor_activity"
    });
    const ransomwareReceipt = buildActorValidationReceiptFixture({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira",
      captureId: "cap_public_advisory_akira_portfolio",
      contentHash: "hash_public_advisory_akira_portfolio",
      provenance: "Public advisory fixture links Akira ransomware to victimology and extortion infrastructure.",
      relationship: "targeting"
    });
    const portfolio = buildSourceProvenanceActorSourceCoveragePortfolio({
      validationReceipts: [aptReceipt, ransomwareReceipt],
      generatedAt: "2026-06-29T12:40:00.000Z"
    });

    expect(portfolio).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_SOURCE_COVERAGE_PORTFOLIO_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      summary: {
        actorCount: 2,
        readyActors: 0,
        partialActors: 2,
        blockedActors: 0,
        alertReadyActors: 2,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        blockerCodes: expect.arrayContaining(["parser_retry_scheduled", "policy_review_required", "degraded_parser"]),
        newestFreshnessAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(portfolio.actorRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actor: "APT29",
        publicTiRoute: "/ti/APT29",
        status: "partial",
        readiness: {
          publicTI: true,
          alertGeneration: true,
          dashboard: true,
          integration: true
        },
        coverageCounts: expect.objectContaining({
          accepted: 1,
          retryGated: 1,
          policyGated: 1,
          inspectOnly: 3,
          alertReady: 1
        }),
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "parser_retry_scheduled", sourceFamily: "telegram_public" }),
          expect.objectContaining({ code: "policy_review_required", sourceFamily: "darkweb_metadata" })
        ]),
        downstreamRoutes: {
          publicTI: "/ti/APT29",
          alertGeneration: "/v1/dwm/alerts/rebuild",
          dashboard: "/v1/dwm/source-requests",
          integration: "/v1/dwm/source-requests"
        },
        provenance: expect.objectContaining({
          validationIds: expect.any(Array),
          captureIds: expect.any(Array),
          contentHashes: expect.any(Array),
          sourceHealthProofIds: expect.any(Array)
        })
      }),
      expect.objectContaining({
        actor: "Akira",
        publicTiRoute: "/ti/Akira",
        readiness: expect.objectContaining({
          publicTI: true,
          alertGeneration: true,
          dashboard: true,
          integration: true
        }),
        coverageCounts: expect.objectContaining({
          accepted: 1,
          retryGated: 1,
          policyGated: 1,
          inspectOnly: 3,
          alertReady: 1
        }),
        sourceFamilies: expect.arrayContaining(["public_advisory", "telegram_public", "darkweb_metadata"]),
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: "degraded_parser" })
        ]),
        provenance: expect.objectContaining({
          captureIds: expect.any(Array),
          contentHashes: expect.any(Array)
        })
      })
    ]));
    expect(portfolio.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/:query", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["actorRows[].readiness", "actorRows[].blockers", "summary"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["schemaVersion", "safeOutput", "actorRows[].provenance", "consumers[]"]) })
    ]));
    expect(portfolio.payloadShape).toEqual(expect.arrayContaining([
      "actorRows[].actor",
      "actorRows[].readiness",
      "actorRows[].blockers",
      "actorRows[].downstreamRoutes",
      "actorRows[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(portfolio)).not.toContain("rawText");
    expect(JSON.stringify(portfolio)).not.toContain("password");
  });

  test("bridges actor source coverage into alert prerequisite packet without network fetches", () => {
    const aptReceipt = buildActorValidationReceiptFixture({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_alert_prereq",
      captureId: "cap_actor_page_apt29_alert_prereq",
      contentHash: "hash_actor_page_apt29_alert_prereq",
      provenance: "Actor page fixture gives APT29 source coverage with parser and policy follow-up.",
      relationship: "actor_activity"
    });
    const ransomwareReceipt = buildActorValidationReceiptFixture({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_alert_prereq",
      captureId: "cap_public_advisory_akira_alert_prereq",
      contentHash: "hash_public_advisory_akira_alert_prereq",
      provenance: "Public advisory fixture gives Akira source coverage with alertable victimology metadata.",
      relationship: "targeting"
    });
    const portfolio = buildSourceProvenanceActorSourceCoveragePortfolio({
      validationReceipts: [aptReceipt, ransomwareReceipt],
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const packet = buildSourceProvenanceActorEnrichmentAlertPrerequisitePacket({
      portfolio,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_ALERT_PREREQUISITE_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      summary: {
        actorCount: 2,
        readyActors: 0,
        partialActors: 2,
        blockedActors: 0,
        alertReadyActors: 2,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        healthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        prerequisiteCodes: expect.arrayContaining([
          "parser_retry_required",
          "policy_review_required",
          "parser_health_inspection_required"
        ]),
        newestFreshnessAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(typeof packet.summary.prerequisiteCount).toBe("number");
    expect(packet.summary.prerequisiteCount >= 6).toBe(true);
    const aptRow = packet.actorRows.find((row) => row.actor === "APT29");
    const ransomwareRow = packet.actorRows.find((row) => row.actor === "Akira");
    expect(aptRow).toMatchObject({
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      alertReadiness: "partial",
      coverageCounts: expect.objectContaining({ alertReady: 1 }),
      sourceFamilies: expect.arrayContaining(["actor_page", "telegram_public", "darkweb_metadata"]),
      downstreamRoutes: expect.objectContaining({
        publicTI: "/ti/APT29",
        alertGeneration: "/v1/dwm/alerts/rebuild"
      })
    });
    expect(aptRow?.missingPrerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "parser_retry_required",
        ownerLane: "parser",
        sourceFamily: "telegram_public",
        nextAction: expect.objectContaining({
          action: "retry_parser",
          route: expect.objectContaining({ method: "POST", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
        })
      }),
      expect.objectContaining({
        code: "policy_review_required",
        ownerLane: "policy",
        sourceFamily: "darkweb_metadata",
        nextAction: expect.objectContaining({
          action: "request_policy_review",
          route: expect.objectContaining({ method: "POST", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
        })
      }),
      expect.objectContaining({
        code: "parser_health_inspection_required",
        ownerLane: "source",
        nextAction: expect.objectContaining({
          action: "inspect_parser_health",
          route: expect.objectContaining({ method: "GET", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
        })
      })
    ]));
    expect((aptRow?.provenance.captureIds.length ?? 0) >= 1).toBe(true);
    expect((aptRow?.provenance.contentHashes.length ?? 0) >= 1).toBe(true);
    expect(ransomwareRow).toMatchObject({
      actor: "Akira",
      publicTiRoute: "/ti/Akira",
      alertReadiness: "partial",
      sourceFamilies: expect.arrayContaining(["public_advisory", "telegram_public", "darkweb_metadata"])
    });
    expect(ransomwareRow?.missingPrerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "parser_retry_required", ownerLane: "parser" }),
      expect.objectContaining({ code: "policy_review_required", ownerLane: "policy" }),
      expect.objectContaining({ code: "parser_health_inspection_required", ownerLane: "source" })
    ]));
    expect((ransomwareRow?.provenance.captureIds.length ?? 0) >= 1).toBe(true);
    expect((ransomwareRow?.provenance.contentHashes.length ?? 0) >= 1).toBe(true);
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, requiredFields: expect.arrayContaining(["actorRows[].missingPrerequisites"]) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, route: expect.objectContaining({ path: "/v1/dwm/source-requests", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["actorRows[].provenance", "actorRows[].missingPrerequisites"]) })
    ]));
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "actorRows[].alertReadiness",
      "actorRows[].missingPrerequisites",
      "actorRows[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("emits source health events from actor alert prerequisites for public TI and alerts", () => {
    const aptReceipt = buildActorValidationReceiptFixture({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_health_events",
      captureId: "cap_actor_page_apt29_health_events",
      contentHash: "hash_actor_page_apt29_health_events",
      provenance: "Actor page fixture gives APT29 parser health and source coverage.",
      relationship: "actor_activity"
    });
    const ransomwareReceipt = buildActorValidationReceiptFixture({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_health_events",
      captureId: "cap_public_advisory_akira_health_events",
      contentHash: "hash_public_advisory_akira_health_events",
      provenance: "Public advisory fixture gives Akira parser health and alert family coverage.",
      relationship: "targeting"
    });
    const portfolio = buildSourceProvenanceActorSourceCoveragePortfolio({
      validationReceipts: [aptReceipt, ransomwareReceipt],
      generatedAt: "2026-06-29T12:50:00.000Z"
    });
    const prerequisites = buildSourceProvenanceActorEnrichmentAlertPrerequisitePacket({
      portfolio,
      generatedAt: "2026-06-29T12:51:00.000Z"
    });
    const packet = buildSourceProvenanceActorEnrichmentSourceHealthEventPacket({
      alertPrerequisitePacket: prerequisites,
      generatedAt: "2026-06-29T12:52:00.000Z"
    });

    expect(packet).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_SOURCE_HEALTH_EVENT_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actorEnrichmentAlertPrerequisitePacketId: prerequisites.id,
      summary: {
        accepted: 2,
        retryGated: 2,
        policyGated: 2,
        inspectOnly: 6,
        healthy: 2,
        degraded: 6,
        stale: 2,
        blocked: 2,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        parserStatuses: expect.arrayContaining(["ready", "not_tested", "retry_scheduled", "blocked"]),
        affectedActorPages: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
        affectedAlertFamilies: expect.arrayContaining(["watchlist_terms", "actor_enrichment", "campaign_freshness", "restricted_metadata"]),
        newestLastRunAt: "2026-06-29T12:28:00.000Z",
        newestLastSuccessAt: "2026-06-29T12:28:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(packet.summary.eventCount).toBe(packet.events.length);
    expect(packet.summary.inspectOnly >= 2).toBe(true);
    expect(packet.summary.degraded >= 2).toBe(true);

    const aptAccepted = packet.events.find((event) => event.actor === "APT29" && event.sourceFamily === "actor_page" && event.candidateValidation.state === "accepted");
    const aptRetry = packet.events.find((event) => event.actor === "APT29" && event.sourceFamily === "telegram_public" && event.candidateValidation.state === "retry_gated");
    const aptPolicy = packet.events.find((event) => event.actor === "APT29" && event.sourceFamily === "darkweb_metadata" && event.candidateValidation.state === "policy_gated");
    const ransomwareAccepted = packet.events.find((event) => event.actor === "Akira" && event.candidateValidation.state === "accepted");

    expect(aptAccepted).toMatchObject({
      actor: "APT29",
      publicTiRoute: "/ti/APT29",
      sourceFamily: "actor_page",
      candidateValidation: expect.objectContaining({
        state: "accepted",
        policyStatus: "allowed",
        parserCompatible: true,
        expectedActorCoverage: ["APT29"],
        expectedEntityCoverage: expect.arrayContaining(["actor_profile", "source_provenance", "alertable_fields"])
      }),
      parserHealth: expect.objectContaining({
        parserStatus: "ready",
        healthState: "healthy",
        lastRunAt: "2026-06-29T12:28:00.000Z",
        lastSuccessAt: "2026-06-29T12:28:00.000Z",
        staleThresholdMinutes: 1440
      }),
      activationTest: expect.objectContaining({ state: "active", testResult: "passed" }),
      affected: expect.objectContaining({
        actorPages: ["/ti/APT29"],
        alertFamilies: expect.arrayContaining(["watchlist_terms", "actor_enrichment"])
      })
    });
    expect(aptRetry).toMatchObject({
      actor: "APT29",
      sourceFamily: "telegram_public",
      candidateValidation: expect.objectContaining({ state: "retry_gated", parserCompatible: true }),
      parserHealth: expect.objectContaining({
        parserStatus: "retry_scheduled",
        healthState: "stale",
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        staleThresholdMinutes: 360
      }),
      activationTest: expect.objectContaining({ state: "retry_scheduled", testResult: "failed" })
    });
    expect(aptPolicy).toMatchObject({
      actor: "APT29",
      sourceFamily: "darkweb_metadata",
      candidateValidation: expect.objectContaining({
        state: "policy_gated",
        policyStatus: "metadata_only_review_required",
        parserCompatible: false,
        rejectionReason: "Candidate requires policy approval before intake."
      }),
      parserHealth: expect.objectContaining({
        parserStatus: "blocked",
        healthState: "blocked"
      }),
      activationTest: expect.objectContaining({ state: "policy_blocked", testResult: "not_run" }),
      affected: expect.objectContaining({
        alertFamilies: expect.arrayContaining(["restricted_metadata", "watchlist_terms"])
      })
    });
    expect(ransomwareAccepted).toMatchObject({
      actor: "Akira",
      publicTiRoute: "/ti/Akira",
      candidateValidation: expect.objectContaining({
        state: "accepted",
        policyStatus: "allowed",
        expectedActorCoverage: ["Akira"]
      }),
      parserHealth: expect.objectContaining({ parserStatus: "ready", healthState: "healthy" })
    });
    expect(packet.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/:query", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, requiredFields: expect.arrayContaining(["events[].affected.alertFamilies", "events[].activationTest"]) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["events[].candidateValidation", "events[].parserHealth", "events[].activationTest", "summary"]) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["events[].provenance", "events[].parserHealth"]) })
    ]));
    expect(packet.payloadShape).toEqual(expect.arrayContaining([
      "events[].candidateValidation",
      "events[].parserHealth",
      "events[].activationTest",
      "events[].affected",
      "events[].provenance",
      "summary"
    ]));
    expect(JSON.stringify(packet)).not.toContain("rawText");
    expect(JSON.stringify(packet)).not.toContain("password");
  });

  test("builds source health monitoring filters for candidate parser and alert handoff work", () => {
    const aptReceipt = buildActorValidationReceiptFixture({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_monitoring_filters",
      captureId: "cap_actor_page_apt29_monitoring_filters",
      contentHash: "hash_actor_page_apt29_monitoring_filters",
      provenance: "Actor page fixture gives APT29 monitoring filters with backed provenance.",
      relationship: "actor_activity"
    });
    const ransomwareReceipt = buildActorValidationReceiptFixture({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_monitoring_filters",
      captureId: "cap_public_advisory_akira_monitoring_filters",
      contentHash: "hash_public_advisory_akira_monitoring_filters",
      provenance: "Public advisory fixture gives Akira monitoring filters with backed provenance.",
      relationship: "targeting"
    });
    const portfolio = buildSourceProvenanceActorSourceCoveragePortfolio({
      validationReceipts: [aptReceipt, ransomwareReceipt],
      generatedAt: "2026-06-29T12:55:00.000Z"
    });
    const prerequisites = buildSourceProvenanceActorEnrichmentAlertPrerequisitePacket({
      portfolio,
      generatedAt: "2026-06-29T12:56:00.000Z"
    });
    const healthEvents = buildSourceProvenanceActorEnrichmentSourceHealthEventPacket({
      alertPrerequisitePacket: prerequisites,
      generatedAt: "2026-06-29T12:57:00.000Z"
    });
    const filters = buildSourceProvenanceSourceHealthMonitoringFilterPacket({
      sourceHealthEventPacket: healthEvents,
      generatedAt: "2026-06-29T12:58:00.000Z"
    });

    expect(filters).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_HEALTH_MONITORING_FILTER_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourceHealthEventPacketId: healthEvents.id,
      summary: {
        eventCount: healthEvents.events.length,
        sourceFamilyFilters: 4,
        candidateStateFilters: 4,
        parserHealthFilters: 4,
        actorPageFilters: 2,
        retryWindowFilters: 1,
        retryableEvents: 2,
        policyBlockedEvents: 2,
        staleEvents: 2,
        healthyEvents: 2,
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        candidateStates: expect.arrayContaining(["accepted", "retry_gated", "policy_gated", "inspect_only"]),
        parserHealthStates: expect.arrayContaining(["healthy", "degraded", "stale", "blocked"]),
        affectedActorPages: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
        affectedAlertFamilies: expect.arrayContaining(["watchlist_terms", "actor_enrichment", "campaign_freshness", "restricted_metadata"]),
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(filters.summary.filterCount).toBe(filters.filters.length);

    const acceptedFilter = filters.filters.find((filter) => filter.kind === "candidate_state" && filter.value === "accepted");
    const retryFilter = filters.filters.find((filter) => filter.kind === "candidate_state" && filter.value === "retry_gated");
    const policyFilter = filters.filters.find((filter) => filter.kind === "candidate_state" && filter.value === "policy_gated");
    const staleFilter = filters.filters.find((filter) => filter.kind === "parser_health" && filter.value === "stale");
    const darkwebFilter = filters.filters.find((filter) => filter.kind === "source_family" && filter.value === "darkweb_metadata");
    const alertFamilyFilter = filters.filters.find((filter) => filter.kind === "alert_family" && filter.value === "watchlist_terms");

    expect(acceptedFilter).toMatchObject({
      kind: "candidate_state",
      value: "accepted",
      count: 2,
      readyCount: 2,
      blockedCount: 0,
      retryableCount: 0,
      affectedActorPages: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
      affectedAlertFamilies: expect.arrayContaining(["watchlist_terms", "actor_enrichment"]),
      operatorAction: expect.objectContaining({
        action: "queue_alert_rebuild",
        ownerLane: "alert",
        route: expect.objectContaining({ method: "POST", path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false })
      })
    });
    expect(retryFilter).toMatchObject({
      kind: "candidate_state",
      value: "retry_gated",
      count: 2,
      retryableCount: 2,
      operatorAction: expect.objectContaining({
        action: "retry",
        ownerLane: "parser",
        route: expect.objectContaining({ method: "POST", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      })
    });
    expect(policyFilter).toMatchObject({
      kind: "candidate_state",
      value: "policy_gated",
      count: 2,
      blockedCount: 2,
      operatorAction: expect.objectContaining({
        action: "request_policy_review",
        ownerLane: "policy",
        route: expect.objectContaining({ method: "POST", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      })
    });
    expect(staleFilter).toMatchObject({
      kind: "parser_health",
      value: "stale",
      count: 2,
      retryableCount: 2,
      operatorAction: expect.objectContaining({ action: "retry", ownerLane: "parser" })
    });
    expect(darkwebFilter).toMatchObject({
      kind: "source_family",
      value: "darkweb_metadata",
      count: 2,
      blockedCount: 2,
      operatorAction: expect.objectContaining({ action: "request_policy_review", ownerLane: "policy" })
    });
    expect(alertFamilyFilter).toMatchObject({
      kind: "alert_family",
      value: "watchlist_terms",
      affectedActorPages: expect.arrayContaining(["/ti/APT29", "/ti/Akira"])
    });
    expect((alertFamilyFilter?.sampleEventIds.length ?? 0) >= 1).toBe(true);
    expect(filters.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "sourceOps", ready: true, requiredFields: expect.arrayContaining(["filters[].operatorAction", "summary"]) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["filters[].affectedActorPages", "filters[].affectedAlertFamilies"]) }),
      expect.objectContaining({ consumer: "publicTI", ready: true, route: expect.objectContaining({ path: "/ti/:query", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["filters[].sampleEventIds", "consumers[]"]) })
    ]));
    expect(filters.payloadShape).toEqual(expect.arrayContaining([
      "filters[].kind",
      "filters[].operatorAction",
      "filters[].sampleEventIds",
      "summary"
    ]));
    expect(JSON.stringify(filters)).not.toContain("rawText");
    expect(JSON.stringify(filters)).not.toContain("password");
  });

  test("builds source pack lifecycle cleanup from monitoring filters without network fetches", () => {
    const aptReceipt = buildActorValidationReceiptFixture({
      actor: "APT29",
      aliases: ["APT29", "Nobelium"],
      sourceFamily: "actor_page",
      sourceId: "src_actor_page_apt29_lifecycle_cleanup",
      captureId: "cap_actor_page_apt29_lifecycle_cleanup",
      contentHash: "hash_actor_page_apt29_lifecycle_cleanup",
      provenance: "Actor page fixture gives APT29 source cleanup rows with backed provenance.",
      relationship: "actor_activity"
    });
    const ransomwareReceipt = buildActorValidationReceiptFixture({
      actor: "Akira",
      aliases: ["Akira"],
      sourceFamily: "public_advisory",
      sourceId: "src_public_advisory_akira_lifecycle_cleanup",
      captureId: "cap_public_advisory_akira_lifecycle_cleanup",
      contentHash: "hash_public_advisory_akira_lifecycle_cleanup",
      provenance: "Public advisory fixture gives Akira source cleanup rows with backed provenance.",
      relationship: "targeting"
    });
    const portfolio = buildSourceProvenanceActorSourceCoveragePortfolio({
      validationReceipts: [aptReceipt, ransomwareReceipt],
      generatedAt: "2026-06-29T13:00:00.000Z"
    });
    const prerequisites = buildSourceProvenanceActorEnrichmentAlertPrerequisitePacket({
      portfolio,
      generatedAt: "2026-06-29T13:01:00.000Z"
    });
    const healthEvents = buildSourceProvenanceActorEnrichmentSourceHealthEventPacket({
      alertPrerequisitePacket: prerequisites,
      generatedAt: "2026-06-29T13:02:00.000Z"
    });
    const filters = buildSourceProvenanceSourceHealthMonitoringFilterPacket({
      sourceHealthEventPacket: healthEvents,
      generatedAt: "2026-06-29T13:03:00.000Z"
    });
    const cleanup = buildSourceProvenanceSourcePackLifecycleCleanupPacket({
      monitoringFilterPacket: filters,
      generatedAt: "2026-06-29T13:04:00.000Z"
    });

    expect(cleanup).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_SOURCE_PACK_LIFECYCLE_CLEANUP_PACKET_SCHEMA_VERSION,
      ok: true,
      status: "partial",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      sourceHealthMonitoringFilterPacketId: filters.id,
      summary: {
        sourceFamilies: expect.arrayContaining(["actor_page", "public_advisory", "telegram_public", "darkweb_metadata"]),
        affectedActorPages: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
        affectedAlertFamilies: expect.arrayContaining(["watchlist_terms", "actor_enrichment", "campaign_freshness", "restricted_metadata"]),
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false,
        crossOrgDataIncluded: false
      }
    });
    expect(cleanup.summary.cleanupCount).toBe(cleanup.cleanupRows.length);
    expect(cleanup.summary.retryParser >= 1).toBe(true);
    expect(cleanup.summary.policyReview >= 1).toBe(true);
    expect(cleanup.summary.alertRebuild >= 1).toBe(true);
    expect(cleanup.summary.inspectGap >= 1).toBe(true);

    const retryRow = cleanup.cleanupRows.find((row) => row.lifecycleState === "retry_ready");
    const policyRow = cleanup.cleanupRows.find((row) => row.lifecycleState === "policy_review_required");
    const alertRow = cleanup.cleanupRows.find((row) => row.lifecycleState === "alert_rebuild_ready");
    const gapRow = cleanup.cleanupRows.find((row) => row.lifecycleState === "gap_review_required" && row.filterKind === "alert_family" && row.filterValue === "watchlist_terms");

    expect(retryRow).toMatchObject({
      lifecycleState: "retry_ready",
      priority: "high",
      affectedActorPages: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
      affectedAlertFamilies: expect.arrayContaining(["watchlist_terms"]),
      remediation: expect.objectContaining({
        action: "retry",
        ownerLane: "parser",
        route: expect.objectContaining({ method: "POST", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      })
    });
    expect(policyRow).toMatchObject({
      lifecycleState: "policy_review_required",
      priority: "high",
      sourceFamilies: expect.arrayContaining(["darkweb_metadata"]),
      remediation: expect.objectContaining({
        action: "request_policy_review",
        ownerLane: "policy",
        route: expect.objectContaining({ method: "POST", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      })
    });
    expect(alertRow).toMatchObject({
      lifecycleState: "alert_rebuild_ready",
      priority: "medium",
      remediation: expect.objectContaining({
        action: "queue_alert_rebuild",
        ownerLane: "alert",
        route: expect.objectContaining({ method: "POST", path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false })
      })
    });
    expect((retryRow?.retryableCount ?? 0) >= 1).toBe(true);
    expect((policyRow?.blockedCount ?? 0) >= 1).toBe(true);
    expect((alertRow?.readyCount ?? 0) >= 1).toBe(true);
    expect(gapRow).toMatchObject({
      lifecycleState: "gap_review_required",
      priority: "high",
      affectedActorPages: expect.arrayContaining(["/ti/APT29", "/ti/Akira"]),
      remediation: expect.objectContaining({
        action: "review_gap",
        ownerLane: "source",
        route: expect.objectContaining({ method: "GET", path: "/v1/dwm/source-requests", liveNetworkFetch: false })
      })
    });
    expect((retryRow?.sampleEventIds.length ?? 0) >= 1).toBe(true);
    expect((policyRow?.sampleEventIds.length ?? 0) >= 1).toBe(true);
    expect((alertRow?.sampleEventIds.length ?? 0) >= 1).toBe(true);
    expect((gapRow?.sampleEventIds.length ?? 0) >= 1).toBe(true);
    expect(cleanup.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "sourceOps", ready: true, requiredFields: expect.arrayContaining(["cleanupRows[].lifecycleState", "cleanupRows[].remediation"]) }),
      expect.objectContaining({ consumer: "dashboard", ready: true, requiredFields: expect.arrayContaining(["cleanupRows[].affectedActorPages", "cleanupRows[].affectedAlertFamilies"]) }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true, route: expect.objectContaining({ path: "/v1/dwm/alerts/rebuild", liveNetworkFetch: false }) }),
      expect.objectContaining({ consumer: "integration", ready: true, requiredFields: expect.arrayContaining(["cleanupRows[].sampleEventIds", "consumers[]"]) })
    ]));
    expect(cleanup.payloadShape).toEqual(expect.arrayContaining([
      "cleanupRows[].lifecycleState",
      "cleanupRows[].priority",
      "cleanupRows[].sampleEventIds",
      "cleanupRows[].remediation",
      "summary"
    ]));
    expect(JSON.stringify(cleanup)).not.toContain("rawText");
    expect(JSON.stringify(cleanup)).not.toContain("password");
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

  test("summarizes parser health provenance with activation decisions for public TI and alerts", () => {
    const { readiness, lifecycle } = buildBlockedSourceLifecycle();
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const summary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });

    expect(summary).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PARSER_HEALTH_PROVENANCE_SUMMARY_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      parserHealthAlertPacketId: parserHealthPacket.id,
      sourceActivationDecisionReceiptId: decisionReceipt.id,
      summary: {
        familyCount: 4,
        healthyFamilyCount: 1,
        parserAlertCount: 3,
        retryableCount: 1,
        policyBlockedCount: 1,
        activationTestsQueued: 4,
        alertableCandidates: 1,
        lastSuccessAt: "2026-06-29T12:46:00.000Z",
        lastFailureAt: "2026-06-29T12:47:00.000Z",
        nextRetryAt: "2026-06-29T12:37:00.000Z"
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(summary.familyRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "telegram_public",
        parserState: "retry_scheduled",
        parserRetriesQueued: 1,
        nextRetryAt: "2026-06-29T12:37:00.000Z",
        blockers: [expect.objectContaining({
          code: "parser_retry_scheduled",
          ownerLane: "parser",
          nextAction: "retry_parser"
        })],
        provenance: expect.objectContaining({
          parserHealthAlertPacketId: parserHealthPacket.id,
          sourceActivationDecisionReceiptId: decisionReceipt.id,
          sourceHealthProofIds: expect.any(Array),
          activationDecisionIds: expect.any(Array),
          fixtureBacked: true
        }),
        readiness: {
          publicTI: false,
          alertGeneration: false,
          sourceOps: true
        }
      }),
      expect.objectContaining({
        family: "darkweb_metadata",
        parserState: "blocked",
        policyReviewsRequired: 1,
        blockers: [expect.objectContaining({
          code: "policy_blocked",
          ownerLane: "policy",
          nextAction: "request_policy_approval"
        })]
      }),
      expect.objectContaining({
        family: "public_advisory",
        parserState: "ready",
        activationTestsQueued: 3,
        alertableCandidates: 1,
        readiness: expect.objectContaining({
          publicTI: true,
          alertGeneration: true
        })
      })
    ]));
    expect(summary.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        consumer: "publicTI",
        ready: true,
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        consumer: "alertGeneration",
        ready: false,
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ dryRun: true })
        })
      }),
      expect.objectContaining({
        consumer: "sourceOps",
        ready: true,
        requiredFields: expect.arrayContaining(["familyRows[].provenance.sourceHealthProofIds"])
      })
    ]));
    expect(summary.payloadShape).toEqual(expect.arrayContaining([
      "familyRows[].parserState",
      "familyRows[].blockers",
      "summary.nextRetryAt"
    ]));
    expect(JSON.stringify(summary)).not.toContain("rawText");
    expect(JSON.stringify(summary)).not.toContain("password");
  });

  test("keeps parser health provenance summary ready for clean ransomware source coverage", () => {
    const { readiness, lifecycle } = buildFreshSourceLifecycle({ actor: "LockBit" });
    const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({
      activationReadiness: readiness,
      generatedAt: "2026-06-29T12:45:00.000Z"
    });
    const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
      auditPacket,
      generatedAt: "2026-06-29T12:46:00.000Z"
    });
    const parserHealthPacket = buildSourceProvenanceParserHealthAlertPacket({
      lifecycle,
      generatedAt: "2026-06-29T12:47:00.000Z"
    });
    const summary = buildSourceProvenanceParserHealthProvenanceSummary({
      parserHealthPacket,
      activationDecisionReceipt: decisionReceipt,
      generatedAt: "2026-06-29T12:48:00.000Z"
    });

    expect(summary).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PARSER_HEALTH_PROVENANCE_SUMMARY_SCHEMA_VERSION,
      ok: true,
      actor: "LockBit",
      publicTiRoute: "/ti/LockBit",
      summary: {
        familyCount: 1,
        healthyFamilyCount: 1,
        parserAlertCount: 0,
        retryableCount: 0,
        policyBlockedCount: 0,
        activationTestsQueued: 1,
        alertableCandidates: 1,
        lastSuccessAt: "2026-06-29T12:46:00.000Z"
      },
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
    expect(summary.familyRows).toEqual([
      expect.objectContaining({
        family: "public_advisory",
        parserState: "ready",
        parserAlertCount: 0,
        activationTestsQueued: 1,
        alertableCandidates: 1,
        blockers: [],
        readiness: {
          publicTI: true,
          alertGeneration: true,
          sourceOps: true
        }
      })
    ]);
    expect(summary.consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "publicTI", ready: true }),
      expect.objectContaining({ consumer: "alertGeneration", ready: true }),
      expect.objectContaining({ consumer: "sourceOps", ready: true })
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

  test("blocks projection watchlist relevance on parser source and actor validation gaps", () => {
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
    const relevance = buildSourceProvenanceProjectionWatchlistRelevance({
      projection,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });

    expect(relevance).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PROJECTION_WATCHLIST_RELEVANCE_SCHEMA_VERSION,
      ok: false,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT28",
      publicTiRoute: "/ti/APT28",
      publicTiSourceOpsProjectionId: projection.id,
      canCreateWatchlistTerms: false,
      canRequestAlertGeneration: false,
      watchlistTerms: [],
      alertRequestPreview: {
        method: "POST",
        path: "/v1/dwm/alerts/rebuild",
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          actor: "APT28",
          watchlistItemIds: [],
          alertGeneratorKeys: [],
          sourceProjectionId: projection.id,
          dryRun: true
        },
        dryRunSupported: true,
        liveNetworkFetch: false
      },
      safeOutput: {
        rawTargetsExposed: false,
        restrictedMetadataLeaked: false,
        privateTelegramContentExposed: false,
        liveNetworkScrapeStarted: false
      }
    });
    expect(relevance.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "projection_not_ready",
        ownerLane: "publicTI",
        path: "pageReadiness.state"
      }),
      expect.objectContaining({
        code: "parser_gap_blocking",
        ownerLane: "parser",
        reasonCode: "parser_retry_scheduled",
        nextAction: "retry_parser"
      }),
      expect.objectContaining({
        code: "source_validation_blocking",
        ownerLane: "publicTI",
        reasonCode: "wrong_actor_query",
        nextAction: "retry_query",
        route: expect.objectContaining({ path: "/ti/APT28", liveNetworkFetch: false })
      }),
      expect.objectContaining({
        code: "source_validation_blocking",
        ownerLane: "source",
        reasonCode: "unsupported_source_family",
        sourceFamily: "pastebin_dump",
        nextAction: "review_source_family"
      })
    ]));
    expect(relevance.nextActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "repair_source_ops",
        ownerLane: "publicTI",
        reasonCode: "projection_not_ready"
      }),
      expect.objectContaining({
        action: "retry_parser",
        ownerLane: "parser",
        reasonCode: "parser_retry_scheduled"
      }),
      expect.objectContaining({
        action: "review_validation_issue",
        ownerLane: "source",
        reasonCode: "unsupported_source_family",
        route: expect.objectContaining({ liveNetworkFetch: false })
      })
    ]));
    expect(relevance.payloadShape).toEqual(expect.arrayContaining([
      "watchlistTerms[].alertGenerationRef",
      "blockers[].code",
      "alertRequestPreview.body.alertGeneratorKeys"
    ]));
    expect(JSON.stringify(relevance)).not.toContain("rawText");
    expect(JSON.stringify(relevance)).not.toContain("password");
  });

  test("creates projection watchlist relevance for ready ransomware source coverage", () => {
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
    const relevance = buildSourceProvenanceProjectionWatchlistRelevance({
      projection,
      generatedAt: "2026-06-29T12:50:00.000Z"
    });

    expect(relevance).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PROJECTION_WATCHLIST_RELEVANCE_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "LockBit",
      publicTiRoute: "/ti/LockBit",
      publicTiSourceOpsProjectionId: projection.id,
      canCreateWatchlistTerms: true,
      canRequestAlertGeneration: true,
      blockers: [],
      alertRequestPreview: {
        path: "/v1/dwm/alerts/rebuild",
        body: {
          tenantId: "tenant_acme",
          organizationId: "org_acme",
          actor: "LockBit",
          sourceProjectionId: projection.id,
          dryRun: true
        },
        liveNetworkFetch: false
      },
      safeOutput: {
        liveNetworkScrapeStarted: false
      }
    });
    expect(relevance.watchlistTerms).toEqual([
      expect.objectContaining({
        kind: "actor",
        term: "LockBit",
        sourceFamilies: [],
        confidence: 0.91,
        provenance: expect.objectContaining({
          publicTiSourceOpsProjectionId: projection.id,
          sourceOpsFixtureBundleId: bundle.id,
          fixtureBacked: true
        }),
        alertGenerationRef: expect.objectContaining({
          schemaVersion: "organization.watchlist_alert_generation_ref.v1",
          source: "public_ti_source_ops_projection",
          organizationId: "org_acme",
          term: "LockBit"
        })
      })
    ]);
    expect(relevance.alertRequestPreview.body.watchlistItemIds).toEqual([
      relevance.watchlistTerms[0].watchlistItemId
    ]);
    expect(relevance.alertRequestPreview.body.alertGeneratorKeys).toEqual([
      relevance.watchlistTerms[0].alertGeneratorKey
    ]);
    expect(relevance.nextActions).toEqual([
      expect.objectContaining({
        action: "request_alert_rebuild",
        ownerLane: "alert",
        reasonCode: "watchlist_terms_ready",
        route: expect.objectContaining({
          path: "/v1/dwm/alerts/rebuild",
          body: expect.objectContaining({ dryRun: true }),
          liveNetworkFetch: false
        })
      })
    ]);
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

function buildActorValidationReceiptFixture(input: {
  actor: string;
  aliases: string[];
  sourceFamily: string;
  sourceId: string;
  captureId: string;
  contentHash: string;
  provenance: string;
  relationship: string;
}) {
  const contract = buildSourceProvenanceTiPageContract({
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    actor: input.actor,
    generatedAt: "2026-06-29T12:00:00.000Z",
    rows: [sourceRow({
      actor: input.actor,
      sourceId: input.sourceId,
      sourceFamily: input.sourceFamily,
      captureId: input.captureId,
      contentHash: input.contentHash,
      provenance: input.provenance,
      relationship: input.relationship,
      confidence: 0.82,
      route: `/ti/${input.actor}`
    })]
  });
  const profile = buildSourceProvenanceActorProfileContract({
    contract,
    values: { aliases: input.aliases }
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
  const activationReadiness = buildSourceProvenanceSourcePackActivationReadiness({ receipt });
  const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({ activationReadiness });
  const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
    auditPacket,
    generatedAt: "2026-06-29T12:27:00.000Z"
  });
  const growthPacket = buildSourceProvenanceSourcePackFixtureGrowthPacket({
    decisionReceipt,
    generatedAt: "2026-06-29T12:28:00.000Z"
  });
  const readinessExport = buildSourceProvenanceSourcePackFixtureReadinessExport({
    packet: growthPacket,
    generatedAt: "2026-06-29T12:29:00.000Z"
  });
  const policyPacket = buildSourceProvenanceSourcePackRetryPolicyPacket({
    readinessExport,
    generatedAt: "2026-06-29T12:30:00.000Z"
  });
  return buildSourceProvenanceSourceCandidateValidationReceipt({
    retryPolicyPacket: policyPacket,
    generatedAt: "2026-06-29T12:31:00.000Z"
  });
}

function buildActorFixtureGrowthPacket(input: {
  actor: string;
  aliases: string[];
  sourceFamily: string;
  sourceId: string;
  captureId: string;
  contentHash: string;
  provenance: string;
  relationship: string;
}) {
  const contract = buildSourceProvenanceTiPageContract({
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    actor: input.actor,
    generatedAt: "2026-06-29T12:00:00.000Z",
    rows: [sourceRow({
      actor: input.actor,
      sourceId: input.sourceId,
      sourceFamily: input.sourceFamily,
      captureId: input.captureId,
      contentHash: input.contentHash,
      provenance: input.provenance,
      relationship: input.relationship,
      confidence: 0.82,
      route: `/ti/${input.actor}`
    })]
  });
  const profile = buildSourceProvenanceActorProfileContract({
    contract,
    values: { aliases: input.aliases }
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
  const activationReadiness = buildSourceProvenanceSourcePackActivationReadiness({ receipt });
  const auditPacket = buildSourceProvenanceSourceActivationAuditPacket({ activationReadiness });
  const decisionReceipt = buildSourceProvenanceSourceActivationDecisionReceipt({
    auditPacket,
    generatedAt: "2026-06-29T12:27:00.000Z"
  });
  return buildSourceProvenanceSourcePackFixtureGrowthPacket({
    decisionReceipt,
    generatedAt: "2026-06-29T12:28:00.000Z"
  });
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
