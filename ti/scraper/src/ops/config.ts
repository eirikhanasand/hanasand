import { DEFAULT_RESOURCE_BUDGET, validateResourceBudget } from "./configBudget.ts";
import { booleanEnv, integerEnv, numberEnv, parseDeploymentTarget, parseEnv, parseLogLevel } from "./configEnv.ts";
export { DEFAULT_RESOURCE_BUDGET, validateResourceBudget } from "./configBudget.ts";
export type { ScraperResourceBudget, ScraperRuntimeConfig } from "./configTypes.ts";
import type { ScraperResourceBudget, ScraperRuntimeConfig } from "./configTypes.ts";

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
