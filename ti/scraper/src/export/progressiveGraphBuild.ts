// @ts-nocheck
import { clampScore, stableId } from "../utils.ts";
import { relationshipDeltas, buildRelationshipDeltaDtos } from "./progressiveGraphDeltas.ts";
import { highest, uniq } from "./progressiveGraphStages.ts";

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

function staged(confidence, stage) {
  return clampScore(confidence * ({ discovery: 0.35, captured: 0.55, extracted: 0.75, reviewed: 0.9, promoted: 1 }[stage] ?? 0.5) + confidence * 0.4);
}

function prov(evidence) {
  return { evidenceId: evidence.id, sourceId: evidence.sourceId, captureId: evidence.captureId, observedAt: evidence.observedAt, urlHash: stableId("urlhash", evidence.url ?? ""), contentHash: evidence.contentHash, extractorVersion: evidence.extractorVersion, stage: evidence.stage };
}

function norm(value) { return String(value).trim().toLowerCase(); }
function minIso(a, b) { return Date.parse(a) <= Date.parse(b) ? a : b; }
function maxIso(a, b) { return Date.parse(a) >= Date.parse(b) ? a : b; }
