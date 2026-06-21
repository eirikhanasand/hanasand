import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { source } from "./helpers/frontierFixtures.ts";

describe("focused frontier fairness", () => {
  test("fairly rotates across tenants requests and sources", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 4 });
    for (const suffix of ["one", "two"]) frontier.add({ source: { ...source, id: `src_apt_${suffix}` }, tenantId: "tenant_apt", intelRequestId: "request_apt29", url: `https://apt.example.test/${suffix}`, discoveredAt: now.toISOString(), anchorText: "APT29 ransomware campaign exploit", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    frontier.add({ source: { ...source, id: "src_feed" }, tenantId: "tenant_feeds", intelRequestId: "request_feed", url: "https://feed.example.test/daily", discoveredAt: now.toISOString(), anchorText: "APT29 ransomware campaign exploit", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    expect(frontier.next(now)?.tenantId).toBe("tenant_apt");
    expect(frontier.next(now)?.tenantId).toBe("tenant_feeds");
  });

  test("keeps public live searches from starving analyst probe and retention work", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 8 });
    for (const [id, budgetClass, fairnessKey] of [["public_live", "interactive_live_search", "tenant:public"], ["analyst", "analyst_deep_dive", "tenant:analyst"], ["probe", "source_health_probe", "tenant:ops"], ["retention", "background_refresh", "retention:replay"]] as const) {
      frontier.add({ source: { ...source, id: `src_${id}` }, tenantId: `tenant_${id}`, intelRequestId: `request_${id}`, url: `https://fairness.example.test/${id}`, discoveredAt: now.toISOString(), anchorText: "APT29 ransomware campaign exploit", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8, fairnessKey });
      const queued = frontier.snapshot().find((item) => item.sourceId === `src_${id}`);
      if (queued) queued.task.planning = { budgetClass, decision: "selected", reason: "test work-class fairness", queryTerms: ["APT29"], freshness: 0.8, sourceTrust: 0.9, selectedFor: budgetClass === "source_health_probe" ? "probe" : budgetClass === "background_refresh" ? "background" : "interactive" };
    }
    expect(frontier.next(now)?.sourceId).toBe("src_retention");
    expect(frontier.next(now)?.sourceId).toBe("src_analyst");
    expect(frontier.next(now)?.sourceId).toBe("src_probe");
    expect(frontier.next(now)?.sourceId).toBe("src_public_live");
  });
});
