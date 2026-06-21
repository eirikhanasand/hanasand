import type { SourceRecord } from "../../types.ts";

const createdAt = new Date(0).toISOString();

export function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_rss",
    name: input.name ?? "Security RSS",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/search?q={query}",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.9,
    language: input.language,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public test source.",
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    governance: input.governance,
    health: input.health,
    catalog: input.catalog,
    scoring: input.scoring,
    crawlState: input.crawlState,
    tags: input.tags,
    metadata: input.metadata,
    createdAt,
    updatedAt: createdAt
  };
}

export function api(path: string, init?: RequestInit) {
  return new Request(`http://scraper.test${path}`, init);
}

export async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}
