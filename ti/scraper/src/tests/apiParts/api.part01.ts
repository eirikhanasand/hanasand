import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns typed health and paginated sources", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "one" }));
    store.saveSource(source({ id: "two", name: "Second" }));
    const options = { store, frontier: new FocusedFrontier() };

    const health = await body(await handleApiRequest(api("/v1/health"), options));
    expect(health).toMatchObject({ ok: true, service: "ti-scraper", version: "v1" });

    const sources = await body(await handleApiRequest(api("/v1/sources?limit=1"), options));
    expect((sources.sources as unknown[])).toHaveLength(1);
    expect(sources.nextCursor).toBe("1");
  });
});
