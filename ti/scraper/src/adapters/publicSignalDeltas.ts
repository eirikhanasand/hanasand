import { hashContent } from "../utils.ts";

export function deltaFromEvidence(item: any, generatedAt: string) {
  return { id: item.id ?? hashContent(JSON.stringify(item)), sourceId: item.sourceId, family: "public_channel", title: item.title, summary: item.summary ?? item.text, url: item.url ?? item.evidenceUrl ?? "metadata-only", confidence: item.confidence ?? 0.55, matchedEntities: item.matchedEntities ?? {}, collectedAt: item.collectedAt ?? generatedAt, provenance: { sourceId: item.sourceId, publicOnly: true, evidenceBacked: true, safeUrl: true } };
}

export function deltaFromAdvisory(item: any, generatedAt: string) {
  return { id: item.id ?? hashContent(item.url ?? item.title ?? JSON.stringify(item)), sourceId: item.sourceId, family: item.family ?? "vendor_report", title: item.title, summary: item.summary, url: item.url, confidence: item.confidence ?? 0.7, matchedEntities: item.matchedEntities ?? {}, publishedAt: item.publishedAt, collectedAt: item.observedAt ?? generatedAt, provenance: { sourceId: item.sourceId, publicOnly: true, evidenceBacked: true, safeUrl: true } };
}

export function deltaFromDarkweb(item: any, generatedAt: string) {
  return { id: item.id ?? hashContent(item.urlHash ?? JSON.stringify(item)), sourceId: item.sourceId ?? "darkweb_metadata", family: "darkweb_metadata", title: item.actor ?? item.siteTitle, summary: item.summary, url: item.urlHash ?? "metadata-only", confidence: item.confidence ?? 0.6, matchedEntities: { actors: [item.actor].filter(Boolean), victims: [item.victim].filter(Boolean) }, collectedAt: item.observedAt ?? generatedAt, provenance: { sourceId: item.sourceId ?? "darkweb_metadata", publicOnly: true, evidenceBacked: true, safeUrl: true } };
}
