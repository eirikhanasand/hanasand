import { canonicalizeUrl } from "../../adapters/staticWeb.ts";
import type { SourceRecord } from "../../types.ts";

const createdAt = new Date(0).toISOString();

export type TestFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_fixture",
    name: input.name ?? "Fixture Source",
    type: input.type ?? "static_web",
    url: input.url ?? "https://example.test/blog/report?b=2&a=1#section",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.9,
    language: input.language ?? "en",
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public website collection allowed for test fixture.",
    createdAt,
    updatedAt: createdAt
  };
}

export function responseFixture(body: string | null, init: ResponseInit, url: string): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

export function fixtureFetch(routes: Record<string, Response>): TestFetcher {
  return async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return (routes[url] ?? responseFixture("", { status: 404 }, url)).clone();
  };
}

export function reportHtml(title: string, body: string, url: string): string {
  const canonical = canonicalizeUrl(url);
  return `<!doctype html><html lang="en"><head><title>${title}</title><link rel="canonical" href="${canonical}" /></head><body><article><h1>${title}</h1><time datetime="2026-05-24">May 24, 2026</time><p>${body}</p><section><h2>Indicators</h2><p>example-${hashSlug(title)}.test and 203.0.113.10</p></section></article></body></html>`;
}

function hashSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
