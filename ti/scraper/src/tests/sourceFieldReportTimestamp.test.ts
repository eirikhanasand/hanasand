import { describe, expect, test } from "bun:test";
import { sourceFieldReportTimestamp } from "../pipeline/sourceFieldReportTimestamp.ts";
import { DarknetMetadataAdapter } from "../adapters/darknetMetadataAdapter.ts";

describe("source-field report provenance", () => {
  test("requires the exact zoned source timestamp and a safe public reference", () => {
    const input = {
      role: "publisher",
      sourceId: "src_public",
      evidencePath: "feed.entry.publishedAt",
      timestamp: "2026-07-23T10:00:00+02:00"
    };
    expect(sourceFieldReportTimestamp({ ...input, referenceUrl: "https://reports.example.com/item#published" })).toMatchObject({
      timestamp: input.timestamp,
      referenceUrl: "https://reports.example.com/item#published",
      extractionMethod: "source_field"
    });
    for (const [timestamp, referenceUrl] of [
      ["2026-07-23T10:00:00", "https://reports.example.com/item"],
      ["not-a-time", "https://reports.example.com/item"],
      [input.timestamp, "http://127.0.0.1/report"],
      [input.timestamp, "http://[::1]/report"],
      [input.timestamp, `http://${"a".repeat(56)}.onion/report`],
      [input.timestamp, "https://user:password@reports.example.com/item"],
      [input.timestamp, "https://reports.example.com/item?api_key=secret"],
      [input.timestamp, "file:///tmp/report"]
    ]) expect(sourceFieldReportTimestamp({ ...input, timestamp, referenceUrl })).toBeUndefined();
  });

  test("keeps every runtime writer behind the shared producer boundary", async () => {
    const directWriters: string[] = [];
    for await (const path of new Bun.Glob("src/**/*.ts").scan(".")) {
      if (path.startsWith("src/tests/")) continue;
      const text = await Bun.file(path).text();
      if (/extractionMethod:\s*"source_field"/.test(text)) directWriters.push(path);
    }
    expect(directWriters.sort()).toEqual([
      "src/pipeline/sourceFieldReportTimestamp.ts",
      "src/storage/memoryStore.ts"
    ]);
  });

  test("never promotes a restricted locator as public report provenance", async () => {
    const collect = (sourceTimestamp: string, publicReferenceUrl?: string) => new DarknetMetadataAdapter("tor_metadata", {
      id: "tor-approved-metadata-proxy",
      async fetchMetadata() {
        return { title: "Public victim listing", victimName: "Example Victim", sourceTimestamp, publicReferenceUrl, links: [] };
      }
    }).collect({
      id: "src_tor",
      name: "Restricted metadata source",
      type: "tor_metadata",
      url: `http://${"a".repeat(56)}.onion`,
      accessMethod: "approved_proxy",
      status: "active",
      risk: "high",
      trustScore: 0.8,
      crawlFrequencySeconds: 3600,
      legalNotes: "Approved metadata-only collection through the isolated proxy.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvedAt: "2026-07-23T00:00:00.000Z", approvedBy: "reviewer" },
      metadata: {}
    } as any);

    expect((await collect("2026-07-23T10:00:00Z")).items[0].metadata.reportTimestamps).toBeUndefined();
    expect((await collect("2026-07-23T10:00:00", "https://reports.example.com/item")).items[0].metadata.reportTimestamps).toBeUndefined();
    expect((await collect("2026-07-23T10:00:00Z", `http://${"b".repeat(56)}.onion/item`)).items[0].metadata.reportTimestamps).toBeUndefined();
    expect((await collect("2026-07-23T10:00:00+02:00", "https://reports.example.com/item")).items[0].metadata.reportTimestamps).toEqual([
      expect.objectContaining({ timestamp: "2026-07-23T10:00:00+02:00", referenceUrl: "https://reports.example.com/item", extractionMethod: "source_field" })
    ]);
  });
});
