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

  test("is exposed as an unauthenticated read-only route", async () => {
    const store: any = { listSources: () => [], listTimelinessRecords: () => [] };
    const response = await handleApiRequest(new Request("http://local/v1/public/coverage"), { store, frontier: {} as any });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ schemaVersion: "public.coverage.v2", registry: { registeredSourceCount: 0 }, qualification: { counts: { total: 0 } } });
  });
});
