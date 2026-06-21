import type { PipelineResult, PersistedGraphNode, PersistedGraphSnapshot, RawCapture, StixBundle, StixExportOptions, StixObject } from "../types.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { mapAttackTechniqueCandidates } from "./attack.ts";
import { buildRelationshipGraph } from "./relationships.ts";

export interface EvidenceBackedStixBundleInput {
  captures: RawCapture[];
  options: StixExportOptions & { bundleKey?: string; includeMetadataOnlyCaptures?: boolean };
}

export function exportPipelineResultToStixBundle(result: PipelineResult, options: StixExportOptions): StixBundle {
  const objects = new Map<string, StixObject>();
  const identity = identityObject(options);
  objects.set(identity.id, identity);
  for (const entity of result.entities) objects.set(stixId(kindForEntity(entity.type), entity.value), domainObject(kindForEntity(entity.type), entity.value, entity.confidence, options.generatedAt, entity.provenance ?? []));
  for (const indicator of result.indicators) {
    const indicatorStix = indicatorObject(indicator.type, indicator.value, indicator.confidence, options.generatedAt, indicator.provenance ?? []);
    const observedStix = observedObject(indicator.type, indicator.value, options.generatedAt);
    objects.set(indicatorStix.id, indicatorStix);
    objects.set(observedStix.id, observedStix);
  }
  for (const technique of mapAttackTechniqueCandidates(result).filter((item) => item.attackId)) {
    const object = attackObject(technique, options.generatedAt);
    objects.set(object.id, object);
  }
  const graph = buildRelationshipGraph(result);
  const graphNodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const relationship of graph.relationships) {
    const sourceNode = graphNodes.get(relationship.sourceRef);
    const targetNode = graphNodes.get(relationship.targetRef);
    if (!sourceNode || !targetNode) continue;
    const source = stixId(kindForEntity(sourceNode.type), sourceNode.value);
    const target = stixId(kindForEntity(targetNode.type), targetNode.value);
    if (objects.has(source) && objects.has(target)) {
      const object = relationshipObject(relationship.type, source, target, relationship.confidence, options.generatedAt, relationship.provenance);
      objects.set(object.id, object);
    }
  }
  if (result.incident) objects.set(stixId("report", result.incident.id), reportObject(result.incident.title, result.incident.summary, [...objects.keys()].filter((id) => id !== identity.id), options.generatedAt, result.capture.provenance ? [result.capture.provenance] : []));
  return bundle(`${options.producerName}:${options.generatedAt}:${result.capture.id}`, objects);
}

export function exportEvidenceBackedStixBundle(input: EvidenceBackedStixBundleInput): StixBundle {
  const objects = new Map<string, StixObject>();
  objects.set(identityObject(input.options).id, identityObject(input.options));
  for (const capture of input.captures) {
    const text = typeof capture.body === "string" ? capture.body : undefined;
    if (text) merge(objects, withCaptureProvenance(exportPipelineResultToStixBundle(processCollectedItem({ sourceId: capture.sourceId, taskId: capture.taskId, url: capture.url, collectedAt: capture.collectedAt, title: String(capture.metadata?.title ?? "Captured evidence"), rawText: text, contentHash: capture.contentHash, links: [], metadata: capture.metadata ?? {}, sensitive: capture.sensitive }), input.options), capture));
    if (!text || input.options.includeMetadataOnlyCaptures !== false) objects.set(stixId("x-ti-evidence", capture.id), evidenceObject(capture, input.options.generatedAt));
  }
  return bundle(`${input.options.producerName}:${input.options.generatedAt}:${input.options.bundleKey ?? "evidence"}`, objects);
}

export function exportGraphSnapshotToStixBundle(snapshot: PersistedGraphSnapshot, options: StixExportOptions): StixBundle {
  const objects = new Map<string, StixObject>();
  objects.set(identityObject(options).id, identityObject(options));
  const nodes = new Map(snapshot.nodes.map((node: any) => [node.id, node]));
  for (const rel of snapshot.relationships.filter((item: any) => item.reviewState === "accepted" || item.confidence >= 0.5)) {
    const loose = rel as any;
    const source = nodes.get(rel.sourceRef ?? loose.sourceId ?? loose.source) as PersistedGraphNode | undefined;
    const target = nodes.get(rel.targetRef ?? loose.targetId ?? loose.target) as PersistedGraphNode | undefined;
    if (!source || !target) continue;
    const sourceId = stixId(kindForEntity(source.type), source.value);
    const targetId = stixId(kindForEntity(target.type), target.value);
    objects.set(sourceId, domainObject(kindForEntity(source.type), source.value, source.confidence ?? 0.5, options.generatedAt, []));
    objects.set(targetId, domainObject(kindForEntity(target.type), target.value, target.confidence ?? 0.5, options.generatedAt, []));
    const object = relationshipObject(rel.type, sourceId, targetId, rel.confidence ?? 0.5, options.generatedAt, snapshot.evidenceSupport.filter((support: any) => support.relationshipId === rel.id));
    objects.set(object.id, object);
  }
  return bundle(`${options.producerName}:${options.generatedAt}:graph:${snapshot.generatedAt}`, objects);
}

function identityObject(options: StixExportOptions): StixObject {
  return { type: "identity", spec_version: "2.1", id: stixId("identity", options.producerName), created: options.generatedAt, modified: options.generatedAt, name: options.producerName };
}

function domainObject(type: string, name: string, confidence: number, at: string, provenance: any[]): StixObject {
  return { type, spec_version: "2.1", id: stixId(type, name), created: at, modified: at, name, confidence: stixConfidence(confidence), x_ti_provenance: provenance };
}

function indicatorObject(type: string, value: string, confidence: number, at: string, provenance: any[]): StixObject {
  return { ...domainObject("indicator", `${type}:${value}`, confidence, at, provenance), pattern_type: "stix", pattern: indicatorPattern(type, value), valid_from: at };
}

function observedObject(type: string, value: string, at: string): StixObject {
  return { type: "observed-data", spec_version: "2.1", id: stixId("observed-data", value), created: at, modified: at, first_observed: at, last_observed: at, number_observed: 1, objects: { "0": { type, value } } } as any;
}

function attackObject(technique: any, at: string): StixObject {
  return { ...domainObject("attack-pattern", technique.name ?? technique.attackId, technique.confidence ?? 0.5, at, technique.provenance ?? []), external_references: [{ source_name: "mitre-attack", external_id: technique.attackId, url: `https://attack.mitre.org/techniques/${String(technique.attackId).replace(".", "/")}/` }] };
}

function relationshipObject(type: string, source_ref: string, target_ref: string, confidence: number, at: string, provenance: any[]): StixObject {
  return { type: "relationship", spec_version: "2.1", id: stixId("relationship", `${type}:${source_ref}:${target_ref}`), created: at, modified: at, relationship_type: type, source_ref, target_ref, confidence: stixConfidence(confidence), x_ti_provenance: provenance.length ? provenance : [{ sourceId: "graph", captureId: "graph", url: "metadata-only", contentHash: "metadata-only" }] };
}

function reportObject(name: string, description: string, refs: string[], at: string, provenance: any[]): StixObject {
  return { type: "report", spec_version: "2.1", id: stixId("report", name), created: at, modified: at, name, description, report_types: ["threat-report"], object_refs: refs, x_ti_provenance: provenance } as any;
}

function evidenceObject(capture: RawCapture, at: string): StixObject {
  return { type: "x-ti-evidence", spec_version: "2.1", id: stixId("x-ti-evidence", capture.id), created: at, modified: at, name: String(capture.metadata?.title ?? capture.id), x_ti_extractable: typeof capture.body === "string", x_ti_capture_id: capture.id, x_ti_source_id: capture.sourceId, x_ti_content_hash: capture.contentHash };
}

function bundle(key: string, objects: Map<string, StixObject>): StixBundle {
  return { type: "bundle", id: stixId("bundle", key), objects: [...objects.values()] };
}

function merge(target: Map<string, StixObject>, bundle: StixBundle): void {
  for (const object of bundle.objects) target.set(object.id, object);
}

function withCaptureProvenance(bundle: StixBundle, capture: RawCapture): StixBundle {
  return {
    ...bundle,
    objects: bundle.objects.map((object) => ({
      ...object,
      x_ti_provenance: object.x_ti_provenance?.map((item: any) => ({ ...item, captureId: capture.id, sourceId: capture.sourceId, url: capture.url, contentHash: capture.contentHash }))
    }))
  };
}

function kindForEntity(type: string): string {
  if (type === "actor") return "intrusion-set";
  if (type === "cve") return "vulnerability";
  if (type === "malware" || type === "tool" || type === "vulnerability") return type;
  if (type === "ttp") return "attack-pattern";
  return "identity";
}

function indicatorPattern(type: string, value: string): string {
  if (type === "ipv4") return `[ipv4-addr:value = '${value}']`;
  if (type === "domain") return `[domain-name:value = '${value}']`;
  if (type === "url") return `[url:value = '${value}']`;
  return `[artifact:payload_bin MATCHES '${value}']`;
}

function stixConfidence(confidence: number): number {
  return Math.max(0, Math.min(100, Math.round(confidence * 100)));
}

function stixId(type: string, value: string): string {
  return `${type}--${uuid(value)}`;
}

function uuid(value: string): string {
  const hex = Array.from({ length: 4 }, (_, index) => Bun.hash(`${value}:${index}`).toString(16).padStart(16, "0")).join("").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(8 + Number.parseInt(hex[16] ?? "0", 16) % 4).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
