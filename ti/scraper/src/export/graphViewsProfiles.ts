// @ts-nocheck
import type { PersistedGraphSnapshot } from "../types.ts";
import { buildGraphNeighborhoodView, profileView, workspace, type CorrelationGraphQueryOptions } from "./graphViewsCore.ts";
import { checkStixExportReadiness } from "./graphViewsReview.ts";

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
export const buildRelationshipCursorDeltas = (current: PersistedGraphSnapshot, options: any) => ({ generatedAt: options.generatedAt, added: current.relationships.filter((rel: any) => !(options.previous?.relationships ?? []).some((old: any) => old.id === rel.id)), removed: [], updated: [] });
export const buildGraphLiveSearchUpdateDto = (snapshot: PersistedGraphSnapshot) => ({ generatedAt: snapshot.generatedAt, updateCount: snapshot.relationships.length });
export { buildGraphNeighborhoodView };
