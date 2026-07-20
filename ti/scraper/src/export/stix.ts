// @ts-nocheck
import type { PipelineResult, RawCapture, StixBundle, StixExportOptions, StixObject } from "../types.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { mapAttackTechniqueCandidates } from "./attack.ts";
import { buildRelationshipGraph } from "./relationships.ts";
import { attackObject, bundle, domainObject, evidenceObject, identityObject, indicatorObject, merge, observedObject, relationshipObject, reportObject, withCaptureProvenance } from "./stixObjects.ts";
import { kindForEntity, stixId } from "./stixIds.ts";
export { exportGraphSnapshotToStixBundle } from "./stixGraphSnapshot.ts";

export interface EvidenceBackedStixBundleInput {
  captures: RawCapture[];
  options: StixExportOptions & { bundleKey?: string; includeMetadataOnlyCaptures?: boolean; includeDerivedIntelligence?: boolean };
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
    if (text && input.options.includeDerivedIntelligence === true) merge(objects, withCaptureProvenance(exportPipelineResultToStixBundle(processCollectedItem({ sourceId: capture.sourceId, taskId: capture.taskId, url: capture.url, collectedAt: capture.collectedAt, title: String(capture.metadata?.title ?? "Captured evidence"), rawText: text, contentHash: capture.contentHash, links: [], metadata: capture.metadata ?? {}, sensitive: capture.sensitive }), input.options), capture));
    if (!text || input.options.includeMetadataOnlyCaptures !== false) objects.set(stixId("x-ti-evidence", capture.id), evidenceObject(capture, input.options.generatedAt));
  }
  return bundle(`${input.options.producerName}:${input.options.generatedAt}:${input.options.bundleKey ?? "evidence"}`, objects);
}
