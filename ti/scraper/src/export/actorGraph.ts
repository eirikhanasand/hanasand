// @ts-nocheck
import type { ActorResultDto, ActorResultRankItem, ActorResultRankKind, ExtractionProvenance, IntelligenceGraphNode, IntelligenceRelationship, PipelineResult, RelationshipGraph } from "../types.ts";
import { clampScore, stableId } from "../utils.ts";
import { buildRelationshipGraph, relationshipConfidence } from "./relationships.ts";

export type ActorGraphOptions = { actor: string; aliases?: string[]; generatedAt: string; staleAfterDays?: number };
const RANKS: ActorResultRankKind[] = ["recent-activity", "supported-target", "confident-ttp", "target-sector", "target-region", "malware-tooling", "cve", "emerging-infrastructure", "stale-context", "contested-claim"];

export function buildActorResultDto(results: PipelineResult[], options: ActorGraphOptions): ActorResultDto {
  const value = /^apt\d+$/i.test(options.actor) ? options.actor.toUpperCase() : options.actor.trim(), aliases = new Set([value, ...(options.aliases ?? [])].map((x) => x.toLowerCase()));
  const nodes = new Map<string, IntelligenceGraphNode>(), rels = new Map<string, any>(), actor = actorNode(value, options.aliases ?? []); nodes.set(actor.id, actor);
  for (const result of results) mergeResult(buildRelationshipGraph(result), result, aliases, actor, nodes, rels);
  const graph: RelationshipGraph = { nodes: [...nodes.values()], relationships: [...rels.values()] };
  return { actor, aliases: [...aliases], graph, rankings: rankActorGraph(graph, actor.id, options.generatedAt, options.staleAfterDays ?? 180), generatedAt: options.generatedAt, coordination: { agent07Grounding: "Consumes only extracted entities/indicators with provenance; ungrounded NLP claims remain excluded.", agent09ApiDto: "Serve ActorResultDto directly for /ti actor result pages without exposing graph internals." } };
}

function mergeResult(graph: RelationshipGraph, result: PipelineResult, aliases: Set<string>, actor: IntelligenceGraphNode, nodes: Map<string, IntelligenceGraphNode>, rels: Map<string, any>) {
  const actorNodes = graph.nodes.filter((n) => n.type === "actor" && aliases.has(n.value.toLowerCase())), allActors = graph.nodes.filter((n) => n.type === "actor");
  if (!actorNodes.length) return;
  for (const node of graph.nodes) mergeNode(nodes, node.type === "actor" && aliases.has(node.value.toLowerCase()) ? mergeActor(actor, node) : node);
  const remap = new Map(actorNodes.map((n) => [n.id, actor.id]));
  for (const rel of graph.relationships) addRel(rels, { ...rel, sourceRef: remap.get(rel.sourceRef) ?? rel.sourceRef, targetRef: remap.get(rel.targetRef) ?? rel.targetRef, properties: { ...rel.properties, contested: rel.type === "attributed-to" && actorNodes.some((n) => n.id === rel.targetRef) && allActors.some((n) => !aliases.has(n.value.toLowerCase())) } });
  for (const alias of actorNodes) if (alias.id !== actor.id && alias.provenance.length) addRel(rels, { id: stableId("rel", `${alias.id}:alias-of:${actor.id}`), sourceRef: alias.id, targetRef: actor.id, type: "alias-of", confidence: relationshipConfidence("incident-mentions-entity", alias.confidence, actor.confidence), firstSeenAt: result.incident?.firstSeenAt ?? result.capture.collectedAt, lastSeenAt: result.incident?.firstSeenAt ?? result.capture.collectedAt, provenance: alias.provenance, properties: { confidenceRule: "incident-mentions-entity", supportCount: 1 } });
}

function rankActorGraph(graph: RelationshipGraph, actorId: string, generatedAt: string, staleDays: number): Record<ActorResultRankKind, ActorResultRankItem[]> {
  const out = Object.fromEntries(RANKS.map((k) => [k, []])) as Record<ActorResultRankKind, ActorResultRankItem[]>, nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const rel of graph.relationships) {
    const source = nodes.get(rel.sourceRef), target = nodes.get(rel.targetRef), stale = isStale(rel.lastSeenAt, generatedAt, staleDays), contested = Boolean(rel.properties?.contested), support = Number(rel.properties?.supportCount ?? 1), base = item(rel, target ?? source, support, stale, contested);
    if (rel.type === "targets" && rel.sourceRef === actorId) out["supported-target"].push({ ...base, kind: "supported-target", reason: "Actor-target relationship ranked by support and confidence." });
    if (rel.type === "uses" && target?.type === "attack-pattern") out["confident-ttp"].push({ ...base, kind: "confident-ttp", reason: "ATT&CK/TTP relationship ranked by confidence." });
    if (rel.type === "uses" && target?.type === "malware") out["malware-tooling"].push({ ...base, kind: "malware-tooling", reason: "Malware/tooling relationship ranked by support." });
    if (rel.type === "exploits" && target?.type === "vulnerability") out.cve.push({ ...base, kind: "cve", reason: "CVE exploitation relationship ranked by confidence." });
    if ((rel.type === "indicates" || rel.type === "communicates-with") && source?.type === "indicator") out["emerging-infrastructure"].push({ ...item(rel, source, support, stale, contested), kind: "emerging-infrastructure", reason: "Indicator/infrastructure evidence ranked by recency." });
    if (rel.type === "related-to" && target?.type === "sector") out["target-sector"].push({ ...base, kind: "target-sector", reason: "Victim-sector relationship ranked by support." });
    if (rel.type === "located-in" && target?.type === "country") out["target-region"].push({ ...base, kind: "target-region", reason: "Victim-region relationship ranked by support." });
    if (stale) out["stale-context"].push({ ...base, kind: "stale-context", reason: "Relationship is stale relative to the configured threshold." });
    if (contested) out["contested-claim"].push({ ...base, kind: "contested-claim", reason: "Relationship participates in conflicting attribution." });
    if (rel.sourceRef === actorId || rel.targetRef === actorId) out["recent-activity"].push({ ...item(rel, target ?? source, support, stale, contested), kind: "recent-activity", reason: "Actor-connected relationship ranked by last seen timestamp." });
  }
  for (const kind of RANKS) out[kind] = dedupe(out[kind]).sort(compare).slice(0, 10);
  return out;
}

function addRel(map: Map<string, any>, rel: IntelligenceRelationship) { if (!rel.provenance.length) return; const key = `${rel.sourceRef}:${rel.type}:${rel.targetRef}`, prev = map.get(key); if (!prev) return map.set(key, { ...rel, id: stableId("rel", key), supportCount: 1, properties: { ...rel.properties, supportCount: 1 } }); const provenance = mergeProvenance(prev.provenance, rel.provenance), supportCount = prev.supportCount + 1, contested = Boolean(prev.properties?.contested || rel.properties?.contested); map.set(key, { ...prev, firstSeenAt: min(prev.firstSeenAt, rel.firstSeenAt), lastSeenAt: max(prev.lastSeenAt, rel.lastSeenAt), confidence: confidence(prev.confidence, rel.confidence, provenance.length, contested), provenance, supportCount, properties: { ...prev.properties, ...rel.properties, supportCount, contested, stale: prev.properties?.stale || rel.properties?.stale } }); }
function mergeNode(map: Map<string, IntelligenceGraphNode>, node: IntelligenceGraphNode) { const prev = map.get(node.id); map.set(node.id, prev ? { ...prev, confidence: confidence(prev.confidence, node.confidence, mergeProvenance(prev.provenance, node.provenance).length, false), provenance: mergeProvenance(prev.provenance, node.provenance), properties: { ...prev.properties, ...node.properties } } : node); }
function mergeActor(actor: IntelligenceGraphNode, node: IntelligenceGraphNode) { return { ...actor, confidence: Math.max(actor.confidence, node.confidence), provenance: mergeProvenance(actor.provenance, node.provenance), properties: { ...actor.properties, aliases: [...new Set([...(actor.properties?.aliases ?? []), node.value, ...(node.properties?.aliases ?? [])])] } }; }
function item(rel: IntelligenceRelationship, node: IntelligenceGraphNode | undefined, supportCount: number, stale: boolean, contested: boolean): ActorResultRankItem { return { kind: "recent-activity", nodeId: node?.id, relationshipIds: [rel.id], label: node?.value ?? rel.targetRef, confidence: rel.confidence, supportCount, firstSeenAt: rel.firstSeenAt, lastSeenAt: rel.lastSeenAt, provenanceCount: rel.provenance.length, stale, contested, reason: "Ranked relationship." }; }
function actorNode(value: string, aliases: string[]): IntelligenceGraphNode { return { id: stableId("node", `actor:${value.toLowerCase()}`), type: "actor", value, confidence: 0.75, provenance: [], properties: { aliases } }; }
function confidence(left: number, right: number, count: number, contested: boolean) { return clampScore(Math.max(left, right) * 0.72 + ((left + right) / 2) * 0.28 + Math.min(0.18, Math.max(0, count - 1) * 0.03) - (contested ? 0.18 : 0)); }
function mergeProvenance(left: ExtractionProvenance[], right: ExtractionProvenance[]) { const seen = new Set<string>(); return [...left, ...right].filter((p) => { const key = `${p.captureId}:${p.startOffset}:${p.endOffset}:${p.evidenceText}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
const isStale = (seen: string, now: string, days: number) => { const age = Date.parse(now) - Date.parse(seen); return Number.isFinite(age) && age > days * 24 * 60 * 60_000; };
const min = (a: string, b: string) => Date.parse(a) <= Date.parse(b) ? a : b;
const max = (a: string, b: string) => Date.parse(a) >= Date.parse(b) ? a : b;
const compare = (a: ActorResultRankItem, b: ActorResultRankItem) => Date.parse(b.lastSeenAt ?? "") - Date.parse(a.lastSeenAt ?? "") || b.supportCount - a.supportCount || b.confidence - a.confidence || b.provenanceCount - a.provenanceCount || a.label.localeCompare(b.label);
function dedupe(items: ActorResultRankItem[]) { const map = new Map<string, ActorResultRankItem>(); for (const i of items) { const key = `${i.kind}:${i.nodeId ?? i.label}`, prev = map.get(key); if (!prev || compare(i, prev) < 0) map.set(key, i); } return [...map.values()]; }
