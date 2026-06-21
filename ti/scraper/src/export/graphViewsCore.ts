// @ts-nocheck
import type { PersistedGraphSnapshot, RelationshipGraph } from "../types.ts";
import { clampScore, stableId } from "../utils.ts";

export interface GraphPersistenceOptions { generatedAt: string; }
export interface GraphNeighborhoodOptions { centerNodeId: string; depth?: 1 | 2; includeReviewStates?: string[]; }
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

export function profileView(snapshot: PersistedGraphSnapshot, nodeId: string, kind: string) {
  return { kind, node: snapshot.nodes.find((node: any) => node.id === nodeId), neighborhood: buildGraphNeighborhoodView(snapshot, { centerNodeId: nodeId }) };
}

export function workspace(kind: string, snapshot: PersistedGraphSnapshot) {
  return { kind, generatedAt: snapshot.generatedAt, nodeCount: snapshot.nodes.length, relationshipCount: snapshot.relationships.length, reviewQueue: buildGraphReviewQueueSummary(snapshot) };
}

export function reviewItem(rel: any) {
  return { id: stableId("graph-review", rel.id), relationshipId: rel.id, reviewState: rel.reviewState ?? "proposed", confidence: rel.confidence ?? 0.5 };
}

export function compactContract(name: string) {
  return { name, safeMetadataOnly: true, routeReady: true };
}

export function buildGraphReviewQueueSummary(snapshot: PersistedGraphSnapshot) {
  const queued = snapshot.relationships.filter((rel: any) => rel.reviewState !== "accepted").length;
  const accepted = snapshot.relationships.filter((rel: any) => rel.reviewState === "accepted").length;
  return { queued, accepted };
}
