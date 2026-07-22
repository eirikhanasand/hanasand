import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns redacted run results with include filters and STIX export", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const run = created.run as { id: string; planId: string };
    const plan = store.getPlan(run.planId);
    const rawText = "APT29 used phishing against a healthcare victim from https://evil.example.com and CVE-2025-12345.";
    const result = processCollectedItem({
      tenantId: "tenant_a",
      sourceId: "src_rss",
      taskId: plan?.tasks[0]?.id,
      url: "https://example.test/report",
      collectedAt: "2026-05-24T00:00:00.000Z",
      title: "APT29 report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { fixture: true, runId: run.id },
      sensitive: false
    });
    store.savePipelineResult({
      ...result,
      capture: { ...result.capture, tenantId: "tenant_a" }
    });

    const capturesOnly = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}/results?include=captures&tenantId=tenant_a`), options));
    const captures = (capturesOnly.results as { captures: { items: Array<{ body?: string; bodyRedacted: boolean }> } }).captures.items;
    expect(captures[0]?.body).toBeUndefined();
    expect(captures[0]?.bodyRedacted).toBe(true);
    expect((capturesOnly.results as Record<string, unknown>).incidents).toBeUndefined();

    const intelOnly = await body(await handleApiRequest(api(`/v1/intel/runs/${run.id}/results?include=indicators,entities,relationships&tenantId=tenant_a`), options));
    expect(((intelOnly.results as { indicators: { items: unknown[] } }).indicators.items).length).toBeGreaterThan(0);
    expect(((intelOnly.results as { entities: { items: unknown[] } }).entities.items).length).toBeGreaterThan(0);
    expect(((intelOnly.results as { relationships: { items: unknown[] } }).relationships.items).length).toBeGreaterThan(0);

    const exportResponse = await body(await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: run.id, tenantId: "tenant_a", generatedAt: "2026-05-24T00:05:00.000Z" })
    }), options));
    expect((exportResponse.bundle as { type: string; objects: unknown[] }).type).toBe("bundle");
    expect((exportResponse.bundle as { type: string; objects: unknown[] }).objects.length).toBeGreaterThan(0);
  });
});
