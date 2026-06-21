import { hashContent, stableId } from "../utils.ts";
import type { PublicAdvisorySafeDelta, PublicAdvisorySearchHit, PublicAdvisorySignalBridgeOptions } from "./publicAdvisoryTypes.ts";

export const publicAdvisoryUrlHash = (url: string) => hashContent(new URL(url, "https://example.invalid").toString().split("#")[0]);

export function publicAdvisorySafeDelta(input: any): PublicAdvisorySafeDelta {
  const r = input.record;
  return { schemaVersion: "ti.public_advisory_signal_delta.v1", id: r.id, title: r.title, urlHash: publicAdvisoryUrlHash(r.url), family: r.family, state: r.state, publishedAt: r.publishedAt, matchedEntities: r.matchedEntities, confidence: r.confidence, safeOutput: { rawBodyExposed: false, credentialsExposed: false } };
}

export function searchPublicAdvisoryItems(items: any[], query: string, limit = 10): PublicAdvisorySearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.map((item) => ({ item, score: terms.filter((t) => JSON.stringify(item).toLowerCase().includes(t)).length / Math.max(1, terms.length) })).filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function publicAdvisoryItemsToSignalRecords(items: any[], options: PublicAdvisorySignalBridgeOptions = {}) {
  return items.flatMap((item) => {
    const metadata = item.metadata ?? {}, delta = metadata.safeDelta ?? {}, source = options.sourceById?.get?.(item.source?.id ?? item.sourceId);
    if (metadata.adapter !== "public_advisory" && delta.schemaVersion !== "ti.public_advisory_signal_delta.v1" && !options.includeNonAdvisoryItems) return [];
    return [{ id: stableId("public-advisory-signal", `${item.url}:${item.contentHash}`), sourceId: item.source?.id ?? item.sourceId, sourceName: source?.name ?? item.source?.name, urlHash: metadata.canonicalUrlHash ?? delta.urlHash ?? publicAdvisoryUrlHash(item.url), title: item.title, summary: item.rawText, family: bridgeFamily(metadata.family ?? delta.family), state: metadata.state ?? delta.state ?? "observed", matchedEntities: metadata.matchedEntities ?? delta.matchedEntities ?? entities(item.rawText ?? ""), confidence: delta.confidence ?? 0.65, publishedAt: delta.publishedAt, collectedAt: item.collectedAt, provenance: { connector: "public_advisory", rawBodyExposed: false } }];
  });
}

export function entities(text: string) { return { actors: uniq(text.match(/\bAPT\d+\b|Volt Typhoon|Turla|Akira|Scattered Spider/gi) ?? []), cves: uniq(text.match(/CVE-\d{4}-\d{4,7}/gi) ?? []), victims: uniq([...text.matchAll(/victim:?\s+([A-Z][\w .&-]+)/g)].map((m) => m[1])), sectors: uniq(text.match(/\b(government|energy|healthcare|finance|telecom)\b/gi) ?? []) }; }
const bridgeFamily = (family: string) => family?.includes("government") ? "government" : family?.includes("vendor") ? "vendor" : "community";
const uniq = (values: string[]) => [...new Set(values.filter(Boolean).map((v) => v.trim()))];
