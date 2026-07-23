import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, FileBackedScraperStore, fixtureCapture, FocusedFrontier, handleApiRequest, InMemoryScraperStore, join, mkdtempSync, rmSync, runCanaryCollectionCycle, test } from "./apiTestHarness.ts";
import { tmpdir } from "node:os";
import { bootstrapRuntimeSources } from "../runtime/sourceBootstrap.ts";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("runtime source bootstrap and scheduler monitoring", () => {
  test("keeps dry-run source-atlas candidates out of automatic production bootstrap", () => {
    const result = bootstrapRuntimeSources(new InMemoryScraperStore());
    const compose = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../../docker-compose.yml"), "utf8");
    expect(result.seedPaths.some((path) => path.endsWith("high_value_exposure_source_candidates.json"))).toBe(false);
    expect(result.errors.some((error) => error.path.endsWith("high_value_exposure_source_candidates.json"))).toBe(false);
    expect(compose.match(/TI_SOURCE_SEED_PATHS:.*high_value_exposure_source_candidates/)).toBeNull();
  });

  test("bootstraps the canonical MITRE APT29 source with fixed-query metadata", () => {
    const store = new InMemoryScraperStore();
    const seedPath = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/public_cti_starter_pack.json");

    bootstrapRuntimeSources(store, { seedPaths: [seedPath] });

    expect(store.listSources().find((source) => source.id === "src_seed_mitre_attack_apt29")).toMatchObject({
      url: "https://attack.mitre.org/groups/G0016/",
      status: "active",
      metadata: { queryTerm: "APT29", queryClass: "threat-intel", productionCollection: true }
    });
  });

  test("imports configured executable sources without rewarding raw registry size", () => {
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
        generatedAt: "2026-07-02T00:00:00.000Z"
      });

      expect(result.importedSourceCount).toBe(2);
      expect(result.totalSourceCount).toBe(2);
      expect(result.activeSourceCount).toBe(2);
      expect(result.retainedSourceCount).toBe(2);
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
        generatedAt: "2026-07-02T00:00:00.000Z"
      });
      const [sourceRecord] = store.listSources() as any[];

      expect(result.importedSourceCount).toBe(1);
      expect(result.activeSourceCount).toBe(0);
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

  test("upgrades a matching low-risk tenant Telegram candidate after independent source approval", () => {
    const store = new InMemoryScraperStore();
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-verified-"));
    const seedPath = join(dir, "verified.json");
    store.saveSource({
      id: "src_catalog_candidate",
      tenantId: "default",
      name: "Catalog candidate",
      type: "telegram_public",
      url: "https://t.me/example_verified",
      accessMethod: "public_http",
      status: "canary",
      risk: "low",
      trustScore: 0.6,
      crawlFrequencySeconds: 1800,
      legalNotes: "Pending source review.",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      metadata: { canaryPortfolio: true }
    } as any);
    writeFileSync(seedPath, JSON.stringify({
      version: 1,
      name: "verified source",
      sources: [{
        id: "src_verified_reference",
        tenantId: "default",
        name: "Verified public channel",
        type: "telegram_public",
        url: "https://t.me/example_verified",
        accessMethod: "public_http",
        status: "active",
        risk: "low",
        trustScore: 0.9,
        crawlFrequencySeconds: 900,
        legalNotes: "Reviewed public preview; no authentication or media retrieval.",
        governance: { approvalRequired: true, approvalState: "approved", approvalScope: "official_public_web_preview", metadataOnly: false, approvedAt: "2026-07-20T00:00:00.000Z", approvedBy: "source-review:test", policyVersion: "collection-policy:v1" },
        metadata: { collectionMode: "public_web_preview", productionCollection: true, mediaPolicy: "metadata_only_no_download" }
      }]
    }));

    try {
      const result = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-21T00:00:00.000Z" });
      expect(result).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 1, skippedSourceCount: 0, activeSourceCount: 1, totalSourceCount: 1 });
      expect(store.listSources()[0]).toMatchObject({
        id: "src_catalog_candidate",
        name: "Verified public channel",
        status: "active",
        risk: "low",
        governance: { approvalState: "approved" },
        metadata: { collectionMode: "public_web_preview", productionCollection: true, verifiedSourceId: "src_verified_reference" }
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reconciles authoritative actor catalogs under stable source IDs and schedules them after restart", async () => {
    const catalogSeedPath = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/verified_long_lived_sources.json");
    const verifiedBundle = JSON.parse(readFileSync(catalogSeedPath, "utf8"));
    const verifiedSources = ["src_mitre_attack_enterprise_stix", "src_ransomwarelive_current_operations_catalog"]
      .map((id) => verifiedBundle.sources.find((source: any) => source.id === id));
    expect(verifiedSources.every(Boolean)).toBe(true);

    const tenantId = "tenant_gate1";
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-catalogs-"));
    const seedPath = join(dir, "verified-catalogs.json");
    const sources = verifiedSources.map((source: any) => ({ ...source, tenantId }));
    writeFileSync(seedPath, JSON.stringify({ version: 1, name: "verified actor catalogs", sources }));

    const store = new InMemoryScraperStore();
    const history = [
      {
        id: "src_legacy_mitre_catalog",
        createdAt: "2026-06-01T00:00:00.000Z",
        lastSeenAt: "2026-07-19T12:00:00.000Z",
        health: { status: "degraded", checkedAt: "2026-07-20T12:00:00.000Z", lastSuccessAt: "2026-07-19T12:00:00.000Z", consecutiveFailures: 2 },
        crawlState: { retryCount: 2, lastCollectedAt: "2026-07-19T12:00:00.000Z", lastError: "legacy parser missing", nextEligibleAt: "2026-07-21T00:00:00.000Z" }
      },
      {
        id: "src_legacy_ransomwarelive_catalog",
        createdAt: "2026-06-02T00:00:00.000Z",
        lastSeenAt: "2026-07-20T06:00:00.000Z",
        health: { status: "healthy", checkedAt: "2026-07-20T06:00:00.000Z", lastSuccessAt: "2026-07-20T06:00:00.000Z", consecutiveFailures: 0 },
        crawlState: { retryCount: 0, lastCollectedAt: "2026-07-20T06:00:00.000Z", nextEligibleAt: "2026-07-21T00:00:00.000Z" }
      }
    ];
    sources.forEach((verified: any, index: number) => store.saveSource({
      ...verified,
      id: history[index].id,
      name: `Stale ${verified.name}`,
      status: "candidate",
      risk: "low",
      trustScore: 0.4,
      crawlFrequencySeconds: 3600,
      governance: undefined,
      metadata: { legacyCatalogCandidate: true },
      createdAt: history[index].createdAt,
      updatedAt: "2026-07-01T00:00:00.000Z",
      lastSeenAt: history[index].lastSeenAt,
      health: history[index].health,
      crawlState: history[index].crawlState
    } as any));

    try {
      const first = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-21T12:00:00.000Z" });
      expect(first).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 2, skippedSourceCount: 0, activeSourceCount: 2, totalSourceCount: 2 });
      expect(store.getSource(history[0].id)).toMatchObject({
        id: history[0].id,
        tenantId,
        createdAt: history[0].createdAt,
        lastSeenAt: history[0].lastSeenAt,
        crawlFrequencySeconds: 86400,
        status: "active",
        governance: { approvalState: "approved" },
        metadata: { extractionProfile: "mitre_actor_catalog", productionCollection: true, verifiedSourceId: sources[0].id },
        health: history[0].health,
        crawlState: history[0].crawlState
      });
      expect(store.getSource(history[1].id)).toMatchObject({
        id: history[1].id,
        tenantId,
        createdAt: history[1].createdAt,
        lastSeenAt: history[1].lastSeenAt,
        crawlFrequencySeconds: 43200,
        status: "active",
        governance: { approvalState: "approved" },
        metadata: { extractionProfile: "ransomware_operation_catalog", productionCollection: true, verifiedSourceId: sources[1].id },
        health: history[1].health,
        crawlState: history[1].crawlState
      });
      expect(store.listSources().some((source) => verifiedSources.some((verified: any) => verified.id === source.id))).toBe(false);

      const afterFirstBootstrap = structuredClone(store.listSources());
      const second = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-22T12:00:00.000Z" });
      expect(second).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: 2, totalSourceCount: 2 });
      expect(store.listSources()).toEqual(afterFirstBootstrap);

      const cycle = await runCanaryCollectionCycle({
        store,
        frontier: new FocusedFrontier(),
        tenantId,
        sourceIds: history.map((source) => source.id),
        maxSources: 2,
        maxTasks: 2,
        now: () => "2026-07-22T12:00:00.000Z",
        fetch: async () => { throw new Error("scheduler eligibility probe"); }
      } as any);
      expect(cycle).toMatchObject({ activeSourceCount: 2, queuedTaskCount: 2, leasedTaskCount: 2, failedTaskCount: 2 });
      expect(store.listRuns().find((run: any) => run.id === cycle.runId)?.taskCount).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("leaves every unsafe or pending duplicate untouched", () => {
    const catalogSeedPath = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/verified_long_lived_sources.json");
    const verified = JSON.parse(readFileSync(catalogSeedPath, "utf8")).sources
      .find((source: any) => source.id === "src_mitre_attack_enterprise_stix");
    expect(verified).toBeTruthy();
    const unsafeVariants = [
      { risk: "medium" },
      { risk: "high" },
      { risk: "restricted" },
      { accessMethod: "api_key" },
      { governance: { approvalState: "pending" } },
      { metadata: { productionCollection: false } },
      { metadata: { private: true } },
      { metadata: { inviteOnly: true } },
      { metadata: { authRequired: true } },
      { metadata: { captchaRequired: true } },
      { metadata: { generatedPublicSourcePack: true } },
      { metadata: { paddedSourcePack: true } },
      { url: "http://127.0.0.1/private-catalog.json" }
    ];
    const tenantId = "tenant_unsafe";
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-unsafe-"));
    const seedPath = join(dir, "verified-catalogs.json");
    const seeds = unsafeVariants.map((_, index) => ({
      ...verified,
      id: `src_verified_catalog_${index}`,
      tenantId,
      url: (unsafeVariants[index] as any).url ?? `https://catalog.example.test/actor-${index}.json`
    }));
    writeFileSync(seedPath, JSON.stringify({ version: 1, name: "verified actor catalogs", sources: seeds }));
    const store = new InMemoryScraperStore();
    seeds.forEach((seed: any, index: number) => {
      const variant: any = unsafeVariants[index];
      store.saveSource({
        ...seed,
        id: `src_unsafe_existing_${index}`,
        name: `Unsafe existing ${index}`,
        status: "candidate",
        risk: "low",
        governance: undefined,
        metadata: { unsafeMarker: index, ...(variant.metadata ?? {}) },
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        ...variant,
        ...(variant.metadata ? { metadata: { unsafeMarker: index, ...variant.metadata } } : {})
      } as any);
    });
    const before = structuredClone(store.listSources());

    try {
      const result = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-21T12:00:00.000Z" });
      expect(result).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: unsafeVariants.length, totalSourceCount: unsafeVariants.length });
      expect(store.listSources()).toEqual(before);
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
      reviewedRejectedCandidates: [],
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
      const result = bootstrapRuntimeSources(store, { seedPaths: [invalidPath, restrictedPath], generatedAt: "2026-07-20T00:00:00.000Z" });
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

  test("activates only recently parser-verified Tor metadata and preserves restart state", () => {
    const previous = Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
    Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = "true";
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-verified-tor-"));
    const snapshotPath = join(dir, "store.json");
    const store = new FileBackedScraperStore({ snapshotPath });
    const seedPath = join(dir, "restricted.json");
    const onion = (letter: string) => `http://${letter.repeat(56)}.onion/`;
    const restrictedSource = (id: string, url: string, verifiedAt: string) => ({
      id,
      name: id,
      type: "tor_metadata",
      url,
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: "restricted",
      trustScore: 0.8,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public victim-listing metadata only; never retrieve leaked files or interact with operators.",
      governance: { approvalRequired: true, approvalState: "approved", metadataOnly: true, approvalScope: "metadata_only", approvedAt: verifiedAt, approvedBy: "source-review:test", policyVersion: "collection-policy:v1" },
      metadata: {
        sourceFamily: "dark_web_victim_feed",
        actorName: id,
        discoveryAuthorityUrl: "https://authority.example.test/",
        discoveryAuthorityRecordUrl: `https://authority.example.test/${id}`,
        discoveryCheckedAt: verifiedAt,
        discoveryAvailability: "reported_available",
        expectedPageRole: "victim_listing",
        collectionScope: "metadata_only",
        retainRawContent: false,
        retentionDays: 30,
        attribution: "Independent public authority record",
        productionCollectionVerifiedAt: verifiedAt,
        productionCollectionOutcome: "metadata_only_parser_verified",
        parserProfile: "victim_card_title",
        reportedVictimCount: 2,
        lastReportedVictimAt: verifiedAt
      }
    });
    const current = restrictedSource("src_verified_restricted", onion("b"), "2026-07-22T10:00:00.000Z");
    const stale = restrictedSource("src_stale_restricted", onion("c"), "2026-06-01T10:00:00.000Z");
    writeFileSync(seedPath, JSON.stringify({
      version: 1,
      name: "verified Tor metadata",
      disabledByDefault: true,
      network: "tor",
      proxyBoundaryId: "tor-approved-metadata-proxy",
      approvalScope: "metadata_only",
      retentionClass: "restricted_metadata",
      forbiddenOperations: ["credential_bypass", "captcha_solving", "threat_actor_interaction", "stolen_file_download", "stealth_or_evasion", "unapproved_proxy", "non_metadata_capture"],
      reviewedRejectedCandidates: [],
      sources: [current, stale]
    }));
    store.saveSource({
      ...current,
      id: "src_existing_candidate",
      status: "candidate",
      governance: { ...current.governance, approvalState: "pending" },
      metadata: { sourceFamily: "dark_web_victim_feed", restrictedMetadataCandidate: true, productionCollection: false },
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      health: { status: "degraded", checkedAt: "2026-07-21T00:00:00.000Z", consecutiveFailures: 1 },
      crawlState: { retryCount: 1, nextEligibleAt: "2026-07-22T12:00:00.000Z" }
    } as any);

    try {
      const first = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-22T12:00:00.000Z" });
      expect(first).toMatchObject({ importedSourceCount: 1, updatedSourceCount: 1, activeSourceCount: 1, totalSourceCount: 2 });
      expect(store.getSource("src_existing_candidate")).toMatchObject({
        id: "src_existing_candidate",
        status: "active",
        governance: { approvalState: "approved", metadataOnly: true },
        metadata: { productionCollection: true, productionCollectionOutcome: "metadata_only_parser_verified", verifiedSourceId: "src_verified_restricted" },
        health: { status: "degraded", consecutiveFailures: 1 },
        crawlState: { retryCount: 1 }
      });
      expect(store.getSource("src_stale_restricted")).toMatchObject({ status: "candidate", metadata: { productionCollection: false, restrictedMetadataCandidate: true } });

      const beforeRestart = structuredClone(store.listSources());
      const restarted = new FileBackedScraperStore({ snapshotPath });
      const second = bootstrapRuntimeSources(restarted, { seedPaths: [seedPath], generatedAt: "2026-07-22T13:00:00.000Z" });
      expect(second).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: 2, activeSourceCount: 1, totalSourceCount: 2 });
      expect(restarted.listSources()).toEqual(beforeRestart);
    } finally {
      if (previous === undefined) delete Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
      else Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("withdraws executable Tor sources when real-pack verification expires or revalidation fails", () => {
    const previous = Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
    Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = "true";
    const dir = mkdtempSync(join(tmpdir(), "hanasand-source-bootstrap-tor-expiry-"));
    const snapshotPath = join(dir, "store.json");
    const seedPath = join(dir, "restricted.json");
    const realSeedPath = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/restricted_metadata_source_packs.json");
    const bundle = JSON.parse(readFileSync(realSeedPath, "utf8"));
    writeFileSync(seedPath, JSON.stringify(bundle));
    const store = new FileBackedScraperStore({ snapshotPath });

    try {
      const first = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-23T12:00:00.000Z" });
      expect(first).toMatchObject({ importedSourceCount: 6, activeSourceCount: 6, totalSourceCount: 6 });
      for (const source of store.listSources().filter((item: any) => item.metadata?.transportCanary !== true)) {
        store.saveSource({ ...source, health: { status: "healthy", checkedAt: "2026-07-23T12:30:00.000Z", consecutiveFailures: 0 }, crawlState: { retryCount: 2, backoffUntil: "2026-07-23T13:00:00.000Z" } });
      }
      store.saveCapture(fixtureCapture({ id: "cap_retained_tor_metadata", sourceId: "restricted_safepay_victim_blog", storageKind: "metadata_only", body: undefined, sensitive: true }));

      const failed = structuredClone(bundle);
      failed.sources.find((source: any) => source.id === "restricted_safepay_victim_blog").metadata.discoveryAvailability = "unknown";
      failed.sources.find((source: any) => source.id === "restricted_space_bears_victim_blog").governance.approvalState = "pending";
      failed.sources.find((source: any) => source.id === "restricted_qilin_victim_blog").metadata.discoveryAvailability = "reported_unavailable";
      writeFileSync(seedPath, JSON.stringify(failed));
      const revalidated = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-23T13:00:00.000Z" });
      expect(revalidated).toMatchObject({ updatedSourceCount: 3, skippedSourceCount: 3, activeSourceCount: 3, totalSourceCount: 6 });
      expect(["restricted_safepay_victim_blog", "restricted_space_bears_victim_blog", "restricted_qilin_victim_blog"].every((id) => {
        const source = store.getSource(id);
        return source?.status === "candidate" && source.metadata?.productionCollection === false && source.metadata?.restrictedMetadataCandidate === true
          && !("verifiedSourceId" in source.metadata);
      })).toBe(true);

      writeFileSync(seedPath, JSON.stringify(bundle));
      const fresh = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-23T14:00:00.000Z" });
      expect(fresh).toMatchObject({ updatedSourceCount: 3, skippedSourceCount: 3, activeSourceCount: 6, totalSourceCount: 6 });
      expect(store.listSources().filter((item: any) => item.metadata?.transportCanary !== true).every((source: any) => source.metadata.verifiedSourceId === source.id
        && !("restrictedMetadataCandidate" in source.metadata))).toBe(true);

      const expired = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-08-01T00:00:00.000Z" });
      expect(expired).toMatchObject({ updatedSourceCount: 5, skippedSourceCount: 1, activeSourceCount: 1, totalSourceCount: 6 });
      expect(store.listSources().filter((item: any) => item.metadata?.transportCanary !== true).every((source: any) => source.status === "candidate"
        && source.metadata.productionCollection === false
        && source.metadata.restrictedMetadataCandidate === true
        && !("verifiedSourceId" in source.metadata)
        && source.health?.status === "healthy"
        && source.crawlState?.retryCount === 2)).toBe(true);

      const restarted = new FileBackedScraperStore({ snapshotPath });
      const repeat = bootstrapRuntimeSources(restarted, { seedPaths: [seedPath], generatedAt: "2026-08-01T01:00:00.000Z" });
      expect(repeat).toMatchObject({ importedSourceCount: 0, updatedSourceCount: 0, skippedSourceCount: 6, activeSourceCount: 1, totalSourceCount: 6 });
      expect(restarted.listSources().filter((item: any) => item.metadata?.transportCanary !== true).every((source: any) => !("verifiedSourceId" in source.metadata)
        && source.metadata.restrictedMetadataCandidate === true)).toBe(true);
      expect(restarted.listCaptures().map((capture: any) => capture.id)).toEqual(["cap_retained_tor_metadata"]);
    } finally {
      if (previous === undefined) delete Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES;
      else Bun.env.TI_IMPORT_RESTRICTED_METADATA_SOURCES = previous;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("uses one canonical Google News provider for query jobs", async () => {
    const seedPath = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/verified_query_providers.json");
    const store = new InMemoryScraperStore();
    const result = bootstrapRuntimeSources(store, { seedPaths: [seedPath], generatedAt: "2026-07-22T00:00:00.000Z" });
    expect(result).toMatchObject({ importedSourceCount: 1, totalSourceCount: 1, activeSourceCount: 1, retainedSourceCount: 1 });
    expect(store.listSources()[0]).toMatchObject({ id: "src_google_news_threat_search", metadata: { healthQuery: "cybersecurity threat intelligence" } });

    const cycle = await runCanaryCollectionCycle({
      store,
      frontier: new FocusedFrontier(),
      maxSources: 1,
      maxTasks: 1,
      now: () => "2026-07-22T00:00:00.000Z",
      fetch: async (url: string) => new Response("<rss><channel></channel></rss>", { status: 200, headers: { "content-type": "application/rss+xml" } })
    } as any);
    expect(cycle.queuedTaskCount).toBe(1);
    const task = store.listRuns().find((run: any) => run.id === cycle.runId);
    expect(task?.failedTaskCount).toBe(0);
    expect(store.getSource("src_google_news_threat_search")?.lastSeenAt).toBe("2026-07-22T00:00:00.000Z");
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
    store.saveSourceHealthObservation({ id: "health_recent", tenantId: "default", sourceId: "src_recent", checkedAt: generatedAt, status: "healthy", success: true, useful: true, itemCount: 1, captureCount: 1, incidentCount: 0, duplicateCount: 0, parserWarningCount: 0 });
    store.saveSourceHealthObservation({ id: "health_due", tenantId: "default", sourceId: "src_due", checkedAt: generatedAt, status: "failed", success: false, useful: false, itemCount: 0, captureCount: 0, incidentCount: 0, duplicateCount: 0, parserWarningCount: 0, failureReason: "HTTP 429" });
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
          seedPaths: [],
          importedSourceCount: 2,
          updatedSourceCount: 0,
          skippedSourceCount: 0,
          activeSourceCount: 2,
          retainedSourceCount: 2,
          totalSourceCount: 2,
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
        totalSourceCount: 2,
        retainedSourceCount: 2,
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

  test("returns the complete executable fleet instead of truncating health rows", async () => {
    const store = new InMemoryScraperStore();
    for (let index = 0; index < 260; index++) store.saveSource({ ...source(`src_full_${index}`, `https://security.example.test/${index}.xml`), status: "active" } as any);

    const response = await handleApiRequest(new Request("http://local/v1/ops/collection-scheduler"), { store, frontier: new FocusedFrontier() } as any);
    const body = await response.json() as any;

    expect(body.sourceCoverage).toMatchObject({ totalSourceCount: 260, retainedSourceCount: 260, activeSourceCount: 260, neverObservedSourceCount: 260 });
    expect(body.sources).toHaveLength(260);
    expect(Object.values(body.sourceHealth).reduce((total: number, count: any) => total + count, 0)).toBe(260);
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
