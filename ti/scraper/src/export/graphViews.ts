import type {
  AttackMatrixCellDto,
  AttackTactic,
  AnalystGraphWorkflowState,
  GraphConfidenceHistoryEntry,
  CorrelationGraphNodeDto,
  CorrelationGraphNeighborhoodDto,
  CorrelationGraphQueryDto,
  CorrelationGraphRelationshipDto,
  CorrelationTimelineDto,
  GraphCutoverPromotionBlockerDto,
  GraphCutoverReportApiDto,
  GraphCutoverReportDto,
  GraphCursorRelationshipDeltaDto,
  GraphCursorRelationshipKind,
  GraphEvidenceSupportRecord,
  GraphExportEnforcementDto,
  GraphExportEnforcementItemDto,
  GraphExportEnforcementState,
  GraphExportCertificationDto,
  GraphExportCertificationScenarioDto,
  GraphExportCertificationScenarioName,
  GraphReleaseCandidateGateDto,
  GraphExportSlaBucket,
  GraphExportSlaDto,
  GraphExportSlaState,
  GraphQueryApiContractDto,
  GraphQueryReadinessFacetDto,
  GraphIntegrityFindingCode,
  GraphIntegrityFindingDto,
  GraphIntegrityReportDto,
  GraphNeighborhoodViewDto,
  GraphNodeViewDto,
  GraphRelationshipReviewState,
  GraphRelationshipViewDto,
  GraphReviewApiExamplesDto,
  GraphReviewApplyAction,
  GraphReviewApplyPlanDto,
  GraphReviewApplyPlanItemDto,
  GraphReviewApplySafety,
  GraphReviewPlanApiDto,
  GraphReviewBatchDto,
  GraphReviewBatchItemDto,
  GraphReviewAuditEntry,
  GraphRuntimeApiDto,
  GraphReviewQueueSummaryDto,
  IncidentTimelineViewDto,
  IntelligenceGraphNode,
  IntelligenceNodeType,
  IntelligenceRelationship,
  PersistedGraphNode,
  PersistedGraphRelationship,
  PersistedGraphSnapshot,
  RelationshipGraph,
  RelationshipDeltaKind,
  SourceProvenancePanelDto,
  StixExportReadinessApiDto,
  StixExportReadinessOptions,
  StixExportReadinessReportDto,
  StixExportPreviewDto,
  TaxiiCollectionDescriptor,
  VictimProfileGraphViewDto,
  ActorProfileGraphViewDto
} from "../types.ts";
import { clampScore, stableId } from "../utils.ts";
import { relationshipStixEligibility } from "./progressiveGraph.ts";
import { STIX_21_GRAPH_MAPPING_CONTRACT } from "./stixContracts.ts";
import { STIX_21_MEDIA_TYPE } from "./taxii.ts";

export interface GraphPersistenceOptions {
  generatedAt: string;
}

export interface GraphNeighborhoodOptions {
  centerNodeId: string;
  depth?: 1 | 2;
  includeReviewStates?: GraphRelationshipReviewState[];
}

export interface StaleRelationshipJobOptions {
  generatedAt: string;
  staleAfterDays: number;
  expireAfterDays?: number;
  reviewerId?: string;
  reason?: string;
}

export interface GraphCursorDeltaOptions {
  generatedAt: string;
  previous?: PersistedGraphSnapshot;
}

export interface GraphCutoverReportOptions extends StixExportReadinessOptions {
  generatedAt?: string;
  actorNodeId?: string;
  victimNodeId?: string;
  maxReviewItems?: number;
}

export interface GraphReviewApplyPlanOptions {
  generatedAt?: string;
  source?: GraphReviewApplyPlanItemDto["source"];
}

export interface CorrelationGraphQueryOptions {
  query: string;
  focusNodeId?: string;
  generatedAt?: string;
  maxRelationships?: number;
}

export function buildPersistedGraphSnapshot(
  graph: RelationshipGraph,
  options: GraphPersistenceOptions
): PersistedGraphSnapshot {
  const evidenceSupport = graph.relationships.flatMap((relationship) => evidenceSupportRecords(relationship));
  const supportIdsByRelationship = new Map<string, string[]>();
  for (const support of evidenceSupport) {
    supportIdsByRelationship.set(support.relationshipId, [...(supportIdsByRelationship.get(support.relationshipId) ?? []), supportId(support)]);
  }

  return {
    nodes: graph.nodes.map((node) => persistedNode(node, graph.relationships)),
    relationships: graph.relationships.map((relationship) => persistedRelationship(relationship, supportIdsByRelationship.get(relationship.id) ?? [], options.generatedAt)),
    evidenceSupport,
    generatedAt: options.generatedAt
  };
}

export function buildGraphNeighborhoodView(
  snapshot: PersistedGraphSnapshot,
  options: GraphNeighborhoodOptions
): GraphNeighborhoodViewDto {
  const depth = options.depth ?? 1;
  const allowedStates = new Set(options.includeReviewStates ?? ["accepted", "unreviewed", "needs_review", "contradicted"]);
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const selectedNodeIds = new Set([options.centerNodeId]);
  const selectedRelationships: PersistedGraphRelationship[] = [];

  for (let hop = 0; hop < depth; hop += 1) {
    const frontier = new Set(selectedNodeIds);
    for (const relationship of snapshot.relationships) {
      if (!allowedStates.has(relationship.reviewState)) continue;
      if (!frontier.has(relationship.sourceRef) && !frontier.has(relationship.targetRef)) continue;
      selectedRelationships.push(relationship);
      selectedNodeIds.add(relationship.sourceRef);
      selectedNodeIds.add(relationship.targetRef);
    }
  }

  const relationships = dedupeRelationships(selectedRelationships)
    .filter((relationship) => nodesById.has(relationship.sourceRef) && nodesById.has(relationship.targetRef))
    .map((relationship) => relationshipView(relationship, nodesById));
  const degree = new Map<string, number>();
  for (const relationship of relationships) {
    degree.set(relationship.sourceRef, (degree.get(relationship.sourceRef) ?? 0) + 1);
    degree.set(relationship.targetRef, (degree.get(relationship.targetRef) ?? 0) + 1);
  }

  return {
    centerNodeId: options.centerNodeId,
    nodes: [...selectedNodeIds]
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is PersistedGraphNode => Boolean(node))
      .map((node) => ({ ...node, degree: degree.get(node.id) ?? 0 }))
      .sort((left, right) => right.degree - left.degree || left.value.localeCompare(right.value)),
    relationships: relationships.sort(compareRelationshipViews),
    generatedAt: snapshot.generatedAt
  };
}

export function buildActorProfileGraphView(
  snapshot: PersistedGraphSnapshot,
  actorNodeId: string
): ActorProfileGraphViewDto {
  const neighborhood = buildGraphNeighborhoodView(snapshot, { centerNodeId: actorNodeId, depth: 2 });
  const actor = neighborhood.nodes.find((node) => node.id === actorNodeId) ?? { ...fallbackNode(actorNodeId), degree: 0 };
  const aliases = neighborhood.relationships
    .filter((relationship) => relationship.type === "alias-of" && (relationship.sourceRef === actorNodeId || relationship.targetRef === actorNodeId))
    .map((relationship) => relationship.sourceRef === actorNodeId ? relationship.target.value : relationship.source.value)
    .sort();

  return {
    actor,
    aliases,
    neighborhood,
    attackMatrix: buildAttackMatrixView(snapshot, actorNodeId),
    provenancePanels: neighborhood.relationships.map((relationship) => buildSourceProvenancePanel(snapshot, relationship.id)),
    generatedAt: snapshot.generatedAt
  };
}

export function buildVictimProfileGraphView(
  snapshot: PersistedGraphSnapshot,
  victimNodeId: string
): VictimProfileGraphViewDto {
  const neighborhood = buildGraphNeighborhoodView(snapshot, { centerNodeId: victimNodeId, depth: 1 });
  const victim = neighborhood.nodes.find((node) => node.id === victimNodeId) ?? { ...fallbackNode(victimNodeId), degree: 0 };
  return {
    victim,
    targetedBy: neighborhood.relationships.filter((relationship) => relationship.type === "targets" && relationship.targetRef === victimNodeId),
    sectors: neighborhood.relationships.filter((relationship) => relationship.type === "related-to"),
    regions: neighborhood.relationships.filter((relationship) => relationship.type === "located-in" || relationship.type === "active-in"),
    provenancePanels: neighborhood.relationships.map((relationship) => buildSourceProvenancePanel(snapshot, relationship.id)),
    generatedAt: snapshot.generatedAt
  };
}

export function buildIncidentTimelineView(snapshot: PersistedGraphSnapshot): IncidentTimelineViewDto {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return {
    events: snapshot.relationships
      .map((relationship) => ({
        relationshipId: relationship.id,
        at: relationship.lastSeenAt,
        label: `${nodesById.get(relationship.sourceRef)?.value ?? relationship.sourceRef} ${relationship.type} ${nodesById.get(relationship.targetRef)?.value ?? relationship.targetRef}`,
        confidence: relationship.confidence,
        reviewState: relationship.reviewState,
        sourceIds: supportFor(snapshot, relationship.id).map((support) => support.sourceId)
      }))
      .sort((left, right) => Date.parse(right.at) - Date.parse(left.at)),
    generatedAt: snapshot.generatedAt
  };
}

export function buildCorrelationGraphQuery(
  snapshot: PersistedGraphSnapshot,
  options: CorrelationGraphQueryOptions
): CorrelationGraphQueryDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const focusNode = options.focusNodeId ? nodesById.get(options.focusNodeId) : findFocusNode(snapshot, options.query);
  const selected = correlationRelationships(snapshot, focusNode?.id, options.maxRelationships ?? 100);
  const selectedNodeIds = new Set(selected.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));
  if (focusNode) selectedNodeIds.add(focusNode.id);
  const readiness = checkStixExportReadiness(snapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const findingsByRelationship = graphFindingsByRelationship(snapshot, generatedAt);
  const degree = relationshipDegree(selected);
  const selectedRelationshipIds = selected.map((relationship) => relationship.id);
  const reviewQueue = buildGraphReviewQueueSummary(snapshot, { generatedAt, relationshipIds: selectedRelationshipIds });
  const selectedReadiness = {
    ...readiness,
    relationships: readiness.relationships.filter((relationship) => selected.some((item) => item.id === relationship.relationshipId)),
    readyCount: readiness.relationships.filter((relationship) => relationship.ready && selected.some((item) => item.id === relationship.relationshipId)).length,
    blockedCount: readiness.relationships.filter((relationship) => !relationship.ready && selected.some((item) => item.id === relationship.relationshipId)).length,
    reviewQueue
  };

  return {
    endpoint: "/v1/graph/query",
    generatedAt,
    query: options.query,
    focusNodeId: focusNode?.id,
    nodes: [...selectedNodeIds]
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is PersistedGraphNode => Boolean(node))
      .map((node) => correlationNode(node, degree.get(node.id) ?? 0))
      .sort((left, right) => right.degree - left.degree || left.value.localeCompare(right.value)),
    relationships: selected.map((relationship) => correlationRelationship(snapshot, relationship, readinessById, findingsByRelationship)),
    neighborhoods: buildCorrelationGraphNeighborhoods(snapshot, selected, readinessById),
    readinessFacets: buildGraphQueryReadinessFacets(snapshot, selected, readinessById, generatedAt),
    attackMatrix: buildAttackMatrixView(snapshot, focusNode?.type === "actor" ? focusNode.id : undefined),
    deltas: buildRelationshipCursorDeltas(snapshot, { generatedAt }).filter((delta) => selected.some((relationship) => relationship.id === delta.relationshipId)),
    exportReadiness: selectedReadiness,
    reviewQueue,
    runtime: buildGraphRuntimeApiDto(snapshot, {
      endpoint: "/v1/graph/query",
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    certification: buildGraphExportCertificationDto(snapshot, {
      endpoint: "/v1/graph/query",
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    provenancePanels: selected.map((relationship) => buildSourceProvenancePanel(snapshot, relationship.id))
  };
}

export function buildCorrelationTimeline(
  snapshot: PersistedGraphSnapshot,
  options: CorrelationGraphQueryOptions
): CorrelationTimelineDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const focusNode = options.focusNodeId ? nodesById.get(options.focusNodeId) : findFocusNode(snapshot, options.query);
  const selected = correlationRelationships(snapshot, focusNode?.id, options.maxRelationships ?? 100);
  const readinessById = new Map(checkStixExportReadiness(snapshot).relationships.map((relationship) => [relationship.relationshipId, relationship]));

  return {
    endpoint: "/v1/graph/timeline",
    generatedAt,
    query: options.query,
    events: selected.map((relationship) => {
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const readiness = readinessById.get(relationship.id);
      const support = supportFor(snapshot, relationship.id);
      return {
        relationshipId: relationship.id,
        at: relationship.lastSeenAt,
        relationshipKind: relationshipKind(relationship, source, target),
        label: `${source.value} ${relationship.type} ${target.value}`,
        sourceLabel: source.value,
        targetLabel: target.value,
        confidence: relationship.confidence,
        reviewState: relationship.reviewState,
        workflowState: analystWorkflowState(relationship),
        sourceIds: uniqueStrings(support.map((item) => item.sourceId)),
        captureIds: uniqueStrings(support.map((item) => item.captureId)),
        contentHashes: uniqueStrings(support.map((item) => item.contentHash)),
        ledgerIds: uniqueStrings(support.flatMap((item) => item.ledgerIds)),
        evidenceIds: relationship.evidenceSupportIds,
        exportReady: readiness?.ready ?? false,
        exportBlockers: readiness?.blockers ?? ["missing_provenance"],
        exportEligibility: relationship.exportEligibility
      };
    }).sort((left, right) => Date.parse(right.at) - Date.parse(left.at) || left.relationshipId.localeCompare(right.relationshipId))
  };
}

export function buildGraphQueryApiContract(endpoint: "/v1/graph/query" | "/v1/graph/timeline"): GraphQueryApiContractDto {
  return {
    endpoint,
    method: "GET",
    mode: "read_only",
    query: [
      { name: "runId", type: "string", required: true },
      { name: "q", type: "string", required: true },
      { name: "focusNodeId", type: "string", required: false }
    ],
    sections: endpoint === "/v1/graph/query"
      ? [
          {
            name: "actor_neighborhood",
            responsePath: "graph.nodes + graph.relationships",
            fields: ["nodeId", "type", "value", "confidence", "degree", "firstSeenAt", "lastSeenAt"]
          },
          {
            name: "victim_neighborhood",
            responsePath: "graph.neighborhoods[name=victim]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "campaign_neighborhood",
            responsePath: "graph.neighborhoods[name=campaign]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "ttp_neighborhood",
            responsePath: "graph.neighborhoods[name=ttp]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "malware_tool_neighborhood",
            responsePath: "graph.neighborhoods[name=malware_tool]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "cve_neighborhood",
            responsePath: "graph.neighborhoods[name=cve]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "infrastructure_neighborhood",
            responsePath: "graph.neighborhoods[name=infrastructure]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "sector_neighborhood",
            responsePath: "graph.neighborhoods[name=sector]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "region_neighborhood",
            responsePath: "graph.neighborhoods[name=region]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "source_neighborhood",
            responsePath: "graph.neighborhoods[name=source]",
            fields: ["nodeIds", "relationshipIds", "maxConfidence", "reviewStates", "freshness", "exportReadyCount", "exportHoldCount"]
          },
          {
            name: "victim_profile",
            responsePath: "graph.relationships[target.type=victim|sector|country]",
            fields: ["relationshipKind", "source", "target", "confidence", "reviewState", "exportReady"]
          },
          {
            name: "attack_matrix",
            responsePath: "graph.attackMatrix",
            fields: ["tactic", "techniques.nodeId", "techniques.name", "techniques.confidence", "techniques.reviewState"]
          },
          {
            name: "relationship_deltas",
            responsePath: "graph.deltas",
            fields: ["relationshipId", "relationshipKind", "delta", "confidenceBefore", "confidenceAfter", "workflowState"]
          },
          {
            name: "export_readiness",
            responsePath: "graph.exportReadiness",
            fields: ["ready", "readyCount", "blockedCount", "relationships.ready", "relationships.blockers"]
          },
          {
            name: "graph_readiness_facets",
            responsePath: "graph.readinessFacets",
            fields: ["name", "ready", "relationshipIds", "nodeIds", "blockerCodes", "warningCodes", "summary"]
          },
          {
            name: "stix_preview",
            responsePath: "graph.relationships[].exportEligibility",
            fields: ["includedByDefault", "accepted", "discoveryOnly", "reason"]
          }
        ]
      : [
          {
            name: "incident_timeline",
            responsePath: "timeline.events",
            fields: ["relationshipId", "at", "label", "confidence", "reviewState", "sourceIds", "captureIds", "contentHashes"]
          },
          {
            name: "export_readiness",
            responsePath: "timeline.events[].exportReady",
            fields: ["exportReady", "exportBlockers", "exportEligibility"]
          }
        ],
    edgeFields: [
      "relationshipId",
      "relationshipKind",
      "type",
      "source",
      "target",
      "confidence",
      "firstSeenAt",
      "lastSeenAt",
      "provenanceIds",
      "sourceIds",
      "captureIds",
      "contentHashes",
      "ledgerIds",
      "evidenceIds",
      "reviewState",
      "workflowState",
      "contradiction",
      "sourceFamilyBias",
      "evidenceGapCodes",
      "answerCaveats",
      "exportReady",
      "exportBlockers",
      "exportEligibility"
    ],
    stixMapping: STIX_21_GRAPH_MAPPING_CONTRACT
  };
}

export function buildAttackMatrixView(snapshot: PersistedGraphSnapshot, actorNodeId?: string): AttackMatrixCellDto[] {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const cells = new Map<AttackTactic, AttackMatrixCellDto>();
  for (const relationship of snapshot.relationships) {
    const target = nodesById.get(relationship.targetRef);
    if (relationship.type !== "uses" || target?.type !== "attack-pattern") continue;
    if (actorNodeId && relationship.sourceRef !== actorNodeId) continue;
    const tactic = attackTactic(target);
    const cell = cells.get(tactic) ?? { tactic, techniques: [] };
    cell.techniques.push({
      nodeId: target.id,
      name: target.value,
      relationshipIds: [relationship.id],
      confidence: relationship.confidence,
      reviewState: relationship.reviewState
    });
    cells.set(tactic, cell);
  }
  return [...cells.values()].sort((left, right) => left.tactic.localeCompare(right.tactic));
}

export function buildSourceProvenancePanel(
  snapshot: PersistedGraphSnapshot,
  relationshipId: string
): SourceProvenancePanelDto {
  const relationship = snapshot.relationships.find((item) => item.id === relationshipId);
  return {
    relationshipId,
    support: supportFor(snapshot, relationshipId),
    reviewAudit: relationship?.reviewAudit ?? []
  };
}

export function analystWorkflowState(relationship: PersistedGraphRelationship): AnalystGraphWorkflowState {
  if (relationship.reviewState === "accepted") return "accepted";
  if (relationship.reviewState === "rejected") return "rejected";
  if (relationship.reviewState === "superseded") return "superseded";
  if (relationship.reviewState === "contradicted") return "contradiction";
  if (relationship.reviewState === "expired") return "stale";
  if (relationship.reviewState === "needs_review") {
    return relationship.confidenceHistory.some((entry) => entry.reason.includes("downgraded")) ? "downgraded" : "needs-human-review";
  }
  return "proposed";
}

export function buildRelationshipCursorDeltas(
  snapshot: PersistedGraphSnapshot,
  options: GraphCursorDeltaOptions
): GraphCursorRelationshipDeltaDto[] {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const previousById = new Map((options.previous?.relationships ?? []).map((relationship) => [relationship.id, relationship]));

  return snapshot.relationships
    .map((relationship) => {
      const previous = previousById.get(relationship.id);
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      return {
        cursor: stableId("graph-cursor", `${options.generatedAt}:${relationship.id}:${relationship.confidence}:${relationship.reviewState}`),
        relationshipId: relationship.id,
        relationshipKind: relationshipKind(relationship, source, target),
        deltaKind: cursorDeltaKind(relationship, previous),
        workflowState: analystWorkflowState(relationship),
        reviewState: relationship.reviewState,
        confidenceBefore: previous?.confidence,
        confidenceAfter: relationship.confidence,
        sourceRef: relationship.sourceRef,
        targetRef: relationship.targetRef,
        sourceLabel: source.value,
        targetLabel: target.value,
        sourceIds: uniqueSorted(supportFor(snapshot, relationship.id).map((support) => support.sourceId)),
        evidenceIds: uniqueSorted(supportFor(snapshot, relationship.id).map((support) => support.evidenceText ?? support.captureId)),
        firstSeenAt: relationship.firstSeenAt,
        lastSeenAt: relationship.lastSeenAt,
        exportEligible: relationship.exportEligibility.includedByDefault,
        changedAt: options.generatedAt
      };
    })
    .filter((delta) => delta.relationshipKind !== "evidence-provenance" || delta.sourceIds.length > 0)
    .sort(compareCursorDeltas);
}

export function buildStixExportPreview(snapshot: PersistedGraphSnapshot): StixExportPreviewDto {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const items = snapshot.relationships.map((relationship) => {
    const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
    const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
    const workflowState = analystWorkflowState(relationship);
    const included = relationship.exportEligibility.includedByDefault;
    return {
      relationshipId: relationship.id,
      relationshipKind: relationshipKind(relationship, source, target),
      sourceLabel: source.value,
      targetLabel: target.value,
      confidence: relationship.confidence,
      workflowState,
      included,
      reason: included
        ? "Accepted or promoted relationship is eligible for default STIX export."
        : `Excluded from default STIX export because workflow state is ${workflowState}.`
    };
  });

  return {
    generatedAt: snapshot.generatedAt,
    includedCount: items.filter((item) => item.included).length,
    excludedCount: items.filter((item) => !item.included).length,
    items
  };
}

export function buildGraphIntegrityReport(snapshot: PersistedGraphSnapshot, generatedAt = snapshot.generatedAt): GraphIntegrityReportDto {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const findings: GraphIntegrityFindingDto[] = [];
  const sourceClusterSizes = sourceClusterSizeByRelationship(snapshot);

  for (const relationship of snapshot.relationships) {
    const source = nodesById.get(relationship.sourceRef);
    const target = nodesById.get(relationship.targetRef);
    const sourceNode = source ?? fallbackNode(relationship.sourceRef);
    const targetNode = target ?? fallbackNode(relationship.targetRef);
    const kind = relationshipKind(relationship, sourceNode, targetNode);
    const support = supportFor(snapshot, relationship.id);

    if (!source || !target) findings.push(finding("orphan_relationship", "critical", relationship, "Relationship references a missing graph node.", "request_evidence", true));
    if (!supportedCursorKind(kind, relationship, sourceNode, targetNode)) {
      findings.push(finding("unsupported_edge", "warning", relationship, "Relationship is not mapped to a supported API cursor edge kind.", "request_evidence", true));
      findings.push(finding("export_schema_risk", "critical", relationship, "Relationship has no safe STIX promotion schema and must stay out of release promotion.", "request_evidence", true));
    }
    if (support.length === 0 || relationship.evidenceSupportIds.length === 0) findings.push(finding("missing_provenance", "critical", relationship, "Relationship has no evidence support records.", "request_evidence", true));
    if (support.length === 0 || support.some((item) => item.ledgerIds.length === 0)) findings.push(finding("missing_ledger_ids", "critical", relationship, "Relationship is missing evidence ledger ids required for public-answer and STIX promotion.", "request_evidence", true));
    if (hasSourceBiasCluster(relationship, support, sourceClusterSizes)) findings.push(finding("source_bias_cluster", "warning", relationship, "Relationship belongs to a single-source bias cluster and needs corroboration before public fact promotion.", "request_evidence", true));
    if (isRestrictedOnlyClaim(support)) findings.push(finding("restricted_only_claim", "warning", relationship, "Relationship is supported only by restricted metadata and needs public or reviewed corroboration before public fact promotion.", "request_evidence", true));
    if (hasUnsupportedRestrictedMetadata(relationship, support)) findings.push(finding("unsupported_restricted_metadata", "critical", relationship, "Restricted metadata relationship is unsupported for public graph export until a safe reviewed mapping exists.", "request_evidence", true));
    if (targetNode.type === "victim" && relationship.reviewState !== "accepted") findings.push(finding("unreviewed_victim_claim", "warning", relationship, "Victim relationship is not analyst-accepted and must stay out of public facts and STIX relationship facts.", "request_evidence", true));
    if (sourceNode.type === "actor" && targetNode.type === "vulnerability" && relationship.type === "exploits" && relationship.reviewState !== "accepted") findings.push(finding("unreviewed_cve_exploitation", "warning", relationship, "CVE exploitation claims require analyst acceptance before public facts or STIX relationship export.", "request_evidence", true));
    if (sourceNode.type === "actor" && targetNode.type === "attack-pattern" && relationship.type === "uses" && relationship.reviewState !== "accepted") findings.push(finding("unreviewed_ttp_mapping", "warning", relationship, "Actor-to-TTP mappings require reviewed evidence before export-ready ATT&CK relationship facts.", "request_evidence", true));
    if (relationship.exportEligibility.discoveryOnly && relationship.confidence < 0.35) findings.push(finding("weak_discovery_only_edge", "warning", relationship, "Discovery-only relationship is too weak for graph promotion.", "reject", true));
    if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true) findings.push(finding("contradicted_edge", "critical", relationship, "Relationship contains contradictory evidence.", "supersede", true));
    if ((relationship.reviewState === "accepted" || relationship.reviewState === "expired") && relationship.properties?.stale === true) findings.push(finding("stale_accepted_edge", "warning", relationship, "Accepted relationship is stale and should be reviewed.", "expire", true));
    if (!relationship.exportEligibility.includedByDefault && relationship.reviewState !== "rejected") findings.push(finding("export_blocking_issue", "warning", relationship, "Relationship is blocked from default STIX export.", "request_review", true));
  }

  return {
    generatedAt,
    findings: findings.sort(compareFindings),
    blockingCount: findings.filter((item) => item.exportBlocked).length,
    warningCount: findings.filter((item) => item.severity === "warning").length
  };
}

export function buildGraphReviewBatch(snapshot: PersistedGraphSnapshot, generatedAt = snapshot.generatedAt): GraphReviewBatchDto {
  const findingsByRelationship = new Map<string, GraphIntegrityFindingDto[]>();
  for (const item of buildGraphIntegrityReport(snapshot, generatedAt).findings) {
    findingsByRelationship.set(item.relationshipId, [...(findingsByRelationship.get(item.relationshipId) ?? []), item]);
  }

  const items: GraphReviewBatchItemDto[] = [];
  for (const relationship of snapshot.relationships) {
    const findings = findingsByRelationship.get(relationship.id) ?? [];
    if (findings.length === 0 && relationship.reviewState === "accepted") continue;
    items.push({
      relationshipId: relationship.id,
      action: reviewBatchAction(relationship, findings),
      priority: reviewBatchPriority(relationship, findings),
      reason: findings[0]?.message ?? "Relationship is proposed and needs analyst review before export.",
      findingCodes: findings.map((item) => item.code),
      sourceIds: uniqueSorted(supportFor(snapshot, relationship.id).map((support) => support.sourceId)),
      evidenceIds: uniqueSorted(supportFor(snapshot, relationship.id).map((support) => support.evidenceText ?? support.captureId)),
      confidence: relationship.confidence,
      workflowState: analystWorkflowState(relationship)
    });
  }

  return {
    generatedAt,
    items: items.sort((left, right) => right.priority - left.priority || left.relationshipId.localeCompare(right.relationshipId))
  };
}

export function buildGraphReviewQueueSummary(
  snapshot: PersistedGraphSnapshot,
  options: { generatedAt?: string; relationshipIds?: string[] } = {}
): GraphReviewQueueSummaryDto {
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const filteredSnapshot = relationshipIdSet
    ? {
        ...snapshot,
        relationships: snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id)),
        evidenceSupport: snapshot.evidenceSupport.filter((support) => relationshipIdSet.has(support.relationshipId))
      }
    : snapshot;
  const batch = buildGraphReviewBatch(filteredSnapshot, options.generatedAt ?? filteredSnapshot.generatedAt);
  const integrity = buildGraphIntegrityReport(filteredSnapshot, options.generatedAt ?? filteredSnapshot.generatedAt);
  const findingsByRelationship = new Map<string, GraphIntegrityFindingDto[]>();
  for (const finding of integrity.findings) {
    findingsByRelationship.set(finding.relationshipId, [...(findingsByRelationship.get(finding.relationshipId) ?? []), finding]);
  }
  const byCode: GraphReviewQueueSummaryDto["byCode"] = countBy<GraphIntegrityFindingCode | "unreviewed">(
    batch.items.flatMap((item) => item.findingCodes.length ? item.findingCodes : ["unreviewed"])
  ) as GraphReviewQueueSummaryDto["byCode"];
  const byWorkflowState: GraphReviewQueueSummaryDto["byWorkflowState"] = countBy(batch.items.map((item) => item.workflowState)).map(({ code, count }) => ({
    workflowState: code as AnalystGraphWorkflowState,
    count
  }));
  const exportHoldCount = batch.items.filter((item) =>
    (findingsByRelationship.get(item.relationshipId) ?? []).some((finding) => finding.exportBlocked)
  ).length;

  return {
    generatedAt: options.generatedAt ?? filteredSnapshot.generatedAt,
    total: batch.items.length,
    exportHoldCount,
    humanReviewCount: batch.items.filter((item) => item.action === "accept" || item.action === "supersede").length,
    automationCandidateCount: batch.items.filter((item) => item.action === "reject" || item.action === "downgrade" || item.action === "mark_stale" || item.action === "request_evidence").length,
    byCode,
    byWorkflowState,
    topRelationshipIds: batch.items.slice(0, 10).map((item) => item.relationshipId),
    publicFactPolicy: exportHoldCount > 0 ? "hold_weak_edges" : "ready"
  };
}

export function checkStixExportReadiness(
  snapshot: PersistedGraphSnapshot,
  options: StixExportReadinessOptions = {}
): StixExportReadinessReportDto {
  const minConfidence = options.minConfidence ?? 0.5;
  const requireAccepted = options.requireAccepted ?? true;
  const exportBlockingFindings = exportBlockingFindingsByRelationship(snapshot);
  const relationships = snapshot.relationships.map((relationship) => {
    const blockers: GraphIntegrityFindingCode[] = [];
    const support = supportFor(snapshot, relationship.id);
    const provenanceComplete = support.length > 0 && support.every((item) => item.sourceId && item.captureId && item.contentHash && item.url);
    if (!provenanceComplete) blockers.push("missing_provenance");
    if (relationship.exportEligibility.discoveryOnly && !options.includeDiscoveryOnly) blockers.push("weak_discovery_only_edge");
    if (relationship.confidence < minConfidence) blockers.push("export_blocking_issue");
    if (requireAccepted && relationship.reviewState !== "accepted") blockers.push("export_blocking_issue");
    if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true) blockers.push("contradicted_edge");
    if (relationship.reviewState === "accepted" && relationship.properties?.stale === true) blockers.push("stale_accepted_edge");
    blockers.push(...(exportBlockingFindings.get(relationship.id) ?? []));
    const uniqueBlockers = uniqueFindingCodes(blockers);
    return {
      relationshipId: relationship.id,
      ready: uniqueBlockers.length === 0,
      blockers: uniqueBlockers,
      confidence: relationship.confidence,
      reviewState: relationship.reviewState,
      discoveryOnly: relationship.exportEligibility.discoveryOnly,
      provenanceComplete
    };
  });

  return {
    generatedAt: snapshot.generatedAt,
    ready: relationships.every((relationship) => relationship.ready),
    readyCount: relationships.filter((relationship) => relationship.ready).length,
    blockedCount: relationships.filter((relationship) => !relationship.ready).length,
    relationships,
    reviewQueue: buildGraphReviewQueueSummary(snapshot)
  };
}

export function buildGraphCutoverReport(
  snapshot: PersistedGraphSnapshot,
  options: GraphCutoverReportOptions = {}
): GraphCutoverReportDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const integrity = buildGraphIntegrityReport(snapshot, generatedAt);
  const exportReadiness = checkStixExportReadiness(snapshot, options);
  const fullReviewBatch = buildGraphReviewBatch(snapshot, generatedAt);
  const maxReviewItems = options.maxReviewItems ?? 50;
  const reviewBatch = {
    ...fullReviewBatch,
    items: fullReviewBatch.items.slice(0, maxReviewItems)
  };
  const stixExportPreview = buildStixExportPreview(snapshot);
  const sections = graphReadinessSections(snapshot, options, exportReadiness, stixExportPreview);
  const counts = {
    relationships: snapshot.relationships.length,
    exportReady: exportReadiness.readyCount,
    reviewQueue: fullReviewBatch.items.length,
    contradicted: snapshot.relationships.filter((relationship) => relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true).length,
    stale: snapshot.relationships.filter((relationship) => relationship.reviewState === "expired" || relationship.properties?.stale === true).length,
    weakDiscoveryOnly: integrity.findings.filter((finding) => finding.code === "weak_discovery_only_edge").length,
    sourceBiasClusters: integrity.findings.filter((finding) => finding.code === "source_bias_cluster").length,
    unsupportedRestrictedMetadata: integrity.findings.filter((finding) => finding.code === "unsupported_restricted_metadata").length,
    provenanceIncomplete: exportReadiness.relationships.filter((relationship) => !relationship.provenanceComplete).length
  };
  const promotionBlockers = graphPromotionBlockers(integrity, exportReadiness, fullReviewBatch, counts);

  return {
    generatedAt,
    ready: promotionBlockers.length === 0 && sections.every((section) => section.ready),
    integrity,
    exportReadiness,
    reviewBatch,
    stixExportPreview,
    sections,
    promotionBlockers,
    counts
  };
}

export function buildGraphReviewApplyPlan(
  snapshot: PersistedGraphSnapshot,
  options: GraphReviewApplyPlanOptions = {}
): GraphReviewApplyPlanDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const batch = buildGraphReviewBatch(snapshot, generatedAt);
  const readinessById = new Map(checkStixExportReadiness(snapshot).relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const relationshipsById = new Map(snapshot.relationships.map((relationship) => [relationship.id, relationship]));
  const items = batch.items.map((item) => {
    const relationship = relationshipsById.get(item.relationshipId)!;
    const readiness = readinessById.get(item.relationshipId);
    const action = applyActionForBatchItem(item, relationship);
    const afterConfidence = confidenceAfterApplyAction(relationship, action);
    const blockedReasonCodes = uniqueExportBlockers([...(readiness?.blockers ?? []), ...item.findingCodes]);
    const safety = applySafety(action, relationship, item, blockedReasonCodes);
    return {
      relationshipId: relationship.id,
      action,
      safety,
      preconditions: applyPreconditions(action, relationship, blockedReasonCodes),
      evidenceIds: item.evidenceIds,
      confidenceImpact: {
        before: relationship.confidence,
        after: afterConfidence,
        reason: confidenceImpactReason(action)
      },
      exportImpact: {
        beforeEligible: relationship.exportEligibility.includedByDefault,
        afterEligible: exportEligibleAfterApply(action, relationship, safety),
        blockedReasonCodes
      },
      auditNotes: applyAuditNotes(action, generatedAt),
      rollbackNotes: applyRollbackNotes(action),
      source: options.source ?? "graph_integrity"
    };
  });

  return {
    generatedAt,
    dryRun: true,
    items,
    automationSafeCount: items.filter((item) => item.safety === "automation_safe").length,
    humanApprovalRequiredCount: items.filter((item) => item.safety === "human_approval_required").length,
    blockedCount: items.filter((item) => item.safety === "blocked").length
  };
}

export function buildGraphReviewPlanApiDto(
  snapshot: PersistedGraphSnapshot,
  options: GraphReviewApplyPlanOptions = {}
): GraphReviewPlanApiDto {
  const plan = buildGraphReviewApplyPlan(snapshot, options);
  return {
    endpoint: "/v1/graph/review-plan",
    generatedAt: plan.generatedAt,
    dryRun: true,
    status: plan.blockedCount > 0 ? "blocked" : plan.items.length > 0 ? "needs_review" : "ready",
    summary: {
      total: plan.items.length,
      automationSafe: plan.automationSafeCount,
      humanApprovalRequired: plan.humanApprovalRequiredCount,
      blocked: plan.blockedCount
    },
    reviewQueue: buildGraphReviewQueueSummary(snapshot, { generatedAt: plan.generatedAt }),
    exportSla: buildGraphExportSlaDto(snapshot, {
      endpoint: "/v1/graph/review-plan",
      generatedAt: plan.generatedAt
    }),
    enforcement: buildGraphExportEnforcementDto(snapshot, {
      endpoint: "/v1/graph/review-plan",
      generatedAt: plan.generatedAt
    }),
    certification: buildGraphExportCertificationDto(snapshot, {
      endpoint: "/v1/graph/review-plan",
      generatedAt: plan.generatedAt
    }),
    actions: plan.items
  };
}

export function buildGraphExportEnforcementDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    endpoint: GraphExportEnforcementDto["endpoint"];
    generatedAt?: string;
    relationshipIds?: string[];
  }
): GraphExportEnforcementDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const scopedSnapshot = relationshipIdSet
    ? {
        ...snapshot,
        relationships: snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id)),
        evidenceSupport: snapshot.evidenceSupport.filter((support) => relationshipIdSet.has(support.relationshipId))
      }
    : snapshot;
  const findings = buildGraphIntegrityReport(scopedSnapshot, generatedAt).findings;
  const findingsByCode = new Map<GraphIntegrityFindingCode, GraphIntegrityFindingDto[]>();
  for (const finding of findings) {
    findingsByCode.set(finding.code, [...(findingsByCode.get(finding.code) ?? []), finding]);
  }
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const items: GraphExportEnforcementItemDto[] = [...findingsByCode.entries()]
    .map(([code, codeFindings]) => {
      const state = enforcementStateForCode(code, codeFindings);
      return {
        code,
        state,
        relationshipIds: uniqueSorted(codeFindings.map((finding) => finding.relationshipId)).slice(0, 25),
        dryRunAction: enforcementActionForCode(code),
        publicAnswerEffect: publicAnswerEffectForCode(code, state),
        stixEffect: stixEffectForCode(code, state),
        message: enforcementMessageForCode(code, codeFindings.length)
      };
    })
    .sort(compareEnforcementItems);
  const schemaSafe = !items.some((item) => item.code === "export_schema_risk" || item.code === "unsupported_edge");
  const ledgerComplete = !items.some((item) => item.code === "missing_ledger_ids");
  const state: GraphExportEnforcementState = items.some((item) => item.state === "rollback")
    ? "rollback"
    : items.some((item) => item.state === "hold")
      ? "hold"
      : items.some((item) => item.state === "warning")
        ? "warning"
        : "pass";

  return {
    endpoint: options.endpoint,
    generatedAt,
    state,
    holdCount: items.filter((item) => item.state === "hold").reduce((sum, item) => sum + item.relationshipIds.length, 0),
    warningCount: items.filter((item) => item.state === "warning").reduce((sum, item) => sum + item.relationshipIds.length, 0),
    rollbackCount: items.filter((item) => item.state === "rollback").reduce((sum, item) => sum + item.relationshipIds.length, 0),
    items,
    answerCaveats: items.filter((item) => item.publicAnswerEffect !== "allow").map((item) => item.code),
    releaseGate: {
      publicAnswers: items.some((item) => item.publicAnswerEffect === "hold" || item.publicAnswerEffect === "remove") ? "hold" : "allow",
      stixPromotion: state === "rollback" ? "rollback" : readiness.blockedCount > 0 ? "hold" : "allow",
      schemaSafe,
      ledgerComplete
    },
    releasePacket: {
      owner: "Agent 08",
      proofCommand: "bun run check:graph-review-mounted",
      status: state === "pass" ? "pass" : state === "warning" ? "warning" : "blocker",
      rollbackPath: "keep graph/STIX relationships out of release promotion until enforcement holds are cleared"
    }
  };
}

export function buildGraphExportCertificationDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    endpoint: GraphExportCertificationDto["endpoint"];
    generatedAt?: string;
    relationshipIds?: string[];
  }
): GraphExportCertificationDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const scopedSnapshot = relationshipIdSet
    ? {
        ...snapshot,
        relationships: snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id)),
        evidenceSupport: snapshot.evidenceSupport.filter((support) => relationshipIdSet.has(support.relationshipId))
      }
    : snapshot;
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const nodesById = new Map(scopedSnapshot.nodes.map((node) => [node.id, node]));
  const scenarioSpecs: Array<{
    name: GraphExportCertificationScenarioName;
    query: string;
    summary: string;
    matches: (relationship: PersistedGraphRelationship, source: PersistedGraphNode, target: PersistedGraphNode, codes: GraphIntegrityFindingCode[]) => boolean;
  }> = [
    { name: "apt29_actor_profile", query: "APT29", summary: "APT29 actor profile relationships are queryable with provenance, caveats, review state, and export eligibility.", matches: (_relationship, source, target) => source.value.includes("APT29") || target.value.includes("APT29") },
    { name: "scattered_spider_actor_profile", query: "Scattered Spider", summary: "Scattered Spider actor profile relationships are certified for actor/TTP/tool/victim graph panels.", matches: (_relationship, source, target) => source.value.includes("Scattered Spider") || target.value.includes("Scattered Spider") },
    { name: "akira_victim_profile", query: "Akira", summary: "Akira ransomware/victim relationships expose restricted-only caveats, victim holds, and export eligibility.", matches: (_relationship, source, target) => source.value.includes("Akira") || target.value.includes("Akira") },
    { name: "turla_actor_profile", query: "Turla", summary: "Turla actor profile fixture slot is present even when no current run evidence matches.", matches: (_relationship, source, target) => source.value.includes("Turla") || target.value.includes("Turla") },
    { name: "cve_exploitation", query: "CVE", summary: "CVE exploitation edges are certified with analyst-review holds and STIX relationship eligibility.", matches: (relationship, source, target) => relationship.type === "exploits" || source.type === "vulnerability" || target.type === "vulnerability" },
    { name: "weak_co_mention", query: "weak co-mention", summary: "Weak discovery-only co-mentions remain caveated and blocked from default STIX promotion.", matches: (_relationship, _source, _target, codes) => codes.includes("weak_discovery_only_edge") },
    { name: "restricted_only_evidence", query: "restricted-only evidence", summary: "Restricted-only evidence is visible as graph context but held from public facts without reviewed corroboration.", matches: (_relationship, _source, _target, codes) => codes.includes("restricted_only_claim") || codes.includes("unsupported_restricted_metadata") },
    { name: "missing_ledger_id", query: "missing ledger ID", summary: "Missing evidence ledger IDs block public-answer and STIX promotion until provenance is repaired.", matches: (_relationship, _source, _target, codes) => codes.includes("missing_ledger_ids") },
    { name: "schema_risk_export", query: "schema-risk export", summary: "Unsupported graph/STIX schema edges are marked as release rollback risks.", matches: (_relationship, _source, _target, codes) => codes.includes("export_schema_risk") || codes.includes("unsupported_edge") },
    { name: "missing_provenance", query: "missing provenance", summary: "Relationships without complete evidence provenance are release rollback risks and cannot certify STIX export.", matches: (_relationship, _source, _target, codes) => codes.includes("missing_provenance") || codes.includes("orphan_relationship") },
    { name: "contradicted_relationship", query: "contradicted relationship", summary: "Contradicted relationships stay visible for review but fail closed for public graph facts and STIX export.", matches: (relationship, _source, _target, codes) => relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true || codes.includes("contradicted_edge") },
    { name: "stale_relationship", query: "stale relationship", summary: "Stale accepted relationships are visible but warned/held for analyst review before promotion.", matches: (relationship, _source, _target, codes) => relationship.properties?.stale === true || codes.includes("stale_accepted_edge") },
    { name: "analyst_reviewed_promotion", query: "analyst-reviewed promotion", summary: "Accepted readiness-passing relationships certify the analyst-reviewed promotion path.", matches: (relationship, _source, _target) => relationship.reviewState === "accepted" && readinessById.get(relationship.id)?.ready === true }
  ];

  const scenarios = scenarioSpecs.map((spec): GraphExportCertificationScenarioDto => {
    const matched = scopedSnapshot.relationships.filter((relationship) => {
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const codes = uniqueFindingCodes([
        ...((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code)),
        ...(readinessById.get(relationship.id)?.blockers ?? [])
      ]);
      return spec.matches(relationship, source, target, codes);
    });
    const codes = uniqueFindingCodes(matched.flatMap((relationship) => [
      ...((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code)),
      ...(readinessById.get(relationship.id)?.blockers ?? [])
    ]));
    const relationshipIds = uniqueSorted(matched.map((relationship) => relationship.id));
    const nodeIds = uniqueSorted(matched.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));
    const status = certificationScenarioStatus(matched, codes, readinessById);
    return {
      name: spec.name,
      status,
      query: spec.query,
      relationshipIds: relationshipIds.slice(0, 25),
      nodeIds: nodeIds.slice(0, 25),
      blockerCodes: certificationBlockerCodes(codes),
      caveatCodes: publicAnswerCaveatCodes(codes),
      proofRoutes: ["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/intel/search.graph", "/v1/contracts"],
      summary: spec.summary
    };
  });
  const status: GraphExportCertificationDto["status"] = scenarios.some((scenario) => scenario.status === "rollback")
    ? "rollback"
    : scenarios.some((scenario) => scenario.status === "hold")
      ? "hold"
      : scenarios.some((scenario) => scenario.status === "warning" || scenario.status === "not_applicable")
        ? "warning"
        : "pass";
  const rcGate = buildGraphReleaseCandidateGate(scenarios);

  return {
    endpoint: options.endpoint,
    generatedAt,
    status,
    scenarioCount: scenarios.length,
    passCount: scenarios.filter((scenario) => scenario.status === "pass").length,
    holdCount: scenarios.filter((scenario) => scenario.status === "hold").length,
    rollbackCount: scenarios.filter((scenario) => scenario.status === "rollback").length,
    scenarios,
    rcGate,
    noUnsupportedTaxiiServerClaims: true,
    releasePacket: {
      owner: "Agent 08",
      proofCommands: [
        "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts src/tests/export.test.ts",
        "bun run check:graph-review-mounted",
        "bun run check:route-inventory"
      ],
      status: rcGate.decision === "pass" ? "pass" : status === "warning" ? "warning" : "blocker",
      rollbackPath: rcGate.agent10ReleaseTrain.rollbackPath
    }
  };
}

export function buildGraphExportSlaDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    endpoint: GraphExportSlaDto["endpoint"];
    generatedAt?: string;
    relationshipIds?: string[];
  }
): GraphExportSlaDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const scopedSnapshot = relationshipIdSet
    ? {
        ...snapshot,
        relationships: snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id)),
        evidenceSupport: snapshot.evidenceSupport.filter((support) => relationshipIdSet.has(support.relationshipId))
      }
    : snapshot;
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const reviewQueue = buildGraphReviewQueueSummary(scopedSnapshot, { generatedAt });
  const findings = buildGraphIntegrityReport(scopedSnapshot, generatedAt).findings;
  const relationshipIdsByCode = new Map<GraphIntegrityFindingCode, string[]>();
  for (const finding of findings) {
    relationshipIdsByCode.set(finding.code, uniqueSorted([...(relationshipIdsByCode.get(finding.code) ?? []), finding.relationshipId]));
  }
  const readyIds = readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId);
  const heldIds = readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId);
  const bucketSpecs: Array<{ bucket: GraphExportSlaBucket; ids: string[]; warningOnly?: boolean }> = [
    { bucket: "export_ready", ids: readyIds, warningOnly: true },
    { bucket: "held", ids: heldIds },
    { bucket: "review_required", ids: reviewQueue.topRelationshipIds },
    { bucket: "stale", ids: relationshipIdsByCode.get("stale_accepted_edge") ?? [] },
    { bucket: "contradicted", ids: relationshipIdsByCode.get("contradicted_edge") ?? [] },
    { bucket: "missing_provenance", ids: relationshipIdsByCode.get("missing_provenance") ?? [] },
    { bucket: "restricted_only", ids: relationshipIdsByCode.get("restricted_only_claim") ?? [] },
    { bucket: "weak_co_mention", ids: relationshipIdsByCode.get("weak_discovery_only_edge") ?? [] },
    { bucket: "source_biased", ids: relationshipIdsByCode.get("source_bias_cluster") ?? [] },
    { bucket: "unreviewed_victim", ids: relationshipIdsByCode.get("unreviewed_victim_claim") ?? [] },
    { bucket: "unreviewed_cve", ids: relationshipIdsByCode.get("unreviewed_cve_exploitation") ?? [] },
    { bucket: "unreviewed_ttp", ids: relationshipIdsByCode.get("unreviewed_ttp_mapping") ?? [] }
  ];
  const buckets = bucketSpecs.map(({ bucket, ids, warningOnly }) => ({
    bucket,
    count: ids.length,
    relationshipIds: uniqueSorted(ids).slice(0, 25),
    state: bucketState(bucket, ids.length, warningOnly)
  }));
  const criticalHold = findings.some((finding) => finding.severity === "critical" && finding.exportBlocked);
  const state: GraphExportSlaState = criticalHold
    ? "rollback"
    : readiness.blockedCount > 0 || reviewQueue.exportHoldCount > 0
      ? "hold"
      : reviewQueue.total > 0
        ? "warning"
        : "pass";

  return {
    endpoint: options.endpoint,
    generatedAt,
    state,
    relationshipCount: scopedSnapshot.relationships.length,
    readyCount: readiness.readyCount,
    heldCount: readiness.blockedCount,
    reviewRequiredCount: reviewQueue.total,
    buckets,
    publicAnswerImpact: state === "pass" || state === "warning" ? "allow_graph_facts" : "hold_graph_facts",
    stixImpact: readiness.readyCount > 0 && readiness.blockedCount === 0
      ? "publish_ready_relationships"
      : readiness.readyCount > 0
        ? "hold_blocked_relationships"
        : "block_export",
    releasePacket: {
      owner: "Agent 08",
      proofCommand: "bun run check:graph-review-mounted",
      status: state === "pass" ? "pass" : state === "warning" ? "warning" : "blocker",
      rollbackPath: "keep graph/STIX facts out of public promotion until export SLA is pass or reviewed warning"
    }
  };

  function bucketState(bucket: GraphExportSlaBucket, count: number, warningOnly?: boolean): GraphExportSlaState {
    if (count === 0) return "pass";
    if (bucket === "export_ready" || warningOnly) return "pass";
    if (bucket === "contradicted" || bucket === "missing_provenance") return "rollback";
    return "hold";
  }
}

export function buildGraphRuntimeApiDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    endpoint: GraphRuntimeApiDto["endpoint"];
    generatedAt?: string;
    relationshipIds?: string[];
    maxRelationships?: number;
  }
): GraphRuntimeApiDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const readiness = checkStixExportReadiness(snapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const reviewQueue = buildGraphReviewQueueSummary(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const runtimeRelationships = relationships
    .map((relationship) => {
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const support = supportFor(snapshot, relationship.id);
      const relationshipReadiness = readinessById.get(relationship.id);
      return {
        relationshipId: relationship.id,
        relationshipKind: relationshipKind(relationship, source, target),
        confidence: relationship.confidence,
        ledgerIds: uniqueSorted(support.flatMap((item) => item.ledgerIds)),
        reviewState: relationship.reviewState,
        freshness: relationshipFreshness(relationship),
        exportReady: relationshipReadiness?.ready ?? false,
        exportHolds: relationshipReadiness?.blockers ?? ["missing_provenance"]
      };
    })
    .sort((left, right) => Number(right.exportReady) - Number(left.exportReady) || right.confidence - left.confidence || left.relationshipId.localeCompare(right.relationshipId))
    .slice(0, options.maxRelationships ?? 50);

  return {
    endpoint: options.endpoint,
    generatedAt,
    relationshipCount: relationships.length,
    readyCount: runtimeRelationships.filter((relationship) => relationship.exportReady).length,
    blockedCount: runtimeRelationships.filter((relationship) => !relationship.exportReady).length,
    publicFactPolicy: reviewQueue.publicFactPolicy,
    exportSla: buildGraphExportSlaDto(snapshot, {
      endpoint: options.endpoint,
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    enforcement: buildGraphExportEnforcementDto(snapshot, {
      endpoint: options.endpoint,
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    certification: buildGraphExportCertificationDto(snapshot, {
      endpoint: options.endpoint,
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    relationships: runtimeRelationships,
    reviewQueue
  };
}

export function buildGraphCutoverReportApiDto(
  snapshot: PersistedGraphSnapshot,
  options: GraphCutoverReportOptions = {}
): GraphCutoverReportApiDto {
  const report = buildGraphCutoverReport(snapshot, options);
  return {
    endpoint: "/v1/graph/cutover-report",
    generatedAt: report.generatedAt,
    ready: report.ready,
    sections: report.sections,
    promotionBlockers: report.promotionBlockers,
    counts: report.counts
  };
}

export function buildStixExportReadinessApiDto(
  snapshot: PersistedGraphSnapshot,
  options: StixExportReadinessOptions = {}
): StixExportReadinessApiDto {
  const readiness = checkStixExportReadiness(snapshot, options);
  const reviewPlan = buildGraphReviewApplyPlan(snapshot, {
    generatedAt: readiness.generatedAt,
    source: "api_request"
  });
  return {
    endpoint: "/v1/exports/stix",
    generatedAt: readiness.generatedAt,
    ready: readiness.ready,
    readyCount: readiness.readyCount,
    blockedCount: readiness.blockedCount,
    relationships: readiness.relationships,
    reviewQueue: readiness.reviewQueue,
    reviewActions: reviewPlan.items.slice(0, 25),
    runtime: buildGraphRuntimeApiDto(snapshot, {
      endpoint: "/v1/exports/stix",
      generatedAt: readiness.generatedAt
    }),
    exportSla: buildGraphExportSlaDto(snapshot, {
      endpoint: "/v1/exports/stix",
      generatedAt: readiness.generatedAt
    }),
    enforcement: buildGraphExportEnforcementDto(snapshot, {
      endpoint: "/v1/exports/stix",
      generatedAt: readiness.generatedAt
    }),
    certification: buildGraphExportCertificationDto(snapshot, {
      endpoint: "/v1/exports/stix",
      generatedAt: readiness.generatedAt
    }),
    preview: buildStixExportPreview(snapshot),
    taxiiCollections: buildTaxiiCollectionReadiness(snapshot, readiness)
  };
}

export function buildTaxiiCollectionReadiness(
  snapshot: PersistedGraphSnapshot,
  readiness: StixExportReadinessReportDto = checkStixExportReadiness(snapshot)
): TaxiiCollectionDescriptor[] {
  const state = readiness.ready
    ? "ready"
    : readiness.readyCount > 0
      ? "hold"
      : "rollback";
  return [
    {
      id: "ti-graph-reviewed-stix-21",
      title: "Reviewed TI graph STIX 2.1 objects",
      description: "Future TAXII collection metadata for reviewed graph relationships; this is not a TAXII server implementation.",
      canRead: readiness.readyCount > 0,
      canWrite: false,
      mediaTypes: [STIX_21_MEDIA_TYPE],
      readiness: {
        status: state,
        readyCount: readiness.readyCount,
        blockedCount: readiness.blockedCount,
        nextCursor: stableId("taxii-cursor", `${snapshot.generatedAt}:${readiness.readyCount}:${readiness.blockedCount}`),
        note: "Expose this descriptor to API/TAXII planning only; object pagination remains behind the future TAXII boundary."
      }
    }
  ];
}

export function graphReviewApiExamples(generatedAt = "2026-05-24T00:00:00.000Z"): GraphReviewApiExamplesDto {
  const actionExamples = {
    accept_edge: exampleApplyItem("rel--accepted", "accept_edge", "human_approval_required", [], 0.78, 0.78, true, true),
    reject_edge: exampleApplyItem("rel--rejected", "reject_edge", "automation_safe", ["weak_discovery_only_edge"], 0.24, 0.24, false, false),
    downgrade_edge: exampleApplyItem("rel--downgraded", "downgrade_edge", "automation_safe", ["export_blocking_issue"], 0.68, 0.44, false, false),
    supersede_edge: exampleApplyItem("rel--superseded", "supersede_edge", "human_approval_required", ["contradicted_edge"], 0.7, 0.2, false, false),
    request_evidence: exampleApplyItem("rel--evidence", "request_evidence", "automation_safe", ["missing_provenance"], 0.5, 0.5, false, false),
    mark_stale: exampleApplyItem("rel--stale", "mark_stale", "automation_safe", ["stale_accepted_edge"], 0.82, 0.35, true, false),
    expire_edge: exampleApplyItem("rel--expire", "expire_edge", "automation_safe", ["stale_accepted_edge"], 0.82, 0.2, true, false),
    hold_edge: exampleApplyItem("rel--hold", "hold_edge", "blocked", ["unreviewed_ttp_mapping"], 0.64, 0.64, false, false),
    block_export: exampleApplyItem("rel--blocked", "block_export", "blocked", ["weak_discovery_only_edge", "export_blocking_issue"], 0.3, 0.3, false, false),
    discovery_only_manual_review_required: exampleApplyItem("rel--discovery-manual", "block_export", "blocked", ["weak_discovery_only_edge"], 0.42, 0.42, false, false)
  } satisfies GraphReviewApiExamplesDto["actionExamples"];

  return {
    reviewPlan: {
      endpoint: "/v1/graph/review-plan",
      generatedAt,
      dryRun: true,
      status: "blocked",
      summary: {
        total: Object.keys(actionExamples).length,
        automationSafe: Object.values(actionExamples).filter((item) => item.safety === "automation_safe").length,
        humanApprovalRequired: Object.values(actionExamples).filter((item) => item.safety === "human_approval_required").length,
        blocked: Object.values(actionExamples).filter((item) => item.safety === "blocked").length
      },
      reviewQueue: exampleReviewQueueSummary(generatedAt),
      exportSla: buildGraphExportSlaDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/graph/review-plan",
        generatedAt
      }),
      enforcement: buildGraphExportEnforcementDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/graph/review-plan",
        generatedAt
      }),
      certification: buildGraphExportCertificationDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/graph/review-plan",
        generatedAt
      }),
      actions: Object.values(actionExamples)
    },
    cutoverReport: {
      endpoint: "/v1/graph/cutover-report",
      generatedAt,
      ready: false,
      sections: [],
      promotionBlockers: [{ code: "review_queue_open", severity: "warning", count: 1, message: "Example graph review queue is not empty." }],
      counts: {
        relationships: Object.keys(actionExamples).length,
        exportReady: 1,
        reviewQueue: Object.keys(actionExamples).length,
        contradicted: 1,
        stale: 1,
        weakDiscoveryOnly: 2,
        sourceBiasClusters: 1,
        unsupportedRestrictedMetadata: 1,
        provenanceIncomplete: 1
      }
    },
    stixReadiness: {
      endpoint: "/v1/exports/stix",
      generatedAt,
      ready: false,
      readyCount: 1,
      blockedCount: Object.keys(actionExamples).length - 1,
      relationships: [],
      reviewQueue: exampleReviewQueueSummary(generatedAt),
      reviewActions: Object.values(actionExamples).slice(0, 4),
      runtime: buildGraphRuntimeApiDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/exports/stix",
        generatedAt
      }),
      exportSla: buildGraphExportSlaDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/exports/stix",
        generatedAt
      }),
      enforcement: buildGraphExportEnforcementDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/exports/stix",
        generatedAt
      }),
      certification: buildGraphExportCertificationDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/exports/stix",
        generatedAt
      }),
      preview: { generatedAt, includedCount: 1, excludedCount: Object.keys(actionExamples).length - 1, items: [] },
      taxiiCollections: buildTaxiiCollectionReadiness({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] })
    },
    actionExamples
  };
}

function exampleReviewQueueSummary(generatedAt: string): GraphReviewQueueSummaryDto {
  return {
    generatedAt,
    total: 7,
    exportHoldCount: 6,
    humanReviewCount: 2,
    automationCandidateCount: 5,
    byCode: [
      { code: "weak_discovery_only_edge", count: 2 },
      { code: "missing_provenance", count: 1 },
      { code: "contradicted_edge", count: 1 },
      { code: "stale_accepted_edge", count: 1 },
      { code: "source_bias_cluster", count: 1 },
      { code: "unsupported_restricted_metadata", count: 1 },
      { code: "restricted_only_claim", count: 1 },
      { code: "unreviewed_victim_claim", count: 1 }
    ],
    byWorkflowState: [
      { workflowState: "needs-human-review", count: 3 },
      { workflowState: "accepted", count: 1 },
      { workflowState: "contradiction", count: 1 },
      { workflowState: "stale", count: 1 },
      { workflowState: "rejected", count: 1 }
    ],
    topRelationshipIds: ["rel--discovery-manual", "rel--evidence", "rel--superseded", "rel--stale"],
    publicFactPolicy: "hold_weak_edges"
  };
}

export function downgradeAndExpireStaleRelationships(
  graph: RelationshipGraph,
  options: StaleRelationshipJobOptions
): RelationshipGraph {
  return {
    nodes: graph.nodes,
    relationships: graph.relationships.map((relationship) => {
      const ageDays = ageInDays(relationship.lastSeenAt, options.generatedAt);
      if (ageDays <= options.staleAfterDays) return relationship;
      const expired = ageDays > (options.expireAfterDays ?? options.staleAfterDays * 2);
      const nextState: GraphRelationshipReviewState = expired ? "expired" : "needs_review";
      const nextConfidence = expired ? Math.min(relationship.confidence, 0.2) : clampScore(relationship.confidence * 0.65);
      const audit: GraphReviewAuditEntry[] = expired ? [{
        decisionId: stableId("review", `${relationship.id}:expired:${options.generatedAt}`),
        relationshipId: relationship.id,
        fromState: reviewState(relationship),
        toState: "expired",
        action: "expire",
        reviewerId: options.reviewerId ?? "system",
        reason: options.reason ?? "Relationship expired after stale threshold.",
        decidedAt: options.generatedAt,
        sourceIds: uniqueSorted(relationship.provenance.map((item) => item.sourceId)),
        evidenceIds: uniqueSorted(relationship.provenance.map((item) => item.evidenceText ?? item.captureId))
      }] : [];
      return {
        ...relationship,
        confidence: nextConfidence,
        properties: {
          ...relationship.properties,
          stale: true,
          reviewState: nextState,
          reviewReason: expired ? options.reason ?? "Relationship expired after stale threshold." : "Relationship is stale and requires review.",
          confidenceHistory: [...confidenceHistory(relationship), {
            relationshipId: relationship.id,
            confidence: nextConfidence,
            recordedAt: options.generatedAt,
            reason: expired ? "expired stale relationship" : "downgraded stale relationship"
          }],
          reviewAudit: [...reviewAudit(relationship), ...audit]
        }
      };
    })
  };
}

function persistedNode(node: IntelligenceGraphNode, relationships: IntelligenceRelationship[]): PersistedGraphNode {
  const seenAt = relationships
    .filter((relationship) => relationship.sourceRef === node.id || relationship.targetRef === node.id)
    .flatMap((relationship) => [relationship.firstSeenAt, relationship.lastSeenAt])
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  return {
    id: node.id,
    type: node.type,
    value: node.value,
    confidence: node.confidence,
    firstSeenAt: seenAt[0],
    lastSeenAt: seenAt.at(-1),
    provenanceCount: node.provenance.length,
    properties: node.properties
  };
}

function persistedRelationship(
  relationship: IntelligenceRelationship,
  evidenceSupportIds: string[],
  generatedAt: string
): PersistedGraphRelationship {
  return {
    id: relationship.id,
    sourceRef: relationship.sourceRef,
    targetRef: relationship.targetRef,
    type: relationship.type,
    confidence: relationship.confidence,
    firstSeenAt: relationship.firstSeenAt,
    lastSeenAt: relationship.lastSeenAt,
    reviewState: reviewState(relationship),
    evidenceSupportIds,
    reviewAudit: reviewAudit(relationship),
    confidenceHistory: [...confidenceHistory(relationship), {
      relationshipId: relationship.id,
      confidence: relationship.confidence,
      recordedAt: generatedAt,
      reason: "snapshot"
    }],
    exportEligibility: relationshipStixEligibility(relationship),
    properties: relationship.properties
  };
}

function evidenceSupportRecords(relationship: IntelligenceRelationship): GraphEvidenceSupportRecord[] {
  return relationship.provenance.map((item) => ({
    relationshipId: relationship.id,
    sourceId: item.sourceId,
    captureId: item.captureId,
    ledgerIds: item.ledgerIds ?? [stableId("ledger", `${item.sourceId}:${item.captureId}:${item.contentHash}`)],
    url: item.url,
    collectedAt: item.collectedAt,
    contentHash: item.contentHash,
    extractorVersion: item.extractorVersion,
    evidenceText: item.evidenceText
  }));
}

function relationshipView(
  relationship: PersistedGraphRelationship,
  nodesById: Map<string, PersistedGraphNode>
): GraphRelationshipViewDto {
  const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
  const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
  return {
    ...relationship,
    source: { id: source.id, type: source.type, value: source.value },
    target: { id: target.id, type: target.type, value: target.value },
    workflowState: analystWorkflowState(relationship)
  };
}

function fallbackNode(id: string): PersistedGraphNode {
  return {
    id,
    type: "report",
    value: id,
    confidence: 0,
    provenanceCount: 0
  };
}

function reviewState(relationship: IntelligenceRelationship): GraphRelationshipReviewState {
  const state = relationship.properties?.reviewState;
  return typeof state === "string" && isReviewState(state) ? state : relationship.properties?.contradicted === true ? "contradicted" : "unreviewed";
}

function isReviewState(value: string): value is GraphRelationshipReviewState {
  return ["unreviewed", "needs_review", "accepted", "rejected", "superseded", "contradicted", "expired"].includes(value);
}

function reviewAudit(relationship: IntelligenceRelationship): GraphReviewAuditEntry[] {
  const value = relationship.properties?.reviewAudit;
  return Array.isArray(value) ? value as GraphReviewAuditEntry[] : [];
}

function confidenceHistory(relationship: IntelligenceRelationship): GraphConfidenceHistoryEntry[] {
  const value = relationship.properties?.confidenceHistory;
  return Array.isArray(value) ? value as GraphConfidenceHistoryEntry[] : [];
}

function supportId(support: GraphEvidenceSupportRecord): string {
  return stableId("support", `${support.relationshipId}:${support.captureId}:${support.contentHash}:${support.evidenceText ?? ""}`);
}

function supportFor(snapshot: PersistedGraphSnapshot, relationshipId: string): GraphEvidenceSupportRecord[] {
  return snapshot.evidenceSupport.filter((support) => support.relationshipId === relationshipId);
}

function findFocusNode(snapshot: PersistedGraphSnapshot, query: string): PersistedGraphNode | undefined {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return undefined;
  return snapshot.nodes.find((node) => node.value.toLowerCase() === normalized)
    ?? snapshot.nodes.find((node) => node.value.toLowerCase().includes(normalized))
    ?? snapshot.nodes.find((node) => `${node.type}:${node.value}`.toLowerCase().includes(normalized));
}

function correlationRelationships(
  snapshot: PersistedGraphSnapshot,
  focusNodeId: string | undefined,
  maxRelationships: number
): PersistedGraphRelationship[] {
  const selected = focusNodeId
    ? snapshot.relationships.filter((relationship) => relationship.sourceRef === focusNodeId || relationship.targetRef === focusNodeId)
    : snapshot.relationships;
  return selected
    .sort((left, right) =>
      reviewRank(right.reviewState) - reviewRank(left.reviewState)
      || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
      || right.confidence - left.confidence
      || left.id.localeCompare(right.id)
    )
    .slice(0, maxRelationships);
}

function relationshipDegree(relationships: PersistedGraphRelationship[]): Map<string, number> {
  const degree = new Map<string, number>();
  for (const relationship of relationships) {
    degree.set(relationship.sourceRef, (degree.get(relationship.sourceRef) ?? 0) + 1);
    degree.set(relationship.targetRef, (degree.get(relationship.targetRef) ?? 0) + 1);
  }
  return degree;
}

function correlationNode(node: PersistedGraphNode, degree: number): CorrelationGraphNodeDto {
  return {
    nodeId: node.id,
    type: node.type,
    value: node.value,
    confidence: node.confidence,
    degree,
    firstSeenAt: node.firstSeenAt,
    lastSeenAt: node.lastSeenAt
  };
}

function correlationRelationship(
  snapshot: PersistedGraphSnapshot,
  relationship: PersistedGraphRelationship,
  readinessById: Map<string, StixExportReadinessReportDto["relationships"][number]>,
  findingsByRelationship: Map<string, GraphIntegrityFindingDto[]> = graphFindingsByRelationship(snapshot)
): CorrelationGraphRelationshipDto {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
  const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
  const readiness = readinessById.get(relationship.id);
  const support = supportFor(snapshot, relationship.id);
  const findingCodes = uniqueFindingCodes((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code));
  const exportBlockers = readiness?.blockers ?? ["missing_provenance"];
  return {
    relationshipId: relationship.id,
    relationshipKind: relationshipKind(relationship, source, target),
    type: relationship.type,
    source: { nodeId: source.id, type: source.type, value: source.value },
    target: { nodeId: target.id, type: target.type, value: target.value },
    confidence: relationship.confidence,
    firstSeenAt: relationship.firstSeenAt,
    lastSeenAt: relationship.lastSeenAt,
    provenanceIds: support.map((item) => supportId(item)),
    sourceIds: uniqueStrings(support.map((item) => item.sourceId)),
    captureIds: uniqueStrings(support.map((item) => item.captureId)),
    contentHashes: uniqueStrings(support.map((item) => item.contentHash)),
    ledgerIds: uniqueStrings(support.flatMap((item) => item.ledgerIds)),
    evidenceIds: relationship.evidenceSupportIds,
    reviewState: relationship.reviewState,
    workflowState: analystWorkflowState(relationship),
    contradiction: relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true || findingCodes.includes("contradicted_edge"),
    sourceFamilyBias: findingCodes.includes("source_bias_cluster"),
    evidenceGapCodes: evidenceGapCodes(findingCodes),
    answerCaveats: publicAnswerCaveatCodes(uniqueFindingCodes([...findingCodes, ...exportBlockers])),
    exportReady: readiness?.ready ?? false,
    exportBlockers,
    exportEligibility: relationship.exportEligibility
  };
}

function graphFindingsByRelationship(snapshot: PersistedGraphSnapshot, generatedAt = snapshot.generatedAt): Map<string, GraphIntegrityFindingDto[]> {
  const findingsByRelationship = new Map<string, GraphIntegrityFindingDto[]>();
  for (const finding of buildGraphIntegrityReport(snapshot, generatedAt).findings) {
    findingsByRelationship.set(finding.relationshipId, [...(findingsByRelationship.get(finding.relationshipId) ?? []), finding]);
  }
  return findingsByRelationship;
}

function evidenceGapCodes(codes: GraphIntegrityFindingCode[]): GraphIntegrityFindingCode[] {
  return codes.filter((code) =>
    code === "missing_provenance"
    || code === "missing_ledger_ids"
    || code === "orphan_relationship"
    || code === "unsupported_edge"
    || code === "unsupported_restricted_metadata"
    || code === "export_schema_risk"
  );
}

function publicAnswerCaveatCodes(codes: GraphIntegrityFindingCode[]): GraphIntegrityFindingCode[] {
  return codes.filter((code) =>
    code !== "export_blocking_issue"
    && code !== "unsupported_edge"
  );
}

function certificationBlockerCodes(codes: GraphIntegrityFindingCode[]): GraphIntegrityFindingCode[] {
  return codes.filter((code) =>
    code === "missing_provenance"
    || code === "missing_ledger_ids"
    || code === "export_schema_risk"
    || code === "unsupported_restricted_metadata"
    || code === "contradicted_edge"
    || code === "orphan_relationship"
  );
}

function certificationScenarioStatus(
  relationships: PersistedGraphRelationship[],
  codes: GraphIntegrityFindingCode[],
  readinessById: Map<string, StixExportReadinessReportDto["relationships"][number]>
): GraphExportCertificationScenarioDto["status"] {
  if (relationships.length === 0) return "not_applicable";
  if (codes.some((code) => code === "missing_provenance" || code === "missing_ledger_ids" || code === "export_schema_risk" || code === "contradicted_edge" || code === "orphan_relationship")) return "rollback";
  if (codes.some((code) => code === "unsupported_restricted_metadata" || code === "weak_discovery_only_edge" || code === "restricted_only_claim" || code === "unreviewed_victim_claim" || code === "unreviewed_cve_exploitation" || code === "unreviewed_ttp_mapping")) return "hold";
  if (codes.some((code) => code === "stale_accepted_edge" || code === "source_bias_cluster" || code === "export_blocking_issue" || code === "unsupported_edge")) return "warning";
  return relationships.every((relationship) => readinessById.get(relationship.id)?.ready === true) ? "pass" : "warning";
}

function requiredGraphRcScenarioNames(): GraphExportCertificationScenarioName[] {
  return [
    "apt29_actor_profile",
    "scattered_spider_actor_profile",
    "akira_victim_profile",
    "turla_actor_profile",
    "cve_exploitation",
    "weak_co_mention",
    "restricted_only_evidence",
    "missing_ledger_id",
    "schema_risk_export",
    "missing_provenance",
    "contradicted_relationship",
    "stale_relationship",
    "analyst_reviewed_promotion"
  ];
}

function buildGraphReleaseCandidateGate(scenarios: GraphExportCertificationScenarioDto[]): GraphReleaseCandidateGateDto {
  const requiredScenarios = requiredGraphRcScenarioNames();
  const coveredScenarios = requiredScenarios.filter((name) =>
    scenarios.some((scenario) => scenario.name === name && scenario.status !== "not_applicable")
  );
  const missingScenarios = requiredScenarios.filter((name) => !coveredScenarios.includes(name));
  const rollbackScenarios = scenarios
    .filter((scenario) => scenario.status === "rollback")
    .map((scenario) => scenario.name);
  const holdScenarios = scenarios
    .filter((scenario) => scenario.status === "hold" || scenario.status === "not_applicable")
    .map((scenario) => scenario.name);
  const decision: GraphReleaseCandidateGateDto["decision"] = rollbackScenarios.length > 0
    ? "rollback"
    : holdScenarios.length > 0 || missingScenarios.length > 0
      ? "hold"
      : "pass";
  return {
    gate: "graph_stix_release_candidate",
    decision,
    requiredScenarios,
    coveredScenarios,
    missingScenarios,
    holdScenarios: uniqueScenarioNames(holdScenarios),
    rollbackScenarios: uniqueScenarioNames(rollbackScenarios),
    publicApiImpact: decision === "pass" ? "allow_graph_answers" : "hold_graph_answers",
    stixImpact: decision === "pass" ? "allow_stix_bundle" : decision === "rollback" ? "rollback_stix_bundle" : "hold_stix_bundle",
    taxiiBoundary: "descriptor_only_no_server",
    agent10ReleaseTrain: {
      field: "graphStixReleaseCandidateGate",
      proofRoutes: ["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"],
      proofCommands: [
        "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts src/tests/export.test.ts",
        "bun run check:graph-review-mounted",
        "bun run check:route-inventory",
        "bun run check"
      ],
      rollbackPath: "keep graph/STIX release candidate out of promotion until rollback scenarios, holds, and missing fixtures are cleared"
    }
  };
}

function uniqueScenarioNames(values: GraphExportCertificationScenarioName[]): GraphExportCertificationScenarioName[] {
  return [...new Set(values)].sort() as GraphExportCertificationScenarioName[];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function buildCorrelationGraphNeighborhoods(
  snapshot: PersistedGraphSnapshot,
  relationships: PersistedGraphRelationship[],
  readinessById: Map<string, StixExportReadinessReportDto["relationships"][number]>
): CorrelationGraphNeighborhoodDto[] {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const specs: Array<{ name: CorrelationGraphNeighborhoodDto["name"]; nodeTypes: IntelligenceNodeType[] }> = [
    { name: "actor", nodeTypes: ["actor"] },
    { name: "victim", nodeTypes: ["victim"] },
    { name: "campaign", nodeTypes: ["campaign"] },
    { name: "ttp", nodeTypes: ["attack-pattern"] },
    { name: "malware_tool", nodeTypes: ["malware", "tool"] },
    { name: "cve", nodeTypes: ["vulnerability"] },
    { name: "infrastructure", nodeTypes: ["infrastructure", "indicator"] },
    { name: "sector", nodeTypes: ["sector"] },
    { name: "region", nodeTypes: ["region", "country"] },
    { name: "source", nodeTypes: ["source", "report", "capture"] }
  ];

  return specs.map((spec) => {
    const nodeIds = new Set<string>();
    const relationshipIds = new Set<string>();
    const reviewStates = new Set<GraphRelationshipReviewState>();
    const timestamps: string[] = [];
    let maxConfidence = 0;
    let exportReadyCount = 0;
    let exportHoldCount = 0;

    for (const relationship of relationships) {
      const source = nodesById.get(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef);
      const matched = [source, target].filter((node): node is PersistedGraphNode => node !== undefined && spec.nodeTypes.includes(node.type));
      if (matched.length === 0) continue;
      for (const node of matched) nodeIds.add(node.id);
      relationshipIds.add(relationship.id);
      reviewStates.add(relationship.reviewState);
      maxConfidence = Math.max(maxConfidence, relationship.confidence);
      timestamps.push(relationship.lastSeenAt);
      const ready = readinessById.get(relationship.id)?.ready ?? false;
      if (ready) exportReadyCount += 1;
      else exportHoldCount += 1;
    }

    return {
      name: spec.name,
      nodeTypes: spec.nodeTypes,
      nodeIds: [...nodeIds].sort(),
      relationshipIds: [...relationshipIds].sort(),
      maxConfidence,
      reviewStates: [...reviewStates].sort(),
      freshness: neighborhoodFreshness(timestamps, snapshot.generatedAt),
      exportReadyCount,
      exportHoldCount
    };
  });
}

function buildGraphQueryReadinessFacets(
  snapshot: PersistedGraphSnapshot,
  relationships: PersistedGraphRelationship[],
  readinessById: Map<string, StixExportReadinessReportDto["relationships"][number]>,
  generatedAt: string
): GraphQueryReadinessFacetDto[] {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const findingsByRelationship = graphFindingsByRelationship(snapshot, generatedAt);
  const specs: Array<{
    name: GraphQueryReadinessFacetDto["name"];
    summary: string;
    matches: (relationship: PersistedGraphRelationship, source: PersistedGraphNode, target: PersistedGraphNode, codes: GraphIntegrityFindingCode[]) => boolean;
  }> = [
    {
      name: "actor_profile",
      summary: "Actor profile relationships with confidence, review state, provenance, time bounds, contradiction markers, and export eligibility.",
      matches: (_relationship, source, target) => source.type === "actor" || target.type === "actor"
    },
    {
      name: "victim_profile",
      summary: "Victim, sector, and region relationships that can back victim profile panels and public-answer holds.",
      matches: (_relationship, source, target) => source.type === "victim" || target.type === "victim" || target.type === "sector" || target.type === "country" || target.type === "region"
    },
    {
      name: "campaign_timeline",
      summary: "Campaign and incident timeline relationships ordered by first/last seen bounds.",
      matches: (_relationship, source, target) => source.type === "campaign" || target.type === "campaign" || source.type === "incident" || target.type === "incident"
    },
    {
      name: "attack_matrix",
      summary: "ATT&CK technique relationships suitable for matrix cells only when reviewed and export-safe.",
      matches: (relationship, source, target) => relationship.type === "uses" && (source.type === "attack-pattern" || target.type === "attack-pattern")
    },
    {
      name: "infrastructure_pivots",
      summary: "Indicator and infrastructure pivots with evidence ledgers and export blockers surfaced per edge.",
      matches: (_relationship, source, target) => source.type === "indicator" || target.type === "indicator" || source.type === "infrastructure" || target.type === "infrastructure"
    },
    {
      name: "source_family_bias",
      summary: "Single-family or single-source clusters that need corroboration before graph facts are promoted.",
      matches: (_relationship, _source, _target, codes) => codes.includes("source_bias_cluster")
    },
    {
      name: "evidence_gaps",
      summary: "Relationships missing provenance, ledger IDs, supported schema mappings, or safe restricted-metadata mappings.",
      matches: (_relationship, _source, _target, codes) => evidenceGapCodes(codes).length > 0
    },
    {
      name: "stix_bundle",
      summary: "STIX 2.1 bundle readiness for the selected graph relationships; blocked edges stay out of fact export.",
      matches: () => true
    },
    {
      name: "taxii_collection",
      summary: "TAXII-facing collection metadata only; this is not a TAXII server and full server behavior remains a future API boundary.",
      matches: () => true
    }
  ];

  return specs.map((spec) => {
    const matched = relationships.filter((relationship) => {
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const codes = uniqueFindingCodes([
        ...((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code)),
        ...(readinessById.get(relationship.id)?.blockers ?? [])
      ]);
      return spec.matches(relationship, source, target, codes);
    });
    const matchedCodes = uniqueFindingCodes(matched.flatMap((relationship) => [
      ...((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code)),
      ...(readinessById.get(relationship.id)?.blockers ?? [])
    ]));
    const blockerCodes = matchedCodes.filter((code) =>
      code === "missing_provenance"
      || code === "missing_ledger_ids"
      || code === "export_schema_risk"
      || code === "unsupported_restricted_metadata"
      || code === "contradicted_edge"
      || code === "orphan_relationship"
    );
    const nodeIds = uniqueSorted(matched.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));
    const relationshipIds = uniqueSorted(matched.map((relationship) => relationship.id));
    return {
      name: spec.name,
      ready: relationshipIds.length > 0 && blockerCodes.length === 0 && matched.every((relationship) => readinessById.get(relationship.id)?.ready ?? false),
      relationshipIds,
      nodeIds,
      blockerCodes,
      warningCodes: matchedCodes.filter((code) => !new Set<string>(blockerCodes).has(code)),
      summary: spec.summary
    };
  });
}

function neighborhoodFreshness(timestamps: string[], generatedAt: string): CorrelationGraphNeighborhoodDto["freshness"] {
  if (timestamps.length === 0) return "unknown";
  const staleCutoffMs = Date.parse(generatedAt) - 180 * 24 * 60 * 60 * 1_000;
  const stale = timestamps.filter((timestamp) => Date.parse(timestamp) < staleCutoffMs).length;
  if (stale === 0) return "current";
  if (stale === timestamps.length) return "stale";
  return "mixed";
}

function relationshipFreshness(relationship: PersistedGraphRelationship): GraphRuntimeApiDto["relationships"][number]["freshness"] {
  if (relationship.reviewState === "expired" || relationship.properties?.stale === true) return "stale";
  if (!relationship.lastSeenAt) return "unknown";
  return "current";
}

function dedupeRelationships(relationships: PersistedGraphRelationship[]): PersistedGraphRelationship[] {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    if (seen.has(relationship.id)) return false;
    seen.add(relationship.id);
    return true;
  });
}

function compareRelationshipViews(left: GraphRelationshipViewDto, right: GraphRelationshipViewDto): number {
  const stateDelta = reviewRank(right.reviewState) - reviewRank(left.reviewState);
  if (stateDelta !== 0) return stateDelta;
  return Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt) || right.confidence - left.confidence;
}

function graphReadinessSections(
  snapshot: PersistedGraphSnapshot,
  options: GraphCutoverReportOptions,
  exportReadiness: StixExportReadinessReportDto,
  stixExportPreview: StixExportPreviewDto
): GraphCutoverReportDto["sections"] {
  const actorProfile = options.actorNodeId ? buildActorProfileGraphView(snapshot, options.actorNodeId) : undefined;
  const victimProfile = options.victimNodeId ? buildVictimProfileGraphView(snapshot, options.victimNodeId) : undefined;
  const timeline = buildIncidentTimelineView(snapshot);
  const attackMatrix = buildAttackMatrixView(snapshot, options.actorNodeId);
  const neighborhood = options.actorNodeId || options.victimNodeId
    ? buildGraphNeighborhoodView(snapshot, { centerNodeId: options.actorNodeId ?? options.victimNodeId!, depth: 1 })
    : { relationships: [] };
  const provenancePanels = snapshot.relationships.map((relationship) => buildSourceProvenancePanel(snapshot, relationship.id));
  const commonBlockers: GraphCutoverPromotionBlockerDto["code"][] = exportReadiness.ready ? [] : ["export_blocking_issue"];

  return [
    {
      name: "actor_profile",
      ready: Boolean(actorProfile?.neighborhood.relationships.length),
      itemCount: actorProfile?.neighborhood.relationships.length ?? 0,
      blockerCodes: actorProfile?.neighborhood.relationships.length ? [] : ["no_export_ready_relationships"]
    },
    {
      name: "victim_profile",
      ready: !options.victimNodeId || Boolean(victimProfile?.targetedBy.length || victimProfile?.sectors.length || victimProfile?.regions.length),
      itemCount: (victimProfile?.targetedBy.length ?? 0) + (victimProfile?.sectors.length ?? 0) + (victimProfile?.regions.length ?? 0),
      blockerCodes: !options.victimNodeId || Boolean(victimProfile?.targetedBy.length || victimProfile?.sectors.length || victimProfile?.regions.length) ? [] : ["no_export_ready_relationships"]
    },
    {
      name: "incident_timeline",
      ready: timeline.events.length > 0,
      itemCount: timeline.events.length,
      blockerCodes: timeline.events.length > 0 ? [] : ["no_export_ready_relationships"]
    },
    {
      name: "attack_matrix",
      ready: attackMatrix.length > 0,
      itemCount: attackMatrix.reduce((count, cell) => count + cell.techniques.length, 0),
      blockerCodes: attackMatrix.length > 0 ? [] : ["no_export_ready_relationships"]
    },
    {
      name: "graph_neighborhood",
      ready: neighborhood.relationships.length > 0,
      itemCount: neighborhood.relationships.length,
      blockerCodes: neighborhood.relationships.length > 0 ? [] : ["no_export_ready_relationships"]
    },
    {
      name: "provenance_panel",
      ready: provenancePanels.some((panel) => panel.support.length > 0),
      itemCount: provenancePanels.reduce((count, panel) => count + panel.support.length, 0),
      blockerCodes: provenancePanels.some((panel) => panel.support.length > 0) ? [] : ["provenance_incomplete"]
    },
    {
      name: "stix_export_preview",
      ready: stixExportPreview.includedCount > 0 && exportReadiness.ready,
      itemCount: stixExportPreview.items.length,
      blockerCodes: stixExportPreview.includedCount > 0 && exportReadiness.ready ? [] : commonBlockers
    }
  ];
}

function graphPromotionBlockers(
  integrity: GraphIntegrityReportDto,
  exportReadiness: StixExportReadinessReportDto,
  reviewBatch: GraphReviewBatchDto,
  counts: GraphCutoverReportDto["counts"]
): GraphCutoverPromotionBlockerDto[] {
  const blockers = new Map<GraphCutoverPromotionBlockerDto["code"], GraphCutoverPromotionBlockerDto>();
  for (const finding of integrity.findings.filter((item) => item.exportBlocked)) {
    addPromotionBlocker(blockers, finding.code, finding.severity, finding.message);
  }
  if (reviewBatch.items.length > 0) addPromotionBlocker(blockers, "review_queue_open", "warning", "Graph review queue has unresolved analyst actions.", reviewBatch.items.length);
  if (exportReadiness.readyCount === 0) addPromotionBlocker(blockers, "no_export_ready_relationships", "critical", "No graph relationships are ready for default STIX export.");
  if (counts.provenanceIncomplete > 0) addPromotionBlocker(blockers, "provenance_incomplete", "critical", "One or more relationships have incomplete evidence provenance.", counts.provenanceIncomplete);
  if (counts.contradicted + counts.stale > 0) addPromotionBlocker(blockers, "contradictory_or_stale_edges", "warning", "Contradictory or stale graph relationships require review.", counts.contradicted + counts.stale);
  return [...blockers.values()].sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || right.count - left.count || left.code.localeCompare(right.code));
}

function addPromotionBlocker(
  blockers: Map<GraphCutoverPromotionBlockerDto["code"], GraphCutoverPromotionBlockerDto>,
  code: GraphCutoverPromotionBlockerDto["code"],
  severity: GraphCutoverPromotionBlockerDto["severity"],
  message: string,
  count = 1
): void {
  const existing = blockers.get(code);
  if (!existing) {
    blockers.set(code, { code, severity, count, message });
    return;
  }
  blockers.set(code, {
    ...existing,
    severity: severityRank(severity) > severityRank(existing.severity) ? severity : existing.severity,
    count: existing.count + count
  });
}

function finding(
  code: GraphIntegrityFindingCode,
  severity: GraphIntegrityFindingDto["severity"],
  relationship: PersistedGraphRelationship,
  message: string,
  recommendedAction: GraphIntegrityFindingDto["recommendedAction"],
  exportBlocked: boolean
): GraphIntegrityFindingDto {
  return { code, severity, relationshipId: relationship.id, message, recommendedAction, exportBlocked };
}

function compareFindings(left: GraphIntegrityFindingDto, right: GraphIntegrityFindingDto): number {
  const severityDelta = severityRank(right.severity) - severityRank(left.severity);
  if (severityDelta !== 0) return severityDelta;
  return left.relationshipId.localeCompare(right.relationshipId) || left.code.localeCompare(right.code);
}

function severityRank(severity: GraphIntegrityFindingDto["severity"]): number {
  if (severity === "critical") return 100;
  if (severity === "warning") return 50;
  return 10;
}

function reviewBatchAction(
  relationship: PersistedGraphRelationship,
  findings: GraphIntegrityFindingDto[]
): GraphReviewBatchItemDto["action"] {
  const codes = new Set(findings.map((item) => item.code));
  if (codes.has("contradicted_edge")) return "supersede";
  if (codes.has("stale_accepted_edge")) return "mark_stale";
  if (
    codes.has("unsupported_restricted_metadata")
    || codes.has("restricted_only_claim")
    || codes.has("unreviewed_victim_claim")
    || codes.has("unreviewed_cve_exploitation")
    || codes.has("unreviewed_ttp_mapping")
    || codes.has("missing_ledger_ids")
    || codes.has("export_schema_risk")
    || codes.has("source_bias_cluster")
  ) return "request_evidence";
  if (codes.has("missing_provenance") || codes.has("orphan_relationship")) return "request_evidence";
  if (codes.has("weak_discovery_only_edge") || relationship.confidence < 0.35) return "reject";
  if (codes.has("export_blocking_issue")) return "downgrade";
  if (relationship.reviewState === "unreviewed" && relationship.confidence >= 0.75) return "accept";
  return "request_evidence";
}

function sourceClusterSizeByRelationship(snapshot: PersistedGraphSnapshot): Map<string, number> {
  const relationshipIdsBySource = new Map<string, Set<string>>();
  for (const support of snapshot.evidenceSupport) {
    const ids = relationshipIdsBySource.get(support.sourceId) ?? new Set<string>();
    ids.add(support.relationshipId);
    relationshipIdsBySource.set(support.sourceId, ids);
  }
  const sizes = new Map<string, number>();
  for (const ids of relationshipIdsBySource.values()) {
    for (const id of ids) sizes.set(id, Math.max(sizes.get(id) ?? 0, ids.size));
  }
  return sizes;
}

function hasSourceBiasCluster(
  relationship: PersistedGraphRelationship,
  support: GraphEvidenceSupportRecord[],
  sourceClusterSizes: Map<string, number>
): boolean {
  if (relationship.properties?.sourceBiasCluster === true || relationship.properties?.sourceBias === true) return true;
  const sourceIds = uniqueSorted(support.map((item) => item.sourceId));
  return sourceIds.length === 1
    && (sourceIds[0]?.includes("source_bias") || sourceIds[0]?.includes("single_vendor_bias"))
    && (sourceClusterSizes.get(relationship.id) ?? 0) >= 2
    && relationship.reviewState !== "rejected";
}

function hasUnsupportedRestrictedMetadata(
  relationship: PersistedGraphRelationship,
  support: GraphEvidenceSupportRecord[]
): boolean {
  if (relationship.properties?.unsupportedRestrictedMetadata === true) return true;
  const sourceIds = support.map((item) => item.sourceId);
  const restricted = sourceIds.some((sourceId) => sourceId.includes("restricted_metadata") || sourceId.includes("tor_metadata") || sourceId.includes("i2p_metadata") || sourceId.includes("freenet_metadata"));
  return restricted && (relationship.properties?.metadataOnly === true || relationship.exportEligibility.discoveryOnly) && relationship.reviewState !== "accepted";
}

function isRestrictedOnlyClaim(support: GraphEvidenceSupportRecord[]): boolean {
  if (support.length === 0) return false;
  return support.every((item) =>
    item.sourceId.includes("restricted_metadata")
    || item.sourceId.includes("tor_metadata")
    || item.sourceId.includes("i2p_metadata")
    || item.sourceId.includes("freenet_metadata")
  );
}

function exportBlockingFindingsByRelationship(snapshot: PersistedGraphSnapshot): Map<string, GraphIntegrityFindingCode[]> {
  const byRelationship = new Map<string, GraphIntegrityFindingCode[]>();
  for (const finding of buildGraphIntegrityReport(snapshot).findings) {
    if (!finding.exportBlocked) continue;
    byRelationship.set(finding.relationshipId, [...(byRelationship.get(finding.relationshipId) ?? []), finding.code]);
  }
  return byRelationship;
}

function countBy<T extends string>(values: T[]): Array<{ code: T; count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
}

function reviewBatchPriority(
  relationship: PersistedGraphRelationship,
  findings: GraphIntegrityFindingDto[]
): number {
  const severity = findings.reduce((score, item) => Math.max(score, severityRank(item.severity)), 0);
  const exportBoost = findings.some((item) => item.exportBlocked) ? 20 : 0;
  const confidenceBoost = Math.round(relationship.confidence * 10);
  return severity + exportBoost + confidenceBoost;
}

function applyActionForBatchItem(
  item: GraphReviewBatchItemDto,
  relationship: PersistedGraphRelationship
): GraphReviewApplyAction {
  if (relationship.exportEligibility.discoveryOnly && (item.action === "accept" || relationship.confidence < 0.5)) return "block_export";
  if (item.action === "accept") return "accept_edge";
  if (item.action === "reject") return "reject_edge";
  if (item.action === "downgrade") return "downgrade_edge";
  if (item.action === "supersede") return "supersede_edge";
  if (item.action === "mark_stale") return "mark_stale";
  return "request_evidence";
}

function exampleApplyItem(
  relationshipId: string,
  action: GraphReviewApplyAction,
  safety: GraphReviewApplySafety,
  blockedReasonCodes: GraphCutoverPromotionBlockerDto["code"][],
  beforeConfidence: number,
  afterConfidence: number,
  beforeEligible: boolean,
  afterEligible: boolean
): GraphReviewApplyPlanItemDto {
  return {
    relationshipId,
    action,
    safety,
    preconditions: action === "block_export"
      ? ["discovery-only evidence cannot be auto-promoted to export-ready", ...blockedReasonCodes.map((code) => `resolve blocker: ${code}`)]
      : ["relationship id is stable", "append review audit entry"],
    evidenceIds: [`evidence:${relationshipId}`],
    confidenceImpact: {
      before: beforeConfidence,
      after: afterConfidence,
      reason: confidenceImpactReason(action)
    },
    exportImpact: {
      beforeEligible,
      afterEligible,
      blockedReasonCodes
    },
    auditNotes: applyAuditNotes(action, "2026-05-24T00:00:00.000Z"),
    rollbackNotes: applyRollbackNotes(action),
    source: "graph_integrity"
  };
}

function confidenceAfterApplyAction(
  relationship: PersistedGraphRelationship,
  action: GraphReviewApplyAction
): number {
  if (action === "accept_edge") return Math.max(relationship.confidence, 0.75);
  if (action === "downgrade_edge") return clampScore(relationship.confidence * 0.65);
  if (action === "mark_stale") return Math.min(relationship.confidence, 0.35);
  if (action === "expire_edge") return Math.min(relationship.confidence, 0.2);
  if (action === "supersede_edge") return Math.min(relationship.confidence, 0.2);
  return relationship.confidence;
}

function applySafety(
  action: GraphReviewApplyAction,
  relationship: PersistedGraphRelationship,
  item: GraphReviewBatchItemDto,
  blockedReasonCodes: GraphCutoverPromotionBlockerDto["code"][]
): GraphReviewApplySafety {
  if (action === "block_export" || action === "hold_edge") return "blocked";
  if (action === "request_evidence") return "automation_safe";
  if (action === "reject_edge" && relationship.exportEligibility.discoveryOnly && relationship.confidence < 0.35) return "automation_safe";
  if (action === "mark_stale" && item.findingCodes.includes("stale_accepted_edge")) return "automation_safe";
  if (action === "downgrade_edge") return "automation_safe";
  if (action === "supersede_edge") return "human_approval_required";
  if (action === "accept_edge" && blockedReasonCodes.length === 0 && item.evidenceIds.length > 0 && relationship.confidence >= 0.75 && !relationship.exportEligibility.discoveryOnly) return "human_approval_required";
  return "human_approval_required";
}

function applyPreconditions(
  action: GraphReviewApplyAction,
  relationship: PersistedGraphRelationship,
  blockedReasonCodes: GraphCutoverPromotionBlockerDto["code"][]
): string[] {
  const preconditions = ["relationship id is stable", "append review audit entry"];
  if (action === "accept_edge") preconditions.push("analyst confirms relationship semantics", "evidence provenance is complete", "confidence meets export threshold");
  if (action === "request_evidence") preconditions.push("capture or extraction evidence must be linked before promotion");
  if (action === "supersede_edge") preconditions.push("replacement relationship must be identified before supersession");
  if (action === "expire_edge") preconditions.push("relationship is stale or outside freshness policy");
  if (action === "block_export" || action === "hold_edge") preconditions.push("relationship remains non-exportable until review and evidence gates pass");
  if (relationship.exportEligibility.discoveryOnly) preconditions.push("discovery-only evidence cannot be auto-promoted to export-ready");
  for (const code of blockedReasonCodes) preconditions.push(`resolve blocker: ${code}`);
  return [...new Set(preconditions)];
}

function confidenceImpactReason(action: GraphReviewApplyAction): string {
  if (action === "accept_edge") return "acceptance raises floor for reviewed graph use";
  if (action === "downgrade_edge") return "downgrade reduces operational confidence pending review";
  if (action === "mark_stale") return "stale facts lose authority until refreshed";
  if (action === "expire_edge") return "expired facts are removed from current public/STIX fact authority";
  if (action === "supersede_edge") return "superseded facts are retained for audit but de-emphasized";
  return "dry-run action does not change confidence";
}

function exportEligibleAfterApply(
  action: GraphReviewApplyAction,
  relationship: PersistedGraphRelationship,
  safety: GraphReviewApplySafety
): boolean {
  if (action === "accept_edge" && safety !== "blocked" && !relationship.exportEligibility.discoveryOnly) return true;
  if (action === "reject_edge" || action === "downgrade_edge" || action === "supersede_edge" || action === "mark_stale" || action === "expire_edge" || action === "hold_edge" || action === "block_export") return false;
  return relationship.exportEligibility.includedByDefault;
}

function applyAuditNotes(action: GraphReviewApplyAction, generatedAt: string): string[] {
  return [
    `dry-run generated at ${generatedAt}`,
    `would append graph review audit entry for ${action}`,
    "does not mutate persisted graph state"
  ];
}

function applyRollbackNotes(action: GraphReviewApplyAction): string[] {
  if (action === "accept_edge") return ["rollback by appending supersede or reject review decision", "restore previous export eligibility from audit history"];
  if (action === "reject_edge") return ["rollback by appending request_review or accept review decision with stronger evidence"];
  if (action === "downgrade_edge" || action === "mark_stale" || action === "expire_edge") return ["rollback by appending accept review decision after refreshed evidence"];
  if (action === "block_export" || action === "hold_edge") return ["rollback is not applicable until preconditions pass"];
  return ["rollback by leaving graph unchanged; this dry-run has no persisted effect"];
}

function uniqueExportBlockers(codes: GraphCutoverPromotionBlockerDto["code"][]): GraphCutoverPromotionBlockerDto["code"][] {
  return [...new Set(codes)];
}

function uniqueFindingCodes(codes: GraphIntegrityFindingCode[]): GraphIntegrityFindingCode[] {
  return [...new Set(codes)];
}

function enforcementStateForCode(
  code: GraphIntegrityFindingCode,
  findings: GraphIntegrityFindingDto[]
): GraphExportEnforcementState {
  if (code === "missing_ledger_ids" || code === "missing_provenance" || code === "export_schema_risk" || code === "contradicted_edge" || findings.some((finding) => finding.severity === "critical")) return "rollback";
  if (code === "stale_accepted_edge" || code === "source_bias_cluster") return "warning";
  return "hold";
}

function enforcementActionForCode(code: GraphIntegrityFindingCode): GraphReviewApplyAction {
  if (code === "weak_discovery_only_edge") return "reject_edge";
  if (code === "stale_accepted_edge") return "expire_edge";
  if (code === "contradicted_edge") return "supersede_edge";
  if (code === "export_blocking_issue") return "downgrade_edge";
  if (code === "unreviewed_victim_claim" || code === "unreviewed_cve_exploitation" || code === "unreviewed_ttp_mapping") return "hold_edge";
  return "request_evidence";
}

function publicAnswerEffectForCode(
  code: GraphIntegrityFindingCode,
  state: GraphExportEnforcementState
): GraphExportEnforcementItemDto["publicAnswerEffect"] {
  if (state === "rollback" || code === "contradicted_edge" || code === "missing_provenance" || code === "missing_ledger_ids") return "remove";
  if (state === "hold" || code === "unreviewed_victim_claim" || code === "unreviewed_cve_exploitation" || code === "unreviewed_ttp_mapping") return "hold";
  if (state === "warning") return "caveat";
  return "allow";
}

function stixEffectForCode(
  code: GraphIntegrityFindingCode,
  state: GraphExportEnforcementState
): GraphExportEnforcementItemDto["stixEffect"] {
  if (state === "rollback" || code === "export_schema_risk" || code === "unsupported_edge" || code === "missing_ledger_ids" || code === "missing_provenance") return "exclude";
  if (state === "hold" || state === "warning") return "hold";
  return "allow";
}

function enforcementMessageForCode(code: GraphIntegrityFindingCode, count: number): string {
  const label = `${count} relationship${count === 1 ? "" : "s"}`;
  if (code === "missing_ledger_ids") return `${label} missing evidence ledger ids required for Agent 06/07/10 promotion.`;
  if (code === "export_schema_risk") return `${label} have schema risk and cannot be promoted to STIX.`;
  if (code === "weak_discovery_only_edge") return `${label} are weak co-mentions or discovery-only edges.`;
  if (code === "restricted_only_claim") return `${label} are supported only by restricted metadata.`;
  if (code === "unreviewed_victim_claim") return `${label} contain unreviewed victim claims.`;
  if (code === "unreviewed_cve_exploitation") return `${label} contain unreviewed CVE exploitation claims.`;
  if (code === "unreviewed_ttp_mapping") return `${label} contain unreviewed actor-to-TTP mappings.`;
  return `${label} blocked by ${code}.`;
}

function compareEnforcementItems(left: GraphExportEnforcementItemDto, right: GraphExportEnforcementItemDto): number {
  const stateDelta = enforcementRank(right.state) - enforcementRank(left.state);
  if (stateDelta !== 0) return stateDelta;
  return right.relationshipIds.length - left.relationshipIds.length || left.code.localeCompare(right.code);
}

function enforcementRank(state: GraphExportEnforcementState): number {
  if (state === "rollback") return 3;
  if (state === "hold") return 2;
  if (state === "warning") return 1;
  return 0;
}

function relationshipKind(
  relationship: PersistedGraphRelationship,
  source: PersistedGraphNode,
  target: PersistedGraphNode
): GraphCursorRelationshipKind {
  if (source.type === "actor" && relationship.type === "targets" && target.type === "victim") return "actor-target";
  if (source.type === "actor" && relationship.type === "uses" && target.type === "attack-pattern") return "actor-ttp";
  if (source.type === "actor" && relationship.type === "uses" && target.type === "tool") return "actor-tool";
  if (source.type === "actor" && relationship.type === "uses" && target.type === "malware") return "actor-malware";
  if (source.type === "actor" && relationship.type === "exploits" && target.type === "vulnerability") return "actor-vulnerability";
  if (source.type === "victim" && relationship.type === "related-to" && target.type === "sector") return "victim-sector";
  if (source.type === "victim" && (relationship.type === "located-in" || relationship.type === "active-in") && (target.type === "country" || target.type === "region")) return "victim-country";
  if (source.type === "incident" && (relationship.type === "derived-from" || relationship.type === "mentions") && target.type === "source") return "incident-source";
  if ((source.type === "indicator" || source.type === "infrastructure") && (relationship.type === "indicates" || relationship.type === "communicates-with")) return "indicator-infrastructure";
  return "evidence-provenance";
}

function supportedCursorKind(
  kind: GraphCursorRelationshipKind,
  relationship: PersistedGraphRelationship,
  source: PersistedGraphNode,
  target: PersistedGraphNode
): boolean {
  if (kind !== "evidence-provenance") return true;
  if (relationship.type === "derived-from" && (target.type === "source" || target.type === "capture" || target.type === "report")) return true;
  if (relationship.type === "mentions" && (source.type === "incident" || source.type === "report")) return true;
  if (relationship.type === "observed-in" || relationship.type === "sighted") return true;
  return source.type === "indicator" || target.type === "indicator";
}

function cursorDeltaKind(
  relationship: PersistedGraphRelationship,
  previous: PersistedGraphRelationship | undefined
): RelationshipDeltaKind {
  if (relationship.reviewState === "contradicted") return "contradicted";
  if (!previous) return "added";
  if (relationship.reviewState === "accepted" && previous.reviewState !== "accepted") return "promoted";
  if (relationship.confidence + 0.001 < previous.confidence) return "downgraded";
  if (relationship.reviewState === "expired" || relationship.properties?.stale === true) return "stale";
  return "updated";
}

function compareCursorDeltas(left: GraphCursorRelationshipDeltaDto, right: GraphCursorRelationshipDeltaDto): number {
  const stateDelta = workflowRank(right.workflowState) - workflowRank(left.workflowState);
  if (stateDelta !== 0) return stateDelta;
  const confidenceDelta = right.confidenceAfter - left.confidenceAfter;
  if (Math.abs(confidenceDelta) > 0.0001) return confidenceDelta;
  return Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
}

function workflowRank(state: AnalystGraphWorkflowState): number {
  if (state === "accepted") return 100;
  if (state === "contradiction") return 90;
  if (state === "downgraded") return 80;
  if (state === "needs-human-review") return 70;
  if (state === "proposed") return 50;
  if (state === "stale") return 30;
  if (state === "superseded") return 20;
  return 10;
}

function reviewRank(state: GraphRelationshipReviewState): number {
  if (state === "accepted") return 100;
  if (state === "needs_review") return 70;
  if (state === "unreviewed") return 50;
  if (state === "contradicted") return 40;
  if (state === "expired") return 20;
  return 10;
}

function attackTactic(node: PersistedGraphNode): AttackTactic {
  const tactic = node.properties?.tactic;
  return typeof tactic === "string" && isAttackTactic(tactic) ? tactic : "unknown";
}

function isAttackTactic(value: string): value is AttackTactic {
  return [
    "reconnaissance",
    "resource-development",
    "initial-access",
    "execution",
    "persistence",
    "privilege-escalation",
    "defense-evasion",
    "credential-access",
    "discovery",
    "lateral-movement",
    "collection",
    "command-and-control",
    "exfiltration",
    "impact",
    "unknown"
  ].includes(value);
}

function ageInDays(seenAt: string, generatedAt: string): number {
  return (Date.parse(generatedAt) - Date.parse(seenAt)) / (24 * 60 * 60_000);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
