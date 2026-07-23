import type { RuntimeConfig } from "../config/runtimeConfig.ts";

export type ResourceStatus = "ok" | "warn" | "critical" | "unavailable";

export interface ResourceSnapshotInput {
  config?: RuntimeConfig;
  queueItems?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cgroup?: CgroupResourceSnapshot;
}

export interface CgroupResourceSnapshot {
  memoryCurrentBytes?: number;
  memoryMaxBytes?: number;
  cpuQuotaMicros?: number;
  cpuPeriodMicros?: number;
}

export interface RuntimeResourceSnapshot {
  configurationSource: "runtime_config" | "unavailable";
  memory: {
    rssMb: number;
    heapUsedMb: number;
    containerCurrentMb: number | null;
    containerLimitMb: number | null;
    containerHeadroomMb: number | null;
    targetMb: number | null;
    ceilingMb: number | null;
    status: ResourceStatus;
  };
  cpu: {
    containerLimitCores: number | null;
  };
  concurrency: {
    clearWeb: number | null;
    telegram: number | null;
    darknetMetadata: number | null;
    total: number | null;
  };
  queue: { currentItems: number };
}
