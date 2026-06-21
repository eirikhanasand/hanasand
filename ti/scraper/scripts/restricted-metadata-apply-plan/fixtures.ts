import type { SourceRecord } from "../../src/types.ts";

export function restrictedMetadataSources(): SourceRecord[] {
  const governance = {
    approvalState: "approved" as const,
    approvalRequired: true,
    metadataOnly: true,
    approvedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "reviewer",
    policyVersion: "collection-policy:v1"
  };
  return [
    source({ id: "src_restricted_ready", name: "Ready restricted metadata source", url: "http://readyexample.onion/posts", status: "active", legalNotes: "Approved restricted metadata fixture.", approvedAt: governance.approvedAt, approvedBy: governance.approvedBy, governance }),
    source({ id: "src_restricted_pending", name: "Pending restricted metadata source", url: "http://pendingexample.onion/posts", status: "needs_review", legalNotes: "", governance: { approvalState: "pending", approvalRequired: true, metadataOnly: true, policyVersion: "collection-policy:v1" } }),
    source({ id: "src_restricted_unsafe", name: "Unsafe restricted metadata source", url: "http://user:pass@unsafeexample.onion/download/customer-dump.zip", status: "active", legalNotes: "Unsafe target fixture.", approvedAt: governance.approvedAt, approvedBy: governance.approvedBy, governance }),
    source({ id: "src_restricted_disabled", name: "Disabled restricted metadata source", url: "http://disabledexample.onion/posts", accessMethod: "disabled", status: "disabled", legalNotes: "Disabled restricted fixture.", approvedAt: governance.approvedAt, approvedBy: governance.approvedBy, governance }),
    source({ id: "src_restricted_retention", name: "Retention expiring restricted metadata source", url: "http://retentionexample.onion/posts", status: "active", legalNotes: "Retention expiring fixture.", approvedAt: governance.approvedAt, approvedBy: governance.approvedBy, governance, metadata: { retentionClass: "restricted_metadata", restrictedRetentionExpiresAt: "2026-05-27T00:00:00.000Z" } })
  ];
}

function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_restricted",
    name: input.name ?? "Restricted metadata fixture",
    type: "tor_metadata",
    url: input.url ?? "http://example.onion/posts",
    accessMethod: input.accessMethod ?? "approved_proxy",
    status: input.status ?? "active",
    risk: "high",
    trustScore: 0.7,
    crawlFrequencySeconds: 3600,
    legalNotes: input.legalNotes ?? "Restricted metadata proof fixture.",
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    governance: input.governance,
    metadata: input.metadata,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}
