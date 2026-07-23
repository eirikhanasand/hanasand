import type { ResourceSnapshotInput, RuntimeResourceSnapshot } from "./resourceTypes.ts";
import { bytesToMb } from "./resourceUtils.ts";

export function buildResourceSnapshot(input: ResourceSnapshotInput): RuntimeResourceSnapshot {
  const memory = input.memoryUsage ?? process.memoryUsage();
  const limits = input.config?.limits;
  const rssMb = bytesToMb(memory.rss);
  const containerCurrentMb = input.cgroup?.memoryCurrentBytes === undefined ? null : bytesToMb(input.cgroup.memoryCurrentBytes);
  const containerLimitMb = input.cgroup?.memoryMaxBytes === undefined ? null : bytesToMb(input.cgroup.memoryMaxBytes);
  const containerHeadroomMb = containerCurrentMb === null || containerLimitMb === null ? null : Math.max(0, containerLimitMb - containerCurrentMb);
  const measuredMb = containerCurrentMb ?? rssMb;
  const clearWeb = limits?.maxConcurrentClearWebTasks ?? null;
  const telegram = limits?.maxConcurrentTelegramTasks ?? null;
  const darknetMetadata = limits?.maxConcurrentDarknetMetadataTasks ?? null;

  return {
    configurationSource: limits ? "runtime_config" : "unavailable",
    memory: {
      rssMb,
      heapUsedMb: bytesToMb(memory.heapUsed),
      containerCurrentMb,
      containerLimitMb,
      containerHeadroomMb,
      targetMb: limits?.maxMemoryMbTarget ?? null,
      ceilingMb: limits?.maxMemoryMbCeiling ?? null,
      status: limits
        ? measuredMb >= limits.maxMemoryMbCeiling || containerLimitMb !== null && limits.maxMemoryMbCeiling >= containerLimitMb
          ? "critical"
          : measuredMb >= limits.maxMemoryMbTarget ? "warn" : "ok"
        : "unavailable"
    },
    cpu: {
      containerLimitCores: input.cgroup?.cpuQuotaMicros === undefined || !input.cgroup.cpuPeriodMicros
        ? null
        : input.cgroup.cpuQuotaMicros / input.cgroup.cpuPeriodMicros
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
