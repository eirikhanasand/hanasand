import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("promotes fresh multi-actor canary captures into public intel answers", async () => {
    const store = new InMemoryScraperStore();
    const objectStore = new InMemoryObjectEvidenceStore();
    const frontier = new FocusedFrontier();
    const canaryFetch = async (url: string) => {
      if (url.includes("microsoft.com")) {
        return new Response(`
          <rss><channel><item>
            <title>APT42 credential theft infrastructure observed in 2026</title>
            <link>https://example.test/microsoft/apt42</link>
            <description>APT42 targeted government and energy sector victims with phishing infrastructure, malware delivery, and indicator 203.0.113.42.</description>
            <pubDate>Sun, 24 May 2026 10:05:00 GMT</pubDate>
          </item></channel></rss>
        `, { status: 200, headers: { "content-type": "application/rss+xml" } });
      }
      if (url.includes("cloud.google.com")) {
        return new Response(`
          <rss><channel><item>
            <title>Turla activity uses Snake malware and command infrastructure</title>
            <link>https://example.test/google/turla</link>
            <description>Turla operators used Snake malware against government victims and maintained command and control infrastructure at 198.51.100.77.</description>
            <pubDate>Sun, 24 May 2026 10:06:00 GMT</pubDate>
          </item></channel></rss>
        `, { status: 200, headers: { "content-type": "application/rss+xml" } });
      }
      return new Response(`
        <rss><channel><item>
          <title>CVE-2026-11111 public advisory</title>
          <link>https://example.test/cve-2026-11111</link>
          <description>Public advisory references CVE-2026-11111 exploitation and indicator 192.0.2.15.</description>
          <pubDate>Sun, 24 May 2026 10:04:00 GMT</pubDate>
        </item></channel></rss>
      `, { status: 200, headers: { "content-type": "application/rss+xml" } });
    };
    const options = { store, frontier, objectStore, canaryFetch };

    await body(await handleApiRequest(api("/v1/sources/canary-activation", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", generatedAt: "2026-05-24T10:00:00.000Z" })
    }), options));
    const run = await body(await handleApiRequest(api("/v1/ops/canary/run", {
      method: "POST",
      body: JSON.stringify({ operatorApproval: true, approvedBy: "analyst-1", maxSources: 4, maxTasks: 4, generatedAt: "2026-05-24T10:07:00.000Z" })
    }), options));
    expect(run.canaryRun).toMatchObject({
      completedTaskCount: 4,
      failedTaskCount: 0,
      insertedCaptureCount: 4,
      incidentCount: 4,
      remainingQueuedTaskCount: 0
    });

    const operator = await body(await handleApiRequest(api("/v1/ops/canary"), options)) as CanaryOperatorResponseForTest;
    const readiness = operator.operatorView.publicAnswerReadiness;
    expect(readiness.find((item) => item.query === "APT42")).toMatchObject({
      captureCount: 1,
      whyPartial: expect.arrayContaining([expect.stringContaining("can cite canary captures")])
    });
    expect(readiness.find((item) => item.query === "Turla")).toMatchObject({
      captureCount: 1,
      whyPartial: expect.arrayContaining([expect.stringContaining("can cite canary captures")])
    });

    for (const query of ["APT42", "Turla"]) {
      const search = await body(await handleApiRequest(api(`/v1/intel/search?q=${encodeURIComponent(query)}`), options)) as unknown as {
        status: string;
        publicTiAnswer: {
          safeSummary: string[];
          evidenceLedgerReferences: unknown[];
          ux: { evidenceStageLabels: { captured_page: { count: number } } };
        };
        actorProfile: {
          datasets: { evidenceStageCounts: { captured_page: number } };
          provenance: Array<{ evidenceStage: string }>;
        };
      };
      expect(search.status).toMatch(/ready|partial/);
      expect(search.publicTiAnswer.safeSummary).not.toEqual(["Searching"]);
      expect(search.actorProfile.datasets.evidenceStageCounts.captured_page).toBeGreaterThan(0);
      expect(search.publicTiAnswer.evidenceLedgerReferences.length).toBeGreaterThan(0);
      expect(search.publicTiAnswer.ux.evidenceStageLabels.captured_page.count).toBeGreaterThan(0);
      expect(search.actorProfile.provenance.every((item: { evidenceStage: string }) => item.evidenceStage === "captured_page")).toBe(true);
      expect(JSON.stringify(search.publicTiAnswer)).toContain(query);
    }

    const readinessProof = await body(await handleApiRequest(api("/v1/ops/canary/readiness?requiredQueries=APT42,Turla&generatedAt=2026-05-24T10:07:00.000Z"), options)) as CanaryReadinessResponseForTest;
    const activeSourceCount = readinessProof.readiness.evidence.activeSourceCount;
    expect(readinessProof.readiness).toMatchObject({
      schemaVersion: "ti.public_canary_readiness.v1",
      decision: "promote",
      evidence: {
        activeSourceCount: 10,
        externalObjectCaptureCount: 4,
        missingObjectReferenceCount: 0,
        promotionYield: 1
      },
      controls: {
        activationRequiresHumanApproval: true,
        continuousLoopAutoActivation: false,
        restrictedSourcesExcluded: true,
        reversiblePauseAvailable: true,
        nativeLiveHttpRequired: false
      }
    });
    expect(activeSourceCount).toBeGreaterThanOrEqual(8);
    expect(readinessProof.readiness.queryReadiness).toEqual(expect.arrayContaining([
      expect.objectContaining({ query: "APT42", captureCount: 1, readyForPublicAnswer: true }),
      expect.objectContaining({ query: "Turla", captureCount: 1, readyForPublicAnswer: true })
    ]));
    expect(readinessProof.readiness.blockers).toEqual([]);
    expect(readinessProof.readiness.proofCommands).toContain("bun run check:canary-proof-path");

    const productionReadiness = await body(await handleApiRequest(api("/v1/ops/canary/readiness?requiredQueries=APT42,Turla&requireNativeLiveHttp=true&generatedAt=2026-05-24T10:07:00.000Z"), options)) as CanaryReadinessResponseForTest;
    expect(productionReadiness.readiness.decision).toBe("hold");
    expect(productionReadiness.readiness.controls.nativeLiveHttpRequired).toBe(true);
    expect(productionReadiness.readiness.blockers).toContain("no native live HTTP canary captures are available for production readiness");
  });
});
