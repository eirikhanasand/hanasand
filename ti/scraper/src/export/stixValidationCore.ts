export interface StixValidationIssue {
  path: string;
  message: string;
}

export const STIX_ID_RE = /^[a-z0-9-]+--[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function issue(issues: StixValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}
