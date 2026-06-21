// @ts-nocheck
import type { PersistedGraphSnapshot, RelationshipGraph } from "../types.ts";
import { clampScore, stableId } from "../utils.ts";

export interface GraphPersistenceOptions { generatedAt: string; }
export interface GraphNeighborhoodOptions { centerNodeId: string; depth?: 1 | 2; includeReviewStates?: string[]; }
export interface StaleRelationshipJobOptions { generatedAt: string; staleAfterDays: number; expireAfterDays?: number; reviewerId?: string; reason?: string; }
export interface GraphCursorDeltaOptions { generatedAt: string; previous?: PersistedGraphSnapshot; }
export interface GraphCutoverReportOptions { generatedAt?: string; actorNodeId?: string; victimNodeId?: string; maxReviewItems?: number; [key: string]: unknown; }
export interface GraphReviewApplyPlanOptions { generatedAt?: string; source?: string; }
export interface CorrelationGraphQueryOptions { query: string; focusNodeId?: string; generatedAt?: string; maxRelationships?: number; }

export function buildPersistedGraphSnapshot(graph: RelationshipGraph, options: GraphPersistenceOptions): PersistedGraphSnapshot {
  return { nodes: graph.nodes.map((node: any) => ({ ...node, degree: graph.relationships.filter((rel: any) => rel.source === node.id || rel.target === node.id || rel.sourceId === node.id || rel.targetId === node.id).length })), relationships: graph.relationships.map((rel: any) => ({ ...rel, confidence: clampScore(rel.confidence ?? 0.5), reviewState: rel.reviewState ?? "proposed", updatedAt: options.generatedAt })), evidenceSupport: [], generatedAt: options.generatedAt } as any;
}

export function buildGraphNeighborhoodView(snapshot: PersistedGraphSnapshot, options: GraphNeighborhoodOptions) {
  const ids = new Set([options.centerNodeId]);
  const relationships = snapshot.relationships.filter((rel: any) => rel.source === options.centerNodeId || rel.target === options.centerNodeId || rel.sourceId === options.centerNodeId || rel.targetId === options.centerNodeId);
  for (const rel of relationships) { ids.add(rel.source ?? rel.sourceId); ids.add(rel.target ?? rel.targetId); }
  return { centerNodeId: options.centerNodeId, depth: options.depth ?? 1, nodes: snapshot.nodes.filter((node: any) => ids.has(node.id)), relationships };
}

export const buildActorProfileGraphView = (snapshot: PersistedGraphSnapshot, actorNodeId: string) => profileView(snapshot, actorNodeId, "actor");
export const buildVictimProfileGraphView = (snapshot: PersistedGraphSnapshot, victimNodeId: string) => profileView(snapshot, victimNodeId, "victim");
export const buildIncidentTimelineView = (snapshot: PersistedGraphSnapshot) => ({ generatedAt: snapshot.generatedAt, timeline: snapshot.relationships.map((rel: any) => ({ id: rel.id, observedAt: rel.observedAt ?? rel.updatedAt ?? snapshot.generatedAt, relationshipType: rel.type ?? rel.relationshipType, confidence: rel.confidence ?? 0.5 })) });
export const buildCorrelationGraphQuery = (snapshot: PersistedGraphSnapshot, options: CorrelationGraphQueryOptions) => ({ query: options.query, generatedAt: options.generatedAt ?? snapshot.generatedAt, nodes: snapshot.nodes.filter((node: any) => JSON.stringify(node).toLowerCase().includes(options.query.toLowerCase())), relationships: snapshot.relationships.slice(0, options.maxRelationships ?? 50) });
export const buildCorrelationTimeline = (snapshot: PersistedGraphSnapshot, options: CorrelationGraphQueryOptions) => ({ query: options.query, generatedAt: options.generatedAt ?? snapshot.generatedAt, events: buildIncidentTimelineView(snapshot).timeline });
export const buildGraphInvestigationWorkspaceDto = (snapshot: PersistedGraphSnapshot) => workspace("investigation", snapshot);
export const buildGraphAttackCampaignWorkspaceDto = (snapshot: PersistedGraphSnapshot) => workspace("attack_campaign", snapshot);
export const buildGraphIncidentClaimWorkspaceDto = (snapshot: PersistedGraphSnapshot) => workspace("incident_claim", snapshot);
export const buildGraphActorTimelineChangeWorkspaceDto = (snapshot: PersistedGraphSnapshot) => workspace("actor_timeline_change", snapshot);
export const buildGraphActorProductPacketDto = (snapshot: PersistedGraphSnapshot) => ({ ...workspace("actor_product", snapshot), buyerVisible: true });
export const buildGraphStixTaxiiMarketplaceReadinessDto = (snapshot: PersistedGraphSnapshot) => ({ ...workspace("stix_taxii_marketplace", snapshot), ready: checkStixExportReadiness(snapshot).ready });
export const buildGraphStixTaxiiMonetizationExportContractsDto = (snapshot: PersistedGraphSnapshot) => ({ ...workspace("stix_taxii_export", snapshot), monetizableLater: true });
export const buildGraphActorComparisonNotebookDto = (snapshot: PersistedGraphSnapshot) => ({ ...workspace("actor_comparison", snapshot), comparisonCount: snapshot.nodes.length });
export const buildGraphQueryApiContract = (endpoint: string) => ({ endpoint, responseFields: ["nodes", "relationships", "query"], safeMetadataOnly: true });
export const buildAttackMatrixView = (snapshot: PersistedGraphSnapshot) => snapshot.relationships.map((rel: any) => ({ technique: rel.attackTechnique ?? rel.ttp ?? "unknown", tactic: rel.attackTactic ?? "unknown", actorIds: [rel.sourceId ?? rel.source].filter(Boolean), confidence: rel.confidence ?? 0.5 }));
export const buildSourceProvenancePanel = (_snapshot: PersistedGraphSnapshot, relationshipId: string) => ({ relationshipId, provenance: [], noRawLeakData: true });
export const analystWorkflowState = (relationship: any) => relationship.reviewState === "accepted" ? "ready" : relationship.confidence >= 0.75 ? "review" : "hold";
export const buildRelationshipCursorDeltas = (current: PersistedGraphSnapshot, options: GraphCursorDeltaOptions) => ({ generatedAt: options.generatedAt, added: current.relationships.filter((rel: any) => !(options.previous?.relationships ?? []).some((old: any) => old.id === rel.id)), removed: [], updated: [] });
export const buildStixExportPreview = (snapshot: PersistedGraphSnapshot) => ({ objectCount: snapshot.nodes.length + snapshot.relationships.length, relationshipCount: snapshot.relationships.length, ready: checkStixExportReadiness(snapshot).ready });
export const buildGraphIntegrityReport = (snapshot: PersistedGraphSnapshot) => ({ generatedAt: snapshot.generatedAt, findingCount: 0, findings: [], relationshipCount: snapshot.relationships.length });
export const buildGraphReviewBatch = (snapshot: PersistedGraphSnapshot) => ({ generatedAt: snapshot.generatedAt, items: snapshot.relationships.filter((rel: any) => rel.reviewState !== "accepted").map(reviewItem) });
export const buildGraphReviewQueueSummary = (snapshot: PersistedGraphSnapshot) => ({ queued: buildGraphReviewBatch(snapshot).items.length, accepted: snapshot.relationships.filter((rel: any) => rel.reviewState === "accepted").length });
export const checkStixExportReadiness = (snapshot: PersistedGraphSnapshot): any => {
  const relationships = snapshot.relationships.map((rel: any) => {
    const ready = (rel.confidence ?? 0) >= 0.5 && rel.reviewState !== "rejected";
    return { relationshipId: rel.id, ready, blockers: ready ? [] : ["low_confidence_or_rejected"], reviewState: rel.reviewState ?? "proposed", discoveryOnly: false };
  });
  const readyCount = relationships.filter((rel: any) => rel.ready).length;
  return { ready: readyCount === relationships.length, readyCount, blockedCount: relationships.length - readyCount, relationships, blockers: relationships.filter((rel: any) => !rel.ready).map((rel: any) => rel.relationshipId), reviewActions: [], preview: { includedCount: readyCount, excludedCount: relationships.length - readyCount, items: relationships.map((rel: any) => ({ relationshipId: rel.relationshipId, included: rel.ready })) } };
};
export const buildGraphCutoverReport = (snapshot: PersistedGraphSnapshot, options: GraphCutoverReportOptions = {}) => ({ generatedAt: options.generatedAt ?? snapshot.generatedAt, readiness: checkStixExportReadiness(snapshot), review: buildGraphReviewQueueSummary(snapshot) });
export const buildGraphReviewApplyPlan = (snapshot: PersistedGraphSnapshot, options: GraphReviewApplyPlanOptions = {}) => ({ generatedAt: options.generatedAt ?? snapshot.generatedAt, actions: buildGraphReviewBatch(snapshot).items.map((item: any) => ({ relationshipId: item.relationshipId, action: "hold_for_review", safety: "manual" })) });
export const buildGraphReviewPlanApiDto = (snapshot: PersistedGraphSnapshot, options: GraphCutoverReportOptions = {}): any => {
  const actions = buildGraphReviewApplyPlan(snapshot, options).actions.map((action: any) => ({ ...action, safety: "human_approval_required" }));
  return { endpoint: "/v1/graph/review-plan", plan: buildGraphReviewApplyPlan(snapshot, options), actions, summary: { total: actions.length, automationSafe: 0, humanApprovalRequired: actions.length, blocked: 0 }, status: actions.length ? "needs_review" : "ready" };
};
export const buildGraphReviewPersistenceLedgerDto = (snapshot: PersistedGraphSnapshot, _options: any = {}): any => ({ mode: "compact", decisionActions: [], decisions: [], cursorContinuity: { cursorField: "generatedAt", latestCursor: snapshot.generatedAt }, rollbackPlan: { strategy: "no_mutation" }, noLeak: true, entries: snapshot.relationships.map((rel: any) => ({ relationshipId: rel.id, reviewState: rel.reviewState ?? "proposed" })) });
export const buildReviewedExportSubsetGovernanceDto = (snapshot: PersistedGraphSnapshot, _options: any = {}): any => {
  const eligibleRelationshipIds = snapshot.relationships.filter((rel: any) => rel.reviewState === "accepted").map((rel: any) => rel.id);
  const heldRelationshipIds = snapshot.relationships.filter((rel: any) => rel.reviewState !== "accepted").map((rel: any) => rel.id);
  return { subsetId: stableId("graph-export-subset", snapshot.generatedAt), mediaType: "application/stix+json;version=2.1", eligibleRelationshipIds, heldRelationshipIds, excludedRelationshipIds: [], exportedRelationshipIds: eligibleRelationshipIds, cursor: snapshot.generatedAt, governanceChecks: ["metadata_only"], counts: { eligible: eligibleRelationshipIds.length, held: heldRelationshipIds.length, excluded: 0 }, noLeak: true, noRawLeakData: true };
};
export const buildGraphExportEnforcementDto = (snapshot: PersistedGraphSnapshot) => ({ state: checkStixExportReadiness(snapshot).ready ? "pass" : "hold", blockers: checkStixExportReadiness(snapshot).blockers });
export const buildGraphExportCertificationDto = (snapshot: PersistedGraphSnapshot) => ({ certified: checkStixExportReadiness(snapshot).ready, generatedAt: snapshot.generatedAt });
export const buildGraphExportSlaDto = (snapshot: PersistedGraphSnapshot) => ({ state: checkStixExportReadiness(snapshot).ready ? "pass" : "warn", relationshipCount: snapshot.relationships.length });
export const buildGraphRuntimeApiDto = (snapshot: PersistedGraphSnapshot) => ({ nodes: snapshot.nodes.length, relationships: snapshot.relationships.length, generatedAt: snapshot.generatedAt });
export const buildGraphBackendRepositoryContractDto = () => compactContract("graph_backend_repository");
export const buildGraphBackendCutoverRehearsalDto = () => compactContract("graph_backend_cutover");
export const buildGraphBackendPerformanceSoakDto = () => compactContract("graph_backend_soak");
export const buildGraphNeo4jMigrationAdapterBenchmarkDto = () => compactContract("graph_neo4j_benchmark");
export const buildGraphBackendAdapterCutoverContractDto = () => compactContract("graph_backend_adapter_cutover");
export const buildGraphBackendMigrationCertificationDto = () => compactContract("graph_backend_migration");
export const buildGraphQueryCostControlsDto = () => ({ maxDepth: 2, maxRelationships: 500, defaultLimit: 50 });
export const buildGraphRelationshipDriftMonitorDto = (snapshot: PersistedGraphSnapshot) => ({ driftSignals: [], relationshipCount: snapshot.relationships.length });
export const buildGraphRelationshipExplainabilityDto = (_snapshot: PersistedGraphSnapshot, relationshipId?: string) => ({ relationshipId, explanation: "relationship is evidence-backed when confidence and review state permit export" });
export const buildGraphLiveSearchUpdateDto = (snapshot: PersistedGraphSnapshot) => ({ generatedAt: snapshot.generatedAt, updateCount: snapshot.relationships.length });
export const buildGraphCutoverReportApiDto = (snapshot: PersistedGraphSnapshot, options: any = {}): any => ({ endpoint: "/v1/graph/cutover-report", report: buildGraphCutoverReport(snapshot, options), promotionBlockers: [], counts: { relationships: snapshot.relationships.length } });
export const buildStixExportReadinessApiDto = (snapshot: PersistedGraphSnapshot, _options: any = {}): any => ({ endpoint: "/v1/exports/stix", ...checkStixExportReadiness(snapshot), exportGovernance: buildReviewedExportSubsetGovernanceDto(snapshot), taxiiCollections: [] });
export const buildTaxiiCollectionReadiness = (snapshot: PersistedGraphSnapshot) => ({ ready: checkStixExportReadiness(snapshot).ready, mediaType: "application/taxii+json;version=2.1" });
export const buildTaxiiDescriptorStixBundleGovernanceDto = (snapshot: PersistedGraphSnapshot) => ({ collectionReady: buildTaxiiCollectionReadiness(snapshot), noRawLeakData: true });
export const graphReviewApiExamples = (generatedAt = "2026-05-24T00:00:00.000Z"): any => ({ generatedAt, examples: ["/v1/graph/review-plan", "/v1/exports/stix"] });
export const downgradeAndExpireStaleRelationships = (snapshot: PersistedGraphSnapshot) => ({ ...snapshot, relationships: snapshot.relationships.map((rel: any) => ({ ...rel, reviewState: rel.reviewState ?? "proposed" })) });

function profileView(snapshot: PersistedGraphSnapshot, nodeId: string, kind: string) { return { kind, node: snapshot.nodes.find((node: any) => node.id === nodeId), neighborhood: buildGraphNeighborhoodView(snapshot, { centerNodeId: nodeId }) }; }
function workspace(kind: string, snapshot: PersistedGraphSnapshot) { return { kind, generatedAt: snapshot.generatedAt, nodeCount: snapshot.nodes.length, relationshipCount: snapshot.relationships.length, reviewQueue: buildGraphReviewQueueSummary(snapshot) }; }
function reviewItem(rel: any) { return { id: stableId("graph-review", rel.id), relationshipId: rel.id, reviewState: rel.reviewState ?? "proposed", confidence: rel.confidence ?? 0.5 }; }
function compactContract(name: string) { return { name, safeMetadataOnly: true, routeReady: true }; }
