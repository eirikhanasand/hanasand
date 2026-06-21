// @ts-nocheck
import type {
  ExtractionProvenance,
  GraphRelationshipReviewState,
  GraphReviewAuditEntry,
  GraphReviewDecision,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  ProgressiveEvidenceStage,
  ProgressiveGraphDto,
  ProgressiveGraphEvidence,
  RelationshipDelta,
  RelationshipDeltaDto,
  RelationshipGraph,
  RelationshipReviewActionAvailability,
  RelationshipStixEligibility,
  StixBundle,
  StixExportOptions,
  StixObject
} from "../types.ts";
import { clampScore, stableId } from "../utils.ts";

const STAGE_WEIGHT: Record<ProgressiveEvidenceStage, number> = {
  discovery: 0.35,
  captured: 0.55,
  extracted: 0.75,
  reviewed: 0.9,
  promoted: 1
};

const STAGE_ORDER: ProgressiveEvidenceStage[] = ["discovery", "captured", "extracted", "reviewed", "promoted"];

const DELTA_PRIORITY: Record<RelationshipDelta["kind"], number> = {
  promoted: 100,
  contradicted: 95,
  downgraded: 90,
  added: 70,
  updated: 45,
  stale: 20
};

const REVIEW_STATES: GraphRelationshipReviewState[] = [
  "unreviewed",
  "needs_review",
  "accepted",
  "rejected",
  "superseded",
  "contradicted",
  "expired"
];

export function buildProgressiveGraphUpdate(
  evidence: ProgressiveGraphEvidence[],
  options: {
    generatedAt: string;
    previous?: RelationshipGraph;
    staleAfterDays?: number;
  }
): ProgressiveGraphDto {
  const nodes = new Map<string, IntelligenceGraphNode>();
  const relationships = new Map<string, IntelligenceRelationship>();

  for (const item of evidence) {
    for (const relationship of item.relationships) {
      const source = addNode(nodes, nodeFromEvidence(relationship.source, item));
      const target = addNode(nodes, nodeFromEvidence(relationship.target, item));
      const edge = relationshipFromEvidence(item, source, target, relationship);
      mergeRelationship(relationships, edge, item.stage);
    }
  }

  const graph: RelationshipGraph = {
    nodes: [...nodes.values()],
    relationships: [...relationships.values()]
  };

  const deltas = relationshipDeltas(options.previous, graph, options.generatedAt, options.staleAfterDays ?? 30);

  return {
    stage: highestStage(evidence.map((item) => item.stage)),
    graph,
    deltas,
    relationshipDeltas: buildRelationshipDeltaDtos(deltas),
    generatedAt: options.generatedAt
  };
}

export function buildRelationshipDeltaDtos(deltas: RelationshipDelta[]): RelationshipDeltaDto[] {
  const sorted = [...deltas].sort(compareRelationshipDeltas);
  return sorted.map((item, index) => {
    const stage = stageForRelationship(item.relationship);
    const reviewReasons = reviewReasonsForDelta(item, stage);
    return {
      relationshipId: item.relationship.id,
      kind: item.kind,
      stage,
      confidenceBefore: item.previous?.confidence,
      confidenceAfter: item.relationship.confidence,
      sourceIds: sourceIds(item.relationship),
      firstSeenAt: item.relationship.firstSeenAt,
      lastSeenAt: item.relationship.lastSeenAt,
      requiresAnalystReview: reviewReasons.length > 0,
      reviewReasons,
      reviewState: relationshipReviewState(item.relationship),
      reviewReason: reviewReason(item.relationship),
      reviewActionAvailability: reviewActionAvailability(item.relationship),
      stixEligibility: relationshipStixEligibility(item.relationship),
      rank: index + 1,
      sourceRef: item.relationship.sourceRef,
      targetRef: item.relationship.targetRef,
      relationshipType: item.relationship.type,
      reason: item.reason
    };
  });
}

export function relationshipStixEligibility(relationship: IntelligenceRelationship): RelationshipStixEligibility {
  const stage = stageForRelationship(relationship);
  const promoted = relationship.properties?.promoted === true || stage === "promoted";
  const accepted = relationshipReviewState(relationship) === "accepted";
  const discoveryOnly = stage === "discovery" && !promoted;
  return {
    discoveryOnly,
    captureBacked: stageIndex(stage) >= stageIndex("captured") || promoted,
    extracted: stageIndex(stage) >= stageIndex("extracted") || promoted,
    reviewed: stageIndex(stage) >= stageIndex("reviewed") || promoted,
    promoted,
    accepted,
    includedByDefault: accepted || promoted
  };
}

export function applyGraphReviewDecision(graph: RelationshipGraph, decision: GraphReviewDecision): RelationshipGraph {
  return {
    nodes: graph.nodes,
    relationships: graph.relationships.map((relationship) =>
      relationship.id === decision.relationshipId ? applyRelationshipReviewDecision(relationship, decision) : relationship
    )
  };
}

export function applyRelationshipReviewDecision(
  relationship: IntelligenceRelationship,
  decision: GraphReviewDecision
): IntelligenceRelationship {
  const fromState = relationshipReviewState(relationship);
  const toState = reviewStateForDecision(decision.action);
  const existingAudit = reviewAudit(relationship);
  const auditEntry: GraphReviewAuditEntry = {
    decisionId: decision.id,
    relationshipId: relationship.id,
    fromState,
    toState,
    action: decision.action,
    reviewerId: decision.reviewerId,
    reason: decision.reason,
    decidedAt: decision.decidedAt,
    sourceIds: uniqueSorted(decision.sourceIds),
    evidenceIds: uniqueSorted(decision.evidenceIds),
    supersedesRelationshipId: decision.supersedesRelationshipId
  };

  return {
    ...relationship,
    properties: {
      ...relationship.properties,
      reviewState: toState,
      reviewDecisionId: decision.id,
      reviewReason: decision.reason,
      reviewedBy: decision.reviewerId,
      reviewedAt: decision.decidedAt,
      reviewSourceIds: auditEntry.sourceIds,
      reviewEvidenceIds: auditEntry.evidenceIds,
      supersedesRelationshipId: decision.supersedesRelationshipId,
      contradicted: decision.action === "resolve_contradiction" ? false : relationship.properties?.contradicted === true || toState === "contradicted",
      promoted: relationship.properties?.promoted === true || toState === "accepted",
      reviewAudit: [...existingAudit, auditEntry]
    }
  };
}

export function exportProgressiveGraphToStixBundle(
  dto: ProgressiveGraphDto,
  options: StixExportOptions
): StixBundle {
  const objects = new Map<string, StixObject>();
  const identity: StixObject = {
    type: "identity",
    spec_version: "2.1",
    id: stixId("identity", options.producerName),
    created: options.generatedAt,
    modified: options.generatedAt,
    name: options.producerName,
    x_ti_tenant_id: options.tenantId
  };
  objects.set(identity.id, identity);

  const includeUnreviewedDiscovery = options.includeDiscoveryEvidence || options.includeUnreviewedDiscoveryContext;
  const exportableRelationships = dto.graph.relationships.filter((relationship) =>
    relationshipStixEligibility(relationship).includedByDefault || (includeUnreviewedDiscovery && stageForRelationship(relationship) === "discovery")
  );
  const referencedNodeIds = new Set(exportableRelationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));

  for (const node of dto.graph.nodes.filter((node) => referencedNodeIds.has(node.id))) {
    objects.set(stixRefForNode(node), stixObjectForNode(node, options.generatedAt));
  }

  for (const relationship of exportableRelationships) {
    objects.set(stixId("relationship", relationship.id), {
      type: "relationship",
      spec_version: "2.1",
      id: stixId("relationship", relationship.id),
      created: options.generatedAt,
      modified: options.generatedAt,
      relationship_type: relationship.type,
      source_ref: stixRefForNodeId(dto.graph, relationship.sourceRef),
      target_ref: stixRefForNodeId(dto.graph, relationship.targetRef),
      confidence: Math.round(clampScore(relationship.confidence) * 100),
      first_seen: relationship.firstSeenAt,
      last_seen: relationship.lastSeenAt,
      x_ti_provenance: relationship.provenance,
      x_ti_stage: relationship.properties?.stage,
      x_ti_delta_kind: dto.deltas.find((delta) => delta.relationship.id === relationship.id)?.kind,
      x_ti_stix_eligibility: relationshipStixEligibility(relationship),
      x_ti_review_state: relationshipReviewState(relationship),
      x_ti_review_reason: reviewReason(relationship),
      x_ti_review_audit: reviewAudit(relationship),
      x_ti_requires_review: dto.relationshipDeltas.find((delta) => delta.relationshipId === relationship.id)?.requiresAnalystReview ?? false
    });
  }

  return {
    type: "bundle",
    id: stixId("bundle", `${options.producerName}:${options.generatedAt}:progressive:${dto.stage}`),
    objects: [...objects.values()]
  };
}

function nodeFromEvidence(
  input: ProgressiveGraphEvidence["relationships"][number]["source"],
  evidence: ProgressiveGraphEvidence
): IntelligenceGraphNode {
  return {
    id: stableId("node", `${input.type}:${input.value.toLowerCase()}`),
    type: input.type,
    value: input.value,
    confidence: stagedConfidence(input.confidence, evidence.stage),
    provenance: [provenance(evidence)],
    properties: { ...input.properties, aliases: input.aliases, stage: evidence.stage }
  };
}

function relationshipFromEvidence(
  evidence: ProgressiveGraphEvidence,
  source: IntelligenceGraphNode,
  target: IntelligenceGraphNode,
  input: ProgressiveGraphEvidence["relationships"][number]
): IntelligenceRelationship {
  return {
    id: stableId("rel", `${source.id}:${input.type}:${target.id}`),
    sourceRef: source.id,
    targetRef: target.id,
    type: input.type,
    confidence: stagedConfidence(input.confidence, evidence.stage),
    firstSeenAt: evidence.observedAt,
    lastSeenAt: evidence.observedAt,
    provenance: [provenance(evidence)],
    properties: {
      ...input.properties,
      stage: evidence.stage,
      contradicted: input.contradicted === true,
      promoted: evidence.stage === "promoted",
      reviewState: reviewStateForEvidence(evidence.stage, input.contradicted === true),
      evidenceId: evidence.id
    }
  };
}

function addNode(nodes: Map<string, IntelligenceGraphNode>, node: IntelligenceGraphNode): IntelligenceGraphNode {
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
    properties: {
      ...existing.properties,
      ...node.properties,
      stage: highestStage([String(existing.properties?.stage ?? "discovery") as ProgressiveEvidenceStage, String(node.properties?.stage ?? "discovery") as ProgressiveEvidenceStage])
    }
  };
  nodes.set(node.id, merged);
  return merged;
}

function mergeRelationship(
  relationships: Map<string, IntelligenceRelationship>,
  relationship: IntelligenceRelationship,
  stage: ProgressiveEvidenceStage
): void {
  const existing = relationships.get(relationship.id);
  if (!existing) {
    relationships.set(relationship.id, relationship);
    return;
  }
  const provenance = mergeProvenance(existing.provenance, relationship.provenance);
  const contradicted = Boolean(existing.properties?.contradicted || relationship.properties?.contradicted);
  const nextStage = highestStage([String(existing.properties?.stage ?? "discovery") as ProgressiveEvidenceStage, stage]);
  relationships.set(relationship.id, {
    ...existing,
    firstSeenAt: minIso(existing.firstSeenAt, relationship.firstSeenAt),
    lastSeenAt: maxIso(existing.lastSeenAt, relationship.lastSeenAt),
    confidence: aggregateConfidence(existing.confidence, relationship.confidence, provenance.length, contradicted),
    provenance,
    properties: {
      ...existing.properties,
      ...relationship.properties,
      stage: nextStage,
      promoted: nextStage === "promoted",
      contradicted,
      reviewState: reviewStateForEvidence(nextStage, contradicted),
      supportCount: provenance.length
    }
  });
}

function relationshipDeltas(
  previous: RelationshipGraph | undefined,
  current: RelationshipGraph,
  generatedAt: string,
  staleAfterDays: number
): RelationshipDelta[] {
  const previousById = new Map((previous?.relationships ?? []).map((relationship) => [relationship.id, relationship]));
  return current.relationships.map((relationship) => {
    const previousRelationship = previousById.get(relationship.id);
    if (relationship.properties?.contradicted === true) return delta("contradicted", relationship, previousRelationship, "Relationship evidence now includes a contradiction.");
    if (isStale(relationship.lastSeenAt, generatedAt, staleAfterDays)) return delta("stale", relationship, previousRelationship, "Relationship is stale relative to polling threshold.");
    if (!previousRelationship) return delta("added", relationship, undefined, "New graph relationship.");
    if (relationship.properties?.promoted === true && previousRelationship.properties?.promoted !== true) return delta("promoted", relationship, previousRelationship, "Relationship was promoted.");
    if (relationship.confidence + 0.001 < previousRelationship.confidence) return delta("downgraded", relationship, previousRelationship, "Relationship confidence decreased.");
    return delta("updated", relationship, previousRelationship, "Relationship confidence, stage, or provenance changed.");
  });
}

function compareRelationshipDeltas(left: RelationshipDelta, right: RelationshipDelta): number {
  const priorityDelta = DELTA_PRIORITY[right.kind] - DELTA_PRIORITY[left.kind];
  if (priorityDelta !== 0) return priorityDelta;

  const leftReview = reviewReasonsForDelta(left, stageForRelationship(left.relationship)).length > 0 ? 1 : 0;
  const rightReview = reviewReasonsForDelta(right, stageForRelationship(right.relationship)).length > 0 ? 1 : 0;
  if (rightReview !== leftReview) return rightReview - leftReview;

  const stageDelta = stageIndex(stageForRelationship(right.relationship)) - stageIndex(stageForRelationship(left.relationship));
  if (stageDelta !== 0) return stageDelta;

  const confidenceDelta = right.relationship.confidence - left.relationship.confidence;
  if (Math.abs(confidenceDelta) > 0.0001) return confidenceDelta;

  const recencyDelta = Date.parse(right.relationship.lastSeenAt) - Date.parse(left.relationship.lastSeenAt);
  if (recencyDelta !== 0) return recencyDelta;

  return left.relationship.id.localeCompare(right.relationship.id);
}

function reviewReasonsForDelta(delta: RelationshipDelta, stage: ProgressiveEvidenceStage): string[] {
  const reasons: string[] = [];
  if (delta.kind === "contradicted") reasons.push("contradicted evidence");
  if (delta.kind === "downgraded") reasons.push("confidence downgraded");
  if (delta.kind === "stale") reasons.push("stale relationship");
  if (stage === "discovery") reasons.push("discovery-only evidence");
  if (delta.relationship.confidence < 0.5) reasons.push("low confidence");
  return reasons;
}

function reviewStateForEvidence(stage: ProgressiveEvidenceStage, contradicted: boolean): GraphRelationshipReviewState {
  if (contradicted) return "contradicted";
  if (stage === "promoted" || stage === "reviewed") return "accepted";
  if (stage === "discovery") return "needs_review";
  return "unreviewed";
}

function relationshipReviewState(relationship: IntelligenceRelationship): GraphRelationshipReviewState {
  const state = String(relationship.properties?.reviewState ?? "");
  if (REVIEW_STATES.includes(state as GraphRelationshipReviewState)) return state as GraphRelationshipReviewState;
  return reviewStateForEvidence(stageForRelationship(relationship), relationship.properties?.contradicted === true);
}

function reviewStateForDecision(action: GraphReviewDecision["action"]): GraphRelationshipReviewState {
  if (action === "accept" || action === "resolve_contradiction") return "accepted";
  if (action === "reject") return "rejected";
  if (action === "supersede") return "superseded";
  if (action === "mark_contradicted") return "contradicted";
  if (action === "expire") return "expired";
  return "needs_review";
}

function reviewActionAvailability(relationship: IntelligenceRelationship): RelationshipReviewActionAvailability {
  const state = relationshipReviewState(relationship);
  return {
    canAccept: state === "unreviewed" || state === "needs_review" || state === "contradicted",
    canReject: state === "unreviewed" || state === "needs_review" || state === "contradicted",
    canSupersede: state === "accepted" || state === "expired",
    canResolveContradiction: state === "contradicted",
    canExpire: state === "accepted" || state === "unreviewed" || state === "needs_review"
  };
}

function reviewReason(relationship: IntelligenceRelationship): string | undefined {
  const value = relationship.properties?.reviewReason;
  return typeof value === "string" ? value : undefined;
}

function reviewAudit(relationship: IntelligenceRelationship): GraphReviewAuditEntry[] {
  const value = relationship.properties?.reviewAudit;
  return Array.isArray(value) ? value.filter(isGraphReviewAuditEntry) : [];
}

function isGraphReviewAuditEntry(value: unknown): value is GraphReviewAuditEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GraphReviewAuditEntry>;
  return typeof candidate.decisionId === "string"
    && typeof candidate.relationshipId === "string"
    && typeof candidate.reviewerId === "string"
    && typeof candidate.reason === "string"
    && typeof candidate.decidedAt === "string";
}

function sourceIds(relationship: IntelligenceRelationship): string[] {
  return uniqueSorted(relationship.provenance.map((item) => item.sourceId));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function stageForRelationship(relationship: IntelligenceRelationship): ProgressiveEvidenceStage {
  const stage = String(relationship.properties?.stage ?? "discovery");
  return STAGE_ORDER.includes(stage as ProgressiveEvidenceStage) ? stage as ProgressiveEvidenceStage : "discovery";
}

function stageIndex(stage: ProgressiveEvidenceStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function delta(
  kind: RelationshipDelta["kind"],
  relationship: IntelligenceRelationship,
  previous: IntelligenceRelationship | undefined,
  reason: string
): RelationshipDelta {
  return { kind, relationship, previous, reason };
}

function stagedConfidence(confidence: number, stage: ProgressiveEvidenceStage): number {
  return clampScore(confidence * STAGE_WEIGHT[stage]);
}

function aggregateConfidence(left: number, right: number, supportCount: number, contradicted: boolean): number {
  const supportBoost = Math.min(0.2, Math.max(0, supportCount - 1) * 0.04);
  return clampScore(Math.max(left, right) * 0.75 + ((left + right) / 2) * 0.25 + supportBoost - (contradicted ? 0.2 : 0));
}

function provenance(evidence: ProgressiveGraphEvidence): ExtractionProvenance {
  return {
    sourceId: evidence.sourceId,
    captureId: evidence.captureId ?? evidence.id,
    url: evidence.url,
    collectedAt: evidence.observedAt,
    contentHash: evidence.contentHash,
    extractorVersion: evidence.extractorVersion,
    evidenceText: evidence.id,
    ledgerIds: evidence.ledgerIds ?? [stableId("ledger", `${evidence.sourceId}:${evidence.captureId ?? evidence.id}:${evidence.contentHash}`)]
  };
}

function mergeProvenance(left: ExtractionProvenance[], right: ExtractionProvenance[]): ExtractionProvenance[] {
  const seen = new Set<string>();
  return [...left, ...right].filter((item) => {
    const key = `${item.captureId}:${item.url}:${item.contentHash}:${item.evidenceText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function highestStage(stages: ProgressiveEvidenceStage[]): ProgressiveEvidenceStage {
  return stages.sort((left, right) => STAGE_ORDER.indexOf(right) - STAGE_ORDER.indexOf(left))[0] ?? "discovery";
}

function isStale(lastSeenAt: string, generatedAt: string, staleAfterDays: number): boolean {
  return Date.parse(generatedAt) - Date.parse(lastSeenAt) > staleAfterDays * 24 * 60 * 60_000;
}

function minIso(left: string, right: string): string {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function maxIso(left: string, right: string): string {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function stixObjectForNode(node: IntelligenceGraphNode, generatedAt: string): StixObject {
  const type = node.type === "actor"
    ? "intrusion-set"
    : node.type === "malware" || node.type === "tool"
      ? "malware"
      : node.type === "victim" || node.type === "sector" || node.type === "country" || node.type === "region"
        ? "identity"
        : node.type === "attack-pattern"
          ? "attack-pattern"
          : node.type === "vulnerability"
            ? "vulnerability"
            : node.type === "indicator" || node.type === "infrastructure"
              ? "indicator"
              : "x-ti-entity";
  return {
    type,
    spec_version: "2.1",
    id: stixRefForNode(node),
    created: generatedAt,
    modified: generatedAt,
    name: node.value,
    confidence: Math.round(clampScore(node.confidence) * 100),
    labels: [node.type],
    x_ti_provenance: node.provenance,
    x_ti_stage: node.properties?.stage
  };
}

function stixRefForNodeId(graph: RelationshipGraph, nodeId: string): string {
  const node = graph.nodes.find((item) => item.id === nodeId);
  return node ? stixRefForNode(node) : stixId("x-ti-entity", nodeId);
}

function stixRefForNode(node: IntelligenceGraphNode): string {
  if (node.type === "actor") return stixId("intrusion-set", node.value);
  if (node.type === "malware" || node.type === "tool") return stixId("malware", node.value);
  if (node.type === "victim" || node.type === "sector" || node.type === "country" || node.type === "region") return stixId("identity", `${node.type}:${node.value}`);
  if (node.type === "attack-pattern") return stixId("attack-pattern", node.value);
  if (node.type === "vulnerability") return stixId("vulnerability", node.value);
  if (node.type === "indicator" || node.type === "infrastructure") return stixId("indicator", `${node.type}:${node.value}`);
  return stixId("x-ti-entity", `${node.type}:${node.value}`);
}

function stixId(type: string, value: string): string {
  const left = hashHex(`${type}:${value}`);
  const right = hashHex(`${type}:${value}:right`);
  const hex = `${left}${right}`.slice(0, 32);
  return `${type}--${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function hashHex(value: string): string {
  const hashed = Bun.hash(stableId("stix", value));
  const asBigInt = typeof hashed === "bigint" ? hashed : BigInt(Math.trunc(hashed));
  return BigInt.asUintN(64, asBigInt).toString(16).padStart(16, "0");
}
