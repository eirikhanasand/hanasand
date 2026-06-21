import type { SourceRecord } from "../../types.ts";

export function source(input: Partial<SourceRecord>): SourceRecord {
  const risk = input.risk ?? "low";
  const requiresApproval = risk !== "low" || input.type?.endsWith("_metadata");
  const approvedAt = input.approvedAt ?? (requiresApproval ? new Date(0).toISOString() : undefined);
  const approvedBy = input.approvedBy ?? (requiresApproval ? "analyst_1" : undefined);
  return {
    id: input.id ?? "src",
    name: input.name ?? "Source",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/search?q={query}",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk,
    trustScore: input.trustScore ?? 0.9,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public fixture.",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    approvedAt,
    approvedBy,
    crawlState: input.crawlState,
    health: input.health,
    lastSeenAt: input.lastSeenAt,
    tags: input.tags,
    metadata: input.metadata,
    governance: input.governance ?? (requiresApproval ? { approvalState: "approved", approvalRequired: true, metadataOnly: Boolean(input.type?.endsWith("_metadata")), approvedAt, approvedBy, riskJustification: "Approved test metadata-only source." } : undefined)
  };
}
