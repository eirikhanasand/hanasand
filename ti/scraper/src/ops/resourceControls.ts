import type { ScraperResourceBudget } from "./config.ts";

export interface RuntimeResourceSnapshot {
  memory: {
    rssMb: number;
    heapUsedMb: number;
    maxRamGb: number;
    normalCeilingGb: number;
    status: "ok" | "warn" | "critical";
  };
  workers: {
    collection: number;
    processing: number;
    telegram: number;
    browser: number;
    darknetMetadata: number;
  };
  queue: {
    maxItems: number;
    currentItems: number;
    status: "ok" | "warn" | "critical";
  };
  disk: {
    reservedGb: number;
  };
}

export interface WorkerMemoryModel {
  apiMb: number;
  collectionWorkerMb: number;
  processingWorkerMb: number;
  telegramWorkerMb: number;
  browserWorkerMb: number;
  darknetMetadataWorkerMb: number;
  queueItemKb: number;
  safetyMarginPercent: number;
}

export interface CapacityEstimate {
  estimatedMb: number;
  targetMb: number;
  ceilingMb: number;
  status: "ok" | "warn" | "critical";
  breakdown: {
    apiMb: number;
    collectionMb: number;
    processingMb: number;
    telegramMb: number;
    browserMb: number;
    darknetMetadataMb: number;
    queueMb: number;
    safetyMarginMb: number;
  };
}

export interface ResourceSnapshotInput {
  budget: ScraperResourceBudget;
  queueItems?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export const DEFAULT_WORKER_MEMORY_MODEL: WorkerMemoryModel = {
  apiMb: 512,
  collectionWorkerMb: 96,
  processingWorkerMb: 512,
  telegramWorkerMb: 192,
  browserWorkerMb: 1536,
  darknetMetadataWorkerMb: 256,
  queueItemKb: 3,
  safetyMarginPercent: 25
};

export function buildResourceSnapshot(input: ResourceSnapshotInput): RuntimeResourceSnapshot {
  const memory = input.memoryUsage ?? process.memoryUsage();
  const rssMb = bytesToMb(memory.rss);
  const heapUsedMb = bytesToMb(memory.heapUsed);
  const maxRamMb = input.budget.maxRamGb * 1024;
  const queueItems = input.queueItems ?? 0;

  return {
    memory: {
      rssMb,
      heapUsedMb,
      maxRamGb: input.budget.maxRamGb,
      normalCeilingGb: input.budget.normalCeilingGb,
      status: statusForRatio(rssMb / maxRamMb)
    },
    workers: {
      collection: input.budget.maxCollectionWorkers,
      processing: input.budget.maxProcessingWorkers,
      telegram: input.budget.maxTelegramWorkers,
      browser: input.budget.maxBrowserWorkers,
      darknetMetadata: input.budget.maxDarknetMetadataWorkers
    },
    queue: {
      maxItems: input.budget.maxQueueItems,
      currentItems: queueItems,
      status: statusForRatio(queueItems / input.budget.maxQueueItems)
    },
    disk: {
      reservedGb: input.budget.reservedDiskGb
    }
  };
}

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

export interface WorkerPoolSizing {
  clearWeb: number;
  processing: number;
  telegram: number;
  browser: number;
  darknetMetadata: number;
  total: number;
}

export function sizeWorkerPools(budget: ScraperResourceBudget, pressure: "mvp" | "normal" | "max" = "normal"): WorkerPoolSizing {
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

export function assertCapacityWithinBudget(estimate: CapacityEstimate): void {
  if (estimate.estimatedMb > estimate.ceilingMb) {
    throw new Error(`estimated scraper capacity ${estimate.estimatedMb} MB exceeds normal ceiling ${estimate.ceilingMb} MB`);
  }
  if (estimate.estimatedMb > estimate.targetMb) {
    throw new Error(`estimated scraper capacity ${estimate.estimatedMb} MB exceeds target ${estimate.targetMb} MB`);
  }
}

export function assertWithinResourceBudget(snapshot: RuntimeResourceSnapshot): void {
  if (snapshot.memory.status === "critical") {
    throw new Error(`RSS memory ${snapshot.memory.rssMb} MB exceeds configured scraper budget`);
  }
  if (snapshot.queue.status === "critical") {
    throw new Error(`queue size ${snapshot.queue.currentItems} exceeds configured scraper budget`);
  }
}

function statusForRatio(ratio: number): "ok" | "warn" | "critical" {
  if (ratio >= 1) return "critical";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

function bytesToMb(value: number): number {
  return Math.round(value / 1024 / 1024);
}
