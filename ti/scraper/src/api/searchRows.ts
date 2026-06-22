import { hashContent } from "../utils.ts";
import { tagsFor } from "./searchTags.ts";

export function rowFromCapture(capture: any, source?: any) {
  const summary = cleanSummary(capture.body ?? capture.rawText ?? capture.metadata?.safeExcerpt ?? "");
  const title = cleanTitle(capture.title, summary, source?.name);
  const url = safePublicUrl(capture.url, capture.metadata);
  return {
    id: capture.id,
    sourceId: capture.sourceId,
    sourceName: source?.name ?? capture.sourceId,
    sourceFamily: source?.metadata?.sourceFamily,
    title,
    summary: summary.slice(0, 500),
    publishedAt: capture.publishedAt,
    collectedAt: capture.collectedAt,
    url,
    urlHash: hashContent(String(capture.url ?? capture.id)).slice(0, 16),
    tags: tagsFor(`${title} ${summary}`),
    provenanceHash: hashContent(capture.id),
    metadataOnly: isMetadataOnly(capture)
  };
}

function cleanTitle(title: unknown, summary: string, sourceName?: string) {
  const lines = summary.split("\n").map((line) => line.trim()).filter(Boolean);
  const fallback = lines[0] === sourceName ? lines[1] : lines[0];
  return cleanSummary(title || fallback || "Public intelligence row").slice(0, 160);
}

function safePublicUrl(url: unknown, metadata: any) {
  const value = String(url ?? "");
  if (!/^https?:\/\//i.test(value) || /\.onion\b/i.test(value)) return undefined;
  if (metadata?.adapter === "darknet_metadata" || metadata?.captureMode === "metadata_only") return undefined;
  return value;
}

function isMetadataOnly(capture: any) {
  return capture.storageKind === "metadata_only" || capture.metadata?.adapter === "darknet_metadata";
}

function cleanSummary(value: unknown) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/<[^>\s]{1,24}(?=\s|$)/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
