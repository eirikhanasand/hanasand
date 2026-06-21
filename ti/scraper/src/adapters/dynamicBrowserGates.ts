import { budget, gate, hasIsolation } from "./dynamicBrowserUtils.ts";

export function buildGates(input: any, fixtures: any[]) {
  const heavy = budget(input.pool);
  const holdFixtures = fixtures.some((fixture) => fixture.status === "hold");
  return [
    gate("explicit_approval", input.approval.explicitlyApproved ? "pass" : "hold"),
    gate("kill_switch", input.policy.killSwitchActive ? "hold" : "pass"),
    gate("robots_legal", input.policy.robotsAllowed && input.policy.legalNotesPresent ? "pass" : "hold"),
    gate("memory_cap", heavy.memoryBudgetStatus === "pass" ? "pass" : "watch"),
    gate("timeout_cap", heavy.timeoutBudgetStatus),
    gate("byte_cap", heavy.byteBudgetStatus),
    gate("queue_pressure", input.pool.currentQueueDepth > input.pool.queueMaxDepth ? "hold" : input.pool.currentQueueDepth > input.pool.queueMaxDepth * 0.7 ? "watch" : "pass"),
    gate("screenshot_hash_only", fixtures.every((f) => Boolean(f.screenshotHash) || f.status !== "pass") ? "pass" : "watch"),
    gate("isolation_hazards_blocked", fixtures.some((f) => hasIsolation(f.checks)) ? "hold" : "pass"),
    gate("browser_pool_isolated", "pass"),
    gate("storage_ephemeral", "pass"),
    gate("fixture_health", holdFixtures ? "hold" : fixtures.some((f) => f.status === "watch") ? "watch" : "pass")
  ];
}
