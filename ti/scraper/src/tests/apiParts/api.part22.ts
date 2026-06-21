import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exposes frontier queue groups and run status frontier context", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const frontier = new FocusedFrontier();
    frontier.add({
      source: source(),
      tenantId: "tenant_a",
      intelRequestId: "request_a",
      url: "https://example.test/apt29",
      discoveredAt: "2026-01-01T00:00:00.000Z",
      anchorText: "APT29 ransomware campaign exploit",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });
    const options = { store, frontier };

    const frontierResponse = await body(await handleApiRequest(api("/v1/frontier"), options));
    expect((frontierResponse.queue as unknown[])).toHaveLength(1);
    expect((frontierResponse.summary as { groups: { tenants: Record<string, number> } }).groups.tenants.tenant_a).toBe(1);
    expect((frontierResponse.scheduler as {
      cutover: { targetBackend: string };
      diagnostics: { diagnostics: Array<{ workClass: string; pressureState: string; queueAgeSeconds: number }> };
    }).cutover.targetBackend).toBe("postgres_queue");
    expect((frontierResponse.scheduler as {
      diagnostics: { diagnostics: Array<{ workClass: string; pressureState: string; queueAgeSeconds: number }> };
    }).diagnostics.diagnostics[0]).toMatchObject({
      workClass: "background_refresh",
      pressureState: "accepted"
    });

    const runResponse = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const runId = (runResponse.run as { id: string }).id;
    const status = await body(await handleApiRequest(api(`/v1/intel/runs/${runId}`), options));

    expect(status.frontier).toBeDefined();
    expect((status.frontier as { summary: { queued: number } }).summary.queued).toBeGreaterThan(0);
  });
});
