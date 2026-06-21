import type { SourceRecord } from "../types.ts";

export function isApproved(source: SourceRecord): boolean {
  if (source.governance) {
    return source.governance.approvalState === "approved" && Boolean(source.governance.approvedAt && source.governance.approvedBy);
  }

  return Boolean(source.approvedAt && source.approvedBy);
}

export function isMetadataSource(source: SourceRecord): boolean {
  return source.type.endsWith("_metadata");
}
