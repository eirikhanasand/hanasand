import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { source } from "./helpers/plannerFixtures.ts";

describe("planner backpressure and continuous scheduling", () => {
  test("reports queue, backoff, activation, and budget backpressure states", () => {
    const now = "2026-05-24T00:00:00.000Z";
    const frontier = new FocusedFrontier({ now: () => new Date(now) });
    for (let index = 0; index < 3; index += 1) frontier.add({ source: source({ id: `src_pressure_${index}` }), url: `https://example.test/apt29-${index}`, discoveredAt: now, anchorText: "APT29 ransomware campaign exploit", parentRelevance: 0.9, novelty: 0.8, freshness: 0.8 });
    const pressured = createLiveSearchPlan({ request: { query: "Turla", entityType: "actor", tenantId: "tenant_live", createdAt: now }, sources: [source({ id: "rss_turla", type: "rss", tags: ["turla"] })], frontier, queuePressureLimit: 2 });
    expect(pressured.dto.backpressureState).toBe("deferred_by_queue_pressure");
    const backoff = createLiveSearchPlan({ request: { query: "Akira", entityType: "actor", tenantId: "tenant_live", createdAt: now }, sources: [source({ id: "rss_backoff", type: "rss", tags: ["akira"], crawlState: { backoffUntil: "2026-05-24T00:20:00.000Z", retryCount: 1 } })] });
    expect(backoff.dto.backpressureState).toBe("deferred_by_source_backoff");
    const activation = createLiveSearchPlan({ request: { query: "Volt Typhoon", entityType: "actor", tenantId: "tenant_live", createdAt: now }, sources: [source({ id: "telegram_candidate", type: "telegram_public", status: "needs_review", tags: ["volt typhoon"] })], queryDemand: { "volt typhoon": 7 } });
    expect(activation.dto.backpressureState).toBe("needs_source_activation");
    expect(activation.dto.recommendedSourceActivations[0]).toMatchObject({ sourceId: "telegram_candidate", coverageGap: "public_chat", demandCount: 7 });
    const budget = createLiveSearchPlan({ request: { query: "Akira", entityType: "actor", tenantId: "tenant_live", maxTasks: 0, createdAt: now }, sources: [source({ id: "rss_budget", type: "rss", tags: ["akira"] })] });
    expect(budget.dto.backpressureState).toBe("deferred_by_budget");
  });

  test("does not let delayed sources exhaust the live task budget", () => {
    const now = "2026-05-24T00:00:00.000Z";
    const delayed = Array.from({ length: 10 }, (_, index) => source({ id: `delayed_${index}`, type: "api", trustScore: 1, tags: ["apt29"], crawlState: { nextEligibleAt: "2026-05-24T01:00:00.000Z", retryCount: 0 } }));
    const available = source({ id: "available", type: "rss", trustScore: 0.5, tags: ["apt29"] });
    const { plan, dto } = createLiveSearchPlan({ request: { query: "APT29", entityType: "actor", tenantId: "tenant_live", createdAt: now }, sources: [...delayed, available] });
    expect(plan.tasks.some((task) => task.sourceId === "available" && !task.availableAt)).toBe(true);
    expect(plan.tasks.every((task) => task.maxRetries === 0)).toBe(true);
    expect(dto.backpressureState).toBe("accepted");
  });

  test("does not schedule a fixed-query source for another actor", () => {
    const { plan } = createLiveSearchPlan({ request: { query: "APT29", entityType: "actor", tenantId: "tenant_live", createdAt: "2026-05-24T00:00:00.000Z" }, sources: [
      source({ id: "gdelt_8base", type: "api", trustScore: 1, metadata: { queryTerm: "8Base" } }),
      source({ id: "gdelt_apt29", type: "api", trustScore: 0.5, metadata: { queryTerm: "APT29" } }),
    ] });
    expect(plan.tasks.map((task) => task.sourceId)).toEqual(["gdelt_apt29"]);
  });

  test("builds continuous actor and CVE scheduling fixtures with cost envelopes", () => {
    const now = "2026-05-24T04:00:00.000Z";
    const sources = [
      source({ id: "rss_apt29", type: "rss", tags: ["apt29", "nobelium"] }),
      source({ id: "api_scattered", type: "api", tags: ["scattered spider"] }),
      source({ id: "web_volt", type: "static_web", tags: ["volt typhoon"] }),
      source({ id: "rss_turla_backoff", type: "rss", tags: ["turla"], crawlState: { backoffUntil: "2026-05-24T04:20:00.000Z", retryCount: 1 } }),
      source({ id: "telegram_akira_pending", type: "telegram_public", status: "needs_review", tags: ["akira"] }),
      source({ id: "rss_muddy", type: "rss", tags: ["muddywater"] }),
      source({ id: "rss_unknown", type: "rss", tags: ["threat actor"] }),
      source({ id: "rss_cve", type: "rss", tags: ["cve-2024-3094"] }),
      source({ id: "tor_approved", type: "tor_metadata", accessMethod: "approved_proxy", risk: "high", tags: ["apt29"], governance: { approvalState: "approved", approvalRequired: true, metadataOnly: true, approvedAt: now, approvedBy: "reviewer" } })
    ];
    const fixtures: Array<{ query: string; entityType: "actor" | "cve"; includeDarknetMetadata?: boolean }> = ["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", "MuddyWater", "Unknown Actor"].map((query) => ({ query, entityType: "actor", includeDarknetMetadata: query === "APT29" }));
    fixtures.push({ query: "CVE-2024-3094", entityType: "cve" });
    const plans = fixtures.map((fixture) => createLiveSearchPlan({ request: { ...fixture, tenantId: "tenant_continuous", createdAt: now, includeTelegram: true, maxTasks: fixture.query === "APT29" ? 12 : 6 }, sources, queryDemand: { [fixture.query.toLowerCase()]: 3 } }));
    expect(plans.every(({ plan }) => plan.tasks.every((task) => task.tenantId === "tenant_continuous"))).toBe(true);
    expect(plans.every(({ plan }) => plan.tasks.every((task) => task.planning?.freshnessTargetSeconds && task.planning.maxCost && task.planning.safetyEnvelope))).toBe(true);
    expect(plans.find(({ plan }) => plan.request.query === "APT29")?.plan.tasks.some((task) => task.sourceId === "tor_approved" && task.planning?.safetyEnvelope?.metadataOnlyRestricted)).toBe(true);
    expect(plans.find(({ plan }) => plan.request.query === "Turla")?.dto.coverageGaps).toContain("freshness_waiting_for_backoff");
    expect(plans.find(({ plan }) => plan.request.query === "Akira")?.dto.recommendedSourceActivations.some((item) => item.requiredAction === "approve")).toBe(true);
    expect(plans.find(({ plan }) => plan.request.query === "CVE-2024-3094")?.plan.tasks.some((task) => task.sourceId === "rss_cve")).toBe(true);
    expect(plans.some(({ plan }) => (plan.explanations ?? []).some((item) => item.status === "skipped"))).toBe(true);
  });
});
