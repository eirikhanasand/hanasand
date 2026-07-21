import type { RuntimeConfig } from "../config/runtimeConfig.ts";

export type ResourceStatus = "ok" | "warn" | "critical" | "unavailable";

export interface ResourceSnapshotInput {
  config?: RuntimeConfig;
  queueItems?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface RuntimeResourceSnapshot {
  configurationSource: "runtime_config" | "unavailable";
  memory: {
    rssMb: number;
    heapUsedMb: number;
    targetMb: number | null;
    ceilingMb: number | null;
    status: ResourceStatus;
  };
  concurrency: {
    clearWeb: number | null;
    telegram: number | null;
    darknetMetadata: number | null;
    total: number | null;
  };
  queue: { currentItems: number };
}
