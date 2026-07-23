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
    expect(paused.lastControlAction).toMatchObject({ action: "pause", approvedBy: "service:hanasand-api", applied: true });
    expect(paused.operatorActions.find((item: any) => item.action === "resume")).toMatchObject({ enabled: true });

    const resumed = await json(await handleApiRequest(request({ action: "resume", approvedBy: "test" }), options as any));
    expect(resumed.scheduler.enabled).toBe(true);
    expect(resumed.scheduler.nextRunAt).toBe("2999-01-01T00:05:00.000Z");
    expect(resumed.lastControlAction).toMatchObject({ action: "resume", approvedBy: "service:hanasand-api", applied: true });
  });

  test("runs one scheduler cycle on demand without leasing network work in the test", async () => {
    let runs = 0;
    const options = optionsWithCanaryLoop({ runOnce: async () => { runs += 1; } });

    const body = await json(await handleApiRequest(request({ action: "run_now", approvedBy: "test" }), options as any));

    expect(runs).toBe(1);
    expect(body.lastControlAction).toMatchObject({ action: "run_now", approvedBy: "service:hanasand-api", applied: true });
  });

  test("requires trusted operator identity when authentication is configured", async () => {
    const options = optionsWithCanaryLoop();
    options.serviceToken = "scheduler-test-secret";

    const rejected = await handleApiRequest(request({ action: "pause", approvedBy: "spoofed" }, { "x-hanasand-service-token": "" }), options);
    expect(rejected.status).toBe(401);

    const accepted = await json(await handleApiRequest(request(
      { action: "pause", approvedBy: "spoofed" },
      { "x-hanasand-service-token": "scheduler-test-secret" }
    ), options));
    expect(accepted.lastControlAction).toMatchObject({ action: "pause", approvedBy: "service:hanasand-api", applied: true });
  });

  test("denies low roles and cross-tenant operators before scheduler state changes", async () => {
    const options = optionsWithCanaryLoop();
    options.serviceToken = undefined;
    options.authApiBase = "https://auth.example.test";
    options.authFetch = async (url: unknown) => {
      const id = decodeURIComponent(String(url).split("/").at(-1) ?? "");
      const role = id === "viewer" ? "viewer" : id === "source-operator" ? "source_operator" : "admin";
      return Response.json({ id, roles: [{ id: role }] });
    };
    options.store.listOrganizations = () => [
      { id: "org_a", tenantId: "tenant_a", status: "active" },
      { id: "org_b", tenantId: "tenant_b", status: "active" }
    ];
    options.store.listOrganizationMembers = () => [
      { id: "member_admin_a", organizationId: "org_a", userId: "admin-a", role: "admin", status: "active" }
    ];

    expect((await handleApiRequest(sessionGet("", "viewer"), options)).status).toBe(403);
    expect((await handleApiRequest(sessionPost({ action: "pause" }, "viewer"), options)).status).toBe(403);
    expect(options.canaryLoop.getState().enabled).toBe(true);
    expect((await handleApiRequest(sessionGet("", "admin-a"), options)).status).toBe(403);
    expect((await handleApiRequest(sessionGet("?tenantId=tenant_a", "admin-a", "tenant_a"), options)).status).toBe(200);
    expect((await handleApiRequest(sessionGet("?tenantId=tenant_b", "admin-a", "tenant_b"), options)).status).toBe(403);
    expect((await handleApiRequest(sessionGet("", "source-operator"), options)).status).toBe(200);
    expect((await handleApiRequest(sessionPost({ action: "pause" }, "source-operator"), options)).status).toBe(200);
    expect(options.canaryLoop.getState().enabled).toBe(false);
  });

  test("keeps global default and customer scheduler state in exact authenticated scopes", async () => {
    let globalRuns = 0;
    let defaultRuns = 0;
    const options = optionsWithCanaryLoop({ runOnce: async () => { globalRuns += 1; } });
    options.defaultCanaryLoop = loop(async () => { defaultRuns += 1; });
    options.store.listSources = () => [
      source({ id: "src_global", status: "active" }),
      source({ id: "src_default", tenantId: "default", status: "active" }),
      source({ id: "src_customer", tenantId: "customer_a", status: "active" })
    ];
    const tasks = ["global", "default", "customer_a"].map((tenantId) => ({
      task: { id: `task_${tenantId}`, sourceId: `src_${tenantId}`, tenantId: tenantId === "global" ? undefined : tenantId }
    }));
    options.frontier.snapshot = () => tasks;
    options.frontier.leasedSnapshot = () => tasks.map((item) => item.task);
    options.frontier.deadLetterSnapshot = () => tasks.map((item) => ({ ...item, taskId: item.task.id, reason: "test" }));

    const global = await json(await handleApiRequest(authenticatedGet(""), options));
    const defaults = await json(await handleApiRequest(authenticatedGet("?tenantId=default"), options));
    const customer = await json(await handleApiRequest(authenticatedGet("?tenantId=customer_a"), options));

    expect(global).toMatchObject({ tenantId: "global", total: 1, scheduler: { queue: { queued: 1, leased: 1, deadLetterCount: 1 } } });
    expect(defaults).toMatchObject({ tenantId: "default", total: 1, scheduler: { queue: { queued: 1, leased: 1, deadLetterCount: 1 } } });
    expect(customer).toMatchObject({ tenantId: "customer_a", total: 0, sourceCoverage: { retainedSourceCount: 1, activeSourceCount: 0, unscheduledExecutableSourceCount: 1 } });
    expect(global.sources.map((row: any) => row.sourceId)).toEqual(["src_global"]);
    expect(defaults.sources.map((row: any) => row.sourceId)).toEqual(["src_default"]);

    await handleApiRequest(request({ action: "run_now", tenantId: "default" }), options);
    expect({ globalRuns, defaultRuns }).toEqual({ globalRuns: 0, defaultRuns: 1 });
    expect((await handleApiRequest(request({ action: "run_now", tenantId: "customer_a" }), options)).status).toBe(409);
    expect((await handleApiRequest(new Request("http://localhost/v1/ops/collection-scheduler"), options)).status).toBe(401);
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
    canaryLoop,
    serviceToken: "scheduler-test-secret"
  };
}

function source(input: { id: string; tenantId?: string; status: string; lastCollectedAt?: string; lastErrorAt?: string; lastError?: string; backoffUntil?: string; retryCount?: number; parserStatus?: string }) {
  return {
    id: input.id,
    tenantId: input.tenantId,
    name: input.id,
    type: "rss",
    url: `https://example.test/${input.id}.xml`,
    accessMethod: "public_http",
    status: input.status,
    risk: "low",
    trustScore: 0.8,
    legalNotes: "Public RSS feed used by the scheduler regression.",
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

function loop(runOnce: () => Promise<void>) {
  return {
    getState: () => ({ enabled: true, running: false, intervalSeconds: 300, maxSources: 10, maxTasks: 5 }),
    setEnabled: () => {},
    runOnce
  };
}

function authenticatedGet(query: string) {
  return new Request(`http://localhost/v1/ops/collection-scheduler${query}`, {
    headers: { "x-hanasand-service-token": "scheduler-test-secret" }
  });
}

function sessionGet(query: string, id: string, tenantId?: string) {
  return new Request(`http://localhost/v1/ops/collection-scheduler${query}`, {
    headers: { authorization: `Bearer ${id}`, id, ...(tenantId ? { "x-tenant-id": tenantId } : {}) }
  });
}

function sessionPost(body: unknown, id: string, tenantId?: string) {
  return new Request("http://localhost/v1/ops/collection-scheduler", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: `Bearer ${id}`, id, ...(tenantId ? { "x-tenant-id": tenantId } : {}) }
  });
}

function request(body: unknown, headers: Record<string, string> = { "x-hanasand-service-token": "scheduler-test-secret" }) {
  return new Request("http://localhost/v1/ops/collection-scheduler", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers }
  });
}

async function json(response: Response) {
  return await response.json() as any;
}
