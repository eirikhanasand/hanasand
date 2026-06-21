// @ts-nocheck
import type { StixBundle, StixObject } from "../types.ts";

export interface StixValidationIssue {
  path: string;
  message: string;
}

export interface StixValidationResult {
  valid: boolean;
  issues: StixValidationIssue[];
}

const STIX_ID_RE = /^[a-z0-9-]+--[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function validateStixBundle(bundle: StixBundle): StixValidationResult {
  const issues: StixValidationIssue[] = [];
  const objectIds = new Set(bundle.objects.map((object) => object.id));

  if (bundle.type !== "bundle") issue(issues, "type", "bundle type must be bundle");
  if (!STIX_ID_RE.test(bundle.id) || !bundle.id.startsWith("bundle--")) {
    issue(issues, "id", "bundle id must be a STIX bundle id");
  }
  if (!Array.isArray(bundle.objects) || bundle.objects.length === 0) {
    issue(issues, "objects", "bundle must contain at least one object");
  }

  bundle.objects.forEach((object, index) => {
    validateStixObject(object, `objects.${index}`, objectIds, issues);
  });

  return { valid: issues.length === 0, issues };
}

export function assertValidStixBundle(bundle: StixBundle): void {
  const result = validateStixBundle(bundle);
  if (!result.valid) {
    const details = result.issues.map((item) => `${item.path}: ${item.message}`).join("; ");
    throw new Error(`Invalid STIX bundle: ${details}`);
  }
}

function validateStixObject(
  object: StixObject,
  path: string,
  objectIds: Set<string>,
  issues: StixValidationIssue[]
): void {
  if (!object.type) issue(issues, `${path}.type`, "object type is required");
  if (!object.id || !STIX_ID_RE.test(object.id)) issue(issues, `${path}.id`, "object id must be a STIX identifier");
  if (object.spec_version !== "2.1") issue(issues, `${path}.spec_version`, "object spec_version must be 2.1");
  if (object.created && !ISO_RE.test(object.created)) issue(issues, `${path}.created`, "created must be an ISO timestamp");
  if (object.modified && !ISO_RE.test(object.modified)) issue(issues, `${path}.modified`, "modified must be an ISO timestamp");
  if (object.confidence !== undefined && (!Number.isInteger(object.confidence) || object.confidence < 0 || object.confidence > 100)) {
    issue(issues, `${path}.confidence`, "confidence must be an integer from 0 to 100");
  }

  if (object.type === "relationship") validateRelationship(object, path, objectIds, issues);
  else if (object.type === "indicator") validateIndicator(object, path, issues);
  else if (object.type === "report") validateReport(object, path, objectIds, issues);
  else if (object.type === "observed-data") validateObservedData(object, path, issues);
  else if (object.type === "attack-pattern") validateAttackPattern(object, path, issues);

  if (object.type !== "identity" && object.type !== "relationship" && object.type !== "observed-data" && !object.name) {
    issue(issues, `${path}.name`, "named STIX domain objects require a name");
  }

  if (object.type !== "identity" && object.type !== "report" && object.x_ti_provenance !== undefined && !Array.isArray(object.x_ti_provenance)) {
    issue(issues, `${path}.x_ti_provenance`, "x_ti_provenance must be an array when present");
  }
}

function validateAttackPattern(object: StixObject, path: string, issues: StixValidationIssue[]): void {
  const mitreRefs = object.external_references?.filter((reference) => reference.source_name === "mitre-attack") ?? [];
  for (const [index, reference] of mitreRefs.entries()) {
    if (!reference.external_id || !/^T\d{4}(?:\.\d{3})?$/.test(reference.external_id)) {
      issue(issues, `${path}.external_references.${index}.external_id`, "MITRE ATT&CK external_id must use T#### or T####.###");
    }
    if (!reference.url) issue(issues, `${path}.external_references.${index}.url`, "MITRE ATT&CK external references require a URL");
  }
  if ((object.revoked === true || object.x_mitre_deprecated === true) && object.x_ti_review_state !== "deprecated_review_hold") {
    issue(issues, `${path}.x_ti_review_state`, "revoked or deprecated ATT&CK techniques must be held as review metadata");
  }
}

function validateObservedData(object: StixObject, path: string, issues: StixValidationIssue[]): void {
  if (!object.first_observed || !ISO_RE.test(object.first_observed)) issue(issues, `${path}.first_observed`, "observed-data first_observed must be an ISO timestamp");
  if (!object.last_observed || !ISO_RE.test(object.last_observed)) issue(issues, `${path}.last_observed`, "observed-data last_observed must be an ISO timestamp");
  if (!Number.isInteger(object.number_observed) || (object.number_observed ?? 0) < 1) issue(issues, `${path}.number_observed`, "observed-data number_observed must be a positive integer");
}

function validateRelationship(
  object: StixObject,
  path: string,
  objectIds: Set<string>,
  issues: StixValidationIssue[]
): void {
  if (!object.relationship_type) issue(issues, `${path}.relationship_type`, "relationship_type is required");
  if (!object.source_ref) issue(issues, `${path}.source_ref`, "source_ref is required");
  if (!object.target_ref) issue(issues, `${path}.target_ref`, "target_ref is required");
  if (object.source_ref && !objectIds.has(object.source_ref)) issue(issues, `${path}.source_ref`, "source_ref must point to an object in the bundle");
  if (object.target_ref && !objectIds.has(object.target_ref)) issue(issues, `${path}.target_ref`, "target_ref must point to an object in the bundle");
  if (!Array.isArray(object.x_ti_provenance) || object.x_ti_provenance.length === 0) {
    issue(issues, `${path}.x_ti_provenance`, "relationships must preserve provenance");
  }
}

function validateIndicator(object: StixObject, path: string, issues: StixValidationIssue[]): void {
  if (!object.pattern) issue(issues, `${path}.pattern`, "indicator pattern is required");
  if (object.pattern_type !== "stix") issue(issues, `${path}.pattern_type`, "indicator pattern_type must be stix");
  if (!object.valid_from || !ISO_RE.test(object.valid_from)) issue(issues, `${path}.valid_from`, "indicator valid_from must be an ISO timestamp");
}

function validateReport(object: StixObject, path: string, objectIds: Set<string>, issues: StixValidationIssue[]): void {
  if (!Array.isArray(object.object_refs) || object.object_refs.length === 0) {
    issue(issues, `${path}.object_refs`, "report must reference exported objects");
    return;
  }

  object.object_refs.forEach((ref, index) => {
    if (!objectIds.has(ref)) issue(issues, `${path}.object_refs.${index}`, "report object_ref must point to an object in the bundle");
  });
}

function issue(issues: StixValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}
