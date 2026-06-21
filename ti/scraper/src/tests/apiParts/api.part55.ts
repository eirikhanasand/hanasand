import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("returns a safe no-result public TI answer contract while live collection is pending", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_no_result", tags: ["apt29"], type: "rss" }));
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Unseen%20Quartz%20Actor&entityType=actor"), {
      store,
      frontier: new FocusedFrontier()
    }));
    const publicTiAnswer = response.publicTiAnswer as {
      noResult: boolean;
      displayState: string;
      safeSummary: string[];
      waitReasons: Array<{ code: string; message: string }>;
      evidenceLedgerReferences: unknown[];
      nextPoll: { pollable: boolean; nextPollAfterSeconds: number; cursorRequired: boolean };
      route: { publicWrapperPath: string; publicWrapperMethod: string };
      stateMachine: {
        state: string;
        progress: { noResult: boolean };
        polling: { pollReason: string; cursorRequired: boolean };
        holds: { sourceActivationGaps: string[] };
        safeNoResult: { noResult: boolean; wording: string; overstatesAbsence: boolean };
      };
      releaseCandidate: {
        state: string;
        visibleAnswer: { displayState: string; safeSummaryMode: string; canRenderFacts: boolean };
        agent10RcGate: { status: string; decision: string };
        publicPostCompatibility: { canonicalPath: string; cursorRequired: boolean };
      };
      ux: {
        state: string;
        compactAnswerCopy: { heading: string; summary: string[]; statusLine: string };
        freshness: { showLastSeen: boolean; noLastSeenFiction: boolean };
        polling: { intervalSeconds: number; nextPollAfterSeconds: number; hint: string };
      };
      buyerSearchCard: {
        schemaVersion: string;
        status: string;
        summary: string;
        recentActivity: string[];
        victimsTargets: string[];
        ttpTools: string[];
        sourcePivots: string[];
        nextSearches: string[];
        confidence: { score: number; label: string; reason: string };
        safety: { noRawLeakData: boolean; noUnsafeUrls: boolean; noCredentials: boolean };
      };
      safeWording: { overstatesLiveSnippets: boolean; rawEvidenceExposed: boolean; restrictedPayloadsExposed: boolean; guidance: string[] };
    };

    expect(typeof publicTiAnswer.noResult).toBe("boolean");
    expect(publicTiAnswer.displayState).toMatch(/partial|review_required|searching/);
    expect(publicTiAnswer.safeSummary.length).toBeGreaterThan(0);
    expect(publicTiAnswer.waitReasons.map((reason) => reason.code)).toContain("capture_promotion");
    expect(Array.isArray(publicTiAnswer.evidenceLedgerReferences)).toBe(true);
    expect(publicTiAnswer.nextPoll).toMatchObject({ pollable: true, cursorRequired: true });
    expect(publicTiAnswer.nextPoll.nextPollAfterSeconds).toBeGreaterThan(0);
    expect(publicTiAnswer.route).toMatchObject({ publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" });
    expect(publicTiAnswer.stateMachine.state).toMatch(/no_result|searching|partial|source_biased/);
    expect(typeof publicTiAnswer.stateMachine.progress.noResult).toBe("boolean");
    expect(publicTiAnswer.stateMachine.polling.cursorRequired).toBe(true);
    expect(typeof publicTiAnswer.stateMachine.safeNoResult.noResult).toBe("boolean");
    expect(publicTiAnswer.stateMachine.safeNoResult.wording).toBe("Searching");
    expect(publicTiAnswer.stateMachine.safeNoResult.overstatesAbsence).toBe(false);
    expect(publicTiAnswer.releaseCandidate.state).toMatch(/no_result|searching|partial|review_required|source_biased/);
    expect(publicTiAnswer.releaseCandidate.visibleAnswer).toMatchObject({
      safeSummaryMode: expect.any(String),
      canRenderFacts: expect.any(Boolean)
    });
    expect(publicTiAnswer.releaseCandidate.agent10RcGate.status).toMatch(/pass|warning|blocker/);
    expect(publicTiAnswer.releaseCandidate.agent10RcGate.decision).toMatch(/pass|hold|rollback/);
    expect(publicTiAnswer.releaseCandidate.publicPostCompatibility).toMatchObject({
      canonicalPath: "/api/ti/search",
      cursorRequired: true
    });
    expect(publicTiAnswer.ux.state).toBe("searching");
    expect(publicTiAnswer.ux.compactAnswerCopy).toMatchObject({
      heading: "Searching",
      summary: ["Searching"],
      statusLine: "Searching"
    });
    expect(publicTiAnswer.ux.freshness).toMatchObject({
      showLastSeen: false,
      noLastSeenFiction: true
    });
    expect(publicTiAnswer.ux.polling).toMatchObject({
      intervalSeconds: 3,
      nextPollAfterSeconds: 3,
      hint: "poll_after_3_seconds"
    });
    expect(publicTiAnswer.buyerSearchCard).toMatchObject({
      schemaVersion: "ti.public_buyer_search_card.v1",
      status: "searching",
      summary: "Searching",
      recentActivity: [],
      victimsTargets: [],
      ttpTools: [],
      sourcePivots: [],
      nextSearches: [],
      confidence: { score: 0, label: "unknown" },
      safety: { noRawLeakData: true, noUnsafeUrls: true, noCredentials: true }
    });
    expect(publicTiAnswer.safeWording.overstatesLiveSnippets).toBe(false);
    expect(publicTiAnswer.safeWording.rawEvidenceExposed).toBe(false);
    expect(publicTiAnswer.safeWording.restrictedPayloadsExposed).toBe(false);
  });
});
