import { describe, expect, test } from "bun:test";
import { buildQueryCoverageReport } from "../pipeline/queryCoverage.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("query-class coverage", () => {
  test("reports common query classes from the same retained evidence set", () => {
    const store = new InMemoryScraperStore();
    const at = "2026-08-10T00:00:00.000Z";
    store.saveSource({ id: "source_query", tenantId: "tenant_query", name: "Threat feed", type: "rss", url: "https://example.test/feed", accessMethod: "public_http", status: "active", risk: "low", trustScore: 1, crawlFrequencySeconds: 3600, createdAt: at, updatedAt: at });
    store.saveCapture({ id: "capture_query", tenantId: "tenant_query", sourceId: "source_query", url: "https://example.test/apt29", title: "APT29 exploited CVE-2026-1234", body: "APT29 used malware against Example Bank in Norway; the campaign exposed stolen data.", collectedAt: at, publishedAt: "2026-08-09T00:00:00.000Z", contentHash: "query_hash", mediaType: "text/html", storageKind: "inline_text", metadata: { exposureClaim: true }, sensitive: false } as any);
    for (const [id, type, value] of [["actor", "actor", "APT29"], ["cve", "cve", "CVE-2026-1234"], ["company", "victim", "Example Bank"], ["country", "country", "Norway"], ["ttp", "ttp", "T1566"]]) store.saveExtractedEntity({ id: `entity_${id}`, tenantId: "tenant_query", sourceId: "source_query", captureId: "capture_query", type, value, confidence: 0.9 });
    const report = buildQueryCoverageReport(store, { tenantId: "tenant_query", generatedAt: "2026-08-10T01:00:00.000Z" });
    const row = (id: string) => report.rows.find((item) => item.queryClass === id)!;
    expect(row("threat_actor")).toMatchObject({ resultCount: 1, sourceDiversity: 1, evidenceCompleteness: { score: 1 }, extractionQuality: { averageConfidence: 0.9 }, timeToFirstResultMs: { status: "unmeasured" } });
    expect(row("cve").resultCount).toBe(1);
    expect(row("leaked_data_claim").resultCount).toBe(1);
    expect(row("ttp").customerMatchBehavior).toMatchObject({ alertCount: 0, matchRate: 0 });
    expect(report.rows).toHaveLength(13);
  });
});
