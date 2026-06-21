import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("keeps unknown actor searches searching-only when generic live results do not match the full query", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_generic_actor_feed",
      name: "Generic actor feed",
      type: "rss",
      url: "https://example.test/generic-actor.xml",
      tags: ["actor"],
      approvedAt: "2026-05-24T00:00:00.000Z",
      approvedBy: "test",
      catalog: {
        canonicalId: "generic-actor-feed",
        publisher: { name: "Generic Actor Feed", trustBasis: "research" },
        tier: "watchlist",
        approvalScope: "safe_public_auto",
        license: "test",
        legalBasis: "public test fixture",
        reliability: 0.5,
        intelligenceValue: 0.2,
        retentionClass: "public_raw",
        coverage: {
          topics: ["actor"],
          actors: [],
          aliases: [],
          industries: [],
          regions: [],
          countries: [],
          languages: ["en"],
          queryPatterns: ["actor"]
        },
        collection: {
          freshnessTargetSeconds: 3600,
          collectionSlaSeconds: 300,
          budgetClass: "low",
          crawlCadenceSeconds: 3600
        },
        adapterCompatibility: ["rss"]
      }
    }));
    const response = await body(await handleApiRequest(api("/v1/intel/search?q=Made%20Up%20Actor&entityType=actor"), {
      store,
      frontier: new FocusedFrontier(),
      disableBundledSourcePack: true,
      publicClearWebFetcher: async () => new Response(`<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title>Cyberattack overview</title>
            <link>https://example.test/cyberattack</link>
            <description>Threat actors and ransomware groups are discussed in general.</description>
          </item>
        </channel></rss>`, {
        status: 200,
        headers: { "content-type": "application/rss+xml" }
      })
    }));
    const publicTiAnswer = response.publicTiAnswer as {
      safeSummary: string[];
      evidenceLedgerReferences: unknown[];
      ux: { state: string; compactAnswerCopy: { heading: string; summary: string[]; statusLine: string } };
    };

    expect(publicTiAnswer.safeSummary).toEqual(["Searching"]);
    expect(publicTiAnswer.evidenceLedgerReferences).toEqual([]);
    expect(publicTiAnswer.ux.state).toBe("searching");
    expect(publicTiAnswer.ux.compactAnswerCopy).toMatchObject({
      heading: "Searching",
      summary: ["Searching"],
      statusLine: "Searching"
    });
    expect(JSON.stringify(response)).not.toMatch(/Cyberattack overview|ransomware groups are discussed/i);
  });
});
