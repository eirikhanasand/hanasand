import { describe, expect, test } from "bun:test";
import { loadRuntimeConfig } from "../config/runtimeConfig.ts";

describe("runtime config", () => {
  test("loads enterprise defaults", () => {
    const config = loadRuntimeConfig({});

    expect(config.apiVersion).toBe("v1");
    expect(config.limits.maxMemoryMbTarget).toBe(8 * 1024);
    expect(config.limits.maxMemoryMbCeiling).toBe(14 * 1024);
    expect(config.collection.darknetMetadataOnly).toBe(true);
    expect(config.scheduler.queueBackend).toBe("embedded_memory");
    expect(config.scheduler.postgresQueueEnabled).toBe(false);
    expect(config.scheduler.postgresLeaseMode).toBe("disabled");
  });

  test("falls back from invalid numeric values", () => {
    const config = loadRuntimeConfig({ SCRAPER_MAX_REQUEST_TASKS: "-1" });

    expect(config.limits.maxRequestTasks).toBe(500);
  });

  test("keeps postgres scheduler backend disabled unless explicitly enabled", () => {
    const requested = loadRuntimeConfig({
      SCRAPER_SCHEDULER_QUEUE_BACKEND: "postgres_scheduler_store"
    });
    const shadow = loadRuntimeConfig({
      SCRAPER_SCHEDULER_QUEUE_BACKEND: "postgres_scheduler_store",
      SCRAPER_SCHEDULER_POSTGRES_QUEUE_ENABLED: "true",
      SCRAPER_SCHEDULER_POSTGRES_SHADOW_WRITES_ENABLED: "true",
      SCRAPER_SCHEDULER_POSTGRES_DSN: "postgres://scheduler@example.invalid/ti"
    });

    expect(requested.scheduler.queueBackend).toBe("postgres_scheduler_store");
    expect(requested.scheduler.postgresQueueEnabled).toBe(false);
    expect(requested.scheduler.postgresDsnConfigured).toBe(false);
    expect(requested.scheduler.postgresLeaseMode).toBe("disabled");
    expect(shadow.scheduler.postgresQueueEnabled).toBe(true);
    expect(shadow.scheduler.postgresDsnConfigured).toBe(true);
    expect(shadow.scheduler.postgresShadowWritesEnabled).toBe(true);
    expect(shadow.scheduler.postgresLeaseMode).toBe("shadow");
  });
});
