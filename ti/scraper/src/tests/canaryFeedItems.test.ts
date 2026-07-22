import { describe, expect, test } from "bun:test";
import { feedItems } from "../ops/canaryFeedItems.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";

const source = { id: "src_feed", name: "Feed", type: "rss", url: "https://feed.test/rss.xml" };
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
      metadata: { reportTimestamps: [{ role: "publisher", timestamp: "Sun, 21 Jun 2026 09:00:00 GMT", sourceId: "src_feed", evidencePath: "feed.entry.publishedAt", extractionMethod: "source_field" }] },
      sensitive: false
    });
    expect(items[0].rawText).toContain("phishing infrastructure");
    expect(items[1].contentHash).not.toEqual(items[0].contentHash);
  });

  test("uses actor or victim report roles only for verified source ownership", () => {
    const verified = feedItems({ ...source, metadata: { reporterRole: "actor", reporterRoleVerified: true } }, task, rss(), "2026-06-21T10:00:00.000Z", metadata);
    const unverified = feedItems({ ...source, metadata: { reporterRole: "actor" } }, task, rss(), "2026-06-21T10:00:00.000Z", metadata);

    expect(verified[0].metadata.reportTimestamps[0].role).toBe("actor");
    expect(unverified[0].metadata.reportTimestamps[0].role).toBe("publisher");
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

  test("extracts locator-free ransomware group communication metadata", () => {
    const groups = { ...source, id: "src_seed_ransomwarelive_groups", type: "api", catalog: { canonicalId: "community:ransomwarelive:groups" } };
    const onion = `${"a".repeat(56)}.onion`;
    const items = feedItems(groups, { ...task, targetUrl: "https://data.ransomware.live/groups.json" }, JSON.stringify([{
      name: "Example Group", altname: ["Example Alias"], type: "ransomware", _victim_count: 12, description: `Profile at http://${onion}`,
      locations: [{ type: "DLS", fqdn: onion }, { type: "Chat", fqdn: onion }, { type: "Telegram", fqdn: "t.me/example" }]
    }]), "2026-07-20T00:00:00.000Z", metadata);

    expect(items[0]).toMatchObject({ metadata: { extractionProfile: "ransomware_group_metadata", ransomwareGroup: { actorName: "Example Group", aliases: ["Example Alias"], channelTypes: ["DLS", "Chat", "Telegram"], victimCount: 12, metadataOnly: true, locatorsRetained: false } } });
    expect(JSON.stringify(items[0])).not.toContain(onion);
    const result = processCollectedItem(items[0]);
    expect(result.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ransomware_family", value: "Example Group", aliases: ["Example Alias"], assertionKind: "observed" }),
      expect.objectContaining({ type: "channel_type", value: "Chat", assertionKind: "observed" })
    ]));
    expect(result.entities.some((entity: any) => ["communication_channel", "buyer_seller_communication", "monetization_path", "profitability_signal", "extortion_type"].includes(entity.type))).toBe(false);
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
