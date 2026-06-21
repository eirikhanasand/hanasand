import { describe, expect, test } from "bun:test";
import { StaticWebAdapter, canonicalizeUrl, extractLinks, extractReadableText } from "../adapters/staticWeb.ts";
import { fixtureFetch, responseFixture, source } from "./helpers/adapterFixtureHelpers.ts";

describe("static web adapter fixtures", () => {
  test("extracts canonical page content links robots notes and provenance", async () => {
    const html = await Bun.file(new URL("./fixtures/static-report.html", import.meta.url)).text();
    const cache = new Map();
    const adapter = new StaticWebAdapter({
      cache,
      fetcher: fixtureFetch({
        "https://example.test/robots.txt": responseFixture("User-agent: *\nDisallow: /private\n", { status: 200 }, "https://example.test/robots.txt"),
        "https://example.test/blog/report?b=2&a=1#section": responseFixture(html, { status: 200, headers: { etag: "\"page-v1\"" } }, "https://example.test/blog/report?a=1&b=2")
      })
    });
    const result = await adapter.collect(source({}));
    const item = result.items[0];

    expect(item?.url).toBe("https://example.test/research/apt29-report");
    expect(item?.rawText).toContain("APT29 malware campaign");
    expect(item?.rawText).not.toContain("console.log");
    expect(item?.links).toEqual(["https://example.test/iocs/cve-2025-12345", "https://external.test/ransomware"]);
    expect(result.discovered[0]?.anchorText).toBe("CVE-2025-12345 indicators");
    expect(item?.metadata).toMatchObject({ adapter: "static_web", requestedUrl: "https://example.test/blog/report?b=2&a=1#section", canonicalUrl: "https://example.test/research/apt29-report" });
    expect(cache.get("https://example.test/blog/report?a=1&b=2")).toMatchObject({ etag: "\"page-v1\"" });
  });

  test("respects robots disallow before fetching the page", async () => {
    let pageFetched = false;
    const adapter = new StaticWebAdapter({ fetcher: async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/robots.txt")) return responseFixture("User-agent: *\nDisallow: /private\n", { status: 200 }, url);
      pageFetched = true;
      return responseFixture("<html></html>", { status: 200 }, url);
    } });
    const result = await adapter.collect(source({ url: "https://example.test/private/report" }));
    expect(result.items).toHaveLength(0);
    expect(pageFetched).toBe(false);
    expect(result.warnings[0]).toContain("robots.txt disallows");
  });

  test("canonicalizes URLs and extracts safe readable text", () => {
    expect(canonicalizeUrl("HTTPS://Example.TEST:443//a?b=2&a=1#frag")).toBe("https://example.test/a?a=1&b=2");
    expect(extractReadableText("<script>bad()</script><p>Threat &amp; CVE</p>")).toBe("Threat & CVE");
    expect(extractLinks("<a href=\"/one#x\">One</a><a href=\"mailto:a@example.test\">Mail</a>", "https://example.test/base")).toEqual(["https://example.test/one"]);
  });
});
