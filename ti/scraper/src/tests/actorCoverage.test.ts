import { describe, expect, test } from "bun:test";
import { buildActorCoverageReport } from "../pipeline/actorCoverage.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("high-value actor coverage", () => {
  test("measures actor dimensions from retained evidence", () => {
    const store = new InMemoryScraperStore();
    const collectedAt = "2026-08-10T00:00:00.000Z";
    store.saveSource({ id: "source_actor", tenantId: "tenant_actor", name: "Threat report", type: "rss", url: "https://example.test/report", accessMethod: "public_http", status: "active", risk: "low", trustScore: 1, crawlFrequencySeconds: 3600, createdAt: collectedAt, updatedAt: collectedAt });
    store.saveCapture({ id: "capture_actor", tenantId: "tenant_actor", sourceId: "source_actor", url: "https://example.test/report/apt29", title: "APT29 targets government", body: "APT29 used MagicWeb against Example Ministry in Norway.", collectedAt, publishedAt: "2026-08-09T00:00:00.000Z", contentHash: "actor_hash", mediaType: "text/html", storageKind: "inline_text", metadata: {}, sensitive: false } as any);
    for (const [id, type, value] of [
      ["actor", "actor", "APT29"],
      ["country", "country", "Norway"],
      ["sector", "sector", "government"],
      ["malware", "malware", "MagicWeb"],
      ["technique", "ttp", "T1566"],
      ["victim", "victim", "Example Ministry"]
    ]) store.saveExtractedEntity({ id: `entity_${id}`, tenantId: "tenant_actor", sourceId: "source_actor", captureId: "capture_actor", type, value, normalizedValue: value.toLowerCase() });

    const report = buildActorCoverageReport(store, { tenantId: "tenant_actor", generatedAt: "2026-08-10T01:00:00.000Z" });
    const apt29 = report.rows.find((row) => row.actorId === "apt29")!;
    expect(apt29.coverage).toMatchObject({ sourceReferences: true, recentActivity: true, countries: true, sectors: true, malwareTools: true, attackTechniques: true, victims: true, sourceFreshness: true });
    expect(apt29.observed.countries).toEqual(["Norway"]);
    expect(apt29.observed.sourceReferences).toEqual([{ sourceId: "source_actor", name: "Threat report", url: "https://example.test/report" }]);
    expect(apt29.evidence).toMatchObject({ captureCount: 1, recentCaptureCount: 1, sourceCount: 1, entityCount: 6 });

    const apt42 = report.rows.find((row) => row.actorId === "apt42")!;
    expect(apt42.coverage.recentActivity).toBe(false);
    expect(apt42.evidence.captureCount).toBe(0);
  });
});
