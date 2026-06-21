// @ts-nocheck
import {
  actionAvailability,
  compareDeltas,
  reviewReasons,
  reviewState,
  sourceIds,
  stageOf
} from "./progressiveGraphStages.ts";
import { relationshipStixEligibility } from "./progressiveGraphStages.ts";

export function buildRelationshipDeltaDtos(deltas) {
  return [...deltas].sort(compareDeltas).map((delta, index) => {
    const stage = stageOf(delta.relationship), reasons = reviewReasons(delta, stage);
    return { relationshipId: delta.relationship.id, kind: delta.kind, stage, confidenceBefore: delta.previous?.confidence, confidenceAfter: delta.relationship.confidence, sourceIds: sourceIds(delta.relationship), firstSeenAt: delta.relationship.firstSeenAt, lastSeenAt: delta.relationship.lastSeenAt, requiresAnalystReview: reasons.length > 0, reviewReasons: reasons, reviewState: reviewState(delta.relationship), reviewReason: delta.relationship.properties?.reviewReason, reviewActionAvailability: actionAvailability(delta.relationship), stixEligibility: relationshipStixEligibility(delta.relationship), rank: index + 1, sourceRef: delta.relationship.sourceRef, targetRef: delta.relationship.targetRef, relationshipType: delta.relationship.type, reason: delta.reason };
  });
}

export function relationshipDeltas(previous, graph, generatedAt, staleAfterDays) {
  const prev = new Map((previous?.relationships ?? []).map((rel) => [rel.id, rel]));
  const deltas = graph.relationships.map((rel) => {
    const old = prev.get(rel.id), kind = !old ? "added" : rel.properties?.contradicted ? "contradicted" : rel.properties?.promoted && !old.properties?.promoted ? "promoted" : rel.confidence < old.confidence ? "downgraded" : rel.confidence !== old.confidence || stageOf(rel) !== stageOf(old) ? "updated" : undefined;
    return kind ? { kind, relationship: rel, previous: old, reason: reasonFor(kind) } : undefined;
  }).filter(Boolean);
  const staleCutoff = Date.parse(generatedAt) - staleAfterDays * 86_400_000;
  for (const rel of graph.relationships) if (Date.parse(rel.lastSeenAt) < staleCutoff) deltas.push({ kind: "stale", relationship: rel, previous: prev.get(rel.id), reason: "relationship has not been refreshed within stale window" });
  return deltas.sort(compareDeltas);
}

function reasonFor(kind) {
  return ({ promoted: "relationship promoted", contradicted: "relationship contradicted by newer evidence", downgraded: "relationship confidence downgraded", added: "relationship added", updated: "relationship updated", stale: "relationship stale" })[kind];
}
