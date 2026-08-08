import { describe, expect, test } from "bun:test";
import { publicCoverage } from "../api/publicCoverage.ts";
import { handleApiRequest } from "../api/server.ts";

describe("public coverage", () => {
  test("publishes aggregate global coverage and excludes tenant records", () => {
    const at = "2026-08-08T00:00:00.000Z";
    const store: any = {
      listSources: () => [
        { id: "global_one", type: "rss", status: "active", crawlFrequencySeconds: 3600, lastSeenAt: at, catalog: { collection: { freshnessTargetSeconds: 7200 }, publisher: { country: "NO" } }, metadata: { sourceFamily: "advisory" } },
        { id: "global_two", type: "static_web", status: "active", crawlFrequencySeconds: 7200, catalog: { collection: { freshnessTargetSeconds: 14400 }, publisher: { country: "US" } }, metadata: { sourceFamily: "advisory" } },
        { id: "tenant_one", tenantId: "tenant_a", type: "rss", status: "active", crawlFrequencySeconds: 1 },
      ],
      listTimelinessRecords: () => [
        { id: "global_timing", latencies: { reportToAlertSeconds: 120 } },
        { id: "tenant_timing", tenantId: "tenant_a", latencies: { reportToAlertSeconds: 1 } },
      ],
    };
    const body = publicCoverage({ store, frontier: {} as any });
    expect(body.sources.total).toBe(2);
    expect(body.sources.families).toEqual({ advisory: 2 });
    expect(body.sources.regions).toEqual({ NO: 1, US: 1 });
    expect(body.observedAlertLatencySeconds).toMatchObject({ sampleCount: 1, medianSeconds: 120, p95Seconds: 120 });
    expect(JSON.stringify(body)).not.toContain("tenant_a");
  });

  test("is exposed as an unauthenticated read-only route", async () => {
    const store: any = { listSources: () => [], listTimelinessRecords: () => [] };
    const response = await handleApiRequest(new Request("http://local/v1/public/coverage"), { store, frontier: {} as any });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ schemaVersion: "public.coverage.v1", sources: { total: 0 } });
  });
});
