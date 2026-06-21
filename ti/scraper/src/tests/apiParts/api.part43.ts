import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("source apply-plan route blocks restricted auto-activation and rejects invalid actions", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({
      id: "src_route_restricted",
      name: "Restricted Route Source",
      type: "tor_metadata",
      url: "http://restricted-route.onion",
      accessMethod: "approved_proxy",
      risk: "restricted",
      status: "approved",
      tenantId: "tenant_restricted_route",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: "2026-05-24T00:00:00.000Z",
        approvedBy: "legal",
        policyVersion: "collection-policy:v1"
      },
      metadata: { legalNotesReviewedAt: new Date().toISOString() },
      tags: ["apt29"]
    }));

    const restricted = await body(await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_restricted_route" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
        sourcePackIds: [],
        selectedActions: ["activate", "quarantine", "request_legal_notes"],
        includeExecutionPreview: true
      })
    }), { store, frontier: new FocusedFrontier() }));
    const applyPlan = restricted.applyPlan as {
      willMutate: boolean;
      willStartCrawling: boolean;
      items: Array<{
        action: string;
        automation: string;
        policyImpact: { metadataOnlyRequired: boolean };
        collectionImpact: { enablesCollection: boolean; remainsDisabled: string[] };
      }>;
    };

    expect(applyPlan.willMutate).toBe(false);
    expect(applyPlan.willStartCrawling).toBe(false);
    expect(applyPlan.items.some((item) => item.action === "activate" && item.collectionImpact.enablesCollection)).toBe(false);
    expect(applyPlan.items.some((item) => item.policyImpact.metadataOnlyRequired)).toBe(true);
    expect(applyPlan.items.flatMap((item) => item.collectionImpact.remainsDisabled)).toEqual(expect.arrayContaining([
      "restricted raw payload collection",
      "automatic restricted-source activation"
    ]));

    const invalidResponse = await handleApiRequest(api("/v1/sources/apply-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queryScope: { queries: ["APT29"] },
        selectedActions: ["launch_crawler"]
      })
    }), { store, frontier: new FocusedFrontier() });
    const invalid = await body(invalidResponse);
    expect(invalidResponse.status).toBe(400);
    expect(invalid.error).toMatchObject({ code: "invalid_action" });
  });
});
