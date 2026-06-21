// @ts-nocheck
import type {
  ActorResultDto,
  ActorResultRankItem,
  ActorResultRankKind,
  ExtractionProvenance,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  PipelineResult,
  RelationshipGraph
} from "../types.ts";
import { clampScore, stableId } from "../utils.ts";
import { buildRelationshipGraph, relationshipConfidence } from "./relationships.ts";

export interface ActorGraphOptions {
  actor: string;
  aliases?: string[];
  generatedAt: string;
  staleAfterDays?: number;
}

interface AggregatedRelationship extends IntelligenceRelationship {
  supportCount: number;
}

const RANK_KINDS: ActorResultRankKind[] = [
  "recent-activity",
  "supported-target",
  "confident-ttp",
  "target-sector",
  "target-region",
  "malware-tooling",
  "cve",
  "emerging-infrastructure",
  "stale-context",
  "contested-claim"
];

export function buildActorResultDto(results: PipelineResult[], options: ActorGraphOptions): ActorResultDto {
  const actorValue = canonicalActor(options.actor);
  const aliasSet = new Set([actorValue, ...(options.aliases ?? [])].map((item) => item.toLowerCase()));
  const nodeMap = new Map<string, IntelligenceGraphNode>();
  const relationshipMap = new Map<string, AggregatedRelationship>();
  const actorNode = ensureActorNode(nodeMap, actorValue, options.aliases ?? []);

  for (const result of results) {
    const graph = buildRelationshipGraph(result);
    const actorNodes = graph.nodes.filter((node) => node.type === "actor" && aliasSet.has(node.value.toLowerCase()));
    const allActorNodes = graph.nodes.filter((node) => node.type === "actor");
    if (actorNodes.length === 0) continue;

    for (const node of graph.nodes) {
      const canonicalNode = node.type === "actor" && aliasSet.has(node.value.toLowerCase())
        ? mergeNode(actorNode, node)
        : node;
      addOrMergeNode(nodeMap, canonicalNode);
    }

    const nodeIdMap = new Map(actorNodes.map((node) => [node.id, actorNode.id]));
    for (const relationship of graph.relationships) {
      const contested = relationship.type === "attributed-to"
        && actorNodes.some((node) => node.id === relationship.targetRef)
        && allActorNodes.some((node) => !aliasSet.has(node.value.toLowerCase()));
      const normalized = {
        ...relationship,
        sourceRef: nodeIdMap.get(relationship.sourceRef) ?? relationship.sourceRef,
        targetRef: nodeIdMap.get(relationship.targetRef) ?? relationship.targetRef,
        properties: { ...relationship.properties, contested }
      };
      addOrMergeRelationship(relationshipMap, normalized);
    }

    addAliasEdges(relationshipMap, actorNode, actorNodes, result.incident?.firstSeenAt ?? result.capture.collectedAt);
  }

  const graph: RelationshipGraph = {
    nodes: [...nodeMap.values()],
    relationships: [...relationshipMap.values()]
  };

  return {
    actor: actorNode,
    aliases: [...aliasSet],
    graph,
    rankings: rankActorGraph(graph, actorNode.id, options.generatedAt, options.staleAfterDays ?? 180),
    generatedAt: options.generatedAt,
    coordination: {
      agent07Grounding: "Consumes only extracted entities/indicators with provenance; ungrounded NLP claims remain excluded.",
      agent09ApiDto: "Serve ActorResultDto directly for /ti actor result pages without exposing graph internals."
    }
  };
}

function rankActorGraph(
  graph: RelationshipGraph,
  actorNodeId: string,
  generatedAt: string,
  staleAfterDays: number
): Record<ActorResultRankKind, ActorResultRankItem[]> {
  const rankings = RANK_KINDS.reduce((accumulator, kind) => {
    accumulator[kind] = [];
    return accumulator;
  }, {} as Record<ActorResultRankKind, ActorResultRankItem[]>);
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const actorEdges = graph.relationships.filter((relationship) => relationship.sourceRef === actorNodeId || relationship.targetRef === actorNodeId);

  for (const relationship of graph.relationships) {
    const target = nodes.get(relationship.targetRef);
    const source = nodes.get(relationship.sourceRef);
    const stale = isStale(relationship.lastSeenAt, generatedAt, staleAfterDays);
    const contested = Boolean(relationship.properties?.contested);
    const supportCount = Number(relationship.properties?.supportCount ?? 1);
    const base = rankItem(relationship, target ?? source, supportCount, stale, contested);

    if (relationship.type === "targets" && relationship.sourceRef === actorNodeId) rankings["supported-target"].push({ ...base, kind: "supported-target", reason: "Actor-target relationship ranked by support and confidence." });
    if (relationship.type === "uses" && target?.type === "attack-pattern") rankings["confident-ttp"].push({ ...base, kind: "confident-ttp", reason: "ATT&CK/TTP relationship ranked by confidence." });
    if (relationship.type === "uses" && target?.type === "malware") rankings["malware-tooling"].push({ ...base, kind: "malware-tooling", reason: "Malware/tooling relationship ranked by support." });
    if (relationship.type === "exploits" && target?.type === "vulnerability") rankings.cve.push({ ...base, kind: "cve", reason: "CVE exploitation relationship ranked by confidence." });
    if ((relationship.type === "indicates" || relationship.type === "communicates-with") && source?.type === "indicator") {
      rankings["emerging-infrastructure"].push({
        ...rankItem(relationship, source, supportCount, stale, contested),
        kind: "emerging-infrastructure",
        reason: "Indicator/infrastructure evidence ranked by recency."
      });
    }
    if (relationship.type === "related-to" && target?.type === "sector") rankings["target-sector"].push({ ...base, kind: "target-sector", reason: "Victim-sector relationship ranked by support." });
    if (relationship.type === "located-in" && target?.type === "country") rankings["target-region"].push({ ...base, kind: "target-region", reason: "Victim-region relationship ranked by support." });
    if (stale) rankings["stale-context"].push({ ...base, kind: "stale-context", reason: "Relationship is stale relative to the configured threshold." });
    if (contested) rankings["contested-claim"].push({ ...base, kind: "contested-claim", reason: "Relationship participates in conflicting attribution." });
  }

  for (const relationship of actorEdges) {
    const target = nodes.get(relationship.targetRef) ?? nodes.get(relationship.sourceRef);
    rankings["recent-activity"].push({
      ...rankItem(relationship, target, Number(relationship.properties?.supportCount ?? 1), isStale(relationship.lastSeenAt, generatedAt, staleAfterDays), Boolean(relationship.properties?.contested)),
      kind: "recent-activity",
      reason: "Actor-connected relationship ranked by last seen timestamp."
    });
  }

  for (const kind of RANK_KINDS) {
    rankings[kind] = dedupeRankItems(rankings[kind]).sort(compareRankItems).slice(0, 10);
  }

  return rankings;
}

function rankItem(
  relationship: IntelligenceRelationship,
  node: IntelligenceGraphNode | undefined,
  supportCount: number,
  stale: boolean,
  contested: boolean
): ActorResultRankItem {
  return {
    kind: "recent-activity",
    nodeId: node?.id,
    relationshipIds: [relationship.id],
    label: node?.value ?? relationship.targetRef,
    confidence: relationship.confidence,
    supportCount,
    firstSeenAt: relationship.firstSeenAt,
    lastSeenAt: relationship.lastSeenAt,
    provenanceCount: relationship.provenance.length,
    stale,
    contested,
    reason: "Ranked relationship."
  };
}

function addOrMergeNode(nodes: Map<string, IntelligenceGraphNode>, node: IntelligenceGraphNode): IntelligenceGraphNode {
  const existing = nodes.get(node.id);
  if (!existing) {
    nodes.set(node.id, node);
    return node;
  }
  const provenance = mergeProvenance(existing.provenance, node.provenance);
  const merged = {
    ...existing,
    confidence: aggregateConfidence(existing.confidence, node.confidence, provenance.length, false),
    provenance,
    properties: { ...existing.properties, ...node.properties }
  };
  nodes.set(node.id, merged);
  return merged;
}

function addOrMergeRelationship(relationships: Map<string, AggregatedRelationship>, relationship: IntelligenceRelationship): void {
  if (relationship.provenance.length === 0) return;
  const key = `${relationship.sourceRef}:${relationship.type}:${relationship.targetRef}`;
  const existing = relationships.get(key);
  if (!existing) {
    relationships.set(key, { ...relationship, id: stableId("rel", key), supportCount: 1, properties: { ...relationship.properties, supportCount: 1 } });
    return;
  }
  const provenance = mergeProvenance(existing.provenance, relationship.provenance);
  const supportCount = existing.supportCount + 1;
  const contested = Boolean(existing.properties?.contested || relationship.properties?.contested);
  const merged: AggregatedRelationship = {
    ...existing,
    firstSeenAt: minIso(existing.firstSeenAt, relationship.firstSeenAt),
    lastSeenAt: maxIso(existing.lastSeenAt, relationship.lastSeenAt),
    confidence: aggregateConfidence(existing.confidence, relationship.confidence, provenance.length, contested),
    provenance,
    supportCount,
    properties: {
      ...existing.properties,
      ...relationship.properties,
      supportCount,
      contested,
      stale: existing.properties?.stale || relationship.properties?.stale
    }
  };
  relationships.set(key, merged);
}

function addAliasEdges(
  relationships: Map<string, AggregatedRelationship>,
  actorNode: IntelligenceGraphNode,
  actorNodes: IntelligenceGraphNode[],
  seenAt: string
): void {
  for (const alias of actorNodes) {
    if (alias.id === actorNode.id || alias.provenance.length === 0) continue;
    addOrMergeRelationship(relationships, {
      id: stableId("rel", `${alias.id}:alias-of:${actorNode.id}`),
      sourceRef: alias.id,
      targetRef: actorNode.id,
      type: "alias-of",
      confidence: relationshipConfidence("incident-mentions-entity", alias.confidence, actorNode.confidence),
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      provenance: alias.provenance,
      properties: { confidenceRule: "incident-mentions-entity", supportCount: 1 }
    });
  }
}

function ensureActorNode(nodes: Map<string, IntelligenceGraphNode>, actorValue: string, aliases: string[]): IntelligenceGraphNode {
  const node: IntelligenceGraphNode = {
    id: stableId("node", `actor:${actorValue.toLowerCase()}`),
    type: "actor",
    value: actorValue,
    confidence: 0.75,
    provenance: [],
    properties: { aliases }
  };
  nodes.set(node.id, node);
  return node;
}

function mergeNode(actorNode: IntelligenceGraphNode, node: IntelligenceGraphNode): IntelligenceGraphNode {
  return {
    ...actorNode,
    confidence: Math.max(actorNode.confidence, node.confidence),
    provenance: mergeProvenance(actorNode.provenance, node.provenance),
    properties: {
      ...actorNode.properties,
      aliases: [...new Set([...(actorNode.properties?.aliases as string[] | undefined ?? []), node.value, ...(node.properties?.aliases as string[] | undefined ?? [])])]
    }
  };
}

function aggregateConfidence(left: number, right: number, provenanceCount: number, contested: boolean): number {
  const supportBoost = Math.min(0.18, Math.max(0, provenanceCount - 1) * 0.03);
  const contestedPenalty = contested ? 0.18 : 0;
  return clampScore(Math.max(left, right) * 0.72 + ((left + right) / 2) * 0.28 + supportBoost - contestedPenalty);
}

function mergeProvenance(left: ExtractionProvenance[], right: ExtractionProvenance[]): ExtractionProvenance[] {
  const seen = new Set<string>();
  return [...left, ...right].filter((item) => {
    const key = `${item.captureId}:${item.startOffset}:${item.endOffset}:${item.evidenceText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalActor(actor: string): string {
  if (/^apt\d+$/i.test(actor)) return actor.toUpperCase();
  return actor.trim();
}

function isStale(lastSeenAt: string, generatedAt: string, staleAfterDays: number): boolean {
  const ageMs = Date.parse(generatedAt) - Date.parse(lastSeenAt);
  return Number.isFinite(ageMs) && ageMs > staleAfterDays * 24 * 60 * 60_000;
}

function minIso(left: string, right: string): string {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function maxIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function compareRankItems(left: ActorResultRankItem, right: ActorResultRankItem): number {
  return Date.parse(right.lastSeenAt ?? "") - Date.parse(left.lastSeenAt ?? "")
    || right.supportCount - left.supportCount
    || right.confidence - left.confidence
    || right.provenanceCount - left.provenanceCount
    || left.label.localeCompare(right.label);
}

function dedupeRankItems(items: ActorResultRankItem[]): ActorResultRankItem[] {
  const byKey = new Map<string, ActorResultRankItem>();
  for (const item of items) {
    const key = `${item.kind}:${item.nodeId ?? item.label}`;
    const existing = byKey.get(key);
    if (!existing || compareRankItems(item, existing) < 0) byKey.set(key, item);
  }
  return [...byKey.values()];
}
