import { describe, expect, test } from "bun:test";
import { publicCoverage } from "../api/publicCoverage.ts";
import { handleApiRequest } from "../api/server.ts";
import { source } from "./helpers/apiSourceFixtures.ts";

describe("public coverage", () => {
  test("keeps active registrations out of useful and qualifying coverage", async () => {
    const store: any = {
      listSources: () => [
        source({ id: "global_one", name: "Global one" }),
        source({ id: "global_two", name: "Global two" }),
        source({ id: "tenant_one", name: "Tenant one", tenantId: "tenant_a" }),
      ],
      listTimelinessRecords: () => [
        { id: "global_timing", latencies: { reportToAlertSeconds: 120 } },
        { id: "tenant_timing", tenantId: "tenant_a", latencies: { reportToAlertSeconds: 1 } },
      ],
      listSourceHealthObservations: () => [],
      listCaptures: () => [],
      listExtractedEntities: () => [],
      listEvaluationLabels: () => [],
    };
    const body = await publicCoverage({ store, frontier: {} as any });
    expect(body.registry).toEqual({ registeredSourceCount: 2, executableSourceCount: 2, inactiveSourceCount: 0 });
    expect(body.usefulCoverage).toMatchObject({ measurementState: "measured", everUsefulSourceCount: 0, sustainedUsefulSourceCount: 0, captureProducingSourceCount: 0 });
    expect(body.qualification).toMatchObject({ measurementState: "measured", counts: { clearWeb: 0, lawfulDarkWeb: 0, publicTelegram: 0, total: 0 }, gaps: { clearWeb: 5_000, lawfulDarkWeb: 1_000, publicTelegram: 100, total: 6_100 }, baselineMet: false });
    expect(body.observedAlertLatencySeconds).toMatchObject({ sampleCount: 1, medianSeconds: 120, p95Seconds: 120 });
    expect(body.collectionCadenceSeconds).toMatchObject({ status: "observed", sourceCount: 2, minimumSeconds: 3600, medianSeconds: 3600, maximumSeconds: 3600 });
    expect(JSON.stringify(body)).not.toContain("tenant_a");
  });

  test("does not publish zero qualification when persisted metrics are unavailable", async () => {
    const store: any = {
      querySourceOperationalPage: async () => ({ rows: [], total: 12, totals: { sourceCount: 12, activeSourceCount: 5, retainedSourceCount: 5, inactiveSourceCount: 7, operationalMetricsMeasured: false } }),
      listTimelinessRecords: () => [],
    };
    const body = await publicCoverage({ store, frontier: {} as any });
    expect(body.registry).toEqual({ registeredSourceCount: 12, executableSourceCount: 5, inactiveSourceCount: 7 });
    expect(body.usefulCoverage).toMatchObject({ measurementState: "not_measured", everUsefulSourceCount: null });
    expect(body.qualification).toMatchObject({ measurementState: "not_measured", counts: { clearWeb: null, lawfulDarkWeb: null, publicTelegram: null, total: null }, baselineMet: null });
  });

  test("uses the bounded PostgreSQL summary instead of the detailed source page", async () => {
    let summaryQueries = 0;
    const store: any = {
      querySourceOperationalSummary: async () => {
        summaryQueries += 1;
        return { summary: {
          measurementState: "measured",
          sourceCount: 1699,
          retainedSourceCount: 214,
          inactiveSourceCount: 1485,
          qualifyingClearWebSourceCount: 28,
          qualifyingLawfulDarkWebSourceCount: 4,
          qualifyingPublicTelegramSourceCount: 13
        } };
      },
      querySourceOperationalPage: async () => { throw new Error("detailed source page must not run"); },
      listSources: () => [],
      listTimelinessRecords: () => []
    };
    const body = await publicCoverage({ store, frontier: {} as any });
    expect(summaryQueries).toBe(1);
    expect(body.registry).toEqual({ registeredSourceCount: 1699, executableSourceCount: 214, inactiveSourceCount: 1485 });
    expect(body.qualification).toMatchObject({ counts: { clearWeb: 28, lawfulDarkWeb: 4, publicTelegram: 13, total: 45 }, gaps: { lawfulDarkWeb: 996 } });
  });

  test("prefers the public coverage storage summary when available", async () => {
    let genericSummaryCalled = false;
    const store: any = {
      queryPublicCoverageSummary: async () => ({ summary: { measurementState: "measured", sourceCount: 3, retainedSourceCount: 2, inactiveSourceCount: 1 } }),
      querySourceOperationalSummary: async () => { genericSummaryCalled = true; return { summary: {} }; },
      listSources: () => { throw new Error("public coverage must not enumerate sources"); },
      listTimelinessRecords: () => [],
      queryPublicCoverageLatency: async () => ({ status: "not_enough_observations", sampleCount: 0, medianSeconds: null, p95Seconds: null }),
      queryPublicCoverageCadence: async () => ({ status: "not_measured", sourceCount: 0, minimumSeconds: null, medianSeconds: null, maximumSeconds: null })
    };
    const body = await publicCoverage({ store, frontier: {} as any });
    expect(genericSummaryCalled).toBe(false);
    expect(body.registry).toEqual({ registeredSourceCount: 3, executableSourceCount: 2, inactiveSourceCount: 1 });
  });

  test("keeps historical usefulness separate from latest source health", async () => {
    const store: any = {
      querySourceOperationalSummary: async () => ({ summary: {
        measurementState: "measured",
        sourceCount: 1,
        retainedSourceCount: 1,
        inactiveSourceCount: 0,
        everUsefulSourceCount: 1,
        usefulSourceCount: 0,
        latestUsefulSourceCount: 0,
        captureProducingSourceCount: 0,
        qualifyingClearWebSourceCount: 0,
        qualifyingLawfulDarkWebSourceCount: 0,
        qualifyingPublicTelegramSourceCount: 0
      } }),
      listTimelinessRecords: () => []
    };

    const body = await publicCoverage({ store, frontier: {} as any });
    expect(body.usefulCoverage).toMatchObject({
      measurementState: "measured",
      everUsefulSourceCount: 1,
      currentlyUsefulSourceCount: 0,
      captureProducingSourceCount: 0
    });
  });

  test("uses the bounded persisted latency aggregate instead of enumerating history", async () => {
    let enumerated = false;
    const store: any = {
      querySourceOperationalSummary: async () => ({ summary: { measurementState: "not_measured", sourceCount: 0, retainedSourceCount: 0, inactiveSourceCount: 0 } }),
      queryPublicCoverageLatency: async () => ({ status: "observed", sampleCount: 2, medianSeconds: 4, p95Seconds: 8 }),
      listTimelinessRecords: () => { enumerated = true; return []; }
    };

    const body = await publicCoverage({ store, frontier: {} as any });
    expect(body.observedAlertLatencySeconds).toEqual({ status: "observed", sampleCount: 2, medianSeconds: 4, p95Seconds: 8 });
    expect(enumerated).toBe(false);
  });

  test("uses the bounded persisted cadence aggregate instead of enumerating sources", async () => {
    let enumerated = false;
    const store: any = {
      querySourceOperationalSummary: async () => ({ summary: { measurementState: "not_measured", sourceCount: 0, retainedSourceCount: 0, inactiveSourceCount: 0 } }),
      queryPublicCoverageCadence: async () => ({ status: "observed", sourceCount: 2, minimumSeconds: 60, medianSeconds: 3600, maximumSeconds: 86400 }),
      listSources: () => { enumerated = true; return []; },
      listTimelinessRecords: () => []
    };

    const body = await publicCoverage({ store, frontier: {} as any });
    expect(body.collectionCadenceSeconds).toEqual({ status: "observed", sourceCount: 2, minimumSeconds: 60, medianSeconds: 3600, maximumSeconds: 86400 });
    expect(enumerated).toBe(false);
  });

  test("does not publish qualification counts from an unmeasured raw PostgreSQL summary", async () => {
    const store: any = {
      querySourceOperationalSummary: async () => ({ summary: {
        operationalMetricsMeasured: false,
        sourceCount: 1699,
        retainedSourceCount: 214,
        inactiveSourceCount: 1485,
        qualifyingClearWebSourceCount: 28,
        qualifyingLawfulDarkWebSourceCount: 4,
        qualifyingPublicTelegramSourceCount: 13
      } }),
      listTimelinessRecords: () => []
    };

    const body = await publicCoverage({ store, frontier: {} as any });
    expect(body.usefulCoverage).toMatchObject({ measurementState: "not_measured", everUsefulSourceCount: null });
    expect(body.qualification).toMatchObject({ measurementState: "not_measured", counts: { clearWeb: null, lawfulDarkWeb: null, publicTelegram: null, total: null }, baselineMet: null });
  });

  test("is exposed as an unauthenticated read-only route", async () => {
    const store: any = { listSources: () => [], listTimelinessRecords: () => [] };
    const response = await handleApiRequest(new Request("http://local/v1/public/coverage"), { store, frontier: {} as any });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ schemaVersion: "public.coverage.v2", registry: { registeredSourceCount: 0 }, qualification: { counts: { total: 0 } } });
  });

  test("returns explicit unavailable on a coverage storage failure", async () => {
    const response = await handleApiRequest(new Request("http://local/v1/public/coverage"), {
      store: { querySourceOperationalSummary: async () => { throw new Error("coverage query timed out"); } } as any,
      frontier: {} as any
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "coverage_unavailable", message: "coverage query timed out" } });
  });
});
