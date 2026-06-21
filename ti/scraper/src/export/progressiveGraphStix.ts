// @ts-nocheck
import { clampScore, stableId } from "../utils.ts";
import {
  relationshipStixEligibility,
  reviewState,
  sourceIds,
  stageOf
} from "./progressiveGraphStages.ts";

export function exportProgressiveGraphToStixBundle(dto, options) {
  const objects = new Map(), identity = { type: "identity", spec_version: "2.1", id: stixId("identity", options.producerName), created: options.generatedAt, modified: options.generatedAt, name: options.producerName, x_ti_tenant_id: options.tenantId };
  objects.set(identity.id, identity);
  const includeDiscovery = options.includeDiscoveryEvidence || options.includeUnreviewedDiscoveryContext;
  const rels = dto.graph.relationships.filter((rel) => relationshipStixEligibility(rel).includedByDefault || includeDiscovery && stageOf(rel) === "discovery");
  const nodeIds = new Set(rels.flatMap((rel) => [rel.sourceRef, rel.targetRef]));
  for (const item of dto.graph.nodes.filter((n) => nodeIds.has(n.id))) objects.set(stixRef(item), stixNode(item, options.generatedAt));
  for (const rel of rels) objects.set(stixId("relationship", rel.id), stixRelationship(dto, rel, options.generatedAt));
  return { type: "bundle", id: stixId("bundle", `${options.producerName}:${options.generatedAt}`), objects: [...objects.values()] };
}

function stixRelationship(dto, rel, at) {
  return { type: "relationship", spec_version: "2.1", id: stixId("relationship", rel.id), created: at, modified: at, relationship_type: rel.type, source_ref: stixRefId(dto.graph, rel.sourceRef), target_ref: stixRefId(dto.graph, rel.targetRef), confidence: Math.round(clampScore(rel.confidence) * 100), first_seen: rel.firstSeenAt, last_seen: rel.lastSeenAt, x_ti_provenance: rel.provenance ?? [], x_ti_review_state: reviewState(rel), x_ti_review_audit: rel.properties?.reviewAudit ?? [], x_ti_stix_eligibility: relationshipStixEligibility(rel), x_ti_source_ids: sourceIds(rel), x_ti_evidence_stage: stageOf(rel), description: rel.properties?.reviewReason };
}

function stixNode(node, at) {
  const type = node.type === "actor" ? "threat-actor" : node.type === "attack-pattern" ? "attack-pattern" : node.type === "tool" ? "tool" : "identity";
  return { type, spec_version: "2.1", id: stixRef(node), created: at, modified: at, name: node.value, aliases: node.aliases, confidence: Math.round(clampScore(node.confidence) * 100), x_ti_node_type: node.type };
}

function stixRef(node) {
  return stixId(node.type === "actor" ? "threat-actor" : node.type === "attack-pattern" ? "attack-pattern" : node.type === "tool" ? "tool" : "identity", node.id);
}

function stixRefId(graph, id) {
  return stixRef(graph.nodes.find((node) => node.id === id) ?? { id, type: "identity" });
}

function stixId(type, value) {
  const h = stableId("stix", value).replace(/^stix_/, "").padEnd(32, "0").slice(0, 32);
  return `${type}--${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
