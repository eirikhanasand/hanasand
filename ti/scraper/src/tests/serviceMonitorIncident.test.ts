import { expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { stableId } from "../utils.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { api, body } from "./helpers/apiSourceFixtures.ts";

test("deduplicates sustained public service incidents, queues Hanasand AI once, retains evidence, and resolves on recovery", async () => {
  const store = new InMemoryScraperStore();
  const options = { store, serviceToken: "monitor-secret" } as any;
  const checks = ["Public Search", "Latest Activity"];
  const timestamps = [
    "2026-08-09T10:00:00.000Z",
    "2026-08-09T10:01:00.000Z",
    "2026-08-09T10:02:00.000Z",
  ];

  for (const checkName of checks) {
    const first = await post(options, {
      service: "threat-intelligence",
      checkName,
      status: "down",
      checkedAt: timestamps[2],
      incidentStartedAt: timestamps[0],
      latencyMs: 15_000,
      message: `${checkName} timed out`,
      consecutiveFailures: 3,
      observations: timestamps.map((checkedAt, index) => ({ status: "down", checkedAt, latencyMs: 15_000 + index, message: `${checkName} timed out`, consecutiveFailures: index + 1 })),
    });
    expect(first.status).toBe(201);
    expect(first.json.queued).toBe(1);

    const repeated = await post(options, {
      service: "threat-intelligence",
      checkName,
      status: "down",
      checkedAt: "2026-08-09T10:03:00.000Z",
      incidentStartedAt: timestamps[0],
      latencyMs: 15_500,
      message: `${checkName} timed out again`,
      consecutiveFailures: 4,
      observations: [{ status: "down", checkedAt: "2026-08-09T10:03:00.000Z", latencyMs: 15_500, message: `${checkName} timed out again`, consecutiveFailures: 4 }],
    });
    expect(repeated.json.queued).toBe(0);
    expect(repeated.json.incident.id).toBe(first.json.incident.id);

    const recovery = await post(options, {
      service: "threat-intelligence",
      checkName,
      status: "up",
      checkedAt: "2026-08-09T10:04:00.000Z",
      incidentStartedAt: timestamps[0],
      latencyMs: 42,
      message: "Recovered",
      consecutiveFailures: 0,
      observations: [{ status: "up", checkedAt: "2026-08-09T10:04:00.000Z", latencyMs: 42, message: "Recovered", consecutiveFailures: 0 }],
    });
    expect(recovery.json.incident.serviceMonitor).toMatchObject({
      service: "threat-intelligence",
      checkName,
      state: "resolved",
      lastStatus: "up",
      lastLatencyMs: 42,
      recoveryAt: "2026-08-09T10:04:00.000Z",
      consecutiveFailures: 0,
      evidenceCount: 5,
    });
  }

  const incidents = store.listIncidents().filter((incident: any) => incident.record?.serviceMonitor);
  expect(incidents).toHaveLength(2);
  const monitorSources = store.listSources().filter((source: any) => source.type === "service_monitor");
  expect(monitorSources).toHaveLength(1);
  expect(monitorSources[0].id).toBe(stableId("service-monitor-source", "https://hanasand.com/status"));
  expect(store.listAnalystMetadataReviewTasks().filter((item: any) => item.recordKind === "automatic_intelligence_review_task")).toHaveLength(2);
  for (const incident of incidents) {
    expect(store.listEvidenceLinks().filter((link: any) => link.subjectType === "incident" && link.subjectId === incident.id)).toHaveLength(5);
    expect(store.listCaptures().filter((capture: any) => capture.sourceId === incident.sourceId).map((capture: any) => capture.metadata?.safeExcerpt).join("\n")).toMatch(/consecutive failures/);
  }
});

async function post(options: any, input: Record<string, unknown>) {
  const response = await handleApiRequest(api("/v1/intel/service-monitor-incidents", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hanasand-service-token": "monitor-secret" },
    body: JSON.stringify(input),
  }), options);
  return { status: response.status, json: await body(response) as any };
}
