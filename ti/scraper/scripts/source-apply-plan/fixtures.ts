import type { SourceRecord } from "../../src/types.ts";

export function publicSources(): SourceRecord[] {
  const reviewedAt = new Date().toISOString();
  return [
    source({ id: "src_source_proof_candidate", status: "candidate", tags: ["apt29"], url: "https://candidate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
    source({ id: "src_source_proof_unhealthy", status: "active", tags: ["apt29"], url: "https://unhealthy.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt }, health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 } }),
    source({ id: "src_source_proof_duplicate_a", tags: ["apt29"], url: "https://duplicate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
    source({ id: "src_source_proof_duplicate_b", tags: ["apt29"], url: "https://duplicate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } })
  ];
}

export function restrictedSources(): SourceRecord[] {
  return [source({
    id: "src_source_proof_restricted",
    name: "Restricted source apply-plan proof",
    type: "tor_metadata",
    url: "http://restricted-proof.onion",
    accessMethod: "approved_proxy",
    risk: "restricted",
    status: "approved",
    tenantId: "tenant_source_proof_restricted",
    governance: {
      approvalRequired: true,
      approvalState: "approved",
      metadataOnly: true,
      approvedAt: "2026-05-24T00:00:00.000Z",
      approvedBy: "legal",
      policyVersion: "collection-policy:v1"
    },
    metadata: { legalNotesReviewedAt: new Date().toISOString() },
    tags: ["apt29"]
  })];
}

function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_source_proof",
    name: input.name ?? "Source apply-plan proof fixture",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/feed.xml",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    tenantId: input.tenantId ?? "tenant_source_proof",
    trustScore: input.trustScore ?? 0.9,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Mounted source apply-plan proof fixture.",
    governance: input.governance,
    health: input.health,
    tags: input.tags,
    metadata: input.metadata,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}
