import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { hashContent } from "../utils.ts";

function runtime() {
  const store = new InMemoryScraperStore();
  store.saveSource({ id: "src_timeliness", tenantId: "tenant_timeliness", name: "Public actor report", type: "static_html", url: "https://actor.example/reports", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.9, crawlFrequencySeconds: 3600, legalNotes: "Public report", metadata: { sourceFamily: "actor_site" }, createdAt: "2026-07-22T10:00:00.000Z", updatedAt: "2026-07-22T10:00:00.000Z" });
  store.saveCapture({ id: "capture_timeliness", tenantId: "tenant_timeliness", sourceId: "src_timeliness", url: "https://actor.example/reports/northwind", observedAt: "2026-07-22T10:04:00.000Z", publishedAt: "2026-07-22T10:05:00.000Z", collectedAt: "2026-07-22T10:07:00.000Z", processedAt: "2026-07-22T10:07:02.000Z", firstVisibleAt: "2026-07-22T10:07:03.000Z", contentHash: hashContent("BlackCat listed Northwind."), mediaType: "text/html", storageKind: "inline_text", body: "BlackCat listed Northwind.", metadata: {}, sensitive: false });
  store.saveIncident({ id: "incident_timeliness", tenantId: "tenant_timeliness", sourceId: "src_timeliness", captureId: "capture_timeliness", title: "Northwind incident", summary: "BlackCat listed Northwind.", firstSeenAt: "2026-07-22T10:05:00.000Z", confidence: 0.9, actorName: "BlackCat" } as never);
  store.saveTimelinessRecord({ id: "incident_timeliness", tenantId: "tenant_timeliness", sourceId: "src_timeliness", captureId: "capture_timeliness", incidentId: "incident_timeliness", publishedAt: "2026-07-22T10:05:00.000Z", collectedAt: "2026-07-22T10:07:00.000Z", processedAt: "2026-07-22T10:07:02.000Z", firstVisibleAt: "2026-07-22T10:07:03.000Z", reportTimestamps: [] });
  store.saveValidationRecord({ id: "validation_timeliness", tenantId: "tenant_timeliness", captureId: "capture_timeliness", validationType: "source_match", status: "supported", referenceUrl: "https://news.example/northwind", matchedAt: "2026-07-22T10:09:00.000Z", reviewerId: "analyst_2" });
  const options = {
    store,
    frontier: new FocusedFrontier(),
    authApiBase: "http://auth.test/api",
    authFetch: async () => Response.json({ id: "analyst_1", roles: [{ id: "analyst" }] }),
  } as any;
  const call = (path: string, init: RequestInit = {}) => handleApiRequest(new Request(`http://local${path}`, {
    ...init,
    headers: { authorization: "Bearer test", id: "analyst_1", "x-tenant-id": "tenant_timeliness", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  }), options);
  return { store, call };
}

describe("timeliness routes", () => {
  test("requires a valid analyst session", async () => {
    const { call } = runtime();
    const response = await call("/v1/intel/timeliness/workbench", { headers: { authorization: "", id: "" } });
    expect(response?.status).toBe(401);
  });

  test("persists a public report reference and exposes the actionable queue", async () => {
    const { store, call } = runtime();
    const before = await (await call("/v1/intel/timeliness/workbench"))!.json() as Record<string, any>;
    expect(before.summary).toMatchObject({ recordCount: 1, unresolvedReferenceCount: 1, observedCoverage: 1, reviewedCoverage: 1, reportToDeliveredCoverage: 0 });
    expect(before.items[0]).toMatchObject({ stages: { observed: "2026-07-22T10:04:00.000Z", reviewed: "2026-07-22T10:09:00.000Z" }, provenance: { reviewed: { validationId: "validation_timeliness", reviewerId: "analyst_2" } } });

    const rejected = await call("/v1/intel/timeliness/references", { method: "POST", body: JSON.stringify({ recordId: "incident_timeliness", role: "actor", timestamp: "2026-07-22T10:00:00.000Z", referenceUrl: "http://127.0.0.1/private", evidencePath: "article.time[datetime]" }) });
    expect(rejected?.status).toBe(400);
    const unzoned = await call("/v1/intel/timeliness/references", { method: "POST", body: JSON.stringify({ recordId: "incident_timeliness", role: "actor", timestamp: "2026-07-22T10:00:00", referenceUrl: "https://actor.example/reports/northwind", evidencePath: "article.time[datetime]" }) });
    expect(unzoned?.status).toBe(400);

    const payload = { recordId: "incident_timeliness", role: "actor", timestamp: "2026-07-22T10:00:00.000Z", referenceUrl: "https://actor.example/reports/northwind", referenceTitle: "Northwind notice", evidencePath: "article.time[datetime]" };
    const createdResponse = await call("/v1/intel/timeliness/references", { method: "POST", body: JSON.stringify(payload) });
    const created = await createdResponse!.json() as Record<string, any>;
    expect(createdResponse?.status).toBe(201);
    expect(created).toMatchObject({ created: true, reference: { role: "actor", recordedBy: "analyst_1", evidencePath: "article.time[datetime]" }, item: { status: "awaiting_alert", stages: { first_report: "2026-07-22T10:00:00.000Z" } } });
    expect(store.getTimelinessRecord("incident_timeliness").reportTimestamps).toHaveLength(1);

    const duplicateResponse = await call("/v1/intel/timeliness/references", { method: "POST", body: JSON.stringify(payload) });
    expect(duplicateResponse?.status).toBe(200);
    expect(await duplicateResponse!.json()).toMatchObject({ created: false });
    expect(store.getTimelinessRecord("incident_timeliness").reportTimestamps).toHaveLength(1);

    const filtered = await (await call("/v1/intel/timeliness/workbench?status=awaiting_alert&q=blackcat"))!.json() as Record<string, any>;
    expect(filtered.page).toMatchObject({ total: 1, nextCursor: null });
    expect(filtered.items[0]).toMatchObject({ actorName: "BlackCat", sourceFamily: "actor_site" });
    const byCapture = await (await call("/v1/intel/timeliness/workbench?q=capture_timeliness"))!.json() as Record<string, any>;
    expect(byCapture.page.total).toBe(1);
  });
});
