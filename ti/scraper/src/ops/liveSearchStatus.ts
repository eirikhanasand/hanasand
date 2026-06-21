// @ts-nocheck
import { DEFAULT_LIVE_SEARCH_SLO } from "./liveSearchDefaults.ts";
import { check, liveSearchAlerts } from "./liveSearchCheck.ts";

export function buildLiveSearchOpsDto(observation: any, slo = DEFAULT_LIVE_SEARCH_SLO) {
  const alerts = liveSearchAlerts(observation, slo);
  return {
    state: observation.state ?? "searching",
    slo,
    status: alerts.some((a) => a.severity === "critical") ? "critical" : alerts.length ? "warn" : "ok",
    recommendedPollIntervalMs: slo.recommendedPollIntervalMs,
    backpressure: { acceptNewRun: alerts.every((a) => a.severity !== "critical") },
    alerts
  };
}

export function recordLiveSearchMetrics(registry: any, observation: any): void {
  registry?.record?.("live_search.results", observation.resultCount ?? 0);
  registry?.record?.("live_search.failures", observation.providerFailures ?? 0);
}

export function evaluateLiveSearchMetricAlerts(observation: any, slo = DEFAULT_LIVE_SEARCH_SLO) {
  return liveSearchAlerts(observation, slo);
}

export function verifyLiveSearchDeployProbe(probe: any) {
  const checks = [
    check("public_ti", probe.publicTi?.status >= 200 && probe.publicTi?.status < 400, "public TI page responds"),
    check("api_search", probe.apiSearch?.status >= 200 && probe.apiSearch?.status < 400, "API search responds")
  ];
  return { ok: checks.every((item) => item.ok), checks };
}

export function assertLiveSearchDeployVerification(result: any): void {
  if (!result.ok) throw new Error(`live search deploy failed: ${result.checks?.filter((c: any) => !c.ok).map((c: any) => c.name).join(", ")}`);
}

export function estimateLiveSearchPollingImpact(clients: number, pollIntervalMs: number) {
  const requestsPerSecond = clients / Math.max(1, pollIntervalMs / 1_000);
  return { concurrentClients: clients, pollIntervalMs, requestsPerSecond, requestsPerMinute: requestsPerSecond * 60, estimatedQueueItemsPerMinute: requestsPerSecond * 60, estimatedMemoryMb: Math.ceil(clients * 0.5), status: requestsPerSecond > 200 ? "critical" : requestsPerSecond > 50 ? "warn" : "ok" };
}
