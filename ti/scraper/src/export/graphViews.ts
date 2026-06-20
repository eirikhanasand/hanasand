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
  GraphDeltaClientContractDto,
  GraphDeltaStreamContractDto,
  GraphDeltaStreamFixtureDto,
  GraphDeltaStreamFixtureName,
  GraphDeltaStreamQueryKind,
  GraphEvidenceSupportRecord,
  GraphAttackCampaignWorkspaceDto,
  GraphAttackCampaignFreshnessSloDto,
  GraphAttackTechniqueTimelineEventDto,
  GraphBackendRepositoryContractDto,
  GraphRepositoryBackendKind,
  GraphRepositoryOperationKind,
  GraphBackendMigrationSchemaDto,
  GraphBackendCutoverRecordKind,
  GraphBackendCutoverRehearsalDto,
  GraphBackendPerformanceSoakDto,
  GraphBackendMigrationCertificationDto,
  GraphBackendMigrationCertificationDataset,
  GraphNeo4jMigrationAdapterBenchmarkDto,
  GraphBackendAdapterCutoverContractDto,
  GraphExportEnforcementDto,
  GraphExportEnforcementItemDto,
  GraphExportEnforcementState,
  GraphExportCertificationDto,
  GraphExportCertificationScenarioDto,
  GraphExportCertificationScenarioName,
  GraphReleaseCandidateGateDto,
  GraphLiveSearchUpdateDto,
  GraphLiveSearchUpdateScenarioDto,
  GraphLiveSearchUpdateScenarioName,
  GraphExportSlaBucket,
  GraphExportSlaDto,
  GraphExportSlaState,
  GraphQueryApiContractDto,
  GraphQueryBudgetDimension,
  GraphQueryCostControlsDto,
  GraphQueryReadinessFacetDto,
  GraphIntegrityFindingCode,
  GraphIntegrityFindingDto,
  GraphIntegrityReportDto,
  GraphInvestigationWorkspaceDto,
  GraphInvestigationWorkspaceReviewAction,
  GraphNeighborhoodViewDto,
  GraphNodeViewDto,
  GraphReviewPersistenceAction,
  GraphReviewPersistenceLedgerDto,
  GraphRelationshipReviewState,
  GraphRelationshipDriftAction,
  GraphRelationshipExplainabilityDto,
  GraphInvestigationNotebookExportDto,
  GraphRelationshipDriftMonitorDto,
  GraphRelationshipDriftSignalKind,
  GraphReviewedExportSubsetGovernanceDto,
  GraphTaxiiDescriptorStixBundleGovernanceDto,
  GraphIncidentClaimWorkspaceDto,
  GraphActorTimelineChangeWorkspaceDto,
  GraphActorProductPacketDto,
  GraphStixTaxiiMarketplaceReadinessDto,
  GraphStixTaxiiMonetizationExportContractsDto,
  GraphProductExportBlocker,
  GraphProductExportTier,
  GraphStixProductObjectType,
  GraphActorComparisonNotebookDto,
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
  IntelligenceRelationshipType,
  PersistedGraphNode,
  PersistedGraphRelationship,
  PersistedGraphSnapshot,
  RelationshipGraph,
  RelationshipDeltaKind,
  SourceProvenancePanelDto,
  StixExportReadinessApiDto,
  StixExportReadinessOptions,
  StixExportReadinessRelationshipDto,
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

  const liveUpdate = buildGraphLiveSearchUpdateDto(snapshot, {
    endpoint: "/v1/graph/query",
    generatedAt,
    relationshipIds: selectedRelationshipIds
  });
  const deltas = buildRelationshipCursorDeltas(snapshot, { generatedAt }).filter((delta) => selected.some((relationship) => relationship.id === delta.relationshipId));

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
    investigationWorkspace: buildGraphInvestigationWorkspaceDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds,
      deltas
    }),
    attackCampaignWorkspace: buildGraphAttackCampaignWorkspaceDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds,
      deltas
    }),
    incidentClaimWorkspace: buildGraphIncidentClaimWorkspaceDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    actorTimelineChanges: buildGraphActorTimelineChangeWorkspaceDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    actorProductPacket: buildGraphActorProductPacketDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    stixTaxiiMarketplaceReadiness: buildGraphStixTaxiiMarketplaceReadinessDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    stixTaxiiMonetizationExportContracts: buildGraphStixTaxiiMonetizationExportContractsDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    actorComparisonNotebook: buildGraphActorComparisonNotebookDto(snapshot, {
      query: options.query,
      focusNodeId: focusNode?.id,
      generatedAt,
      relationshipIds: selectedRelationshipIds
    }),
    neighborhoods: buildCorrelationGraphNeighborhoods(snapshot, selected, readinessById),
    readinessFacets: buildGraphQueryReadinessFacets(snapshot, selected, readinessById, generatedAt),
    attackMatrix: buildAttackMatrixView(snapshot, focusNode?.type === "actor" ? focusNode.id : undefined),
    deltas,
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
    liveUpdate,
    provenancePanels: selected.map((relationship) => buildSourceProvenancePanel(snapshot, relationship.id))
  };
}

export function buildGraphInvestigationWorkspaceDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
    deltas?: GraphCursorRelationshipDeltaDto[];
  }
): GraphInvestigationWorkspaceDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const readiness = checkStixExportReadiness(snapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const findingsByRelationship = graphFindingsByRelationship(snapshot, generatedAt);
  const relationshipIdsByNode = new Map<string, Set<string>>();
  for (const relationship of relationships) {
    relationshipIdsByNode.set(relationship.sourceRef, (relationshipIdsByNode.get(relationship.sourceRef) ?? new Set()).add(relationship.id));
    relationshipIdsByNode.set(relationship.targetRef, (relationshipIdsByNode.get(relationship.targetRef) ?? new Set()).add(relationship.id));
  }

  const nodes = [...new Set(relationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]))]
    .map((nodeId) => nodesById.get(nodeId) ?? fallbackNode(nodeId))
    .map((node) => {
      const nodeRelationshipIds = [...(relationshipIdsByNode.get(node.id) ?? new Set<string>())].sort();
      const nodeRelationships = relationships.filter((relationship) => nodeRelationshipIds.includes(relationship.id));
      const support = nodeRelationships.flatMap((relationship) => supportFor(snapshot, relationship.id));
      return {
        nodeId: node.id,
        type: node.type,
        value: node.value,
        confidence: node.confidence,
        relationshipIds: nodeRelationshipIds,
        evidenceIds: uniqueSorted(nodeRelationships.flatMap((relationship) => relationship.evidenceSupportIds)),
        ledgerIds: uniqueSorted(support.flatMap((item) => item.ledgerIds)),
        reviewStates: uniqueReviewStates(nodeRelationships.map((relationship) => relationship.reviewState)),
        exportReadyRelationshipCount: nodeRelationships.filter((relationship) => readinessById.get(relationship.id)?.ready ?? false).length,
        heldRelationshipCount: nodeRelationships.filter((relationship) => !(readinessById.get(relationship.id)?.ready ?? false)).length
      };
    })
    .sort((left, right) => right.relationshipIds.length - left.relationshipIds.length || left.value.localeCompare(right.value));

  const ledger = relationships
    .map((relationship) => relationshipConfidenceLedgerEntry(snapshot, relationship, readinessById, findingsByRelationship, nodesById, generatedAt))
    .sort((left, right) => Number(right.reviewBlocked) - Number(left.reviewBlocked) || right.confidence - left.confidence || left.relationshipId.localeCompare(right.relationshipId));
  const reviewPersistence = buildGraphReviewPersistenceLedgerDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const exportGovernance = buildReviewedExportSubsetGovernanceDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const taxiiStixGovernance = buildTaxiiDescriptorStixBundleGovernanceDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    exportGovernance
  });
  const costControls = buildGraphQueryCostControlsDto(snapshot, {
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    relationshipIds: relationships.map((relationship) => relationship.id),
    workspaceKind: "investigation"
  });
  const driftMonitor = buildGraphRelationshipDriftMonitorDto(snapshot, {
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    relationshipIds: relationships.map((relationship) => relationship.id),
    workspaceKind: "investigation",
    costControls,
    deltas: options.deltas
  });
  const relationshipExplanations = buildGraphRelationshipExplainabilityDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    driftMonitor,
    exportGovernance
  });
  const notebookExport = buildGraphInvestigationNotebookExportDto({
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    nodes,
    relationships,
    relationshipExplanations,
    driftMonitor,
    exportGovernance,
    costControls,
    pivotRecommendations: []
  });
  const backendMigrationCertification = buildGraphBackendMigrationCertificationDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    costControls,
    driftMonitor,
    exportGovernance,
    notebookExport
  });
  const releaseCandidate = buildGraphExportCertificationDto(snapshot, {
    endpoint: "/v1/graph/query",
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  }).rcGate;
  const incidentClaims = buildGraphIncidentClaimWorkspaceDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const actorTimelineChanges = buildGraphActorTimelineChangeWorkspaceDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const actorProductPacket = buildGraphActorProductPacketDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    incidentClaims,
    actorTimelineChanges
  });
  const stixTaxiiMarketplaceReadiness = buildGraphStixTaxiiMarketplaceReadinessDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    actorProductPacket
  });
  const stixTaxiiMonetizationExportContracts = buildGraphStixTaxiiMonetizationExportContractsDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    actorProductPacket,
    marketplaceReadiness: stixTaxiiMarketplaceReadiness
  });
  const actorComparisonNotebook = buildGraphActorComparisonNotebookDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });

  const nodeGroups = buildInvestigationNodeGroups(nodes, ledger);

  return {
    endpoint: "/v1/graph/query",
    mode: "read_only_investigation_workspace",
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    nodeGroups,
    nodes,
    relationshipConfidenceLedger: ledger,
    reviewPersistence,
    exportGovernance,
    taxiiStixGovernance,
    releaseCandidate,
    costControls,
    driftMonitor,
    relationshipExplanations,
    notebookExport,
    backendMigrationCertification,
    incidentClaims,
    actorTimelineChanges,
    actorProductPacket,
    stixTaxiiMarketplaceReadiness,
    stixTaxiiMonetizationExportContracts,
    actorComparisonNotebook,
    reviewActions: buildInvestigationReviewActions(ledger),
    workflowContracts: buildInvestigationWorkflowContracts(options.query, options.focusNodeId, nodes, ledger),
    deltaPolling: {
      cursorField: "graph.deltas[].cursor",
      nextPollSeconds: 3,
      relationshipDeltaCount: options.deltas?.length ?? buildRelationshipCursorDeltas(snapshot, { generatedAt }).filter((delta) => relationships.some((relationship) => relationship.id === delta.relationshipId)).length
    },
    safety: {
      restrictedMaterialPolicy: "metadata_only_review_hold",
      rawRestrictedMaterialIncluded: false,
      taxiiBoundary: "descriptor_only_no_server"
    }
  };
}

export function buildGraphAttackCampaignWorkspaceDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
    deltas?: GraphCursorRelationshipDeltaDto[];
  }
): GraphAttackCampaignWorkspaceDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const graphNodeTypes = new Set<IntelligenceNodeType>(["actor", "campaign", "attack-pattern", "malware", "tool", "victim", "infrastructure", "vulnerability"]);
  const isGraphNodeType = (
    type: IntelligenceNodeType
  ): type is GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number]["type"] => graphNodeTypes.has(type);
  const attackIdForNode = (node: PersistedGraphNode): string | undefined => {
    const explicit = node.properties?.attackId ?? node.properties?.externalId ?? node.properties?.mitreAttackId;
    if (typeof explicit === "string" && /^T\d{4}(?:\.\d{3})?$/.test(explicit)) return explicit;
    return node.value.match(/\bT\d{4}(?:\.\d{3})?\b/)?.[0];
  };
  const campaignIdsFor = (techniqueRelationship: PersistedGraphRelationship): string[] => {
    const linkedNodeIds = new Set([techniqueRelationship.sourceRef, techniqueRelationship.targetRef]);
    return uniqueSorted(relationships
      .filter((relationship) => relationship.id !== techniqueRelationship.id)
      .flatMap((relationship) => {
        const source = nodesById.get(relationship.sourceRef);
        const target = nodesById.get(relationship.targetRef);
        if (!source || !target) return [];
        if (source.type === "campaign" && (linkedNodeIds.has(relationship.targetRef) || relationship.targetRef === techniqueRelationship.targetRef)) return [source.id];
        if (target.type === "campaign" && (linkedNodeIds.has(relationship.sourceRef) || relationship.sourceRef === techniqueRelationship.targetRef)) return [target.id];
        return [];
      }));
  };
  const confidenceTrendFor = (relationship: PersistedGraphRelationship): GraphAttackTechniqueTimelineEventDto["confidenceTrend"] => {
    if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true) return "contradicted";
    if (relationship.reviewState === "expired" || relationship.properties?.stale === true || ageInDays(relationship.lastSeenAt, generatedAt) > 180) return "stale";
    const first = relationship.confidenceHistory[0]?.confidence;
    const last = relationship.confidenceHistory.at(-1)?.confidence ?? relationship.confidence;
    if (first === undefined || relationship.confidenceHistory.length <= 1) return "new";
    if (last - first >= 0.08) return "rising";
    if (first - last >= 0.08) return "falling";
    return "stable";
  };
  const readiness = checkStixExportReadiness(snapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const findingsByRelationship = graphFindingsByRelationship(snapshot, generatedAt);
  const supportByRelationship = new Map(relationships.map((relationship) => [relationship.id, supportFor(snapshot, relationship.id)]));

  const techniqueTimeline = relationships
    .filter((relationship) => relationship.type === "uses")
    .flatMap((relationship): GraphAttackTechniqueTimelineEventDto[] => {
      const source = nodesById.get(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef);
      if (source?.type !== "actor" || target?.type !== "attack-pattern") return [];
      const support = supportByRelationship.get(relationship.id) ?? [];
      const findings = uniqueFindingCodes((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code));
      const exportBlockers = readinessById.get(relationship.id)?.blockers ?? ["missing_provenance"];
      const attackId = attackIdForNode(target);
      const event: GraphAttackTechniqueTimelineEventDto = {
        techniqueNodeId: target.id,
        techniqueName: target.value,
        tactic: attackTactic(target),
        relationshipIds: [relationship.id],
        campaignIds: campaignIdsFor(relationship),
        firstSeenAt: relationship.firstSeenAt,
        lastSeenAt: relationship.lastSeenAt,
        confidence: relationship.confidence,
        confidenceTrend: confidenceTrendFor(relationship),
        reviewState: relationship.reviewState,
        workflowState: analystWorkflowState(relationship),
        sourceIds: uniqueSorted(support.map((item) => item.sourceId)),
        evidenceIds: uniqueSorted(relationship.evidenceSupportIds),
        ledgerIds: uniqueSorted(support.flatMap((item) => item.ledgerIds)),
        exportEligible: readinessById.get(relationship.id)?.ready ?? false,
        exportBlockers: uniqueFindingCodes([...findings, ...exportBlockers])
      };
      if (attackId) event.attackId = attackId;
      return [event];
    })
    .sort((left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt) || right.confidence - left.confidence || left.techniqueName.localeCompare(right.techniqueName));

  const campaignRelationshipIds = new Set(relationships
    .filter((relationship) => {
      const source = nodesById.get(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef);
      return Boolean(source && target && (isGraphNodeType(source.type) || isGraphNodeType(target.type)) && (
        source.type === "campaign" ||
        target.type === "campaign" ||
        source.type === "actor" ||
        target.type === "actor" ||
        source.type === "attack-pattern" ||
        target.type === "attack-pattern"
      ));
    })
    .map((relationship) => relationship.id));
  const timelineRelationshipIds = new Set(techniqueTimeline.flatMap((event) => event.relationshipIds));
  const campaignRelationships = relationships.filter((relationship) => campaignRelationshipIds.has(relationship.id) || timelineRelationshipIds.has(relationship.id));
  const graphNodeIds = uniqueSorted(campaignRelationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));
  const graphNodes = graphNodeIds
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is PersistedGraphNode & { type: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number]["type"] } => node !== undefined && isGraphNodeType(node.type))
    .map((node) => {
      const nodeRelationships = campaignRelationships.filter((relationship) => relationship.sourceRef === node.id || relationship.targetRef === node.id);
      return {
        nodeId: node.id,
        type: node.type,
        value: node.value,
        confidence: node.confidence,
        relationshipIds: uniqueSorted(nodeRelationships.map((relationship) => relationship.id)),
        reviewStates: uniqueReviewStates(nodeRelationships.map((relationship) => relationship.reviewState)),
        exportReadyRelationshipCount: nodeRelationships.filter((relationship) => readinessById.get(relationship.id)?.ready ?? false).length,
        heldRelationshipCount: nodeRelationships.filter((relationship) => !(readinessById.get(relationship.id)?.ready ?? false)).length
      };
    })
    .sort((left, right) => right.relationshipIds.length - left.relationshipIds.length || left.value.localeCompare(right.value));
  const graphEdges = campaignRelationships
    .map((relationship) => {
      const source = nodesById.get(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef);
      if (!source || !target || !isGraphNodeType(source.type) || !isGraphNodeType(target.type)) return undefined;
      const support = supportByRelationship.get(relationship.id) ?? [];
      const findings = uniqueFindingCodes((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code));
      const exportBlockers = readinessById.get(relationship.id)?.blockers ?? ["missing_provenance"];
      return {
        relationshipId: relationship.id,
        type: relationship.type,
        sourceRef: relationship.sourceRef,
        targetRef: relationship.targetRef,
        confidence: relationship.confidence,
        reviewState: relationship.reviewState,
        workflowState: analystWorkflowState(relationship),
        sourceIds: uniqueSorted(support.map((item) => item.sourceId)),
        ledgerIds: uniqueSorted(support.flatMap((item) => item.ledgerIds)),
        exportEligible: readinessById.get(relationship.id)?.ready ?? false,
        exportBlockers: uniqueFindingCodes([...findings, ...exportBlockers])
      };
    })
    .filter((edge): edge is GraphAttackCampaignWorkspaceDto["campaignGraph"]["edges"][number] => Boolean(edge))
    .sort((left, right) => Number(right.exportEligible) - Number(left.exportEligible) || right.confidence - left.confidence || left.relationshipId.localeCompare(right.relationshipId));
  const reviewHolds = graphEdges
    .filter((edge) => !edge.exportEligible || edge.reviewState !== "accepted")
    .map((edge) => {
      const relationship = campaignRelationships.find((item) => item.id === edge.relationshipId)!;
      const support = supportByRelationship.get(edge.relationshipId) ?? [];
      const provenanceComplete = support.length > 0 && support.every((item) => item.captureId && item.contentHash && item.ledgerIds.length > 0);
      return {
        relationshipId: edge.relationshipId,
        reasonCodes: edge.exportBlockers,
        allowedActions: investigationAllowedActions(relationship, edge.exportEligible, edge.exportBlockers, provenanceComplete)
      };
    });
  const maxNodes = 50;
  const maxEdges = 75;
  const maxTimelineEvents = 50;
  const maxReviewHolds = 50;
  const boundedGraphNodes = graphNodes.slice(0, maxNodes);
  const boundedGraphEdges = graphEdges.slice(0, maxEdges);
  const boundedTechniqueTimeline = techniqueTimeline.slice(0, maxTimelineEvents);
  const boundedReviewHolds = reviewHolds.slice(0, maxReviewHolds);
  const truncated = graphNodes.length > maxNodes
    || graphEdges.length > maxEdges
    || techniqueTimeline.length > maxTimelineEvents
    || reviewHolds.length > maxReviewHolds;
  const pivotQueues = buildGraphPivotQueues(boundedGraphNodes, boundedGraphEdges);
  const searchPivotRecommendations = buildGraphSearchPivotRecommendations(boundedGraphNodes, boundedGraphEdges, pivotQueues);
  const reviewBoard = buildGraphCampaignTimelineReviewBoard({
    generatedAt,
    timeline: boundedTechniqueTimeline,
    nodes: boundedGraphNodes,
    edges: boundedGraphEdges,
    reviewHolds: boundedReviewHolds
  });
  const freshnessSlo = buildGraphAttackCampaignFreshnessSloDto({
    generatedAt,
    reviewBoard,
    timeline: boundedTechniqueTimeline,
    nodes: boundedGraphNodes
  });
  const latestCursor = options.deltas?.find((delta) => boundedGraphEdges.some((edge) => edge.relationshipId === delta.relationshipId))?.cursor;
  const costControls = buildGraphQueryCostControlsDto(snapshot, {
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    relationshipIds: boundedGraphEdges.map((edge) => edge.relationshipId),
    workspaceKind: "campaign_timeline",
    deltas: options.deltas
  });
  const driftMonitor = buildGraphRelationshipDriftMonitorDto(snapshot, {
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    relationshipIds: boundedGraphEdges.map((edge) => edge.relationshipId),
    workspaceKind: "campaign_timeline",
    costControls,
    deltas: options.deltas
  });

  return {
    endpoint: "/v1/graph/query",
    mode: "attack_technique_timeline_campaign_graph",
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    techniqueTimeline: boundedTechniqueTimeline,
    campaignGraph: {
      nodes: boundedGraphNodes,
      edges: boundedGraphEdges,
      campaignNodeIds: uniqueSorted(boundedGraphNodes.filter((node) => node.type === "campaign").map((node) => node.nodeId)),
      actorNodeIds: uniqueSorted(boundedGraphNodes.filter((node) => node.type === "actor").map((node) => node.nodeId)),
      techniqueNodeIds: uniqueSorted(boundedGraphNodes.filter((node) => node.type === "attack-pattern").map((node) => node.nodeId))
    },
    pivotQueues,
    reviewHolds: boundedReviewHolds,
    exportEligibility: {
      readyRelationshipIds: uniqueSorted(boundedGraphEdges.filter((edge) => edge.exportEligible).map((edge) => edge.relationshipId)),
      heldRelationshipIds: uniqueSorted(boundedGraphEdges.filter((edge) => !edge.exportEligible).map((edge) => edge.relationshipId)),
      policy: "reviewed_or_promoted_ttp_campaign_edges_only"
    },
    performanceBudget: {
      maxNodes,
      maxEdges,
      maxTimelineEvents,
      maxReviewHolds,
      nodeCount: boundedGraphNodes.length,
      edgeCount: boundedGraphEdges.length,
      timelineEventCount: boundedTechniqueTimeline.length,
      reviewHoldCount: boundedReviewHolds.length,
      truncated,
      ...(truncated && latestCursor ? { nextPageCursor: latestCursor } : {}),
      queryPlan: "bounded_single_hop_campaign_ttp_pivots"
    },
    searchPivotRecommendations,
    reviewBoard,
    freshnessSlo,
    costControls,
    driftMonitor,
    deltaPolling: {
      cursorField: "graph.deltas[].cursor",
      nextPollSeconds: 3,
      relationshipDeltaCount: options.deltas?.filter((delta) => boundedGraphEdges.some((edge) => edge.relationshipId === delta.relationshipId)).length
        ?? buildRelationshipCursorDeltas(snapshot, { generatedAt }).filter((delta) => boundedGraphEdges.some((edge) => edge.relationshipId === delta.relationshipId)).length
    },
    safety: {
      restrictedMaterialPolicy: "metadata_only_review_hold",
      rawRestrictedMaterialIncluded: false,
      taxiiBoundary: "descriptor_only_no_server"
    }
  };
}

export function buildGraphIncidentClaimWorkspaceDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
  }
): GraphIncidentClaimWorkspaceDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const scopedRelationshipIds = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const scopedRelationships = scopedRelationshipIds
    ? snapshot.relationships.filter((relationship) => scopedRelationshipIds.has(relationship.id))
    : snapshot.relationships;
  const touchedIncidentIds = new Set(scopedRelationships.flatMap((relationship) => {
    const source = nodesById.get(relationship.sourceRef);
    const target = nodesById.get(relationship.targetRef);
    return [
      source?.type === "incident" ? source.id : undefined,
      target?.type === "incident" ? target.id : undefined
    ].filter((value): value is string => Boolean(value));
  }));
  const normalizedQuery = options.query.trim().toLowerCase();
  const incidentNodes = snapshot.nodes
    .filter((node) => node.type === "incident")
    .filter((node) =>
      !scopedRelationshipIds
      || touchedIncidentIds.has(node.id)
      || node.id === options.focusNodeId
      || node.value.toLowerCase().includes(normalizedQuery)
    );
  const readiness = checkStixExportReadiness(snapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));

  const clusters: GraphIncidentClaimWorkspaceDto["clusters"] = incidentNodes.map((incident): GraphIncidentClaimWorkspaceDto["clusters"][number] => {
    const clusterRelationships = snapshot.relationships
      .filter((relationship) => relationship.sourceRef === incident.id || relationship.targetRef === incident.id)
      .sort((left, right) => Date.parse(left.firstSeenAt) - Date.parse(right.firstSeenAt) || left.id.localeCompare(right.id));
    const clusterNodeIds = uniqueSorted([incident.id, ...clusterRelationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef])]);
    const clusterNodes = clusterNodeIds.map((nodeId) => nodesById.get(nodeId) ?? fallbackNode(nodeId));
    const support = clusterRelationships.flatMap((relationship) => supportFor(snapshot, relationship.id));
    const contradictedRelationships = clusterRelationships.filter((relationship) =>
      relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true
    );
    const corroboratingSupport = support.filter((item) =>
      !contradictedRelationships.some((relationship) => relationship.id === item.relationshipId)
    );
    const contradictingSupport = support.filter((item) =>
      contradictedRelationships.some((relationship) => relationship.id === item.relationshipId)
      || /contradict|dispute|rebut|counter/i.test(item.sourceId)
    );
    const sourceFamilies = uniqueSorted(support.map((item) => sourceFamilyForClaimSupport(item.sourceId)));
    const publisherIds = uniqueSorted([
      ...support.map((item) => item.sourceId),
      ...clusterNodes.filter((node) => node.type === "source" || node.type === "report").map((node) => node.value)
    ]);
    const firstReportedAt = minIsoValues(clusterRelationships.map((relationship) => relationship.firstSeenAt)) ?? incident.firstSeenAt ?? generatedAt;
    const lastReportedAt = maxIsoValues(clusterRelationships.map((relationship) => relationship.lastSeenAt)) ?? incident.lastSeenAt ?? generatedAt;
    const reviewState = incidentClaimReviewState(clusterRelationships);
    const missingProvenance = clusterRelationships.some((relationship) => supportFor(snapshot, relationship.id).length === 0);
    const hasContradiction = contradictedRelationships.length > 0 || contradictingSupport.length > 0;
    const eligibleRelationshipIds = uniqueSorted(clusterRelationships
      .filter((relationship) => readinessById.get(relationship.id)?.ready ?? false)
      .map((relationship) => relationship.id));
    const reportOrSourceRelationshipIds = clusterRelationships
      .filter((relationship) => {
        const source = nodesById.get(relationship.sourceRef);
        const target = nodesById.get(relationship.targetRef);
        return source?.type === "report" || source?.type === "source" || target?.type === "report" || target?.type === "source";
      })
      .map((relationship) => relationship.id);
    const heldRelationshipIds = uniqueSorted([
      ...clusterRelationships
        .filter((relationship) => !(readinessById.get(relationship.id)?.ready ?? false))
        .map((relationship) => relationship.id),
      ...reportOrSourceRelationshipIds
    ]);
    const exportState: GraphIncidentClaimWorkspaceDto["clusters"][number]["exportState"] = hasContradiction
      ? "held_contradicted"
      : missingProvenance
        ? "held_missing_provenance"
        : eligibleRelationshipIds.length === clusterRelationships.length && clusterRelationships.length > 0
          ? "eligible_reviewed_subset"
          : "held_unreviewed_inference";
    const confidence = clusterRelationships.length === 0
      ? incident.confidence
      : clampScore(clusterRelationships.reduce((sum, relationship) => sum + relationship.confidence, 0) / clusterRelationships.length);
    const actorNodeIds = nodeIdsByType(clusterNodes, ["actor"]);
    const victimNodeIds = nodeIdsByType(clusterNodes, ["victim"]);
    const campaignNodeIds = nodeIdsByType(clusterNodes, ["campaign"]);
    const mergeDecision: GraphIncidentClaimWorkspaceDto["clusters"][number]["mergeSemantics"]["decision"] =
      hasContradiction || incident.properties?.splitRequired === true || actorNodeIds.length > 1 && victimNodeIds.length > 1
        ? "split_required"
        : publisherIds.length > 1
          ? "merged_public_reports"
          : "single_report";

    return {
      claimId: stableId("incident-claim", `${incident.id}:${firstReportedAt}:${clusterRelationships.map((relationship) => relationship.id).join("|")}`),
      incidentNodeId: incident.id,
      canonicalValue: incident.value,
      claimType: incidentClaimType(incident, clusterNodes, hasContradiction),
      relationshipIds: uniqueSorted(clusterRelationships.map((relationship) => relationship.id)),
      nodeIds: clusterNodeIds,
      actorNodeIds,
      victimNodeIds,
      campaignNodeIds,
      sectorNodeIds: nodeIdsByType(clusterNodes, ["sector"]),
      countryNodeIds: nodeIdsByType(clusterNodes, ["country"]),
      malwareToolNodeIds: nodeIdsByType(clusterNodes, ["malware", "tool"]),
      ttpNodeIds: nodeIdsByType(clusterNodes, ["attack-pattern"]),
      sourceNodeIds: nodeIdsByType(clusterNodes, ["source"]),
      reportNodeIds: nodeIdsByType(clusterNodes, ["report"]),
      firstReportedAt,
      lastReportedAt,
      publisherCount: publisherIds.length,
      sourceFamilyCount: sourceFamilies.length,
      corroboratingEvidenceIds: uniqueSorted(corroboratingSupport.map((item) => item.evidenceText ?? item.captureId)),
      contradictingEvidenceIds: uniqueSorted(contradictingSupport.map((item) => item.evidenceText ?? item.captureId)),
      ledgerIds: uniqueSorted(support.flatMap((item) => item.ledgerIds)),
      confidence,
      freshness: incidentClaimFreshness(lastReportedAt, generatedAt),
      reviewState,
      exportState,
      mergeSemantics: {
        decision: mergeDecision,
        rules: uniqueClaimMergeRules({
          publisherCount: publisherIds.length,
          sourceFamilyCount: sourceFamilies.length,
          actorNodeIds,
          victimNodeIds,
          campaignNodeIds,
          hasContradiction,
          incident
        }),
        splitRequiredWhen: incidentClaimSplitRules({ hasContradiction, actorNodeIds, victimNodeIds, campaignNodeIds, incident })
      },
      reviewedStixSubset: {
        eligibleRelationshipIds,
        heldRelationshipIds,
        policy: "reviewed_relationships_only_unreviewed_claim_inference_held"
      }
    };
  }).sort((left, right) =>
    Date.parse(right.lastReportedAt) - Date.parse(left.lastReportedAt)
    || right.confidence - left.confidence
    || left.canonicalValue.localeCompare(right.canonicalValue)
  );

  return {
    endpoint: "/v1/graph/query",
    mode: "incident_claim_graph_corroboration",
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    clusters,
    summary: {
      clusterCount: clusters.length,
      eligibleClusterCount: clusters.filter((cluster) => cluster.exportState === "eligible_reviewed_subset").length,
      heldClusterCount: clusters.filter((cluster) => cluster.exportState !== "eligible_reviewed_subset").length,
      contradictedClusterCount: clusters.filter((cluster) => cluster.exportState === "held_contradicted").length,
      publisherCount: uniqueSorted(clusters.flatMap((cluster) => [...cluster.sourceNodeIds, ...cluster.reportNodeIds])).length,
      sourceFamilyCount: Math.max(0, ...clusters.map((cluster) => cluster.sourceFamilyCount))
    },
    handoffs: {
      agent04ConflictResolution: "consume_alias_campaign_victim_contradiction_rows",
      agent06EvidenceLedger: "claim_clusters_require_capture_ledger_and_content_hash_replay",
      agent07QualityGate: "hold_unreviewed_contradicted_or_source_biased_claim_clusters",
      agent09ApiFrontend: "render_incident_claim_clusters_as_partial_or_review_held_graph_context",
      agent10ReleaseGate: "authoritative_stix_requires_reviewed_claim_cluster_subset"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphActorTimelineChangeWorkspaceDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
    maxEvents?: number;
  }
): GraphActorTimelineChangeWorkspaceDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const normalizedQuery = options.query.trim().toLowerCase();
  const focusActor = options.focusNodeId
    ? nodesById.get(options.focusNodeId)
    : snapshot.nodes.find((node) => node.type === "actor" && node.value.toLowerCase().includes(normalizedQuery));
  const readiness = checkStixExportReadiness(snapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const blockersByRelationship = exportBlockingFindingsByRelationship(snapshot);
  const incidentClaims = buildGraphIncidentClaimWorkspaceDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: options.relationshipIds
  });
  const claimIdsByRelationship = new Map<string, string[]>();
  for (const cluster of incidentClaims.clusters) {
    for (const relationshipId of cluster.relationshipIds) {
      claimIdsByRelationship.set(relationshipId, [...(claimIdsByRelationship.get(relationshipId) ?? []), cluster.claimId]);
    }
  }
  const relationships = snapshot.relationships
    .filter((relationship) => !relationshipIdSet || relationshipIdSet.has(relationship.id))
    .filter((relationship) => {
      if (!focusActor || focusActor.type !== "actor") return true;
      if (relationship.sourceRef === focusActor.id || relationship.targetRef === focusActor.id) return true;
      return false;
    });
  const maxEvents = options.maxEvents ?? 80;
  const timelineEvents = relationships
    .map((relationship): GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number] => {
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const eventNodes = [source, target];
      const support = supportFor(snapshot, relationship.id);
      const readinessRow = readinessById.get(relationship.id);
      const exportBlockers = uniqueFindingCodes([...(readinessRow?.blockers ?? []), ...(blockersByRelationship.get(relationship.id) ?? [])]);
      const actorNodeIds = nodeIdsByType(eventNodes, ["actor"]);
      const confidenceTrend = actorTimelineConfidenceTrend(relationship, generatedAt);
      const contradictionState = actorTimelineContradictionState(relationship, exportBlockers);
      const relationshipLedgerIds = Array.isArray(relationship.properties?.ledgerIds)
        ? relationship.properties.ledgerIds.filter((id): id is string => typeof id === "string")
        : [];
      const ledgerIds = uniqueSorted([...support.flatMap((item) => item.ledgerIds), ...relationshipLedgerIds]);
      const publicFactState = actorTimelinePublicFactState({
        relationship,
        readinessReady: readinessRow?.ready ?? false,
        exportBlockers,
        ledgerIds,
        freshness: incidentClaimFreshness(relationship.lastSeenAt, generatedAt),
        contradictionState
      });
      return {
        eventId: stableId("actor-timeline-event", relationship.id),
        relationshipId: relationship.id,
        eventKind: actorTimelineEventKind(relationship, source, target, claimIdsByRelationship.get(relationship.id) ?? []),
        actorNodeIds,
        incidentClaimIds: uniqueSorted(claimIdsByRelationship.get(relationship.id) ?? []),
        campaignNodeIds: nodeIdsByType(eventNodes, ["campaign"]),
        ttpNodeIds: nodeIdsByType(eventNodes, ["attack-pattern"]),
        malwareToolNodeIds: nodeIdsByType(eventNodes, ["malware", "tool"]),
        victimNodeIds: nodeIdsByType(eventNodes, ["victim"]),
        vulnerabilityNodeIds: nodeIdsByType(eventNodes, ["vulnerability"]),
        infrastructureNodeIds: nodeIdsByType(eventNodes, ["infrastructure", "indicator"]),
        sourceNodeIds: nodeIdsByType(eventNodes, ["source", "report"]),
        firstSeenAt: relationship.firstSeenAt,
        lastSeenAt: relationship.lastSeenAt,
        confidence: relationship.confidence,
        confidenceTrend,
        freshness: incidentClaimFreshness(relationship.lastSeenAt, generatedAt),
        reviewState: relationship.reviewState,
        workflowState: analystWorkflowState(relationship),
        contradictionState,
        sourceIds: uniqueSorted(support.map((item) => item.sourceId)),
        sourceFamilies: uniqueSorted(support.map((item) => sourceFamilyForClaimSupport(item.sourceId))),
        evidenceIds: uniqueSorted(support.map((item) => item.evidenceText ?? item.captureId)),
        ledgerIds,
        captureIds: uniqueSorted(support.map((item) => item.captureId)),
        exportEligible: readinessRow?.ready ?? false,
        exportBlockers,
        publicFactState
      };
    })
    .sort((left, right) =>
      Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
      || Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt)
      || right.confidence - left.confidence
      || left.relationshipId.localeCompare(right.relationshipId)
    )
    .slice(0, maxEvents);
  const campaignChanges = timelineEvents
    .map((event): GraphActorTimelineChangeWorkspaceDto["campaignChanges"][number] | undefined => {
      const changeKind = actorTimelineChangeKind(event);
      if (!changeKind) return undefined;
      return {
        changeId: stableId("actor-timeline-change", `${changeKind}:${event.relationshipId}`),
        changeKind,
        relationshipIds: [event.relationshipId],
        actorNodeIds: event.actorNodeIds,
        nodeIds: uniqueSorted([
          ...event.actorNodeIds,
          ...event.campaignNodeIds,
          ...event.ttpNodeIds,
          ...event.malwareToolNodeIds,
          ...event.victimNodeIds,
          ...event.vulnerabilityNodeIds,
          ...event.infrastructureNodeIds,
          ...event.sourceNodeIds
        ]),
        firstSeenAt: event.firstSeenAt,
        lastSeenAt: event.lastSeenAt,
        confidenceTrend: event.confidenceTrend,
        reviewState: event.reviewState,
        contradictionState: event.contradictionState,
        exportEligible: event.exportEligible,
        exportBlockers: event.exportBlockers,
        recommendedAction: actorTimelineRecommendedAction(event),
        releaseImpact: actorTimelineReleaseImpact(event)
      };
    })
    .filter((change): change is GraphActorTimelineChangeWorkspaceDto["campaignChanges"][number] => Boolean(change))
    .sort((left, right) =>
      actorTimelineReleaseRank(right.releaseImpact) - actorTimelineReleaseRank(left.releaseImpact)
      || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
      || left.changeId.localeCompare(right.changeId)
    );
  return {
    endpoint: "/v1/graph/query",
    mode: "graph_backed_actor_timeline_campaign_change_detection",
    generatedAt,
    query: options.query,
    focusActorNodeId: focusActor?.type === "actor" ? focusActor.id : undefined,
    timelineEvents,
    campaignChanges,
    summary: {
      eventCount: timelineEvents.length,
      changeCount: campaignChanges.length,
      actorCount: uniqueSorted(timelineEvents.flatMap((event) => event.actorNodeIds)).length,
      incidentClaimEventCount: timelineEvents.filter((event) => event.incidentClaimIds.length > 0).length,
      campaignChangeCount: campaignChanges.filter((change) => change.changeKind === "campaign_membership_change").length,
      staleEventCount: timelineEvents.filter((event) => event.freshness === "stale" || event.publicFactState === "held_stale").length,
      contradictedEventCount: timelineEvents.filter((event) => event.contradictionState === "contradicted").length,
      heldEventCount: timelineEvents.filter((event) => event.publicFactState !== "eligible_reviewed_fact").length,
      exportEligibleEventCount: timelineEvents.filter((event) => event.exportEligible).length
    },
    deltaContract: {
      cursorField: "graph.deltas[].cursor",
      nextPollSeconds: 3,
      eventTypes: ["graph.actor_timeline.event_added", "graph.actor_timeline.change_detected", "graph.actor_timeline.review_hold", "graph.actor_timeline.export_ready"]
    },
    reviewedStixSubset: {
      eligibleRelationshipIds: uniqueSorted(timelineEvents.filter((event) => event.exportEligible).map((event) => event.relationshipId)),
      heldRelationshipIds: uniqueSorted(timelineEvents.filter((event) => !event.exportEligible).map((event) => event.relationshipId)),
      policy: "actor_timeline_reviewed_events_only"
    },
    handoffs: {
      agent04ConflictResolution: "consume_actor_timeline_campaign_change_conflicts",
      agent06EvidenceReplay: "replay_timeline_events_missing_ledger_or_capture_refs",
      agent07QualityGate: "hold_stale_contradicted_or_weak_timeline_events",
      agent09ApiFrontend: "render_actor_timeline_and_campaign_change_rows",
      agent10ReleaseGate: "hold_release_when_actor_timeline_changes_are_unreviewed_or_contradicted"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphActorProductPacketDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
    incidentClaims?: GraphIncidentClaimWorkspaceDto;
    actorTimelineChanges?: GraphActorTimelineChangeWorkspaceDto;
  }
): GraphActorProductPacketDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const normalizedQuery = options.query.trim().toLowerCase();
  const focusActor = options.focusNodeId
    ? nodesById.get(options.focusNodeId)
    : snapshot.nodes.find((node) => node.type === "actor" && node.value.toLowerCase().includes(normalizedQuery));
  const hasMissingExplicitFocus = Boolean(options.focusNodeId && !focusActor);
  const scopedRelationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : focusActor?.type === "actor"
      ? snapshot.relationships.filter((relationship) => relationship.sourceRef === focusActor.id || relationship.targetRef === focusActor.id)
      : hasMissingExplicitFocus
        ? []
        : snapshot.relationships;
  const relationships = focusActor?.type === "actor"
    ? scopedRelationships.filter((relationship) => relationship.sourceRef === focusActor.id || relationship.targetRef === focusActor.id)
    : scopedRelationships;
  const incidentClaims = options.incidentClaims ?? buildGraphIncidentClaimWorkspaceDto(snapshot, {
    query: options.query,
    focusNodeId: focusActor?.id ?? options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const actorTimelineChanges = options.actorTimelineChanges ?? buildGraphActorTimelineChangeWorkspaceDto(snapshot, {
    query: options.query,
    focusNodeId: focusActor?.id ?? options.focusNodeId,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const readiness = checkStixExportReadiness(snapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const blockersByRelationship = exportBlockingFindingsByRelationship(snapshot);
  const timelineEvents = actorTimelineChanges.timelineEvents;
  const sourceFamilies = uniqueSorted(timelineEvents.flatMap((event) => event.sourceFamilies));
  const expectedSourceFamilies = ["clear_web_report", "public_advisory", "rss_feed", "public_channel"];
  const sourceCoverageGaps = expectedSourceFamilies.filter((family) => !sourceFamilies.includes(family));
  if (focusActor && timelineEvents.length === 0) sourceCoverageGaps.push("no_graph_evidence_for_actor");
  if (!focusActor) {
    sourceCoverageGaps.push("actor_not_indexed_in_graph");
    if (options.focusNodeId) sourceCoverageGaps.push("no_graph_evidence_for_actor");
  }

  const nodeLabels = (nodeIds: string[]): string[] => uniqueSorted(nodeIds.map((nodeId) => nodesById.get(nodeId)?.value ?? nodeId));
  const changedKinds = [...new Set(actorTimelineChanges.campaignChanges.map((change) => change.changeKind))]
    .sort((left, right) => left.localeCompare(right));
  const latestEventAt = maxIsoValues(timelineEvents.map((event) => event.lastSeenAt));
  const heldRelationshipIds = uniqueSorted([
    ...actorTimelineChanges.reviewedStixSubset.heldRelationshipIds,
    ...incidentClaims.clusters.flatMap((cluster) => cluster.reviewedStixSubset.heldRelationshipIds)
  ]);
  const readyRelationshipIds = uniqueSorted([
    ...actorTimelineChanges.reviewedStixSubset.eligibleRelationshipIds,
    ...incidentClaims.clusters.flatMap((cluster) => cluster.reviewedStixSubset.eligibleRelationshipIds)
  ]);
  const reviewRequiredRelationshipIds = uniqueSorted(timelineEvents
    .filter((event) => event.publicFactState !== "eligible_reviewed_fact")
    .map((event) => event.relationshipId));
  const contradictionIds = uniqueSorted(timelineEvents
    .filter((event) => event.contradictionState !== "none")
    .map((event) => event.relationshipId));
  const contradictionReasons = uniqueSorted(timelineEvents
    .filter((event) => event.contradictionState !== "none")
    .flatMap((event) => event.exportBlockers.length > 0 ? event.exportBlockers : ["contradiction_review_required"]));
  const whatChanged = productWhatChanged(actorTimelineChanges, nodesById);
  const whyItMatters = productWhyItMatters(actorTimelineChanges, incidentClaims);
  const confidenceDrivers = productConfidenceDrivers(timelineEvents, incidentClaims);
  const reviewRequired = productReviewRequired(timelineEvents, incidentClaims);
  const victimNodeIds = uniqueSorted(timelineEvents.flatMap((event) => event.victimNodeIds));
  const focusedTimelineEvents = focusActor
    ? timelineEvents.filter((event) => event.actorNodeIds.includes(focusActor.id))
    : [];
  const focusedIncidentClusters = focusActor
    ? incidentClaims.clusters.filter((cluster) => cluster.actorNodeIds.includes(focusActor.id))
    : incidentClaims.clusters.filter((cluster) => cluster.canonicalValue.toLowerCase().includes(normalizedQuery));
  const targetingContextNodeIds = relatedNodeIdsByType(relationships, nodesById, victimNodeIds, ["sector", "country"]);
  const sectorNodeIds = uniqueSorted([
    ...incidentClaims.clusters.flatMap((cluster) => cluster.sectorNodeIds),
    ...targetingContextNodeIds.filter((nodeId) => nodesById.get(nodeId)?.type === "sector")
  ]);
  const countryNodeIds = uniqueSorted([
    ...incidentClaims.clusters.flatMap((cluster) => cluster.countryNodeIds),
    ...targetingContextNodeIds.filter((nodeId) => nodesById.get(nodeId)?.type === "country")
  ]);
  const infrastructureNodeIds = uniqueSorted(timelineEvents.flatMap((event) => event.infrastructureNodeIds));
  const vulnerabilityNodeIds = uniqueSorted(timelineEvents.flatMap((event) => event.vulnerabilityNodeIds));
  const matchedGraphEvidence = focusedTimelineEvents.length > 0 || focusedIncidentClusters.length > 0;
  const stixPreviewReadiness = buildGraphProductStixPreviewReadiness({
    timelineEvents,
    incidentClaims,
    relationships,
    nodesById,
    readinessById,
    blockersByRelationship
  });
  const apifyStatus: GraphActorProductPacketDto["apifySummary"]["status"] = !matchedGraphEvidence
    ? "searching"
    : reviewRequiredRelationshipIds.length > 0
      ? "review_required"
      : readyRelationshipIds.length > 0
        ? "ready"
        : "partial";

  return {
    endpoint: "/v1/graph/query",
    mode: "graph_export_product_packaging",
    generatedAt,
    query: options.query,
    focusActorNodeId: focusActor?.type === "actor" ? focusActor.id : undefined,
    actorTimelineSummary: {
      eventCount: timelineEvents.length,
      ...(latestEventAt ? { latestEventAt } : {}),
      whatChanged,
      whyItMatters
    },
    campaignChangeSummary: {
      changeCount: actorTimelineChanges.campaignChanges.length,
      highImpactChangeCount: actorTimelineChanges.campaignChanges.filter((change) => change.releaseImpact === "hold" || change.releaseImpact === "rollback").length,
      changeKinds: changedKinds
    },
    incidentClaimSummary: {
      clusterCount: incidentClaims.summary.clusterCount,
      eligibleClusterCount: incidentClaims.summary.eligibleClusterCount,
      heldClusterCount: incidentClaims.summary.heldClusterCount,
      canonicalClaims: incidentClaims.clusters.slice(0, 6).map((cluster) => cluster.canonicalValue)
    },
    victimTargetingPatternSummary: {
      victimNodeIds,
      sectorNodeIds,
      countryNodeIds,
      infrastructureNodeIds,
      vulnerabilityNodeIds,
      patternLabels: uniqueSorted([
        ...nodeLabels(victimNodeIds).map((label) => `victim:${label}`),
        ...nodeLabels(sectorNodeIds).map((label) => `sector:${label}`),
        ...nodeLabels(countryNodeIds).map((label) => `country:${label}`),
        ...nodeLabels(infrastructureNodeIds).map((label) => `infrastructure:${label}`),
        ...nodeLabels(vulnerabilityNodeIds).map((label) => `cve:${label}`)
      ]).slice(0, 12)
    },
    ttpSourceCorroboration: productTtpSourceCorroboration(timelineEvents),
    contradictionState: {
      state: contradictionIds.length === 0 ? "none" : timelineEvents.some((event) => event.contradictionState === "contradicted") ? "contradicted" : "suspected",
      relationshipIds: contradictionIds,
      reasons: contradictionReasons
    },
    reviewedExportReadiness: {
      readyRelationshipIds,
      heldRelationshipIds,
      reviewRequiredRelationshipIds,
      publicFactPolicy: "reviewed_evidence_only",
      taxiiBoundary: "descriptor_only_no_server"
    },
    stixPreviewReadiness,
    publicCopyHints: {
      whatChanged,
      whyItMatters,
      confidenceDrivers,
      sourceCoverageGaps: uniqueSorted(sourceCoverageGaps),
      reviewRequired
    },
    apifySummary: {
      title: focusActor?.value ?? options.query,
      status: apifyStatus,
      whatChanged: whatChanged[0] ?? "No graph-backed actor timeline changes are available yet.",
      whyItMatters: whyItMatters[0] ?? "The scraper should keep searching public sources before presenting this as actor intelligence.",
      reviewRequired: reviewRequired.length > 0
    },
    unknownActorHandling: {
      matchedGraphEvidence,
      message: matchedGraphEvidence
        ? "Graph-backed public context is available, with reviewed and held export state separated."
        : "No graph-backed actor evidence is indexed for this query yet; keep the response in searching or partial state and show source gaps.",
      safeNextPivots: uniqueSorted([
        ...nodeLabels(victimNodeIds).map((label) => `victim:${label}`),
        ...nodeLabels(vulnerabilityNodeIds).map((label) => `cve:${label}`),
        ...nodeLabels(infrastructureNodeIds).map((label) => `infrastructure:${label}`),
        ...(focusActor ? [`actor:${focusActor.value}`] : [`actor:${options.query}`])
      ]).slice(0, 8),
      missingSourceFamilies: uniqueSorted(sourceCoverageGaps)
    },
    noLeak: {
      rawUrlsIncluded: false,
      rawRestrictedMaterialIncluded: false,
      leakedContentIncluded: false,
      credentialOrPayloadEvidenceIncluded: false,
      privateChannelMaterialIncluded: false,
      actorInteractionIncluded: false,
      unsafeDarkwebDetailsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphStixTaxiiMarketplaceReadinessDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
    actorProductPacket?: GraphActorProductPacketDto;
  }
): GraphStixTaxiiMarketplaceReadinessDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const actorProductPacket = options.actorProductPacket ?? buildGraphActorProductPacketDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: options.relationshipIds
  });
  const readyRows = actorProductPacket.stixPreviewReadiness.filter((row) => row.readiness === "ready");
  const heldRows = actorProductPacket.stixPreviewReadiness.filter((row) => row.readiness === "held");
  const readyRelationshipIds = actorProductPacket.reviewedExportReadiness.readyRelationshipIds;
  const heldRelationshipIds = actorProductPacket.reviewedExportReadiness.heldRelationshipIds;
  const objectTypes = uniqueSorted(readyRows.map((row) => row.objectType)) as GraphActorProductPacketDto["stixPreviewReadiness"][number]["objectType"][];
  const emptyCounts: Record<GraphActorProductPacketDto["stixPreviewReadiness"][number]["objectType"], number> = {
    "intrusion-set": 0,
    campaign: 0,
    malware: 0,
    tool: 0,
    "attack-pattern": 0,
    identity: 0,
    relationship: 0,
    sighting: 0
  };
  const objectCounts = readyRows.reduce((counts, row) => {
    counts[row.objectType] += Math.max(row.nodeIds.length, row.relationshipIds.length, 1);
    return counts;
  }, { ...emptyCounts });
  const reviewedBundleExamples: GraphStixTaxiiMarketplaceReadinessDto["reviewedBundleExamples"] = [
    {
      exampleId: stableId("stix-marketplace-example", `${options.query}:apify:${readyRelationshipIds.join("|")}`),
      mediaType: STIX_21_MEDIA_TYPE,
      bundleKind: "reviewed_actor_intelligence_subset",
      ready: readyRelationshipIds.length > 0,
      objectTypes,
      readyRelationshipIds,
      heldRelationshipIds,
      objectCounts,
      exampleUse: "apify_sample_row"
    },
    {
      exampleId: stableId("stix-marketplace-example", `${options.query}:ti:${readyRelationshipIds.join("|")}`),
      mediaType: STIX_21_MEDIA_TYPE,
      bundleKind: "reviewed_actor_intelligence_subset",
      ready: readyRelationshipIds.length > 0 && heldRows.length === 0,
      objectTypes,
      readyRelationshipIds,
      heldRelationshipIds,
      objectCounts,
      exampleUse: "ti_preview"
    },
    {
      exampleId: stableId("stix-marketplace-example", `${options.query}:enterprise:${readyRelationshipIds.join("|")}`),
      mediaType: STIX_21_MEDIA_TYPE,
      bundleKind: "reviewed_actor_intelligence_subset",
      ready: readyRelationshipIds.length > 0,
      objectTypes,
      readyRelationshipIds,
      heldRelationshipIds,
      objectCounts,
      exampleUse: "enterprise_stix_preview"
    }
  ];

  return {
    mode: "reviewed_stix_bundle_examples_taxii_descriptor_marketplace_readiness",
    generatedAt,
    query: options.query,
    reviewedBundleExamples,
    taxiiDescriptorPricingReadiness: {
      collectionName: "ti-graph-reviewed-stix-21",
      descriptorOnly: true,
      serverImplemented: false,
      mediaType: STIX_21_MEDIA_TYPE,
      pageSize: 100,
      pricingTiers: [
        {
          tier: "free_sample",
          includedObjectTypes: objectTypes.filter((type) => type === "intrusion-set" || type === "attack-pattern" || type === "relationship"),
          maxObjectsPerPage: 25,
          readiness: readyRelationshipIds.length > 0 ? "ready" : "needs_review",
          buyerValue: "sample reviewed actor TTP and relationship context for Apify listing proof",
          requiredGate: "reviewed_relationships"
        },
        {
          tier: "analyst",
          includedObjectTypes: objectTypes,
          maxObjectsPerPage: 100,
          readiness: heldRelationshipIds.length === 0 && readyRelationshipIds.length > 0 ? "ready" : "needs_review",
          buyerValue: "reviewed actor timeline, campaign, victim, TTP, malware/tool, and sighting preview objects",
          requiredGate: "provenance_complete"
        },
        {
          tier: "enterprise",
          includedObjectTypes: ["intrusion-set", "campaign", "malware", "tool", "attack-pattern", "identity", "relationship", "sighting"],
          maxObjectsPerPage: 500,
          readiness: "future_interface",
          buyerValue: "descriptor-only TAXII collection contract for future enterprise export integration",
          requiredGate: "taxii_server_not_built"
        }
      ]
    },
    readinessGates: [
      {
        gate: "reviewed_relationships",
        state: readyRelationshipIds.length > 0 ? "pass" : "hold",
        relationshipIds: readyRelationshipIds,
        reason: "Only reviewed/export-ready relationship IDs appear in bundle examples."
      },
      {
        gate: "provenance_complete",
        state: actorProductPacket.publicCopyHints.reviewRequired.length === 0 ? "pass" : "hold",
        relationshipIds: actorProductPacket.reviewedExportReadiness.reviewRequiredRelationshipIds,
        reason: "Review-required rows must clear evidence, ledger, freshness, and contradiction gates before paid bundle promotion."
      },
      {
        gate: "no_leak",
        state: "pass",
        relationshipIds: readyRelationshipIds,
        reason: "Marketplace packets include only metadata, IDs, counts, object types, and review states."
      },
      {
        gate: "descriptor_only_taxii",
        state: "pass",
        relationshipIds: [],
        reason: "TAXII is represented as collection descriptors and page contract metadata only; no server route is claimed."
      },
      {
        gate: "held_rows_excluded",
        state: heldRelationshipIds.length > 0 ? "hold" : "pass",
        relationshipIds: heldRelationshipIds,
        reason: "Held rows are visible as exclusions and never enter authoritative reviewed bundle examples."
      }
    ],
    marketplaceDifferentiators: [
      "reviewed STIX 2.1 object previews backed by graph evidence IDs",
      "descriptor-only TAXII readiness without premature server claims",
      "buyer-facing free sample, analyst, and enterprise package boundaries",
      "explicit held-row exclusions for stale, contradicted, weak, restricted, missing-ledger, and unreviewed facts",
      "safe Apify and /ti copy hooks tied to the same graph product packet"
    ],
    noLeak: {
      rawUrlsIncluded: false,
      rawRestrictedMaterialIncluded: false,
      leakedContentIncluded: false,
      credentialOrPayloadEvidenceIncluded: false,
      privateChannelMaterialIncluded: false,
      actorInteractionIncluded: false,
      unsafeDarkwebDetailsIncluded: false,
      objectKeysIncluded: false,
      taxiiServerClaimed: false,
      metadataOnly: true
    }
  };
}

export function buildGraphStixTaxiiMonetizationExportContractsDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
    actorProductPacket?: GraphActorProductPacketDto;
    marketplaceReadiness?: GraphStixTaxiiMarketplaceReadinessDto;
  }
): GraphStixTaxiiMonetizationExportContractsDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const actorProductPacket = options.actorProductPacket ?? buildGraphActorProductPacketDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: options.relationshipIds
  });
  const marketplaceReadiness = options.marketplaceReadiness ?? buildGraphStixTaxiiMarketplaceReadinessDto(snapshot, {
    query: options.query,
    focusNodeId: options.focusNodeId,
    generatedAt,
    relationshipIds: options.relationshipIds,
    actorProductPacket
  });
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const scopedRelationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const supportByRelationship = new Map(snapshot.evidenceSupport.map((support) => [support.relationshipId, support]));
  const previewRows = actorProductPacket.stixPreviewReadiness;
  const readyRelationshipIds = actorProductPacket.reviewedExportReadiness.readyRelationshipIds;
  const heldRelationshipIds = actorProductPacket.reviewedExportReadiness.heldRelationshipIds;
  const readyTypes = uniqueSorted(previewRows.filter((row) => row.readiness === "ready").map((row) => row.objectType)) as GraphStixProductObjectType[];
  const allObjectTypes: GraphStixProductObjectType[] = ["intrusion-set", "campaign", "malware", "tool", "attack-pattern", "identity", "relationship", "sighting", "indicator", "report"];
  const blockersByRelationship = new Map<string, GraphProductExportBlocker[]>();
  for (const relationship of scopedRelationships) {
    blockersByRelationship.set(relationship.id, productExportBlockersForRelationship(relationship, supportByRelationship.get(relationship.id)));
  }
  for (const row of previewRows) {
    if (row.readiness !== "held") continue;
    const rowBlockers = productExportBlockersForHoldReasons(row.holdReasons);
    for (const relationshipId of row.relationshipIds) {
      blockersByRelationship.set(relationshipId, uniqueSorted([...(blockersByRelationship.get(relationshipId) ?? []), ...rowBlockers]) as GraphProductExportBlocker[]);
    }
  }
  const allBlockers = uniqueSorted([...blockersByRelationship.values()].flat()) as GraphProductExportBlocker[];
  const heldReasons = buildProductHeldReasons(blockersByRelationship);
  const objectEligibilityMatrix: GraphStixTaxiiMonetizationExportContractsDto["objectEligibilityMatrix"] = allObjectTypes.map((objectType) => {
    const matchingRows = previewRows.filter((row) => row.objectType === objectType);
    const eligibleRelationshipIds = uniqueSorted(matchingRows.filter((row) => row.readiness === "ready").flatMap((row) => row.relationshipIds));
    const heldIds = uniqueSorted([
      ...matchingRows.filter((row) => row.readiness === "held").flatMap((row) => row.relationshipIds),
      ...(objectType === "indicator" || objectType === "report" ? heldRelationshipIds : [])
    ]).slice(0, 25);
    const blockers = uniqueSorted([
      ...heldIds.flatMap((relationshipId) => blockersByRelationship.get(relationshipId) ?? ["missing_analyst_review"]),
      ...(objectType === "indicator" || objectType === "report" ? ["missing_analyst_review" as const] : [])
    ]) as GraphProductExportBlocker[];
    return {
      objectType,
      eligibleRelationshipIds: eligibleRelationshipIds.slice(0, 25),
      heldRelationshipIds: heldIds,
      requiredEvidence: ["ledger_ids", "capture_ids", "source_ids", "analyst_review", "safe_public_or_reviewed_metadata"],
      confidenceThreshold: objectType === "relationship" || objectType === "sighting" ? 0.7 : 0.75,
      freshnessWindowDays: objectType === "indicator" ? 14 : objectType === "report" ? 90 : 45,
      eligibleTiers: productEligibleTiers(objectType, eligibleRelationshipIds.length > 0),
      blockers
    };
  });
  const apifyReviewedObjectTypes = readyTypes.filter((type) => type !== "relationship" || readyRelationshipIds.length > 0);
  const apifyExportBlockers = allBlockers.filter((blocker) => blocker !== "taxii_server_not_implemented").slice(0, 8);
  const exportContracts: GraphStixTaxiiMonetizationExportContractsDto["exportContracts"] = [
    {
      tier: "free_sample",
      implementedSurface: "apify_dataset",
      rowLimit: 25,
      reviewedObjectEligibility: "ready_reviewed_only",
      evidenceRequirements: ["ledger_ids", "capture_ids", "source_ids", "analyst_review", "tenant_policy_allow"],
      confidenceThreshold: 0.75,
      freshnessWindowDays: 30,
      updateCadence: "per_run",
      pricingReadinessNote: "Implemented as compact safe Apify dataset fields; STIX objects are preview metadata only unless reviewed relationship gates pass.",
      stixReady: readyRelationshipIds.length > 0,
      taxiiDescriptorReady: marketplaceReadiness.taxiiDescriptorPricingReadiness.descriptorOnly,
      reviewedObjectTypes: apifyReviewedObjectTypes,
      exportBlockers: apifyExportBlockers
    },
    {
      tier: "analyst",
      implementedSurface: "public_ti_preview",
      rowLimit: 100,
      reviewedObjectEligibility: "ready_reviewed_only",
      evidenceRequirements: ["ledger_ids", "capture_ids", "source_ids", "analyst_review", "freshness_window", "tenant_policy_allow"],
      confidenceThreshold: 0.7,
      freshnessWindowDays: 45,
      updateCadence: "polling_delta",
      pricingReadinessNote: "Implemented as `/ti` and graph-query preview contracts with held rows surfaced as caveats, not authoritative STIX.",
      stixReady: readyRelationshipIds.length > 0,
      taxiiDescriptorReady: marketplaceReadiness.taxiiDescriptorPricingReadiness.descriptorOnly,
      reviewedObjectTypes: readyTypes,
      exportBlockers: apifyExportBlockers
    },
    {
      tier: "enterprise",
      implementedSurface: "taxii_descriptor_only",
      rowLimit: 500,
      reviewedObjectEligibility: "descriptor_future_interface",
      evidenceRequirements: ["ledger_ids", "capture_ids", "source_ids", "analyst_review", "freshness_window", "tenant_policy_allow"],
      confidenceThreshold: 0.7,
      freshnessWindowDays: 90,
      updateCadence: "future_taxii_collection",
      pricingReadinessNote: "Contract-only enterprise export package; TAXII collection descriptor exists but no server route is mounted or claimed.",
      stixReady: readyRelationshipIds.length > 0,
      taxiiDescriptorReady: true,
      reviewedObjectTypes: allObjectTypes,
      exportBlockers: uniqueSorted([...apifyExportBlockers, "taxii_server_not_implemented"]) as GraphProductExportBlocker[]
    }
  ];

  return {
    mode: "stix_taxii_monetization_export_contracts",
    generatedAt,
    query: options.query,
    exportContracts,
    objectEligibilityMatrix,
    heldExportBlockedReasons: heldReasons,
    apifyDatasetFields: {
      stixReady: readyRelationshipIds.length > 0,
      taxiiDescriptorReady: marketplaceReadiness.taxiiDescriptorPricingReadiness.descriptorOnly,
      exportTier: readyRelationshipIds.length > 0 ? "free_sample" : "analyst",
      exportBlockers: apifyExportBlockers,
      reviewedObjectTypes: apifyReviewedObjectTypes
    },
    implementationBoundary: {
      apifyDatasetImplemented: true,
      publicTiPreviewImplemented: true,
      enterprisePackageContractOnly: true,
      taxiiServerImplemented: false,
      taxiiDescriptorOnly: true,
      authoritativeStixRequiresReviewedRelationships: true
    },
    noLeak: {
      rawUrlsIncluded: false,
      leakedContentIncluded: false,
      credentialOrPayloadEvidenceIncluded: false,
      privateChannelMaterialIncluded: false,
      objectKeysIncluded: false,
      actorInteractionIncluded: false,
      unsafeDarkwebDetailsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphActorComparisonNotebookDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    query: string;
    focusNodeId?: string;
    generatedAt?: string;
    relationshipIds?: string[];
  }
): GraphActorComparisonNotebookDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const supportByRelationship = new Map(snapshot.evidenceSupport.map((support) => [support.relationshipId, support]));
  const readiness = checkStixExportReadiness({ ...snapshot, relationships });
  const readinessById = new Map(readiness.relationships.map((row) => [row.relationshipId, row]));
  const actorNodeIds = uniqueSorted([
    ...(options.focusNodeId && nodesById.get(options.focusNodeId)?.type === "actor" ? [options.focusNodeId] : []),
    ...relationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]).filter((nodeId) => nodesById.get(nodeId)?.type === "actor")
  ]).slice(0, 6);
  const focusActorId = actorNodeIds[0];
  const focusNeighborIds = new Set(relationships
    .filter((relationship) => relationship.sourceRef === focusActorId || relationship.targetRef === focusActorId)
    .flatMap((relationship) => [relationship.sourceRef, relationship.targetRef])
    .filter((nodeId) => nodeId !== focusActorId));
  const comparisonRows = actorNodeIds.map((actorNodeId) => {
    const actor = nodesById.get(actorNodeId) ?? fallbackNode(actorNodeId);
    const actorRelationships = relationships.filter((relationship) => relationship.sourceRef === actorNodeId || relationship.targetRef === actorNodeId);
    const reviewedRelationshipIds = actorRelationships.filter((relationship) => readinessById.get(relationship.id)?.ready).map((relationship) => relationship.id);
    const heldRelationshipIds = actorRelationships.filter((relationship) => !readinessById.get(relationship.id)?.ready).map((relationship) => relationship.id);
    const blockers = uniqueSorted(actorRelationships.flatMap((relationship) => productExportBlockersForRelationship(relationship, supportByRelationship.get(relationship.id)))) as GraphProductExportBlocker[];
    const neighborNodes = actorRelationships
      .flatMap((relationship) => [relationship.sourceRef, relationship.targetRef])
      .filter((nodeId) => nodeId !== actorNodeId)
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is PersistedGraphNode => Boolean(node));
    const reviewedObjectTypes = uniqueSorted(neighborNodes.map(stixProductObjectTypeForNode).filter((type): type is GraphStixProductObjectType => Boolean(type))) as GraphStixProductObjectType[];
    const averageConfidence = Number((actorRelationships.reduce((sum, relationship) => sum + relationship.confidence, 0) / Math.max(1, actorRelationships.length)).toFixed(2));
    const latestSeenAt = actorRelationships.map((relationship) => relationship.lastSeenAt).sort().at(-1);
    const sharedNeighborIds = neighborNodes.filter((node) => focusNeighborIds.has(node.id));
    return {
      actorNodeId,
      actorName: actor.value,
      relationshipIds: uniqueSorted(actorRelationships.map((relationship) => relationship.id)).slice(0, 50),
      reviewedRelationshipCount: reviewedRelationshipIds.length,
      heldRelationshipCount: heldRelationshipIds.length,
      averageConfidence,
      latestSeenAt,
      reviewedObjectTypes,
      sourceFamilies: uniqueSorted(actorRelationships.map((relationship) => supportByRelationship.get(relationship.id)?.sourceId).filter((sourceId): sourceId is string => Boolean(sourceId)).map(sourceFamilyForProduct)),
      exportTierReadiness: {
        free_sample: reviewedRelationshipIds.length > 0 ? "ready" : "held",
        analyst: reviewedRelationshipIds.length > 0 && heldRelationshipIds.length > 0 ? "partial" : reviewedRelationshipIds.length > 0 ? "ready" : "held",
        enterprise: "future_interface"
      } satisfies GraphActorComparisonNotebookDto["comparisonRows"][number]["exportTierReadiness"],
      exportBlockers: blockers,
      differentiators: buyerNotebookDifferentiators(neighborNodes, heldRelationshipIds.length),
      sharedWithFocus: {
        ttpNodeIds: sharedNeighborIds.filter((node) => node.type === "attack-pattern").map((node) => node.id),
        malwareToolNodeIds: sharedNeighborIds.filter((node) => node.type === "malware" || node.type === "tool").map((node) => node.id),
        victimNodeIds: sharedNeighborIds.filter((node) => node.type === "victim").map((node) => node.id),
        campaignNodeIds: sharedNeighborIds.filter((node) => node.type === "campaign").map((node) => node.id)
      }
    };
  });
  const reviewedRelationshipIds = uniqueSorted(comparisonRows.flatMap((row) => row.relationshipIds.filter((relationshipId) => readinessById.get(relationshipId)?.ready)));
  const heldRelationshipIds = uniqueSorted(comparisonRows.flatMap((row) => row.relationshipIds.filter((relationshipId) => !readinessById.get(relationshipId)?.ready)));
  const reviewedObjectTypes = uniqueSorted(comparisonRows.flatMap((row) => row.reviewedObjectTypes)) as GraphStixProductObjectType[];
  const notebooks: GraphActorComparisonNotebookDto["notebooks"] = [
    {
      notebookId: stableId("graph-buyer-notebook", `${options.query}:apify:${actorNodeIds.join("|")}`),
      useCase: "apify_listing_sample",
      title: "Reviewed actor comparison sample",
      includedActorNodeIds: actorNodeIds.slice(0, 3),
      sectionKeys: ["summary", "ttps", "sources", "holds"],
      reviewedRelationshipIds: reviewedRelationshipIds.slice(0, 25),
      heldRelationshipIds: heldRelationshipIds.slice(0, 25),
      reviewedObjectTypes,
      exportTier: "free_sample",
      safeForBuyerPreview: reviewedRelationshipIds.length > 0,
      maxRows: 25,
      nextActions: heldRelationshipIds.length > 0 ? ["open_ti_preview", "hold_unreviewed_edges", "compare_actor_overlap"] : ["open_ti_preview", "export_reviewed_stix", "compare_actor_overlap"]
    },
    {
      notebookId: stableId("graph-buyer-notebook", `${options.query}:public-ti:${actorNodeIds.join("|")}`),
      useCase: "public_ti_investigation",
      title: "Buyer-ready /ti investigation notebook",
      includedActorNodeIds: actorNodeIds,
      sectionKeys: ["summary", "timeline", "incident_claims", "ttps", "victims", "sources", "holds"],
      reviewedRelationshipIds: reviewedRelationshipIds.slice(0, 75),
      heldRelationshipIds: heldRelationshipIds.slice(0, 75),
      reviewedObjectTypes,
      exportTier: "analyst",
      safeForBuyerPreview: reviewedRelationshipIds.length > 0,
      maxRows: 100,
      nextActions: heldRelationshipIds.length > 0 ? ["request_more_evidence", "hold_unreviewed_edges", "compare_actor_overlap"] : ["export_reviewed_stix", "compare_actor_overlap"]
    },
    {
      notebookId: stableId("graph-buyer-notebook", `${options.query}:enterprise:${actorNodeIds.join("|")}`),
      useCase: "enterprise_export_review",
      title: "Enterprise reviewed export notebook contract",
      includedActorNodeIds: actorNodeIds,
      sectionKeys: ["summary", "timeline", "incident_claims", "ttps", "victims", "sources", "stix_export", "holds"],
      reviewedRelationshipIds: reviewedRelationshipIds.slice(0, 150),
      heldRelationshipIds: heldRelationshipIds.slice(0, 150),
      reviewedObjectTypes,
      exportTier: "enterprise",
      safeForBuyerPreview: reviewedRelationshipIds.length > 0,
      maxRows: 500,
      nextActions: ["export_reviewed_stix", "request_more_evidence", "hold_unreviewed_edges", "compare_actor_overlap"]
    }
  ];

  return {
    mode: "graph_backed_actor_comparison_buyer_ready_notebooks",
    generatedAt,
    query: options.query,
    comparedActorNodeIds: actorNodeIds,
    comparisonRows,
    notebooks,
    buyerReadiness: {
      publicPreviewReady: reviewedRelationshipIds.length > 0,
      apifySampleReady: reviewedRelationshipIds.length > 0,
      enterpriseNotebookContractReady: true,
      taxiiStillDescriptorOnly: true
    },
    noLeak: {
      rawUrlsIncluded: false,
      leakedContentIncluded: false,
      credentialOrPayloadEvidenceIncluded: false,
      privateChannelMaterialIncluded: false,
      objectKeysIncluded: false,
      actorInteractionIncluded: false,
      unsafeDarkwebDetailsIncluded: false,
      metadataOnly: true
    }
  };
}

function productExportBlockersForRelationship(
  relationship: PersistedGraphRelationship,
  support?: GraphEvidenceSupportRecord
): GraphProductExportBlocker[] {
  const blockers: GraphProductExportBlocker[] = [];
  const sourceIds = support?.sourceId ? [support.sourceId] : [];
  if (relationship.confidence < 0.7) blockers.push("weak_evidence");
  if (relationship.reviewState !== "accepted") blockers.push("missing_analyst_review");
  if (relationship.properties?.stale === true) blockers.push("stale_activity");
  if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true) blockers.push("contradiction");
  if ((support?.ledgerIds ?? []).length === 0 || relationship.evidenceSupportIds.length === 0) blockers.push("missing_ledger");
  if (sourceIds.some((sourceId) => sourceId.includes("restricted") || sourceId.includes("dark") || sourceId.includes("leak"))) blockers.push("restricted_metadata_only");
  if (sourceIds.some((sourceId) => sourceId.includes("public_channel") || sourceId.includes("telegram"))) blockers.push("public_channel_only");
  if (relationship.properties?.unsafeSource === true || relationship.properties?.unsupported === true) blockers.push("unsafe_source");
  if (relationship.properties?.tenantPolicyHold === true) blockers.push("tenant_policy_hold");
  return uniqueSorted(blockers) as GraphProductExportBlocker[];
}

function productExportBlockersForHoldReasons(reasons: GraphIntegrityFindingCode[]): GraphProductExportBlocker[] {
  const blockers = reasons.map((reason): GraphProductExportBlocker => {
    switch (reason) {
      case "weak_discovery_only_edge":
      case "source_bias_cluster":
        return "weak_evidence";
      case "stale_accepted_edge":
      case "deprecated_attack_technique":
      case "attack_alias_drift":
        return "stale_activity";
      case "contradicted_edge":
        return "contradiction";
      case "restricted_only_claim":
      case "unsupported_restricted_metadata":
        return "restricted_metadata_only";
      case "missing_ledger_ids":
      case "missing_provenance":
      case "orphan_relationship":
        return "missing_ledger";
      case "unreviewed_victim_claim":
      case "unreviewed_cve_exploitation":
      case "unreviewed_ttp_mapping":
        return "missing_analyst_review";
      case "unsupported_edge":
      case "export_schema_risk":
      case "export_blocking_issue":
        return "unsafe_source";
      default:
        return "missing_analyst_review";
    }
  });
  return uniqueSorted(blockers) as GraphProductExportBlocker[];
}

function productEligibleTiers(objectType: GraphStixProductObjectType, hasEligibleRows: boolean): GraphProductExportTier[] {
  if (!hasEligibleRows) return [];
  if (objectType === "indicator" || objectType === "report") return ["enterprise"];
  if (objectType === "intrusion-set" || objectType === "attack-pattern" || objectType === "relationship") return ["free_sample", "analyst", "enterprise"];
  return ["analyst", "enterprise"];
}

function buildProductHeldReasons(
  blockersByRelationship: Map<string, GraphProductExportBlocker[]>
): GraphStixTaxiiMonetizationExportContractsDto["heldExportBlockedReasons"] {
  const explanations: Record<GraphProductExportBlocker, string> = {
    weak_evidence: "The relationship is not strong enough for authoritative STIX or paid export without more corroboration.",
    stale_activity: "The relationship is stale or lifecycle-drifted and needs fresh evidence before promotion.",
    contradiction: "Conflicting graph evidence exists; keep the row in analyst review instead of export.",
    restricted_metadata_only: "Restricted or leak-adjacent material is metadata-only and cannot become authoritative STIX without reviewed public corroboration.",
    public_channel_only: "Public-channel-only hints remain caveated until corroborated by stronger public sources.",
    missing_ledger: "Evidence ledger, capture, or provenance references are incomplete.",
    missing_analyst_review: "The relationship has not cleared analyst review for export.",
    unsafe_source: "The relationship touches unsupported or unsafe source/export semantics.",
    tenant_policy_hold: "Tenant policy does not allow export promotion for this row.",
    taxii_server_not_implemented: "TAXII is descriptor-only; no mounted server route is implemented."
  };
  const rows = Object.keys(explanations).map((reason) => {
    const typedReason = reason as GraphProductExportBlocker;
    const relationshipIds = uniqueSorted([...blockersByRelationship.entries()]
      .filter(([, blockers]) => blockers.includes(typedReason))
      .map(([relationshipId]) => relationshipId));
    return {
      reason: typedReason,
      relationshipIds: relationshipIds.slice(0, 25),
      publicExplanation: explanations[typedReason]
    };
  });
  return rows.filter((row) => row.relationshipIds.length > 0 || row.reason === "taxii_server_not_implemented");
}

function stixProductObjectTypeForNode(node: PersistedGraphNode): GraphStixProductObjectType | undefined {
  if (node.type === "actor") return "intrusion-set";
  if (node.type === "campaign") return "campaign";
  if (node.type === "malware") return "malware";
  if (node.type === "tool") return "tool";
  if (node.type === "attack-pattern") return "attack-pattern";
  if (node.type === "victim" || node.type === "sector" || node.type === "country") return "identity";
  if (node.type === "infrastructure" || node.type === "vulnerability") return "indicator";
  if (node.type === "incident" || node.type === "source" || node.type === "report") return "report";
  return undefined;
}

function sourceFamilyForProduct(sourceId: string): string {
  if (sourceId.includes("restricted") || sourceId.includes("dark")) return "restricted_metadata";
  if (sourceId.includes("public_channel") || sourceId.includes("telegram")) return "public_channel";
  if (sourceId.includes("advisory") || sourceId.includes("cisa")) return "advisory";
  if (sourceId.includes("rss")) return "rss";
  if (sourceId.includes("vendor") || sourceId.includes("report")) return "vendor_report";
  return "public_source";
}

function buyerNotebookDifferentiators(nodes: PersistedGraphNode[], heldCount: number): string[] {
  const byType = new Map<IntelligenceNodeType, string[]>();
  for (const node of nodes) {
    byType.set(node.type, [...(byType.get(node.type) ?? []), node.value]);
  }
  const rows: string[] = [];
  for (const [type, values] of byType.entries()) {
    rows.push(`${type}:${uniqueSorted(values).slice(0, 3).join(", ")}`);
  }
  if (heldCount > 0) rows.push(`held_edges:${heldCount}`);
  return rows.slice(0, 8);
}

function productWhatChanged(
  actorTimelineChanges: GraphActorTimelineChangeWorkspaceDto,
  nodesById: Map<string, PersistedGraphNode>
): string[] {
  const labels = actorTimelineChanges.campaignChanges.slice(0, 6).map((change) => {
    const nodeValues = change.nodeIds
      .map((nodeId) => nodesById.get(nodeId)?.value)
      .filter((value): value is string => Boolean(value))
      .slice(0, 3)
      .join(", ");
    return `${change.changeKind.replaceAll("_", " ")}${nodeValues ? `: ${nodeValues}` : ""}`;
  });
  if (labels.length > 0) return labels;
  if (actorTimelineChanges.timelineEvents.length > 0) return ["Graph relationships changed, but no campaign-level change is ready for product copy."];
  return ["No graph-backed actor timeline changes are available yet."];
}

function productWhyItMatters(
  actorTimelineChanges: GraphActorTimelineChangeWorkspaceDto,
  incidentClaims: GraphIncidentClaimWorkspaceDto
): string[] {
  const reasons: string[] = [];
  if (incidentClaims.summary.eligibleClusterCount > 0) reasons.push("Reviewed incident claims can be summarized as public actor context.");
  if (incidentClaims.summary.heldClusterCount > 0) reasons.push("Some incident claims remain review-held and should be shown as caveated context.");
  if (actorTimelineChanges.summary.contradictedEventCount > 0) reasons.push("Contradictions require analyst review before public facts or STIX export.");
  if (actorTimelineChanges.summary.staleEventCount > 0) reasons.push("Stale campaign or TTP edges should not be promoted without fresh corroboration.");
  if (actorTimelineChanges.summary.exportEligibleEventCount > 0) reasons.push("Reviewed relationships are available for a compact STIX preview subset.");
  return reasons.length > 0 ? reasons : ["Public source coverage and evidence replay determine whether this actor packet can move beyond searching."];
}

function productConfidenceDrivers(
  timelineEvents: GraphActorTimelineChangeWorkspaceDto["timelineEvents"],
  incidentClaims: GraphIncidentClaimWorkspaceDto
): string[] {
  const families = uniqueSorted(timelineEvents.flatMap((event) => event.sourceFamilies));
  const ledgerCount = uniqueSorted(timelineEvents.flatMap((event) => event.ledgerIds)).length;
  const evidenceCount = uniqueSorted(timelineEvents.flatMap((event) => event.evidenceIds)).length;
  const drivers: string[] = [];
  if (families.length > 0) drivers.push(`source families: ${families.join(", ")}`);
  if (ledgerCount > 0) drivers.push(`${ledgerCount} ledger-backed graph relationships`);
  if (evidenceCount > 0) drivers.push(`${evidenceCount} evidence references`);
  if (incidentClaims.summary.publisherCount > 1) drivers.push(`${incidentClaims.summary.publisherCount} public publishers in incident clusters`);
  if (incidentClaims.summary.sourceFamilyCount > 1) drivers.push(`${incidentClaims.summary.sourceFamilyCount} source families corroborating claims`);
  return drivers.length > 0 ? drivers : ["no graph evidence or claim ledger support yet"];
}

function productReviewRequired(
  timelineEvents: GraphActorTimelineChangeWorkspaceDto["timelineEvents"],
  incidentClaims: GraphIncidentClaimWorkspaceDto
): string[] {
  const requirements = uniqueSorted([
    ...timelineEvents
      .filter((event) => event.publicFactState !== "eligible_reviewed_fact")
      .map((event) => `${event.relationshipId}:${event.publicFactState}`),
    ...incidentClaims.clusters
      .filter((cluster) => cluster.exportState !== "eligible_reviewed_subset")
      .map((cluster) => `${cluster.claimId}:${cluster.exportState}`)
  ]);
  return requirements.slice(0, 12);
}

function productTtpSourceCorroboration(
  timelineEvents: GraphActorTimelineChangeWorkspaceDto["timelineEvents"]
): GraphActorProductPacketDto["ttpSourceCorroboration"] {
  return timelineEvents
    .filter((event) => event.ttpNodeIds.length > 0 || event.malwareToolNodeIds.length > 0)
    .map((event) => {
      const corroborationState: GraphActorProductPacketDto["ttpSourceCorroboration"][number]["corroborationState"] =
        event.publicFactState !== "eligible_reviewed_fact"
          ? "held"
          : event.ledgerIds.length === 0 || event.evidenceIds.length === 0
            ? "needs_evidence"
            : event.sourceFamilies.length > 1
              ? "well_corroborated"
              : "single_source";
      return {
        ...(event.ttpNodeIds[0] ? { ttpNodeId: event.ttpNodeIds[0] } : {}),
        ...(event.malwareToolNodeIds[0] ? { malwareToolNodeId: event.malwareToolNodeIds[0] } : {}),
        relationshipIds: [event.relationshipId],
        sourceFamilies: event.sourceFamilies,
        evidenceIds: event.evidenceIds,
        ledgerIds: event.ledgerIds,
        confidence: event.confidence,
        corroborationState
      };
    })
    .sort((left, right) =>
      Number(right.corroborationState === "well_corroborated") - Number(left.corroborationState === "well_corroborated")
      || right.confidence - left.confidence
      || left.relationshipIds[0]!.localeCompare(right.relationshipIds[0]!)
    )
    .slice(0, 12);
}

function buildGraphProductStixPreviewReadiness(input: {
  timelineEvents: GraphActorTimelineChangeWorkspaceDto["timelineEvents"];
  incidentClaims: GraphIncidentClaimWorkspaceDto;
  relationships: PersistedGraphRelationship[];
  nodesById: Map<string, PersistedGraphNode>;
  readinessById: Map<string, StixExportReadinessReportDto["relationships"][number]>;
  blockersByRelationship: Map<string, GraphIntegrityFindingCode[]>;
}): GraphActorProductPacketDto["stixPreviewReadiness"] {
  const rows = new Map<GraphActorProductPacketDto["stixPreviewReadiness"][number]["objectType"], GraphActorProductPacketDto["stixPreviewReadiness"][number]>();
  const add = (
    objectType: GraphActorProductPacketDto["stixPreviewReadiness"][number]["objectType"],
    nodeIds: string[],
    relationshipIds: string[]
  ) => {
    const existing = rows.get(objectType);
    const holdReasons = uniqueFindingCodes(relationshipIds.flatMap((relationshipId) => [
      ...(input.readinessById.get(relationshipId)?.blockers ?? []),
      ...(input.blockersByRelationship.get(relationshipId) ?? [])
    ]));
    const readiness = relationshipIds.length > 0 && relationshipIds.every((relationshipId) => input.readinessById.get(relationshipId)?.ready === true)
      ? "ready"
      : "held";
    rows.set(objectType, {
      objectType,
      nodeIds: uniqueSorted([...(existing?.nodeIds ?? []), ...nodeIds]),
      relationshipIds: uniqueSorted([...(existing?.relationshipIds ?? []), ...relationshipIds]),
      readiness: existing?.readiness === "ready" && readiness === "ready" ? "ready" : readiness,
      holdReasons: uniqueFindingCodes([...(existing?.holdReasons ?? []), ...holdReasons])
    });
  };

  for (const event of input.timelineEvents) {
    add("intrusion-set", event.actorNodeIds, [event.relationshipId]);
    if (event.campaignNodeIds.length > 0) add("campaign", event.campaignNodeIds, [event.relationshipId]);
    if (event.ttpNodeIds.length > 0) add("attack-pattern", event.ttpNodeIds, [event.relationshipId]);
    for (const nodeId of event.malwareToolNodeIds) {
      const node = input.nodesById.get(nodeId);
      add(node?.type === "tool" ? "tool" : "malware", [nodeId], [event.relationshipId]);
    }
    if (event.victimNodeIds.length > 0) add("identity", event.victimNodeIds, [event.relationshipId]);
    if (event.relationshipId) add("relationship", [], [event.relationshipId]);
  }
  for (const cluster of input.incidentClaims.clusters) {
    add("sighting", cluster.nodeIds, cluster.relationshipIds);
  }
  const actorNodeIds = uniqueSorted(input.relationships.flatMap((relationship) => {
    const source = input.nodesById.get(relationship.sourceRef);
    const target = input.nodesById.get(relationship.targetRef);
    return [
      source?.type === "actor" ? source.id : undefined,
      target?.type === "actor" ? target.id : undefined
    ].filter((nodeId): nodeId is string => Boolean(nodeId));
  }));
  if (actorNodeIds.length > 0 && !rows.has("intrusion-set")) {
    add("intrusion-set", actorNodeIds, input.relationships
      .filter((relationship) => actorNodeIds.includes(relationship.sourceRef) || actorNodeIds.includes(relationship.targetRef))
      .map((relationship) => relationship.id));
  }
  if (rows.size === 0 && input.relationships.length > 0) {
    add("relationship", [], input.relationships.map((relationship) => relationship.id));
  }
  return [...rows.values()].sort((left, right) =>
    Number(right.readiness === "ready") - Number(left.readiness === "ready")
    || left.objectType.localeCompare(right.objectType)
  );
}

function sourceFamilyForClaimSupport(sourceId: string): string {
  const normalized = sourceId.toLowerCase();
  if (/telegram|public_channel|channel/.test(normalized)) return "public_channel";
  if (/rss|feed/.test(normalized)) return "rss_feed";
  if (/advisory|cve|cert|cisa/.test(normalized)) return "public_advisory";
  if (/vendor|report|blog|clear_web|static/.test(normalized)) return "clear_web_report";
  if (/restricted|dark|ransom|leak/.test(normalized)) return "restricted_metadata";
  return normalized.split(/[_:-]/)[0] || "unknown";
}

function minIsoValues(values: string[]): string | undefined {
  return values.filter(Boolean).sort((left, right) => Date.parse(left) - Date.parse(right))[0];
}

function maxIsoValues(values: string[]): string | undefined {
  return values.filter(Boolean).sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function incidentClaimReviewState(relationships: PersistedGraphRelationship[]): GraphRelationshipReviewState {
  if (relationships.some((relationship) => relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true)) return "contradicted";
  if (relationships.some((relationship) => relationship.reviewState === "expired")) return "expired";
  if (relationships.some((relationship) => relationship.reviewState === "needs_review")) return "needs_review";
  if (relationships.length > 0 && relationships.every((relationship) => relationship.reviewState === "accepted")) return "accepted";
  if (relationships.some((relationship) => relationship.reviewState === "rejected")) return "rejected";
  return "unreviewed";
}

function nodeIdsByType(nodes: PersistedGraphNode[], types: IntelligenceNodeType[]): string[] {
  const allowed = new Set<IntelligenceNodeType>(types);
  return uniqueSorted(nodes.filter((node) => allowed.has(node.type)).map((node) => node.id));
}

function relatedNodeIdsByType(
  relationships: PersistedGraphRelationship[],
  nodesById: Map<string, PersistedGraphNode>,
  seedNodeIds: string[],
  types: IntelligenceNodeType[]
): string[] {
  const seeds = new Set(seedNodeIds);
  const allowed = new Set<IntelligenceNodeType>(types);
  const relatedNodeIds: string[] = [];
  for (const relationship of relationships) {
    const pairs: Array<[string, string]> = [
      [relationship.sourceRef, relationship.targetRef],
      [relationship.targetRef, relationship.sourceRef]
    ];
    for (const [sourceRef, targetRef] of pairs) {
      if (!seeds.has(sourceRef)) continue;
      const node = nodesById.get(targetRef);
      if (!node || !allowed.has(node.type)) continue;
      relatedNodeIds.push(node.id);
    }
  }
  return uniqueSorted(relatedNodeIds);
}

function incidentClaimType(
  incident: PersistedGraphNode,
  nodes: PersistedGraphNode[],
  hasContradiction: boolean
): GraphIncidentClaimWorkspaceDto["clusters"][number]["claimType"] {
  const nodeTypes = new Set<IntelligenceNodeType>(nodes.map((node) => node.type));
  const value = `${incident.value} ${String(incident.properties?.claimType ?? "")}`.toLowerCase();
  if (hasContradiction || /alias|ambiguous/.test(value)) return "ambiguous_alias_claim";
  if (nodeTypes.has("malware") || /lockbit|akira|ransom/.test(value)) return "ransomware_claim";
  if (nodeTypes.has("victim") || value.includes("victim") || value.includes("leak")) return "victim_claim";
  if (nodeTypes.has("vulnerability") || value.includes("cve-")) return "vulnerability_claim";
  if (nodeTypes.has("campaign")) return "campaign_claim";
  if (nodeTypes.has("actor")) return "intrusion_activity";
  return "ambiguous_alias_claim";
}

function incidentClaimFreshness(
  lastReportedAt: string,
  generatedAt: string
): GraphIncidentClaimWorkspaceDto["clusters"][number]["freshness"] {
  const days = ageInDays(lastReportedAt, generatedAt);
  if (days > 30) return "stale";
  if (days > 7) return "watch";
  return "fresh";
}

function uniqueClaimMergeRules(input: {
  publisherCount: number;
  sourceFamilyCount: number;
  actorNodeIds: string[];
  victimNodeIds: string[];
  campaignNodeIds: string[];
  hasContradiction: boolean;
  incident: PersistedGraphNode;
}): GraphIncidentClaimWorkspaceDto["clusters"][number]["mergeSemantics"]["rules"] {
  const rules: GraphIncidentClaimWorkspaceDto["clusters"][number]["mergeSemantics"]["rules"] = ["same_incident_node"];
  if (input.publisherCount > 1) rules.push("same_day_syndication");
  if (input.sourceFamilyCount > 1) rules.push("publisher_diversity");
  if (input.actorNodeIds.length > 0 && (input.victimNodeIds.length > 0 || input.campaignNodeIds.length > 0)) rules.push("actor_victim_campaign_overlap");
  if (input.hasContradiction || input.incident.properties?.aliasCollision === true || /alias|ambiguous/i.test(input.incident.value)) rules.push("alias_collision_hold");
  if (input.incident.properties?.oldCampaignReuse === true) rules.push("old_campaign_reuse_hold");
  if (input.incident.properties?.recurringVictimClaim === true) rules.push("recurring_victim_claim_hold");
  return [...new Set(rules)];
}

function incidentClaimSplitRules(input: {
  hasContradiction: boolean;
  actorNodeIds: string[];
  victimNodeIds: string[];
  campaignNodeIds: string[];
  incident: PersistedGraphNode;
}): GraphIncidentClaimWorkspaceDto["clusters"][number]["mergeSemantics"]["splitRequiredWhen"] {
  const rules: GraphIncidentClaimWorkspaceDto["clusters"][number]["mergeSemantics"]["splitRequiredWhen"] = ["distinct_incident_node"];
  if (input.hasContradiction) rules.push("contradictory_attribution");
  if (input.victimNodeIds.length > 1 || input.actorNodeIds.length > 1 && input.victimNodeIds.length > 1) rules.push("different_victim_same_day");
  if (input.campaignNodeIds.length > 1 || input.incident.properties?.renamedCampaign === true) rules.push("renamed_campaign_without_review");
  if (input.actorNodeIds.length > 1 || input.incident.properties?.oldCampaignReuse === true) rules.push("old_campaign_reuse_without_fresh_evidence");
  return [...new Set(rules)];
}

function actorTimelineConfidenceTrend(
  relationship: PersistedGraphRelationship,
  generatedAt: string
): GraphAttackTechniqueTimelineEventDto["confidenceTrend"] {
  if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true) return "contradicted";
  if (relationship.reviewState === "expired" || relationship.properties?.stale === true || ageInDays(relationship.lastSeenAt, generatedAt) > 90) return "stale";
  return attackTechniqueConfidenceTrend(relationship, generatedAt);
}

function actorTimelineContradictionState(
  relationship: PersistedGraphRelationship,
  exportBlockers: GraphIntegrityFindingCode[]
): GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]["contradictionState"] {
  if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true || exportBlockers.includes("contradicted_edge")) return "contradicted";
  if (relationship.properties?.sourceBiasCluster === true || exportBlockers.includes("source_bias_cluster")) return "suspected";
  return "none";
}

function actorTimelineEventKind(
  relationship: PersistedGraphRelationship,
  source: PersistedGraphNode,
  target: PersistedGraphNode,
  incidentClaimIds: string[]
): GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]["eventKind"] {
  if (incidentClaimIds.length > 0 || source.type === "incident" || target.type === "incident") return "incident_claim";
  if (source.type === "attack-pattern" || target.type === "attack-pattern") return "attack_technique";
  if (source.type === "campaign" || target.type === "campaign") return "campaign_change";
  if (source.type === "victim" || target.type === "victim") return "victim_targeting";
  if (source.type === "malware" || target.type === "malware" || source.type === "tool" || target.type === "tool") return "tooling_change";
  if (source.type === "vulnerability" || target.type === "vulnerability") return "vulnerability_change";
  if (source.type === "infrastructure" || target.type === "infrastructure" || source.type === "indicator" || target.type === "indicator") return "infrastructure_change";
  if (source.type === "source" || target.type === "source" || source.type === "report" || target.type === "report" || relationship.type === "derived-from" || relationship.type === "mentions") return "source_signal";
  return "relationship";
}

function actorTimelinePublicFactState(input: {
  relationship: PersistedGraphRelationship;
  readinessReady: boolean;
  exportBlockers: GraphIntegrityFindingCode[];
  ledgerIds: string[];
  freshness: GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]["freshness"];
  contradictionState: GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]["contradictionState"];
}): GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]["publicFactState"] {
  if (input.contradictionState === "contradicted" || input.exportBlockers.includes("contradicted_edge")) return "held_contradicted";
  if (input.ledgerIds.length === 0 || input.exportBlockers.includes("missing_ledger_ids") || input.exportBlockers.includes("missing_provenance")) return "held_missing_ledger";
  if (input.freshness === "stale" || input.exportBlockers.includes("stale_accepted_edge")) return "held_stale";
  if (
    input.relationship.exportEligibility.discoveryOnly
    || input.exportBlockers.includes("weak_discovery_only_edge")
    || input.exportBlockers.includes("restricted_only_claim")
    || input.exportBlockers.includes("unsupported_restricted_metadata")
  ) return "held_restricted_or_weak";
  return input.readinessReady && input.relationship.reviewState === "accepted" ? "eligible_reviewed_fact" : "held_for_review";
}

function actorTimelineChangeKind(
  event: GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]
): GraphActorTimelineChangeWorkspaceDto["campaignChanges"][number]["changeKind"] | undefined {
  if (event.actorNodeIds.length > 1 || event.eventKind === "relationship" && event.relationshipId.includes("alias")) return "actor_alias_change";
  if (event.campaignNodeIds.length > 0 || event.eventKind === "campaign_change") return "campaign_membership_change";
  if (event.ttpNodeIds.length > 0 || event.eventKind === "attack_technique") return "ttp_change";
  if (event.victimNodeIds.length > 0 || event.eventKind === "victim_targeting") return "targeting_change";
  if (event.malwareToolNodeIds.length > 0 || event.eventKind === "tooling_change") return "tooling_change";
  if (event.vulnerabilityNodeIds.length > 0 || event.eventKind === "vulnerability_change") return "vulnerability_change";
  if (event.infrastructureNodeIds.length > 0 || event.eventKind === "infrastructure_change") return "infrastructure_change";
  if (event.sourceFamilies.length > 1 || event.eventKind === "source_signal") return "source_family_change";
  if (event.incidentClaimIds.length > 0 || event.eventKind === "incident_claim") return "incident_claim_change";
  return undefined;
}

function actorTimelineRecommendedAction(
  event: GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]
): GraphActorTimelineChangeWorkspaceDto["campaignChanges"][number]["recommendedAction"] {
  if (event.publicFactState === "eligible_reviewed_fact") return "promote";
  if (event.publicFactState === "held_missing_ledger") return "request_evidence";
  if (event.publicFactState === "held_contradicted") return "attach_contradiction";
  if (event.publicFactState === "held_stale") return "mark_stale";
  if (event.publicFactState === "held_restricted_or_weak") return "hold_public_fact";
  return "hold";
}

function actorTimelineReleaseImpact(
  event: GraphActorTimelineChangeWorkspaceDto["timelineEvents"][number]
): GraphActorTimelineChangeWorkspaceDto["campaignChanges"][number]["releaseImpact"] {
  if (event.publicFactState === "held_contradicted" || event.publicFactState === "held_missing_ledger") return "rollback";
  if (event.publicFactState === "held_for_review" || event.publicFactState === "held_restricted_or_weak") return "hold";
  if (event.publicFactState === "held_stale" || event.contradictionState === "suspected") return "watch";
  return "promote";
}

function actorTimelineReleaseRank(impact: GraphActorTimelineChangeWorkspaceDto["campaignChanges"][number]["releaseImpact"]): number {
  if (impact === "rollback") return 4;
  if (impact === "hold") return 3;
  if (impact === "watch") return 2;
  return 1;
}

function buildGraphCampaignTimelineReviewBoard(input: {
  generatedAt: string;
  timeline: GraphAttackCampaignWorkspaceDto["techniqueTimeline"];
  nodes: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"];
  edges: GraphAttackCampaignWorkspaceDto["campaignGraph"]["edges"];
  reviewHolds: GraphAttackCampaignWorkspaceDto["reviewHolds"];
}): GraphAttackCampaignWorkspaceDto["reviewBoard"] {
  const nodesById = new Map(input.nodes.map((node) => [node.nodeId, node]));
  const timelineByRelationship = new Map<string, GraphAttackCampaignWorkspaceDto["techniqueTimeline"][number]>();
  for (const event of input.timeline) {
    for (const relationshipId of event.relationshipIds) {
      timelineByRelationship.set(relationshipId, event);
    }
  }
  const holdCodesByRelationship = new Map(input.reviewHolds.map((hold) => [hold.relationshipId, hold.reasonCodes]));
  const rows = input.edges
    .filter((edge) => edge.type === "uses" || edge.type === "attributed-to" || edge.type === "targets" || edge.type === "exploits")
    .map((edge) => {
      const source = nodesById.get(edge.sourceRef);
      const target = nodesById.get(edge.targetRef);
      const timelineEvent = timelineByRelationship.get(edge.relationshipId);
      const exportBlockers = uniqueFindingCodes([
        ...edge.exportBlockers,
        ...(holdCodesByRelationship.get(edge.relationshipId) ?? [])
      ]);
      const firstSeenAt = timelineEvent?.firstSeenAt ?? input.generatedAt;
      const lastSeenAt = timelineEvent?.lastSeenAt ?? input.generatedAt;
      const releaseImpact = campaignReviewReleaseImpact(edge, exportBlockers, timelineEvent?.confidenceTrend);
      return {
        rowId: stableId("campaign-review-row", `${edge.relationshipId}:${firstSeenAt}:${lastSeenAt}`),
        relationshipIds: [edge.relationshipId],
        campaignIds: uniqueSorted([
          ...(timelineEvent?.campaignIds ?? []),
          ...[source, target].filter((node): node is GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number] => node?.type === "campaign").map((node) => node.nodeId)
        ]),
        actorNodeIds: uniqueSorted([source, target].filter((node): node is GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number] => node?.type === "actor").map((node) => node.nodeId)),
        techniqueNodeIds: uniqueSorted([
          ...(timelineEvent ? [timelineEvent.techniqueNodeId] : []),
          ...[source, target].filter((node): node is GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number] => node?.type === "attack-pattern").map((node) => node.nodeId)
        ]),
        techniqueNames: uniqueSorted([
          ...(timelineEvent ? [timelineEvent.techniqueName] : []),
          ...[source, target].filter((node): node is GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number] => node?.type === "attack-pattern").map((node) => node.value)
        ]),
        attackIds: uniqueSorted(timelineEvent?.attackId ? [timelineEvent.attackId] : []),
        firstSeenAt,
        lastSeenAt,
        confidence: edge.confidence,
        confidenceTrend: timelineEvent?.confidenceTrend ?? campaignReviewConfidenceTrend(edge, exportBlockers),
        reviewState: edge.reviewState,
        workflowState: edge.workflowState,
        sourceIds: edge.sourceIds,
        evidenceIds: timelineEvent?.evidenceIds ?? [],
        ledgerIds: uniqueSorted([...edge.ledgerIds, ...(timelineEvent?.ledgerIds ?? [])]),
        exportEligible: edge.exportEligible,
        exportBlockers,
        recommendedAction: campaignReviewRecommendedAction(edge, exportBlockers, timelineEvent?.confidenceTrend),
        releaseImpact
      };
    })
    .sort((left, right) => campaignReleaseRank(right.releaseImpact) - campaignReleaseRank(left.releaseImpact) || right.confidence - left.confidence || left.rowId.localeCompare(right.rowId));
  const lanes = campaignReviewBoardLanes(rows);
  return {
    mode: "enterprise_campaign_timeline_review_board",
    generatedAt: input.generatedAt,
    lanes,
    rows,
    summary: {
      rowCount: rows.length,
      readyRows: rows.filter((row) => row.releaseImpact === "promote").length,
      holdRows: rows.filter((row) => row.releaseImpact === "hold").length,
      rollbackRows: rows.filter((row) => row.releaseImpact === "rollback").length,
      staleOrContradictedRows: rows.filter((row) => row.confidenceTrend === "stale" || row.confidenceTrend === "contradicted").length,
      restrictedOrPolicyRows: rows.filter((row) => row.exportBlockers.some((code) => code === "restricted_only_claim" || code === "unsupported_restricted_metadata")).length,
      publicFactPolicy: "promote_reviewed_only_hold_everything_else"
    },
    safety: {
      metadataOnly: true,
      rawRestrictedMaterialIncluded: false,
      taxiiBoundary: "descriptor_only_no_server"
    }
  };
}

function campaignReviewBoardLanes(
  rows: GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"]
): GraphAttackCampaignWorkspaceDto["reviewBoard"]["lanes"] {
  const laneSpecs: Array<{
    lane: GraphAttackCampaignWorkspaceDto["reviewBoard"]["lanes"][number]["lane"];
    match: (row: GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"][number]) => boolean;
    recommendedAction: GraphAttackCampaignWorkspaceDto["reviewBoard"]["lanes"][number]["recommendedAction"];
    releaseImpact: GraphAttackCampaignWorkspaceDto["reviewBoard"]["lanes"][number]["releaseImpact"];
  }> = [
    { lane: "ready_for_public_fact", match: (row) => row.exportEligible && row.reviewState === "accepted", recommendedAction: "mark_export_ready", releaseImpact: "promote" },
    { lane: "needs_evidence", match: (row) => row.exportBlockers.includes("missing_ledger_ids") || row.exportBlockers.includes("missing_provenance"), recommendedAction: "request_evidence", releaseImpact: "hold" },
    { lane: "stale_or_contradicted", match: (row) => row.confidenceTrend === "stale" || row.confidenceTrend === "contradicted" || row.reviewState === "contradicted" || row.reviewState === "expired", recommendedAction: "attach_contradiction", releaseImpact: "hold" },
    { lane: "restricted_or_policy_hold", match: (row) => row.exportBlockers.includes("restricted_only_claim") || row.exportBlockers.includes("unsupported_restricted_metadata"), recommendedAction: "hold_public_fact", releaseImpact: "hold" },
    { lane: "export_blocked", match: (row) => !row.exportEligible, recommendedAction: "hold", releaseImpact: "rollback" }
  ];
  return laneSpecs.map((spec) => {
    const laneRows = rows.filter(spec.match);
    return {
      lane: spec.lane,
      relationshipIds: uniqueSorted(laneRows.flatMap((row) => row.relationshipIds)).slice(0, 25),
      count: laneRows.length,
      recommendedAction: spec.recommendedAction,
      releaseImpact: spec.releaseImpact
    };
  });
}

function buildGraphAttackCampaignFreshnessSloDto(input: {
  generatedAt: string;
  reviewBoard: GraphAttackCampaignWorkspaceDto["reviewBoard"];
  timeline: GraphAttackCampaignWorkspaceDto["techniqueTimeline"];
  nodes: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"];
}): GraphAttackCampaignFreshnessSloDto {
  const timelineByRelationship = new Map<string, GraphAttackTechniqueTimelineEventDto>();
  for (const event of input.timeline) {
    for (const relationshipId of event.relationshipIds) {
      timelineByRelationship.set(relationshipId, event);
    }
  }
  const nodeById = new Map(input.nodes.map((node) => [node.nodeId, node]));
  const defaultTargetDays = 45;
  const warningRatio = 0.75;
  const breachRatio = 1;
  const rows = input.reviewBoard.rows.map((row): GraphAttackCampaignFreshnessSloDto["rows"][number] => {
    const timelineEvent = row.relationshipIds.map((relationshipId) => timelineByRelationship.get(relationshipId)).find((event): event is GraphAttackTechniqueTimelineEventDto => Boolean(event));
    const tactic = timelineEvent?.tactic ?? "unknown";
    const targetDays = attackCampaignFreshnessTargetDays(tactic);
    const ageDays = roundMetric(ageInDays(row.lastSeenAt, input.generatedAt));
    const missingEvidenceReplay = row.exportBlockers.includes("missing_ledger_ids") || row.exportBlockers.includes("missing_provenance") || row.ledgerIds.length === 0;
    const techniqueLifecycle = attackCampaignTechniqueLifecycle(row.attackIds, row.techniqueNames);
    const aliasDrift = attackCampaignAliasDrift(row, nodeById);
    const contradictionState = attackCampaignContradictionState(row);
    const freshnessState = attackCampaignFreshnessState({
      ageDays,
      targetDays,
      confidenceTrend: row.confidenceTrend,
      reviewState: row.reviewState,
      exportEligible: row.exportEligible,
      exportBlockers: row.exportBlockers,
      techniqueLifecycleState: techniqueLifecycle.state,
      aliasDriftState: aliasDrift.state,
      contradictionState,
      warningRatio,
      breachRatio
    });
    const exportBlockers = uniqueFindingCodes([
      ...row.exportBlockers,
      ...(freshnessState === "warning" || freshnessState === "breach" ? ["stale_accepted_edge" as const] : []),
      ...(missingEvidenceReplay ? ["missing_ledger_ids" as const] : []),
      ...(techniqueLifecycle.state === "deprecated_or_revoked" ? ["deprecated_attack_technique" as const] : []),
      ...(aliasDrift.state !== "none" ? ["attack_alias_drift" as const] : []),
      ...(contradictionState !== "none" ? ["contradicted_edge" as const] : [])
    ]);
    return {
      rowId: stableId("attack-campaign-freshness-slo-row", `${row.rowId}:${row.lastSeenAt}:${targetDays}`),
      relationshipIds: row.relationshipIds,
      campaignIds: row.campaignIds,
      actorNodeIds: row.actorNodeIds,
      techniqueNodeIds: row.techniqueNodeIds,
      attackIds: row.attackIds,
      tactic,
      lastSeenAt: row.lastSeenAt,
      ageDays,
      targetDays,
      freshnessState,
      confidenceTrend: row.confidenceTrend,
      techniqueLifecycle,
      aliasDrift,
      contradictionState,
      reviewState: row.reviewState,
      exportEligible: row.exportEligible && freshnessState === "current" && exportBlockers.length === 0,
      exportEligibilityDecision: attackCampaignExportEligibilityDecision({
        freshnessState,
        missingEvidenceReplay,
        techniqueLifecycleState: techniqueLifecycle.state,
        aliasDriftState: aliasDrift.state,
        contradictionState,
        exportBlockers
      }),
      exportBlockers,
      recommendedAction: attackCampaignFreshnessAction(freshnessState, missingEvidenceReplay, exportBlockers),
      releaseImpact: attackCampaignFreshnessReleaseImpact(freshnessState, row.releaseImpact, missingEvidenceReplay),
      sourceIds: row.sourceIds,
      evidenceIds: row.evidenceIds,
      ledgerIds: row.ledgerIds
    };
  }).sort((left, right) =>
    attackCampaignFreshnessStateRank(right.freshnessState) - attackCampaignFreshnessStateRank(left.freshnessState)
    || right.ageDays - left.ageDays
    || left.rowId.localeCompare(right.rowId)
  );
  const sourceCadenceRequests = rows
    .filter((row) => row.freshnessState !== "current" || row.exportBlockers.includes("missing_ledger_ids") || row.exportBlockers.includes("missing_provenance"))
    .map((row): GraphAttackCampaignFreshnessSloDto["sourceCadenceRequests"][number] => ({
      requestId: stableId("attack-campaign-freshness-request", `${row.rowId}:${row.freshnessState}:${row.sourceIds.join(",")}`),
      relationshipIds: row.relationshipIds,
      sourceIds: row.sourceIds,
      reason: attackCampaignFreshnessRequestReason(row),
      owner: attackCampaignFreshnessRequestOwner(row),
      dryRun: true
    }))
    .slice(0, 25);

  return {
    mode: "attack_campaign_freshness_slo",
    generatedAt: input.generatedAt,
    policy: {
      defaultTargetDays,
      warningRatio,
      breachRatio,
      publicFactPolicy: "hold_stale_or_unreviewed_campaign_ttp_rows",
      taxiiBoundary: "descriptor_only_no_server"
    },
    summary: {
      rowCount: rows.length,
      currentRows: rows.filter((row) => row.freshnessState === "current").length,
      warningRows: rows.filter((row) => row.freshnessState === "warning").length,
      breachRows: rows.filter((row) => row.freshnessState === "breach").length,
      heldRows: rows.filter((row) => row.freshnessState === "held").length,
      deprecatedTechniqueRows: rows.filter((row) => row.techniqueLifecycle.state === "deprecated_or_revoked").length,
      aliasDriftRows: rows.filter((row) => row.aliasDrift.state !== "none").length,
      contradictionRows: rows.filter((row) => row.contradictionState !== "none").length,
      exportEligibleRows: rows.filter((row) => row.exportEligible).length,
      sourceExpansionRequests: sourceCadenceRequests.filter((request) => request.owner === "agent_01" || request.owner === "agent_04").length,
      evidenceReplayRequests: sourceCadenceRequests.filter((request) => request.owner === "agent_06").length
    },
    rows,
    sourceCadenceRequests,
    deltaContract: {
      cursorField: "graph.deltas[].cursor",
      nextPollSeconds: 3,
      eventTypes: ["graph.attack_campaign.freshness_warning", "graph.attack_campaign.freshness_breach", "graph.attack_campaign.freshness_hold"]
    },
    handoffs: {
      agent01SourceActivation: "review_source_pack_freshness_debt",
      agent02SchedulerCadence: "raise_campaign_ttp_collection_cadence_dry_run",
      agent04CoverageRadar: "expand_safe_public_campaign_sources",
      agent06EvidenceReplay: "replay_missing_or_stale_campaign_ttp_evidence",
      agent07QualityReview: "keep_stale_or_contradicted_rows_out_of_public_facts",
      agent09ApiCompatibility: "stable_3_second_polling_freshness_slo_packet",
      agent10ReleaseGate: "hold_release_when_campaign_freshness_breaches_lack_review"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

function attackCampaignFreshnessTargetDays(tactic: AttackTactic): number {
  if (tactic === "initial-access" || tactic === "execution" || tactic === "command-and-control" || tactic === "impact") return 30;
  if (tactic === "unknown") return 60;
  return 45;
}

function attackCampaignFreshnessState(input: {
  ageDays: number;
  targetDays: number;
  confidenceTrend: GraphAttackTechniqueTimelineEventDto["confidenceTrend"];
  reviewState: GraphRelationshipReviewState;
  exportEligible: boolean;
  exportBlockers: GraphIntegrityFindingCode[];
  techniqueLifecycleState: GraphAttackCampaignFreshnessSloDto["rows"][number]["techniqueLifecycle"]["state"];
  aliasDriftState: GraphAttackCampaignFreshnessSloDto["rows"][number]["aliasDrift"]["state"];
  contradictionState: GraphAttackCampaignFreshnessSloDto["rows"][number]["contradictionState"];
  warningRatio: number;
  breachRatio: number;
}): GraphAttackCampaignFreshnessSloDto["rows"][number]["freshnessState"] {
  if (input.techniqueLifecycleState === "deprecated_or_revoked" || input.aliasDriftState !== "none" || input.contradictionState === "contradicted") return "held";
  if (input.confidenceTrend === "contradicted" || input.reviewState === "contradicted" || input.exportBlockers.includes("contradicted_edge")) return "held";
  if (input.confidenceTrend === "stale" || input.reviewState === "expired" || input.ageDays >= input.targetDays * input.breachRatio) return "breach";
  if (!input.exportEligible || input.exportBlockers.length > 0) return "held";
  if (input.ageDays >= input.targetDays * input.warningRatio) return "warning";
  return "current";
}

function attackCampaignFreshnessAction(
  state: GraphAttackCampaignFreshnessSloDto["rows"][number]["freshnessState"],
  missingEvidenceReplay: boolean,
  blockers: GraphIntegrityFindingCode[]
): GraphAttackCampaignFreshnessSloDto["rows"][number]["recommendedAction"] {
  if (missingEvidenceReplay) return "request_evidence_replay";
  if (blockers.includes("source_bias_cluster") || blockers.includes("weak_discovery_only_edge")) return "request_source_expansion";
  if (state === "breach") return "mark_stale";
  if (state === "warning") return "raise_cadence";
  if (state === "held") return "hold_export";
  return "keep_current";
}

function attackCampaignFreshnessReleaseImpact(
  state: GraphAttackCampaignFreshnessSloDto["rows"][number]["freshnessState"],
  currentImpact: GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"][number]["releaseImpact"],
  missingEvidenceReplay: boolean
): GraphAttackCampaignFreshnessSloDto["rows"][number]["releaseImpact"] {
  if (currentImpact === "rollback") return "rollback";
  if (missingEvidenceReplay || state === "held" || state === "breach") return "hold";
  if (state === "warning") return "watch";
  return currentImpact === "promote" ? "promote" : currentImpact;
}

function attackCampaignFreshnessRequestReason(
  row: GraphAttackCampaignFreshnessSloDto["rows"][number]
): GraphAttackCampaignFreshnessSloDto["sourceCadenceRequests"][number]["reason"] {
  if (row.exportBlockers.includes("missing_ledger_ids") || row.exportBlockers.includes("missing_provenance")) return "missing_evidence_replay";
  if (row.recommendedAction === "request_source_expansion") return "source_gap";
  if (row.freshnessState === "breach" || row.freshnessState === "held") return "freshness_breach";
  return "freshness_warning";
}

function attackCampaignFreshnessRequestOwner(
  row: GraphAttackCampaignFreshnessSloDto["rows"][number]
): GraphAttackCampaignFreshnessSloDto["sourceCadenceRequests"][number]["owner"] {
  if (row.exportBlockers.includes("missing_ledger_ids") || row.exportBlockers.includes("missing_provenance")) return "agent_06";
  if (row.recommendedAction === "request_source_expansion") return "agent_04";
  if (row.sourceIds.length === 0) return "agent_01";
  return "agent_02";
}

function attackCampaignFreshnessStateRank(state: GraphAttackCampaignFreshnessSloDto["rows"][number]["freshnessState"]): number {
  if (state === "held") return 4;
  if (state === "breach") return 3;
  if (state === "warning") return 2;
  return 1;
}

const DEPRECATED_OR_REVOKED_ATTACK_IDS = new Set(["T1066", "T1086", "T1111"]);

function attackCampaignTechniqueLifecycle(
  attackIds: string[],
  techniqueNames: string[]
): GraphAttackCampaignFreshnessSloDto["rows"][number]["techniqueLifecycle"] {
  const deprecatedAttackId = attackIds.find((attackId) => DEPRECATED_OR_REVOKED_ATTACK_IDS.has(attackId.toUpperCase()));
  const deprecatedText = [...attackIds, ...techniqueNames].find((value) => /\b(?:deprecated|revoked|legacy)\b/i.test(value));
  if (deprecatedAttackId || deprecatedText) {
    return {
      state: "deprecated_or_revoked",
      replacementRequired: true,
      reviewReason: deprecatedAttackId
        ? `${deprecatedAttackId} is treated as deprecated or revoked until a reviewed replacement ATT&CK technique is selected`
        : "Technique text indicates a deprecated, revoked, or legacy ATT&CK mapping"
    };
  }
  return {
    state: attackIds.length > 0 ? "current" : "unknown",
    replacementRequired: false
  };
}

function attackCampaignAliasDrift(
  row: GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"][number],
  nodeById: Map<string, GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number]>
): GraphAttackCampaignFreshnessSloDto["rows"][number]["aliasDrift"] {
  const actorValues = uniqueSorted(row.actorNodeIds
    .map((nodeId) => nodeById.get(nodeId)?.value)
    .filter((value): value is string => Boolean(value)));
  const reasonCodes = uniqueFindingCodes([
    ...(row.exportBlockers.includes("source_bias_cluster") ? ["source_bias_cluster" as const] : []),
    ...(row.exportBlockers.includes("contradicted_edge") ? ["contradicted_edge" as const] : []),
    ...(row.actorNodeIds.length > 1 ? ["attack_alias_drift" as const] : [])
  ]);
  const state: GraphAttackCampaignFreshnessSloDto["rows"][number]["aliasDrift"]["state"] = row.reviewState === "contradicted" && actorValues.length > 0
    ? "split_required"
    : reasonCodes.length > 0
      ? "needs_review"
      : "none";

  return {
    state,
    actorNodeIds: row.actorNodeIds,
    actorValues,
    reasonCodes
  };
}

function attackCampaignContradictionState(
  row: GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"][number]
): GraphAttackCampaignFreshnessSloDto["rows"][number]["contradictionState"] {
  if (row.reviewState === "contradicted" || row.confidenceTrend === "contradicted" || row.exportBlockers.includes("contradicted_edge")) return "contradicted";
  if (row.releaseImpact === "hold" && row.exportBlockers.includes("source_bias_cluster")) return "suspected";
  return "none";
}

function attackCampaignExportEligibilityDecision(input: {
  freshnessState: GraphAttackCampaignFreshnessSloDto["rows"][number]["freshnessState"];
  missingEvidenceReplay: boolean;
  techniqueLifecycleState: GraphAttackCampaignFreshnessSloDto["rows"][number]["techniqueLifecycle"]["state"];
  aliasDriftState: GraphAttackCampaignFreshnessSloDto["rows"][number]["aliasDrift"]["state"];
  contradictionState: GraphAttackCampaignFreshnessSloDto["rows"][number]["contradictionState"];
  exportBlockers: GraphIntegrityFindingCode[];
}): GraphAttackCampaignFreshnessSloDto["rows"][number]["exportEligibilityDecision"] {
  if (input.contradictionState !== "none") return "hold_contradiction";
  if (input.aliasDriftState !== "none") return "hold_alias_drift";
  if (input.techniqueLifecycleState === "deprecated_or_revoked") return "hold_deprecated_attack_mapping";
  if (input.missingEvidenceReplay) return "hold_missing_evidence";
  if (input.freshnessState === "warning" || input.freshnessState === "breach") return "hold_stale_or_breached";
  if (input.freshnessState === "current" && input.exportBlockers.length === 0) return "eligible_current_reviewed";
  return "hold_unreviewed_or_blocked";
}

function campaignReviewReleaseImpact(
  edge: GraphAttackCampaignWorkspaceDto["campaignGraph"]["edges"][number],
  exportBlockers: GraphIntegrityFindingCode[],
  trend?: GraphAttackTechniqueTimelineEventDto["confidenceTrend"]
): GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"][number]["releaseImpact"] {
  if (exportBlockers.some((code) => code === "export_schema_risk" || code === "unsupported_edge" || code === "orphan_relationship")) return "rollback";
  if (!edge.exportEligible || edge.reviewState !== "accepted") return "hold";
  if (trend === "stale" || trend === "contradicted") return "watch";
  return "promote";
}

function campaignReviewRecommendedAction(
  edge: GraphAttackCampaignWorkspaceDto["campaignGraph"]["edges"][number],
  exportBlockers: GraphIntegrityFindingCode[],
  trend?: GraphAttackTechniqueTimelineEventDto["confidenceTrend"]
): GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"][number]["recommendedAction"] {
  if (edge.exportEligible && edge.reviewState === "accepted") return "mark_export_ready";
  if (trend === "contradicted" || edge.reviewState === "contradicted" || exportBlockers.includes("contradicted_edge")) return "attach_contradiction";
  if (trend === "stale" || edge.reviewState === "expired" || exportBlockers.includes("stale_accepted_edge")) return "mark_stale";
  if (exportBlockers.includes("missing_ledger_ids") || exportBlockers.includes("missing_provenance")) return "request_evidence";
  if (exportBlockers.includes("restricted_only_claim") || exportBlockers.includes("unsupported_restricted_metadata")) return "hold_public_fact";
  if (!edge.exportEligible) return "hold";
  return "promote";
}

function campaignReviewConfidenceTrend(
  edge: GraphAttackCampaignWorkspaceDto["campaignGraph"]["edges"][number],
  exportBlockers: GraphIntegrityFindingCode[]
): GraphAttackTechniqueTimelineEventDto["confidenceTrend"] {
  if (edge.reviewState === "contradicted" || exportBlockers.includes("contradicted_edge")) return "contradicted";
  if (edge.reviewState === "expired" || exportBlockers.includes("stale_accepted_edge")) return "stale";
  if (edge.confidence >= 0.8) return "stable";
  if (edge.confidence < 0.5) return "falling";
  return "new";
}

function campaignReleaseRank(impact: GraphAttackCampaignWorkspaceDto["reviewBoard"]["rows"][number]["releaseImpact"]): number {
  if (impact === "rollback") return 4;
  if (impact === "hold") return 3;
  if (impact === "watch") return 2;
  return 1;
}

function buildGraphPivotQueues(
  nodes: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"],
  edges: GraphAttackCampaignWorkspaceDto["campaignGraph"]["edges"]
): GraphAttackCampaignWorkspaceDto["pivotQueues"] {
  return nodes
    .filter((node) => node.relationshipIds.length > 0)
    .map((node) => {
      const nodeEdges = edges.filter((edge) => edge.sourceRef === node.nodeId || edge.targetRef === node.nodeId);
      const held = nodeEdges.filter((edge) => !edge.exportEligible || edge.reviewState !== "accepted");
      const ready = nodeEdges.filter((edge) => edge.exportEligible && edge.reviewState === "accepted");
      const nextActions = new Set<GraphAttackCampaignWorkspaceDto["pivotQueues"][number]["nextActions"][number]>(["open_neighborhood"]);
      if (held.length > 0) {
        nextActions.add("request_evidence");
        nextActions.add("hold_export");
      }
      if (ready.length > 0) nextActions.add("promote_reviewed");
      return {
        pivotType: node.type,
        nodeIds: [node.nodeId],
        relationshipIds: node.relationshipIds,
        nextActions: [...nextActions].sort(),
        priority: pivotPriority(node, held.length, ready.length),
        reason: pivotReason(node, held.length, ready.length)
      };
    })
    .sort((left, right) => pivotPriorityRank(right.priority) - pivotPriorityRank(left.priority) || right.relationshipIds.length - left.relationshipIds.length || left.pivotType.localeCompare(right.pivotType))
    .slice(0, 25);
}

function buildGraphSearchPivotRecommendations(
  nodes: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"],
  edges: GraphAttackCampaignWorkspaceDto["campaignGraph"]["edges"],
  pivotQueues: GraphAttackCampaignWorkspaceDto["pivotQueues"]
): GraphAttackCampaignWorkspaceDto["searchPivotRecommendations"] {
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  return pivotQueues
    .flatMap((pivot) => pivot.nodeIds.map((nodeId) => {
      const node = nodesById.get(nodeId);
      if (!node) return undefined;
      const nodeEdges = edges.filter((edge) => edge.sourceRef === node.nodeId || edge.targetRef === node.nodeId);
      const held = nodeEdges.filter((edge) => !edge.exportEligible || edge.reviewState !== "accepted");
      const ready = nodeEdges.filter((edge) => edge.exportEligible && edge.reviewState === "accepted");
      return {
        query: graphSearchPivotQuery(node),
        pivotType: node.type,
        nodeId: node.nodeId,
        nodeValue: node.value,
        sourceRelationshipIds: node.relationshipIds,
        confidence: node.confidence,
        priority: pivot.priority,
        reason: graphSearchPivotReason(node, held.length, ready.length),
        expectedSearchEffect: graphSearchPivotEffect(held.length, ready.length),
        safety: {
          willStartCrawling: false,
          willFetchRestrictedMaterial: false,
          metadataOnly: true,
          taxiiBoundary: "descriptor_only_no_server"
        }
      } satisfies GraphAttackCampaignWorkspaceDto["searchPivotRecommendations"][number];
    }))
    .filter((item): item is GraphAttackCampaignWorkspaceDto["searchPivotRecommendations"][number] => Boolean(item))
    .sort((left, right) => pivotPriorityRank(right.priority) - pivotPriorityRank(left.priority) || right.confidence - left.confidence || left.query.localeCompare(right.query))
    .slice(0, 25);
}

function graphSearchPivotQuery(node: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number]): string {
  if (node.type === "attack-pattern") return `technique:${node.value}`;
  if (node.type === "vulnerability") return `cve:${node.value}`;
  if (node.type === "infrastructure") return `infrastructure:${node.value}`;
  if (node.type === "malware" || node.type === "tool") return `tooling:${node.value}`;
  if (node.type === "victim") return `victim:${node.value}`;
  if (node.type === "campaign") return `campaign:${node.value}`;
  return `actor:${node.value}`;
}

function graphSearchPivotReason(
  node: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number],
  heldCount: number,
  readyCount: number
): string {
  if (heldCount > 0) return `Search ${node.value} to corroborate ${heldCount} held graph relationship${heldCount === 1 ? "" : "s"} before public/STIX promotion.`;
  if (readyCount > 0) return `Search ${node.value} to expand reviewed graph context from ${readyCount} export-ready relationship${readyCount === 1 ? "" : "s"}.`;
  return `Search ${node.value} as a bounded graph neighborhood pivot.`;
}

function graphSearchPivotEffect(
  heldCount: number,
  readyCount: number
): GraphAttackCampaignWorkspaceDto["searchPivotRecommendations"][number]["expectedSearchEffect"] {
  if (heldCount > 0) return "corroborate_hold";
  if (readyCount > 0) return "promote_reviewed_fact";
  return "open_graph_neighborhood";
}

function pivotPriority(
  node: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number],
  heldCount: number,
  readyCount: number
): GraphAttackCampaignWorkspaceDto["pivotQueues"][number]["priority"] {
  if ((node.type === "campaign" || node.type === "attack-pattern" || node.type === "vulnerability") && heldCount > 0) return "high";
  if (readyCount > 0 || node.relationshipIds.length >= 2) return "medium";
  return "low";
}

function pivotPriorityRank(priority: GraphAttackCampaignWorkspaceDto["pivotQueues"][number]["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function pivotReason(
  node: GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number],
  heldCount: number,
  readyCount: number
): string {
  if (heldCount > 0) return `${node.type} pivot has ${heldCount} review/export hold${heldCount === 1 ? "" : "s"}`;
  if (readyCount > 0) return `${node.type} pivot has ${readyCount} reviewed export-ready relationship${readyCount === 1 ? "" : "s"}`;
  return `${node.type} pivot is visible for bounded neighborhood expansion`;
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

function buildInvestigationWorkflowContracts(
  query: string,
  focusNodeId: string | undefined,
  nodes: GraphInvestigationWorkspaceDto["nodes"],
  ledger: GraphInvestigationWorkspaceDto["relationshipConfidenceLedger"]
): GraphInvestigationWorkspaceDto["workflowContracts"] {
  const maxPivotRelationships = 25;
  const boundedRelationshipIds = ledger.slice(0, maxPivotRelationships).map((entry) => entry.relationshipId);
  const eligibleRelationshipIds = ledger.filter((entry) => entry.exportEligible).map((entry) => entry.relationshipId);
  const heldRelationshipIds = ledger.filter((entry) => !entry.exportEligible).map((entry) => entry.relationshipId);
  const allowedActions = uniqueInvestigationActions(ledger.flatMap((entry) => entry.allowedActions));
  return {
    openInvestigation: {
      endpoint: "/v1/graph/investigations",
      method: "POST",
      mode: "contract_only_dry_run",
      requestFields: ["runId", "query", "focusNodeId", "tenantId", "maxPivotRelationships", "cursor"],
      responseFields: ["investigationId", "nodeIds", "relationshipIds", "nextCursor", "reviewQueue", "exportEligibility"],
      investigationId: stableId("graph_investigation", `${query}:${focusNodeId ?? "root"}:${boundedRelationshipIds.join("|")}`),
      boundedRelationshipIds,
      nextCursor: ledger.length > maxPivotRelationships ? `relationship:${ledger[maxPivotRelationships]?.relationshipId}` : undefined,
      tenantScoped: true
    },
    savePivotSet: {
      endpoint: "/v1/graph/investigations/{investigationId}/pivots",
      method: "POST",
      mode: "dry_run_until_persistent_review_store",
      maxPivotRelationships,
      pivotRelationshipIds: boundedRelationshipIds,
      cursorStable: true,
      willMutate: false
    },
    reviewRelationship: {
      endpoint: "/v1/graph/relationships/{relationshipId}/review",
      method: "POST",
      mode: "dry_run_or_existing_review_state_only",
      allowedActions,
      relationshipIds: boundedRelationshipIds,
      resultingReviewStates: uniqueReviewStates(ledger.map((entry) => reviewStateAfterInvestigationAction(entry.allowedActions[0], entry.reviewState))),
      requiredProvenanceFields: ["relationshipId", "evidenceIds", "ledgerIds", "sourceIds", "reviewedBy", "reviewReason"],
      willMutateWithoutApproval: false
    },
    exportReviewedSubset: {
      endpoint: "/v1/graph/investigations/{investigationId}/exports/stix",
      method: "POST",
      mode: "contract_only_export_preview",
      eligibleRelationshipIds,
      heldRelationshipIds,
      mediaType: STIX_21_MEDIA_TYPE,
      taxiiBoundary: "descriptor_only_no_server"
    }
  };
}

function uniqueInvestigationActions(actions: GraphInvestigationWorkspaceReviewAction[]): GraphInvestigationWorkspaceReviewAction[] {
  const order: GraphInvestigationWorkspaceReviewAction[] = ["promote", "hold", "reject", "mark_stale", "merge_duplicate", "split_alias_collision", "attach_contradiction", "mark_export_ready"];
  const actionSet = new Set(actions);
  return order.filter((action) => actionSet.has(action));
}

function reviewStateAfterInvestigationAction(
  action: GraphInvestigationWorkspaceReviewAction | undefined,
  fallback: GraphRelationshipReviewState
): GraphRelationshipReviewState {
  if (action === "promote" || action === "mark_export_ready") return "accepted";
  if (action === "hold") return "needs_review";
  if (action === "reject") return "rejected";
  if (action === "mark_stale") return "expired";
  if (action === "attach_contradiction") return "contradicted";
  return fallback;
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
    persistence: buildGraphReviewPersistenceLedgerDto(snapshot, {
      generatedAt: plan.generatedAt
    }),
    exportGovernance: buildReviewedExportSubsetGovernanceDto(snapshot, {
      generatedAt: plan.generatedAt
    }),
    actions: plan.items
  };
}

function reviewPersistenceDecision(
  snapshot: PersistedGraphSnapshot,
  relationship: PersistedGraphRelationship,
  readinessById: Map<string, StixExportReadinessReportDto["relationships"][number]>,
  generatedAt: string
): GraphReviewPersistenceLedgerDto["decisions"][number] {
  const support = supportFor(snapshot, relationship.id);
  const readiness = readinessById.get(relationship.id);
  const action = reviewPersistenceActionFor(relationship, readiness);
  return {
    decisionId: stableId("graph-review-decision", `${relationship.id}:${action}:${relationship.reviewState}:${generatedAt}`),
    relationshipId: relationship.id,
    action,
    persistedReviewState: persistedReviewStateAfterAction(relationship, action),
    reviewerId: action === "promote" || action === "mark_export_ready" ? "analyst_required" : "system_policy",
    reason: reviewPersistenceReason(relationship, action, readiness?.blockers ?? []),
    decidedAt: generatedAt,
    sourceIds: uniqueSorted(support.map((item) => item.sourceId)),
    evidenceIds: relationship.evidenceSupportIds,
    captureIds: uniqueSorted(support.map((item) => item.captureId)),
    ledgerIds: uniqueSorted(support.flatMap((item) => item.ledgerIds)),
    qualityCorrectionIds: qualityCorrectionIdsFor(relationship),
    appendOnly: true,
    exportEligibleAfterDecision: action === "mark_export_ready" || (action === "promote" && readiness?.ready === true),
    rollbackDecisionId: stableId("graph-review-rollback", `${relationship.id}:${action}:${generatedAt}`)
  };
}

function reviewPersistenceActionFor(
  relationship: PersistedGraphRelationship,
  readiness?: StixExportReadinessReportDto["relationships"][number]
): GraphReviewPersistenceAction {
  const blockers = readiness?.blockers ?? [];
  if (relationship.type === "alias-of" && relationship.reviewState === "contradicted") return "split_alias";
  if (relationship.type === "alias-of" && relationship.reviewState === "accepted" && readiness?.ready === true) return "merge_duplicate";
  if (relationship.reviewState === "rejected") return "reject";
  if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true || blockers.includes("contradicted_edge")) return "mark_contradicted";
  if (relationship.reviewState === "expired" || relationship.properties?.stale === true || blockers.includes("stale_accepted_edge")) return "mark_stale";
  if (relationship.reviewState === "accepted" && readiness?.ready === true) return "mark_export_ready";
  if (relationship.confidence >= 0.75 && relationship.reviewState !== "accepted" && blockers.length === 0) return "promote";
  return "hold";
}

function persistedReviewStateAfterAction(
  relationship: PersistedGraphRelationship,
  action: GraphReviewPersistenceAction
): GraphRelationshipReviewState {
  if (action === "promote" || action === "mark_export_ready" || action === "merge_duplicate") return "accepted";
  if (action === "reject") return "rejected";
  if (action === "mark_contradicted" || action === "split_alias") return "contradicted";
  if (action === "mark_stale") return "expired";
  return relationship.reviewState === "unreviewed" ? "needs_review" : relationship.reviewState;
}

function reviewPersistenceReason(
  relationship: PersistedGraphRelationship,
  action: GraphReviewPersistenceAction,
  blockers: GraphIntegrityFindingCode[]
): string {
  if (action === "mark_export_ready") return "relationship is accepted, provenance-backed, and export eligible";
  if (action === "promote") return "relationship has sufficient confidence and no export blockers but still requires analyst approval";
  if (action === "reject") return "relationship is rejected and remains excluded from public/STIX facts";
  if (action === "mark_contradicted") return "contradictory relationship evidence must be persisted as a hold";
  if (action === "mark_stale") return "stale relationship state is persisted before export subset generation";
  if (action === "merge_duplicate") return "accepted alias relationship can be persisted as duplicate merge evidence";
  if (action === "split_alias") return "contradicted alias relationship requires split-alias review state";
  return blockers.length > 0 ? `relationship held by ${blockers.join(",")}` : "relationship held pending analyst review or stronger provenance";
}

function qualityCorrectionIdsFor(relationship: PersistedGraphRelationship): string[] {
  const explicit = relationship.properties?.qualityCorrectionIds ?? relationship.properties?.qualityCorrectionId;
  if (Array.isArray(explicit) && explicit.every((item) => typeof item === "string")) return uniqueSorted(explicit);
  if (typeof explicit === "string") return [explicit];
  if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true) return [stableId("quality-correction", `${relationship.id}:contradiction`)];
  if (relationship.properties?.stale === true || relationship.reviewState === "expired") return [stableId("quality-correction", `${relationship.id}:stale`)];
  return [];
}

export function buildGraphReviewPersistenceLedgerDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
  } = {}
): GraphReviewPersistenceLedgerDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const scopedSnapshot = {
    ...snapshot,
    relationships,
    evidenceSupport: snapshot.evidenceSupport.filter((support) => relationships.some((relationship) => relationship.id === support.relationshipId))
  };
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const deltas = buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const decisions = relationships
    .map((relationship) => reviewPersistenceDecision(scopedSnapshot, relationship, readinessById, generatedAt))
    .sort((left, right) => left.relationshipId.localeCompare(right.relationshipId));

  return {
    mode: "graph_review_persistence_contract",
    generatedAt,
    decisionActions: ["promote", "hold", "reject", "mark_stale", "mark_contradicted", "merge_duplicate", "split_alias", "mark_export_ready"],
    decisions,
    reviewStateCounts: countBy(relationships.map((relationship) => relationship.reviewState)).map(({ code, count }) => ({ reviewState: code, count })),
    cursorContinuity: {
      cursorField: "graph.deltas[].cursor",
      latestCursor: deltas[0]?.cursor,
      replayableRelationshipIds: uniqueSorted(deltas.map((delta) => delta.relationshipId)).slice(0, 25),
      replayProof: "decision_rows_replay_before_export_subset_generation"
    },
    rollbackPlan: {
      strategy: "append_compensating_review_decision",
      rollbackOnlyActions: ["reject", "mark_stale", "mark_contradicted"],
      willDeleteAuditRows: false,
      willRewriteEvidence: false
    },
    apiDtoStability: {
      relationshipIdStable: true,
      decisionIdStable: true,
      exportSubsetCursorStable: true,
      dtoFields: ["decisionId", "relationshipId", "action", "persistedReviewState", "ledgerIds", "evidenceIds", "exportEligibleAfterDecision"]
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildReviewedExportSubsetGovernanceDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
  } = {}
): GraphReviewedExportSubsetGovernanceDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const scopedSnapshot = {
    ...snapshot,
    relationships,
    evidenceSupport: snapshot.evidenceSupport.filter((support) => relationships.some((relationship) => relationship.id === support.relationshipId))
  };
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const eligibleRelationshipIds = uniqueSorted(readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId));
  const heldRelationshipIds = uniqueSorted(readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId));
  const excludedRelationshipIds = uniqueSorted(relationships
    .filter((relationship) => relationship.reviewState === "rejected" || relationship.reviewState === "contradicted" || (readinessById.get(relationship.id)?.blockers ?? []).includes("export_schema_risk"))
    .map((relationship) => relationship.id));
  const decisions = relationships.map((relationship) => reviewPersistenceDecision(scopedSnapshot, relationship, readinessById, generatedAt));
  return {
    mode: "reviewed_export_subset_governance",
    generatedAt,
    subsetId: stableId("graph-reviewed-export-subset", `${generatedAt}:${eligibleRelationshipIds.join("|")}:${heldRelationshipIds.join("|")}`),
    mediaType: STIX_21_MEDIA_TYPE,
    eligibleRelationshipIds: eligibleRelationshipIds.slice(0, 100),
    heldRelationshipIds: heldRelationshipIds.slice(0, 100),
    excludedRelationshipIds: excludedRelationshipIds.slice(0, 100),
    decisionIds: decisions.map((decision) => decision.decisionId).slice(0, 100),
    cursor: stableId("graph-export-subset-cursor", `${generatedAt}:${eligibleRelationshipIds.length}:${heldRelationshipIds.length}:${excludedRelationshipIds.length}`),
    governanceChecks: {
      stixEligibility: "reviewed_provenance_backed_relationships_only",
      attackFreshness: "deprecated_revoked_or_stale_attack_mappings_hold_export",
      campaignTimelineReview: "campaign_ttp_rows_require_review_board_clearance",
      sourceClaimProvenance: "source_capture_ledger_ids_required",
      restrictedMetadataHolds: "metadata_only_edges_remain_descriptor_context",
      taxiiBoundary: "descriptor_only_no_server"
    },
    counts: {
      eligible: eligibleRelationshipIds.length,
      held: heldRelationshipIds.length,
      excluded: excludedRelationshipIds.length,
      restrictedHeld: relationshipIdsByCodes(findingsByRelationship, ["restricted_only_claim", "unsupported_restricted_metadata"]).length,
      staleHeld: relationshipIdsByCodes(findingsByRelationship, ["stale_accepted_edge"]).length,
      contradictedHeld: relationshipIdsByCodes(findingsByRelationship, ["contradicted_edge"]).length,
      missingProvenanceHeld: relationshipIdsByCodes(findingsByRelationship, ["missing_provenance", "missing_ledger_ids"]).length
    },
    agentHandoffs: {
      agent06ClaimLedgerIds: uniqueSorted(scopedSnapshot.evidenceSupport.flatMap((support) => support.ledgerIds)).slice(0, 100),
      agent07QualityCorrectionIds: uniqueSorted(relationships.flatMap((relationship) => qualityCorrectionIdsFor(relationship))).slice(0, 100),
      agent09ApiFields: ["subsetId", "eligibleRelationshipIds", "heldRelationshipIds", "cursor", "taxiiBoundary"],
      agent10ReleaseGate: "promote_when_eligible_nonzero_and_holds_explained"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
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

function buildGraphRuntimeBackendAdapterCutoverContractDto(input: {
  generatedAt: string;
  backendContract: GraphBackendRepositoryContractDto;
  backendCutover: GraphBackendCutoverRehearsalDto;
  backendPerformance: GraphBackendPerformanceSoakDto;
  backendMigrationCertification: GraphBackendMigrationCertificationDto;
  neo4jMigrationAdapter: GraphNeo4jMigrationAdapterBenchmarkDto;
}): GraphBackendAdapterCutoverContractDto {
  const blockers = uniqueSorted([
    ...input.neo4jMigrationAdapter.cutoverReadiness.blockers,
    ...(input.backendMigrationCertification.certificationState === "rollback" ? ["backend_migration_certification_rollback"] : []),
    ...(input.backendMigrationCertification.certificationState === "hold" ? ["backend_migration_certification_hold"] : []),
    ...(input.backendPerformance.releasePacket.status === "rollback" ? ["backend_performance_rollback"] : []),
    ...(input.backendPerformance.releasePacket.status === "hold" ? ["backend_performance_hold"] : []),
    ...(input.backendCutover.releasePacket.status === "rollback" ? ["backend_cutover_rollback"] : []),
    ...(input.backendCutover.releasePacket.status === "hold" ? ["backend_cutover_hold"] : [])
  ]);
  const status: GraphBackendAdapterCutoverContractDto["status"] = blockers.some((blocker) => blocker.includes("rollback"))
    ? "rollback"
    : blockers.some((blocker) => blocker.includes("hold") || blocker.includes("missing_ledger"))
      ? "hold"
      : input.neo4jMigrationAdapter.status === "warning" || input.backendMigrationCertification.certificationState === "warning"
        ? "warning"
        : "pass";
  const migrations = input.backendCutover.migrationSchemas.reduce<GraphBackendAdapterCutoverContractDto["migrations"]>((items, schema) => {
    if (schema.backend !== "postgres_graph_tables" && schema.backend !== "neo4j") return items;
    const backend: "postgres_graph_tables" | "neo4j" = schema.backend;
    items.push({
      backend,
      schemaName: schema.schemaName,
      tablesOrLabels: schema.tablesOrLabels,
      requiredIndexes: schema.requiredIndexes,
      migrationProof: "dry_run_contract_only",
      rollbackUnit: "snapshot_generation"
    });
    return items;
  }, []);

  return {
    mode: "neo4j_postgres_graph_backend_adapter_contract",
    generatedAt: input.generatedAt,
    status,
    adapterStrategy: {
      primaryBackend: "postgres_graph_tables",
      compatibleBackends: input.backendContract.backendCandidates,
      neo4jState: "contract_only_no_live_driver",
      routeShapePolicy: "serve_existing_graph_runtime_dtos_without_route_shape_changes",
      taxiiBoundary: "descriptor_only_no_server"
    },
    interfaces: input.backendContract.operations.map((operation) => ({
      name: operation.kind,
      postgresTarget: operation.tableOrLabel,
      neo4jTarget: neo4jTargetForOperation(operation.kind),
      idField: operation.idField,
      requiredFields: operation.requiredFields,
      tenantScoped: operation.tenantScoped,
      appendOnly: operation.appendOnly,
      replayRequired: operation.kind === "record_cursor_delta" || operation.appendOnly
    })),
    migrations,
    cursorReplay: {
      cursorField: "graph.deltas[].cursor",
      cursorDeltaCount: input.backendContract.cursorDeltaCount,
      replayableRelationshipIds: input.backendContract.cursorDeltas.relationshipIds,
      latestCursor: input.backendContract.cursorDeltas.latestChangedAt,
      orderPolicy: "preserve_delta_cursor_order_across_backends"
    },
    reviewHoldParity: {
      heldRelationshipIds: uniqueSorted([
        ...input.backendMigrationCertification.holdPolicy.weakDiscoveryRelationshipIds,
        ...input.backendMigrationCertification.holdPolicy.publicChannelOnlyRelationshipIds,
        ...input.backendMigrationCertification.holdPolicy.restrictedMetadataRelationshipIds,
        ...input.backendMigrationCertification.holdPolicy.staleRelationshipIds,
        ...input.backendMigrationCertification.holdPolicy.contradictedRelationshipIds,
        ...input.backendMigrationCertification.holdPolicy.missingLedgerRelationshipIds,
        ...input.backendMigrationCertification.holdPolicy.budgetBoundedRelationshipIds
      ]),
      missingLedgerRelationshipIds: input.backendMigrationCertification.holdPolicy.missingLedgerRelationshipIds,
      staleRelationshipIds: input.backendMigrationCertification.holdPolicy.staleRelationshipIds,
      contradictedRelationshipIds: input.backendMigrationCertification.holdPolicy.contradictedRelationshipIds,
      weakDiscoveryRelationshipIds: input.backendMigrationCertification.holdPolicy.weakDiscoveryRelationshipIds,
      policy: "held_relationships_remain_non_exportable_until_review_replay_and_recompute_pass"
    },
    performanceSlo: {
      queryPlan: input.backendPerformance.queryCost.queryPlan,
      costBand: input.backendPerformance.queryCost.costBand,
      latencyTargets: input.backendPerformance.latencyTargets,
      benchmarkScenarios: input.neo4jMigrationAdapter.benchmarkScenarios,
      releaseStatus: input.backendPerformance.releasePacket.status
    },
    cutoverReadiness: {
      decision: status,
      blockers,
      fallback: "keep_memory_snapshot_or_postgres_graph_tables_authoritative",
      proofCommands: [
        "bun run check",
        "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts",
        "bun run check:graph-review-mounted"
      ]
    },
    handoffs: {
      agent06PersistenceReplay: "load_graph_rows_from_evidence_claim_ledger_and_cursor_replay_before_cutover",
      agent07QualityParity: "compare_alias_split_contradiction_stale_and_review_state_parity",
      agent09ApiCompatibility: "keep_graph_query_runtime_and_stix_response_shapes_stable",
      agent10ReleaseGate: "consume_adapter_cutover_contract_for_promote_hold_or_rollback"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
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
  const workspaceKind: GraphQueryCostControlsDto["tenant"]["workspaceKind"] = options.endpoint === "/v1/exports/stix" ? "stix_preview" : options.endpoint === "/v1/intel/search.graph" ? "runtime_delta" : "investigation";
  const deltas = buildRelationshipCursorDeltas(snapshot, { generatedAt }).filter((delta) => relationships.some((relationship) => relationship.id === delta.relationshipId));
  const queryCostControls = buildGraphQueryCostControlsDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    workspaceKind,
    deltas
  });
  const driftMonitor = buildGraphRelationshipDriftMonitorDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    workspaceKind,
    costControls: queryCostControls,
    deltas
  });
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
  const reviewedExportSubset = buildReviewedExportSubsetGovernanceDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const taxiiStixGovernance = buildTaxiiDescriptorStixBundleGovernanceDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    exportGovernance: reviewedExportSubset
  });
  const reviewPersistence = buildGraphReviewPersistenceLedgerDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const backendContract = buildGraphBackendRepositoryContractDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const backendCutover = buildGraphBackendCutoverRehearsalDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const backendPerformance = buildGraphBackendPerformanceSoakDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const backendMigrationCertification = buildGraphBackendMigrationCertificationDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id),
    costControls: queryCostControls,
    driftMonitor,
    exportGovernance: reviewedExportSubset
  });
  const neo4jMigrationAdapter = buildGraphNeo4jMigrationAdapterBenchmarkDto(snapshot, {
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });
  const certification = buildGraphExportCertificationDto(snapshot, {
    endpoint: options.endpoint,
    generatedAt,
    relationshipIds: relationships.map((relationship) => relationship.id)
  });

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
    certification,
    liveUpdate: buildGraphLiveSearchUpdateDto(snapshot, {
      endpoint: options.endpoint,
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    backendContract,
    backendCutover,
    backendPerformance,
    backendMigrationCertification,
    neo4jMigrationAdapter,
    backendAdapterCutover: buildGraphRuntimeBackendAdapterCutoverContractDto({
      generatedAt,
      backendContract,
      backendCutover,
      backendPerformance,
      backendMigrationCertification,
      neo4jMigrationAdapter
    }),
    queryCostControls,
    driftMonitor,
    reviewPersistence,
    reviewedExportSubset,
    taxiiStixGovernance,
    releaseCandidate: certification.rcGate,
    actorTimelineChanges: buildGraphActorTimelineChangeWorkspaceDto(snapshot, {
      query: "runtime graph actor timeline",
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    actorProductPacket: buildGraphActorProductPacketDto(snapshot, {
      query: "runtime graph product packet",
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    stixTaxiiMarketplaceReadiness: buildGraphStixTaxiiMarketplaceReadinessDto(snapshot, {
      query: "runtime graph marketplace readiness",
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    stixTaxiiMonetizationExportContracts: buildGraphStixTaxiiMonetizationExportContractsDto(snapshot, {
      query: "runtime graph monetization export contracts",
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    actorComparisonNotebook: buildGraphActorComparisonNotebookDto(snapshot, {
      query: "runtime graph actor comparison notebooks",
      generatedAt,
      relationshipIds: relationships.map((relationship) => relationship.id)
    }),
    relationships: runtimeRelationships,
    reviewQueue
  };
}

export function buildGraphBackendRepositoryContractDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
  } = {}
): GraphBackendRepositoryContractDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const support = snapshot.evidenceSupport.filter((item) => relationshipIds.has(item.relationshipId));
  const readiness = checkStixExportReadiness({
    ...snapshot,
    relationships,
    evidenceSupport: support
  });
  const deltas = buildRelationshipCursorDeltas({
    ...snapshot,
    relationships,
    evidenceSupport: support
  }, { generatedAt });

  return {
    mode: "backend_neutral_graph_repository_contract",
    backendCandidates: ["memory_snapshot", "postgres_graph_tables", "neo4j"],
    tenantScope: "tenant_id_required_on_nodes_edges_provenance_reviews_and_deltas",
    generatedAt,
    nodeCount: snapshot.nodes.length,
    relationshipCount: relationships.length,
    provenanceCount: support.length,
    cursorDeltaCount: deltas.length,
    operations: [
      graphRepositoryOperation("upsert_node", "graph_nodes", "node_id", ["tenant_id", "node_id", "type", "value", "confidence", "first_seen_at", "last_seen_at"], false, "Store stable graph nodes with aliases and confidence for SQL or graph labels."),
      graphRepositoryOperation("upsert_relationship", "graph_relationships", "relationship_id", ["tenant_id", "relationship_id", "source_ref", "target_ref", "type", "confidence", "review_state"], false, "Store actor/victim/TTP/malware/CVE relationships without changing DTO ids."),
      graphRepositoryOperation("append_provenance", "graph_evidence_support", "support_id", ["tenant_id", "relationship_id", "source_id", "capture_id", "ledger_ids", "content_hash"], true, "Append provenance chains and Agent 06 ledger ids for every relationship support row."),
      graphRepositoryOperation("append_review_decision", "graph_review_audit", "decision_id", ["tenant_id", "relationship_id", "action", "reviewer_id", "reason", "decided_at"], true, "Append accepted/rejected/superseded/contradicted/expired decisions without rewriting history."),
      graphRepositoryOperation("append_confidence_history", "graph_confidence_history", "relationship_id_recorded_at", ["tenant_id", "relationship_id", "confidence", "recorded_at", "reason"], true, "Persist stale, downgraded, contradicted, and promoted confidence changes for replay."),
      graphRepositoryOperation("record_cursor_delta", "graph_cursor_deltas", "cursor", ["tenant_id", "cursor", "relationship_id", "delta_kind", "workflow_state", "changed_at"], true, "Persist Agent 09 poll cursors for graph deltas."),
      graphRepositoryOperation("update_export_eligibility", "graph_export_eligibility", "relationship_id", ["tenant_id", "relationship_id", "reviewed", "promoted", "accepted", "included_by_default"], false, "Persist STIX eligibility flags and recompute readiness before export.")
    ],
    reviewWorkflow: {
      acceptedRelationshipIds: uniqueSorted(relationships.filter((relationship) => relationship.reviewState === "accepted").map((relationship) => relationship.id)).slice(0, 25),
      rejectedRelationshipIds: uniqueSorted(relationships.filter((relationship) => relationship.reviewState === "rejected").map((relationship) => relationship.id)).slice(0, 25),
      staleRelationshipIds: uniqueSorted(relationships.filter((relationship) => relationship.reviewState === "expired" || relationship.properties?.stale === true).map((relationship) => relationship.id)).slice(0, 25),
      contradictedRelationshipIds: uniqueSorted(relationships.filter((relationship) => relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true).map((relationship) => relationship.id)).slice(0, 25),
      pendingReviewRelationshipIds: uniqueSorted(relationships.filter((relationship) => relationship.reviewState === "needs_review" || relationship.reviewState === "unreviewed").map((relationship) => relationship.id)).slice(0, 25),
      decisionActions: ["request_review", "accept", "reject", "supersede", "mark_contradicted", "resolve_contradiction", "expire", "request_evidence"],
      auditPersistence: "append_only_review_audit"
    },
    exportEligibility: {
      readyRelationshipIds: uniqueSorted(readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId)).slice(0, 25),
      heldRelationshipIds: uniqueSorted(readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId)).slice(0, 25),
      policy: "persist_readiness_flags_and_recompute_before_stix_export"
    },
    cursorDeltas: {
      cursorField: "graph.deltas[].cursor",
      relationshipIds: uniqueSorted(deltas.map((delta) => delta.relationshipId)).slice(0, 25),
      latestChangedAt: deltas[0]?.changedAt
    },
    handoffs: {
      agent06ClaimLedger: "persist_ledger_ids_with_provenance_support",
      agent07EntityResolution: "preserve_stable_node_ids_aliases_and_review_states",
      agent09Api: "serve_same_dtos_from_repository_without_route_shape_changes",
      agent10DeploymentGate: "verify_repository_replay_before_graph_export_promotion"
    }
  };
}

export function buildGraphBackendCutoverRehearsalDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
  } = {}
): GraphBackendCutoverRehearsalDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const support = snapshot.evidenceSupport.filter((item) => relationshipIds.has(item.relationshipId));
  const scopedSnapshot = { ...snapshot, relationships, evidenceSupport: support };
  const repositoryContract = buildGraphBackendRepositoryContractDto(scopedSnapshot, { generatedAt });
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const deltas = buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const missingLedgerRelationshipIds = uniqueSorted(support
    .filter((item) => item.ledgerIds.length === 0)
    .map((item) => item.relationshipId));
  const weakDiscoveryHeldIds = relationshipIdsByCodes(findingsByRelationship, ["weak_discovery_only_edge"]);
  const restrictedHeldIds = relationshipIdsByCodes(findingsByRelationship, ["restricted_only_claim", "unsupported_restricted_metadata"]);
  const publicChannelHintHeldIds = uniqueSorted(support
    .filter((item) => item.sourceId.includes("telegram") || item.sourceId.includes("public_channel") || item.sourceId.includes("public-signal"))
    .map((item) => item.relationshipId)
    .filter((relationshipId) => readiness.relationships.some((relationship) => relationship.relationshipId === relationshipId && !relationship.ready)));
  const rollbackCodes: GraphIntegrityFindingCode[] = ["missing_provenance", "orphan_relationship", "export_schema_risk", "unsupported_edge"];
  const hasRollbackRisk = [...findingsByRelationship.values()].some((findings) => findings.some((finding) => rollbackCodes.includes(finding.code) && finding.severity === "critical"));
  const status: GraphBackendCutoverRehearsalDto["releasePacket"]["status"] = hasRollbackRisk
    ? "rollback"
    : missingLedgerRelationshipIds.length > 0 || readiness.blockedCount > 0
      ? "hold"
      : "pass";

  return {
    mode: "graph_backend_cutover_rehearsal",
    generatedAt,
    targetBackends: repositoryContract.backendCandidates,
    repositoryContract,
    migrationSchemas: buildGraphBackendMigrationSchemas(scopedSnapshot),
    replayImport: {
      source: "agent06_evidence_claim_ledger",
      importOrder: ["nodes", "relationships", "evidence_support", "review_audit", "confidence_history", "cursor_deltas", "export_eligibility"],
      replayableRelationshipIds: uniqueSorted(relationships.filter((relationship) => support.some((item) => item.relationshipId === relationship.id)).map((relationship) => relationship.id)).slice(0, 25),
      staleRelationshipIds: repositoryContract.reviewWorkflow.staleRelationshipIds,
      contradictedRelationshipIds: repositoryContract.reviewWorkflow.contradictedRelationshipIds,
      reviewHeldRelationshipIds: uniqueSorted([
        ...repositoryContract.reviewWorkflow.pendingReviewRelationshipIds,
        ...repositoryContract.reviewWorkflow.staleRelationshipIds,
        ...repositoryContract.reviewWorkflow.contradictedRelationshipIds,
        ...readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId)
      ]).slice(0, 25),
      missingLedgerRelationshipIds: missingLedgerRelationshipIds.slice(0, 25),
      cursorField: "graph.deltas[].cursor",
      cursorDeltaCount: deltas.length,
      latestCursor: deltas[0]?.cursor,
      ledgerCompleteness: missingLedgerRelationshipIds.length === 0 ? "complete" : "hold_missing_ledger_ids",
      restrictedMaterialPolicy: "metadata_only_review_hold"
    },
    verification: {
      tenantScopedRows: repositoryContract.operations.every((operation) => operation.tenantScoped),
      cursorContinuity: deltas.every((delta) => delta.cursor.length > 0),
      provenanceComplete: support.every((item) => item.sourceId.length > 0 && item.captureId.length > 0 && item.contentHash.length > 0),
      reviewAuditAppendOnly: repositoryContract.operations.some((operation) => operation.kind === "append_review_decision" && operation.appendOnly),
      confidenceHistoryAppendOnly: repositoryContract.operations.some((operation) => operation.kind === "append_confidence_history" && operation.appendOnly),
      exportEligibilityRecomputed: repositoryContract.operations.some((operation) => operation.kind === "update_export_eligibility"),
      noRawRestrictedMaterialSerialized: true
    },
    backupRestore: {
      snapshotId: stableId("graph-backend-cutover", [generatedAt, ...uniqueSorted(relationships.map((relationship) => relationship.id))].join("|")),
      backupManifestTables: uniqueSorted(repositoryContract.operations.map((operation) => operation.tableOrLabel)),
      restoreVerification: "replay_snapshot_then_compare_counts_cursors_and_export_eligibility",
      rollbackPath: "restore_last_verified_snapshot_and_hold_graph_exports"
    },
    exportEligibility: {
      readyRelationshipIds: uniqueSorted(readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId)).slice(0, 25),
      heldRelationshipIds: uniqueSorted(readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId)).slice(0, 25),
      weakDiscoveryHeldIds: weakDiscoveryHeldIds.slice(0, 25),
      restrictedHeldIds: restrictedHeldIds.slice(0, 25),
      publicChannelHintHeldIds: publicChannelHintHeldIds.slice(0, 25),
      policy: "weak_public_channel_and_restricted_edges_remain_pivots_or_review_holds_until_promoted"
    },
    releasePacket: {
      owner: "Agent 08",
      status,
      proofCommand: "bun test src/tests/graphViews.test.ts",
      agent10Field: "graphBackendCutoverRehearsal",
      rollbackPath: status === "pass"
        ? "no rollback needed after verified replay; keep last verified snapshot for restore"
        : "keep in-memory graph DTOs authoritative and hold graph/STIX promotion until replay/import verification passes"
    }
  };
}

export function buildGraphBackendPerformanceSoakDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
  } = {}
): GraphBackendPerformanceSoakDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const support = snapshot.evidenceSupport.filter((item) => relationshipIds.has(item.relationshipId));
  const scopedSnapshot = { ...snapshot, relationships, evidenceSupport: support };
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const deltas = buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const reviewHoldIds = uniqueSorted(readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId));
  const nodeIds = uniqueSorted(relationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));
  const estimatedCostUnits = graphQueryEstimatedCostUnits({
    relationshipCount: relationships.length,
    nodeCount: nodeIds.length,
    evidenceSupportCount: support.length,
    cursorDeltaCount: deltas.length,
    reviewHoldCount: reviewHoldIds.length
  });
  const costBand = graphQueryCostBand(estimatedCostUnits, relationships.length, nodeIds.length);
  const queueState = costBand === "rollback"
    ? "rollback"
    : costBand === "high" || reviewHoldIds.length > 50
      ? "hold"
      : costBand === "medium" || reviewHoldIds.length > 20
        ? "watch"
        : "pass";
  const releaseStatus: GraphBackendPerformanceSoakDto["releasePacket"]["status"] = queueState === "rollback"
    ? "rollback"
    : queueState === "hold"
      ? "hold"
      : queueState === "watch"
        ? "warning"
        : "pass";

  return {
    mode: "graph_backend_performance_soak",
    generatedAt,
    targetBackends: ["memory_snapshot", "postgres_graph_tables", "neo4j"],
    queryCost: {
      queryPlan: "bounded_single_hop_relationship_scan",
      relationshipCount: relationships.length,
      nodeCount: nodeIds.length,
      evidenceSupportCount: support.length,
      cursorDeltaCount: deltas.length,
      reviewHoldCount: reviewHoldIds.length,
      exportReadyCount: readiness.readyCount,
      estimatedCostUnits,
      costBand
    },
    budgets: {
      maxRelationshipsPerPage: 50,
      maxNodesPerPage: 75,
      maxEvidenceSupportRows: 150,
      maxCursorDeltas: 100,
      maxCostUnits: 250,
      publicPollSeconds: 3
    },
    latencyTargets: buildGraphBackendLatencyTargets(costBand, estimatedCostUnits),
    queuePressure: {
      graphExportQueued: readiness.readyCount,
      reviewHoldQueued: reviewHoldIds.length,
      cursorReplayQueued: deltas.length,
      state: queueState
    },
    soakScenarios: buildGraphBackendSoakScenarios(relationships, reviewHoldIds, deltas, findingsByRelationship, queueState),
    safety: {
      tenantScoped: true,
      restrictedMaterialPolicy: "metadata_only_review_hold",
      rawRestrictedMaterialIncluded: false,
      taxiiBoundary: "descriptor_only_no_server"
    },
    releasePacket: {
      owner: "Agent 08",
      status: releaseStatus,
      proofCommand: "bun test src/tests/graphViews.test.ts",
      agent10Field: "graphBackendPerformanceSoak",
      rollbackPath: releaseStatus === "pass"
        ? "keep bounded graph query plan and continue collecting latency samples during canary"
        : "hold graph export promotion and keep bounded in-memory DTOs authoritative until backend soak returns pass"
    }
  };
}

export function buildGraphNeo4jMigrationAdapterBenchmarkDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
  } = {}
): GraphNeo4jMigrationAdapterBenchmarkDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const support = snapshot.evidenceSupport.filter((item) => relationshipIds.has(item.relationshipId));
  const scopedSnapshot = { ...snapshot, relationships, evidenceSupport: support };
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const deltas = buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const nodes = snapshot.nodes.filter((node) => relationships.some((relationship) => relationship.sourceRef === node.id || relationship.targetRef === node.id));
  const relationshipProjection = buildNeo4jRelationshipProjection(relationships, readiness);
  const benchmarkScenarios = buildNeo4jBenchmarkScenarios(relationships, readiness, deltas);
  const hasMissingLedger = support.some((item) => item.ledgerIds.length === 0);
  const heldRowsRemainNonExportable = readiness.relationships
    .filter((relationship) => !relationship.ready)
    .every((relationship) => relationship.blockers.length > 0);
  const status: GraphNeo4jMigrationAdapterBenchmarkDto["status"] = benchmarkScenarios.some((scenario) => scenario.status === "rollback")
    ? "rollback"
    : hasMissingLedger || !heldRowsRemainNonExportable
      ? "hold"
      : benchmarkScenarios.some((scenario) => scenario.status === "warning")
        ? "warning"
        : "pass";

  return {
    mode: "neo4j_migration_adapter_contract_benchmark",
    generatedAt,
    status,
    adapterBoundary: {
      targetBackend: "neo4j",
      implementationState: "contract_only_no_live_driver",
      primaryCutoverBackend: "postgres_graph_tables",
      apiShapePolicy: "serve_existing_graph_runtime_dtos_without_route_shape_changes",
      taxiiBoundary: "descriptor_only_no_server"
    },
    nodeLabelProjection: buildNeo4jNodeLabelProjection(nodes),
    relationshipProjection,
    constraints: [
      {
        name: "graph_node_identity",
        cypher: "CREATE CONSTRAINT graph_node_identity IF NOT EXISTS FOR (n:GraphNode) REQUIRE (n.tenant_id, n.workspace_id, n.node_id) IS UNIQUE",
        requiredBeforePromotion: true
      },
      {
        name: "graph_relationship_identity",
        cypher: "CREATE CONSTRAINT graph_relationship_identity IF NOT EXISTS FOR ()-[r:GRAPH_RELATIONSHIP]-() REQUIRE (r.tenant_id, r.workspace_id, r.relationship_id) IS UNIQUE",
        requiredBeforePromotion: true
      },
      {
        name: "graph_cursor_order",
        cypher: "CREATE INDEX graph_cursor_order IF NOT EXISTS FOR ()-[r:GRAPH_RELATIONSHIP]-() ON (r.tenant_id, r.cursor, r.last_seen_at)",
        requiredBeforePromotion: true
      },
      {
        name: "graph_export_review",
        cypher: "CREATE INDEX graph_export_review IF NOT EXISTS FOR ()-[r:GRAPH_RELATIONSHIP]-() ON (r.review_state, r.export_eligible)",
        requiredBeforePromotion: true
      }
    ],
    benchmarkScenarios,
    parityChecks: {
      nodeCountMatchesSnapshot: nodes.length <= snapshot.nodes.length,
      relationshipCountMatchesSnapshot: relationshipProjection.reduce((total, row) => total + row.count, 0) === relationships.length,
      evidenceSupportCountMatchesSnapshot: support.every((item) => item.relationshipId.length > 0 && item.contentHash.length > 0),
      cursorOrderPreserved: deltas.every((delta) => delta.cursor.length > 0 && delta.changedAt.length > 0),
      reviewStateParity: relationships.every((relationship) => relationship.reviewState.length > 0),
      exportEligibilityParity: readiness.relationships.length === relationships.length,
      heldRowsRemainNonExportable
    },
    cutoverReadiness: {
      decision: status,
      blockers: neo4jAdapterBlockers(status, hasMissingLedger, heldRowsRemainNonExportable, benchmarkScenarios),
      fallback: "keep_postgres_graph_tables_or_memory_snapshot_authoritative",
      proofCommand: "bun test src/tests/graphViews.test.ts"
    },
    handoffs: {
      agent06Replay: "load_nodes_relationships_provenance_reviews_confidence_and_cursor_deltas_before_benchmark",
      agent07Quality: "compare_alias_split_contradiction_and_review_state_parity",
      agent09Api: "keep_graph_query_and_stix_runtime_dto_shapes_stable",
      agent10Release: "consume_neo4j_adapter_benchmark_for_promote_hold_or_rollback"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphBackendAdapterCutoverContractDto(input: {
  generatedAt: string;
  backendContract: GraphBackendRepositoryContractDto;
  backendCutover: GraphBackendCutoverRehearsalDto;
  backendPerformance: GraphBackendPerformanceSoakDto;
  backendMigrationCertification: GraphBackendMigrationCertificationDto;
  neo4jMigrationAdapter: GraphNeo4jMigrationAdapterBenchmarkDto;
}): GraphBackendAdapterCutoverContractDto {
  const schemaByBackend = new Map(input.backendCutover.migrationSchemas.map((schema) => [schema.backend, schema]));
  const heldRelationshipIds = uniqueSorted([
    ...input.backendMigrationCertification.holdPolicy.weakDiscoveryRelationshipIds,
    ...input.backendMigrationCertification.holdPolicy.publicChannelOnlyRelationshipIds,
    ...input.backendMigrationCertification.holdPolicy.restrictedMetadataRelationshipIds,
    ...input.backendMigrationCertification.holdPolicy.staleRelationshipIds,
    ...input.backendMigrationCertification.holdPolicy.contradictedRelationshipIds,
    ...input.backendMigrationCertification.holdPolicy.missingLedgerRelationshipIds,
    ...input.backendMigrationCertification.holdPolicy.budgetBoundedRelationshipIds
  ]).slice(0, 50);
  const blockers = uniqueSorted([
    ...input.neo4jMigrationAdapter.cutoverReadiness.blockers,
    ...(input.backendMigrationCertification.certificationState === "rollback" ? ["backend_migration_certification_rollback"] : []),
    ...(input.backendMigrationCertification.certificationState === "hold" ? ["backend_migration_certification_hold"] : []),
    ...(input.backendPerformance.releasePacket.status === "rollback" ? ["backend_performance_rollback"] : []),
    ...(input.backendPerformance.releasePacket.status === "hold" ? ["backend_performance_hold"] : []),
    ...(input.backendCutover.releasePacket.status === "rollback" ? ["backend_cutover_rollback"] : []),
    ...(input.backendCutover.releasePacket.status === "hold" ? ["backend_cutover_hold"] : [])
  ]);
  const status: GraphBackendAdapterCutoverContractDto["status"] = blockers.some((blocker) => blocker.includes("rollback"))
    ? "rollback"
    : blockers.some((blocker) => blocker.includes("hold") || blocker.includes("missing_ledger"))
      ? "hold"
      : input.neo4jMigrationAdapter.status === "warning" || input.backendMigrationCertification.certificationState === "warning"
        ? "warning"
        : "pass";

  return {
    mode: "neo4j_postgres_graph_backend_adapter_contract",
    generatedAt: input.generatedAt,
    status,
    adapterStrategy: {
      primaryBackend: "postgres_graph_tables",
      compatibleBackends: input.backendContract.backendCandidates,
      neo4jState: "contract_only_no_live_driver",
      routeShapePolicy: "serve_existing_graph_runtime_dtos_without_route_shape_changes",
      taxiiBoundary: "descriptor_only_no_server"
    },
    interfaces: input.backendContract.operations.map((operation) => ({
      name: operation.kind,
      postgresTarget: operation.tableOrLabel,
      neo4jTarget: neo4jTargetForOperation(operation.kind),
      idField: operation.idField,
      requiredFields: operation.requiredFields,
      tenantScoped: operation.tenantScoped,
      appendOnly: operation.appendOnly,
      replayRequired: operation.kind !== "update_export_eligibility"
    })),
    migrations: (["postgres_graph_tables", "neo4j"] as const).map((backend) => {
      const schema = schemaByBackend.get(backend);
      return {
        backend,
        schemaName: schema?.schemaName ?? `${backend}_graph_contract`,
        tablesOrLabels: schema?.tablesOrLabels ?? [],
        requiredIndexes: schema?.requiredIndexes ?? [],
        migrationProof: "dry_run_contract_only",
        rollbackUnit: "snapshot_generation"
      };
    }),
    cursorReplay: {
      cursorField: "graph.deltas[].cursor",
      cursorDeltaCount: input.backendCutover.replayImport.cursorDeltaCount,
      replayableRelationshipIds: input.backendCutover.replayImport.replayableRelationshipIds,
      latestCursor: input.backendCutover.replayImport.latestCursor,
      orderPolicy: "preserve_delta_cursor_order_across_backends"
    },
    reviewHoldParity: {
      heldRelationshipIds,
      missingLedgerRelationshipIds: input.backendMigrationCertification.holdPolicy.missingLedgerRelationshipIds,
      staleRelationshipIds: input.backendMigrationCertification.holdPolicy.staleRelationshipIds,
      contradictedRelationshipIds: input.backendMigrationCertification.holdPolicy.contradictedRelationshipIds,
      weakDiscoveryRelationshipIds: input.backendMigrationCertification.holdPolicy.weakDiscoveryRelationshipIds,
      policy: "held_relationships_remain_non_exportable_until_review_replay_and_recompute_pass"
    },
    performanceSlo: {
      queryPlan: input.backendPerformance.queryCost.queryPlan,
      costBand: input.backendPerformance.queryCost.costBand,
      latencyTargets: input.backendPerformance.latencyTargets,
      benchmarkScenarios: input.neo4jMigrationAdapter.benchmarkScenarios,
      releaseStatus: input.backendPerformance.releasePacket.status
    },
    cutoverReadiness: {
      decision: status,
      blockers,
      fallback: "keep_memory_snapshot_or_postgres_graph_tables_authoritative",
      proofCommands: [
        "bun run check",
        "bun test src/tests/graphViews.test.ts src/tests/graphReviewRoutes.test.ts",
        "bun run check:graph-review-mounted"
      ]
    },
    handoffs: {
      agent06PersistenceReplay: "load_graph_rows_from_evidence_claim_ledger_and_cursor_replay_before_cutover",
      agent07QualityParity: "compare_alias_split_contradiction_stale_and_review_state_parity",
      agent09ApiCompatibility: "keep_graph_query_runtime_and_stix_response_shapes_stable",
      agent10ReleaseGate: "consume_adapter_cutover_contract_for_promote_hold_or_rollback"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphBackendMigrationCertificationDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
    costControls?: GraphQueryCostControlsDto;
    driftMonitor?: GraphRelationshipDriftMonitorDto;
    exportGovernance?: GraphReviewedExportSubsetGovernanceDto;
    notebookExport?: GraphInvestigationNotebookExportDto;
  } = {}
): GraphBackendMigrationCertificationDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const support = snapshot.evidenceSupport.filter((item) => relationshipIds.has(item.relationshipId));
  const scopedSnapshot = { ...snapshot, relationships, evidenceSupport: support };
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const scopedNodes = snapshot.nodes.filter((node) => relationships.some((relationship) => relationship.sourceRef === node.id || relationship.targetRef === node.id));
  const deltas = buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const costControls = options.costControls ?? buildGraphQueryCostControlsDto(scopedSnapshot, { generatedAt, workspaceKind: "investigation" });
  const driftMonitor = options.driftMonitor ?? buildGraphRelationshipDriftMonitorDto(scopedSnapshot, {
    generatedAt,
    workspaceKind: "investigation",
    costControls,
    deltas
  });
  const missingLedgerRelationshipIds = uniqueSorted([
    ...relationships
      .filter((relationship) => supportFor(scopedSnapshot, relationship.id).length === 0)
      .map((relationship) => relationship.id),
    ...support.filter((item) => item.ledgerIds.length === 0).map((item) => item.relationshipId)
  ]);
  const heldRelationshipIds = uniqueSorted(readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId));
  const eligibleRelationshipIds = uniqueSorted(readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId));
  const confidenceHistoryCount = relationships.reduce((count, relationship) => count + relationship.confidenceHistory.length, 0);
  const reviewDecisionCount = relationships.reduce((count, relationship) => count + relationship.reviewAudit.length, 0);
  const attackCampaignTimelineRows = relationships.filter((relationship) => {
    const source = nodesById.get(relationship.sourceRef);
    const target = nodesById.get(relationship.targetRef);
    return source?.type === "actor" && target?.type === "attack-pattern" && relationship.type === "uses";
  }).length;
  const graphPivotCount = uniqueSorted(relationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef])).length;
  const notebookExportRows = options.notebookExport?.boundedEdges.length ?? Math.min(relationships.length, 50);
  const blockers = uniqueFindingCodes([
    ...readiness.relationships.flatMap((relationship) => relationship.blockers),
    ...[...findingsByRelationship.values()].flatMap((findings) => findings.map((finding) => finding.code))
  ]);
  const hasRollbackRisk = blockers.some((code) => ["missing_provenance", "orphan_relationship", "export_schema_risk", "unsupported_edge"].includes(code))
    || costControls.queuePressure.state === "rollback";
  const certificationState: GraphBackendMigrationCertificationDto["certificationState"] = hasRollbackRisk
    ? "rollback"
    : missingLedgerRelationshipIds.length > 0 || heldRelationshipIds.length > 0 || costControls.queuePressure.state === "hold"
      ? "hold"
      : costControls.queuePressure.state === "watch"
        ? "warning"
        : "pass";
  const relationshipIndexes = ["tenant_id", "workspace_id", "relationship_id", "source_ref", "target_ref"];
  const migrationDataset = (
    order: number,
    dataset: GraphBackendMigrationCertificationDataset,
    target: string,
    prerequisite: string,
    replayProof: string,
    rollbackCheckpoint: string,
    requiredIndexes: string[]
  ): GraphBackendMigrationCertificationDto["migrationOrder"][number] => ({
    order,
    dataset,
    sourceContract: `GraphBackendMigrationCertificationDto.${dataset}`,
    target,
    prerequisite,
    replayProof,
    rollbackCheckpoint,
    requiredIndexes
  });

  return {
    mode: "graph_backend_production_migration_certification",
    generatedAt,
    targetBackends: ["memory_snapshot", "postgres_graph_tables", "neo4j"],
    certificationState,
    summary: {
      nodeCount: scopedNodes.length,
      edgeCount: relationships.length,
      provenanceRowCount: support.length,
      reviewDecisionCount,
      confidenceHistoryCount,
      cursorDeltaCount: deltas.length,
      attackCampaignTimelineRows,
      graphPivotCount,
      notebookExportRows,
      stixPreviewRows: readiness.relationships.length,
      heldRelationshipCount: heldRelationshipIds.length,
      exportEligibleCount: eligibleRelationshipIds.length
    },
    migrationOrder: [
      migrationDataset(1, "nodes", "graph_nodes / (:GraphNode)", "tenant scoped source nodes exist", "compare node counts and stable ids", "restore graph_nodes snapshot", ["tenant_id", "workspace_id", "node_id", "node_type", "value_hash"]),
      migrationDataset(2, "relationships", "graph_relationships / [:TI_RELATIONSHIP]", "nodes imported first", "compare source_ref target_ref type confidence review_state", "restore graph_relationships snapshot", relationshipIndexes),
      migrationDataset(3, "evidence_provenance", "graph_relationship_provenance", "Agent 06 capture and claim-ledger replay complete", "compare source ids capture ids content hashes and ledger ids", "drop provenance import batch", ["tenant_id", "relationship_id", "source_id", "capture_id", "content_hash"]),
      migrationDataset(4, "relationship_reviews", "graph_relationship_review_audit", "relationship ids and evidence provenance imported", "append-only audit row count matches snapshot", "append compensating rollback decision", ["tenant_id", "relationship_id", "decision_id", "review_state"]),
      migrationDataset(5, "confidence_history", "graph_relationship_confidence_history", "review audit imported", "append-only confidence history count matches snapshot", "discard confidence import batch", ["tenant_id", "relationship_id", "recorded_at"]),
      migrationDataset(6, "cursor_deltas", "graph_cursor_deltas", "confidence and review rows imported", "latest cursor and relationship order match graph.deltas", "restore previous cursor checkpoint", ["tenant_id", "workspace_id", "cursor", "relationship_id", "changed_at"]),
      migrationDataset(7, "attack_campaign_timeline", "graph_attack_campaign_timeline", "actor campaign TTP edges imported", "timeline row count and ATT&CK ids match workspace", "rebuild timeline projection from relationships", ["tenant_id", "actor_id", "campaign_id", "technique_id", "last_seen_at"]),
      migrationDataset(8, "graph_pivots", "graph_investigation_pivots", "nodes relationships and review states imported", "bounded pivot relationship ids match workspace", "rebuild pivot projection from relationship table", ["tenant_id", "workspace_id", "node_id", "priority"]),
      migrationDataset(9, "notebook_exports", "graph_notebook_export_projection", "pivots and explanations available", "bounded notebook edge count and taxii descriptor match", "delete notebook projection and rebuild from DTO", ["tenant_id", "workspace_id", "export_packet_id"]),
      migrationDataset(10, "stix_preview_subsets", "graph_stix_preview_subset", "export eligibility recomputed after replay", "eligible and held relationship ids match readiness", "hold STIX preview and recompute eligibility", ["tenant_id", "workspace_id", "relationship_id", "export_eligible"])
    ],
    replayPrerequisites: {
      source: "agent06_retention_replay_and_claim_ledger",
      requiresDurableCaptures: true,
      requiresClaimLedgerRows: true,
      requiresReviewAuditRows: true,
      requiresCursorReplay: true,
      requiredRelationshipIds: uniqueSorted(relationships.map((relationship) => relationship.id)).slice(0, 50),
      missingLedgerRelationshipIds: missingLedgerRelationshipIds.slice(0, 50),
      retentionBoundary: "hashes_ids_redaction_state_and_metadata_only"
    },
    indexRequirements: [
      { name: "graph_tenant_workspace_idx", fields: ["tenant_id", "workspace_id"], purpose: "tenant scoped graph workspace reads", requiredBeforePromotion: true },
      { name: "graph_relationship_endpoints_idx", fields: ["source_ref", "target_ref", "relationship_type"], purpose: "bounded pivots and neighborhood reads", requiredBeforePromotion: true },
      { name: "graph_review_state_idx", fields: ["review_state", "export_eligible", "last_seen_at"], purpose: "review queues and export recomputation", requiredBeforePromotion: true },
      { name: "graph_cursor_idx", fields: ["cursor", "changed_at", "relationship_id"], purpose: "3-second polling and replay continuity", requiredBeforePromotion: true },
      { name: "graph_attack_campaign_idx", fields: ["actor_id", "campaign_id", "technique_id", "attack_id"], purpose: "ATT&CK campaign timeline workspaces", requiredBeforePromotion: false },
      { name: "graph_stix_subset_idx", fields: ["relationship_id", "export_eligible", "blocker_code"], purpose: "STIX preview subset recomputation", requiredBeforePromotion: true }
    ],
    cursorContinuity: {
      cursorField: "graph.deltas[].cursor",
      latestCursor: deltas[0]?.cursor,
      replayableRelationshipIds: uniqueSorted(relationships.filter((relationship) => support.some((item) => item.relationshipId === relationship.id)).map((relationship) => relationship.id)).slice(0, 50),
      changedRelationshipIds: uniqueSorted(deltas.map((delta) => delta.relationshipId)).slice(0, 50),
      nextPollSeconds: 3,
      policy: "preserve_cursor_order_across_backend_replay"
    },
    tenantScoping: {
      tenantId: costControls.tenant.tenantId,
      workspaceId: costControls.tenant.workspaceId,
      isolation: "tenant_and_workspace_required_on_all_graph_rows",
      crossTenantJoinsAllowed: false
    },
    exportRecomputation: {
      eligibleRelationshipIds: eligibleRelationshipIds.slice(0, 50),
      heldRelationshipIds: heldRelationshipIds.slice(0, 50),
      blockers,
      policy: "recompute_after_replay_before_stix_preview_or_taxii_descriptor",
      taxiiBoundary: "descriptor_only_no_server"
    },
    holdPolicy: {
      weakDiscoveryRelationshipIds: driftMonitor.heldFacts.weakDiscoveryRelationshipIds,
      publicChannelOnlyRelationshipIds: driftMonitor.heldFacts.publicChannelOnlyRelationshipIds,
      restrictedMetadataRelationshipIds: driftMonitor.heldFacts.restrictedMetadataRelationshipIds,
      staleRelationshipIds: driftMonitor.heldFacts.staleRelationshipIds,
      contradictedRelationshipIds: driftMonitor.heldFacts.contradictedRelationshipIds,
      missingLedgerRelationshipIds: uniqueSorted([...driftMonitor.heldFacts.missingLedgerRelationshipIds, ...missingLedgerRelationshipIds]).slice(0, 50),
      budgetBoundedRelationshipIds: driftMonitor.heldFacts.budgetBoundedRelationshipIds,
      policy: "held_relationships_remain_non_exportable_until_review_and_replay_pass"
    },
    rollbackCheckpoints: [
      { name: "graph_tables_snapshot", checkpoint: "last_verified_graph_snapshot", action: "restore graph tables or keep memory snapshot authoritative" },
      { name: "review_audit_append_only", checkpoint: "pre_import_review_audit_tail", action: "append compensating rollback decisions instead of deleting audit rows" },
      { name: "cursor_replay_checkpoint", checkpoint: "latest_verified_graph_delta_cursor", action: "resume polling from previous cursor and suppress backend deltas" },
      { name: "export_subset_recompute", checkpoint: "pre_replay_stix_preview_subset", action: "hold STIX preview and recompute eligible and held ids" },
      { name: "notebook_projection_rebuild", checkpoint: "metadata_only_notebook_export_packet", action: "rebuild notebook projection from graph workspace DTO" }
    ],
    agentHandoffs: {
      agent06RetentionReplay: "prove_captures_claim_ledgers_review_audit_and_cursor_replay_before_import",
      agent07QualityGate: "certify_contradictions_stale_edges_and_entity_splits_before_export_recompute",
      agent09ApiContract: "serve_existing_graph_runtime_workspace_and_stix_fields_without_shape_changes",
      agent10ReleaseGate: "consume_graph_backend_migration_certification_for_promote_hold_or_rollback"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphQueryCostControlsDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    query?: string;
    focusNodeId?: string;
    relationshipIds?: string[];
    workspaceKind?: GraphQueryCostControlsDto["tenant"]["workspaceKind"];
    deltas?: GraphCursorRelationshipDeltaDto[];
  } = {}
): GraphQueryCostControlsDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const support = snapshot.evidenceSupport.filter((item) => relationshipIds.has(item.relationshipId));
  const scopedSnapshot = { ...snapshot, relationships, evidenceSupport: support };
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const deltas = options.deltas ?? buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const nodeIds = uniqueSorted(relationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const techniqueTimelineEventCount = relationships.filter((relationship) => {
    const source = nodesById.get(relationship.sourceRef);
    const target = nodesById.get(relationship.targetRef);
    return relationship.type === "uses" && (source?.type === "attack-pattern" || target?.type === "attack-pattern");
  }).length;
  const campaignPivotCount = uniqueSorted(relationships
    .flatMap((relationship) => [nodesById.get(relationship.sourceRef), nodesById.get(relationship.targetRef)])
    .filter((node): node is PersistedGraphNode => node !== undefined && (node.type === "campaign" || node.type === "actor" || node.type === "attack-pattern"))
    .map((node) => node.id)).length;
  const heldRelationshipIds = uniqueSorted(readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId));
  const missingLedgerRelationshipIds = uniqueSorted(support
    .filter((item) => item.ledgerIds.length === 0)
    .map((item) => item.relationshipId));
  const publicChannelOnlyRelationshipIds = uniqueSorted(relationships
    .filter((relationship) => {
      const relationshipSupport = support.filter((item) => item.relationshipId === relationship.id);
      return relationshipSupport.length > 0 && relationshipSupport.every((item) => /telegram|public[_-]?channel|public[_-]?signal/i.test(item.sourceId));
    })
    .map((relationship) => relationship.id));
  const weakDiscoveryRelationshipIds = relationshipIdsByCodes(findingsByRelationship, ["weak_discovery_only_edge"]);
  const restrictedMetadataRelationshipIds = relationshipIdsByCodes(findingsByRelationship, ["restricted_only_claim", "unsupported_restricted_metadata"]);
  const staleRelationshipIds = relationshipIdsByCodes(findingsByRelationship, ["stale_accepted_edge"]);
  const contradictedRelationshipIds = uniqueSorted([
    ...relationshipIdsByCodes(findingsByRelationship, ["contradicted_edge"]),
    ...relationships.filter((relationship) => relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true).map((relationship) => relationship.id)
  ]);
  const observed: Record<GraphQueryBudgetDimension, number> = {
    nodes: nodeIds.length,
    edges: relationships.length,
    relationship_review_rows: heldRelationshipIds.length,
    technique_timeline_events: techniqueTimelineEventCount,
    campaign_pivots: campaignPivotCount,
    evidence_joins: support.length,
    stix_preview_rows: readiness.relationships.length,
    cursor_continuation: deltas.length,
    export_eligibility_recomputation: relationships.length
  };
  const limits: Record<GraphQueryBudgetDimension, { soft: number; hard: number }> = {
    nodes: { soft: 60, hard: 75 },
    edges: { soft: 40, hard: 50 },
    relationship_review_rows: { soft: 35, hard: 50 },
    technique_timeline_events: { soft: 30, hard: 40 },
    campaign_pivots: { soft: 18, hard: 25 },
    evidence_joins: { soft: 100, hard: 150 },
    stix_preview_rows: { soft: 40, hard: 50 },
    cursor_continuation: { soft: 75, hard: 100 },
    export_eligibility_recomputation: { soft: 75, hard: 100 }
  };
  const dimensions: GraphQueryBudgetDimension[] = [
    "nodes",
    "edges",
    "relationship_review_rows",
    "technique_timeline_events",
    "campaign_pivots",
    "evidence_joins",
    "stix_preview_rows",
    "cursor_continuation",
    "export_eligibility_recomputation"
  ];
  const budgets = dimensions.map((dimension) => {
    const state = graphQueryBudgetState(observed[dimension], limits[dimension]);
    return {
      dimension,
      observed: observed[dimension],
      softLimit: limits[dimension].soft,
      hardLimit: limits[dimension].hard,
      state,
      degradation: graphQueryBudgetDegradation(dimension, state)
    };
  });
  const overallState = budgets.reduce<GraphQueryCostControlsDto["queuePressure"]["state"]>((current, budget) =>
    graphQueryBudgetStateRank(budget.state) > graphQueryBudgetStateRank(current) ? budget.state : current, "pass");
  const truncatedDimensions = budgets
    .filter((budget) => budget.observed > budget.hardLimit)
    .map((budget) => budget.dimension);
  const boundedRelationshipIds = uniqueSorted(relationships.map((relationship) => relationship.id)).slice(0, 50);
  const tenantId = graphTenantIdFor(snapshot, relationships);
  const workspaceKind = options.workspaceKind ?? "investigation";
  const queueHoldReasons = uniqueSorted([
    ...budgets.filter((budget) => budget.state === "hold" || budget.state === "rollback").map((budget) => `${budget.dimension}_budget_${budget.state}`),
    ...(weakDiscoveryRelationshipIds.length > 0 ? ["weak_discovery_held"] : []),
    ...(publicChannelOnlyRelationshipIds.length > 0 ? ["public_channel_only_held"] : []),
    ...(restrictedMetadataRelationshipIds.length > 0 ? ["restricted_metadata_held"] : []),
    ...(staleRelationshipIds.length > 0 ? ["stale_relationships_held"] : []),
    ...(contradictedRelationshipIds.length > 0 ? ["contradicted_relationships_held"] : []),
    ...(missingLedgerRelationshipIds.length > 0 ? ["missing_ledger_ids_held"] : [])
  ]);

  return {
    mode: "graph_query_cost_controls_tenant_budget",
    generatedAt,
    tenant: {
      tenantId,
      workspaceId: stableId("graph-workspace", `${tenantId}:${workspaceKind}:${options.query ?? "runtime"}:${options.focusNodeId ?? "all"}`),
      workspaceKind,
      isolation: "tenant_and_workspace_scoped_budget"
    },
    budgets,
    continuation: {
      cursorField: "graph.deltas[].cursor",
      ...(truncatedDimensions.length > 0 && deltas[0]?.cursor ? { nextCursor: deltas[0].cursor } : {}),
      boundedRelationshipIds,
      truncatedDimensions
    },
    queuePressure: {
      state: overallState,
      schedulerBudgetClass: workspaceKind === "stix_preview" ? "graph_export_preview" : workspaceKind === "runtime_delta" ? "graph_delta_poll" : "interactive_graph_query",
      maxRuntimeMs: overallState === "rollback" ? 750 : overallState === "hold" ? 1200 : 1800,
      nextPollSeconds: 3,
      holdReasons: queueHoldReasons
    },
    heldFacts: {
      weakDiscoveryRelationshipIds: weakDiscoveryRelationshipIds.slice(0, 50),
      publicChannelOnlyRelationshipIds: publicChannelOnlyRelationshipIds.slice(0, 50),
      restrictedMetadataRelationshipIds: restrictedMetadataRelationshipIds.slice(0, 50),
      staleRelationshipIds: staleRelationshipIds.slice(0, 50),
      contradictedRelationshipIds: contradictedRelationshipIds.slice(0, 50),
      missingLedgerRelationshipIds: missingLedgerRelationshipIds.slice(0, 50),
      policy: "held_facts_never_promote_because_of_budget_truncation"
    },
    stixPreviewLimits: {
      maxPreviewRelationships: 50,
      eligibleRelationshipIds: uniqueSorted(readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId)).slice(0, 50),
      heldRelationshipIds: heldRelationshipIds.slice(0, 50),
      recomputeExportEligibility: "bounded_to_selected_relationship_ids"
    },
    agentHandoffs: {
      agent02SchedulerBudget: "interactive_graph_query_budget",
      agent06EvidenceChain: "evidence_join_rows_bounded_by_ledger_ids",
      agent07QualityConfidence: "held_relationships_keep_quality_caveats",
      agent09ApiCompatibility: "stable_fields_with_cursor_degradation",
      agent10CapacityRunbook: "hold_or_rollback_on_budget_breach"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

export function buildGraphRelationshipDriftMonitorDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    query?: string;
    focusNodeId?: string;
    relationshipIds?: string[];
    workspaceKind?: GraphQueryCostControlsDto["tenant"]["workspaceKind"];
    costControls?: GraphQueryCostControlsDto;
    deltas?: GraphCursorRelationshipDeltaDto[];
  } = {}
): GraphRelationshipDriftMonitorDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const support = snapshot.evidenceSupport.filter((item) => relationships.some((relationship) => relationship.id === item.relationshipId));
  const scopedSnapshot = { ...snapshot, relationships, evidenceSupport: support };
  const costControls = options.costControls ?? buildGraphQueryCostControlsDto(scopedSnapshot, {
    generatedAt,
    query: options.query,
    focusNodeId: options.focusNodeId,
    relationshipIds: relationships.map((relationship) => relationship.id),
    workspaceKind: options.workspaceKind,
    deltas: options.deltas
  });
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const boundedRelationshipIds = new Set(costControls.continuation.boundedRelationshipIds);
  const heldFacts = costControls.heldFacts;
  const weakDiscovery = new Set(heldFacts.weakDiscoveryRelationshipIds);
  const publicChannelOnly = new Set(heldFacts.publicChannelOnlyRelationshipIds);
  const restrictedMetadata = new Set(heldFacts.restrictedMetadataRelationshipIds);
  const stale = new Set(heldFacts.staleRelationshipIds);
  const contradicted = new Set(heldFacts.contradictedRelationshipIds);
  const missingLedger = new Set(heldFacts.missingLedgerRelationshipIds);
  const deltas = options.deltas ?? buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const deltaIds = new Set(deltas.map((delta) => delta.relationshipId));

  const rows = relationships
    .map((relationship): GraphRelationshipDriftMonitorDto["rows"][number] => {
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const relationshipSupport = support.filter((item) => item.relationshipId === relationship.id);
      const findings = uniqueFindingCodes((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code));
      const blockers = uniqueFindingCodes([
        ...findings,
        ...(readinessById.get(relationship.id)?.blockers ?? [])
      ]);
      const supportSourceIds = uniqueSorted(relationshipSupport.map((item) => item.sourceId));
      const signals = new Set<GraphRelationshipDriftSignalKind>();
      const findingSet = new Set(blockers);
      const isAlias = relationship.type === "alias-of" || source.type === "actor" && target.type === "actor";
      const isAttackMapping = source.type === "attack-pattern" || target.type === "attack-pattern";
      const isVictimClaim = source.type === "victim" || target.type === "victim";
      const isInfrastructureHint = source.type === "infrastructure" || target.type === "infrastructure";
      const isCampaignMembership = source.type === "campaign" || target.type === "campaign";
      const hasMissingLedger = missingLedger.has(relationship.id)
        || findingSet.has("missing_ledger_ids")
        || relationshipSupport.length === 0
        || relationshipSupport.some((item) => item.ledgerIds.length === 0);
      const hasRestrictedMetadata = restrictedMetadata.has(relationship.id)
        || findingSet.has("restricted_only_claim")
        || findingSet.has("unsupported_restricted_metadata");
      const hasPublicChannelOnly = publicChannelOnly.has(relationship.id);
      const hasWeakDiscovery = weakDiscovery.has(relationship.id)
        || findingSet.has("weak_discovery_only_edge")
        || findingSet.has("source_bias_cluster");
      const isStale = stale.has(relationship.id)
        || relationship.reviewState === "expired"
        || relationship.properties?.stale === true
        || findingSet.has("stale_accepted_edge")
        || ageInDays(relationship.lastSeenAt, generatedAt) > 180;
      const isContradicted = contradicted.has(relationship.id)
        || relationship.reviewState === "contradicted"
        || relationship.properties?.contradicted === true
        || findingSet.has("contradicted_edge");
      const isBudgetBounded = !boundedRelationshipIds.has(relationship.id);

      if (deltaIds.has(relationship.id)) signals.add("fresh_public_advisory");
      if (hasPublicChannelOnly) signals.add("public_channel_hint");
      if (hasRestrictedMetadata) signals.add("restricted_metadata_review");
      if (hasMissingLedger) signals.add("evidence_replay_failure");
      if (hasWeakDiscovery || findingSet.has("source_bias_cluster")) signals.add("source_pack_expansion");
      if (isContradicted) signals.add("analyst_correction");
      if (isStale) signals.add(ageInDays(relationship.lastSeenAt, generatedAt) > 365 ? "source_retirement" : "fresh_public_advisory");
      if (isCampaignMembership) signals.add("campaign_membership_change");
      if (isAttackMapping) signals.add("attack_mapping_change");
      if (isVictimClaim) signals.add("victim_claim_change");
      if (isInfrastructureHint) signals.add("infrastructure_hint_change");
      if (hasRestrictedMetadata && /leak|dataset/i.test(String(relationship.properties?.category ?? relationship.type))) {
        signals.add("dataset_metadata_hold");
      }

      const exportEligibleBefore = readinessById.get(relationship.id)?.ready ?? false;
      const action = driftActionForRelationship({
        relationship,
        isAlias,
        isStale,
        isContradicted,
        hasMissingLedger,
        hasRestrictedMetadata,
        hasPublicChannelOnly,
        hasWeakDiscovery,
        isBudgetBounded,
        exportEligibleBefore,
        blockerCount: blockers.length
      });
      const nextReviewState = driftReviewStateForAction(action, relationship.reviewState);
      const exportEligibleAfter = action === "keep_promoted" || action === "merge_duplicate";
      return {
        rowId: stableId("graph-drift-row", `${relationship.id}:${action}:${generatedAt}`),
        relationshipId: relationship.id,
        relationshipKind: relationshipKind(relationship, source, target),
        relationshipType: relationship.type,
        sourceRef: relationship.sourceRef,
        targetRef: relationship.targetRef,
        sourceType: source.type,
        targetType: target.type,
        driftSignals: [...signals].sort(),
        action,
        previousReviewState: relationship.reviewState,
        nextReviewState,
        confidenceBefore: relationship.confidence,
        confidenceAfter: driftConfidenceAfter(relationship.confidence, action),
        firstSeenAt: relationship.firstSeenAt,
        lastSeenAt: relationship.lastSeenAt,
        sourceIds: supportSourceIds,
        evidenceIds: uniqueSorted(relationship.evidenceSupportIds),
        ledgerIds: uniqueSorted(relationshipSupport.flatMap((item) => item.ledgerIds)),
        exportEligibleBefore,
        exportEligibleAfter,
        exportBlockers: blockers,
        budgetBounded: isBudgetBounded,
        reason: driftReasonForAction(action)
      };
    })
    .sort((left, right) =>
      Number(right.action !== "keep_promoted") - Number(left.action !== "keep_promoted")
      || Number(right.exportEligibleBefore) - Number(left.exportEligibleBefore)
      || right.confidenceBefore - left.confidenceBefore
      || left.relationshipId.localeCompare(right.relationshipId));

  const changedRelationshipIds = uniqueSorted(rows
    .filter((row) => row.action !== "keep_promoted" || deltaIds.has(row.relationshipId))
    .map((row) => row.relationshipId));
  const eventTypes = uniqueSorted(rows.flatMap((row): GraphRelationshipDriftMonitorDto["deltaContract"]["eventTypes"] => {
    const events: GraphRelationshipDriftMonitorDto["deltaContract"]["eventTypes"] = ["graph.relationship.drift"];
    if (row.action === "mark_stale" || row.action === "preserve_historical") events.push("graph.relationship.stale");
    if (row.action === "mark_contradicted" || row.action === "split_alias") events.push("graph.relationship.contradicted");
    if (!row.exportEligibleAfter) events.push("graph.relationship.export_hold");
    return events;
  })) as GraphRelationshipDriftMonitorDto["deltaContract"]["eventTypes"];

  return {
    mode: "campaign_relationship_drift_monitor",
    generatedAt,
    tenant: {
      tenantId: costControls.tenant.tenantId,
      workspaceId: costControls.tenant.workspaceId,
      workspaceKind: costControls.tenant.workspaceKind,
      budgetState: costControls.queuePressure.state,
      budgetPolicy: "respect_graph_query_cost_controls"
    },
    summary: {
      rowCount: rows.length,
      keepPromoted: rows.filter((row) => row.action === "keep_promoted").length,
      reviewRequired: rows.filter((row) => row.nextReviewState === "needs_review").length,
      stale: rows.filter((row) => row.action === "mark_stale").length,
      contradicted: rows.filter((row) => row.action === "mark_contradicted").length,
      stixBlocked: rows.filter((row) => !row.exportEligibleAfter).length,
      evidenceReplayRequested: rows.filter((row) => row.action === "request_evidence_replay").length,
      sourceExpansionRequested: rows.filter((row) => row.action === "request_source_expansion").length,
      historicalPreserved: rows.filter((row) => row.action === "preserve_historical").length
    },
    rows,
    heldFacts: {
      weakDiscoveryRelationshipIds: heldFacts.weakDiscoveryRelationshipIds,
      publicChannelOnlyRelationshipIds: heldFacts.publicChannelOnlyRelationshipIds,
      restrictedMetadataRelationshipIds: heldFacts.restrictedMetadataRelationshipIds,
      staleRelationshipIds: heldFacts.staleRelationshipIds,
      contradictedRelationshipIds: heldFacts.contradictedRelationshipIds,
      missingLedgerRelationshipIds: heldFacts.missingLedgerRelationshipIds,
      budgetBoundedRelationshipIds: rows.filter((row) => row.budgetBounded).map((row) => row.relationshipId),
      policy: "drift_monitor_never_promotes_held_or_budget_truncated_rows"
    },
    deltaContract: {
      cursorField: "graph.deltas[].cursor",
      nextPollSeconds: 3,
      changedRelationshipIds,
      eventTypes
    },
    agentHandoffs: {
      agent06ChainOfCustody: "request_evidence_replay_for_missing_or_failed_ledger_rows",
      agent07ContradictionWorkbench: "contradicted_and_alias_split_rows_require_quality_review",
      agent09PollingDeltas: "emit_relationship_drift_events_with_3_second_polling",
      agent10ReleaseGate: "block_release_when_unexplained_drift_rows_remain",
      agent01Agent04SourceGaps: "request_source_expansion_for_weak_or_source_biased_rows"
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

function driftActionForRelationship(input: {
  relationship: PersistedGraphRelationship;
  isAlias: boolean;
  isStale: boolean;
  isContradicted: boolean;
  hasMissingLedger: boolean;
  hasRestrictedMetadata: boolean;
  hasPublicChannelOnly: boolean;
  hasWeakDiscovery: boolean;
  isBudgetBounded: boolean;
  exportEligibleBefore: boolean;
  blockerCount: number;
}): GraphRelationshipDriftAction {
  if (input.isContradicted) return input.isAlias ? "split_alias" : "mark_contradicted";
  if (input.isStale) return ageInDays(input.relationship.lastSeenAt, input.relationship.firstSeenAt) > 365 ? "preserve_historical" : "mark_stale";
  if (input.hasMissingLedger) return "request_evidence_replay";
  if (input.hasRestrictedMetadata || input.hasPublicChannelOnly || input.isBudgetBounded) return "block_stix_export";
  if (input.hasWeakDiscovery || input.relationship.reviewState === "unreviewed" || input.relationship.reviewState === "needs_review") return "request_source_expansion";
  if (input.isAlias && input.relationship.reviewState === "accepted" && input.exportEligibleBefore) return "merge_duplicate";
  if (input.exportEligibleBefore && input.relationship.reviewState === "accepted" && input.blockerCount === 0) return "keep_promoted";
  return "demote_to_review";
}

function driftReviewStateForAction(
  action: GraphRelationshipDriftAction,
  currentState: GraphRelationshipReviewState
): GraphRelationshipReviewState {
  if (action === "keep_promoted" || action === "merge_duplicate") return currentState === "accepted" ? "accepted" : "needs_review";
  if (action === "mark_contradicted" || action === "split_alias") return "contradicted";
  if (action === "mark_stale" || action === "preserve_historical") return "expired";
  if (action === "demote_to_review" || action === "request_evidence_replay" || action === "request_source_expansion" || action === "block_stix_export") return "needs_review";
  return "needs_review";
}

function driftConfidenceAfter(confidence: number, action: GraphRelationshipDriftAction): number {
  if (action === "keep_promoted" || action === "merge_duplicate") return confidence;
  if (action === "mark_contradicted" || action === "split_alias") return clampScore(confidence * 0.35);
  if (action === "mark_stale" || action === "preserve_historical") return clampScore(confidence * 0.65);
  if (action === "request_evidence_replay") return clampScore(confidence * 0.75);
  if (action === "request_source_expansion" || action === "block_stix_export") return clampScore(confidence * 0.85);
  return clampScore(confidence * 0.8);
}

function driftReasonForAction(action: GraphRelationshipDriftAction): string {
  if (action === "keep_promoted") return "reviewed relationship remains provenance-backed and export eligible";
  if (action === "merge_duplicate") return "accepted alias relationship can be merged after duplicate review";
  if (action === "split_alias") return "alias relationship is contradicted and should split before promotion";
  if (action === "mark_contradicted") return "relationship has contradictory evidence or analyst correction";
  if (action === "mark_stale") return "relationship is stale and needs refreshed public evidence";
  if (action === "preserve_historical") return "relationship is stale enough to preserve as historical only";
  if (action === "request_evidence_replay") return "ledger or provenance replay is incomplete";
  if (action === "request_source_expansion") return "relationship needs stronger public source coverage";
  if (action === "block_stix_export") return "policy, restricted metadata, public-channel, or budget hold blocks export";
  return "relationship should return to analyst review before promotion";
}

export function buildGraphRelationshipExplainabilityDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
    driftMonitor?: GraphRelationshipDriftMonitorDto;
    exportGovernance?: GraphReviewedExportSubsetGovernanceDto;
  } = {}
): GraphRelationshipExplainabilityDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const relationships = relationshipIdSet
    ? snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id))
    : snapshot.relationships;
  const scopedSupport = snapshot.evidenceSupport.filter((support) => relationships.some((relationship) => relationship.id === support.relationshipId));
  const scopedSnapshot = { ...snapshot, relationships, evidenceSupport: scopedSupport };
  const readiness = checkStixExportReadiness(scopedSnapshot);
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const findingsByRelationship = graphFindingsByRelationship(scopedSnapshot, generatedAt);
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const driftMonitor = options.driftMonitor ?? buildGraphRelationshipDriftMonitorDto(scopedSnapshot, { generatedAt });
  const driftRowsById = new Map(driftMonitor.rows.map((row) => [row.relationshipId, row]));
  const reviewedEligible = new Set(options.exportGovernance?.eligibleRelationshipIds ?? []);
  const rows = relationships
    .map((relationship): GraphRelationshipExplainabilityDto["rows"][number] => {
      const sourceNode = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const targetNode = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const support = supportFor(scopedSnapshot, relationship.id);
      const findings = uniqueFindingCodes((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code));
      const readinessRow = readinessById.get(relationship.id);
      const drift = driftRowsById.get(relationship.id);
      const exportBlockers = uniqueFindingCodes([...(readinessRow?.blockers ?? []), ...findings]);
      const eligible = readinessRow?.ready ?? false;
      const status = explainabilityStatus(relationship, eligible, exportBlockers, drift?.action);
      const trend = explainabilityConfidenceTrend(relationship, drift?.action, generatedAt);
      const attackContext = explainabilityAttackCampaignContext(relationship, sourceNode, targetNode, relationships, nodesById);
      const reviewDecisionIds = uniqueSorted(relationship.reviewAudit.map((entry) => entry.decisionId));
      const ledgerRefs = uniqueSorted([
        ...support.flatMap((item) => item.ledgerIds),
        ...propertyStringArray(relationship.properties, "claimLedgerIds"),
        ...propertyStringArray(relationship.properties, "claimLedgerRefs")
      ]);
      const caveats = explainabilityCaveats(status, exportBlockers, drift?.action);
      return {
        explanationId: stableId("graph-explanation", `${relationship.id}:${status}:${generatedAt}`),
        relationshipId: relationship.id,
        relationshipKind: relationshipKind(relationship, sourceNode, targetNode),
        relationshipType: relationship.type,
        source: { nodeId: sourceNode.id, type: sourceNode.type, value: sourceNode.value },
        target: { nodeId: targetNode.id, type: targetNode.type, value: targetNode.value },
        status,
        summary: explainabilitySummary(status, relationship, sourceNode.value, targetNode.value),
        why: explainabilityReasons(relationship, support, exportBlockers, drift),
        sourceIds: uniqueSorted(support.map((item) => item.sourceId)),
        evidenceIds: uniqueSorted(relationship.evidenceSupportIds),
        claimLedgerRefs: ledgerRefs,
        reviewDecisionIds,
        confidence: {
          current: relationship.confidence,
          trend,
          historyPoints: relationship.confidenceHistory.length
        },
        drift: {
          action: drift?.action ?? (eligible ? "keep_promoted" : "demote_to_review"),
          signals: drift?.driftSignals ?? [],
          confidenceAfter: drift?.confidenceAfter ?? relationship.confidence
        },
        attackCampaignContext: attackContext,
        exportEligibility: {
          eligible,
          blockers: exportBlockers,
          reviewedSubsetEligible: reviewedEligible.size > 0 ? reviewedEligible.has(relationship.id) : eligible,
          taxiiBoundary: "descriptor_only_no_server"
        },
        caveats,
        agentHandoffs: {
          agent06EvidenceReplay: exportBlockers.some((code) => code === "missing_ledger_ids" || code === "missing_provenance") ? [relationship.id] : [],
          agent07QualityReview: status === "contradicted" || status === "stale" || status === "held" || status === "split" ? [relationship.id] : [],
          agent09DeltaFields: ["relationshipId", "drift.action", "exportEligibility", "confidence.trend"],
          agent10ReleaseArtifact: "relationship_explanation_row"
        },
        noLeak: {
          rawRestrictedMaterialIncluded: false,
          objectKeysIncluded: false,
          unsafeUrlsIncluded: false,
          metadataOnly: true
        }
      };
    })
    .sort((left, right) => Number(right.status === "export_blocked" || right.status === "held") - Number(left.status === "export_blocked" || left.status === "held") || right.confidence.current - left.confidence.current || left.relationshipId.localeCompare(right.relationshipId));

  return {
    mode: "graph_relationship_explainability",
    generatedAt,
    rows,
    summary: {
      rowCount: rows.length,
      promoted: rows.filter((row) => row.status === "promoted").length,
      held: rows.filter((row) => row.status === "held").length,
      stale: rows.filter((row) => row.status === "stale").length,
      contradicted: rows.filter((row) => row.status === "contradicted").length,
      exportReady: rows.filter((row) => row.status === "export_ready" || row.exportEligibility.eligible).length,
      exportBlocked: rows.filter((row) => row.status === "export_blocked" || !row.exportEligibility.eligible).length
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

function buildGraphInvestigationNotebookExportDto(input: {
  generatedAt: string;
  query: string;
  focusNodeId?: string;
  nodes: GraphInvestigationWorkspaceDto["nodes"];
  relationships: PersistedGraphRelationship[];
  relationshipExplanations: GraphRelationshipExplainabilityDto;
  driftMonitor: GraphRelationshipDriftMonitorDto;
  exportGovernance: GraphReviewedExportSubsetGovernanceDto;
  costControls: GraphQueryCostControlsDto;
  pivotRecommendations: GraphAttackCampaignWorkspaceDto["searchPivotRecommendations"];
}): GraphInvestigationNotebookExportDto {
  const explanationById = new Map(input.relationshipExplanations.rows.map((row) => [row.relationshipId, row]));
  const boundedRelationshipIds = new Set(input.costControls.continuation.boundedRelationshipIds);
  const boundedRelationships = input.relationships.filter((relationship) => boundedRelationshipIds.has(relationship.id)).slice(0, 50);
  const caveats = uniqueSorted([
    ...input.relationshipExplanations.rows.flatMap((row) => row.caveats),
    ...(input.driftMonitor.summary.stixBlocked > 0 ? ["some relationships are held from STIX export"] : []),
    ...(input.costControls.queuePressure.holdReasons.length > 0 ? ["query budget or held-fact policy affects notebook scope"] : [])
  ]);
  const fallbackPivots = input.pivotRecommendations.length > 0
    ? input.pivotRecommendations
    : input.nodes
        .filter((node) => node.heldRelationshipCount > 0 || node.exportReadyRelationshipCount > 0)
        .slice(0, 8)
        .map((node) => ({
          query: `${node.type}:${node.value}`,
          nodeId: node.nodeId,
          nodeValue: node.value,
          sourceRelationshipIds: node.relationshipIds.slice(0, 8),
          confidence: node.exportReadyRelationshipCount > 0 ? 0.72 : 0.48,
          priority: node.heldRelationshipCount > 0 ? "high" as const : "medium" as const,
          reason: node.heldRelationshipCount > 0 ? "review held relationships before promotion" : "inspect export-ready relationship context",
          expectedSearchEffect: node.heldRelationshipCount > 0 ? "request_more_evidence" as const : "open_graph_neighborhood" as const,
          safety: {
            willStartCrawling: false,
            willFetchRestrictedMaterial: false,
            metadataOnly: true,
            taxiiBoundary: "descriptor_only_no_server" as const
          }
        }));
  return {
    mode: "metadata_only_graph_investigation_notebook_export",
    generatedAt: input.generatedAt,
    query: input.query,
    investigationId: stableId("graph-investigation", `${input.query}:${input.focusNodeId ?? "all"}:${input.generatedAt}`),
    exportPacketId: stableId("graph-notebook", `${input.query}:${input.generatedAt}:${boundedRelationships.length}`),
    boundedNodes: input.nodes.slice(0, 75).map((node) => ({
      nodeId: node.nodeId,
      type: node.type,
      value: node.value,
      relationshipIds: node.relationshipIds.filter((relationshipId) => boundedRelationshipIds.has(relationshipId)).slice(0, 25),
      reviewStates: node.reviewStates,
      exportReadyRelationshipCount: node.exportReadyRelationshipCount,
      heldRelationshipCount: node.heldRelationshipCount
    })),
    boundedEdges: boundedRelationships.map((relationship) => {
      const drift = input.driftMonitor.rows.find((row) => row.relationshipId === relationship.id);
      const explanation = explanationById.get(relationship.id);
      return {
        relationshipId: relationship.id,
        sourceRef: relationship.sourceRef,
        targetRef: relationship.targetRef,
        relationshipKind: explanation?.relationshipKind ?? "evidence-provenance",
        reviewState: relationship.reviewState,
        driftAction: drift?.action ?? "demote_to_review",
        exportEligible: explanation?.exportEligibility.eligible ?? false,
        caveats: explanation?.caveats ?? ["relationship explanation unavailable"]
      };
    }),
    pivotRecommendations: fallbackPivots.slice(0, 12).map((pivot) => ({
      query: pivot.query,
      nodeId: pivot.nodeId,
      nodeValue: pivot.nodeValue,
      sourceRelationshipIds: pivot.sourceRelationshipIds,
      priority: pivot.priority,
      reason: pivot.reason
    })),
    caveats,
    relationshipExplanations: input.relationshipExplanations.rows.slice(0, 50),
    stixPreviewDescriptor: {
      mediaType: "application/stix+json;version=2.1",
      eligibleRelationshipIds: input.exportGovernance.eligibleRelationshipIds,
      heldRelationshipIds: input.exportGovernance.heldRelationshipIds,
      taxiiBoundary: "descriptor_only_no_server",
      previewOnly: true
    },
    costBudget: {
      tenantId: input.costControls.tenant.tenantId,
      workspaceId: input.costControls.tenant.workspaceId,
      budgetState: input.costControls.queuePressure.state,
      boundedRelationshipIds: input.costControls.continuation.boundedRelationshipIds,
      truncatedDimensions: input.costControls.continuation.truncatedDimensions,
      nextPollSeconds: 3
    },
    deltaClientContract: graphDeltaClientContract(),
    handoffs: {
      agent06EvidenceReplay: input.relationshipExplanations.rows.flatMap((row) => row.agentHandoffs.agent06EvidenceReplay),
      agent07QualityReview: input.relationshipExplanations.rows.flatMap((row) => row.agentHandoffs.agent07QualityReview),
      agent09ApiSseDeltas: ["graph.relationship.explanation", "graph.notebook.export_ready", "graph.relationship.export_hold"],
      agent10ReleaseArtifacts: ["relationship_explanations", "metadata_only_notebook_export"],
      agent01SourceGaps: input.driftMonitor.rows.filter((row) => row.action === "request_source_expansion").map((row) => row.relationshipId),
      agent04PublicSourceBenchmarks: input.driftMonitor.rows.filter((row) => row.driftSignals.includes("source_pack_expansion")).map((row) => row.relationshipId)
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
}

function explainabilityStatus(
  relationship: PersistedGraphRelationship,
  eligible: boolean,
  blockers: GraphIntegrityFindingCode[],
  driftAction?: GraphRelationshipDriftAction
): GraphRelationshipExplainabilityDto["rows"][number]["status"] {
  if (driftAction === "split_alias") return "split";
  if (driftAction === "merge_duplicate") return "merged";
  if (driftAction === "mark_contradicted" || relationship.reviewState === "contradicted" || blockers.includes("contradicted_edge")) return "contradicted";
  if (driftAction === "mark_stale" || driftAction === "preserve_historical" || relationship.reviewState === "expired" || blockers.includes("stale_accepted_edge")) return "stale";
  if (!eligible && blockers.length > 0) return "export_blocked";
  if (!eligible) return "held";
  if (relationship.exportEligibility.promoted) return "promoted";
  return "export_ready";
}

function explainabilityConfidenceTrend(
  relationship: PersistedGraphRelationship,
  driftAction: GraphRelationshipDriftAction | undefined,
  generatedAt: string
): GraphRelationshipExplainabilityDto["rows"][number]["confidence"]["trend"] {
  if (driftAction === "mark_contradicted" || driftAction === "split_alias" || relationship.reviewState === "contradicted") return "contradicted";
  if (driftAction === "mark_stale" || driftAction === "preserve_historical" || relationship.reviewState === "expired" || ageInDays(relationship.lastSeenAt, generatedAt) > 180) return "stale";
  const first = relationship.confidenceHistory[0]?.confidence;
  const last = relationship.confidenceHistory.at(-1)?.confidence ?? relationship.confidence;
  if (first === undefined || relationship.confidenceHistory.length <= 1) return "new";
  if (last - first >= 0.08) return "rising";
  if (first - last >= 0.08) return "falling";
  return "stable";
}

function explainabilityAttackCampaignContext(
  relationship: PersistedGraphRelationship,
  source: PersistedGraphNode,
  target: PersistedGraphNode,
  relationships: PersistedGraphRelationship[],
  nodesById: Map<string, PersistedGraphNode>
): GraphRelationshipExplainabilityDto["rows"][number]["attackCampaignContext"] {
  const linkedNodeIds = new Set([relationship.sourceRef, relationship.targetRef]);
  const linkedRelationships = relationships.filter((item) =>
    item.id === relationship.id || linkedNodeIds.has(item.sourceRef) || linkedNodeIds.has(item.targetRef));
  const linkedNodes = uniqueSorted([
    source.id,
    target.id,
    ...linkedRelationships.flatMap((item) => [item.sourceRef, item.targetRef])
  ])
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is PersistedGraphNode => Boolean(node));
  return {
    attackIds: uniqueSorted(linkedNodes.filter((node) => node.type === "attack-pattern").flatMap((node) => [
      ...propertyStringArray(node.properties, "attackId"),
      ...propertyStringArray(node.properties, "mitreAttackId"),
      node.value.match(/\bT\d{4}(?:\.\d{3})?\b/)?.[0] ?? ""
    ]).filter(Boolean)),
    campaignIds: uniqueSorted(linkedNodes.filter((node) => node.type === "campaign").map((node) => node.id)),
    techniqueIds: uniqueSorted(linkedNodes.filter((node) => node.type === "attack-pattern").map((node) => node.id)),
    actorIds: uniqueSorted(linkedNodes.filter((node) => node.type === "actor").map((node) => node.id))
  };
}

function explainabilitySummary(
  status: GraphRelationshipExplainabilityDto["rows"][number]["status"],
  relationship: PersistedGraphRelationship,
  sourceValue: string,
  targetValue: string
): string {
  if (status === "promoted" || status === "export_ready") return `${sourceValue} ${relationship.type} ${targetValue} is reviewed and provenance-backed.`;
  if (status === "stale") return `${sourceValue} ${relationship.type} ${targetValue} is stale and needs refreshed public evidence.`;
  if (status === "contradicted") return `${sourceValue} ${relationship.type} ${targetValue} is contradicted and must stay out of promotion.`;
  if (status === "split") return `${sourceValue} ${relationship.type} ${targetValue} should split before alias promotion.`;
  if (status === "merged") return `${sourceValue} ${relationship.type} ${targetValue} is eligible for duplicate merge review.`;
  if (status === "export_blocked") return `${sourceValue} ${relationship.type} ${targetValue} is blocked from STIX export.`;
  return `${sourceValue} ${relationship.type} ${targetValue} remains held for analyst review.`;
}

function explainabilityReasons(
  relationship: PersistedGraphRelationship,
  support: GraphEvidenceSupportRecord[],
  blockers: GraphIntegrityFindingCode[],
  drift?: GraphRelationshipDriftMonitorDto["rows"][number]
): string[] {
  return uniqueSorted([
    support.length > 0 ? "has evidence support rows" : "missing evidence support rows",
    support.some((item) => item.ledgerIds.length > 0) ? "has claim/evidence ledger references" : "missing ledger references",
    relationship.reviewState === "accepted" ? "accepted by review state" : `review state is ${relationship.reviewState}`,
    relationship.exportEligibility.promoted ? "marked promoted in relationship eligibility" : "not promoted by default",
    ...(blockers.length > 0 ? blockers.map((code) => `export blocker: ${code}`) : ["no export blockers"]),
    ...(drift ? [`drift action: ${drift.action}`, ...drift.driftSignals.map((signal) => `drift signal: ${signal}`)] : [])
  ]);
}

function explainabilityCaveats(
  status: GraphRelationshipExplainabilityDto["rows"][number]["status"],
  blockers: GraphIntegrityFindingCode[],
  driftAction?: GraphRelationshipDriftAction
): string[] {
  return uniqueSorted([
    ...(status === "held" || status === "export_blocked" ? ["held from public fact promotion"] : []),
    ...(status === "stale" ? ["stale relationship requires refreshed evidence"] : []),
    ...(status === "contradicted" || status === "split" ? ["contradiction requires quality review"] : []),
    ...(blockers.includes("restricted_only_claim") || blockers.includes("unsupported_restricted_metadata") ? ["restricted metadata remains descriptor-only"] : []),
    ...(blockers.includes("weak_discovery_only_edge") ? ["weak discovery-only evidence cannot promote"] : []),
    ...(blockers.includes("missing_ledger_ids") || blockers.includes("missing_provenance") ? ["evidence replay required before export"] : []),
    ...(driftAction === "request_source_expansion" ? ["source expansion requested"] : [])
  ]);
}

function propertyStringArray(properties: PersistedGraphRelationship["properties"] | PersistedGraphNode["properties"], key: string): string[] {
  const value = properties?.[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function graphQueryBudgetState(
  observed: number,
  limit: { soft: number; hard: number }
): GraphQueryCostControlsDto["budgets"][number]["state"] {
  if (observed > limit.hard * 2) return "rollback";
  if (observed > limit.hard) return "hold";
  if (observed > limit.soft) return "watch";
  return "pass";
}

function graphQueryBudgetDegradation(
  dimension: GraphQueryBudgetDimension,
  state: GraphQueryCostControlsDto["budgets"][number]["state"]
): GraphQueryCostControlsDto["budgets"][number]["degradation"] {
  if (state === "pass") return "none";
  if (state === "rollback") return "rollback_to_summary";
  if (dimension === "stix_preview_rows" || dimension === "export_eligibility_recomputation") return "hold_export";
  if (dimension === "relationship_review_rows" || dimension === "campaign_pivots") return "hold_expansion";
  return "truncate_with_cursor";
}

function graphQueryBudgetStateRank(state: GraphQueryCostControlsDto["queuePressure"]["state"]): number {
  if (state === "rollback") return 3;
  if (state === "hold") return 2;
  if (state === "watch") return 1;
  return 0;
}

function graphTenantIdFor(snapshot: PersistedGraphSnapshot, relationships: PersistedGraphRelationship[]): string {
  const explicit = relationships
    .map((relationship) => relationship.properties?.tenantId)
    .find((tenantId): tenantId is string => typeof tenantId === "string" && tenantId.length > 0);
  if (explicit) return explicit;
  const nodeTenant = snapshot.nodes
    .map((node) => node.properties?.tenantId)
    .find((tenantId): tenantId is string => typeof tenantId === "string" && tenantId.length > 0);
  return nodeTenant ?? "default";
}

function graphQueryEstimatedCostUnits(input: {
  relationshipCount: number;
  nodeCount: number;
  evidenceSupportCount: number;
  cursorDeltaCount: number;
  reviewHoldCount: number;
}): number {
  return input.relationshipCount * 3
    + input.nodeCount * 2
    + input.evidenceSupportCount
    + input.cursorDeltaCount
    + input.reviewHoldCount * 4;
}

function graphQueryCostBand(
  estimatedCostUnits: number,
  relationshipCount: number,
  nodeCount: number
): GraphBackendPerformanceSoakDto["queryCost"]["costBand"] {
  if (estimatedCostUnits > 500 || relationshipCount > 100 || nodeCount > 150) return "rollback";
  if (estimatedCostUnits > 250 || relationshipCount > 50 || nodeCount > 75) return "high";
  if (estimatedCostUnits > 120 || relationshipCount > 25 || nodeCount > 40) return "medium";
  return "low";
}

function buildGraphBackendLatencyTargets(
  costBand: GraphBackendPerformanceSoakDto["queryCost"]["costBand"],
  estimatedCostUnits: number
): GraphBackendPerformanceSoakDto["latencyTargets"] {
  const status = costBand === "rollback"
    ? "rollback"
    : costBand === "high"
      ? "hold"
      : costBand === "medium"
        ? "watch"
        : "pass";
  const p95Base = Math.max(25, estimatedCostUnits * 4);
  return [
    {
      backend: "memory_snapshot",
      p95Ms: Math.min(750, p95Base),
      p99Ms: Math.min(1200, p95Base * 1.6),
      status,
      reason: "embedded runtime must keep bounded graph queries inside the public 3-second polling window"
    },
    {
      backend: "postgres_graph_tables",
      p95Ms: Math.min(1200, p95Base * 1.5),
      p99Ms: Math.min(2200, p95Base * 2.3),
      status,
      reason: "Postgres graph-table candidate must preserve tenant indexes and cursor continuity under replay"
    },
    {
      backend: "neo4j",
      p95Ms: Math.min(1400, p95Base * 1.7),
      p99Ms: Math.min(2500, p95Base * 2.5),
      status,
      reason: "future graph backend remains candidate-only until query plans and export holds match DTO semantics"
    }
  ];
}
function buildNeo4jNodeLabelProjection(
  nodes: PersistedGraphNode[]
): GraphNeo4jMigrationAdapterBenchmarkDto["nodeLabelProjection"] {
  const labelSpecs: Array<{ label: string; sourceNodeTypes: IntelligenceNodeType[] }> = [
    { label: "Actor", sourceNodeTypes: ["actor"] },
    { label: "Campaign", sourceNodeTypes: ["campaign"] },
    { label: "AttackPattern", sourceNodeTypes: ["attack-pattern"] },
    { label: "MalwareTool", sourceNodeTypes: ["malware", "tool"] },
    { label: "Victim", sourceNodeTypes: ["victim"] },
    { label: "Infrastructure", sourceNodeTypes: ["infrastructure"] },
    { label: "Vulnerability", sourceNodeTypes: ["vulnerability"] },
    { label: "Source", sourceNodeTypes: ["source"] },
    { label: "GraphNode", sourceNodeTypes: ["actor", "campaign", "attack-pattern", "malware", "tool", "victim", "infrastructure", "vulnerability", "source", "sector", "country", "incident", "indicator"] }
  ];
  const requiredProperties: GraphNeo4jMigrationAdapterBenchmarkDto["nodeLabelProjection"][number]["requiredProperties"] = ["tenant_id", "workspace_id", "node_id", "type", "value", "confidence", "first_seen_at", "last_seen_at"];
  return labelSpecs
    .map((spec): GraphNeo4jMigrationAdapterBenchmarkDto["nodeLabelProjection"][number] => ({
      label: spec.label,
      sourceNodeTypes: spec.sourceNodeTypes,
      count: nodes.filter((node) => spec.sourceNodeTypes.includes(node.type)).length,
      requiredProperties
    }))
    .filter((row) => row.count > 0 || row.label === "GraphNode");
}

function buildNeo4jRelationshipProjection(
  relationships: PersistedGraphRelationship[],
  readiness: StixExportReadinessReportDto
): GraphNeo4jMigrationAdapterBenchmarkDto["relationshipProjection"] {
  const readinessById = new Map(readiness.relationships.map((relationship) => [relationship.relationshipId, relationship]));
  const types = uniqueSorted(relationships.map((relationship) => relationship.type)) as IntelligenceRelationshipType[];
  return types.map((type) => {
    const typedRelationships = relationships.filter((relationship) => relationship.type === type);
    return {
      relationshipType: type,
      count: typedRelationships.length,
      requiredProperties: ["tenant_id", "workspace_id", "relationship_id", "review_state", "confidence", "first_seen_at", "last_seen_at", "export_eligible"],
      exportEligibleCount: typedRelationships.filter((relationship) => readinessById.get(relationship.id)?.ready ?? false).length,
      heldCount: typedRelationships.filter((relationship) => !(readinessById.get(relationship.id)?.ready ?? false)).length
    };
  });
}

function buildNeo4jBenchmarkScenarios(
  relationships: PersistedGraphRelationship[],
  readiness: StixExportReadinessReportDto,
  deltas: GraphCursorRelationshipDeltaDto[]
): GraphNeo4jMigrationAdapterBenchmarkDto["benchmarkScenarios"] {
  const readyRelationshipIds = readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId);
  const heldRelationshipIds = readiness.relationships.filter((relationship) => !relationship.ready).map((relationship) => relationship.relationshipId);
  const techniqueRelationshipIds = relationships.filter((relationship) => relationship.type === "uses").map((relationship) => relationship.id);
  const campaignRelationshipIds = relationships
    .filter((relationship) => relationship.type === "attributed-to" || relationship.type === "uses" || relationship.type === "targets")
    .map((relationship) => relationship.id);
  const statusForRows = (expectedRows: number, hardLimit: number): GraphNeo4jMigrationAdapterBenchmarkDto["benchmarkScenarios"][number]["status"] => {
    if (expectedRows > hardLimit * 2) return "rollback";
    if (expectedRows > hardLimit) return "hold";
    if (expectedRows > hardLimit * 0.75) return "warning";
    return "pass";
  };
  return [
    {
      name: "actor_one_hop",
      cypherShape: "MATCH (actor:Actor {tenant_id:$tenantId})-[r:GRAPH_RELATIONSHIP]-(n:GraphNode) RETURN actor,r,n LIMIT $limit",
      relationshipIds: relationships.slice(0, 25).map((relationship) => relationship.id),
      expectedRows: Math.min(relationships.length, 50),
      p95MsTarget: 80,
      p99MsTarget: 150,
      status: statusForRows(relationships.length, 75),
      rollbackThreshold: "one_hop_rows_exceed_150_or_relationship_id_parity_fails"
    },
    {
      name: "campaign_two_hop",
      cypherShape: "MATCH (actor:Actor)-[r1:GRAPH_RELATIONSHIP]-(campaign:Campaign)-[r2:GRAPH_RELATIONSHIP]-(ttp:AttackPattern) RETURN actor,r1,campaign,r2,ttp LIMIT $limit",
      relationshipIds: campaignRelationshipIds.slice(0, 25),
      expectedRows: Math.min(campaignRelationshipIds.length, 75),
      p95MsTarget: 140,
      p99MsTarget: 240,
      status: statusForRows(campaignRelationshipIds.length, 90),
      rollbackThreshold: "campaign_two_hop_rows_exceed_180_or_review_hold_filter_missing"
    },
    {
      name: "attack_matrix",
      cypherShape: "MATCH (:Actor)-[r:GRAPH_RELATIONSHIP]->(ttp:AttackPattern) WHERE r.export_eligible = true RETURN ttp.attack_id,r.review_state,r.confidence",
      relationshipIds: techniqueRelationshipIds.slice(0, 25),
      expectedRows: Math.min(techniqueRelationshipIds.length, 40),
      p95MsTarget: 90,
      p99MsTarget: 180,
      status: statusForRows(techniqueRelationshipIds.length, 60),
      rollbackThreshold: "attack_matrix_rows_exceed_120_or_attack_id_projection_missing"
    },
    {
      name: "stix_preview_subset",
      cypherShape: "MATCH ()-[r:GRAPH_RELATIONSHIP]->() WHERE r.export_eligible = true AND r.review_state = 'accepted' RETURN r.relationship_id,r.provenance_ids LIMIT $limit",
      relationshipIds: readyRelationshipIds.slice(0, 25),
      expectedRows: Math.min(readyRelationshipIds.length, 50),
      p95MsTarget: 120,
      p99MsTarget: 220,
      status: statusForRows(readyRelationshipIds.length + heldRelationshipIds.length, 100),
      rollbackThreshold: "stix_preview_rows_exceed_200_or_held_rows_become_exportable"
    },
    {
      name: "cursor_replay",
      cypherShape: "MATCH ()-[r:GRAPH_RELATIONSHIP]->() WHERE r.cursor > $afterCursor RETURN r ORDER BY r.cursor ASC LIMIT $limit",
      relationshipIds: deltas.slice(0, 25).map((delta) => delta.relationshipId),
      expectedRows: Math.min(deltas.length, 100),
      p95MsTarget: 70,
      p99MsTarget: 140,
      status: statusForRows(deltas.length, 125),
      rollbackThreshold: "cursor_replay_rows_exceed_250_or_cursor_order_not_stable"
    }
  ];
}

function neo4jAdapterBlockers(
  status: GraphNeo4jMigrationAdapterBenchmarkDto["status"],
  hasMissingLedger: boolean,
  heldRowsRemainNonExportable: boolean,
  scenarios: GraphNeo4jMigrationAdapterBenchmarkDto["benchmarkScenarios"]
): string[] {
  const blockers = new Set<string>();
  if (status === "pass") return [];
  if (hasMissingLedger) blockers.add("missing_ledger_replay_before_neo4j_import");
  if (!heldRowsRemainNonExportable) blockers.add("held_rows_export_eligibility_parity_failed");
  for (const scenario of scenarios) {
    if (scenario.status === "hold" || scenario.status === "rollback") blockers.add(`${scenario.name}_benchmark_${scenario.status}`);
  }
  return [...blockers].sort();
}

function buildGraphBackendSoakScenarios(
  relationships: PersistedGraphRelationship[],
  reviewHoldIds: string[],
  deltas: GraphCursorRelationshipDeltaDto[],
  findingsByRelationship: Map<string, GraphIntegrityFindingDto[]>,
  queueState: GraphBackendPerformanceSoakDto["queuePressure"]["state"]
): GraphBackendPerformanceSoakDto["soakScenarios"] {
  const relationshipIds = uniqueSorted(relationships.map((relationship) => relationship.id));
  const criticalFindingIds = uniqueSorted([...findingsByRelationship.entries()]
    .filter(([, findings]) => findings.some((finding) => finding.severity === "critical"))
    .map(([relationshipId]) => relationshipId));
  const scenarioState: GraphBackendPerformanceSoakDto["soakScenarios"][number]["expectedState"] = queueState;
  return [
    {
      name: "actor_query",
      relationshipIds: relationshipIds.slice(0, 25),
      expectedState: scenarioState,
      rollbackThreshold: "p99_above_3000ms_or_more_than_50_relationships_without_cursor"
    },
    {
      name: "campaign_timeline",
      relationshipIds: relationships.filter((relationship) => relationship.type === "uses" || relationship.type === "attributed-to").map((relationship) => relationship.id).slice(0, 25),
      expectedState: scenarioState,
      rollbackThreshold: "timeline_events_exceed_page_budget_or_missing_attack_provenance"
    },
    {
      name: "stix_export_preview",
      relationshipIds: criticalFindingIds.length > 0 ? criticalFindingIds.slice(0, 25) : relationshipIds.slice(0, 25),
      expectedState: criticalFindingIds.length > 0 ? "rollback" : scenarioState,
      rollbackThreshold: "critical_schema_or_provenance_findings_block_export"
    },
    {
      name: "cursor_replay",
      relationshipIds: uniqueSorted(deltas.map((delta) => delta.relationshipId)).slice(0, 25),
      expectedState: deltas.length > 100 ? "hold" : scenarioState,
      rollbackThreshold: "cursor_delta_count_exceeds_100_or_latest_cursor_missing"
    },
    {
      name: "review_hold_burst",
      relationshipIds: reviewHoldIds.slice(0, 25),
      expectedState: reviewHoldIds.length > 50 ? "hold" : scenarioState,
      rollbackThreshold: "review_hold_queue_exceeds_50_or_public_fact_policy_not_hold_weak_edges"
    }
  ];
}

function buildGraphBackendMigrationSchemas(snapshot: PersistedGraphSnapshot): GraphBackendMigrationSchemaDto[] {
  const nodeKinds = uniqueSorted(snapshot.nodes.map((node) => node.type)) as IntelligenceNodeType[];
  const recordKinds: GraphBackendCutoverRecordKind[] = [
    ...nodeKinds,
    "relationship",
    "evidence_support",
    "review_decision",
    "confidence_history",
    "cursor_delta",
    "export_eligibility"
  ];
  return [
    {
      backend: "postgres_graph_tables",
      schemaName: "ti_graph",
      recordKinds,
      tablesOrLabels: [
        "graph_nodes",
        "graph_relationships",
        "graph_evidence_support",
        "graph_review_audit",
        "graph_confidence_history",
        "graph_cursor_deltas",
        "graph_export_eligibility"
      ],
      requiredIndexes: [
        "tenant_id,node_id",
        "tenant_id,relationship_id",
        "tenant_id,source_ref,target_ref,type",
        "tenant_id,cursor",
        "tenant_id,review_state,last_seen_at"
      ],
      tenantIsolation: "tenant_id_partition_or_label_property_required",
      rollbackUnit: "snapshot_generation",
      summary: "Postgres graph tables keep append-only provenance, review audit, confidence history, and cursor rows while preserving API DTO ids."
    },
    {
      backend: "neo4j",
      schemaName: "ti_graph_labels",
      recordKinds,
      tablesOrLabels: [
        "GraphNode",
        "GraphRelationship",
        "EvidenceSupport",
        "ReviewDecision",
        "ConfidenceHistory",
        "CursorDelta",
        "ExportEligibility"
      ],
      requiredIndexes: [
        "GraphNode(tenant_id,node_id)",
        "GraphRelationship(tenant_id,relationship_id)",
        "CursorDelta(tenant_id,cursor)",
        "ReviewDecision(tenant_id,relationship_id,decided_at)",
        "ExportEligibility(tenant_id,relationship_id)"
      ],
      tenantIsolation: "tenant_id_partition_or_label_property_required",
      rollbackUnit: "snapshot_generation",
      summary: "Neo4j-compatible labels are an alternate storage target; the same tenant id, relationship id, cursor, and audit semantics stay mandatory."
    }
  ];
}

function relationshipIdsByCodes(
  findingsByRelationship: Map<string, GraphIntegrityFindingDto[]>,
  codes: GraphIntegrityFindingCode[]
): string[] {
  return uniqueSorted([...findingsByRelationship.entries()]
    .filter(([_relationshipId, findings]) => findings.some((finding) => codes.includes(finding.code)))
    .map(([relationshipId]) => relationshipId));
}

function graphRepositoryOperation(
  kind: GraphBackendRepositoryContractDto["operations"][number]["kind"],
  tableOrLabel: string,
  idField: string,
  requiredFields: string[],
  appendOnly: boolean,
  summary: string
): GraphBackendRepositoryContractDto["operations"][number] {
  return {
    kind,
    tableOrLabel,
    idField,
    requiredFields,
    tenantScoped: true,
    appendOnly,
    summary
  };
}

export function buildGraphLiveSearchUpdateDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    endpoint: GraphLiveSearchUpdateDto["endpoint"];
    generatedAt?: string;
    relationshipIds?: string[];
  }
): GraphLiveSearchUpdateDto {
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
  const deltas = buildRelationshipCursorDeltas(scopedSnapshot, { generatedAt });
  const deltaByRelationship = new Map(deltas.map((delta) => [delta.relationshipId, delta]));
  const scenarioSpecs: Array<{
    name: GraphLiveSearchUpdateScenarioName;
    summary: string;
    matches: (relationship: PersistedGraphRelationship, source: PersistedGraphNode, target: PersistedGraphNode, codes: GraphIntegrityFindingCode[], support: GraphEvidenceSupportRecord[]) => boolean;
  }> = [
    { name: "apt29_clear_web", summary: "APT29 clear-web evidence can increment graph relationships with provenance-backed caveats or reviewed facts.", matches: (_relationship, source, target, _codes, support) => hasNodeValue(source, target, "APT29") && hasClearWebSupport(support) },
    { name: "apt42_clear_web", summary: "APT42 clear-web evidence is represented as incremental actor graph context instead of falling back to cached defaults.", matches: (_relationship, source, target, _codes, support) => hasNodeValue(source, target, "APT42") && hasClearWebSupport(support) },
    { name: "turla_clear_web", summary: "Turla clear-web updates preserve stale and current relationship deltas for live actor search.", matches: (_relationship, source, target, _codes, support) => hasNodeValue(source, target, "Turla") && hasClearWebSupport(support) },
    { name: "volt_typhoon_public_channel", summary: "Volt Typhoon public-channel deltas remain hints until corroborated or analyst-reviewed.", matches: (_relationship, source, target, _codes, support) => hasNodeValue(source, target, "Volt Typhoon") && hasPublicChannelSupport(support) },
    { name: "scattered_spider_clear_web", summary: "Scattered Spider clear-web deltas update actor, TTP, tool, and victim pivots with provenance.", matches: (_relationship, source, target, _codes, support) => hasNodeValue(source, target, "Scattered Spider") && hasClearWebSupport(support) },
    { name: "akira_restricted_held", summary: "Akira restricted-held evidence is graph context only until public or reviewed corroboration is present.", matches: (_relationship, source, target, _codes, support) => hasNodeValue(source, target, "Akira") && hasRestrictedSupport(support) },
    { name: "cve_exploitation", summary: "CVE exploitation deltas are tracked but require review before confident public facts or STIX export.", matches: (relationship, source, target) => relationship.type === "exploits" || source.type === "vulnerability" || target.type === "vulnerability" },
    { name: "random_actor_weak_discovery", summary: "Random or unknown actor discovery remains low-confidence pivot material and is not exported as a fact.", matches: (_relationship, source, target, codes) => (hasNodeValue(source, target, "Random") || hasNodeValue(source, target, "Unknown")) && codes.includes("weak_discovery_only_edge") },
    { name: "weak_co_mention", summary: "Weak co-mentions stay caveated and excluded from default STIX promotion.", matches: (_relationship, _source, _target, codes) => codes.includes("weak_discovery_only_edge") || codes.includes("unsupported_edge") },
    { name: "public_channel_only_hint", summary: "Public-channel-only graph hints are visible for pivots but held from confident answers.", matches: (_relationship, _source, _target, _codes, support) => support.length > 0 && support.every((item) => item.sourceId.includes("public_channel") || item.sourceId.includes("telegram")) },
    { name: "restricted_held_evidence", summary: "Restricted metadata remains held context with no public-fact promotion.", matches: (_relationship, _source, _target, codes, support) => codes.includes("restricted_only_claim") || codes.includes("unsupported_restricted_metadata") || hasRestrictedSupport(support) },
    { name: "missing_ledger_id", summary: "Missing ledger IDs block incremental public-answer and STIX promotion.", matches: (_relationship, _source, _target, codes) => codes.includes("missing_ledger_ids") },
    { name: "stale_relationship", summary: "Stale relationships are retained as review deltas instead of refreshed public facts.", matches: (relationship, _source, _target, codes) => relationship.properties?.stale === true || relationship.reviewState === "expired" || codes.includes("stale_accepted_edge") },
    { name: "contradicted_relationship", summary: "Contradicted relationships fail closed for public graph facts and STIX export.", matches: (relationship, _source, _target, codes) => relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true || codes.includes("contradicted_edge") },
    { name: "missing_provenance", summary: "Missing provenance blocks graph/STIX promotion until evidence support is repaired.", matches: (_relationship, _source, _target, codes) => codes.includes("missing_provenance") || codes.includes("orphan_relationship") },
    { name: "accepted_promotion", summary: "Accepted or promoted deltas can become public graph facts when ledger and schema gates pass.", matches: (relationship) => relationship.reviewState === "accepted" || relationship.exportEligibility.promoted },
    { name: "stix_export_eligible", summary: "Only reviewed or promoted relationships with complete provenance are eligible for default STIX export.", matches: (relationship) => readinessById.get(relationship.id)?.ready === true }
  ];
  const scenarioCoverage = scenarioSpecs.map((spec): GraphLiveSearchUpdateScenarioDto => {
    const matched = scopedSnapshot.relationships.filter((relationship) => {
      const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
      const support = supportFor(scopedSnapshot, relationship.id);
      const codes = uniqueFindingCodes([
        ...((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code)),
        ...(readinessById.get(relationship.id)?.blockers ?? [])
      ]);
      return spec.matches(relationship, source, target, codes, support);
    });
    const codes = uniqueFindingCodes(matched.flatMap((relationship) => [
      ...((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code)),
      ...(readinessById.get(relationship.id)?.blockers ?? [])
    ]));
    const relationshipIds = uniqueSorted(matched.map((relationship) => relationship.id));
    const deltaKinds = uniqueDeltaKinds(matched.map((relationship) => deltaByRelationship.get(relationship.id)?.deltaKind).filter((kind): kind is RelationshipDeltaKind => Boolean(kind)));
    return {
      name: spec.name,
      status: liveScenarioStatus(relationshipIds.length, codes, matched),
      relationshipIds: relationshipIds.slice(0, 25),
      deltaKinds,
      caveatCodes: publicAnswerCaveatCodes(codes),
      exportEligibleCount: matched.filter((relationship) => readinessById.get(relationship.id)?.ready === true).length,
      summary: spec.summary
    };
  });

  const deltaStream = graphDeltaStreamContract(scenarioCoverage);
  return {
    endpoint: options.endpoint,
    generatedAt,
    mode: "incremental_live_search_graph",
    responsePolicy: "seconds_level_polling",
    nextPollSeconds: 3,
    cursorField: "graph.deltas[].cursor",
    relationshipCount: scopedSnapshot.relationships.length,
    deltaCounts: relationshipDeltaCounts(deltas),
    scenarioCoverage,
    deltaStream,
    clientContract: graphDeltaClientContract(deltaStream.fixtures.map((fixture) => fixture.name)),
    weakDiscoveryPolicy: "pivots_and_caveats_only",
    publicChannelPolicy: "hint_until_corroborated_or_reviewed",
    restrictedEvidencePolicy: "held_context_no_public_fact",
    stixPolicy: "export_only_reviewed_or_promoted_relationships",
    taxiiBoundary: "descriptor_only_no_server",
    agentHandoffs: {
      agent06ClaimLedger: "ledger_ids_required_for_promotion",
      agent07AnswerCaveats: "surface_weak_public_restricted_stale_contradicted_and_missing_provenance",
      agent09ContractIndex: "expose_graph_live_update",
      agent10ReleaseGate: "graph_live_incremental_gate"
    },
    proofRoutes: ["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/intel/search.graph", "/v1/contracts"]
  };
}

const GRAPH_DELTA_STREAM_FIXTURE_SPECS: Array<{
  readonly name: GraphDeltaStreamFixtureName;
  readonly scenario: GraphLiveSearchUpdateScenarioName;
  readonly coveredStatus: GraphDeltaStreamFixtureDto["status"];
  readonly queryKinds: GraphDeltaStreamQueryKind[];
  readonly workflowStates: AnalystGraphWorkflowState[];
  readonly reviewStates: GraphRelationshipReviewState[];
  readonly reviewHold: boolean;
  readonly stixImpact: GraphDeltaStreamFixtureDto["stixImpact"];
  readonly publicAnswerImpact: GraphDeltaStreamFixtureDto["publicAnswerImpact"];
  readonly agent06LedgerGate: GraphDeltaStreamFixtureDto["agent06LedgerGate"];
  readonly agent07Caveat: GraphDeltaStreamFixtureDto["agent07Caveat"];
  readonly summary: string;
}> = [
  {
    name: "clear_web_capture_promotion",
    scenario: "apt42_clear_web",
    coveredStatus: "emitted",
    queryKinds: ["actor", "random_actor", "made_up_actor", "cve"],
    workflowStates: ["proposed"],
    reviewStates: ["needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "fact",
    agent06LedgerGate: "hold_missing_ledger",
    agent07Caveat: "none",
    summary: "Clear-web capture promotion emits pollable graph deltas with review and ledger gates."
  },
  {
    name: "public_channel_hint",
    scenario: "public_channel_only_hint",
    coveredStatus: "held",
    queryKinds: ["actor", "victim_ransomware"],
    workflowStates: ["needs-human-review"],
    reviewStates: ["needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "pivot",
    agent06LedgerGate: "not_required",
    agent07Caveat: "public_channel_hint",
    summary: "Approved public-channel matches stay pivot-only until corroborated or reviewed."
  },
  {
    name: "restricted_metadata_held",
    scenario: "restricted_held_evidence",
    coveredStatus: "held",
    queryKinds: ["victim_ransomware", "actor"],
    workflowStates: ["needs-human-review"],
    reviewStates: ["needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "hidden",
    agent06LedgerGate: "hold_missing_ledger",
    agent07Caveat: "restricted_held",
    summary: "Restricted metadata remains held context with no public-fact promotion."
  },
  {
    name: "missing_ledger_id",
    scenario: "missing_ledger_id",
    coveredStatus: "held",
    queryKinds: ["actor", "cve"],
    workflowStates: ["needs-human-review"],
    reviewStates: ["needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "caveat",
    agent06LedgerGate: "hold_missing_ledger",
    agent07Caveat: "missing_provenance",
    summary: "Missing ledger IDs block promotion until Agent 06 evidence gates are complete."
  },
  {
    name: "claim_ledger_hold",
    scenario: "missing_ledger_id",
    coveredStatus: "held",
    queryKinds: ["actor", "cve"],
    workflowStates: ["needs-human-review"],
    reviewStates: ["needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "caveat",
    agent06LedgerGate: "hold_missing_ledger",
    agent07Caveat: "missing_provenance",
    summary: "Claim-ledger gaps hold graph deltas before public or STIX promotion."
  },
  {
    name: "weak_co_mention_pivot",
    scenario: "weak_co_mention",
    coveredStatus: "held",
    queryKinds: ["actor", "random_actor", "made_up_actor"],
    workflowStates: ["proposed"],
    reviewStates: ["unreviewed", "needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "pivot",
    agent06LedgerGate: "complete",
    agent07Caveat: "weak_discovery",
    summary: "Weak co-mentions produce pivots only, not confident exported facts."
  },
  {
    name: "actor_alias_collision",
    scenario: "weak_co_mention",
    coveredStatus: "held",
    queryKinds: ["actor", "made_up_actor"],
    workflowStates: ["needs-human-review"],
    reviewStates: ["needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "pivot",
    agent06LedgerGate: "complete",
    agent07Caveat: "weak_discovery",
    summary: "Actor alias collisions route to review before answer promotion."
  },
  {
    name: "contradicted_attribution",
    scenario: "contradicted_relationship",
    coveredStatus: "blocked",
    queryKinds: ["actor"],
    workflowStates: ["contradiction"],
    reviewStates: ["contradicted"],
    reviewHold: true,
    stixImpact: "blocked",
    publicAnswerImpact: "hidden",
    agent06LedgerGate: "complete",
    agent07Caveat: "contradicted",
    summary: "Contradicted attribution blocks public graph facts and export."
  },
  {
    name: "stale_ttp",
    scenario: "stale_relationship",
    coveredStatus: "held",
    queryKinds: ["actor"],
    workflowStates: ["stale", "downgraded"],
    reviewStates: ["expired", "needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "caveat",
    agent06LedgerGate: "complete",
    agent07Caveat: "stale",
    summary: "Stale TTP deltas remain reviewable but not fresh public facts."
  },
  {
    name: "new_victim_claim",
    scenario: "scattered_spider_clear_web",
    coveredStatus: "emitted",
    queryKinds: ["actor", "victim_ransomware", "sector", "country"],
    workflowStates: ["proposed", "accepted"],
    reviewStates: ["unreviewed", "accepted"],
    reviewHold: false,
    stixImpact: "held",
    publicAnswerImpact: "caveat",
    agent06LedgerGate: "complete",
    agent07Caveat: "none",
    summary: "New victim claims are pollable deltas with review/export gates."
  },
  {
    name: "new_cve_exploitation_claim",
    scenario: "cve_exploitation",
    coveredStatus: "held",
    queryKinds: ["actor", "cve"],
    workflowStates: ["needs-human-review", "accepted"],
    reviewStates: ["needs_review", "accepted"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "caveat",
    agent06LedgerGate: "complete",
    agent07Caveat: "none",
    summary: "CVE exploitation claims are graph deltas and need review for confident export."
  },
  {
    name: "malware_tool_relation",
    scenario: "scattered_spider_clear_web",
    coveredStatus: "emitted",
    queryKinds: ["actor", "malware_tool"],
    workflowStates: ["proposed", "accepted"],
    reviewStates: ["unreviewed", "accepted"],
    reviewHold: false,
    stixImpact: "held",
    publicAnswerImpact: "caveat",
    agent06LedgerGate: "complete",
    agent07Caveat: "none",
    summary: "Malware/tool relationships are answer enrichment deltas with provenance."
  },
  {
    name: "infrastructure_relation",
    scenario: "volt_typhoon_public_channel",
    coveredStatus: "held",
    queryKinds: ["actor"],
    workflowStates: ["proposed", "needs-human-review"],
    reviewStates: ["needs_review"],
    reviewHold: true,
    stixImpact: "held",
    publicAnswerImpact: "pivot",
    agent06LedgerGate: "complete",
    agent07Caveat: "public_channel_hint",
    summary: "Infrastructure relationships are pollable pivots and stay caveated when public-channel-only."
  },
  {
    name: "analyst_accepted_promotion",
    scenario: "accepted_promotion",
    coveredStatus: "eligible",
    queryKinds: ["actor", "malware_tool", "victim_ransomware"],
    workflowStates: ["accepted"],
    reviewStates: ["accepted"],
    reviewHold: false,
    stixImpact: "eligible",
    publicAnswerImpact: "fact",
    agent06LedgerGate: "complete",
    agent07Caveat: "none",
    summary: "Analyst-accepted promotion exposes eligible facts when ledger/provenance pass."
  },
  {
    name: "analyst_rejected_relation",
    scenario: "weak_co_mention",
    coveredStatus: "blocked",
    queryKinds: ["actor", "made_up_actor"],
    workflowStates: ["rejected"],
    reviewStates: ["rejected"],
    reviewHold: true,
    stixImpact: "blocked",
    publicAnswerImpact: "hidden",
    agent06LedgerGate: "complete",
    agent07Caveat: "rejected",
    summary: "Analyst-rejected relationships remain hidden from public facts and export."
  },
  {
    name: "graph_rollback",
    scenario: "missing_provenance",
    coveredStatus: "blocked",
    queryKinds: ["actor"],
    workflowStates: ["contradiction", "rejected", "needs-human-review"],
    reviewStates: ["contradicted", "rejected", "needs_review"],
    reviewHold: true,
    stixImpact: "blocked",
    publicAnswerImpact: "hidden",
    agent06LedgerGate: "not_required",
    agent07Caveat: "missing_provenance",
    summary: "Rollback fixtures fail closed on missing provenance, contradiction, or rejected relations."
  },
  {
    name: "stix_export_eligibility_change",
    scenario: "stix_export_eligible",
    coveredStatus: "eligible",
    queryKinds: ["actor", "cve", "malware_tool", "sector"],
    workflowStates: ["accepted"],
    reviewStates: ["accepted"],
    reviewHold: false,
    stixImpact: "eligible",
    publicAnswerImpact: "fact",
    agent06LedgerGate: "complete",
    agent07Caveat: "none",
    summary: "Accepted relationships with complete provenance become eligible for STIX export."
  }
];

function graphDeltaClientContract(fixtureNames: GraphDeltaStreamFixtureName[] = GRAPH_DELTA_STREAM_FIXTURE_SPECS.map((spec) => spec.name)): GraphDeltaClientContractDto {
  return {
    mode: "graph_delta_client_contract",
    transport: "polling_primary_sse_future",
    routeBindings: ["/v1/intel/search.graph", "/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"],
    polling: {
      primary: true,
      intervalSeconds: 3,
      cursorField: "graph.deltas[].cursor",
      requestFields: ["runId", "query", "cursor", "deltaCursor", "focusNodeId", "maxRelationships"],
      responseFields: ["graph.deltas", "graph.runtime.liveUpdate", "graph.investigationWorkspace.notebookExport", "graph.reviewQueue", "graph.exportReadiness"]
    },
    clientStates: [
      { state: "empty_poll", eventTypes: ["graph.relationship.updated"], publicAnswerEffect: "none", stixEffect: "none" },
      { state: "new_relationships", eventTypes: ["graph.relationship.added", "graph.relationship.updated"], publicAnswerEffect: "caveat", stixEffect: "none" },
      { state: "review_hold", eventTypes: ["graph.relationship.review_hold", "graph.relationship.export_hold"], publicAnswerEffect: "hold", stixEffect: "held" },
      { state: "export_ready", eventTypes: ["graph.relationship.export_ready", "graph.notebook.export_ready"], publicAnswerEffect: "fact_candidate", stixEffect: "eligible" },
      { state: "stix_hold", eventTypes: ["graph.relationship.export_hold"], publicAnswerEffect: "caveat", stixEffect: "held" },
      { state: "rollback_required", eventTypes: ["graph.rollback.required"], publicAnswerEffect: "remove", stixEffect: "blocked" }
    ],
    notebookBinding: {
      exportPacketField: "graph.investigationWorkspace.notebookExport.exportPacketId",
      previewOnly: true,
      boundedNodeLimit: 75,
      boundedEdgeLimit: 50,
      caveatPolicy: "carry_relationship_explanations_and_export_holds",
      taxiiBoundary: "descriptor_only_no_server"
    },
    fixtureNames: [...new Set(fixtureNames)].sort((left, right) => left.localeCompare(right)),
    safety: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    },
    handoffs: {
      agent06EvidenceReplay: "cursor_deltas_must_replay_to_capture_and_ledger_ids",
      agent07QualityCaveats: "client_must_render_hold_caveat_before_public_fact",
      agent09FrontendContract: "poll_graph_deltas_every_3_seconds_with_stable_cursor_fields",
      agent10ReleaseGate: "rollback_on_missing_cursor_unsafe_payload_or_export_hold_drift"
    }
  };
}

function graphDeltaStreamContract(scenarioCoverage: GraphLiveSearchUpdateScenarioDto[]): GraphDeltaStreamContractDto {
  const byScenario = new Map(scenarioCoverage.map((scenario) => [scenario.name, scenario]));
  const fixtures: GraphDeltaStreamFixtureDto[] = GRAPH_DELTA_STREAM_FIXTURE_SPECS.map((spec) => {
    const scenario = byScenario.get(spec.scenario);
    const status = scenario?.status === "covered"
      ? spec.coveredStatus
      : scenario?.status === "blocked"
        ? "blocked"
        : scenario?.status === "held"
          ? "held"
          : "missing";
    return {
      name: spec.name,
      status,
      queryKinds: spec.queryKinds,
      relationshipIds: scenario?.relationshipIds ?? [],
      deltaKinds: scenario?.deltaKinds ?? [],
      workflowStates: spec.workflowStates,
      reviewStates: spec.reviewStates,
      caveatCodes: scenario?.caveatCodes ?? [],
      evidenceIds: [],
      ledgerIds: [],
      sourceIds: [],
      exportEligibleCount: scenario?.exportEligibleCount ?? 0,
      reviewHold: spec.reviewHold || status === "held" || status === "blocked",
      stixImpact: spec.stixImpact,
      publicAnswerImpact: spec.publicAnswerImpact,
      agent06LedgerGate: spec.agent06LedgerGate,
      agent07Caveat: spec.agent07Caveat,
      agent09CursorState: "pollable",
      agent10ReleaseGate: status === "blocked" ? "rollback" : spec.reviewHold ? "hold" : "pass",
      summary: scenario?.summary ?? spec.summary
    };
  });
  return {
    mode: "real_time_answer_graph_delta_stream",
    responsePolicy: "seconds_level_polling",
    nextPollSeconds: 3,
    cursorField: "graph.deltas[].cursor",
    fixtureCount: fixtures.length,
    fixtures,
    queryCoverage: ["actor", "random_actor", "made_up_actor", "cve", "malware_tool", "victim_ransomware", "country", "sector"],
    reviewHoldPolicy: "hold_unreviewed_public_channel_restricted_weak_missing_ledger_stale_contradicted_rejected",
    stixEligibilityPolicy: "reviewed_or_promoted_with_provenance_and_ledger",
    rollbackPolicy: "contradicted_rejected_missing_provenance_or_schema_risk_blocks_export",
    taxiiBoundary: "descriptor_only_no_server",
    routeBindings: ["/v1/intel/search.graph", "/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/contracts"]
  };
}

function hasNodeValue(source: PersistedGraphNode, target: PersistedGraphNode, value: string): boolean {
  const normalized = value.toLowerCase();
  return source.value.toLowerCase().includes(normalized) || target.value.toLowerCase().includes(normalized);
}

function hasClearWebSupport(support: GraphEvidenceSupportRecord[]): boolean {
  return support.some((item) =>
    !hasPublicChannelSupport([item])
    && !hasRestrictedSupport([item])
    && !item.sourceId.includes("seed")
  );
}

function hasPublicChannelSupport(support: GraphEvidenceSupportRecord[]): boolean {
  return support.some((item) => item.sourceId.includes("public_channel") || item.sourceId.includes("telegram"));
}

function hasRestrictedSupport(support: GraphEvidenceSupportRecord[]): boolean {
  return support.some((item) =>
    item.sourceId.includes("restricted_metadata")
    || item.sourceId.includes("tor_metadata")
    || item.sourceId.includes("i2p_metadata")
    || item.sourceId.includes("freenet_metadata")
  );
}

function uniqueDeltaKinds(values: RelationshipDeltaKind[]): RelationshipDeltaKind[] {
  const order: RelationshipDeltaKind[] = ["promoted", "contradicted", "downgraded", "added", "updated", "stale"];
  const set = new Set(values);
  return order.filter((kind) => set.has(kind));
}

function relationshipDeltaCounts(deltas: GraphCursorRelationshipDeltaDto[]): Record<RelationshipDeltaKind, number> {
  return {
    added: deltas.filter((delta) => delta.deltaKind === "added").length,
    updated: deltas.filter((delta) => delta.deltaKind === "updated").length,
    downgraded: deltas.filter((delta) => delta.deltaKind === "downgraded").length,
    contradicted: deltas.filter((delta) => delta.deltaKind === "contradicted").length,
    stale: deltas.filter((delta) => delta.deltaKind === "stale").length,
    promoted: deltas.filter((delta) => delta.deltaKind === "promoted").length
  };
}

function liveScenarioStatus(
  matchedCount: number,
  codes: GraphIntegrityFindingCode[],
  relationships: PersistedGraphRelationship[]
): GraphLiveSearchUpdateScenarioDto["status"] {
  if (matchedCount === 0) return "missing";
  if (codes.some((code) => code === "missing_provenance" || code === "orphan_relationship" || code === "contradicted_edge")) return "blocked";
  if (codes.length > 0 || relationships.some((relationship) => relationship.reviewState !== "accepted" && !relationship.exportEligibility.promoted)) return "held";
  return "covered";
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
  const exportGovernance = buildReviewedExportSubsetGovernanceDto(snapshot, {
    generatedAt: readiness.generatedAt
  });
  const certification = buildGraphExportCertificationDto(snapshot, {
    endpoint: "/v1/exports/stix",
    generatedAt: readiness.generatedAt
  });
  const defaultActorNode = snapshot.nodes.find((node) => node.type === "actor");
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
    certification,
    persistence: buildGraphReviewPersistenceLedgerDto(snapshot, {
      generatedAt: readiness.generatedAt
    }),
    exportGovernance,
    taxiiStixGovernance: buildTaxiiDescriptorStixBundleGovernanceDto(snapshot, {
      generatedAt: readiness.generatedAt,
      exportGovernance,
      readiness
    }),
    releaseCandidate: certification.rcGate,
    driftMonitor: buildGraphRelationshipDriftMonitorDto(snapshot, {
      generatedAt: readiness.generatedAt,
      workspaceKind: "stix_preview"
    }),
    backendMigrationCertification: buildGraphBackendMigrationCertificationDto(snapshot, {
      generatedAt: readiness.generatedAt
    }),
    actorTimelineChanges: buildGraphActorTimelineChangeWorkspaceDto(snapshot, {
      query: defaultActorNode?.value ?? "stix export actor timeline",
      focusNodeId: defaultActorNode?.id,
      generatedAt: readiness.generatedAt
    }),
    actorProductPacket: buildGraphActorProductPacketDto(snapshot, {
      query: defaultActorNode?.value ?? "stix export product packet",
      focusNodeId: defaultActorNode?.id,
      generatedAt: readiness.generatedAt
    }),
    stixTaxiiMarketplaceReadiness: buildGraphStixTaxiiMarketplaceReadinessDto(snapshot, {
      query: defaultActorNode?.value ?? "stix export marketplace readiness",
      focusNodeId: defaultActorNode?.id,
      generatedAt: readiness.generatedAt
    }),
    stixTaxiiMonetizationExportContracts: buildGraphStixTaxiiMonetizationExportContractsDto(snapshot, {
      query: defaultActorNode?.value ?? "stix export monetization contracts",
      focusNodeId: defaultActorNode?.id,
      generatedAt: readiness.generatedAt
    }),
    actorComparisonNotebook: buildGraphActorComparisonNotebookDto(snapshot, {
      query: defaultActorNode?.value ?? "stix export actor comparison notebooks",
      focusNodeId: defaultActorNode?.id,
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

export function buildTaxiiDescriptorStixBundleGovernanceDto(
  snapshot: PersistedGraphSnapshot,
  options: {
    generatedAt?: string;
    relationshipIds?: string[];
    readiness?: StixExportReadinessReportDto;
    exportGovernance?: GraphReviewedExportSubsetGovernanceDto;
  } = {}
): GraphTaxiiDescriptorStixBundleGovernanceDto {
  const generatedAt = options.generatedAt ?? snapshot.generatedAt;
  const relationshipIdSet = options.relationshipIds ? new Set(options.relationshipIds) : undefined;
  const scopedSnapshot = relationshipIdSet
    ? {
        ...snapshot,
        relationships: snapshot.relationships.filter((relationship) => relationshipIdSet.has(relationship.id)),
        evidenceSupport: snapshot.evidenceSupport.filter((support) => relationshipIdSet.has(support.relationshipId))
      }
    : snapshot;
  const readiness = options.readiness ?? checkStixExportReadiness(scopedSnapshot);
  const exportGovernance = options.exportGovernance ?? buildReviewedExportSubsetGovernanceDto(scopedSnapshot, { generatedAt });
  const descriptorCollections = buildTaxiiCollectionReadiness(scopedSnapshot, readiness);
  const collectionStatus = descriptorCollections[0]?.readiness?.status ?? (readiness.ready ? "ready" : readiness.readyCount > 0 ? "hold" : "rollback");
  const referencedNodeIds = new Set(scopedSnapshot.relationships
    .filter((relationship) => exportGovernance.eligibleRelationshipIds.includes(relationship.id))
    .flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));

  return {
    mode: "taxii_descriptor_stix_bundle_governance",
    generatedAt,
    descriptorOnly: true,
    serverImplemented: false,
    collectionId: "ti-graph-reviewed-stix-21",
    mediaType: STIX_21_MEDIA_TYPE,
    subset: {
      subsetId: exportGovernance.subsetId,
      cursor: exportGovernance.cursor,
      eligibleRelationshipIds: exportGovernance.eligibleRelationshipIds,
      heldRelationshipIds: exportGovernance.heldRelationshipIds,
      excludedRelationshipIds: exportGovernance.excludedRelationshipIds,
      decisionIds: exportGovernance.decisionIds,
      estimatedStixObjectCount: 2 + referencedNodeIds.size + exportGovernance.eligibleRelationshipIds.length,
      maxObjectsPerPage: 100,
      stableOrdering: "identity_markings_nodes_relationships"
    },
    descriptorCollections,
    bundleGates: {
      validatesStix21: true,
      reviewedRelationshipsOnly: true,
      evidenceProvenanceRequired: true,
      defaultDiscoveryEvidenceExcluded: true,
      deprecatedAttackRequiresReplacementReview: true,
      restrictedMetadataDescriptorOnly: true
    },
    futureTaxiiInterface: {
      providerInterface: "TaxiiExportProvider",
      listCollections: "descriptor_only",
      getObjects: "future_page_contract",
      requestFields: ["collectionId", "addedAfter", "limit", "next"],
      responseFields: ["collectionId", "objects", "more", "next"],
      cursorField: "taxiiCollections[].readiness.nextCursor",
      mountedRoutes: []
    },
    releaseGate: {
      status: collectionStatus,
      readyCount: readiness.readyCount,
      blockedCount: readiness.blockedCount,
      promoteWhen: "ready_relationships_nonzero_and_holds_explained",
      rollbackWhen: ["unsafe_material_requested", "unreviewed_relationship_exported", "descriptor_claimed_as_server", "stix_validation_failed"]
    },
    noLeak: {
      rawRestrictedMaterialIncluded: false,
      objectKeysIncluded: false,
      unsafeUrlsIncluded: false,
      metadataOnly: true
    }
  };
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
      persistence: buildGraphReviewPersistenceLedgerDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        generatedAt
      }),
      exportGovernance: buildReviewedExportSubsetGovernanceDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
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
      driftMonitor: buildGraphRelationshipDriftMonitorDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        generatedAt,
        workspaceKind: "stix_preview"
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
      persistence: buildGraphReviewPersistenceLedgerDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        generatedAt
      }),
      exportGovernance: buildReviewedExportSubsetGovernanceDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        generatedAt
      }),
      taxiiStixGovernance: buildTaxiiDescriptorStixBundleGovernanceDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        generatedAt
      }),
      releaseCandidate: buildGraphExportCertificationDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        endpoint: "/v1/exports/stix",
        generatedAt
      }).rcGate,
      backendMigrationCertification: buildGraphBackendMigrationCertificationDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        generatedAt
      }),
      actorTimelineChanges: buildGraphActorTimelineChangeWorkspaceDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        query: "example stix actor timeline",
        generatedAt
      }),
      actorProductPacket: buildGraphActorProductPacketDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        query: "example stix product packet",
        generatedAt
      }),
      stixTaxiiMarketplaceReadiness: buildGraphStixTaxiiMarketplaceReadinessDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        query: "example stix marketplace readiness",
        generatedAt
      }),
      stixTaxiiMonetizationExportContracts: buildGraphStixTaxiiMonetizationExportContractsDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        query: "example stix monetization contracts",
        generatedAt
      }),
      actorComparisonNotebook: buildGraphActorComparisonNotebookDto({ generatedAt, nodes: [], relationships: [], evidenceSupport: [] }, {
        query: "example actor comparison notebook",
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

function relationshipConfidenceLedgerEntry(
  snapshot: PersistedGraphSnapshot,
  relationship: PersistedGraphRelationship,
  readinessById: Map<string, StixExportReadinessReportDto["relationships"][number]>,
  findingsByRelationship: Map<string, GraphIntegrityFindingDto[]>,
  nodesById: Map<string, PersistedGraphNode>,
  generatedAt: string
): GraphInvestigationWorkspaceDto["relationshipConfidenceLedger"][number] {
  const source = nodesById.get(relationship.sourceRef) ?? fallbackNode(relationship.sourceRef);
  const target = nodesById.get(relationship.targetRef) ?? fallbackNode(relationship.targetRef);
  const support = supportFor(snapshot, relationship.id);
  const findingCodes = uniqueFindingCodes((findingsByRelationship.get(relationship.id) ?? []).map((finding) => finding.code));
  const readiness = readinessById.get(relationship.id);
  const exportBlockers = readiness?.blockers ?? ["missing_provenance"];
  const contradiction = relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true || findingCodes.includes("contradicted_edge");
  const stale = relationship.reviewState === "expired" || relationship.properties?.stale === true || findingCodes.includes("stale_accepted_edge");
  const restrictedHeld = exportBlockers.includes("restricted_only_claim") || exportBlockers.includes("unsupported_restricted_metadata");
  const provenanceComplete = support.length > 0 && support.every((item) => item.captureId && item.contentHash && item.ledgerIds.length > 0);
  const reviewBlocked = !readiness?.ready || contradiction || stale || restrictedHeld || relationship.reviewState !== "accepted";

  return {
    relationshipId: relationship.id,
    relationshipKind: relationshipKind(relationship, source, target),
    type: relationship.type,
    source: { nodeId: source.id, type: source.type, value: source.value },
    target: { nodeId: target.id, type: target.type, value: target.value },
    confidence: relationship.confidence,
    confidenceBand: relationship.confidence >= 0.75 ? "high" : relationship.confidence >= 0.45 ? "medium" : "low",
    whyExists: relationshipConfidenceReasons(relationship, support, findingCodes, generatedAt),
    supportingEvidenceIds: relationship.evidenceSupportIds,
    supportingLedgerIds: uniqueSorted(support.flatMap((item) => item.ledgerIds)),
    supportingCaptureIds: uniqueSorted(support.map((item) => item.captureId)),
    supportingSourceIds: uniqueSorted(support.map((item) => item.sourceId)),
    disagreeingSourceIds: disagreeingSourceIds(support, relationship, findingCodes),
    stale,
    contradiction,
    reviewBlocked,
    reviewState: relationship.reviewState,
    workflowState: analystWorkflowState(relationship),
    allowedActions: investigationAllowedActions(relationship, readiness?.ready ?? false, findingCodes, provenanceComplete),
    exportEligible: readiness?.ready ?? false,
    exportBlockers,
    provenanceComplete
  };
}

function relationshipConfidenceReasons(
  relationship: PersistedGraphRelationship,
  support: GraphEvidenceSupportRecord[],
  findingCodes: GraphIntegrityFindingCode[],
  generatedAt: string
): string[] {
  const reasons = [
    `${relationship.type} edge observed between ${relationship.sourceRef} and ${relationship.targetRef}`,
    `${support.length} provenance support record${support.length === 1 ? "" : "s"} linked`,
    `${relationship.reviewState} review state with ${confidenceBandLabel(relationship.confidence)} confidence`
  ];
  if (relationship.exportEligibility.reviewed || relationship.exportEligibility.promoted || relationship.exportEligibility.accepted) reasons.push("reviewed/promoted evidence contributes to export eligibility");
  if (relationship.exportEligibility.discoveryOnly) reasons.push("discovery-only support keeps the edge as a pivot until capture or review");
  if (findingCodes.includes("source_bias_cluster")) reasons.push("single-source or source-family bias requires corroboration");
  if (findingCodes.includes("contradicted_edge")) reasons.push("contradictory support is present and must be resolved by review");
  if (findingCodes.includes("stale_accepted_edge") || relationship.properties?.stale === true) reasons.push(`stale edge as of ${generatedAt}`);
  if (findingCodes.includes("missing_ledger_ids") || findingCodes.includes("missing_provenance")) reasons.push("evidence ledger or provenance gap blocks promotion");
  return uniqueStrings(reasons);
}

function confidenceBandLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.45) return "medium";
  return "low";
}

function disagreeingSourceIds(
  support: GraphEvidenceSupportRecord[],
  relationship: PersistedGraphRelationship,
  findingCodes: GraphIntegrityFindingCode[]
): string[] {
  if (relationship.reviewState !== "contradicted" && relationship.properties?.contradicted !== true && !findingCodes.includes("contradicted_edge")) return [];
  const explicit = relationship.properties?.disagreeingSourceIds;
  if (Array.isArray(explicit) && explicit.every((item) => typeof item === "string")) return uniqueSorted(explicit);
  return uniqueSorted(support.map((item) => item.sourceId).filter((sourceId) => /contradict|dispute|rebut|counter/i.test(sourceId)));
}

function investigationAllowedActions(
  relationship: PersistedGraphRelationship,
  exportReady: boolean,
  findingCodes: GraphIntegrityFindingCode[],
  provenanceComplete: boolean
): GraphInvestigationWorkspaceReviewAction[] {
  const actions = new Set<GraphInvestigationWorkspaceReviewAction>();
  if (relationship.reviewState === "accepted" && exportReady) actions.add("mark_export_ready");
  if (relationship.reviewState !== "accepted" && provenanceComplete && relationship.confidence >= 0.75 && findingCodes.length === 0) actions.add("promote");
  if (relationship.reviewState !== "rejected") actions.add("hold");
  if (relationship.confidence < 0.45 || relationship.exportEligibility.discoveryOnly) actions.add("reject");
  if (relationship.reviewState === "expired" || relationship.properties?.stale === true || findingCodes.includes("stale_accepted_edge")) actions.add("mark_stale");
  if (relationship.type === "alias-of") actions.add("merge_duplicate");
  if (relationship.type === "alias-of" && (findingCodes.includes("source_bias_cluster") || relationship.reviewState === "contradicted")) actions.add("split_alias_collision");
  if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true || findingCodes.includes("contradicted_edge")) actions.add("attach_contradiction");
  if (!actions.size) actions.add("hold");
  return [...actions].sort();
}

function buildInvestigationNodeGroups(
  nodes: GraphInvestigationWorkspaceDto["nodes"],
  ledger: GraphInvestigationWorkspaceDto["relationshipConfidenceLedger"]
): GraphInvestigationWorkspaceDto["nodeGroups"] {
  const groups = new Map<IntelligenceNodeType, GraphInvestigationWorkspaceDto["nodeGroups"][number]>();
  for (const node of nodes) {
    const existing = groups.get(node.type) ?? {
      type: node.type,
      nodeIds: [],
      relationshipIds: [],
      exportReadyRelationshipCount: 0,
      heldRelationshipCount: 0
    };
    existing.nodeIds.push(node.nodeId);
    existing.relationshipIds.push(...node.relationshipIds);
    groups.set(node.type, existing);
  }
  return [...groups.values()].map((group) => {
    const relationshipIds = uniqueSorted(group.relationshipIds);
    return {
      ...group,
      nodeIds: uniqueSorted(group.nodeIds),
      relationshipIds,
      exportReadyRelationshipCount: relationshipIds.filter((relationshipId) => ledger.find((entry) => entry.relationshipId === relationshipId)?.exportEligible).length,
      heldRelationshipCount: relationshipIds.filter((relationshipId) => !(ledger.find((entry) => entry.relationshipId === relationshipId)?.exportEligible)).length
    };
  }).sort((left, right) => right.relationshipIds.length - left.relationshipIds.length || left.type.localeCompare(right.type));
}

function buildInvestigationReviewActions(
  ledger: GraphInvestigationWorkspaceDto["relationshipConfidenceLedger"]
): GraphInvestigationWorkspaceDto["reviewActions"] {
  const actionReasons: Record<GraphInvestigationWorkspaceReviewAction, string> = {
    promote: "high-confidence complete-provenance edges can be promoted by analyst review",
    hold: "review-held edges stay visible as pivots without public/STIX fact promotion",
    reject: "weak or discovery-only relationships can be rejected from graph facts",
    mark_stale: "stale relationships should be marked stale before current-answer use",
    merge_duplicate: "alias or duplicate entities can be merged through review audit",
    split_alias_collision: "alias collisions can be split when evidence disagrees",
    attach_contradiction: "contradictory evidence must be attached before resolution",
    mark_export_ready: "accepted export-safe relationships can be marked ready for STIX output"
  };
  const humanActions = new Set<GraphInvestigationWorkspaceReviewAction>(["promote", "reject", "merge_duplicate", "split_alias_collision", "attach_contradiction", "mark_export_ready"]);
  const grouped = new Map<GraphInvestigationWorkspaceReviewAction, string[]>();
  for (const entry of ledger) {
    for (const action of entry.allowedActions) grouped.set(action, [...(grouped.get(action) ?? []), entry.relationshipId]);
  }
  return [...grouped.entries()]
    .map(([action, relationshipIds]) => ({
      action,
      relationshipIds: uniqueSorted(relationshipIds),
      requiresHumanApproval: humanActions.has(action),
      reason: actionReasons[action]
    }))
    .sort((left, right) => left.action.localeCompare(right.action));
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

function uniqueReviewStates(states: GraphRelationshipReviewState[]): GraphRelationshipReviewState[] {
  return [...new Set(states)].sort();
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

function attackExternalId(node: PersistedGraphNode): string | undefined {
  const explicit = node.properties?.attackId ?? node.properties?.externalId ?? node.properties?.mitreAttackId;
  if (typeof explicit === "string" && /^T\d{4}(?:\.\d{3})?$/.test(explicit)) return explicit;
  const match = node.value.match(/\bT\d{4}(?:\.\d{3})?\b/);
  return match?.[0];
}

function campaignIdsForTechnique(
  relationships: PersistedGraphRelationship[],
  nodesById: Map<string, PersistedGraphNode>,
  techniqueRelationship: PersistedGraphRelationship
): string[] {
  const linkedNodeIds = new Set([techniqueRelationship.sourceRef, techniqueRelationship.targetRef]);
  return uniqueSorted(relationships
    .filter((relationship) => relationship.id !== techniqueRelationship.id)
    .flatMap((relationship) => {
      const source = nodesById.get(relationship.sourceRef);
      const target = nodesById.get(relationship.targetRef);
      if (!source || !target) return [];
      if (source.type === "campaign" && (linkedNodeIds.has(relationship.targetRef) || relationship.targetRef === techniqueRelationship.targetRef)) return [source.id];
      if (target.type === "campaign" && (linkedNodeIds.has(relationship.sourceRef) || relationship.sourceRef === techniqueRelationship.targetRef)) return [target.id];
      return [];
    }));
}

function attackTechniqueConfidenceTrend(
  relationship: PersistedGraphRelationship,
  generatedAt: string
): GraphAttackTechniqueTimelineEventDto["confidenceTrend"] {
  if (relationship.reviewState === "contradicted" || relationship.properties?.contradicted === true) return "contradicted";
  if (relationship.reviewState === "expired" || relationship.properties?.stale === true || ageInDays(relationship.lastSeenAt, generatedAt) > 180) return "stale";
  const first = relationship.confidenceHistory[0]?.confidence;
  const last = relationship.confidenceHistory.at(-1)?.confidence ?? relationship.confidence;
  if (first === undefined || relationship.confidenceHistory.length <= 1) return "new";
  if (last - first >= 0.08) return "rising";
  if (first - last >= 0.08) return "falling";
  return "stable";
}

function isCampaignGraphNodeType(
  type: IntelligenceNodeType
): type is GraphAttackCampaignWorkspaceDto["campaignGraph"]["nodes"][number]["type"] {
  return ["actor", "campaign", "attack-pattern", "malware", "tool", "victim", "infrastructure", "vulnerability"].includes(type);
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

function roundMetric(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 100) / 100;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueGraphDeltaStreamFixtureNames(values: GraphDeltaStreamFixtureName[]): GraphDeltaStreamFixtureName[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function neo4jTargetForOperation(kind: GraphRepositoryOperationKind): string {
  if (kind === "upsert_node") return "(:GraphNode)";
  if (kind === "upsert_relationship") return "()-[:GRAPH_RELATIONSHIP]->()";
  if (kind === "append_provenance") return "(:EvidenceSupport)";
  if (kind === "append_review_decision") return "(:ReviewDecision)";
  if (kind === "append_confidence_history") return "(:ConfidenceHistory)";
  if (kind === "record_cursor_delta") return "(:CursorDelta)";
  return "(:ExportEligibility)";
}
