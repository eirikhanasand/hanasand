// @ts-nocheck
import type { StixObject } from "../types.ts";
import { issue, ISO_RE, STIX_ID_RE, type StixValidationIssue } from "./stixValidationCore.ts";
import {
  validateAttackPattern,
  validateIndicator,
  validateObservedData,
  validateRelationship,
  validateReport
} from "./stixValidationObjects.ts";

export function validateStixObject(object: StixObject, path: string, objectIds: Set<string>, issues: StixValidationIssue[]): void {
  if (!object.type) issue(issues, `${path}.type`, "object type is required");
  if (!object.id || !STIX_ID_RE.test(object.id)) issue(issues, `${path}.id`, "object id must be a STIX identifier");
  if (object.spec_version !== "2.1") issue(issues, `${path}.spec_version`, "object spec_version must be 2.1");
  if (object.created && !ISO_RE.test(object.created)) issue(issues, `${path}.created`, "created must be an ISO timestamp");
  if (object.modified && !ISO_RE.test(object.modified)) issue(issues, `${path}.modified`, "modified must be an ISO timestamp");
  if (object.confidence !== undefined && (!Number.isInteger(object.confidence) || object.confidence < 0 || object.confidence > 100)) issue(issues, `${path}.confidence`, "confidence must be an integer from 0 to 100");

  if (object.type === "relationship") validateRelationship(object, path, objectIds, issues);
  else if (object.type === "indicator") validateIndicator(object, path, issues);
  else if (object.type === "report") validateReport(object, path, objectIds, issues);
  else if (object.type === "observed-data") validateObservedData(object, path, issues);
  else if (object.type === "attack-pattern") validateAttackPattern(object, path, issues);

  if (object.type !== "identity" && object.type !== "relationship" && object.type !== "observed-data" && !object.name) issue(issues, `${path}.name`, "named STIX domain objects require a name");
  if (object.type !== "identity" && object.type !== "report" && object.x_ti_provenance !== undefined && !Array.isArray(object.x_ti_provenance)) issue(issues, `${path}.x_ti_provenance`, "x_ti_provenance must be an array when present");
}
