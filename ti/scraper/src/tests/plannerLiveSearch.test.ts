import { describe, expect, test } from "bun:test";
import { createCollectionPlan, createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import type { CollectionRun } from "../types.ts";
import { source } from "./helpers/plannerFixtures.ts";

const actorIdentities = [{
  id: "mitre-attack-enterprise:G0016",
  catalogId: "mitre-attack-enterprise",
  externalId: "G0016",
  canonicalName: "APT29",
  normalizedCanonicalName: "apt29",
  associatedNames: ["Nobelium", "Cozy Bear", "Midnight Blizzard"],
  status: "current"
}] as any[];

describe("live search planner", () => {
  test("plans random actor queries and returns DTO fields", () => {
    for (const query of ["Scattered Spider", "Akira", "Volt Typhoon", "Turla"]) {
      const { dto } = createLiveSearchPlan({ request: { query, entityType: "actor", tenantId: "tenant_live" }, sources: [source({ id: `api_${query}`, type: "api", trustScore: 0.95, tags: [query.toLowerCase()] }), source({ id: `rss_${query}`, type: "rss", trustScore: 0.85 })] });
      expect(dto.mode).toBe("interactive_live_search");
      expect(dto.backpressureState).toBe("accepted");
      expect(dto.reuseKey).toMatch(/^live-reuse_/);
      expect(dto.queuedTaskCount).toBeGreaterThan(0);
      expect(dto.nextPollSeconds).toBeGreaterThan(0);
      expect(dto.zeroTaskReason).toBe("none");
      expect(dto.queryTerms.map((term) => term.toLowerCase())).toContain(query.toLowerCase());
    }
  });

  test("reports zero-task reasons and active-run attachment", () => {
    const activePlan = createCollectionPlan({ id: "request_active", query: "Akira", entityType: "actor", tenantId: "tenant_live", createdAt: "2026-05-24T00:00:00.000Z" }, [source({ id: "rss_active", type: "rss" })]);
    const activeRun: CollectionRun = { id: "run_active", tenantId: "tenant_live", planId: activePlan.id, requestId: activePlan.request.id, status: "running", createdAt: "2026-05-24T00:00:00.000Z", updatedAt: "2026-05-24T00:00:00.000Z", taskCount: activePlan.tasks.length, reviewTaskCount: activePlan.reviewRequired.length, rejectedSourceCount: activePlan.rejected.length, captureCount: 0, incidentCount: 0 };
    const duplicate = createLiveSearchPlan({ request: { query: "Akira", entityType: "actor", tenantId: "tenant_live" }, sources: [source({ id: "rss_active", type: "rss" })], activeRuns: [activeRun], activePlans: [{ id: "unrelated_workflow_record" }, activePlan] });
    expect(duplicate.dto.attachedToActiveRun).toBe(true);
    expect(duplicate.dto.backpressureState).toBe("attached_to_active_run");
    expect(duplicate.dto.zeroTaskReason).toBe("duplicate_run_already_active");
    expect(createLiveSearchPlan({ request: { query: "Turla", entityType: "actor" }, sources: [] }).dto.zeroTaskReason).toBe("no_approved_sources");
    expect(createLiveSearchPlan({ request: { query: "apt", entityType: "free_text" }, sources: [] }).dto.zeroTaskReason).toBe("query_too_broad");

    const blocked = createLiveSearchPlan({ request: { query: "Volt Typhoon", entityType: "actor", includeDarknetMetadata: true }, sources: [{ ...source({ id: "restricted_only", type: "tor_metadata", accessMethod: "approved_proxy", risk: "restricted", trustScore: 1 }), approvedAt: undefined, approvedBy: undefined, governance: undefined }] });
    expect(blocked.dto.zeroTaskReason).toBe("none");
    expect(blocked.dto.backpressureState).toBe("needs_source_activation");
    expect(blocked.dto.reviewTaskCount).toBe(1);
    expect(blocked.dto.blockedSourceCount).toBe(1);
    expect(blocked.plan.rejected).toEqual([]);
    expect(blocked.plan.reviewRequired[0]?.reason).toContain("metadata-only review");
    expect(blocked.dto.recommendedSourceActivations[0]?.sourceId).toBe("restricted_only");
  });

  test("reuse keys normalize aliases, tenant, source scope, risk scope, and freshness window", () => {
    const sources = [source({ id: "rss", type: "rss", risk: "low" }), source({ id: "telegram", type: "telegram_public", risk: "medium" })];
    const apt29 = createLiveSearchPlan({ request: { query: "APT29", entityType: "actor", tenantId: "tenant_live", includeTelegram: true, createdAt: "2026-05-24T00:05:00.000Z" }, actorIdentities, sources });
    const nobelium = createLiveSearchPlan({ request: { query: "Nobelium", entityType: "actor", tenantId: "tenant_live", includeTelegram: true, createdAt: "2026-05-24T00:55:00.000Z" }, actorIdentities, sources });
    const nextWindow = createLiveSearchPlan({ request: { query: "Nobelium", entityType: "actor", tenantId: "tenant_live", includeTelegram: true, createdAt: "2026-05-24T01:00:00.000Z" }, actorIdentities, sources });
    expect(apt29.dto.reuseKey).toBe(nobelium.dto.reuseKey);
    expect(nextWindow.dto.reuseKey).not.toBe(apt29.dto.reuseKey);

    const activeRun: CollectionRun = { id: "run_reuse", tenantId: "tenant_live", planId: apt29.plan.id, requestId: "different_request_id", requestHash: apt29.dto.reuseKey, status: "running", createdAt: "2026-05-24T00:05:00.000Z", updatedAt: "2026-05-24T00:05:00.000Z", taskCount: apt29.plan.tasks.length, reviewTaskCount: apt29.plan.reviewRequired.length, rejectedSourceCount: apt29.plan.rejected.length, captureCount: 0, incidentCount: 0 };
    const attached = createLiveSearchPlan({ request: { query: "Nobelium", entityType: "actor", tenantId: "tenant_live", includeTelegram: true, createdAt: "2026-05-24T00:12:00.000Z" }, actorIdentities, sources, activeRuns: [activeRun] });
    expect(attached.dto.activeRunId).toBe("run_reuse");
    expect(attached.dto.backpressureState).toBe("attached_to_active_run");
  });
});
