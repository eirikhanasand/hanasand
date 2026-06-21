import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("publishes canary soak health across repeated portfolio-only cycles", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const objectStore = new InMemoryObjectEvidenceStore();
    const canaryFetch = async (url: string) => {
      const title = url.includes("microsoft.com")
        ? "APT42 public canary soak proof"
        : "Turla public canary soak proof";
      const description = title.includes("APT42")
        ? "APT42 targeted public sector victims with phishing infrastructure and malware."
        : "Turla used Snake malware and command infrastructure against government victims.";
      return new Response(`
        <rss><channel><item>
          <title>${title}</title>
          <link>https://example.test/canary-soak/${encodeURIComponent(title)}</link>
          <description>${description}</description>
          <pubDate>Sun, 24 May 2026 10:30:00 GMT</pubDate>
        </item></channel></rss>
      `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    };
    const options = { store, frontier, objectStore, canaryFetch };
    store.saveSource(source({
      id: "src_non_canary_soak",
      status: "active",
      type: "rss",
      url: "https://non-canary.example.test/feed.xml",
      metadata: { canaryPortfolio: false }
    }));

    await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "soak-proof", generatedAt: "2026-05-24T10:20:00.000Z" })
    }), options));
    await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "soak-proof", maxSources: 1, maxTasks: 1, generatedAt: "2026-05-24T10:21:00.000Z" })
    }), options));
    await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "soak-proof", maxSources: 2, maxTasks: 1, generatedAt: "2026-05-24T10:22:00.000Z" })
    }), options));

    const soak = await body(await handleApiRequest(api("/v1/ops/canary/soak?minCycles=2&generatedAt=2026-05-24T10:22:00.000Z"), options)) as CanarySoakResponseForTest;
    expect(soak.soak).toMatchObject({
      schemaVersion: "ti.public_canary_soak.v1",
      decision: "promote",
      metrics: {
        cycleCount: 2,
        totalCaptureCount: 2,
        totalIncidentCount: 2,
        activeSourceCount: 10,
        externalObjectCaptureCount: 2,
        missingObjectReferenceCount: 0,
        promotionYield: 1
      },
      controls: {
        canaryPortfolioOnly: true,
        activationRequiresHumanApproval: true,
        continuousLoopAutoActivation: false,
        boundedQueueRequired: true,
        objectBoundaryRequired: true,
        nativeLiveHttpRequired: false,
        restrictedSourcesExcluded: true
      }
    });
    const productionSoak = await body(await handleApiRequest(api("/v1/ops/canary/soak?minCycles=2&requireNativeLiveHttp=true&generatedAt=2026-05-24T10:22:00.000Z"), options)) as CanarySoakResponseForTest;
    expect(productionSoak.soak.decision).toBe("hold");
    expect(productionSoak.soak.controls.nativeLiveHttpRequired).toBe(true);
    expect(productionSoak.soak.blockers).toContain("no native live HTTP canary captures are available in the soak window");
    expect(soak.soak.cycles).toHaveLength(2);
    expect(soak.soak.blockers).toEqual([]);
    expect(soak.soak.proofCommands).toContain("bun run check:canary-proof-path");
    expect(store.listCaptures().every((capture) => capture.sourceId !== "src_non_canary_soak")).toBe(true);
  });
});
