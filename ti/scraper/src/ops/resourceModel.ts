import type { WorkerMemoryModel } from "./resourceTypes.ts";

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
