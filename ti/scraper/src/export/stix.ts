import type {
  AttackTechniqueCandidate,
  CollectedItem,
  ExtractedEntity,
  ExtractionProvenance,
  Indicator,
  IncidentCandidate,
  PersistedGraphNode,
  PersistedGraphSnapshot,
  PipelineResult,
  RawCapture,
  RelationshipGraph,
  StixBundle,
  StixExternalReference,
  StixExportOptions,
  StixObject
} from "../types.ts";
import { hashContent, normalizeWhitespace, stableId } from "../utils.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { mapAttackTechniqueCandidates } from "./attack.ts";
import {
  buildGraphReviewPersistenceLedgerDto,
  buildReviewedExportSubsetGovernanceDto,
  checkStixExportReadiness
} from "./graphViews.ts";
import { buildRelationshipGraph } from "./relationships.ts";

export interface EvidenceBackedStixBundleInput {
  captures: RawCapture[];
  incidents?: IncidentCandidate[];
  options: StixExportOptions & {
    bundleKey?: string;
    includeMetadataOnlyCaptures?: boolean;
  };
}

export function exportPipelineResultToStixBundle(result: PipelineResult, options: StixExportOptions): StixBundle {
  const graph = buildRelationshipGraph(result);
  const techniques = mapAttackTechniqueCandidates(result);
  const objects = new Map<string, StixObject>();

  const identity = stixIdentity(options);
  objects.set(identity.id, identity);

  for (const entity of result.entities) {
    const object = stixObjectFromEntity(entity, options.generatedAt);
    objects.set(object.id, object);
  }

  for (const indicator of result.indicators) {
    const object = stixObjectFromIndicator(indicator, options.generatedAt);
    objects.set(object.id, object);
    const observed = stixObservedDataFromIndicator(indicator, options.generatedAt);
    objects.set(observed.id, observed);
  }

  for (const technique of techniques) {
    const object = stixAttackPatternFromTechnique(technique, options.generatedAt);
    objects.set(object.id, object);
  }

  for (const relationship of stixRelationshipsFromGraph(graph, options.generatedAt)) {
    objects.set(relationship.id, relationship);
  }

  if (result.incident) {
    const captureProvenance: ExtractionProvenance[] = result.capture.provenance ? [{
      ...result.capture.provenance,
      extractorVersion: result.capture.provenance.extractorVersion ?? String(result.capture.metadata.extractorVersion ?? "unknown")
    }] : [];
    const reportRefs = [...objects.values()]
      .filter((object) => object.id !== identity.id && object.type !== "relationship")
      .map((object) => object.id);
    const report: StixObject = {
      type: "report",
      spec_version: "2.1",
      id: stixId("report", result.incident.id),
      created: options.generatedAt,
      modified: options.generatedAt,
      name: result.incident.title,
      description: result.incident.summary,
      confidence: stixConfidence(result.incident.confidence),
      labels: ["threat-report", "ti-scraper"],
      object_refs: reportRefs,
      external_references: evidenceReferences(captureProvenance),
      x_ti_provenance: captureProvenance,
      x_ti_review_reasons: result.incident.reviewReasons,
      x_ti_review_reason_details: result.incident.reviewReasonDetails ?? [],
      x_ti_extractor_version: result.incident.extractorVersion,
      x_ti_source_id: result.incident.sourceId,
      x_ti_capture_id: result.incident.captureId,
      x_ti_tenant_id: options.tenantId
    };
    objects.set(report.id, report);
  }

  return {
    type: "bundle",
    id: stixId("bundle", `${options.producerName}:${options.generatedAt}:${result.capture.id}`),
    objects: [...objects.values()]
  };
}

export function exportEvidenceBackedStixBundle(input: EvidenceBackedStixBundleInput): StixBundle {
  const objects = new Map<string, StixObject>();
  const incidentByCaptureId = new Map((input.incidents ?? [])
    .filter((incident) => incident.captureId)
    .map((incident) => [String(incident.captureId), incident]));
  const identity = stixIdentity(input.options);
  objects.set(identity.id, identity);

  for (const capture of input.captures) {
    const incident = incidentByCaptureId.get(capture.id);
    const result = incident
      ? pipelineResultFromStoredIncident(capture, incident)
      : pipelineResultFromCapture(capture);

    if (result) {
      const bundle = exportPipelineResultToStixBundle(result, input.options);
      for (const object of bundle.objects) objects.set(object.id, object);
    }

    if ((!result || input.options.includeMetadataOnlyCaptures) && input.options.includeMetadataOnlyCaptures !== false) {
      const evidence = stixEvidenceObjectFromCapture(capture, input.options.generatedAt);
      objects.set(evidence.id, evidence);
    }
  }

  return {
    type: "bundle",
    id: stixId("bundle", `${input.options.producerName}:${input.options.generatedAt}:${input.options.bundleKey ?? "evidence"}:${input.captures.map((capture) => capture.id).join("|")}`),
    objects: [...objects.values()]
  };
}

export function exportGraphSnapshotToStixBundle(snapshot: PersistedGraphSnapshot, options: StixExportOptions): StixBundle {
  const readiness = checkStixExportReadiness(snapshot);
  const reviewPersistence = buildGraphReviewPersistenceLedgerDto(snapshot, { generatedAt: options.generatedAt });
  const exportGovernance = buildReviewedExportSubsetGovernanceDto(snapshot, { generatedAt: options.generatedAt });
  const readyRelationshipIds = new Set(readiness.relationships.filter((relationship) => relationship.ready).map((relationship) => relationship.relationshipId));
  const exportableRelationships = snapshot.relationships.filter((relationship) => readyRelationshipIds.has(relationship.id));
  const referencedNodeIds = new Set(exportableRelationships.flatMap((relationship) => [relationship.sourceRef, relationship.targetRef]));
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const objects = new Map<string, StixObject>();
  const identity = stixIdentity(options);
  objects.set(identity.id, {
    ...identity,
    x_ti_blocked_relationships: readiness.relationships
      .filter((relationship) => !relationship.ready)
      .map((relationship) => ({
        relationshipId: relationship.relationshipId,
        blockers: relationship.blockers,
        reviewState: relationship.reviewState,
        discoveryOnly: relationship.discoveryOnly
      })),
    x_ti_review_persistence: {
      mode: reviewPersistence.mode,
      decisionActions: reviewPersistence.decisionActions,
      decisionIds: reviewPersistence.decisions.map((decision) => decision.decisionId),
      cursorField: reviewPersistence.cursorContinuity.cursorField,
      latestCursor: reviewPersistence.cursorContinuity.latestCursor,
      rollbackStrategy: reviewPersistence.rollbackPlan.strategy,
      noLeak: reviewPersistence.noLeak
    },
    x_ti_reviewed_export_subset: {
      subsetId: exportGovernance.subsetId,
      mediaType: exportGovernance.mediaType,
      eligibleRelationshipIds: exportGovernance.eligibleRelationshipIds,
      heldRelationshipIds: exportGovernance.heldRelationshipIds,
      excludedRelationshipIds: exportGovernance.excludedRelationshipIds,
      cursor: exportGovernance.cursor,
      governanceChecks: exportGovernance.governanceChecks,
      counts: exportGovernance.counts,
      noLeak: exportGovernance.noLeak
    }
  });

  const marking: StixObject = {
    type: "marking-definition",
    spec_version: "2.1",
    id: stixId("marking-definition", "ti-scraper-review-required"),
    created: options.generatedAt,
    modified: options.generatedAt,
    name: "TI Scraper Review Required",
    definition_type: "statement",
    definition: { statement: "Unsupported, weak, contradicted, stale, or unreviewed graph relationships are not exported as STIX facts." }
  };
  objects.set(marking.id, marking);

  for (const nodeId of referencedNodeIds) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const object = stixObjectFromGraphNode(node, options.generatedAt);
    objects.set(object.id, object);
  }

  for (const relationship of exportableRelationships) {
    const source = nodesById.get(relationship.sourceRef);
    const target = nodesById.get(relationship.targetRef);
    if (!source || !target) continue;
    objects.set(stixId("relationship", relationship.id), {
      type: "relationship",
      spec_version: "2.1",
      id: stixId("relationship", relationship.id),
      created: options.generatedAt,
      modified: options.generatedAt,
      relationship_type: relationship.type,
      source_ref: stixRefForPersistedNode(source),
      target_ref: stixRefForPersistedNode(target),
      confidence: stixConfidence(relationship.confidence),
      first_seen: relationship.firstSeenAt,
      last_seen: relationship.lastSeenAt,
      external_references: evidenceReferences(snapshot.evidenceSupport.filter((support) => support.relationshipId === relationship.id)),
      object_marking_refs: [marking.id],
      x_ti_provenance: snapshot.evidenceSupport.filter((support) => support.relationshipId === relationship.id).map((support) => ({
        sourceId: support.sourceId,
        captureId: support.captureId,
        ledgerIds: support.ledgerIds,
        url: support.url,
        collectedAt: support.collectedAt,
        contentHash: support.contentHash,
        extractorVersion: support.extractorVersion,
        evidenceText: support.evidenceText
      })),
      x_ti_review_state: relationship.reviewState,
      x_ti_workflow_state: relationship.reviewState === "accepted" ? "accepted" : "review-required",
      x_ti_evidence_support_ids: relationship.evidenceSupportIds
    });
  }

  return {
    type: "bundle",
    id: stixId("bundle", `${options.producerName}:${options.generatedAt}:graph:${snapshot.generatedAt}`),
    objects: [...objects.values()]
  };
}

function pipelineResultFromStoredIncident(capture: RawCapture, incident: IncidentCandidate): PipelineResult {
  return {
    capture,
    incident: {
      ...incident,
      captureId: capture.id,
      entities: incident.entities.map((entity) => rewriteEntityProvenance(entity, capture)),
      indicators: incident.indicators.map((indicator) => rewriteIndicatorProvenance(indicator, capture))
    },
    indicators: incident.indicators.map((indicator) => rewriteIndicatorProvenance(indicator, capture)),
    entities: incident.entities.map((entity) => rewriteEntityProvenance(entity, capture))
  };
}

function pipelineResultFromCapture(capture: RawCapture): PipelineResult | undefined {
  const rawText = extractableCaptureText(capture);
  if (!rawText) return undefined;

  const item: CollectedItem = {
    sourceId: capture.sourceId,
    taskId: capture.taskId,
    url: capture.canonicalUrl ?? capture.url,
    collectedAt: capture.collectedAt,
    publishedAt: capture.publishedAt,
    title: captureTitle(capture),
    rawText,
    html: capture.storageKind === "inline_html" ? capture.body : undefined,
    contentHash: capture.contentHash || hashContent(rawText),
    language: capture.language,
    links: captureLinks(capture),
    metadata: {
      ...capture.metadata,
      sourceCaptureId: capture.id,
      exportExtraction: "live-capture"
    },
    sensitive: false
  };

  const result = processCollectedItem(item);
  const indicators = result.indicators.map((indicator) => rewriteIndicatorProvenance(indicator, capture));
  const entities = result.entities.map((entity) => rewriteEntityProvenance(entity, capture));
  const incident = result.incident && (indicators.length > 0 || entities.length > 0)
    ? {
      ...result.incident,
      captureId: capture.id,
      entities,
      indicators,
      reviewReasonDetails: result.incident.reviewReasonDetails?.map((detail) => ({
        ...detail,
        provenance: detail.provenance?.map((item) => rewriteProvenance(item, capture))
      }))
    }
    : undefined;

  return { capture, indicators, entities, incident };
}

function extractableCaptureText(capture: RawCapture): string | undefined {
  if (capture.sensitive || !capture.body) return undefined;
  if (capture.storageKind !== "inline_text" && capture.storageKind !== "inline_html") return undefined;
  if (capture.storageKind === "inline_html") {
    const text = capture.body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    return normalizeWhitespace(text);
  }
  return normalizeWhitespace(capture.body);
}

function captureTitle(capture: RawCapture): string | undefined {
  const title = capture.metadata.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const headline = capture.metadata.headline;
  if (typeof headline === "string" && headline.trim()) return headline.trim();
  return undefined;
}

function captureLinks(capture: RawCapture): string[] {
  const links = capture.metadata.links;
  if (!Array.isArray(links)) return [];
  return links.filter((link): link is string => typeof link === "string");
}

function rewriteIndicatorProvenance(indicator: Indicator, capture: RawCapture): Indicator {
  return { ...indicator, provenance: indicator.provenance?.map((item) => rewriteProvenance(item, capture)) };
}

function rewriteEntityProvenance(entity: ExtractedEntity, capture: RawCapture): ExtractedEntity {
  return { ...entity, provenance: entity.provenance?.map((item) => rewriteProvenance(item, capture)) };
}

function rewriteProvenance(provenance: ExtractionProvenance, capture: RawCapture): ExtractionProvenance {
  return {
    ...provenance,
    sourceId: capture.sourceId,
    captureId: capture.id,
    url: capture.canonicalUrl ?? capture.url,
    collectedAt: capture.collectedAt,
    contentHash: capture.contentHash,
    extractorVersion: provenance.extractorVersion ?? String(capture.metadata.extractorVersion ?? "unknown")
  };
}

function stixEvidenceObjectFromCapture(capture: RawCapture, generatedAt: string): StixObject {
  const provenance = captureProvenance(capture);
  const extractable = Boolean(extractableCaptureText(capture));
  return {
    type: "x-ti-evidence",
    spec_version: "2.1",
    id: stixId("x-ti-evidence", capture.id),
    created: generatedAt,
    modified: generatedAt,
    name: captureTitle(capture) ?? `Evidence capture ${capture.id}`,
    description: extractable
      ? "Stored capture included in the STIX-like evidence bundle."
      : "Stored capture is represented as metadata because raw exportable text is unavailable or redacted.",
    confidence: extractable ? 60 : 30,
    external_references: evidenceReferences(provenance),
    x_ti_provenance: provenance,
    x_ti_source_id: capture.sourceId,
    x_ti_task_id: capture.taskId,
    x_ti_capture_id: capture.id,
    x_ti_storage_kind: capture.storageKind,
    x_ti_media_type: capture.mediaType,
    x_ti_sensitive: capture.sensitive,
    x_ti_sensitivity_flags: capture.sensitivityFlags ?? [],
    x_ti_content_hash: capture.contentHash,
    x_ti_normalized_text_hash: capture.normalizedTextHash,
    x_ti_extractable: extractable
  };
}

function captureProvenance(capture: RawCapture): ExtractionProvenance[] {
  if (capture.provenance) {
    return [rewriteProvenance({
      sourceId: capture.provenance.sourceId,
      captureId: capture.provenance.captureId,
      url: capture.provenance.url,
      collectedAt: capture.provenance.collectedAt,
      contentHash: capture.provenance.contentHash,
      extractorVersion: capture.provenance.extractorVersion ?? String(capture.metadata.extractorVersion ?? "unknown")
    }, capture)];
  }
  return [{
    sourceId: capture.sourceId,
    captureId: capture.id,
    url: capture.canonicalUrl ?? capture.url,
    collectedAt: capture.collectedAt,
    contentHash: capture.contentHash,
    extractorVersion: String(capture.metadata.extractorVersion ?? "unknown")
  }];
}

function stixIdentity(options: StixExportOptions): StixObject {
  return {
    type: "identity",
    spec_version: "2.1",
    id: stixId("identity", options.producerName),
    created: options.generatedAt,
    modified: options.generatedAt,
    name: options.producerName,
    x_ti_tenant_id: options.tenantId
  };
}

function stixObjectFromEntity(entity: ExtractedEntity, generatedAt: string): StixObject {
  const value = entity.normalizedValue ?? entity.value;
  const provenance = entity.provenance ?? [];
  const common = {
    spec_version: "2.1" as const,
    created: generatedAt,
    modified: generatedAt,
    name: value,
    confidence: stixConfidence(entity.confidence),
    external_references: evidenceReferences(provenance),
    x_ti_provenance: provenance,
    x_ti_review_reasons: entity.reviewReasons ?? [],
    x_ti_raw_value: entity.rawValue
  };

  if (entity.type === "actor") return { ...common, type: "intrusion-set", id: stixId("intrusion-set", value), aliases: entity.aliases ?? [] };
  if (entity.type === "malware" || entity.type === "ransomware_family") return { ...common, type: "malware", id: stixId("malware", value), labels: [entity.type] };
  if (entity.type === "ttp") return { ...common, type: "attack-pattern", id: stixId("attack-pattern", value) };
  if (entity.type === "cve") return { ...common, type: "vulnerability", id: stixId("vulnerability", value) };
  if (entity.type === "victim" || entity.type === "sector" || entity.type === "country") {
    return { ...common, type: "identity", id: stixId("identity", `${entity.type}:${value}`), labels: [entity.type] };
  }
  return { ...common, type: "x-ti-entity", id: stixId("x-ti-entity", `${entity.type}:${value}`), labels: [entity.type] };
}

function stixObjectFromIndicator(indicator: Indicator, generatedAt: string): StixObject {
  const value = indicator.normalizedValue ?? indicator.value;
  const provenance = indicator.provenance ?? [];
  if (indicator.type === "cve") {
    return {
      type: "vulnerability",
      spec_version: "2.1",
      id: stixId("vulnerability", value),
      created: generatedAt,
      modified: generatedAt,
      name: value,
      confidence: stixConfidence(indicator.confidence),
      external_references: evidenceReferences(provenance),
      x_ti_provenance: provenance,
      x_ti_indicator_type: indicator.type
    };
  }

  return {
    type: "indicator",
    spec_version: "2.1",
    id: stixId("indicator", `${indicator.type}:${value}`),
    created: generatedAt,
    modified: generatedAt,
    name: `${indicator.type}:${value}`,
    pattern: indicatorPattern(indicator.type, value),
    pattern_type: "stix",
    valid_from: generatedAt,
    confidence: stixConfidence(indicator.confidence),
    external_references: evidenceReferences(provenance),
    x_ti_provenance: provenance,
    x_ti_indicator_type: indicator.type,
    x_ti_review_reasons: indicator.reviewReasons ?? []
  };
}

function stixObservedDataFromIndicator(indicator: Indicator, generatedAt: string): StixObject {
  const value = indicator.normalizedValue ?? indicator.value;
  const provenance = indicator.provenance ?? [];
  const observedAt = provenance[0]?.collectedAt ?? generatedAt;
  return {
    type: "observed-data",
    spec_version: "2.1",
    id: stixId("observed-data", `${indicator.type}:${value}:${observedAt}`),
    created: generatedAt,
    modified: generatedAt,
    first_observed: observedAt,
    last_observed: observedAt,
    number_observed: 1,
    confidence: stixConfidence(indicator.confidence),
    external_references: evidenceReferences(provenance),
    x_ti_provenance: provenance,
    x_ti_indicator_ref: stixId(indicator.type === "cve" ? "vulnerability" : "indicator", indicator.type === "cve" ? value : `${indicator.type}:${value}`)
  };
}

function stixAttackPatternFromTechnique(technique: AttackTechniqueCandidate, generatedAt: string): StixObject {
  const externalReferences: StixExternalReference[] = [
    ...(technique.attackId ? [mitreAttackReference(technique.attackId)] : []),
    ...evidenceReferences(technique.provenance)
  ];

  return {
    type: "attack-pattern",
    spec_version: "2.1",
    id: stixId("attack-pattern", technique.attackId ?? technique.name),
    created: generatedAt,
    modified: generatedAt,
    name: technique.name,
    confidence: stixConfidence(technique.confidence),
    external_references: externalReferences,
    x_ti_attack_tactic: technique.tactic,
    x_ti_provenance: technique.provenance,
    x_ti_review_reasons: technique.reviewReasons
  };
}

function stixRelationshipsFromGraph(graph: RelationshipGraph, generatedAt: string): StixObject[] {
  return graph.relationships.map((relationship) => ({
    type: "relationship",
    spec_version: "2.1",
    id: stixId("relationship", relationship.id),
    created: generatedAt,
    modified: generatedAt,
    relationship_type: relationship.type,
    source_ref: stixRefForGraphNode(graph, relationship.sourceRef),
    target_ref: stixRefForGraphNode(graph, relationship.targetRef),
    confidence: stixConfidence(relationship.confidence),
    external_references: evidenceReferences(relationship.provenance),
    x_ti_provenance: relationship.provenance
  }));
}

function stixRefForGraphNode(graph: RelationshipGraph, nodeId: string): string {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) return stixId("x-ti-entity", nodeId);
  if (node.type === "actor") return stixId("intrusion-set", node.value);
  if (node.type === "malware") return stixId("malware", node.value);
  if (node.type === "attack-pattern") return stixId("attack-pattern", node.value);
  if (node.type === "vulnerability") return stixId("vulnerability", node.value);
  if (node.type === "indicator") return stixId("indicator", `${node.properties?.indicatorType ?? "unknown"}:${node.value}`);
  if (node.type === "incident") return stixId("report", node.id);
  if (node.type === "victim") return stixId("identity", `victim:${node.value}`);
  if (node.type === "sector") return stixId("identity", `sector:${node.value}`);
  if (node.type === "country" || node.type === "region") return stixId("identity", `${node.type}:${node.value}`);
  return stixId("x-ti-entity", `${node.type}:${node.value}`);
}

function stixObjectFromGraphNode(node: PersistedGraphNode, generatedAt: string): StixObject {
  const common = {
    spec_version: "2.1" as const,
    created: generatedAt,
    modified: generatedAt,
    name: node.value,
    confidence: stixConfidence(node.confidence),
    x_ti_graph_node_id: node.id,
    x_ti_graph_node_type: node.type,
    x_ti_first_seen: node.firstSeenAt,
    x_ti_last_seen: node.lastSeenAt
  };
  if (node.type === "actor") return { ...common, type: "intrusion-set", id: stixRefForPersistedNode(node) };
  if (node.type === "malware" || node.type === "tool") return { ...common, type: "malware", id: stixRefForPersistedNode(node), labels: [node.type] };
  if (node.type === "attack-pattern") return { ...common, type: "attack-pattern", id: stixRefForPersistedNode(node), external_references: attackExternalReferences(node.value) };
  if (node.type === "vulnerability") return { ...common, type: "vulnerability", id: stixRefForPersistedNode(node) };
  if (node.type === "indicator") {
    return {
      ...common,
      type: "indicator",
      id: stixRefForPersistedNode(node),
      pattern: indicatorPattern(String(node.properties?.indicatorType ?? "x-ti"), node.value),
      pattern_type: "stix",
      valid_from: generatedAt
    };
  }
  if (node.type === "victim" || node.type === "sector" || node.type === "country" || node.type === "region") {
    return { ...common, type: "identity", id: stixRefForPersistedNode(node), labels: [node.type] };
  }
  return { ...common, type: "x-ti-entity", id: stixRefForPersistedNode(node), labels: [node.type] };
}

function stixRefForPersistedNode(node: PersistedGraphNode): string {
  if (node.type === "actor") return stixId("intrusion-set", node.value);
  if (node.type === "malware" || node.type === "tool") return stixId("malware", node.value);
  if (node.type === "attack-pattern") return stixId("attack-pattern", node.value);
  if (node.type === "vulnerability") return stixId("vulnerability", node.value);
  if (node.type === "indicator") return stixId("indicator", `${node.properties?.indicatorType ?? "unknown"}:${node.value}`);
  if (node.type === "victim") return stixId("identity", `victim:${node.value}`);
  if (node.type === "sector") return stixId("identity", `sector:${node.value}`);
  if (node.type === "country" || node.type === "region") return stixId("identity", `${node.type}:${node.value}`);
  return stixId("x-ti-entity", `${node.type}:${node.value}`);
}

function attackExternalReferences(value: string): StixExternalReference[] {
  const match = value.match(/\bT\d{4}(?:\.\d{3})?\b/);
  return match ? [mitreAttackReference(match[0])] : [];
}

function mitreAttackReference(attackId: string): StixExternalReference {
  const path = attackId.replace(".", "/");
  return {
    source_name: "mitre-attack",
    external_id: attackId,
    url: `https://attack.mitre.org/techniques/${path}/`
  };
}

function evidenceReferences(provenance: Array<{ url: string; contentHash: string; sourceId: string; captureId: string }>): StixExternalReference[] {
  return provenance.map((item) => ({
    source_name: "ti-scraper-evidence",
    url: item.url,
    external_id: item.captureId,
    hashes: { "x-content-hash": item.contentHash },
    description: `source:${item.sourceId}`
  }));
}

function indicatorPattern(type: string, value: string): string {
  if (type === "ipv4" || type === "ipv6") return `[ipv4-addr:value = '${value}']`;
  if (type === "domain") return `[domain-name:value = '${value}']`;
  if (type === "url") return `[url:value = '${value}']`;
  if (type === "sha256" || type === "sha1" || type === "md5") return `[file:hashes.${type.toUpperCase()} = '${value}']`;
  return `[x-ti-indicator:value = '${value}']`;
}

function stixConfidence(confidence: number): number {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}

function stixId(type: string, value: string): string {
  return `${type}--${uuidFromStableValue(`${type}:${value}`)}`;
}

function uuidFromStableValue(value: string): string {
  const left = hashHex(value);
  const right = hashHex(`${value}:right`);
  const hex = `${left}${right}`.slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function hashHex(value: string): string {
  const hashed = Bun.hash(stableId("stix", value));
  const asBigInt = typeof hashed === "bigint" ? hashed : BigInt(Math.trunc(hashed));
  return BigInt.asUintN(64, asBigInt).toString(16).padStart(16, "0");
}
