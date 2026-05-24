import { describe, expect, test } from "bun:test";
import { promoteSearchResultToCanonicalCapture, type SearchResultHandoff } from "../adapters/clearWebPromotion.ts";
import { RssAdapter, parseRssItems } from "../adapters/rss.ts";
import { StaticWebAdapter, canonicalizeUrl, extractLinks, extractReadableText } from "../adapters/staticWeb.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { SourceRecord } from "../types.ts";

const createdAt = new Date(0).toISOString();

function source(input: Partial<SourceRecord>): SourceRecord {
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

type TestFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function responseFixture(body: string | null, init: ResponseInit, url: string): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function fixtureFetch(routes: Record<string, Response>): TestFetcher {
  return async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const route = routes[url];
    if (!route) return responseFixture("", { status: 404 }, url);
    return route;
  };
}

describe("RSS adapter", () => {
  test("parses RSS and Atom items into collected items with provenance", async () => {
    const feed = await Bun.file(new URL("./fixtures/security-feed.xml", import.meta.url)).text();
    const cache = new Map();
    const adapter = new RssAdapter({
      cache,
      fetcher: fixtureFetch({
        "https://example.test/feed.xml": responseFixture(feed, {
          status: 200,
          headers: { etag: "\"feed-v1\"", "last-modified": "Sat, 01 Feb 2025 10:00:00 GMT" }
        }, "https://example.test/feed.xml")
      })
    });

    const result = await adapter.collect(source({ id: "rss_fixture", type: "rss", url: "https://example.test/feed.xml" }));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.url).toBe("https://example.test/research/apt29-campaign?ref=rss");
    expect(result.items[0]?.rawText).toContain("APT29 campaign");
    expect(result.items[0]?.metadata.provenance).toMatchObject({ sourceId: "rss_fixture" });
    expect(cache.get("https://example.test/feed.xml")).toMatchObject({ etag: "\"feed-v1\"" });
  });

  test("returns no items when conditional RSS request is not modified", async () => {
    const cache = new Map([["https://example.test/feed.xml", { etag: "\"feed-v1\"" }]]);
    const adapter = new RssAdapter({
      cache,
      fetcher: fixtureFetch({
        "https://example.test/feed.xml": responseFixture("", { status: 304 }, "https://example.test/feed.xml")
      })
    });

    const result = await adapter.collect(source({ type: "rss", url: "https://example.test/feed.xml" }));
    expect(result.items).toHaveLength(0);
    expect(result.warnings[0]).toContain("not modified");
  });

  test("normalizes Atom alternate links relative to the feed URL", () => {
    const parsed = parseRssItems("<entry><title>T</title><link rel=\"alternate\" href=\"/post\" /></entry>", "https://example.test/feed");
    expect(parsed[0]?.link).toBe("https://example.test/post");
  });
});

describe("static web adapter", () => {
  test("extracts canonical page content, links, robots notes, and provenance", async () => {
    const html = await Bun.file(new URL("./fixtures/static-report.html", import.meta.url)).text();
    const cache = new Map();
    const adapter = new StaticWebAdapter({
      cache,
      fetcher: fixtureFetch({
        "https://example.test/robots.txt": responseFixture("User-agent: *\nDisallow: /private\n", {
          status: 200
        }, "https://example.test/robots.txt"),
        "https://example.test/blog/report?b=2&a=1#section": responseFixture(html, {
          status: 200,
          headers: { etag: "\"page-v1\"" }
        }, "https://example.test/blog/report?a=1&b=2")
      })
    });

    const result = await adapter.collect(source({}));
    const item = result.items[0];

    expect(item?.url).toBe("https://example.test/research/apt29-report");
    expect(item?.rawText).toContain("APT29 malware campaign");
    expect(item?.rawText).not.toContain("console.log");
    expect(item?.links).toEqual([
      "https://example.test/iocs/cve-2025-12345",
      "https://external.test/ransomware"
    ]);
    expect(result.discovered[0]?.anchorText).toBe("CVE-2025-12345 indicators");
    expect(item?.metadata).toMatchObject({
      adapter: "static_web",
      requestedUrl: "https://example.test/blog/report?b=2&a=1#section",
      canonicalUrl: "https://example.test/research/apt29-report"
    });
    expect(cache.get("https://example.test/blog/report?a=1&b=2")).toMatchObject({ etag: "\"page-v1\"" });
  });

  test("respects robots disallow before fetching the page", async () => {
    let pageFetched = false;
    const adapter = new StaticWebAdapter({
      fetcher: async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.endsWith("/robots.txt")) {
          return responseFixture("User-agent: *\nDisallow: /private\n", { status: 200 }, url);
        }
        pageFetched = true;
        return responseFixture("<html></html>", { status: 200 }, url);
      }
    });

    const result = await adapter.collect(source({ url: "https://example.test/private/report" }));
    expect(result.items).toHaveLength(0);
    expect(pageFetched).toBe(false);
    expect(result.warnings[0]).toContain("robots.txt disallows");
  });

  test("canonicalizes URLs and extracts safe readable text", () => {
    expect(canonicalizeUrl("HTTPS://Example.TEST:443//a?b=2&a=1#frag")).toBe("https://example.test/a?a=1&b=2");
    expect(extractReadableText("<script>bad()</script><p>Threat &amp; CVE</p>")).toBe("Threat & CVE");
    expect(extractLinks("<a href=\"/one#x\">One</a><a href=\"mailto:a@example.test\">Mail</a>", "https://example.test/base"))
      .toEqual(["https://example.test/one"]);
  });

  test("promotes live search-result handoffs into canonical captured evidence for actor and CVE queries", async () => {
    const store = new InMemoryScraperStore();
    const clearWebSource = source({
      id: "src_clear_web_promotion",
      name: "Clear-web promotion source",
      type: "static_web",
      url: "https://example.test/research/index"
    });
    store.saveSource(clearWebSource);
    const observedAt = "2026-05-24T12:00:00.000Z";
    const handoffs: SearchResultHandoff[] = [
      handoff(1, "APT29", "apt29-report", "APT29 campaign report", "APT29 campaign used malware and phishing against government victims with CVE-2026-1001."),
      handoff(2, "Scattered Spider", "scattered-spider-report", "Scattered Spider report", "Scattered Spider intrusion targeted hospitality victim help desks with social engineering."),
      handoff(3, "Volt Typhoon", "volt-typhoon-report", "Volt Typhoon advisory", "Volt Typhoon campaign targeted critical infrastructure sectors with living-off-the-land techniques."),
      handoff(4, "Akira ransomware", "akira-report", "Akira ransomware report", "Akira ransomware leak claim names victim Fjord Energy AS in the energy sector."),
      handoff(5, "Turla", "turla-report", "Turla report", "Turla malware campaign used Snake tooling against diplomatic targets."),
      handoff(6, "CVE-2026-12345", "cve-2026-12345-advisory", "CVE-2026-12345 advisory", "CVE-2026-12345 exploit observed in a public advisory with intrusion indicators.")
    ];
    const fetcher = fixtureFetch({
      "https://example.test/robots.txt": responseFixture("User-agent: *\nAllow: /\n", { status: 200 }, "https://example.test/robots.txt"),
      ...Object.fromEntries(handoffs.map((item) => [
        item.url,
        responseFixture(reportHtml(item.title, item.snippet, item.url), {
          status: 200,
          headers: { etag: `"${item.resultId}"`, "last-modified": "Sun, 24 May 2026 12:00:00 GMT" }
        }, item.url)
      ]))
    });

    const proofs = [];
    for (const item of handoffs) {
      proofs.push(await promoteSearchResultToCanonicalCapture(store, clearWebSource, item, { fetcher }));
    }

    expect(proofs).toHaveLength(6);
    expect(proofs.every((proof) => proof.status === "captured")).toBe(true);
    expect(proofs.map((proof) => proof.query)).toEqual(["APT29", "Scattered Spider", "Volt Typhoon", "Akira ransomware", "Turla", "CVE-2026-12345"]);
    expect(proofs.every((proof) => proof.captureId?.startsWith("cap_"))).toBe(true);
    expect(proofs.every((proof) => proof.incidentId?.startsWith("inc_"))).toBe(true);
    expect(proofs.every((proof) => proof.canonicalUrl?.startsWith("https://example.test/research/"))).toBe(true);
    expect(proofs.every((proof) => proof.contentHash && proof.contentHash.length > 10)).toBe(true);
    expect(new Set(proofs.map((proof) => proof.taskId)).size).toBe(6);
    expect(store.listDiscoveryEvidence().every((item) => item.promotedToCaptureId && item.promotedToIncidentId && item.promotedToTaskId)).toBe(true);
    expect(store.listCaptures()).toHaveLength(6);
    expect(store.listCaptures().every((capture) => capture.metadata.evidenceStage === "captured_page")).toBe(true);
    expect(store.listCaptures().every((capture) => capture.metadata.promotedFromDiscoveryId)).toBe(true);
    expect(store.listCaptures().map((capture) => capture.metadata.parserProfile)).toEqual(Array(6).fill("vendor_report"));
    expect(store.listIncidents()).toHaveLength(6);
    expect(JSON.stringify({ proofs, captures: store.listCaptures() })).not.toContain("object/key");

    function handoff(rank: number, query: string, slug: string, title: string, snippet: string): SearchResultHandoff {
      return {
        query,
        runId: "run_clear_web_promotion",
        provider: "fixture_search",
        resultId: `result_${slug}`,
        title,
        snippet,
        url: `https://example.test/research/${slug}?utm=search#summary`,
        rank,
        observedAt,
        confidence: 0.78
      };
    }
  });
});

function reportHtml(title: string, body: string, url: string): string {
  const canonical = canonicalizeUrl(url);
  return `<!doctype html>
<html lang="en">
  <head>
    <title>${title}</title>
    <link rel="canonical" href="${canonical}" />
  </head>
  <body>
    <article>
      <h1>${title}</h1>
      <time datetime="2026-05-24">May 24, 2026</time>
      <p>${body}</p>
      <section><h2>Indicators</h2><p>example-${hashSlug(title)}.test and 203.0.113.10</p></section>
    </article>
  </body>
</html>`;
}

function hashSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
