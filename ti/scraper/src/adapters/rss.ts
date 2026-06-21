import type { CollectionTask, SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import type { CollectionAdapter } from "./base.ts";
import { evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { canonicalizeUrl, createConditionalHeaders, rememberValidators } from "./staticWeb.ts";
import { mapRssEntry } from "./rssItemMapper.ts";
import { parseRssItems } from "./rssXml.ts";
import type { Fetcher, RssAdapterOptions } from "./rssTypes.ts";

export { parseRssItems } from "./rssXml.ts";

export class RssAdapter implements CollectionAdapter {
  readonly type = "rss" as const;
  private readonly fetcher: Fetcher;
  private readonly cache;

  constructor(options: RssAdapterOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.cache = options.cache ?? new Map();
  }

  async collect(source: SourceRecord, task?: CollectionTask) {
    const policy = task ? evaluateTaskForCollection(source, task) : { allowed: true, metadataOnly: false, reason: "manual run" };
    if (!policy.allowed) return { items: [], discovered: [], warnings: [policy.reason] };
    const url = task?.targetUrl ?? source.url;
    const headers = createConditionalHeaders(url, this.cache);
    const response = await this.fetcher(url, { headers });
    if (response.status === 304) return { items: [], discovered: [], warnings: [`RSS not modified for ${url}`] };
    if (!response.ok) throw new Error(`RSS fetch failed ${response.status} for ${url}`);
    const finalUrl = canonicalizeUrl(response.url || url);
    rememberValidators(finalUrl, response, this.cache);
    const xml = await response.text();
    const collectedAt = nowIso();
    const items = parseRssItems(xml, finalUrl).map((entry) => mapRssEntry({ entry, source, task, url, finalUrl, response, collectedAt }));
    return { items, discovered: [], warnings: [] };
  }
}
