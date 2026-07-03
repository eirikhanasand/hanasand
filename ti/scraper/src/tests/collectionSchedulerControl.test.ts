import { describe, expect, test } from "bun:test";
import { collectionSchedulerStatus } from "../api/collectionSchedulerStatus.ts";
import { handleApiRequest } from "../api/server.ts";

describe("collection scheduler control", () => {
  test("returns actionable scheduler blockers controls and per-source health", async () => {
    const options = optionsWithCanaryLoop({ enabled: true, runOnce: async () => {} });
    options.store.listSources = () => [
      source({ id: "src_healthy", status: "active", lastCollectedAt: new Date().toISOString(), parserStatus: "ready" }),
      source({ id: "src_retry", status: "active", lastErrorAt: "2026-07-02T08:00:00.000Z", backoffUntil: "2999-01-01T00:00:00.000Z", retryCount: 2, lastError: "HTTP 429", parserStatus: "degraded" }),
      source({ id: "src_stale", status: "canary", lastCollectedAt: "2026-01-01T00:00:00.000Z", parserStatus: "ready" })
    ];
    options.frontier.deadLetterSnapshot = () => [{ taskId: "task_dead", task: { sourceId: "src_retry" }, reason: "parser_timeout" }];

    const body = await json(collectionSchedulerStatus(options as any));

    expect(body.decision).not.toBe("operational");
    expect(body.operatorActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "pause", enabled: true, endpoint: "/v1/ops/collection-scheduler" }),
      expect.objectContaining({ action: "run_now", enabled: true, body: { action: "run_now" } })
    ]));
    expect(body.operationalBlockers.map((blocker: any) => blocker.code)).toEqual(expect.arrayContaining(["dead_letter_tasks"]));
    expect(body.sourceHealth).toMatchObject({ healthy: 1, retrying: 1, stale: 1 });
    expect(body.sources.find((item: any) => item.sourceId === "src_retry")).toMatchObject({
      healthState: "retrying",
      lastFailureReason: "HTTP 429",
      nextAction: "wait_for_backoff_or_manual_retry",
      parserStatus: "degraded"
    });
    expect(JSON.stringify(body)).not.toContain("rawPayload");
  });

  test("pauses and resumes the attached canary collection loop", async () => {
    const options = optionsWithCanaryLoop();

    const paused = await json(await handleApiRequest(request({ action: "pause", approvedBy: "test" }), options as any));
    expect(paused.scheduler.enabled).toBe(false);
    expect(paused.scheduler.nextRunAt).toBeUndefined();
    expect(paused.lastControlAction).toMatchObject({ action: "pause", approvedBy: "test", applied: true });
    expect(paused.operatorActions.find((item: any) => item.action === "resume")).toMatchObject({ enabled: true });

    const resumed = await json(await handleApiRequest(request({ action: "resume", approvedBy: "test" }), options as any));
    expect(resumed.scheduler.enabled).toBe(true);
    expect(resumed.scheduler.nextRunAt).toBe("2999-01-01T00:05:00.000Z");
    expect(resumed.lastControlAction).toMatchObject({ action: "resume", approvedBy: "test", applied: true });
  });

  test("runs one scheduler cycle on demand without leasing network work in the test", async () => {
    let runs = 0;
    const options = optionsWithCanaryLoop({ runOnce: async () => { runs += 1; } });

    const body = await json(await handleApiRequest(request({ action: "run_now", approvedBy: "test" }), options as any));

    expect(runs).toBe(1);
    expect(body.lastControlAction).toMatchObject({ action: "run_now", approvedBy: "test", applied: true });
  });
});

function optionsWithCanaryLoop(input: { enabled?: boolean; runOnce?: () => Promise<void> } = {}): any {
  let enabled = input.enabled ?? true;
  const canaryLoop = {
    getState: () => ({
      enabled,
      running: false,
      intervalSeconds: 300,
      maxSources: 50,
      maxTasks: 25,
      nextCycleAt: enabled ? "2999-01-01T00:05:00.000Z" : undefined
    }),
    setEnabled: (next: boolean) => {
      enabled = next;
      return canaryLoop.getState();
    },
    runOnce: input.runOnce ?? (async () => {})
  };
  return {
    store: {
      listSources: () => [source({ id: "src_default", status: "active", lastCollectedAt: new Date().toISOString() })],
      listRuns: () => [{ requestId: "req_public_canary", status: "completed", updatedAt: "2026-07-02T10:00:00.000Z" }]
    },
    frontier: { size: () => 0, snapshot: () => [], leasedSnapshot: () => [], deadLetterSnapshot: () => [] },
    canaryLoop
  };
}

function source(input: { id: string; status: string; lastCollectedAt?: string; lastErrorAt?: string; lastError?: string; backoffUntil?: string; retryCount?: number; parserStatus?: string }) {
  return {
    id: input.id,
    name: input.id,
    type: "rss",
    status: input.status,
    crawlFrequencySeconds: 3600,
    crawlState: {
      lastCollectedAt: input.lastCollectedAt,
      lastErrorAt: input.lastErrorAt,
      lastError: input.lastError,
      backoffUntil: input.backoffUntil,
      retryCount: input.retryCount ?? 0
    },
    health: { parserStatus: input.parserStatus ?? "ready" }
  };
}

function request(body: unknown) {
  return new Request("http://localhost/v1/ops/collection-scheduler", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

async function json(response: Response) {
  return await response.json() as any;
}
