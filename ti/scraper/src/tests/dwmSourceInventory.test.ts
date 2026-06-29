import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { applyDwmSeedCatalog, buildDwmSeedCatalog, buildDwmSourceInventory } from "../product/dwmSourceInventory.ts";
import { FileBackedDwmSourcePackWorkerStateAdapter, InMemoryDwmSourcePackRegistryAdapter } from "../storage/dwmSourcePackRegistry.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { SourceRecord } from "../types.ts";

const generatedAt = "2026-06-27T12:00:00.000Z";

describe("dwm source inventory", () => {
  test("generates public Telegram and metadata-only dark-web seed catalogs", () => {
    const catalog = buildDwmSeedCatalog({ watchlist: ["acme.com", "Acme Payments"], generatedAt });

    expect(catalog.packs.length).toBeGreaterThanOrEqual(5);
    expect(catalog.candidates.filter((candidate) => candidate.family === "telegram_public").length).toBeGreaterThanOrEqual(3000);
    expect(catalog.candidates.filter((candidate) => candidate.family === "darkweb_metadata").length).toBeGreaterThanOrEqual(4000);
    expect(catalog.candidates.every((candidate) => candidate.source.metadata.mediaPolicy === "metadata_only_no_download")).toBe(true);
    expect(catalog.candidates.find((candidate) => candidate.family === "darkweb_metadata")?.source.legalNotes).toContain("No credential bypass");
  });

  test("dedupes registered sources into review workflow instead of creating duplicate candidates", () => {
    const existing: SourceRecord = {
      id: "src_existing_tg",
      name: "Existing ransomware live",
      type: "telegram_public",
      url: "https://t.me/ransomwarelive",
      accessMethod: "public_http",
      status: "active",
      trustScore: 0.8,
      legalNotes: "Public preview only.",
      createdAt: generatedAt,
      updatedAt: generatedAt
    } as SourceRecord;

    const inventory = buildDwmSourceInventory({ sources: [existing], watchlist: ["acme.com"], generatedAt, includeCandidates: true });

    expect(inventory.counts.registeredTelegramPublic).toBe(1);
    expect(inventory.counts.duplicateCandidates).toBeGreaterThanOrEqual(1);
    expect(inventory.reviewQueue.some((item) => item.reviewState === "blocked_duplicate" && item.duplicateOf === "src_existing_tg")).toBe(true);
  });

  test("applies Telegram seed packs as canary-safe sources and reports duplicates", () => {
    const store = new InMemoryScraperStore();
    const first = applyDwmSeedCatalog({
      store,
      seedPackIds: ["telegram-ransomware-claim-watch"],
      watchlist: ["acme.com"],
      activate: true,
      limit: 12,
      generatedAt
    });
    const second = applyDwmSeedCatalog({
      store,
      seedPackIds: ["telegram-ransomware-claim-watch"],
      activate: true,
      limit: 12,
      generatedAt
    });

    expect(first.summary.createdCount).toBe(12);
    expect(first.summary.telegramPublicCreated).toBe(12);
    expect(first.createdSources.every((source) => source.status === "canary")).toBe(true);
    expect(first.createdSources.every((source) => source.metadata.collectionBoundary.noPrivateAccess === true)).toBe(true);
    expect(second.summary.createdCount).toBe(0);
    expect(second.summary.duplicateCount).toBe(12);
  });

  test("approves dark-web seed packs as metadata-only active sources", () => {
    const store = new InMemoryScraperStore();
    const first = applyDwmSeedCatalog({
      store,
      seedPackIds: ["darkweb-actor-metadata-core"],
      activate: true,
      approveMetadataOnly: true,
      approvedBy: "analyst-1",
      limit: 6,
      generatedAt
    });
    const second = applyDwmSeedCatalog({
      store,
      seedPackIds: ["darkweb-actor-metadata-core"],
      activate: true,
      approveMetadataOnly: true,
      approvedBy: "analyst-1",
      limit: 6,
      generatedAt: "2026-06-27T12:30:00.000Z"
    });

    expect(first.summary.createdCount).toBe(6);
    expect(first.summary.darkwebMetadataCreated).toBe(6);
    expect(first.createdSources.every((source) => source.status === "active")).toBe(true);
    expect(first.createdSources.every((source) => source.governance?.metadataOnly === true)).toBe(true);
    expect(first.createdSources.every((source) => source.governance?.approvalState === "approved")).toBe(true);
    expect(second.summary.createdCount).toBe(6);
    expect(second.summary.duplicateCount).toBe(0);
    expect(store.listSources().filter((source) => source.type === "darkweb_metadata")).toHaveLength(6);
    expect(store.listSources().every((source) => source.metadata?.metadataOnlyApproved === true)).toBe(true);
  });

  test("mounts source pack and source inventory API routes", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const applyResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ seedPackIds: ["telegram-stealer-broker-watch"], activate: true, limit: 10, scope: "acme.com" })
    }), options);
    const applyBody = await applyResponse.json() as any;
    const inventoryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?watchlist=acme.com"), options);
    const inventoryBody = await inventoryResponse.json() as any;
    const packsResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-packs"), options);
    const packsBody = await packsResponse.json() as any;

    expect(applyResponse.status).toBe(201);
    expect(applyBody.summary.createdCount).toBe(10);
    expect(inventoryBody.schemaVersion).toBe("dwm.source_inventory.v1");
    expect(inventoryBody.counts.registeredTelegramPublic).toBe(10);
    expect(packsBody.counts.telegramPublic).toBeGreaterThanOrEqual(3000);
  });

  test("exposes missing worker readiness as a proxy-verifiable blocked state", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const inventory = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?full=true&watchlist=APT29"), options);
    const inventoryBody = await inventory.json() as any;
    const packs = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-packs?terms=APT29"), options);
    const packsBody = await packs.json() as any;

    expect(inventory.status).toBe(200);
    expect(inventoryBody.sourcePackWorker).toMatchObject({
      freshness: "missing",
      readiness: {
        state: "missing",
        blockers: expect.arrayContaining(["source-pack worker has not run"])
      },
      safeOutput: {
        rawUnsafeRowsStored: false,
        rawTargetsExposed: false,
        privateTelegramContentExposed: false,
        restrictedMetadataLeaked: false,
        liveNetworkScrapeStarted: false
      },
      proxyVerification: {
        schemaVersion: "dwm.source_pack_worker_proxy_verification.v1",
        state: "missing"
      },
      sourceHealth: {
        schemaVersion: "dwm.source_health_operations.v1",
        candidateStates: { accepted: 0, rejected: 0, duplicate: 0, retryable: 0, unretryable: 0 },
        sourcePackGrowthDeltas: { packCount: 0, candidateCount: 0, activeSourceRows: 0 },
        safeOutput: { liveNetworkScrapeStarted: false }
      }
    });
    expect(inventoryBody.sourcePackWorker.proxyVerification.requiredJsonPaths).toEqual(expect.arrayContaining([
      "sourceInventory.sourcePackWorker.freshness",
      "sourceInventory.sourcePackWorker.safeOutput.liveNetworkScrapeStarted",
      "sourcePacks.proxyVerification.state"
    ]));
    expect(inventoryBody.sourcePackWorker.proxyVerification.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "safe_output_no_live_network", status: "pass" }),
      expect.objectContaining({ id: "rejected_candidates_redacted", status: "pass" }),
      expect.objectContaining({ id: "pack_ids_redacted", status: "pass" })
    ]));
    expect(packsBody).toMatchObject({
      readiness: { state: "missing" },
      proxyVerification: { state: "missing" },
      sourceHealth: {
        schemaVersion: "dwm.source_health_operations.v1",
        safeOutput: { liveNetworkScrapeStarted: false }
      },
      safeOutput: { liveNetworkScrapeStarted: false }
    });
  });

  test("exposes source health operations blockers and retry state without live scraping", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "source-health-ops-"));
    try {
      const store = new InMemoryScraperStore();
      const sourcePackRegistry = new InMemoryDwmSourcePackRegistryAdapter();
      const workerState = new FileBackedDwmSourcePackWorkerStateAdapter({ snapshotPath: join(tmp, "worker-state.json") });
      const options = {
        store,
        frontier: new FocusedFrontier(),
        sourcePackRegistry,
        sourcePackValidationQueue: workerState.validationQueue,
        sourcePackActiveSourceStore: workerState.activeSources,
        sourcePackWorkerRunStore: workerState.workerRuns,
        sourcePackCollectionReceiptStore: workerState.collectionReceipts
      };

      const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
        method: "POST",
        body: JSON.stringify({
          sourcePackId: "pack_source_health_ops",
          sourcePackLabel: "Source health operations pack",
          tenantId: "tenant_source_health",
          scope: "APT29",
          requestedBy: "source-health-worker",
          candidates: [
            { target: "@source_health_active_public", type: "telegram_channel", family: "telegram" },
            { target: "@source_health_retry_public", type: "telegram_channel", family: "telegram", parserExpectation: "retry_fixture" },
            { target: "@source_health_active_public", type: "telegram_channel", family: "telegram" },
            { target: "metadata://darkweb/password-dump", type: "restricted_metadata", family: "darkweb_onion" }
          ]
        })
      }), options);
      const createdBody = await created.json() as any;
      expect(created.status).toBe(201);
      expect(createdBody.summary).toMatchObject({ acceptedCount: 2, rejectedCount: 1, duplicateCount: 1 });

      const run = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
        method: "POST",
        body: JSON.stringify({ action: "pack_worker_run", sourcePackId: "pack_source_health_ops", chunkSize: 10 })
      }), options);
      const runBody = await run.json() as any;
      expect(run.status).toBe(200);
      expect(runBody.collectionQueue.summary).toMatchObject({ queuedCount: 1, duplicateCount: 0, taskCount: 1 });

      const reloadedWorkerState = new FileBackedDwmSourcePackWorkerStateAdapter({ snapshotPath: join(tmp, "worker-state.json") });
      const reloadedOptions = {
        store,
        frontier: new FocusedFrontier(),
        sourcePackRegistry,
        sourcePackValidationQueue: reloadedWorkerState.validationQueue,
        sourcePackActiveSourceStore: reloadedWorkerState.activeSources,
        sourcePackWorkerRunStore: reloadedWorkerState.workerRuns,
        sourcePackCollectionReceiptStore: reloadedWorkerState.collectionReceipts
      };
      const inventory = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?full=true&watchlist=APT29"), reloadedOptions);
      const inventoryBody = await inventory.json() as any;
      const packs = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-packs?terms=APT29"), reloadedOptions);
      const packsBody = await packs.json() as any;
      const health = inventoryBody.sourcePackWorker.sourceHealth;

      expect(inventory.status).toBe(200);
      expect(health).toMatchObject({
        schemaVersion: "dwm.source_health_operations.v1",
        candidateStates: {
          duplicate: 1,
          retryable: 1
        },
        sourcePackGrowthDeltas: {
          packCount: 1,
          candidateCount: 4,
          activeSourceRows: 1,
          queuedCollectionReceipts: 1
        },
        safeOutput: {
          privateTelegramContentExposed: false,
          restrictedMetadataLeaked: false,
          liveNetworkScrapeStarted: false,
          restrictedPayloadDownloadAllowed: false
        }
      });
      expect(health.family.telegram).toMatchObject({
        candidateCount: 3,
        activeCount: 1,
        duplicateCount: 1,
        retryableCount: 1,
        parserStatusCounts: expect.objectContaining({
          telegram_public_parser_ready: 1,
          parser_retry_scheduled: 1,
          duplicate_skipped: 1
        }),
        lastWorkerReceipt: expect.objectContaining({ targetRawStored: false, status: "queued" })
      });
      expect(health.family.darkweb_onion).toMatchObject({
        candidateCount: 1,
        activeCount: 0,
        unretryableCount: 1,
        rejectionReasons: expect.arrayContaining([
          expect.objectContaining({ status: "disabled", retryable: false })
        ])
      });
      expect(health.typedBlockers).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "parser_failure", family: "telegram", retryable: true }),
        expect.objectContaining({ code: "duplicate_source", family: "telegram", retryable: false }),
        expect.objectContaining({ code: "parser_failure", family: "darkweb_onion", retryable: false }),
        expect.objectContaining({ code: "no_active_source_family", family: "darkweb_onion", retryable: true })
      ]));
      expect(inventoryBody.sourcePackWorker.proxyVerification.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "source_health_present", status: "pass" }),
        expect.objectContaining({ id: "source_health_blockers_typed", status: "pass" })
      ]));
      expect(packsBody.sourceHealth).toMatchObject({
        schemaVersion: "dwm.source_health_operations.v1",
        sourcePackGrowthDeltas: { queuedCollectionReceipts: 1 },
        safeOutput: { liveNetworkScrapeStarted: false }
      });
      expect(JSON.stringify(health)).not.toContain("password-dump");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("exposes restart-safe source-pack worker readiness for dashboard proxy consumption", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "source-pack-worker-proof-"));
    try {
      const store = new InMemoryScraperStore();
      const sourcePackRegistry = new InMemoryDwmSourcePackRegistryAdapter();
      const workerStatePath = join(tmp, "worker-state.json");
      const workerState = new FileBackedDwmSourcePackWorkerStateAdapter({ snapshotPath: workerStatePath });
      const options = {
        store,
        frontier: new FocusedFrontier(),
        sourcePackRegistry,
        sourcePackValidationQueue: workerState.validationQueue,
        sourcePackActiveSourceStore: workerState.activeSources,
        sourcePackWorkerRunStore: workerState.workerRuns,
        sourcePackCollectionReceiptStore: workerState.collectionReceipts
      };

      const created = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
        method: "POST",
        body: JSON.stringify({
          sourcePackId: "pack_inventory_worker_ready",
          sourcePackLabel: "Inventory worker proof pack",
          tenantId: "tenant_inventory",
          scope: "APT29",
          requestedBy: "source-growth-worker",
          candidates: [
            { target: "@inventory_worker_public_cti", type: "telegram_channel", family: "telegram" },
            { target: "metadata://darkweb/apt29/claims", type: "restricted_metadata", family: "darkweb_metadata" },
            { target: "@inventory_worker_public_cti", type: "telegram_channel", family: "telegram" },
            { target: "metadata://darkweb/password-dump", type: "restricted_metadata", family: "darkweb_onion" }
          ]
        })
      }), options);
      const createdBody = await created.json() as any;
      expect(created.status).toBe(201);
      expect(createdBody.summary).toMatchObject({ acceptedCount: 2, rejectedCount: 1, duplicateCount: 1 });

      const firstRun = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
        method: "POST",
        body: JSON.stringify({ action: "pack_worker_run", sourcePackId: "pack_inventory_worker_ready", chunkSize: 2 })
      }), options);
      const firstRunBody = await firstRun.json() as any;
      expect(firstRun.status).toBe(200);
      expect(firstRunBody.collectionQueue.summary).toMatchObject({ queuedCount: 2, duplicateCount: 0, taskCount: 2 });
      expect(options.frontier.snapshot()).toHaveLength(2);

      const reloadedWorkerState = new FileBackedDwmSourcePackWorkerStateAdapter({ snapshotPath: workerStatePath });
      const reloadedOptions = {
        store,
        frontier: new FocusedFrontier(),
        sourcePackRegistry,
        sourcePackValidationQueue: reloadedWorkerState.validationQueue,
        sourcePackActiveSourceStore: reloadedWorkerState.activeSources,
        sourcePackWorkerRunStore: reloadedWorkerState.workerRuns,
        sourcePackCollectionReceiptStore: reloadedWorkerState.collectionReceipts
      };

      const repeated = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
        method: "POST",
        body: JSON.stringify({ action: "pack_worker_run", sourcePackId: "pack_inventory_worker_ready", chunkSize: 2 })
      }), reloadedOptions);
      const repeatedBody = await repeated.json() as any;
      expect(repeated.status).toBe(200);
      expect(repeatedBody.collectionQueue.summary).toMatchObject({ queuedCount: 0, duplicateCount: 2, taskCount: 2 });
      expect(reloadedOptions.frontier.snapshot()).toHaveLength(0);

      const inventory = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?full=true&watchlist=APT29"), reloadedOptions);
      const inventoryBody = await inventory.json() as any;
      const packs = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-packs?terms=APT29"), reloadedOptions);
      const packsBody = await packs.json() as any;

      expect(inventory.status).toBe(200);
      expect(inventoryBody.sourcePackWorker).toMatchObject({
        freshness: "fresh",
        counters: {
          totalCandidates: 4,
          accepted: 2,
          restrictedBlocked: 1,
          activeSourceRows: 2,
          queuedCollectionTasks: 2,
          collectionReadyRows: 2
        },
        readiness: { state: "ready", blockers: [] },
        safeOutput: {
          privateTelegramContentExposed: false,
          restrictedMetadataLeaked: false,
          liveNetworkScrapeStarted: false
        }
      });
      expect(inventoryBody.counts.registeredTelegramPublic).toBe(1);
      expect(inventoryBody.counts.registeredDarkwebMetadata).toBe(1);
      expect(inventoryBody.sourcePackWorker.rejectedCandidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ family: "darkweb_onion", status: "disabled", reason: expect.any(String), targetRef: expect.objectContaining({ rawStored: false }) }),
        expect.objectContaining({ family: "telegram", status: "disabled", reason: expect.stringContaining("Duplicate"), targetRef: expect.objectContaining({ rawStored: false }) })
      ]));
      expect(inventoryBody.sourcePackWorker.parserSourceFamilyCounts.telegram).toMatchObject({ telegram_public_parser_ready: 1 });
      expect(Object.values(inventoryBody.sourcePackWorker.parserSourceFamilyCounts.telegram).reduce((sum: number, count: any) => sum + Number(count), 0)).toBe(2);
      expect(inventoryBody.sourcePackWorker.parserSourceFamilyCounts.darkweb_metadata).toMatchObject({ restricted_metadata_parser_ready: 1 });
      expect(inventoryBody.sourcePackWorker.parserSourceFamilyCounts.darkweb_onion).toMatchObject({ intake_blocked: 1 });
      expect(inventoryBody.sourcePackWorker.proxyVerification).toMatchObject({
        schemaVersion: "dwm.source_pack_worker_proxy_verification.v1",
        state: "ready",
        safeOutput: {
          privateTelegramContentExposed: false,
          restrictedMetadataLeaked: false,
          liveNetworkScrapeStarted: false
        }
      });
      expect(inventoryBody.sourcePackWorker.proxyVerification.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "schema_present", status: "pass" }),
        expect.objectContaining({ id: "active_or_collection_rows_when_ready", status: "pass" }),
        expect.objectContaining({ id: "pack_ids_redacted", status: "pass" }),
        expect.objectContaining({ id: "rejected_candidates_redacted", status: "pass" }),
        expect.objectContaining({ id: "safe_output_no_restricted_metadata_leak", status: "pass" }),
        expect.objectContaining({ id: "safe_output_no_live_network", status: "pass" })
      ]));
      expect(inventoryBody.sourcePackWorker.proxyVerification.worker3JsonAssertions).toEqual(expect.arrayContaining([
        ".sourceInventory.sourcePackWorker.safeOutput.liveNetworkScrapeStarted == false",
        ".sourcePacks.proxyVerification.checks | any(.id == \"safe_output_no_live_network\" and .status == \"pass\")"
      ]));
      expect(JSON.stringify(inventoryBody.sourcePackWorker)).not.toContain("password-dump");

      expect(packs.status).toBe(200);
      expect(packsBody).toMatchObject({
        workerReadiness: { activeSourceRows: 2, collectionReadyRows: 2 },
        sourceGrowthCounters: { queuedCollectionTasks: 2, restrictedBlocked: 1 },
        readiness: { state: "ready" },
        proxyVerification: {
          schemaVersion: "dwm.source_pack_worker_proxy_verification.v1",
          state: "ready"
        },
        sourceHealth: {
          schemaVersion: "dwm.source_health_operations.v1",
          sourcePackGrowthDeltas: { activeSourceRows: 2, queuedCollectionReceipts: 2 },
          safeOutput: { liveNetworkScrapeStarted: false }
        },
        safeOutput: { rawTargetsExposed: false }
      });

      const stale = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-packs?terms=APT29&generatedAt=2030-01-01T00:00:00.000Z"), reloadedOptions);
      const staleBody = await stale.json() as any;
      expect(stale.status).toBe(200);
      expect(staleBody.readiness).toMatchObject({
        state: "stale",
        blockers: expect.arrayContaining(["source-pack worker last run is older than 120 minutes"])
      });
      expect(staleBody.proxyVerification).toMatchObject({
        state: "stale",
        safeOutput: { liveNetworkScrapeStarted: false }
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
