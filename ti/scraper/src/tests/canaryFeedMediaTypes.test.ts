import { describe, expect, test } from "bun:test";
import { fetchItems } from "../ops/canaryHelpers.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("public feed media types", () => {
  test("collects RSS and RDF feed aliases used by public sources", async () => {
    const feed = source({ id: "src_feed_alias", type: "rss", url: "https://example.test/feed" });
    const body = "<rdf:RDF><item><title>APT29 public advisory</title><description>APT29 targeted diplomatic organizations.</description><link>https://example.test/report</link></item></rdf:RDF>";

    for (const contentType of ["application/rdf+xml", "application/x-rss+xml"]) {
      const items = await fetchItems(feed, { id: `task_${contentType}`, targetUrl: feed.url }, async () => new Response(body, { headers: { "content-type": contentType } }), "injected_proof_fetch", "2026-07-21T00:00:00.000Z", 512_000);
      expect(items).toEqual([expect.objectContaining({ title: "APT29 public advisory", metadata: expect.objectContaining({ fetchProvenance: expect.objectContaining({ contentType }) }) })]);
    }
  });
});
