import type { SourceRecord } from "../../types.ts";
import { source } from "./apiSourceFixtures.ts";

const approvedGovernance = {
  approvalState: "approved" as const,
  approvalRequired: true,
  metadataOnly: true,
  approvedAt: "2026-01-01T00:00:00.000Z",
  approvedBy: "reviewer",
  policyVersion: "collection-policy:v1"
};

export function apiRestrictedMetadataApplyPlanSources(): SourceRecord[] {
  return restrictedMetadataApplyPlanSources();
}

export function restrictedMetadataApplyPlanSources(): SourceRecord[] {
  return [
    source({ id: "src_restricted_ready", name: "Ready restricted metadata source", type: "tor_metadata", url: "http://readyexample.onion/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Approved restricted metadata fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_pending", name: "Pending restricted metadata source", type: "tor_metadata", url: "http://pendingexample.onion/posts", accessMethod: "approved_proxy", status: "needs_review", risk: "high", legalNotes: "", governance: { approvalState: "pending", approvalRequired: true, metadataOnly: true, policyVersion: "collection-policy:v1" } }),
    source({ id: "src_restricted_unsafe", name: "Unsafe restricted metadata source", type: "tor_metadata", url: "http://user:pass@unsafeexample.onion/download/customer-dump.zip", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Unsafe target fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_disabled", name: "Disabled restricted metadata source", type: "tor_metadata", url: "http://disabledexample.onion/posts", accessMethod: "disabled", status: "disabled", risk: "high", legalNotes: "Disabled restricted fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance }),
    source({ id: "src_restricted_retention", name: "Retention expiring restricted metadata source", type: "tor_metadata", url: "http://retentionexample.onion/posts", accessMethod: "approved_proxy", status: "active", risk: "high", legalNotes: "Retention expiring fixture.", approvedAt: "2026-01-01T00:00:00.000Z", approvedBy: "reviewer", governance: approvedGovernance, metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-27T00:00:00.000Z" } })
  ];
}
