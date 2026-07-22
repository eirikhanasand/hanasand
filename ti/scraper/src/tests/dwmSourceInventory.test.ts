import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { buildDwmSourceInventory } from "../product/dwmSourceInventory.ts";
import { FileBackedDwmSourcePackWorkerStateAdapter, InMemoryDwmSourcePackRegistryAdapter } from "../storage/dwmSourcePackRegistry.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

const generatedAt = "2026-06-27T12:00:00.000Z";

describe("dwm source inventory", () => {
  test("reports only registered executable sources and no generated candidates", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };
    store.saveSource({ id: "src_real", name: "Real source", type: "rss", url: "https://example.com/feed.xml", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.8, crawlFrequencySeconds: 3600, legalNotes: "Public defensive feed.", createdAt: generatedAt, updatedAt: generatedAt } as any);
    const inventoryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?watchlist=acme.com"), options);
    const inventoryBody = await inventoryResponse.json() as any;
    const packsResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-packs"), options);
    const packsBody = await packsResponse.json() as any;

    expect(inventoryBody.schemaVersion).toBe("dwm.source_inventory.v1");
    expect(inventoryBody.counts).toMatchObject({ registeredTotal: 1, registeredActiveOrCanary: 1, catalogTotalCandidates: 0, netNewCandidates: 0 });
    expect(buildDwmSourceInventory({ sources: store.listSources(), generatedAt }).reviewQueue).toEqual([]);
    expect(packsBody).toMatchObject({ packs: [], counts: { packCount: 0, candidateCount: 0 } });
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
      const inventory = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?tenantId=tenant_source_health&full=true&watchlist=APT29"), reloadedOptions);
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
      expect(inventoryBody.sourcePackWorker.sourceOperationsReadiness).toMatchObject({
        schemaVersion: "dwm.source_operations_readiness.v1",
        summary: {
          packCount: 1,
          candidateCount: 4,
          activeSourceCount: 1,
          retryableCount: 1,
          duplicateCount: 1,
          policyRejectedCount: 1
        },
        actionability: {
          canGrowSources: true,
          canRetry: true,
          canResolvePolicyRejected: true
        },
        safeOutput: { liveNetworkScrapeStarted: false, rawTargetsExposed: false }
      });
      expect(inventoryBody.sourcePackWorker.sourceOperationsReadiness.nextOperatorActions).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: "retry_candidate", priority: "high" }),
        expect.objectContaining({ action: "suppress_duplicate", priority: "medium" }),
        expect.objectContaining({ action: "review_policy_rejection", priority: "medium" })
      ]));
      expect(inventoryBody.sourcePackWorker.proxyVerification.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "source_health_present", status: "pass" }),
        expect.objectContaining({ id: "source_health_blockers_typed", status: "pass" }),
        expect.objectContaining({ id: "source_operations_readiness_present", status: "pass" }),
        expect.objectContaining({ id: "source_operations_next_actions_present", status: "pass" })
      ]));
      expect(packsBody.sourceHealth).toMatchObject({
        schemaVersion: "dwm.source_health_operations.v1",
        sourcePackGrowthDeltas: { queuedCollectionReceipts: 1 },
        safeOutput: { liveNetworkScrapeStarted: false }
      });
      expect(packsBody.sourceOperationsReadiness).toMatchObject({
        schemaVersion: "dwm.source_operations_readiness.v1",
        summary: { candidateCount: 4, activeSourceCount: 1 },
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

      const inventory = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?tenantId=tenant_inventory&full=true&watchlist=APT29"), reloadedOptions);
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
        ".sourceInventory.sourcePackWorker.sourceCustomerConfig.schemaVersion == \"dwm.source_pack_customer_config.v1\"",
        ".sourceInventory.sourcePackWorker.sourceCustomerConfig.sourceConfigs | all(.redactedIdentity.rawStored == false)",
        ".sourcePacks.proxyVerification.checks | any(.id == \"safe_output_no_live_network\" and .status == \"pass\")"
      ]));
      expect(inventoryBody.sourcePackWorker.sourceCustomerConfig).toMatchObject({
        schemaVersion: "dwm.source_pack_customer_config.v1",
        summary: {
          candidateCount: 4,
          activeSourceCount: 2,
          duplicateCount: 1,
          suppressedDuplicateCount: 0,
          policyRejectedCount: 1,
          restrictedSourceCount: 2,
          cleanupRequiredCount: 2,
          mutationReady: false
        },
        safeOutput: { liveNetworkScrapeStarted: false, rawTargetsExposed: false }
      });
      expect(inventoryBody.sourcePackWorker.sourceCustomerConfig.sourceConfigs).toEqual(expect.arrayContaining([
        expect.objectContaining({ family: "telegram", redactedIdentity: expect.objectContaining({ rawStored: false }) }),
        expect.objectContaining({ family: "darkweb_metadata", candidatePolicy: expect.objectContaining({ metadataOnly: true, restrictedSource: true }) }),
        expect.objectContaining({
          family: "darkweb_onion",
          typedBlockers: expect.arrayContaining([
            expect.objectContaining({ code: "rejected_policy" }),
            expect.objectContaining({ code: "restricted_source" })
          ])
        })
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
        sourceOperationsReadiness: {
          schemaVersion: "dwm.source_operations_readiness.v1",
          summary: { activeSourceCount: 2, candidateCount: 4 },
          actionability: { canGrowSources: true },
          safeOutput: { liveNetworkScrapeStarted: false }
        },
        sourceCustomerConfig: {
          schemaVersion: "dwm.source_pack_customer_config.v1",
          summary: { candidateCount: 4, activeSourceCount: 2, mutationReady: false },
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
      expect(staleBody.sourceOperationsReadiness).toMatchObject({
        summary: { staleWorker: true },
        actionability: { staleWorkerBlocksActions: true },
        typedBlockers: expect.arrayContaining([
          expect.objectContaining({ code: "stale_worker", severity: "blocking", retryable: true })
        ])
      });
      expect(staleBody.sourceCustomerConfig).toMatchObject({
        summary: { staleWorker: true },
        readiness: {
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: "stale_worker", severity: "blocking", retryable: true })
          ])
        },
        safeOutput: { liveNetworkScrapeStarted: false }
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
