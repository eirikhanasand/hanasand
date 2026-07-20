import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { api, body, source } from "./helpers/apiSourceFixtures.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

describe("structured intelligence API boundary", () => {
  test("keeps reads tenant-exact and removes restricted source, capture, and alert material", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_global", name: "Global feed" }));
    store.saveSource({ ...source({ id: "src_tenant_a", name: "Tenant A feed" }), tenantId: "tenant_a" });
    store.saveSource({ ...source({ id: "src_tenant_b", name: "Tenant B feed" }), tenantId: "tenant_b" });
    store.saveSource({ ...source({
      id: "src_restricted_a",
      name: "Restricted metadata",
      type: "tor_metadata",
      accessMethod: "approved_proxy",
      url: `http://${"a".repeat(56)}.onion/?token=source-secret`,
      governance: { approvalState: "approved", metadataOnly: true, policyVersion: "collection-policy:v1" },
      metadata: { captureMode: "metadata_only", token: "source-secret" }
    }), tenantId: "tenant_a" });

    store.saveCapture(fixtureCapture({ id: "cap_global", sourceId: "src_global" }));
    store.saveCapture(fixtureCapture({ id: "cap_tenant_b", tenantId: "tenant_b", sourceId: "src_tenant_b" }));
    store.saveCapture(fixtureCapture({
      id: "cap_restricted_a",
      tenantId: "tenant_a",
      sourceId: "src_restricted_a",
      url: `http://${"a".repeat(56)}.onion/post?token=capture-secret`,
      body: "stolen row that must never leave storage",
      sensitive: true,
      storageKind: "metadata_only",
      metadata: { adapter: "darknet_metadata", captureMode: "metadata_only", token: "capture-secret", leakSite: { actorName: "Akira", victimName: "Example Corp" } }
    }));
    store.saveExtractedEntity({ id: "entity_restricted_secret", tenantId: "tenant_a", sourceId: "src_restricted_a", captureId: "cap_restricted_a", type: "dataset", value: "secret dataset field", confidence: 0.99 });
    store.saveIntelligenceClaim({ id: "claim_restricted_secret", tenantId: "tenant_a", sourceIds: ["src_restricted_a"], captureIds: ["cap_restricted_a"], claimType: "dataset", value: { dataset: "secret claim value" }, summary: "secret claim summary", confidence: 0.99, reviewState: "confirmed", corroborationState: "corroborated" });
    store.saveDwmAlert({
      id: "alert_tenant_a",
      tenantId: "tenant_a",
      incidentId: "incident_a",
      actor: "Akira",
      company: "Example Corp",
      claimSummary: "Public metadata claim",
      severity: "high",
      confidence: 86,
      reviewState: "needs_review",
      deliveryState: "pending_review",
      firstSeenAt: "2026-07-20T10:00:00.000Z",
      lastSeenAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-20T10:00:00.000Z",
      webhookUrl: "https://hooks.example.test/private-token",
      rawPayload: "alert-secret",
      evidence: [{ sourceId: "src_restricted_a", captureId: "cap_restricted_a", captureMode: "metadata_only", excerpt: "unsafe excerpt" }]
    });
    store.saveDwmAlert({ id: "alert_tenant_b", tenantId: "tenant_b", severity: "low", confidence: 10, reviewState: "unreviewed", deliveryState: "pending_review", firstSeenAt: "2026-07-20T10:00:00.000Z", lastSeenAt: "2026-07-20T10:00:00.000Z", updatedAt: "2026-07-20T10:00:00.000Z" });
    const options = { store, frontier: new FocusedFrontier() };

    const global = await body(await handleApiRequest(api("/v1/intel/sources"), options));
    expect((global.sources as any[]).map((record) => record.id)).toEqual(["src_global"]);

    const sources = await body(await handleApiRequest(api("/v1/intel/sources", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect((sources.sources as any[]).map((record) => record.id)).toEqual(["src_tenant_a", "src_restricted_a"]);
    const restrictedSource = (sources.sources as any[]).find((record) => record.id === "src_restricted_a");
    expect(restrictedSource).toMatchObject({ locatorRedacted: true, operatingMode: { metadataOnly: true } });
    expect("url" in restrictedSource).toBe(false);

    const captures = await body(await handleApiRequest(api("/v1/intel/captures?includeBody=true", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect(captures).toMatchObject({ total: 1, captures: [{ id: "cap_restricted_a", bodyRedacted: true, locatorRedacted: true }] });
    expect("url" in (captures.captures as any[])[0]).toBe(false);
    expect("body" in (captures.captures as any[])[0]).toBe(false);

    const alerts = await body(await handleApiRequest(api("/v1/intel/alerts", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect(alerts).toMatchObject({ total: 1, alerts: [{ id: "alert_tenant_a", confidence: 0.86, evidence: { captureIds: ["cap_restricted_a"], sourceIds: ["src_restricted_a"], metadataOnly: true } }] });

    const search = await body(await handleApiRequest(api("/v1/intel/search?q=Example%20Corp", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect(search).toMatchObject({ status: "partial", confidence: 0.35, actionability: { shouldAlert: false }, evidenceAssessment: { metadataOnly: true } });
    expect(search.claims).toEqual([]);
    expect((search.rows as any[])[0]).toMatchObject({ actor: "Akira", victimName: "Example Corp", metadataOnly: true });

    const legacySources = await body(await handleApiRequest(api("/v1/sources?limit=1", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect(legacySources).toMatchObject({ total: 2, nextCursor: "1" });
    const serialized = JSON.stringify({ sources, captures, alerts, search, legacySources });
    for (const forbidden of [".onion", "source-secret", "capture-secret", "stolen row", "private-token", "alert-secret", "unsafe excerpt", "secret dataset field", "secret claim value", "secret claim summary"]) expect(serialized).not.toContain(forbidden);

    const mismatch = await handleApiRequest(api("/v1/intel/entities?tenantId=tenant_b", { headers: { "x-tenant-id": "tenant_a" } }), options);
    expect(mismatch.status).toBe(403);
  });

  test("rejects cross-tenant validation and review writes", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource({ ...source({ id: "src_tenant_b" }), tenantId: "tenant_b" });
    const capture = store.saveCapture(fixtureCapture({ id: "cap_tenant_b", tenantId: "tenant_b", sourceId: "src_tenant_b" }));
    store.saveIntelligenceClaim({ id: "claim_tenant_b", tenantId: "tenant_b", reviewState: "unreviewed" });
    const options = { store, frontier: new FocusedFrontier() };

    const validation = await handleApiRequest(api("/v1/intel/validation-records", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_a" },
      body: JSON.stringify({ captureId: capture.id, validationType: "public_confirmation", status: "supported", referenceUrl: "https://example.test/report" })
    }), options);
    expect(validation.status).toBe(400);

    const review = await handleApiRequest(api("/v1/intel/claims/claim_tenant_b/reviews", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "tenant_a", "x-actor-id": "analyst_a" },
      body: JSON.stringify({ action: "confirm", reason: "Confirmed against a public report." })
    }), options);
    expect(review.status).toBe(404);
    expect(store.listValidationRecords()).toHaveLength(0);
    expect(store.listClaimReviews()).toHaveLength(0);
  });

  test("scopes search, evidence reports, and run results to the requested tenant", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource({ ...source({ id: "src_a" }), tenantId: "tenant_a" });
    store.saveSource({ ...source({ id: "src_b" }), tenantId: "tenant_b" });
    store.saveRun({ id: "run_a", tenantId: "tenant_a", status: "completed", startedAt: "2026-07-20T10:00:00.000Z", updatedAt: "2026-07-20T10:01:00.000Z" });
    store.saveRun({ id: "run_b", tenantId: "tenant_b", status: "completed", startedAt: "2026-07-20T10:00:00.000Z", updatedAt: "2026-07-20T10:01:00.000Z" });
    store.saveCapture(fixtureCapture({ id: "cap_a", tenantId: "tenant_a", sourceId: "src_a", body: "APT29 compromised Alpha Health.", metadata: { exposureClaim: true, query: "APT29", normalizedQuery: "apt29", runId: "run_a" } }));
    store.saveCapture(fixtureCapture({ id: "cap_b", tenantId: "tenant_b", sourceId: "src_b", body: "APT29 compromised Beta Bank.", metadata: { exposureClaim: true, query: "APT29", normalizedQuery: "apt29", runId: "run_b" } }));
    store.saveIncident({ id: "incident_a", tenantId: "tenant_a", sourceId: "src_a", captureId: "cap_a", title: "Alpha incident", summary: "APT29 at Alpha", firstSeenAt: "2026-07-20T10:00:00.000Z", confidence: 0.8 });
    store.saveIncident({ id: "incident_b", tenantId: "tenant_b", sourceId: "src_b", captureId: "cap_b", title: "Beta incident", summary: "APT29 at Beta", firstSeenAt: "2026-07-20T10:00:00.000Z", confidence: 0.8 });
    store.saveExtractedEntity({ id: "entity_a", tenantId: "tenant_a", sourceId: "src_a", captureId: "cap_a", type: "actor", value: "APT29", confidence: 0.98 });
    const options = { store, frontier: new FocusedFrontier() };

    const search = await body(await handleApiRequest(api("/v1/intel/search?q=APT29", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect((search.rows as any[]).map((row) => row.id)).toEqual(["cap_a"]);
    expect(search).toMatchObject({ status: "partial", confidence: 0.69, actionability: { shouldAlert: false }, quality: { status: "partial", canPromoteToReady: false } });
    expect(JSON.stringify(search)).not.toContain("Beta Bank");

    const evidence = await body(await handleApiRequest(api("/v1/evidence/trust-ledger?q=APT29", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect(evidence.trustLedger).toMatchObject({ tenantId: "tenant_a", counts: { claims: 1 }, claims: [{ claimId: "incident_a", captureId: "cap_a" }] });

    const results = await body(await handleApiRequest(api("/v1/intel/runs/run_a/results", { headers: { "x-tenant-id": "tenant_a" } }), options));
    expect(results).toMatchObject({
      runId: "run_a",
      results: {
        captures: { items: [{ id: "cap_a", bodyRedacted: true }], total: 1 },
        incidents: { items: [{ id: "incident_a" }], total: 1 }
      }
    });
    expect(JSON.stringify(results)).not.toContain("APT29 compromised Alpha Health");
    expect((await handleApiRequest(api("/v1/intel/runs/run_a/results", { headers: { "x-tenant-id": "tenant_b" } }), options)).status).toBe(404);
  });
});
