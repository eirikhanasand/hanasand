import { describe, expect, test } from "bun:test";
import { buildIncidentCandidate, logicalIncidentIdentity } from "../pipeline/incidentCandidate.ts";

function item(overrides: Record<string, unknown> = {}): any {
  return {
    tenantId: "tenant-a",
    sourceId: "source-a",
    url: "https://reports.example.test/incidents/alpha",
    title: "Alpha incident",
    rawText: "Alpha ransomware attacked Example Industries.",
    contentHash: "revision-one",
    collectedAt: "2026-07-21T10:00:00.000Z",
    publishedAt: "2026-07-21T09:00:00.000Z",
    links: [],
    metadata: {},
    sensitive: false,
    ...overrides
  };
}

describe("logical incident identity", () => {
  test("keeps a unique incident URL stable across content revisions", () => {
    const first = logicalIncidentIdentity(item());
    const revision = logicalIncidentIdentity(item({ contentHash: "revision-two", rawText: "Updated evidence." }));
    expect(revision).toEqual(first);
    expect(first.strategy).toBe("canonical_url");
  });

  test("keeps CISA records distinct on a shared feed URL and stable across revisions", () => {
    const shared = { url: "https://www.cisa.gov/known_exploited_vulnerabilities.json", metadata: { structuredFields: { cveID: "CVE-2026-63030" } } };
    const first = logicalIncidentIdentity(item(shared));
    const revision = logicalIncidentIdentity(item({ ...shared, contentHash: "changed", title: "Updated title" }));
    const other = logicalIncidentIdentity(item({ ...shared, metadata: { structuredFields: { cveID: "CVE-2026-60137" } } }));
    expect(revision).toEqual(first);
    expect(other.keyHash).not.toBe(first.keyHash);
    expect(first.strategy).toBe("cve");
  });

  test("separates entries when a feed parser can only return the feed URL", () => {
    const metadata = { feedItem: true, requestedUrl: "https://news.example.test/feed.xml", finalUrl: "https://news.example.test/feed.xml" };
    const first = logicalIncidentIdentity(item({ url: "https://news.example.test/feed.xml", title: "Incident one", metadata }));
    const other = logicalIncidentIdentity(item({ url: "https://news.example.test/feed.xml", title: "Incident two", metadata }));
    expect(first.strategy).toBe("feed_entry_fallback");
    expect(other.keyHash).not.toBe(first.keyHash);
  });

  test("isolates tenants and never stores the raw identity key", () => {
    const first = logicalIncidentIdentity(item());
    const otherTenant = logicalIncidentIdentity(item({ tenantId: "tenant-b" }));
    expect(otherTenant.keyHash).not.toBe(first.keyHash);
    expect(JSON.stringify(first)).not.toContain("reports.example.test");
  });

  test("does not turn failed feed parsing into an incident", () => {
    const fallback = item({
      url: "https://news.example.test/feed.xml",
      title: "Threat research feed",
      rawText: "The fallback page mentions a ransomware attack against Example Industries.",
      metadata: { adapter: "rss", feedItem: false, parserWarnings: ["feed contained no RSS or Atom entries"] }
    });
    expect(buildIncidentCandidate(fallback, "cap-fallback", [], [{ type: "victim", value: "Example Industries", confidence: 0.9 }] as any)).toBeUndefined();
  });
});
