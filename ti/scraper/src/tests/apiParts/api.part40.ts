import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("rejects invalid scheduler apply-plan actions without mutating frontier state", async () => {
    const store = new InMemoryScraperStore();
    const frontier = new FocusedFrontier();
    const activeSource = source({ id: "src_invalid_scheduler_action" });
    store.saveSource(activeSource);
    frontier.add({
      source: activeSource,
      tenantId: "tenant_scheduler",
      intelRequestId: "request_invalid_action",
      url: "https://scheduler.example.test/invalid-action",
      discoveredAt: "2026-01-01T00:00:00.000Z",
      anchorText: "APT29 scheduler invalid action fixture",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.7
    });
    const beforeQueued = frontier.snapshot().map((item) => item.task.id).sort();
    const response = await handleApiRequest(api("/v1/frontier/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedActions: ["mutate_queue_now"] })
    }), { store, frontier });
    const payload = await body(response);

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: {
        code: "invalid_action",
        message: "selectedActions contains unsupported frontier apply actions",
        details: {
          invalid: ["mutate_queue_now"],
          allowed: expect.arrayContaining(["release_expired_leases", "trigger_emergency_brake"])
        }
      }
    });
    expect(frontier.snapshot().map((item) => item.task.id).sort()).toEqual(beforeQueued);
    expect(frontier.leasedSnapshot()).toEqual([]);
  });
});
