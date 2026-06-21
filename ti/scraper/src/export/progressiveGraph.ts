// @ts-nocheck
import { clampScore, stableId } from "../utils.ts";

const STAGES = ["discovery", "captured", "extracted", "reviewed", "promoted"];
const PRIORITY = { promoted: 100, contradicted: 95, downgraded: 90, added: 70, updated: 45, stale: 20 };

export function buildProgressiveGraphUpdate(evidence, options) {
  const nodes = new Map(), relationships = new Map();
  for (const item of evidence) for (const rel of item.relationships) {
    const source = putNode(nodes, node(rel.source, item));
    const target = putNode(nodes, node(rel.target, item));
    merge(relationships, relationship(item, source, target, rel), item.stage);
  }
  const graph = { nodes: [...nodes.values()], relationships: [...relationships.values()] };
  const deltas = relationshipDeltas(options.previous, graph, options.generatedAt, options.staleAfterDays ?? 30);
  return { stage: highest(evidence.map((e) => e.stage)), graph, deltas, relationshipDeltas: buildRelationshipDeltaDtos(deltas), generatedAt: options.generatedAt };
}

export function buildRelationshipDeltaDtos(deltas) {
  return [...deltas].sort(compareDeltas).map((delta, index) => {
    const stage = stageOf(delta.relationship), reasons = reviewReasons(delta, stage);
    return { relationshipId: delta.relationship.id, kind: delta.kind, stage, confidenceBefore: delta.previous?.confidence, confidenceAfter: delta.relationship.confidence, sourceIds: sourceIds(delta.relationship), firstSeenAt: delta.relationship.firstSeenAt, lastSeenAt: delta.relationship.lastSeenAt, requiresAnalystReview: reasons.length > 0, reviewReasons: reasons, reviewState: reviewState(delta.relationship), reviewReason: delta.relationship.properties?.reviewReason, reviewActionAvailability: actionAvailability(delta.relationship), stixEligibility: relationshipStixEligibility(delta.relationship), rank: index + 1, sourceRef: delta.relationship.sourceRef, targetRef: delta.relationship.targetRef, relationshipType: delta.relationship.type, reason: delta.reason };
  });
}

export function relationshipStixEligibility(relationship) {
  const stage = stageOf(relationship), promoted = relationship.properties?.promoted === true || stage === "promoted", accepted = reviewState(relationship) === "accepted";
  return { discoveryOnly: stage === "discovery" && !promoted, captureBacked: idx(stage) >= idx("captured") || promoted, extracted: idx(stage) >= idx("extracted") || promoted, reviewed: idx(stage) >= idx("reviewed") || promoted, promoted, accepted, includedByDefault: accepted || promoted };
}

export function applyGraphReviewDecision(graph, decision) {
  return { nodes: graph.nodes, relationships: graph.relationships.map((rel) => rel.id === decision.relationshipId ? applyRelationshipReviewDecision(rel, decision) : rel) };
}

export function applyRelationshipReviewDecision(relationship, decision) {
  const toState = decision.action === "accept" || decision.action === "resolve_contradiction" ? "accepted" : decision.action === "reject" ? "rejected" : decision.action === "supersede" ? "superseded" : "needs_review";
  const audit = [...(relationship.properties?.reviewAudit ?? []), { decisionId: decision.id, relationshipId: decision.relationshipId, fromState: reviewState(relationship), toState, action: decision.action, reviewerId: decision.reviewerId, reason: decision.reason, decidedAt: decision.decidedAt, sourceIds: uniq(decision.sourceIds ?? []), evidenceIds: uniq(decision.evidenceIds ?? []), supersedesRelationshipId: decision.supersedesRelationshipId }];
  return { ...relationship, properties: { ...relationship.properties, reviewState: toState, reviewDecisionId: decision.id, reviewReason: decision.reason, reviewedBy: decision.reviewerId, reviewedAt: decision.decidedAt, reviewSourceIds: audit.at(-1).sourceIds, reviewEvidenceIds: audit.at(-1).evidenceIds, supersedesRelationshipId: decision.supersedesRelationshipId, contradicted: decision.action === "resolve_contradiction" ? false : relationship.properties?.contradicted === true || toState === "contradicted", promoted: relationship.properties?.promoted === true || toState === "accepted", reviewAudit: audit } };
}

export function exportProgressiveGraphToStixBundle(dto, options) {
  const objects = new Map(), identity = { type: "identity", spec_version: "2.1", id: stixId("identity", options.producerName), created: options.generatedAt, modified: options.generatedAt, name: options.producerName, x_ti_tenant_id: options.tenantId };
  objects.set(identity.id, identity);
  const includeDiscovery = options.includeDiscoveryEvidence || options.includeUnreviewedDiscoveryContext;
  const rels = dto.graph.relationships.filter((rel) => relationshipStixEligibility(rel).includedByDefault || includeDiscovery && stageOf(rel) === "discovery");
  const nodeIds = new Set(rels.flatMap((rel) => [rel.sourceRef, rel.targetRef]));
  for (const item of dto.graph.nodes.filter((n) => nodeIds.has(n.id))) objects.set(stixRef(item), stixNode(item, options.generatedAt));
  for (const rel of rels) objects.set(stixId("relationship", rel.id), { type: "relationship", spec_version: "2.1", id: stixId("relationship", rel.id), created: options.generatedAt, modified: options.generatedAt, relationship_type: rel.type, source_ref: stixRefId(dto.graph, rel.sourceRef), target_ref: stixRefId(dto.graph, rel.targetRef), confidence: Math.round(clampScore(rel.confidence) * 100), first_seen: rel.firstSeenAt, last_seen: rel.lastSeenAt, x_ti_provenance: rel.provenance ?? [], x_ti_review_state: reviewState(rel), x_ti_review_audit: rel.properties?.reviewAudit ?? [], x_ti_stix_eligibility: relationshipStixEligibility(rel), x_ti_source_ids: sourceIds(rel), x_ti_evidence_stage: stageOf(rel), description: rel.properties?.reviewReason });
  return { type: "bundle", id: stixId("bundle", `${options.producerName}:${options.generatedAt}`), objects: [...objects.values()] };
}

function node(input, evidence) {
  const id = stableId("node", `${input.type}:${norm(input.value)}`);
  return { id, type: input.type, value: input.value, label: input.value, confidence: clampScore(input.confidence ?? 0.5), firstSeenAt: evidence.observedAt, lastSeenAt: evidence.observedAt, aliases: input.aliases ?? [], sourceIds: [evidence.sourceId], evidenceIds: [evidence.id], properties: { stage: evidence.stage } };
}
function relationship(evidence, source, target, input) {
  const id = stableId("rel", `${source.id}:${input.type}:${target.id}`);
  const stage = evidence.stage;
  return { id, sourceRef: source.id, targetRef: target.id, type: input.type, confidence: staged(input.confidence ?? 0.5, stage), firstSeenAt: evidence.observedAt, lastSeenAt: evidence.observedAt, sourceIds: [evidence.sourceId], evidenceIds: [evidence.id], provenance: [prov(evidence)], properties: { stage, contradicted: input.contradicted === true, promoted: stage === "promoted", captureIds: evidence.captureId ? [evidence.captureId] : [], contentHashes: evidence.contentHash ? [evidence.contentHash] : [] } };
}
function putNode(nodes, next) {
  const prev = nodes.get(next.id);
  if (!prev) nodes.set(next.id, next);
  else nodes.set(next.id, { ...prev, confidence: Math.max(prev.confidence, next.confidence), firstSeenAt: minIso(prev.firstSeenAt, next.firstSeenAt), lastSeenAt: maxIso(prev.lastSeenAt, next.lastSeenAt), aliases: uniq([...(prev.aliases ?? []), ...(next.aliases ?? [])]), sourceIds: uniq([...(prev.sourceIds ?? []), ...next.sourceIds]), evidenceIds: uniq([...(prev.evidenceIds ?? []), ...next.evidenceIds]), properties: { ...prev.properties, stage: highest([prev.properties?.stage ?? "discovery", next.properties?.stage ?? "discovery"]) } });
  return nodes.get(next.id);
}
function merge(map, next, stage) {
  const prev = map.get(next.id);
  if (!prev) return map.set(next.id, next);
  const nextStage = highest([prev.properties?.stage ?? "discovery", stage]);
  const contradicted = prev.properties?.contradicted === true || next.properties?.contradicted === true;
  map.set(next.id, { ...prev, confidence: contradicted && next.properties?.contradicted ? Math.min(prev.confidence, next.confidence) : Math.max(prev.confidence, next.confidence), firstSeenAt: minIso(prev.firstSeenAt, next.firstSeenAt), lastSeenAt: maxIso(prev.lastSeenAt, next.lastSeenAt), sourceIds: uniq([...(prev.sourceIds ?? []), ...next.sourceIds]), evidenceIds: uniq([...(prev.evidenceIds ?? []), ...next.evidenceIds]), provenance: [...(prev.provenance ?? []), ...next.provenance], properties: { ...prev.properties, stage: nextStage, contradicted, promoted: prev.properties?.promoted === true || next.properties?.promoted === true || nextStage === "promoted", captureIds: uniq([...(prev.properties?.captureIds ?? []), ...(next.properties?.captureIds ?? [])]), contentHashes: uniq([...(prev.properties?.contentHashes ?? []), ...(next.properties?.contentHashes ?? [])]) } });
}
function relationshipDeltas(previous, graph, generatedAt, staleAfterDays) {
  const prev = new Map((previous?.relationships ?? []).map((rel) => [rel.id, rel]));
  const deltas = graph.relationships.map((rel) => {
    const old = prev.get(rel.id), kind = !old ? "added" : rel.properties?.contradicted ? "contradicted" : rel.properties?.promoted && !old.properties?.promoted ? "promoted" : rel.confidence < old.confidence ? "downgraded" : rel.confidence !== old.confidence || stageOf(rel) !== stageOf(old) ? "updated" : undefined;
    return kind ? { kind, relationship: rel, previous: old, reason: reasonFor(kind) } : undefined;
  }).filter(Boolean);
  const staleCutoff = Date.parse(generatedAt) - staleAfterDays * 86_400_000;
  for (const rel of graph.relationships) if (Date.parse(rel.lastSeenAt) < staleCutoff) deltas.push({ kind: "stale", relationship: rel, previous: prev.get(rel.id), reason: "relationship has not been refreshed within stale window" });
  return deltas.sort(compareDeltas);
}
function compareDeltas(a, b) { return (PRIORITY[b.kind] ?? 0) - (PRIORITY[a.kind] ?? 0) || b.relationship.confidence - a.relationship.confidence || a.relationship.id.localeCompare(b.relationship.id); }
function reviewReasons(delta, stage) { return uniq([delta.kind === "contradicted" ? "contradicted evidence" : "", delta.kind === "stale" ? "stale relationship" : "", stage === "discovery" ? "discovery-only evidence" : "", delta.relationship.confidence < 0.5 ? "low confidence" : ""]); }
function actionAvailability(rel) { const state = reviewState(rel); return { accept: state !== "accepted", reject: state !== "rejected", supersede: true, resolveContradiction: rel.properties?.contradicted === true }; }
function reviewState(rel) { return rel.properties?.reviewState ?? (rel.properties?.contradicted ? "contradicted" : stageOf(rel) === "promoted" ? "accepted" : stageOf(rel) === "discovery" ? "needs_review" : "unreviewed"); }
function stageOf(rel) { const stage = rel.properties?.stage ?? "discovery"; return STAGES.includes(stage) ? stage : "discovery"; }
function staged(confidence, stage) { return clampScore(confidence * ({ discovery: 0.35, captured: 0.55, extracted: 0.75, reviewed: 0.9, promoted: 1 }[stage] ?? 0.5) + confidence * 0.4); }
function sourceIds(rel) { return uniq(rel.sourceIds ?? rel.provenance?.map((p) => p.sourceId) ?? []); }
function prov(evidence) { return { evidenceId: evidence.id, sourceId: evidence.sourceId, captureId: evidence.captureId, observedAt: evidence.observedAt, urlHash: stableId("urlhash", evidence.url ?? ""), contentHash: evidence.contentHash, extractorVersion: evidence.extractorVersion, stage: evidence.stage }; }
function stixNode(node, at) { const type = node.type === "actor" ? "threat-actor" : node.type === "attack-pattern" ? "attack-pattern" : node.type === "tool" ? "tool" : "identity"; return { type, spec_version: "2.1", id: stixRef(node), created: at, modified: at, name: node.value, aliases: node.aliases, confidence: Math.round(clampScore(node.confidence) * 100), x_ti_node_type: node.type }; }
function stixRef(node) { return stixId(node.type === "actor" ? "threat-actor" : node.type === "attack-pattern" ? "attack-pattern" : node.type === "tool" ? "tool" : "identity", node.id); }
function stixRefId(graph, id) { return stixRef(graph.nodes.find((node) => node.id === id) ?? { id, type: "identity" }); }
function stixId(type, value) { const h = stableId("stix", value).replace(/^stix_/, "").padEnd(32, "0").slice(0, 32); return `${type}--${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; }
function reasonFor(kind) { return ({ promoted: "relationship promoted", contradicted: "relationship contradicted by newer evidence", downgraded: "relationship confidence downgraded", added: "relationship added", updated: "relationship updated", stale: "relationship stale" })[kind]; }
function idx(stage) { return STAGES.indexOf(stage); }
function highest(stages) { return stages.sort((a, b) => idx(b) - idx(a))[0] ?? "discovery"; }
function norm(value) { return String(value).trim().toLowerCase(); }
function minIso(a, b) { return Date.parse(a) <= Date.parse(b) ? a : b; }
function maxIso(a, b) { return Date.parse(a) >= Date.parse(b) ? a : b; }
function uniq(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))); }
