import type { CollectionTask, SourceRecord } from "../types.ts";
import { hashContent, normalizeWhitespace, nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { canonicalizeUrl, createConditionalHeaders, rememberValidators, type AdapterHttpCache } from "./staticWeb.ts";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface RssAdapterOptions {
  fetcher?: Fetcher;
  cache?: AdapterHttpCache;
}

export class RssAdapter implements CollectionAdapter {
  readonly type = "rss" as const;
  private readonly fetcher: Fetcher;
  private readonly cache: AdapterHttpCache;

  constructor(options: RssAdapterOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.cache = options.cache ?? new Map();
  }

  async collect(source: SourceRecord, task?: CollectionTask) {
    const policy = task
      ? evaluateTaskForCollection(source, task)
      : { allowed: true, metadataOnly: false, reason: "manual run" };

    if (!policy.allowed) {
      return { items: [], discovered: [], warnings: [policy.reason] };
    }

    const url = task?.targetUrl ?? source.url;
    const headers = createConditionalHeaders(url, this.cache);
    const response = await this.fetcher(url, { headers });
    if (response.status === 304) {
      return { items: [], discovered: [], warnings: [`RSS not modified for ${url}`] };
    }
    if (!response.ok) throw new Error(`RSS fetch failed ${response.status} for ${url}`);

    const finalUrl = canonicalizeUrl(response.url || url);
    rememberValidators(finalUrl, response, this.cache);
    const xml = await response.text();
    const collectedAt = nowIso();
    const items = parseRssItems(xml, finalUrl).map((entry) => {
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
        metadata: {
          adapter: "rss",
          sourceType: source.type,
          requestedUrl: url,
          finalUrl,
          responseStatus: response.status,
          redirected: response.redirected,
          etag: response.headers.get("etag") ?? undefined,
          lastModified: response.headers.get("last-modified") ?? undefined,
          legalNotes: source.legalNotes,
          provenance: {
            sourceId: source.id,
            taskId: task?.id,
            collectedAt,
            extractorVersion: "rss-adapter-v2",
            confidence: 0.8
          }
        },
        sensitive: false
      };
    });

    return { items, discovered: [], warnings: [] };
  }
}

export function parseRssItems(
  xml: string,
  feedUrl = "https://example.invalid/feed.xml"
): Array<{ title: string; link: string; description: string; publishedAt?: string }> {
  const blocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return blocks.map((block) => ({
    title: decodeXmlTag(block, "title"),
    link: normalizeFeedLink(decodeXmlTag(block, "link") || decodeLinkHref(block), feedUrl),
    description: decodeXmlTag(block, "description") || decodeXmlTag(block, "summary") || decodeXmlTag(block, "content"),
    publishedAt: decodeXmlTag(block, "pubDate") || decodeXmlTag(block, "updated") || decodeXmlTag(block, "published") || undefined
  }));
}

function decodeXmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(stripCdata(match?.[1] ?? ""));
}

function decodeLinkHref(block: string): string {
  const alternate = [...block.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => !/\brel=["']?(self|hub)["']?/i.test(tag));
  const match = alternate?.match(/\bhref=["']([^"']+)["']/i);
  return decodeEntities(match?.[1] ?? "");
}

function normalizeFeedLink(link: string, feedUrl: string): string {
  if (!link) return "";
  try {
    return canonicalizeUrl(new URL(link, feedUrl).toString());
  } catch {
    return link;
  }
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
