import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("supports compact source admin and metrics", async () => {
    const store = new InMemoryScraperStore();
    const options = {
      store,
      frontier: new FocusedFrontier(),
      authApiBase: "http://auth.test/api",
      authFetch: async () => Response.json({ id: "source-admin", roles: [{ id: "source_admin" }] })
    } as any;
    const headers = { "content-type": "application/json", authorization: "Bearer valid", id: "source-admin" };
    const unauthenticated = await handleApiRequest(api("/v1/sources", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), options);
    expect(unauthenticated.status).toBe(401);
    const privateTarget = await handleApiRequest(api("/v1/sources", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Private target", type: "rss", url: "http://127.0.0.1/feed", accessMethod: "public_http", status: "candidate", risk: "low", legalNotes: "Public feed collection basis." })
    }), options);
    expect(privateTarget.status).toBe(400);
    const created = await body(await handleApiRequest(api("/v1/sources", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Vendor API",
        type: "api",
        url: "https://api.example.test/intel?q={query}",
        accessMethod: "official_api",
        status: "candidate",
        risk: "medium",
        legalNotes: "Approved vendor API fixture."
      })
    }), options));

    const id = (created.source as { id: string }).id;
    const updated = await body(await handleApiRequest(api(`/v1/sources/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ trustScore: 1.5 })
    }), options));
    expect((updated.source as { status: string; trustScore: number }).status).toBe("candidate");
    expect((updated.source as { status: string; trustScore: number }).trustScore).toBe(1);

    const metrics = await body(await handleApiRequest(api("/v1/metrics"), options));
    expect(metrics.service).toBe("ti-scraper");
    expect((metrics.sources as { active: number }).active).toBe(0);
  });
});
