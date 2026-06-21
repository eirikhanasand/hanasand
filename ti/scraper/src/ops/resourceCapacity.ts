import type { ScraperResourceBudget } from "./config.ts";
import { DEFAULT_WORKER_MEMORY_MODEL } from "./resourceModel.ts";
import type { CapacityEstimate, WorkerMemoryModel } from "./resourceTypes.ts";

export function estimateCapacity(
  budget: ScraperResourceBudget,
  model: WorkerMemoryModel = DEFAULT_WORKER_MEMORY_MODEL
): CapacityEstimate {
  const collectionMb = budget.maxCollectionWorkers * model.collectionWorkerMb;
  const processingMb = budget.maxProcessingWorkers * model.processingWorkerMb;
  const telegramMb = budget.maxTelegramWorkers * model.telegramWorkerMb;
  const browserMb = budget.maxBrowserWorkers * model.browserWorkerMb;
  const darknetMetadataMb = budget.maxDarknetMetadataWorkers * model.darknetMetadataWorkerMb;
  const queueMb = Math.ceil((budget.maxQueueItems * model.queueItemKb) / 1024);
  const subtotal = model.apiMb + collectionMb + processingMb + telegramMb + browserMb + darknetMetadataMb + queueMb;
  const safetyMarginMb = Math.ceil(subtotal * (model.safetyMarginPercent / 100));
  const estimatedMb = subtotal + safetyMarginMb;
  const targetMb = budget.maxRamGb * 1024;
  const ceilingMb = budget.normalCeilingGb * 1024;

  return {
    estimatedMb,
    targetMb,
    ceilingMb,
    status: estimatedMb >= ceilingMb ? "critical" : estimatedMb >= targetMb * 0.8 ? "warn" : "ok",
    breakdown: {
      apiMb: model.apiMb,
      collectionMb,
      processingMb,
      telegramMb,
      browserMb,
      darknetMetadataMb,
      queueMb,
      safetyMarginMb
    }
  };
}
