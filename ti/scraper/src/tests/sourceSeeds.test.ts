import { describe, expect, test } from "bun:test";
import {
  buildSafePublicSourcePackInstallPlan,
  buildSourceActivationBatchApiResponse,
  buildSourceCoverageCloseoutApiResponse,
  buildSourceCoveragePlanApiResponse,
  buildSourcePortfolioApiResponse,
  buildSourceRuntimeSlaApiResponse,
  buildSourceActivationReport,
  buildSourceActivationApiResponse,
  buildLiveSearchSourceActivationDto,
  exportSeedBundle,
  explainSourceForQuery,
  importSeedBundle,
  seedDuplicateKey,
  type SeedSourceBundle,
  validateSafePublicStarterPackCoverage,
  validateSeedBundle
} from "../registry/sourceSeeds.ts";
import { buildSourceHealthRollup, sourceHealthRollupToRow, sourceScoreHistoryRow } from "../registry/sourceHealth.ts";
import { buildSourceApplyPlan, buildSourceApplyPlanApiResponse, executeSourceApplyPlanDryRun } from "../registry/sourceApplyPlan.ts";
import { buildSourceCutoverRehearsalReport } from "../registry/sourceCutover.ts";
import { buildSourceRegistryReconciliationReport } from "../registry/sourceReconciliation.ts";
import type { SourceRecord } from "../types.ts";

describe("source seed bundles", () => {
  test("validates the production safe public CTI seed bundle without crawling", async () => {
    for (const path of ["seeds/public_cti_sources.json", "seeds/public_cti_starter_pack.json"]) {
      const bundle = await Bun.file(path).json() as SeedSourceBundle;
      const report = validateSeedBundle(bundle, {
        dryRun: true,
        importedAt: "2026-05-24T00:00:00.000Z"
      });

      expect(report.dryRun).toBe(true);
      expect(report.valid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.duplicates).toHaveLength(0);
      expect(report.accepted.length).toBeGreaterThan(0);
      expect(report.accepted.every((source) => source.status === "candidate")).toBe(true);
      expect(report.activation.approved).toBe(report.accepted.length);
    }
  });

  test("reports duplicates by tenant, type, and canonical URL", () => {
    const source = seedSource("https://Example.test/feed.xml?b=2&a=1#section");
    const bundle: SeedSourceBundle = {
      version: 1,
      name: "duplicates",
      sources: [
        source,
        { ...source, id: "src_duplicate", url: "https://example.test/feed.xml?a=1&b=2" }
      ]
    };

    const report = importSeedBundle(bundle, { dryRun: true });
    expect(report.valid).toBe(false);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]?.key).toBe("global:rss:https://example.test/feed.xml?a=1&b=2");
  });

  test("reports duplicates against existing sources", () => {
    const existing: SourceRecord = {
      ...seedSource("https://example.test/feed.xml"),
      id: "src_existing",
      status: "active",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    };
    const bundle: SeedSourceBundle = {
      version: 1,
      name: "existing-duplicate",
      sources: [seedSource("https://example.test/feed.xml/")]
    };

    const report = validateSeedBundle(bundle, { existingSources: [existing] });
    expect(report.duplicates[0]?.existingSourceId).toBe("src_existing");
    expect(seedDuplicateKey(existing)).toBe(seedDuplicateKey(bundle.sources[0]!));
  });

  test("rejects non-public or high-risk seed sources", () => {
    const bundle: SeedSourceBundle = {
      version: 1,
      name: "unsafe",
      sources: [{
        ...seedSource("http://exampleonion.onion"),
        type: "tor_metadata",
        accessMethod: "approved_proxy",
        risk: "high"
      }]
    };

    const report = validateSeedBundle(bundle);
    expect(report.valid).toBe(false);
    expect(report.errors[0]?.message).toContain("safe public CTI");
  });

  test("reports missing compliance fields and overlapping coverage", () => {
    const missingCatalog = { ...seedSource("https://example.test/no-catalog.xml"), catalog: undefined };
    const missingLegal = { ...seedSource("https://example.test/no-legal.xml"), legalNotes: "" };
    const overlapA = seedSource("https://example.test/a.xml");
    const overlapB = { ...seedSource("https://example.test/b.xml"), id: "src_seed_b" };
    const report = validateSeedBundle({
      version: 1,
      name: "compliance",
      sources: [missingCatalog, missingLegal, overlapA, overlapB]
    });

    expect(report.compliance.missingCatalog).toHaveLength(1);
    expect(report.compliance.missingLegalNotes).toHaveLength(1);
    expect(report.compliance.overlappingCoverage.length).toBeGreaterThan(0);
    expect(report.valid).toBe(false);
  });

  test("reports stale imported and exported sources using freshness targets", () => {
    const stale = {
      ...seedSource("https://example.test/stale.xml"),
      lastSeenAt: "2026-05-20T00:00:00.000Z"
    };
    const report = validateSeedBundle({
      version: 1,
      name: "stale",
      sources: [stale]
    }, {
      importedAt: "2026-05-24T00:00:00.000Z",
      referenceAt: "2026-05-24T00:00:00.000Z"
    });
    const exported = exportSeedBundle(report.accepted, "stale-export", "2026-05-24T00:00:00.000Z");

    expect(report.activation.stale).toBe(1);
    expect(report.compliance.stale[0]).toMatchObject({ sourceName: "Seed Source", freshnessTargetSeconds: 86400 });
    expect(exported.sources[0]?.lastSeenAt).toBe("2026-05-20T00:00:00.000Z");
  });

  test("exports registry sources back to seed bundle shape", () => {
    const importedAt = "2026-05-24T00:00:00.000Z";
    const report = importSeedBundle({
      version: 1,
      name: "exportable",
      sources: [seedSource("https://example.test/feed.xml")]
    }, { importedAt });

    const exported = exportSeedBundle(report.accepted, "roundtrip", importedAt);
    expect(exported.version).toBe(1);
    expect(exported.sources[0]?.legalNotes).toContain("Public");
    expect(exported.sources[0]?.catalog?.approvalScope).toBe("safe_public_auto");
  });

  test("explains source coverage for actor and sector queries", () => {
    const report = importSeedBundle({
      version: 1,
      name: "coverage",
      sources: [seedSource("https://example.test/feed.xml")]
    }, { importedAt: "2026-05-24T00:00:00.000Z" });
    const source = { ...report.accepted[0]!, status: "active" as const };

    const explanation = explainSourceForQuery("APT29 healthcare ransomware Europe", source);
    expect(explanation.status).toBe("active");
    expect(explanation.matchedActors).toContain("APT29");
    expect(explanation.matchedIndustries).toContain("healthcare");
    expect(explanation.score).toBeGreaterThan(0.5);
  });

  test("builds activation summaries for stale, blocked, and adapter-incompatible sources", () => {
    const report = importSeedBundle({
      version: 1,
      name: "activation",
      sources: [seedSource("https://example.test/feed.xml")]
    }, { importedAt: "2026-05-24T00:00:00.000Z" });
    const base = report.accepted[0]!;
    const activation = buildSourceActivationReport("CVE-2024 exploitation", [
      { ...base, id: "active", status: "active" },
      { ...base, id: "blocked", status: "disabled" },
      { ...base, id: "incompatible", type: "static_web", catalog: { ...base.catalog!, adapterCompatibility: ["rss"] } }
    ], "2026-05-24T00:00:00.000Z");

    expect(activation.summary.active).toBe(1);
    expect(activation.summary.blocked_by_policy).toBe(1);
    expect(activation.summary.adapter_incompatible).toBe(1);
  });

  test("scores 100 representative source records across query families", () => {
    const families = [
      ["APT29", "Midnight Blizzard", "vendor-report"],
      ["Scattered Spider", "UNC3944", "identity"],
      ["LockBit", "ransomware", "leak metadata"],
      ["Lazarus", "malware", "financial"],
      ["Sandworm", "critical infrastructure", "Europe"],
      ["CVE", "vulnerability", "exploitation"],
      ["Norway", "critical infrastructure", "national CERT"],
      ["healthcare", "ransomware", "Europe"],
      ["GitHub advisory", "supply chain", "CVE"],
      ["ATT&CK", "TTP", "actor"]
    ];
    const sources: SourceRecord[] = Array.from({ length: 100 }, (_, index) => {
      const family = families[index % families.length]!;
      const input = seedSource(`https://example.test/${index}/feed.xml`);
      const catalog = input.catalog!;
      return {
        ...input,
        id: `src_fixture_${index}`,
        status: index % 5 === 0 ? "approved" : "active",
        createdAt: "2026-05-24T00:00:00.000Z",
        updatedAt: "2026-05-24T00:00:00.000Z",
        catalog: {
          ...catalog,
          canonicalId: `fixture:${index}`,
          coverage: {
            ...catalog.coverage,
            topics: [...catalog.coverage.topics, family[2]],
            actors: family[0] === "CVE" || family[0] === "Norway" || family[0] === "healthcare" || family[0] === "GitHub advisory" || family[0] === "ATT&CK" ? catalog.coverage.actors : [family[0]],
            aliases: [...catalog.coverage.aliases, family[1]],
            industries: [...catalog.coverage.industries, family[0] === "healthcare" ? "healthcare" : "critical infrastructure"],
            regions: [...catalog.coverage.regions, "Europe"],
            countries: [...catalog.coverage.countries, "Norway"],
            queryPatterns: [...catalog.coverage.queryPatterns, family.join(" ")]
          }
        }
      };
    });

    const apt29 = buildSourceActivationReport("APT29 Midnight Blizzard", sources);
    const norway = buildSourceActivationReport("Norway critical infrastructure", sources);
    const cve = buildSourceActivationReport("CVE-2024 exploitation", sources);

    expect(sources).toHaveLength(100);
    expect(apt29.sources.some((source) => source.matchedActors.includes("APT29"))).toBe(true);
    expect(norway.sources.some((source) => source.matchedRegions.includes("Norway"))).toBe(true);
    expect(cve.sources.some((source) => source.matchedTopics.includes("vulnerability"))).toBe(true);
  });

  test("rolls up adapter health signals for source scoring and operations", () => {
    const rollup = buildSourceHealthRollup({ id: "src_health", tenantId: "tenant_global" }, [
      { sourceId: "src_health", checkedAt: "2026-05-24T00:00:00.000Z", success: true, httpStatus: 200, latencyMs: 100, freshnessLagSeconds: 20, changedContent: true },
      { sourceId: "src_health", checkedAt: "2026-05-24T00:01:00.000Z", success: false, httpStatus: 429, latencyMs: 500, parserWarnings: ["rate limited"], policyBlocked: true, adapterFailureCategory: "rate_limit" },
      { sourceId: "src_health", checkedAt: "2026-05-24T00:02:00.000Z", success: false, httpStatus: 500, latencyMs: 300, parserWarnings: ["html parse warning"], duplicate: true, adapterFailureCategory: "server_error" }
    ], "2026-05-24T00:00:00.000Z", "2026-05-24T01:00:00.000Z");

    expect(rollup.checksTotal).toBe(3);
    expect(rollup.httpStatusMix).toMatchObject({ "200": 1, "429": 1, "500": 1 });
    expect(rollup.parserWarningCount).toBe(2);
    expect(rollup.changedContentRate).toBeCloseTo(1 / 3);
    expect(rollup.duplicateRate).toBeCloseTo(1 / 3);
    expect(rollup.policyBlockRate).toBeCloseTo(1 / 3);
    expect(rollup.adapterFailureCategories).toMatchObject({ rate_limit: 1, server_error: 1 });
    expect(rollup.health.status).toBe("degraded");
    expect(rollup.health.consecutiveFailures).toBe(2);
  });

  test("maps source health rollups and score history to migration row shapes", () => {
    const source: SourceRecord = {
      ...seedSource("https://example.test/health.xml"),
      id: "src_health",
      tenantId: "tenant_global",
      status: "active",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z",
      scoring: {
        reliability: 0.8,
        freshness: 0.7,
        relevance: 0.9,
        uniqueness: 0.6,
        parseability: 0.75,
        policyRiskPenalty: 0,
        operatorBoost: 0.05
      }
    };
    const rollup = buildSourceHealthRollup(source, [
      { sourceId: "src_health", checkedAt: "2026-05-24T00:00:00.000Z", success: true, httpStatus: 200, latencyMs: 100, freshnessLagSeconds: 120, changedContent: true },
      { sourceId: "src_health", checkedAt: "2026-05-24T00:01:00.000Z", success: false, httpStatus: 429, latencyMs: 400, parserWarnings: ["rate limited"], policyBlocked: true, adapterFailureCategory: "rate_limit" }
    ], "2026-05-24T00:00:00.000Z", "2026-05-24T01:00:00.000Z");

    const healthRow = sourceHealthRollupToRow(rollup);
    const scoreRow = sourceScoreHistoryRow(source, rollup, "2026-05-24T01:00:00.000Z", "hourly rollup");

    expect(healthRow).toMatchObject({
      source_id: "src_health",
      tenant_id: "tenant_global",
      window_start: "2026-05-24T00:00:00.000Z",
      window_end: "2026-05-24T01:00:00.000Z",
      checks_total: 2,
      successes: 1,
      failures: 1,
      adapter_failure_category: "rate_limit"
    });
    expect(healthRow.parser_confidence).toBe(0.5);
    expect(scoreRow).toMatchObject({
      source_id: "src_health",
      tenant_id: "tenant_global",
      calculated_at: "2026-05-24T01:00:00.000Z",
      reliability: 0.8,
      health_penalty: 0.1,
      reason: "hourly rollup"
    });
    expect(scoreRow.effective_score).toBeGreaterThan(0);
    expect(scoreRow.effective_score).toBeLessThan(1);
    expect(scoreRow.inputs.rollup).toMatchObject({ source_id: "src_health" });
  });

  test("builds live-search activation DTOs for Agent 09 coverage gaps and recommendations", () => {
    const report = importSeedBundle({
      version: 1,
      name: "live-search-activation",
      sources: [
        seedSource("https://example.test/candidate.xml"),
        { ...seedSource("https://example.test/approved.xml"), id: "src_approved" },
        { ...seedSource("https://example.test/stale.xml"), id: "src_stale", lastSeenAt: "2026-05-20T00:00:00.000Z" },
        { ...seedSource("https://example.test/incompatible.xml"), id: "src_incompatible" }
      ]
    }, {
      importedAt: "2026-05-24T00:00:00.000Z"
    });
    const [candidate, approved, stale, incompatible] = report.accepted;
    const dto = buildLiveSearchSourceActivationDto("APT29 healthcare ransomware Europe", [
      { ...candidate!, status: "candidate" },
      { ...approved!, status: "approved" },
      { ...stale!, status: "active" },
      { ...incompatible!, type: "static_web", status: "active", catalog: { ...incompatible!.catalog!, adapterCompatibility: ["rss"] } }
    ], {
      generatedAt: "2026-05-24T00:00:00.000Z",
      demandCount: 3
    });

    expect(dto.coverageGaps.map((gap) => gap.category)).toEqual(expect.arrayContaining([
      "candidate_only",
      "approved_idle",
      "stale",
      "adapter_incompatible"
    ]));
    expect(dto.activationRecommendations[0]?.priority).toBeGreaterThan(dto.activationRecommendations.at(-1)?.priority ?? 0);
    expect(dto.activationRecommendations.some((recommendation) =>
      recommendation.requiredAction === "approve" && recommendation.coverageGap === "source_activation"
    )).toBe(true);
    expect(dto.activationRecommendations.some((recommendation) =>
      recommendation.requiredAction === "enable_adapter" && recommendation.coverageGap === "adapter_compatibility"
    )).toBe(true);
    expect(dto.sourceCoverage.summary.active).toBe(0);
  });

  test("builds /v1 intel search source activation responses with deterministic tenant-scoped gaps", () => {
    const report = importSeedBundle({
      version: 1,
      name: "api-activation",
      sources: [
        { ...seedSource("https://example.test/active.xml"), id: "src_active", tenantId: "tenant_a" },
        { ...seedSource("https://example.test/approved.xml"), id: "src_approved", tenantId: "tenant_a" },
        { ...seedSource("https://example.test/stale.xml"), id: "src_stale", tenantId: "tenant_a", lastSeenAt: "2026-05-20T00:00:00.000Z" },
        { ...seedSource("https://example.test/disabled.xml"), id: "src_disabled", tenantId: "tenant_a" },
        { ...seedSource("https://example.test/duplicate.xml"), id: "src_duplicate_a", tenantId: "tenant_a" },
        { ...seedSource("https://example.test/duplicate.xml"), id: "src_duplicate_b", tenantId: "tenant_a" },
        { ...seedSource("https://example.test/other-tenant.xml"), id: "src_other_tenant", tenantId: "tenant_b" }
      ]
    }, {
      importedAt: "2026-05-24T00:00:00.000Z"
    });
    const [active, approved, stale, disabled, duplicateA, duplicateB, otherTenant] = report.accepted;
    const response = buildSourceActivationApiResponse("APT29 healthcare ransomware Europe", [
      { ...active!, status: "active" },
      { ...approved!, status: "approved" },
      { ...stale!, status: "active" },
      { ...disabled!, status: "disabled", accessMethod: "disabled" },
      { ...duplicateA!, status: "candidate" },
      { ...duplicateB!, status: "candidate" },
      { ...otherTenant!, status: "active" }
    ], {
      tenantId: "tenant_a",
      generatedAt: "2026-05-24T00:00:00.000Z",
      demandCount: 2
    });

    expect(response.tenantId).toBe("tenant_a");
    expect(response.activeCoverage.map((source) => source.sourceId)).toEqual(["src_active"]);
    expect(response.approvedIdleSources.map((source) => source.sourceId)).toEqual(["src_approved"]);
    expect(response.staleSources.map((source) => source.sourceId)).toEqual(["src_stale"]);
    expect(response.policyBlocks.map((source) => source.sourceId)).toEqual(["src_disabled"]);
    expect(response.duplicateSources[0]).toMatchObject({
      sourceIds: ["src_duplicate_a", "src_duplicate_b"]
    });
    expect(response.sourceCoverage.sources.some((source) => source.sourceId === "src_other_tenant")).toBe(false);
    expect(response.underservedReasons.map((reason) => reason.code)).toEqual(expect.arrayContaining([
      "stale_cadence",
      "no_public_channel_coverage",
      "no_approved_restricted_metadata_source",
      "source_disabled"
    ]));
    expect(response.activationRecommendations.every((recommendation) => recommendation.demandCount === 2)).toBe(true);
  });

  test("builds dry-run install contracts for safe public CTI source packs without crawling", () => {
    const bundle: SeedSourceBundle = {
      version: 1,
      name: "install-plan",
      sources: [
        { ...seedSource("https://example.test/install.xml"), id: "src_install" },
        { ...seedSource("https://example.test/duplicate.xml"), id: "src_duplicate_install" }
      ]
    };
    const existing: SourceRecord = {
      ...seedSource("https://example.test/duplicate.xml"),
      id: "src_existing_duplicate",
      tenantId: "tenant_plan",
      status: "active",
      createdAt: "2026-05-24T00:00:00.000Z",
      updatedAt: "2026-05-24T00:00:00.000Z"
    };

    const plan = buildSafePublicSourcePackInstallPlan(bundle, {
      mode: "install",
      tenantId: "tenant_plan",
      existingSources: [existing],
      generatedAt: "2026-05-24T00:00:00.000Z"
    });

    expect(plan.mode).toBe("install");
    expect(plan.dryRun).toBe(true);
    expect(plan.willStartCrawling).toBe(false);
    expect(plan.safeToInstall).toBe(false);
    expect(plan.duplicateSourceCount).toBe(1);
    expect(plan.recommendations[0]).toMatchObject({
      sourceId: "src_install",
      tenantId: "tenant_plan",
      requiredAction: "install_candidate"
    });
    expect(plan.recommendations.some((recommendation) =>
      recommendation.sourceId === "src_duplicate_install" && recommendation.requiredAction === "skip_duplicate"
    )).toBe(true);
  });

  test("validates curated public CTI starter pack coverage for enterprise query families", async () => {
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle;
    const validation = validateSafePublicStarterPackCoverage(bundle, [
      "APT29",
      "Scattered Spider",
      "Volt Typhoon",
      "Turla",
      "Akira ransomware",
      "MuddyWater",
      "FIN7",
      "Lazarus",
      "LockBit",
      "unknown actor",
      "CVE-2024 exploitation"
    ], {
      tenantId: "tenant_global",
      generatedAt: "2026-05-24T00:00:00.000Z"
    });

    expect(validation.valid).toBe(true);
    expect(validation.queries).toHaveLength(11);
    expect(validation.queries.every((query) => query.coverageReady)).toBe(true);
    expect(validation.queries.every((query) => query.candidateCoverageCount > 0)).toBe(true);
    expect(validation.queries.find((query) => query.query === "Volt Typhoon")?.topSourceIds.length).toBeGreaterThan(0);
    expect(validation.queries.find((query) => query.query === "MuddyWater")?.topSourceIds).toContain("src_seed_eset_welivesecurity");
    expect(validation.queries.find((query) => query.query === "FIN7")?.topSourceIds).toEqual(expect.arrayContaining(["src_seed_cisco_talos_blog", "src_seed_dfir_report"]));
  });

  test("builds production actor source coverage plans without unsafe source classes", async () => {
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle;
    const report = validateSeedBundle(bundle, {
      dryRun: true,
      importedAt: "2026-05-24T00:00:00.000Z"
    });
    const safeText = JSON.stringify(bundle.sources.map((source) => ({
      id: source.id,
      type: source.type,
      url: source.url,
      accessMethod: source.accessMethod,
      risk: source.risk,
      approvalScope: source.catalog?.approvalScope
    }))).toLowerCase();
    const activeSources = report.accepted.slice(0, 5).map((source) => ({ ...source, status: "active" as const }));
    const coverage = buildSourceCoveragePlanApiResponse({
      tenantId: "tenant_global",
      generatedAt: "2026-05-24T00:00:00.000Z",
      queries: ["APT29", "Turla", "Scattered Spider", "Akira", "Volt Typhoon", "MuddyWater", "FIN7", "Lazarus", "LockBit", "unknown actor"],
      sources: activeSources,
      sourcePacks: [bundle]
    });

    expect(report.valid).toBe(true);
    expect(bundle.sources.length).toBeGreaterThanOrEqual(20);
    expect(bundle.sources.every((source) =>
      source.risk === "low" &&
      (source.accessMethod === "public_http" || source.accessMethod === "official_api") &&
      ["rss", "static_web", "api", "pdf"].includes(source.type) &&
      source.catalog?.approvalScope === "safe_public_auto" &&
      Boolean(source.legalNotes.trim()) &&
      Boolean(source.catalog.legalBasis.trim()) &&
      Boolean(source.catalog.collection.crawlCadenceSeconds) &&
      source.catalog.adapterCompatibility.includes(source.type)
    )).toBe(true);
    expect(safeText).not.toContain(".onion");
    expect(safeText).not.toContain("private forum");
    expect(safeText).not.toContain("credential");
    expect(safeText).not.toContain("captcha");
    expect(safeText).not.toContain("download");
    expect(coverage).toMatchObject({
      endpoint: "/v1/sources/coverage-plan",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      tenantId: "tenant_global"
    });
    expect(coverage.queries).toHaveLength(10);
    expect(coverage.queries.every((query) => query.safeSourcePackRecommendations.length > 0 || query.activeSources.length > 0)).toBe(true);
    expect(coverage.queries.find((query) => query.query === "MuddyWater")?.safeSourcePackRecommendations.map((source) => source.sourceId)).toEqual(expect.arrayContaining([
      "src_seed_eset_welivesecurity",
      "src_seed_cisco_talos_blog"
    ]));
    expect(coverage.queries.find((query) => query.query === "FIN7")?.safeSourcePackRecommendations.map((source) => source.sourceId)).toEqual(expect.arrayContaining([
      "src_seed_cisco_talos_blog",
      "src_seed_securelist",
      "src_seed_dfir_report"
    ]));
    expect(coverage.queries.find((query) => query.query === "unknown actor")?.missingVerticals.map((vertical) => vertical.vertical)).toEqual(expect.arrayContaining([
      "actor_intelligence",
      "vendor_research",
      "public_channel",
      "restricted_metadata"
    ]));
    expect(coverage.sourcePackInstallPlans[0]).toMatchObject({
      packName: "safe-public-cti-starter-pack",
      safeToInstall: true,
      duplicateSourceCount: 0,
      willStartCrawling: false
    });
    expect(coverage.forbiddenSourceClasses).toEqual(expect.arrayContaining([
      "private forums",
      "credentialed sources",
      "leaked-file endpoints",
      "CAPTCHA bypass",
      "restricted raw payload collection"
    ]));
  });

  test("detects runtime source governance drift and builds dry-run remediation plans", async () => {
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle;
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const base = importSeedBundle({
      version: 1,
      name: "runtime-drift",
      sources: [
        { ...seedSource("https://runtime.example.test/active.xml"), id: "src_runtime_active", tenantId: "tenant_runtime" },
        { ...seedSource("https://runtime.example.test/idle.xml"), id: "src_runtime_idle", tenantId: "tenant_runtime" },
        { ...seedSource("https://runtime.example.test/legal.xml"), id: "src_runtime_legal", tenantId: "tenant_runtime" },
        { ...seedSource("https://runtime.example.test/health.xml"), id: "src_runtime_health", tenantId: "tenant_runtime" },
        { ...seedSource("https://runtime.example.test/adapter.xml"), id: "src_runtime_adapter", tenantId: "tenant_runtime" },
        { ...seedSource("https://runtime.example.test/duplicate.xml"), id: "src_runtime_duplicate_a", tenantId: "tenant_runtime" },
        { ...seedSource("https://runtime.example.test/duplicate.xml"), id: "src_runtime_duplicate_b", tenantId: "tenant_runtime" },
        { ...bundle.sources.find((source) => source.id === "src_seed_mandiant_blog")!, tenantId: "tenant_runtime" }
      ]
    }, { importedAt: generatedAt }).accepted;
    const sources: SourceRecord[] = [
      { ...base[0]!, status: "active", metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt } },
      { ...base[1]!, status: "approved", metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt } },
      { ...base[2]!, status: "active", governance: { approvalRequired: true, approvalState: "expired", metadataOnly: false, approvalExpiresAt: "2026-01-01T00:00:00.000Z" }, metadata: { legalNotesReviewedAt: "2025-01-01T00:00:00.000Z" } },
      { ...base[3]!, status: "active", health: { status: "failing", consecutiveFailures: 6, errorRate: 0.9 }, metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt } },
      { ...base[4]!, status: "active", type: "static_web", catalog: { ...base[4]!.catalog!, adapterCompatibility: ["rss"] }, metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt } },
      { ...base[5]!, status: "active", metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt } },
      { ...base[6]!, status: "active", metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt } },
      { ...base[7]!, status: "active", metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt, sourcePackVersion: "old-pack-version" } }
    ];
    const response = buildSourceCoveragePlanApiResponse({
      tenantId: "tenant_runtime",
      generatedAt,
      queries: ["APT29", "Turla", "Scattered Spider", "Akira", "Volt Typhoon", "MuddyWater", "FIN7", "Lazarus", "LockBit", "random actor", "CVE-2024-1234"],
      sources,
      sourcePacks: [bundle]
    });

    expect(response.queries).toHaveLength(11);
    expect(response.queries.every((query) => query.eligibleSources !== undefined && query.selectedSources !== undefined)).toBe(true);
    expect(response.queries.find((query) => query.query === "APT29")?.selectedSources.length).toBeGreaterThan(0);
    expect(response.queries.find((query) => query.query === "random actor")?.missingApprovedPublicSources.length).toBeGreaterThan(0);
    expect(response.governanceDrift.map((item) => item.code)).toEqual(expect.arrayContaining([
      "approval_expired",
      "approval_not_approved",
      "stale_legal_notes",
      "missing_robots_notes",
      "stale_health",
      "adapter_mismatch",
      "duplicate_canonical_url",
      "source_pack_version_skew"
    ]));
    expect(response.remediationPlans).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "request_legal_review", dryRun: true, willMutate: false, willStartCrawling: false }),
      expect.objectContaining({ action: "quarantine", dryRun: true, willMutate: false, willStartCrawling: false }),
      expect.objectContaining({ action: "reassign_adapter", dryRun: true, willMutate: false, willStartCrawling: false }),
      expect.objectContaining({ action: "retire_duplicate", dryRun: true, willMutate: false, willStartCrawling: false })
    ]));
    expect(response.remediationPlans.every((plan) => plan.willMutate === false && plan.willStartCrawling === false)).toBe(true);
  });

  test("evaluates enforcement-grade source coverage SLOs and excludes unsafe source classes", async () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle;
    const make = (url: string, id: string, publisher: string, trustBasis: "vendor" | "government" | "standards_body", topics: string[]) => ({
      ...seedSource(url),
      id,
      tenantId: "tenant_slo",
      catalog: {
        ...seedSource(url).catalog,
        canonicalId: `public:slo:${id}`,
        publisher: { name: publisher, trustBasis, country: "NO" },
        coverage: {
          ...seedSource(url).catalog.coverage,
          topics: [...new Set([...seedSource(url).catalog.coverage.topics, ...topics])],
          actors: ["APT29", "LockBit"],
          aliases: ["Midnight Blizzard"],
          industries: ["healthcare", "energy"],
          regions: ["Europe", "North America"],
          countries: ["Norway", "United States"],
          queryPatterns: ["APT29", "LockBit ransomware", "CVE-2024-1234", "healthcare", "Norway", "Cobalt Strike"]
        }
      }
    });
    const imported = importSeedBundle({
      version: 1,
      name: "slo-safe-public",
      sources: [
        make("https://slo.example.test/vendor.xml", "src_slo_vendor", "Vendor Research", "vendor", ["malware", "tooling", "Cobalt Strike"]),
        make("https://slo.example.test/gov.xml", "src_slo_gov", "Government Advisories", "government", ["government", "advisory"]),
        make("https://slo.example.test/standards.xml", "src_slo_standards", "Standards Dataset", "standards_body", ["public dataset", "CVE"])
      ]
    }, { importedAt: generatedAt }).accepted;
    const activeSafe = imported.map((source) => ({
      ...source,
      status: "active" as const,
      lastSeenAt: "2026-05-23T18:00:00.000Z",
      crawlState: { retryCount: 0, lastCollectedAt: "2026-05-23T18:00:00.000Z" },
      metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt }
    }));
    const unsafeRestricted: SourceRecord = {
      ...activeSafe[0]!,
      id: "src_slo_restricted",
      name: "Restricted raw source must not satisfy public SLO",
      type: "tor_metadata",
      url: "http://unsafe-slo.onion/posts",
      accessMethod: "approved_proxy",
      risk: "restricted",
      status: "active",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, policyVersion: "collection-policy:v1" },
      catalog: { ...activeSafe[0]!.catalog!, approvalScope: "restricted_protocol", adapterCompatibility: ["tor_metadata"], retentionClass: "restricted_metadata" }
    };
    const unsafeChat: SourceRecord = {
      ...activeSafe[1]!,
      id: "src_slo_chat",
      name: "Public chat source must not satisfy safe-public SLO",
      type: "telegram_public",
      accessMethod: "public_http",
      risk: "medium",
      status: "active",
      catalog: { ...activeSafe[1]!.catalog!, approvalScope: "public_requires_review", adapterCompatibility: ["telegram_public"], retentionClass: "public_chat_text" }
    };
    const unsafeCaptcha: SourceRecord = {
      ...activeSafe[2]!,
      id: "src_slo_captcha",
      name: "CAPTCHA gated source must not satisfy public SLO",
      type: "dynamic_web",
      risk: "medium",
      status: "active",
      metadata: { ...activeSafe[2]!.metadata, requiresCaptcha: true },
      catalog: { ...activeSafe[2]!.catalog!, approvalScope: "public_requires_review", adapterCompatibility: ["dynamic_web"] }
    };
    const passing = buildSourceCoveragePlanApiResponse({
      tenantId: "tenant_slo",
      generatedAt,
      queries: ["APT29", "LockBit ransomware victims", "CVE-2024-1234", "healthcare sector", "Norway targeting", "Cobalt Strike malware tool"],
      sources: activeSafe,
      sourcePacks: [bundle]
    });
    const withUnsafe = buildSourceCoveragePlanApiResponse({
      tenantId: "tenant_slo",
      generatedAt,
      queries: ["APT29"],
      sources: [...activeSafe, unsafeRestricted, unsafeChat, unsafeCaptcha],
      sourcePacks: [bundle]
    });
    const unsafeOnly = buildSourceCoveragePlanApiResponse({
      tenantId: "tenant_slo",
      generatedAt,
      queries: ["APT29"],
      sources: [unsafeRestricted, unsafeChat, unsafeCaptcha],
      sourcePacks: [bundle]
    });

    expect(passing.slo.status).toBe("pass");
    expect(passing.queries.map((query) => query.slo.queryClass)).toEqual([
      "actor",
      "ransomware_victim",
      "cve",
      "sector",
      "country",
      "malware_tool"
    ]);
    expect(passing.queries.every((query) => query.slo.status === "pass")).toBe(true);
    expect(passing.queries.every((query) => query.slo.actuals.activeSafePublicSources >= query.slo.requirements.minActiveSafePublicSources)).toBe(true);
    expect(passing.queries.every((query) => query.slo.actuals.sourceFamilies.length >= query.slo.requirements.minSourceFamilies)).toBe(true);
    expect(withUnsafe.queries[0]!.slo.status).toBe("warning");
    expect(withUnsafe.queries[0]!.slo.actuals.activeSafePublicSources).toBe(3);
    expect(withUnsafe.queries[0]!.slo.actuals.excludedUnsafeSourceIds).toEqual(expect.arrayContaining([
      "src_slo_restricted",
      "src_slo_chat",
      "src_slo_captcha"
    ]));
    expect(unsafeOnly.queries[0]!.coverageState).toBe("needs_review");
    expect(unsafeOnly.queries[0]!.slo.status).toBe("fail");
    expect(unsafeOnly.queries[0]!.slo.actuals.activeSafePublicSources).toBe(0);
    expect(unsafeOnly.queries[0]!.slo.actuals.excludedUnsafeSourceIds).toEqual(expect.arrayContaining([
      "src_slo_restricted",
      "src_slo_chat",
      "src_slo_captcha"
    ]));
    expect(unsafeOnly.queries[0]!.drift.map((item) => item.code)).toEqual(expect.arrayContaining([
      "below_minimum_active_sources",
      "insufficient_source_family_diversity",
      "unsafe_source_class_excluded",
      "missing_approved_public_source_pack"
    ]));
    expect(unsafeOnly.remediationPlans).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "add_source_pack", dryRun: true, willMutate: false, willStartCrawling: false }),
      expect.objectContaining({ action: "quarantine", dryRun: true, willMutate: false, willStartCrawling: false })
    ]));
  });

  test("builds source portfolio operations and dry-run onboarding burn-down reports", async () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle;
    const imported = importSeedBundle({
      version: 1,
      name: "portfolio-current",
      sources: [
        { ...seedSource("https://portfolio.example.test/apt29.xml"), id: "src_portfolio_apt29", tenantId: "tenant_portfolio" },
        { ...seedSource("https://portfolio.example.test/volt.xml"), id: "src_portfolio_volt", tenantId: "tenant_portfolio", catalog: { ...seedSource("https://portfolio.example.test/volt.xml").catalog, coverage: { ...seedSource("https://portfolio.example.test/volt.xml").catalog.coverage, actors: ["Volt Typhoon"], regions: ["Asia Pacific"], countries: ["China"], industries: ["telecommunications"], queryPatterns: ["Volt Typhoon", "telecom sector"] } } },
        { ...seedSource("https://portfolio.example.test/candidate.xml"), id: "src_portfolio_candidate", tenantId: "tenant_portfolio" }
      ]
    }, { importedAt: generatedAt }).accepted;
    const sources: SourceRecord[] = [
      { ...imported[0]!, status: "active", metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt, extractionYield: 0.91 }, crawlState: { retryCount: 0, lastCollectedAt: "2026-05-23T20:00:00.000Z" } },
      { ...imported[1]!, status: "approved", metadata: { legalNotesReviewedAt: "2026-02-01T00:00:00.000Z", robotsReviewedAt: "2026-02-01T00:00:00.000Z", extractionYield: 0.42 } },
      { ...imported[2]!, status: "candidate", metadata: { extractionYield: 0.25 } }
    ];
    const portfolio = buildSourcePortfolioApiResponse({
      tenantId: "tenant_portfolio",
      generatedAt,
      queries: ["APT29", "Volt Typhoon", "LockBit ransomware victims", "CVE-2024-1234", "Norway", "healthcare sector", "random unknown actor"],
      sources,
      sourcePacks: [bundle]
    });

    expect(portfolio).toMatchObject({
      endpoint: "/v1/sources/portfolio",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      tenantId: "tenant_portfolio"
    });
    expect(portfolio.queries).toHaveLength(7);
    expect(portfolio.portfolio.familyGroups.length).toBeGreaterThan(0);
    expect(portfolio.portfolio.legalReviewAgeGroups.map((group) => group.key)).toEqual(expect.arrayContaining(["0-30d", "91-180d", "missing"]));
    expect(portfolio.portfolio.robotsReviewAgeGroups.map((group) => group.key)).toEqual(expect.arrayContaining(["0-30d", "91-180d", "missing"]));
    expect(portfolio.portfolio.reliabilityGroups.map((group) => group.key)).toContain("medium");
    expect(portfolio.portfolio.extractionYieldGroups.map((group) => group.key)).toEqual(expect.arrayContaining(["high", "low"]));
    expect(portfolio.onboardingPlans[0]).toMatchObject({
      packName: "safe-public-cti-starter-pack",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      promotionSafety: { safeToPromote: true }
    });
    expect(portfolio.onboardingPlans[0]!.schedulerCost.estimatedTasksPerDay).toBeGreaterThan(0);
    expect(portfolio.onboardingPlans[0]!.parserCompatibility.every((item) => item.compatible)).toBe(true);
    expect(portfolio.onboardingPlans[0]!.expectedCoverageDelta.some((delta) => delta.query === "Volt Typhoon" && delta.candidateAdditions > 0)).toBe(true);
    expect(portfolio.burnDown.some((item) => item.query === "random unknown actor" && item.sourceAdditions.length > 0)).toBe(true);
    expect(portfolio.promotionPacket).toMatchObject({
      field: "sourcePortfolioId",
      gate: "source_portfolio_ready"
    });
  });

  test("builds dry-run source activation batches for runtime collection readiness", async () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const bundle = await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle;
    const imported = importSeedBundle({
      version: 1,
      name: "activation-batch-current",
      sources: [
        { ...seedSource("https://activation.example.test/idle.xml"), id: "src_activation_idle", tenantId: "tenant_activation" },
        { ...seedSource("https://activation.example.test/parser-gap.xml"), id: "src_activation_parser_gap", tenantId: "tenant_activation" }
      ]
    }, { importedAt: generatedAt }).accepted;
    const sources: SourceRecord[] = [
      { ...imported[0]!, status: "approved", metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt, maxBytes: 750000 } },
      { ...imported[1]!, status: "candidate", catalog: { ...imported[1]!.catalog!, adapterCompatibility: ["api"] }, metadata: { legalNotesReviewedAt: generatedAt, robotsReviewedAt: generatedAt } },
      {
        ...imported[0]!,
        id: "src_activation_restricted",
        name: "Restricted Activation Fixture",
        type: "tor_metadata",
        url: "http://activationrestricted.onion/posts",
        accessMethod: "approved_proxy",
        risk: "restricted",
        status: "approved",
        governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, policyVersion: "collection-policy:v1" },
        catalog: { ...imported[0]!.catalog!, approvalScope: "restricted_protocol", adapterCompatibility: ["tor_metadata"], retentionClass: "restricted_metadata" }
      },
      {
        ...imported[0]!,
        id: "src_activation_chat",
        name: "Public Chat Activation Fixture",
        type: "telegram_public",
        risk: "medium",
        status: "approved",
        catalog: { ...imported[0]!.catalog!, approvalScope: "public_requires_review", adapterCompatibility: ["telegram_public"], retentionClass: "public_chat_text" }
      }
    ];
    const response = buildSourceActivationBatchApiResponse({
      tenantId: "tenant_activation",
      generatedAt,
      queries: ["APT29", "CVE-2024-1234", "LockBit ransomware victims", "Norway", "healthcare sector", "Cobalt Strike malware tool"],
      sources,
      sourcePacks: [bundle]
    });
    const apt29 = response.queries.find((query) => query.query === "APT29")!;

    expect(response).toMatchObject({
      endpoint: "/v1/sources/activation-batches",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      tenantId: "tenant_activation"
    });
    expect(response.queries).toHaveLength(6);
    expect(apt29.sources.some((source) => source.sourceId === "src_activation_idle" && source.decision === "activate")).toBe(true);
    expect(apt29.sources.some((source) => source.sourceId === "src_activation_parser_gap" && source.decision === "defer_parser_gap")).toBe(true);
    expect(apt29.sources.every((source) => source.safePublic && source.retentionClass !== "restricted_metadata")).toBe(true);
    expect(apt29.sources.find((source) => source.sourceId === "src_activation_idle")).toMatchObject({
      adapterOwner: "rss",
      parserOwner: "rss",
      expectedCadenceSeconds: 3600,
      maxBytes: 750000,
      legalReviewState: "current",
      robotsReviewState: "current"
    });
    expect(apt29.operatorDecisionPacket.parserFixesRequired).toContain("src_activation_parser_gap");
    expect(apt29.blockedUnsafeSourceIds).toEqual(expect.arrayContaining(["src_activation_restricted", "src_activation_chat"]));
    expect(response.forbiddenSourceClasses).toEqual(expect.arrayContaining([
      "restricted raw payload collection",
      "private forums",
      "leaked-file endpoints",
      "CAPTCHA bypass",
      "public chat sources"
    ]));
    expect(response.queries.every((query) => query.willMutate === false && query.willStartCrawling === false)).toBe(true);
  });

  test("builds source runtime SLA packets with dry-run breach remediation", async () => {
    const generatedAt = "2026-05-24T12:00:00.000Z";
    const currentReview = "2026-05-24T00:00:00.000Z";
    const staleReview = "2025-12-01T00:00:00.000Z";
    const imported = importSeedBundle({
      version: 1,
      name: "runtime-sla-current",
      sources: [
        { ...seedSource("https://sla.example.test/apt29.xml"), id: "src_sla_apt29", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/volt.xml"), id: "src_sla_volt", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/scattered.xml"), id: "src_sla_scattered", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/akira.xml"), id: "src_sla_akira", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/cve.xml"), id: "src_sla_cve", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/norway.xml"), id: "src_sla_norway", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/parser.xml"), id: "src_sla_parser", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/duplicate.xml"), id: "src_sla_duplicate_a", tenantId: "tenant_runtime_sla" },
        { ...seedSource("https://sla.example.test/duplicate.xml"), id: "src_sla_duplicate_b", tenantId: "tenant_runtime_sla" }
      ]
    }, { importedAt: currentReview }).accepted;
    const byId = Object.fromEntries(imported.map((source) => [source.id, source]));
    const sources: SourceRecord[] = [
      {
        ...byId.src_sla_apt29!,
        status: "active",
        crawlState: { retryCount: 0, lastCollectedAt: "2026-05-24T11:30:00.000Z" },
        health: { status: "healthy", consecutiveFailures: 0, errorRate: 0.02 },
        metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.9, claimYield: 0.7, maxBytes: 500000 }
      },
      {
        ...byId.src_sla_volt!,
        status: "approved",
        tags: [...(byId.src_sla_volt!.tags ?? []), "Volt Typhoon"],
        catalog: {
          ...byId.src_sla_volt!.catalog!,
          coverage: { ...byId.src_sla_volt!.catalog!.coverage, actors: ["Volt Typhoon"], aliases: ["Volt Typhoon"], queryPatterns: ["Volt Typhoon"] }
        },
        crawlState: { retryCount: 0, lastCollectedAt: "2026-05-20T00:00:00.000Z" },
        health: { status: "degraded", consecutiveFailures: 2, errorRate: 0.2 },
        metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.5, claimYield: 0.4 }
      },
      {
        ...byId.src_sla_scattered!,
        status: "active",
        tags: [...(byId.src_sla_scattered!.tags ?? []), "Scattered Spider"],
        catalog: {
          ...byId.src_sla_scattered!.catalog!,
          collection: { ...byId.src_sla_scattered!.catalog!.collection, budgetClass: "low", crawlCadenceSeconds: 900 },
          coverage: { ...byId.src_sla_scattered!.catalog!.coverage, actors: ["Scattered Spider"], aliases: ["Scattered Spider"], queryPatterns: ["Scattered Spider"] }
        },
        crawlState: { retryCount: 0, lastCollectedAt: "2026-05-24T11:45:00.000Z" },
        health: { status: "healthy", consecutiveFailures: 0, errorRate: 0.01 },
        metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.2, claimYield: 0.1 }
      },
      {
        ...byId.src_sla_akira!,
        status: "quarantined",
        tags: [...(byId.src_sla_akira!.tags ?? []), "Akira", "ransomware"],
        catalog: {
          ...byId.src_sla_akira!.catalog!,
          rollback: { lastQuarantineReason: "outage spike", rollbackReason: "last good parser version" },
          coverage: { ...byId.src_sla_akira!.catalog!.coverage, topics: ["ransomware", "victimology"], actors: ["Akira"], queryPatterns: ["Akira ransomware victims"] }
        },
        health: { status: "failing", consecutiveFailures: 7, errorRate: 0.95, lastError: "provider outage" },
        crawlState: { retryCount: 4, lastCollectedAt: "2026-05-18T00:00:00.000Z" },
        metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.1, claimYield: 0.05 }
      },
      {
        ...byId.src_sla_cve!,
        status: "active",
        tags: [...(byId.src_sla_cve!.tags ?? []), "CVE-2024-1234"],
        catalog: {
          ...byId.src_sla_cve!.catalog!,
          coverage: { ...byId.src_sla_cve!.catalog!.coverage, topics: ["CVE", "vulnerability"], queryPatterns: ["CVE-2024-1234"] }
        },
        crawlState: { retryCount: 0, lastCollectedAt: "2026-05-24T11:00:00.000Z" },
        health: { status: "healthy", consecutiveFailures: 0, errorRate: 0.03 },
        metadata: { legalNotesReviewedAt: staleReview, robotsReviewedAt: staleReview, evidenceYield: 0.8, claimYield: 0.6 }
      },
      {
        ...byId.src_sla_norway!,
        status: "active",
        tags: [...(byId.src_sla_norway!.tags ?? []), "Norway", "healthcare"],
        catalog: {
          ...byId.src_sla_norway!.catalog!,
          coverage: { ...byId.src_sla_norway!.catalog!.coverage, countries: ["Norway"], regions: ["Europe"], industries: ["healthcare"], queryPatterns: ["Norway healthcare sector"] }
        },
        crawlState: { retryCount: 0, lastCollectedAt: "2026-05-24T11:00:00.000Z" },
        health: { status: "healthy", consecutiveFailures: 0, errorRate: 0.02 },
        metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.7, claimYield: 0.5 }
      },
      {
        ...byId.src_sla_parser!,
        status: "active",
        tags: [...(byId.src_sla_parser!.tags ?? []), "Cobalt Strike", "malware"],
        catalog: {
          ...byId.src_sla_parser!.catalog!,
          adapterCompatibility: ["api"],
          coverage: { ...byId.src_sla_parser!.catalog!.coverage, topics: ["malware", "tooling", "Cobalt Strike"], queryPatterns: ["Cobalt Strike malware tool"] }
        },
        crawlState: { retryCount: 0, lastCollectedAt: "2026-05-24T11:00:00.000Z" },
        health: { status: "healthy", consecutiveFailures: 0, errorRate: 0.01 },
        metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.8, claimYield: 0.6 }
      },
      { ...byId.src_sla_duplicate_a!, status: "active", metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.8, claimYield: 0.6 } },
      { ...byId.src_sla_duplicate_b!, status: "approved", metadata: { legalNotesReviewedAt: currentReview, robotsReviewedAt: currentReview, evidenceYield: 0.8, claimYield: 0.6 } }
    ];
    const response = buildSourceRuntimeSlaApiResponse({
      tenantId: "tenant_runtime_sla",
      generatedAt,
      queries: ["APT29", "Volt Typhoon", "Scattered Spider", "Akira ransomware victims", "CVE-2024-1234", "Norway healthcare sector", "Cobalt Strike malware tool", "provider outage"],
      sources
    });
    const apt29 = response.queries.find((query) => query.query === "APT29")!;
    const volt = response.queries.find((query) => query.query === "Volt Typhoon")!;
    const scattered = response.queries.find((query) => query.query === "Scattered Spider")!;
    const akira = response.queries.find((query) => query.query === "Akira ransomware victims")!;
    const cve = response.queries.find((query) => query.query === "CVE-2024-1234")!;
    const tool = response.queries.find((query) => query.query === "Cobalt Strike malware tool")!;

    expect(response).toMatchObject({
      endpoint: "/v1/sources/runtime-sla",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      tenantId: "tenant_runtime_sla"
    });
    expect(apt29.sources.find((source) => source.sourceId === "src_sla_apt29")).toMatchObject({
      status: "pass",
      apiImpact: "none"
    });
    expect(volt.remediation.map((item) => item.action)).toContain("activate_approved_source");
    expect(scattered.remediation.map((item) => item.action)).toContain("pause_noisy_source");
    expect(scattered.remediation.map((item) => item.action)).toContain("change_cadence");
    expect(scattered.remediation.some((item) => item.owner === "agent_06" && item.action === "change_cadence")).toBe(true);
    expect(akira.summary.releaseHold).toBe(true);
    expect(akira.remediation.map((item) => item.action)).toContain("quarantine_failure");
    expect(akira.promotionGate.decision).toBe("rollback");
    expect(akira.promotionGate.holds).toContainEqual(expect.objectContaining({ code: "quarantine", owner: "agent_10" }));
    expect(akira.promotionGate.agent10ReleaseDecision).toMatchObject({
      field: "sourceSlaPromotionGate",
      status: "rollback",
      releaseImpact: "rollback_required"
    });
    expect(cve.remediation.map((item) => item.action)).toEqual(expect.arrayContaining(["request_legal_review", "request_robots_review"]));
    expect(cve.promotionGate.holds.map((hold) => hold.code)).toEqual(expect.arrayContaining(["legal_review", "robots_review"]));
    expect(tool.remediation).toContainEqual(expect.objectContaining({ action: "request_parser_support", owner: "agent_03", releaseHold: true }));
    expect(tool.promotionGate.holds).toContainEqual(expect.objectContaining({ code: "parser_gap", owner: "agent_03" }));
    expect(scattered.promotionGate.holds).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "scheduler_cost", owner: "agent_02" }),
      expect.objectContaining({ code: "evidence_yield", owner: "agent_06" })
    ]));
    expect(response.queries.every((query) => query.sourceFamilyGate.requiredFamilies >= query.sourceFamilyGate.actualFamilies)).toBe(true);
    expect(response.queries.flatMap((query) => query.promotionGate.repairPackets).every((packet) => packet.dryRun && packet.willMutate === false && packet.willStartCrawling === false)).toBe(true);
    expect(response.queries.flatMap((query) => query.remediation).every((item) => item.dryRun && item.willMutate === false && item.willStartCrawling === false)).toBe(true);
    expect(response.rollup.status).toBe("breach");
    expect(response.rollup.releaseHold).toBe(true);
    expect(response.releasePacket).toMatchObject({
      gate: "source_sla_enforcement",
      decision: "rollback",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false
    });
    expect(response.releasePacket.heldQueries).toEqual(expect.arrayContaining(["Akira ransomware victims", "CVE-2024-1234", "Cobalt Strike malware tool"]));
    expect(response.coordination.agent02Fields).toContain("schedulerCost");
    expect(response.coordination.agent03Fields).toContain("metrics.parser_compatibility");
    expect(response.coordination.agent06Fields).toContain("metrics.evidence_yield");
    expect(response.coordination.agent10Fields).toContain("summary.releaseHold");
  });

  test("builds coverage closeout activation waves for enterprise actor search", () => {
    const generatedAt = "2026-05-24T12:30:00.000Z";
    const sources: SourceRecord[] = [];
    const response = buildSourceCoverageCloseoutApiResponse({
      tenantId: "tenant_closeout",
      generatedAt,
      queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Cobalt Strike malware tool", "Norway", "healthcare sector", "campaign infrastructure", "C2 infrastructure"],
      sources
    });
    const categories = response.activationWaves.map((wave) => wave.category);

    expect(response).toMatchObject({
      endpoint: "/v1/sources/coverage-closeout",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      tenantId: "tenant_closeout",
      releasePacket: {
        gate: "source_coverage_closeout",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false
      }
    });
    expect(response.summary.safePublicActivationSourceCount).toBeGreaterThanOrEqual(50);
    expect(categories).toEqual(expect.arrayContaining([
      "vendor_blog",
      "advisory",
      "rss",
      "github_security_advisory",
      "public_research_feed",
      "government_cert"
    ]));
    expect(response.activationWaves.every((wave) => wave.dryRun && wave.willMutate === false && wave.willStartCrawling === false)).toBe(true);
    expect(response.activationWaves.flatMap((wave) => wave.sources).every((source) =>
      source.approvalScope === "safe_public_auto" &&
      source.legalReviewState === "current" &&
      (source.robotsReviewState === "current" || source.robotsReviewState === "not_required") &&
      source.parserCompatible &&
      source.promotionImpact.agent07 === "ready_for_extraction" &&
      source.promotionImpact.agent09 === "api_coverage_ready" &&
      source.promotionImpact.agent10 === "release_candidate"
    )).toBe(true);
    expect(response.queries.map((query) => query.queryClass)).toEqual([
      "actor",
      "ransomware_victim",
      "cve",
      "malware_tool",
      "country",
      "sector",
      "campaign",
      "infrastructure"
    ]);
    expect(response.queries.every((query) => query.plannedSafePublicSourceCount > 0)).toBe(true);
    expect(response.forbiddenSourceClasses).toEqual(expect.arrayContaining([
      "restricted raw payload collection",
      "private forums",
      "credentialed sources",
      "leaked-file endpoints",
      "authentication-gated sources",
      "CAPTCHA bypass",
      "public chat sources"
    ]));
  });

  test("builds source activation execution readiness for canary rollout and drift burn-down", () => {
    const generatedAt = "2026-05-24T13:30:00.000Z";
    const response = buildSourceCoverageCloseoutApiResponse({
      tenantId: "tenant_execution",
      generatedAt,
      queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Norway", "healthcare sector", "campaign infrastructure"],
      sources: []
    });
    const readiness = response.executionReadiness;
    const canaryCategories = new Set(readiness.first10Canary.map((source) => source.category));
    const excludedClasses = readiness.excludedSources.map((source) => source.excludedClass);
    const queryClasses = readiness.coverageByQueryClass.map((row) => row.queryClass);

    expect(readiness).toMatchObject({
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      agent10ReleasePacket: {
        field: "sourceActivationExecutionReadiness",
        gate: "source_activation_execution_readiness",
        decision: "pass",
        dryRun: true,
        willMutate: false,
        willStartCrawling: false,
        canaryCount: 10,
        rolloutCount: 50
      },
      queueBudgetImpact: {
        owner: "agent_02",
        withinBudget: true
      },
      parserGapHandoff: {
        owner: "agent_03",
        releaseImpact: "none"
      }
    });
    expect(readiness.first10Canary).toHaveLength(10);
    expect(readiness.publicRollout50).toHaveLength(50);
    expect(canaryCategories.size).toBeGreaterThanOrEqual(5);
    expect(readiness.first10Canary.map((source) => source.canaryOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(readiness.publicRollout50.every((source) =>
      source.approvalScope === "safe_public_auto" &&
      source.legalReviewAgeDays <= 90 &&
      (source.robotsReviewAgeDays === "not_required" || source.robotsReviewAgeDays <= 90) &&
      source.parserOwner === "agent_03" &&
      source.parserCompatible &&
      source.expectedCaptureYield >= source.expectedEvidenceYield &&
      source.schedulerBudget.estimatedDailyTasks > 0 &&
      source.postActivationDriftChecks.includes("scheduler_queue_budget")
    )).toBe(true);
    expect(queryClasses).toEqual(expect.arrayContaining(["actor", "ransomware_victim", "cve", "country", "sector", "campaign"]));
    expect(readiness.coverageByQueryClass.every((row) => row.sourceCount > 0)).toBe(true);
    expect(excludedClasses).toEqual(expect.arrayContaining([
      "restricted_raw_payload",
      "private_forum",
      "credentialed_source",
      "leaked_file_endpoint",
      "captcha_gated",
      "public_chat_source",
      "parser_gap",
      "duplicate"
    ]));
    expect(readiness.excludedSources.every((source) => source.dryRun && source.willMutate === false && source.willStartCrawling === false)).toBe(true);
    expect(readiness.sourceRetirement.candidates).toEqual(readiness.duplicateSuppression.duplicateSourceIds);
    expect(readiness.duplicateSuppression.duplicateSourceIds.length).toBeGreaterThan(0);
    expect(readiness.parserGapHandoff.sourceIds.length).toBeGreaterThan(0);
    expect(readiness.queueBudgetImpact.canaryEstimatedDailyTasks).toBeGreaterThan(0);
    expect(readiness.queueBudgetImpact.rolloutEstimatedDailyTasks).toBeGreaterThan(readiness.queueBudgetImpact.canaryEstimatedDailyTasks);
    expect(readiness.postActivationDriftChecks).toEqual(expect.arrayContaining([
      "legal_review_age_days <= 90",
      "Agent 02 queue budget remains within source activation envelope"
    ]));
    expect(readiness.rolloutPromotion).toMatchObject({
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      stage: "canary_to_expanded_rollout",
      evidenceYieldThresholds: {
        canaryMinimum: 0.35,
        rolloutMinimum: 0.4,
        certificationOwner: "agent_06"
      },
      costControls: {
        owner: "agent_02",
        state: "within_budget"
      },
      agent10CanaryReleaseDecision: {
        field: "sourceRolloutPromotionPacket",
        canaryDecision: "pass",
        expandedRolloutDecision: "pass",
        releaseDecision: "promote_canary_then_expand"
      }
    });
    expect(readiness.rolloutPromotion.first10CanarySourceIds).toEqual(readiness.first10Canary.map((source) => source.sourceId));
    expect(readiness.rolloutPromotion.publicRollout50SourceIds).toHaveLength(50);
    expect(readiness.rolloutPromotion.coverageImpacts.map((impact) => impact.queryClass)).toEqual(expect.arrayContaining(["actor", "ransomware_victim", "cve", "country", "sector", "campaign"]));
    expect(readiness.rolloutPromotion.coverageImpacts.every((impact) =>
      impact.agent02SchedulerTelemetry.telemetryFields.includes("queue_age_p95") &&
      impact.agent06EvidenceCertification.threshold === 0.4 &&
      impact.agent07PollingState.nextPollSeconds === 300 &&
      impact.agent09ContractIndex.field === "sourceCoverage.rolloutPromotion" &&
      impact.agent10Decision.field === "sourceRolloutPromotionPacket"
    )).toBe(true);
    expect(readiness.rolloutPromotion.postCanaryMonitoring.map((item) => item.owner)).toEqual(expect.arrayContaining(["agent_02", "agent_06", "agent_07", "agent_10"]));
    expect(readiness.rolloutPromotion.sourceRetirement.candidates).toEqual(readiness.sourceRetirement.candidates);
    expect(readiness.rolloutPromotion.duplicateSuppression.duplicateSourceIds).toEqual(readiness.duplicateSuppression.duplicateSourceIds);
    expect(readiness.rolloutPromotion.parserGapHandoff.sourceIds).toEqual(readiness.parserGapHandoff.sourceIds);
    expect(response.queries.every((query) =>
      query.executionPacket.dryRun &&
      query.executionPacket.willMutate === false &&
      query.executionPacket.willStartCrawling === false &&
      query.executionPacket.rolloutSourceIds.length > 0 &&
      query.executionPacket.promotionImpact.agent06EvidenceCertification.certificationState === "ready" &&
      query.executionPacket.promotionImpact.agent09ContractIndex.route === "/v1/contracts"
    )).toBe(true);
    expect(response.releasePacket.agent10ExecutionField).toBe("sourceActivationExecutionReadiness");
  });

  test("reconciles desired source packs registry health scheduler and adapter drift", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const desiredPack: SeedSourceBundle = {
      version: 1,
      name: "desired-pack",
      sources: [
        { ...seedSource("https://example.test/desired-missing.xml"), id: "src_desired_missing", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/current-active.xml"), id: "src_current_active", tenantId: "tenant_reconcile" }
      ]
    };
    const current = importSeedBundle({
      version: 1,
      name: "current-registry",
      sources: [
        { ...seedSource("https://example.test/current-active.xml"), id: "src_current_active", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/approved-idle.xml"), id: "src_approved_idle", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/unhealthy.xml"), id: "src_unhealthy", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/no-captures.xml"), id: "src_no_captures", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/disabled.xml"), id: "src_disabled", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/expired.xml"), id: "src_expired", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/duplicate.xml"), id: "src_duplicate_a", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/duplicate.xml"), id: "src_duplicate_b", tenantId: "tenant_reconcile" },
        { ...seedSource("https://example.test/incompatible.xml"), id: "src_incompatible", tenantId: "tenant_reconcile" }
      ]
    }, { importedAt: "2026-05-01T00:00:00.000Z" }).accepted;
    const byId = Object.fromEntries(current.map((source) => [source.id, source]));
    const sources: SourceRecord[] = [
      { ...byId.src_current_active!, status: "active", crawlState: { retryCount: 0, lastCollectedAt: "2026-05-23T23:00:00.000Z" }, metadata: { legalNotesReviewedAt: generatedAt } },
      { ...byId.src_approved_idle!, status: "approved", metadata: { legalNotesReviewedAt: generatedAt } },
      { ...byId.src_unhealthy!, status: "active", health: { status: "failing", consecutiveFailures: 5, errorRate: 0.8 }, metadata: { legalNotesReviewedAt: generatedAt } },
      { ...byId.src_no_captures!, status: "active", crawlState: { retryCount: 0 }, metadata: { legalNotesReviewedAt: generatedAt } },
      { ...byId.src_disabled!, status: "disabled", accessMethod: "disabled", metadata: { legalNotesReviewedAt: generatedAt } },
      { ...byId.src_expired!, status: "active", governance: { approvalRequired: true, approvalState: "approved", metadataOnly: false, approvalExpiresAt: "2026-05-01T00:00:00.000Z" }, metadata: { legalNotesReviewedAt: "2025-01-01T00:00:00.000Z" } },
      { ...byId.src_duplicate_a!, status: "candidate", metadata: { legalNotesReviewedAt: generatedAt } },
      { ...byId.src_duplicate_b!, status: "candidate", metadata: { legalNotesReviewedAt: generatedAt } },
      { ...byId.src_incompatible!, status: "active", catalog: { ...byId.src_incompatible!.catalog!, adapterCompatibility: ["api"] }, metadata: { legalNotesReviewedAt: generatedAt } }
    ];

    const report = buildSourceRegistryReconciliationReport({
      tenantId: "tenant_reconcile",
      generatedAt,
      desiredSourcePacks: [desiredPack],
      currentSources: sources,
      adapterCapabilities: [{ sourceType: "rss", available: false, reason: "rss adapter disabled in this deployment" }],
      scheduler: {
        scheduledSourceIds: ["src_current_active"],
        deadLetterSourceIds: ["src_unhealthy"],
        lastCaptureAtBySourceId: { src_current_active: "2026-05-23T23:30:00.000Z" }
      },
      legalNotesStaleAfterSeconds: 30 * 86400
    });

    expect(report.summary).toMatchObject({
      missing_approved_source: 1,
      approved_not_scheduled: 5,
      active_unhealthy: 1,
      active_no_recent_captures: 4,
      disabled_by_policy: 1,
      expired_approval: 1,
      stale_legal_notes: 1,
      duplicate_source: 2,
      adapter_capability_mismatch: 9
    });
    expect(report.missingDesiredSources[0]).toMatchObject({
      sourceId: "src_desired_missing",
      recommendedAction: "approve_candidates"
    });
    expect(report.drift.map((item) => item.code)).toEqual(expect.arrayContaining([
      "approved_not_scheduled",
      "active_unhealthy",
      "active_no_recent_captures",
      "disabled_by_policy",
      "expired_approval",
      "stale_legal_notes",
      "duplicate_source",
      "adapter_capability_mismatch"
    ]));
    expect(report.reviewPlans.map((plan) => plan.action)).toEqual(expect.arrayContaining([
      "approve_candidates",
      "quarantine_degraded_sources",
      "retire_dead_sources",
      "request_legal_notes"
    ]));
    expect(report.reviewPlans.every((plan) => plan.dryRun && plan.willStartCrawling === false && plan.tenantId === "tenant_reconcile")).toBe(true);
  });

  test("keeps large enterprise reconciliation deterministic compact and tenant scoped", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const sources: SourceRecord[] = Array.from({ length: 240 }, (_, index) => {
      const input = seedSource(`https://enterprise.example.test/${index}/feed.xml`);
      return {
        ...input,
        id: `src_enterprise_${index.toString().padStart(3, "0")}`,
        tenantId: index === 239 ? "other_tenant" : "tenant_enterprise",
        status: index % 11 === 0 ? "approved" : "active",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        health: index % 17 === 0
          ? { status: "degraded", consecutiveFailures: 2, errorRate: 0.4 }
          : { status: "healthy", consecutiveFailures: 0, errorRate: 0.01 },
        crawlState: {
          retryCount: 0,
          lastCollectedAt: index % 13 === 0 ? "2026-05-20T00:00:00.000Z" : "2026-05-23T23:00:00.000Z"
        },
        metadata: {
          legalNotesReviewedAt: index % 19 === 0 ? "2025-01-01T00:00:00.000Z" : generatedAt
        }
      };
    });

    const first = buildSourceRegistryReconciliationReport({
      tenantId: "tenant_enterprise",
      generatedAt,
      currentSources: sources,
      scheduler: {
        scheduledSourceIds: sources.slice(0, 120).map((source) => source.id),
        lastCaptureAtBySourceId: Object.fromEntries(sources.slice(0, 120).map((source) => [source.id, source.crawlState?.lastCollectedAt ?? generatedAt]))
      },
      maxDriftItems: 40
    });
    const second = buildSourceRegistryReconciliationReport({
      tenantId: "tenant_enterprise",
      generatedAt,
      currentSources: [...sources].reverse(),
      scheduler: {
        scheduledSourceIds: sources.slice(0, 120).map((source) => source.id),
        lastCaptureAtBySourceId: Object.fromEntries(sources.slice(0, 120).map((source) => [source.id, source.crawlState?.lastCollectedAt ?? generatedAt]))
      },
      maxDriftItems: 40
    });

    expect(first.sourceCount).toBe(239);
    expect(first.compact.driftItemCount).toBeLessThanOrEqual(40);
    expect(first.compact.omittedDriftItemCount).toBeGreaterThan(0);
    expect(first.drift.map((item) => `${item.code}:${item.sourceId}`)).toEqual(second.drift.map((item) => `${item.code}:${item.sourceId}`));
    expect(first.drift.some((item) => item.tenantId === "other_tenant")).toBe(false);
    expect(first.reviewPlans.every((plan) => plan.dryRun && plan.willStartCrawling === false)).toBe(true);
  });

  test("builds source cutover rehearsal reports with governance evidence and promotion gate fields", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const desiredPack: SeedSourceBundle = {
      version: 1,
      name: "cutover-pack",
      sources: [
        { ...seedSource("https://example.test/cutover-active.xml"), id: "src_cutover_active", tenantId: "tenant_cutover" },
        { ...seedSource("https://example.test/cutover-missing.xml"), id: "src_cutover_missing", tenantId: "tenant_cutover" }
      ]
    };
    const imported = importSeedBundle({
      version: 1,
      name: "cutover-current",
      sources: [
        { ...seedSource("https://example.test/cutover-active.xml"), id: "src_cutover_active", tenantId: "tenant_cutover" },
        { ...seedSource("https://example.test/cutover-candidate.xml"), id: "src_cutover_candidate", tenantId: "tenant_cutover" },
        { ...seedSource("https://example.test/cutover-unhealthy.xml"), id: "src_cutover_unhealthy", tenantId: "tenant_cutover" }
      ]
    }, { importedAt: generatedAt }).accepted;
    const [active, candidate, unhealthy] = imported;
    const report = buildSourceCutoverRehearsalReport({
      tenantId: "tenant_cutover",
      generatedAt,
      queries: ["APT29", "CVE-2024 exploitation"],
      sources: [
        { ...active!, status: "active", health: { status: "healthy", consecutiveFailures: 0, errorRate: 0 }, crawlState: { retryCount: 0, lastCollectedAt: "2026-05-23T23:30:00.000Z" }, metadata: { legalNotesReviewedAt: generatedAt } },
        { ...candidate!, status: "candidate", metadata: { legalNotesReviewedAt: generatedAt } },
        { ...unhealthy!, status: "active", health: { status: "failing", consecutiveFailures: 4, errorRate: 0.75 }, crawlState: { retryCount: 0, lastCollectedAt: "2026-05-20T00:00:00.000Z" }, metadata: { legalNotesReviewedAt: generatedAt } }
      ],
      desiredSourcePacks: [desiredPack],
      adapterCapabilities: [{ sourceType: "rss", available: true }],
      scheduler: {
        scheduledSourceIds: ["src_cutover_active"],
        lastCaptureAtBySourceId: { src_cutover_active: "2026-05-23T23:30:00.000Z" }
      },
      maxItemsPerSection: 20
    });

    expect(report.state).toBe("blocked");
    expect(report.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      "active_unhealthy",
      "missing_approved_source"
    ]));
    expect(report.promotionGate).toMatchObject({
      gate: "source_cutover_ready",
      ready: false,
      state: "blocked"
    });
    expect(report.promotionGate.proof.willStartCrawling).toBe(false);
    expect(report.sourcePackInstallPlans[0]?.willStartCrawling).toBe(false);
    expect(report.governanceEvidence.length).toBeGreaterThan(0);
    expect(report.governanceEvidence.every((item) =>
      item.safetyCase.length > 0 &&
      item.remainsDisabled.includes("restricted-source raw payload collection") ||
      item.remainsDisabled.includes("restricted-source activation without metadata-only approval") ||
      item.remainsDisabled.includes("restricted protocols") ||
      item.remainsDisabled.includes("restricted activation")
    )).toBe(true);
    expect(report.agent09Compatibility.exposeFields).toContain("promotionGate");
    expect(report.agent09Compatibility.suppressInternalFields).toContain("reconciliation.drift.schedulerState");
  });

  test("keeps large tenant source cutover rehearsal compact across query families", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const sources: SourceRecord[] = Array.from({ length: 260 }, (_, index) => {
      const input = seedSource(`https://cutover.example.test/${index}/feed.xml`);
      const family = index % 5 === 0 ? "APT29" : index % 5 === 1 ? "Scattered Spider" : index % 5 === 2 ? "Volt Typhoon" : index % 5 === 3 ? "Akira" : "CVE";
      return {
        ...input,
        id: `src_cutover_enterprise_${index.toString().padStart(3, "0")}`,
        tenantId: index === 259 ? "other_tenant" : "tenant_enterprise_cutover",
        status: index % 23 === 0 ? "candidate" : "active",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        health: index % 29 === 0
          ? { status: "degraded", consecutiveFailures: 2, errorRate: 0.35 }
          : { status: "healthy", consecutiveFailures: 0, errorRate: 0.01 },
        crawlState: { retryCount: 0, lastCollectedAt: index % 31 === 0 ? "2026-05-20T00:00:00.000Z" : "2026-05-23T23:00:00.000Z" },
        metadata: { legalNotesReviewedAt: generatedAt },
        catalog: {
          ...input.catalog!,
          coverage: {
            ...input.catalog!.coverage,
            actors: family === "CVE" ? input.catalog!.coverage.actors : [family],
            aliases: [...input.catalog!.coverage.aliases, family],
            topics: [...input.catalog!.coverage.topics, family === "CVE" ? "CVE" : "actor"],
            queryPatterns: [...input.catalog!.coverage.queryPatterns, family]
          }
        }
      };
    });
    const report = buildSourceCutoverRehearsalReport({
      tenantId: "tenant_enterprise_cutover",
      generatedAt,
      queries: ["APT29", "Scattered Spider", "Volt Typhoon", "Akira ransomware", "CVE-2024 exploitation"],
      sources,
      scheduler: {
        scheduledSourceIds: sources.slice(0, 180).map((source) => source.id),
        lastCaptureAtBySourceId: Object.fromEntries(sources.slice(0, 180).map((source) => [source.id, source.crawlState?.lastCollectedAt ?? generatedAt]))
      },
      maxItemsPerSection: 35
    });

    expect(report.queries).toHaveLength(5);
    expect(report.healthSummary.total).toBe(259);
    expect(report.compact.governanceEvidenceCount).toBeLessThanOrEqual(35);
    expect(report.compact.omittedGovernanceEvidenceCount).toBeGreaterThan(0);
    expect(report.reconciliation.compact.driftItemCount).toBeLessThanOrEqual(35);
    expect(report.activation.every((item) => item.activeCoverage.length > 0)).toBe(true);
    expect(report.governanceEvidence.some((item) => item.sourceIds.includes("src_cutover_enterprise_259"))).toBe(false);
    expect(report.promotionGate.proof.queryCount).toBe(5);
    expect(report.promotionGate.proof.willStartCrawling).toBe(false);
  });

  test("builds dry-run source apply plans with prerequisites diffs rollback and policy impact", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const imported = importSeedBundle({
      version: 1,
      name: "apply-current",
      sources: [
        { ...seedSource("https://example.test/apply-active.xml"), id: "src_apply_active", tenantId: "tenant_apply" },
        { ...seedSource("https://example.test/apply-candidate.xml"), id: "src_apply_candidate", tenantId: "tenant_apply" },
        { ...seedSource("https://example.test/apply-unhealthy.xml"), id: "src_apply_unhealthy", tenantId: "tenant_apply" }
      ]
    }, { importedAt: generatedAt }).accepted;
    const [active, candidate, unhealthy] = imported;
    const sources: SourceRecord[] = [
      { ...active!, status: "active", health: { status: "healthy", consecutiveFailures: 0, errorRate: 0 }, crawlState: { retryCount: 0, lastCollectedAt: "2026-05-23T23:30:00.000Z" }, metadata: { legalNotesReviewedAt: generatedAt } },
      { ...candidate!, status: "candidate", metadata: { legalNotesReviewedAt: generatedAt } },
      { ...unhealthy!, status: "active", health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 }, crawlState: { retryCount: 0, lastCollectedAt: "2026-05-20T00:00:00.000Z" }, metadata: { legalNotesReviewedAt: generatedAt } }
    ];
    const rehearsal = buildSourceCutoverRehearsalReport({
      tenantId: "tenant_apply",
      generatedAt,
      queries: ["APT29"],
      sources,
      scheduler: { scheduledSourceIds: ["src_apply_active"] },
      maxItemsPerSection: 20
    });
    const plan = buildSourceApplyPlan({ rehearsal, sources, generatedAt });
    const dryRun = executeSourceApplyPlanDryRun(plan);

    expect(plan.dryRun).toBe(true);
    expect(plan.willMutate).toBe(false);
    expect(plan.promotionGate.gate).toBe("source_apply_plan_ready");
    expect(plan.promotionGate.willStartCrawling).toBe(false);
    expect(plan.items.every((item) => item.dryRun && item.collectionImpact.willStartCrawling === false)).toBe(true);
    expect(plan.items.find((item) => item.sourceId === "src_apply_candidate")).toMatchObject({
      action: "approve",
      automation: "human_approval_required"
    });
    expect(plan.items.find((item) => item.sourceId === "src_apply_unhealthy")).toMatchObject({
      action: "quarantine",
      automation: "rollback_only",
      rollbackState: { quarantineState: "required" }
    });
    expect(plan.items.find((item) => item.sourceId === "src_apply_unhealthy")?.expectedRegistryDiff).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "status", before: "active", after: "quarantined" })
    ]));
    expect(dryRun.executed).toBe(false);
    expect(dryRun.itemResults.every((item) => item.reason.includes("Dry-run") || item.blocked)).toBe(true);
  });

  test("blocks restricted source auto-activation and keeps public source-pack apply planning non-crawling", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const publicPack: SeedSourceBundle = {
      version: 1,
      name: "apply-public-pack",
      sources: [
        { ...seedSource("https://example.test/apply-pack.xml"), id: "src_apply_pack", tenantId: "tenant_apply_pack" }
      ]
    };
    const publicSource = importSeedBundle(publicPack, { importedAt: generatedAt }).accepted[0]!;
    const restricted: SourceRecord = {
      ...publicSource,
      id: "src_restricted_apply",
      name: "Restricted Apply Source",
      type: "tor_metadata",
      url: "http://restrictedexample.onion",
      accessMethod: "approved_proxy",
      risk: "restricted",
      status: "approved",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: generatedAt,
        approvedBy: "legal",
        policyVersion: "collection-policy:v1"
      },
      catalog: {
        ...publicSource.catalog!,
        approvalScope: "restricted_protocol",
        adapterCompatibility: ["tor_metadata"],
        retentionClass: "darknet_metadata"
      }
    };
    const rehearsal = buildSourceCutoverRehearsalReport({
      tenantId: "tenant_apply_pack",
      generatedAt,
      queries: ["APT29"],
      sources: [
        { ...publicSource, status: "candidate", tenantId: "tenant_apply_pack", metadata: { legalNotesReviewedAt: generatedAt } },
        restricted
      ],
      desiredSourcePacks: [publicPack],
      scheduler: {},
      maxItemsPerSection: 20
    });
    const plan = buildSourceApplyPlan({ rehearsal, sources: [{ ...publicSource, status: "candidate", tenantId: "tenant_apply_pack" }, restricted], generatedAt });
    const restrictedItem = plan.items.find((item) => item.sourceId === "src_restricted_apply");
    const publicItem = plan.items.find((item) => item.sourceId === "src_apply_pack");

    expect(rehearsal.sourcePackInstallPlans[0]?.willStartCrawling).toBe(false);
    expect(publicItem?.collectionImpact.willStartCrawling).toBe(false);
    expect(publicItem?.automation).toBe("human_approval_required");
    expect(restrictedItem).toMatchObject({
      action: "quarantine",
      automation: "rollback_only",
      policyImpact: {
        riskChange: "restricted_blocked",
        metadataOnlyRequired: true
      }
    });
    expect(restrictedItem?.collectionImpact.enablesCollection).toBe(false);
    expect(restrictedItem?.collectionImpact.remainsDisabled).toEqual(expect.arrayContaining([
      "restricted raw payload collection",
      "automatic restricted-source activation"
    ]));
    expect(plan.automationSummary.rollback_only).toBeGreaterThan(0);
  });

  test("freezes /v1 sources apply-plan API DTOs with schema examples and execution preview", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const imported = importSeedBundle({
      version: 1,
      name: "api-apply-current",
      sources: [
        { ...seedSource("https://example.test/api-active.xml"), id: "src_api_active", tenantId: "tenant_api_apply" },
        { ...seedSource("https://example.test/api-candidate.xml"), id: "src_api_candidate", tenantId: "tenant_api_apply" },
        { ...seedSource("https://example.test/api-unhealthy.xml"), id: "src_api_unhealthy", tenantId: "tenant_api_apply" }
      ]
    }, { importedAt: generatedAt }).accepted;
    const [active, candidate, unhealthy] = imported;
    const sources: SourceRecord[] = [
      { ...active!, status: "active", health: { status: "healthy", consecutiveFailures: 0, errorRate: 0 }, crawlState: { retryCount: 0, lastCollectedAt: "2026-05-23T23:30:00.000Z" }, metadata: { legalNotesReviewedAt: generatedAt } },
      { ...candidate!, status: "candidate", metadata: { legalNotesReviewedAt: generatedAt } },
      { ...unhealthy!, status: "active", health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 }, crawlState: { retryCount: 0, lastCollectedAt: "2026-05-20T00:00:00.000Z" }, metadata: { legalNotesReviewedAt: generatedAt } }
    ];
    const rehearsal = buildSourceCutoverRehearsalReport({
      tenantId: "tenant_api_apply",
      generatedAt,
      queries: ["APT29", "CVE-2024 exploitation"],
      sources,
      scheduler: { scheduledSourceIds: ["src_api_active"] },
      maxItemsPerSection: 20
    });
    const plan = buildSourceApplyPlan({ rehearsal, sources, generatedAt });
    const dto = buildSourceApplyPlanApiResponse(plan, {
      tenantId: "tenant_api_apply",
      queryScope: { queries: ["APT29", "CVE-2024 exploitation"], entityTypes: ["actor", "vulnerability"] },
      sourcePackIds: ["safe-public-cti-starter-pack"],
      selectedActions: ["approve", "quarantine", "leave_unchanged"],
      dryRun: true,
      includeExecutionPreview: true
    });

    expect(dto).toMatchObject({
      apiVersion: "v1",
      endpoint: "/v1/sources/apply-plan",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      tenantId: "tenant_api_apply"
    });
    expect(dto.request.queryScope.queries).toEqual(["APT29", "CVE-2024 exploitation"]);
    expect(dto.request.sourcePackIds).toEqual(["safe-public-cti-starter-pack"]);
    expect(dto.items.every((item) => ["approve", "quarantine", "leave_unchanged"].includes(item.action))).toBe(true);
    expect(dto.approvalSummary.approvalsRequired).toBeGreaterThan(0);
    expect(dto.approvalSummary.rollbackOnly).toBeGreaterThan(0);
    expect(dto.executionPreview?.executed).toBe(false);
    expect(dto.executionPreview?.dryRun).toBe(true);
    expect(dto.executionPreview?.itemResults.every((item) => item.reason.includes("Dry-run") || item.blocked)).toBe(true);
    expect(dto.promotionPacketLink).toMatchObject({
      field: "sourceApplyPlanId",
      value: plan.id,
      gate: "source_apply_plan_ready"
    });
    expect(dto.schemaExamples.map((example) => example.name)).toEqual([
      "happy_path",
      "human_approval_required",
      "blocked_restricted_source",
      "duplicate_source",
      "stale_legal_notes",
      "rollback_only_quarantine"
    ]);
    expect(dto.schemaExamples.every((example) =>
      example.response.dryRun === true &&
      example.response.willMutate === false &&
      example.response.willStartCrawling === false
    )).toBe(true);
  });

  test("API-facing apply-plan DTOs never imply restricted auto-activation", () => {
    const generatedAt = "2026-05-24T00:00:00.000Z";
    const base = importSeedBundle({
      version: 1,
      name: "restricted-api-apply",
      sources: [{ ...seedSource("https://example.test/restricted-api.xml"), id: "src_restricted_api_seed", tenantId: "tenant_restricted_api" }]
    }, { importedAt: generatedAt }).accepted[0]!;
    const restricted: SourceRecord = {
      ...base,
      id: "src_restricted_api",
      name: "Restricted API Apply Source",
      type: "tor_metadata",
      url: "http://restrictedapi.onion",
      accessMethod: "approved_proxy",
      risk: "restricted",
      status: "approved",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: generatedAt,
        approvedBy: "legal",
        policyVersion: "collection-policy:v1"
      },
      catalog: {
        ...base.catalog!,
        approvalScope: "restricted_protocol",
        adapterCompatibility: ["tor_metadata"],
        retentionClass: "darknet_metadata"
      }
    };
    const rehearsal = buildSourceCutoverRehearsalReport({
      tenantId: "tenant_restricted_api",
      generatedAt,
      queries: ["APT29"],
      sources: [restricted],
      scheduler: {},
      maxItemsPerSection: 10
    });
    const plan = buildSourceApplyPlan({ rehearsal, sources: [restricted], generatedAt });
    const dto = buildSourceApplyPlanApiResponse(plan, {
      tenantId: "tenant_restricted_api",
      queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
      sourcePackIds: [],
      selectedActions: ["activate", "quarantine", "request_legal_notes"],
      dryRun: true,
      includeExecutionPreview: true
    });

    expect(dto.willMutate).toBe(false);
    expect(dto.willStartCrawling).toBe(false);
    expect(dto.items.every((item) => item.collectionImpact.willStartCrawling === false)).toBe(true);
    expect(dto.items.some((item) => item.action === "activate" && item.collectionImpact.enablesCollection)).toBe(false);
    expect(dto.items.some((item) => item.policyImpact.metadataOnlyRequired)).toBe(true);
    expect(dto.items.flatMap((item) => item.collectionImpact.remainsDisabled)).toEqual(expect.arrayContaining([
      "restricted raw payload collection",
      "automatic restricted-source activation"
    ]));
  });
});

function seedSource(url: string) {
  return {
    id: "src_seed",
    name: "Seed Source",
    type: "rss" as const,
    url,
    accessMethod: "public_http" as const,
    risk: "low" as const,
    trustScore: 0.5,
    crawlFrequencySeconds: 3600,
    legalNotes: "Public seed source for validation tests.",
    tags: ["test"],
    catalog: {
      canonicalId: "public:test:seed",
      publisher: {
        name: "Example Publisher",
        country: "NO",
        homepage: "https://example.test",
        trustBasis: "community" as const
      },
      tier: "tier_2" as const,
      approvalScope: "safe_public_auto" as const,
      license: "Public web content; verify source terms before production activation.",
      legalBasis: "Public defensive CTI source with no authentication or sensitive collection.",
      reliability: 0.7,
      intelligenceValue: 0.72,
      retentionClass: "standard" as const,
      analystOwner: "source-ops",
      coverage: {
        topics: ["ransomware", "vulnerability", "threat-report"],
        actors: ["APT29"],
        aliases: ["Midnight Blizzard"],
        industries: ["healthcare"],
        regions: ["Europe"],
        countries: ["Norway"],
        languages: ["en"],
        queryPatterns: ["APT29", "CVE", "healthcare ransomware Europe"]
      },
      collection: {
        freshnessTargetSeconds: 86400,
        collectionSlaSeconds: 3600,
        budgetClass: "normal" as const,
        crawlCadenceSeconds: 3600
      },
      adapterCompatibility: ["rss" as const],
      rollback: {}
    }
  };
}
