// @ts-nocheck
import type { StixBundle } from "../types.ts";
import { issue, STIX_ID_RE, type StixValidationIssue } from "./stixValidationCore.ts";
import { validateStixObject } from "./stixValidationObject.ts";

export type { StixValidationIssue } from "./stixValidationCore.ts";

export interface StixValidationResult {
  valid: boolean;
  issues: StixValidationIssue[];
}

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
