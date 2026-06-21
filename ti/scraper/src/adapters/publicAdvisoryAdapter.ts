import { hashContent } from "../utils.ts";
import { parsePublicAdvisoryRecords } from "./publicAdvisoryParse.ts";
import { publicAdvisorySafeDelta, publicAdvisoryUrlHash } from "./publicAdvisorySignals.ts";
import type { PublicAdvisoryAdapterOptions } from "./publicAdvisoryTypes.ts";

export class PublicAdvisoryAdapter {
  constructor(private options: PublicAdvisoryAdapterOptions = {}) {}
  async collect(source: any, task: any) {
    const collectedAt = this.options.now?.() ?? new Date().toISOString();
    const response = await (this.options.fetcher ?? fetch)(task.targetUrl ?? source.url);
    const body = await response.text();
    const parsed = parsePublicAdvisoryRecords({ body, contentType: response.headers?.get?.("content-type") ?? "", source, feedUrl: response.url ?? source.url, collectedAt });
    return { items: parsed.records.map((record: any) => publicAdvisoryRecordToCollectedItem({ record, source, task, collectedAt })), discovered: [], warnings: parsed.warnings };
  }
}

export function publicAdvisoryRecordToCollectedItem(input: any) {
  const r = input.record, source = input.source, urlHash = publicAdvisoryUrlHash(r.url);
  const safeDelta = publicAdvisorySafeDelta({ record: r, source, collectedAt: input.collectedAt });
  const rawText = [r.title, r.summary, r.url].filter(Boolean).join("\n");
  return { source, task: input.task, url: r.url, title: r.title, rawText, body: rawText, collectedAt: input.collectedAt, contentHash: hashContent(rawText), metadata: { adapter: "public_advisory", state: r.state, family: r.family, canonicalUrlHash: urlHash, matchedEntities: r.matchedEntities, safeDelta } };
}
