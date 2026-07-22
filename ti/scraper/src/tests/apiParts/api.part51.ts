import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("smokes mounted quality endpoints through the Bun API server", async () => {
    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({
      id: "cap_mounted_ready",
      tenantId: undefined,
      url: "https://mounted-quality.example.test/apt29-ready",
      body: "Mandiant linked APT29 to phishing and credential dumping against Northwind Health in healthcare. First seen 2026-05-22.",
      metadata: { title: "APT29 mounted ready", actorName: "APT29", evidenceStage: "reviewed_promoted", graphReviewState: "accepted", exposureClaim: true }
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_mounted_alias",
      tenantId: undefined,
      url: "https://mounted-quality.example.test/akira-alias",
      body: "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.",
      metadata: { title: "Akira mounted alias", evidenceStage: "captured_page", exposureClaim: true }
    }));
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const ready = await fetch(`${base}/v1/intel/search?q=APT29&entityType=actor`).then((response) => response.json()) as {
        quality: { status: string; canPromoteToReady: boolean; publicWarningText: string[] };
        graph: { endpoint: string; reviewQueue: { total: number; publicFactPolicy: string } };
      };
      const evaluated = await fetch(`${base}/v1/quality/evaluate?q=APT29`).then((response) => response.json()) as {
        quality: { status: string; canPromoteToReady: boolean };
      };
      const alias = await fetch(`${base}/v1/quality/evaluate?q=Akira`).then((response) => response.json()) as {
        quality: { publicWarningCodes: string[]; analystActions: Array<{ kind: string }> };
      };

      expect(ready.quality).toMatchObject({ status: "partial", canPromoteToReady: false });
      expect(evaluated.quality).toMatchObject({ status: "ready", canPromoteToReady: true });
      expect(ready.graph).toMatchObject({
        endpoint: "/v1/intel/search.graph"
      });
      expect(["ready", "hold_weak_edges"]).toContain(ready.graph.reviewQueue.publicFactPolicy);
      expect(alias.quality.publicWarningCodes).toContain("single_source");
      expect(alias.quality.analystActions.map((action) => action.kind)).toContain("review_claims");
      expect(JSON.stringify(ready.quality)).not.toContain("Mandiant linked APT29");
      expect(JSON.stringify(alias.quality)).not.toContain("Cyber gang list");
      expect(JSON.stringify(alias.quality)).not.toContain("mounted-quality.example.test");
    } finally {
      await server.stop();
    }
  });
});
