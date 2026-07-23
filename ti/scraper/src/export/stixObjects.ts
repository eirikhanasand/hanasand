// @ts-nocheck
import type { RawCapture, StixBundle, StixExportOptions, StixObject } from "../types.ts";
import { sanitizeDwmCustomerText } from "../product/dwmCustomerDisplay.ts";
import { indicatorPattern, stixConfidence, stixId } from "./stixIds.ts";

export function identityObject(options: StixExportOptions): StixObject {
  return { type: "identity", spec_version: "2.1", id: stixId("identity", options.producerName), created: options.generatedAt, modified: options.generatedAt, name: options.producerName };
}

export function domainObject(type: string, name: string, confidence: number, at: string, provenance: any[]): StixObject {
  return { type, spec_version: "2.1", id: stixId(type, name), created: at, modified: at, name, confidence: stixConfidence(confidence), x_ti_provenance: provenance };
}

export function indicatorObject(type: string, value: string, confidence: number, at: string, provenance: any[]): StixObject {
  return { ...domainObject("indicator", `${type}:${value}`, confidence, at, provenance), pattern_type: "stix", pattern: indicatorPattern(type, value), valid_from: at };
}

export function observedObject(type: string, value: string, at: string): StixObject {
  return { type: "observed-data", spec_version: "2.1", id: stixId("observed-data", value), created: at, modified: at, first_observed: at, last_observed: at, number_observed: 1, objects: { "0": { type, value } } } as any;
}

export function attackObject(technique: any, at: string): StixObject {
  return { ...domainObject("attack-pattern", technique.name ?? technique.attackId, technique.confidence ?? 0.5, at, technique.provenance ?? []), external_references: [{ source_name: "mitre-attack", external_id: technique.attackId, url: `https://attack.mitre.org/techniques/${String(technique.attackId).replace(".", "/")}/` }] };
}

export function relationshipObject(type: string, source_ref: string, target_ref: string, confidence: number, at: string, provenance: any[]): StixObject {
  return { type: "relationship", spec_version: "2.1", id: stixId("relationship", `${type}:${source_ref}:${target_ref}`), created: at, modified: at, relationship_type: type, source_ref, target_ref, confidence: stixConfidence(confidence), x_ti_provenance: provenance.length ? provenance : [{ sourceId: "graph", captureId: "graph", url: "metadata-only", contentHash: "metadata-only" }] };
}

export function reportObject(name: string, description: string, refs: string[], at: string, provenance: any[]): StixObject {
  return { type: "report", spec_version: "2.1", id: stixId("report", name), created: at, modified: at, published: at, name, description, report_types: ["threat-report"], object_refs: refs, x_ti_provenance: provenance } as any;
}

export function evidenceObject(capture: RawCapture, at: string): StixObject {
  return { type: "x-ti-evidence", spec_version: "2.1", id: stixId("x-ti-evidence", capture.id), created: at, modified: at, name: sanitizeDwmCustomerText(capture.metadata?.title, capture.id, 180), x_ti_extractable: typeof capture.body === "string", x_ti_capture_id: capture.id, x_ti_source_id: capture.sourceId, x_ti_content_hash: capture.contentHash };
}

export function bundle(key: string, objects: Map<string, StixObject>): StixBundle {
  return { type: "bundle", id: stixId("bundle", key), objects: [...objects.values()] };
}

export function merge(target: Map<string, StixObject>, bundle: StixBundle): void {
  for (const object of bundle.objects) target.set(object.id, object);
}

export function withCaptureProvenance(bundle: StixBundle, capture: RawCapture): StixBundle {
  return { ...bundle, objects: bundle.objects.map((object) => ({ ...object, x_ti_provenance: object.x_ti_provenance?.map((item: any) => ({ ...item, captureId: capture.id, sourceId: capture.sourceId, url: capture.url, contentHash: capture.contentHash })) })) };
}
