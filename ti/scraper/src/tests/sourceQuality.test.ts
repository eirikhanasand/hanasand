import { describe, expect, test } from "bun:test";
import { buildSourceQualityReport } from "../pipeline/sourceQuality.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("source quality", () => {
  test("derives quality from health, captures, entities, and alerts", () => {
    const store = new InMemoryScraperStore();
    const at = "2026-08-10T00:00:00.000Z";
    store.saveSource({ id: "source_quality", tenantId: "tenant_quality", name: "Quality feed", type: "rss", url: "https://example.test/feed", accessMethod: "public_http", status: "active", risk: "low", trustScore: 1, crawlFrequencySeconds: 3600, metadata: { sourceFamily: "public_advisory" }, createdAt: at, updatedAt: at });
    store.saveCapture({ id: "capture_quality", tenantId: "tenant_quality", sourceId: "source_quality", url: "https://example.test/item", collectedAt: at, publishedAt: "2026-08-09T00:00:00.000Z", contentHash: "quality_hash", mediaType: "text/html", storageKind: "inline_text", body: "APT29", metadata: { language: "en", country: "Norway" }, sensitive: false } as any);
    store.saveExtractedEntity({ id: "entity_quality", tenantId: "tenant_quality", sourceId: "source_quality", captureId: "capture_quality", type: "country", value: "Norway", normalizedValue: "norway" });
    store.saveSourceHealthObservation({ id: "health_quality_ok", tenantId: "tenant_quality", sourceId: "source_quality", checkedAt: at, status: "healthy", success: true, useful: true, captureCount: 1, duplicateCount: 0, parserWarningCount: 0, latencyMs: 120 });
    store.saveSourceHealthObservation({ id: "health_quality_failed", tenantId: "tenant_quality", sourceId: "source_quality", checkedAt: "2026-08-09T00:00:00.000Z", status: "failed", success: false, useful: false, failureReason: "request timeout", latencyMs: 500 });
    const report = buildSourceQualityReport(store, { tenantId: "tenant_quality", generatedAt: "2026-08-10T01:00:00.000Z" });
    expect(report.rows[0]).toMatchObject({ sample: { attempts: 2, successfulAttempts: 1, captures: 1 }, collectionSuccessRate: 0.5, parserSuccessRate: 1, usefulOutputRate: 0.5, duplicateRate: 0, language: { en: 1 }, geography: { Norway: 1 }, failureCategories: { timeout: 1 }, timeToUsefulOutputMs: { average: 120, sampleSize: 1 } });
  });
});
