import { expect, test } from "bun:test";
import { DarknetMetadataAdapter } from "../adapters/darknetMetadataAdapter.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { SourceRecord } from "../types.ts";

const source = { id: "restricted_booba_team_victim_api", name: "Booba metadata", type: "tor_metadata", url: "http://exampleonion.onion", accessMethod: "approved_proxy", trustScore: 0.7, language: "en", crawlFrequencyMinutes: 60, status: "active", legalNotes: "Metadata only", approvedAt: "2026-06-20T00:00:00.000Z", approvedBy: "test", metadata: { actorName: "Booba Team" }, createdAt: "2026-06-20T00:00:00.000Z", updatedAt: "2026-06-20T00:00:00.000Z" } as SourceRecord;
const collect = (victimNames: string[]) => new DarknetMetadataAdapter("tor_metadata", {
  id: "tor-approved-metadata-proxy", network: "tor", accessMethod: "approved_proxy",
  async fetchMetadata() { return { actorName: "Booba Team", victimNames, victimName: victimNames[0], title: "Victim collection", description: "Mixed victim summary", sourceTimestamp: "2026-07-28T12:20:39.988Z", publicReferenceUrl: "https://example.test/collection", claimedCountry: "NO", links: [] }; }
}).collect(source);

test("keeps each metadata victim separate through persistence without copying collection timestamps", async () => {
  const result = await collect(["Pelli Clarke Pelli Architects", "Zynex"]);
  expect(result.items).toHaveLength(2);
  const store = new InMemoryScraperStore();
  const saved = result.items.map(item => store.savePipelineResult(processCollectedItem(item)));
  expect(new Set(saved.map(r => r.incident?.id)).size).toBe(2);
  for (const r of saved) {
    expect(r.incident).toBeDefined();
    expect(r.capture.metadata.leakSite.victimNames).toHaveLength(1);
    expect(r.capture.metadata.leakSite.claimedCountry).toBeUndefined();
    expect(r.capture.publishedAt).toBeUndefined();
    const timing = store.getTimelinessRecord(r.incident!.id);
    expect(timing.firstReportedKind).toBe("server_first_seen");
    expect(timing.firstReportedAt).toBe(r.capture.collectedAt);
    expect(timing.timestampAnomalies).toEqual([]);
    expect(timing.latencies.firstReportToCollectionSeconds).toBeUndefined();
  }
  const single = (await collect(["Zynex"])).items[0];
  const recollected = store.savePipelineResult(processCollectedItem(single));
  expect(recollected.incident?.id).toBe(saved[1].incident?.id);
});
