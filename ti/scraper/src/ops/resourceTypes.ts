import type { ScraperResourceBudget } from "./config.ts";

export interface RuntimeResourceSnapshot {
  memory: { rssMb: number; heapUsedMb: number; maxRamGb: number; normalCeilingGb: number; status: ResourceStatus };
  workers: { collection: number; processing: number; telegram: number; browser: number; darknetMetadata: number };
  queue: { maxItems: number; currentItems: number; status: ResourceStatus };
  disk: { reservedGb: number };
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
  status: ResourceStatus;
  breakdown: CapacityBreakdown;
}

export interface CapacityBreakdown {
  apiMb: number;
  collectionMb: number;
  processingMb: number;
  telegramMb: number;
  browserMb: number;
  darknetMetadataMb: number;
  queueMb: number;
  safetyMarginMb: number;
}

export interface ResourceSnapshotInput {
  budget: ScraperResourceBudget;
  queueItems?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface WorkerPoolSizing {
  clearWeb: number;
  processing: number;
  telegram: number;
  browser: number;
  darknetMetadata: number;
  total: number;
}

export type ResourceStatus = "ok" | "warn" | "critical";
