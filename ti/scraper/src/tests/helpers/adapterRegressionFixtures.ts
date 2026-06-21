import type { CollectedItem, SourceRecord, SourceType } from "../../types.ts";
import { hashContent } from "../../utils.ts";

const createdAt = new Date(0).toISOString();

export function source(id: string, type: SourceType, url: string, trustScore = 0.84): SourceRecord {
  return {
    id,
    name: id,
    type,
    url,
    accessMethod: type === "telegram_public" ? "official_api" : "public_http",
    status: "active",
    risk: "low",
    trustScore,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Public source fixture.",
    createdAt,
    updatedAt: createdAt
  };
}

export function collected(src: SourceRecord, text: string, publishedAt = "2026-05-24T00:00:00.000Z"): CollectedItem {
  return { sourceId: src.id, taskId: `task_${src.id}`, url: src.url, collectedAt: "2026-05-24T12:00:00.000Z", publishedAt, title: src.name, rawText: text, contentHash: hashContent(text), language: "en", links: [], metadata: {}, sensitive: false };
}
