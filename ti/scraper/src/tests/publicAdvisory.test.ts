import { describe, expect, test } from "bun:test";
import {
  parsePublicAdvisoryRecords,
  publicAdvisoryItemsToSignalRecords,
  publicAdvisoryRecordToCollectedItem
} from "../adapters/publicAdvisory.ts";
import { buildPublicAdvisorySignalConnector } from "../adapters/publicSignalFusion.ts";
import type { SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_advisory",
  name: "Vendor Advisory",
  type: "rss",
  url: "https://vendor.example/feed.json",
  accessMethod: "public_http",
  status: "active",
  risk: "low",
  trustScore: 0.86,
  crawlFrequencySeconds: 3600,
  legalNotes: "Public advisory feed.",
  createdAt: "2026-06-21T00:00:00.000Z",
  updatedAt: "2026-06-21T00:00:00.000Z"
};

describe("compact public advisory adapter", () => {
  test("parses public advisory records into collected items and signal rows", () => {
    const parsed = parsePublicAdvisoryRecords({
      body: JSON.stringify([{ id: "adv1", title: "APT29 CVE-2026-4242 phishing", url: "https://vendor.example/adv1", summary: "APT29 exploited CVE-2026-4242." }]),
      contentType: "application/json",
      source,
      feedUrl: source.url,
      collectedAt: "2026-06-21T00:00:00.000Z"
    });
    const item = publicAdvisoryRecordToCollectedItem({ record: parsed.records[0], source, collectedAt: "2026-06-21T00:00:00.000Z" });
    const signals = publicAdvisoryItemsToSignalRecords([item], { sourceById: new Map([[source.id, source]]) });
    const connector = buildPublicAdvisorySignalConnector({ query: "APT29", sources: [source], signals });

    expect(parsed.records).toHaveLength(1);
    expect(item.rawText).toContain("APT29");
    expect(signals[0].matchedEntities.actors).toContain("APT29");
    expect(connector.status).toBe("ready");
  });

  test("normalizes the official CISA KEV envelope", () => {
    const cisa = { ...source, catalog: { canonicalId: "gov:us:cisa:known-exploited-vulnerabilities" } } as SourceRecord;
    const parsed = parsePublicAdvisoryRecords({
      body: JSON.stringify({ vulnerabilities: [{ cveID: "CVE-2026-4242", vulnerabilityName: "Example exploited vulnerability", shortDescription: "Used in active exploitation.", dateAdded: "2026-06-21" }] }),
      contentType: "application/json",
      source: cisa,
      feedUrl: source.url,
      collectedAt: "2026-06-22T00:00:00.000Z"
    });
    const item = publicAdvisoryRecordToCollectedItem({ record: parsed.records[0], source: cisa, collectedAt: "2026-06-22T00:00:00.000Z" });

    expect(item).toMatchObject({
      title: "Example exploited vulnerability",
      publishedAt: "2026-06-21",
      metadata: { extractionProfile: "cisa_kev", structuredFields: { cveID: "CVE-2026-4242" } }
    });
  });
});
