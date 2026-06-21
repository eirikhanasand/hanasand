import type { ScraperResourceBudget } from "./configTypes.ts";

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
