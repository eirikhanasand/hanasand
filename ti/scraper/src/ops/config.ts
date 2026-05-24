export interface ScraperResourceBudget {
  maxRamGb: number;
  normalCeilingGb: number;
  reservedDiskGb: number;
  maxCollectionWorkers: number;
  maxProcessingWorkers: number;
  maxTelegramWorkers: number;
  maxBrowserWorkers: number;
  maxDarknetMetadataWorkers: number;
  maxQueueItems: number;
}

export interface ScraperRuntimeConfig {
  env: "development" | "test" | "production";
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
  deploymentTarget: "local" | "inspur" | "other";
  browserWorkersEnabled: boolean;
  darknetMetadataWorkersEnabled: boolean;
  metricsEnabled: boolean;
  resourceBudget: ScraperResourceBudget;
}

export const DEFAULT_RESOURCE_BUDGET: ScraperResourceBudget = {
  maxRamGb: 96,
  normalCeilingGb: 160,
  reservedDiskGb: 500,
  maxCollectionWorkers: 64,
  maxProcessingWorkers: 16,
  maxTelegramWorkers: 8,
  maxBrowserWorkers: 0,
  maxDarknetMetadataWorkers: 2,
  maxQueueItems: 50_000
};

export function loadRuntimeConfig(env: Record<string, string | undefined> = Bun.env): ScraperRuntimeConfig {
  const resourceBudget: ScraperResourceBudget = {
    maxRamGb: numberEnv(env.SCRAPER_MAX_RAM_GB, DEFAULT_RESOURCE_BUDGET.maxRamGb),
    normalCeilingGb: numberEnv(env.SCRAPER_NORMAL_CEILING_GB, DEFAULT_RESOURCE_BUDGET.normalCeilingGb),
    reservedDiskGb: numberEnv(env.SCRAPER_RESERVED_DISK_GB, DEFAULT_RESOURCE_BUDGET.reservedDiskGb),
    maxCollectionWorkers: integerEnv(env.SCRAPER_COLLECTION_WORKERS, DEFAULT_RESOURCE_BUDGET.maxCollectionWorkers),
    maxProcessingWorkers: integerEnv(env.SCRAPER_PROCESSING_WORKERS, DEFAULT_RESOURCE_BUDGET.maxProcessingWorkers),
    maxTelegramWorkers: integerEnv(env.SCRAPER_TELEGRAM_WORKERS, DEFAULT_RESOURCE_BUDGET.maxTelegramWorkers),
    maxBrowserWorkers: integerEnv(env.SCRAPER_BROWSER_WORKERS, DEFAULT_RESOURCE_BUDGET.maxBrowserWorkers),
    maxDarknetMetadataWorkers: integerEnv(env.SCRAPER_DARKNET_METADATA_WORKERS, DEFAULT_RESOURCE_BUDGET.maxDarknetMetadataWorkers),
    maxQueueItems: integerEnv(env.SCRAPER_MAX_QUEUE_ITEMS, DEFAULT_RESOURCE_BUDGET.maxQueueItems)
  };

  validateResourceBudget(resourceBudget);

  return {
    env: parseEnv(env.NODE_ENV),
    port: integerEnv(env.SCRAPER_PORT, 8097),
    logLevel: parseLogLevel(env.SCRAPER_LOG_LEVEL),
    deploymentTarget: parseDeploymentTarget(env.SCRAPER_DEPLOYMENT_TARGET),
    browserWorkersEnabled: booleanEnv(env.SCRAPER_ENABLE_BROWSER_WORKERS, false),
    darknetMetadataWorkersEnabled: booleanEnv(env.SCRAPER_ENABLE_DARKNET_METADATA_WORKERS, false),
    metricsEnabled: booleanEnv(env.SCRAPER_ENABLE_METRICS, true),
    resourceBudget
  };
}

export function validateResourceBudget(budget: ScraperResourceBudget): void {
  if (budget.maxRamGb <= 0) throw new Error("SCRAPER_MAX_RAM_GB must be greater than 0");
  if (budget.normalCeilingGb < budget.maxRamGb) throw new Error("SCRAPER_NORMAL_CEILING_GB must be >= SCRAPER_MAX_RAM_GB");
  if (budget.maxRamGb > budget.normalCeilingGb) throw new Error("RAM budget exceeds normal ceiling");
  if (budget.normalCeilingGb > 160) throw new Error("normal scraper ceiling cannot exceed 160 GB without explicit reallocation");
  if (budget.reservedDiskGb < 500) throw new Error("SCRAPER_RESERVED_DISK_GB must reserve at least 500 GB");
  if (budget.maxCollectionWorkers < 1) throw new Error("SCRAPER_COLLECTION_WORKERS must be at least 1");
  if (budget.maxProcessingWorkers < 1) throw new Error("SCRAPER_PROCESSING_WORKERS must be at least 1");
  if (budget.maxTelegramWorkers < 0 || budget.maxBrowserWorkers < 0 || budget.maxDarknetMetadataWorkers < 0) {
    throw new Error("worker counts cannot be negative");
  }
  if (budget.maxDarknetMetadataWorkers > 8) throw new Error("darknet metadata concurrency should stay low");
  if (budget.maxQueueItems < 1) throw new Error("SCRAPER_MAX_QUEUE_ITEMS must be at least 1");
}

function numberEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric env value: ${value}`);
  return parsed;
}

function integerEnv(value: string | undefined, fallback: number): number {
  return Math.floor(numberEnv(value, fallback));
}

function booleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function parseEnv(value: string | undefined): ScraperRuntimeConfig["env"] {
  return value === "production" || value === "test" ? value : "development";
}

function parseLogLevel(value: string | undefined): ScraperRuntimeConfig["logLevel"] {
  return value === "debug" || value === "warn" || value === "error" ? value : "info";
}

function parseDeploymentTarget(value: string | undefined): ScraperRuntimeConfig["deploymentTarget"] {
  return value === "inspur" || value === "other" ? value : "local";
}
