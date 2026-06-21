import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("defers public live searches under background queue pressure without duplicating reuse keys", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    for (const actor of ["Scattered Spider", "Akira", "Volt Typhoon", "Turla"]) {
      store.saveSource(source({
        id: `src_${actor.replaceAll(" ", "_").toLowerCase()}`,
        type: "rss",
        trustScore: 0.9,
        tags: [actor.toLowerCase()]
      }));
    }
    for (let index = 0; index < 50; index += 1) {
      frontier.add({
        source: source({ id: `src_sweep_${index}`, type: index % 2 === 0 ? "rss" : "static_web" }),
        tenantId: `tenant_sweep_${index % 7}`,
        intelRequestId: `sweep_${Math.floor(index / 100)}`,
        url: `https://sweep.example.test/background/${index}`,
        discoveredAt: "2026-05-24T00:00:00.000Z",
        anchorText: "APT ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8,
        fairnessKey: "background:sweep"
      });
    }

    const options = { store, frontier };
    const reuseKeys = new Map<string, string>();
    for (const actor of ["Scattered Spider"]) {
      for (let poll = 0; poll < 1; poll += 1) {
        const response = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(actor)}&entityType=actor`, {
          headers: { "x-tenant-id": "tenant_public" }
        }), options));
        const planner = response.planner as {
          backpressureState: string;
          backpressureReason?: string;
          reuseKey: string;
          activeRunId?: string;
        };

        expect(planner.activeRunId).toBeUndefined();
        expect(planner.backpressureState).toMatch(/deferred_by_queue_pressure|deferred_by_source_backoff/);
        expect(planner.backpressureReason ?? "").toMatch(/frontier queue depth|crawl backoff|freshness/);
        if (!reuseKeys.has(actor)) reuseKeys.set(actor, planner.reuseKey);
        expect(planner.reuseKey).toBe(reuseKeys.get(actor) ?? "");
      }
    }
  }, 15_000);
});
