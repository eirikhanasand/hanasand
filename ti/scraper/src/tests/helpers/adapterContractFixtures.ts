import { canonicalizeUrl } from "../../adapters/staticWeb.ts";
import type { CollectionTask, SourceRecord } from "../../types.ts";

const createdAt = new Date(0).toISOString();

export function source(input: Partial<SourceRecord>): SourceRecord {
  return { id: input.id ?? "src_dynamic_report", name: input.name ?? "Fixture Dynamic Report", type: input.type ?? "dynamic_web", url: input.url ?? "https://reports.example.test/js/apt42?b=2&a=1#story", accessMethod: input.accessMethod ?? "public_http", status: input.status ?? "active", risk: input.risk ?? "low", trustScore: input.trustScore ?? 0.84, language: input.language ?? "en", crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600, legalNotes: input.legalNotes ?? "Public vendor report fixture.", createdAt, updatedAt: createdAt, metadata: input.metadata };
}

export function task(input: Partial<CollectionTask>): CollectionTask {
  return { id: input.id ?? "task_adapter_contract", sourceId: input.sourceId ?? "src_dynamic_report", targetUrl: input.targetUrl ?? "https://reports.example.test/js/apt42?b=2&a=1#story", sourceType: input.sourceType ?? "dynamic_web", queuedAt: input.queuedAt ?? "2026-05-24T12:00:00.000Z", priority: input.priority ?? 0.9, reason: input.reason ?? "fixture", retryCount: input.retryCount ?? 0, maxBytes: input.maxBytes ?? 1_000_000 };
}

export function responseFixture(body: string, init: ResponseInit, url: string): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

export function reportHtml(title: string, body: string): string {
  return `<!doctype html><html><head><title>${title}</title><link rel="canonical" href="${canonicalizeUrl("https://reports.example.test/research/apt42-dynamic-report#top")}" /></head><body><main><h1>${title}</h1><time datetime="2026-05-20">May 20, 2026</time><p>${body}</p><a href="/iocs/apt42">Indicators</a></main></body></html>`;
}
