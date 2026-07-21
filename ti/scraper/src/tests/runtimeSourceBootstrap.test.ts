import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, FocusedFrontier, handleApiRequest, InMemoryScraperStore, join, mkdtempSync, rmSync, test } from "./apiTestHarness.ts";
import { tmpdir } from "node:os";
import { bootstrapRuntimeSources } from "../runtime/sourceBootstrap.ts";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("runtime source bootstrap and scheduler monitoring", () => {
  test("keeps dry-run source-atlas candidates out of automatic production bootstrap", () => {
    const result = bootstrapRuntimeSources(new InMemoryScraperStore(), { sourceTarget: 0 });
    const compose = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../../docker-compose.yml"), "utf8");
    expect(result.seedPaths.some((path) => path.endsWith("high_value_exposure_source_candidates.json"))).toBe(false);
    expect(result.errors.some((error) => error.path.endsWith("high_value_exposure_source_candidates.json"))).toBe(false);
    expect(compose.match(/TI_SOURCE_SEED_PATHS:.*high_value_exposure_source_candidates/)).toBeNull();
  });

  test("bootstraps the canonical MITRE APT29 source with fixed-query metadata", () => {
    const store = new InMemoryScraperStore();
    const seedPath = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/public_cti_starter_pack.json");

    bootstrapRuntimeSources(store, { seedPaths: [seedPath], sourceTarget: 0 });

    expect(store.listSources().find((source) => source.id === "src_seed_mitre_attack_apt29")).toMatchObject({
      url: "https://attack.mitre.org/groups/G0016/",
      status: "active",
      metadata: { queryTerm: "APT29", queryClass: "threat-intel", productionCollection: true }
    });
  });

  test("imports configured source bundles and reports the exact source target shortfall", () => {
    const store = new InMemoryScraperStore();
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-"));
    const seedPath = join(dir, "sources.json");
    writeFileSync(seedPath, JSON.stringify({
      version: 1,
      name: "test production sources",
      generatedAt: "2026-07-02T00:00:00.000Z",
      sources: [
        source("src_public_feed_a", "https://security.example.test/feed-a.xml"),
        source("src_public_feed_b", "https://security.example.test/feed-b.xml")
      ]
    }));

    try {
      const result = bootstrapRuntimeSources(store, {
        seedPaths: [seedPath],
        generatedAt: "2026-07-02T00:00:00.000Z",
        sourceTarget: 1000
      });

      expect(result.importedSourceCount).toBe(2);
      expect(result.totalSourceCount).toBe(2);
      expect(result.activeSourceCount).toBe(2);
      expect(result.shortfall).toBe(998);
      expect(result.blocker).toBe("source_registry_shortfall:2/1000");
      expect(store.listSources().every((item: any) => item.metadata.productionCollection === true)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("imports disabled public Telegram candidate packs as reviewed-off candidates", () => {
    const store = new InMemoryScraperStore();
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-telegram-"));
    const seedPath = join(dir, "telegram.json");
    writeFileSync(seedPath, JSON.stringify({
      version: 1,
      name: "public telegram candidates",
      disabledByDefault: true,
      sources: [
        {
          id: "tg_candidate_runtime",
          name: "Public Runtime Channel Candidate",
          channelHandle: "public_runtime_channel",
          publicUrl: "https://t.me/public_runtime_channel",
          legalNotes: "Candidate public channel; collect public posts only after source review.",
          approvalState: "pending",
          rateLimit: { minIntervalSeconds: 600 },
          compliance: { approvalScope: "public_requires_review", legalBasis: "Public CTI monitoring review." },
          trustScore: 0.55
        }
      ]
    }));

    try {
      const result = bootstrapRuntimeSources(store, {
        seedPaths: [seedPath],
        generatedAt: "2026-07-02T00:00:00.000Z",
        sourceTarget: 1000
      });
      const [sourceRecord] = store.listSources() as any[];

      expect(result.importedSourceCount).toBe(1);
      expect(result.activeSourceCount).toBe(0);
      expect(result.shortfall).toBe(999);
      expect(sourceRecord).toMatchObject({
        id: "tg_candidate_runtime",
        type: "telegram_public",
        accessMethod: "public_http",
        status: "candidate",
        risk: "medium",
        metadata: { publicTelegramCandidate: true, productionCollection: true }
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects invalid generic seeds and keeps valid Tor metadata seeds inactive", () => {
    const previous = Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
    Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = "true";
    const store = new InMemoryScraperStore();
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-restricted-"));
    const invalidPath = join(dir, "invalid-public.json");
    const restrictedPath = join(dir, "restricted.json");
    writeFileSync(invalidPath, JSON.stringify({ version: 1, name: "invalid", sources: [{ ...source("src_invalid", "https://example.test/feed"), legalNotes: "" }] }));
    writeFileSync(restrictedPath, JSON.stringify({
      version: 1,
      name: "reviewed Tor metadata candidates",
      disabledByDefault: true,
      network: "tor",
      proxyBoundaryId: "tor-approved-metadata-proxy",
      approvalScope: "metadata_only",
      retentionClass: "restricted_metadata",
      forbiddenOperations: ["credential_bypass", "captcha_solving", "threat_actor_interaction", "stolen_file_download", "stealth_or_evasion", "unapproved_proxy", "non_metadata_capture"],
      sources: [{
        id: "src_restricted_candidate",
        name: "Reviewed victim listing candidate",
        type: "tor_metadata",
        url: `http://${"a".repeat(56)}.onion/`,
        accessMethod: "approved_proxy",
        status: "candidate",
        risk: "restricted",
        trustScore: 0.6,
        crawlFrequencySeconds: 3600,
        legalNotes: "Publicly advertised victim-listing metadata only; never retrieve leaked files or interact with operators.",
        governance: { approvalRequired: true, approvalState: "pending", metadataOnly: true, approvalScope: "metadata_only", policyVersion: "collection-policy:v1" },
        metadata: {
          sourceFamily: "dark_web_victim_feed",
          actorName: "Example actor",
          discoveryAuthorityUrl: "https://example.test/about",
          discoveryAuthorityRecordUrl: "https://example.test/group/example",
          discoveryCheckedAt: "2026-07-20T00:00:00.000Z",
          discoveryAvailability: "unknown",
          expectedPageRole: "victim_listing",
          collectionScope: "metadata_only",
          retainRawContent: false,
          retentionDays: 30,
          attribution: "Example public discovery authority"
        }
      }]
    }));

    try {
      const result = bootstrapRuntimeSources(store, { seedPaths: [invalidPath, restrictedPath], generatedAt: "2026-07-20T00:00:00.000Z", sourceTarget: 1 });
      expect(result).toMatchObject({ importedSourceCount: 1, skippedSourceCount: 1, activeSourceCount: 0, totalSourceCount: 1 });
      expect(result.errors.some((error) => error.message.includes("src_invalid: legal notes are required"))).toBe(true);
      expect(store.listSources()[0]).toMatchObject({
        id: "src_restricted_candidate",
        status: "candidate",
        accessMethod: "approved_proxy",
        metadata: { productionCollection: false, canaryPortfolio: false, restrictedMetadataCandidate: true }
      });
    } finally {
      if (previous === undefined) delete Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
      else Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("generated public source pack clears the 1k production source target from an empty registry", () => {
    const seedPath = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/public_threat_intel_generated_sources.json");
    const bundle = JSON.parse(readFileSync(seedPath, "utf8"));
    const store = new InMemoryScraperStore();

    const result = bootstrapRuntimeSources(store, {
      seedPaths: [seedPath],
      generatedAt: "2026-07-02T00:00:00.000Z",
      sourceTarget: 1000
    });

    expect(bundle.sources.length).toBeGreaterThanOrEqual(1000);
    expect(bundle.sources.some((source: any) => !source.legalNotes || source.risk !== "low")).toBe(false);
    expect(result.importedSourceCount).toBeGreaterThanOrEqual(1000);
    expect(result.totalSourceCount).toBeGreaterThanOrEqual(1000);
    expect(result.activeSourceCount).toBeGreaterThanOrEqual(1000);
    expect(result.shortfall).toBe(0);
    expect(result.blocker).toBeUndefined();
    expect(result.errors.filter((error) => error.path === seedPath)).toEqual([]);
  });

  test("collection scheduler status exposes source coverage, durable run state, parser state, and per-source freshness", async () => {
    const originalAiBase = Bun.env.HANASAND_AI_API_BASE;
    delete Bun.env.HANASAND_AI_API_BASE;
    const store = new InMemoryScraperStore();
    const generatedAt = new Date().toISOString();
    store.saveSource({
      ...source("src_recent", "https://security.example.test/recent.xml"),
      status: "active",
      crawlState: { retryCount: 0, lastCollectedAt: generatedAt }
    } as any);
    store.saveSource({
      ...source("src_due", "https://security.example.test/due.xml"),
      status: "active",
      crawlState: { retryCount: 2, lastErrorAt: generatedAt, lastError: "HTTP 429", nextEligibleAt: generatedAt }
    } as any);
    store.saveRun({
      id: "run_recent",
      requestId: "req_public_canary",
      status: "completed",
      sourceCount: 2,
      captureCount: 1,
      exposureClaimCount: 1,
      createdAt: generatedAt,
      updatedAt: generatedAt
    });

    try {
      const response = await handleApiRequest(new Request("http://local/v1/ops/collection-scheduler"), {
        store,
        frontier: new FocusedFrontier(),
        sourceBootstrap: {
          generatedAt,
          sourceTarget: 2,
          seedPaths: [],
          importedSourceCount: 2,
          skippedSourceCount: 0,
          activeSourceCount: 2,
          totalSourceCount: 2,
          shortfall: 0,
          errors: []
        }
      } as any);
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.decision).toBe("degraded");
      expect(body.operationalBlockers.map((item: any) => item.code)).toEqual(expect.arrayContaining([
        "daily_coverage_below_target",
        "parser_endpoint_missing",
        "scheduler_loop_unattached"
      ]));
      expect(body.sourceCoverage).toMatchObject({
        sourceTarget: 2,
        totalSourceCount: 2,
        sourceShortfall: 0,
        activeSourceCount: 2,
        dailySourceCount: 2,
        dailyAttemptedCount: 2,
        dailyCoveredCount: 1
      });
      expect(body.scheduler.lastSuccessfulRun.id).toBe("run_recent");
      expect(Date.parse(body.scheduler.nextRunAt)).toBeGreaterThan(Date.parse(generatedAt));
      expect(body.parser.aiEndpointConfigured).toBe(false);
      expect(body.sources.find((item: any) => item.sourceId === "src_due").retryCount).toBe(2);
    } finally {
      if (originalAiBase === undefined) delete Bun.env.HANASAND_AI_API_BASE;
      else Bun.env.HANASAND_AI_API_BASE = originalAiBase;
    }
  });
});

function source(id: string, url: string) {
  return {
    id,
    tenantId: "default",
    name: id,
    type: "rss",
    url,
    accessMethod: "public_http",
    status: "candidate",
    risk: "low",
    trustScore: 0.82,
    crawlFrequencySeconds: 300,
    legalNotes: "Public security source with safe metadata collection basis.",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z"
  };
}
