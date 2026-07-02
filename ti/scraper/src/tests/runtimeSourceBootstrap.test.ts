import { writeFileSync } from "node:fs";
import { describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, join, mkdtempSync, rmSync, test } from "./apiTestHarness.ts";
import { tmpdir } from "node:os";
import { bootstrapRuntimeSources } from "../runtime/sourceBootstrap.ts";

describe("runtime source bootstrap and scheduler monitoring", () => {
  test("imports configured source bundles and reports the exact source target shortfall", () => {
    const store = new InMemoryScraperStore();
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-"));
    const seedPath = join(dir, "sources.json");
    writeFileSync(seedPath, JSON.stringify({
      version: 1,
      name: "test production sources",
      generatedAt: "2026-07-02T00:00:00.000Z",
      sources: [
        source("src_public_feed_a", "https://security.example.test/feed-a.xml"),
        source("src_public_feed_b", "https://security.example.test/feed-b.xml")
      ]
    }));

    try {
      const result = bootstrapRuntimeSources(store, {
        seedPaths: [seedPath],
        generatedAt: "2026-07-02T00:00:00.000Z",
        sourceTarget: 1000
      });

      expect(result.importedSourceCount).toBe(2);
      expect(result.totalSourceCount).toBe(2);
      expect(result.activeSourceCount).toBe(2);
      expect(result.shortfall).toBe(998);
      expect(result.blocker).toBe("source_registry_shortfall:2/1000");
      expect(store.listSources().every((item: any) => item.metadata.productionCollection === true)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("collection scheduler status exposes source coverage, durable run state, parser state, and per-source freshness", async () => {
    const originalAiBase = Bun.env.HANASAND_AI_API_BASE;
    delete Bun.env.HANASAND_AI_API_BASE;
    const store = new InMemoryScraperStore();
    const generatedAt = new Date().toISOString();
    store.saveSource({
      ...source("src_recent", "https://security.example.test/recent.xml"),
      status: "active",
      crawlState: { retryCount: 0, lastCollectedAt: generatedAt }
    } as any);
    store.saveSource({
      ...source("src_due", "https://security.example.test/due.xml"),
      status: "active",
      crawlState: { retryCount: 2, lastErrorAt: generatedAt, lastError: "HTTP 429", nextEligibleAt: generatedAt }
    } as any);
    store.saveRun({
      id: "run_recent",
      requestId: "req_public_canary",
      status: "completed",
      sourceCount: 2,
      captureCount: 1,
      exposureClaimCount: 1,
      createdAt: generatedAt,
      updatedAt: generatedAt
    });

    try {
      const response = await handleApiRequest(new Request("http://local/v1/ops/collection-scheduler"), {
        store,
        frontier: new FocusedFrontier(),
        sourceBootstrap: {
          generatedAt,
          sourceTarget: 2,
          seedPaths: [],
          importedSourceCount: 2,
          skippedSourceCount: 0,
          activeSourceCount: 2,
          totalSourceCount: 2,
          shortfall: 0,
          errors: []
        }
      } as any);
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.decision).toBe("operational");
      expect(body.sourceCoverage).toMatchObject({
        sourceTarget: 2,
        totalSourceCount: 2,
        sourceShortfall: 0,
        activeSourceCount: 2,
        dailySourceCount: 2,
        dailyCoveredCount: 1
      });
      expect(body.scheduler.lastSuccessfulRun.id).toBe("run_recent");
      expect(body.parser.aiEndpointConfigured).toBe(false);
      expect(body.sources.find((item: any) => item.sourceId === "src_due").retryCount).toBe(2);
    } finally {
      if (originalAiBase === undefined) delete Bun.env.HANASAND_AI_API_BASE;
      else Bun.env.HANASAND_AI_API_BASE = originalAiBase;
    }
  });
});

function source(id: string, url: string) {
  return {
    id,
    tenantId: "default",
    name: id,
    type: "rss",
    url,
    accessMethod: "public_http",
    status: "candidate",
    risk: "low",
    trustScore: 0.82,
    crawlFrequencySeconds: 300,
    legalNotes: "Public security source with safe metadata collection basis.",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z"
  };
}
