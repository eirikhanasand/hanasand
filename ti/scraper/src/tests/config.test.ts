import { describe, expect, test } from "bun:test";
import { loadRuntimeConfig } from "../config/runtimeConfig.ts";

describe("runtime config", () => {
  test("loads enterprise defaults", () => {
    const config = loadRuntimeConfig({});

    expect(config.apiVersion).toBe("v1");
    expect(config.limits.maxMemoryMbTarget).toBe(96 * 1024);
    expect(config.limits.maxMemoryMbCeiling).toBe(160 * 1024);
    expect(config.collection.darknetMetadataOnly).toBe(true);
  });

  test("falls back from invalid numeric values", () => {
    const config = loadRuntimeConfig({ SCRAPER_MAX_REQUEST_TASKS: "-1" });

    expect(config.limits.maxRequestTasks).toBe(500);
  });
});
