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
import { startAutomaticReviewWorker } from "../api/automaticReviewRoutes.ts";
import { startAutomaticEvaluationLoop } from "../api/evaluationBenchmarkRoutes.ts";
import { warmSearchCaptureIndexAsync } from "../api/searchCaptureIndex.ts";
import type { ApiServerOptions } from "../api/serverTypes.ts";

export function createScheduledRunBoundary(options: {
  execute: (runId: string) => Promise<any>;
  onError: (error: unknown, runId: string) => void;
}) {
  const timers = new Map<string, Timer>();
  const active = new Set<Promise<any>>();
  let stopping = false;
  const clearTimers = () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  };
  const execute = (runId: string): Promise<any> => {
    if (stopping) return Promise.resolve(undefined);
    const existingTimer = timers.get(runId);
    if (existingTimer) clearTimeout(existingTimer);
    timers.delete(runId);
    let execution: Promise<any>;
    try { execution = options.execute(runId); }
    catch (error) { execution = Promise.reject(error); }
    let tracked!: Promise<any>;
    tracked = execution
      .then((run) => {
        if (!stopping && run?.status === "queued" && run.nextAttemptAt) {
          const delay = Math.max(0, Math.min(2_147_000_000, Date.parse(run.nextAttemptAt) - Date.now()));
          timers.set(runId, setTimeout(() => {
            timers.delete(runId);
            if (!stopping) void execute(runId);
          }, delay));
        }
        return run;
      })
      .catch((error) => {
        options.onError(error, runId);
        throw error;
      })
      .finally(() => active.delete(tracked));
    active.add(tracked);
    void tracked.catch(() => undefined);
    return tracked;
  };
  return {
    execute,
    beginStopping: () => { stopping = true; clearTimers(); },
    drain: async () => {
      while (active.size) await Promise.allSettled([...active]);
      clearTimers();
    }
  };
}

type Stoppable = { stop: () => Promise<unknown> };

export function automaticEvaluationEnabled(env: Record<string, string | undefined> = Bun.env) {
  return env.TI_AUTOMATIC_EVALUATION_ENABLED === "true"
    && (env.SCRAPER_ENV !== "production" || env.TI_AUTOMATIC_EVALUATION_ALLOW_PRODUCTION === "true");
}

export function automaticReviewEnabled(env: Record<string, string | undefined> = Bun.env) {
  return env.HANASAND_AI_REVIEW_ENABLED === "true"
    && (env.SCRAPER_ENV !== "production" || env.HANASAND_AI_REVIEW_ALLOW_PRODUCTION === "true");
}

export function createScraperRuntimeStop(options: {
  scheduledRuns: { beginStopping: () => void; drain: () => Promise<void> };
  server: Stoppable;
  canary: Stoppable;
  defaultCanary?: Stoppable;
  restrictedMetadata: Stoppable;
  evaluation: Stoppable;
  automaticReview: Stoppable;
  store: { close: () => Promise<unknown> };
}) {
  let stopPromise: Promise<void> | undefined;
  return () => stopPromise ??= (async () => {
    options.scheduledRuns.beginStopping();
    await options.server.stop();
    await Promise.all([
      options.canary.stop(),
      options.defaultCanary?.stop(),
      options.restrictedMetadata.stop(),
      options.evaluation.stop(),
      options.automaticReview.stop(),
      options.scheduledRuns.drain()
    ]);
    await options.store.close();
  })();
}

export async function startScraperRuntime() {
  const startupAt = Date.now();
  const config = loadRuntimeConfig();
  const logger = createLogger(Bun.env.SCRAPER_LOG_LEVEL === "debug" ? "debug" : "info");
  const startupPhase = (phase: string, extra: Record<string, unknown> = {}) => logger.info("ti-scraper startup phase", { event: "service.startup_phase", phase, elapsedMs: Date.now() - startupAt, ...extra });
  startupPhase("config_loaded");
  const paths = buildRuntimeStores(config);
  startupPhase("runtime_stores_built");
  const runMaintenanceMigrations = Bun.env.TI_RUN_MAINTENANCE_MIGRATIONS === "true";
  const store = await PostgresScraperStore.create({ runMaintenanceMigrations, hydrate: false, deferHighVolumeHydration: true, deferStartupChecks: true, onStartupPhase: (phase) => startupPhase(`postgres_${phase}`) });
  startupPhase("postgres_maintenance_migrations", { enabled: runMaintenanceMigrations });
  startupPhase("postgres_store_created");
  const frontier = new FocusedFrontier({
    maxQueueSize: Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500"),
    defaultPerSourceConcurrency: 1,
    crawlBudgetPolicies: { "public-canary": { taskLimit: Number(Bun.env.TI_CANARY_BUDGET_TASKS ?? "1000"), byteLimit: Number(Bun.env.TI_CANARY_BUDGET_BYTES ?? "512000000") } }
  });
  const objectStore = new FileObjectEvidenceStore({ rootDir: paths.evidenceObjectDir });
  const serverOptions: ApiServerOptions = { port: config.port, store, frontier, config, objectStore, ready: false };
  const server = startApiServer(serverOptions);
  startupPhase("api_server_started", { port: server.port });
  const startupChecks = Promise.all([
    store.databaseHealth(),
    store.queryExposureQueuePage({ tenantId: "default", filters: {}, limit: 25, offset: 0, global: true })
  ]).then(() => startupPhase("postgres_health_checked"))
    .catch((error) => logger.warn("deferred postgres startup checks failed", { event: "postgres.startup_checks_failed", error: error instanceof Error ? error.message : String(error) }));
  const hydration = store.hydrateStartupData((phase) => startupPhase(`postgres_${phase}`));
  await Promise.all([hydration, startupChecks]);
  const legacyImport = await store.importLegacySnapshot(paths.evidenceMetadataPath);
  startupPhase("legacy_snapshot_checked", { imported: legacyImport.imported });
  const parserDiagnosticObjectCleanup = await store.purgeParserDiagnosticArchiveObjects(objectStore);
  startupPhase("parser_diagnostic_objects_cleaned", parserDiagnosticObjectCleanup);
  const retentionAssignments = normalizeDefaultRetentionClasses(store);
  const retention = await enforceDefaultRetentionPolicies(store, objectStore);
  startupPhase("retention_enforced", { retentionAssignments, retentionMutations: retention.reduce((count, result) => count + result.deletionAudit.length, 0) });
  const sourceBootstrap = await bootstrapRuntimeSources(store as any);
  startupPhase("sources_bootstrapped", { sourceCount: sourceBootstrap.totalSourceCount, importedSourceCount: sourceBootstrap.importedSourceCount });
  const scheduledRuns = createScheduledRunBoundary({
    execute: (runId) => executeScheduledCollectionRun({
      store,
      frontier,
      objectStore,
      maxConcurrentTasks: Math.min(4, Number(Bun.env.TI_CANARY_MAX_CONCURRENT_TASKS ?? "4")),
      timeoutMs: Number(Bun.env.TI_CANARY_TIMEOUT_MS ?? Bun.env.SCRAPER_DEFAULT_TIMEOUT_MS ?? "12000"),
      maxItemsPerTask: Number(Bun.env.TI_CANARY_MAX_ITEMS_PER_TASK ?? "4"),
    }, runId),
    onError: (error, runId) => logger.warn("scheduled collection run failed", { event: "scheduled_run.error", runId, error: error instanceof Error ? error.message : String(error) })
  });
  const executeRun = scheduledRuns.execute;
  const canaryEnabled = Bun.env.TI_CANARY_ENABLED !== "false";
  const defaultCanaryEnabled = canaryEnabled && Bun.env.TI_DEFAULT_CANARY_ENABLED !== "false";
  const collectionConcurrency = Math.max(2, Number(Bun.env.TI_CANARY_MAX_CONCURRENT_TASKS ?? "16"));
  const defaultCollectionConcurrency = defaultCanaryEnabled
    ? Math.min(collectionConcurrency - 1, Math.max(1, Number(Bun.env.TI_DEFAULT_CANARY_MAX_CONCURRENT_TASKS ?? "2")))
    : 0;
  const canaryOptions = {
    store, frontier, objectStore,
    intervalSeconds: Number(Bun.env.TI_CANARY_INTERVAL_SECONDS ?? "300"),
    maxTasks: Number(Bun.env.TI_CANARY_MAX_TASKS ?? "25"),
    maxSources: Number(Bun.env.TI_CANARY_MAX_SOURCES ?? "50"),
    maxConcurrentTasks: collectionConcurrency - defaultCollectionConcurrency,
    timeoutMs: Number(Bun.env.TI_CANARY_TIMEOUT_MS ?? Bun.env.SCRAPER_DEFAULT_TIMEOUT_MS ?? "12000"),
    maxItemsPerTask: Number(Bun.env.TI_CANARY_MAX_ITEMS_PER_TASK ?? "4"),
    queueLimit: Number(Bun.env.TI_CANARY_MAX_QUEUE_SIZE ?? "500"),
    // Cover every eligible public source unless an explicit family is configured.
    sourceFamily: Bun.env.TI_PRODUCTION_SOURCE_FAMILY || undefined,
    watchlistDiscoveryMaxJobs: Number(Bun.env.TI_WATCHLIST_DISCOVERY_MAX_JOBS ?? "1"),
    activateSources: Bun.env.TI_CANARY_AUTO_ACTIVATE === "true",
    runExecutor: executeRun
  };
  const canary = startCanaryCollectionLoop({
    ...canaryOptions,
    enabled: canaryEnabled,
    operatorId: Bun.env.TI_CANARY_OPERATOR_ID ?? "startup-canary",
    onCycle: (result) => logger.info("public canary collection cycle", { event: "canary.cycle", ...result }),
    onError: (error) => logger.warn("public canary collection failed", { event: "canary.error", error: error instanceof Error ? error.message : String(error) })
  });
  const defaultCanary = startCanaryCollectionLoop({
    ...canaryOptions,
    tenantId: "default",
    includeSharedSources: false,
    scheduleWatchlistDiscovery: false,
    enabled: defaultCanaryEnabled,
    maxSources: Math.max(1, Number(Bun.env.TI_DEFAULT_CANARY_MAX_SOURCES ?? "60")),
    maxTasks: Math.max(1, Number(Bun.env.TI_DEFAULT_CANARY_MAX_TASKS ?? "60")),
    maxConcurrentTasks: defaultCollectionConcurrency || 1,
    operatorId: Bun.env.TI_DEFAULT_CANARY_OPERATOR_ID ?? "startup-default-canary",
    onCycle: (result) => logger.info("default-tenant public canary collection cycle", { event: "canary.default.cycle", ...result }),
    onError: (error) => logger.warn("default-tenant public canary collection failed", { event: "canary.default.error", error: error instanceof Error ? error.message : String(error) })
  });
  const restrictedEnabled = Bun.env.TI_RESTRICTED_METADATA_ENABLED === "true";
  const proxyUrl = Bun.env.TI_TOR_METADATA_PROXY;
  if (restrictedEnabled && !proxyUrl) throw new Error("TI_TOR_METADATA_PROXY is required when restricted metadata collection is enabled");
  const restrictedBoundary = proxyUrl ? new TorMetadataHttpBoundary({ proxyUrl }) : undefined;
  const restrictedMetadata = startRestrictedMetadataCollectionLoop({
    store,
    boundary: restrictedBoundary,
    enabled: restrictedEnabled,
    intervalSeconds: Number(Bun.env.TI_RESTRICTED_METADATA_INTERVAL_SECONDS ?? "900"),
    maxSources: Number(Bun.env.TI_RESTRICTED_METADATA_MAX_SOURCES ?? "300"),
    maxConcurrentSources: Math.max(1, Math.min(
      config.limits.maxConcurrentDarknetMetadataTasks,
      restrictedBoundary?.config.maxConcurrency ?? 1
    )),
    onError: (error: unknown) => logger.warn("restricted metadata collection failed", { event: "restricted_metadata.error", error: error instanceof Error ? error.message : String(error) })
  });
  const recoveredRuns = recoverCollectionRuns({ store, execute: executeRun });
  const evaluation = startAutomaticEvaluationLoop({
    store,
    enabled: automaticEvaluationEnabled(),
    intervalSeconds: Number(Bun.env.TI_AUTOMATIC_EVALUATION_INTERVAL_SECONDS ?? "60"),
    maxTasks: Number(Bun.env.TI_AUTOMATIC_EVALUATION_MAX_TASKS_PER_CYCLE ?? "2"),
    sampleSize: Number(Bun.env.TI_AUTOMATIC_EVALUATION_SAMPLE_SIZE ?? "50"),
    timeoutMs: Number(Bun.env.HANASAND_AI_EVALUATION_TIMEOUT_MS ?? "30000"),
    onCycle: (result) => logger.info("automatic evaluation cycle", { event: "automatic_evaluation.cycle", ...result }),
    onError: (error: unknown) => logger.warn("automatic evaluation cycle failed", { event: "automatic_evaluation.error", error: error instanceof Error ? error.message : String(error) })
  });
  Object.assign(serverOptions, { ready: true, canaryLoop: canary, defaultCanaryLoop: defaultCanary, restrictedMetadataLoop: restrictedMetadata, evaluationLoop: evaluation, sourceBootstrap, runExecutor: executeRun });
  // ponytail: warm the common global inventory page once; later reads are served
  // from the bounded five-second backend cache instead of repeating cold joins.
  // ponytail: cache warming must never delay listener startup or make health fail.
  void store.querySourceOperationalPage?.({ generatedAt: new Date().toISOString(), limit: 50, offset: 0, executableOnly: false, sort: "source", direction: "asc" })
    ?.catch((error) => logger.warn("source inventory warm failed", { event: "source_inventory.warm_failed", error: error instanceof Error ? error.message : String(error) }));
  startupPhase("search_index_warm_queued");
  setTimeout(() => void warmSearchCaptureIndexAsync(store)
    .then((result) => startupPhase("search_index_built", result))
    .catch((error) => logger.error("search index warm failed", { event: "search_index.warm_failed", error: error instanceof Error ? error.message : String(error) })), 0);
  startupPhase("runtime_workers_started");
  const automaticReview = automaticReviewEnabled()
    ? startAutomaticReviewWorker({ store, frontier, config } as any, {
      intervalMs: Number(Bun.env.HANASAND_AI_REVIEW_INTERVAL_MS ?? "60000"),
      limit: Number(Bun.env.HANASAND_AI_REVIEW_MAX_TASKS_PER_CYCLE ?? "10"),
      concurrency: Number(Bun.env.HANASAND_AI_REVIEW_CONCURRENCY ?? "3"),
      onCycle: (result) => logger.info("automatic intelligence review cycle", { event: "automatic_review.cycle", ...result }),
      onError: (error: unknown) => logger.warn("automatic intelligence review cycle failed", { event: "automatic_review.error", error: error instanceof Error ? error.message : String(error) })
    })
    : { stop: async () => undefined };
  logger.info("ti-scraper started", { event: "service.started", port: server.port, apiVersion: config.apiVersion, memoryTargetMb: config.limits.maxMemoryMbTarget, memoryCeilingMb: config.limits.maxMemoryMbCeiling, storageBackend: "postgresql", storageSchema: "threat_intel", legacyImport, retentionAssignments, retentionMutations: retention.reduce((count, result) => count + result.deletionAudit.length, 0), publicCanaryEnabled: canaryEnabled, defaultCanaryEnabled, collectionConcurrency, publicCanaryAutoActivate: Bun.env.TI_CANARY_AUTO_ACTIVATE === "true", automaticEvaluationEnabled: automaticEvaluationEnabled(), recoveredRuns, sourceBootstrap, ...paths });
  return { stop: createScraperRuntimeStop({ scheduledRuns, server, canary, defaultCanary, restrictedMetadata, evaluation, automaticReview, store }) };
}
