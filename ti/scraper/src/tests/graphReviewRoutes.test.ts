import { describe, expect, test } from "bun:test";
import {
  handleGraphCutoverReportRoute,
  handleGraphReviewPlanRoute,
  handleStixExportReadinessRoute
} from "../api/graphReviewRoutes.ts";
import { handleApiRequest, startApiServer } from "../api/server.ts";
import { buildPersistedGraphSnapshot } from "../export/graphViews.ts";
import { buildProgressiveGraphUpdate } from "../export/progressiveGraph.ts";
import { exportGraphSnapshotToStixBundle } from "../export/stix.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { ProgressiveGraphEvidence, SourceRecord } from "../types.ts";
import { hashContent } from "../utils.ts";

const apt29 = { type: "actor" as const, value: "APT29", confidence: 0.86, aliases: ["Cozy Bear"] };
const phishing = { type: "attack-pattern" as const, value: "T1566 Phishing", confidence: 0.78, properties: { tactic: "initial-access" } };
const rumor = { type: "victim" as const, value: "Rumored Victim", confidence: 0.34 };

function evidence(input: Partial<ProgressiveGraphEvidence>): ProgressiveGraphEvidence {
  return {
    id: input.id ?? "evidence",
    stage: input.stage ?? "captured",
    observedAt: input.observedAt ?? "2026-05-24T00:00:00.000Z",
    sourceId: input.sourceId ?? "src_graph",
    captureId: input.captureId,
    url: input.url ?? "https://example.test/graph",
    contentHash: input.contentHash ?? input.id ?? "hash",
    extractorVersion: input.extractorVersion ?? "graph-review-route-test",
    relationships: input.relationships ?? []
  };
}

function routeSnapshot() {
  const dto = buildProgressiveGraphUpdate([
    evidence({
      id: "route_ready_reviewed",
      stage: "reviewed",
      sourceId: "vendor_report",
      relationships: [{ source: apt29, target: phishing, type: "uses", confidence: 0.86 }]
    }),
    evidence({
      id: "route_blocked_discovery",
      stage: "discovery",
      sourceId: "live_search",
      observedAt: "2026-05-24T00:01:00.000Z",
      relationships: [{ source: apt29, target: rumor, type: "targets", confidence: 0.3 }]
    })
  ], { generatedAt: "2026-05-24T00:02:00.000Z" });
  return buildPersistedGraphSnapshot(dto.graph, { generatedAt: "2026-05-24T00:03:00.000Z" });
}

function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_rss",
    name: input.name ?? "Security RSS",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/search?q={query}",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.9,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public test source.",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function api(path: string, init?: RequestInit) {
  return new Request(`http://scraper.test${path}`, init);
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

describe("graph review route handlers", () => {
  test("publish frozen graph review examples for every contract action", () => {
    const result = handleGraphReviewPlanRoute({
      snapshot: routeSnapshot(),
      request: { includeExamples: true, generatedAt: "2026-05-24T00:04:00.000Z" }
    });
    expect(result.status).toBe(200);
    if ("error" in result.body) throw new Error(result.body.error.message);

    expect(result.body.contract).toMatchObject({
      endpoint: "/v1/graph/review-plan",
      method: "GET",
      mode: "dry_run"
    });
    expect(result.body.contract.response.forbiddenMutationFields).toContain("reviewDecisionApplied");
    expect(Object.keys(result.body.examples!.actionExamples).sort()).toEqual([
      "accept_edge",
      "block_export",
      "discovery_only_manual_review_required",
      "downgrade_edge",
      "expire_edge",
      "hold_edge",
      "mark_stale",
      "reject_edge",
      "request_evidence",
      "supersede_edge"
    ]);
    expect(result.body.examples!.actionExamples.discovery_only_manual_review_required.safety).toBe("blocked");
    expect(result.body.examples!.actionExamples.discovery_only_manual_review_required.exportImpact.afterEligible).toBe(false);
  });

  test("keeps weak discovery-only graph edges non-exportable by default", () => {
    const snapshot = routeSnapshot();
    const readiness = handleStixExportReadinessRoute({
      snapshot,
      request: { generatedAt: "2026-05-24T00:05:00.000Z" }
    });
    const plan = handleGraphReviewPlanRoute({
      snapshot,
      request: { selectedActions: ["block_export"], generatedAt: "2026-05-24T00:05:00.000Z" }
    });
    expect(readiness.status).toBe(200);
    expect(plan.status).toBe(200);
    if ("error" in readiness.body) throw new Error(readiness.body.error.message);
    if ("error" in plan.body) throw new Error(plan.body.error.message);

    const blocked = readiness.body.readiness.relationships.find((relationship) => relationship.discoveryOnly);
    expect(blocked?.ready).toBe(false);
    expect(blocked?.blockers).toContain("weak_discovery_only_edge");
    expect(readiness.body.readiness.enforcement.items.map((item) => item.code)).toContain("weak_discovery_only_edge");
    expect(readiness.body.readiness.enforcement.releaseGate.publicAnswers).toBe("hold");
    expect(readiness.body.readiness.preview.excludedCount).toBeGreaterThan(0);
    expect(readiness.body.readiness.persistence.mode).toBe("graph_review_persistence_contract");
    expect(readiness.body.readiness.persistence.decisionActions).toEqual(expect.arrayContaining([
      "promote",
      "hold",
      "reject",
      "mark_stale",
      "mark_contradicted",
      "merge_duplicate",
      "split_alias",
      "mark_export_ready"
    ]));
    expect(readiness.body.readiness.exportGovernance).toMatchObject({
      mode: "reviewed_export_subset_governance",
      mediaType: "application/stix+json;version=2.1",
      governanceChecks: {
        taxiiBoundary: "descriptor_only_no_server",
        sourceClaimProvenance: "source_capture_ledger_ids_required"
      },
      noLeak: {
        rawRestrictedMaterialIncluded: false,
        objectKeysIncluded: false,
        unsafeUrlsIncluded: false
      }
    });
    expect(readiness.body.readiness.exportGovernance.eligibleRelationshipIds.length).toBe(readiness.body.readiness.readyCount);
    expect(plan.body.reviewPlan.persistence.rollbackPlan).toMatchObject({
      strategy: "append_compensating_review_decision",
      willDeleteAuditRows: false,
      willRewriteEvidence: false
    });
    expect(plan.body.reviewPlan.enforcement.releaseGate.stixPromotion).toMatch(/hold|rollback/);
    expect(plan.body.reviewPlan.actions.every((action) => action.action === "block_export")).toBe(true);
    expect(plan.body.reviewPlan.actions.some((action) => action.preconditions.includes("discovery-only evidence cannot be auto-promoted to export-ready"))).toBe(true);
  });

  test("validates invalid relationship ids without producing a plan", () => {
    const result = handleGraphCutoverReportRoute({
      snapshot: routeSnapshot(),
      request: { relationshipId: "rel_missing" }
    });

    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({
      error: {
        code: "relationship_not_found",
        details: { relationshipId: "rel_missing" }
      }
    });
  });

  test("mounts graph review cutover and STIX readiness routes from run materialization", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const run = created.run as { id: string; planId: string };
    const plan = store.getPlan(run.planId);
    const rawText = "APT29 used phishing against a healthcare victim from https://evil.example.com.";
    const result = processCollectedItem({
      sourceId: "src_rss",
      taskId: plan?.tasks[0]?.id,
      url: "https://example.test/report",
      collectedAt: "2026-05-24T00:00:00.000Z",
      title: "APT29 report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { fixture: true },
      sensitive: false
    });
    store.savePipelineResult({
      ...result,
      capture: { ...result.capture, tenantId: "tenant_a" }
    });

    const reviewPlan = await body(await handleApiRequest(api(`/v1/graph/review-plan?runId=${run.id}&includeExamples=true`), options));
    const cutover = await body(await handleApiRequest(api(`/v1/graph/cutover-report?runId=${run.id}`), options));
    const readiness = await body(await handleApiRequest(api(`/v1/exports/stix?runId=${run.id}`), options));
    const invalid = await handleApiRequest(api(`/v1/graph/review-plan?runId=${run.id}&relationshipId=rel_missing`), options);
    const invalidBody = await body(invalid);

    expect((reviewPlan.reviewPlan as { endpoint: string }).endpoint).toBe("/v1/graph/review-plan");
    expect(Object.keys((reviewPlan.examples as { actionExamples: Record<string, unknown> }).actionExamples)).toContain("accept_edge");
    expect((cutover.cutoverReport as { endpoint: string }).endpoint).toBe("/v1/graph/cutover-report");
    expect((readiness.readiness as { endpoint: string }).endpoint).toBe("/v1/exports/stix");
    expect(invalid.status).toBe(404);
    expect(invalidBody.error).toMatchObject({ code: "relationship_not_found" });
  });

  test("smokes mounted graph endpoints through the Bun API server for proof cases", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const acceptedRunId = await seedMountedRun(base, store, "accepted", "accepted");
      const rejectedRunId = await seedMountedRun(base, store, "rejected", "rejected");

      const accepted = await fetchJson(`${base}/v1/exports/stix?runId=${acceptedRunId}`) as {
        readiness: { readyCount: number; relationships: Array<{ ready: boolean; reviewState: string }>; enforcement: { releaseGate: { ledgerComplete: boolean; schemaSafe: boolean } } };
      };
      const rejected = await fetchJson(`${base}/v1/exports/stix?runId=${rejectedRunId}`) as {
        readiness: { ready: boolean; readyCount: number; blockedCount: number; relationships: Array<{ ready: boolean; reviewState: string }> };
      };
      const examples = await fetchJson(`${base}/v1/graph/review-plan?runId=${acceptedRunId}&includeExamples=true`) as {
        examples: { actionExamples: Record<string, { action: string; safety: string; exportImpact: { afterEligible: boolean }; preconditions: string[] }> };
      };
      const cutover = await fetchJson(`${base}/v1/graph/cutover-report?runId=${rejectedRunId}`) as {
        cutoverReport: { ready: boolean; counts: { exportReady: number; relationships: number }; promotionBlockers: Array<{ code: string }> };
      };
      const graph = await fetchJson(`${base}/v1/graph/query?runId=${acceptedRunId}&q=APT29`) as {
        graph: {
          endpoint: string;
          relationships: Array<{ exportReady: boolean; provenanceIds: string[] }>;
          attackMatrix: unknown[];
          deltas: unknown[];
          investigationWorkspace: {
            reviewPersistence: {
              mode: string;
              decisions: Array<{ relationshipId: string; decisionId: string; ledgerIds: string[]; appendOnly: boolean; rollbackDecisionId: string }>;
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
            };
            exportGovernance: {
              mode: string;
              eligibleRelationshipIds: string[];
              heldRelationshipIds: string[];
              agentHandoffs: { agent09ApiFields: string[] };
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
            };
            costControls: {
              mode: string;
              tenant: { workspaceKind: string; isolation: string };
              continuation: { boundedRelationshipIds: string[]; truncatedDimensions: string[] };
              heldFacts: { policy: string; missingLedgerRelationshipIds: string[] };
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
            };
            driftMonitor: {
              mode: string;
              tenant: { workspaceKind: string; budgetPolicy: string };
              rows: Array<{ relationshipId: string; action: string; exportEligibleAfter: boolean }>;
              deltaContract: { nextPollSeconds: number; eventTypes: string[] };
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
            };
            relationshipExplanations: {
              mode: string;
              rows: Array<{ relationshipId: string; status: string; why: string[]; exportEligibility: { taxiiBoundary: string; eligible: boolean } }>;
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
            };
            notebookExport: {
              mode: string;
              boundedNodes: unknown[];
              boundedEdges: unknown[];
              pivotRecommendations: unknown[];
              relationshipExplanations: unknown[];
              stixPreviewDescriptor: { taxiiBoundary: string; previewOnly: boolean };
              costBudget: { nextPollSeconds: number };
              deltaClientContract: {
                mode: string;
                polling: { intervalSeconds: number; cursorField: string };
                notebookBinding: { previewOnly: boolean; taxiiBoundary: string };
                safety: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
              };
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
            };
            backendMigrationCertification: {
              mode: string;
              migrationOrder: Array<{ dataset: string }>;
              cursorContinuity: { cursorField: string; nextPollSeconds: number };
              tenantScoping: { isolation: string; crossTenantJoinsAllowed: boolean };
              exportRecomputation: { taxiiBoundary: string };
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean };
            };
          };
          attackCampaignWorkspace: {
            freshnessSlo: {
              mode: string;
              policy: { publicFactPolicy: string; taxiiBoundary: string };
              deltaContract: { cursorField: string; nextPollSeconds: number };
              sourceCadenceRequests: Array<{ dryRun: boolean }>;
              noLeak: { rawRestrictedMaterialIncluded: boolean; objectKeysIncluded: boolean; unsafeUrlsIncluded: boolean; metadataOnly: boolean };
            };
          };
          reviewQueue: { publicFactPolicy: string; total: number };
          exportReadiness: { reviewQueue: { publicFactPolicy: string } };
          runtime: {
            enforcement: { releaseGate: { ledgerComplete: boolean; schemaSafe: boolean } };
            queryCostControls: { mode: string; queuePressure: { nextPollSeconds: number; schedulerBudgetClass: string }; budgets: Array<{ dimension: string; hardLimit: number }> };
            driftMonitor: { mode: string; tenant: { workspaceKind: string }; rows: Array<{ action: string }> };
            backendMigrationCertification: { mode: string; holdPolicy: { policy: string }; migrationOrder: Array<{ dataset: string }> };
            neo4jMigrationAdapter: { mode: string; adapterBoundary: { implementationState: string; taxiiBoundary: string }; benchmarkScenarios: Array<{ name: string }>; parityChecks: { heldRowsRemainNonExportable: boolean }; noLeak: { metadataOnly: boolean; rawRestrictedMaterialIncluded: boolean } };
            backendAdapterCutover: {
              mode: string;
              adapterStrategy: { primaryBackend: string; neo4jState: string; taxiiBoundary: string };
              interfaces: Array<{ name: string; postgresTarget: string; neo4jTarget: string; tenantScoped: boolean }>;
              migrations: Array<{ backend: string; migrationProof: string }>;
              cursorReplay: { cursorField: string; orderPolicy: string };
              reviewHoldParity: { policy: string };
              cutoverReadiness: { fallback: string; proofCommands: string[] };
              noLeak: { metadataOnly: boolean; rawRestrictedMaterialIncluded: boolean };
            };
            liveUpdate: {
              clientContract: {
                mode: string;
                transport: string;
                fixtureNames: string[];
                polling: { intervalSeconds: number; cursorField: string };
                handoffs: { agent09FrontendContract: string };
              };
            };
            reviewPersistence: { mode: string };
            reviewedExportSubset: { mode: string; eligibleRelationshipIds: string[] };
          };
        };
      };
      const timeline = await fetchJson(`${base}/v1/graph/timeline?runId=${acceptedRunId}&q=APT29`) as {
        timeline: { endpoint: string; events: Array<{ label: string; exportReady: boolean }> };
      };
      const invalid = await fetch(`${base}/v1/graph/review-plan?runId=${acceptedRunId}&relationshipId=rel_missing`);
      const invalidBody = await invalid.json() as { error: { code: string } };

      expect(accepted.readiness.relationships.length).toBeGreaterThan(0);
      expect(accepted.readiness.relationships.some((relationship) => relationship.reviewState === "accepted")).toBe(true);
      expect(accepted.readiness.enforcement.releaseGate.ledgerComplete).toBe(true);
      expect(rejected.readiness).toMatchObject({ ready: false, readyCount: 0 });
      expect(rejected.readiness.blockedCount).toBeGreaterThan(0);
      expect(rejected.readiness.relationships.every((relationship) => !relationship.ready && relationship.reviewState === "rejected")).toBe(true);
      expect(examples.examples.actionExamples.discovery_only_manual_review_required).toMatchObject({
        safety: "blocked",
        exportImpact: { afterEligible: false }
      });
      expect(examples.examples.actionExamples.discovery_only_manual_review_required.preconditions).toContain("discovery-only evidence cannot be auto-promoted to export-ready");
      expect(examples.examples.actionExamples.block_export).toMatchObject({
        action: "block_export",
        safety: "blocked",
        exportImpact: { afterEligible: false }
      });
      expect(cutover.cutoverReport.counts.relationships).toBeGreaterThan(0);
      expect(cutover.cutoverReport.counts.exportReady).toBe(0);
      expect(cutover.cutoverReport.promotionBlockers.map((blocker) => blocker.code)).toContain("no_export_ready_relationships");
      expect(graph.graph.endpoint).toBe("/v1/graph/query");
      expect(graph.graph.relationships.some((relationship) => relationship.exportReady && relationship.provenanceIds.length > 0)).toBe(true);
      expect(graph.graph.attackMatrix.length).toBeGreaterThan(0);
      expect(graph.graph.deltas.length).toBeGreaterThan(0);
      expect(["ready", "hold_weak_edges"]).toContain(graph.graph.reviewQueue.publicFactPolicy);
      expect(graph.graph.exportReadiness.reviewQueue.publicFactPolicy).toBe(graph.graph.reviewQueue.publicFactPolicy);
      expect(graph.graph.runtime.enforcement.releaseGate.ledgerComplete).toBe(true);
      expect(graph.graph.investigationWorkspace.reviewPersistence.mode).toBe("graph_review_persistence_contract");
      expect(graph.graph.investigationWorkspace.reviewPersistence.decisions.length).toBeGreaterThan(0);
      expect(graph.graph.investigationWorkspace.reviewPersistence.decisions.every((decision) => decision.appendOnly && decision.decisionId && decision.rollbackDecisionId)).toBe(true);
      expect(graph.graph.investigationWorkspace.exportGovernance.mode).toBe("reviewed_export_subset_governance");
      expect(graph.graph.investigationWorkspace.exportGovernance.eligibleRelationshipIds.length).toBeGreaterThan(0);
      expect(graph.graph.investigationWorkspace.exportGovernance.agentHandoffs.agent09ApiFields).toContain("cursor");
      expect(graph.graph.investigationWorkspace.reviewPersistence.noLeak).toMatchObject({
        rawRestrictedMaterialIncluded: false,
        objectKeysIncluded: false,
        unsafeUrlsIncluded: false
      });
      expect(graph.graph.investigationWorkspace.exportGovernance.noLeak).toMatchObject({
        rawRestrictedMaterialIncluded: false,
        objectKeysIncluded: false,
        unsafeUrlsIncluded: false
      });
      expect(graph.graph.investigationWorkspace.costControls).toMatchObject({
        mode: "graph_query_cost_controls_tenant_budget",
        tenant: {
          workspaceKind: "investigation",
          isolation: "tenant_and_workspace_scoped_budget"
        },
        heldFacts: {
          policy: "held_facts_never_promote_because_of_budget_truncation"
        },
        noLeak: {
          rawRestrictedMaterialIncluded: false,
          objectKeysIncluded: false,
          unsafeUrlsIncluded: false
        }
      });
      expect(graph.graph.investigationWorkspace.costControls.continuation.boundedRelationshipIds.length).toBeLessThanOrEqual(50);
      expect(graph.graph.investigationWorkspace.driftMonitor).toMatchObject({
        mode: "campaign_relationship_drift_monitor",
        tenant: {
          workspaceKind: "investigation",
          budgetPolicy: "respect_graph_query_cost_controls"
        },
        deltaContract: {
          nextPollSeconds: 3
        },
        noLeak: {
          rawRestrictedMaterialIncluded: false,
          objectKeysIncluded: false,
          unsafeUrlsIncluded: false
        }
      });
      expect(graph.graph.investigationWorkspace.driftMonitor.rows.length).toBeGreaterThan(0);
      expect(graph.graph.investigationWorkspace.driftMonitor.rows.some((row) => row.action === "keep_promoted")).toBe(true);
      expect(graph.graph.investigationWorkspace.relationshipExplanations).toMatchObject({
        mode: "graph_relationship_explainability",
        noLeak: {
          rawRestrictedMaterialIncluded: false,
          objectKeysIncluded: false,
          unsafeUrlsIncluded: false
        }
      });
      expect(graph.graph.investigationWorkspace.relationshipExplanations.rows.some((row) =>
        row.exportEligibility.eligible && row.why.length > 0 && row.exportEligibility.taxiiBoundary === "descriptor_only_no_server"
      )).toBe(true);
      expect(graph.graph.investigationWorkspace.notebookExport).toMatchObject({
        mode: "metadata_only_graph_investigation_notebook_export",
        stixPreviewDescriptor: {
          taxiiBoundary: "descriptor_only_no_server",
          previewOnly: true
        },
        costBudget: {
          nextPollSeconds: 3
        },
        deltaClientContract: {
          mode: "graph_delta_client_contract",
          polling: {
            intervalSeconds: 3,
            cursorField: "graph.deltas[].cursor"
          },
          notebookBinding: {
            previewOnly: true,
            taxiiBoundary: "descriptor_only_no_server"
          },
          safety: {
            rawRestrictedMaterialIncluded: false,
            objectKeysIncluded: false,
            unsafeUrlsIncluded: false
          }
        },
        noLeak: {
          rawRestrictedMaterialIncluded: false,
          objectKeysIncluded: false,
          unsafeUrlsIncluded: false
        }
      });
      expect(graph.graph.investigationWorkspace.notebookExport.boundedNodes.length).toBeGreaterThan(0);
      expect(graph.graph.investigationWorkspace.notebookExport.boundedEdges.length).toBeGreaterThan(0);
      expect(graph.graph.investigationWorkspace.notebookExport.pivotRecommendations.length).toBeGreaterThan(0);
      expect(graph.graph.investigationWorkspace.backendMigrationCertification).toMatchObject({
        mode: "graph_backend_production_migration_certification",
        cursorContinuity: {
          cursorField: "graph.deltas[].cursor",
          nextPollSeconds: 3
        },
        tenantScoping: {
          isolation: "tenant_and_workspace_required_on_all_graph_rows",
          crossTenantJoinsAllowed: false
        },
        exportRecomputation: {
          taxiiBoundary: "descriptor_only_no_server"
        },
        noLeak: {
          rawRestrictedMaterialIncluded: false,
          objectKeysIncluded: false,
          unsafeUrlsIncluded: false
        }
      });
      expect(graph.graph.investigationWorkspace.backendMigrationCertification.migrationOrder.map((row) => row.dataset)).toEqual(expect.arrayContaining([
        "nodes",
        "relationships",
        "relationship_reviews",
        "confidence_history",
        "attack_campaign_timeline",
        "graph_pivots",
        "notebook_exports",
        "stix_preview_subsets"
      ]));
      expect(graph.graph.runtime.queryCostControls.mode).toBe("graph_query_cost_controls_tenant_budget");
      expect(graph.graph.runtime.queryCostControls.queuePressure).toMatchObject({
        schedulerBudgetClass: "interactive_graph_query",
        nextPollSeconds: 3
      });
      expect(graph.graph.runtime.queryCostControls.budgets.map((budget) => budget.dimension)).toContain("stix_preview_rows");
      expect(graph.graph.runtime.driftMonitor.mode).toBe("campaign_relationship_drift_monitor");
      expect(graph.graph.runtime.driftMonitor.tenant.workspaceKind).toBe("investigation");
      expect(graph.graph.runtime.backendMigrationCertification.mode).toBe("graph_backend_production_migration_certification");
      expect(graph.graph.runtime.backendMigrationCertification.holdPolicy.policy).toBe("held_relationships_remain_non_exportable_until_review_and_replay_pass");
      expect(graph.graph.runtime.neo4jMigrationAdapter).toMatchObject({
        mode: "neo4j_migration_adapter_contract_benchmark",
        adapterBoundary: {
          implementationState: "contract_only_no_live_driver",
          taxiiBoundary: "descriptor_only_no_server"
        },
        parityChecks: {
          heldRowsRemainNonExportable: true
        },
        noLeak: {
          metadataOnly: true,
          rawRestrictedMaterialIncluded: false
        }
      });
      expect(graph.graph.runtime.neo4jMigrationAdapter.benchmarkScenarios.map((scenario) => scenario.name)).toEqual(expect.arrayContaining([
        "actor_one_hop",
        "campaign_two_hop",
        "cursor_replay"
      ]));
      expect(graph.graph.runtime.backendAdapterCutover).toMatchObject({
        mode: "neo4j_postgres_graph_backend_adapter_contract",
        adapterStrategy: {
          primaryBackend: "postgres_graph_tables",
          neo4jState: "contract_only_no_live_driver",
          taxiiBoundary: "descriptor_only_no_server"
        },
        cursorReplay: {
          cursorField: "graph.deltas[].cursor",
          orderPolicy: "preserve_delta_cursor_order_across_backends"
        },
        reviewHoldParity: {
          policy: "held_relationships_remain_non_exportable_until_review_replay_and_recompute_pass"
        },
        cutoverReadiness: {
          fallback: "keep_memory_snapshot_or_postgres_graph_tables_authoritative"
        },
        noLeak: {
          metadataOnly: true,
          rawRestrictedMaterialIncluded: false
        }
      });
      expect(graph.graph.runtime.backendAdapterCutover.interfaces.every((item) => item.tenantScoped)).toBe(true);
      expect(graph.graph.runtime.backendAdapterCutover.migrations.map((migration) => migration.backend)).toEqual(["postgres_graph_tables", "neo4j"]);
      expect(graph.graph.runtime.liveUpdate.clientContract).toMatchObject({
        mode: "graph_delta_client_contract",
        transport: "polling_primary_sse_future",
        polling: {
          intervalSeconds: 3,
          cursorField: "graph.deltas[].cursor"
        },
        handoffs: {
          agent09FrontendContract: "poll_graph_deltas_every_3_seconds_with_stable_cursor_fields"
        }
      });
      expect(graph.graph.runtime.liveUpdate.clientContract.fixtureNames).toContain("stix_export_eligibility_change");
      expect(graph.graph.attackCampaignWorkspace.freshnessSlo).toMatchObject({
        mode: "attack_campaign_freshness_slo",
        policy: {
          publicFactPolicy: "hold_stale_or_unreviewed_campaign_ttp_rows",
          taxiiBoundary: "descriptor_only_no_server"
        },
        deltaContract: {
          cursorField: "graph.deltas[].cursor",
          nextPollSeconds: 3
        },
        noLeak: {
          rawRestrictedMaterialIncluded: false,
          objectKeysIncluded: false,
          unsafeUrlsIncluded: false,
          metadataOnly: true
        }
      });
      expect(graph.graph.attackCampaignWorkspace.freshnessSlo.sourceCadenceRequests.every((request) => request.dryRun)).toBe(true);
      expect(graph.graph.runtime.reviewPersistence.mode).toBe("graph_review_persistence_contract");
      expect(graph.graph.runtime.reviewedExportSubset.mode).toBe("reviewed_export_subset_governance");
      expect(timeline.timeline.endpoint).toBe("/v1/graph/timeline");
      expect(timeline.timeline.events.some((event) => event.label.includes("APT29"))).toBe(true);
      expect(invalid.status).toBe(404);
      expect(invalidBody.error.code).toBe("relationship_not_found");
    } finally {
      server.stop();
    }
  });

  test("exports only readiness-passing graph relationships as STIX facts", () => {
    const snapshot = routeSnapshot();
    const bundle = exportGraphSnapshotToStixBundle(snapshot, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T05:00:00.000Z"
    });
    const validation = validateStixBundle(bundle);
    const relationships = bundle.objects.filter((object) => object.type === "relationship");
    const identity = bundle.objects.find((object) => object.type === "identity" && object.name === "ti-scraper");

    expect(validation.valid).toBe(true);
    expect(relationships.length).toBeGreaterThan(0);
    expect(relationships.every((object) => Array.isArray(object.x_ti_provenance) && object.x_ti_provenance.length > 0)).toBe(true);
    expect(relationships.every((object) => object.x_ti_review_state === "accepted")).toBe(true);
    expect(bundle.objects.some((object) => object.type === "marking-definition" && object.name === "TI Scraper Review Required")).toBe(true);
    expect(Array.isArray(identity?.x_ti_blocked_relationships)).toBe(true);
    expect(JSON.stringify(identity?.x_ti_blocked_relationships)).toContain("weak_discovery_only_edge");
    expect(identity?.x_ti_review_persistence).toMatchObject({
      mode: "graph_review_persistence_contract",
      rollbackStrategy: "append_compensating_review_decision",
      noLeak: {
        rawRestrictedMaterialIncluded: false,
        objectKeysIncluded: false,
        unsafeUrlsIncluded: false
      }
    });
    expect(identity?.x_ti_reviewed_export_subset).toMatchObject({
      mediaType: "application/stix+json;version=2.1",
      governanceChecks: {
        taxiiBoundary: "descriptor_only_no_server",
        restrictedMetadataHolds: "metadata_only_edges_remain_descriptor_context"
      },
      noLeak: {
        rawRestrictedMaterialIncluded: false,
        objectKeysIncluded: false,
        unsafeUrlsIncluded: false
      }
    });
  });
});

async function seedMountedRun(
  base: string,
  store: InMemoryScraperStore,
  name: string,
  graphReviewState: "accepted" | "rejected"
): Promise<string> {
  const tenantId = `tenant_graph_mounted_${name}`;
  const created = await fetchJson(`${base}/v1/intel/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId })
  }) as { run: { id: string; planId: string } };
  const plan = store.getPlan(created.run.planId);
  const rawText = `APT29 used phishing and Cobalt Strike against Northwind Health in healthcare from https://evil.example.com/${name} and exploited CVE-2025-12345.`;
  const result = processCollectedItem({
    sourceId: "src_rss",
    taskId: plan?.tasks[0]?.id,
    url: `https://example.test/${name}`,
    collectedAt: "2026-05-24T00:00:00.000Z",
    title: `APT29 ${name} mounted graph proof`,
    rawText,
    contentHash: hashContent(rawText),
    links: [],
    metadata: {
      evidenceStage: graphReviewState === "accepted" ? "reviewed_promoted" : "captured_page",
      graphReviewState,
      graphReviewReason: `${graphReviewState} mounted graph proof`
    },
    sensitive: false
  });
  store.savePipelineResult({
    ...result,
    capture: {
      ...result.capture,
      tenantId,
      metadata: {
        ...result.capture.metadata,
        evidenceStage: graphReviewState === "accepted" ? "reviewed_promoted" : "captured_page",
        graphReviewState,
        graphReviewReason: `${graphReviewState} mounted graph proof`
      }
    }
  });
  return created.run.id;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed: ${url} -> ${response.status}`);
  return await response.json() as Record<string, unknown>;
}
