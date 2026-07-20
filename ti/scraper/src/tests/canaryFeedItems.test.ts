import { describe, expect, test } from "bun:test";
import { feedItems } from "../ops/canaryFeedItems.ts";

const source = { id: "src_feed", name: "Feed", url: "https://feed.test/rss.xml" };
const task = { id: "task_feed", targetUrl: source.url };
const metadata = { canaryPortfolio: true, fetchMode: "native_live_http" };

describe("canary feed item extraction", () => {
  test("turns RSS entries into distinct collected items", () => {
    const items = feedItems(source, task, rss(), "2026-06-21T00:00:00.000Z", metadata);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceId: "src_feed",
      taskId: "task_feed",
      title: "APT29 phishing campaign",
      url: "https://feed.test/apt29",
      publishedAt: "Sun, 21 Jun 2026 09:00:00 GMT",
      sensitive: false
    });
    expect(items[0].rawText).toContain("phishing infrastructure");
    expect(items[1].contentHash).not.toEqual(items[0].contentHash);
  });

  test("parses legacy API sources into structured CISA KEV items", () => {
    const cisa = {
      ...source,
      id: "src_seed_cisa_known_exploited_vulns",
      type: "api",
      catalog: { canonicalId: "gov:us:cisa:known-exploited-vulnerabilities" }
    };
    const items = feedItems(cisa, { ...task, targetUrl: "https://www.cisa.gov/kev.json" }, JSON.stringify({ vulnerabilities: [{
      cveID: "CVE-2026-4242",
      vendorProject: "Example Vendor",
      product: "Example Product",
      vulnerabilityName: "Example exploited vulnerability",
      dateAdded: "2026-06-21",
      knownRansomwareCampaignUse: "Known"
    }] }), "2026-06-22T00:00:00.000Z", metadata);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "CVE-2026-4242",
      publishedAt: "2026-06-21",
      metadata: {
        extractionProfile: "cisa_kev",
        structuredFields: { cveID: "CVE-2026-4242", vendorProject: "Example Vendor", knownRansomwareCampaignUse: "Known" }
      }
    });
  });
});

function rss() {
  return `<rss><channel>
    <item><title>APT29 phishing campaign</title><link>https://feed.test/apt29</link>
    <description>APT29 targeted ministries with phishing infrastructure.</description>
    <pubDate>Sun, 21 Jun 2026 09:00:00 GMT</pubDate></item>
    <item><title>Akira ransomware victim</title><link>https://feed.test/akira</link>
    <description>Akira claimed a healthcare victim and dataset.</description></item>
  </channel></rss>`;
}
