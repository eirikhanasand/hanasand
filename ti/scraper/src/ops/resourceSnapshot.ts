import type { ResourceSnapshotInput, RuntimeResourceSnapshot } from "./resourceTypes.ts";
import { bytesToMb } from "./resourceUtils.ts";

export function buildResourceSnapshot(input: ResourceSnapshotInput): RuntimeResourceSnapshot {
  const memory = input.memoryUsage ?? process.memoryUsage();
  const limits = input.config?.limits;
  const rssMb = bytesToMb(memory.rss);
  const clearWeb = limits?.maxConcurrentClearWebTasks ?? null;
  const telegram = limits?.maxConcurrentTelegramTasks ?? null;
  const darknetMetadata = limits?.maxConcurrentDarknetMetadataTasks ?? null;

  return {
    configurationSource: limits ? "runtime_config" : "unavailable",
    memory: {
      rssMb,
      heapUsedMb: bytesToMb(memory.heapUsed),
      targetMb: limits?.maxMemoryMbTarget ?? null,
      ceilingMb: limits?.maxMemoryMbCeiling ?? null,
      status: limits
        ? rssMb >= limits.maxMemoryMbCeiling ? "critical" : rssMb >= limits.maxMemoryMbTarget ? "warn" : "ok"
        : "unavailable"
    },
    concurrency: {
      clearWeb,
      telegram,
      darknetMetadata,
      total: clearWeb === null || telegram === null || darknetMetadata === null ? null : clearWeb + telegram + darknetMetadata
    },
    queue: { currentItems: Math.max(0, input.queueItems ?? 0) }
  };
}
