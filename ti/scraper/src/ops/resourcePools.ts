import type { ScraperResourceBudget } from "./config.ts";
import type { WorkerPoolSizing } from "./resourceTypes.ts";

export function sizeWorkerPools(
  budget: ScraperResourceBudget,
  pressure: "mvp" | "normal" | "max" = "normal"
): WorkerPoolSizing {
  const multiplier = pressure === "mvp" ? 0.5 : pressure === "max" ? 1 : 0.75;
  const browser = pressure === "mvp" ? 0 : Math.floor(budget.maxBrowserWorkers * multiplier);
  const darknetMetadata = Math.min(8, Math.max(0, Math.floor(budget.maxDarknetMetadataWorkers * multiplier)));
  const pools = {
    clearWeb: Math.max(1, Math.floor(budget.maxCollectionWorkers * multiplier)),
    processing: Math.max(1, Math.floor(budget.maxProcessingWorkers * multiplier)),
    telegram: Math.max(0, Math.floor(budget.maxTelegramWorkers * multiplier)),
    browser,
    darknetMetadata
  };

  return {
    ...pools,
    total: pools.clearWeb + pools.processing + pools.telegram + pools.browser + pools.darknetMetadata
  };
}
