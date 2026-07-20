import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir, handleApiRequest, startApiServer, loadRuntimeConfig, FocusedFrontier, activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop, createLogger, MetricsRegistry, WorkerSupervisor, processCollectedItem, FileBackedScraperStore, InMemoryObjectEvidenceStore, InMemoryScraperStore, hashContent, api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "../apiTestHarness.ts";
import type { AnalystClaimLedgerEntry, CanaryOperatorResponseForTest, CanaryReadinessResponseForTest, CanarySoakResponseForTest, RawCapture, SourceRecord } from "../apiTestHarness.ts";

describe("api v1", () => {
  test("exports STIX-like CTI from run captures even before incidents are persisted", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source());
    const options = { store, frontier: new FocusedFrontier() };
    const created = await body(await handleApiRequest(api("/v1/intel/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "APT29", entityType: "actor", tenantId: "tenant_a" })
    }), options));
    const run = created.run as { id: string; planId: string };
    const plan = store.getPlan(run.planId);
    const rawText = "APT29 used phishing and Cobalt Strike against Northwind Health Systems with CVE-2025-12345 from 198.51.100.42.";
    store.saveCapture({
      id: "cap_capture_only_stix",
      tenantId: "tenant_a",
      sourceId: "src_rss",
      taskId: plan?.tasks[0]?.id,
      url: "https://example.test/capture-only",
      canonicalUrl: "https://example.test/capture-only",
      collectedAt: "2026-05-24T00:00:00.000Z",
      contentHash: hashContent(rawText),
      normalizedTextHash: hashContent(rawText.toLowerCase()),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body: rawText,
      metadata: { title: "Capture-only APT29 report", runId: run.id },
      sensitive: false,
      sensitivityFlags: ["public"]
    });

    const exportResponse = await body(await handleApiRequest(api("/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: run.id, tenantId: "tenant_a", generatedAt: "2026-05-24T00:05:00.000Z" })
    }), options));
    const objects = (exportResponse.bundle as { objects: Array<{ type: string; name?: string; x_ti_provenance?: Array<{ captureId: string }> }> }).objects;

    expect(objects.some((object) => object.type === "indicator" && object.name === "ipv4:198.51.100.42")).toBe(true);
    expect(objects.some((object) => object.type === "intrusion-set" && object.name === "APT29")).toBe(true);
    expect(objects.some((object) => object.type === "report")).toBe(true);
    expect(objects.every((object) =>
      object.x_ti_provenance ? object.x_ti_provenance.every((item) => item.captureId === "cap_capture_only_stix") : true
    )).toBe(true);
  });
});
