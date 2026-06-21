import { describe, expect, test } from "bun:test";
import { RssAdapter, parseRssItems } from "../adapters/rss.ts";
import { fixtureFetch, responseFixture, source } from "./helpers/adapterFixtureHelpers.ts";

describe("RSS adapter fixtures", () => {
  test("parses RSS and Atom items into collected items with provenance", async () => {
    const feed = await Bun.file(new URL("./fixtures/security-feed.xml", import.meta.url)).text();
    const cache = new Map();
    const adapter = new RssAdapter({ cache, fetcher: fixtureFetch({ "https://example.test/feed.xml": responseFixture(feed, { status: 200, headers: { etag: "\"feed-v1\"", "last-modified": "Sat, 01 Feb 2025 10:00:00 GMT" } }, "https://example.test/feed.xml") }) });
    const result = await adapter.collect(source({ id: "rss_fixture", type: "rss", url: "https://example.test/feed.xml" }));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.url).toBe("https://example.test/research/apt29-campaign?ref=rss");
    expect(result.items[0]?.rawText).toContain("APT29 campaign");
    expect(result.items[0]?.metadata.provenance).toMatchObject({ sourceId: "rss_fixture" });
    expect(cache.get("https://example.test/feed.xml")).toMatchObject({ etag: "\"feed-v1\"" });
  });

  test("returns no items when conditional RSS request is not modified", async () => {
    const cache = new Map([["https://example.test/feed.xml", { etag: "\"feed-v1\"" }]]);
    const adapter = new RssAdapter({ cache, fetcher: fixtureFetch({ "https://example.test/feed.xml": responseFixture("", { status: 304 }, "https://example.test/feed.xml") }) });
    const result = await adapter.collect(source({ type: "rss", url: "https://example.test/feed.xml" }));
    expect(result.items).toHaveLength(0);
    expect(result.warnings[0]).toContain("not modified");
  });

  test("normalizes Atom alternate links relative to the feed URL", () => {
    const parsed = parseRssItems("<entry><title>T</title><link rel=\"alternate\" href=\"/post\" /></entry>", "https://example.test/feed");
    expect(parsed[0]?.link).toBe("https://example.test/post");
  });
});
