import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("persists canary metadata through the file-backed scraper store boundary", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ti-file-backed-store-"));
    try {
      const snapshotPath = join(dir, "metadata", "scraper-store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(source({ id: "src_persisted", status: "active" }));
      const capture = fixtureCapture({
        id: "cap_persisted",
        sourceId: "src_persisted",
        body: undefined,
        storageKind: "external_object",
        objectRef: {
          bucket: "public-canary-evidence",
          key: "global/src_persisted/cap_persisted/hash.bin",
          sizeBytes: 42,
          sha256: "hash"
        },
        metadata: {
          safeExcerpt: "APT42 public canary evidence",
          bodyExternalized: true
        }
      });
      store.saveCapture(capture);
      store.saveEvaluationBenchmark({ id: "benchmark_persisted", status: "annotating" });
      store.saveEvaluationAnnotation({ id: "annotation_persisted", benchmarkId: "benchmark_persisted" });
      store.saveEvaluationAdjudication({ id: "adjudication_persisted", benchmarkId: "benchmark_persisted" });

      const reloaded = new FileBackedScraperStore({ snapshotPath });
      expect(reloaded.getSource("src_persisted")?.status).toBe("active");
      expect(reloaded.getCapture("cap_persisted")).toMatchObject({
        storageKind: "external_object",
        body: undefined,
        metadata: {
          bodyExternalized: true
        }
      });
      expect(reloaded.getEvaluationBenchmark("benchmark_persisted")?.status).toBe("annotating");
      expect(reloaded.getEvaluationAnnotation("annotation_persisted")?.benchmarkId).toBe("benchmark_persisted");
      expect(reloaded.getEvaluationAdjudication("adjudication_persisted")?.benchmarkId).toBe("benchmark_persisted");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
