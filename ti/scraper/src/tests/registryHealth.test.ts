import { describe, expect, test } from "bun:test";
import { registry, seedSource } from "./helpers/registryFixtures.ts";

describe("source registry health", () => {
  test("records bounded health and source scoring inputs", () => {
    const store = registry();
    const source = store.upsert(seedSource({ id: "health_source" }));
    const updated = store.recordHealth(source.id, {
      status: "degraded",
      consecutiveFailures: 2,
      errorRate: 2,
      medianLatencyMs: 250
    });

    expect(updated.health?.errorRate).toBe(1);
    expect(updated.health?.consecutiveFailures).toBe(2);
    expect(updated.scoring?.reliability).toBe(0.7);
  });
});
