import type { ResourceSnapshotInput, RuntimeResourceSnapshot } from "./resourceTypes.ts";
import { bytesToMb, statusForRatio } from "./resourceUtils.ts";

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
    disk: { reservedGb: input.budget.reservedDiskGb }
  };
}
