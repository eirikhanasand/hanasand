// @ts-nocheck
import { reviewState, stageOf, uniq } from "./progressiveGraphStages.ts";

export function applyGraphReviewDecision(graph, decision) {
  return { nodes: graph.nodes, relationships: graph.relationships.map((rel) => rel.id === decision.relationshipId ? applyRelationshipReviewDecision(rel, decision) : rel) };
}

export function applyRelationshipReviewDecision(relationship, decision) {
  const toState = decision.action === "accept" || decision.action === "resolve_contradiction" ? "accepted" : decision.action === "reject" ? "rejected" : decision.action === "supersede" ? "superseded" : "needs_review";
  const audit = [...(relationship.properties?.reviewAudit ?? []), auditEntry(relationship, decision, toState)];
  return { ...relationship, properties: { ...relationship.properties, reviewState: toState, reviewDecisionId: decision.id, reviewReason: decision.reason, reviewedBy: decision.reviewerId, reviewedAt: decision.decidedAt, reviewSourceIds: audit.at(-1).sourceIds, reviewEvidenceIds: audit.at(-1).evidenceIds, supersedesRelationshipId: decision.supersedesRelationshipId, contradicted: decision.action === "resolve_contradiction" ? false : relationship.properties?.contradicted === true || toState === "contradicted", promoted: relationship.properties?.promoted === true || toState === "accepted", reviewAudit: audit } };
}

function auditEntry(relationship, decision, toState) {
  return { decisionId: decision.id, relationshipId: decision.relationshipId, fromState: reviewState(relationship), toState, action: decision.action, reviewerId: decision.reviewerId, reason: decision.reason, decidedAt: decision.decidedAt, sourceIds: uniq(decision.sourceIds ?? []), evidenceIds: uniq(decision.evidenceIds ?? []), supersedesRelationshipId: decision.supersedesRelationshipId };
}

export function currentRelationshipStage(relationship) {
  return stageOf(relationship);
}
