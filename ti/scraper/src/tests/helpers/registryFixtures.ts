import { InMemorySourceRegistry } from "../../registry/sourceRegistry.ts";
import type { SourceRecord } from "../../types.ts";

export function registry(): InMemorySourceRegistry {
  return new InMemorySourceRegistry();
}

export function seedSource(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_registry_fixture",
    name: input.name ?? "Registry fixture",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/feed.xml",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    tenantId: input.tenantId,
    trustScore: input.trustScore ?? 0.7,
    language: input.language,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public registry fixture.",
    governance: input.governance,
    health: input.health,
    metadata: input.metadata,
    tags: input.tags,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

export function upsertFixture(input: Partial<SourceRecord> = {}): SourceRecord {
  return registry().upsert(seedSource(input));
}
