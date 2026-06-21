import type { CollectionTask, SourceRecord } from "../types.ts";
import { hashContent, normalizeWhitespace } from "../utils.ts";
import { canonicalizeUrl } from "./staticWeb.ts";
import type { RssItem } from "./rssTypes.ts";

export function mapRssEntry(input: {
  entry: RssItem;
  source: SourceRecord;
  task?: CollectionTask;
  url: string;
  finalUrl: string;
  response: Response;
  collectedAt: string;
}) {
  const { entry, source, task, url, finalUrl, response, collectedAt } = input;
  const entryUrl = canonicalizeUrl(entry.link || finalUrl);
  const rawText = normalizeWhitespace(`${entry.title} ${entry.description}`.trim());
  return {
    sourceId: source.id,
    taskId: task?.id,
    url: entryUrl,
    collectedAt,
    publishedAt: entry.publishedAt,
    title: entry.title,
    rawText,
    contentHash: hashContent(rawText || entryUrl),
    language: source.language,
    links: entry.link ? [entryUrl] : [],
    metadata: { adapter: "rss", sourceType: source.type, requestedUrl: url, finalUrl, responseStatus: response.status, redirected: response.redirected, etag: response.headers.get("etag") ?? undefined, lastModified: response.headers.get("last-modified") ?? undefined, legalNotes: source.legalNotes, provenance: { sourceId: source.id, taskId: task?.id, collectedAt, extractorVersion: "rss-adapter-v2", confidence: 0.8 } },
    sensitive: false
  };
}
