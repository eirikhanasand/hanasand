// @ts-nocheck
import type { PersistedGraphNode, PersistedGraphSnapshot, StixBundle, StixExportOptions, StixObject } from "../types.ts";
import { bundle, domainObject, identityObject, relationshipObject } from "./stixObjects.ts";
import { kindForEntity, stixId } from "./stixIds.ts";

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
