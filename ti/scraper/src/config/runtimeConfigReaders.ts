import type {
  CollectionDefaults,
  ResourceLimits,
  RuntimeConfig,
  SchedulerRuntimeDefaults
} from "./runtimeConfigTypes.ts";

export function readResourceLimits(env: Record<string, string | undefined>): ResourceLimits {
  return {
    maxRequestTasks: readInt(env.SCRAPER_MAX_REQUEST_TASKS, 500),
    maxTaskBytes: readInt(env.SCRAPER_MAX_TASK_BYTES, 10 * 1024 * 1024),
    maxConcurrentClearWebTasks: readInt(env.SCRAPER_CLEAR_WEB_CONCURRENCY, 64),
    maxConcurrentTelegramTasks: readInt(env.SCRAPER_TELEGRAM_CONCURRENCY, 8),
    maxConcurrentDarknetMetadataTasks: readInt(env.SCRAPER_DARKNET_METADATA_CONCURRENCY, 4),
    maxMemoryMbTarget: readInt(env.SCRAPER_MEMORY_TARGET_MB, 96 * 1024),
    maxMemoryMbCeiling: readInt(env.SCRAPER_MEMORY_CEILING_MB, 160 * 1024)
  };
}

export function readCollectionDefaults(env: Record<string, string | undefined>): CollectionDefaults {
  return {
    userAgent: env.SCRAPER_USER_AGENT ?? "ti-scraper/0.1 public-cti-research",
    defaultTimeoutMs: readInt(env.SCRAPER_DEFAULT_TIMEOUT_MS, 30_000),
    highRiskRequiresApproval: readBoolean(env.SCRAPER_HIGH_RISK_REQUIRES_APPROVAL, true),
    darknetMetadataOnly: readBoolean(env.SCRAPER_DARKNET_METADATA_ONLY, true)
  };
}

export function readSchedulerRuntimeDefaults(env: Record<string, string | undefined>): SchedulerRuntimeDefaults {
  const postgresQueueEnabled = readBoolean(env.SCRAPER_SCHEDULER_POSTGRES_QUEUE_ENABLED, false);
  const postgresShadowWritesEnabled = readBoolean(env.SCRAPER_SCHEDULER_POSTGRES_SHADOW_WRITES_ENABLED, false);
  return {
    queueBackend: env.SCRAPER_SCHEDULER_QUEUE_BACKEND === "postgres_scheduler_store" ? "postgres_scheduler_store" : "embedded_memory",
    postgresQueueEnabled,
    postgresDsnConfigured: Boolean(env.SCRAPER_SCHEDULER_POSTGRES_DSN),
    postgresShadowWritesEnabled,
    postgresLeaseMode: postgresQueueEnabled ? postgresShadowWritesEnabled ? "shadow" : "active" : "disabled"
  };
}

export function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

export function readEnvironment(value: string | undefined): RuntimeConfig["environment"] {
  if (value === "development" || value === "staging" || value === "production") return value;
  return "local";
}
