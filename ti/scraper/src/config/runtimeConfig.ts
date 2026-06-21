import type { RuntimeConfig } from "./runtimeConfigTypes.ts";
import {
  readCollectionDefaults,
  readEnvironment,
  readInt,
  readResourceLimits,
  readSchedulerRuntimeDefaults
} from "./runtimeConfigReaders.ts";

export type {
  CollectionDefaults,
  ResourceLimits,
  RuntimeConfig,
  SchedulerRuntimeDefaults
} from "./runtimeConfigTypes.ts";

export function loadRuntimeConfig(env: Record<string, string | undefined> = Bun.env): RuntimeConfig {
  return {
    serviceName: "ti-scraper",
    apiVersion: "v1",
    port: readInt(env.SCRAPER_PORT, 8097),
    environment: readEnvironment(env.SCRAPER_ENV),
    limits: readResourceLimits(env),
    collection: readCollectionDefaults(env),
    scheduler: readSchedulerRuntimeDefaults(env)
  };
}
