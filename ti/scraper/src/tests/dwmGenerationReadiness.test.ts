import { describe, expect, test } from "bun:test";
import { getDwmAlertGenerationReadiness } from "../api/dwmWorkflowRoutes.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture } from "../types.ts";

const watchlist = {
  id: "watchlist", tenantId: "default", name: "Company", status: "active",
  terms: [{ kind: "domain", value: "acme.com" }],
  createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z"
};
const url = new URL("http://localhost/v1/dwm/alerts/generation-readiness?tenantId=default");

describe("generation readiness evidence loading", () => {
  test.each([
    [],
    [{ ...watchlist, status: "paused" }],
    [{ ...watchlist, tenantId: "another-tenant" }],
    [{ ...watchlist, organizationId: "another-organization" }],
    [{ ...watchlist, terms: [] }],
    [{ ...watchlist, terms: [{ kind: "domain", value: " " }] }]
  ].map(watchlists => ({ watchlists })))("does not read the capture archive without eligible terms: %j", async ({ watchlists }) => {
    const store = new InMemoryScraperStore();
    for (const row of watchlists) store.saveDwmWatchlist(row);
    let queried = false;
    Object.assign(store, { queryDwmEvidence: async (tenantId: string, terms?: string[]) => {
      expect(tenantId).toBe("default");
      if (terms === undefined) throw new Error("Unbounded capture archive read");
      expect(terms).toEqual([]);
      queried = true;
      return { sources: [], captures: [] };
    } });
    const response = await getDwmAlertGenerationReadiness(url, { store, frontier: new FocusedFrontier() });
    expect(response.status).toBe(200);
    expect(queried).toBe(true);
    const body = await response.json() as any;
    expect(body.readiness.counts.captureRefCount).toBe(0);
    expect(body.readiness.readyForCustomerDelivery).toBe(false);
    expect(body.readiness.blockerCodes.length).toBeGreaterThan(0);
  });

  test("still loads complete evidence for active watchlists", async () => {
    const store = new InMemoryScraperStore();
    store.saveDwmWatchlist(watchlist);
    let queried = false;
    Object.assign(store, { queryDwmEvidence: async (tenantId: string, terms?: string[]) => {
      expect(tenantId).toBe("default");
      expect(terms).toBeUndefined();
      queried = true;
      return { sources: [], captures: [{
        id: "matching-capture", sourceId: "source", body: "acme.com was mentioned",
        publishedAt: "2026-09-20T00:00:00.000Z", contentHash: "hash", collectedAt: "2026-09-20T00:00:00.000Z"
      } as RawCapture] };
    } });
    const response = await getDwmAlertGenerationReadiness(url, { store, frontier: new FocusedFrontier() });
    expect(response.status).toBe(200);
    expect(queried).toBe(true);
    const body = await response.json() as any;
    expect(body.readiness.counts.captureRefCount).toBe(1);
    expect(body.readiness.readyForRebuild).toBe(true);
  });
});
