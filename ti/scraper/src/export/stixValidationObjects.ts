// @ts-nocheck
import type { StixObject } from "../types.ts";
import { issue, ISO_RE, type StixValidationIssue } from "./stixValidationCore.ts";

export function validateAttackPattern(object: StixObject, path: string, issues: StixValidationIssue[]): void {
  const mitreRefs = object.external_references?.filter((reference) => reference.source_name === "mitre-attack") ?? [];
  for (const [index, reference] of mitreRefs.entries()) {
    if (!reference.external_id || !/^T\d{4}(?:\.\d{3})?$/.test(reference.external_id)) issue(issues, `${path}.external_references.${index}.external_id`, "MITRE ATT&CK external_id must use T#### or T####.###");
    if (!reference.url) issue(issues, `${path}.external_references.${index}.url`, "MITRE ATT&CK external references require a URL");
  }
  if ((object.revoked === true || object.x_mitre_deprecated === true) && object.x_ti_review_state !== "deprecated_review_hold") issue(issues, `${path}.x_ti_review_state`, "revoked or deprecated ATT&CK techniques must be held as review metadata");
}

export function validateObservedData(object: StixObject, path: string, issues: StixValidationIssue[]): void {
  if (!object.first_observed || !ISO_RE.test(object.first_observed)) issue(issues, `${path}.first_observed`, "observed-data first_observed must be an ISO timestamp");
  if (!object.last_observed || !ISO_RE.test(object.last_observed)) issue(issues, `${path}.last_observed`, "observed-data last_observed must be an ISO timestamp");
  if (!Number.isInteger(object.number_observed) || (object.number_observed ?? 0) < 1) issue(issues, `${path}.number_observed`, "observed-data number_observed must be a positive integer");
}

export function validateRelationship(object: StixObject, path: string, objectIds: Set<string>, issues: StixValidationIssue[]): void {
  if (!object.relationship_type) issue(issues, `${path}.relationship_type`, "relationship_type is required");
  if (!object.source_ref) issue(issues, `${path}.source_ref`, "source_ref is required");
  if (!object.target_ref) issue(issues, `${path}.target_ref`, "target_ref is required");
  if (object.source_ref && !objectIds.has(object.source_ref)) issue(issues, `${path}.source_ref`, "source_ref must point to an object in the bundle");
  if (object.target_ref && !objectIds.has(object.target_ref)) issue(issues, `${path}.target_ref`, "target_ref must point to an object in the bundle");
  if (!Array.isArray(object.x_ti_provenance) || object.x_ti_provenance.length === 0) issue(issues, `${path}.x_ti_provenance`, "relationships must preserve provenance");
}

export function validateIndicator(object: StixObject, path: string, issues: StixValidationIssue[]): void {
  if (!object.pattern) issue(issues, `${path}.pattern`, "indicator pattern is required");
  if (object.pattern_type !== "stix") issue(issues, `${path}.pattern_type`, "indicator pattern_type must be stix");
  if (!object.valid_from || !ISO_RE.test(object.valid_from)) issue(issues, `${path}.valid_from`, "indicator valid_from must be an ISO timestamp");
}

export function validateReport(object: StixObject, path: string, objectIds: Set<string>, issues: StixValidationIssue[]): void {
  if (!Array.isArray(object.object_refs) || object.object_refs.length === 0) return issue(issues, `${path}.object_refs`, "report must reference exported objects");
  object.object_refs.forEach((ref, index) => {
    if (!objectIds.has(ref)) issue(issues, `${path}.object_refs.${index}`, "report object_ref must point to an object in the bundle");
  });
}
