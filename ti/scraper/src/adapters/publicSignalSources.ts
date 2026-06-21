import type { SourceRecord } from "../types.ts";
import { familyForSource } from "./publicSignalFamilies.ts";

export function selectSources(sources: SourceRecord[], query: string, limit: number) {
  return sources.map((source) => ({ ...sourceSummary(source), family: familyForSource(source), selected: true, score: scoreSource(source, query), reliability: source.trustScore ?? 0.5, freshness: 0.7 })).sort((a, b) => b.score - a.score).slice(0, limit);
}

function sourceSummary(source: SourceRecord) {
  return { sourceId: source.id, id: source.id, name: source.name, url: source.url, type: source.type, status: source.status, trustScore: source.trustScore };
}

function scoreSource(source: SourceRecord, query: string) {
  const text = `${source.name} ${source.url}`.toLowerCase();
  return Math.min(1, (source.trustScore ?? 0.5) + (text.includes(query.toLowerCase()) ? 0.25 : 0));
}
