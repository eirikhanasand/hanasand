import { startApiServer } from "../api/server.ts";
import { loadRuntimeConfig } from "../config/runtimeConfig.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { startCanaryCollectionLoop } from "../ops/canaryCollection.ts";
import { startRestrictedMetadataCollectionLoop } from "../ops/restrictedMetadataCollection.ts";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { createLogger } from "../ops/logger.ts";
import { FileObjectEvidenceStore } from "../storage/fileObjectStore.ts";
import { PostgresScraperStore } from "../storage/postgresScraperStore.ts";
import { enforceDefaultRetentionPolicies, normalizeDefaultRetentionClasses } from "../storage/retention.ts";
import { bootstrapRuntimeSources } from "./sourceBootstrap.ts";
import { buildRuntimeStores } from "./startupStores.ts";
import { executeScheduledCollectionRun, recoverCollectionRuns } from "../ops/scheduledCollection.ts";

export async function startScraperRuntime() {
  const config = loadRuntimeConfig();
  const logger = createLogger(Bun.env.SCRAPER_LOG_LEVEL === "debug" ? "debug" : "info");
  const paths = buildRuntimeStores(config);
  const store = await PostgresScraperStore.create();
  const legacyImport = await store.importLegacySnapshot(paths.evidenceMetadataPath);
  const objectStore = new FileObjectEvidenceStore({ rootDir: paths.evidenceObjectDir });
  const retentionAssignments = normalizeDefaultRetentionClasses(store);
  const retention = await enforceDefaultRetentionPolicies(store, objectStore);
  const frontier = new FocusedFrontier({
    maxQueueSize: Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500"),
    defaultPerSourceConcurrency: 1,
    crawlBudgetPolicies: { "public-canary": { taskLimit: Number(Bun.env.TI_CANARY_BUDGET_TASKS ?? "1000"), byteLimit: Number(Bun.env.TI_CANARY_BUDGET_BYTES ?? "512000000") } }
  });
  const sourceBootstrap = await bootstrapRuntimeSources(store as any);
  const canary = startCanaryCollectionLoop({
    store, frontier, objectStore,
    enabled: Bun.env.TI_CANARY_ENABLED !== "false",
    intervalSeconds: Number(Bun.env.TI_CANARY_INTERVAL_SECONDS ?? "300"),
    maxTasks: Number(Bun.env.TI_CANARY_MAX_TASKS ?? "25"),
    maxSources: Number(Bun.env.TI_CANARY_MAX_SOURCES ?? "50"),
    maxConcurrentTasks: Number(Bun.env.TI_CANARY_MAX_CONCURRENT_TASKS ?? "16"),
    timeoutMs: Number(Bun.env.TI_CANARY_TIMEOUT_MS ?? Bun.env.SCRAPER_DEFAULT_TIMEOUT_MS ?? "12000"),
    maxItemsPerTask: Number(Bun.env.TI_CANARY_MAX_ITEMS_PER_TASK ?? "4"),
    queueLimit: Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500"),
    operatorId: Bun.env.TI_CANARY_OPERATOR_ID ?? "startup-canary",
    activateSources: Bun.env.TI_CANARY_AUTO_ACTIVATE === "true",
    onCycle: (result) => logger.info("public canary collection cycle", { event: "canary.cycle", ...result }),
    onError: (error) => logger.warn("public canary collection failed", { event: "canary.error", error: error instanceof Error ? error.message : String(error) })
  });
  const restrictedEnabled = Bun.env.TI_RESTRICTED_METADATA_ENABLED === "true";
  const proxyUrl = Bun.env.TI_TOR_METADATA_PROXY;
  if (restrictedEnabled && !proxyUrl) throw new Error("TI_TOR_METADATA_PROXY is required when restricted metadata collection is enabled");
  const restrictedMetadata = startRestrictedMetadataCollectionLoop({
    store,
    boundary: proxyUrl ? new TorMetadataHttpBoundary({ proxyUrl }) : undefined,
    enabled: restrictedEnabled,
    intervalSeconds: Number(Bun.env.TI_RESTRICTED_METADATA_INTERVAL_SECONDS ?? "900"),
    maxSources: Number(Bun.env.TI_RESTRICTED_METADATA_MAX_SOURCES ?? "2"),
    onError: (error: unknown) => logger.warn("restricted metadata collection failed", { event: "restricted_metadata.error", error: error instanceof Error ? error.message : String(error) })
  });
  const runTimers = new Map<string, Timer>();
  const executeRun = (runId: string) => {
    const existingTimer = runTimers.get(runId);
    if (existingTimer) clearTimeout(existingTimer);
    runTimers.delete(runId);
    void executeScheduledCollectionRun({
      store,
      frontier,
      objectStore,
      maxConcurrentTasks: Math.min(4, Number(Bun.env.TI_CANARY_MAX_CONCURRENT_TASKS ?? "4")),
      timeoutMs: Number(Bun.env.TI_CANARY_TIMEOUT_MS ?? Bun.env.SCRAPER_DEFAULT_TIMEOUT_MS ?? "12000"),
      maxItemsPerTask: Number(Bun.env.TI_CANARY_MAX_ITEMS_PER_TASK ?? "4"),
    }, runId).then((run: any) => {
      if (run?.status !== "queued" || !run.nextAttemptAt) return;
      const delay = Math.max(0, Math.min(2_147_000_000, Date.parse(run.nextAttemptAt) - Date.now()));
      runTimers.set(runId, setTimeout(() => executeRun(runId), delay));
    }).catch((error) => logger.warn("scheduled collection run failed", { event: "scheduled_run.error", runId, error: error instanceof Error ? error.message : String(error) }));
  };
  const recoveredRuns = recoverCollectionRuns({ store, execute: executeRun });
  const server = startApiServer({ port: config.port, store, frontier, config, objectStore, canaryLoop: canary, restrictedMetadataLoop: restrictedMetadata, sourceBootstrap, runExecutor: executeRun });
  logger.info("ti-scraper started", { event: "service.started", port: server.port, apiVersion: config.apiVersion, memoryTargetMb: config.limits.maxMemoryMbTarget, memoryCeilingMb: config.limits.maxMemoryMbCeiling, storageBackend: "postgresql", storageSchema: "threat_intel", legacyImport, retentionAssignments, retentionMutations: retention.reduce((count, result) => count + result.deletionAudit.length, 0), publicCanaryEnabled: Bun.env.TI_CANARY_ENABLED !== "false", publicCanaryAutoActivate: Bun.env.TI_CANARY_AUTO_ACTIVATE === "true", recoveredRuns, sourceBootstrap, ...paths });
  return { stop: async () => { for (const timer of runTimers.values()) clearTimeout(timer); canary.stop(); restrictedMetadata.stop(); server.stop(); await store.close(); } };
}
