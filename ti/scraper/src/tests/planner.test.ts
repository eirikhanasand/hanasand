import { describe, expect, test } from "bun:test";
import { createCollectionPlan, createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import type { CollectionRun, SourceRecord } from "../types.ts";

function source(input: Partial<SourceRecord>): SourceRecord {
  const risk = input.risk ?? "low";
  const requiresApproval = risk !== "low" || input.type?.endsWith("_metadata");
  const approvedAt = input.approvedAt ?? (requiresApproval ? new Date(0).toISOString() : undefined);
  const approvedBy = input.approvedBy ?? (requiresApproval ? "analyst_1" : undefined);
  return {
    id: input.id ?? "src",
    name: input.name ?? "Source",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/search?q={query}",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk,
    trustScore: input.trustScore ?? 0.9,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Public fixture.",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    approvedAt,
    approvedBy,
    crawlState: input.crawlState,
    health: input.health,
    lastSeenAt: input.lastSeenAt,
    tags: input.tags,
    metadata: input.metadata,
    governance: input.governance ?? (requiresApproval ? {
      approvalState: "approved",
      approvalRequired: true,
      metadataOnly: Boolean(input.type?.endsWith("_metadata")),
      approvedAt,
      approvedBy,
      riskJustification: "Approved test metadata-only source."
    } : undefined)
  };
}

describe("intelligence planner", () => {
  test("fans an APT29 request out to clear web and approved metadata sources", () => {
    const plan = createCollectionPlan({
      query: "APT29",
      entityType: "actor",
      includeDarknetMetadata: true,
      tenantId: "tenant_global",
      requesterId: "analyst_1",
      priority: "high"
    }, [
      source({ id: "rss", type: "rss" }),
      source({
        id: "tor",
        type: "tor_metadata",
        accessMethod: "approved_proxy",
        risk: "high",
        approvedAt: new Date(0).toISOString(),
        approvedBy: "operator",
        governance: {
          approvalState: "approved",
          approvalRequired: true,
          metadataOnly: true,
          approvedAt: new Date(0).toISOString(),
          approvedBy: "operator",
          policyVersion: "collection-policy:v1"
        }
      }),
      source({ id: "paused", status: "paused" })
    ]);

    expect(plan.tasks.some((task) => task.sourceId === "rss")).toBe(true);
    expect(plan.tasks.some((task) => task.sourceId === "tor")).toBe(true);
    expect(plan.rejected.some((rejected) => rejected.sourceId === "paused")).toBe(true);
    expect(plan.tasks.every((task) => task.intelRequestId === plan.id)).toBe(true);
    expect(plan.tasks.every((task) => task.tenantId === "tenant_global")).toBe(true);
    expect(plan.audit[0]?.action).toBe("intel.plan.created");
  });

  test("excludes darknet metadata unless requested", () => {
    const plan = createCollectionPlan({
      query: "APT29",
      entityType: "actor",
      includeDarknetMetadata: false
    }, [
      source({ id: "rss", type: "rss" }),
      source({
        id: "tor",
        type: "tor_metadata",
        accessMethod: "approved_proxy",
        risk: "high",
        approvedAt: new Date(0).toISOString(),
        approvedBy: "operator",
        governance: {
          approvalState: "approved",
          approvalRequired: true,
          metadataOnly: true,
          approvedAt: new Date(0).toISOString(),
          approvedBy: "operator",
          policyVersion: "collection-policy:v1"
        }
      })
    ]);

    expect(plan.tasks.some((task) => task.sourceId === "rss")).toBe(true);
    expect(plan.tasks.some((task) => task.sourceId === "tor")).toBe(false);
  });

  test("expands APT29 aliases and splits interactive work from background fanout", () => {
    const createdAt = "2026-05-24T00:00:00.000Z";
    const plan = createCollectionPlan({
      query: "APT29",
      entityType: "actor",
      priority: "urgent",
      budgetClass: "interactive_search",
      createdAt,
      tenantId: "tenant_a"
    }, [
      source({ id: "api", type: "api", trustScore: 0.95, tags: ["apt29", "nobelium"] }),
      source({ id: "rss", type: "rss", trustScore: 0.9 }),
      source({ id: "static", type: "static_web", trustScore: 0.85 }),
      source({ id: "pdf", type: "pdf", trustScore: 0.8 }),
      source({ id: "later", type: "rss", trustScore: 0.75 })
    ]);

    expect(plan.queryTerms).toContain("cozy bear");
    expect(plan.queryTerms).toContain("midnight blizzard");
    expect(plan.budget?.class).toBe("interactive_search");
    expect(plan.tasks.length).toBeGreaterThan(4);
    expect(plan.tasks.filter((task) => task.availableAt && task.availableAt > createdAt).length).toBeGreaterThan(0);
    expect(plan.tasks.every((task) => task.maxBytes === plan.budget?.maxBytesPerTask)).toBe(true);
    expect(plan.explanations?.some((explanation) => explanation.status === "delayed")).toBe(true);
  });

  test("uses source freshness and backoff to explain delayed scheduling", () => {
    const createdAt = "2026-05-24T00:00:00.000Z";
    const plan = createCollectionPlan({
      query: "APT29",
      entityType: "actor",
      budgetClass: "analyst_deep_dive",
      createdAt
    }, [
      source({
        id: "fresh",
        type: "rss",
        trustScore: 0.8,
        crawlState: { retryCount: 0, lastCollectedAt: "2026-05-23T23:30:00.000Z" }
      }),
      source({
        id: "backoff",
        type: "api",
        trustScore: 0.95,
        crawlState: { retryCount: 2, backoffUntil: "2026-05-24T00:10:00.000Z" }
      })
    ]);

    expect(plan.tasks[0]?.sourceId).toBe("fresh");
    const backoffTask = plan.tasks.find((task) => task.sourceId === "backoff");
    expect(backoffTask?.availableAt).toBe("2026-05-24T00:10:00.000Z");
    expect(plan.explanations?.some((explanation) => explanation.sourceId === "backoff" && explanation.status === "waiting-for-backoff")).toBe(true);
  });

  test("blocks unapproved restricted sources with planner explanations", () => {
    const plan = createCollectionPlan({
      query: "APT29",
      entityType: "actor",
      includeDarknetMetadata: true,
      budgetClass: "restricted_darknet_metadata_sweep",
      createdAt: "2026-05-24T00:00:00.000Z"
    }, [
      source({ id: "rss", type: "rss" }),
      {
        ...source({ id: "restricted", type: "tor_metadata", accessMethod: "approved_proxy", risk: "restricted" }),
        approvedAt: undefined,
        approvedBy: undefined,
        governance: undefined
      }
    ]);

    expect(plan.tasks.some((task) => task.sourceId === "rss")).toBe(true);
    expect(plan.tasks.some((task) => task.sourceId === "restricted")).toBe(false);
    expect(plan.explanations?.some((explanation) =>
      explanation.sourceId === "restricted"
      && (explanation.status === "blocked-by-policy" || explanation.status === "blocked-by-approval")
    )).toBe(true);
  });

  test("keeps broad actor sweeps bounded under large source load", () => {
    const sources = Array.from({ length: 1_000 }, (_, index) => source({
      id: `src_${index}`,
      type: index % 5 === 0 ? "api" : index % 3 === 0 ? "static_web" : "rss",
      trustScore: 0.4 + (index % 10) / 20,
      tags: index % 7 === 0 ? ["apt29", "midnight blizzard"] : undefined,
      crawlState: index % 11 === 0
        ? { retryCount: 1, backoffUntil: "2026-05-24T00:20:00.000Z" }
        : { retryCount: 0, lastCollectedAt: "2026-05-23T00:00:00.000Z" }
    }));
    sources.unshift({
      ...source({ id: "restricted_unapproved", type: "tor_metadata", accessMethod: "approved_proxy", risk: "restricted", trustScore: 1, tags: ["apt29"] }),
      approvedAt: undefined,
      approvedBy: undefined,
      governance: undefined
    });

    const plan = createCollectionPlan({
      query: "APT29",
      entityType: "actor",
      budgetClass: "broad_daily_sweep",
      includeDarknetMetadata: true,
      createdAt: "2026-05-24T00:00:00.000Z",
      tenantId: "tenant_large"
    }, sources);

    expect(plan.tasks.length + plan.reviewRequired.length).toBeLessThanOrEqual(plan.budget?.maxTasks ?? 0);
    expect(plan.tasks.length).toBeGreaterThan(50);
    expect(plan.queryTerms).toContain("nobelium");
    expect(plan.explanations?.some((explanation) => explanation.status === "waiting-for-backoff")).toBe(true);
    expect(plan.explanations?.some((explanation) => explanation.sourceId === "restricted_unapproved")).toBe(true);
    expect(plan.tasks.every((task) => task.tenantId === "tenant_large")).toBe(true);
  });

  test("live search plans random actor queries and returns Agent 09 DTO fields", () => {
    for (const query of ["Scattered Spider", "Akira", "Volt Typhoon", "Turla"]) {
      const { dto } = createLiveSearchPlan({
        request: {
          query,
          entityType: "actor",
          tenantId: "tenant_live"
        },
        sources: [
          source({ id: `api_${query}`, type: "api", trustScore: 0.95, tags: [query.toLowerCase()] }),
          source({ id: `rss_${query}`, type: "rss", trustScore: 0.85 })
        ]
      });

      expect(dto.mode).toBe("interactive_live_search");
      expect(dto.backpressureState).toBe("accepted");
      expect(dto.reuseKey).toMatch(/^live-reuse_/);
      expect(dto.queuedTaskCount).toBeGreaterThan(0);
      expect(dto.nextPollSeconds).toBeGreaterThan(0);
      expect(dto.zeroTaskReason).toBe("none");
      expect(dto.queryTerms.map((term) => term.toLowerCase())).toContain(query.toLowerCase());
    }
  });

  test("live search reports zero-task reason codes and active-run attachment", () => {
    const activePlan = createCollectionPlan({
      id: "request_active",
      query: "Akira",
      entityType: "actor",
      tenantId: "tenant_live",
      createdAt: "2026-05-24T00:00:00.000Z"
    }, [source({ id: "rss_active", type: "rss" })]);
    const activeRun: CollectionRun = {
      id: "run_active",
      tenantId: "tenant_live",
      planId: activePlan.id,
      requestId: activePlan.request.id,
      status: "running",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z",
      taskCount: activePlan.tasks.length,
      reviewTaskCount: activePlan.reviewRequired.length,
      rejectedSourceCount: activePlan.rejected.length,
      captureCount: 0,
      incidentCount: 0
    };

    const duplicate = createLiveSearchPlan({
      request: { query: "Akira", entityType: "actor", tenantId: "tenant_live" },
      sources: [source({ id: "rss_active", type: "rss" })],
      activeRuns: [activeRun],
      activePlans: [activePlan]
    });
    expect(duplicate.dto.attachedToActiveRun).toBe(true);
    expect(duplicate.dto.backpressureState).toBe("attached_to_active_run");
    expect(duplicate.dto.zeroTaskReason).toBe("duplicate_run_already_active");

    const noSources = createLiveSearchPlan({
      request: { query: "Turla", entityType: "actor" },
      sources: []
    });
    expect(noSources.dto.zeroTaskReason).toBe("no_approved_sources");

    const broad = createLiveSearchPlan({
      request: { query: "apt", entityType: "free_text" },
      sources: []
    });
    expect(broad.dto.zeroTaskReason).toBe("query_too_broad");

    const blocked = createLiveSearchPlan({
      request: { query: "Volt Typhoon", entityType: "actor", includeDarknetMetadata: true },
      sources: [{
        ...source({ id: "restricted_only", type: "tor_metadata", accessMethod: "approved_proxy", risk: "restricted", trustScore: 1 }),
        approvedAt: undefined,
        approvedBy: undefined,
        governance: undefined
      }]
    });
    expect(blocked.dto.zeroTaskReason).toBe("none");
    expect(blocked.dto.backpressureState).toBe("needs_source_activation");
    expect(blocked.dto.reviewTaskCount).toBe(1);
    expect(blocked.dto.blockedSourceCount).toBe(1);
    expect(blocked.plan.rejected).toEqual([]);
    expect(blocked.plan.reviewRequired[0]?.reason).toContain("metadata-only review");
    expect(blocked.dto.recommendedSourceActivations[0]?.sourceId).toBe("restricted_only");
  });

  test("live search reuse keys normalize aliases, tenant, source scope, risk scope, and freshness window", () => {
    const sources = [
      source({ id: "rss", type: "rss", risk: "low" }),
      source({ id: "telegram", type: "telegram_public", risk: "medium" })
    ];

    const apt29 = createLiveSearchPlan({
      request: {
        query: "APT29",
        entityType: "actor",
        tenantId: "tenant_live",
        includeTelegram: true,
        createdAt: "2026-05-24T00:05:00.000Z"
      },
      sources
    });
    const nobelium = createLiveSearchPlan({
      request: {
        query: "Nobelium",
        entityType: "actor",
        tenantId: "tenant_live",
        includeTelegram: true,
        createdAt: "2026-05-24T00:55:00.000Z"
      },
      sources
    });
    const nextWindow = createLiveSearchPlan({
      request: {
        query: "Nobelium",
        entityType: "actor",
        tenantId: "tenant_live",
        includeTelegram: true,
        createdAt: "2026-05-24T01:00:00.000Z"
      },
      sources
    });

    expect(apt29.dto.reuseKey).toBe(nobelium.dto.reuseKey);
    expect(nextWindow.dto.reuseKey).not.toBe(apt29.dto.reuseKey);

    const activeRun: CollectionRun = {
      id: "run_reuse",
      tenantId: "tenant_live",
      planId: apt29.plan.id,
      requestId: "different_request_id",
      requestHash: apt29.dto.reuseKey,
      status: "running",
      createdAt: "2026-05-24T00:05:00.000Z",
      updatedAt: "2026-05-24T00:05:00.000Z",
      taskCount: apt29.plan.tasks.length,
      reviewTaskCount: apt29.plan.reviewRequired.length,
      rejectedSourceCount: apt29.plan.rejected.length,
      captureCount: 0,
      incidentCount: 0
    };
    const attached = createLiveSearchPlan({
      request: {
        query: "Nobelium",
        entityType: "actor",
        tenantId: "tenant_live",
        includeTelegram: true,
        createdAt: "2026-05-24T00:12:00.000Z"
      },
      sources,
      activeRuns: [activeRun]
    });
    expect(attached.dto.activeRunId).toBe("run_reuse");
    expect(attached.dto.backpressureState).toBe("attached_to_active_run");
  });

  test("live search reports queue, backoff, activation, and budget backpressure states", () => {
    const now = "2026-05-24T00:00:00.000Z";
    const frontier = new FocusedFrontier({ now: () => new Date(now) });
    for (let index = 0; index < 3; index += 1) {
      frontier.add({
        source: source({ id: `src_pressure_${index}` }),
        url: `https://example.test/apt29-${index}`,
        discoveredAt: now,
        anchorText: "APT29 ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8
      });
    }

    const pressured = createLiveSearchPlan({
      request: { query: "Turla", entityType: "actor", tenantId: "tenant_live", createdAt: now },
      sources: [source({ id: "rss_turla", type: "rss", tags: ["turla"] })],
      frontier,
      queuePressureLimit: 2
    });
    expect(pressured.dto.backpressureState).toBe("deferred_by_queue_pressure");

    const backoff = createLiveSearchPlan({
      request: { query: "Akira", entityType: "actor", tenantId: "tenant_live", createdAt: now },
      sources: [source({
        id: "rss_backoff",
        type: "rss",
        tags: ["akira"],
        crawlState: { backoffUntil: "2026-05-24T00:20:00.000Z", retryCount: 1 }
      })]
    });
    expect(backoff.dto.backpressureState).toBe("deferred_by_source_backoff");

    const activation = createLiveSearchPlan({
      request: { query: "Volt Typhoon", entityType: "actor", tenantId: "tenant_live", createdAt: now },
      sources: [source({ id: "telegram_candidate", type: "telegram_public", status: "needs_review", tags: ["volt typhoon"] })],
      queryDemand: { "volt typhoon": 7 }
    });
    expect(activation.dto.backpressureState).toBe("needs_source_activation");
    expect(activation.dto.recommendedSourceActivations[0]).toMatchObject({
      sourceId: "telegram_candidate",
      coverageGap: "public_chat",
      demandCount: 7
    });

    const budget = createLiveSearchPlan({
      request: { query: "Akira", entityType: "actor", tenantId: "tenant_live", maxTasks: 0, createdAt: now },
      sources: [source({ id: "rss_budget", type: "rss", tags: ["akira"] })]
    });
    expect(budget.dto.backpressureState).toBe("deferred_by_budget");
  });

  test("builds continuous actor and CVE scheduling fixtures with safety and cost envelopes", () => {
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
    const fixtures = [
      { query: "APT29", entityType: "actor" as const, includeDarknetMetadata: true },
      { query: "Scattered Spider", entityType: "actor" as const },
      { query: "Volt Typhoon", entityType: "actor" as const },
      { query: "Turla", entityType: "actor" as const },
      { query: "Akira", entityType: "actor" as const },
      { query: "MuddyWater", entityType: "actor" as const },
      { query: "Unknown Actor", entityType: "actor" as const },
      { query: "CVE-2024-3094", entityType: "cve" as const }
    ];
    const plans = fixtures.map((fixture) => createLiveSearchPlan({
      request: {
        ...fixture,
        tenantId: "tenant_continuous",
        createdAt: now,
        includeTelegram: true,
        maxTasks: 6
      },
      sources,
      queryDemand: { [fixture.query.toLowerCase()]: 3 }
    }));

    expect(plans.every(({ plan }) => plan.tasks.every((task) => task.tenantId === "tenant_continuous"))).toBe(true);
    expect(plans.every(({ plan }) => plan.tasks.every((task) => task.planning?.freshnessTargetSeconds && task.planning.maxCost && task.planning.safetyEnvelope))).toBe(true);
    expect(plans.find(({ plan }) => plan.request.query === "APT29")?.plan.tasks.some((task) => task.sourceType === "tor_metadata" && task.planning?.safetyEnvelope?.metadataOnlyRestricted)).toBe(true);
    expect(plans.find(({ plan }) => plan.request.query === "Turla")?.dto.coverageGaps).toContain("freshness_waiting_for_backoff");
    expect(plans.find(({ plan }) => plan.request.query === "Akira")?.dto.recommendedSourceActivations.some((item) => item.requiredAction === "approve")).toBe(true);
    expect(plans.find(({ plan }) => plan.request.query === "CVE-2024-3094")?.plan.tasks.some((task) => task.sourceId === "rss_cve")).toBe(true);
    expect(plans.some(({ plan }) => (plan.explanations ?? []).some((item) => item.status === "skipped"))).toBe(true);
  });
});
